import React, { useEffect, useMemo, useState } from 'react'

const apiFetch = async (path, opts={}) => {
  const password = localStorage.getItem('app_password') || '';
  const headers = { 'Content-Type': 'application/json', ...(opts.headers||{}) };
  if (password) headers['x-app-password'] = password;
  const res = await fetch(path, { credentials:'include', ...opts, headers });
  if (!res.ok) {
    let j = null;
    try{ j = await res.json(); }catch{}
    const msg = j?.error || j?.messages?.[0] || res.statusText || 'Request failed';
    throw new Error(msg);
  }
  return res.json();
};

function Footer(){
  return (
    <div className="footer">Powered by Cloudflare DNS API • © iAmSaugata</div>
  );
}

function Header({title, right}){
  return (
    <div className="header container">
      <div className="title">{title}</div>
      <div className="btn-row">{right}</div>
    </div>
  );
}

function CenterCard({children, title}){
  return (
    <div className="container">
      <div className="card centered-panel">
        {title && <h2 style={{marginTop:0, textAlign:'center'}}>{title}</h2>}
        {children}
      </div>
    </div>
  );
}

function Login({onSuccess}){
  const [pwd,setPwd] = useState('');
  const [err,setErr] = useState('');

  const doLogin = async() => {
    setErr('');
    try{
      const j = await apiFetch('/api/health', { method:'GET', headers: {'x-app-password': pwd }});
      // store
      localStorage.setItem('app_password', pwd);
      document.cookie = `app_password=${pwd}; path=/; SameSite=Lax`;
      onSuccess();
    }catch(e){
      setErr(e.message || 'Login failed');
    }
  };

  return (
    <>
      <Header title="Cloudflare DNS Manager" right={null} />
      <CenterCard title="Login">
        <div className="grid">
          <label>Password
            <input className="input" type="password" value={pwd} onChange={e=>setPwd(e.target.value)} placeholder="Enter APP_PASSWORD" />
          </label>
          {err && <div style={{color:'#ff7a7a'}}>{err}</div>}
          <div className="btn-row" style={{justifyContent:'center'}}>
            <button className="btn" onClick={()=>setPwd('')}>Clear</button>
            <button className="btn" onClick={()=>window.location.reload()}>Reload</button>
            <button className="btn" onClick={doLogin}>Login</button>
          </div>
        </div>
      </CenterCard>
      <Footer/>
    </>
  );
}

function Zones({onOpenZone, onSignOut}){
  const [zones,setZones] = useState([]);
  const [err,setErr] = useState('');
  useEffect(()=>{
    apiFetch('/api/zones').then(j=>setZones(j.zones||[])).catch(e=>setErr(e.message||'Error'));
  },[]);

  return (
    <>
      <Header
        title="Cloudflare DNS Manager"
        right={<button className="btn" onClick={onSignOut}>Sign Out</button>}
      />
      <div className="container" style={{display:'flex', justifyContent:'center'}}>
        <div style={{width:520}}>
          {err && <div style={{color:'#ff7a7a', marginBottom:12}}>{err}</div>}
          <div className="grid">
            {zones.map(z=> (
              <div key={z.id} className="zone-card">
                <div style={{fontWeight:800}}>{z.name} <span className="badge">{z.plan} • {z.type}</span></div>
                <div className="btn-row" style={{justifyContent:'flex-start'}}>
                  <button className="btn" onClick={()=>onOpenZone(z)}>Open</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <Footer/>
    </>
  );
}

function Modal({title, children, onClose}){
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e=>e.stopPropagation()}>
        <h3>{title}</h3>
        <div>{children}</div>
      </div>
    </div>
  );
}

function DNSManager({zone, onBack, onSignOut}){
  const [records, setRecords] = useState([]);
  const [filterType, setFilterType] = useState('All');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [editRec, setEditRec] = useState(null);
  const [delRec, setDelRec] = useState(null);
  const [err, setErr] = useState('');

  const load = async() => {
    setLoading(true); setErr('');
    try{
      const j = await apiFetch(`/api/zone/${zone.id}/dns_records`);
      setRecords(j.records || []);
      document.title = zone.name.toUpperCase();
    }catch(e){
      setErr(e.message||'Error');
    }finally{ setLoading(false); }
  };

  useEffect(()=>{ load(); }, [zone.id]);

  const filtered = useMemo(()=>{
    return records.filter(r => {
      if (filterType !== 'All' && r.type !== filterType) return false;
      const q = search.trim().toLowerCase();
      if (!q) return true;
      return [r.type, r.name, r.content, r.comment].some(x => (x||'').toString().toLowerCase().includes(q));
    });
  }, [records, filterType, search]);

  const TypeOptions = ['All','A','AAAA','CNAME','TXT','MX','NS','PTR'];

  const startAdd = () => setAddOpen(true);
  const startEdit = (r) => setEditRec(r);
  const startDelete = (r) => setDelRec(r);

  const submitAdd = async(form) => {
    try{
      await apiFetch(`/api/zone/${zone.id}/dns_records`, { method:'POST', body: JSON.stringify(form) });
      setAddOpen(false);
      load();
    }catch(e){ alert(e.message); }
  };
  const submitEdit = async(id, form) => {
    try{
      await apiFetch(`/api/zone/${zone.id}/dns_records/${id}`, { method:'PUT', body: JSON.stringify(form) });
      setEditRec(null);
      load();
    }catch(e){ alert(e.message); }
  };
  const submitDelete = async(id) => {
    try{
      await apiFetch(`/api/zone/${zone.id}/dns_records/${id}`, { method:'DELETE' });
      setDelRec(null);
      load();
    }catch(e){ alert(e.message); }
  };

  const ZoneTitle = <span>DNS Manager for Zone <span style={{color:'var(--accent-strong)'}}>{zone.name.toUpperCase()}</span></span>;

  return (
    <>
      <Header
        title={ZoneTitle}
        right={<>
          <button className="btn" onClick={onBack}>Change Zone</button>
          <button className="btn" onClick={onSignOut}>Sign Out</button>
        </>}
      />
      <div className="container">
        <div className="row" style={{marginBottom:10}}>
          <select className="select" style={{maxWidth:180}} value={filterType} onChange={e=>setFilterType(e.target.value)}>
            {TypeOptions.map(t=><option key={t} value={t}>{t}</option>)}
          </select>
          <input className="input" placeholder="Search type, name, content, comment..." value={search} onChange={e=>setSearch(e.target.value)} />
          <button className="btn" onClick={()=>{ setFilterType('All'); setSearch(''); }}>Clear</button>
        </div>

        <div className="justify-between" style={{marginBottom:8}}>
          <div></div>
          <button className="btn" onClick={startAdd}>Add Record</button>
        </div>

        {err && <div style={{color:'#ff7a7a', marginBottom:12}}>{err}</div>}
        <table className="table">
          <thead>
            <tr>
              <th>Type</th>
              <th>Name</th>
              <th>Content</th>
              <th>TTL</th>
              <th>Proxy</th>
              <th>Priority</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(r => (
              <tr key={r.id}>
                <td>{r.type} {r.proxied ? <span className="tag">Proxied</span> : null}</td>
                <td>
                  <div className="row">
                    <span>{r.name}</span>
                    {!!r.comment && <span title={r.comment} className="tooltip-icon">📜</span>}
                    {r.readOnly && <span className="badge">Read-only</span>}
                  </div>
                </td>
                <td className="wrap">{r.content}</td>
                <td>{r.ttl}</td>
                <td>
                  {['A','AAAA','CNAME'].includes(r.type) ? (
                    <span>{r.proxiable ? (r.proxied ? 'On' : 'Off') : 'DNS only'}</span>
                  ) : 'DNS only'}
                </td>
                <td>{r.type === 'MX' ? (r.priority ?? '') : ''}</td>
                <td className="actions">
                  {r.readOnly ? (
                    <span className="muted">—</span>
                  ) : (
                    <>
                      <button className="btn" onClick={()=>startEdit(r)}>Edit</button>
                      <button className="btn btn-danger" onClick={()=>startDelete(r)}>Delete</button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {addOpen && <RecordModal title="Add DNS Record" onClose={()=>setAddOpen(false)} onSubmit={submitAdd} />}
        {editRec && <RecordModal title="Edit DNS Record" record={editRec} onClose={()=>setEditRec(null)} onSubmit={(f)=>submitEdit(editRec.id, f)} />}
        {delRec && <DeleteModal rec={delRec} onClose={()=>setDelRec(null)} onConfirm={()=>submitDelete(delRec.id)} />}
      </div>
      <Footer/>
    </>
  );
}

function RecordModal({title, record, onClose, onSubmit}){
  const [type,setType] = useState(record?.type || 'A');
  const [name,setName] = useState(record?.name || '');
  const [content,setContent] = useState(record?.content || '');
  const [ttl,setTtl] = useState(record?.ttl || 1);
  const [proxied,setProxied] = useState(record?.proxied || false);
  const [priority,setPriority] = useState(record?.priority ?? '');
  const [comment,setComment] = useState(record?.comment || '');
  const [busy,setBusy] = useState(false);

  const canProxy = ['A','AAAA','CNAME'].includes(type);
  const showPriority = type === 'MX';

  const submit = async () => {
    setBusy(true);
    const payload = { type, name, content, ttl: Number(ttl), comment: comment || undefined };
    if (canProxy) payload.proxied = !!proxied;
    if (showPriority) payload.priority = Number(priority)||10;
    try{
      await onSubmit(payload);
    }finally{
      setBusy(false);
    }
  };

  return (
    <Modal title={title} onClose={onClose}>
      <div className="grid">
        <label>Type
          <select className="select" value={type} onChange={e=>setType(e.target.value)}>
            {['A','AAAA','CNAME','TXT','MX','NS','PTR'].map(t=><option key={t} value={t}>{t}</option>)}
          </select>
        </label>
        <label>Name
          <input className="input" value={name} onChange={e=>setName(e.target.value)} placeholder="e.g., sub.example.com" />
        </label>
        <label>Content
          <input className="input" value={content} onChange={e=>setContent(e.target.value)} placeholder="IP, hostname, text, etc." />
        </label>
        <label>TTL
          <input className="input" type="number" min="1" value={ttl} onChange={e=>setTtl(e.target.value)} />
          {!ttl && <div className="disabled-note">TTL is required.</div>}
        </label>
        <label>Proxy
          {canProxy ? (
            <select className="select" value={proxied ? 'on':'off'} onChange={e=>setProxied(e.target.value==='on')}>
              <option value="off">Off</option>
              <option value="on">On</option>
            </select>
          ) : (
            <>
              <input className="input" disabled value="DNS only" />
              <div className="disabled-note">Proxy toggle is only available for A/AAAA/CNAME.</div>
            </>
          )}
        </label>
        <label>Priority (MX only)
          {showPriority ? (
            <input className="input" type="number" value={priority} onChange={e=>setPriority(e.target.value)} />
          ) : (
            <>
              <input className="input" disabled value="N/A" />
              <div className="disabled-note">Priority applies only to MX records.</div>
            </>
          )}
        </label>
        <label>Comment (optional) <span title="Comment is shown via 📜 tooltip in the list.">📜</span>
          <input className="input" value={comment} onChange={e=>setComment(e.target.value)} placeholder="Add a helpful note" />
          <div className="help">This will show as a 📜 tooltip next to the Name in the table.</div>
        </label>
        <div className="footer" style={{display:'flex', gap:10, justifyContent:'flex-end'}}>
          <button className="btn" disabled={busy} onClick={onClose}>Cancel</button>
          <button className="btn" disabled={busy} onClick={submit}>Save</button>
        </div>
      </div>
    </Modal>
  );
}

function DeleteModal({rec, onClose, onConfirm}){
  return (
    <Modal title="Confirm Delete" onClose={onClose}>
      <p>Are you sure you want to delete this record?</p>
      <ul>
        <li><b>Type:</b> {rec.type}</li>
        <li><b>Name:</b> {rec.name}</li>
        <li><b>Content:</b> {rec.content}</li>
      </ul>
      <div className="footer">
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn btn-danger" onClick={onConfirm}>Delete</button>
      </div>
    </Modal>
  );
}

export default function App(){
  const [view,setView] = useState('login');
  const [zone,setZone] = useState(null);

  useEffect(()=>{
    // Try silent health check
    const stored = localStorage.getItem('app_password');
    if (stored){
      apiFetch('/api/health').then(()=>setView('zones')).catch(()=>setView('login'));
    }
  },[]);

  const signOut = ()=>{
    localStorage.removeItem('app_password');
    document.cookie = 'app_password=; Max-Age=0; path=/;';
    setView('login');
  };

  if (view === 'login') return <Login onSuccess={()=>setView('zones')} />;
  if (view === 'zones') return <Zones onOpenZone={(z)=>{ setZone(z); setView('dns'); }} onSignOut={signOut} />;
  if (view === 'dns') return <DNSManager zone={zone} onBack={()=>setView('zones')} onSignOut={signOut} />;
  return null;
}
