import fetch from 'node-fetch'

const API = 'https://api.cloudflare.com/client/v4'

function authHeaders(){
  const token = process.env.CF_API_TOKEN || ''
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
}

async function cfFetch(path, opts={}){
  const url = `${API}${path}`
  console.log('[DEBUG] CF CALL', opts.method||'GET', url)
  const res = await fetch(url, { ...opts, headers: { ...(opts.headers||{}), ...authHeaders() }})
  const body = await res.json().catch(async()=>({ raw: await res.text() }))
  if (!res.ok || body.success===false){
    const err = new Error('Cloudflare API error')
    err.status = res.status
    err.body = body
    throw err
  }
  return body
}

export default {
  async getZones(){
    return cfFetch('/zones?status=active&per_page=50')
  },

  async listRecords(zoneId, { types=[] } = {}){
    // We fetch all and filter by types on server
    const body = await cfFetch(`/zones/${zoneId}/dns_records?per_page=200`)
    const filtered = (body.result||[]).filter(r => types.length ? types.includes(r.type) : true)
    return { ...body, result: filtered }
  },

  async createRecord(zoneId, payload){
    // Normalize fields based on type
    const data = normalize(payload)
    return cfFetch(`/zones/${zoneId}/dns_records`, { method:'POST', body: JSON.stringify(data) })
  },

  async updateRecord(zoneId, id, payload){
    const data = normalize(payload)
    return cfFetch(`/zones/${zoneId}/dns_records/${id}`, { method:'PUT', body: JSON.stringify(data) })
  },

  async deleteRecord(zoneId, id){
    return cfFetch(`/zones/${zoneId}/dns_records/${id}`, { method:'DELETE' })
  }
}

function normalize(p){
  const out = {
    type: p.type,
    name: p.name,
    content: p.content,
    ttl: typeof p.ttl === 'number' ? p.ttl : 1,
    comment: p.comment
  }
  if (['A','AAAA','CNAME'].includes(p.type)){
    out.proxied = !!p.proxied
  }
  if (p.type === 'MX'){
    out.priority = typeof p.priority === 'number' ? p.priority : 10
  }
  return out
}
