import 'dotenv/config'
import express from 'express'
import morgan from 'morgan'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import path from 'path'
import { fileURLToPath } from 'url'
import cf from './cloudflare.mjs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const PORT = process.env.PORT || 8080
const APP_PASSWORD = process.env.APP_PASSWORD || ''

app.use(morgan('dev'))
app.use(express.json())
app.use(cookieParser())
app.use(cors({ origin: true, credentials: true }))

// Debug logger for every request
app.use((req,res,next)=>{
  console.log(`[DEBUG] ${new Date().toISOString()} ${req.method} ${req.url}`)
  next()
})

// simple auth middleware for /api/*
function auth(req,res,next){
  if (req.path === '/health') return next()
  const header = req.header('x-app-password') || ''
  const cookie = req.cookies?.app_password || ''
  const pass = header || cookie
  if (!APP_PASSWORD || pass === APP_PASSWORD) return next()
  return res.status(401).json({ ok:false, message:'Unauthorized' })
}

app.get('/api/health', (req,res)=> res.json({ ok:true, time:new Date().toISOString() }))

app.use('/api', auth)

// ZONES
app.get('/api/zones', async (req,res)=>{
  try {
    const r = await cf.getZones()
    res.json(r)
  } catch (e) {
    console.error('zones error', e)
    res.status(e.status||500).json(e.body||{message:String(e)})
  }
})

// RECORDS
app.get('/api/zone/:zoneId/dns_records', async (req,res)=>{
  try {
    const types = ['A','AAAA','CNAME','TXT','MX','NS','PTR']
    const r = await cf.listRecords(req.params.zoneId, { types })
    res.json(r)
  } catch (e) {
    console.error('list error', e)
    res.status(e.status||500).json(e.body||{message:String(e)})
  }
})

app.post('/api/zone/:zoneId/dns_records', async (req,res)=>{
  try {
    const r = await cf.createRecord(req.params.zoneId, req.body)
    res.json(r)
  } catch (e) {
    console.error('create error', e)
    res.status(e.status||500).json(e.body||{message:String(e)})
  }
})

app.put('/api/zone/:zoneId/dns_records/:id', async (req,res)=>{
  try {
    const r = await cf.updateRecord(req.params.zoneId, req.params.id, req.body)
    res.json(r)
  } catch (e) {
    console.error('update error', e)
    res.status(e.status||500).json(e.body||{message:String(e)})
  }
})

app.delete('/api/zone/:zoneId/dns_records/:id', async (req,res)=>{
  try {
    const r = await cf.deleteRecord(req.params.zoneId, req.params.id)
    res.json(r)
  } catch (e) {
    console.error('delete error', e)
    res.status(e.status||500).json(e.body||{message:String(e)})
  }
})

// Serve static frontend
const publicDir = path.join(__dirname, 'public')
app.use(express.static(publicDir))
app.get('*', (req,res)=> res.sendFile(path.join(publicDir, 'index.html')))

app.listen(PORT, ()=> console.log(`Server on :${PORT}`))
