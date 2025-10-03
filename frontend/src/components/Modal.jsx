export default function Modal({title, content, actions=[]}){
  const wrap = document.createElement('div')
  wrap.className = 'modal-backdrop'
  wrap.innerHTML = `
    <div class="modal">
      <div style="font-size:18px; font-weight:700; margin-bottom:10px;">${title}</div>
      <div class="modal-body"></div>
      <div style="display:flex; gap:8px; justify-content:flex-end; margin-top:12px;">
        ${actions.map((a,i)=>`<button class="btn ${a.class||''}" data-i="${i}">${a.label}</button>`).join('')}
      </div>
    </div>
  `
  document.body.appendChild(wrap)
  const body = wrap.querySelector('.modal-body')
  if(typeof content === 'string') body.innerHTML = content
  else body.appendChild(content)

  wrap.querySelectorAll('button[data-i]').forEach(btn=>{
    btn.onclick = ()=>{
      const i = parseInt(btn.getAttribute('data-i'),10)
      const a = actions[i]
      if(a && a.onClick) a.onClick(btn)
    }
  })

  function close(){
    document.body.removeChild(wrap)
  }

  return { close }
}
