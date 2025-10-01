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

app.use(express.json());
app.use(morgan("dev"));
app.use(cors());

const CF_BASE = "https://api.cloudflare.com/client/v4";

// Password auth middleware
function appAuth(req, res, next) {
  const hdr = req.headers["x-app-password"];
  if (!hdr || hdr !== process.env.APP_PASSWORD) {
    return res.status(401).json({ success: false, error: "Unauthorized" });
  }
  next();
}

// All API routes require password
app.use("/api", appAuth);

async function cfFetch(path, options = {}) {
  const res = await fetch(`${CF_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${process.env.CF_API_TOKEN}`,
      ...(options.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.success === false) {
    const err = new Error(data?.errors?.[0]?.message || `Cloudflare API error (${res.status})`);
    err.status = res.status;
    err.cf = data;
    throw err;
  }
  return data;
}

// API
app.get("/api/health", (req, res) => res.json({ ok: true }));

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

// Error handler
app.use((err, req, res, next) => {
  res.status(err.status || 500).json({ success:false, error: err.message, details: err.cf || undefined });
});

app.listen(PORT, () => console.log(`CF DNS Manager running on :${PORT}`));
