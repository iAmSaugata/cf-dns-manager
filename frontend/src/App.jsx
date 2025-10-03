import React, { useEffect, useState } from 'react'
import Login from './components/Login.jsx'
import ZoneSelect from './components/ZoneSelect.jsx'
import DnsManager from './components/DnsManager.jsx'
import { api } from './api.js'

export default function App() {
  const [stage, setStage] = useState('login')
  const [zones, setZones] = useState([])
  const [zone, setZone] = useState(null)
  const [password, setPassword] = useState(localStorage.getItem('app_password') || '')

  useEffect(() => {
    if (password) {
      api.setPassword(password)
      api.health().then(() => {
        setStage('zones')
      }).catch(() => setStage('login'))
    }
  }, [])

  const handleLogin = async (pwd) => {
    try {
      api.setPassword(pwd)
      await api.health()
      document.cookie = `app_password=${encodeURIComponent(pwd)}; path=/`
      localStorage.setItem('app_password', pwd)
      setPassword(pwd)
      setStage('zones')
    } catch (e) {
      throw e
    }
  }

  const signOut = () => {
    document.cookie = 'app_password=; Max-Age=0; path=/'
    localStorage.removeItem('app_password')
    setPassword('')
    setZone(null)
    setStage('login')
    document.title = 'Cloudflare DNS Manager'
  }

  const openZone = (z) => {
    setZone(z)
    setStage('dns')
  }

  const backToZones = () => {
    setZone(null)
    setStage('zones')
    document.title = 'Cloudflare DNS Manager'
  }

  return (
    <div className="app-shell">
      {stage === 'login' && <Login onLogin={handleLogin} />}
      {stage === 'zones' && <ZoneSelect onOpen={openZone} onSignOut={signOut} />}
      {stage === 'dns' && zone && <DnsManager zone={zone} onChangeZone={backToZones} onSignOut={signOut} />}
    </div>
  )
}
