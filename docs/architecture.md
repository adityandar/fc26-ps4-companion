# FC26 PS4 Companion Architecture

## Purpose

FC26 PS4 Companion is a read-only career archive for decrypted EA Sports FC 26 PS4 saves exported with Apollo Save Tool.

The application imports save snapshots, preserves their original bytes, extracts career data through the pinned `fc26companion` parser, stores normalized facts in SQLite, and derives single-snapshot views and live comparisons in the application layer.

The application is not a save editor. It never modifies, resigns, or writes back to an original save.

## System overview

```text
                    Browser
                       │
             React + Vite frontend
                       │ fetch /api/*
                       ▼
                 Node HTTP server
              ┌────────┼────────┐
              │        │        │
          Import API  View API  Compare API
              │        │        │
              ▼        ▼        ▼
        ImportService  SQLite repository
              │              │
              ▼              ▼
       Immutable object store   Snapshot facts
              │
              ▼
       fc26companion adapter
              │
              ▼
       FIFA/FC26 database tables
```

## Runtime components

### Frontend

The frontend is a React application built with Vite.

Source files live under:

```text
frontend/
  index.html
  src/
    entry.tsx
    main.tsx
    styles.css
```

`frontend/src/main.tsx` currently contains the application shell, page composition, reusable table renderer, import flow, snapshot view, and comparison view. The entry file mounts the React application into the single `index.html` document.

The frontend routes are:

```text
/
/import
/view
/compare
```

The old `.html` URLs are retained only as compatibility routes in the HTTP server. The new frontend does not navigate to them.

### Frontend build

Vite builds the frontend into:

```text
web-v2/dist/
```

Generated files are ignored by Git. `npm run dev` builds the frontend before starting the Node server, so the normal development flow remains:

```bash
npm run dev
```

The frontend uses:

- React for component rendering;
- TanStack Table v8 for sorting and filtering;
- local CSS tokens and responsive layout;
- no runtime network dependency for fonts or assets.

## Backend

The backend starts in [src/main.ts](../src/main.ts).

It loads `config.json`, opens the SQLite database, initializes the immutable object store, creates the import service, and starts the HTTP API server.

Important backend modules:

```text
src/
  main.ts                    application composition root
  config.ts                  config.json and environment overrides
  server/apiServer.ts        HTTP routes and static frontend serving
  import/importService.ts    preview, staging, and commit workflow
  import/objectStore.ts      immutable byte storage
  import/saveParser.ts       upstream parser boundary
  import/ps4Normalizer.ts    normalized PS4 snapshot mapping
  store/database.ts          SQLite schema and migrations
  store/snapshotRepository.ts persistence and retrieval
  comparison/compareSnapshots.ts live A/B comparison
  domain/                    stable application data contracts
  upstream/companion.ts      pinned fc26companion adapter
```

## Import flow

The import flow has two phases.

### Preview

1. The browser reads the selected file as bytes.
2. The browser sends the bytes to `POST /api/import/preview`.
3. The server validates the request size and filename.
4. `ImportService` computes the source SHA-256.
5. The bytes are copied into the object store.
6. The copy SHA-256 is calculated and compared with the source hash.
7. The working copy is parsed through `src/import/saveParser.ts`.
8. The server returns metadata and summary information without committing a snapshot.
9. A short-lived preview token is created.

### Commit

1. The browser confirms the career, season, checkpoint, and note.
2. The browser sends the preview token to `POST /api/import/commit`.
3. The server verifies that the preview token has not expired.
4. The normalized candidate is persisted as an immutable snapshot.
5. Snapshot player rows, academy rows, evidence, and career facts are stored in SQLite.
6. The object copy remains available under its SHA-256 identity.

The original source path is never used as a write target.

## Parser boundary

The application intentionally uses the pinned public `fc26companion` implementation rather than maintaining a second independent FC26 decoder.

The boundary is:

[src/upstream/companion.ts](../src/upstream/companion.ts)

The parser receives:

- the Apollo-decrypted `DATA` working copy;
- `fifa_ng_db-meta.xml` from the pinned Companion reference;
- name and competition datasets from the same reference.

The parser produces database tables. The local normalizer selects and maps only fields declared by the application domain.

This boundary prevents upstream implementation details from leaking throughout the application and allows the parser dependency to be updated deliberately.

## Normalized domain model

The application stores an immutable `Snapshot` containing:

- career identity;
- season and checkpoint metadata;
- source and copy SHA-256 hashes;
- manager and club hints;
- senior player state;
- academy player state;
- evidence classifications;
- parser warnings;
- career facts.

Career facts currently include:

- manager reputation and finances;
- club worth and prestige fields;
- manager history;
- competition progress;
- active league standings;
- record scorelines where available.

Club-focused facts are selected from the current managed club and are kept separate from generic player metadata:

- `career_managerhistory`: season record, league/team IDs, results, points, table position, objectives, and biggest buy/sell labels and amounts;
- `career_managerinfo` and `career_users`: manager context, earnings, wage, board/reputation fields, and current club identity;
- `career_playercontract`: contract duration/status, role, wage, dates, and bonuses for players in the current squad;
- `career_playergrowthuserseason`: current-season overall and selected attribute values for players present in the snapshot;
- `career_squadranking`: current and previous squad overall values, retained as raw numeric values until scale semantics are verified;
- `career_presignedcontract`: incoming/outgoing offer activity linked to the managed club.

The following audited tables are intentionally excluded from the current product scope: `previousteam`, `career_playerlastgrowth`, and `career_playermatchratinghistory`. They may be revisited only when a concrete manager/club dashboard use case and field semantics are established.

The view page displays the facts from one snapshot. The comparison page derives differences live between any two snapshots; no comparison result is written back into the stored snapshot.

Raw values are not silently guessed. For example:

- manager budget `0` is shown as unavailable;
- manager history position `0` is treated as unavailable rather than a valid table position;
- competition `stageid` values remain labeled internal stage codes unless a verified mapping exists;
- `stageid = -1` is shown as not started.
- opaque IDs such as `leagueId`, `teamId`, `contractType`, and `playerRole` remain codes unless a verified lookup is available.

## Storage layout

The default local configuration is:

```json
{
  "companionRoot": "../public-reference/fc26companion",
  "objectRoot": "data-v2/objects",
  "databasePath": "data-v2/companion.sqlite",
  "host": "127.0.0.1",
  "port": 4132
}
```

The runtime data layout is:

```text
data-v2/
  companion.sqlite
  objects/
    <sha256>/
      DATA
```

The SQLite database stores canonical normalized facts. The object store stores immutable bytes. Neither layer overwrites an original Apollo export.

## API surface

### Careers and snapshots

```text
GET  /api/careers
GET  /api/careers/:careerId/snapshots
GET  /api/snapshots/:snapshotId
```

### Import

```text
POST /api/import/preview
POST /api/import/commit
```

### Comparison and exports

```text
GET /api/compare?a=<snapshotId>&b=<snapshotId>
GET /api/snapshots/:snapshotId/export.json
GET /api/snapshots/:snapshotId/export.csv
```

Comparisons are calculated at request time. Comparison results are not persisted into snapshots.

## Comparison model

Snapshots are immutable observations. The comparison service derives differences between any two compatible snapshots from the same career.

It can report:

- players joined;
- players departed;
- player field changes;
- academy movement;
- career fact changes where supported.

Because the comparison is live, users can compare:

- season start to season end;
- transfer window checkpoints;
- snapshots across different seasons;
- any other two checkpoints in the same Career.

## Read-only and security boundaries

- Original save files are never modified.
- Uploaded content is treated as untrusted bytes.
- Save content is parsed as data and never executed.
- Upload size is bounded by the HTTP server.
- Filenames are sanitized before staging.
- Preview tokens expire after a short period.
- Static frontend routes are separated from `/api/*` routes.
- `sources/`, `public-reference/`, and legacy inputs are not production write targets.

## Legacy boundary

The previous Python/catalog implementation is retained under `legacy/` for historical reference and parity investigation.

Production code does not depend on:

- legacy catalog files;
- legacy JSON summaries;
- the old Python web server;
- the previous comparison persistence model.

The current production path is TypeScript + React + SQLite + the pinned Companion parser adapter.

## Development commands

```bash
npm run dev          # build frontend and start application at localhost:4132
npm run build:web    # build only the React frontend
npm run typecheck    # TypeScript validation
npm test             # backend and normalization tests
npm run demo:seed    # create synthetic snapshots for UI testing
npm run reset:dev -- --confirm  # reset only development data-v2 state
```

## Known limitations

- Some FC26 internal numeric codes do not yet have verified human-readable mappings.
- Player names can remain ID-based when neither the save nor the configured fallback dataset contains a name.
- Competition stage codes are intentionally not guessed.
- The frontend currently keeps several page components in `frontend/src/main.tsx`; this is functional but is a future cleanup target for more granular component files.
- The development server still retains compatibility handling for the older `.html` URLs.

## Attribution

The application uses and attributes the pinned `fc26companion` project as the parser and database interpretation reference. Additional references are recorded in:

- [docs/UPSTREAM.md](UPSTREAM.md)
- [REFERENCE_SOURCES.json](../REFERENCE_SOURCES.json)
- the public-reference repositories kept outside production data paths.
