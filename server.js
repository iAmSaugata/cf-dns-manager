import express from 'express';
import morgan from 'morgan';
import cors from 'cors';
import fetch from 'node-fetch';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const APP_PASSWORD = process.env.APP_PASSWORD || 'change-me';
const CF_API_TOKEN = process.env.CF_API_TOKEN || '';
const PORT = process.env.PORT || 5000;

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(morgan('tiny'));

// Simple password check middleware for all /api routes
app.use('/api', (req, res, next) => {
  const pass = req.headers['x-app-password'] || req.get('x-app-password') || req.query.app_password;
  if (!pass || pass !== APP_PASSWORD) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }
  next();
});

function cfHeaders() {
  return {
    'Authorization': `Bearer ${CF_API_TOKEN}`,
    'Content-Type': 'application/json'
  };
}

// Health
app.get('/api/health', (req, res) => {
  res.json({ ok: true, version: '2.8.0' });
});

// Zones
app.get('/api/zones', async (req, res) => {
  try {
    const resp = await fetch('https://api.cloudflare.com/client/v4/zones?per_page=50', {
      headers: cfHeaders()
    });
    const data = await resp.json();
    if (!data.success) return res.status(400).json(data);
    // Keep only what we use
    const zones = data.result.map(z => ({
      id: z.id,
      name: z.name,
      type: z.type || (z.plan && z.plan.name) || 'unknown',
      status: z.status
    }));
    res.json({ success: true, result: zones });
  } catch (e) {
    res.status(500).json({ success:false, error: e.message });
  }
});

// List DNS records
app.get('/api/zones/:zoneId/records', async (req, res) => {
  const { zoneId } = req.params;
  const search = req.query.search || '';
  const url = new URL(`https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records`);
  url.searchParams.set('per_page', '200');
  if (search) url.searchParams.set('name', search);
  try {
    const resp = await fetch(url, { headers: cfHeaders() });
    const data = await resp.json();
    if (!data.success) return res.status(400).json(data);
    res.json({ success:true, result: data.result });
  } catch (e) {
    res.status(500).json({ success:false, error: e.message });
  }
});

// Create record
app.post('/api/zones/:zoneId/records', async (req,res) => {
  const { zoneId } = req.params;
  const body = req.body || {};
  try {
    const resp = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records`, {
      method:'POST',
      headers: cfHeaders(),
      body: JSON.stringify(body)
    });
    const data = await resp.json();
    if (!data.success) return res.status(400).json(data);
    res.json({ success:true, result:data.result });
  } catch (e) {
    res.status(500).json({ success:false, error:e.message });
  }
});

// Update record (generic patch)
app.patch('/api/zones/:zoneId/records/:recordId', async (req,res) => {
  const { zoneId, recordId } = req.params;
  try {
    const resp = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records/${recordId}`, {
      method:'PATCH',
      headers: cfHeaders(),
      body: JSON.stringify(req.body || {})
    });
    const data = await resp.json();
    if (!data.success) return res.status(400).json(data);
    res.json({ success:true, result:data.result });
  } catch (e) {
    res.status(500).json({ success:false, error:e.message });
  }
});

// Bulk delete by ids
app.post('/api/zones/:zoneId/records/bulk-delete', async (req,res) => {
  const { zoneId } = req.params;
  const { ids } = req.body || {};
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ success:false, error:'No ids provided' });
  }
  try {
    const results = [];
    for (const id of ids) {
      const resp = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records/${id}`, {
        method:'DELETE',
        headers: cfHeaders()
      });
      const d = await resp.json();
      results.push({ id, success: d.success });
    }
    res.json({ success:true, result: results });
  } catch (e) {
    res.status(500).json({ success:false, error:e.message });
  }
});

// Toggle proxy (ensures only allowed types can be proxied)
const PROXYABLE = new Set(['A','AAAA','CNAME']);
app.patch('/api/zones/:zoneId/records/:recordId/proxy', async (req,res) => {
  const { zoneId, recordId } = req.params;
  const { proxied } = req.body || {};
  try {
    // read record first
    const getResp = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records/${recordId}`, { headers: cfHeaders() });
    const getData = await getResp.json();
    if (!getData.success) return res.status(400).json(getData);
    const rec = getData.result;
    const canProxy = PROXYABLE.has(rec.type);
    const payload = { proxied: canProxy ? !!proxied : false };
    const patch = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records/${recordId}`, {
      method:'PATCH', headers: cfHeaders(), body: JSON.stringify(payload)
    });
    const patchData = await patch.json();
    if (!patchData.success) return res.status(400).json(patchData);
    res.json({ success:true, result: patchData.result, proxyLocked: !canProxy });
  } catch (e) {
    res.status(500).json({ success:false, error:e.message });
  }
});

// Rename record (guard: source must exist; do not create if not found)
app.patch('/api/zones/:zoneId/records/rename', async (req,res) => {
  const { zoneId } = req.params;
  const { fromName, toName, type } = req.body || {};
  if (!fromName || !toName || !type) return res.status(400).json({ success:false, error:'fromName, toName, type required'});
  try {
    // find source by exact name & type
    const url = new URL(`https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records`);
    url.searchParams.set('name', fromName);
    url.searchParams.set('type', type);
    const r = await fetch(url, { headers: cfHeaders() });
    const d = await r.json();
    if (!d.success) return res.status(400).json(d);
    const match = (d.result || []).find(x => x.name.toLowerCase() === fromName.toLowerCase() && x.type === type);
    if (!match) return res.status(404).json({ success:false, error:'Source record does not exist' });
    // patch name only
    const patch = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records/${match.id}`, {
      method: 'PATCH',
      headers: cfHeaders(),
      body: JSON.stringify({ name: toName })
    });
    const pd = await patch.json();
    if (!pd.success) return res.status(400).json(pd);
    res.json({ success:true, result: pd.result });
  } catch (e) {
    res.status(500).json({ success:false, error:e.message });
  }
});

// Serve frontend
app.use(express.static(path.join(__dirname, 'dist')));
app.get('*', (req,res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`CF DNS Manager running on http://0.0.0.0:${PORT}`);
});
