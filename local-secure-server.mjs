import http from 'node:http';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = __dirname;
const env = loadEnvFile(path.join(ROOT, '.env.local'));
const HOST = process.env.HOST || env.HOST || '127.0.0.1';
const PORT = Number(process.env.PORT || env.PORT || 8787);
const OPENAI_API_KEY =
  process.env.OPENAI_API_KEY ||
  env.OPENAI_API_KEY ||
  process.env.ADMKEY ||
  env.ADMKEY ||
  process.env.LUCASJOGA ||
  env.LUCASJOGA ||
  '';
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.pdf': 'application/pdf',
  '.txt': 'text/plain; charset=utf-8',
  '.ico': 'image/x-icon'
};

function loadEnvFile(filePath) {
  try {
    const content = fsSync.readFileSync(filePath, 'utf8');
    const parsed = {};
    content.split(/\r?\n/).forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      const eq = trimmed.indexOf('=');
      if (eq <= 0) return;
      const key = trimmed.slice(0, eq).trim();
      const rawValue = trimmed.slice(eq + 1).trim();
      parsed[key] = rawValue.replace(/^"|"$/g, '');
    });
    return parsed;
  } catch {
    return {};
  }
}

function json(res, status, payload) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  res.end(JSON.stringify(payload));
}

async function readBody(req) {
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > 5 * 1024 * 1024) {
      throw new Error('Payload muito grande.');
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

function resolveFilePath(requestPath) {
  let pathname = decodeURIComponent(requestPath.split('?')[0]);
  if (pathname === '/') pathname = '/hipofise-workspace.html';
  const normalized = path.normalize(pathname).replace(/^([.][.][/\\])+/, '');
  const absolute = path.join(ROOT, normalized);
  if (!absolute.startsWith(ROOT)) return null;
  return absolute;
}

async function serveStatic(req, res) {
  const filePath = resolveFilePath(req.url || '/');
  if (!filePath) return json(res, 400, { error: { message: 'Caminho invalido.' } });
  try {
    const stat = await fs.stat(filePath);
    if (stat.isDirectory()) {
      return serveStatic({ ...req, url: path.posix.join(req.url || '/', 'hipofise-workspace.html') }, res);
    }
    const ext = path.extname(filePath).toLowerCase();
    const mime = MIME_TYPES[ext] || 'application/octet-stream';
    const buffer = await fs.readFile(filePath);
    res.writeHead(200, {
      'Content-Type': mime,
      'Cache-Control': ext === '.html' ? 'no-store' : 'public, max-age=3600'
    });
    if (req.method === 'HEAD') return res.end();
    res.end(buffer);
  } catch {
    json(res, 404, { error: { message: 'Arquivo nao encontrado.' } });
  }
}

async function proxyOpenAI(req, res) {
  if (!OPENAI_API_KEY) {
    return json(res, 503, { error: { message: 'OPENAI_API_KEY nao configurada no servidor local.' } });
  }
  let rawBody = '';
  try {
    rawBody = await readBody(req);
  } catch (error) {
    return json(res, 413, { error: { message: error.message } });
  }

  try {
    const upstream = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: rawBody
    });
    const text = await upstream.text();
    res.writeHead(upstream.status, {
      'Content-Type': upstream.headers.get('content-type') || 'application/json; charset=utf-8',
      'Cache-Control': 'no-store'
    });
    res.end(text);
  } catch (error) {
    json(res, 502, { error: { message: `Falha ao conectar com a OpenAI: ${error.message}` } });
  }
}

const server = http.createServer(async (req, res) => {
  if (!req.url) return json(res, 400, { error: { message: 'Request invalido.' } });
  if (req.method === 'OPTIONS') {
    res.writeHead(204, { 'Cache-Control': 'no-store' });
    return res.end();
  }
  if (req.method === 'GET' && req.url.startsWith('/api/health')) {
    return json(res, 200, { ok: true, host: HOST, port: PORT, keyConfigured: Boolean(OPENAI_API_KEY) });
  }
  if (req.method === 'POST' && req.url === '/api/openai/responses') {
    return proxyOpenAI(req, res);
  }
  if (req.method === 'GET' || req.method === 'HEAD') {
    return serveStatic(req, res);
  }
  return json(res, 405, { error: { message: 'Metodo nao permitido.' } });
});

server.listen(PORT, HOST, () => {
  console.log(`Servidor local seguro ativo em http://${HOST}:${PORT}/hipofise-workspace.html`);
  console.log('A chave da OpenAI esta no backend local e nao e enviada para o navegador.');
});
