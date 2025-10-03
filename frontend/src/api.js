const apiBase = ''

let password = ''

function headers() {
  const h = { 'Content-Type': 'application/json' }
  if (password) h['x-app-password'] = password
  return h
}

async function req(path, opts = {}) {
  const res = await fetch(`/api${path}`, { credentials: 'include', headers: headers(), ...opts })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err?.errors?.[0]?.message || err?.error || res.statusText)
  }
  return res.json()
}

export const api = {
  setPassword: (pwd) => { password = pwd },
  health: () => req('/health'),
  zones: () => req('/zones'),
  listRecords: (zoneId) => req(`/zone/${zoneId}/dns_records?per_page=500`),
  createRecord: (zoneId, body) => req(`/zone/${zoneId}/dns_records`, { method: 'POST', body: JSON.stringify(body) }),
  updateRecord: (zoneId, id, body) => req(`/zone/${zoneId}/dns_records/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteRecord: (zoneId, id) => req(`/zone/${zoneId}/dns_records/${id}`, { method: 'DELETE' }),
}
