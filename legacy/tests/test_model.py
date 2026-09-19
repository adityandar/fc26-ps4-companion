import json
import unittest
from pathlib import Path
from ps4_companion.model import ImportRecord, ImportRequest, STANDARD_CHECKPOINTS

class ModelTests(unittest.TestCase):
    def test_standard_checkpoints_are_named(self):
        self.assertEqual(STANDARD_CHECKPOINTS["season_start"], "Season Start")
        self.assertEqual(len(STANDARD_CHECKPOINTS), 4)

    def test_request_rejects_missing_metadata(self):
        with self.assertRaises(ValueError):
            ImportRequest(Path("x"), "", "season_start").validate()

    def test_record_is_json_serializable(self):
        record = ImportRecord("id", "a", "b", "c", "c", 1, "career", "mgr", "club", "1", "season_start", "note", {}, "now")
        json.dumps(record.to_dict())

if __name__ == "__main__": unittest.main()
