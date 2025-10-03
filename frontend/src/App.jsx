import React, { useEffect, useMemo, useState } from 'react'

const API = (path, opts={}) => {
  const headers = new Headers(opts.headers || {});
  const pass = localStorage.getItem('app_password');
  if (pass) headers.set('x-app-password', pass);
  return fetch(path, { ...opts, headers, credentials: 'include' });
};

function useAuth() {
  const [authed, setAuthed] = useState(false);
  const [checking, setChecking] = useState(true);
  useEffect(() => {
    (async () => {
      const res = await API('/api/health');
      setAuthed(res.ok);
      setChecking(false);
    })();
  }, []);
  return { authed, checking, setAuthed };
}

function Login({ onSuccess }) {
  const [pwd, setPwd] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const tryLogin = async () => {
    setLoading(true);
    setError('');
    const res = await fetch('/api/health', {
      headers: { 'x-app-password': pwd },
      credentials: 'include'
    });
    setLoading(false);
    if (res.ok) {
      document.cookie = `app_password=${pwd}; path=/; SameSite=Lax`;
      localStorage.setItem('app_password', pwd);
      onSuccess();
    } else {
      setError('Invalid password');
    }
  };

  const clear = () => { setPwd(''); setError(''); };
  const reload = () => { window.location.reload(); };

  return (
    <div className="page page-center">
      <div className="card">
        <div className="card-title">Login</div>
        <input type="password" className="input" placeholder="Password" value={pwd}
               onChange={e => setPwd(e.target.value)} />
        {error && <div className="error">{error}</div>}
        <div className="row gap">
          <button className="btn btn-ghost" onClick={clear} disabled={loading}>Clear</button>
          <button className="btn btn-ghost" onClick={reload} disabled={loading}>Reload</button>
          <button className="btn btn-primary" onClick={tryLogin} disabled={loading}>Login</button>
        </div>
      </div>
    </div>
  );
}

function Header({ title, onChangeZone, onLogout }) {
  return (
    <div className="header">
      <div className="title" title="Cloudflare DNS Manager">{title}</div>
      <div className="flex-spacer" />
      {onChangeZone && <button className="btn btn-ghost" onClick={onChangeZone}>Change Zone</button>}
      <button className="btn btn-ghost" onClick={onLogout}>Sign Out</button>
    </div>
  );
}

function Zones({ onOpen }) {
  const [zones, setZones] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const res = await API('/api/zones');
      if (res.ok) {
        const j = await res.json();
        setZones(j.result || []);
      }
      setLoading(false);
    })();
  }, []);

  return (
    <div className="page page-center">
      <Header title="Cloudflare DNS Manager" onChangeZone={null} onLogout={() => { localStorage.removeItem('app_password'); document.cookie='app_password=; Max-Age=0; path=/'; location.reload(); }} />
      <div className="zone-list">
        {loading ? <div className="muted">Loading zones…</div> :
          zones.map(z => (
            <div key={z.id} className="zone-card">
              <div className="zone-name"><b>{z.name}</b></div>
              <div className="badge">{z.plan} • {z.type}</div>
              <button className="btn btn-primary small" onClick={() => onOpen(z)}>Open</button>
            </div>
          ))
        }
      </div>
      <footer className="footer">Powered by Cloudflare DNS API • © iAmSaugata</footer>
    </div>
  );
}

function Modal({ open, children, onClose }) {
  if (!open) return null;
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

function Manager({ zone, onBack }) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState('All');
  const [query, setQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editRecord, setEditRecord] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const fetchRecords = async () => {
    setLoading(true);
    const res = await API(`/api/zone/${zone.id}/dns_records`);
    if (res.ok) {
      const j = await res.json();
      setRecords(j.result || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    document.title = zone.name.toUpperCase();
    fetchRecords();
  }, [zone.id]);

  const filtered = useMemo(() => {
    const t = typeFilter === 'All' ? null : typeFilter;
    const q = query.trim().toLowerCase();
    return records.filter(r => (!t || r.type === t) &&
      (!q || [r.type, r.name, r.content, r.comment || ''].join(' ').toLowerCase().includes(q)));
  }, [records, typeFilter, query]);

  function logout() {
    localStorage.removeItem('app_password');
    document.cookie='app_password=; Max-Age=0; path=/';
    location.href = '/';
  }

  return (
    <div className="page">
      <Header
        title={<span>DNS Manager for Zone <span className="zonename">{zone.name.toUpperCase()}</span></span>}
        onChangeZone={onBack}
        onLogout={logout}
      />

      <div className="row filter-row">
        <select className="input" value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
          {['All','A','AAAA','CNAME','TXT','MX','NS','PTR'].map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <input className="input" placeholder="Search type, name, content, comment" value={query} onChange={e => setQuery(e.target.value)} />
        <button className="btn btn-ghost" onClick={() => { setQuery(''); setTypeFilter('All'); }}>Clear</button>
      </div>

      <div className="row right">
        <button className="btn btn-success" onClick={() => { setEditRecord(null); setShowForm(true); }}>+ Add Record</button>
      </div>

      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Select</th>
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
            {loading ? (
              <tr><td colSpan="8" className="muted">Loading…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan="8" className="muted">No records</td></tr>
            ) : filtered.map(r => (
              <tr key={r.id} className="row-hover">
                <td>—</td>
                <td>{r.type}</td>
                <td>
                  <span title={r.name}>{(r.name || '').length > 25 ? r.name.slice(0,25)+'…' : r.name}</span>
                  {r.comment ? <span className="comment-icon" title={r.comment}> 📜</span> : null}
                </td>
                <td title={r.content}>{(r.content || '').length > 25 ? r.content.slice(0,25)+'…' : r.content}</td>
                <td>{r.ttl === 1 ? 'Auto' : r.ttl}</td>
                <td>{(r.type==='A'||r.type==='AAAA'||r.type==='CNAME') ? (r.proxied ? 'Proxied' : 'DNS only') : 'DNS only'}</td>
                <td>{r.type==='MX' ? (r.priority ?? '-') : '-'}</td>
                <td className="actions">
                  {!r.readOnly && (
                    <>
                      <button className="btn btn-ghost small" onClick={() => { setEditRecord(r); setShowForm(true); }}>Edit</button>
                      <button className="btn btn-danger small" onClick={() => setConfirmDelete(r)}>Delete</button>
                    </>
                  )}
                  {r.readOnly && <span className="muted">Read‑only</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <footer className="footer">Powered by Cloudflare DNS API • © iAmSaugata</footer>

      <Modal open={showForm} onClose={() => setShowForm(false)}>
        <RecordForm zone={zone} initial={editRecord} onDone={() => { setShowForm(false); fetchRecords(); }} />
      </Modal>

      <Modal open={!!confirmDelete} onClose={() => setConfirmDelete(null)}>
        {confirmDelete && <DeleteConfirm zone={zone} rec={confirmDelete} onDone={() => { setConfirmDelete(null); fetchRecords(); }} />}
      </Modal>
    </div>
  );
}

function RecordForm({ zone, initial, onDone }) {
  const isEdit = !!initial;
  const [form, setForm] = useState(() => ({
    type: initial?.type || 'A',
    name: initial?.name || '',
    content: initial?.content || '',
    ttl: initial?.ttl === 1 ? 1 : (initial?.ttl || 1),
    proxied: initial?.proxied || false,
    priority: initial?.priority ?? '',
    comment: initial?.comment || ''
  }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const proxySupported = ['A','AAAA','CNAME'].includes(form.type);

  async function save() {
    setSaving(true); setError('');
    const payload = { ...form };
    if (!proxySupported) { payload.proxied = false; }
    if (form.type !== 'MX') { payload.priority = undefined; }
    const path = isEdit ? `/api/zone/${zone.id}/dns_records/${initial.id}` : `/api/zone/${zone.id}/dns_records`;
    const method = isEdit ? 'PUT' : 'POST';
    const res = await API(path, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (res.ok) { onDone(); }
    else {
      const j = await res.json().catch(() => ({}));
      setError(j?.errors?.[0]?.message || j?.error || 'Failed');
    }
    setSaving(false);
  }

  return (
    <div>
      <div className="modal-title">{isEdit ? 'Edit Record' : 'Add Record'}</div>
      <div className="form-grid">
        <label>Type</label>
        <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} className="input">
          {['A','AAAA','CNAME','TXT','MX','NS','PTR'].map(t => <option key={t} value={t}>{t}</option>)}
        </select>

        <label>Name</label>
        <input className="input" placeholder="e.g., www.example.com" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />

        <label>Content</label>
        <input className="input" placeholder="IPv4/IPv6/target/etc." value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} />

        <label>TTL</label>
        <input className="input" type="number" min="1" placeholder="1 (Auto) or seconds" value={form.ttl} onChange={e => setForm({ ...form, ttl: Number(e.target.value) })} />

        <label>Proxy</label>
        {proxySupported ? (
          <button className={"btn " + (form.proxied ? "btn-primary" : "btn-ghost")} onClick={() => setForm({ ...form, proxied: !form.proxied })}>
            {form.proxied ? 'Proxied' : 'DNS only'}
          </button>
        ) : (
          <input className="input" value="DNS only" disabled />
        )}

        <label>Priority (MX only)</label>
        <input className="input" type="number" disabled={form.type!=='MX'} placeholder={form.type==='MX'?'10':'N/A'} value={form.type==='MX'?(form.priority||''):''} onChange={e => setForm({ ...form, priority: Number(e.target.value) })} />

        <label>Comment (optional)</label>
        <input className="input" placeholder="Optional note" value={form.comment} onChange={e => setForm({ ...form, comment: e.target.value })} />
      </div>
      {error && <div className="error">{error}</div>}
      <div className="row right gap">
        <button className="btn btn-ghost" onClick={onDone} disabled={saving}>Cancel</button>
        <button className="btn btn-primary" onClick={save} disabled={saving}>{isEdit ? 'Save' : 'Create'}</button>
      </div>
    </div>
  );
}

function DeleteConfirm({ zone, rec, onDone }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const doDelete = async () => {
    setLoading(true); setError('');
    const res = await API(`/api/zone/${zone.id}/dns_records/${rec.id}`, { method: 'DELETE' });
    if (res.ok) onDone();
    else {
      const j = await res.json().catch(() => ({}));
      setError(j?.errors?.[0]?.message || j?.error || 'Failed');
    }
    setLoading(false);
  };

  return (
    <div>
      <div className="modal-title">Confirm Delete</div>
      <div className="muted">You are about to delete:</div>
      <div className="box">
        <div><b>Type:</b> {rec.type}</div>
        <div><b>Name:</b> {rec.name}</div>
        <div><b>Content:</b> {rec.content}</div>
        <div><b>TTL:</b> {rec.ttl === 1 ? 'Auto' : rec.ttl}</div>
        {rec.type === 'MX' && <div><b>Priority:</b> {rec.priority ?? '-'}</div>}
      </div>
      {error && <div className="error">{error}</div>}
      <div className="row right gap">
        <button className="btn btn-ghost" onClick={onDone} disabled={loading}>Cancel</button>
        <button className="btn btn-danger" onClick={doDelete} disabled={loading}>Delete</button>
      </div>
    </div>
  );
}

export default function App() {
  const { authed, checking, setAuthed } = useAuth();
  const [zone, setZone] = useState(null);

  if (checking) return <div className="page page-center"><div className="muted">Checking…</div></div>;
  if (!authed) return <Login onSuccess={() => setAuthed(true)} />;

  if (!zone) return <Zones onOpen={setZone} />;
  return <Manager zone={zone} onBack={() => setZone(null)} />;
}
