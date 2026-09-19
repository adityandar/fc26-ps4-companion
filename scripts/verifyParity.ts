import { readFile } from 'node:fs/promises';

const args = process.argv.slice(2);
const value = (flag: string): string | null => { const index = args.indexOf(flag); return index >= 0 ? args[index + 1] ?? null : null; };
const leftPath = value('--left');
const rightPath = value('--right');

if (!leftPath || !rightPath) {
  console.error('Usage: npm run verify:parity -- --left <legacy.json> --right <new.json>');
  process.exitCode = 2;
} else {
  const left = JSON.parse(await readFile(leftPath, 'utf8')) as Record<string, unknown>;
  const right = JSON.parse(await readFile(rightPath, 'utf8')) as Record<string, unknown>;
  const checks = {
    sourceSha256: left.source_sha256 === right.sourceSha256,
    copySha256: (left.working_copy_sha256 ?? left.source_sha256) === right.copySha256,
    season: left.season === right.seasonLabel,
    checkpoint: left.checkpoint === right.checkpoint,
  };
  const failed = Object.entries(checks).filter(([, passed]) => !passed).map(([name]) => name);
  console.log(JSON.stringify({ checks, status: failed.length ? 'mismatch' : 'match', failed }, null, 2));
  if (failed.length) process.exitCode = 1;
}
