from datetime import datetime, timezone
from pathlib import Path
from .catalog import Catalog
from .companion_bridge import ParsedCareer, parse_staged_save
from .insights import build_insights
from .model import ImportRecord, ImportRequest, STANDARD_CHECKPOINTS
from .staging import StagedSave, stage_save

class ImportPreview:
    def __init__(self, request: ImportRequest, staged: StagedSave, parsed: ParsedCareer, career_id: str):
        self.request, self.staged, self.parsed, self.career_id = request, staged, parsed, career_id

def preview_import(request: ImportRequest, working_root: Path, companion_root: Path) -> ImportPreview:
    request.validate()
    staged = stage_save(request.source_path, working_root)
    parsed = parse_staged_save(staged.working_copy_path, companion_root)
    career_id = f"{parsed.manager_name}|{parsed.club_name}"
    return ImportPreview(request, staged, parsed, career_id)

def commit_import(preview: ImportPreview, catalog: Catalog, output_root: Path, confirm: bool = False) -> ImportRecord:
    if not confirm:
        raise ValueError("commit requires explicit confirmation")
    duplicate = catalog.find_duplicate(preview.career_id, preview.staged.source_sha256)
    if duplicate:
        return duplicate
    stamp = datetime.now(timezone.utc).isoformat()
    import_id = f"{preview.career_id}|{preview.staged.source_sha256[:16]}"
    summary = {
        "manager_name": preview.parsed.manager_name,
        "club_name": preview.parsed.club_name,
        "estimated_date": preview.parsed.estimated_date,
        "databases": preview.parsed.databases,
        "table_counts": list(preview.parsed.table_counts),
        "senior_players": preview.parsed.senior_players,
        "academy_players": preview.parsed.academy_players,
        "name_coverage": preview.parsed.name_coverage,
    }
    previous = next((r for r in reversed(catalog.records) if r.career_id == preview.career_id), None)
    record = ImportRecord(import_id, str(preview.staged.source_path), str(preview.staged.working_copy_path), preview.staged.source_sha256, preview.staged.working_copy_sha256, preview.staged.size_bytes, preview.career_id, preview.parsed.manager_name, preview.parsed.club_name, preview.request.season, preview.request.checkpoint, preview.request.user_note, summary, stamp)
    insight = build_insights(record, previous)
    summary["insights"] = {
        "mode": insight.mode,
        "headline": insight.headline,
        "available": insight.available,
        "unavailable": insight.unavailable,
        "changes": insight.changes,
    }
    record = ImportRecord(import_id, str(preview.staged.source_path), str(preview.staged.working_copy_path), preview.staged.source_sha256, preview.staged.working_copy_sha256, preview.staged.size_bytes, preview.career_id, preview.parsed.manager_name, preview.parsed.club_name, preview.request.season, preview.request.checkpoint, preview.request.user_note, summary, stamp)
    catalog.append(record)
    derived = output_root / "imports" / f"{preview.staged.source_sha256}.json"
    derived.parent.mkdir(parents=True, exist_ok=True)
    import json
    derived.write_text(json.dumps(record.to_dict(), indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return record
