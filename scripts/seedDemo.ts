import { createHash } from 'node:crypto';
import { openDatabase } from '../src/store/database.js';
import { createSnapshotRepository } from '../src/store/snapshotRepository.js';
import type { PlayerState } from '../src/domain/snapshot.js';

const databasePath = process.env.FC26_COMPANION_DATABASE ?? 'data-v2/companion.sqlite';
const db = openDatabase(databasePath);
const repository = createSnapshotRepository(db);
const baseLabel = 'Demo Manager · Demo FC';
const existingCareer = repository.listCareers().find((item) => item.label === baseLabel);
const existingHasFacts = existingCareer ? repository.listSnapshots(existingCareer.id).some((snapshot) => (snapshot.careerFacts?.seasons.length ?? 0) > 0) : false;
const career = existingCareer && existingHasFacts ? existingCareer : repository.createCareer(existingCareer ? `${baseLabel} · Facts v2` : baseLabel);
const basePlayers: PlayerState[] = [
  { playerId: 1001, name: { display: 'Demo Striker', source: 'demo', provisional: false, resolverVersion: 'demo-fixture' }, preferredPositions: [25], squadPosition: 25, overall: 72, potential: 80, birthdate: null, height: 184, weight: null, nationality: 14, contractUntil: 2029, wage: 5000, jerseyNumber: 9, leagueAppearances: 0, leagueGoals: 0, evidence: [] },
  { playerId: 1002, name: { display: 'Demo Keeper', source: 'demo', provisional: false, resolverVersion: 'demo-fixture' }, preferredPositions: [0], squadPosition: 0, overall: 70, potential: 76, birthdate: null, height: 191, weight: null, nationality: 21, contractUntil: 2030, wage: 4200, jerseyNumber: 1, leagueAppearances: 0, leagueGoals: 0, evidence: [] },
  { playerId: 1003, name: { display: 'Demo Midfielder', source: 'demo', provisional: false, resolverVersion: 'demo-fixture' }, preferredPositions: [14], squadPosition: 14, overall: 68, potential: 74, birthdate: null, height: 178, weight: null, nationality: 27, contractUntil: 2028, wage: 3000, jerseyNumber: 8, leagueAppearances: 0, leagueGoals: 0, evidence: [] },
];
const academy = [{ playerId: 2001, name: { display: 'Demo Academy', source: 'demo' as const, provisional: false, resolverVersion: 'demo-fixture' }, tier: 2, lowPotential: null, potentialVariance: 3, monthsInSquad: 2 }];
const stages = [
  { label: '2026/27', checkpoint: 'season_start', date: '2026-08-01', delta: 0 },
  { label: '2026/27', checkpoint: 'summer_window_closed', date: '2026-09-01', delta: 1 },
  { label: '2026/27', checkpoint: 'january_window_closed', date: '2027-02-01', delta: 3 },
  { label: '2026/27', checkpoint: 'season_end', date: '2027-06-01', delta: 5 },
];
for (const stage of stages) {
  const sourceSha256 = createHash('sha256').update(`fc26-demo-${stage.checkpoint}`).digest('hex');
  if (repository.findByHash(career.id, sourceSha256)) continue;
  const players = basePlayers.map((player) => ({ ...player, overall: player.overall === null ? null : player.overall + stage.delta, potential: player.potential === null ? null : player.potential + (stage.delta > 2 ? 1 : 0) }));
  if (stage.checkpoint !== 'season_start') players.push({ ...basePlayers[0], playerId: 1004, name: { display: 'Demo New Signing', source: 'demo', provisional: false, resolverVersion: 'demo-fixture' }, preferredPositions: [5], squadPosition: 5, overall: 66 + stage.delta, potential: 75, jerseyNumber: 18 });
  repository.saveSnapshot({ careerId: career.id, sourceSha256, copySha256: sourceSha256, objectPath: `data-v2/demo/${sourceSha256}/DATA`, sourceFilename: 'DEMO-DATA', sizeBytes: 0, schemaVersion: 1, parserVersion: 'demo-fixture', parsedSeasonIndex: 1, seasonLabel: stage.label, checkpoint: stage.checkpoint, estimatedGameDate: stage.date, estimatedDateBasis: 'synthetic-fixture', careerHint: { managerName: 'Demo Manager', clubTeamId: 999, clubName: 'Demo FC' }, players, academyPlayers: stage.checkpoint === 'season_end' ? [...academy, { ...academy[0], playerId: 2002, name: { ...academy[0].name, display: 'Demo Academy Promotion' }, monthsInSquad: 8 }] : academy, evidence: [], warnings: [{ code: 'synthetic-fixture', message: 'Synthetic data; not extracted from a real save.', severity: 'info' }], userNote: 'Synthetic demo snapshot', importedAt: new Date(`${stage.date}T12:00:00Z`).toISOString(), careerFacts: { managerReputation: 75 + stage.delta, managerWage: 10000, totalEarnings: 100000 * stage.delta, clubWorth: 25000000, profitability: 12, domesticPrestige: 50 + stage.delta, internationalPrestige: 20, youthDevelopment: 70, transferBudget: 1000000 - stage.delta * 100000, wageBudget: 50000, biggestWin: { userScore: 4, opponentScore: 0, opponentTeamId: 901, date: Number(stage.date.replaceAll('-', '')) }, biggestLoss: null, seasons: [{ season: 1, played: stage.delta * 5, wins: stage.delta * 3, draws: stage.delta, losses: stage.delta, points: stage.delta * 10, position: stage.delta ? 3 : null, goalsFor: stage.delta * 8, goalsAgainst: stage.delta * 3, leagueTrophies: 0, cupTrophies: 0 }], competitions: [{ name: 'Demo League', season: 1, stage: stage.delta, won: stage.checkpoint === 'season_end', result: stage.delta }] } });
}
console.log(JSON.stringify({ database: databasePath, career: career.label, snapshots: repository.listSnapshots(career.id).length, synthetic: true }, null, 2));
db.close();
