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
