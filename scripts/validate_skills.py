#!/usr/bin/env python3
from pathlib import Path
import re
root = Path(__file__).resolve().parents[1] / "skills"
errors = []
for skill in sorted(root.glob("*/SKILL.md")):
    text = skill.read_text()
    match = re.match(r"^---\n(.*?)\n---\n", text, re.S)
    if not match:
        errors.append(f"{skill}: missing YAML frontmatter")
        continue
    frontmatter = match.group(1)
    for key in ("name:", "description:"):
        if key not in frontmatter: errors.append(f"{skill}: missing {key[:-1]}")
    for link in re.findall(r"\]\((references/[^)]+)\)", text):
        if not (skill.parent / link).exists(): errors.append(f"{skill}: missing linked file {link}")
if errors:
    raise SystemExit("\n".join(errors))
print(f"Validated {len(list(root.glob('*/SKILL.md')))} skills")
