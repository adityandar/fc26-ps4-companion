import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { access, copyFile, mkdir, rename, stat } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';

export interface StagedObject {
  readonly sourcePath: string;
  readonly objectPath: string;
  readonly sourceSha256: string;
  readonly copySha256: string;
  readonly sizeBytes: number;
  readonly sourceFilename: string;
}

async function hashFile(path: string): Promise<string> {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(path)) hash.update(new Uint8Array(chunk));
  return hash.digest('hex');
}

export class ObjectStore {
  constructor(private readonly root: string) {}

  async stageFile(sourcePath: string): Promise<StagedObject> {
    const sourceSha256 = await hashFile(sourcePath);
    const sourceStat = await stat(sourcePath);
    const objectDir = join(this.root, 'objects', sourceSha256);
    const objectPath = join(objectDir, basename(sourcePath));
    await mkdir(objectDir, { recursive: true });
    try {
      await access(objectPath);
    } catch {
      const tempPath = join(objectDir, `.staging-${process.pid}-${Date.now()}`);
      await copyFile(sourcePath, tempPath);
      const copySha256 = await hashFile(tempPath);
      if (copySha256 !== sourceSha256) throw new Error('staged copy hash does not match source hash');
      await rename(tempPath, objectPath);
    }
    const copySha256 = await hashFile(objectPath);
    if (copySha256 !== sourceSha256) throw new Error('existing object hash does not match source hash');
    return { sourcePath, objectPath, sourceSha256, copySha256, sizeBytes: sourceStat.size, sourceFilename: basename(sourcePath) };
  }
}
