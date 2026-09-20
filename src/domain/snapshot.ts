import type { CareerId, SnapshotId } from './ids.js';
import type { FieldEvidence, ParserWarning } from './evidence.js';
import type { CareerFacts } from './careerFacts.js';

export const SNAPSHOT_SCHEMA_VERSION = 1;

export interface ResolvedName {
  readonly display: string;
  readonly source: 'edited' | 'primary' | 'fallback' | 'literal' | 'derived' | 'unresolved' | 'demo';
  readonly provisional: boolean;
  readonly resolverVersion: string;
}

export interface PlayerState {
  readonly playerId: number;
  readonly name: ResolvedName;
  readonly preferredPositions: readonly number[];
  readonly squadPosition: number | null;
  readonly overall: number | null;
  readonly potential: number | null;
  readonly birthdate: number | null;
  readonly height: number | null;
  readonly weight: number | null;
  readonly nationality: number | null;
  readonly nationalityName?: string | null;
  readonly preferredFoot?: number | null;
  readonly contractUntil: number | null;
  readonly wage: number | null;
  readonly contractDurationMonths?: number | null;
  readonly contractStatus?: number | null;
  readonly playerRole?: number | null;
  readonly contractDate?: number | null;
  readonly lastStatusChangeDate?: number | null;
  readonly signOnBonus?: number | null;
  readonly performanceBonusValue?: number | null;
  readonly jerseyNumber: number | null;
  readonly leagueAppearances: number | null;
  readonly leagueGoals: number | null;
  readonly evidence: readonly FieldEvidence[];
}

export interface AcademyPlayerState {
  readonly playerId: number;
  readonly name: ResolvedName;
  readonly tier: number | null;
  readonly lowPotential: number | null;
  readonly potentialVariance: number | null;
  readonly monthsInSquad: number | null;
}

export interface SnapshotCandidate {
  readonly schemaVersion: typeof SNAPSHOT_SCHEMA_VERSION;
  readonly careerHint: { readonly clubTeamId: number | null; readonly clubName: string | null; readonly managerName: string | null };
  readonly parsedSeasonIndex: number | null;
  readonly estimatedGameDate: string | null;
  readonly estimatedDateBasis: string | null;
  readonly players: readonly PlayerState[];
  readonly academyPlayers: readonly AcademyPlayerState[];
  readonly evidence: readonly FieldEvidence[];
  readonly warnings: readonly ParserWarning[];
  readonly careerFacts?: CareerFacts;
}

export interface Snapshot extends SnapshotCandidate {
  readonly id: SnapshotId;
  readonly careerId: CareerId;
  readonly sourceSha256: string;
  readonly copySha256: string;
  readonly objectPath: string;
  readonly sourceFilename: string;
  readonly sizeBytes: number;
  readonly seasonLabel: string;
  readonly checkpoint: string;
  readonly userNote: string;
  readonly parserVersion: string;
  readonly importedAt: string;
}
