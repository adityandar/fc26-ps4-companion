import type { FieldEvidence } from '../domain/evidence.js';

export const PLAYER_EVIDENCE: readonly FieldEvidence[] = [
  { normalizedField: 'overall', sourceTable: 'players', sourceField: 'overallrating', transform: 'identity', classification: 'observed' },
  { normalizedField: 'potential', sourceTable: 'players', sourceField: 'potential', transform: 'identity', classification: 'observed' },
  { normalizedField: 'preferredPositions', sourceTable: 'players', sourceField: 'preferredposition1..4', transform: 'compact non-zero positions', classification: 'observed' },
  { normalizedField: 'height', sourceTable: 'players', sourceField: 'height', transform: 'identity', classification: 'observed' },
  { normalizedField: 'contractUntil', sourceTable: 'players', sourceField: 'contractvaliduntil', transform: 'identity', classification: 'observed' },
  { normalizedField: 'squadPosition', sourceTable: 'teamplayerlinks', sourceField: 'position', transform: 'identity', classification: 'observed' },
  { normalizedField: 'wage', sourceTable: 'career_playercontract', sourceField: 'wage', transform: 'identity', classification: 'observed' },
  { normalizedField: 'contractDurationMonths', sourceTable: 'career_playercontract', sourceField: 'duration_months', transform: 'identity', classification: 'observed' },
  { normalizedField: 'contractStatus', sourceTable: 'career_playercontract', sourceField: 'contract_status', transform: 'identity', classification: 'observed' },
  { normalizedField: 'playerRole', sourceTable: 'career_playercontract', sourceField: 'playerrole', transform: 'identity', classification: 'observed' },
  { normalizedField: 'estimatedGameDate', sourceTable: 'persistent_events/career_playermatchratinghistory/career_presignedcontract', sourceField: 'eventdate/date/signeddate', transform: 'maximum date lower bound', classification: 'inferred' },
];
