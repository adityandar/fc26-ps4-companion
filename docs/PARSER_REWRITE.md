# Internal parser rewrite

## Decision

The production application will eventually parse FC26 PS4 saves with code owned by this repository. The public `fc26companion` project remains a read-only research reference and temporary parity oracle only; it is not the final runtime dependency.

## Staged path

1. Capture parser parity fixtures from known PS4 working copies without modifying them.
2. Implement our own container scanner and database block reader.
3. Implement table descriptors, primitive values, row decoding, and database merging.
4. Implement the career blob reader for fixtures, results, and career state.
5. Implement our own name, position, league, competition, manager, finance, and transfer normalizers.
6. Compare internal output against the pinned reference parser and classify every mismatch as observed, candidate, or inferred.
7. Switch production imports to the internal parser after parity gates pass.
8. Remove the runtime adapter and `FC26_COMPANION_ROOT`; keep attribution and reference documentation.

## Attribution boundary

The internal parser is an independent implementation informed by publicly documented FC26 save observations and the `fc26companion` project. Attribution is retained in `docs/UPSTREAM.md` and `docs/REFERENCES.md`. Reference code and data remain read-only and are never edited by this project.

## No false parity

Parity is only claimed per field and offset when both implementations produce the same result on the same byte hash. Unsupported or unresolved fields remain explicitly marked and are not silently promoted to facts.
