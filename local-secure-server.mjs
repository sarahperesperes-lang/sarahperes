import http from 'node:http';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = __dirname;
const env = loadEnvFile(path.join(ROOT, '.env.local'));
const HOST = env.HOST || process.env.HOST || '127.0.0.1';
const PORT = Number(env.PORT || process.env.PORT || 8787);
const API_ACCESS_PASSWORD = env.API_ACCESS_PASSWORD || process.env.API_ACCESS_PASSWORD || '324125';
const OPENAI_API_KEY = env.OPENAI_API_KEY || process.env.OPENAI_API_KEY || '';
const OPENAI_BASE_URL = env.OPENAI_BASE_URL || process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
const SITE_OPENAI_MODEL = env.SITE_OPENAI_MODEL || process.env.SITE_OPENAI_MODEL || 'gpt-4.1-mini';
const BOT_OPENAI_MODEL = env.BOT_OPENAI_MODEL || process.env.BOT_OPENAI_MODEL || SITE_OPENAI_MODEL;
const OLLAMA_HOST = env.OLLAMA_HOST || process.env.OLLAMA_HOST || 'http://127.0.0.1:11434';
const SITE_OLLAMA_MODEL = env.SITE_OLLAMA_MODEL || process.env.SITE_OLLAMA_MODEL || 'codellama:13b-code-q4_K_M';
const BOT_OLLAMA_MODEL = env.BOT_OLLAMA_MODEL || process.env.BOT_OLLAMA_MODEL || SITE_OLLAMA_MODEL;
const OLLAMA_FALLBACK_MODEL = env.OLLAMA_FALLBACK_MODEL || process.env.OLLAMA_FALLBACK_MODEL || 'llama3:latest';
const OLLAMA_NUM_CTX = Number(env.OLLAMA_NUM_CTX || process.env.OLLAMA_NUM_CTX || 12288);
const AI_PROVIDER = resolveProvider();
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,HEAD,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-api-password, x-openai-profile'
};
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

function resolveProvider() {
  const configured = String(env.AI_PROVIDER || process.env.AI_PROVIDER || '').trim().toLowerCase();
  if (configured === 'openai' || configured === 'ollama') return configured;
  return OPENAI_API_KEY ? 'openai' : 'ollama';
}

function json(res, status, payload) {
  res.writeHead(status, {
    ...CORS_HEADERS,
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
  if (pathname === '/') pathname = '/index.html';
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
      return serveStatic({ ...req, url: path.posix.join(req.url || '/', 'index.html') }, res);
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

function getModelForProfile(profile) {
  if (AI_PROVIDER === 'openai') {
    return profile === 'bot' ? BOT_OPENAI_MODEL : SITE_OPENAI_MODEL;
  }
  return profile === 'bot' ? BOT_OLLAMA_MODEL : SITE_OLLAMA_MODEL;
}

function getApiPasswordFromRequest(req) {
  const url = new URL(req.url || '/', `http://${HOST}:${PORT}`);
  return String(req.headers['x-api-password'] || url.searchParams.get('password') || '').trim();
}

function isAuthorizedRequest(req) {
  return Boolean(API_ACCESS_PASSWORD) && getApiPasswordFromRequest(req) === API_ACCESS_PASSWORD;
}

function flattenContentText(content) {
  if (!content) return '';
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content.map(flattenContentText).filter(Boolean).join('\n');
  }
  if (typeof content === 'object') {
    if (typeof content.text === 'string') return content.text;
    if (typeof content.output_text === 'string') return content.output_text;
    if (typeof content.input_text === 'string') return content.input_text;
    if (content.type === 'input_image') return '[imagem enviada ao cliente local]';
    if (Array.isArray(content.content)) return flattenContentText(content.content);
  }
  return '';
}

function buildPromptFromRequestBody(body) {
  const messages = [];
  if (typeof body?.input === 'string') {
    messages.push({ role: 'user', text: body.input });
  } else if (Array.isArray(body?.input)) {
    for (const item of body.input) {
      if (!item) continue;
      const role = String(item.role || 'user').toLowerCase();
      const text = flattenContentText(item.content || item.text || item);
      if (text) messages.push({ role, text });
    }
  } else if (Array.isArray(body?.messages)) {
    for (const item of body.messages) {
      if (!item) continue;
      const role = String(item.role || 'user').toLowerCase();
      const text = flattenContentText(item.content || item.text || item);
      if (text) messages.push({ role, text });
    }
  }

  const systemText = messages.filter((item) => item.role === 'system').map((item) => item.text).join('\n\n');
  const userText = messages.filter((item) => item.role !== 'system').map((item) => item.text).join('\n\n');
  const schema = body?.text?.format?.schema;
  const schemaInstruction = schema
    ? [
        'Voce deve responder apenas JSON valido, sem markdown, sem comentarios e sem texto antes ou depois.',
        'Use exatamente esta estrutura JSON como contrato:',
        JSON.stringify(schema, null, 2)
      ].join('\n\n')
    : '';
  return [systemText, schemaInstruction, userText].filter(Boolean).join('\n\n');
}

async function ensureOllamaReachable() {
  const upstream = await fetch(`${OLLAMA_HOST}/api/tags`, { method: 'GET' });
  if (!upstream.ok) {
    throw new Error(`Ollama respondeu ${upstream.status}.`);
  }
  return upstream.json();
}

async function ensureOpenAIReachable() {
  if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY ausente.');
  }
  const upstream = await fetch(`${OPENAI_BASE_URL}/responses`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: SITE_OPENAI_MODEL,
      store: false,
      max_output_tokens: 4,
      input: [
        {
          role: 'user',
          content: [
            { type: 'input_text', text: 'Responda apenas OK.' }
          ]
        }
      ]
    })
  });
  const text = await upstream.text();
  if (!upstream.ok) {
    throw new Error(`OpenAI respondeu ${upstream.status}: ${text}`);
  }
  return JSON.parse(text);
}

async function callOllamaGenerateOnce({ model, prompt }) {
  const upstream = await fetch(`${OLLAMA_HOST}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      prompt,
      stream: false,
      options: {
        temperature: 0.15,
        num_ctx: OLLAMA_NUM_CTX
      }
    })
  });
  const text = await upstream.text();
  if (!upstream.ok) {
    throw new Error(`Ollama respondeu ${upstream.status}: ${text}`);
  }
  const payload = JSON.parse(text);
  return {
    outputText: String(payload.response || '').trim(),
    modelUsed: model,
    fallbackUsed: false,
    requestedModel: model
  };
}

async function callOllamaGenerate({ model, prompt }) {
  try {
    return await callOllamaGenerateOnce({ model, prompt });
  } catch (error) {
    if (model === OLLAMA_FALLBACK_MODEL) {
      throw error;
    }
    const fallback = await callOllamaGenerateOnce({ model: OLLAMA_FALLBACK_MODEL, prompt });
    return {
      ...fallback,
      fallbackUsed: true,
      requestedModel: model
    };
  }
}

async function proxyOpenAI(req, res, forcedProfile = null) {
  if (!isAuthorizedRequest(req)) {
    return json(res, 401, { error: { message: 'Senha da API local invalida ou ausente.' } });
  }
  if (!OPENAI_API_KEY) {
    return json(res, 503, { error: { message: 'OPENAI_API_KEY nao configurada no servidor local.' } });
  }
  const profile = forcedProfile || getProfileFromRequest(req);
  const model = getModelForProfile(profile);
  let rawBody = '';
  try {
    rawBody = await readBody(req);
  } catch (error) {
    return json(res, 413, { error: { message: error.message } });
  }

  let body = {};
  try {
    body = rawBody ? JSON.parse(rawBody) : {};
  } catch {
    return json(res, 400, { error: { message: 'Payload JSON invalido.' } });
  }

  const payload = {
    ...body,
    model,
    store: false
  };

  try {
    const upstream = await fetch(`${OPENAI_BASE_URL}/responses`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    const text = await upstream.text();
    let parsed;
    try {
      parsed = text ? JSON.parse(text) : {};
    } catch {
      parsed = { error: { message: text || `OpenAI respondeu ${upstream.status}.` } };
    }
    if (!upstream.ok) {
      return json(res, upstream.status, parsed);
    }
    res.writeHead(200, {
      ...CORS_HEADERS,
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store'
    });
    res.end(JSON.stringify(parsed));
  } catch (error) {
    json(res, 502, { error: { message: `Falha ao conectar com a OpenAI: ${error.message}` } });
  }
}

async function proxyOllama(req, res, forcedProfile = null) {
  if (!isAuthorizedRequest(req)) {
    return json(res, 401, { error: { message: 'Senha da API local invalida ou ausente.' } });
  }
  const profile = forcedProfile || getProfileFromRequest(req);
  const model = getModelForProfile(profile);
  let rawBody = '';
  try {
    rawBody = await readBody(req);
  } catch (error) {
    return json(res, 413, { error: { message: error.message } });
  }

  try {
    const body = rawBody ? JSON.parse(rawBody) : {};
    const prompt = buildPromptFromRequestBody(body);
    if (!prompt) {
      return json(res, 400, { error: { message: 'Payload de IA vazio ou invalido.' } });
    }
    const generation = await callOllamaGenerate({ model, prompt });
    const outputText = generation.outputText;
    res.writeHead(200, {
      ...CORS_HEADERS,
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store'
    });
    res.end(JSON.stringify({
      id: `ollama_${Date.now()}`,
      object: 'response',
      provider: 'ollama',
      model: generation.modelUsed,
      requested_model: generation.requestedModel,
      fallback_used: Boolean(generation.fallbackUsed),
      fallback_model: generation.fallbackUsed ? generation.modelUsed : null,
      status: 'completed',
      output_text: outputText,
      output: [
        {
          id: `msg_${Date.now()}`,
          type: 'message',
          role: 'assistant',
          content: [
            {
              type: 'output_text',
              text: outputText
            }
          ]
        }
      ]
    }));
  } catch (error) {
    json(res, 502, { error: { message: `Falha ao conectar com o Ollama: ${error.message}` } });
  }
}

async function proxyAI(req, res, forcedProfile = null) {
  if (AI_PROVIDER === 'openai') {
    return proxyOpenAI(req, res, forcedProfile);
  }
  return proxyOllama(req, res, forcedProfile);
}

const server = http.createServer(async (req, res) => {
  if (!req.url) return json(res, 400, { error: { message: 'Request invalido.' } });
  if (req.method === 'OPTIONS') {
    res.writeHead(204, { ...CORS_HEADERS, 'Cache-Control': 'no-store' });
    return res.end();
  }
  if (req.method === 'GET' && req.url.startsWith('/api/health')) {
    if (AI_PROVIDER === 'openai') {
      try {
        await ensureOpenAIReachable();
        return json(res, 200, {
          ok: true,
          host: HOST,
          port: PORT,
          provider: 'openai',
          openaiBaseUrl: OPENAI_BASE_URL,
          siteKeyConfigured: Boolean(OPENAI_API_KEY),
          botKeyConfigured: Boolean(OPENAI_API_KEY),
          keyConfigured: Boolean(OPENAI_API_KEY),
          apiPasswordConfigured: Boolean(API_ACCESS_PASSWORD),
          siteModel: SITE_OPENAI_MODEL,
          botModel: BOT_OPENAI_MODEL,
          fallbackModel: null,
          siteModelAvailable: true,
          botModelAvailable: SITE_OPENAI_MODEL === BOT_OPENAI_MODEL,
          fallbackModelAvailable: false,
          availableModels: [SITE_OPENAI_MODEL, BOT_OPENAI_MODEL].filter(Boolean)
        });
      } catch (error) {
        return json(res, 200, {
          ok: false,
          host: HOST,
          port: PORT,
          provider: 'openai',
          openaiBaseUrl: OPENAI_BASE_URL,
          siteKeyConfigured: Boolean(OPENAI_API_KEY),
          botKeyConfigured: Boolean(OPENAI_API_KEY),
          keyConfigured: Boolean(OPENAI_API_KEY),
          apiPasswordConfigured: Boolean(API_ACCESS_PASSWORD),
          siteModel: SITE_OPENAI_MODEL,
          botModel: BOT_OPENAI_MODEL,
          fallbackModel: null,
          error: error.message
        });
      }
    }
    try {
      const tags = await ensureOllamaReachable();
      const names = Array.isArray(tags?.models) ? tags.models.map((item) => item.name) : [];
      return json(res, 200, {
        ok: true,
        host: HOST,
        port: PORT,
        provider: 'ollama',
        ollamaHost: OLLAMA_HOST,
        siteKeyConfigured: names.includes(SITE_OLLAMA_MODEL) || names.includes(OLLAMA_FALLBACK_MODEL),
        botKeyConfigured: names.includes(BOT_OLLAMA_MODEL) || names.includes(OLLAMA_FALLBACK_MODEL),
        keyConfigured: names.includes(SITE_OLLAMA_MODEL) || names.includes(OLLAMA_FALLBACK_MODEL),
        apiPasswordConfigured: Boolean(API_ACCESS_PASSWORD),
        siteModel: SITE_OLLAMA_MODEL,
        botModel: BOT_OLLAMA_MODEL,
        fallbackModel: OLLAMA_FALLBACK_MODEL,
        siteModelAvailable: names.includes(SITE_OLLAMA_MODEL),
        botModelAvailable: names.includes(BOT_OLLAMA_MODEL),
        fallbackModelAvailable: names.includes(OLLAMA_FALLBACK_MODEL),
        availableModels: names
      });
    } catch (error) {
      return json(res, 200, {
        ok: false,
        host: HOST,
        port: PORT,
        provider: 'ollama',
        ollamaHost: OLLAMA_HOST,
        siteKeyConfigured: false,
        botKeyConfigured: false,
        keyConfigured: false,
        apiPasswordConfigured: Boolean(API_ACCESS_PASSWORD),
        siteModel: SITE_OLLAMA_MODEL,
        botModel: BOT_OLLAMA_MODEL,
        fallbackModel: OLLAMA_FALLBACK_MODEL,
        error: error.message
      });
    }
  }
  if (req.method === 'POST' && req.url === '/api/openai/responses') {
    return proxyAI(req, res, 'site');
  }
  if (req.method === 'POST' && req.url === '/api/bot/responses') {
    return proxyAI(req, res, 'bot');
  }
  if (req.method === 'GET' || req.method === 'HEAD') {
    return serveStatic(req, res);
  }
  return json(res, 405, { error: { message: 'Metodo nao permitido.' } });
});

server.listen(PORT, HOST, () => {
  console.log(`Servidor local seguro ativo em http://${HOST}:${PORT}/`);
  console.log(`Provider ativo: ${AI_PROVIDER}`);
  if (AI_PROVIDER === 'openai') {
    console.log(`OpenAI: ${OPENAI_BASE_URL}`);
    console.log(`Modelo do site: ${SITE_OPENAI_MODEL} | Modelo do bot: ${BOT_OPENAI_MODEL}`);
  } else {
    console.log(`Ollama: ${OLLAMA_HOST}`);
    console.log(`Modelo do site: ${SITE_OLLAMA_MODEL} | Modelo do bot: ${BOT_OLLAMA_MODEL} | Fallback: ${OLLAMA_FALLBACK_MODEL}`);
  }
  console.log(`Senha da API local configurada: ${Boolean(API_ACCESS_PASSWORD)}`);
  console.log('A IA local usa o backend seguro e nao depende de chave no navegador.');
});
