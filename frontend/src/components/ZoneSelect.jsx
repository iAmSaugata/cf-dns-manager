export default function ZoneSelect(mount, {zones, onOpen}){
  mount.innerHTML = `
    <div class="zone-list">
      ${zones.map(z=>`
        <div class="zone-card">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <div>
              <div style="font-weight:700">${z.name}</div>
              <div style="margin-top:6px">
                <span class="badge">${z.plan}</span>
                <span class="badge">${z.type}</span>
              </div>
            </div>
            <div>
              <button class="btn" data-open="${z.id}">Open</button>
            </div>
          </div>
        </div>
      `).join('')}
    </div>
  `
  mount.querySelectorAll('button[data-open]').forEach(btn=>{
    btn.onclick = ()=>{
      const id = btn.getAttribute('data-open')
      const zone = zones.find(z=>z.id===id)
      onOpen(zone)
    }
  })
}
