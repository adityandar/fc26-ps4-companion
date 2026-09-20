# FC26 PS4 Companion Frontend Revamp Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current hand-written multi-page browser UI with a maintainable React/Vite frontend that preserves the existing API and provides sortable, filterable player tables.

**Architecture:** Keep the TypeScript HTTP server, parser, SQLite store, import flow, and comparison API unchanged at the domain boundary. Add a Vite-built React client under `frontend/`; serve its compiled assets through the existing server with a fallback for client-side routes. Keep page state in URL query parameters where practical and keep table transformations client-side because snapshots are immutable.

**Tech Stack:** React, TypeScript, Vite, TanStack Table, plain CSS design tokens.

**Spec:** Approved design direction in the conversation on 2026-09-20.

## Global Constraints

- Original saves remain read-only and immutable.
- `public-reference/` and `sources/` remain read-only.
- Existing API response shapes remain backward compatible.
- `npm run dev` remains the only required development command after dependencies are installed.
- Player tables must support sorting and text/value filtering for every visible data column.
- The frontend must remain usable without network access at runtime.
- Existing legacy/Python data is not read by the new frontend.

### Task 1: Frontend toolchain and shell

**Files:**
- Create: `frontend/index.html`, `frontend/src/main.tsx`, `frontend/src/styles.css`, `vite.config.ts`
- Modify: `package.json`, `src/server/apiServer.ts`
- Test: `tests/frontendRoutes.test.ts`

- [ ] Add React/Vite/TanStack dependencies and build scripts.
- [ ] Create a shared application shell with navigation, career context, status region, and responsive layout.
- [ ] Serve the Vite build and fallback routes from the existing server.
- [ ] Verify the build and static route behavior, then commit.

### Task 2: API client and shared domain presentation

**Files:**
- Create: `frontend/src/lib/api.ts`, `frontend/src/lib/format.ts`, `frontend/src/components/MetricCard.tsx`, `frontend/src/components/PageHeader.tsx`
- Test: `frontend/src/lib/format.test.ts`

- [ ] Add typed fetch helpers for careers, snapshots, imports, exports, and comparisons.
- [ ] Centralize number/date/status formatting and null-state labels.
- [ ] Add accessible loading, error, and empty states.
- [ ] Verify with unit tests and commit.

### Task 3: Import, archive, and comparison pages

**Files:**
- Create: `frontend/src/pages/HomePage.tsx`, `frontend/src/pages/ImportPage.tsx`, `frontend/src/pages/ViewPage.tsx`, `frontend/src/pages/ComparePage.tsx`
- Create: `frontend/src/components/ImportWizard.tsx`, `frontend/src/components/SnapshotPicker.tsx`, `frontend/src/components/CompareSummary.tsx`
- Modify: `src/server/apiServer.ts` only where the typed client exposes a missing existing endpoint.

- [ ] Rebuild the three-mode landing page.
- [ ] Rebuild preview/metadata/commit import flow.
- [ ] Rebuild single snapshot and live comparison flow.
- [ ] Verify one-snapshot and two-snapshot cases, then commit.

### Task 4: Reusable data tables

**Files:**
- Create: `frontend/src/components/DataTable.tsx`, `frontend/src/components/TableToolbar.tsx`, `frontend/src/features/squad/playerColumns.tsx`, `frontend/src/features/squad/SquadTable.tsx`, `frontend/src/features/academy/AcademyTable.tsx`, `frontend/src/features/league/LeagueTable.tsx`
- Test: `frontend/src/features/squad/tableState.test.ts`

- [ ] Define typed columns for every squad and academy field.
- [ ] Add per-column sorting, text filters, numeric filters, reset, and responsive overflow.
- [ ] Add league standings table with position and points formatting.
- [ ] Verify sorting/filtering independently from page rendering, then commit.

### Task 5: Snapshot composition and polish

**Files:**
- Create: `frontend/src/components/CareerOverview.tsx`, `frontend/src/components/ManagerPerformance.tsx`, `frontend/src/components/CompetitionProgress.tsx`, `frontend/src/components/EvidencePanel.tsx`
- Modify: `frontend/src/pages/ViewPage.tsx`, `frontend/src/pages/ComparePage.tsx`, `frontend/src/styles.css`

- [ ] Compose the complete snapshot view around the reusable tables.
- [ ] Add career overview, manager history, league, competitions, evidence, integrity, and exports.
- [ ] Add keyboard focus, reduced-motion handling, mobile layout, and accessible table labels.
- [ ] Run typecheck, tests, production build, and commit.

### Task 6: Migration and documentation

**Files:**
- Modify: `README.md`, `docs/USER_WORKFLOW.md`, `config.example.json`
- Create: `docs/FRONTEND.md`

- [ ] Document the new frontend architecture, commands, and route behavior.
- [ ] Remove obsolete references to the old static UI while preserving legacy documentation.
- [ ] Run the complete verification suite and commit the final checkpoint.
