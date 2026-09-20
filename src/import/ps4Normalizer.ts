import type { FieldEvidence } from '../domain/evidence.js';
import type { AcademyPlayerState, PlayerState, ResolvedName, SnapshotCandidate } from '../domain/snapshot.js';
import { PLAYER_EVIDENCE } from './schemaManifest.js';
import type { CareerFacts, CompetitionProgress, LeagueFacts, LeagueStanding, SeasonRecord } from '../domain/careerFacts.js';

type Row = Record<string, unknown>;
type Tables = Record<string, Row[]>;
const number = (row: Row | undefined, field: string): number | null => typeof row?.[field] === 'number' ? row[field] as number : null;
const text = (row: Row | undefined, field: string): string | null => typeof row?.[field] === 'string' && row[field] ? row[field] as string : null;
const table = (tables: Tables, name: string): Row[] => tables[name] ?? [];
const numberValue = (row: Row | undefined, key: string): number | null => typeof row?.[key] === 'number' ? row[key] as number : null;

export interface NormalizationContext {
  readonly parserVersion: string;
  readonly nameResolver: (playerId: number) => ResolvedName;
  readonly competitionResolver?: (code: string) => string | null;
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
    playerStates.push({ playerId, name: context.nameResolver(playerId), preferredPositions, squadPosition: number(link, 'position'), overall: number(player, 'overallrating'), potential: number(player, 'potential'), birthdate: number(player, 'birthdate'), height: number(player, 'height'), weight: number(player, 'weight'), nationality: number(player, 'nationality'), contractUntil: number(player, 'contractvaliduntil'), wage: number(contract, 'wage'), contractDurationMonths: number(contract, 'duration_months'), contractStatus: number(contract, 'contract_status'), playerRole: number(contract, 'playerrole'), contractDate: number(contract, 'contract_date'), lastStatusChangeDate: number(contract, 'last_status_change_date'), signOnBonus: number(contract, 'signon_bonus'), performanceBonusValue: number(contract, 'performancebonusvalue'), jerseyNumber: number(link, 'jerseynumber'), leagueAppearances: number(link, 'leagueappearances'), leagueGoals: number(link, 'leaguegoals'), evidence: evidenceFor(['overall', 'potential', 'preferredPositions', 'height', 'contractUntil', 'squadPosition', 'wage']) });
  }
  const academyPlayers: AcademyPlayerState[] = table(tables, 'career_youthplayers').flatMap((row) => {
    const playerId = number(row, 'playerid'); return playerId === null ? [] : [{ playerId, name: context.nameResolver(playerId), tier: number(row, 'playertier'), lowPotential: number(row, 'swinglowpotential'), potentialVariance: number(row, 'potentialvariance'), monthsInSquad: number(row, 'monthsinsquad') }];
  });
  const uniquePlayers = [...new Map(playerStates.map((player) => [player.playerId, player])).values()];
  const uniqueAcademyPlayers = [...new Map(academyPlayers.map((player) => [player.playerId, player])).values()];
  const pref = table(tables, 'career_managerpref')[0];
  const score = (kind: 'win' | 'loss') => { const userScore = numberValue(managerInfo, `big${kind}userscore`); const opponentScore = numberValue(managerInfo, `big${kind}oppscore`); const date = numberValue(managerInfo, `big${kind}date`); if (userScore === null || opponentScore === null || date === null || date <= 20080101) return null; return { userScore, opponentScore, opponentTeamId: numberValue(managerInfo, `big${kind}oppteamid`), date }; };
  const seasons: SeasonRecord[] = table(tables, 'career_managerhistory').map((row) => ({ season: numberValue(row, 'season'), teamId: numberValue(row, 'teamid'), leagueId: numberValue(row, 'leagueid'), played: numberValue(row, 'games_played') ?? 0, wins: numberValue(row, 'wins') ?? 0, draws: numberValue(row, 'draws') ?? 0, losses: numberValue(row, 'losses') ?? 0, points: numberValue(row, 'points'), position: numberValue(row, 'tableposition') === 0 ? null : numberValue(row, 'tableposition'), goalsFor: numberValue(row, 'goals_for'), goalsAgainst: numberValue(row, 'goals_against'), leagueTrophies: numberValue(row, 'leaguetrophies') ?? 0, cupTrophies: (numberValue(row, 'domesticcuptrophies') ?? 0) + (numberValue(row, 'continentalcuptrophies') ?? 0), bigBuy: text(row, 'bigbuyplayername') ? { playerName: text(row, 'bigbuyplayername')!, amount: numberValue(row, 'bigbuyamount') ?? 0 } : null, bigSell: text(row, 'bigsellplayername') ? { playerName: text(row, 'bigsellplayername')!, amount: numberValue(row, 'bigsellamount') ?? 0 } : null, objectives: { league: numberValue(row, 'leagueobjective'), leagueResult: numberValue(row, 'leagueobjectiveresult'), domesticCup: numberValue(row, 'domestic_cup_objective'), domesticCupResult: numberValue(row, 'domestic_cup_result'), europeCup: numberValue(row, 'europe_cup_objective'), europeCupResult: numberValue(row, 'europe_cup_result') } }));
  const competitions: CompetitionProgress[] = table(tables, 'career_competitionprogress').map((row) => { const code = text(row, 'compshortname'); return { name: (code && context.competitionResolver?.(code)) || code || `Competition #${numberValue(row, 'compobjid') ?? 'unknown'}`, season: numberValue(row, 'season'), stage: numberValue(row, 'stageid'), won: (numberValue(row, 'hasteamwon') ?? 0) !== 0, result: numberValue(row, 'cup_objective_result') }; });
  const leagueLinks = table(tables, 'leagueteamlinks');
  const userLeagueId = number(user, 'leagueid') ?? leagueLinks.find((row) => number(row, 'teamid') === clubTeamId)?.leagueid as number | null ?? null;
  const leagueRow = table(tables, 'leagues').find((row) => number(row, 'leagueid') === userLeagueId);
  const teamNames = new Map(table(tables, 'teams').map((row) => [number(row, 'teamid'), text(row, 'teamname')]));
  const standings: LeagueStanding[] = leagueLinks.filter((row) => number(row, 'leagueid') === userLeagueId).map((row) => { const teamId = number(row, 'teamid'); const wins = (number(row, 'homewins') ?? 0) + (number(row, 'awaywins') ?? 0); const draws = (number(row, 'homedraws') ?? 0) + (number(row, 'awaydraws') ?? 0); const losses = (number(row, 'homelosses') ?? 0) + (number(row, 'awaylosses') ?? 0); return { teamId: teamId ?? -1, teamName: (teamId !== null && teamNames.get(teamId)) || `Team #${teamId ?? 'unknown'}`, position: number(row, 'currenttableposition') && number(row, 'currenttableposition')! > 0 ? number(row, 'currenttableposition') : null, previousPosition: number(row, 'previousyeartableposition') && number(row, 'previousyeartableposition')! > 0 ? number(row, 'previousyeartableposition') : null, played: wins + draws + losses, wins, draws, losses, goalsFor: (number(row, 'homegf') ?? 0) + (number(row, 'awaygf') ?? 0), goalsAgainst: (number(row, 'homega') ?? 0) + (number(row, 'awayga') ?? 0), points: number(row, 'points') ?? 0, isUserClub: teamId === clubTeamId }; }).sort((a, b) => (a.position ?? 999) - (b.position ?? 999) || b.points - a.points);
  const league: LeagueFacts | null = standings.length ? { leagueId: userLeagueId, leagueName: text(leagueRow, 'leaguename')?.replace(/ \(\d+\)$/, '') ?? null, standings } : null;
  const squadIds = new Set([...uniquePlayers, ...uniqueAcademyPlayers].map((player) => player.playerId));
  const growthFields = ['agility', 'acceleration', 'balance', 'ballcontrol', 'composure', 'crossing', 'curve', 'defensiveawareness', 'dribbling', 'finishing', 'freekickaccuracy', 'gkdiving', 'gkhandling', 'gkkicking', 'gkpositioning', 'gkreflexes', 'headingaccuracy', 'interceptions', 'jumping', 'longpassing', 'longshots', 'penalties', 'positioning', 'reactions', 'shortpassing', 'shotpower', 'slidingtackle', 'sprintspeed', 'stamina', 'standingtackle', 'strength', 'vision', 'volleys'];
  const playerGrowth = table(tables, 'career_playergrowthuserseason').filter((row) => squadIds.has(number(row, 'playerid') ?? -1)).map((row) => ({ playerId: number(row, 'playerid')!, overall: number(row, 'overall'), attributes: Object.fromEntries(growthFields.flatMap((field) => { const value = number(row, field); return value === null ? [] : [[field, value]]; })) }));
  const squadRanking = table(tables, 'career_squadranking').filter((row) => squadIds.has(number(row, 'playerid') ?? -1)).map((row) => ({ playerId: number(row, 'playerid')!, currentOverall: number(row, 'curroverall'), previousOverall: number(row, 'lastoverall') }));
  const transfers = table(tables, 'career_presignedcontract').filter((row) => number(row, 'teamid') === clubTeamId || number(row, 'offerteamid') === clubTeamId).map((row) => ({ playerId: number(row, 'playerid') ?? -1, teamId: number(row, 'teamid'), offerTeamId: number(row, 'offerteamid'), offeredFee: number(row, 'offeredfee'), offeredWage: number(row, 'offeredwage'), signedDate: number(row, 'signeddate'), completionDate: number(row, 'completedate'), contractType: number(row, 'offeredcontracttype'), isComingThisSeason: (number(row, 'iscomingthisseason') ?? 0) !== 0, isLoanBuy: (number(row, 'isloanbuy') ?? 0) !== 0, directApproach: (number(row, 'isdirectapproach') ?? 0) !== 0 }));
  const careerFacts: CareerFacts = { managerReputation: numberValue(managerInfo, 'managerreputation'), managerWage: numberValue(managerInfo, 'wage'), totalEarnings: numberValue(managerInfo, 'totalearnings'), clubWorth: numberValue(club, 'clubworth'), profitability: numberValue(club, 'profitability'), domesticPrestige: numberValue(club, 'domesticprestige'), internationalPrestige: numberValue(club, 'internationalprestige'), youthDevelopment: numberValue(club, 'youthdevelopment'), transferBudget: numberValue(pref, 'transferbudget'), wageBudget: numberValue(pref, 'wagebudget'), biggestWin: score('win'), biggestLoss: score('loss'), releasedPlayersThisSeason: numberValue(managerInfo, 'playersreleasedthisseason'), boardConfidence: numberValue(managerInfo, 'boardconfidence'), seasons, competitions, league, transfers, playerGrowth, squadRanking };
  return { schemaVersion: 1, careerHint: { clubTeamId, clubName: text(club, 'teamname'), managerName }, parsedSeasonIndex: number(user, 'seasoncount'), estimatedGameDate: null, estimatedDateBasis: null, players: uniquePlayers, academyPlayers: uniqueAcademyPlayers, evidence: PLAYER_EVIDENCE, warnings: uniquePlayers.length !== playerStates.length || uniqueAcademyPlayers.length !== academyPlayers.length ? [{ code: 'duplicate-player-id', message: 'Duplicate player IDs were returned by the parser and were collapsed by playerId.', severity: 'warning' }] : [], careerFacts };
}
