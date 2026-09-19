import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ObjectStore } from '../src/import/objectStore.js';

test('stages a byte-identical object', async () => {
  const root = mkdtempSync(join(tmpdir(), 'fc26-object-')); const source = join(root, 'DATA'); writeFileSync(source, Buffer.from([0, 1, 2, 3]));
  const before = readFileSync(source); const staged = await new ObjectStore(join(root, 'objects')).stageFile(source);
  assert.deepEqual(readFileSync(source), before); assert.equal(staged.sourceSha256, staged.copySha256); assert.deepEqual(readFileSync(staged.objectPath), before);
});
