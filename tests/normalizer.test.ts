import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizePs4Save } from '../src/import/ps4Normalizer.js';

test('normalizer collapses duplicate senior and academy player rows', () => {
  const parsed = { tables: {
    career_users: [{ seasoncount: 1, clubteamid: 10 }],
    career_managerinfo: [{ clubteamid: 10 }],
    teams: [{ teamid: 10, teamname: 'Test FC' }],
    teamplayerlinks: [{ teamid: 10, playerid: 7, position: 1 }, { teamid: 10, playerid: 7, position: 1 }],
    players: [{ playerid: 7, overallrating: 70, potential: 75 }],
    career_playercontract: [],
    career_youthplayers: [{ playerid: 99, playertier: 2 }, { playerid: 99, playertier: 2 }],
  } };
  const candidate = normalizePs4Save(parsed, { parserVersion: 'test', nameResolver: (playerId) => ({ display: `Player #${playerId}`, source: 'unresolved', provisional: false, resolverVersion: 'test' }) });
  assert.equal(candidate.players.length, 1);
  assert.equal(candidate.academyPlayers.length, 1);
  assert.equal(candidate.warnings.length, 1);
  assert.equal(candidate.warnings[0].code, 'duplicate-player-id');
});

test('normalizer treats zero table position as an unavailable final position and resolves competition codes', () => {
  const candidate = normalizePs4Save({ tables: {
    career_users: [{ seasoncount: 2, clubteamid: 10 }],
    career_managerinfo: [{ clubteamid: 10, managerreputation: 0 }],
    teams: [{ teamid: 10, teamname: 'Test FC', clubworth: 10946 }],
    teamplayerlinks: [], players: [], career_playercontract: [], career_youthplayers: [],
    career_managerhistory: [{ season: 2, games_played: 10, wins: 3, draws: 2, losses: 5, points: 11, tableposition: 0 }],
    career_competitionprogress: [{ compshortname: 'C201', compobjid: 1, stageid: 543, hasteamwon: 0 }],
  } }, { parserVersion: 'test', competitionResolver: (code) => code === 'C201' ? 'FA Cup' : null, nameResolver: (playerId) => ({ display: `Player #${playerId}`, source: 'unresolved', provisional: false, resolverVersion: 'test' }) });
  assert.equal(candidate.careerFacts?.seasons[0]?.position, null);
  assert.equal(candidate.careerFacts?.competitions[0]?.name, 'FA Cup');
  assert.equal(candidate.careerFacts?.competitions[0]?.stage, 543);
});

test('normalizer extracts the active league table from league links', () => {
  const candidate = normalizePs4Save({ tables: {
    career_users: [{ seasoncount: 2, clubteamid: 10, leagueid: 20 }],
    career_managerinfo: [{ clubteamid: 10 }],
    teams: [{ teamid: 10, teamname: 'Test FC' }, { teamid: 11, teamname: 'Rival FC' }],
    leagues: [{ leagueid: 20, leaguename: 'Test League (1)' }],
    leagueteamlinks: [
      { leagueid: 20, teamid: 10, currenttableposition: 2, previousyeartableposition: 4, homewins: 3, awaywins: 1, homedraws: 2, awaydraws: 0, homelosses: 0, awaylosses: 1, homegf: 8, awaygf: 4, homega: 3, awayga: 2, points: 14 },
      { leagueid: 20, teamid: 11, currenttableposition: 1, homewins: 5, awaywins: 0, homedraws: 0, awaydraws: 0, homelosses: 0, awaylosses: 1, homegf: 10, awaygf: 0, homega: 2, awayga: 1, points: 15 },
    ],
    teamplayerlinks: [], players: [], career_playercontract: [], career_youthplayers: [],
  } }, { parserVersion: 'test', nameResolver: (playerId) => ({ display: `Player #${playerId}`, source: 'unresolved', provisional: false, resolverVersion: 'test' }) });
  assert.equal(candidate.careerFacts?.league?.leagueName, 'Test League');
  assert.equal(candidate.careerFacts?.league?.standings[1]?.isUserClub, true);
  assert.equal(candidate.careerFacts?.league?.standings[1]?.previousPosition, 4);
});

test('normalizer captures club-focused contracts, growth, ranking, and transfer activity', () => {
  const candidate = normalizePs4Save({ tables: {
    career_users: [{ seasoncount: 2, clubteamid: 10, leagueid: 20 }], career_managerinfo: [{ clubteamid: 10, playersreleasedthisseason: 2, boardconfidence: 4 }],
    teams: [{ teamid: 10, teamname: 'Test FC' }, { teamid: 11, teamname: 'Rival FC' }], leagues: [{ leagueid: 20, leaguename: 'Test League' }], leagueteamlinks: [],
    teamplayerlinks: [{ teamid: 10, playerid: 7, position: 1 }], players: [{ playerid: 7, overallrating: 70, potential: 75 }],
    career_playercontract: [{ playerid: 7, teamid: 10, wage: 1000, duration_months: 24, contract_status: 0, playerrole: 2, contract_date: 20260101, last_status_change_date: 20260102, signon_bonus: 50, performancebonusvalue: 10 }], career_youthplayers: [],
    career_managerhistory: [{ season: 2, teamid: 10, leagueid: 20, games_played: 10, wins: 3, draws: 2, losses: 5, points: 11, tableposition: 4, bigbuyplayername: 'New Player', bigbuyamount: 1000, domestic_cup_objective: 2, domestic_cup_result: 1 }],
    career_playergrowthuserseason: [{ playerid: 7, overall: 71, acceleration: 80, finishing: 60 }], career_squadranking: [{ playerid: 7, curroverall: 710, lastoverall: 700 }],
    career_presignedcontract: [{ playerid: 8, teamid: 10, offerteamid: 11, offeredfee: 2000, offeredwage: 900, signeddate: 20260103, completedate: 20260701, offeredcontracttype: 5, iscomingthisseason: 1, isloanbuy: 0, isdirectapproach: 1 }],
    persistent_events: [{ eventid: 5, eventdate: 20260701, team1id: 11, team2id: 10, player1id: 8 }, { eventid: 5, eventdate: 20260702, team1id: 12, team2id: 13, player1id: 9 }],
  } }, { parserVersion: 'test', nameResolver: (playerId) => ({ display: `Player #${playerId}`, source: 'unresolved', provisional: false, resolverVersion: 'test' }) });
  assert.equal(candidate.players[0]?.contractDurationMonths, 24);
  assert.equal(candidate.careerFacts?.seasons[0]?.bigBuy?.amount, 1000);
  assert.equal(candidate.careerFacts?.seasons[0]?.teamId, 10);
  assert.equal(candidate.careerFacts?.playerGrowth?.[0]?.overall, 71);
  assert.equal(candidate.careerFacts?.squadRanking?.[0]?.currentOverall, 710);
  assert.equal(candidate.careerFacts?.transfers?.[0]?.offeredFee, 2000);
  assert.equal(candidate.careerFacts?.transferEvents?.[0]?.fromTeamName, 'Rival FC');
  assert.equal(candidate.careerFacts?.transferEvents?.[0]?.toTeamName, 'Test FC');
  assert.equal(candidate.careerFacts?.transferEvents?.[0]?.playerName, 'Player #8');
  assert.equal(candidate.careerFacts?.transferEvents?.length, 2);
});
