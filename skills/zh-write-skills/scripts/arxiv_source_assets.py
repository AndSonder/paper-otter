#!/usr/bin/env python3
"""Download pinned arXiv source; safely unpack and index unverified figure candidates."""
import argparse
import gzip
import hashlib
import io
import json
import re
import tarfile
import time
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path, PurePosixPath
from urllib.parse import urljoin, urlparse
from urllib.request import Request, urlopen

MAX_DOWNLOAD = 32 * 1024 * 1024
MAX_EXPANDED = 128 * 1024 * 1024
MAX_FILE = 32 * 1024 * 1024
MAX_MEMBERS = 4000
IMAGE_SUFFIXES = {'.pdf', '.png', '.jpg', '.jpeg', '.eps', '.svg', '.ps'}


def sha256(body):
    return hashlib.sha256(body).hexdigest()


def write_json(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')


class Links(HTMLParser):
    def __init__(self):
        super().__init__()
        self.links = []

    def handle_starttag(self, tag, attrs):
        if tag == 'a':
            self.links.append(dict(attrs))


def download(url, limit=MAX_DOWNLOAD):
    if urlparse(url).hostname != 'arxiv.org' or urlparse(url).scheme != 'https':
        raise ValueError('Download must use https://arxiv.org')
    request = Request(url, headers={'User-Agent': 'PaperSourceReader/1.0 (single-paper research)'})
    with urlopen(request, timeout=45) as response:
        if urlparse(response.url).hostname != 'arxiv.org':
            raise ValueError('Unexpected download redirect')
        body = response.read(limit + 1)
        if len(body) > limit:
            raise ValueError('Download exceeds byte limit')
        return body, {'requested_url': url, 'final_url': response.url,
                      'content_type': response.headers.get('Content-Type'),
                      'bytes': len(body), 'sha256': sha256(body)}


def source_links(abstract, abstract_url, version):
    parser = Links()
    parser.feed(abstract.decode('utf-8'))
    source = next((urljoin(abstract_url, a['href']) for a in parser.links
                   if a.get('href', '').endswith('/src/' + version)), None)
    license_url = next((a['href'] for a in parser.links
                        if a.get('title') == 'Rights to this article'), None)
    if source is None:
        raise ValueError('No pinned TeX Source link found; inspect Other formats manually')
    return source, license_url


def unpack_source(body, destination):
    """Validate every tar member before writing; never invoke TeX or archive extraction."""
    if destination.exists():
        raise ValueError('Extraction destination must be new')
    if body.startswith(b'\x1f\x8b'):
        with gzip.GzipFile(fileobj=io.BytesIO(body)) as compressed:
            body = compressed.read(MAX_EXPANDED + 1)
    if len(body) > MAX_EXPANDED:
        raise ValueError('Expanded source exceeds byte limit')
    try:
        archive = tarfile.open(fileobj=io.BytesIO(body), mode='r:')
    except tarfile.ReadError:
        if len(body) > MAX_FILE or b'\\document' not in body or b'\x00' in body:
            raise ValueError('Source is neither supported tar nor single TeX file')
        destination.mkdir()
        (destination / 'source.tex').write_bytes(body)
        return
    members, seen, total = [], set(), 0
    with archive:
        for member in archive:
            if len(members) >= MAX_MEMBERS:
                raise ValueError('Archive exceeds member count limit')
            path = PurePosixPath(member.name)
            if (path.is_absolute() or '..' in path.parts or '\\' in member.name
                    or not path.parts or path.as_posix() in seen):
                raise ValueError('Unsafe or duplicate archive path: ' + member.name)
            if not (member.isfile() or member.isdir()) or member.issparse():
                raise ValueError('Links, devices, sparse and special files are forbidden')
            total += member.size
            if member.size < 0 or member.size > MAX_FILE or total > MAX_EXPANDED:
                raise ValueError('Archive exceeds file/total size limit')
            seen.add(path.as_posix())
            members.append(member)
        destination.mkdir()
        for member in members:
            target = destination.joinpath(*PurePosixPath(member.name).parts)
            if not target.resolve().is_relative_to(destination.resolve()):
                raise ValueError('Archive path escapes destination')
            if member.isdir():
                target.mkdir(parents=True, exist_ok=True)
            else:
                target.parent.mkdir(parents=True, exist_ok=True)
                with archive.extractfile(member) as source, target.open('xb') as output:
                    output.write(source.read(MAX_FILE + 1))


def braced_argument(text, start):
    """Read nested braces without expanding commands; preserve raw TeX caption."""
    depth = 1
    for index in range(start, len(text)):
        if index and text[index - 1] == '\\':
            continue
        depth += (text[index] == '{') - (text[index] == '}')
        if depth == 0:
            return text[start:index]
    return None


def command_arguments(text, name):
    pattern = r'\\' + name + r'\*?(?:\s*\[[^\]]*\])?\s*\{'
    return [(match.start(), braced_argument(text, match.end()))
            for match in re.finditer(pattern, text)]


def index_figures(root):
    assets = [p for p in root.rglob('*') if p.suffix.lower() in IMAGE_SUFFIXES]
    candidates = []
    for tex in sorted(root.rglob('*.tex')):
        raw = tex.read_text(errors='replace')
        # Preserve offsets for line numbers while ignoring ordinary TeX comments.
        text = re.sub(r'(?<!\\)%[^\n]*', lambda m: ' ' * len(m[0]), raw)
        pattern = r'\\begin\{figure\*?\}(.*?)\\end\{figure\*?\}'
        for match in re.finditer(pattern, text, re.S):
            block = match.group(1)
            references = []
            for offset, reference in command_arguments(block, 'includegraphics'):
                if reference is None:
                    continue
                normalized = reference.removeprefix('./')
                possible = [p for p in assets if
                            p.relative_to(root).as_posix() == normalized
                            or p.relative_to(root).with_suffix('').as_posix() == normalized
                            or p.name == normalized or p.stem == normalized]
                references.append({'reference': reference,
                                   'line': text.count('\n', 0, match.start(1) + offset) + 1,
                                   'candidate_assets': [str(p.relative_to(root)) for p in possible]})
            captions = [{'raw_tex': caption,
                         'line': text.count('\n', 0, match.start(1) + offset) + 1}
                        for offset, caption in command_arguments(block, 'caption')]
            candidates.append({'status': 'automatic_candidate_not_verified',
                               'tex_file': str(tex.relative_to(root)),
                               'figure_environment_line': text.count('\n', 0, match.start()) + 1,
                               'labels': [label for _, label in command_arguments(block, 'label')],
                               'captions': captions, 'graphics': references})
    return candidates


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('version', help='Pinned modern arXiv identifier, e.g. 2205.14135v2')
    parser.add_argument('output', type=Path, help='New output directory')
    args = parser.parse_args()
    if not re.fullmatch(r'\d{4}\.\d{4,5}v[1-9]\d*', args.version):
        parser.error('A version-pinned modern arXiv identifier is required')
    args.output.mkdir(parents=True, exist_ok=False)
    manifest = {'version': args.version, 'retrieved_at': datetime.now(timezone.utc).isoformat(),
                'status': 'started', 'verification': 'No figures manually verified by this script'}
    try:
        abstract_url = 'https://arxiv.org/abs/' + args.version
        abstract, manifest['abstract'] = download(abstract_url, 2 * 1024 * 1024)
        (args.output / 'abstract.html').write_bytes(abstract)
        source_url, manifest['license_url'] = source_links(abstract, abstract_url, args.version)
        manifest['source_url_discovered_in_abstract'] = source_url
        time.sleep(3)
        source, manifest['source'] = download(source_url)
        (args.output / 'source.download').write_bytes(source)
        unpack_source(source, args.output / 'source')
        write_json(args.output / 'figure-candidates.json', index_figures(args.output / 'source'))
        manifest['status'] = 'source_downloaded_and_indexed'
    except Exception as error:
        manifest['status'] = 'failed'
        manifest['error'] = f'{type(error).__name__}: {error}'
        raise
    finally:
        write_json(args.output / 'manifest.json', manifest)
    print(args.output / 'manifest.json')


if __name__ == '__main__':
    main()
