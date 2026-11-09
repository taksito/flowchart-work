/* ===== Sign in with 新北市教育局 OpenID (校務行政帳號); the Apps Script checks it with the OpenID server ===== */
function NtpcLogin(o){
  const SK='ntpc-v1', OP='https://openid.ntpc.edu.tw/OpenId/Provider', ANY='http://specs.openid.net/auth/2.0/identifier_select';
  const e=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const MSG={login_off:'Sign-in is not turned on yet. Tell your teacher. 老師的雲端程式還沒開啟登入功能。',
    login_required:'Sign in first. 請先用校務行政帳號登入。',
    bad_token:'Sign-in failed. Try again. 登入失敗，請再登入一次。', login_expired:'Sign-in expired. Sign in again. 登入過期了，請再登入一次。',
    ntpc_cancel:'You cancelled the sign-in. 你取消了登入。',
    not_school:'This account is not from our school. 這個帳號不是本校的學生或老師。',
    bad_openid:'Sign-in could not be checked. Try again. 登入驗證失敗，請再登入一次。',
    ntpc_no_data:'Your name was not shared. Press 同意 on the sign-in page. 沒有收到姓名資料，請在授權畫面按「同意」。',
    ntpc_no_class:'Your class and seat are missing. Tell your teacher. 校務行政系統裡沒有你的班級座號，請告訴老師。',
    server_error:'The server had a problem. Try again. 雲端程式出錯了，請再試一次。'};
  const ok=u=>u&&u.token&&Number(u.exp)*1000>Date.now()+60000?u:null;
  let user=null, note='';
  try{ user=ok(JSON.parse(sessionStorage.getItem(SK)||'null')); }catch(err){}
  /* back from a sign-in in this same window: …#ntpc=… */
  const h=location.hash.match(/[#&]ntpc=([\w-]+)/);
  if(h){
    try{ const d=JSON.parse(decodeURIComponent(escape(atob(h[1].replace(/-/g,'+').replace(/_/g,'/')))));
      if(d&&d.type==='ntpc-login'){ if(d.ok&&ok(d.user)){ user=d.user; try{ sessionStorage.setItem(SK,JSON.stringify(user)); }catch(err){} } else note=MSG[d.error]||'Sign-in failed. 登入失敗。'; } }catch(err){}
    try{ history.replaceState(null,'',location.href.split('#')[0]); }catch(err){}
  }
  function setUser(u){ user=u; try{ if(u) sessionStorage.setItem(SK,JSON.stringify(u)); else sessionStorage.removeItem(SK); }catch(err){} render(); if(u&&o.onUser) o.onUser(u); if(!u&&o.onOut) o.onOut(); }
  function status(t,bad){ const s=o.box&&o.box.querySelector('.gst'); if(s){ s.textContent=t||''; s.classList.toggle('err',!!bad); } }
  function authUrl(){
    const back=o.url+'?back='+encodeURIComponent(location.href.split('#')[0]);
    return OP+'?'+new URLSearchParams({'openid.ns':'http://specs.openid.net/auth/2.0','openid.mode':'checkid_setup','openid.claimed_id':ANY,'openid.identity':ANY,
      'openid.return_to':back,'openid.realm':o.url,'openid.ns.sreg':'http://openid.net/extensions/sreg/1.1','openid.sreg.required':'fullname,email,country,language,timezone'});
  }
  function start(){
    const u=authUrl(), w=window.open(u,'ntpc-login','width=560,height=720');
    if(!w){ location.href=u; return; }   // pop-ups blocked: sign in in this window and come back
    status('Sign in in the new window… 請在跳出的視窗登入…');
  }
  window.addEventListener('message',ev=>{
    const d=ev.data; if(!d||d.type!=='ntpc-login') return;
    if(!/^https:\/\/([\w-]+\.)*(googleusercontent\.com|script\.google\.com)$/.test(ev.origin)) return;
    if(d.ok&&ok(d.user)) setUser(d.user); else status(MSG[d.error]||('Sign-in failed. 登入失敗。'+(d.error?`（${e(d.error)}）`:'')),true);
  });
  function render(){
    const b=o.box; if(!b) return;
    if(user){ b.innerHTML=`<div class="glogin on"><span class="gok">✓</span><span class="gwho"><b>${e(user.student||user.name)}</b><small>新北市 OpenID · ${e(user.email)}${user.role&&user.role!=='學生'?' · '+e(user.role):''}</small></span><button type="button" class="btn" data-gout>Sign out 登出</button></div>`;
      b.querySelector('[data-gout]').onclick=()=>setUser(null); return; }
    b.innerHTML=`<div class="glogin"><p>Sign in with your school account first. 請先用新北市校務行政系統的帳號密碼登入（OpenID）。</p><div class="gbtn"><button type="button" class="btn primary" data-gin>新北市 OpenID 登入 Sign in</button></div><span class="status gst"></span></div>`;
    b.querySelector('[data-gin]').onclick=start;
    if(note){ status(note,true); note=''; }
  }
  if(user&&o.onUser) setTimeout(()=>o.onUser(user),0);
  return {
    user:()=>user,
    token:()=>user&&Number(user.exp)*1000>Date.now()+30000?user.token:null,
    expired:()=>{ setUser(null); status(MSG.login_expired,true); },
    message:k=>MSG[k],
    render
  };
}

/* ===== Sign in with the school Google account; the Apps Script looks the student up in the roster ===== */
function GLogin(o){
  const SK='glogin-v1', domain=String(o.domain||'').trim();
  const e=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  let user=null, ready=false, waiting=false;
  try{ const s=JSON.parse(sessionStorage.getItem(SK)||'null'); if(s&&s.exp*1000>Date.now()+60000) user=s; }catch(err){}
  const MSG={not_in_roster:'This account is not on the class list. Tell your teacher. 名單裡找不到這個帳號，請告訴老師。',
    bad_domain:`Use your school account${domain?' (@'+domain+')':''}. 請用學校的帳號登入${domain?'（@'+domain+'）':''}。`,
    no_roster:'Your teacher has not added the class list yet. 老師還沒放學生名單。',
    login_off:'Sign-in is not turned on yet. Tell your teacher. 老師的雲端程式還沒開啟登入功能。',
    login_required:'Sign in first. 請先用學校帳號登入。',
    bad_token:'Sign-in failed. Try again. 登入失敗，請再試一次。', login_expired:'Sign-in expired. Sign in again. 登入過期了，請再登入一次。'};
  function setUser(u){ user=u; try{ if(u) sessionStorage.setItem(SK,JSON.stringify(u)); else sessionStorage.removeItem(SK); }catch(err){} render(); if(u&&o.onUser) o.onUser(u); if(!u&&o.onOut) o.onOut(); }
  function status(t,bad){ const s=o.box.querySelector('.gst'); if(s){ s.textContent=t||''; s.classList.toggle('err',!!bad); } }
  function render(){
    const b=o.box; if(!b) return;
    if(user){ b.innerHTML=`<div class="glogin on"><span class="gok">✓</span><span class="gwho"><b>${e(user.student)}</b><small>${e(user.email)}</small></span><button type="button" class="btn" data-gout>Sign out 登出</button></div>`;
      b.querySelector('[data-gout]').onclick=()=>{ try{ google.accounts.id.disableAutoSelect(); }catch(err){} setUser(null); }; return; }
    b.innerHTML=`<div class="glogin"><p>Sign in with your school Google account first. 請先用學校的 Google 帳號登入${domain?'（…@'+e(domain)+'）':''}。</p><div class="gbtn"></div><span class="status gst"></span></div>`;
    if(ready) button(); else load();
  }
  function button(){ const el=o.box.querySelector('.gbtn'); if(!el) return; try{ google.accounts.id.renderButton(el,{type:'standard',theme:'outline',size:'large',text:'signin_with',shape:'pill',locale:'zh-TW'}); }catch(err){ status('Could not show the sign-in button. 無法顯示登入按鈕。',true); } }
  function load(){
    if(waiting) return; waiting=true;
    const s=document.createElement('script'); s.src='https://accounts.google.com/gsi/client'; s.async=true;
    s.onload=()=>{ try{ const opt={client_id:o.clientId,callback:onCred,auto_select:false,cancel_on_tap_outside:true,ux_mode:'popup'}; if(domain) opt.hd=domain; google.accounts.id.initialize(opt); ready=true; button(); }catch(err){ status('Sign-in is not available. 無法使用登入。',true); } };
    s.onerror=()=>status('Cannot reach Google. Check the internet. 連不上 Google，請確認網路。',true);
    document.head.appendChild(s);
  }
  async function onCred(resp){
    status('Checking… 確認中…');
    try{ const r=await fetch(o.url,{method:'POST',body:JSON.stringify({action:'whoami',idToken:resp.credential})}); const res=await r.json();
      if(res&&res.ok){ setUser({cls:res.who.cls,seat:res.who.seat,name:res.who.name,student:res.who.student,email:res.email,exp:res.exp,token:resp.credential}); return; }
      const m=MSG[res&&res.error]||('Sign-in failed. 登入失敗。'+(res&&res.error?`（${res.error}）`:''));
      status(m+(res&&res.email?' '+res.email:''),true);
    }catch(err){ status('Cannot reach Google Drive. 連不上雲端。',true); }
  }
  return {
    user:()=>user,
    token:()=>user&&user.exp*1000>Date.now()+30000?user.token:null,
    expired:()=>{ setUser(null); status(MSG.login_expired,true); },
    message:k=>MSG[k],
    render
  };
}

/* ===== A random code for this computer's browser, made once and remembered (e.g. PC-7F3K) ===== */
function flowDeviceId(){
  const K='flowchart-device-id';
  try{ const v=localStorage.getItem(K); if(/^PC-[A-Z0-9]{4}$/.test(v||'')) return v; }catch(e){}
  const A='ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let r=new Uint8Array(4); try{ crypto.getRandomValues(r); }catch(e){ r=r.map(()=>Math.floor(Math.random()*256)); }
  const id='PC-'+[...r].map(x=>A[x%A.length]).join('');
  try{ localStorage.setItem(K,id); }catch(e){}
  return id;
}
