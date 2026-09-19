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
