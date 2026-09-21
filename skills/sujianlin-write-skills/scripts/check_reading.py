#!/usr/bin/env python3
"""Locate likely Markdown delivery defects; never score or rewrite prose.

This is a small heuristic checker, not a Markdown/TeX renderer. It checks inline
Markdown images (including angle-bracket paths and optional quoted titles), but
not reference images, HTML, nested alt brackets or nested destination parentheses.
Root-relative image paths resolve on the filesystem, not a website. Remote images
are never fetched. Code fences, indented code and backtick spans are ignored.
Recognized math delimiters: $...$, $$...$$, \\(...\\), \\[...\\]. Paired dollar
amounts can look like math; delimiter balance and mathematical correctness are
not validated by the default check. Bare-command/subscript findings are warnings
for human review. --katex-module optionally renders recognized math with an
existing local KaTeX package via Node. This detects parser errors, not layout,
mathematical correctness, or unsupported Markdown conventions.

Exit status: 0 = no findings; 1 = warnings only; 2 = errors (including input I/O).
"""

import argparse
import json
import re
import sys
import subprocess
from pathlib import Path
from typing import NamedTuple
from urllib.parse import unquote, urlsplit


class Finding(NamedTuple):
    line: int
    severity: str
    message: str


IMAGE = re.compile(
    r'(?<!\\)!\[(?P<alt>(?:\\.|[^\]\\\n])*)\]\('
    r'\s*(?:<(?P<angle>[^>\n]*)>|(?P<plain>[^\s()]*))'
    r'''(?:\s+(?:"[^"\n]*"|'[^'\n]*'))?\s*\)'''
)
MATH = re.compile(
    r'(?<!\\)\$\$[\s\S]*?(?<!\\)\$\$'
    r'|(?<![\\$])\$(?!\$)[^\n$]*?(?<!\\)\$(?!\$)'
    r'|(?<!\\)\\\([\s\S]*?\\\)'
    r'|(?<!\\)\\\[[\s\S]*?\\\]'
)
BARE_MATH = re.compile(
    r'(?<!\\)\\[A-Za-z]+'
    r'|[A-Za-z0-9]+[_^]\{[^}\n]+\}'
    r'|\b[A-Za-z]+_[A-Za-z0-9]+(?=\()'
)
UNESCAPED_TEX_COMMAND = re.compile(
    r'(?<![\\A-Za-z])'
    r'(?:mathrm|mathbf|mathcal|operatorname|nabla|lambda|sigma|epsilon|theta|beta)'
    r'(?=$|[^A-Za-z])'
)
PAREN_MATH = re.compile(
    r'(?<![\\\w])\('
    r'(?:[A-Za-z](?:_[A-Za-z0-9{}]+)?(?:\^[A-Za-z0-9{}]+)?'
    r'|[^()\n]*(?:\\[A-Za-z]+|[_^=<>])[^()\n]*)'
    r'\)'
)


def blank(text):
    """Preserve offsets and line numbers while hiding ignored syntax."""
    return re.sub(r'[^\n]', ' ', text)


def without_code(text):
    lines = []
    fence = None
    for line in text.splitlines(keepends=True):
        marker = re.match(r'^ {0,3}(`{3,}|~{3,})(.*)', line)
        if fence:
            lines.append(blank(line))
            if marker:
                run, suffix = marker.groups()
                if run[0] == fence[0] and len(run) >= len(fence) and not suffix.strip():
                    fence = None
        elif marker:
            fence = marker.group(1)
            lines.append(blank(line))
        elif line.startswith(('    ', '\t')):
            lines.append(blank(line))
        else:
            lines.append(line)
    # Matching backtick run lengths allow literal backticks inside code spans.
    return re.sub(
        r'(?<!`)(`+)(?!`)[\s\S]*?(?<!`)\1(?!`)',
        lambda match: blank(match.group()), ''.join(lines),
    )


def image_findings(text, markdown_path):
    for match in IMAGE.finditer(text):
        line = text.count('\n', 0, match.start()) + 1
        if not match.group('alt').strip():
            yield Finding(line, 'warning', 'image has empty alt text')
        target = match.group('angle')
        if target is None:
            target = match.group('plain')
        try:
            parts = urlsplit(target)
        except ValueError:
            yield Finding(line, 'warning', 'cannot interpret image target: ' + target)
            continue
        if parts.scheme or parts.netloc:
            continue
        local_path = unquote(parts.path)
        if not local_path:
            yield Finding(line, 'error', 'image has no local file target')
            continue
        local_path = re.sub(r'\\([ !#()\[\]])', r'\1', local_path)
        if not (markdown_path.parent / local_path).is_file():
            yield Finding(line, 'error', 'local image file does not exist: ' + target)


KATEX_CHECK = r"""
const fs = require('node:fs');
const katex = require(process.argv[1]);
const expressions = JSON.parse(fs.readFileSync(0, 'utf8'));
const failures = [];
for (const expression of expressions) {
    try {
        katex.renderToString(expression.tex, {
            displayMode: expression.display,
            throwOnError: true,
            strict: 'ignore',
            trust: false,
        });
    } catch (error) {
        failures.push({line: expression.line, message: error.message});
    }
}
process.stdout.write(JSON.stringify(failures));
"""


def math_render_findings(text, katex_module):
    expressions = []
    for match in MATH.finditer(text):
        raw = match.group()
        width = 1 if raw.startswith('$') and not raw.startswith('$$') else 2
        expressions.append({
            'line': text.count('\n', 0, match.start()) + 1,
            'tex': raw[width:-width],
            'display': raw.startswith(('$$', r'\[')),
        })
    try:
        result = subprocess.run(
            ['node', '-e', KATEX_CHECK, str(katex_module.resolve())],
            input=json.dumps(expressions), text=True, capture_output=True,
            timeout=60, check=True,
        )
        failures = json.loads(result.stdout)
    except (OSError, subprocess.SubprocessError, json.JSONDecodeError) as error:
        detail = getattr(error, 'stderr', None) or str(error)
        if isinstance(detail, bytes):
            detail = detail.decode('utf-8', errors='replace')
        return [Finding(1, 'error', 'math renderer could not run: ' + detail.strip())]
    return [Finding(item['line'], 'error', item['message']) for item in failures]


def math_markup_findings(text):
    for math_match in MATH.finditer(text):
        raw = math_match.group()
        for command_match in UNESCAPED_TEX_COMMAND.finditer(raw):
            offset = math_match.start() + command_match.start()
            yield Finding(
                text.count('\n', 0, offset) + 1,
                'warning',
                'possible TeX command missing backslash: ' + command_match.group(),
            )


def check_reading(markdown_path, katex_module=None):
    text = without_code(markdown_path.read_text(encoding='utf-8'))
    findings = list(image_findings(text, markdown_path))
    findings.extend(math_markup_findings(text))
    if katex_module is not None:
        findings.extend(math_render_findings(text, katex_module))
    prose = IMAGE.sub(lambda match: blank(match.group()), text)
    # Ignore destinations and bare URLs so URL underscores do not imply math.
    prose = re.sub(r'\]\([^\n)]*\)', lambda match: blank(match.group()), prose)
    prose = re.sub(r'(?:https?://|www\.)[^\s<>]+', lambda match: blank(match.group()), prose)
    prose = MATH.sub(lambda match: blank(match.group()), prose)
    for match in PAREN_MATH.finditer(prose):
        findings.append(Finding(
            prose.count('\n', 0, match.start()) + 1,
            'warning', 'possible math written in plain parentheses: ' + match.group(),
        ))
    for match in BARE_MATH.finditer(prose):
        findings.append(Finding(
            prose.count('\n', 0, match.start()) + 1,
            'warning', 'possible math outside delimiters: ' + match.group(),
        ))
    return sorted(findings, key=lambda finding: finding.line)


def main():
    parser = argparse.ArgumentParser(description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('markdown', type=Path, help='local UTF-8 Markdown file')
    parser.add_argument('--katex-module', type=Path,
                        help='existing local KaTeX package directory; requires Node')
    args = parser.parse_args()
    try:
        findings = check_reading(args.markdown, args.katex_module)
    except (OSError, UnicodeError) as error:
        print('{}: error: {}'.format(args.markdown, error), file=sys.stderr)
        return 2
    for finding in findings:
        print('{}:{}: {}: {}'.format(args.markdown, *finding))
    if not findings:
        scope = 'heuristic and KaTeX parser checks; not page layout' if args.katex_module else 'heuristic check only'
        print('{}: no findings ({})'.format(args.markdown, scope))
    if any(finding.severity == 'error' for finding in findings):
        return 2
    return 1 if findings else 0


if __name__ == '__main__':
    sys.exit(main())
