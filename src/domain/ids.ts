export type CareerId = string & { readonly __brand: 'CareerId' };
export type SnapshotId = string & { readonly __brand: 'SnapshotId' };

export const careerId = (value: string): CareerId => value as CareerId;
export const snapshotId = (value: string): SnapshotId => value as SnapshotId;
