import App from './App.jsx'

document.title = 'Cloudflare DNS Manager'

const root = document.getElementById('root')
root.innerHTML = ''
const mount = document.createElement('div')
root.appendChild(mount)

// Simple "no-react" mounting to keep dependencies minimal
App(mount)
