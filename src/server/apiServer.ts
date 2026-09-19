import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { SnapshotId } from '../domain/ids.js';
import { careerId, snapshotId } from '../domain/ids.js';
import { compareSnapshots, IncompatibleCareerError } from '../comparison/compareSnapshots.js';
import type { SnapshotRepository } from '../store/snapshotRepository.js';
import type { ImportPreview, ImportService } from '../import/importService.js';

function json(res: ServerResponse, status: number, body: unknown): void {
  const data = JSON.stringify(body); res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'content-length': Buffer.byteLength(data) }); res.end(data);
}
function csvValue(value: unknown): string { const text = value === null || value === undefined ? '' : String(value); return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text; }

async function requestJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) { chunks.push(Buffer.from(chunk)); if (Buffer.concat(chunks).length > 64 * 1024 * 1024) throw new Error('request exceeds 64 MiB limit'); }
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as Record<string, unknown>;
}

export function createApiServer(repository: SnapshotRepository, port = 4132, host = '127.0.0.1', webRoot = join(process.cwd(), 'web-v2'), importer?: ImportService) {
  const previews = new Map<string, { preview: ImportPreview; expiresAt: number }>();
  const server = createServer((req, res) => {
    try {
      const url = new URL(req.url ?? '/', `http://${host}`);
      if (req.method === 'POST' && importer && url.pathname === '/api/import/preview') return requestJson(req).then(async (body) => {
        const filename = typeof body.filename === 'string' && body.filename.length <= 128 ? body.filename.replace(/[^a-zA-Z0-9._-]/g, '_') : 'DATA';
        const encoded = typeof body.dataBase64 === 'string' ? body.dataBase64 : '';
        if (!encoded) return json(res, 400, { error: 'dataBase64 is required' });
        if (encoded.length > 64 * 1024 * 1024) return json(res, 413, { error: 'uploaded save exceeds 48 MiB decoded limit' });
        const bytes = Buffer.from(encoded, 'base64'); if (!bytes.length) return json(res, 400, { error: 'uploaded save is empty' }); if (bytes.length > 48 * 1024 * 1024) return json(res, 413, { error: 'uploaded save exceeds 48 MiB limit' });
        const preview = await importer.previewBytes(filename, bytes);
        const token = `${preview.staged.sourceSha256}-${Date.now()}`; previews.set(token, { preview, expiresAt: Date.now() + 15 * 60 * 1000 });
        return json(res, 200, { token, sourceSha256: preview.staged.sourceSha256, copySha256: preview.staged.copySha256, sizeBytes: preview.staged.sizeBytes, sourceFilename: preview.staged.sourceFilename, careerHint: preview.careerHint, candidate: { managerName: preview.candidate.careerHint.managerName, clubName: preview.candidate.careerHint.clubName, players: preview.candidate.players.length, academyPlayers: preview.candidate.academyPlayers.length, estimatedGameDate: preview.candidate.estimatedGameDate, parsedSeasonIndex: preview.candidate.parsedSeasonIndex, warnings: preview.candidate.warnings } });
      }).catch((error) => json(res, 400, { error: error instanceof Error ? error.message : 'import preview failed' }));
      if (req.method === 'POST' && importer && url.pathname === '/api/import/commit') return requestJson(req).then((body) => {
        const token = typeof body.token === 'string' ? body.token : ''; const entry = previews.get(token); const preview = entry?.preview;
        if (!entry || !preview || entry.expiresAt < Date.now()) { previews.delete(token); return json(res, 404, { error: 'preview expired or not found' }); }
        const seasonLabel = typeof body.seasonLabel === 'string' ? body.seasonLabel : 'unknown'; const checkpoint = typeof body.checkpoint === 'string' ? body.checkpoint : 'custom';
        const careerIdValue = typeof body.careerId === 'string' && body.careerId ? { kind: 'existing' as const, id: body.careerId as never } : { kind: 'new' as const, label: typeof body.careerLabel === 'string' && body.careerLabel ? body.careerLabel : preview.careerHint };
        const snapshot = importer.commit(preview, careerIdValue, { seasonLabel, checkpoint, note: typeof body.note === 'string' ? body.note : undefined }); previews.delete(token);
        return json(res, 201, { snapshotId: snapshot.id, careerId: snapshot.careerId, sourceSha256: snapshot.sourceSha256 });
      }).catch((error) => json(res, 400, { error: error instanceof Error ? error.message : 'import commit failed' }));
      if (req.method !== 'GET') return json(res, 405, { error: 'method not allowed' });
      if (url.pathname === '/' || /^\/(index|import|view|compare)\.html$/.test(url.pathname)) {
        const page = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
        return readFile(join(webRoot, page)).then((data) => { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); res.end(data); }).catch(() => json(res, 404, { error: 'web ui not found' }));
      }
      if (url.pathname === '/app.js' || url.pathname === '/styles.css') {
        const contentType = url.pathname.endsWith('.js') ? 'text/javascript; charset=utf-8' : 'text/css; charset=utf-8';
        return readFile(join(webRoot, url.pathname.slice(1))).then((data) => { res.writeHead(200, { 'content-type': contentType }); res.end(data); }).catch(() => json(res, 404, { error: 'asset not found' }));
      }
      if (url.pathname === '/api/careers') return json(res, 200, repository.listCareers());
      const careerMatch = /^\/api\/careers\/([^/]+)\/snapshots$/.exec(url.pathname);
      if (careerMatch) return json(res, 200, repository.listSnapshots(careerId(careerMatch[1])));
      const snapshotMatch = /^\/api\/snapshots\/([^/]+)$/.exec(url.pathname);
      if (snapshotMatch) { const found = repository.getSnapshot(snapshotId(snapshotMatch[1])); return found ? json(res, 200, found) : json(res, 404, { error: 'snapshot not found' }); }
      const exportMatch = /^\/api\/snapshots\/([^/]+)\/export\.(json|csv)$/.exec(url.pathname);
      if (exportMatch) { const found = repository.getSnapshot(snapshotId(exportMatch[1])); if (!found) return json(res, 404, { error: 'snapshot not found' }); if (exportMatch[2] === 'json') { const data = JSON.stringify(found, null, 2); res.writeHead(200, { 'content-type': 'application/json', 'content-disposition': `attachment; filename="${found.sourceFilename}.json"` }); return res.end(data); } const rows = [['player_id', 'name', 'name_source', 'position_codes', 'overall', 'potential', 'height_cm', 'contract_until', 'wage', 'jersey_number'], ...found.players.map((player) => [player.playerId, player.name.display, player.name.source, player.preferredPositions.join('|'), player.overall, player.potential, player.height, player.contractUntil, player.wage, player.jerseyNumber])]; const data = rows.map((row) => row.map(csvValue).join(',')).join('\n'); res.writeHead(200, { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="${found.sourceFilename}.csv"` }); return res.end(data); }
      if (url.pathname === '/api/compare') {
        const a = url.searchParams.get('a'); const b = url.searchParams.get('b');
        if (!a || !b) return json(res, 400, { error: 'a and b snapshot IDs are required' });
        const left = repository.getSnapshot(snapshotId(a)); const right = repository.getSnapshot(snapshotId(b));
        if (!left || !right) return json(res, 404, { error: 'snapshot not found' });
        try { return json(res, 200, compareSnapshots(left, right)); } catch (error) { if (error instanceof IncompatibleCareerError) return json(res, 409, { error: error.message }); throw error; }
      }
      return json(res, 404, { error: 'not found' });
    } catch (error) { return json(res, 500, { error: error instanceof Error ? error.message : 'internal error' }); }
  });
  return { server, listen: () => new Promise<string>((resolve) => server.listen(port, host, () => { const address = server.address(); const actualPort = typeof address === 'object' && address ? address.port : port; resolve(`http://${host}:${actualPort}`); })), close: () => server.close() };
}
