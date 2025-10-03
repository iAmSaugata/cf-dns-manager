import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import fetch from 'node-fetch';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8080;
const APP_PASSWORD = process.env.APP_PASSWORD || '';
const CF_API_TOKEN = process.env.CF_API_TOKEN || '';

if (!APP_PASSWORD || !CF_API_TOKEN) {
  console.warn('[WARN] APP_PASSWORD or CF_API_TOKEN not set. The app will not function without them.');
}

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(morgan('dev'));

// Simple cookie parser (no dependency)
function parseCookies(cookieHeader) {
  const out = {};
  if (!cookieHeader) return out;
  cookieHeader.split(';').forEach(kv => {
    const idx = kv.indexOf('=');
    if (idx > -1) {
      const k = kv.slice(0, idx).trim();
      const v = decodeURIComponent(kv.slice(idx+1).trim());
      out[k] = v;
    }
  });
  return out;
}

// Auth middleware for /api/*
app.use('/api', (req, res, next) => {
  const headerPass = req.headers['x-app-password'];
  const cookies = parseCookies(req.headers.cookie || '');
  const cookiePass = cookies['app_password'];
  const pass = headerPass || cookiePass;
  if (!APP_PASSWORD) {
    return res.status(500).json({ error: 'Server missing APP_PASSWORD' });
  }
  if (pass !== APP_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
});

// Debug logger for all API calls
app.use('/api', (req, _res, next) => {
  console.debug(`[DEBUG] ${req.method} ${req.originalUrl} body=`, req.body || null);
  next();
});

// Helper to call Cloudflare API
const CF_BASE = 'https://api.cloudflare.com/client/v4';

async function cfFetch(pathname, options = {}) {
  const url = `${CF_BASE}${pathname}`;
  const opts = {
    ...options,
    headers: {
      'Authorization': `Bearer ${CF_API_TOKEN}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  };
  console.debug('[DEBUG] Upstream:', opts.method || 'GET', url, options.body ? `body=${options.body}` : '');
  const resp = await fetch(url, opts);
  const text = await resp.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }
  if (!resp.ok || data?.success === false) {
    return { ok: false, status: resp.status, data };
  }
  return { ok: true, status: resp.status, data };
}

// Health
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'Cloudflare DNS Manager', time: new Date().toISOString() });
});

// Zones
app.get('/api/zones', async (_req, res) => {
  const r = await cfFetch('/zones');
  if (!r.ok) return res.status(r.status).json(r.data);
  res.json(r.data);
});

// List DNS records (filter to allowed types only)
const ALLOWED_TYPES = new Set(['A','AAAA','CNAME','TXT','MX','NS','PTR']);
app.get('/api/zone/:zoneId/dns_records', async (req, res) => {
  const { zoneId } = req.params;
  const searchParams = new URLSearchParams(req.query);
  const r = await cfFetch(`/zones/${zoneId}/dns_records?${searchParams.toString()}`);
  if (!r.ok) return res.status(r.status).json(r.data);
  const filtered = r.data.result.filter(rec => ALLOWED_TYPES.has(rec.type));
  res.json({ ...r.data, result: filtered });
});

// Create DNS record
app.post('/api/zone/:zoneId/dns_records', async (req, res) => {
  const { zoneId } = req.params;
  const body = JSON.stringify(req.body || {});
  const r = await cfFetch(`/zones/${zoneId}/dns_records`, { method: 'POST', body });
  if (!r.ok) return res.status(r.status).json(r.data);
  res.json(r.data);
});

// Update DNS record
app.put('/api/zone/:zoneId/dns_records/:id', async (req, res) => {
  const { zoneId, id } = req.params;
  const body = JSON.stringify(req.body || {});
  const r = await cfFetch(`/zones/${zoneId}/dns_records/${id}`, { method: 'PUT', body });
  if (!r.ok) return res.status(r.status).json(r.data);
  res.json(r.data);
});

// Delete DNS record
app.delete('/api/zone/:zoneId/dns_records/:id', async (req, res) => {
  const { zoneId, id } = req.params;
  const r = await cfFetch(`/zones/${zoneId}/dns_records/${id}`, { method: 'DELETE' });
  if (!r.ok) return res.status(r.status).json(r.data);
  res.json(r.data);
});

// Serve static frontend
app.use(express.static(path.join(__dirname, 'public')));
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Cloudflare DNS Manager running on :${PORT}`);
});
