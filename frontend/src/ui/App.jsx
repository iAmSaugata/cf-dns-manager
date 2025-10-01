import React, { useEffect, useState } from 'react'

const API = async (path, opts={}) => {
  const password = localStorage.getItem('app_password') || ''
  const res = await fetch(`/api${path}`, {
    ...opts,
    headers: { 'x-app-password': password, 'Content-Type': 'application/json', ...(opts.headers||{}) }
  })
  let data = {}
  try { data = await res.json() } catch {}
  if (!res.ok || data.success === false) {
    const msg = data?.error || `Request failed (${res.status})`
    const err = new Error(msg); err.status = res.status
    throw err
  }
  return data
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
      <div className="card" style={{maxWidth: 420, margin:'60px auto'}}>
        <h2>Login</h2>
        <p className="muted">Enter the password you configured in <code>APP_PASSWORD</code>.</p>
        <input type="password" className="input" placeholder="Password"
          value={password} onChange={e=>setPassword(e.target.value)} />
        <div style={{marginTop:12}}>
          <button className="btn" disabled={loading || !password} onClick={submit}>
            {loading ? "Checking…" : "Login"}
          </button>
        </div>
        {err && <p style={{color:'salmon', marginTop:8}}>{err}</p>}
        <div className="footer">Powered by Cloudflare DNS API • © iAmSaugata</div>
      </div>
    </div>
  )
}

function ZonePicker({ onPick, onAuthFail }) {
  const [zones,setZones] = useState([])
  const [loading,setLoading] = useState(true)
  const [error,setError] = useState("")
  useEffect(()=>{
    let mounted = true
    ;(async()=>{
      setLoading(true); setError("")
      try {
        const data = await API(`/zones`)
        const zs = data.result || []
        if (!mounted) return
        setZones(zs)
        if (zs.length === 1) onPick(zs[0])
      } catch(e) {
        if (e.status === 401) onAuthFail?.()
        else setError(e.message || "Failed to load zones")
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return ()=>{ mounted=false }
  },[])
  if (loading) return <div className="wrap"><p className="muted">Loading zones…</p></div>
  if (error) return <div className="wrap"><div className="card" style={{border:'1px solid #e76f51'}}><b>Error:</b> {error}</div></div>
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
  const [error,setError] = useState("")
  useEffect(()=>{
    let mounted = true
    ;(async()=>{
      setLoading(true); setError("")
      try {
        const data = await API(`/zone/${zone.id}/dns_records?per_page=200`)
        if (!mounted) return
        setRecords(data.result || [])
      } catch(e) {
        setError(e.message || "Failed to load DNS records")
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return ()=>{ mounted=false }
  }, [zone])
  return (
    <div className="wrap">
      <div className="card">
        <div className="header">
          <div className="title">DNS Manager for Zone <b>{zone.name.toUpperCase()}</b></div>
          <div style={{display:'flex', gap:8}}>
            <button className="btn secondary" onClick={onBack}>Change zone</button>
            <button className="btn secondary" onClick={()=>{ localStorage.removeItem('app_password'); location.reload() }}>Sign out</button>
          </div>
        </div>
        {loading && <p className="muted">Loading…</p>}
        {error && <div className="card" style={{border:'1px solid #e76f51', marginBottom:10}}><b>Error:</b> {error}</div>}
        {!loading && !error && (
          <div style={{overflowX:'auto'}}>
            <table>
              <thead><tr><th>Type</th><th>Name</th><th>Content</th><th>Proxy</th><th>TTL</th></tr></thead>
              <tbody>{records.map(r => (
                <tr key={r.id}><td>{r.type}</td><td>{r.name}</td><td>{r.content}</td><td>{r.proxied?'Proxied':'DNS only'}</td><td>{r.ttl===1?'Auto':r.ttl}</td></tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </div>
      <div className="footer">Powered by Cloudflare DNS API • © iAmSaugata</div>
    </div>
  )
}

export default function App(){
  const [logged,setLogged] = useState(!!localStorage.getItem('app_password'))
  const [zone,setZone] = useState(null)
  if (!logged) return <Login onDone={()=>setLogged(true)} />
  if (!zone) return <ZonePicker onPick={z=>setZone(z)} onAuthFail={()=>{ localStorage.removeItem('app_password'); location.reload() }} />
  return <Records zone={zone} onBack={()=>setZone(null)} />
}
