import unittest
from ps4_companion.insights import build_insights
from ps4_companion.model import ImportRecord

def record(checkpoint="season_start", summary=None):
    return ImportRecord("id"+checkpoint,"source","copy","hash"+checkpoint,"hash"+checkpoint,1,"career","Manager","Club","2026/27",checkpoint,"",summary or {"estimated_date":"2027-01-01","databases":2,"senior_players":23,"academy_players":9,"name_coverage":"23/23"},"now")

class InsightTests(unittest.TestCase):
    def test_single_snapshot_has_baseline_insights(self):
        result=build_insights(record())
        self.assertEqual(result.mode,"single_snapshot")
        self.assertEqual(result.available["senior_players"],23)
        self.assertIn("change_since_previous_snapshot",result.unavailable)

    def test_two_snapshots_have_changes(self):
        result=build_insights(record("summer_window_closed",{"estimated_date":"2027-09-01","databases":2,"senior_players":24,"academy_players":8,"name_coverage":"24/24"}),record())
        self.assertEqual(result.mode,"comparison")
        self.assertEqual(result.changes["senior_players"],(23,24))

if __name__=='__main__': unittest.main()
