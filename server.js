import express from "express";
import cors from "cors";
import morgan from "morgan";
import fetch from "node-fetch";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { v4 as uuidv4 } from "uuid";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

// ---- Basic startup diagnostics ----
console.log("=== CF DNS Manager starting ===");
console.log("NODE_ENV:", process.env.NODE_ENV || "development");
console.log("PORT:", PORT);
console.log("APP_PASSWORD set:", Boolean(process.env.APP_PASSWORD));
console.log("CF_API_TOKEN set:", Boolean(process.env.CF_API_TOKEN));

// If critical envs are missing, log loud warning (but still start)
if (!process.env.APP_PASSWORD) {
  console.error("[WARN] APP_PASSWORD is not set. API will reject all requests.");
}
if (!process.env.CF_API_TOKEN) {
  console.error("[WARN] CF_API_TOKEN is not set. Cloudflare calls will fail.");
}

app.set('trust proxy', true);
app.use(express.json());

// Attach a request id for tracing
app.use((req,res,next)=>{ req.id = uuidv4(); next(); });

// morgan access logs with request id
morgan.token('rid', (req)=> req.id);
app.use(morgan(':date[iso] :rid :remote-addr ":method :url" :status :res[content-length] - :response-time ms'));

// CORS (allow all by default inside your infra)
app.use(cors());

const CF_BASE = "https://api.cloudflare.com/client/v4";

// Password auth middleware
function appAuth(req, res, next) {
  const hdr = req.headers["x-app-password"];
  if (!hdr || hdr !== process.env.APP_PASSWORD) {
    console.warn(`[AUTH] Denied (req ${req.id}) remote=${req.ip}`);
    return res.status(401).json({ success: false, error: "Unauthorized" });
  }
  next();
}

// All API routes require password
app.use("/api", appAuth);

// Helper to log Cloudflare calls
async function cfFetch(path, options = {}) {
  const url = `${CF_BASE}${path}`;
  console.log(`[CF] ${options.method || 'GET'} ${url}`);
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${process.env.CF_API_TOKEN}`,
      ...(options.headers || {}),
    },
  });
  let data = {};
  try { data = await res.json(); } catch {}
  if (!res.ok || data?.success === false) {
    console.error("[CF][ERROR]", res.status, data?.errors || data);
    const err = new Error(data?.errors?.[0]?.message || `Cloudflare API error (${res.status})`);
    err.status = res.status;
    err.cf = data;
    throw err;
  }
  return data;
}

// ---- API Routes ----
app.get("/api/health", (req, res) => res.json({
  ok: true,
  env: {
    appPasswordSet: Boolean(process.env.APP_PASSWORD),
    cfApiTokenSet: Boolean(process.env.CF_API_TOKEN)
  }
}));

app.get("/api/zones", async (req, res, next) => {
  try {
    const data = await cfFetch(`/zones?per_page=50&page=1`);
    res.json(data);
  } catch (e) { next(e); }
});

app.get("/api/zone/:zoneId/dns_records", async (req, res, next) => {
  try {
    const { zoneId } = req.params;
    const { page = 1, per_page = 200, type = "", name = "", content = "" } = req.query;
    const params = new URLSearchParams({ page, per_page });
    if (type) params.set("type", type);
    if (name) params.set("name", name);
    if (content) params.set("content", content);
    const data = await cfFetch(`/zones/${zoneId}/dns_records?${params.toString()}`);
    res.json(data);
  } catch (e) { next(e); }
});

app.post("/api/zone/:zoneId/dns_records", async (req, res, next) => {
  try {
    const { zoneId } = req.params;
    const data = await cfFetch(`/zones/${zoneId}/dns_records`, {
      method: "POST",
      body: JSON.stringify(req.body),
    });
    res.json(data);
  } catch (e) { next(e); }
});

app.put("/api/zone/:zoneId/dns_records/:recordId", async (req, res, next) => {
  try {
    const { zoneId, recordId } = req.params;
    const data = await cfFetch(`/zones/${zoneId}/dns_records/${recordId}`, {
      method: "PUT",
      body: JSON.stringify(req.body),
    });
    res.json(data);
  } catch (e) { next(e); }
});

app.delete("/api/zone/:zoneId/dns_records/:recordId", async (req, res, next) => {
  try {
    const { zoneId, recordId } = req.params;
    const data = await cfFetch(`/zones/${zoneId}/dns_records/${recordId}`, {
      method: "DELETE",
    });
    res.json(data);
  } catch (e) { next(e); }
});

// Serve frontend build
const distPath = path.join(__dirname, "frontend", "dist");
app.use(express.static(distPath));
app.get("*", (_, res) => res.sendFile(path.join(distPath, "index.html")));

// Global error handler with stack & request id
app.use((err, req, res, next) => {
  console.error(`[ERROR][${req.id}]`, err.stack || err.message, err.details || err.cf || "");
  res.status(err.status || 500).json({ success:false, error: err.message, details: err.cf || undefined, rid: req.id });
});

// Crash safety logs
process.on('unhandledRejection', (reason) => {
  console.error("[unhandledRejection]", reason);
});
process.on('uncaughtException', (err) => {
  console.error("[uncaughtException]", err);
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`HTTP server listening on 0.0.0.0:${PORT}`);
});
