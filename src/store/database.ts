import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const SCHEMA = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS schema_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS career (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS snapshot (
  id TEXT PRIMARY KEY,
  career_id TEXT NOT NULL REFERENCES career(id),
  source_sha256 TEXT NOT NULL,
  copy_sha256 TEXT NOT NULL,
  object_path TEXT NOT NULL,
  source_filename TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  schema_version INTEGER NOT NULL,
  parser_version TEXT NOT NULL,
  parsed_season_index INTEGER,
  season_label TEXT NOT NULL,
  checkpoint TEXT NOT NULL,
  estimated_game_date TEXT,
  estimated_date_basis TEXT,
  manager_name TEXT,
  club_team_id INTEGER,
  club_name TEXT,
  user_note TEXT NOT NULL,
  imported_at TEXT NOT NULL,
  UNIQUE(career_id, source_sha256)
);
CREATE TABLE IF NOT EXISTS snapshot_player (
  snapshot_id TEXT NOT NULL REFERENCES snapshot(id),
  player_id INTEGER NOT NULL,
  state_json TEXT NOT NULL,
  PRIMARY KEY(snapshot_id, player_id)
);
CREATE TABLE IF NOT EXISTS snapshot_academy_player (
  snapshot_id TEXT NOT NULL REFERENCES snapshot(id),
  player_id INTEGER NOT NULL,
  state_json TEXT NOT NULL,
  PRIMARY KEY(snapshot_id, player_id)
);
CREATE TABLE IF NOT EXISTS field_evidence (
  snapshot_id TEXT NOT NULL REFERENCES snapshot(id),
  normalized_field TEXT NOT NULL,
  evidence_json TEXT NOT NULL,
  PRIMARY KEY(snapshot_id, normalized_field)
);
CREATE TABLE IF NOT EXISTS parser_run (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_sha256 TEXT NOT NULL,
  status TEXT NOT NULL,
  warnings_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS snapshot_note (
  snapshot_id TEXT PRIMARY KEY REFERENCES snapshot(id),
  note TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS data_source_attribution (
  id TEXT PRIMARY KEY,
  role TEXT NOT NULL,
  source_uri TEXT NOT NULL,
  attribution TEXT NOT NULL
);
`;

export function openDatabase(path: string): Database.Database {
  mkdirSync(dirname(path), { recursive: true });
  const db = new Database(path);
  db.exec(SCHEMA);
  db.prepare("INSERT OR REPLACE INTO schema_meta(key, value) VALUES ('version', '1')").run();
  return db;
}
