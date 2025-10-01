import express from "express";
import cors from "cors";
import morgan from "morgan";
import fetch from "node-fetch";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const PORT = process.env.PORT || 5000;
console.log("=== CF DNS Manager starting ===");
console.log("PORT:", PORT, "APP_PASSWORD set:", Boolean(process.env.APP_PASSWORD), "CF_API_TOKEN set:", Boolean(process.env.CF_API_TOKEN));
app.set('trust proxy', true);
app.disable('etag');
app.use((req,res,next)=>{ res.set('Cache-Control','no-store'); next(); });
app.use(express.json());
app.use(cors());
app.use(morgan(':date[iso] :remote-addr ":method :url" :status :res[content-length] - :response-time ms'));
const CF_BASE = "https://api.cloudflare.com/client/v4";
function parseCookies(h){const o={};if(!h)return o;h.split(';').forEach(k=>{const i=k.indexOf('=');if(i>-1)o[k[:i].trim()]=decodeURIComponent(k[i+1:])});return o}
function appAuth(req,res,next){
  const hdr = req.headers['x-app-password'];
  const ck = (req.headers.cookie||'').split('app_password=').pop().split(';')[0] || '';
  const provided = hdr || (ck||''); const expected = process.env.APP_PASSWORD || '';
  if(!provided) return res.status(401).json({success:false,error:'Unauthorized (no password)'});
  if(provided!==expected) return res.status(401).json({success:false,error:'Unauthorized (bad password)'});
  next();
}
app.use('/api', appAuth);
app.get('/api/health', (req,res)=> res.json({ok:true}));
async function cfFetch(path, options={}){
  const url = `${CF_BASE}${path}`; console.log('[CF]', options.method||'GET', url);
  const res = await fetch(url, { ...options, headers:{ 'Content-Type':'application/json', 'Authorization':`Bearer ${process.env.CF_API_TOKEN}`, ...(options.headers||{}) } });
  let data={}; try{ data=await res.json(); }catch{}
  if(!res.ok || data?.success===false){ const err = new Error(data?.errors?.[0]?.message || `Cloudflare API error (${res.status})`); err.status=res.status; err.cf=data; throw err; }
  return data;
}
app.get('/api/zones', async (req,res,next)=>{ try{ res.json(await cfFetch('/zones?per_page=200&page=1')); }catch(e){ next(e);} });
app.get('/api/zone/:zoneId/dns_records', async (req,res,next)=>{
  try{const {zoneId}=req.params; const {page=1,per_page=200,type='',name='',content=''}=req.query;
    const q=new URLSearchParams({page,per_page}); if(type)q.set('type',type); if(name)q.set('name',name); if(content)q.set('content',content);
    res.json(await cfFetch(`/zones/${zoneId}/dns_records?${q.toString()}`));}catch(e){next(e);} });
app.post('/api/zone/:zoneId/dns_records', async (req,res,next)=>{ try{ const {zoneId}=req.params; res.json(await cfFetch(`/zones/${zoneId}/dns_records`,{method:'POST',body:JSON.stringify(req.body)})); }catch(e){next(e);} });
app.put('/api/zone/:zoneId/dns_records/:id', async (req,res,next)=>{ try{ const {zoneId,id}=req.params; res.json(await cfFetch(`/zones/${zoneId}/dns_records/${id}`,{method:'PUT',body:JSON.stringify(req.body)})); }catch(e){next(e);} });
app.delete('/api/zone/:zoneId/dns_records/:id', async (req,res,next)=>{ try{ const {zoneId,id}=req.params; res.json(await cfFetch(`/zones/${zoneId}/dns_records/${id}`,{method:'DELETE'})); }catch(e){next(e);} });
const distPath = path.join(__dirname,'frontend','dist');
app.use(express.static(distPath));
app.get('*', (_,res)=> res.sendFile(path.join(distPath,'index.html')));
app.use((err,req,res,next)=>{ res.status(err.status||500).json({success:false,error:err.message,details:err.cf||undefined}); });
app.listen(PORT,'0.0.0.0', ()=> console.log(`HTTP server listening on 0.0.0.0:${PORT}`));
