import { openDatabase } from './store/database.js';
import { createSnapshotRepository } from './store/snapshotRepository.js';
import { createApiServer } from './server/apiServer.js';
import { ObjectStore } from './import/objectStore.js';
import { ImportService } from './import/importService.js';

const databasePath = process.env.FC26_COMPANION_DATABASE ?? 'data-v2/companion.sqlite';
const port = Number(process.env.PORT ?? 4132);
const host = process.env.HOST ?? '127.0.0.1';
const db = openDatabase(databasePath);
const repository = createSnapshotRepository(db);
const importer = process.env.FC26_COMPANION_ROOT ? new ImportService(new ObjectStore(process.env.FC26_COMPANION_OBJECT_ROOT ?? 'data-v2/objects'), repository, process.env.FC26_COMPANION_ROOT) : undefined;
const app = createApiServer(repository, port, host, undefined, importer);
app.listen().then((url) => console.log(`FC26 PS4 Companion API: ${url}`));
