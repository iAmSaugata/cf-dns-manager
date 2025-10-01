import React, { useEffect, useState } from 'react'
const api = async (path, opts={}) => {
  const password = localStorage.getItem('app_password') || ''
  const res = await fetch(`/api${path}`, { ...opts, headers:{ 'x-app-password': password, 'Content-Type':'application/json', ...(opts.headers||{}) }, credentials:'same-origin', cache:'no-store' })
  let data={}; try{ data=await res.json() }catch{}
  if(!res.ok || data.success===false){ const err=new Error(data?.error||`Request failed (${res.status})`); err.status=res.status; err.payload=data; throw err }
  return data
}
function LogoutButton(){ return <button className="btn secondary" onClick={()=>{ document.cookie='app_password=; Max-Age=0; Path=/'; localStorage.removeItem('app_password'); location.reload() }}>Sign out</button> }
function ZonePicker({ onPick }){
  const [zones,setZones]=useState([]); const [loading,setLoading]=useState(true); const [err,setErr]=useState('')
  useEffect(()=>{(async()=>{try{const d=await api(`/zones?t=${Date.now()}`); const zs=d.result||[]; setZones(zs); if(zs.length===1) onPick(zs[0]);}catch(e){setErr(e.message)}finally{setLoading(false)}})()},[])
  if(loading) return <div className="wrap"><p className="muted">Loading zones…</p></div>
  return <div className="wrap"><div className="header"><div className="title">Select Zone</div><LogoutButton/></div><div className="card">{err && <div className="muted">Error: {err}</div>}{(zones||[]).map(z=><div key={z.id} style={{display:'flex',justifyContent:'space-between',padding:'8px 0',borderBottom:'1px solid #2b3d66'}}><div><b>{z.name}</b></div><button className="btn" onClick={()=>onPick(z)}>Open</button></div>)}<div className="footer">Powered by Cloudflare DNS API • © iAmSaugata</div></div></div>
}
function AddRecord({ zoneId, onCreated }){
  const [type,setType]=useState('A'); const [name,setName]=useState(''); const [content,setContent]=useState(''); const [ttl,setTtl]=useState(1); const [proxied,setProxied]=useState(false); const [busy,setBusy]=useState(false); const [err,setErr]=useState('')
  const create=async()=>{ setBusy(true); setErr(''); try{ const body={type,name,content,ttl:Number(ttl)}; if(['A','AAAA','CNAME'].includes(type)) body.proxied=Boolean(proxied); const d=await api(`/zone/${zoneId}/dns_records`,{method:'POST',body:JSON.stringify(body)}); onCreated(d.result); setName(''); setContent(''); }catch(e){ setErr(e.message)} finally{ setBusy(false)} }
  return <div className="inline-form" style={{margin:'6px 0 12px'}}>
    <select value={type} onChange={e=>setType(e.target.value)}>{['A','AAAA','CNAME','TXT','MX','NS','SRV','CAA','PTR'].map(t=><option key={t} value={t}>{t}</option>)}</select>
    <input placeholder="Name (use @ for root)" value={name} onChange={e=>setName(e.target.value)}/>
    <textarea placeholder="Content / Target / Value" value={content} onChange={e=>setContent(e.target.value)}/>
    <select value={ttl} onChange={e=>setTtl(e.target.value)}><option value={1}>Auto</option>{[60,120,300,600,1200,1800,3600,7200,14400,28800,43200].map(v=><option key={v} value={v}>{v}s</option>)}</select>
    <select value={proxied?'on':'off'} onChange={e=>setProxied(e.target.value==='on')}><option value="off">DNS only</option><option value="on">Proxied</option></select>
    <div style={{display:'flex',justifyContent:'flex-end'}}><button className="btn" disabled={busy || !type || !content} onClick={create}>{busy?'Adding…':'Add record'}</button></div>
    {err && <div className="muted" style={{gridColumn:'1 / -1'}}>Error: {err}</div>}
  </div>
}
function RecordRow({ rec, zoneId, onSaved, onDeleted }){
  const [edit,setEdit]=useState(false); const [busy,setBusy]=useState(false)
  const [type,setType]=useState(rec.type); const [name,setName]=useState(rec.name); const [content,setContent]=useState(rec.content); const [ttl,setTtl]=useState(rec.ttl); const [proxied,setProxied]=useState(Boolean(rec.proxied))
  const save=async()=>{ setBusy(true); try{ const body={type,name,content,ttl:Number(ttl)}; if(['A','AAAA','CNAME'].includes(type)) body.proxied=Boolean(proxied); const d=await api(`/zone/${zoneId}/dns_records/${rec.id}`,{method:'PUT',body:JSON.stringify(body)}); onSaved(d.result); setEdit(false);}catch(e){alert('Save failed: '+e.message)}finally{setBusy(false)} }
  const del=async()=>{ if(!confirm(`Delete ${rec.type} ${rec.name}?`)) return; setBusy(true); try{ await api(`/zone/${zoneId}/dns_records/${rec.id}`,{method:'DELETE'}); onDeleted(rec.id);}catch(e){alert('Delete failed: '+e.message)}finally{setBusy(false)} }
  if(edit){ return <div className="row">
    <select value={type} onChange={e=>setType(e.target.value)}>{['A','AAAA','CNAME','TXT','MX','NS','SRV','CAA','PTR'].map(t=><option key={t} value={t}>{t}</option>)}</select>
    <input value={name} onChange={e=>setName(e.target.value)}/>
    <textarea value={content} onChange={e=>setContent(e.target.value)}/>
    <select value={ttl} onChange={e=>setTtl(e.target.value)}><option value={1}>Auto</option>{[60,120,300,600,1200,1800,3600,7200,14400,28800,43200].map(v=><option key={v} value={v}>{v}s</option>)}</select>
    <select value={proxied?'on':'off'} onChange={e=>setProxied(e.target.value==='on')}><option value="off">DNS only</option><option value="on">Proxied</option></select>
    <div className="row-actions"><button className="btn" disabled={busy} onClick={save}>{busy?'Saving…':'Save'}</button><button className="btn secondary" disabled={busy} onClick={()=>setEdit(false)}>Cancel</button></div>
  </div> }
  return <div className="row">
    <div className="cell-wrap">{rec.type}</div><div className="cell-wrap">{rec.name}</div><div className="cell-wrap">{rec.content}</div><div className="cell-wrap">{rec.ttl===1?'Auto':rec.ttl}</div><div className="cell-wrap">{rec.proxied?'Proxied':'DNS only'}</div>
    <div className="row-actions"><button className="btn" onClick={()=>setEdit(true)}>Edit</button><button className="btn danger" onClick={del}>Delete</button></div>
  </div>
}
function Records({ zone, onBack }){
  const [recs,setRecs]=useState([]); const [loading,setLoading]=useState(true); const [err,setErr]=useState('')
  const load=async()=>{ setLoading(true); setErr(''); try{ const d=await api(`/zone/${zone.id}/dns_records?per_page=200&t=${Date.now()}`); setRecs(d.result||[]) }catch(e){ setErr(e.message)} finally{ setLoading(false)} }
  useEffect(()=>{ load() },[zone.id])
  const updateRec=r=>setRecs(p=>p.map(x=>x.id===r.id?r:x)); const removeRec=id=>setRecs(p=>p.filter(x=>x.id!==id)); const addRec=r=>setRecs(p=>[r,...p])
  return <div className="wrap">
    <div className="header"><div className="title">DNS Manager for Zone <b>{zone.name.toUpperCase()}</b></div><div style={{display:'flex',gap:8}}><button className="btn secondary" onClick={onBack}>Change zone</button><LogoutButton/></div></div>
    <div className="card">
      <AddRecord zoneId={zone.id} onCreated={addRec}/>
      {loading && <p className="muted">Loading…</p>}
      {err && <p className="muted">Error: {err}</p>}
      {!loading && !err && <><div className="grid th"><div>Type</div><div>Name</div><div>Content</div><div>TTL</div><div>Proxy</div><div>Actions</div></div>{recs.map(r=><RecordRow key={r.id} rec={r} zoneId={zone.id} onSaved={updateRec} onDeleted={removeRec}/>)}</>}
      <div className="footer">Powered by Cloudflare DNS API • © iAmSaugata</div>
    </div>
  </div>
}
function Login({ onDone }){
  const [password,setPassword]=useState(''); const [busy,setBusy]=useState(false); const [err,setErr]=useState('')
  const submit=async()=>{ setBusy(true); setErr(''); try{ localStorage.setItem('app_password',password); document.cookie=`app_password=${encodeURIComponent(password)}; Path=/; SameSite=Lax`; const r=await fetch('/api/health',{headers:{'x-app-password':password},credentials:'same-origin'}); if(!r.ok) throw new Error('Invalid password'); onDone(); }catch(e){ setErr(e.message)} finally{ setBusy(false)} }
  return <div className="wrap"><div className="header"><div className="title">Login</div></div><div className="card"><p className="muted">Enter the password you configured in <b>APP_PASSWORD</b>.</p><input type="password" placeholder="Password" value={password} onChange={e=>setPassword(e.target.value)}/><div style={{marginTop:10,display:'flex',gap:8}}><button className="btn" disabled={busy||!password} onClick={submit}>{busy?'Checking…':'Login'}</button><LogoutButton/></div>{err && <p style={{color:'salmon'}}>Error: {err}</p>}<div className="footer">Powered by Cloudflare DNS API • © iAmSaugata</div></div></div>
}
export default function App(){ const [logged,setLogged]=useState(!!localStorage.getItem('app_password')); const [zone,setZone]=useState(null); if(!logged) return <Login onDone={()=>setLogged(true)}/>; if(!zone) return <ZonePicker onPick={z=>setZone(z)}/>; return <Records zone={zone} onBack={()=>setZone(null)}/> }
