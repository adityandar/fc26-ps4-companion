import test from 'node:test';
import assert from 'node:assert/strict';
import { scanDatabaseBlocks } from '../src/parser/container.js';

test('internal container scanner reports database offsets without changing bytes', () => {
  const block = Buffer.alloc(20); Buffer.from('DB\0\x08\0\0\0\0', 'latin1').copy(block); block.writeUInt32LE(20, 8);
  const input = Buffer.concat([Buffer.from([1, 2, 3]), block, Buffer.from([9])]);
  const before = Buffer.from(input); const blocks = scanDatabaseBlocks(input);
  assert.equal(blocks.length, 1); assert.equal(blocks[0].offset, 3); assert.equal(blocks[0].size, 20); assert.deepEqual(input, before);
});
