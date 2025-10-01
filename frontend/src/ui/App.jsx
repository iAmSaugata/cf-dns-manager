import React, { useEffect, useMemo, useState } from 'react'

const api = async (p,o={})=>{
  const pw=localStorage.getItem('app_password')||''
  const r=await fetch(`/api${p}`,{...o,headers:{'x-app-password':pw,'Content-Type':'application/json',...(o.headers||{})},credentials:'same-origin',cache:'no-store'})
  let d={}; try{ d=await r.json() }catch{}
  if(!r.ok || d.success===false){ const e=new Error(d?.error||`Request failed (${r.status})`); e.status=r.status; e.payload=d; throw e }
  return d
}

const Logout=()=> <button className="btn secondary" onClick={()=>{document.cookie='app_password=; Max-Age=0; Path=/';localStorage.removeItem('app_password');location.reload()}}>Sign out</button>

function ZonePicker({onPick}){
  const [zones,setZones]=useState([]),[loading,setLoading]=useState(true),[err,setErr]=useState('')
  useEffect(()=>{(async()=>{try{const d=await api(`/zones?t=${Date.now()}`);const zs=d.result||[];setZones(zs);if(zs.length===1)onPick(zs[0])}catch(e){setErr(e.message)}finally{setLoading(false)}})()},[])
  if(loading) return <div className="center"><div className="card"><p className="muted">Loading zones…</p></div></div>
  return <div className="center" style={{alignItems:'flex-start'}}>
    <div className="wrap" style={{padding:0}}>
      <div className="header" style={{padding:'18px'}}><div className="title">Select Zone</div><Logout/></div>
      <div className="card" style={{margin:'0 18px 18px'}}>
        {err && <div className="muted">Error: {err}</div>}
        {(zones||[]).map(z=>(
          <div key={z.id} style={{display:'flex',justifyContent:'space-between',padding:'10px 0',borderBottom:'1px solid #2b3d66'}}>
            <div><b>{z.name}</b> <span className="badge">{z.plan?.name||'Free'}</span></div><button className="btn" onClick={()=>onPick(z)}>Open</button>
          </div>
        ))}
        <div className="footer">Powered by Cloudflare DNS API • © iAmSaugata</div>
      </div>
    </div>
  </div>
}

function AddRecord({zoneId,onCreated}){
  const [type,setType]=useState('A'),[name,setName]=useState(''),[content,setContent]=useState(''),[ttl,setTtl]=useState(1),[proxied,setProxied]=useState(false),[comment,setComment]=useState(''),[busy,setBusy]=useState(false),[err,setErr]=useState('')
  const add=async()=>{ setBusy(true); setErr(''); try{ const body={type,name,content,ttl:Number(ttl)}; if(comment) body.comment=comment; if(['A','AAAA','CNAME'].includes(type)) body.proxied=Boolean(proxied); const d=await api(`/zone/${zoneId}/dns_records`,{method:'POST',body:JSON.stringify(body)}); onCreated(d.result); setName(''); setContent(''); setComment(''); }catch(e){ setErr(e.message) } finally { setBusy(false) } }
  return <>
    <select value={type} onChange={e=>setType(e.target.value)}>
      {['A','AAAA','CNAME','TXT','MX','NS','SRV','CAA','PTR'].map(t=><option key={t} value={t}>{t}</option>)}
    </select>
    <input placeholder="Name (use @ for root)" value={name} onChange={e=>setName(e.target.value)} />
    <textarea placeholder="Content / Target / Value" value={content} onChange={e=>setContent(e.target.value)} />
    <select value={ttl} onChange={e=>setTtl(e.target.value)}>
      <option value={1}>Auto</option>
      {[60,120,300,600,1200,1800,3600,7200,14400,28800,43200].map(v=><option key={v} value={v}>{v}s</option>)}
    </select>
    <select value={proxied?'on':'off'} onChange={e=>setProxied(e.target.value==='on')}>
      <option value="off">DNS only</option><option value="on">Proxied</option>
    </select>
    <input placeholder="Comment (optional)" value={comment} onChange={e=>setComment(e.target.value)} />
    <button className="btn" disabled={busy || !type || !content} onClick={add}>{busy?'Adding…':'Add record'}</button>
    {err && <div className="muted" style={{gridColumn:'1 / -1'}}>Error: {err}</div>}
  </>
}

function DeleteModal({open,onClose,onConfirm,items}){
  if(!open) return null
  const one = items.length===1 ? items[0] : null
  return <div className="modal-mask" onClick={onClose}>
    <div className="modal" onClick={e=>e.stopPropagation()}>
      <h3>{one ? 'Delete DNS record?' : `Delete ${items.length} DNS records?`}</h3>
      <div className="details">
        {one ? (
          <div>
            <div className="row"><div>Type</div><div>{one.type}</div></div>
            <div className="row"><div>Name</div><div>{one.name}</div></div>
            <div className="row"><div>Content</div><div>{one.content}</div></div>
            <div className="row"><div>TTL</div><div>{one.ttl===1?'Auto':one.ttl}</div></div>
            <div className="row"><div>Proxy</div><div>{one.proxied?'Proxied':'DNS only'}</div></div>
            {one.comment ? <div className="row"><div>Comment</div><div>{one.comment}</div></div> : null}
          </div>
        ) : (
          <div style={{maxHeight:260,overflow:'auto'}}>
            {items.map(x => <div key={x.id} className="row"><div>{x.type}</div><div>{x.name} → {x.content}</div></div>)}
          </div>
        )}
      </div>
      <div className="actions">
        <button className="btn secondary" onClick={onClose}>Cancel</button>
        <button className="btn danger" onClick={onConfirm}>Delete</button>
      </div>
    </div>
  </div>
}

function Row({rec,zoneId,onSaved,onDeleted,onToggleSelect,selected,setDeleteTarget}){
  const [edit,setEdit]=useState(false),[busy,setBusy]=useState(false)
  const [type,setType]=useState(rec.type),[name,setName]=useState(rec.name),[content,setContent]=useState(rec.content),[ttl,setTtl]=useState(rec.ttl),[proxied,setProxied]=useState(Boolean(rec.proxied)),[comment,setComment]=useState(rec.comment||'')
  const save=async()=>{ setBusy(true); try{ const body={type,name,content,ttl:Number(ttl),comment}; if(['A','AAAA','CNAME'].includes(type)) body.proxied=Boolean(proxied); const d=await api(`/zone/${zoneId}/dns_records/${rec.id}`,{method:'PUT',body:JSON.stringify(body)}); onSaved(d.result); setEdit(false)}catch(e){ alert('Save failed: '+e.message) } finally{ setBusy(false) } }
  const askDelete=()=> setDeleteTarget([rec])
  if(edit){
    return <div className="row" style={{alignItems:'start'}}>
      <input type="checkbox" checked={selected} onChange={e=>onToggleSelect(rec.id,e.target.checked)} />
      <select value={type} onChange={e=>setType(e.target.value)}>{['A','AAAA','CNAME','TXT','MX','NS','SRV','CAA','PTR'].map(t=><option key={t} value={t}>{t}</option>)}</select>
      <input value={name} onChange={e=>setName(e.target.value)} />
      <textarea value={content} onChange={e=>setContent(e.target.value)} />
      <select value={ttl} onChange={e=>setTtl(e.target.value)}><option value={1}>Auto</option>{[60,120,300,600,1200,1800,3600,7200,14400,28800,43200].map(v=><option key={v} value={v}>{v}s</option>)}</select>
      <select value={proxied?'on':'off'} onChange={e=>setProxied(e.target.value==='on')}><option value="off">DNS only</option><option value="on">Proxied</option></select>
      <input placeholder="Comment" value={comment} onChange={e=>setComment(e.target.value)} />
      <div className="row-actions" style={{minWidth:170}}>
        <button className="btn" disabled={busy} onClick={save}>{busy?'Saving…':'Save'}</button>
        <button className="btn secondary" disabled={busy} onClick={()=>setEdit(false)}>Cancel</button>
      </div>
    </div>
  }
  return <div className="row">
    <input type="checkbox" checked={selected} onChange={e=>onToggleSelect(rec.id,e.target.checked)} />
    <div className="cell-wrap">{rec.type}</div>
    <div className="cell-wrap">
      {rec.comment ? (
        <span className="tooltip"><span className="info">i</span><span className="tip">{rec.comment}</span></span>
      ) : null} {rec.name}
    </div>
    <div className="cell-wrap">{rec.content}</div>
    <div className="cell-wrap">{rec.ttl===1?'Auto':rec.ttl}</div>
    <div className="cell-wrap">{rec.proxied?'Proxied':'DNS only'}</div>
    <div className="row-actions"><button className="btn" onClick={()=>setEdit(true)}>Edit</button><button className="btn danger" onClick={askDelete}>Delete</button></div>
  </div>
}

function Records({zone,onBack}){
  const [recs,setRecs]=useState([]),[loading,setLoading]=useState(true),[err,setErr]=useState('')
  const [filterType,setFilterType]=useState(''),[search,setSearch]=useState('')
  const [selected,setSelected]=useState({})
  const [deleteTarget,setDeleteTarget]=useState(null),[bulkBusy,setBulkBusy]=useState(false)

  const load=async()=>{ setLoading(true); setErr(''); try{ const d=await api(`/zone/${zone.id}/dns_records?per_page=200&t=${Date.now()}`); setRecs(d.result||[]) }catch(e){ setErr(e.message) } finally{ setLoading(false) } }
  useEffect(()=>{ load() },[zone.id])

  const updateRec = r => setRecs(p=>p.map(x=>x.id===r.id? r : x))
  const removeRec = id => setRecs(p=>p.filter(x=>x.id!==id))
  const addRec = r => setRecs(p=>[r,...p])

  const filtered = useMemo(()=>{
    const q=(search||'').toLowerCase().trim()
    return recs.filter(r=>{
      if(filterType && r.type!==filterType) return false
      if(!q) return true
      return [r.type,r.name,r.content,r.comment||''].join(' ').toLowerCase().includes(q)
    })
  },[recs,filterType,search])

  const onToggleSelect=(id,on)=> setSelected(prev=>({...prev,[id]:on}))
  const allSelected = filtered.length>0 && filtered.every(r=>selected[r.id])
  const toggleAll = (on)=>{ const m={...selected}; filtered.forEach(r=>m[r.id]=on); setSelected(m) }
  const openBulkDelete = ()=>{
    const ids = Object.entries(selected).filter(([,on])=>on).map(([id])=>id)
    if(!ids.length) return
    const items = recs.filter(r=>ids.includes(r.id))
    setDeleteTarget(items)
  }
  const confirmDelete = async ()=>{
    const items = deleteTarget||[]
    if(!items.length){ setDeleteTarget(null); return }
    setBulkBusy(true)
    try{
      for(const r of items){
        await api(`/zone/${zone.id}/dns_records/${r.id}`,{method:'DELETE'})
        removeRec(r.id)
      }
      setSelected({})
    }catch(e){ alert('Delete failed: '+e.message) } finally { setBulkBusy(false); setDeleteTarget(null) }
  }

  return <div className="wrap">
    <div className="header">
      <div className="title">DNS Manager for Zone <b>{zone.name.toUpperCase()}</b></div>
      <div style={{display:'flex',gap:8}}><button className="btn secondary" onClick={onBack}>Change zone</button><Logout/></div>
    </div>

    <div className="card">
      <div className="toolbar-line">
        <div className="toolbar-left">
          <select value={filterType} onChange={e=>setFilterType(e.target.value)}>
            <option value="">All types</option>
            {['A','AAAA','CNAME','TXT','MX','NS','SRV','CAA','PTR'].map(t=><option key={t} value={t}>{t}</option>)}
          </select>
          <input placeholder="Search type, name, content, or comment…" value={search} onChange={e=>setSearch(e.target.value)} />
          <button className="btn secondary" onClick={()=>{ setFilterType(''); setSearch(''); }}>Clear</button>
        </div>
        <div className="toolbar-right">
          <button className="btn danger" disabled={bulkBusy || !Object.values(selected).some(Boolean)} onClick={openBulkDelete}>
            {bulkBusy?'Deleting…':'Delete selected'}
          </button>
        </div>
      </div>

      <div className="toolbar">
        <AddRecord zoneId={zone.id} onCreated={addRec} />
      </div>

      </div>

      {loading && <p className=\"muted\">Loading…</p>}      </div>

      {loading && <p className="muted">Loading…</p>}
      {err && <p className="muted">Error: {err}</p>}

      {!loading && !err && <>
        <div className="grid th"><div><input type="checkbox" checked={allSelected} onChange={e=>toggleAll(e.target.checked)} /></div><div>Type</div><div>Name</div><div>Content</div><div>TTL</div><div>Proxy</div><div>Actions</div></div>
        {filtered.map(r=> <Row key={r.id} rec={r} zoneId={zone.id} onSaved={updateRec} onDeleted={()=>removeRec(r.id)} onToggleSelect={onToggleSelect} selected={!!selected[r.id]} setDeleteTarget={setDeleteTarget} />)}
      </>}

      <div className="footer">Powered by Cloudflare DNS API • © iAmSaugata</div>
    </div>

    <DeleteModal open={!!deleteTarget} items={deleteTarget||[]} onClose={()=>setDeleteTarget(null)} onConfirm={confirmDelete} />
  </div>
}

function Login({onDone}){
  const [p,setP]=useState(''),[busy,setBusy]=useState(false),[err,setErr]=useState('')
  const go=async()=>{ setBusy(true); setErr(''); try{ localStorage.setItem('app_password',p); document.cookie=`app_password=${encodeURIComponent(p)}; Path=/; SameSite=Lax`; const r=await fetch('/api/health',{headers:{'x-app-password':p},credentials:'same-origin'}); if(!r.ok) throw new Error('Invalid password'); onDone() }catch(e){ setErr(e.message) } finally { setBusy(false) } }
  return <div className="center"><div className="card" style={{width:'100%',maxWidth:520,padding:'22px'}}><div className="title" style={{marginBottom:8}}>Login</div><p className="muted">Enter the password you configured in <b>APP_PASSWORD</b>.</p><input type="password" placeholder="Password" value={p} onChange={e=>setP(e.target.value)} /><div className="login-actions" style={{marginTop:12}}><button className="btn secondary" onClick={()=>setP('')}>Clear</button><button className="btn secondary" onClick={()=>location.reload()}>Reload</button><button className="btn" disabled={busy||!p} onClick={go}>{busy?'Checking…':'Login'}</button></div>{err && <p className="muted">Error: {err}</p>}<div className="footer">Powered by Cloudflare DNS API • © iAmSaugata</div></div></div>
}

export default function App(){ const [logged,setLogged]=useState(!!localStorage.getItem('app_password')); const [zone,setZone]=useState(null); if(!logged) return <Login onDone={()=>setLogged(true)}/>; if(!zone) return <ZonePicker onPick={z=>setZone(z)}/>; return <Records zone={zone} onBack={()=>setZone(null)} /> }
