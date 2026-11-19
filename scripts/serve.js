// Tiny static file server for the examples (ES modules don't load from file://),
// plus /events, a Server-Sent Events stream of made-up activity for the live
// example (see examples/feed.js).
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { createFeed } from '../examples/feed.js';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const port = Number(process.env.PORT) || 3000;
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
};

// ---- /events -----------------------------------------------------------------
//
// GET /events?client=<id>&rate=<events a second, 0–50; 0 pauses>
//
// Sends `add` events, whose data is an event, and `update` events, whose data
// is { id, patch }. Each client id has its own feed, which outlives its
// connection by KEEP_MS: the page reconnects with the same id to change the
// rate, and the browser does to recover from a dropped connection. A feed
// sends its history only when it starts, and what it sends between
// connections is queued and sent on the next one, so running events still
// get their ends.

const KEEP_MS = 60_000;
const PING_MS = 15_000; // a comment now and then keeps proxies from closing the stream
const clients = new Map(); // id → { feed, res, queue, idle }

function events(req, res, params) {
  const id = params.get('client') || randomUUID();
  const asked = Number(params.get('rate') ?? 2);
  const rate = Number.isFinite(asked) ? Math.min(Math.max(asked, 0), 50) : 2;
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });

  let client = clients.get(id);
  if (client) {
    clearTimeout(client.idle);
    client.res?.end(); // an older connection still open
    client.res = res;
    for (const message of client.queue.splice(0)) res.write(message);
    client.feed.setRate(rate);
  } else {
    client = { res, queue: [], idle: 0 };
    clients.set(id, client);
    const c = client;
    c.feed = createFeed((op, data) => {
      const message = `event: ${op}\ndata: ${JSON.stringify(data)}\n\n`;
      if (c.res) c.res.write(message);
      else c.queue.push(message);
    }, { rate });
  }

  const ping = setInterval(() => res.write(': ping\n\n'), PING_MS);
  req.on('close', () => {
    clearInterval(ping);
    if (client.res !== res) return; // replaced by a newer connection
    client.res = null;
    client.idle = setTimeout(() => {
      client.feed.stop();
      clients.delete(id);
    }, KEEP_MS);
  });
}

// ---- Static files ------------------------------------------------------------

createServer(async (req, res) => {
  try {
    const { pathname, searchParams } = new URL(req.url, 'http://localhost');
    if (pathname === '/events') return events(req, res, searchParams);
    if (pathname === '/') return res.writeHead(302, { Location: '/examples/' }).end();
    let file = join(root, decodeURIComponent(pathname));
    if (!file.startsWith(root + sep)) return res.writeHead(403).end();
    if (pathname.endsWith('/')) file = join(file, 'index.html');
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': types[extname(file)] ?? 'application/octet-stream' }).end(body);
  } catch {
    res.writeHead(404).end('Not found');
  }
}).listen(port, () => console.log(`Chroniko example: http://localhost:${port}/`));
