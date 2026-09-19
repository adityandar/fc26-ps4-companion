import test from 'node:test';
import assert from 'node:assert/strict';
import { positionName } from '../src/domain/positions.js';
import type { Snapshot } from '../src/domain/snapshot.js';

test('position zero is goalkeeper and unknown codes remain visible', () => {
  assert.equal(positionName(0), 'GK');
  assert.equal(positionName(999), '#999');
});

test('snapshot type is designed without persisted comparison fields', () => {
  const snapshot = {} as Snapshot;
  assert.equal('insights' in snapshot, false);
  assert.equal('previousSnapshotId' in snapshot, false);
});
