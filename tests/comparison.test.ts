import test from 'node:test';
import assert from 'node:assert/strict';
import { compareSnapshots, IncompatibleCareerError } from '../src/comparison/compareSnapshots.js';
import { careerId, snapshotId } from '../src/domain/ids.js';
import type { Snapshot } from '../src/domain/snapshot.js';

const name = { display: 'Player', source: 'primary' as const, provisional: false, resolverVersion: 'test' };
function snapshot(id: string, career: string, players: Partial<Snapshot['players'][number]>[]): Snapshot {
  return { id: snapshotId(id), careerId: careerId(career), sourceSha256: id, copySha256: id, objectPath: id, sourceFilename: 'DATA', sizeBytes: 1, schemaVersion: 1, parserVersion: 'test', parsedSeasonIndex: 2, seasonLabel: '2026/27', checkpoint: id, estimatedGameDate: null, estimatedDateBasis: null, careerHint: { managerName: 'Manager', clubTeamId: 1, clubName: 'Club' }, players: players.map((player, index) => ({ playerId: index + 1, name, preferredPositions: [], squadPosition: 25, overall: 60, potential: 70, birthdate: null, height: null, weight: null, nationality: null, contractUntil: null, wage: null, jerseyNumber: null, leagueAppearances: null, leagueGoals: null, evidence: [], ...player })), academyPlayers: [], evidence: [], warnings: [], userNote: '', importedAt: 'now' };
}

test('compares arbitrary snapshots live and suppresses unchanged fields', () => {
  const result = compareSnapshots(snapshot('a', 'career', [{ overall: 60 }]), snapshot('b', 'career', [{ overall: 61 }, { playerId: 2, name }]));
  assert.equal(result.players.joined.length, 1); assert.equal(result.players.updated[0]?.changes[0]?.field, 'overall');
});

test('compares contract metadata when it changes', () => {
  const result = compareSnapshots(snapshot('a', 'career', [{ contractDurationMonths: 12, playerRole: 2 }]), snapshot('b', 'career', [{ contractDurationMonths: 24, playerRole: 3 }]));
  assert.deepEqual(result.players.updated[0]?.changes.map((change) => change.field), ['contractDurationMonths', 'playerRole']);
});

test('rejects cross-career comparison', () => {
  assert.throws(() => compareSnapshots(snapshot('a', 'one', []), snapshot('b', 'two', [])), IncompatibleCareerError);
});
