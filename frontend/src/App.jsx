import React, { useEffect, useMemo, useState } from 'react'

const API = {
  async request(path, opts={}){
    const password = localStorage.getItem('app_password') || ''
    const res = await fetch(path, {
      ...opts,
      headers: {
        'Content-Type':'application/json',
        'x-app-password': password,
        ...(opts.headers||{})
      },
      credentials: 'include'
    })
    if(!res.ok){
      let j
      try { j = await res.json() } catch { j = { error: await res.text() } }
      throw Object.assign(new Error('Request failed'), { status: res.status, body: j })
    }
    const ct = res.headers.get('content-type') || ''
    if (ct.includes('application/json')) return res.json()
    return res.text()
  },
  health(){ return this.request('/api/health') },
  zones(){ return this.request('/api/zones') },
  list(zoneId, params={}){
    const q = new URLSearchParams(params).toString()
    return this.request(`/api/zone/${zoneId}/dns_records${q ? ('?'+q):''}`)
  },
  create(zoneId, payload){ return this.request(`/api/zone/${zoneId}/dns_records`, { method:'POST', body: JSON.stringify(payload) }) },
  update(zoneId, id, payload){ return this.request(`/api/zone/${zoneId}/dns_records/${id}`, { method:'PUT', body: JSON.stringify(payload) }) },
  remove(zoneId, id){ return this.request(`/api/zone/${zoneId}/dns_records/${id}`, { method:'DELETE' }) },
}

function useAuth(){
  const [password, setPassword] = useState(localStorage.getItem('app_password') || '')
  const [ok, setOk] = useState(false)
  const [error, setError] = useState('')
  const login = async () => {
    setError('')
    try {
      localStorage.setItem('app_password', password)
      // attempt a harmless call to validate
      await API.health()
      setOk(true)
      // also set cookie
      document.cookie = `app_password=${encodeURIComponent(password)}; path=/; max-age=864000`
    } catch(e){
      setOk(false)
      setError('Invalid password')
      localStorage.removeItem('app_password')
    }
  }
  const logout = () => {
    localStorage.removeItem('app_password')
    document.cookie = 'app_password=; Max-Age=0; path=/'
    setOk(false)
  }
  return { password, setPassword, ok, setOk, login, logout, error }
}

function CenterCard({title, children}){
  return (
    <div className="card">
      <div className="title" style={{marginBottom:12}}>{title}</div>
      {children}
    </div>
  )
}

function Login({auth}){
  useEffect(()=>{ document.title = 'Cloudflare DNS Manager • Login' },[])
  return (
    <CenterCard title="Login">
      <div className="form-row">
        <input className="input" type="password" placeholder="Password"
          value={auth.password} onChange={e=>auth.setPassword(e.target.value)} />
      </div>
      {auth.error && <div style={{color:'#ff9ea3', marginBottom:12}}>{auth.error}</div>}
      <div style={{display:'flex', gap:10, justifyContent:'space-between'}}>
        <button className="btn clear" onClick={()=>auth.setPassword('')}>Clear</button>
        <button className="btn" onClick={()=>window.location.reload()}>Reload</button>
        <button className="btn primary" onClick={auth.login}>Login</button>
      </div>
    </CenterCard>
  )
}

function Zones({onOpen, onLogout}){
  const [zones,setZones] = useState([])
  const [loading,setLoading] = useState(true)
  useEffect(()=>{
    document.title = 'Cloudflare DNS Manager'
    API.zones().then(d=>{
      setZones(d.result || [])
      setLoading(false)
      if ((d.result||[]).length===1){
        onOpen(d.result[0])
      }
    }).catch(()=>setLoading(false))
  },[])
  return (
    <>
      <header className="header">
        <div className="title">Cloudflare DNS Manager</div>
        <div style={{display:'flex', gap:10}}>
          <button className="btn" onClick={()=>window.location.reload()}>Reload</button>
          <button className="btn danger" onClick={onLogout}>Sign Out</button>
        </div>
      </header>
      <div className="zone-list">
        {loading && <div style={{opacity:.8}}>Loading zones…</div>}
        {!loading && zones.map(z=>(
          <div key={z.id} className="zone-card">
            <div className="zone-name">{z.name}</div>
            <div className="zone-badge">{(z.plan && z.plan.name) ? z.plan.name : (z.type || 'zone')}</div>
            <div style={{marginTop:10}}>
              <button className="btn primary" onClick={()=>onOpen(z)}>Open</button>
            </div>
          </div>
        ))}
      </div>
      <div className="footer">Powered by Cloudflare DNS API • © iAmSaugata</div>
    </>
  )
}

function Toggle({checked, onChange, disabled}){
  return (
    <button className="btn" disabled={disabled} onClick={()=>onChange(!checked)}>
      {checked ? 'Proxied' : 'DNS only'}
    </button>
  )
}

function Tip({text}){
  if (!text) return null
  return (
    <span className="tooltip icon" aria-label="comment">
      <span>📜</span>
      <span className="tiptext">{text}</span>
    </span>
  )
}

function Modal({title, children, onClose}){
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e=>e.stopPropagation()}>
        <div className="modal-header">
          <div className="title" style={{fontSize:20}}>{title}</div>
          <button className="btn" onClick={onClose}>✕</button>
        </div>
        <hr className="divider" />
        {children}
      </div>
    </div>
  )
}

function RecordModal({initial, onSave, onClose, saving}){
  const [form,setForm] = useState(()=> ({
    type: initial?.type || 'A',
    name: initial?.name || '',
    content: initial?.content || '',
    ttl: initial?.ttl || 300,
    proxied: (initial?.type==='A'||initial?.type==='AAAA'||initial?.type==='CNAME') ? !!initial?.proxied : false,
    priority: initial?.type==='MX' ? (initial?.priority ?? 10) : null,
    comment: initial?.comment || ''
  }))
  const isProxyAllowed = ['A','AAAA','CNAME'].includes(form.type)
  const isMX = form.type==='MX'
  useEffect(()=>{
    // Disable proxy for non-eligible types
    if (!isProxyAllowed) setForm(f=>({...f, proxied:false}))
    if (!isMX) setForm(f=>({...f, priority:null}))
  }, [form.type])

  return (
    <Modal title={initial?.id ? 'Edit Record' : 'Add Record'} onClose={onClose}>
      <div className="form-row">
        <select className="select" value={form.type} onChange={e=>setForm({...form, type:e.target.value})}>
          {['A','AAAA','CNAME','TXT','MX','NS','PTR'].map(t=><option key={t} value={t}>{t}</option>)}
        </select>
        <input className="input" placeholder="Name (relative)" value={form.name} onChange={e=>setForm({...form, name:e.target.value})} />
        <textarea className="textarea" placeholder="Content" rows="3" value={form.content} onChange={e=>setForm({...form, content:e.target.value})}></textarea>
        <input className="input" type="number" placeholder="TTL (seconds)" value={form.ttl} onChange={e=>setForm({...form, ttl: Number(e.target.value)})} />
        <div>
          <div style={{marginBottom:6}}>Proxy</div>
          <Toggle checked={!!form.proxied} onChange={v=>setForm({...form, proxied:v})} disabled={!isProxyAllowed} />
          {!isProxyAllowed && <div style={{fontSize:12, color:'#b0b7c9', marginTop:6}}>DNS only</div>}
        </div>
        <input className="input" placeholder="Priority (MX only)" type="number" value={form.priority ?? ''} onChange={e=>setForm({...form, priority: e.target.value===''? null : Number(e.target.value)})} disabled={!isMX} />
        <input className="input" placeholder="Comment (optional)" value={form.comment} onChange={e=>setForm({...form, comment:e.target.value})} />
        <div style={{fontSize:12, color:'#9fb2d9'}}>Tip: Name is relative (e.g., <code>@</code> for root, or <code>www</code> for www.example.com)</div>
      </div>
      <div className="modal-actions">
        <button className="btn" onClick={onClose} disabled={saving}>Cancel</button>
        <button className="btn primary" onClick={()=>onSave(form)} disabled={saving}>Save</button>
      </div>
    </Modal>
  )
}

function ConfirmModal({text, onConfirm, onClose, confirming}){
  return (
    <Modal title="Confirm" onClose={onClose}>
      <div style={{padding:'6px 8px 14px'}}>{text}</div>
      <div className="modal-actions">
        <button className="btn" onClick={onClose} disabled={confirming}>Cancel</button>
        <button className="btn danger" onClick={onConfirm} disabled={confirming}>Delete</button>
      </div>
    </Modal>
  )
}

function Manager({zone, onBack, onLogout}){
  const [list,setList] = useState([])
  const [loading,setLoading] = useState(true)
  const [filterType,setFilterType] = useState('All')
  const [q,setQ] = useState('')
  const [modal,setModal] = useState(null)
  const [confirm,setConfirm] = useState(null)
  const [busy,setBusy] = useState(false)

  useEffect(()=>{
    const Z = zone.name.toUpperCase()
    document.title = Z
  },[zone])

  const fetchList = ()=>{
    setLoading(true)
    API.list(zone.id).then(d=>{
      setList(d.result || [])
      setLoading(false)
    }).catch(e=>{ setLoading(false) })
  }
  useEffect(fetchList, [zone.id])

  const filtered = useMemo(()=>{
    return (list||[]).filter(r=>{
      if (filterType!=='All' && r.type!==filterType) return false
      const hay = [r.type, r.name, r.content, r.comment || ''].join(' ').toLowerCase()
      return hay.includes(q.toLowerCase())
    })
  }, [list, filterType, q])

  const addRec = ()=> setModal({})
  const editRec = (r)=> setModal(r)
  const saveRec = async (form)=>{
    setBusy(true)
    try {
      const payload = {
        type: form.type,
        name: form.name,
        content: form.content,
        ttl: Number(form.ttl) || 1,
        proxied: ['A','AAAA','CNAME'].includes(form.type) ? !!form.proxied : undefined,
        priority: form.type==='MX' ? Number(form.priority ?? 10) : undefined,
        comment: form.comment || undefined
      }
      if (modal.id){
        await API.update(zone.id, modal.id, payload)
      } else {
        await API.create(zone.id, payload)
      }
      setModal(null)
      fetchList()
    } catch(e){
      alert('Failed: '+(e.body?.message || e.message))
    } finally { setBusy(false) }
  }
  const askDelete = (r)=> setConfirm(r)
  const doDelete = async ()=>{
    if (!confirm) return
    setBusy(true)
    try{
      await API.remove(zone.id, confirm.id)
      setConfirm(null)
      fetchList()
    }catch(e){
      alert('Delete failed: '+(e.body?.message || e.message))
    }finally{ setBusy(false) }
  }

  const isReadonly = (r)=> !!(r.locked || r.readonly || (r.meta && (r.meta.auto_added || r.meta.managed_by_apps || r.meta.managed_by_argo_tunnel)))

  return (
    <>
      <header className="header">
        <div className="title">DNS Manager for Zone <span className="zone">{zone.name.toUpperCase()}</span></div>
        <div style={{display:'flex', gap:10}}>
          <button className="btn" onClick={onBack}>Change Zone</button>
          <button className="btn danger" onClick={onLogout}>Sign Out</button>
        </div>
      </header>

      <div className="toolbar">
        <select className="select" value={filterType} onChange={e=>setFilterType(e.target.value)}>
          {['All','A','AAAA','CNAME','TXT','MX','NS','PTR'].map(t=><option key={t} value={t}>{t}</option>)}
        </select>
        <input className="input" placeholder="Search type/name/content/comment" value={q} onChange={e=>setQ(e.target.value)} />
        <button className="btn clear" onClick={()=>{ setQ(''); setFilterType('All') }}>Clear</button>
      </div>

      <div style={{display:'flex', justifyContent:'flex-end', padding:'0 24px 8px'}}>
        <button className="btn primary" onClick={addRec}>Add Record</button>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Type</th>
              <th>Name</th>
              <th className="content">Content</th>
              <th>TTL</th>
              <th>Proxy</th>
              <th>Priority</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan="7" style={{padding:20, textAlign:'center'}}>Loading…</td></tr>}
            {!loading && filtered.map(r=>(
              <tr key={r.id}>
                <td>{r.type}</td>
                <td>{r.name} <Tip text={r.comment} /></td>
                <td className="content">{r.content}</td>
                <td>{r.ttl}</td>
                <td>
                  {['A','AAAA','CNAME'].includes(r.type)
                    ? <span className={r.proxied ? 'badge-proxied' : 'badge-dns'}>{r.proxied ? 'Proxied' : 'DNS only'}</span>
                    : <span className="badge-dns">DNS only</span>}
                </td>
                <td>{r.type==='MX' ? (r.priority ?? '') : ''}</td>
                <td>
                  <div className="actions">
                    {!isReadonly(r) && (
                      <>
                        <button className="btn" onClick={()=>editRec(r)}>Edit</button>
                        <button className="btn danger" onClick={()=>askDelete(r)}>Delete</button>
                      </>
                    )}
                    {isReadonly(r) && <span className="badge-dns">Read‑only</span>}
                  </div>
                </td>
              </tr>
            ))}
            {!loading && filtered.length===0 && <tr><td colSpan="7" style={{padding:20, textAlign:'center'}}>No records</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="footer">Powered by Cloudflare DNS API • © iAmSaugata</div>

      {modal && <RecordModal initial={modal} onSave={saveRec} onClose={()=>setModal(null)} saving={busy} />}
      {confirm && <ConfirmModal text={`Delete ${confirm.type} ${confirm.name}?`} onConfirm={doDelete} onClose={()=>setConfirm(null)} confirming={busy} />}
    </>
  )
}

export default function App(){
  const auth = useAuth()
  const [zone, setZone] = useState(null)

  if (!auth.ok) return <Login auth={auth} />
  if (!zone) return <Zones onOpen={setZone} onLogout={auth.logout} />
  return <Manager zone={zone} onBack={()=>setZone(null)} onLogout={auth.logout} />
}
