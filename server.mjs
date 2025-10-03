import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { attachLogging } from './logger.mjs';
import { attachCookieParser, passwordMiddleware } from './auth.mjs';
import { listZones, listRecords, createRecord, updateRecord, deleteRecord } from './cloudflare.mjs';

dotenv.config();
const app = express();
const PORT = process.env.PORT || 8080;

// Middlewares
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
attachCookieParser(app);
attachLogging(app);

// Health (no password)
app.get('/api/health', (req,res)=>{
  res.json({ ok: true, time: new Date().toISOString() });
});

// All API endpoints below require password
app.use('/api', (req,res,next)=>{
  if(req.path === '/health') return next();
  return passwordMiddleware(req,res,next);
});

// Zones
app.get('/api/zones', async (req,res)=>{
  try{
    const zones = await listZones();
    // Map only desired fields
    const mapped = zones.map(z=>({
      id: z.id,
      name: z.name,
      plan: z.plan?.name || 'Unknown',
      type: z.type || 'zone'
    }));
    res.json(mapped);
  }catch(err){
    res.status(502).json(err);
  }
});

// Records (filtered)
app.get('/api/zone/:zoneId/dns_records', async (req,res)=>{
  try{
    const records = await listRecords(req.params.zoneId);
    res.json(records);
  }catch(err){
    res.status(502).json(err);
  }
});

app.post('/api/zone/:zoneId/dns_records', async (req,res)=>{
  try{
    const body = req.body || {};
    const result = await createRecord(req.params.zoneId, body);
    res.json(result);
  }catch(err){
    res.status(502).json(err);
  }
});

app.put('/api/zone/:zoneId/dns_records/:id', async (req,res)=>{
  try{
    const body = req.body || {};
    const result = await updateRecord(req.params.zoneId, req.params.id, body);
    res.json(result);
  }catch(err){
    res.status(502).json(err);
  }
});

app.delete('/api/zone/:zoneId/dns_records/:id', async (req,res)=>{
  try{
    const result = await deleteRecord(req.params.zoneId, req.params.id);
    res.json(result);
  }catch(err){
    res.status(502).json(err);
  }
});

// --- Serve frontend build ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.join(__dirname, 'public');

app.use(express.static(publicDir));
app.get('*', (_req,res)=>{
  res.sendFile(path.join(publicDir, 'index.html'));
});

app.listen(PORT, ()=>{
  console.log(`Cloudflare DNS Manager listening on :${PORT}`);
});
