import tempfile
import unittest
from pathlib import Path
from ps4_companion.catalog import Catalog
from ps4_companion.companion_bridge import ParsedCareer
from ps4_companion.importer import ImportPreview, commit_import
from ps4_companion.model import ImportRequest
from ps4_companion.staging import StagedSave

class ImporterTests(unittest.TestCase):
    def test_commit_requires_confirmation_and_is_idempotent(self):
        with tempfile.TemporaryDirectory() as td:
            root=Path(td); source=root/'DATA'; copy=root/'copy'; source.write_bytes(b'x'); copy.write_bytes(b'x')
            staged=StagedSave(source,copy,'abc','abc',1)
            parsed=ParsedCareer('Manager','Club','2','2027-01-01',2,(32,33),23,9,'23/23','')
            preview=ImportPreview(ImportRequest(source,'2026/27','season_start','note'),staged,parsed,'Manager|Club')
            catalog=Catalog(root/'catalog.json')
            with self.assertRaises(ValueError): commit_import(preview,catalog,root)
            first=commit_import(preview,catalog,root,confirm=True)
            second=commit_import(preview,catalog,root,confirm=True)
            self.assertEqual(first.import_id,second.import_id)
            self.assertEqual(len(catalog.records),1)
            self.assertEqual(first.derived_summary["insights"]["mode"], "single_snapshot")
            self.assertIn("change_since_previous_snapshot", first.derived_summary["insights"]["unavailable"])

if __name__ == '__main__': unittest.main()
