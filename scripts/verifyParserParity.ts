import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { loadDbMeta } from '../src/parser/meta.js';
import { parseDatabaseSave } from '../src/parser/database.js';
import { loadCompanionModules } from '../src/upstream/companion.js';

const args = process.argv.slice(2); const value = (flag: string) => { const index = args.indexOf(flag); return index >= 0 ? args[index + 1] ?? null : null; };
const savePath = value('--save'); const root = process.env.FC26_COMPANION_ROOT;
if (!savePath || !root) { console.error('Usage: FC26_COMPANION_ROOT=/path/to/fc26companion npm run verify:parser -- --save /path/to/working-copy'); process.exitCode = 2; } else {
  const bytes = await readFile(savePath); const hash = createHash('sha256').update(bytes).digest('hex'); const metaPath = join(root, 'data/fifa_ng_db-meta.xml');
  const internal = parseDatabaseSave(bytes, loadDbMeta(metaPath)); const upstream = await loadCompanionModules(root); const reference = upstream.parseSave(bytes, upstream.loadDbMeta(metaPath)) as { tables: Record<string, Record<string, unknown>[]>; databases: { index: number; tables: string[] }[]; unknownTables: string[] };
  const names = [...new Set([...Object.keys(internal.tables), ...Object.keys(reference.tables)])].sort(); const tableDiff = names.filter((name) => (internal.tables[name]?.length ?? 0) !== (reference.tables[name]?.length ?? 0)).map((name) => ({ table: name, internalRows: internal.tables[name]?.length ?? 0, referenceRows: reference.tables[name]?.length ?? 0 }));
  console.log(JSON.stringify({ save: savePath, sha256: hash, internal: { databases: internal.databases.length, tables: Object.keys(internal.tables).length, unknownTables: internal.unknownTables.length }, reference: { databases: reference.databases.length, tables: Object.keys(reference.tables).length, unknownTables: reference.unknownTables.length }, tableDiff, status: tableDiff.length ? 'mismatch' : 'table-count-match' }, null, 2));
  if (tableDiff.length) process.exitCode = 1;
}
