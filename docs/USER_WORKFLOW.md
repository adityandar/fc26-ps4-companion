# User workflow

The production application has three separate pages:

1. **Import** (`/import.html`) — choose an Apollo-exported `DATA` file. The server creates a byte-identical copy, verifies both SHA-256 hashes, and parses only the copy. The preview shows the detected career hint, player counts, warnings, and hash. The user then chooses an existing or new Career, season, and checkpoint before committing.
2. **Archive** (`/`) — choose one Career and one Snapshot. This page is for single-snapshot inspection: squad, academy, evidence classifications, integrity hashes, and CSV/JSON exports.
3. **Compare** (`/compare.html`) — choose any two snapshots within a Career. The comparison is calculated live and includes joined, departed, and field-level player changes. It is never written into either snapshot.

The original save is never changed. Uploaded bytes are kept under `data-v2/objects/`, while canonical snapshot facts are stored in `data-v2/companion.sqlite`. Preview tokens expire after 15 minutes. The old Python/catalog flow is under `legacy/` and is not read by production code.
