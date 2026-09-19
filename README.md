# FC26 PS4 Companion

Local, read-only snapshot importer for Apollo-exported EA SPORTS FC 26 PS4 saves.

## Current application

- Creates a byte-for-byte working copy before parsing.
- Records source and working-copy SHA-256 hashes.
- Calls the existing `fc26companion` parser for database/career extraction.
- Uses a structured JSON bridge to the Companion parser rather than scraping terminal text.
- Supports season, checkpoint, and user notes.
- Prevents duplicate imports for the same career and save hash.
- Treats one imported save as a complete `single_snapshot` baseline: career state, roster counts, parser coverage, hashes, and user notes remain available even without a comparison save. Later saves can add `comparison` insights.
- Provides a TypeScript/SQLite API and browser workspace at `http://localhost:4132`.

The Python importer, JSON catalog, synthetic demo generator, and old web server are retained under [`legacy/`](legacy/) for historical reference only. They are not part of the production runtime and the new application does not read `catalog.json`.

The original save is never written. Runtime data is kept under `data/`, which is intentionally gitignored.

## Run the new application

```bash
npm install
npm run dev
```

The app auto-detects the reference parser at `../public-reference/fc26companion`. For another location, copy [`config.example.json`](config.example.json) to `config.json` and edit `companionRoot`. Environment variables remain available as overrides.

The recommended local setup is:

```bash
cp config.example.json config.json
npm run dev
```

`config.json` is local-only and ignored by Git. Its `companionRoot` must point to the checkout of the pinned `fc26companion` revision. The server creates the SQLite database and object store under `data-v2/` automatically.

The UI can upload an Apollo-exported `DATA` file, preview the parsed career, and commit it as a new immutable snapshot. Use `/import.html` for imports, `/` for single-snapshot browsing, and `/compare.html` for live comparisons. The original file is never written. No legacy catalog migration is required. See [`docs/USER_WORKFLOW.md`](docs/USER_WORKFLOW.md).

## Synthetic demo data

Legacy JSON fixtures are not valid Apollo `DATA` files and must not be uploaded to the parser. To seed four safe synthetic snapshots directly into the new SQLite store:

```bash
npm run demo:seed
```

The fixture is explicitly marked synthetic and is safe to rerun; it never reads or modifies a real save.

## Legacy reference

The retired Python flow is documented in [`legacy/README.md`](legacy/README.md). It is intentionally not used by the new app.


For external player names, provide the primary Companion/DataHub catalog:

```bash
FC26_PLAYER_NAMES=/path/to/fc26companion/data/playernames_fc26.csv
```

Optional fallback CSVs can be supplied as an OS-separated list; they are only consulted for IDs missing from the primary catalog:

```bash
FC26_PLAYER_NAMES_FALLBACK=/path/to/alternative.csv:/path/to/kaggle.csv
```

Name resolution uses the primary external `player_id` first, then fallback catalogs, then names recovered from the save, then `Player #ID`. Attribution is recorded in `REFERENCE_SOURCES.json`.

Supported checkpoints:

- `season_start`
- `summer_window_closed`
- `january_window_closed`
- `season_end`
- custom label through the web flow

## Synthetic demo fixtures

To create four safe demo snapshots from an already imported snapshot:

```bash
PYTHONPATH=. python3 generate_demo_data.py
```

The generator writes only to `data/demo/` and never modifies the original save, working copy, or production catalog. It covers unchanged players, rating/potential changes, one incoming player, one departed player, and academy growth.

To view the synthetic catalog in the local web app without using production data:

```bash
FC26_COMPANION_DATA_ROOT=/Users/adityandar/Project/learning/fc26-save-research/ps4-companion/data/demo \
PYTHONPATH=. python3 run_ps4_companion.py --port 4131
```
