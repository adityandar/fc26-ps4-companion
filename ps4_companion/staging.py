import hashlib
import shutil
from dataclasses import dataclass
from pathlib import Path

@dataclass(frozen=True)
class StagedSave:
    source_path: Path
    working_copy_path: Path
    source_sha256: str
    working_copy_sha256: str
    size_bytes: int

def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()

def stage_save(source: Path, root: Path) -> StagedSave:
    source = source.expanduser().resolve()
    if not source.is_file():
        raise FileNotFoundError(source)
    source_hash = sha256_file(source)
    target_dir = root / source_hash[:16]
    target_dir.mkdir(parents=True, exist_ok=True)
    target = target_dir / source.name
    if not target.exists():
        with source.open("rb") as src, target.open("xb") as dst:
            shutil.copyfileobj(src, dst, length=1024 * 1024)
    copy_hash = sha256_file(target)
    if source_hash != copy_hash:
        raise IOError("working copy hash does not match source")
    return StagedSave(source, target, source_hash, copy_hash, source.stat().st_size)
