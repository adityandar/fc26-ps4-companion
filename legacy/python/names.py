import csv
from pathlib import Path

def load_external_names(paths: Path | list[Path] | None) -> dict[int, dict[str, str]]:
    if paths is None:
        return {}
    if isinstance(paths, Path):
        paths = [paths]
    result: dict[int, dict[str, str]] = {}
    for path in paths:
        if not path or not path.exists():
            continue
        with path.open(encoding='utf-8', newline='') as handle:
            for row in csv.DictReader(line for line in handle if not line.startswith('#')):
                if row.get('player_id', '').isdigit():
                    result.setdefault(int(row['player_id']), row)
    return result

def resolve_player_name(player: dict, external: dict[int, dict[str, str]]) -> dict[str, str]:
    if player.get('name') and player.get('name_source') not in (None, '', 'unresolved'):
        return {'name': player['name'], 'source': player['name_source']}
    player_id = player.get('playerid')
    imported = external.get(player_id)
    if imported:
        return {'name': imported.get('short_name') or imported.get('long_name') or f'Player #{player_id}', 'source': 'external'}
    local = player.get('local_name')
    if local:
        return {'name': local, 'source': 'save_local'}
    return {'name': f'Player #{player_id}', 'source': 'fallback_id'}
