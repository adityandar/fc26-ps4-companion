import { openDatabase } from './store/database.js';
import { createSnapshotRepository } from './store/snapshotRepository.js';
import { createApiServer } from './server/apiServer.js';

const databasePath = process.env.FC26_COMPANION_DATABASE ?? 'data-v2/companion.sqlite';
const port = Number(process.env.PORT ?? 4132);
const db = openDatabase(databasePath);
const repository = createSnapshotRepository(db);
const app = createApiServer(repository, port);
app.listen().then((url) => console.log(`FC26 PS4 Companion API: ${url}`));
