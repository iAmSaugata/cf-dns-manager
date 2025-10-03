import React, { useEffect, useMemo, useState } from 'react'
import { api } from './api.js'
import Modal from './modal/Modal.jsx'

const ALLOWED_TYPES = ['A','AAAA','CNAME','TXT','MX','NS','PTR']
function LockIcon(){ return <span className="lock">🔒</span> }
function truncate(s){ if (!s) return ''; return s.length > 25 ? (s.slice(0,25)+'...') : s }

export default function DnsManager({ zone, onSignOut, onChangeZone }){
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [type, setType] = useState('All')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [busy, setBusy] = useState(false)
  const [selected, setSelected] = useState({})
  const [confirmDel, setConfirmDel] = useState(false)

  const zoneNameCaps = (zone?.name || '').toUpperCase()

  useEffect(()=>{ (async ()=>{
      setLoading(true)
      try{ const d = await api.listRecords(zone.id); setRows(d.result||[]) }catch(e){ console.error(e) } finally{ setLoading(false) }
    })()
  }, [zone?.id])

  const filtered = useMemo(()=>{
    const query = q.trim().toLowerCase()
    return (rows||[]).filter(r=>{
      if (type !== 'All' && r.type !== type) return false
      if (!query) return true
      const fields = [r.type, r.name, r.content, r.comment||''].join(' ').toLowerCase()
      return fields.includes(query)
    })
  }, [rows, q, type])

  const toggleSelect = (id)=> setSelected(s=>({ ...s, [id]: !s[id] }))
  const openCreate = ()=>{ setEditing({ type:'A', name:'', content:'', ttl:1, proxied:true, priority:null, comment:'' }); setShowModal(true) }
  const openEdit = (r)=>{ setEditing({ type:r.type, name:r.name, content:r.content, ttl:r.ttl, proxied:!!r.proxied, comment:r.comment||'', priority:r.type==='MX' ? (r.priority ?? 0) : null, id:r.id }); setShowModal(true) }

  const isRestricted = (r)=> r.locked || (r.meta && (r.meta.read_only === true || r.meta.auto_added || r.meta.managed_by_apps || r.meta.managed_by_argo_tunnel))

  const save = async ()=>{
    if (!editing) return
    setBusy(true)
    try{
      const payload = {
        type: editing.type, name: editing.name, content: editing.content,
        ttl: Number(editing.ttl)||1,
        proxied: ['A','AAAA','CNAME'].includes(editing.type) ? !!editing.proxied : undefined,
        comment: editing.comment || undefined,
        priority: editing.type==='MX' ? Number(editing.priority||0) : undefined,
      }
      if (editing.id){ await api.updateRecord(zone.id, editing.id, payload) }
      else { await api.createRecord(zone.id, payload) }
      const d = await api.listRecords(zone.id); setRows(d.result||[])
      setShowModal(false); setEditing(null)
    }catch(e){ alert('Save failed: ' + e.message) }finally{ setBusy(false) }
  }

  const delSelected = async ()=>{
    const ids = Object.entries(selected).filter(([id,v])=>v).map(([id])=>id)
    if (ids.length===0) return
    setConfirmDel(false)
    for (const id of ids){ try{ await api.deleteRecord(zone.id, id) }catch(e){ console.error('Delete failed for', id, e) } }
    const d = await api.listRecords(zone.id); setRows(d.result||[]); setSelected({})
  }

  const proxyCell = (r)=> (['A','AAAA','CNAME'].includes(r.type) ? (r.proxied ? 'Proxied' : 'DNS only') : 'DNS only')
  const anySelected = Object.values(selected).some(Boolean)

  return (<>
    <div className="header">
      <div className="title">DNS Manager for Zone <span className="zone">{zoneNameCaps}</span></div>
      <div style={{display:'flex', gap:10}}>
        <button className="btn" onClick={onChangeZone}>Change Zone</button>
        <button className="btn" onClick={onSignOut}>Sign Out</button>
      </div>
    </div>
    <div className="container">

      <div className="row nowrap" style={{marginBottom:12}}>
        <select value={type} onChange={e=>setType(e.target.value)} style={{maxWidth:160}}>
          <option>All</option>
          {ALLOWED_TYPES.map(t => <option key={t}>{t}</option>)}
        </select>
        <input className="input grow" placeholder="Search (type, name, content, comment)" value={q} onChange={e=>setQ(e.target.value)} />
        <button className="btn" onClick={()=>setQ('')}>Clear</button>
      </div>

      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6}}>
        <button className="btn red" disabled={!anySelected} onClick={()=>setConfirmDel(true)}>Delete Selected</button>
        <button className="btn green" onClick={openCreate}>Add Record</button>
      </div>

      <table className="table">
        <thead>
          <tr>
            <th>Select</th><th>Type</th><th>Name</th><th>Content</th><th>TTL</th><th>Proxy</th><th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map(r => {
            const disabled = isRestricted(r)
            return (
              <tr key={r.id}>
                <td style={{textAlign:'center', width:70}}>
                  {disabled ? <LockIcon/> : <input type="checkbox" checked={!!selected[r.id]} onChange={()=>toggleSelect(r.id)} />}
                </td>
                <td>{r.type}</td>
                <td>{truncate(r.name)}{!!r.comment && <span className="tooltip" title={r.comment}>📜</span>}</td>
                <td>{truncate(r.content)}{r.type==='MX' && (r.priority ?? null) !== null ? <span className="badge-priority">{r.priority}</span> : null}</td>
                <td>{r.ttl === 1 ? 'Auto' : r.ttl}</td>
                <td>{proxyCell(r)}</td>
                <td className="actions">
                  <button className="btn" onClick={()=>!disabled && openEdit(r)} disabled={disabled} title={disabled ? 'Read-only' : 'Edit'}>Edit</button>
                  <button className="btn red" onClick={()=>{ if(!disabled){ setSelected({[r.id]:true}); setConfirmDel(true); } }} disabled={disabled} title={disabled ? 'Read-only' : 'Delete'}>Delete</button>
                </td>
              </tr>
            )
          })}
          {filtered.length===0 && !loading && <tr><td colSpan="7" style={{textAlign:'center'}}>No records</td></tr>}
        </tbody>
      </table></div>

      {showModal && (
        <Modal onClose={()=>setShowModal(false)}>
          <div className="modal-header">{editing?.id ? 'Edit Record' : 'Add Record'}</div>
          <div className="form-grid">
            <div style={{flex:'0 0 180px'}}>
              <label>Type</label>
              <select value={editing.type} onChange={e=>setEditing({...editing, type:e.target.value})}>
                {ALLOWED_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="grow">
              <label>Name</label>
              <input className="input" value={editing.name} onChange={e=>setEditing({...editing, name:e.target.value})} placeholder="e.g. app.example.com" />
            </div>
          </div>

          <div className="form-row" style={{marginTop:10}}>
            <div className="grow">
              <label>Content</label>
              <input className="input" value={editing.content} onChange={e=>setEditing({...editing, content:e.target.value})} placeholder="IPv4/IPv6/target/content" />
            </div>
            <div style={{flex:'0 0 160px'}}>
              <label>TTL</label>
              <input className="input" type="number" min="1" value={editing.ttl} onChange={e=>setEditing({...editing, ttl:e.target.value})} />
              <small className="muted">1=Auto</small>
            </div>
          </div>

          <div className="form-row-3" style={{marginTop:10}}>
            <div>
              {['A','AAAA','CNAME'].includes(editing.type) ? (
                <div className="label-inline">
                  <span>Proxy</span>
                  <label className="switch">
                    <input type="checkbox" checked={!!editing.proxied} onChange={e=>setEditing({...editing, proxied:e.target.checked})} />
                    <span className="slider"></span>
                  </label>
                </div>
              ) : (
                <div className="label-inline"><span>Proxy</span><span className="kv">DNS only</span></div>
              )}
            </div>
            <div>
              <label>Priority (MX)</label>
              <input className="input" type="number" min="0" value={editing.type==='MX' ? (editing.priority ?? 0) : 'N/A'} onChange={e=>setEditing({...editing, priority:e.target.value})} disabled={editing.type!=='MX'} />
            </div>
            <div className="grow">
              <label>Comment</label>
              <input className="input" value={editing.comment||''} onChange={e=>setEditing({...editing, comment:e.target.value})} placeholder="Optional note (shows as 📜 tooltip)" />
            </div>
          </div>

          <div className="modal-actions">
            <button className="btn" onClick={()=>setShowModal(false)} disabled={busy}>Cancel</button>
            <button className="btn green" onClick={save} disabled={busy}>{busy ? 'Saving...' : 'Save'}</button>
          </div>
        </Modal>
      )}

      {confirmDel && (
        <Modal onClose={()=>setConfirmDel(false)}>
          <div className="modal-header">Confirm Delete</div>
          <div>
            {(() => {
              const ids = Object.entries(selected).filter(([id, v])=>v).map(([id])=>id)
              if (ids.length === 1) {
                const r = rows.find(x=>x.id===ids[0])
                if (!r) return null
                return (
                  <div>
                    <div style={{marginBottom:8}}>You are about to delete this record:</div>
                    <div className="nohover"><table className="table" style={{borderSpacing: 0}}>
                      <tbody>
                        <tr><th>Type</th><td>{r.type}</td></tr>
                        <tr><th>Name</th><td>{r.name}</td></tr>
                        <tr><th>Content</th><td>{r.content}</td></tr>
                        <tr><th>TTL</th><td>{r.ttl === 1 ? 'Auto' : r.ttl}</td></tr>
                        <tr><th>Proxy</th><td>{['A','AAAA','CNAME'].includes(r.type) ? (r.proxied ? 'Proxied' : 'DNS only') : 'DNS only'}</td></tr>
                        {r.type==='MX' ? <tr><th>Priority</th><td>{r.priority ?? ''}</td></tr> : null}
                        {r.comment ? <tr><th>Comment</th><td>{r.comment}</td></tr> : null}
                      </tbody>
                    </table>
                  </div>
                )
              }
              return (
                <div>
                  <div style={{marginBottom:8}}>The following {ids.length} records will be deleted:</div>
                  <ul>
                    {ids.map(id => {
                      const r = rows.find(x=>x.id===id)
                      if (!r) return null
                      return <li key={id}><b>{r.type}</b> — {r.name}</li>
                    })}
                  </ul>
                </div>
              )
            })()}
            <div className="modal-actions">
              <button className="btn" onClick={()=>setConfirmDel(false)}>Cancel</button>
              <button className="btn red" disabled={!Object.values(selected).some(Boolean)} onClick={delSelected}>Delete Selected</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  </>)
}
