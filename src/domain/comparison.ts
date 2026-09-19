import type { SnapshotId } from './ids.js';
import type { PlayerState } from './snapshot.js';

export interface PlayerFieldChange {
  readonly field: string;
  readonly before: unknown;
  readonly after: unknown;
}

export interface PlayerJoined {
  readonly playerId: number;
  readonly name: string;
  readonly nameSource: string;
  readonly after: PlayerState;
}

export interface PlayerDeparted {
  readonly playerId: number;
  readonly name: string;
  readonly nameSource: string;
  readonly before: PlayerState;
}

export interface PlayerUpdated {
  readonly playerId: number;
  readonly name: string;
  readonly changes: readonly PlayerFieldChange[];
}

export interface ComparisonResult {
  readonly snapshotA: SnapshotId;
  readonly snapshotB: SnapshotId;
  readonly careerCompatible: true;
  readonly players: {
    readonly joined: readonly PlayerJoined[];
    readonly departed: readonly PlayerDeparted[];
    readonly updated: readonly PlayerUpdated[];
  };
  readonly academy: { readonly added: number; readonly removed: number };
  readonly summary: Readonly<Record<string, number>>;
}
