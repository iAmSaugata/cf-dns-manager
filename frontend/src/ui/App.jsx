import React, { useEffect, useState } from 'react'

const API = async (path, opts={}) => {
  const password = localStorage.getItem('app_password') || ''
  const res = await fetch(`/api${path}`, {
    ...opts,
    headers: { 'x-app-password': password, 'Content-Type': 'application/json', ...(opts.headers||{}) },
    credentials: 'same-origin',
    cache: 'no-store'
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

function LogoutButton({ label='Sign out' }) {
  return <button className="btn secondary" onClick={()=>{ document.cookie='app_password=; Max-Age=0; Path=/'; localStorage.removeItem('app_password'); location.reload() }}>{label}</button>
}

function Login({ onDone }) {
  const [password,setPassword] = useState("")
  const [loading,setLoading] = useState(false)
  const [err,setErr] = useState("")
  const submit = async () => {
    setLoading(true); setErr("")
    try {
      localStorage.setItem("app_password", password)
      document.cookie = `app_password=${encodeURIComponent(password)}; Path=/; SameSite=Lax`
      const res = await fetch("/api/health", { headers: { "x-app-password": password }, credentials:'same-origin', cache:'no-store' })
      if (!res.ok) throw new Error("Invalid password")
      onDone()
    } catch(e) { setErr(e.message) } finally { setLoading(false) }
  }
  return (
    <div className="center">
      <div className="card">
        <div className="header">
          <div className="title">Login</div>
          <LogoutButton label="Clear & Reload" />
        </div>
        <p className="muted">Enter the password you configured in <b>APP_PASSWORD</b>.</p>
        <input type="password" className="input" placeholder="Password"
          value={password} onChange={e=>setPassword(e.target.value)} />
        <div style={{marginTop:12, display:'flex', gap:10}}>
          <button className="btn" disabled={loading || !password} onClick={submit}>
            {loading ? "Checking…" : "Login"}
          </button>
          <button className="btn secondary" onClick={()=>{ setPassword(''); localStorage.removeItem('app_password'); document.cookie='app_password=; Max-Age=0; Path=/'; }}>Reset</button>
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
        const data = await API(`/zones?t=${Date.now()}`)
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
  if (loading) return <div className="center"><p className="muted">Loading zones…</p></div>
  return (
    <div className="center" style={{alignItems:'flex-start'}}>
      <div className="card">
        <div className="header">
          <div className="title">Select Zone</div>
          <LogoutButton />
        </div>
        {error && <div className="tag" style={{border:'1px solid #e76f51', marginBottom:10}}><b style={{marginRight:8}}>Error:</b> {error}</div>}
        {zones.length === 0 ? (
          <div className="muted">No zones found for this token.</div>
        ) : (
          <div className="list">
            {zones.map(z => (
              <div key={z.id} className="tag">
                <div><b>{z.name}</b></div>
                <button className="btn" onClick={()=>onPick(z)}>Open</button>
              </div>
            ))}
          </div>
        )}
        <div className="footer">Powered by Cloudflare DNS API • © iAmSaugata</div>
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
        const data = await API(`/zone/${zone.id}/dns_records?per_page=200&t=${Date.now()}`)
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
      <div className="header">
        <div className="title">DNS Manager for Zone <b>{zone.name.toUpperCase()}</b></div>
        <div style={{display:'flex', gap:8}}>
          <button className="btn secondary" onClick={onBack}>Change zone</button>
          <LogoutButton />
        </div>
      </div>
      <div className="card">
        {loading && <p className="muted">Loading…</p>}
        {error && <div className="tag" style={{border:'1px solid #e76f51', marginBottom:10}}><b style={{marginRight:8}}>Error:</b> {error}</div>}
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
        <div className="footer">Powered by Cloudflare DNS API • © iAmSaugata</div>
      </div>
    </div>
  )
}

export default function App(){
  const [logged,setLogged] = useState(!!localStorage.getItem('app_password'))
  const [zone,setZone] = useState(null)
  if (!logged) return <Login onDone={()=>setLogged(true)} />
  if (!zone) return <ZonePicker onPick={z=>setZone(z)} onAuthFail={()=>{ document.cookie='app_password=; Max-Age=0; Path=/'; localStorage.removeItem('app_password'); location.reload() }} />
  return <Records zone={zone} onBack={()=>setZone(null)} />
}
