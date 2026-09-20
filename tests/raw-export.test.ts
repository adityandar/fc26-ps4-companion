import test from 'node:test';
import assert from 'node:assert/strict';
import { rawExportDocument } from '../src/import/saveParser.js';

test('raw export document preserves parser tables and metadata', () => {
  const result = rawExportDocument(
    { tables: { players: [{ playerid: 7, overallrating: 82 }] } },
    'DATA',
    'parser-1',
  );

  assert.deepEqual(result, {
    _meta: { kind: 'parsed-raw', sourceFile: 'DATA', parserVersion: 'parser-1' },
    tables: { players: [{ playerid: 7, overallrating: 82 }] },
  });
});
