import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDatabase } from '../src/store/database.js';
import { createSnapshotRepository } from '../src/store/snapshotRepository.js';
import { migrateLegacyJson } from '../src/migration/legacyJson.js';

test('migrates legacy records without persisting old insights', async () => {
  const root = mkdtempSync(join(tmpdir(), 'fc26-migration-')); const catalog = join(root, 'catalog.json');
  writeFileSync(catalog, JSON.stringify([{ import_id: 'x', source_path: '/tmp/DATA', working_copy_path: '/tmp/DATA', source_sha256: 'a'.repeat(64), working_copy_sha256: 'a'.repeat(64), size_bytes: 1, career_id: 'Manager|Club', manager_name: 'Manager', club_name: 'Club', season: '2026/27', checkpoint: 'season_start', user_note: '', derived_summary: { estimated_date: '2027-01-01', senior_players: 0, academy_players: 0, insights: { mode: 'comparison' } }, created_at: 'now' }]));
  const db = openDatabase(join(root, 'db.sqlite')); const report = await migrateLegacyJson(catalog, createSnapshotRepository(db)); assert.equal(report.imported, 1); db.close();
});
