from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any

STANDARD_CHECKPOINTS = {
    "season_start": "Season Start",
    "summer_window_closed": "Summer Window Closed",
    "january_window_closed": "January Window Closed",
    "season_end": "Season End",
}

@dataclass(frozen=True)
class ImportRequest:
    source_path: Path
    season: str
    checkpoint: str
    user_note: str = ""

    def validate(self) -> None:
        if not self.season.strip():
            raise ValueError("season is required")
        if not self.checkpoint.strip():
            raise ValueError("checkpoint is required")

@dataclass(frozen=True)
class ImportRecord:
    import_id: str
    source_path: str
    working_copy_path: str
    source_sha256: str
    working_copy_sha256: str
    size_bytes: int
    career_id: str
    manager_name: str
    club_name: str
    season: str
    checkpoint: str
    user_note: str
    derived_summary: dict[str, Any]
    created_at: str

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)
