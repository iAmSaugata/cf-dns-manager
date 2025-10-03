import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import fetch from 'node-fetch';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8080;
const APP_PASSWORD = process.env.APP_PASSWORD || '';
const CF_API_TOKEN = process.env.CF_API_TOKEN || '';

// Basic safety checks
if (!APP_PASSWORD) {
  console.warn('[WARN] APP_PASSWORD is not set. All API calls will fail auth.');
}
if (!CF_API_TOKEN) {
  console.warn('[WARN] CF_API_TOKEN is not set. Upstream Cloudflare calls will fail.');
}

// Middleware
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());
app.use(morgan('dev'));

// Serve static frontend (built into /public)
const publicDir = path.join(__dirname, 'public');
app.use(express.static(publicDir));

// Auth middleware for /api/*
function requirePassword(req, res, next) {
  const headerPass = req.header('x-app-password');
  const cookiePass = req.cookies?.app_password;
  const provided = headerPass || cookiePass;
  if (!APP_PASSWORD) return res.status(500).json({ error: 'Server not configured: APP_PASSWORD missing' });
  if (provided !== APP_PASSWORD) return res.status(401).json({ error: 'Unauthorized' });
  next();
}

// Helper: Cloudflare fetch with debug
const CF_BASE = 'https://api.cloudflare.com/client/v4';
async function cfFetch(endpoint, options = {}) {
  const url = `${CF_BASE}${endpoint}`;
  const final = {
    headers: {
      'Authorization': `Bearer ${CF_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    ...options,
  };
  console.log('[CF]', options.method || 'GET', url);
  const resp = await fetch(url, final);
  const json = await resp.json().catch(() => ({}));
  if (!resp.ok || json?.success === false) {
    console.log('[CF][ERR]', json);
    return { ok: false, status: resp.status, data: json };
  }
  return { ok: true, status: resp.status, data: json };
}

// Routes
app.get('/api/health', requirePassword, (req, res) => {
  res.json({ ok: true, ts: new Date().toISOString() });
});

// Login helper to set cookie (optional for clients)
app.post('/api/login', (req, res) => {
  const { password } = req.body || {};
  if (!APP_PASSWORD) return res.status(500).json({ error: 'APP_PASSWORD not configured' });
  if (password !== APP_PASSWORD) return res.status(401).json({ error: 'Invalid password' });
  res.cookie('app_password', APP_PASSWORD, { httpOnly: false, sameSite: 'Lax' });
  res.json({ ok: true });
});

// Zones
app.get('/api/zones', requirePassword, async (req, res) => {
  const r = await cfFetch('/zones?per_page=50');
  if (!r.ok) return res.status(r.status).json(r.data);
  const zones = (r.data.result || []).map(z => ({
    id: z.id,
    name: z.name,
    plan: z.plan?.name || 'Free',
    type: z.type || 'full',
  }));
  res.json({ ok: true, zones });
});

// List DNS records (allowed types)
const ALLOWED_TYPES = ['A', 'AAAA', 'CNAME', 'TXT', 'MX', 'NS', 'PTR'];
app.get('/api/zone/:zoneId/dns_records', requirePassword, async (req, res) => {
  const { zoneId } = req.params;
  let page = 1;
  const per_page = 100;
  let all = [];
  while (true) {
    const r = await cfFetch(`/zones/${zoneId}/dns_records?page=${page}&per_page=${per_page}`);
    if (!r.ok) return res.status(r.status).json(r.data);
    const result = r.data.result || [];
    all = all.concat(result);
    if (result.length < per_page) break;
    page++;
  }
  const filtered = all.filter(r => ALLOWED_TYPES.includes(r.type));
  const mapped = filtered.map(r => ({
    id: r.id,
    type: r.type,
    name: r.name,
    content: r.content,
    ttl: r.ttl,
    proxied: !!r.proxied,
    proxiable: !!r.proxiable,
    priority: r.priority ?? null,
    comment: r.comment || '',
    locked: !!r.locked,
    meta: r.meta || {},
    readOnly: !!r.locked || !!r.meta?.managed_by_apps || !!r.meta?.managed_by_argo_tunnel
  }));
  res.json({ ok: true, records: mapped });
});

// Create DNS record
app.post('/api/zone/:zoneId/dns_records', requirePassword, async (req, res) => {
  const { zoneId } = req.params;
  let { type, name, content, ttl, proxied, priority, comment } = req.body || {};

  if (!ALLOWED_TYPES.includes(type)) return res.status(400).json({ error: 'Unsupported type' });
  if (!name || !content) return res.status(400).json({ error: 'name and content are required' });

  // Enforce proxy only for A/AAAA/CNAME
  if (!['A', 'AAAA', 'CNAME'].includes(type)) proxied = false;

  const payload = { type, name, content, ttl: ttl || 1, proxied, comment: comment || undefined };
  if (type === 'MX') payload.priority = Number.isInteger(priority) ? priority : 10;

  const r = await cfFetch(`/zones/${zoneId}/dns_records`, { method: 'POST', body: JSON.stringify(payload) });
  if (!r.ok) return res.status(r.status).json(r.data);
  res.json({ ok: true, result: r.data.result });
});

// Update DNS record
app.put('/api/zone/:zoneId/dns_records/:id', requirePassword, async (req, res) => {
  const { zoneId, id } = req.params;
  const input = req.body || {};

  // Fetch current record to preserve fields
  const current = await cfFetch(`/zones/${zoneId}/dns_records/${id}`);
  if (!current.ok) return res.status(current.status).json(current.data);
  const cur = current.data.result;

  if (!ALLOWED_TYPES.includes(cur.type)) return res.status(400).json({ error: 'Unsupported type' });

  const type = cur.type;
  const payload = {
    type,
    name: input.name ?? cur.name,
    content: input.content ?? cur.content,
    ttl: input.ttl ?? cur.ttl,
    comment: (Object.prototype.hasOwnProperty.call(input, 'comment') ? input.comment : undefined) // placeholder to avoid accidental comment removal
  };

  // Maintain/allow proxy only for A/AAAA/CNAME
  if (['A', 'AAAA', 'CNAME'].includes(type)) {
    payload.proxied = (typeof input.proxied === 'boolean') ? input.proxied : cur.proxied;
  } else {
    payload.proxied = false;
  }

  // MX priority
  if (type === 'MX') {
    payload.priority = (typeof input.priority === 'number') ? input.priority : cur.priority;
  }

  // Cloudflare requires omitting undefined; rebuild without undefined
  const cleanPayload = Object.fromEntries(Object.entries(payload).filter(([,v]) => v !== undefined));

  const r = await cfFetch(`/zones/${zoneId}/dns_records/${id}`, { method: 'PUT', body: JSON.stringify(cleanPayload) });
  if (!r.ok) return res.status(r.status).json(r.data);
  res.json({ ok: true, result: r.data.result });
});

// Delete DNS record
app.delete('/api/zone/:zoneId/dns_records/:id', requirePassword, async (req, res) => {
  const { zoneId, id } = req.params;
  const r = await cfFetch(`/zones/${zoneId}/dns_records/${id}`, { method: 'DELETE' });
  if (!r.ok) return res.status(r.status).json(r.data);
  res.json({ ok: true, result: r.data.result });
});

// Fallback to SPA (index.html) for frontend routes
app.get('*', (req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`[Cloudflare DNS Manager] Listening on :${PORT}`);
});
