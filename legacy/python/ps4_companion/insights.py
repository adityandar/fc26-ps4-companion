from dataclasses import dataclass
from typing import Any
from .model import ImportRecord

@dataclass(frozen=True)
class SnapshotInsights:
    mode: str
    headline: str
    available: dict[str, Any]
    unavailable: list[str]
    changes: dict[str, Any]

def build_insights(current: ImportRecord, previous: ImportRecord | None = None) -> SnapshotInsights:
    summary = current.derived_summary
    available = {
        "career": current.career_id,
        "season": current.season,
        "checkpoint": current.checkpoint,
        "manager": current.manager_name,
        "club": current.club_name,
        "estimated_date": summary.get("estimated_date"),
        "databases": summary.get("databases"),
        "senior_players": summary.get("senior_players"),
        "academy_players": summary.get("academy_players"),
        "name_coverage": summary.get("name_coverage"),
        "source_sha256": current.source_sha256,
    }
    if previous is None:
        return SnapshotInsights(
            "single_snapshot",
            f"Baseline snapshot for {current.club_name} · {current.manager_name}",
            available,
            ["change_since_previous_snapshot", "transfer_movement", "player_growth", "academy_change"],
            {},
        )
    old = previous.derived_summary
    candidates = {
        "senior_players": (old.get("senior_players"), summary.get("senior_players")),
        "academy_players": (old.get("academy_players"), summary.get("academy_players")),
        "estimated_date": (old.get("estimated_date"), summary.get("estimated_date")),
    }
    changes = {key: value for key, value in candidates.items() if value[0] != value[1]}
    old_players = {p.get("playerid"): p for p in old.get("squad_players", []) if p.get("playerid") is not None}
    new_players = {p.get("playerid"): p for p in summary.get("squad_players", []) if p.get("playerid") is not None}
    added = len(new_players.keys() - old_players.keys())
    departed = len(old_players.keys() - new_players.keys())
    rating_changed = 0
    for player_id in old_players.keys() & new_players.keys():
        before = old_players[player_id].get("attributes", {})
        after = new_players[player_id].get("attributes", {})
        if before.get("overallrating") != after.get("overallrating") or before.get("potential") != after.get("potential"):
            rating_changed += 1
    if added:
        changes["squad_added"] = (0, added)
    if departed:
        changes["squad_departed"] = (0, departed)
    if rating_changed:
        changes["players_with_rating_or_potential_change"] = (0, rating_changed)
    return SnapshotInsights("comparison", f"Changes since {previous.checkpoint}", available, [], changes)
