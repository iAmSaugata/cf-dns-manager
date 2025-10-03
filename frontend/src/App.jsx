import Login from './components/Login.jsx'
import ZoneSelect from './components/ZoneSelect.jsx'
import DNSManager from './components/DNSManager.jsx'
import './styles.css'

const state = {
  page: 'login',
  password: '',
  zones: [],
  zone: null
}

async function api(path, opts={}){
  const headers = Object.assign({'Content-Type':'application/json','x-app-password': state.password}, opts.headers||{})
  const res = await fetch(path, {...opts, headers, credentials:'include'})
  if(!res.ok){
    const err = await res.json().catch(()=>({error:'Request failed'}))
    throw err
  }
  return res.json()
}

export default function App(mount){
  const render = async ()=>{
    mount.innerHTML = `
      <div class="app">
        ${state.page !== 'login' ? `
        <div class="header">
          <h1>${state.page === 'dns' ? `DNS Manager for Zone <span style="color:#0ea5e9;font-weight:700">${(state.zone?.name||'').toUpperCase()}</span>` : 'Cloudflare DNS Manager'}</h1>
          <div class="actions">
            ${state.page === 'dns' ? `<button class="btn" id="btn-change">Change Zone</button>` : ''}
            <button class="btn" id="btn-signout">Sign Out</button>
          </div>
        </div>` : ''}
        <div class="center-wrap" id="center"></div>
        <div class="footer">Powered by Cloudflare DNS API • © iAmSaugata</div>
      </div>
    `

    const center = document.getElementById('center')

    if(state.page === 'login'){
      Login(center, {
        onLogin: async (password)=>{
          state.password = password
          try{
            await api('/api/health')
            // set cookie + localStorage
            document.cookie = `app_password=${encodeURIComponent(password)}; path=/; SameSite=Lax`
            localStorage.setItem('app_password', password)
            state.page = 'zones'
            render()
          }catch(e){
            Login(center, { error: e?.error || 'Login failed', onLogin: arguments.callee })
          }
        },
        onReload: ()=> location.reload(),
        onClear: ()=>{
          localStorage.removeItem('app_password'); document.cookie = 'app_password=; Max-Age=0; path=/'
        },
        stored: localStorage.getItem('app_password') || ''
      })
    }
    else if(state.page === 'zones'){
      try{
        const zones = await api('/api/zones')
        state.zones = zones
        ZoneSelect(center, {
          zones,
          onOpen: (zone)=>{ state.zone = zone; state.page='dns'; document.title = (zone.name||'').toUpperCase(); render() }
        })
      }catch(e){
        center.innerHTML = `<div class="card"><div class="title">Error</div><pre>${e?.error||'Failed to load zones'}</pre></div>`
      }
    }
    else if(state.page === 'dns'){
      DNSManager(center, {
        zone: state.zone,
        api: (path, opts)=> api(path, opts),
        onChangeZone: ()=>{ state.page='zones'; document.title='Cloudflare DNS Manager'; render() }
      })
      const changeBtn = document.getElementById('btn-change')
      if(changeBtn) changeBtn.onclick = ()=>{ state.page='zones'; document.title='Cloudflare DNS Manager'; render() }
    }

    const signout = document.getElementById('btn-signout')
    if(signout){
      signout.onclick = ()=>{
        localStorage.removeItem('app_password')
        document.cookie = 'app_password=; Max-Age=0; path=/'
        state.page = 'login'; state.password=''; state.zone=null; state.zones=[]
        document.title = 'Cloudflare DNS Manager'
        render()
      }
    }
  }

  render()
}
