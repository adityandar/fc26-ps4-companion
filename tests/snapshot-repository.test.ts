import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDatabase } from '../src/store/database.js';
import { createSnapshotRepository } from '../src/store/snapshotRepository.js';
import { snapshotId } from '../src/domain/ids.js';

test('stores one immutable snapshot per career and source hash', () => {
  const db = openDatabase(join(mkdtempSync(join(tmpdir(), 'fc26-')), 'test.sqlite'));
  const repository = createSnapshotRepository(db);
  const career = repository.createCareer('Padova career');
  const candidate = {
    careerId: career.id, sourceSha256: 'a'.repeat(64), copySha256: 'a'.repeat(64), objectPath: 'objects/a/DATA', sourceFilename: 'DATA', sizeBytes: 1, schemaVersion: 1, parserVersion: 'test', parsedSeasonIndex: 2, seasonLabel: '2026/27', checkpoint: 'season_start', estimatedGameDate: null, estimatedDateBasis: null, careerHint: { managerName: 'Manager', clubTeamId: 1, clubName: 'Padova' }, players: [], academyPlayers: [], evidence: [], warnings: [], userNote: '', importedAt: new Date().toISOString(),
  } as const;
  const first = repository.saveSnapshot(candidate);
  const second = repository.saveSnapshot(candidate);
  assert.equal(first.id, second.id);
  assert.equal(repository.listSnapshots(career.id).length, 1);
  assert.equal(repository.getSnapshot(snapshotId(first.id))?.sourceSha256, 'a'.repeat(64));
  db.close();
});
