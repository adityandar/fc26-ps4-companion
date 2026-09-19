import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDatabase } from '../src/store/database.js';
import { createSnapshotRepository } from '../src/store/snapshotRepository.js';
import { createApiServer } from '../src/server/apiServer.js';

test('API exposes read-only live comparison route', async (t) => {
  const db = openDatabase(join(mkdtempSync(join(tmpdir(), 'fc26-api-')), 'test.sqlite')); const repo = createSnapshotRepository(db); const app = createApiServer(repo, 0);
  try { const url = await app.listen(); const response = await fetch(`${url}/api/careers`); assert.equal(response.status, 200); assert.deepEqual(await response.json(), []); app.close(); db.close(); } catch (error) { app.close(); db.close(); if ((error as NodeJS.ErrnoException).code === 'EPERM') { t.skip('network listeners are unavailable in the current sandbox'); return; } throw error; }
});
