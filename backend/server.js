import express from 'express';
import morgan from 'morgan';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8080;
const APP_PASSWORD = process.env.APP_PASSWORD || '';
const CF_API_TOKEN = process.env.CF_API_TOKEN || '';

if (!CF_API_TOKEN) {
  console.warn('[WARN] CF_API_TOKEN is not set. Cloudflare API calls will fail.');
}

app.use(cors({
  origin: true,
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());
app.use(morgan('dev'));

// Debug logger - logs all requests and body
app.use((req, res, next) => {
  console.log(`[DEBUG] ${req.method} ${req.originalUrl}`);
  if (Object.keys(req.query || {}).length) console.log('[DEBUG] query:', req.query);
  if (Object.keys(req.body || {}).length) console.log('[DEBUG] body:', req.body);
  next();
});

// Auth middleware for all /api/*
app.use('/api', (req, res, next) => {
  const headerPass = req.get('x-app-password');
  const cookiePass = req.cookies?.app_password;
  const password = headerPass || cookiePass;
  if (!APP_PASSWORD) {
    return res.status(500).json({ error: 'Server not configured: APP_PASSWORD missing' });
  }
  if (password !== APP_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
});

// Helpers
const CF_BASE = 'https://api.cloudflare.com/client/v4';
const ALLOWED_TYPES = new Set(['A','AAAA','CNAME','TXT','MX','NS','PTR']);
const PROXY_TYPES = new Set(['A','AAAA','CNAME']);

async function cfFetch(path, options = {}) {
  const url = `${CF_BASE}${path}`;
  const opts = {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${CF_API_TOKEN}`,
      ...(options.headers || {})
    }
  };
  console.log('[DEBUG] Upstream', options.method || 'GET', url);
  const r = await fetch(url, opts);
  const data = await r.json().catch(() => ({}));
  if (!r.ok || data?.success === false) {
    const status = r.status || 500;
    console.log('[DEBUG] Upstream error', status, JSON.stringify(data));
    return { ok: false, status, data };
  }
  return { ok: true, status: r.status, data };
}

// --- Endpoints ---
app.get('/api/health', (req, res) => {
  res.json({ ok: true, service: 'Cloudflare DNS Manager', time: new Date().toISOString() });
});

// Get zones
app.get('/api/zones', async (req, res) => {
  const pageSize = 50;
  let page = 1;
  let all = [];
  while (true) {
    const q = new URLSearchParams({ page: String(page), per_page: String(pageSize) });
    const r = await cfFetch(`/zones?${q.toString()}`);
    if (!r.ok) return res.status(r.status).json(r.data);
    all = all.concat(r.data.result || []);
    const total = r.data.result_info?.total_pages || 1;
    if (page >= total) break;
    page++;
  }
  const mapped = all.map(z => ({
    id: z.id,
    name: z.name,
    plan: z.plan?.name || z.plan?.legacy_id || 'Unknown',
    type: z.type || (z.paused ? 'paused' : 'active')
  }));
  res.json({ result: mapped });
});

// List DNS records (filtered)
app.get('/api/zone/:zoneId/dns_records', async (req, res) => {
  const { zoneId } = req.params;
  const pageSize = 100;
  let page = 1;
  let all = [];
  while (true) {
    const q = new URLSearchParams({ page: String(page), per_page: String(pageSize) });
    const r = await cfFetch(`/zones/${zoneId}/dns_records?${q.toString()}`);
    if (!r.ok) return res.status(r.status).json(r.data);
    all = all.concat(r.data.result || []);
    const total = r.data.result_info?.total_pages || 1;
    if (page >= total) break;
    page++;
  }
  // filter allowed types
  all = all.filter(r => ALLOWED_TYPES.has(r.type));
  const mapped = all.map(r => ({
    id: r.id,
    type: r.type,
    name: r.name,
    content: r.content,
    ttl: r.ttl,
    proxied: r.proxied === true,
    proxiable: r.proxiable === true,
    comment: r.comment || '',
    priority: r.priority ?? null,
    readOnly: Boolean(r.locked || (r.meta && (r.meta.auto_added || r.meta.managed_by_apex_dns)))
  }));
  res.json({ result: mapped });
});

function sanitizeRecordPayload(body) {
  const { type, name, content, ttl, proxied, priority, comment } = body;
  if (!ALLOWED_TYPES.has(type)) {
    return { error: `Type ${type} not allowed` };
  }
  const payload = {
    type,
    name,
    content,
    ttl: ttl ? Number(ttl) : 1, // 1 means "auto" in CF UI; API accepts seconds, but we allow 1 for auto-like
    comment: comment || undefined
  };
  if (PROXY_TYPES.has(type)) {
    payload.proxied = Boolean(proxied);
  } else {
    payload.proxied = false; // enforce DNS-only for unsupported
  }
  if (type === 'MX') {
    payload.priority = (priority === 0 || priority) ? Number(priority) : 10;
  } else {
    delete payload.priority;
  }
  return { payload };
}

// Create
app.post('/api/zone/:zoneId/dns_records', async (req, res) => {
  const { zoneId } = req.params;
  const check = sanitizeRecordPayload(req.body || {});
  if (check.error) return res.status(400).json({ error: check.error });
  const r = await cfFetch(`/zones/${zoneId}/dns_records`, {
    method: 'POST',
    body: JSON.stringify(check.payload)
  });
  if (!r.ok) return res.status(r.status).json(r.data);
  res.json(r.data);
});

// Update
app.put('/api/zone/:zoneId/dns_records/:id', async (req, res) => {
  const { zoneId, id } = req.params;
  const check = sanitizeRecordPayload(req.body || {});
  if (check.error) return res.status(400).json({ error: check.error });
  const r = await cfFetch(`/zones/${zoneId}/dns_records/${id}`, {
    method: 'PUT',
    body: JSON.stringify(check.payload)
  });
  if (!r.ok) return res.status(r.status).json(r.data);
  res.json(r.data);
});

// Delete
app.delete('/api/zone/:zoneId/dns_records/:id', async (req, res) => {
  const { zoneId, id } = req.params;
  const r = await cfFetch(`/zones/${zoneId}/dns_records/${id}`, { method: 'DELETE' });
  if (!r.ok) return res.status(r.status).json(r.data);
  res.json(r.data);
});

// Serve frontend (built assets)
import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const clientDir = path.join(__dirname, '..', 'frontend', 'dist');
app.use(express.static(clientDir));
app.get('*', (req, res) => {
  res.sendFile(path.join(clientDir, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Cloudflare DNS Manager backend running on :${PORT}`);
});
