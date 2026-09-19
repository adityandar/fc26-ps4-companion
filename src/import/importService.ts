import type { CareerId } from '../domain/ids.js';
import type { Snapshot, SnapshotCandidate } from '../domain/snapshot.js';
import { ObjectStore, type StagedObject } from './objectStore.js';
import { parseAndNormalizeSave } from './saveParser.js';
import type { SnapshotRepository } from '../store/snapshotRepository.js';

export interface ImportPreview { readonly staged: StagedObject; readonly candidate: SnapshotCandidate; readonly careerHint: string }
export type CareerChoice = { readonly kind: 'new'; readonly label: string } | { readonly kind: 'existing'; readonly id: CareerId };

export class ImportService {
  constructor(private readonly objects: ObjectStore, private readonly repository: SnapshotRepository, private readonly companionRoot: string) {}

  async preview(sourcePath: string): Promise<ImportPreview> {
    const staged = await this.objects.stageFile(sourcePath);
    const candidate = await parseAndNormalizeSave(staged.objectPath, this.companionRoot);
    return { staged, candidate, careerHint: `${candidate.careerHint.managerName ?? 'Unknown manager'} · ${candidate.careerHint.clubName ?? 'Unknown club'}` };
  }

  async previewBytes(filename: string, bytes: Uint8Array): Promise<ImportPreview> {
    const staged = await this.objects.stageBytes(filename, bytes);
    const candidate = await parseAndNormalizeSave(staged.objectPath, this.companionRoot);
    return { staged, candidate, careerHint: `${candidate.careerHint.managerName ?? 'Unknown manager'} · ${candidate.careerHint.clubName ?? 'Unknown club'}` };
  }

  commit(preview: ImportPreview, choice: CareerChoice, metadata: { readonly seasonLabel: string; readonly checkpoint: string; readonly note?: string }): Snapshot {
    const career = choice.kind === 'new' ? this.repository.createCareer(choice.label) : { id: choice.id };
    return this.repository.saveSnapshot({ ...preview.candidate, careerId: career.id, sourceSha256: preview.staged.sourceSha256, copySha256: preview.staged.copySha256, objectPath: preview.staged.objectPath, sourceFilename: preview.staged.sourceFilename, sizeBytes: preview.staged.sizeBytes, seasonLabel: metadata.seasonLabel, checkpoint: metadata.checkpoint, userNote: metadata.note ?? '', parserVersion: 'companion-pinned-0e1d32a', importedAt: new Date().toISOString() });
  }
}
