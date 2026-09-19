import json
from pathlib import Path
from typing import Any
from .model import ImportRecord

class Catalog:
    def __init__(self, path: Path):
        self.path = path
        self.records: list[ImportRecord] = []
        if path.exists():
            raw = json.loads(path.read_text(encoding="utf-8"))
            self.records = [ImportRecord(**item) for item in raw]

    def find_duplicate(self, career_id: str, source_sha256: str) -> ImportRecord | None:
        return next((r for r in self.records if r.career_id == career_id and r.source_sha256 == source_sha256), None)

    def append(self, record: ImportRecord) -> None:
        self.records.append(record)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        temp = self.path.with_suffix(self.path.suffix + ".tmp")
        temp.write_text(json.dumps([r.to_dict() for r in self.records], indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        temp.replace(self.path)
