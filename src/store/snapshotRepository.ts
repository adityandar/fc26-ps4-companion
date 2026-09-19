import Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import type { CareerId, SnapshotId } from '../domain/ids.js';
import { careerId, snapshotId } from '../domain/ids.js';
import type { Snapshot, SnapshotCandidate } from '../domain/snapshot.js';

export interface CareerSummary { readonly id: CareerId; readonly label: string; readonly createdAt: string }

export interface SnapshotRepository {
  createCareer(label: string): CareerSummary;
  listCareers(): readonly CareerSummary[];
  saveSnapshot(input: Omit<Snapshot, 'id'>): Snapshot;
  getSnapshot(id: SnapshotId): Snapshot | null;
  listSnapshots(career: CareerId): readonly Snapshot[];
  findByHash(career: CareerId, sourceSha256: string): Snapshot | null;
}

function rowToSnapshot(row: Record<string, unknown>, players: readonly Record<string, unknown>[], academy: readonly Record<string, unknown>[], evidence: readonly Record<string, unknown>[]): Snapshot {
  return {
    id: snapshotId(String(row.id)), careerId: careerId(String(row.career_id)), sourceSha256: String(row.source_sha256), copySha256: String(row.copy_sha256), objectPath: String(row.object_path), sourceFilename: String(row.source_filename), sizeBytes: Number(row.size_bytes), schemaVersion: 1, parserVersion: String(row.parser_version), parsedSeasonIndex: row.parsed_season_index === null ? null : Number(row.parsed_season_index), seasonLabel: String(row.season_label), checkpoint: String(row.checkpoint), estimatedGameDate: row.estimated_game_date === null ? null : String(row.estimated_game_date), estimatedDateBasis: row.estimated_date_basis === null ? null : String(row.estimated_date_basis), careerHint: { managerName: row.manager_name === null ? null : String(row.manager_name), clubTeamId: row.club_team_id === null ? null : Number(row.club_team_id), clubName: row.club_name === null ? null : String(row.club_name) }, players: players.map((item) => JSON.parse(String(item.state_json))), academyPlayers: academy.map((item) => JSON.parse(String(item.state_json))), evidence: evidence.flatMap((item) => JSON.parse(String(item.evidence_json))), warnings: [], userNote: String(row.user_note), importedAt: String(row.imported_at), careerFacts: JSON.parse(String(row.career_facts_json ?? '{}')),
  };
}

export function createSnapshotRepository(db: Database.Database): SnapshotRepository {
  const load = (id: SnapshotId): Snapshot | null => {
    const row = db.prepare('SELECT * FROM snapshot WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    if (!row) return null;
    const players = db.prepare('SELECT state_json FROM snapshot_player WHERE snapshot_id = ?').all(id) as Record<string, unknown>[];
    const academy = db.prepare('SELECT state_json FROM snapshot_academy_player WHERE snapshot_id = ?').all(id) as Record<string, unknown>[];
    const evidence = db.prepare('SELECT evidence_json FROM field_evidence WHERE snapshot_id = ?').all(id) as Record<string, unknown>[];
    return rowToSnapshot(row, players, academy, evidence);
  };
  return {
    createCareer(label) {
      const id = careerId(randomUUID()); const createdAt = new Date().toISOString();
      db.prepare('INSERT INTO career(id, label, created_at) VALUES (?, ?, ?)').run(id, label, createdAt);
      return { id, label, createdAt };
    },
    listCareers() {
      return (db.prepare('SELECT id, label, created_at FROM career ORDER BY created_at').all() as Record<string, unknown>[]).map((row) => ({ id: careerId(String(row.id)), label: String(row.label), createdAt: String(row.created_at) }));
    },
    saveSnapshot(input) {
      const existing = db.prepare('SELECT id FROM snapshot WHERE career_id = ? AND source_sha256 = ?').get(input.careerId, input.sourceSha256) as { id: string } | undefined;
      if (existing) return load(snapshotId(existing.id))!;
      const id = snapshotId(randomUUID());
      const insert = db.transaction(() => {
        db.prepare('INSERT INTO snapshot(id, career_id, source_sha256, copy_sha256, object_path, source_filename, size_bytes, schema_version, parser_version, parsed_season_index, season_label, checkpoint, estimated_game_date, estimated_date_basis, manager_name, club_team_id, club_name, user_note, imported_at, career_facts_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(id, input.careerId, input.sourceSha256, input.copySha256, input.objectPath, input.sourceFilename, input.sizeBytes, input.schemaVersion, input.parserVersion, input.parsedSeasonIndex, input.seasonLabel, input.checkpoint, input.estimatedGameDate, input.estimatedDateBasis, input.careerHint.managerName, input.careerHint.clubTeamId, input.careerHint.clubName, input.userNote, input.importedAt, JSON.stringify(input.careerFacts ?? {}));
        const playerInsert = db.prepare('INSERT INTO snapshot_player(snapshot_id, player_id, state_json) VALUES (?, ?, ?)');
        for (const player of input.players) playerInsert.run(id, player.playerId, JSON.stringify(player));
        const academyInsert = db.prepare('INSERT INTO snapshot_academy_player(snapshot_id, player_id, state_json) VALUES (?, ?, ?)');
        for (const player of input.academyPlayers) academyInsert.run(id, player.playerId, JSON.stringify(player));
        const evidenceInsert = db.prepare('INSERT INTO field_evidence(snapshot_id, normalized_field, evidence_json) VALUES (?, ?, ?)');
        for (const evidence of input.evidence) evidenceInsert.run(id, evidence.normalizedField, JSON.stringify(evidence));
        if (input.userNote) db.prepare('INSERT INTO snapshot_note(snapshot_id, note) VALUES (?, ?)').run(id, input.userNote);
      });
      insert();
      return load(id)!;
    },
    getSnapshot: load,
    listSnapshots(career) {
      return (db.prepare('SELECT * FROM snapshot WHERE career_id = ? ORDER BY season_label, imported_at').all(career) as Record<string, unknown>[]).map((row) => load(snapshotId(String(row.id)))!);
    },
    findByHash(career, sourceSha256) {
      const row = db.prepare('SELECT id FROM snapshot WHERE career_id = ? AND source_sha256 = ?').get(career, sourceSha256) as { id: string } | undefined;
      return row ? load(snapshotId(row.id)) : null;
    },
  };
}

export type SnapshotCandidateInput = SnapshotCandidate;
