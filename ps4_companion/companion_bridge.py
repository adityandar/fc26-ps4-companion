import re
import subprocess
from dataclasses import dataclass
from pathlib import Path

@dataclass(frozen=True)
class ParsedCareer:
    manager_name: str
    club_name: str
    season: str
    estimated_date: str
    databases: int
    table_counts: tuple[int, ...]
    senior_players: int
    academy_players: int
    name_coverage: str
    raw_output: str

def parse_probe_output(output: str) -> ParsedCareer:
    career = re.search(r"^career\s+(.+?)\s+·\s+(.+?)\s+·\s+season\s+(.+)$", output, re.M)
    date = re.search(r"^date\s+~([^\s]+)", output, re.M)
    parse = re.search(r"^parse\s+\d+ ms, (\d+) databases", output, re.M)
    dbs = [int(v) for v in re.findall(r"^\s+DB\d+: (\d+) tables", output, re.M)]
    squad = re.search(r"^squad\s+(\d+) players", output, re.M)
    academy = re.search(r"^academy\s+(\d+) prospects", output, re.M)
    names = re.search(r"names\s+(\d+/\d+)", output)
    if not all((career, date, parse, squad, academy)):
        raise ValueError("Companion probe output did not contain required career fields")
    manager, club, season = career.groups()
    return ParsedCareer(manager, club, season, date.group(1), int(parse.group(1)), tuple(dbs), int(squad.group(1)), int(academy.group(1)), names.group(1) if names else "", output)

def parse_staged_save(path: Path, companion_root: Path, allow_failure: bool = False) -> ParsedCareer:
    command = ["npm", "run", "probe", "--", str(path)]
    result = subprocess.run(command, cwd=companion_root, text=True, capture_output=True)
    output = result.stdout + result.stderr
    if result.returncode != 0 and not allow_failure:
        raise RuntimeError(f"Companion probe failed ({result.returncode}): {output[-2000:]}")
    return parse_probe_output(output)
