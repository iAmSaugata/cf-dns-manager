import React from 'react'
import { setPassword } from './api.js'

export default function ZoneSelect({ zones, onOpen, onSignOut }){
  return (
    <>
      <div className="header">
        <div className="title">Cloudflare DNS Manager</div>
        <div>
          <button className="btn" onClick={onSignOut}>Sign Out</button>
        </div>
      </div>
      <div className="centered-wrap">
        <div className="card" style={{maxWidth: '520px'}}>
          <div style={{fontWeight:800, fontSize:20, textAlign:'center', marginBottom:8}}>Select a Zone</div>
          <small className="muted" style={{display:'block', textAlign:'center', marginBottom: 6}}>Everything is center aligned</small>
          <div>
            {(zones||[]).map(z => (
              <div key={z.id} className="zone-card">
                <div style={{fontWeight:700}}>{z.name} <span className="badge">{z.plan && z.plan.name ? z.plan.name : (z.type || 'zone')}</span></div>
                <div style={{marginTop:10}}>
                  <button className="btn" onClick={()=>onOpen(z)}>Open</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}
