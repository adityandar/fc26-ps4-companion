import { migrateLegacyJson } from '../src/migration/legacyJson.js';
import { openDatabase } from '../src/store/database.js';
import { createSnapshotRepository } from '../src/store/snapshotRepository.js';

const args = process.argv.slice(2); const value = (flag: string, fallback: string) => { const index = args.indexOf(flag); return index >= 0 ? args[index + 1] ?? fallback : fallback; };
const catalog = value('--catalog', 'data/catalog.json'); const database = value('--database', 'data-v2/companion.sqlite'); const dryRun = args.includes('--dry-run');
const db = openDatabase(database); const report = await migrateLegacyJson(catalog, createSnapshotRepository(db), dryRun); console.log(JSON.stringify({ ...report, dryRun, database }, null, 2)); db.close();
