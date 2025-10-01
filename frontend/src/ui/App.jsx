import React, { useEffect, useState } from 'react'

const API = (path, opts={}) => {
  const password = localStorage.getItem('app_password') || ''
  return fetch(`/api${path}`, {
    ...opts,
    headers: { 'x-app-password': password, 'Content-Type': 'application/json', ...(opts.headers||{}) }
  }).then(async r => {
    const j = await r.json().catch(()=>({}))
    if (!r.ok || j.success === false) throw new Error(j?.error || 'Request failed')
    return j
  })
}

function Login({ onDone }) {
  const [password,setPassword] = useState("")
  const [loading,setLoading] = useState(false)
  const [err,setErr] = useState("")

  const submit = async () => {
    setLoading(true); setErr("")
    try {
      localStorage.setItem("app_password", password)
      const res = await fetch("/api/health", { headers: { "x-app-password": password } })
      if (!res.ok) throw new Error("Invalid password")
      onDone()
    } catch(e) { setErr(e.message) } finally { setLoading(false) }
  }

  return (
    <div className="wrap">
      <div className="card" style={{maxWidth: 400, margin:'60px auto'}}>
        <h2>Login</h2>
        <input type="password" className="input" placeholder="Password"
          value={password} onChange={e=>setPassword(e.target.value)} />
        <button className="btn" disabled={loading || !password} onClick={submit}>
          {loading ? "Checking…" : "Login"}
        </button>
        {err && <p style={{color:'salmon'}}>{err}</p>}
      </div>
    </div>
  )
}

function ZonePicker({ onPick }) {
  const [zones,setZones] = useState([])
  const [loading,setLoading] = useState(true)

  useEffect(()=>{
    (async()=>{
      const data = await API(`/zones`)
      const zs = data.result || []
      setZones(zs)
      setLoading(false)
      if (zs.length === 1) onPick(zs[0])
    })()
  },[])

  if (loading) return <p className="muted">Loading zones…</p>
  if (zones.length === 1) return null

  return (
    <div className="wrap">
      <div className="card">
        <h2>Select Zone</h2>
        {zones.map(z => (
          <div key={z.id} className="tag" style={{display:'flex', justifyContent:'space-between', marginBottom:8}}>
            <div><b>{z.name}</b></div>
            <button className="btn" onClick={()=>onPick(z)}>Open</button>
          </div>
        ))}
      </div>
    </div>
  )
}

function Records({ zone, onBack }) {
  const [records,setRecords] = useState([])
  const [loading,setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    const data = await API(`/zone/${zone.id}/dns_records?per_page=200`)
    setRecords(data.result || [])
    setLoading(false)
  }
  useEffect(()=>{ load() }, [zone])

  return (
    <div className="wrap">
      <div className="card">
        <div className="header">
          <div className="title">DNS Manager for Zone <b>{zone.name.toUpperCase()}</b></div>
          <div style={{display:'flex', gap:8}}>
            <button className="btn secondary" onClick={onBack}>Change zone</button>
            <button className="btn secondary" onClick={()=>location.reload()}>Sign out</button>
          </div>
        </div>
        <div style={{overflowX:'auto'}}>
          {loading? <p className="muted">Loading…</p>:
          <table><thead><tr><th>Type</th><th>Name</th><th>Content</th><th>Proxy</th><th>TTL</th></tr></thead>
          <tbody>{records.map(r => (
            <tr key={r.id}><td>{r.type}</td><td>{r.name}</td><td>{r.content}</td><td>{r.proxied?'Proxied':'DNS only'}</td><td>{r.ttl===1?'Auto':r.ttl}</td></tr>
          ))}</tbody></table>}
        </div>
      </div>
      <div className="footer">Powered by Cloudflare DNS API • © iAmSaugata</div>
    </div>
  )
}

export default function App(){
  const [logged,setLogged] = useState(!!localStorage.getItem('app_password'))
  const [zone,setZone] = useState(null)
  if (!logged) return <Login onDone={()=>setLogged(true)} />
  if (!zone) return <ZonePicker onPick={z=>setZone(z)} />
  return <Records zone={zone} onBack={()=>setZone(null)} />
}
