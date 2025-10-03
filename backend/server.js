// Cloudflare DNS Manager Backend
// Express + ES Modules + node-fetch
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import fetch from 'node-fetch';
import path from 'path';
import compression from 'compression';
import { fileURLToPath } from 'url';

import dotenv from 'dotenv';
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8080;
const APP_PASSWORD = process.env.APP_PASSWORD;
const CF_API_TOKEN = process.env.CF_API_TOKEN;
const CF_API_BASE = 'https://api.cloudflare.com/client/v4';

if (!APP_PASSWORD) {
  console.warn('[WARN] APP_PASSWORD is not set. Set it in environment!');
}
if (!CF_API_TOKEN) {
  console.warn('[WARN] CF_API_TOKEN is not set. Set it in environment!');
}

app.use(morgan('dev'));
app.use(cors({
  origin: true,
  credentials: true,
}));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use(compression());

// --- Simple auth middleware for /api/* ---
function requirePassword(req, res, next) {
  const pass = req.headers['x-app-password'] || req.cookies['app_password'];
  if (!APP_PASSWORD) {
    return res.status(500).json({ success: false, error: 'Server not configured with APP_PASSWORD' });
  }
  if (pass !== APP_PASSWORD) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }
  return next();
}

// --- Utility: Forward CF API Request with debug logs ---
async function cfRequest(pathname, options = {}) {
  const url = `${CF_API_BASE}${pathname}`;
  const opts = {
    ...options,
    headers: {
      'Authorization': `Bearer ${CF_API_TOKEN}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  };
  console.log(`[CF] ${opts.method || 'GET'} ${url}`);
  if (opts.body) {
    try { console.log('[CF] Body:', JSON.stringify(JSON.parse(opts.body), null, 2)); } catch {}
  }
  const r = await fetch(url, opts);
  const text = await r.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }
  if (!r.ok || (json && json.success === false)) {
    console.log('[CF] Error Response:', JSON.stringify(json, null, 2));
    return { ok: false, status: r.status, data: json };
  }
  console.log('[CF] OK Response.');
  return { ok: true, status: r.status, data: json };
}

// --- Health (no auth) ---
app.get('/api/health', (req,res)=>{
  res.json({ ok: true, ts: new Date().toISOString() });
});

// --- Zones ---
app.get('/api/zones', requirePassword, async (req, res) => {
  const params = new URLSearchParams({ per_page: '50' });
  const accountId = process.env.CF_ACCOUNT_ID;
  if (accountId) params.set('account.id', accountId);
  const resp = await cfRequest(`/zones?${params.toString()}`);
  if (!resp.ok) return res.status(resp.status).json(resp.data);
  res.json(resp.data);
});

// Allowed DNS types
const ALLOWED_TYPES = new Set(['A','AAAA','CNAME','TXT','MX','NS','PTR']);

// --- List DNS records (filter to allowed types) ---
app.get('/api/zone/:zoneId/dns_records', requirePassword, async (req, res) => {
  const { zoneId } = req.params;
  // We fetch all records across multiple pages; filter to allowed set.
  // To keep simple, fetch first 1000.
  const params = new URLSearchParams({ per_page: '1000' });
  const resp = await cfRequest(`/zones/${zoneId}/dns_records?${params.toString()}`);
  if (!resp.ok) return res.status(resp.status).json(resp.data);
  let results = resp.data.result || [];
  results = results.filter(r => ALLOWED_TYPES.has(r.type));
  res.json({ success: true, result: results });
});

// --- Create DNS record ---
app.post('/api/zone/:zoneId/dns_records', requirePassword, async (req, res) => {
  const { zoneId } = req.params;
  const body = req.body || {};
  if (!ALLOWED_TYPES.has(body.type)) {
    return res.status(400).json({ success:false, error: 'Type not allowed' });
  }
  // Ensure proxy only for A/AAAA/CNAME
  if (!['A','AAAA','CNAME'].includes(body.type)) {
    delete body.proxied;
  }
  const payload = {
    type: body.type,
    name: body.name,
    content: body.content,
    ttl: body.ttl || 1, // 1 = Auto
    proxied: body.proxied,
    comment: body.comment || undefined,
    priority: body.type === 'MX' ? Number(body.priority||0) : undefined
  };
  const resp = await cfRequest(`/zones/${zoneId}/dns_records`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  if (!resp.ok) return res.status(resp.status).json(resp.data);
  res.json(resp.data);
});

// --- Update DNS record ---
app.put('/api/zone/:zoneId/dns_records/:id', requirePassword, async (req, res) => {
  const { zoneId, id } = req.params;
  const body = req.body || {};
  if (!ALLOWED_TYPES.has(body.type)) {
    return res.status(400).json({ success:false, error: 'Type not allowed' });
  }
  if (!['A','AAAA','CNAME'].includes(body.type)) {
    delete body.proxied;
  }
  const payload = {
    type: body.type,
    name: body.name,
    content: body.content,
    ttl: body.ttl || 1,
    proxied: body.proxied,
    comment: body.comment || undefined,
    priority: body.type === 'MX' ? Number(body.priority||0) : undefined
  };
  const resp = await cfRequest(`/zones/${zoneId}/dns_records/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
  if (!resp.ok) return res.status(resp.status).json(resp.data);
  res.json(resp.data);
});

// --- Delete DNS record ---
app.delete('/api/zone/:zoneId/dns_records/:id', requirePassword, async (req, res) => {
  const { zoneId, id } = req.params;
  const resp = await cfRequest(`/zones/${zoneId}/dns_records/${id}`, {
    method: 'DELETE',
  });
  if (!resp.ok) return res.status(resp.status).json(resp.data);
  res.json(resp.data);
});

// --- Serve Frontend (built Vite assets) ---
const distPath = path.join(__dirname, '..', 'frontend', 'dist');
app.use(express.static(distPath));

app.get('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Cloudflare DNS Manager backend running on :${PORT}`);
});
