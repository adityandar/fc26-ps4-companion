# Upstream Companion Boundary

The final PS4 application reuses the public `fc26companion` implementation through a local adapter.

- Repository: https://github.com/srikz4/fc26companion
- Reviewed revision: `0e1d32a87c9947be681803cd506bc543f912cfd8`
- License declared by upstream: MIT
- Reused areas: database parser, metadata decoder, name resolver, position/domain mappings, and selected career engines.
- Local boundary: `src/upstream/companion.ts`
- Runtime configuration: `FC26_COMPANION_ROOT`

The adapter is the only application module allowed to import upstream source paths directly. Application code consumes typed local interfaces so an upstream layout change is isolated to one boundary.

Upstream data files and source checkouts remain read-only references. Any copied source or generated attribution file must retain this notice and the upstream license.
