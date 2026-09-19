# FC26 PS4 Companion

Local, read-only snapshot importer for Apollo-exported EA SPORTS FC 26 PS4 saves.

## Current vertical slice

- Creates a byte-for-byte working copy before parsing.
- Records source and working-copy SHA-256 hashes.
- Calls the existing `fc26companion` parser for database/career extraction.
- Uses a structured JSON bridge to the Companion parser rather than scraping terminal text.
- Supports season, checkpoint, and user notes.
- Prevents duplicate imports for the same career and save hash.
- Treats one imported save as a complete `single_snapshot` baseline: career state, roster counts, parser coverage, hashes, and user notes remain available even without a comparison save. Later saves can add `comparison` insights.
- Provides a local upload page at `http://127.0.0.1:4130`.

The original save is never written. Runtime data is kept under `data/`, which is intentionally gitignored.

## CLI

```bash
PYTHONPATH=. python3 import_ps4_snapshot.py /path/to/DATA \
  --season 2026/27 \
  --checkpoint season_start \
  --note "Initial checkpoint" \
  --companion-root /path/to/fc26companion \
  --confirm
```

## Web app

Set `FC26_COMPANION_ROOT` to the local checkout of `fc26companion`, then run:

```bash
FC26_COMPANION_ROOT=/path/to/fc26companion PYTHONPATH=. \
  python3 run_ps4_companion.py --port 4130
```

Supported checkpoints:

- `season_start`
- `summer_window_closed`
- `january_window_closed`
- `season_end`
- custom label through the web flow
