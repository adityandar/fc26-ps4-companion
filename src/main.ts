import { loadConfig } from './config.js';
import { openDatabase } from './store/database.js';
import { createSnapshotRepository } from './store/snapshotRepository.js';
import { createApiServer } from './server/apiServer.js';
import { ObjectStore } from './import/objectStore.js';
import { ImportService } from './import/importService.js';

const config = loadConfig();
const databasePath = config.databasePath;
const port = config.port;
const host = config.host;
const db = openDatabase(databasePath);
const repository = createSnapshotRepository(db);
const importer = config.companionRoot ? new ImportService(new ObjectStore(config.objectRoot), repository, config.companionRoot) : undefined;
const app = createApiServer(repository, port, host, undefined, importer);
app.listen().then((url) => console.log(`FC26 PS4 Companion: ${url} · parser=${config.companionRoot || 'not configured'}`));
