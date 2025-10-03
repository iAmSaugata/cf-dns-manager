export default function Login(mount, {onLogin, onReload, onClear, stored='', error=''}){
  mount.innerHTML = `
    <div class="card">
      <div class="title">Login</div>
      <div class="field">
        <input id="pwd" class="input" type="password" placeholder="Enter password" value="${stored}"/>
      </div>
      ${error ? `<div style="color:#dc2626; margin-bottom:10px;">${error}</div>` : ''}
      <div class="row" style="justify-content:space-between;">
        <button class="btn" id="clear">Clear</button>
        <button class="btn" id="reload">Reload</button>
        <button class="btn" id="login">Login</button>
      </div>
    </div>
  `
  document.getElementById('login').onclick = ()=> onLogin(document.getElementById('pwd').value)
  document.getElementById('reload').onclick = ()=> onReload()
  document.getElementById('clear').onclick = ()=> onClear()
}
