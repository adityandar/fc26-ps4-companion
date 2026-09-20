import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { loadCompanionModules } from '../upstream/companion.js';
import type { SnapshotCandidate } from '../domain/snapshot.js';
import { normalizePs4Save } from './ps4Normalizer.js';

export interface ParsedRawDocument {
  readonly _meta: { readonly kind: 'parsed-raw'; readonly sourceFile: string; readonly parserVersion: string };
  readonly tables: Record<string, Record<string, unknown>[]>;
}

export function rawExportDocument(parsed: { tables: Record<string, Record<string, unknown>[]> }, sourceFile: string, parserVersion: string): ParsedRawDocument {
  return { _meta: { kind: 'parsed-raw', sourceFile, parserVersion }, tables: parsed.tables };
}

export async function parseRawSave(savePath: string, companionRoot = process.env.FC26_COMPANION_ROOT): Promise<ParsedRawDocument> {
  if (!companionRoot) throw new Error('FC26_COMPANION_ROOT is required');
  const modules = await loadCompanionModules(companionRoot);
  const meta = modules.loadDbMeta(join(companionRoot, 'data/fifa_ng_db-meta.xml'));
  const parsed = modules.parseSave(await readFile(savePath), meta) as { tables: Record<string, Record<string, unknown>[]> };
  return rawExportDocument(parsed, savePath.split(/[\\/]/).pop() ?? 'DATA', 'companion-pinned-0e1d32a');
}

export async function parseAndNormalizeSave(savePath: string, companionRoot = process.env.FC26_COMPANION_ROOT): Promise<SnapshotCandidate> {
  if (!companionRoot) throw new Error('FC26_COMPANION_ROOT is required');
  const modules = await loadCompanionModules(companionRoot);
  const meta = modules.loadDbMeta(join(companionRoot, 'data/fifa_ng_db-meta.xml'));
  const parsed = modules.parseSave(await readFile(savePath), meta) as { tables: Record<string, Record<string, unknown>[]> };
  const names = modules.loadNameTable(join(companionRoot, 'data/playernames_fc26.csv'));
  const derived = modules.deriveNameIds([parsed.tables], names);
  const resolver = modules.createNameResolver(parsed.tables, names, derived) as { resolve: (playerId: number) => { display: string; origin: string; provisional: boolean } };
  const competitionMap = new Map<string, string>();
  const competitionCsv = await readFile(join(companionRoot, 'data/competitions.csv'), 'utf8');
  for (const line of competitionCsv.split(/\r?\n/).slice(1)) {
    const match = line.match(/^([^,]+),(.*)$/);
    if (match?.[1] && match[2]) competitionMap.set(match[1].trim(), match[2].trim());
  }
  return normalizePs4Save(parsed, { parserVersion: 'companion-pinned-0e1d32a', competitionResolver: (code) => competitionMap.get(code) ?? null, nameResolver: (playerId) => ({ display: resolver.resolve(playerId).display, source: resolver.resolve(playerId).origin as 'primary', provisional: resolver.resolve(playerId).provisional, resolverVersion: 'companion-pinned-0e1d32a' }) });
}
