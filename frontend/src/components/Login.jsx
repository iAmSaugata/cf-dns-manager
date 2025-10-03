import React, { useState } from 'react'

export default function Login({ onLogin }) {
  const [pwd, setPwd] = useState('')
  const [err, setErr] = useState('')

  const submit = async () => {
    setErr('')
    try {
      await onLogin(pwd)
    } catch (e) {
      setErr('Invalid password.')
    }
  }

  const clear = () => { setPwd(''); setErr('') }
  const reload = () => window.location.reload()

  return (
    <div className="center-card">
      <h1>Login</h1>
      <input type="password" placeholder="Password" value={pwd} onChange={e => setPwd(e.target.value)} />
      {err && <div className="error">{err}</div>}
      <div className="btn-row">
        <button className="btn" onClick={clear}>Clear</button>
        <button className="btn" onClick={reload}>Reload</button>
        <button className="btn primary" onClick={submit}>Login</button>
      </div>
      <footer>Powered by Cloudflare DNS API • © iAmSaugata</footer>
    </div>
  )
}
