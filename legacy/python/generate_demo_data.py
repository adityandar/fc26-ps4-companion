#!/usr/bin/env python3
"""Create synthetic snapshot fixtures without touching real saves or production catalog."""
import argparse, copy, hashlib, json
from pathlib import Path
from ps4_companion.insights import build_insights
from ps4_companion.model import ImportRecord

def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument('--catalog', type=Path, default=Path('data/catalog.json'))
    ap.add_argument('--output', type=Path, default=Path('data/demo'))
    args = ap.parse_args()
    records = json.loads(args.catalog.read_text(encoding='utf-8'))
    enriched = []
    import_dir = args.catalog.parent / 'imports'
    import_paths = sorted(import_dir.glob('*.json')) if import_dir.exists() else []
    for path in import_paths:
        try:
            candidate = json.loads(path.read_text(encoding='utf-8'))
            if candidate.get('derived_summary', {}).get('squad_players'):
                enriched.append(candidate)
        except (OSError, json.JSONDecodeError):
            continue
    if enriched:
        records = enriched
    if not records:
        raise SystemExit('No real snapshot found. Import one snapshot first.')
    base = copy.deepcopy(records[0])
    source = base['derived_summary']
    squad = copy.deepcopy(source.get('squad_players', []))
    if not squad:
        raise SystemExit('Base snapshot has no squad_players. Re-import it with the current parser first.')
    academy = copy.deepcopy(source.get('academy_player_records', []))
    checkpoints = [('season_start', '2026-08-01'), ('summer_window_closed', '2026-09-01'), ('january_window_closed', '2027-01-31'), ('season_end', '2027-06-08')]
    demo_records = []
    for index, (checkpoint, date) in enumerate(checkpoints):
        summary = copy.deepcopy(source)
        current = copy.deepcopy(squad[:])
        current_academy = copy.deepcopy(academy[:])
        if index >= 1 and current:
            current[0]['attributes']['overallrating'] = (current[0]['attributes'].get('overallrating') or 70) + index
        if index >= 1 and len(current) > 1:
            current[1]['attributes']['potential'] = (current[1]['attributes'].get('potential') or 75) - index
        if index == 1 and len(current) > 2:
            current.pop(2)
            current.append({'playerid': 990000 + index, 'name': 'Demo Incoming Player', 'name_source': 'demo', 'attributes': {'overallrating': 68, 'potential': 78, 'height': 180}, 'squad': {'position': 25, 'jerseynumber': 99}, 'contract': {'wage': 1000, 'contract_status': 'demo'}})
        if index >= 2:
            current_academy.append({'playerid': 980000 + index, 'playertier': 2, 'swinglowpotential': 80, 'potentialvariance': 4, 'monthsinsquad': index})
        if index == 3 and current_academy:
            current_academy[0]['potentialvariance'] = 12
        summary['estimated_date'] = date
        summary['squad_players'] = current
        summary['academy_player_records'] = current_academy
        payload = json.dumps({'checkpoint': checkpoint, 'summary': summary}, sort_keys=True).encode()
        digest = hashlib.sha256(payload).hexdigest()
        record = copy.deepcopy(base)
        record['import_id'] = f"{base['career_id']}|demo-{checkpoint}"
        record['source_path'] = f"demo://{checkpoint}"
        record['working_copy_path'] = f"demo://{checkpoint}"
        record['source_sha256'] = digest
        record['working_copy_sha256'] = digest
        record['checkpoint'] = checkpoint
        record['user_note'] = f"Synthetic demo fixture: {checkpoint}"
        record['derived_summary'] = summary
        demo_records.append(record)
    for index, record in enumerate(demo_records):
        current = ImportRecord(**record)
        previous = ImportRecord(**demo_records[index - 1]) if index else None
        insight = build_insights(current, previous)
        record['derived_summary']['insights'] = {'mode': insight.mode, 'headline': insight.headline, 'available': insight.available, 'unavailable': insight.unavailable, 'changes': insight.changes}
    args.output.mkdir(parents=True, exist_ok=True)
    (args.output / 'catalog.json').write_text(json.dumps(demo_records, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
    for record in demo_records:
        (args.output / f"{record['source_sha256']}.json").write_text(json.dumps(record, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
    print(f'Wrote {len(demo_records)} synthetic snapshots to {args.output}')

if __name__ == '__main__':
    main()
