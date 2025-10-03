import React, { useEffect, useState } from 'react'
import Login from './components/Login.jsx'
import ZoneSelect from './components/ZoneSelect.jsx'
import DnsManager from './components/DnsManager.jsx'
import { api, setPassword, getPassword } from './components/api.js'

export default function App(){
  const [view, setView] = useState('login')
  const [zones, setZones] = useState([])
  const [zone, setZone] = useState(null)
  const [theme, setTheme] = useState(() => localStorage.getItem('cf_theme') || 'light')

  useEffect(()=>{ document.documentElement.setAttribute('data-theme', theme); localStorage.setItem('cf_theme', theme) }, [theme])

  useEffect(()=>{
    const pw = getPassword()
    if (pw){
      setPassword(pw)
      api.zones().then(d=>{
        if (d && d.result) { setZones(d.result); setView('zones') }
      }).catch(()=>{})
    }
  }, [])

  const handleLoggedIn = async ()=>{
    const z = await api.zones()
    setZones(z.result || [])
    setView('zones')
  }

  const openZone = (z)=>{ setZone(z); document.title = (z.name||'').toUpperCase(); setView('dns') }
  const signOut = ()=>{ setPassword(null); setView('login'); document.title = 'Cloudflare DNS Manager' }
  const changeZone = ()=>{ setZone(null); setView('zones'); document.title = 'Cloudflare DNS Manager' }

  return (
    <div>
      {view === 'login' && <Login onLoggedIn={handleLoggedIn}/>}
      {view === 'zones' && <ZoneSelect zones={zones} onOpen={openZone} onSignOut={signOut}/>}
      {view === 'dns' && zone && <DnsManager zone={zone} onSignOut={signOut} onChangeZone={changeZone}/>}
      <div className="footer">
        <span style={{marginRight:12}}>Dark Mode</span>
        <label className="switch">
          <input type="checkbox" checked={theme==='dark'} onChange={e=>setTheme(e.target.checked ? 'dark' : 'light')} />
          <span className="slider"></span>
        </label>
        <span style={{marginLeft:16}}>Powered by Cloudflare DNS API • © iAmSaugata</span>
      </div>
    </div>
  )
}
