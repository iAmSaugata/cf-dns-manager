
import React, { useEffect, useMemo, useState } from 'react'
const api = async (p,o={})=>{
  const pw=localStorage.getItem('app_password')||''
  const r=await fetch(`/api${p}`,{...o,headers:{'x-app-password':pw,'Content-Type':'application/json',...(o.headers||{})},credentials:'same-origin',cache:'no-store'})
  let d={}; try{ d=await r.json() }catch{}
  if(!r.ok || d.success===false){ const e=new Error(d?.error||`Request failed (${r.status})`); e.status=r.status; e.payload=d; throw e }
  return d
}
const Logout=()=> <button className="btn secondary" onClick={()=>{document.cookie='app_password=; Max-Age=0; Path=/';localStorage.removeItem('app_password');location.reload()}}>Sign Out</button>
const PROXYABLE = new Set(['A','AAAA','CNAME']); const LOCK_ONLY = new Set(['TXT','MX','NS','PTR']);

function ZonePicker({onPick}){
  const [zones,setZones]=useState([]),[loading,setLoading]=useState(true),[err,setErr]=useState('')
  useEffect(()=>{(async()=>{try{const d=await api(`/zones?t=${Date.now()}`);const zs=d.result||[];setZones(zs);if(zs.length===1)onPick(zs[0])}catch(e){setErr(e.message)}finally{setLoading(false)}})()},[])
  if(loading) return <div className="center-full"><div className="card"><p className="muted">Loading zones…</p></div></div>
  return <div className="wrap center-page">
    <div className="header"><div className="title">Select Zone</div><Logout/></div>
    <div className="card">
      {err && <div className="muted">Error: {err}</div>}
      <div className="zone-list">
        {(zones||[]).map(z=>(
          <div className="zone-item" key={z.id}>
            <div className="zone-top"><div className="zone-name" style={{fontWeight:700}}>{z.name}</div><div className="badge">{z.plan?.name||"Free Website"}</div></div>
            <div className="zone-actions"><button className="btn" onClick={()=>onPick(z)}>Open</button></div>
          </div>
        ))}
      </div>
      <div className="footer">Powered by Cloudflare DNS API • © iAmSaugata</div>
    </div>
  </div>
}

function AddRecord({zoneId,onCreated}){
  const [type,setType]=useState('A'),[name,setName]=useState(''),[content,setContent]=useState(''),[ttl,setTtl]=useState(1),[proxied,setProxied]=useState(false),[comment,setComment]=useState(''),[busy,setBusy]=useState(false),[err,setErr]=useState('')
  const add=async()=>{ setBusy(true); setErr(''); try{ const body={type,name,content,ttl:Number(ttl)}; if(comment) body.comment=comment; if(PROXYABLE.has(type)) body.proxied=Boolean(proxied); if(LOCK_ONLY.has(type)) body.proxied=false; const d=await api(`/zone/${zoneId}/dns_records`,{method:"POST",body:JSON.stringify(body)}); onCreated(d.result); setName(''); setContent(''); setComment(''); }catch(e){ setErr(e.message) } finally { setBusy(false) } }
  return <div className="inline-form" style={{gridTemplateColumns:'160px 1fr 1fr 110px 120px 1fr auto'}}>
    <select value={type} onChange={e=>setType(e.target.value)}>
      {['A','AAAA','CNAME','TXT','MX','NS','PTR'].map(t=><option key={t} value={t}>{t}</option>)}
    </select>
    <input placeholder="Name (use @ for root)" value={name} onChange={e=>setName(e.target.value)} />
    <textarea placeholder="Content / Target / Value" value={content} onChange={e=>setContent(e.target.value)} />
    <select value={ttl} onChange={e=>setTtl(e.target.value)}>
      <option value={1}>Auto</option>{[60,120,300,600,1200,1800,3600,7200,14400,28800,43200].map(v=><option key={v} value={v}>{v}s</option>)}
    </select>
    {PROXYABLE.has(type) ? (
      <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center'}}><div className="muted" style={{fontSize:11,marginBottom:4}}>PROXY</div>
        <div className={`switch ${proxied?'on':''}`} onClick={()=>setProxied(!proxied)}><div className="dot"/></div>
      </div>
    ) : (
      <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center'}}><div className='muted' style={{fontSize:11,marginBottom:4}}>PROXY</div><div className='muted'>DNS only</div></div>
    )}
    <input placeholder="Comment (optional)" value={comment} onChange={e=>setComment(e.target.value)} />
    <button className="btn lg" disabled={busy || !type || !content} onClick={add}>{busy?'Adding…':'Add Record'}</button>
    {err && <div className="muted" style={{gridColumn:'1 / -1'}}>Error: {err}</div>}
  </div>
}

function DeleteModal({open,onClose,onConfirm,items}){
  if(!open) return null
  const one = items.length===1 ? items[0] : null
  return <div className="center-full" style={{position:'fixed',inset:0,background:'rgba(0,0,0,.5)'}} onClick={onClose}>
    <div className="card" style={{width:'min(720px,92vw)'}} onClick={e=>e.stopPropagation()}>
      <div className="title">{one ? 'Delete DNS record?' : `Delete ${items.length} DNS records?`}</div>
      <div className="muted" style={{marginTop:6,maxHeight:260,overflow:'auto'}}>
        {one ? (<div><div><b>Type:</b> {one.type}</div><div><b>Name:</b> {one.name}</div><div><b>Content:</b> {one.content}</div><div><b>TTL:</b> {one.ttl===1?'Auto':one.ttl}</div><div><b>Proxy:</b> {one.proxied?'Proxied':'DNS only'}</div>{one.comment? <div><b>Comment:</b> {one.comment}</div>:null}</div>)
              : (items.map(x=><div key={x.id} style={{margin:'4px 0',borderTop:'1px solid #223356',paddingTop:4}}>{x.type} • {x.name} → {x.content}</div>))}
      </div>
      <div style={{display:'flex',gap:8,justifyContent:'flex-end',marginTop:10}}>
        <button className="btn secondary" onClick={onClose}>Cancel</button>
        <button className="btn danger" onClick={onConfirm}>Delete</button>
      </div>
    </div>
  </div>
}

function Row({rec,zoneId,onSaved,onToggleSelect,selected,setDeleteTarget}){
  const [edit,setEdit]=useState(false),[busy,setBusy]=useState(false)
  const [type,setType]=useState(rec.type),[name,setName]=useState(rec.name),[content,setContent]=useState(rec.content),[ttl,setTtl]=useState(rec.ttl),[proxied,setProxied]=useState(Boolean(rec.proxied)),[comment,setComment]=useState(rec.comment||'')
  useEffect(()=>{ setType(rec.type); setName(rec.name); setContent(rec.content); setTtl(rec.ttl); setProxied(Boolean(rec.proxied)); setComment(rec.comment||'') }, [rec.id,rec.type,rec.name,rec.content,rec.ttl,rec.proxied,rec.comment])

  const save=async()=>{ setBusy(true); try{ const body={type,name,content,ttl:Number(ttl),comment}; if(PROXYABLE.has(type)) body.proxied=Boolean(proxied); if(LOCK_ONLY.has(type)) body.proxied=false; const d=await api(`/zone/${zoneId}/dns_records/${rec.id}`,{method:'PUT',body:JSON.stringify(body)}); onSaved(d.result); setEdit(false)}catch(e){ alert('Save failed: '+e.message) } finally{ setBusy(false) } }
  const askDelete=()=> setDeleteTarget([rec])

  if(edit){
    return <div className="row dns" style={{alignItems:'start'}}>
      <input type="checkbox" checked={selected} onChange={e=>onToggleSelect(rec.id,e.target.checked)} />
      <select value={type} onChange={e=>setType(e.target.value)}>{['A','AAAA','CNAME','TXT','MX','NS','PTR'].map(t=><option key={t} value={t}>{t}</option>)}</select>
      <input value={name} onChange={e=>setName(e.target.value)} />
      <textarea value={content} onChange={e=>setContent(e.target.value)} />
      <select value={ttl} onChange={e=>setTtl(e.target.value)}><option value={1}>Auto</option>{[60,120,300,600,1200,1800,3600,7200,14400,28800,43200].map(v=><option key={v} value={v}>{v}s</option>)}</select>
      { PROXYABLE.has(type) ? (
        <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center'}}><div className='muted' style={{fontSize:11,marginBottom:4}}>PROXY</div><div className={`switch ${proxied?'on':''}`} onClick={()=>setProxied(!proxied)}><div className='dot'/></div></div>
      ) : (<div style={{display:'flex',flexDirection:'column',alignItems:'center'}}><div className='muted' style={{fontSize:11,marginBottom:4}}>PROXY</div><div className='muted'>DNS only</div></div>) }
      <input placeholder="Comment" value={comment} onChange={e=>setComment(e.target.value)} />
      <div className="row-actions" style={{minWidth:150}}>
        <button className="btn" disabled={busy} onClick={save}>{busy?'Saving…':'Save'}</button>
        <button className="btn secondary" disabled={busy} onClick={()=>setEdit(false)}>Cancel</button>
      </div>
    </div>
  }
  return <div className="row dns">
    <input type="checkbox" checked={selected} onChange={e=>onToggleSelect(rec.id,e.target.checked)} />
    <div className="cell-wrap">{rec.type}</div>
    <div className="cell-wrap">{rec.comment ? (<span className="tooltip"><span className="info">ℹ️</span><span className="tip">{rec.comment}</span></span>) : null} {' '}{rec.name}</div>
    <div className="cell-wrap">{rec.content}</div>
    <div className="cell-wrap">{rec.ttl===1?'Auto':rec.ttl}</div>
    <div className="cell-wrap">{PROXYABLE.has(rec.type) ? (<div className={`switch ${rec.proxied?'on':''}`} onClick={async()=>{ try{ const d=await api(`/zone/${zoneId}/dns_records/${rec.id}`,{method:'PUT',body:JSON.stringify({...rec,proxied:!rec.proxied})}); onSaved(d.result); }catch(e){ alert('Toggle failed: '+e.message) }}}><div className="dot"/></div>) : ('DNS only')}</div>
    <div className="row-actions"><button className="btn" onClick={()=>setEdit(true)}>Edit</button><button className="btn danger" onClick={askDelete}>Delete</button></div>
  </div>
}

function Records({zone,onBack}){
  const [recs,setRecs]=useState([]),[loading,setLoading]=useState(true),[err,setErr]=useState('')
  const [filterType,setFilterType]=useState(''),[search,setSearch]=useState('')
  const [selected,setSelected]=useState({})
  const [delItems,setDelItems]=useState(null),[bulkBusy,setBulkBusy]=useState(false)
  useEffect(()=>{ document.title = `${zone.name} — CF DNS Manager`; return ()=>{ document.title = 'CF DNS Manager'; } },[zone.name])
  const load=async()=>{ setLoading(true); setErr(''); try{ const d=await api(`/zone/${zone.id}/dns_records?per_page=200&t=${Date.now()}`); setRecs(d.result||[]) }catch(e){ setErr(e.message) } finally{ setLoading(false) } }
  useEffect(()=>{ load() },[zone.id])
  const updateRec = r => setRecs(p=>p.map(x=>x.id===r.id? r : x))
  const removeRec = id => setRecs(p=>p.filter(x=>x.id!==id))
  const addRec = r => setRecs(p=>[r,...p])
  const filtered = useMemo(()=>{ const q=(search||'').toLowerCase().trim(); return recs.filter(r=>{ if(filterType && r.type!==filterType) return false; if(!q) return true; return [r.type,r.name,r.content,r.comment||''].join(' ').toLowerCase().includes(q) }) },[recs,filterType,search])
  const onToggleSelect=(id,on)=> setSelected(prev=>({...prev,[id]:on}))
  const allSelected = filtered.length>0 && filtered.every(r=>selected[r.id])
  const toggleAll = (on)=>{ const m={...selected}; filtered.forEach(r=>m[r.id]=on); setSelected(m) }
  const openBulkDelete = ()=>{ const ids = Object.entries(selected).filter(([,on])=>on).map(([id])=>id); if(!ids.length) return; const items = recs.filter(r=>ids.includes(r.id)); setDelItems(items) }
  const confirmDelete = async ()=>{ const items = delItems||[]; if(!items.length){ setDelItems(null); return } setBulkBusy(true); try{ for(const r of items){ await api(`/zone/${zone.id}/dns_records/${r.id}`,{method:'DELETE'}); removeRec(r.id) } setSelected({}) }catch(e){ alert('Delete failed: '+e.message) } finally { setBulkBusy(false); setDelItems(null) } }
  return <div className="wrap center-page">
    <div className="header"><div className="title">DNS Manager for Zone <b className="zone-accent">{zone.name.toUpperCase()}</b></div><div style={{display:'flex',gap:8}}><button className="btn secondary" onClick={onBack}>Change Zone</button><Logout/></div></div>
    <div className="card">
      <div className="toolbar-line"><div className="toolbar-left"><select value={filterType} onChange={e=>setFilterType(e.target.value)}><option value="">All types</option>{['A','AAAA','CNAME','TXT','MX','NS','PTR'].map(t=><option key={t} value={t}>{t}</option>)}</select><input placeholder="Search type, name, content, or comment…" value={search} onChange={e=>setSearch(e.target.value)} /><button className="btn secondary" onClick={()=>{ setFilterType(''); setSearch(''); }}>Clear</button></div><div className="toolbar-right"><button className="btn danger lg" disabled={bulkBusy || !Object.values(selected).some(Boolean)} onClick={openBulkDelete}>{bulkBusy?'Deleting…':'Delete Selected'}</button></div></div>
      <div className="toolbar"><AddRecord zoneId={zone.id} onCreated={addRec} /></div>
      <div className="grid th"><div><input type="checkbox" checked={allSelected} onChange={e=>toggleAll(e.target.checked)} /></div><div>Type</div><div>Name</div><div>Content</div><div>TTL</div><div>Proxy</div><div>Actions</div></div>
      {!loading && !err && filtered.map(r=> <Row key={r.id} rec={r} zoneId={zone.id} onSaved={updateRec} onToggleSelect={onToggleSelect} selected={!!selected[r.id]} setDeleteTarget={setDelItems} />)}
      {loading && <p className="muted">Loading…</p>}
      {err && <p className="muted">Error: {err}</p>}
      <div className="footer">Powered by Cloudflare DNS API • © iAmSaugata</div>
    </div>
  </div>
}

function Login({onDone}){
  const [p,setP]=useState(''),[busy,setBusy]=useState(false),[err,setErr]=useState('')
  useEffect(()=>{ document.title='CF DNS Manager' },[])
  const go=async()=>{ setBusy(true); setErr(''); try{ localStorage.setItem('app_password',p); document.cookie=`app_password=${encodeURIComponent(p)}; Path=/; SameSite=Lax`; const r=await fetch('/api/health',{headers:{'x-app-password':p},credentials:'same-origin'}); if(!r.ok) throw new Error('Invalid password'); onDone() }catch(e){ setErr(e.message) } finally { setBusy(false) } }
  return <div className="center-full">
    <div className="card" style={{width:620}}>
      <div className="title" style={{marginBottom:8}}>Login</div>
      <p className="muted">Enter the password you configured in <b>APP_PASSWORD</b>.</p>
      <input type="password" placeholder="Password" value={p} onChange={e=>setP(e.target.value)} />
      <div className="login-actions" style={{marginTop:10,display:'flex',gap:8,justifyContent:'flex-end'}}>
        <button className="btn secondary" onClick={()=>setP('')}>Clear</button>
        <button className="btn secondary" onClick={()=>location.reload()}>Reload</button>
        <button className="btn" onClick={go} disabled={busy || !p}>{busy?'Logging…':'Login'}</button>
      </div>
      {err && <p className="muted">Error: {err}</p>}
      <div className="footer">Powered by Cloudflare DNS API • © iAmSaugata</div>
    </div>
  </div>
}
export default function App(){ const [logged,setLogged]=useState(!!localStorage.getItem('app_password')); const [zone,setZone]=useState(null); if(!logged) return <Login onDone={()=>setLogged(true)}/>; if(!zone) return <ZonePicker onPick={z=>setZone(z)}/>; return <Records zone={zone} onBack={()=>setZone(null)} /> }
