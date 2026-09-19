# Upstream Companion Boundary

The PS4 application reuses the public `fc26companion` implementation through a local adapter. This is an intentional runtime dependency; the parser is not duplicated locally.

- Repository: https://github.com/srikz4/fc26companion
- Reviewed revision: `0e1d32a87c9947be681803cd506bc543f912cfd8`
- License declared by upstream: MIT
- Reused areas: database parser, metadata decoder, name resolver, position/domain mappings, and selected career engines.
- Local boundary: `src/upstream/companion.ts`
- Runtime configuration: `FC26_COMPANION_ROOT`

## Configuration and call path

The preferred configuration is the project-local, Git-ignored `config.json`, based on `config.example.json`:

```json
{
  "companionRoot": "../public-reference/fc26companion",
  "objectRoot": "data-v2/objects",
  "databasePath": "data-v2/companion.sqlite",
  "host": "127.0.0.1",
  "port": 4132
}
```

`npm run dev` loads this file through `src/config.ts`. Environment variables override matching values, with `FC26_COMPANION_ROOT` taking precedence over the JSON path. The import path calls only `src/upstream/companion.ts`; application code does not import upstream modules directly.

The pinned upstream modules currently used are:

- database parser and metadata loader;
- FC26 name table and derived-name resolver;
- selected parser-facing domain helpers.

The application owns the working-copy policy, snapshot model, SQLite store, comparison engine, UI, exports, and attribution. Upstream checkouts and data files remain read-only.

The adapter is the only application module allowed to import upstream source paths directly. Application code consumes typed local interfaces so an upstream layout change is isolated to one boundary.

Upstream data files and source checkouts remain read-only references. Any copied source or generated attribution file must retain this notice and the upstream license.
