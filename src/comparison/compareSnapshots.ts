import type { ComparisonResult, PlayerFieldChange, PlayerJoined, PlayerDeparted, PlayerUpdated } from '../domain/comparison.js';
import type { Snapshot, PlayerState } from '../domain/snapshot.js';

export class IncompatibleCareerError extends Error {
  constructor() { super('Snapshots belong to different careers'); }
}

const fields: readonly (keyof PlayerState)[] = ['overall', 'potential', 'squadPosition', 'contractUntil', 'wage', 'height', 'nationality', 'leagueAppearances', 'leagueGoals', 'contractDurationMonths', 'contractStatus', 'playerRole'];

function changes(before: PlayerState, after: PlayerState): readonly PlayerFieldChange[] {
  return fields.flatMap((field) => before[field] === after[field] ? [] : [{ field: String(field), before: before[field], after: after[field] }]);
}

export function compareSnapshots(a: Snapshot, b: Snapshot): ComparisonResult {
  if (a.careerId !== b.careerId) throw new IncompatibleCareerError();
  const before = new Map(a.players.map((player) => [player.playerId, player]));
  const after = new Map(b.players.map((player) => [player.playerId, player]));
  const joined: PlayerJoined[] = []; const departed: PlayerDeparted[] = []; const updated: PlayerUpdated[] = [];
  for (const [playerId, player] of after) {
    if (!before.has(playerId)) joined.push({ playerId, name: player.name.display, nameSource: player.name.source, after: player });
    else { const fieldChanges = changes(before.get(playerId)!, player); if (fieldChanges.length) updated.push({ playerId, name: player.name.display, changes: fieldChanges }); }
  }
  for (const [playerId, player] of before) if (!after.has(playerId)) departed.push({ playerId, name: player.name.display, nameSource: player.name.source, before: player });
  const beforeAcademy = new Set(a.academyPlayers.map((player) => player.playerId)); const afterAcademy = new Set(b.academyPlayers.map((player) => player.playerId));
  const result = { snapshotA: a.id, snapshotB: b.id, careerCompatible: true as const, players: { joined, departed, updated }, academy: { added: [...afterAcademy].filter((id) => !beforeAcademy.has(id)).length, removed: [...beforeAcademy].filter((id) => !afterAcademy.has(id)).length }, summary: { playersJoined: joined.length, playersDeparted: departed.length, playersUpdated: updated.length } };
  return result;
}
