export const DB_HEADER = Buffer.from([0x44, 0x42, 0x00, 0x08, 0x00, 0x00, 0x00, 0x00]);

export interface DatabaseBlock { readonly index: number; readonly offset: number; readonly size: number; readonly bytes: Buffer }

/** Read-only FC26 database container scan. It never mutates or decrypts input bytes. */
export function scanDatabaseBlocks(save: Uint8Array): readonly DatabaseBlock[] {
  const bytes = Buffer.from(save); const blocks: DatabaseBlock[] = []; let cursor = 0; let index = 0;
  while (cursor <= bytes.length - DB_HEADER.length) {
    const offset = bytes.indexOf(DB_HEADER, cursor); if (offset < 0) break;
    if (offset + 12 > bytes.length) break;
    const size = bytes.readUInt32LE(offset + 8);
    if (size < 12 || offset + size > bytes.length) { cursor = offset + DB_HEADER.length; continue; }
    blocks.push({ index, offset, size, bytes: Buffer.from(bytes.subarray(offset, offset + size)) }); index++; cursor = offset + size;
  }
  return blocks;
}

export function containerSummary(save: Uint8Array): { readonly databases: number; readonly offsets: readonly number[]; readonly sizes: readonly number[] } {
  const blocks = scanDatabaseBlocks(save); return { databases: blocks.length, offsets: blocks.map((block) => block.offset), sizes: blocks.map((block) => block.size) };
}
