import unittest
from ps4_companion.companion_bridge import parse_probe_output, parse_json_output

SAMPLE = """parse  341 ms, 2 databases\n  DB0: 32 tables\n  DB1: 33 tables\ncareer  Frederico Whisper  ·  Padova  ·  season 2\ndate    ~2027-04-04  (estimated)\nsquad   23 players (20769 in save)  ·  names 22/23\nacademy 9 prospects\n"""

class BridgeTests(unittest.TestCase):
    def test_parse_companion_summary(self):
        parsed = parse_probe_output(SAMPLE)
        self.assertEqual(parsed.club_name, "Padova")
        self.assertEqual(parsed.table_counts, (32, 33))
        self.assertEqual(parsed.senior_players, 23)
        self.assertEqual(parsed.academy_players, 9)

    def test_parse_structured_json_summary(self):
        parsed = parse_json_output('{"manager_name":"Manager","club_name":"Club","season":2,"estimated_date":"2027-01-01","databases":2,"table_counts":[32,33],"senior_players":23,"academy_players":9}')
        self.assertEqual(parsed.manager_name, "Manager")
        self.assertEqual(parsed.table_counts, (32, 33))

if __name__ == "__main__": unittest.main()
