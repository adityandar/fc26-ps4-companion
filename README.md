# FC26 PS4 Companion

Local, read-only dashboard for Apollo-exported EA SPORTS FC 26 PS4 career saves.

The app creates an immutable working copy, parses it through the pinned [`fc26companion`](https://github.com/ismailoksuz/EAFC26-DataHub) parser boundary, stores normalized snapshot data in SQLite, and calculates comparisons live. It never modifies, resigns, or writes back to an original save.

## Get Started

### 1. Requirements

- Node.js 20 or newer;
- an Apollo Save Tool decrypted PS4 `DATA` file;
- the pinned `fc26companion` reference checkout.

The default layout expects `public-reference/fc26companion` next to this project. If it is elsewhere, edit `config.json` and set `companionRoot` to its absolute path.

### 2. Install and run

```bash
npm install
npm run dev
```

Open [http://localhost:4132](http://localhost:4132).

The normal development command builds the React frontend and starts the local server. Runtime data is created under `data-v2/`, which is ignored by Git.

### Docker deployment

On an Ubuntu server with Docker Compose:

```bash
git clone https://github.com/adityandar/fc26-ps4-companion.git
cd fc26-ps4-companion
docker compose up -d --build
```

Open `http://SERVER_IP:4132`. The image clones and pins the required `fc26companion` revision during build. SQLite and immutable working copies persist in the local `data-v2/` volume.

For a non-Docker installation, run the setup script once:

```bash
./install.sh
npm run dev
```

The script clones or updates `public-reference/fc26companion`, checks out the pinned revision, installs both projects, and builds the frontend. It does not touch save files.

### 3. Import a save

1. Open **Import**.
2. Choose the Apollo-decrypted `DATA` file.
3. Click **Preview save** and wait for parsing to finish.
4. Confirm the career, season, and checkpoint metadata.
5. Choose an existing career or create a new one.
6. Commit the snapshot.

The source file is read-only. The app stores a byte-for-byte working copy and records both SHA-256 hashes.

### 4. Browse and compare

- **View** shows one snapshot independently: squad, academy, league table, manager history, contracts, transfers, evidence, and exports.
- **Compare** selects any two snapshots from the same career and calculates player changes live.
- A single snapshot is still useful; comparison fields simply remain unavailable until a second snapshot exists.

Snapshots can belong to different seasons, so cross-season comparison is supported when they belong to the same career.

## Configuration

The local `config.json` is ignored by Git. A working example is:

```json
{
  "companionRoot": "../public-reference/fc26companion",
  "objectRoot": "data-v2/objects",
  "databasePath": "data-v2/companion.sqlite",
  "host": "127.0.0.1",
  "port": 4132,
  "currency": "USD"
}
```

`currency` controls view-layer formatting for wages, fees, and transfer amounts. It does not alter stored raw values.

Environment overrides:

```bash
FC26_COMPANION_ROOT=/absolute/path/to/fc26companion npm run dev
FC26_CURRENCY=EUR npm run dev
```

## What is currently captured

The normalized snapshot includes:

- senior squad and academy players;
- names, positions, OVR, potential, height, contracts, wages, jersey numbers, and league appearances/goals;
- current league table and club identity;
- manager history, results, points, table position, goals, trophies, and biggest buy/sell records;
- manager context such as earnings, club worth, budget, board confidence, and released-player count;
- contract metadata from `career_playercontract`;
- player-season growth values and squad ranking values;
- transfer activity from `career_presignedcontract`;
- parser evidence, warnings, source filename, checkpoint metadata, and SHA-256 hashes.

Some numeric IDs remain internal codes when no verified lookup exists. The UI labels those conservatively rather than guessing.

## Development commands

```bash
npm run typecheck
npm test
npm run build:web
npm run demo:seed
npm run reset:dev -- --confirm
```

Demo data is synthetic and does not represent a real Apollo `DATA` file. It is safe for UI testing and never modifies an original save.

## Data safety model

- Original saves are never used as write targets.
- A byte-for-byte working copy is created before parsing.
- Source and working-copy SHA-256 values are stored.
- Comparison results are derived at request time and are not persisted into snapshots.
- Save contents are treated as untrusted data and are never executed.
- `sources/` and `public-reference/` are reference-only and must not be edited.

## Architecture and attribution

See [`docs/architecture.md`](docs/architecture.md) for the system design, import flow, domain model, API, and source-table mapping.

The main parser remains an external runtime dependency. Its use and the other research references are recorded in [`REFERENCE_SOURCES.json`](REFERENCE_SOURCES.json).

Historical Python/catalog flows remain under [`legacy/`](legacy/) for reference only and are not part of the production runtime.
