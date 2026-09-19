# FC26 PS4 Companion Total Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Python proof of concept with a mature TypeScript-first local web application that imports immutable PS4 save snapshots into SQLite and compares any two snapshots live, including cross-season pairs.

**Architecture:** Pin and wrap the proven `fc26companion` parser/domain implementation, normalize Apollo PS4 saves into versioned snapshot records, store canonical facts in SQLite, and derive single-snapshot and A/B comparison views through application services. Keep the Python POC and current JSON data intact until an explicit parity checkpoint authorizes contraction.

**Tech Stack:** Node.js 20+, TypeScript 5.8, `tsx` 4.21, `better-sqlite3` 13, `fast-xml-parser` 4.5, Node test runner, loopback-only `node:http`, SQLite WAL, browser ES modules and CSS.

**Spec:** `docs/superpowers/specs/2026-09-20-ps4-companion-architecture-design.md`

## Global Constraints

- All save analysis is read-only. Never modify, overwrite, re-sign, or write back an uploaded save.
- Create and hash-verify a byte-for-byte immutable copy before parsing.
- Treat every save as untrusted binary data and never execute its contents.
- Files under `sources/` and `public-reference/` are read-only references.
- Persist `observed`, `candidate`, or `inferred` evidence for decoded fields; never present an unsupported mapping as fact.
- Snapshot facts are immutable; live comparisons are derived and non-canonical.
- Production and demo stores must use different database files and object roots.
- Preserve current JSON catalogs, import files, working copies, and the Python POC throughout expand/migrate/verify.
- Pin upstream `fc26companion` revision `0e1d32a87c9947be681803cd506bc543f912cfd8` and retain MIT attribution.
- The user runs server, real-save parsing, and manual checkpoint commands. Agents may prepare commands but do not launch those processes without a new explicit request.
- No legacy contraction or deletion occurs without a separate explicit approval after parity verification.

---

## Phase 1 — TypeScript Foundation and Canonical Store

### Task 1: Establish the TypeScript workspace and upstream boundary

**Files:**
- Modify: `package.json`
- Create: `package-lock.json`
- Create: `tsconfig.json`
- Create: `src/upstream/companion.ts`
- Create: `docs/UPSTREAM.md`
- Create: `tests/upstream-boundary.test.ts`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: pinned `fc26companion` source revision and its parser/data assets.
- Produces: `CompanionModules` adapter exposing parser, metadata, name resolver, and selected domain constants without leaking upstream paths.

- [ ] **Step 1: Write the failing upstream boundary test**

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { companionRevision, loadCompanionModules } from '../src/upstream/companion.ts';

test('pins the reviewed Companion revision and loads required modules', async () => {
  assert.equal(companionRevision, '0e1d32a87c9947be681803cd506bc543f912cfd8');
  const modules = await loadCompanionModules();
  assert.equal(typeof modules.parseSave, 'function');
  assert.equal(typeof modules.loadDbMeta, 'function');
  assert.equal(typeof modules.createNameResolver, 'function');
});
```

- [ ] **Step 2: Ask the user to install dependencies and confirm the test fails**

Run:

```bash
npm install
npm test -- tests/upstream-boundary.test.ts
```

Expected: FAIL because `src/upstream/companion.ts` does not exist.

- [ ] **Step 3: Add the workspace and adapter**

Set scripts in `package.json`:

```json
{
  "scripts": {
    "test": "node --import tsx --test tests/*.test.ts",
    "typecheck": "tsc --noEmit",
    "dev": "tsx src/main.ts",
    "migrate:json": "tsx scripts/migrateJson.ts",
    "verify:parity": "tsx scripts/verifyParity.ts"
  }
}
```

Add `better-sqlite3`, `fast-xml-parser`, `tsx`, TypeScript, and Node typings at the versions declared in the plan header. Implement `loadCompanionModules()` as the only module allowed to import pinned Companion parser/name/domain files. Document upstream URL, revision, license, imported assets, and update procedure in `docs/UPSTREAM.md`.

- [ ] **Step 4: Ask the user to run foundation verification**

```bash
npm test -- tests/upstream-boundary.test.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json tsconfig.json src/upstream/companion.ts docs/UPSTREAM.md tests/upstream-boundary.test.ts .gitignore
git commit -m "chore: establish TypeScript companion boundary"
```

### Task 2: Define versioned domain models and evidence manifest

**Files:**
- Create: `src/domain/ids.ts`
- Create: `src/domain/snapshot.ts`
- Create: `src/domain/comparison.ts`
- Create: `src/domain/evidence.ts`
- Create: `src/domain/positions.ts`
- Create: `tests/domain-model.test.ts`

**Interfaces:**
- Produces: `CareerId`, `SnapshotId`, `SnapshotCandidate`, `Snapshot`, `PlayerState`, `AcademyPlayerState`, `ComparisonResult`, and `FieldEvidence`.
- Consumed by: repository, normalizer, import service, comparison service, API, fixtures, and exports.

- [ ] **Step 1: Write failing serialization and invariant tests**

```ts
test('snapshot facts contain no persisted comparison', () => {
  const snapshot = makeSnapshot();
  assert.equal('insights' in snapshot, false);
  assert.equal('previousSnapshotId' in snapshot, false);
});

test('position zero remains goalkeeper', () => {
  assert.equal(positionName(0), 'GK');
});
```

- [ ] **Step 2: Ask the user to run the domain test**

```bash
npm test -- tests/domain-model.test.ts
```

Expected: FAIL because the domain files do not exist.

- [ ] **Step 3: Implement explicit immutable domain types**

Use readonly properties and `SCHEMA_VERSION = 1`. Keep source facts separate from enrichment:

```ts
export interface ResolvedName {
  readonly display: string;
  readonly source: 'edited' | 'primary' | 'fallback' | 'literal' | 'derived' | 'unresolved';
  readonly provisional: boolean;
  readonly resolverVersion: string;
}
```

Define evidence records with exact table, field, transform, classification, and reference URI. Centralize the complete position enum in `positions.ts`; rendering and CSV export must import it rather than duplicate maps.

- [ ] **Step 4: Ask the user to run domain verification**

```bash
npm test -- tests/domain-model.test.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain tests/domain-model.test.ts
git commit -m "feat(domain): define immutable snapshot models"
```

### Task 3: Add SQLite migrations and repository

**Files:**
- Create: `src/store/migrations/001_initial.sql`
- Create: `src/store/migrate.ts`
- Create: `src/store/database.ts`
- Create: `src/store/snapshotRepository.ts`
- Create: `tests/snapshot-repository.test.ts`

**Interfaces:**
- Consumes: domain snapshot types.
- Produces: `SnapshotRepository` with `createCareer`, `listCareers`, `saveSnapshot`, `getSnapshot`, `listSnapshots`, and `findByHash`.

- [ ] **Step 1: Write failing repository tests against a temporary database**

```ts
test('stores one immutable snapshot per career and source hash', () => {
  const repo = openTestRepository();
  const career = repo.createCareer({ label: 'Padova career' });
  const first = repo.saveSnapshot(candidate(career.id));
  const second = repo.saveSnapshot(candidate(career.id));
  assert.equal(first.id, second.id);
  assert.equal(repo.listSnapshots(career.id).length, 1);
});
```

Add tests for foreign keys, notes stored separately, parser runs, and rollback on a failed player insert.

- [ ] **Step 2: Ask the user to run the repository tests and confirm failure**

```bash
npm test -- tests/snapshot-repository.test.ts
```

- [ ] **Step 3: Implement migration runner and repository transaction**

`001_initial.sql` creates `schema_meta`, `career`, `snapshot`, `parser_run`, `snapshot_player`, `snapshot_academy_player`, `snapshot_contract`, `snapshot_note`, `field_evidence`, and `data_source_attribution`. Enable WAL and foreign keys. Use `UNIQUE(career_id, source_sha256)`.

- [ ] **Step 4: Ask the user to run repository verification**

```bash
npm test -- tests/snapshot-repository.test.ts
npm run typecheck
```

- [ ] **Step 5: Commit**

```bash
git add src/store tests/snapshot-repository.test.ts
git commit -m "feat(store): add canonical SQLite snapshot repository"
```

**Checkpoint 1 acceptance:** TypeScript workspace loads the pinned Companion boundary, domain models exclude comparison state, and SQLite persists immutable snapshots transactionally.

---

## Phase 2 — Read-Only PS4 Import

### Task 4: Build the immutable object store

**Files:**
- Create: `src/import/objectStore.ts`
- Create: `tests/object-store.test.ts`

**Interfaces:**
- Produces: `stageSave(input: Readable | string): Promise<StagedObject>` where `StagedObject` contains source hash, copied hash, size, and immutable path.

- [ ] **Step 1: Write tests proving byte preservation and idempotence**

```ts
test('stages a byte-identical object and never mutates the source', async () => {
  const before = await readFile(source);
  const staged = await store.stageFile(source);
  assert.deepEqual(await readFile(source), before);
  assert.equal(staged.sourceSha256, staged.copySha256);
});
```

- [ ] **Step 2: Ask the user to run and observe failure**

```bash
npm test -- tests/object-store.test.ts
```

- [ ] **Step 3: Implement streaming hash and exclusive object creation**

Write to a temporary file inside the configured object root, verify its hash, then atomically rename it to `objects/<sha256>/DATA`. Existing matching objects are reused. Reject files above the configured upload limit.

- [ ] **Step 4: Ask the user to run verification**

```bash
npm test -- tests/object-store.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/import/objectStore.ts tests/object-store.test.ts
git commit -m "feat(import): add immutable save object store"
```

### Task 5: Wrap the Companion parser and normalize PS4 snapshots

**Files:**
- Create: `src/import/saveParser.ts`
- Create: `src/import/ps4Normalizer.ts`
- Create: `src/import/schemaManifest.ts`
- Create: `tests/fixtures/parser-output.json`
- Create: `tests/ps4-normalizer.test.ts`

**Interfaces:**
- Consumes: staged immutable save path and `CompanionModules`.
- Produces: `ParsedSave` and `SnapshotCandidate` with provenance and warnings.

- [ ] **Step 1: Write failing normalizer tests from a checked-in parser-output fixture**

Assert manager, club ID/name, parsed season index, estimated-date basis, player ID, position `0`, OVR, potential, contract expiry, academy state, and name provenance. Assert unknown fields are not silently promoted.

- [ ] **Step 2: Ask the user to run the tests and confirm failure**

```bash
npm test -- tests/ps4-normalizer.test.ts
```

- [ ] **Step 3: Implement parser and normalizer boundaries**

Use Companion's metadata and name resolver through `src/upstream/companion.ts`. Copy only fields declared in `schemaManifest.ts`. Store estimated date with the exact source table/field basis. Resolve academy names through the same player index as senior players.

- [ ] **Step 4: Ask the user to run normalizer verification**

```bash
npm test -- tests/ps4-normalizer.test.ts
npm run typecheck
```

- [ ] **Step 5: Commit**

```bash
git add src/import tests/fixtures/parser-output.json tests/ps4-normalizer.test.ts
git commit -m "feat(import): normalize Companion output for PS4 snapshots"
```

### Task 6: Implement career assignment and import orchestration

**Files:**
- Create: `src/import/importService.ts`
- Create: `tests/import-service.test.ts`

**Interfaces:**
- Consumes: `ObjectStore`, `SaveParser`, `SnapshotNormalizer`, and `SnapshotRepository`.
- Produces: `previewImport()` and `commitImport(previewId, careerChoice, metadata)`.

- [ ] **Step 1: Write failing preview/commit tests**

Cover create-career, existing-career, duplicate hash, user season/checkpoint metadata, parser failure, and transaction rollback. Assert import does not compute or persist comparison.

- [ ] **Step 2: Ask the user to run and observe failure**

```bash
npm test -- tests/import-service.test.ts
```

- [ ] **Step 3: Implement two-stage import**

Preview stages and parses but writes no snapshot. Commit requires an explicit career choice and writes normalized data transactionally. Career suggestions are advisory and never auto-merge.

- [ ] **Step 4: Ask the user to run import service verification**

```bash
npm test -- tests/import-service.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/import/importService.ts tests/import-service.test.ts
git commit -m "feat(import): add explicit PS4 snapshot import workflow"
```

**Checkpoint 2 acceptance:** A fixture can be staged, parsed, previewed, assigned to a career, and committed as a normalized SQLite snapshot without changing source bytes or persisting comparison state. The user performs one real-save parity import before Phase 3.

---

## Phase 3 — Compatibility Migration

### Task 7: Import legacy JSON data idempotently

**Files:**
- Create: `src/migration/legacyJson.ts`
- Create: `scripts/migrateJson.ts`
- Create: `tests/fixtures/legacy-catalog-minimal.json`
- Create: `tests/fixtures/legacy-catalog-enriched.json`
- Create: `tests/legacy-migration.test.ts`

**Interfaces:**
- Consumes: current `catalog.json`, optional `imports/*.json`, career mapping decisions.
- Produces: migration report and normalized SQLite snapshots marked with legacy provenance.

- [ ] **Step 1: Write failing migration tests**

Cover old records without roster data, enriched records, duplicate catalog/import records, stale persisted insights, and repeated migration. Assert persisted `insights` is ignored.

- [ ] **Step 2: Ask the user to run and observe failure**

```bash
npm test -- tests/legacy-migration.test.ts
```

- [ ] **Step 3: Implement expand-only migration**

Read legacy files without modifying them. Prefer the richer record for the same hash, discard legacy comparison output, create explicit career mappings, and write a JSON migration report containing imported, skipped, incomplete, and conflicting records.

- [ ] **Step 4: Ask the user to run migration tests**

```bash
npm test -- tests/legacy-migration.test.ts
```

- [ ] **Step 5: Ask the user to run a dry-run against copied legacy data**

```bash
npm run migrate:json -- --catalog data/catalog.json --database data-v2/companion.sqlite --dry-run
```

Expected: report only; no legacy file changes.

- [ ] **Step 6: Commit**

```bash
git add src/migration scripts/migrateJson.ts tests/fixtures/legacy-catalog-*.json tests/legacy-migration.test.ts
git commit -m "feat(migration): import legacy JSON snapshots idempotently"
```

**Checkpoint 3 acceptance:** Legacy JSON variants migrate repeatedly without duplication or mutation, and stale stored insights do not enter the canonical store.

---

## Phase 4 — Live Snapshot and Comparison Services

### Task 8: Build single-snapshot query models

**Files:**
- Create: `src/application/snapshotService.ts`
- Create: `src/application/viewModels.ts`
- Create: `tests/snapshot-service.test.ts`

**Interfaces:**
- Produces: `getCareerTimeline(careerId)` and `getSnapshotView(snapshotId)`.
- Consumed by: HTTP API and export service.

- [ ] **Step 1: Write failing single-snapshot tests**

Assert one snapshot returns overview, squad, academy, contracts, evidence, notes, warnings, and season/checkpoint without requiring another snapshot.

- [ ] **Step 2: Ask the user to run and observe failure**

```bash
npm test -- tests/snapshot-service.test.ts
```

- [ ] **Step 3: Implement query models**

Keep repository rows private to the store layer. Build stable API view models with explicit `available` and `unavailable` sections based on evidence, not truthiness.

- [ ] **Step 4: Ask the user to run verification**

```bash
npm test -- tests/snapshot-service.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/application tests/snapshot-service.test.ts
git commit -m "feat(application): add complete single-snapshot views"
```

### Task 9: Build typed live comparison

**Files:**
- Create: `src/comparison/compareSnapshots.ts`
- Create: `src/comparison/playerDiff.ts`
- Create: `src/comparison/academyDiff.ts`
- Create: `tests/comparison.test.ts`

**Interfaces:**
- Produces: `compareSnapshots(a: Snapshot, b: Snapshot): ComparisonResult`.
- Consumed by: comparison API, UI, and export service.

- [ ] **Step 1: Write failing comparison tests**

Cover single-career validation, same-season comparison, cross-season comparison, joined/departed players, OVR/potential/position/contract changes, academy additions, unchanged-field suppression, reversed A/B order, and unresolved names.

```ts
assert.deepEqual(result.players.joined[0], {
  playerId: 990001,
  name: 'Demo Incoming Player',
  nameSource: 'demo',
  after: expectedPlayer,
});
```

- [ ] **Step 2: Ask the user to run and observe failure**

```bash
npm test -- tests/comparison.test.ts
```

- [ ] **Step 3: Implement pure comparison functions**

Match players by game player ID. Emit typed before/after changes with names for presentation, but never use names as identity. Reject different careers with a typed compatibility error. Do not persist results.

- [ ] **Step 4: Ask the user to run comparison verification**

```bash
npm test -- tests/comparison.test.ts
npm run typecheck
```

- [ ] **Step 5: Commit**

```bash
git add src/comparison tests/comparison.test.ts
git commit -m "feat(comparison): compare arbitrary snapshots live"
```

**Checkpoint 4 acceptance:** Any A snapshot renders alone, and any A/B pair in one career compares live, including cross-season fixtures. No comparison data is written to SQLite.

---

## Phase 5 — HTTP API and Mature Web Flow

### Task 10: Add loopback-only API routes

**Files:**
- Create: `src/server/apiServer.ts`
- Create: `src/server/body.ts`
- Create: `src/server/routes.ts`
- Create: `src/config.ts`
- Create: `src/main.ts`
- Create: `tests/api-server.test.ts`

**Interfaces:**
- Produces routes: `GET /api/careers`, `POST /api/import/preview`, `POST /api/import/commit`, `GET /api/careers/:id/snapshots`, `GET /api/snapshots/:id`, `GET /api/compare?a=&b=`, and export endpoints.

- [ ] **Step 1: Write failing HTTP contract tests**

Test loopback defaults, upload limit, malformed multipart data, career choice requirement, single snapshot response, dynamic comparison, missing IDs, and demo mutation rejection.

- [ ] **Step 2: Ask the user to run and observe failure**

```bash
npm test -- tests/api-server.test.ts
```

- [ ] **Step 3: Implement the API server**

Reuse Companion's loopback-only server patterns. Route handlers call application services only. Return structured errors without raw stack traces. In demo mode, reject import and note mutation routes with HTTP 403.

- [ ] **Step 4: Ask the user to run API verification**

```bash
npm test -- tests/api-server.test.ts
npm run typecheck
```

- [ ] **Step 5: Commit**

```bash
git add src/server src/config.ts src/main.ts tests/api-server.test.ts
git commit -m "feat(api): expose snapshot and live comparison services"
```

### Task 11: Build the career timeline and A/B selector

**Files:**
- Create: `web/index.html`
- Create: `web/app.js`
- Create: `web/api.js`
- Create: `web/state.js`
- Create: `web/views/careers.js`
- Create: `web/views/timeline.js`
- Create: `web/views/snapshot.js`
- Create: `web/views/comparison.js`
- Create: `web/styles/tokens.css`
- Create: `web/styles/layout.css`
- Create: `web/styles/components.css`
- Create: `tests/web-flow.test.ts`

**Interfaces:**
- Consumes: Task 10 API contracts.
- Produces: career list, season-grouped timeline, required Snapshot A selector, optional Snapshot B selector, single view, and comparison view.

- [ ] **Step 1: Write failing browser-flow DOM tests**

Test that A alone calls `/api/snapshots/:id`; A+B calls `/api/compare`; season labels appear in both selectors; swapping A/B reverses changes; and an empty B never blocks the snapshot view.

- [ ] **Step 2: Ask the user to run and observe failure**

```bash
npm test -- tests/web-flow.test.ts
```

- [ ] **Step 3: Implement modular browser views**

Use semantic HTML, accessible labels, responsive tables/cards, URL query parameters for selected career/A/B, explicit loading/error/empty states, and no raw JSON in the primary flow.

- [ ] **Step 4: Ask the user to run automated web verification**

```bash
npm test -- tests/web-flow.test.ts
```

- [ ] **Step 5: Ask the user to run the manual checkpoint**

```bash
npm run dev -- --data-root data-v2 --port 4130
```

Verify: career selection, one-snapshot view, same-season A/B, cross-season A/B, URL reload, mobile-width layout, and demo read-only mode.

- [ ] **Step 6: Commit**

```bash
git add web tests/web-flow.test.ts
git commit -m "feat(web): add career timeline and dynamic snapshot comparison"
```

**Checkpoint 5 acceptance:** The website supports the intended select-A/select-B flow. A alone is complete; B activates live comparison; cross-season selection is visible and stable.

---

## Phase 6 — Domain Parity: Squad, Academy, Transfers, and Competitions

### Task 12: Complete squad, academy, contract, and development views

**Files:**
- Create: `src/application/playerService.ts`
- Create: `src/application/academyService.ts`
- Modify: `src/comparison/playerDiff.ts`
- Modify: `src/comparison/academyDiff.ts`
- Create: `web/views/squad.js`
- Create: `web/views/academy.js`
- Create: `tests/player-parity.test.ts`

**Interfaces:**
- Produces normalized player cards and detailed development changes.

- [ ] **Step 1: Add failing parity tests**

Assert names, position, OVR, potential, birthdate/age, height, nationality, contract expiry, wage, appearances, goals, academy potential range, and provenance for known players in the checked-in fixture.

- [ ] **Step 2: Ask the user to run and observe failure**

```bash
npm test -- tests/player-parity.test.ts
```

- [ ] **Step 3: Implement missing normalized fields and views**

Reuse Companion domain transforms. Display raw codes only in diagnostics. Keep candidate/inferred badges for mappings that have not reached observed confidence.

- [ ] **Step 4: Ask the user to run verification**

```bash
npm test -- tests/player-parity.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/application src/comparison web/views tests/player-parity.test.ts
git commit -m "feat(players): complete squad and academy snapshot parity"
```

### Task 13: Add transfers, fixtures, competitions, and standings

**Files:**
- Create: `src/application/competitionService.ts`
- Create: `src/application/transferService.ts`
- Create: `src/comparison/competitionDiff.ts`
- Modify: `src/domain/snapshot.ts`
- Modify: `src/domain/comparison.ts`
- Create: `web/views/transfers.js`
- Create: `web/views/competitions.js`
- Create: `tests/competition-parity.test.ts`

**Interfaces:**
- Reuses: Companion `transfers`, `fixtures`, `pairings`, and `standings` engines.
- Produces: snapshot competition state and live transfer/standing changes.

- [ ] **Step 1: Write failing domain parity tests**

Cover fixture accumulation, position/points/W-D-L/GF-GA, cup progress, player joined/departed evidence, and unavailable states when fixture-slot evidence is incomplete.

- [ ] **Step 2: Ask the user to run and observe failure**

```bash
npm test -- tests/competition-parity.test.ts
```

- [ ] **Step 3: Implement services through Companion wrappers**

Do not copy algorithm bodies into presentation code. Preserve fixture-slot and estimated-date evidence. Never synthesize a standings row when required evidence is missing.

- [ ] **Step 4: Ask the user to run verification**

```bash
npm test -- tests/competition-parity.test.ts
npm run typecheck
```

- [ ] **Step 5: Commit**

```bash
git add src/application src/comparison src/domain web/views tests/competition-parity.test.ts
git commit -m "feat(career): add transfers and competition history"
```

**Checkpoint 6 acceptance:** Squad, academy, contracts, transfers, fixtures, and standings have normalized single-snapshot views and typed live differences, with unavailable states where evidence is insufficient.

---

## Phase 7 — Exports, Demo Parity, and Attribution

### Task 14: Add versioned CSV/JSON exports

**Files:**
- Create: `src/export/snapshotExport.ts`
- Create: `src/export/comparisonExport.ts`
- Create: `tests/export.test.ts`
- Modify: `src/server/routes.ts`

**Interfaces:**
- Produces: snapshot JSON, snapshot player CSV, comparison JSON, and player-change CSV.

- [ ] **Step 1: Write failing export tests**

Assert deterministic headers/order, UTF-8 names, source hashes, schema version, A/B identifiers, and attribution metadata.

- [ ] **Step 2: Ask the user to run and observe failure**

```bash
npm test -- tests/export.test.ts
```

- [ ] **Step 3: Implement exports from application view models**

Do not read SQLite tables or raw parser structures directly from exporters.

- [ ] **Step 4: Ask the user to run verification**

```bash
npm test -- tests/export.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/export src/server/routes.ts tests/export.test.ts
git commit -m "feat(export): add versioned snapshot and comparison exports"
```

### Task 15: Generate demo data through production services

**Files:**
- Create: `src/demo/fixtures.ts`
- Create: `scripts/generateDemo.ts`
- Create: `tests/demo-isolation.test.ts`
- Preserve until the separately approved legacy contraction: `generate_demo_data.py`

**Interfaces:**
- Consumes: domain models and `SnapshotRepository`.
- Produces: separate read-only demo SQLite database containing four checkpoints and a cross-season pair.

- [ ] **Step 1: Write failing isolation tests**

Assert the fixture generator never opens the production database/object root, demo API rejects writes, and demo comparisons equal production-service comparisons for the same domain objects.

- [ ] **Step 2: Ask the user to run and observe failure**

```bash
npm test -- tests/demo-isolation.test.ts
```

- [ ] **Step 3: Implement demo generation**

Create deterministic careers/snapshots using `SnapshotRepository`. Include edited, imported, derived, and unresolved names; joined/departed players; contract, position, rating, academy, transfer, standings, and cross-season changes.

- [ ] **Step 4: Ask the user to run verification**

```bash
npm test -- tests/demo-isolation.test.ts
npm run dev -- --demo --port 4131
```

- [ ] **Step 5: Commit**

```bash
git add src/demo scripts/generateDemo.ts tests/demo-isolation.test.ts
git commit -m "feat(demo): generate isolated full-coverage fixtures"
```

### Task 16: Surface provenance, uncertainty, and attribution

**Files:**
- Create: `web/views/provenance.js`
- Create: `web/views/dataSources.js`
- Create: `docs/DATA_SOURCES.md`
- Modify: `REFERENCE_SOURCES.json`
- Create: `tests/provenance-view.test.ts`

**Interfaces:**
- Consumes: field evidence and data-source attribution repository records.
- Produces: user-visible source acknowledgements and developer diagnostics.

- [ ] **Step 1: Write failing provenance tests**

Assert estimated date is labeled inferred with its basis, name source appears, candidate fields are distinguishable, and every external catalog has attribution and license notes.

- [ ] **Step 2: Ask the user to run and observe failure**

```bash
npm test -- tests/provenance-view.test.ts
```

- [ ] **Step 3: Implement provenance and attribution views**

Keep the normal UI concise; detailed table/field evidence belongs in expandable diagnostics.

- [ ] **Step 4: Ask the user to run verification**

```bash
npm test -- tests/provenance-view.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add web/views docs/DATA_SOURCES.md REFERENCE_SOURCES.json tests/provenance-view.test.ts
git commit -m "docs: expose parser evidence and data attribution"
```

**Checkpoint 7 acceptance:** Snapshot and comparison exports are deterministic, demo uses production services in an isolated database, and every external/derived field can be audited.

---

## Phase 8 — Parity Verification and Optional Legacy Contraction

### Task 17: Build Python/TypeScript parity verification

**Files:**
- Create: `scripts/verifyParity.ts`
- Create: `src/verification/parity.ts`
- Create: `tests/parity.test.ts`
- Create at runtime: `notes/parity-report.json`
- Create at runtime: `notes/parity-report.md`

**Interfaces:**
- Consumes: immutable working-copy path, legacy JSON output, TypeScript normalized snapshot.
- Produces: field-level parity report with accepted and unexplained discrepancies.

- [ ] **Step 1: Write failing parity classification tests**

Test exact matches, acceptable resolver improvements, missing legacy fields, count disagreements, hash mismatch as fatal, and observed-field disagreement as fatal.

- [ ] **Step 2: Ask the user to run and observe failure**

```bash
npm test -- tests/parity.test.ts
```

- [ ] **Step 3: Implement the parity reporter**

Compare source/copy hash, career metadata, squad/academy player IDs, counts, names with provenance, OVR/potential, positions, contracts, and evidence classification. Never modify either output.

- [ ] **Step 4: Ask the user to run tests**

```bash
npm test -- tests/parity.test.ts
```

- [ ] **Step 5: Ask the user to run real-save parity**

```bash
npm run verify:parity -- --save /absolute/path/to/working-copy/DATA --legacy data/catalog.json --out notes
```

Expected: original and working-copy hashes match; all unexplained observed-field discrepancies are zero before contraction.

- [ ] **Step 6: Commit**

```bash
git add scripts/verifyParity.ts src/verification tests/parity.test.ts notes/parity-report.md
git commit -m "test(parity): verify TypeScript output against the legacy POC"
```

### Task 18: Final quality gate and legacy decision

**Files:**
- Modify: `README.md`
- Create: `docs/MIGRATION.md`
- Create: `docs/OPERATIONS.md`
- Move only after explicit approval: Python POC files to `legacy/python-poc/`

**Interfaces:**
- Produces: final runbook, migration instructions, rollback instructions, and an explicit contraction decision.

- [ ] **Step 1: Ask the user to run the full automated gate**

```bash
npm test
npm run typecheck
```

Expected: all tests pass and typecheck exits zero.

- [ ] **Step 2: Ask the user to run production and demo acceptance**

```bash
npm run dev -- --data-root data-v2 --port 4130
npm run dev -- --demo --port 4131
```

Validate import, immutable hash, single snapshot, same-season comparison, cross-season comparison, exports, demo isolation, restart persistence, and migration rollback.

- [ ] **Step 3: Write operations and migration documentation**

Document exact install/run commands, database/object paths, backup procedure, JSON migration, parser revision, troubleshooting, and rollback to the Python POC.

- [ ] **Step 4: Stop for explicit contraction approval**

Do not move, delete, or disable Python files unless the user separately approves contraction after reviewing the parity report and acceptance results.

- [ ] **Step 5: If approved, move the POC without deleting history**

Move `web_server.py`, `run_ps4_companion.py`, `import_ps4_snapshot.py`, `ps4_companion/`, and Python tests into `legacy/python-poc/`. Preserve README instructions for running the legacy path against existing JSON.

- [ ] **Step 6: Commit documentation and any separately approved move**

```bash
git add README.md docs/MIGRATION.md docs/OPERATIONS.md legacy
git commit -m "docs: complete PS4 companion migration runbook"
```

**Checkpoint 8 acceptance:** The TypeScript app passes automated and user-run real-save parity, the user has reviewed rollback instructions, and legacy contraction remains an explicit separate decision.

---

## Rollback Matrix

| Stage | Forward state | Rollback |
|---|---|---|
| Phases 1–2 | TypeScript files and new SQLite added | Run unchanged Python POC against existing JSON |
| Phase 3 | Legacy JSON copied into SQLite | Discard `data-v2/`; original JSON remains untouched |
| Phases 4–7 | New API/UI active | Stop Node server and run Python server on its original data root |
| Phase 8 before approval | Parity complete, both runtimes present | Continue using Python; no data restoration needed |
| Phase 8 after approved move | Python under `legacy/` | Run documented legacy entry point from `legacy/python-poc/` |

## Completion Evidence

The refactor is complete only when all of the following exist:

- passing full Node test output;
- passing TypeScript typecheck output;
- real-save source/copy SHA-256 equality;
- migration report proving legacy files were not changed;
- parity report with no unexplained observed-field discrepancy;
- successful single snapshot and cross-season A/B user checks;
- deterministic snapshot and comparison exports;
- documented data sources and licenses;
- explicit user decision about retaining or moving the Python POC.
