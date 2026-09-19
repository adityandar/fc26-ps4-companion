import { access } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

export const companionRevision = '0e1d32a87c9947be681803cd506bc543f912cfd8';

export interface CompanionModules {
  readonly parseSave: (bytes: Buffer, meta: unknown) => unknown;
  readonly loadDbMeta: (path: string) => unknown;
  readonly createNameResolver: (...args: unknown[]) => unknown;
  readonly loadNameTable: (path: string) => unknown;
  readonly deriveNameIds: (...args: unknown[]) => unknown;
}

export async function loadCompanionModules(root = process.env.FC26_COMPANION_ROOT): Promise<CompanionModules> {
  if (!root) throw new Error('FC26_COMPANION_ROOT is required');
  const parser = join(root, 'src/parser/dbReader.ts');
  const meta = join(root, 'src/parser/meta.ts');
  const names = join(root, 'src/names/nameTable.ts');
  const derive = join(root, 'src/names/deriveNameTable.ts');
  await Promise.all([parser, meta, names, derive].map((path) => access(path)));
  const [parserModule, metaModule, namesModule, deriveModule] = await Promise.all([
    import(pathToFileURL(parser).href),
    import(pathToFileURL(meta).href),
    import(pathToFileURL(names).href),
    import(pathToFileURL(derive).href),
  ]);
  return {
    parseSave: parserModule.parseSave,
    loadDbMeta: metaModule.loadDbMeta,
    createNameResolver: namesModule.createNameResolver,
    loadNameTable: namesModule.loadNameTable,
    deriveNameIds: deriveModule.deriveNameIds,
  };
}
