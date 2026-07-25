// ─────────────────────────────────────────────────────────────
// Kichat server — zero external dependencies.
// Serves the frontend and proxies chat to the configured LLM provider,
// keeping your API key on the server (never in the browser).
// ─────────────────────────────────────────────────────────────

import http from 'node:http';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildSystemPrompt } from './src/persona.js';
import { toolsDescriptionForPrompt, avatarDescriptionForPrompt } from './src/tools.js';
import { generateReply } from './src/providers.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, 'public');

// ── Minimal .env loader (no dependency) ──────────────────────
async function loadEnv() {
  try {
    const raw = await fs.readFile(path.join(__dirname, '.env'), 'utf8');
    for (const line of raw.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (!(key in process.env)) process.env[key] = value;
    }
  } catch {
    // No .env file — rely on real environment variables.
  }
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
};

function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(body);
}

async function serveStatic(req, res) {
  let urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (urlPath === '/') urlPath = '/index.html';
  const filePath = path.join(PUBLIC_DIR, path.normalize(urlPath));
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403); res.end('Forbidden'); return;
  }
  try {
    const data = await fs.readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'content-type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  } catch {
    res.writeHead(404); res.end('Not found');
  }
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > 2_000_000) reject(new Error('Body zu groß'));
    });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

async function handleChat(req, res) {
  try {
    const raw = await readBody(req);
    const { history } = JSON.parse(raw || '{}');
    if (!Array.isArray(history) || history.length === 0) {
      return sendJson(res, 400, { error: 'history[] erforderlich' });
    }
    const system = buildSystemPrompt(toolsDescriptionForPrompt(), avatarDescriptionForPrompt());
    const result = await generateReply({ system, history });
    return sendJson(res, 200, result);
  } catch (err) {
    console.error('chat error:', err);
    return sendJson(res, 500, { error: String(err && err.message ? err.message : err) });
  }
}

async function handleConfig(req, res) {
  const provider = (process.env.PROVIDER || 'anthropic').toLowerCase();
  const configured = provider === 'openai'
    ? Boolean(process.env.OPENAI_API_KEY || process.env.OPENAI_BASE_URL)
    : Boolean(process.env.ANTHROPIC_API_KEY);
  return sendJson(res, 200, { provider, configured });
}

async function main() {
  await loadEnv();
  const port = Number(process.env.PORT || 8787);

  const server = http.createServer(async (req, res) => {
    if (req.method === 'POST' && req.url === '/api/chat') return handleChat(req, res);
    if (req.method === 'GET' && req.url === '/api/config') return handleConfig(req, res);
    if (req.method === 'GET') return serveStatic(req, res);
    res.writeHead(405); res.end('Method not allowed');
  });

  server.listen(port, () => {
    const provider = (process.env.PROVIDER || 'anthropic').toLowerCase();
    console.log(`\n  Nikita ist wach 🖤  →  http://localhost:${port}`);
    console.log(`  Provider: ${provider}\n`);
  });
}

main();
