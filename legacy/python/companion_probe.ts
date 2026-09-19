import { readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { pathToFileURL } from 'node:url';

const [companionRoot, savePath] = process.argv.slice(2);
if (!companionRoot || !savePath) throw new Error('usage: companion_probe.ts <companion-root> <save-path>');
const root = companionRoot.replace(/\/$/, '');
const metaMod = await import(pathToFileURL(join(root, 'src/parser/meta.ts')).href);
const dbMod = await import(pathToFileURL(join(root, 'src/parser/dbReader.ts')).href);
const namesMod = await import(pathToFileURL(join(root, 'src/names/nameTable.ts')).href);
const deriveMod = await import(pathToFileURL(join(root, 'src/names/deriveNameTable.ts')).href);
const meta = metaMod.loadDbMeta(join(root, 'data/fifa_ng_db-meta.xml'));
const parsed = dbMod.parseSave(readFileSync(savePath), meta);
const tables = parsed.tables as Record<string, Record<string, unknown>[]>;
const knownNames = namesMod.loadNameTable(join(root, 'data/playernames_fc26.csv'));
const derivedNames = deriveMod.deriveNameIds([tables], knownNames);
const nameResolver = namesMod.createNameResolver(tables, knownNames, derivedNames);
const row = (table: string) => tables[table]?.[0] ?? {};
const num = (value: unknown): number | null => typeof value === 'number' ? value : null;
const str = (value: unknown): string | null => typeof value === 'string' && value.length ? value : null;
const user = row('career_users');
const info = row('career_managerinfo');
const clubId = num(info.clubteamid) ?? num(user.clubteamid);
const club = (tables.teams ?? []).find((item) => item.teamid === clubId) ?? {};
const nameRows = tables.teamplayerlinks ?? [];
const senior = nameRows.filter((item) => item.teamid === clubId).length;
const academy = (tables.career_youthplayers ?? []).filter((item) => num(item.playerid) !== null).length;
const playersById = new Map((tables.players ?? []).map((item) => [num(item.playerid), item]));
const localNames = new Map((tables.dcplayernames ?? []).map((item) => [num(item.nameid), str(item.name)]));
const contractsById = new Map((tables.career_playercontract ?? []).map((item) => [num(item.playerid), item]));
const playerFields = ['overallrating', 'potential', 'birthdate', 'preferredposition1', 'preferredposition2', 'preferredposition3', 'preferredposition4', 'height', 'weight', 'nationality', 'contractvaliduntil', 'playerjointeamdate'];
const squadPlayers = nameRows.filter((item) => item.teamid === clubId).map((link) => {
  const id = num(link.playerid); const player = playersById.get(id) ?? {}; const contract = contractsById.get(id) ?? {};
  const nameIds = [player.firstnameid, player.lastnameid, player.commonnameid, player.playerjerseynameid].map(num).filter((value): value is number => value !== null);
  const localName = nameIds.map((nameId) => localNames.get(nameId)).filter(Boolean).join(' ') || null;
  const resolved = id === null ? null : nameResolver.resolve(id);
  return { playerid: id, name: resolved?.display ?? null, name_source: resolved?.origin ?? null, local_name: localName, nameids: { firstnameid: num(player.firstnameid), lastnameid: num(player.lastnameid), commonnameid: num(player.commonnameid), jerseynameid: num(player.playerjerseynameid) }, attributes: Object.fromEntries(playerFields.map((field) => [field, player[field] ?? null])), squad: { position: link.position ?? null, jerseynumber: link.jerseynumber ?? null, form: link.form ?? null, leagueappearances: link.leagueappearances ?? null, leaguegoals: link.leaguegoals ?? null }, contract: { wage: contract.wage ?? null, duration_months: contract.duration_months ?? null, contract_status: contract.contract_status ?? null } };
});
const academyPlayers = (tables.career_youthplayers ?? []).filter((item) => num(item.playerid) !== null).map((item) => ({ playerid: num(item.playerid), playertier: item.playertier ?? null, swinglowpotential: item.swinglowpotential ?? null, potentialvariance: item.potentialvariance ?? null, monthsinsquad: item.monthsinsquad ?? null }));
const dateFields = [['persistent_events','eventdate'], ['career_playermatchratinghistory','date'], ['career_presignedcontract','signeddate']];
let latest = 0;
for (const [table, field] of dateFields) for (const item of tables[table] ?? []) {
  const value = num(item[field]); if (value && value > latest) latest = value;
}
const latestDate = latest ? String(latest).replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3') : 'unknown';
console.log(JSON.stringify({
  file_name: basename(savePath),
  databases: parsed.databases.length,
  table_counts: parsed.databases.map((db: { tables: string[] }) => db.tables.length),
  unknown_tables: parsed.unknownTables,
  manager_name: [str(user.firstname), str(user.surname)].filter(Boolean).join(' '),
  club_name: str(club.teamname) ?? (clubId === null ? 'unknown' : `#${clubId}`),
  season: num(user.seasoncount),
  estimated_date: latestDate,
  senior_players: senior,
  academy_players: academy,
  squad_players: squadPlayers,
  academy_player_records: academyPlayers,
  player_count: (tables.players ?? []).length,
  parser_stats: parsed.stats,
}, null, 2));
