import fetch from 'node-fetch';
import { debugLog } from './logger.mjs';

const CF_API_BASE = 'https://api.cloudflare.com/client/v4';
const ALLOWED_TYPES = ['A','AAAA','CNAME','TXT','MX','NS','PTR'];

function cfHeaders(){
  const token = process.env.CF_API_TOKEN;
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };
}

export async function listZones(){
  const url = `${CF_API_BASE}/zones`;
  debugLog('CF GET', url);
  const r = await fetch(url, { headers: cfHeaders() });
  const j = await r.json();
  if(!j.success) throw j;
  return j.result;
}

export async function listRecords(zoneId){
  const url = `${CF_API_BASE}/zones/${zoneId}/dns_records?per_page=200`;
  debugLog('CF GET', url);
  const r = await fetch(url, { headers: cfHeaders() });
  const j = await r.json();
  if(!j.success) throw j;
  // Filter allowed types only
  return j.result.filter(rec => ALLOWED_TYPES.includes(rec.type));
}

export async function createRecord(zoneId, body){
  const url = `${CF_API_BASE}/zones/${zoneId}/dns_records`;
  debugLog('CF POST', {url, body});
  const r = await fetch(url, { method:'POST', headers: cfHeaders(), body: JSON.stringify(body) });
  const j = await r.json();
  if(!j.success) throw j;
  return j.result;
}

export async function updateRecord(zoneId, id, body){
  const url = `${CF_API_BASE}/zones/${zoneId}/dns_records/${id}`;
  debugLog('CF PUT', {url, body});
  const r = await fetch(url, { method:'PUT', headers: cfHeaders(), body: JSON.stringify(body) });
  const j = await r.json();
  if(!j.success) throw j;
  return j.result;
}

export async function deleteRecord(zoneId, id){
  const url = `${CF_API_BASE}/zones/${zoneId}/dns_records/${id}`;
  debugLog('CF DELETE', url);
  const r = await fetch(url, { method:'DELETE', headers: cfHeaders() });
  const j = await r.json();
  if(!j.success) throw j;
  return j.result;
}
