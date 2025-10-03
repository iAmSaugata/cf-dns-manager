import React, { useEffect, useMemo, useState } from 'react'
import { api } from '../api.js'

const TYPES = ['All','A','AAAA','CNAME','TXT','MX','NS','SRV','CAA','PTR'] // UI filter includes SRV/CAA but API filters result set
const PROXY_TYPES = new Set(['A','AAAA','CNAME'])

function isReadOnly(rec) {
  return !!(rec.locked || rec.meta?.managed_by_apps || rec.meta?.managed_by_argo_tunnel || rec.meta?.auto_added)
}

function nameWithTooltip(rec) {
  if (rec.comment) {
    return <span title={rec.comment}>📜 {rec.name}</span>
  }
  return <span>{rec.name}</span>
}

export default function DnsManager({ zone, onChangeZone, onSignOut }) {
  const [records, setRecords] = useState([])
  const [search, setSearch] = useState('')
  const [type, setType] = useState('All')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState({})
  const [editing, setEditing] = useState(null) // record or placeholder
  const [busy, setBusy] = useState(false)
  const zoneNameCaps = (zone?.name || '').toUpperCase()

  useEffect(() => {
    document.title = zoneNameCaps
    load()
  }, [zone?.id])

  async function load() {
    setLoading(true)
    setError('')
    try {
      const data = await api.listRecords(zone.id)
      setRecords(data.result || [])
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const filtered = useMemo(() => {
    return records.filter(r => {
      if (type !== 'All' && r.type !== type) return false
      const q = search.trim().toLowerCase()
      if (!q) return true
      const hay = [r.type, r.name, r.content, r.comment || ''].join(' ').toLowerCase()
      return hay.includes(q)
    })
  }, [records, search, type])

  function toggleSelect(id) {
    setSelected(s => ({ ...s, [id]: !s[id] }))
  }

  function clearSelection() {
    setSelected({})
  }

  function openAdd() {
    setEditing({ id: null, type: 'A', name: '', content: '', ttl: 300, proxied: true, priority: undefined, comment: '' })
  }

  function openEdit(rec) {
    setEditing({ ...rec })
  }

  function cancelEdit() {
    setEditing(null)
  }

  async function saveEdit() {
    if (!editing) return
    setBusy(true)
    try {
      const body = {
        type: editing.type,
        name: editing.name,
        content: editing.content,
        ttl: Number(editing.ttl) || 1,
        comment: editing.comment || undefined
      }
      if (PROXY_TYPES.has(editing.type)) body.proxied = !!editing.proxied
      if (editing.type === 'MX') body.priority = Number(editing.priority) || 0

      if (editing.id) {
        await api.updateRecord(zone.id, editing.id, body)
      } else {
        await api.createRecord(zone.id, body)
      }
      await load()
      setEditing(null)
    } catch (e) {
      alert(e.message)
    } finally {
      setBusy(false)
    }
  }

  async function deleteSelected() {
    const ids = Object.entries(selected).filter(([,v]) => v).map(([k]) => k)
    if (!ids.length) return
    const items = records.filter(r => ids.includes(r.id)).map(r => `${r.type} ${r.name}`).join('\n')
    if (!confirm(`Delete these records?\n\n${items}`)) return
    setBusy(true)
    try {
      for (const id of ids) {
        const rec = records.find(r => r.id === id)
        if (rec && !isReadOnly(rec)) {
          await api.deleteRecord(zone.id, id)
        }
      }
      await load()
      clearSelection()
    } catch (e) {
      alert(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page">
      <header className="header">
        <h1>DNS Manager for Zone <span className="zone-caps">{zoneNameCaps}</span></h1>
        <div className="header-actions">
          <button className="btn" onClick={onChangeZone}>Change Zone</button>
          <button className="btn" onClick={onSignOut}>Sign Out</button>
          <button className="btn primary" onClick={openAdd}>Add Record</button>
          <div className="filter-row">
            <select value={type} onChange={e => setType(e.target.value)}>
              {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <input placeholder="Search type, name, content, comment" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <button className="btn danger" disabled={!Object.values(selected).some(Boolean)} onClick={deleteSelected}>
            Delete Selected
          </button>
        </div>
      </header>

      {loading && <div className="center">Loading...</div>}
      {error && <div className="error center">{error}</div>}

      {!loading && !editing && (
        <table className="records">
          <thead>
            <tr>
              <th></th>
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
            {filtered.map(r => {
              const ro = isReadOnly(r)
              const proxyCell = PROXY_TYPES.has(r.type)
                ? <input type="checkbox" disabled readOnly checked={!!r.proxied} />
                : <span>DNS only</span>
              return (
                <tr key={r.id} className="row">
                  <td>
                    {ro ? '🔒' : <input type="checkbox" checked={!!selected[r.id]} onChange={() => toggleSelect(r.id)} />}
                  </td>
                  <td>{r.type}</td>
                  <td className="wrap">{nameWithTooltip(r)}</td>
                  <td className="wrap">{r.content}</td>
                  <td>{r.ttl}</td>
                  <td>{proxyCell}</td>
                  <td>{r.type === 'MX' ? (r.priority ?? '') : ''}</td>
                  <td>
                    {!ro && <button className="btn small" onClick={() => openEdit(r)}>Edit</button>}
                    {!ro && <button className="btn small danger" onClick={() => { setSelected({ [r.id]: true }); deleteSelected() }}>Delete</button>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}

      {editing && (
        <div className="edit-panel">
          <div className="form-grid">
            <label>Type</label>
            <select value={editing.type} onChange={e => setEditing({ ...editing, type: e.target.value })}>
              {['A','AAAA','CNAME','TXT','MX','NS','PTR'].map(t => <option key={t} value={t}>{t}</option>)}
            </select>

            <label>Name</label>
            <input value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} placeholder="e.g., www or @ or sub.domain.com" />

            <label>Content</label>
            <input value={editing.content} onChange={e => setEditing({ ...editing, content: e.target.value })} placeholder="IPv4/IPv6, target, or text" />

            <label>TTL</label>
            <input type="number" value={editing.ttl} onChange={e => setEditing({ ...editing, ttl: e.target.value })} />

            <label>Proxy</label>
            <div className="proxy-cell">
              {PROXY_TYPES.has(editing.type) ? (
                <>
                  <div className="proxy-label">PROXY</div>
                  <label className="switch">
                    <input type="checkbox" checked={!!editing.proxied} onChange={e => setEditing({ ...editing, proxied: e.target.checked })} />
                    <span className="slider"></span>
                  </label>
                </>
              ) : (
                <span>DNS only</span>
              )}
            </div>

            <label>Priority (MX)</label>
            <input type="number" disabled={editing.type !== 'MX'} value={editing.type === 'MX' ? (editing.priority ?? 0) : ''} onChange={e => setEditing({ ...editing, priority: e.target.value })} />

            <label>Comment</label>
            <input value={editing.comment || ''} onChange={e => setEditing({ ...editing, comment: e.target.value })} placeholder="Optional notes (shown via 📜 tooltip)" />
          </div>

          <div className="btn-row right">
            <button className="btn" disabled={busy} onClick={cancelEdit}>Cancel</button>
            <button className="btn primary" disabled={busy} onClick={saveEdit}>{editing.id ? 'Save' : 'Create'}</button>
          </div>
        </div>
      )}

      <footer>Powered by Cloudflare DNS API • © iAmSaugata</footer>
    </div>
  )
}
