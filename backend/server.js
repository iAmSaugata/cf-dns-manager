
import 'dotenv/config';
import express from 'express';
import fetch from 'node-fetch';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8080;
const CF_API_TOKEN = process.env.CF_API_TOKEN;
const APP_PASSWORD = process.env.APP_PASSWORD || '';
const ALLOWED_TYPES = ['A','AAAA','CNAME','TXT','MX','NS','PTR'];
const RESTRICTED_NAMES = (process.env.RESTRICTED_NAMES || '').split(',').map(s => s.trim()).filter(Boolean);

if (!CF_API_TOKEN) {
  console.warn('[WARN] CF_API_TOKEN not set. API calls will fail.');
}

app.use(morgan('dev'));
app.use(express.json());
app.use(cookieParser());
app.use(cors({
  origin: true,
  credentials: true
}));

// Static: serve built frontend (placed under ../frontend/dist during container build)
const staticDir = path.join(__dirname, 'public');
app.use(express.static(staticDir));

function isRestrictedRecord(rec) {
  const nameMatch = RESTRICTED_NAMES.some(n => n.toLowerCase() === (rec?.name || '').toLowerCase());
  const commentMatch = (rec?.comment || '').toLowerCase().includes('[locked]');
  return nameMatch || commentMatch;
}

// Auth middleware
function requirePassword(req, res, next) {
  const headerPass = req.header('x-app-password');
  const cookiePass = req.cookies?.app_password;
  const pass = headerPass || cookiePass;
  if (!APP_PASSWORD) {
    return res.status(500).json({ error: 'APP_PASSWORD not configured on server' });
  }
  if (pass !== APP_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  return next();
}

async function cfFetch(endpoint, options = {}) {
  const url = `https://api.cloudflare.com/client/v4${endpoint}`;
  const headers = {
    'Authorization': `Bearer ${CF_API_TOKEN}`,
    'Content-Type': 'application/json'
  };
  const final = { ...options, headers: { ...headers, ...(options.headers || {}) } };
  console.log('[CF] ', options.method || 'GET', endpoint);
  const res = await fetch(url, final);
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json?.success === false) {
    const status = res.status || 500;
    console.error('[CF ERROR]', status, JSON.stringify(json));
    throw { status, json };
  }
  return json;
}

app.get('/api/health', requirePassword, (req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

// List zones
app.get('/api/zones', requirePassword, async (req, res) => {
  try {
    const data = await cfFetch('/zones');
    res.json(data);
  } catch (e) {
    res.status(e.status || 500).json(e.json || { error: 'Unknown error' });
  }
});

// List DNS records (filtered by ALLOWED_TYPES)
app.get('/api/zone/:zoneId/dns_records', requirePassword, async (req, res) => {
  const { zoneId } = req.params;
  try {
    const params = new URLSearchParams();
    params.set('per_page', '5000');
    const data = await cfFetch(`/zones/${zoneId}/dns_records?${params.toString()}`);
    const filtered = data.result.filter(r => ALLOWED_TYPES.includes(r.type));
    res.json({ result: filtered, success: true });
  } catch (e) {
    res.status(e.status || 500).json(e.json || { error: 'Unknown error' });
  }
});

// Create DNS record
app.post('/api/zone/:zoneId/dns_records', requirePassword, async (req, res) => {
  const { zoneId } = req.params;
  const { type, name, content, ttl, proxied, priority, comment } = req.body || {};
  try {
    if (!ALLOWED_TYPES.includes(type)) {
      return res.status(400).json({ error: 'Unsupported type' });
    }
    const payload = { type, name, content, ttl: ttl || 1, comment: comment || undefined };
    // Proxy only for A/AAAA/CNAME
    if (['A','AAAA','CNAME'].includes(type)) {
      payload.proxied = !!proxied;
    }
    if (type === 'MX') {
      payload.priority = typeof priority === 'number' ? priority : 10;
    }
    const data = await cfFetch(`/zones/${zoneId}/dns_records`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    res.json(data);
  } catch (e) {
    res.status(e.status || 500).json(e.json || { error: 'Unknown error' });
  }
});

// Update DNS record
app.put('/api/zone/:zoneId/dns_records/:id', requirePassword, async (req, res) => {
  const { zoneId, id } = req.params;
  const { type, name, content, ttl, proxied, priority, comment } = req.body || {};
  try {
    // first fetch to check restriction
    const existing = await cfFetch(`/zones/${zoneId}/dns_records/${id}`);
    if (isRestrictedRecord(existing.result)) {
      return res.status(403).json({ error: 'Restricted record cannot be edited' });
    }
    if (!ALLOWED_TYPES.includes(type)) {
      return res.status(400).json({ error: 'Unsupported type' });
    }
    const payload = { type, name, content, ttl: ttl || 1, comment: comment || undefined };
    if (['A','AAAA','CNAME'].includes(type)) {
      payload.proxied = !!proxied;
    }
    if (type === 'MX') {
      payload.priority = typeof priority === 'number' ? priority : 10;
    }
    const data = await cfFetch(`/zones/${zoneId}/dns_records/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload)
    });
    res.json(data);
  } catch (e) {
    res.status(e.status || 500).json(e.json || { error: 'Unknown error' });
  }
});

// Delete DNS record
app.delete('/api/zone/:zoneId/dns_records/:id', requirePassword, async (req, res) => {
  const { zoneId, id } = req.params;
  try {
    const existing = await cfFetch(`/zones/${zoneId}/dns_records/${id}`);
    if (isRestrictedRecord(existing.result)) {
      return res.status(403).json({ error: 'Restricted record cannot be deleted' });
    }
    const data = await cfFetch(`/zones/${zoneId}/dns_records/${id}`, { method: 'DELETE' });
    res.json(data);
  } catch (e) {
    res.status(e.status || 500).json(e.json || { error: 'Unknown error' });
  }
});

// Fallback to SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(staticDir, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`[Server] listening on :${PORT}`);
});
