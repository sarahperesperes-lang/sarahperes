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
const API_ACCESS_PASSWORD = process.env.API_ACCESS_PASSWORD || env.API_ACCESS_PASSWORD || '324125';
const SITE_OPENAI_API_KEY =
  process.env.SITE_OPENAI_API_KEY ||
  env.SITE_OPENAI_API_KEY ||
  process.env.OPENAI_API_KEY ||
  env.OPENAI_API_KEY ||
  process.env.ADMKEY ||
  env.ADMKEY ||
  '';
const BOT_OPENAI_API_KEY =
  process.env.BOT_OPENAI_API_KEY ||
  env.BOT_OPENAI_API_KEY ||
  process.env.OPENAI_BOT_API_KEY ||
  env.OPENAI_BOT_API_KEY ||
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

function getProfileFromRequest(req) {
  const url = new URL(req.url || '/', `http://${HOST}:${PORT}`);
  const headerProfile = String(req.headers['x-openai-profile'] || '').trim().toLowerCase();
  if (headerProfile === 'bot' || headerProfile === 'site') return headerProfile;
  const queryProfile = String(url.searchParams.get('profile') || '').trim().toLowerCase();
  if (queryProfile === 'bot' || queryProfile === 'site') return queryProfile;
  return 'site';
}

function getKeyForProfile(profile) {
  return profile === 'bot' ? BOT_OPENAI_API_KEY : SITE_OPENAI_API_KEY;
}

function getApiPasswordFromRequest(req) {
  const url = new URL(req.url || '/', `http://${HOST}:${PORT}`);
  return String(req.headers['x-api-password'] || url.searchParams.get('password') || '').trim();
}

function isAuthorizedRequest(req) {
  return Boolean(API_ACCESS_PASSWORD) && getApiPasswordFromRequest(req) === API_ACCESS_PASSWORD;
}

async function proxyOpenAI(req, res, forcedProfile = null) {
  if (!isAuthorizedRequest(req)) {
    return json(res, 401, { error: { message: 'Senha da API local invalida ou ausente.' } });
  }
  const profile = forcedProfile || getProfileFromRequest(req);
  const primaryKey = getKeyForProfile(profile);
  const fallbackKey = profile === 'site' && BOT_OPENAI_API_KEY ? BOT_OPENAI_API_KEY : '';
  if (!primaryKey && !fallbackKey) {
    return json(res, 503, {
      error: {
        message:
          profile === 'bot'
            ? 'BOT_OPENAI_API_KEY nao configurada no servidor local.'
            : 'SITE_OPENAI_API_KEY/OPENAI_API_KEY nao configurada no servidor local.'
      }
    });
  }
  let rawBody = '';
  try {
    rawBody = await readBody(req);
  } catch (error) {
    return json(res, 413, { error: { message: error.message } });
  }

  try {
    const attemptRequest = async (apiKey) =>
      fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: rawBody
      });

    let upstream = primaryKey ? await attemptRequest(primaryKey) : null;
    if (upstream && (upstream.status === 401 || upstream.status === 403) && fallbackKey && fallbackKey !== primaryKey) {
      upstream = await attemptRequest(fallbackKey);
    } else if (!upstream && fallbackKey) {
      upstream = await attemptRequest(fallbackKey);
    }

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
    return json(res, 200, {
      ok: true,
      host: HOST,
      port: PORT,
      keyConfigured: Boolean(SITE_OPENAI_API_KEY),
      siteKeyConfigured: Boolean(SITE_OPENAI_API_KEY),
      botKeyConfigured: Boolean(BOT_OPENAI_API_KEY),
      apiPasswordConfigured: Boolean(API_ACCESS_PASSWORD)
    });
  }
  if (req.method === 'POST' && req.url === '/api/openai/responses') {
    return proxyOpenAI(req, res, 'site');
  }
  if (req.method === 'POST' && req.url === '/api/bot/responses') {
    return proxyOpenAI(req, res, 'bot');
  }
  if (req.method === 'GET' || req.method === 'HEAD') {
    return serveStatic(req, res);
  }
  return json(res, 405, { error: { message: 'Metodo nao permitido.' } });
});

server.listen(PORT, HOST, () => {
  console.log(`Servidor local seguro ativo em http://${HOST}:${PORT}/`);
  console.log(`Perfil site configurado: ${Boolean(SITE_OPENAI_API_KEY)} | Perfil bot configurado: ${Boolean(BOT_OPENAI_API_KEY)}`);
  console.log(`Senha da API local configurada: ${Boolean(API_ACCESS_PASSWORD)}`);
  console.log('As chaves da OpenAI ficam no backend local e nao sao enviadas para o navegador.');
});
