import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { createApiMiddleware } from './apiPlugin.ts';
import { openConfiguredDbClient } from './dbClient.ts';

const DIST_DIR = path.join(process.cwd(), 'dist');
const UPLOADS_DIR = path.join(process.cwd(), 'public', 'uploads');

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.json': 'application/json; charset=utf-8',
  '.ico': 'image/x-icon',
};

function serveStaticFile(res: http.ServerResponse, filePath: string): boolean {
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    return false;
  }
  const ext = path.extname(filePath).toLowerCase();
  res.statusCode = 200;
  res.setHeader('Content-Type', MIME_TYPES[ext] || 'application/octet-stream');
  fs.createReadStream(filePath).pipe(res);
  return true;
}

async function main() {
  const dbClient = await openConfiguredDbClient();
  const apiMiddleware = createApiMiddleware(dbClient);
  const port = Number(process.env.PORT || 5174);
  const host = process.env.HOST || '0.0.0.0';

  const server = http.createServer((req, res) => {
    const urlPath = new URL(req.url || '/', 'http://localhost').pathname;

    if (urlPath.startsWith('/api/')) {
      apiMiddleware(req, res, () => {
        res.statusCode = 404;
        res.end(JSON.stringify({ error: 'API route not found.' }));
      });
      return;
    }

    // Serve runtime-uploaded product images from public/uploads
    if (urlPath.startsWith('/uploads/')) {
      const safeRel = path.normalize(urlPath.slice('/uploads/'.length)).replace(/^(\.\.(\/|\\|$))+/, '');
      if (serveStaticFile(res, path.join(UPLOADS_DIR, safeRel))) return;
    }

    const reqRel = urlPath === '/' ? 'index.html' : urlPath.replace(/^\/+/, '');
    const safeDistRel = path.normalize(reqRel).replace(/^(\.\.(\/|\\|$))+/, '');
    const candidate = path.join(DIST_DIR, safeDistRel);
    if (serveStaticFile(res, candidate)) return;

    // Fallback to SPA entry for client-side query/URL visits
    const indexHtml = path.join(DIST_DIR, 'index.html');
    if (serveStaticFile(res, indexHtml)) return;

    res.statusCode = 404;
    res.end('GreenCart build missing. Run `npm run build` first.');
  });

  server.listen(port, host, () => {
    console.log(`GreenCart server (${dbClient.dialect}) running at http://localhost:${port}/`);
  });

  const shutdown = async () => {
    server.close();
    await dbClient.close();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown());
  process.on('SIGTERM', () => void shutdown());
}

main().catch((err) => {
  console.error('Failed to start GreenCart server:', err);
  process.exit(1);
});
