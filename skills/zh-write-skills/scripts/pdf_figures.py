#!/usr/bin/env python3
"""Reproducibly export and validate figure crops from a PDF manifest."""
from __future__ import annotations

import argparse
import hashlib
import json
import sys
from pathlib import Path

try:
    import fitz
except ImportError as exc:
    raise SystemExit("PyMuPDF is required: python3 -m pip install pymupdf") from exc


def fail(message: str) -> None:
    raise SystemExit(message)


def inside(root: Path, path: Path) -> bool:
    try:
        path.resolve().relative_to(root.resolve())
        return True
    except ValueError:
        return False


def ink_bounds(pix: fitz.Pixmap, threshold: int = 245) -> tuple[int, int, int, int] | None:
    channels = pix.n
    samples = memoryview(pix.samples)
    left, top, right, bottom = pix.width, pix.height, -1, -1
    for y in range(pix.height):
        row = y * pix.stride
        for x in range(pix.width):
            offset = row + x * channels
            if min(samples[offset:offset + min(channels, 3)]) < threshold:
                left, top = min(left, x), min(top, y)
                right, bottom = max(right, x), max(bottom, y)
    return None if right < 0 else (left, top, right + 1, bottom + 1)


def load_manifest(path: Path) -> tuple[dict, Path, Path]:
    try:
        manifest = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        fail(f"Cannot read manifest {path}: {exc}")
    root = path.resolve().parent
    pdf = (root / manifest.get("pdf", "")).resolve()
    if not inside(root, pdf) or not pdf.is_file():
        fail("pdf must resolve to a file inside the manifest directory")
    figures = manifest.get("figures")
    if manifest.get("version") != 1 or not isinstance(figures, list) or not figures:
        fail("manifest requires version 1 and a non-empty figures array")
    return manifest, root, pdf


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("manifest", type=Path)
    parser.add_argument("--check", action="store_true", help="validate existing files without rewriting")
    args = parser.parse_args()
    manifest, root, pdf_path = load_manifest(args.manifest)
    expected_pdf_hash = manifest.get("pdfSha256")
    actual_pdf_hash = hashlib.sha256(pdf_path.read_bytes()).hexdigest()
    if expected_pdf_hash != actual_pdf_hash:
        fail(f"PDF hash mismatch: expected {expected_pdf_hash!r}, got {actual_pdf_hash}")

    document = fitz.open(pdf_path)
    scale = manifest.get("scale", 3)
    if not isinstance(scale, (int, float)) or not 1 <= scale <= 8:
        fail("scale must be between 1 and 8")
    failures = []
    for index, item in enumerate(manifest["figures"], 1):
        label = item.get("sourceFigure", f"figure {index}")
        page_number = item.get("page")
        crop = item.get("crop")
        output = (root / item.get("output", "")).resolve()
        if not isinstance(page_number, int) or not 1 <= page_number <= len(document):
            failures.append(f"{label}: invalid 1-based page number")
            continue
        if not isinstance(crop, list) or len(crop) != 4 or not all(isinstance(v, (int, float)) for v in crop):
            failures.append(f"{label}: crop must be [x0, y0, x1, y1] in PDF points")
            continue
        if not inside(root, output) or output.suffix.lower() != ".png":
            failures.append(f"{label}: output must be a PNG inside the manifest directory")
            continue
        page = document[page_number - 1]
        rect = fitz.Rect(*crop)
        if rect.is_empty or not page.rect.contains(rect):
            failures.append(f"{label}: crop is empty or outside page bounds {page.rect}")
            continue
        caption = item.get("captionPrefix")
        if caption:
            matches = page.search_for(caption)
            if not matches:
                failures.append(f"{label}: caption prefix not found on page: {caption!r}")
                continue
            if any(rect.intersects(match) for match in matches):
                failures.append(f"{label}: crop intersects the paper caption")
                continue
        pix = page.get_pixmap(matrix=fitz.Matrix(scale, scale), clip=rect, alpha=False)
        if pix.width < 600:
            failures.append(f"{label}: output is only {pix.width}px wide; increase scale")
            continue
        bounds = ink_bounds(pix)
        if bounds is None:
            failures.append(f"{label}: crop contains no visible content")
            continue
        margin = max(3, round(scale))
        left, top, right, bottom = bounds
        if left < margin or top < margin or pix.width - right < margin or pix.height - bottom < margin:
            failures.append(f"{label}: visible content touches a crop edge; expand the crop")
            continue
        if args.check:
            if not output.is_file():
                failures.append(f"{label}: missing output {output.relative_to(root)}")
            else:
                existing = fitz.Pixmap(str(output))
                if (existing.width, existing.height, hashlib.sha256(output.read_bytes()).hexdigest()) != (
                    pix.width, pix.height, hashlib.sha256(pix.tobytes("png")).hexdigest()
                ):
                    failures.append(f"{label}: output is stale; regenerate it")
        else:
            output.parent.mkdir(parents=True, exist_ok=True)
            pix.save(output)
            print(f"Exported {label}: {output.relative_to(root)} ({pix.width}x{pix.height})")

    if failures:
        print("\n".join(failures), file=sys.stderr)
        raise SystemExit(2)
    print(f"Validated {len(manifest['figures'])} PDF figure crops")


if __name__ == "__main__":
    main()
