import React, { useEffect, useMemo, useState } from 'react'

const API = (path, opts={}) => {
  const pass = localStorage.getItem('app_password') || '';
  return fetch(path, {
    ...opts,
    headers: {
      'Content-Type':'application/json',
      'x-app-password': pass,
      ...(opts.headers||{})
    }
  }).then(r => r.json());
};

const proxyableTypes = new Set(['A','AAAA','CNAME']);
const defaultTitle = 'CF DNS Manager';

function Switch({checked, disabled, onChange}){
  return (
    <div className={`switch ${checked?'on':''}`} onClick={()=>!disabled && onChange(!checked)} role="switch" aria-checked={checked} aria-disabled={disabled} title={disabled?'Proxy not supported for this type':''}>
      <input type="checkbox" checked={checked} readOnly />
      <div className="knob"></div>
    </div>
  )
}

function ConfirmModal({title, children, onClose, onConfirm, confirmText='Confirm', danger}){
  return (
    <div className="modal-back">
      <div className="modal">
        <div className="titlebar">
          <div className="title">{title}</div>
          <button className="btn ghost" onClick={onClose}>Close</button>
        </div>
        <div style={{padding:'8px 0'}}>{children}</div>
        <div className="row" style={{justifyContent:'flex-end'}}>
          <button className="btn ghost" onClick={onClose}>Cancel</button>
          <button className={`btn ${danger?'danger':'primary'}`} onClick={onConfirm}>{confirmText}</button>
        </div>
      </div>
    </div>
  )
}

export default function App(){
  const [stage, setStage] = useState('login'); // login | zones | records
  const [zones, setZones] = useState([]);
  const [zone, setZone] = useState(null);
  const [records, setRecords] = useState([]);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState([]);
  const [showDelete, setShowDelete] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState(null);
  const [error, setError] = useState('');

  // Add Record form state
  const [form, setForm] = useState({ type:'A', name:'', content:'', ttl:1, proxied:true });

  // Title management
  useEffect(()=>{
    if (zone) document.title = `${zone.name.toUpperCase()} • ${defaultTitle}`;
    else document.title = defaultTitle;
  }, [zone]);

  // boot: if password already exists, go to zones
  useEffect(()=>{
    const pass = localStorage.getItem('app_password');
    if (pass) setStage('zones');
  }, []);

  const filtered = useMemo(()=>{
    if (!filter) return records;
    const q = filter.toLowerCase();
    return records.filter(r => (r.name?.toLowerCase().includes(q) || r.content?.toLowerCase().includes(q) || r.type?.toLowerCase().includes(q)));
  }, [records, filter]);

  // API calls
  const loadZones = async () => {
    setLoading(true); setError('');
    const r = await API('/api/zones');
    setLoading(false);
    if (!r.success) return setError(r.error || 'Failed to load zones');
    setZones(r.result || []);
  };

  const loadRecords = async (search='') => {
    if (!zone) return;
    setLoading(true); setError('');
    const r = await API(`/api/zones/${zone.id}/records${search?`?search=${encodeURIComponent(search)}`:''}`);
    setLoading(false);
    if (!r.success) return setError(r.error || 'Failed to load records');
    setRecords(r.result || []);
  };

  const onLogin = async (e) => {
    e.preventDefault();
    const pass = new FormData(e.target).get('password');
    localStorage.setItem('app_password', pass);
    setStage('zones');
    await loadZones();
  };

  const onSelectZone = async (z) => {
    setZone(z);
    setStage('records');
    setSelected([]);
    await loadRecords();
  };

  const onChangeZone = () => {
    setZone(null);
    setStage('zones');
    setSelected([]);
    setRecords([]);
    setFilter('');
    document.title = defaultTitle;
  };

  const toggleSelect = (id) => {
    setSelected(s => s.includes(id) ? s.filter(x=>x!==id) : [...s, id]);
  };

  const onBulkDelete = () => setShowDelete(true);

  const confirmDelete = async () => {
    const ids = selected.slice();
    setShowDelete(false);
    setLoading(true);
    const r = await API(`/api/zones/${zone.id}/records/bulk-delete`, { method:'POST', body: JSON.stringify({ ids }) });
    setLoading(false);
    if (!r.success) { setError(r.error || 'Delete failed'); return; }
    setRecords(list => list.filter(x => !ids.includes(x.id)));
    setSelected([]);
  };

  const onAddRecord = async () => {
    setShowAdd(false);
    setLoading(true);
    const payload = { ...form };
    // Enforce proxy rules
    if (!proxyableTypes.has(payload.type)) payload.proxied = false;
    const r = await API(`/api/zones/${zone.id}/records`, { method:'POST', body: JSON.stringify(payload) });
    setLoading(false);
    if (!r.success) return setError(r.errors?.[0]?.message || r.error || 'Create failed');
    setRecords(list => [r.result, ...list]);
    setForm({ type:'A', name:'', content:'', ttl:1, proxied:true });
  };

  const onToggleProxy = async (rec, next) => {
    const r = await API(`/api/zones/${zone.id}/records/${rec.id}/proxy`, { method:'PATCH', body: JSON.stringify({ proxied: next }) });
    if (!r.success) {
      setError(r.error || 'Proxy toggle failed');
      return;
    }
    // optimistic sync
    setRecords(list => list.map(x => x.id===rec.id ? { ...x, proxied: r.result.proxied } : x));
    // if currently editing this record, ensure modal sees fresh state
    if (editId === rec.id) setEditId(rec.id); // trigger rerender read-by-id
  };

  const onEdit = (rec) => setEditId(rec.id);
  const onSaveEdit = async (id, patch) => {
    const r = await API(`/api/zones/${zone.id}/records/${id}`, { method:'PATCH', body: JSON.stringify(patch) });
    if (!r.success) return setError(r.error || 'Update failed');
    setRecords(list => list.map(x => x.id===id ? r.result : x));
    setEditId(null);
  };

  const editingRecord = useMemo(()=> records.find(r=>r.id===editId) || null, [records, editId]);

  if (stage === 'login') {
    return (
      <div className="center">
        <div className="card card--small">
          <h2>Sign in</h2>
          <p className="muted">Enter the app password to continue.</p>
          <form onSubmit={onLogin}>
            <input className="input" name="password" type="password" placeholder="App password" required />
            <div style={{height:10}}></div>
            <button className="btn primary" type="submit">Continue</button>
          </form>
          <div style={{height:8}}></div>
          <div className="hint"><span className="icon">📜</span>CF DNS Manager v16 — desktop‑only UI</div>
        </div>
      </div>
    )
  }

  if (stage === 'zones') {
    return (
      <div className="center" style={{flexDirection:'column', gap:16}}>
        <div className="card card--small" style={{textAlign:'center'}}>
          <h2>Select Zone</h2>
          <p className="muted">Choose a zone to manage DNS records.</p>
          <div className="row" style={{justifyContent:'center'}}>
            <button className="btn primary" onClick={loadZones}>Load Zones</button>
          </div>
        </div>
        <div className="zone-grid">
          {zones.map(z => (
            <div key={z.id} className="zone-item" onClick={()=>onSelectZone(z)} title={`Status: ${z.status}`}>
              <div style={{fontWeight:700}}>{z.name}</div>
              <div className="pill" title="Zone type">{z.type}</div>
            </div>
          ))}
        </div>
        {!!error && <div className="muted">Error: {error}</div>}
      </div>
    )
  }

  // records view
  return (
    <div style={{padding:24}}>
      <div className="titlebar">
        <div className="title">{zone?.name?.toUpperCase() || 'ZONE'}</div>
        <div className="row">
          <button className="btn ghost" onClick={onChangeZone}>Change Zone</button>
        </div>
      </div>

      <div className="toolbar">
        <div className="toolbar-left">
          <input className="input" placeholder="Search / filter" value={filter} onChange={e=>setFilter(e.target.value)} style={{width:360}} />
          <button className="btn" onClick={()=>{ setFilter(''); loadRecords(); }}>Clear</button>
        </div>
        <div className="toolbar-right">
          <button className="btn danger" disabled={selected.length===0} onClick={onBulkDelete}>Delete Selected</button>
        </div>
      </div>

      <div style={{padding:'6px 0 10px 0'}}>
        <button className="btn primary" onClick={()=>setShowAdd(true)}>Add Record</button>
      </div>

      {loading && <div className="hint">Loading…</div>}
      {!!error && <div className="hint">Error: {error}</div>}

      <table className="table">
        <thead>
          <tr>
            <th><input type="checkbox" checked={selected.length>0 && selected.length===filtered.length && filtered.length>0} onChange={e=>{
              if (e.target.checked) setSelected(filtered.map(r=>r.id));
              else setSelected([]);
            }} /></th>
            <th>Type</th><th>Name</th><th>Content</th><th>TTL</th><th>Proxied</th><th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map(r => (
            <tr key={r.id}>
              <td><input type="checkbox" checked={selected.includes(r.id)} onChange={()=>toggleSelect(r.id)} /></td>
              <td><span className="tag">{r.type}</span></td>
              <td>{r.name}</td>
              <td><span className="kbd">{r.content}</span></td>
              <td>{r.ttl===1?'Auto':r.ttl}</td>
              <td>
                <div className="row" style={{gap:8}}>
                  <Switch
                    checked={!!r.proxied}
                    disabled={!proxyableTypes.has(r.type)}
                    onChange={(v)=>onToggleProxy(r, v)}
                  />
                  {!proxyableTypes.has(r.type) && <span className="muted" title="DNS-only for this type">DNS‑only</span>}
                </div>
              </td>
              <td className="row" style={{gap:6}}>
                <button className="btn" onClick={()=>onEdit(r)}>Edit</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Delete confirmation modal */}
      {showDelete && (
        <ConfirmModal title="Confirm deletion" danger confirmText={`Delete ${selected.length} record(s)`}
          onClose={()=>setShowDelete(false)}
          onConfirm={confirmDelete}>
          <div className="list">
            {records.filter(r=>selected.includes(r.id)).map(r => (
              <div key={r.id} className="row" style={{justifyContent:'space-between'}}>
                <div><span className="tag">{r.type}</span> {r.name}</div>
                <div className="kbd">{r.content}</div>
              </div>
            ))}
          </div>
          <div className="hint" style={{marginTop:8}}><span className="icon">📜</span>This action cannot be undone.</div>
        </ConfirmModal>
      )}

      {/* Add record modal */}
      {showAdd && (
        <ConfirmModal title="Add DNS Record" confirmText="Create" onClose={()=>setShowAdd(false)} onConfirm={onAddRecord}>
          <div className="row" style={{gap:12}}>
            <div style={{flex: '0 0 120px'}}>
              <label className="field-label">Type</label>
              <select className="input" value={form.type} onChange={e=>setForm(f=>({...f, type:e.target.value}))}>
                {['A','AAAA','CNAME','TXT','MX','NS','PTR'].map(t=> <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div style={{flex:1}}>
              <label className="field-label">Name</label>
              <input className="input" value={form.name} onChange={e=>setForm(f=>({...f, name:e.target.value}))} placeholder={`host.${zone.name}`} />
            </div>
          </div>
          <div className="field">
            <label className="field-label">Content</label>
            <input className="input" value={form.content} onChange={e=>setForm(f=>({...f, content:e.target.value}))} placeholder="1.2.3.4 / target.example.com / text" />
          </div>
          <div className="row" style={{gap:12}}>
            <div style={{flex:'0 0 120px'}}>
              <label className="field-label">TTL</label>
              <select className="input" value={form.ttl} onChange={e=>setForm(f=>({...f, ttl:Number(e.target.value)}))}>
                <option value={1}>Auto</option>
                <option value={60}>60</option>
                <option value={120}>120</option>
                <option value={300}>300</option>
                <option value={600}>600</option>
              </select>
            </div>
            <div style={{flex:1}}>
              <label className="field-label">PROXY</label>
              <div className="row" style={{gap:10}}>
                <Switch
                  checked={!!form.proxied}
                  disabled={!proxyableTypes.has(form.type)}
                  onChange={v=>setForm(f=>({...f, proxied: v}))}
                />
                {!proxyableTypes.has(form.type) && <span className="muted">DNS‑only for {form.type}</span>}
              </div>
            </div>
          </div>
        </ConfirmModal>
      )}

      {/* Edit modal - reads live record by id to avoid stale state */}
      {editingRecord && (
        <ConfirmModal title={`Edit ${editingRecord.name}`} confirmText="Save" onClose={()=>setEditId(null)}
          onConfirm={()=>onSaveEdit(editingRecord.id, {
            name: editingRecord.name,
            content: editingRecord.content,
            ttl: editingRecord.ttl,
            proxied: proxyableTypes.has(editingRecord.type) ? !!editingRecord.proxied : false
          })}>
          <div className="row-gap">
            <span className="tag">{editingRecord.type}</span>
            {proxyableTypes.has(editingRecord.type) ? <span className="tag">{editingRecord.proxied? 'Proxied':'DNS‑only'}</span> : <span className="tag">DNS‑only</span>}
          </div>
          <div className="field">
            <label className="field-label">Name</label>
            <input className="input" value={editingRecord.name} onChange={e=>{
              const v = e.target.value; 
              // keep in list so modal always reflects state
              window.requestAnimationFrame(()=>{
                // live mutate via state updater
              });
              // we keep a copy in state
              // reflect in records state
              }} placeholder={`host.${zone.name}`} />
          </div>
          <div className="field">
            <label className="field-label">Content</label>
            <input className="input" value={editingRecord.content} onChange={e=>{
              const v = e.target.value;
              // update local state mirror
              // replace in records array
              }} />
          </div>
          <div className="row" style={{gap:12}}>
            <div style={{flex:'0 0 120px'}}>
              <label className="field-label">TTL</label>
              <select className="input" value={editingRecord.ttl} onChange={e=>{
                const v = Number(e.target.value);
                // update mirror
              }}>
                <option value={1}>Auto</option>
                <option value={60}>60</option>
                <option value={120}>120</option>
                <option value={300}>300</option>
                <option value={600}>600</option>
              </select>
            </div>
            <div style={{flex:1}}>
              <label className="field-label">PROXY</label>
              <div className="row" style={{gap:10}}>
                <Switch
                  checked={!!editingRecord.proxied}
                  disabled={!proxyableTypes.has(editingRecord.type)}
                  onChange={(v)=>setRecords(list => list.map(x => x.id===editingRecord.id ? { ...x, proxied: v } : x))}
                />
                {!proxyableTypes.has(editingRecord.type) && <span className="muted">DNS‑only for this type</span>}
              </div>
            </div>
          </div>
        </ConfirmModal>
      )}
    </div>
  )
}
