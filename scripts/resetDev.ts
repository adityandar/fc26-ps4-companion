import { existsSync } from 'node:fs';
import { mkdir, rm } from 'node:fs/promises';
import { resolve } from 'node:path';

if (!process.argv.includes('--confirm')) {
  console.error('This removes only data-v2 development data. Re-run with: npm run reset:dev -- --confirm');
  process.exitCode = 2;
} else {
  const target = resolve(process.cwd(), 'data-v2');
  if (target !== resolve(process.cwd(), 'data-v2')) throw new Error('refusing to reset an unexpected path');
  if (existsSync(target)) await rm(target, { recursive: true, force: true });
  await mkdir(target, { recursive: true });
  console.log(`Reset development store: ${target}`);
  console.log('Original saves, legacy/, and config.json were not touched.');
}
