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
console.log("NODE_ENV:", process.env.NODE_ENV || "development");
console.log("PORT:", PORT);
console.log("APP_PASSWORD set:", Boolean(process.env.APP_PASSWORD));
console.log("CF_API_TOKEN set:", Boolean(process.env.CF_API_TOKEN));

if (!process.env.APP_PASSWORD) console.error("[WARN] APP_PASSWORD is not set. API will reject all requests.");
if (!process.env.CF_API_TOKEN) console.error("[WARN] CF_API_TOKEN is not set. Cloudflare calls will fail.");

app.set('trust proxy', true);
app.disable('etag');
app.use((req,res,next)=>{ res.set('Cache-Control','no-store'); next(); });
app.use(express.json());
app.use(cors());
morgan.token('realip', (req)=> req.headers['cf-connecting-ip'] || req.ip);
app.use(morgan(':date[iso] :realip ":method :url" :status :res[content-length] - :response-time ms'));

const CF_BASE = "https://api.cloudflare.com/client/v4";

function parseCookies(cookieHeader) {
  const out = {}; if (!cookieHeader) return out;
  cookieHeader.split(';').forEach(kv => { const i=kv.indexOf('='); if(i>-1) out[kv.slice(0,i).trim()]=decodeURIComponent(kv.slice(i+1)); });
  return out;
}
function mask(v){ if(!v) return '(empty)'; return v.length<=4? '*'.repeat(v.length): v.slice(0,2)+'***'+v.slice(-2); }

function appAuth(req, res, next) {
  const hdr = req.headers["x-app-password"];
  const cookiePw = parseCookies(req.headers.cookie||"")["app_password"];
  const provided = hdr || cookiePw || "";
  const expected = process.env.APP_PASSWORD || "";
  if (!provided) { console.warn(`[AUTH] Missing password. ip=${req.headers['cf-connecting-ip']||req.ip}`); return res.status(401).json({success:false,error:"Unauthorized (no password)"}); }
  if (provided !== expected) { console.warn(`[AUTH] Mismatch provided=${mask(provided)} expected_len=${expected.length} ip=${req.headers['cf-connecting-ip']||req.ip}`); return res.status(401).json({success:false,error:"Unauthorized (bad password)"}); }
  next();
}

app.use("/api", appAuth);

app.get("/api/debug", (req,res)=>{
  const cookies=parseCookies(req.headers.cookie||"");
  res.json({ ok:true, received:{ 'x-app-password-len': (req.headers['x-app-password']||'').length, 'cookie-has-app_password': Boolean(cookies['app_password']) }});
});

app.get("/api/health", (req,res)=> res.json({ ok:true }));

async function cfFetch(path, options = {}) {
  const url = `${CF_BASE}${path}`;
  console.log(`[CF] ${options.method || 'GET'} ${url}`);
  const res = await fetch(url, {
    ...options,
    headers: { "Content-Type":"application/json", "Authorization":`Bearer ${process.env.CF_API_TOKEN}`, ...(options.headers||{}) },
  });
  let data={}; try{ data=await res.json(); }catch{}
  if (!res.ok || data?.success===false) { console.error("[CF][ERROR]", res.status, data?.errors||data); const err = new Error(data?.errors?.[0]?.message || `Cloudflare API error (${res.status})`); err.status=res.status; err.cf=data; throw err; }
  return data;
}

app.get("/api/zones", async (req,res,next)=>{
  try { res.json(await cfFetch(`/zones?per_page=200&page=1`)); } catch(e){ next(e); }
});

app.get("/api/zone/:zoneId/dns_records", async (req, res, next) => {
  try {
    const { zoneId } = req.params;
    const { page = 1, per_page = 200, type = "", name = "", content = "" } = req.query;
    const params = new URLSearchParams({ page, per_page });
    if (type) params.set("type", type);
    if (name) params.set("name", name);
    if (content) params.set("content", content);
    res.json(await cfFetch(`/zones/${zoneId}/dns_records?${params.toString()}`));
  } catch (e) { next(e); }
});

const distPath = path.join(__dirname,"frontend","dist");
app.use(express.static(distPath));
app.get("*", (_,res)=> res.sendFile(path.join(distPath,"index.html")));

app.use((err, req, res, next)=>{
  console.error("[ERROR]", err.stack || err.message, err.cf || "");
  res.status(err.status||500).json({ success:false, error:err.message, details:err.cf||undefined });
});

app.listen(PORT,"0.0.0.0", ()=> console.log(`HTTP server listening on 0.0.0.0:${PORT}`));
