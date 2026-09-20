import type { ComparisonResult, PlayerFieldChange, PlayerJoined, PlayerDeparted, PlayerUpdated } from '../domain/comparison.js';
import type { Snapshot, PlayerState } from '../domain/snapshot.js';
import type { TransferActivity } from '../domain/careerFacts.js';

export class IncompatibleCareerError extends Error {
  constructor() { super('Snapshots belong to different careers'); }
}

const fields: readonly (keyof PlayerState)[] = ['overall', 'potential', 'squadPosition', 'contractUntil', 'wage', 'height', 'nationality', 'leagueAppearances', 'leagueGoals', 'contractDurationMonths', 'contractStatus', 'playerRole'];

function changes(before: PlayerState, after: PlayerState): readonly PlayerFieldChange[] {
  return fields.flatMap((field) => before[field] === after[field] ? [] : [{ field: String(field), before: before[field], after: after[field] }]);
}

function transferKey(transfer: TransferActivity): string {
  return [transfer.playerId, transfer.teamId, transfer.offerTeamId, transfer.offeredFee, transfer.signedDate, transfer.completionDate].join(':');
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
  const beforeTransfers = a.careerFacts?.transfers ?? []; const afterTransfers = b.careerFacts?.transfers ?? [];
  const beforeTransferKeys = new Set(beforeTransfers.map(transferKey)); const afterTransferKeys = new Set(afterTransfers.map(transferKey));
  const addedTransfers = afterTransfers.filter((transfer) => !beforeTransferKeys.has(transferKey(transfer))); const removedTransfers = beforeTransfers.filter((transfer) => !afterTransferKeys.has(transferKey(transfer)));
  const beforeResults = a.careerFacts?.fixtureEvidence?.latestResults ?? [];
  const afterResults = b.careerFacts?.fixtureEvidence?.latestResults ?? [];
  const resultKey = (item: Record<string, unknown>) => [item.date, item.homeTeamId, item.awayTeamId, item.homeGoals, item.awayGoals, item.leagueId].join(':');
  const beforeResultKeys = new Set(beforeResults.map((item) => resultKey(item as unknown as Record<string, unknown>)));
  const addedResults = afterResults.filter((item) => !beforeResultKeys.has(resultKey(item as unknown as Record<string, unknown>))) as unknown as Record<string, unknown>[];
  const result = { snapshotA: a.id, snapshotB: b.id, careerCompatible: true as const, players: { joined, departed, updated }, academy: { added: [...afterAcademy].filter((id) => !beforeAcademy.has(id)).length, removed: [...beforeAcademy].filter((id) => !afterAcademy.has(id)).length }, transfers: { added: addedTransfers, removed: removedTransfers }, fixtures: { addedResults, source: addedResults.length ? 'mrni' : null }, summary: { playersJoined: joined.length, playersDeparted: departed.length, playersUpdated: updated.length, transfersAdded: addedTransfers.length, transfersRemoved: removedTransfers.length, fixturesAdded: addedResults.length } };
  return result;
}
