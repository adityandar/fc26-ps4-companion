import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { SnapshotId } from '../domain/ids.js';
import { snapshotId } from '../domain/ids.js';
import { compareSnapshots, IncompatibleCareerError } from '../comparison/compareSnapshots.js';
import type { SnapshotRepository } from '../store/snapshotRepository.js';

function json(res: ServerResponse, status: number, body: unknown): void {
  const data = JSON.stringify(body); res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'content-length': Buffer.byteLength(data) }); res.end(data);
}

export function createApiServer(repository: SnapshotRepository, port = 4132, host = '127.0.0.1') {
  const server = createServer((req, res) => {
    try {
      const url = new URL(req.url ?? '/', `http://${host}`);
      if (req.method !== 'GET') return json(res, 405, { error: 'read-only route' });
      if (url.pathname === '/api/careers') return json(res, 200, repository.listCareers());
      const careerMatch = /^\/api\/careers\/([^/]+)\/snapshots$/.exec(url.pathname);
      if (careerMatch) return json(res, 200, repository.listSnapshots(careerMatch[1] as never));
      const snapshotMatch = /^\/api\/snapshots\/([^/]+)$/.exec(url.pathname);
      if (snapshotMatch) { const found = repository.getSnapshot(snapshotId(snapshotMatch[1])); return found ? json(res, 200, found) : json(res, 404, { error: 'snapshot not found' }); }
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
