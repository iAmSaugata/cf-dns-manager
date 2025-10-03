
import React, { useEffect, useMemo, useState } from 'react';

const API = {
  async request(path, method='GET', body) {
    const pass = localStorage.getItem('app_password') || '';
    const res = await fetch(path, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'x-app-password': pass
      },
      credentials: 'include',
      body: body ? JSON.stringify(body) : undefined
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      throw j;
    }
    return res.json();
  },
  health() { return this.request('/api/health');},
  zones() { return this.request('/api/zones');},
  listRecords(zoneId) { return this.request(`/api/zone/${zoneId}/dns_records`);},
  createRecord(zoneId, payload) { return this.request(`/api/zone/${zoneId}/dns_records`, 'POST', payload);},
  updateRecord(zoneId, id, payload) { return this.request(`/api/zone/${zoneId}/dns_records/${id}`, 'PUT', payload);},
  deleteRecord(zoneId, id) { return this.request(`/api/zone/${zoneId}/dns_records/${id}`, 'DELETE');},
};

const TYPES = ['A','AAAA','CNAME','TXT','MX','NS','PTR'];

function usePassword() {
  const [pass, setPass] = useState(localStorage.getItem('app_password') || '');
  const save = (p) => {
    localStorage.setItem('app_password', p);
    document.cookie = `app_password=${encodeURIComponent(p)}; path=/; SameSite=Lax`;
    setPass(p);
  };
  const clear = () => {
    localStorage.removeItem('app_password');
    document.cookie = 'app_password=; Max-Age=0; path=/';
    setPass('');
  };
  return { pass, save, clear };
}

function CenterCard({children, title}) {
  return (
    <div className="center-wrap">
      <div className="card">
        <h2>{title}</h2>
        {children}
      </div>
    </div>
  );
}

function Login({ onSuccess }) {
  const { pass, save, clear } = usePassword();
  const [input, setInput] = useState(pass);
  const [error, setError] = useState('');
  async function tryLogin() {
    setError('');
    try {
      const res = await API.health();
      onSuccess();
    } catch (e) {
      setError(e?.error || 'Login failed');
    }
  }
  return (
    <CenterCard title="Login">
      <input type="password" placeholder="Enter password" value={input} onChange={e=>setInput(e.target.value)} />
      <div className="row">
        <button className="btn" onClick={()=>{setInput(''); clear();}}>Clear</button>
        <button className="btn" onClick={()=>window.location.reload()}>Reload</button>
        <button className="btn primary" onClick={()=>{save(input); tryLogin();}}>Login</button>
      </div>
      {error && <div className="error">{error}</div>}
    </CenterCard>
  );
}

function ZonePicker({ onOpen, onSignOut }) {
  const [zones, setZones] = useState([]);
  const [error, setError] = useState('');
  useEffect(()=>{
    API.zones().then(d=>{
      setZones(d.result || []);
    }).catch(e=>setError(e?.errors?.[0]?.message || e?.error || 'Failed to load zones'));
  },[]);
  return (
    <>
      <header className="appbar">
        <div/>
        <button className="btn" onClick={onSignOut}>Sign Out</button>
      </header>
      <CenterCard title="Select a Zone">
        <div className="zones">
          {zones.map(z=> (
            <div className="zone-card" key={z.id} onClick={()=>onOpen(z)}>
              <div className="zone-name"><b>{z.name}</b></div>
              <div className="zone-badge">{(z.plan && z.plan.name) || z.type || '—'}</div>
              <button className="btn small">Open</button>
            </div>
          ))}
          {!zones.length && !error && <div>Loading…</div>}
          {error && <div className="error">{error}</div>}
        </div>
      </CenterCard>
    </>
  );
}

function RecordForm({initial, onCancel, onSave, busy}) {
  const [form, setForm] = useState(()=> ({
    type: initial?.type || 'A',
    name: initial?.name || '',
    content: initial?.content || '',
    ttl: initial?.ttl && initial.ttl !== 1 ? initial.ttl : 1,
    proxied: !!initial?.proxied,
    priority: initial?.priority ?? 10,
    comment: initial?.comment || ''
  }));
  const canProxy = ['A','AAAA','CNAME'].includes(form.type);
  useEffect(()=>{
    if(!canProxy) {
      setForm(f=>({...f, proxied:false}));
    }
  }, [form.type]);
  return (
    <div className="modal">
      <div className="modal-card">
        <h3>{initial ? 'Edit Record' : 'Add Record'}</h3>
        <div className="form-grid">
          <label>Type</label>
          <select value={form.type} onChange={e=>setForm({...form, type:e.target.value})}>
            {TYPES.map(t=> <option key={t} value={t}>{t}</option>)}
          </select>

          <label>Name</label>
          <input value={form.name} onChange={e=>setForm({...form, name:e.target.value})} />

          <label>Content</label>
          <input value={form.content} onChange={e=>setForm({...form, content:e.target.value})} />

          <label>TTL</label>
          <input type="number" min="1" value={form.ttl} onChange={e=>setForm({...form, ttl:Number(e.target.value)})} />

          <label>Proxy</label>
          <div>
            {canProxy ? (
              <>
                <div className="label-top">PROXY</div>
                <label className="switch">
                  <input type="checkbox" checked={!!form.proxied} onChange={e=>setForm({...form, proxied:e.target.checked})} />
                  <span className="slider"></span>
                </label>
              </>
            ) : <span>DNS only</span>}
          </div>

          <label>Priority (MX)</label>
          <input type="number" disabled={form.type!=='MX'} value={form.priority} onChange={e=>setForm({...form, priority:Number(e.target.value)})} />

          <label>Comment</label>
          <input value={form.comment} onChange={e=>setForm({...form, comment:e.target.value})} placeholder="optional" />
        </div>
        <div className="row right">
          <button className="btn" disabled={busy} onClick={onCancel}>Cancel</button>
          <button className="btn primary" disabled={busy} onClick={()=>onSave(form)}>{initial ? 'Save' : 'Create'}</button>
        </div>
      </div>
    </div>
  );
}

function DnsManager({ zone, onBack, onSignOut }) {
  const [records, setRecords] = useState([]);
  const [sel, setSel] = useState({}); // id -> bool
  const [filter, setFilter] = useState('');
  const [busy, setBusy] = useState(false);
  const [showForm, setShowForm] = useState(null); // record or null
  const [error, setError] = useState('');

  const filtered = useMemo(()=>{
    const q = filter.toLowerCase();
    return records.filter(r => !q || [r.type, r.name, r.content].join(' ').toLowerCase().includes(q));
  }, [records, filter]);

  useEffect(()=>{
    document.title = `${zone.name} • DNS Manager`;
    load();
  }, [zone?.id]);

  async function load() {
    setBusy(true);
    setError('');
    try {
      const d = await API.listRecords(zone.id);
      setRecords(d.result || []);
      setSel({});
    } catch (e) {
      setError(e?.errors?.[0]?.message || e?.error || 'Failed to load records');
    } finally {
      setBusy(false);
    }
  }

  function isRestricted(r) {
    const comment = (r.comment || '').toLowerCase();
    return comment.includes('[locked]') || r.__restricted;
  }

  async function save(form) {
    setBusy(true);
    try {
      if (showForm?.id) {
        await API.updateRecord(zone.id, showForm.id, form);
      } else {
        await API.createRecord(zone.id, form);
      }
      setShowForm(null);
      await load();
    } catch (e) {
      alert(e?.errors?.[0]?.message || e?.error || 'Request failed');
    } finally {
      setBusy(false);
    }
  }

  async function del(id) {
    if (!confirm('Delete this record?')) return;
    setBusy(true);
    try {
      await API.deleteRecord(zone.id, id);
      await load();
    } catch (e) {
      alert(e?.errors?.[0]?.message || e?.error || 'Delete failed');
    } finally {
      setBusy(false);
    }
  }

  const selectedList = filtered.filter(r => sel[r.id]);

  return (
    <div className="page">
      <header className="appbar">
        <button className="btn" onClick={onBack}>Change Zone</button>
        <div className="title">DNS Manager for Zone {String(zone.name || '').toUpperCase()}</div>
        <button className="btn" onClick={onSignOut}>Sign Out</button>
      </header>

      <div className="toolbar">
        <input placeholder="Filter / search…" value={filter} onChange={e=>setFilter(e.target.value)} />
        <div className="row gap">
          <button className="btn" onClick={()=>setFilter('')}>Clear</button>
          <button className="btn danger" disabled={!selectedList.length} onClick={()=>setShowForm({__bulkDelete:true})}>Delete Selected</button>
          <button className="btn primary" onClick={()=>setShowForm({})}>Add Record</button>
        </div>
      </div>

      {error && <div className="error">{error}</div>}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Select</th><th>Type</th><th>Name</th><th>Content</th><th>TTL</th><th>Proxy</th><th>Priority</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(r => {
              const restricted = isRestricted(r);
              const canProxy = ['A','AAAA','CNAME'].includes(r.type);
              return (
                <tr key={r.id} className="row-hover">
                  <td>
                    {restricted ? <span title="Restricted 🔒">🔒</span> :
                      <input type="checkbox" checked={!!sel[r.id]} onChange={e=>setSel({...sel, [r.id]: e.target.checked})} />}
                  </td>
                  <td>{r.type}</td>
                  <td>
                    {r.name}
                    {r.comment ? <span className="comment" title={r.comment}> 📜</span> : null}
                  </td>
                  <td>{r.content}</td>
                  <td>{r.ttl === 1 ? 'Auto' : r.ttl}</td>
                  <td>{canProxy ? (r.proxied ? 'Proxied' : 'DNS only') : 'DNS only'}</td>
                  <td>{r.type === 'MX' ? (r.priority ?? '—') : '—'}</td>
                  <td>
                    {!restricted && (
                      <>
                        <button className="btn small" onClick={()=>setShowForm(r)}>Edit</button>
                        <button className="btn small danger" onClick={()=>del(r.id)}>Delete</button>
                      </>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {showForm && showForm.__bulkDelete && (
        <div className="modal">
          <div className="modal-card">
            <h3>Confirm delete</h3>
            <div className="list">
              {selectedList.map(r => <div key={r.id}>{r.type} — {r.name}</div>)}
            </div>
            <div className="row right">
              <button className="btn" onClick={()=>setShowForm(null)}>Cancel</button>
              <button className="btn danger" disabled={busy} onClick={async ()=>{
                setBusy(True)
              }}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {showForm && !showForm.__bulkDelete && (
        <RecordForm initial={showForm.id ? showForm : null} busy={busy}
          onCancel={()=>setShowForm(null)}
          onSave={save}
        />
      )}

      <footer className="footer">Powered by Cloudflare DNS API • © iAmSaugata</footer>
    </div>
  );
}

export default function App() {
  const [stage, setStage] = useState('login'); // login, zones, manage
  const [zone, setZone] = useState(null);

  function signOut() {
    localStorage.removeItem('app_password');
    document.cookie = 'app_password=; Max-Age=0; path=/';
    setStage('login');
  }

  useEffect(()=>{
    // Try a silent login
    (async ()=>{
      if (localStorage.getItem('app_password')) {
        try { await API.health(); setStage('zones'); } catch {}
      }
    })();
  }, []);

  if (stage === 'login') return <Login onSuccess={()=>setStage('zones')} />;
  if (stage === 'zones') return <ZonePicker onOpen={(z)=>{ setZone(z); setStage('manage'); }} onSignOut={signOut} />;
  if (stage === 'manage') return <DnsManager zone={zone} onBack={()=>setStage('zones')} onSignOut={signOut} />;
  return null;
}
