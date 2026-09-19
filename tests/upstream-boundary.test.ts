import test from 'node:test';
import assert from 'node:assert/strict';
import { companionRevision } from '../src/upstream/companion.js';

test('pins the reviewed Companion revision', () => {
  assert.equal(companionRevision, '0e1d32a87c9947be681803cd506bc543f912cfd8');
});
