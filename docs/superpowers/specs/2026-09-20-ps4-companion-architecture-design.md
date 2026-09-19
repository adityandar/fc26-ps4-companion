# FC26 PS4 Companion Architecture Design

## Status

Approved direction: rebuild the application as a TypeScript-first PS4 snapshot companion using `fc26companion` as the parser, domain, engine, and UI reference. The current Python application remains available as a parity oracle during migration and moves to `legacy/` only after the replacement passes explicit parity gates.

## Product Goal

Build a local-first web application that imports decrypted Apollo PS4 Career Mode saves as immutable snapshots, lets a user inspect any single snapshot, and computes comparisons live between any two snapshots in the same career, including snapshots from different seasons.

The application must remain read-only with respect to every uploaded save. It must never modify, overwrite, re-sign, or write a save back to the console format.

## Core Product Rules

1. A snapshot records state at one moment. It does not contain a permanent comparison result.
2. Comparison is derived live from a user-selected Snapshot A and optional Snapshot B.
3. Snapshot A alone is a complete, useful view.
4. Snapshot A and B may be from different seasons.
5. Comparisons normally require the same application-managed career identity.
6. Original save bytes are immutable and untrusted.
7. Every parsed claim has reproducible provenance: source hash, parser version, schema version, and evidence classification.
8. Demo data uses the same domain models, repository interfaces, comparison service, and UI as production data.

## Chosen Technical Direction

### Runtime

- TypeScript on Node.js for parser integration, domain logic, local HTTP server, and application services.
- A modern TypeScript frontend reused or adapted from `fc26companion` rather than the current server-rendered Python HTML.
- SQLite as the canonical normalized data store.
- Filesystem object storage for immutable uploaded bytes and parser artifacts.
- The existing Python POC is retained under a compatibility boundary until parity is proven.

### Why TypeScript-First

`fc26companion` already provides the most valuable mature components: the FC26 database parser, metadata decoder, name resolver, observation model, standings engine, and web application patterns. Keeping the final application in TypeScript removes the Python-to-`tsx` subprocess boundary and avoids reimplementing Companion domain logic.

## System Boundaries

```text
Browser
  ├── Import workflow
  ├── Career and snapshot browser
  ├── Single snapshot view
  └── Live comparison view
          │
          ▼
Local TypeScript server
  ├── ImportService
  ├── SnapshotRepository
  ├── ComparisonService
  ├── EnrichmentService
  └── ExportService
          │
          ├── SQLite normalized store
          ├── Immutable object store
          └── FC26 Companion parser/domain modules
```

Each unit must have a narrow interface. The browser never reads raw save bytes. The comparison service never invokes the parser. Rendering code never interprets raw database field names.

## Import Flow

1. The user chooses a decrypted Apollo `DATA` file.
2. The server streams the upload into a temporary inbox with a size limit.
3. The server computes SHA-256 before parsing.
4. The file is copied byte-for-byte into an immutable object path keyed by SHA-256.
5. The copied hash is verified against the upload hash.
6. The FC26 parser reads only the immutable copy.
7. The PS4 adapter converts parser tables into a versioned normalized snapshot candidate.
8. Validation checks required identity, counts, supported schema, and evidence metadata.
9. The user assigns the candidate to an existing career or creates a new career.
10. The user sets season label, checkpoint, and optional notes.
11. SQLite writes snapshot metadata and normalized entities in one transaction.
12. A duplicate `(career_id, source_sha256)` is idempotent. A newer parser may create a new parser run or enrichment revision, but not a duplicate snapshot.

No comparison runs during import.

## Career Identity

The application generates an immutable UUID for each career. Manager name and club are observed snapshot attributes, not identity keys.

On import the user chooses:

- create a new career; or
- add to an existing career.

The UI may recommend a likely career using manager name, club team ID, and parsed season, but must not silently merge careers. This allows manager club changes and prevents two careers with the same manager and club from colliding.

## Snapshot Model

Every snapshot contains:

- `snapshot_id`: application UUID;
- `career_id`: application UUID;
- `source_sha256` and verified copy hash;
- immutable object path;
- original filename and byte size;
- `schema_version`;
- parser name, parser version, and parse timestamp;
- parsed season index and user-visible season label;
- checkpoint enum or custom label;
- observed manager, club ID, and club name;
- estimated in-game date plus estimation basis;
- normalized senior squad state;
- normalized academy state;
- normalized contracts, competitions, fixtures, and transfers when supported;
- user note stored separately from parser facts;
- parse warnings and unknown-table statistics.

The normalized snapshot must not contain `insights`, `changes`, or a pointer to a previous snapshot.

## Player State

Player identity uses game `playerid` within a career. Each player state stores raw identifiers and normalized values separately:

- player ID and name IDs;
- resolved display name, resolution source, resolver version, and provisional flag;
- senior, academy, loan, or departed membership state;
- preferred and squad positions;
- overall and potential;
- birthdate, height, weight, nationality, and preferred foot;
- contract expiry, wage, role, and status;
- relevant appearances, goals, cards, form, and injury fields;
- supported technical attributes.

Names are enrichment, not identity. Improved name catalogs may update display enrichment without changing historical player identity or source facts.

## Evidence and Provenance

Fields and transforms are classified as:

- `observed`: decoded directly from a known table and field;
- `candidate`: repeatable mapping with incomplete validation;
- `inferred`: derived from multiple observed values or heuristics.

The codebase keeps a schema manifest mapping normalized fields to source table, source field, transform, classification, and supporting reference. Estimated dates must retain their basis and must be labeled as estimates in the UI.

## Storage Design

SQLite is the single canonical source for normalized application data.

Initial tables:

- `career`;
- `snapshot`;
- `parser_run`;
- `snapshot_player`;
- `snapshot_academy_player`;
- `snapshot_contract`;
- `snapshot_competition`;
- `snapshot_fixture`;
- `snapshot_note`;
- `field_evidence`;
- `data_source_attribution`.

Uploaded bytes remain outside SQLite in an object directory such as `data/objects/<sha256>/DATA`. Writes use transactions and foreign keys. Migrations are numbered, forward-only in production, and tested against a copied database.

JSON export remains supported but is generated from the repository; JSON is not a second writable source of truth.

## Single Snapshot View

Selecting one snapshot shows the complete state available at that moment:

- career overview;
- manager and club;
- season, checkpoint, and estimated date;
- squad and academy;
- contracts and player attributes;
- competitions and standings when supported;
- transfers and fixtures when supported;
- notes, parser warnings, provenance, and export actions.

This view must not imply that a previous snapshot is required.

## Live Comparison

The comparison service accepts two immutable snapshots:

```ts
compareSnapshots(snapshotA: SnapshotId, snapshotB: SnapshotId): ComparisonResult
```

It validates career compatibility, loads both states, and returns ephemeral typed changes:

- players joined and departed;
- senior/academy transitions;
- overall and potential changes;
- position and contract changes;
- wage and squad role changes;
- academy development;
- transfer evidence;
- competition and standings changes;
- fixture and season summaries.

Each player-level change includes player ID, best available display name, before value, after value, and evidence. The UI may cache the result by `(snapshot_a, snapshot_b, comparison_version)`, but the cache is disposable and never canonical.

Cross-season comparison is allowed within one career. The UI must show both season labels and checkpoints prominently. Cross-career comparison is outside the first implementation and may be added later as an explicitly warned advanced mode.

## Name Resolution

The resolver order is:

1. literal edited names in the save;
2. primary FC26 player ID catalog;
3. one configured fallback catalog for missing IDs;
4. literal `dcplayernames` data;
5. Companion name-ID derivation;
6. `Player #<id>` fallback.

The resolver loads and indexes catalogs once per server process. Every resolution records source and provisional status. Source attribution is stored in the database and exposed in an acknowledgements/data-sources view.

## Demo and Fixture Design

Synthetic fixtures use the same normalized `SnapshotCandidate` builder and repository interface as real parser output. They write to a separate SQLite database and object root. Demo mode is read-only: upload and mutation endpoints are disabled.

Fixtures cover:

- single snapshot;
- four checkpoints;
- joined/departed players;
- overall and potential changes;
- contract and position changes;
- academy additions and promotions;
- unresolved and edited names;
- cross-season comparison;
- partial or unavailable fields.

## Web Application Flow

### Home

- list careers;
- create/import snapshot;
- open demo workspace;
- show parser and data-source status.

### Career page

- timeline grouped by season;
- checkpoint cards;
- Snapshot A selector;
- optional Snapshot B selector;
- single-view and compare actions.

### Comparison page

- explicit A and B labels;
- summary counts;
- named player changes;
- filters by change type;
- detailed before/after values;
- CSV and JSON export.

UI polish follows stable domain data. Raw JSON remains available in a developer diagnostics view, not as the main user experience.

## Error Handling

- Uploaded content is treated as untrusted binary data and never executed.
- Parsing runs with bounded input size and clear failure output.
- Failed imports leave no snapshot transaction but retain an auditable parser-run failure record where safe.
- Unsupported schema and incomplete extraction are explicit states, not empty success.
- Duplicate imports are idempotent.
- Database migrations back up or copy the database before transformation.
- Demo and production stores cannot share a writable path.

## Migration Strategy

The transition uses expand, migrate, verify, contract.

### Expand

- introduce the TypeScript app beside the Python POC;
- add SQLite and normalized models;
- reuse Companion modules through a pinned source revision or package boundary;
- preserve current JSON and working copies unchanged.

### Migrate

- write a one-way importer from current `catalog.json` and derived import JSON into SQLite;
- mark migrated records with source provenance;
- tolerate records from older parser versions with missing roster fields;
- keep migration idempotent by source hash and career assignment.

### Verify

- compare hashes, career identity, squad counts, player IDs, academy counts, and selected field values between Python POC and TypeScript output;
- run both paths against the same working copies;
- document every accepted discrepancy.

### Contract

- move Python runtime files to `legacy/` only after parity gates pass;
- retain migration and verification tools;
- never delete existing user data automatically;
- remove legacy runtime only with separate explicit authorization.

Rollback before contract is switching back to the Python application and its untouched JSON catalog. SQLite and the new object store are additive.

## Reuse and Dependency Boundary

The application must pin the exact `fc26companion` revision used. Reused files, packages, and data sources retain their original attribution and license notices. Internal Companion modules are wrapped behind local adapter interfaces so upstream path changes do not leak throughout the application.

Primary adapters:

```ts
interface SaveParser {
  parse(path: string): Promise<ParsedSave>;
}

interface SnapshotNormalizer {
  normalize(parsed: ParsedSave, context: ImportContext): SnapshotCandidate;
}

interface SnapshotRepository {
  save(candidate: SnapshotCandidate): Promise<Snapshot>;
  get(id: SnapshotId): Promise<Snapshot>;
  listByCareer(careerId: CareerId): Promise<SnapshotSummary[]>;
}
```

## Testing Strategy

- parser adapter contract tests using immutable working-copy fixtures;
- normalizer tests for each supported table and transform;
- repository tests against temporary SQLite databases;
- migration tests from current JSON variants;
- single snapshot view tests;
- live comparison tests for same-season and cross-season pairs;
- name resolver precedence tests;
- demo/production isolation tests;
- browser-level import, select, compare, and export tests;
- source-hash preservation tests proving original bytes remain unchanged.

No completion claim is valid without the relevant focused tests and a real-save parity run performed by the user or in an authorized local environment.

## Delivery Phases and Checkpoints

1. TypeScript workspace, pinned Companion boundary, SQLite migrations, and repository.
2. Immutable PS4 import and normalized single snapshot persistence.
3. Career assignment and snapshot timeline.
4. Dynamic A/B selector and live comparison, including cross-season fixtures.
5. Squad, academy, contract, and player-development parity.
6. Transfers, competitions, fixtures, and standings.
7. Mature UI, exports, provenance, and attribution.
8. Python/TypeScript parity report and legacy retirement decision.

The user reviews the application at the end of every phase before the next phase begins.

## Acceptance Criteria

- The original Apollo save hash remains unchanged after every operation.
- A single snapshot is fully viewable without comparison.
- Any two snapshots in one career can be selected and compared live.
- Cross-season comparison works without rewriting either snapshot.
- Snapshot records contain no persisted previous-snapshot relationship or canonical comparison output.
- Duplicate imports create no duplicate snapshot.
- Demo and production use the same services while remaining physically isolated.
- Names and decoded fields expose provenance and uncertainty.
- Current JSON data can be migrated idempotently.
- Python POC remains recoverable until parity is approved.

