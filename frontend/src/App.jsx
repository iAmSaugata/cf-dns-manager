import React, { useEffect, useState } from 'react'
import Login from './components/Login.jsx'
import ZoneSelect from './components/ZoneSelect.jsx'
import DnsManager from './components/DnsManager.jsx'
import { api, setPassword, getPassword } from './components/api.js'

export default function App(){
  const [view, setView] = useState('login')
  const [zones, setZones] = useState([])
  const [zone, setZone] = useState(null)

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

  const openZone = (z)=>{
    setZone(z)
    document.title = (z.name || '').toUpperCase()
    setView('dns')
  }

  const signOut = ()=>{
    setPassword(null)
    setView('login')
    document.title = 'Cloudflare DNS Manager'
  }

  const changeZone = ()=>{
    setZone(null); setView('zones'); document.title = 'Cloudflare DNS Manager'
  }

  return (
    <div>
      {view === 'login' && <Login onLoggedIn={handleLoggedIn}/>}
      {view === 'zones' && <ZoneSelect zones={zones} onOpen={openZone} onSignOut={signOut}/>}
      {view === 'dns' && zone && <DnsManager zone={zone} onSignOut={signOut} onChangeZone={changeZone}/>}
      <div className="footer">Powered by Cloudflare DNS API • © iAmSaugata</div>
    </div>
  )
}
