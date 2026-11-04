/* ===== Helper robot: hints stay hidden until the student clicks the robot ===== */
function BuddyBot(o){
  const panel=o.panel, mode=o.mode==='head'?'head':'walk';
  const still=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(!document.getElementById('bb-style')){ const st=document.createElement('style'); st.id='bb-style'; st.textContent=`
.bb-dock{position:relative;user-select:none;-webkit-user-select:none}
.bb-dock.bb-walk{height:118px;margin:4px 12px 0;border-bottom:1px dashed var(--line)}
.bb-dock.bb-head{position:absolute;left:max(16px,env(safe-area-inset-left,0px));bottom:calc(14px + env(safe-area-inset-bottom,0px));z-index:5;width:60px;height:52px}
.bb-bot{position:absolute;left:0;bottom:0;width:64px;cursor:pointer;outline:none;-webkit-tap-highlight-color:transparent}
.bb-head .bb-bot{width:60px}
.bb-bot svg{display:block;width:100%;height:auto;overflow:visible;transition:transform .25s}
.bb-bot.left svg{transform:scaleX(-1)}
.bb-bot:hover svg,.bb-bot:focus-visible svg{transform:translateY(-2px) scale(1.05)}
.bb-bot.left:hover svg,.bb-bot.left:focus-visible svg{transform:translateY(-2px) scaleX(-1.05) scaleY(1.05)}
.bb-bot:focus-visible{outline:2px solid var(--accent);outline-offset:3px;border-radius:12px}
.bb-eyes,.bb-happy,.bb-leg,.bb-arm{transform-box:fill-box;transform-origin:center;transition:transform .12s}
.bb-blink .bb-eyes{transform:scaleY(.12)}
.bb-glad .bb-eyes{opacity:0}.bb-happy{opacity:0}.bb-glad .bb-happy{opacity:1}
.bb-walking .bb-leg1{animation:bbStep .5s infinite}.bb-walking .bb-leg2{animation:bbStep .5s infinite .25s}
.bb-walking .bb-arm1{animation:bbSwing .5s infinite}.bb-walking .bb-arm2{animation:bbSwing .5s infinite .25s}
.bb-walking .bb-whole{animation:bbBob .5s infinite}
.bb-ant{transform-box:fill-box;transform-origin:bottom center;animation:bbAnt 3.2s ease-in-out infinite}
@keyframes bbStep{50%{transform:translateY(-3px)}}@keyframes bbSwing{50%{transform:rotate(14deg)}}@keyframes bbBob{50%{transform:translateY(-1.5px)}}@keyframes bbAnt{0%,100%{transform:rotate(-6deg)}50%{transform:rotate(6deg)}}
.bb-say{position:absolute;bottom:calc(100% + 6px);left:50%;transform:translateX(-50%);width:max-content;max-width:230px;background:var(--panel);color:var(--ink);border:1px solid var(--line);border-radius:12px;padding:7px 10px;font-size:12.5px;line-height:1.45;box-shadow:0 4px 14px rgba(20,40,34,.12);pointer-events:none;animation:bbPop .18s ease-out;text-align:center}
.bb-say small{display:block;color:var(--muted);font-size:11.5px}
.bb-say::after{content:"";position:absolute;top:100%;left:var(--tail,50%);margin-left:-6px;border:6px solid transparent;border-top-color:var(--panel)}
.bb-head .bb-say{left:calc(100% + 10px);bottom:8px;transform:none}
.bb-head .bb-say::after{top:auto;bottom:8px;left:-12px;margin:0;border-top-color:transparent;border-right-color:var(--panel)}
@keyframes bbPop{from{opacity:0}}
.bb-head .bb-say{animation:none}
.bb-x{position:absolute;left:-4px;bottom:-2px;width:18px;height:18px;border-radius:50%;border:2px solid var(--panel);background:#e5484d;color:#fff;font-size:11px;line-height:1;padding:0;cursor:pointer;box-shadow:0 1px 4px rgba(0,0,0,.25);display:grid;place-items:center}
.bb-x:hover{background:#c9363b}
.buddy.bb-closed{display:none!important}
.bb-x[hidden],.bb-say[hidden]{display:none!important}
.bb-hint{font-size:11px;color:var(--muted);position:absolute;right:0;bottom:4px;pointer-events:none}
@media (prefers-reduced-motion:reduce){.bb-ant,.bb-walking .bb-leg1,.bb-walking .bb-leg2,.bb-walking .bb-arm1,.bb-walking .bb-arm2,.bb-walking .bb-whole{animation:none}}
`; document.head.appendChild(st); }
  const EYES='<g class="bb-eyes"><ellipse cx="25" cy="29" rx="3.6" ry="4.4" fill="#1e2a2c"/><ellipse cx="39" cy="29" rx="3.6" ry="4.4" fill="#1e2a2c"/><circle cx="26.2" cy="27.4" r="1.2" fill="#fff"/><circle cx="40.2" cy="27.4" r="1.2" fill="#fff"/></g>'+
    '<g class="bb-happy" fill="none" stroke="#1e2a2c" stroke-width="2.2" stroke-linecap="round"><path d="M21.5 30.5q3.5-5 7 0"/><path d="M35.5 30.5q3.5-5 7 0"/></g>';
  const HEAD='<g class="bb-ant"><line x1="32" y1="11" x2="32" y2="4" stroke="#2e7d72" stroke-width="2"/><circle cx="32" cy="3.5" r="3.2" fill="#ff6b8b"/></g>'+
    '<rect x="4" y="23" width="6" height="12" rx="3" fill="#2e7d72"/><rect x="54" y="23" width="6" height="12" rx="3" fill="#2e7d72"/>'+
    '<rect x="8" y="10" width="48" height="38" rx="16" fill="#5cc8b8" stroke="#2e7d72" stroke-width="2"/><rect x="14" y="16" width="36" height="25" rx="10" fill="#effaf7"/>'+
    EYES+'<circle cx="19.5" cy="36" r="2.6" fill="#ff9fb2" opacity=".85"/><circle cx="44.5" cy="36" r="2.6" fill="#ff9fb2" opacity=".85"/><path d="M29 35.5q3 3 6 0" fill="none" stroke="#1e2a2c" stroke-width="1.8" stroke-linecap="round"/>';
  const BODY='<g class="bb-arm bb-arm1"><rect x="9" y="52" width="8" height="14" rx="4" fill="#9a7bff"/></g><g class="bb-arm bb-arm2"><rect x="47" y="52" width="8" height="14" rx="4" fill="#9a7bff"/></g>'+
    '<g class="bb-leg bb-leg1"><rect x="22" y="66" width="7" height="10" rx="3.5" fill="#6b4fd8"/></g><g class="bb-leg bb-leg2"><rect x="35" y="66" width="7" height="10" rx="3.5" fill="#6b4fd8"/></g>'+
    '<rect x="16" y="48" width="32" height="21" rx="9" fill="#9a7bff" stroke="#6b4fd8" stroke-width="2"/><circle cx="32" cy="58" r="4" fill="#ffd166"/>';
  const svg=mode==='head'?`<svg viewBox="0 0 64 50" aria-hidden="true"><g class="bb-whole">${HEAD}</g></svg>`:`<svg viewBox="0 0 64 78" aria-hidden="true"><g class="bb-whole">${BODY}${HEAD}</g></svg>`;
  const dock=document.createElement('div'); dock.className='bb-dock bb-'+mode;
  dock.innerHTML=`<div class="bb-bot" role="button" tabindex="0" aria-label="Helper 小幫手：點我看提示">${svg}<button class="bb-x" type="button" aria-label="Close hints 關閉提示" title="Close hints 關閉提示" hidden>✕</button><div class="bb-say" hidden></div></div>`;
  (o.mount||panel.parentNode).insertBefore(dock,o.before===undefined?panel:o.before);
  const bot=dock.querySelector('.bb-bot'), bubble=dock.querySelector('.bb-say'), xb=dock.querySelector('.bb-x');
  panel.classList.add('bb-closed');
  let open=false, hover=false, hoverMsg=false, sayT=null, lastAct=Date.now(), lastCheer=0, lastIdle=Date.now(), x=0, target=null, pause=Date.now()+1500, last=performance.now();
  function place(){ if(mode!=='walk') return; const W=dock.clientWidth, bw=bubble.offsetWidth, bx=bot.offsetWidth, cx=x+bx/2;
    const L=Math.max(0,Math.min(W-bw,cx-bw/2)); bubble.style.left=(L-x)+'px'; bubble.style.transform='none';
    bubble.style.setProperty('--tail',Math.max(10,Math.min(bw-10,cx-L))+'px'); }
  function say(en,zh,ms){ clearTimeout(sayT); hoverMsg=false; bubble.innerHTML=`${zh}<small>${en}</small>`; bubble.hidden=false; place(); if(ms) sayT=setTimeout(()=>{ bubble.hidden=true; },ms); }
  function hush(){ clearTimeout(sayT); bubble.hidden=true; }
  function glad(ms){ bot.classList.add('bb-glad'); setTimeout(()=>bot.classList.remove('bb-glad'),ms||1200); }
  function setOpen(v,quiet){ open=v; panel.classList.toggle('bb-closed',!v); xb.hidden=!v; bot.setAttribute('aria-label',v?'Helper 小幫手':'Helper 小幫手：點我看提示');
    if(v){ hush(); glad(900); } else if(!quiet){ say('Click me if you need me.','如果有需要，再點我喔！',3500); }
    if(o.onToggle) o.onToggle(v); }
  bot.addEventListener('click',e=>{ if(e.target===xb) return; if(!open) setOpen(true); else glad(600); });
  bot.addEventListener('keydown',e=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); if(!open) setOpen(true); } });
  xb.addEventListener('click',e=>{ e.stopPropagation(); setOpen(false); });
  bot.addEventListener('mouseenter',()=>{ hover=true; if(!open&&bubble.hidden){ say('Do you really need a hint? Click me.','你真的需要提示嗎？點我一下。'); hoverMsg=true; } });
  bot.addEventListener('mouseleave',()=>{ hover=false; if(hoverMsg) hush(); });
  /* the student is working: cheer now and then */
  function activity(){ const now=Date.now(); lastAct=now; lastIdle=now;
    if(!open&&!hover&&now-lastCheer>120000){ lastCheer=now; setTimeout(()=>{ if(!open&&!hover){ say('You can do it! Keep solving.','加油，好好解題！',3000); glad(1500); } },600); } }
  (o.activity||[]).forEach(el=>{ if(el){ el.addEventListener('pointerup',activity,{passive:true}); el.addEventListener('keyup',activity,{passive:true}); } });
  /* nobody is working for a while: a quiet reminder */
  setInterval(()=>{ const now=Date.now(); if(open||hover) return; if(now-lastAct>60000&&now-lastIdle>180000){ lastIdle=now; say('Please listen to your teacher.','請專心聽課喔。',4000); } },5000);
  /* blink, and look toward the mouse */
  const eyes=[...dock.querySelectorAll('.bb-eyes,.bb-happy')];
  (function blink(){ setTimeout(()=>{ bot.classList.add('bb-blink'); setTimeout(()=>{ bot.classList.remove('bb-blink'); blink(); },140); },2600+Math.random()*3600); })();
  let mx=null,my=null,raf=0;
  document.addEventListener('pointermove',e=>{ mx=e.clientX; my=e.clientY; if(!raf) raf=requestAnimationFrame(look); },{passive:true});
  function look(){ raf=0; const r=bot.getBoundingClientRect(); if(!r.width) return; const dx=mx-(r.left+r.width/2), dy=my-(r.top+r.height*.35), d=Math.hypot(dx,dy)||1, k=Math.min(1,d/200);
    let ex=dx/d*2.2*k, ey=dy/d*1.6*k; if(bot.classList.contains('left')) ex=-ex; eyes.forEach(g=>g.style.translate=`${ex.toFixed(2)}px ${ey.toFixed(2)}px`); }
  /* walk back and forth (walk mode only) */
  if(mode==='walk'&&!still){
    const step=t=>{ const dt=Math.min(0.05,(t-last)/1000); last=t; const w=dock.clientWidth-bot.offsetWidth;
      if(w>0&&!hover&&!open&&bubble.hidden&&Date.now()>pause){
        if(target===null){ target=Math.random()*w; bot.classList.toggle('left',target<x); }
        const dir=Math.sign(target-x); x+=dir*28*dt; bot.classList.add('bb-walking');
        if(Math.abs(target-x)<1.5||(dir>0&&x>target)||(dir<0&&x<target)){ x=target; target=null; pause=Date.now()+2500+Math.random()*4500; bot.classList.remove('bb-walking'); }
      } else bot.classList.remove('bb-walking');
      if(w>0) x=Math.max(0,Math.min(w,x)); bot.style.transform=`translateX(${x.toFixed(1)}px)`;
      requestAnimationFrame(step); };
    requestAnimationFrame(step);
  }
  return {open:()=>setOpen(true),close:()=>setOpen(false,true),isOpen:()=>open,say,activity,
    done(){ if(!open){ say('All done! Great job!','全部完成了，好棒！',4000); glad(2500); } }};
}
