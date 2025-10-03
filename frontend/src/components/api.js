let password = null
export function setPassword(pw){
  password = pw
  if (pw){
    localStorage.setItem('app_password', pw)
    document.cookie = `app_password=${pw}; path=/; SameSite=Lax`
  }else{
    localStorage.removeItem('app_password')
    document.cookie = 'app_password=; Max-Age=0; path=/'
  }
}
export function getPassword(){ return localStorage.getItem('app_password') || null }
async function req(path, opts={}){
  const headers = opts.headers || {}
  if (password) headers['x-app-password'] = password
  const res = await fetch(path, { ...opts, headers, credentials: 'include' })
  if (!res.ok){
    const t = await res.json().catch(()=>({}))
    throw new Error(t.error || 'Request failed')
  }
  return res.json()
}
export const api = {
  health(){ return req('/api/health') },
  zones(){ return req('/api/zones') },
  listRecords(zoneId){ return req(`/api/zone/${zoneId}/dns_records`) },
  createRecord(zoneId, payload){ return req(`/api/zone/${zoneId}/dns_records`, { method:'POST', body: JSON.stringify(payload), headers:{ 'Content-Type':'application/json' } }) },
  updateRecord(zoneId, id, payload){ return req(`/api/zone/${zoneId}/dns_records/${id}`, { method:'PUT', body: JSON.stringify(payload), headers:{ 'Content-Type':'application/json' } }) },
  deleteRecord(zoneId, id){ return req(`/api/zone/${zoneId}/dns_records/${id}`, { method:'DELETE' }) },
}
