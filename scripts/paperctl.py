#!/usr/bin/env python3
"""Manage the local, private data consumed by the paper-daily reader."""
from __future__ import annotations
import argparse, hashlib, json, os, shutil
from datetime import datetime, timezone
from pathlib import Path
ROOT = Path(os.environ.get("PAPER_DAILY_ROOT", Path(__file__).resolve().parents[1])).resolve()
STATE = ROOT / ".paper-daily"
CATALOG = ROOT / "public" / "local" / "catalog.json"
REQUIRED_PROFILE = {"version", "reader", "goals", "topics", "reading", "recommendation"}
REQUIRED_PAPER = {"id", "title", "englishTitle", "year", "tags", "minutes", "reason", "source"}
WRITING_FILES = {"article.md", "evidence.md", "logic-draft.md", "logic-review.md", "reader-draft.md", "reader-report.md", "revision-notes.md"}
WRITING_STAGES = ["evidence", "logic-draft", "logic-review", "reader-draft", "reader-report", "revision-notes", "article"]
STAGE_FILES = {stage: f"{stage}.md" for stage in WRITING_STAGES}

def load_json(path: Path) -> dict:
    try: value = json.loads(path.read_text())
    except (OSError, json.JSONDecodeError) as exc: raise SystemExit(f"Cannot read valid JSON from {path}: {exc}") from exc
    if not isinstance(value, dict): raise SystemExit(f"Expected a JSON object in {path}")
    return value

def validate_profile(profile: dict) -> None:
    missing = sorted(REQUIRED_PROFILE - profile.keys())
    if missing: raise SystemExit(f"Profile is missing keys: {', '.join(missing)}")
    if profile.get("version") != 1: raise SystemExit("Only profile version 1 is supported")
    minutes = profile.get("reading", {}).get("dailyMinutes")
    if not isinstance(minutes, int) or not 5 <= minutes <= 180: raise SystemExit("reading.dailyMinutes must be an integer from 5 to 180")

def initialize(profile_path: Path) -> None:
    profile = load_json(profile_path); validate_profile(profile)
    STATE.mkdir(exist_ok=True)
    for folder in ("papers", "daily", "candidates"): (STATE / folder).mkdir(exist_ok=True)
    (STATE / "profile.json").write_text(json.dumps(profile, ensure_ascii=False, indent=2) + "\n")
    (STATE / "events.jsonl").touch(exist_ok=True)
    inferences = STATE / "inferences.json"
    if not inferences.exists(): inferences.write_text("[]\n")
    print(f"Initialized private reading workspace at {STATE}")

def validate_paper(metadata: dict, path: Path) -> None:
    missing = sorted(REQUIRED_PAPER - metadata.keys())
    if missing: raise SystemExit(f"{path} is missing keys: {', '.join(missing)}")
    if not isinstance(metadata["year"], str): raise SystemExit(f"{path}: year must be a string")
    if not isinstance(metadata["tags"], list) or not all(isinstance(v, str) for v in metadata["tags"]): raise SystemExit(f"{path}: tags must be a string array")
    terms = metadata.get("terms", [])
    if not isinstance(terms, list) or not all(isinstance(term, dict) and isinstance(term.get("name"), str) and isinstance(term.get("meaning"), str) for term in terms):
        raise SystemExit(f"{path}: terms must contain name and meaning strings")

def reviewed_article(paper_dir: Path) -> str:
    article = paper_dir / "article.md"
    manifest_path = paper_dir / "writing.json"
    if not article.exists() and not manifest_path.exists(): return ""
    if not article.exists() or not manifest_path.exists():
        raise SystemExit(f"{paper_dir}: article.md and writing.json must be created together")
    missing = sorted(name for name in WRITING_FILES if not (paper_dir / name).is_file())
    if missing: raise SystemExit(f"{paper_dir}: incomplete writing workflow; missing {', '.join(missing)}")
    manifest = load_json(manifest_path)
    if manifest.get("version") != 2 or manifest.get("status") != "complete" or manifest.get("pipeline") != "sujianlin-write-skills":
        raise SystemExit(f"{manifest_path}: invalid writing completion manifest")
    workflow_path = paper_dir / "writing-workflow.json"
    workflow = load_json(workflow_path)
    if workflow.get("status") != "complete" or workflow.get("paperId") != paper_dir.name:
        raise SystemExit(f"{workflow_path}: writing workflow is not complete")
    completed = workflow.get("completed")
    if not isinstance(completed, list) or [item.get("stage") for item in completed if isinstance(item, dict)] != WRITING_STAGES:
        raise SystemExit(f"{workflow_path}: writing stages are incomplete or out of order")
    previous = ""
    for stage, item in zip(WRITING_STAGES, completed):
        stage_path = paper_dir / STAGE_FILES[stage]
        digest = hashlib.sha256(stage_path.read_bytes()).hexdigest()
        if item.get("sha256") != digest or item.get("previousSha256") != previous:
            raise SystemExit(f"{workflow_path}: stale or invalid checkpoint for {stage}")
        previous = digest
    content = article.read_text()
    digest = hashlib.sha256(content.encode()).hexdigest()
    workflow_digest = hashlib.sha256(workflow_path.read_bytes()).hexdigest()
    if manifest.get("articleSha256") != digest or manifest.get("workflowSha256") != workflow_digest:
        raise SystemExit(f"{manifest_path}: article hash does not match article.md; run the writing validation again")
    return content

def writing_begin(paper_id: str, restart: bool) -> None:
    paper_dir = STATE / "papers" / paper_id
    if not (paper_dir / "paper.json").is_file(): raise SystemExit(f"Unknown paper: {paper_id}")
    existing = [name for name in (*WRITING_FILES, "writing.json", "writing-workflow.json") if (paper_dir / name).exists()]
    if existing and not restart: raise SystemExit(f"Writing files already exist for {paper_id}; use --restart to discard them")
    if restart:
        for name in existing: (paper_dir / name).unlink()
    workflow = {"version": 1, "paperId": paper_id, "status": "active", "completed": []}
    (paper_dir / "writing-workflow.json").write_text(json.dumps(workflow, ensure_ascii=False, indent=2) + "\n")
    print(f"Started ordered writing workflow for {paper_id}; next stage: {WRITING_STAGES[0]}")

def writing_record(paper_id: str, stage: str) -> None:
    paper_dir = STATE / "papers" / paper_id
    workflow_path = paper_dir / "writing-workflow.json"
    workflow = load_json(workflow_path)
    completed = workflow.get("completed", [])
    expected = WRITING_STAGES[len(completed)] if len(completed) < len(WRITING_STAGES) else None
    if workflow.get("status") != "active" or stage != expected:
        raise SystemExit(f"Expected writing stage {expected}, got {stage}")
    stage_path = paper_dir / STAGE_FILES[stage]
    if not stage_path.is_file() or not stage_path.read_text().strip(): raise SystemExit(f"Missing or empty stage file: {stage_path}")
    future = [STAGE_FILES[name] for name in WRITING_STAGES[len(completed) + 1:] if (paper_dir / STAGE_FILES[name]).exists()]
    if future: raise SystemExit(f"Future writing stages already exist before {stage}: {', '.join(future)}")
    digest = hashlib.sha256(stage_path.read_bytes()).hexdigest()
    previous = completed[-1]["sha256"] if completed else ""
    completed.append({"stage": stage, "file": STAGE_FILES[stage], "sha256": digest, "previousSha256": previous, "recordedAt": datetime.now(timezone.utc).isoformat()})
    workflow["completed"] = completed
    if stage == "article": workflow["status"] = "complete"
    workflow_path.write_text(json.dumps(workflow, ensure_ascii=False, indent=2) + "\n")
    if stage == "article":
        workflow_digest = hashlib.sha256(workflow_path.read_bytes()).hexdigest()
        manifest = {"version": 2, "status": "complete", "pipeline": "sujianlin-write-skills", "articleSha256": digest, "workflowSha256": workflow_digest}
        (paper_dir / "writing.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")
        print(f"Completed ordered writing workflow for {paper_id}")
    else: print(f"Recorded {stage}; next stage: {WRITING_STAGES[len(completed)]}")

def daily_order() -> list[str]:
    daily_root = STATE / "daily"
    daily_files = sorted(daily_root.glob("*.json"), reverse=True) if daily_root.exists() else []
    if not daily_files: return []
    daily = load_json(daily_files[0])
    ordered = [daily.get("primary"), *daily.get("alternatives", [])]
    return [paper_id for paper_id in ordered if isinstance(paper_id, str) and paper_id]

def sync() -> None:
    papers = []
    source_root = STATE / "papers"
    if source_root.exists():
        for metadata_path in sorted(source_root.glob("*/paper.json")):
            metadata = load_json(metadata_path); validate_paper(metadata, metadata_path)
            metadata["markdown"] = reviewed_article(metadata_path.parent)
            metadata["contentStatus"] = "reviewed" if metadata["markdown"] else "metadata"
            metadata["sections"] = []
            metadata.setdefault("terms", []); metadata.setdefault("outline", [])
            papers.append(metadata)
            asset_source = metadata_path.parent / "assets"
            if asset_source.exists():
                asset_target = ROOT / "public" / "local" / "papers" / metadata["id"]
                asset_target.mkdir(parents=True, exist_ok=True)
                shutil.copytree(asset_source, asset_target, dirs_exist_ok=True)
    order = {paper_id: index for index, paper_id in enumerate(daily_order())}
    papers.sort(key=lambda paper: (order.get(paper["id"], len(order)), paper["id"]))
    CATALOG.parent.mkdir(parents=True, exist_ok=True)
    CATALOG.write_text(json.dumps({"version": 1, "papers": papers}, ensure_ascii=False) + "\n")
    print(f"Published {len(papers)} local papers to {CATALOG}")

def validate() -> None:
    profile_path = STATE / "profile.json"
    if not profile_path.exists(): print("No local profile yet; run the initialization skill first"); return
    validate_profile(load_json(profile_path)); print("Local profile is valid")

def event(args: argparse.Namespace) -> None:
    STATE.mkdir(exist_ok=True)
    record = {"timestamp": datetime.now(timezone.utc).isoformat(), "paperId": args.paper_id, "type": args.type, "value": args.value}
    with (STATE / "events.jsonl").open("a") as stream: stream.write(json.dumps(record, ensure_ascii=False) + "\n")

def import_history(path: Path) -> None:
    history = load_json(path)
    STATE.mkdir(exist_ok=True)
    events = []
    for exposure in history.get("exposures", []):
        events.append({"timestamp": exposure.get("day"), "paperId": exposure.get("paperId"), "type": "exposed", "value": exposure.get("position")})
    for record in history.get("records", []):
        paper_id, timestamp = record.get("paperId"), record.get("updatedAt")
        events.append({"timestamp": timestamp, "paperId": paper_id, "type": "reading_summary", "value": {"seconds": record.get("seconds", 0), "progress": record.get("progress", 0)}})
        for key in ("liked", "saved", "reason"):
            if record.get(key): events.append({"timestamp": timestamp, "paperId": paper_id, "type": key, "value": record[key]})
    with (STATE / "events.jsonl").open("a") as stream:
        for item in events: stream.write(json.dumps(item, ensure_ascii=False) + "\n")
    print(f"Imported {len(events)} feedback events")

def main() -> None:
    parser = argparse.ArgumentParser(); sub = parser.add_subparsers(dest="command", required=True)
    init = sub.add_parser("init"); init.add_argument("profile", type=Path)
    sub.add_parser("sync"); sub.add_parser("validate")
    writing_start = sub.add_parser("writing-begin"); writing_start.add_argument("paper_id"); writing_start.add_argument("--restart", action="store_true")
    writing_checkpoint = sub.add_parser("writing-record"); writing_checkpoint.add_argument("paper_id"); writing_checkpoint.add_argument("stage", choices=WRITING_STAGES)
    history = sub.add_parser("import-history"); history.add_argument("path", type=Path)
    add_event = sub.add_parser("event"); add_event.add_argument("paper_id"); add_event.add_argument("type", choices=["opened", "liked", "saved", "dismissed", "finished"]); add_event.add_argument("value", nargs="?", default=True)
    args = parser.parse_args()
    if args.command == "init": initialize(args.profile)
    elif args.command == "sync": sync()
    elif args.command == "validate": validate()
    elif args.command == "writing-begin": writing_begin(args.paper_id, args.restart)
    elif args.command == "writing-record": writing_record(args.paper_id, args.stage)
    elif args.command == "import-history": import_history(args.path)
    else: event(args)
if __name__ == "__main__": main()
