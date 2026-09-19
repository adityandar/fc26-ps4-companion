import hashlib
import tempfile
import unittest
from pathlib import Path
from ps4_companion.staging import stage_save

class StagingTests(unittest.TestCase):
    def test_stage_is_byte_identical(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td); source = root / "DATA"; source.write_bytes(b"untrusted save bytes\x00\x01")
            before = source.read_bytes(); staged = stage_save(source, root / "working")
            self.assertEqual(before, source.read_bytes())
            self.assertEqual(staged.source_sha256, staged.working_copy_sha256)
            self.assertEqual(source.read_bytes(), staged.working_copy_path.read_bytes())

if __name__ == "__main__": unittest.main()
