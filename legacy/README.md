# Legacy FC26 PS4 Companion

This folder contains the previous Python proof of concept and its JSON catalog/data. It is preserved read-only for historical comparison and recovery.

Nothing under this directory is imported by the TypeScript application. The production path uses `src/`, `web-v2/`, and `data-v2/companion.sqlite`.

Legacy contents:

- `python/` — old importer, parser bridge, insight engine, and web server;
- `data/legacy-save-data/` — old catalog, imported records, demo records, and working data;
- `scripts/` — old JSON migration/parity utilities;
- `tests/` — old Python tests.

Do not place new production code here.
