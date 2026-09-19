import type { FieldEvidence } from '../domain/evidence.js';
import type { AcademyPlayerState, PlayerState, ResolvedName, SnapshotCandidate } from '../domain/snapshot.js';
import { PLAYER_EVIDENCE } from './schemaManifest.js';

type Row = Record<string, unknown>;
type Tables = Record<string, Row[]>;
const number = (row: Row | undefined, field: string): number | null => typeof row?.[field] === 'number' ? row[field] as number : null;
const text = (row: Row | undefined, field: string): string | null => typeof row?.[field] === 'string' && row[field] ? row[field] as string : null;
const table = (tables: Tables, name: string): Row[] => tables[name] ?? [];

export interface NormalizationContext {
  readonly parserVersion: string;
  readonly nameResolver: (playerId: number) => ResolvedName;
}

const evidenceFor = (fields: readonly string[]): readonly FieldEvidence[] => PLAYER_EVIDENCE.filter((item) => fields.includes(item.normalizedField));

export function normalizePs4Save(parsed: unknown, context: NormalizationContext): SnapshotCandidate {
  const result = parsed as { tables?: Tables };
  const tables = result.tables ?? {};
  const user = table(tables, 'career_users')[0];
  const managerInfo = table(tables, 'career_managerinfo')[0];
  const clubTeamId = number(managerInfo, 'clubteamid') ?? number(user, 'clubteamid');
  const club = table(tables, 'teams').find((row) => number(row, 'teamid') === clubTeamId);
  const managerName = [text(user, 'firstname'), text(user, 'surname')].filter(Boolean).join(' ') || null;
  const links = table(tables, 'teamplayerlinks').filter((row) => number(row, 'teamid') === clubTeamId);
  const players = new Map(table(tables, 'players').map((row) => [number(row, 'playerid'), row]));
  const contracts = new Map(table(tables, 'career_playercontract').map((row) => [number(row, 'playerid'), row]));
  const playerStates: PlayerState[] = [];
  for (const link of links) {
    const playerId = number(link, 'playerid'); const player = players.get(playerId); if (playerId === null || !player) continue;
    const preferredPositions = [1, 2, 3, 4].map((index) => number(player, `preferredposition${index}`)).filter((value): value is number => value !== null);
    const contract = contracts.get(playerId);
    playerStates.push({ playerId, name: context.nameResolver(playerId), preferredPositions, squadPosition: number(link, 'position'), overall: number(player, 'overallrating'), potential: number(player, 'potential'), birthdate: number(player, 'birthdate'), height: number(player, 'height'), weight: number(player, 'weight'), nationality: number(player, 'nationality'), contractUntil: number(player, 'contractvaliduntil'), wage: number(contract, 'wage'), jerseyNumber: number(link, 'jerseynumber'), leagueAppearances: number(link, 'leagueappearances'), leagueGoals: number(link, 'leaguegoals'), evidence: evidenceFor(['overall', 'potential', 'preferredPositions', 'height', 'contractUntil', 'squadPosition', 'wage']) });
  }
  const academyPlayers: AcademyPlayerState[] = table(tables, 'career_youthplayers').flatMap((row) => {
    const playerId = number(row, 'playerid'); return playerId === null ? [] : [{ playerId, name: context.nameResolver(playerId), tier: number(row, 'playertier'), lowPotential: number(row, 'swinglowpotential'), potentialVariance: number(row, 'potentialvariance'), monthsInSquad: number(row, 'monthsinsquad') }];
  });
  return { schemaVersion: 1, careerHint: { clubTeamId, clubName: text(club, 'teamname'), managerName }, parsedSeasonIndex: number(user, 'seasoncount'), estimatedGameDate: null, estimatedDateBasis: null, players: playerStates, academyPlayers, evidence: PLAYER_EVIDENCE, warnings: [] };
}
