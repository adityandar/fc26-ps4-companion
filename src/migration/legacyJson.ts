import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import type { Snapshot } from '../domain/snapshot.js';
import { createSnapshotRepository, type SnapshotRepository } from '../store/snapshotRepository.js';

type LegacyRecord = Record<string, any>;
export interface MigrationReport { imported: number; duplicates: number; incomplete: number; conflicts: string[]; sourceFiles: string[] }

function toSnapshotInput(record: LegacyRecord, careerId: string): Omit<Snapshot, 'id'> {
  const summary = record.derived_summary ?? {};
  const players = (summary.squad_players ?? []).map((player: any) => ({ playerId: Number(player.playerid), name: { display: player.name ?? `Player #${player.playerid}`, source: player.name_source ?? 'unresolved', provisional: player.name_source === 'derived', resolverVersion: 'legacy-migration' }, preferredPositions: [], squadPosition: player.squad?.position ?? null, overall: player.attributes?.overallrating ?? null, potential: player.attributes?.potential ?? null, birthdate: player.attributes?.birthdate ?? null, height: player.attributes?.height ?? null, weight: player.attributes?.weight ?? null, nationality: player.attributes?.nationality ?? null, contractUntil: player.attributes?.contractvaliduntil ?? null, wage: player.contract?.wage ?? null, jerseyNumber: player.squad?.jerseynumber ?? null, leagueAppearances: player.squad?.leagueappearances ?? null, leagueGoals: player.squad?.leaguegoals ?? null, evidence: [] }));
  const academyPlayers = (summary.academy_player_records ?? []).map((player: any) => ({ playerId: Number(player.playerid), name: { display: `Player #${player.playerid}`, source: 'unresolved' as const, provisional: false, resolverVersion: 'legacy-migration' }, tier: player.playertier ?? null, lowPotential: player.swinglowpotential ?? null, potentialVariance: player.potentialvariance ?? null, monthsInSquad: player.monthsinsquad ?? null }));
  return { careerId: careerId as any, sourceSha256: record.source_sha256, copySha256: record.working_copy_sha256 ?? record.source_sha256, objectPath: record.working_copy_path, sourceFilename: basename(record.source_path ?? 'DATA'), sizeBytes: Number(record.size_bytes ?? 0), schemaVersion: 1, parserVersion: 'legacy-json-migration', parsedSeasonIndex: Number(summary.season ?? 0) || null, seasonLabel: record.season ?? 'unknown', checkpoint: record.checkpoint ?? 'custom', estimatedGameDate: summary.estimated_date ?? null, estimatedDateBasis: 'legacy-derived-summary', careerHint: { managerName: record.manager_name ?? null, clubTeamId: null, clubName: record.club_name ?? null }, players, academyPlayers, evidence: [], warnings: [{ code: 'legacy-import', message: 'Imported from legacy JSON; persisted legacy insights were ignored.', severity: 'info' }], userNote: record.user_note ?? '', importedAt: record.created_at ?? new Date().toISOString(), careerFacts: { managerReputation: null, managerWage: null, totalEarnings: null, clubWorth: null, profitability: null, domesticPrestige: null, internationalPrestige: null, youthDevelopment: null, transferBudget: null, wageBudget: null, biggestWin: null, biggestLoss: null, seasons: [], competitions: [], league: null } };
}

export async function migrateLegacyJson(catalogPath: string, repository: SnapshotRepository, dryRun = false): Promise<MigrationReport> {
  const raw = JSON.parse(await readFile(catalogPath, 'utf8')) as LegacyRecord[]; const records = [...raw]; const importsDir = join(dirname(catalogPath), 'imports');
  if (existsSync(importsDir)) for (const record of records) { const path = join(importsDir, `${record.source_sha256}.json`); if (existsSync(path)) { const enriched = JSON.parse(await readFile(path, 'utf8')); if ((enriched.derived_summary?.squad_players?.length ?? 0) > (record.derived_summary?.squad_players?.length ?? 0)) Object.assign(record, enriched); } }
  const careers = new Map<string, string>(); const report: MigrationReport = { imported: 0, duplicates: 0, incomplete: 0, conflicts: [], sourceFiles: [catalogPath] };
  for (const record of records) {
    if (!record.source_sha256) { report.incomplete++; continue; }
    const key = String(record.career_id ?? `${record.manager_name}|${record.club_name}`); let id = careers.get(key);
    if (!id) { const existing = repository.listCareers().find((career) => career.label === key); id = existing ? String(existing.id) : String(repository.createCareer(key).id); careers.set(key, id); }
    const input = toSnapshotInput(record, id); if (!dryRun) { const existing = repository.findByHash(id as any, input.sourceSha256); if (existing) report.duplicates++; else { repository.saveSnapshot(input); report.imported++; } } else report.imported++;
  }
  return report;
}
