#!/usr/bin/env node
/**
 * Split a large JSON object without loading the whole file into memory.
 *
 * Usage:
 *   npm exec tsx -- scripts/splitRawJson.ts /path/to/DATA.raw.json ./split
 *   npm exec tsx -- scripts/splitRawJson.ts /path/to/DATA.raw.json ./split --nested --chunk-size 1000
 *
 * Default output:
 *   split/_meta.json
 *   split/tables.json

 * With --nested, each property inside `tables` gets its own file:
 *   split/_meta.json
 *   split/tables/players.json
 *   split/tables/teams.json
 */
import { createReadStream } from 'node:fs';
import { mkdir, open, stat, writeFile } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';

const inputPath = process.argv[2];
const outputDir = process.argv[3] ?? './split-raw';
const nested = process.argv.includes('--nested');
const chunkArg = process.argv.indexOf('--chunk-size');
const chunkSize = chunkArg >= 0 ? Number(process.argv[chunkArg + 1]) : 1000;
if (!Number.isInteger(chunkSize) || chunkSize <= 0) throw new Error('--chunk-size must be a positive integer');

if (!inputPath) {
  console.error('Usage: npm exec tsx -- scripts/splitRawJson.ts <input.json> [output-dir] [--nested]');
  process.exit(1);
}

function safeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_') || 'unnamed';
}

const readers = new WeakMap<object, { buffer: Buffer; offset: number; length: number; bytesRead: number; total: number; lastReport: number }>();

async function readNextByte(handle: Awaited<ReturnType<typeof open>>): Promise<number | null> {
  let state = readers.get(handle);
  if (!state) {
    state = { buffer: Buffer.allocUnsafe(1024 * 1024), offset: 0, length: 0, bytesRead: 0, total: (await stat(inputPath)).size, lastReport: Date.now() };
    readers.set(handle, state);
  }
  if (state.offset >= state.length) {
    const result = await handle.read(state.buffer, 0, state.buffer.length, null);
    state.offset = 0;
    state.length = result.bytesRead;
    if (result.bytesRead === 0) return null;
  }
  state.bytesRead++;
  if (Date.now() - state.lastReport > 2000) {
    const percent = state.total ? ((state.bytesRead / state.total) * 100).toFixed(1) : '?';
    process.stdout.write(`\rReading ${percent}% (${Math.round(state.bytesRead / 1024 / 1024)} MiB)`);
    state.lastReport = Date.now();
  }
  return state.buffer[state.offset++]!;
}

async function readJsonValue(handle: Awaited<ReturnType<typeof open>>): Promise<string> {
  let output = '';
  let quote = false;
  let escaped = false;
  let depth = 0;
  let started = false;

  while (true) {
    const byte = await readNextByte(handle);
    if (byte === null) throw new Error('Unexpected end of file while reading a JSON value');
    const char = String.fromCharCode(byte);

    if (!started) {
      if (/\s/.test(char)) continue;
      started = true;
      output += char;
      if (char === '"') quote = true;
      else if (char === '{' || char === '[') depth = 1;
      else if (char === '}' || char === ']') return output;
      else if (char !== 't' && char !== 'f' && char !== 'n' && !/[0-9-]/.test(char)) {
        throw new Error(`Unexpected JSON value start: ${char}`);
      }
      if (depth === 0 && char !== '"') {
        while (true) {
          const next = await readNextByte(handle);
          if (next === null || /[\s,}]/.test(String.fromCharCode(next))) return output;
          output += String.fromCharCode(next);
        }
      }
      continue;
    }

    output += char;
    if (quote) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') quote = false;
      continue;
    }
    if (char === '"') quote = true;
    else if (char === '{' || char === '[') depth++;
    else if (char === '}' || char === ']') {
      depth--;
      if (depth === 0) return output;
    }
  }
}

async function splitObject(): Promise<void> {
  await mkdir(outputDir, { recursive: true });
  const handle = await open(inputPath, 'r');
  try {
    const first = await readNextByte(handle);
    if (first !== 123) throw new Error('Input must be a top-level JSON object');

    while (true) {
      let byte: number | null;
      do { byte = await readNextByte(handle); } while (byte !== null && /\s|,/.test(String.fromCharCode(byte)));
      if (byte === null) throw new Error('Unexpected end of file');
      if (byte === 125) break;
      if (byte !== 34) throw new Error('Expected a JSON object key');

      let key = '';
      let escaped = false;
      while (true) {
        const next = await readNextByte(handle);
        if (next === null) throw new Error('Unexpected end of file in object key');
        const char = String.fromCharCode(next);
        if (escaped) { key += char; escaped = false; continue; }
        if (char === '\\') { key += char; escaped = true; continue; }
        if (char === '"') break;
        key += char;
      }
      let colon: number | null;
      do { colon = await readNextByte(handle); } while (colon !== null && /\s/.test(String.fromCharCode(colon)));
      if (colon !== 58) throw new Error(`Expected colon after key ${key}`);

      const rawValue = await readJsonValue(handle);
      const target = join(outputDir, `${safeName(key)}.json`);
      await writeFile(target, `${rawValue}\n`, 'utf8');

      if (nested && key === 'tables' && rawValue.startsWith('{')) {
        const tablesDir = join(outputDir, 'tables');
        await mkdir(tablesDir, { recursive: true });
        const parsed = JSON.parse(rawValue) as Record<string, unknown>;
        for (const [table, value] of Object.entries(parsed)) {
          const tableDir = join(tablesDir, safeName(table));
          await mkdir(tableDir, { recursive: true });
          if (Array.isArray(value)) {
            for (let start = 0, part = 1; start < value.length; start += chunkSize, part++) {
              const rows = value.slice(start, start + chunkSize);
              const filename = `part-${String(part).padStart(5, '0')}.json`;
              await writeFile(join(tableDir, filename), `${JSON.stringify(rows)}\n`, 'utf8');
            }
            if (value.length === 0) await writeFile(join(tableDir, 'part-00001.json'), '[]\n', 'utf8');
          } else {
            await writeFile(join(tableDir, 'value.json'), `${JSON.stringify(value)}\n`, 'utf8');
          }
        }
      }
    }
  } finally {
    await handle.close();
  }
}

splitObject()
  .then(() => console.log(`\nSplit complete: ${resolve(outputDir)}`))
  .catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
