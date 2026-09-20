import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { loadCompanionModules } from '../upstream/companion.js';
import type { FixtureEvidence } from '../domain/careerFacts.js';
import type { SnapshotCandidate as Candidate } from '../domain/snapshot.js';
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

export async function parseAndNormalizeSave(savePath: string, companionRoot = process.env.FC26_COMPANION_ROOT): Promise<Candidate> {
  if (!companionRoot) throw new Error('FC26_COMPANION_ROOT is required');
  const modules = await loadCompanionModules(companionRoot);
  const meta = modules.loadDbMeta(join(companionRoot, 'data/fifa_ng_db-meta.xml'));
  const parsed = modules.parseSave(await readFile(savePath), meta) as { tables: Record<string, Record<string, unknown>[]> };
  const names = modules.loadNameTable(join(companionRoot, 'data/playernames_fc26.csv'));
  const derived = modules.deriveNameIds([parsed.tables], names);
  const resolver = modules.createNameResolver(parsed.tables, names, derived) as { resolve: (playerId: number) => { display: string; full?: string; origin: string; provisional: boolean } };
  const competitionMap = new Map<string, string>();
  const competitionCsv = await readFile(join(companionRoot, 'data/competitions.csv'), 'utf8');
  for (const line of competitionCsv.split(/\r?\n/).slice(1)) {
    const match = line.match(/^([^,]+),(.*)$/);
    if (match?.[1] && match[2]) competitionMap.set(match[1].trim(), match[2].trim());
  }
  const nationalityMap = new Map<number, string>();
  const nationalityCsv = await readFile(join(companionRoot, 'data/nations_fc26.csv'), 'utf8');
  for (const line of nationalityCsv.split(/\r?\n/).slice(1)) { const match = line.match(/^(\d+),(.*)$/); if (match) nationalityMap.set(Number(match[1]), match[2].trim()); }
  const bytes = await readFile(savePath);
  const tables = parsed.tables;
  const leagueOfTeam = (teamId: number): number | null => { const row = tables.leagueteamlinks?.find((item) => item.teamid === teamId); return typeof row?.leagueid === 'number' ? row.leagueid : null; };
  const fixtures = modules.readFixtureLedger(bytes) as Array<Record<string, number | null>> | null;
  const latestResults = modules.readLatestResults(bytes, leagueOfTeam, (id) => tables.players?.some((row) => row.playerid === id) ?? false) as Array<Record<string, number | null>> | null;
  const fixtureEvidence: FixtureEvidence = { source: 'companion-fixture-ledger', fixtures: (fixtures ?? []).map((row) => ({ date: row.date as number, kickoff: row.kickoff as number | null, competitionId: row.comp as number, slotA: row.slotA as number, slotB: row.slotB as number, goalsA: row.goalsA as number | null, goalsB: row.goalsB as number | null })), latestResults: (latestResults ?? []).map((row) => ({ date: row.date as number, homeTeamId: row.homeTeamId as number, awayTeamId: row.awayTeamId as number, homeGoals: row.homeGoals as number, awayGoals: row.awayGoals as number, leagueId: row.leagueId as number, standoutPlayerId: row.standoutPlayerId as number | null })), fixtureCount: fixtures?.length ?? 0, resultCount: latestResults?.length ?? 0 };
  return normalizePs4Save(parsed, { parserVersion: 'companion-pinned-0e1d32a', fixtureEvidence, nationalityResolver: (id) => id === null ? null : nationalityMap.get(id) ?? null, competitionResolver: (code) => competitionMap.get(code) ?? null, nameResolver: (playerId) => { const resolved = resolver.resolve(playerId); return { display: resolved.display, full: resolved.full, source: resolved.origin as 'primary', provisional: resolved.provisional, resolverVersion: 'companion-pinned-0e1d32a' }; } });
}
