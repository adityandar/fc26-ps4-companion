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
FC26_COMPANION_ROOT=/path/to/fc26companion \
FC26_COMPANION_OBJECT_ROOT=data-v2/objects \
HOST=0.0.0.0 PORT=4132 npm run dev
```

The UI can upload an Apollo-exported `DATA` file, preview the parsed career, and commit it as a new immutable snapshot. The original file is never written. No legacy catalog migration is required.

## Legacy reference

The retired Python flow is documented in [`legacy/README.md`](legacy/README.md). It is intentionally not used by the new app.

```bash
FC26_COMPANION_ROOT=/path/to/fc26companion PYTHONPATH=. \
python3 run_ps4_companion.py --port 4130
```

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
