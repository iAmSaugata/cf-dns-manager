import React, { useEffect, useState } from 'react'
import { api } from '../api.js'

export default function ZoneSelect({ onOpen, onSignOut }) {
  const [zones, setZones] = useState([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')

  useEffect(() => {
    document.title = 'Cloudflare DNS Manager'
    api.zones().then(z => {
      setZones(z.result || [])
      setLoading(false)
    }).catch(e => { setErr(e.message); setLoading(false) })
  }, [])

  return (
    <div className="page">
      <header className="header">
        <h1>Cloudflare DNS Manager</h1>
        <div className="header-actions">
          <button className="btn" onClick={onSignOut}>Sign Out</button>
        </div>
      </header>

      <h2 className="center-title">Zone Selection</h2>

      {loading && <div className="center">Loading...</div>}
      {err && <div className="error center">{err}</div>}

      <div className="zones-grid">
        {zones.map(z => (
          <div key={z.id} className="zone-card" onClick={() => onOpen(z)}>
            <div className="zone-name"><b>{z.name}</b></div>
            <div className="zone-badge">{z.plan?.name || z.type || 'Zone'}</div>
            <button className="btn small">Open</button>
          </div>
        ))}
      </div>

      <footer>Powered by Cloudflare DNS API • © iAmSaugata</footer>
    </div>
  )
}
