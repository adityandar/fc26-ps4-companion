# FC26 PS4 Companion

Local, read-only dashboard for Apollo-exported EA SPORTS FC 26 PS4 career saves.

The app creates an immutable working copy, parses it through the pinned [`fc26companion`](https://github.com/srikz4/fc26companion) parser boundary, stores normalized snapshot data in SQLite, and calculates comparisons live. It never modifies, resigns, or writes back to an original save.

## Get Started

### 1. Requirements

- Node.js 22 or newer;
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

Useful Docker commands:

```bash
docker compose logs -f              # follow application logs
docker compose ps                   # check service status
docker compose stop                 # stop without deleting data
docker compose start                # start again
docker compose down                 # remove containers, keep ./data-v2
git pull && docker compose up -d --build  # update and rebuild
```

Do not remove the `data-v2/` directory if you want to keep imported careers and snapshots. The original PS4 saves remain outside the container and are not modified.

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

## References and attribution

This project is an independent read-only PS4 companion application. It uses the following projects and research references:

- [fc26companion](https://github.com/srikz4/fc26companion) — primary parser/runtime reference for FC26 save database tables, player names, competition labels, and career view-model semantics. The application pins and loads its parser modules at revision `0e1d32a87c9947be681803cd506bc543f912cfd8`. It is licensed under MIT; its copyright and permission notice are preserved by using the reference checkout rather than copying its source into this repository.
- [Apollo Save Tool PS4 documentation](https://github.com/bucanero/apollo-ps4/blob/main/docs/usage.md) — documentation for exporting decrypted PS4 save data.
- [FC26 Save Parser](https://github.com/mhirst1992/fc26-save-parser) and its [README](https://github.com/mhirst1992/fc26-save-parser/blob/main/README.md) — reference for `fifa_ng_db`, table-directory structure, signatures, CZUM field meanings, and FC26 PC save research.
- [FC26 Companion](https://github.com/srikz4/fc26companion) — comparative reference for read-only Manager Career presentation and career data concepts.
- [FIFA Career Save Parser](https://github.com/sammygriffiths/fifa-career-save-parser) — historical reference for FIFA Career Mode table and field conventions.
- [SoccerGaming FIFA 18 reverse-engineering thread](https://soccergaming.com/forums/threads/fifa-18-save-editing-thread.6465621/) — historical research on career tables, players, teams, and internal database structures.
- [EAFC26-DataHub](https://github.com/ismailoksuz/EAFC26-DataHub) — optional external player-data reference, separate from the runtime parser.
- [Basche14 EAFC26 dataset](https://github.com/Basche14/EAFC26/blob/main/ea_fc26_players.csv) — optional fallback player-data reference.
- [Kaggle EAFC26 Player Database](https://www.kaggle.com/datasets/flynn28/eafc26-player-database) — optional fallback research dataset, subject to its own license and terms.
- [FUT.GG player reference](https://www.fut.gg/players/269357-nicola-valente/26-269357/) — targeted external cross-check for player ID `269357`.
- [Reddit PS4 Homebrew discussion](https://www.reddit.com/r/ps4homebrew/comments/1shxy4j/fc_26_career_mode_crashing_after_few_saves/) — community context for FC26 PS4 Career Mode and Apollo save behavior.
- [Reddit PS4 Homebrew FC24 save discussion](https://www.reddit.com/r/ps4homebrew/comments/1ef2jyq) — community reference for PS4 save structure and PC-data comparison context.

Attribution does not imply that these projects endorse this application. Their code, data, documentation, and licenses remain owned by their respective authors. The complete machine-readable reference list is maintained in [`REFERENCE_SOURCES.json`](REFERENCE_SOURCES.json). External datasets are optional and are only used for name/data fallback or cross-checking; the original save remains the authoritative source for imported snapshot values.
