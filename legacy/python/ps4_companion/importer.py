from datetime import datetime, timezone
from pathlib import Path
from .catalog import Catalog
from .companion_bridge import ParsedCareer, parse_staged_save
from .insights import build_insights
from .model import ImportRecord, ImportRequest, STANDARD_CHECKPOINTS
from .names import load_external_names, resolve_player_name
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
    import os
    primary = Path(os.environ['FC26_PLAYER_NAMES']) if os.environ.get('FC26_PLAYER_NAMES') else None
    fallback = [Path(value) for value in os.environ.get('FC26_PLAYER_NAMES_FALLBACK', '').split(os.pathsep) if value]
    external = load_external_names(([primary] if primary else []) + fallback)
    enriched_squad = [{**player, **resolve_player_name(player, external)} for player in preview.parsed.squad_players]
    duplicate = catalog.find_duplicate(preview.career_id, preview.staged.source_sha256)
    if duplicate:
        # A duplicate byte stream must not create another snapshot, but a newer
        # parser can legitimately discover more derived fields in the same save.
        duplicate.derived_summary.update({
            "squad_players": enriched_squad,
            "academy_player_records": list(preview.parsed.academy_player_records),
        })
        catalog.save()
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
        "squad_players": enriched_squad,
        "academy_player_records": list(preview.parsed.academy_player_records),
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
