import Modal from './Modal.jsx'

const allowedTypes = ['A','AAAA','CNAME','TXT','MX','NS','PTR']

function isReadOnly(rec){
  return !!(rec.locked || (rec.meta && (rec.meta.read_only === true || rec.meta.managed_by_apps || rec.meta.managed_by_argo_tunnel)))
}

function proxySupported(type){
  return ['A','AAAA','CNAME'].includes(type)
}

function rowProxyCell(rec){
  if(proxySupported(rec.type)){
    const active = rec.proxied ? 'active' : ''
    return `<div class="proxy-toggle ${active}" data-id="${rec.id}"><span class="dot"></span></div>`
  }
  return `<span>DNS only</span>`
}

function truncate(s){
  if(!s) return ''
  return s.length>25 ? (s.slice(0,25)+'…') : s
}

export default function DNSManager(mount, {zone, api, onChangeZone}){
  let records = []
  let filterType = 'All'
  let filterText = ''
  let selection = new Set()
  let modal = null
  let busy = false

  async function load(){
    const list = await api(`/api/zone/${zone.id}/dns_records`)
    records = list
    render()
  }

  function filtered(){
    return records.filter(r=>{
      const typeOk = filterType==='All' || r.type===filterType
      const text = (r.type+' '+(r.name||'')+' '+(r.content||'')+' '+(r.comment||r.data?.comment||'')).toLowerCase()
      const txtOk = !filterText || text.includes(filterText.toLowerCase())
      return typeOk && txtOk
    })
  }

  function render(){
    mount.innerHTML = `
      <div class="table-wrap">
        <div class="table-card">
          <div class="toolbar">
            <button class="btn" id="btn-change-zone">Change Zone</button>
            <button class="btn" id="btn-signout-top">Sign Out</button>
          </div>
          <div class="filterbar">
            <select class="select" id="type">
              <option>All</option>
              ${allowedTypes.map(t=>`<option ${filterType===t?'selected':''}>${t}</option>`).join('')}
            </select>
            <input id="search" class="input-sm" placeholder="Search type, name, content, comment" value="${filterText}"/>
            <button class="btn" id="clear">Clear</button>
          </div>

          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
            <div>
              <button class="btn btn-red" id="delete-selected" ${selection.size? '':'disabled'}>Delete Selected</button>
            </div>
            <div>
              <button class="btn btn-green" id="add-record">Add Record</button>
            </div>
          </div>

          <table class="table">
            <thead>
              <tr>
                <th style="width:36px;">Select</th>
                <th style="width:80px;">Type</th>
                <th>Name</th>
                <th>Content</th>
                <th style="width:80px;">TTL</th>
                <th style="width:90px;">Proxy</th>
                <th style="width:90px;">Priority</th>
                <th style="width:140px;">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${filtered().map(rec=>`
                <tr>
                  <td><input type="checkbox" class="checkbox" data-sel="${rec.id}" ${selection.has(rec.id)?'checked':''} ${isReadOnly(rec)?'disabled':''}/></td>
                  <td>${rec.type}</td>
                  <td>${truncate(rec.name)} ${(rec.comment||rec.data?.comment)?`<span title="${rec.comment||rec.data?.comment}">📜</span>`:''}</td>
                  <td>${truncate(rec.content)}</td>
                  <td>${rec.ttl===1?'Auto':rec.ttl}</td>
                  <td>${rowProxyCell(rec)}</td>
                  <td>${rec.type==='MX' ? (rec.priority ?? '') : ''}</td>
                  <td style="text-align:center;">
                    ${isReadOnly(rec)? '' : `
                      <button class="btn" data-edit="${rec.id}">Edit</button>
                      <button class="btn btn-red" data-del="${rec.id}">Delete</button>
                    `}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `

    // Header buttons in page (mirror)
    document.getElementById('btn-change-zone').onclick = ()=> onChangeZone()
    document.getElementById('btn-signout-top').onclick = ()=>{
      localStorage.removeItem('app_password')
      document.cookie = 'app_password=; Max-Age=0; path=/'
      location.reload()
    }

    // Filters
    const typeSel = document.getElementById('type')
    const search = document.getElementById('search')
    typeSel.onchange = ()=>{ filterType = typeSel.value; render() }
    search.oninput = ()=>{ filterText = search.value; render() }
    document.getElementById('clear').onclick = ()=>{ filterText=''; filterType='All'; render() }

    // Add
    document.getElementById('add-record').onclick = ()=> openModal()

    // Selection
    mount.querySelectorAll('input[data-sel]').forEach(ch=>{
      ch.onchange = ()=>{
        const id = ch.getAttribute('data-sel')
        if(ch.checked) selection.add(id); else selection.delete(id)
        render()
      }
    })

    // Proxy toggles
    mount.querySelectorAll('.proxy-toggle').forEach(tg=>{
      tg.onclick = async ()=>{
        const id = tg.getAttribute('data-id')
        const rec = records.find(r=>r.id===id)
        if(!rec || !proxySupported(rec.type)) return
        try{
          await api(`/api/zone/${zone.id}/dns_records/${id}`, {
            method:'PUT',
            body: JSON.stringify({
              type: rec.type,
              name: rec.name,
              content: rec.content,
              ttl: rec.ttl,
              proxied: !rec.proxied,
              priority: rec.priority
            })
          })
          await load()
        }catch(e){ alert(e?.error||'Failed to toggle proxy') }
      }
    })

    // Edit/Delete
    mount.querySelectorAll('button[data-edit]').forEach(b=>{
      b.onclick = ()=>{
        const id = b.getAttribute('data-edit')
        const rec = records.find(r=>r.id===id)
        openModal(rec)
      }
    })
    mount.querySelectorAll('button[data-del]').forEach(b=>{
      b.onclick = async ()=>{
        const id = b.getAttribute('data-del')
        confirmDelete([id])
      }
    })

    // Bulk delete
    document.getElementById('delete-selected').onclick = ()=>{
      if(!selection.size) return
      confirmDelete(Array.from(selection))
    }
  }

  function confirmDelete(ids){
    const items = ids.map(id=>{
      const r = records.find(x=>x.id===id)
      return `${r?.type || ''} ${r?.name || ''}`.trim()
    }).join('<br/>')
    modal = Modal({
      title: 'Confirm Delete',
      content: `<div>Are you sure you want to delete the following record(s)?</div><div style="margin-top:8px">${items}</div>`,
      actions: [
        { label:'Cancel', class:'', onClick: ()=> modal.close() },
        { label:'Delete Selected', class:'btn-red', onClick: async ()=>{
          try{
            for(const id of ids){
              await api(`/api/zone/${zone.id}/dns_records/${id}`, { method:'DELETE' })
            }
            modal.close(); selection.clear(); await load()
          }catch(e){ alert(e?.error||'Delete failed') }
        }}
      ]
    })
  }

  function openModal(rec=null){
    const isEdit = !!rec
    const data = {
      type: rec?.type || 'A',
      name: rec?.name || '',
      content: rec?.content || '',
      ttl: rec?.ttl ?? 1,
      proxied: !!rec?.proxied,
      priority: rec?.priority ?? '',
      comment: rec?.comment || rec?.data?.comment || ''
    }

    function disabledIf(cond){ return cond ? 'disabled class="disabled"' : '' }

    const form = document.createElement('div')
    form.innerHTML = `
      <div class="field">
        <label class="label">Type</label>
        <select class="select" id="f-type">
          ${allowedTypes.map(t=>`<option ${data.type===t?'selected':''}>${t}</option>`).join('')}
        </select>
        <div class="help">Only A, AAAA, CNAME, TXT, MX, NS, PTR are supported.</div>
      </div>
      <div class="field">
        <label class="label">Name</label>
        <input class="input" id="f-name" placeholder="sub.example.com" value="${data.name}"/>
        <div class="help">Fully-qualified or relative to zone.</div>
      </div>
      <div class="field">
        <label class="label">Content</label>
        <input class="input" id="f-content" placeholder="Target / IP / value" value="${data.content}"/>
      </div>
      <div class="field">
        <label class="label">TTL</label>
        <input class="input" id="f-ttl" type="number" min="1" value="${data.ttl}"/>
        <div class="help">Use 1 for Auto.</div>
      </div>
      <div class="field">
        <label class="label">Proxy</label>
        ${proxySupported(data.type) ? `
          <div class="proxy-toggle ${data.proxied?'active':''}" id="f-proxy"><span class="dot"></span></div>
        ` : `<input class="input disabled" value="DNS only" disabled />`}
        <div class="help">Proxy toggle is only available for A/AAAA/CNAME.</div>
      </div>
      <div class="field">
        <label class="label">Priority (MX only)</label>
        <input class="input ${data.type==='MX'?'':'disabled'}" id="f-priority" type="number" min="0" value="${data.type==='MX'?data.priority:''}" ${data.type==='MX'?'':'disabled'}/>
      </div>
      <div class="field">
        <label class="label">Comment (optional)</label>
        <input class="input" id="f-comment" placeholder="Any note for this record" value="${data.comment}"/>
      </div>
    `

    function bindTypeInteractions(){
      const typeSel = form.querySelector('#f-type')
      const pr = form.querySelector('#f-priority')
      const proxy = form.querySelector('#f-proxy')
      function apply(){
        const t = typeSel.value
        if(t==='MX'){ pr.removeAttribute('disabled'); pr.classList.remove('disabled') }
        else { pr.setAttribute('disabled',''); pr.classList.add('disabled'); pr.value='' }
        if(proxy){
          if(proxySupported(t)){ proxy.classList.remove('disabled') }
          else { proxy.classList.add('disabled') }
        }
      }
      typeSel.onchange = apply
      apply()
      if(proxy){
        proxy.onclick = ()=>{
          if(proxy.classList.contains('disabled')) return
          proxy.classList.toggle('active')
        }
      }
    }

    modal = Modal({
      title: isEdit? 'Edit Record' : 'Add Record',
      content: form,
      actions: [
        { label:'Cancel', onClick: ()=> modal.close() },
        { label: isEdit? 'Save' : 'Create', onClick: async (btn)=>{
          if(busy) return; busy = True
          try{
            btn.disabled = true
            const type = form.querySelector('#f-type').value
            const body = {
              type,
              name: form.querySelector('#f-name').value.trim(),
              content: form.querySelector('#f-content').value.trim(),
              ttl: parseInt(form.querySelector('#f-ttl').value,10) || 1
            }
            if(type==='MX'){
              const pr = form.querySelector('#f-priority').value
              if(pr !== '') body.priority = parseInt(pr,10)
            }
            if(proxySupported(type)){
              body.proxied = form.querySelector('#f-proxy').classList.contains('active')
            }
            const comment = form.querySelector('#f-comment').value.trim()
            if(comment){ body.comment = comment }

            if(isEdit){
              await api(`/api/zone/${zone.id}/dns_records/${rec.id}`, { method:'PUT', body: JSON.stringify(body) })
            }else{
              await api(`/api/zone/${zone.id}/dns_records`, { method:'POST', body: JSON.stringify(body) })
            }
            modal.close(); await load()
          }catch(e){
            alert(e?.error || 'Request failed')
          }finally{
            busy = false; btn.disabled = false
          }
        }}
      ]
    })
    bindTypeInteractions()
  }

  load().catch(e=>{
    mount.innerHTML = `<div class="table-wrap"><div class="table-card"><div style="color:#dc2626">Failed to load records: ${e?.error||'error'}</div></div></div>`
  })
}
