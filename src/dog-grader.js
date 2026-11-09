/* ===== Classwork L2-1 Dog Talk: the cat walks, talks and broadcasts "eat"; the dog hears it and answers ===== */
/* CAT:  START CAT → go to (-160, 0) → repeat 10 { move 10 steps } → say "eat together?" → broadcast "eat"
   DOG:  START DOG (when I receive "eat") → say "sure!"
   say / says may be a PROCESS or an OUTPUT shape; broadcast may be the last rounded shape, or a PROCESS followed by END. */
const DOG_STEPS=[['catStart','Cat START'],['goto','go to (-160, 0)'],['repeat','repeat 10'],['move','move 10 steps'],['say','say "eat together?"'],['bcast','broadcast "eat"'],['dogStart','Dog START'],['says','says "sure!"']];
function dogKind(n){
  const t=String(n.text||''), l=t.toLowerCase(), num=s=>(l.match(/-?\d+(\.\d+)?/g)||[]).map(Number);
  const k={};
  k.start=n.type==='terminator'&&/start|開始|when|當/i.test(t);
  k.receive=/receive|收到|接收/i.test(t);
  k.dog=/dog|狗/i.test(t); k.cat=/cat|貓/i.test(t);
  k.goto=/go\s*to|goto|移到|移動到|定位/i.test(t); k.gotoOK=k.goto&&num(t).includes(-160)&&num(t).filter(x=>x===0).length>=1;
  k.repeat=n.type==='loop'||/repeat|重複/i.test(t); k.repeatOK=k.repeat&&num(t).includes(10);
  k.move=/move|移動|走/i.test(t)&&!k.goto; k.moveOK=k.move&&num(t).includes(10);
  k.bcast=/broadcast|廣播/i.test(t); k.bcastOK=k.bcast&&/eat|吃/i.test(t);
  k.say=/\bsays?\b|說|output|print/i.test(t)&&!k.bcast&&!k.goto&&!k.move&&!k.start;
  k.sayCat=k.say&&/eat|吃/i.test(t)&&/to?ge?t?h?e?r|一起/i.test(t);
  k.sayDog=k.say&&/sure|好|當然|ok/i.test(t);
  k.end=n.type==='terminator'&&/end|stop|結束/i.test(t)&&!k.start;
  return k;
}
function gradeDog(work){
  const N=work.nodes||[], E=(work.edges||[]).filter(e=>e&&e.from&&e.to);
  const byId={}, out={}, inc={}; N.forEach(n=>{ byId[n.id]=n; out[n.id]=[]; inc[n.id]=[]; });
  E.forEach(e=>{ if(byId[e.from.node]&&byId[e.to.node]&&e.from.node!==e.to.node){ out[e.from.node].push(e); inc[e.to.node].push(e); } });
  const K={}; N.forEach(n=>K[n.id]=dogKind(n));
  const starts=N.filter(n=>K[n.id].start);
  const dogStart=starts.find(n=>K[n.id].receive||K[n.id].dog)||null;
  const catStart=starts.find(n=>n!==dogStart&&!K[n.id].receive)||null;
  const pick=f=>N.filter(n=>f(K[n.id]));
  const goto=pick(k=>k.goto)[0], loop=N.filter(n=>n.type==='loop')[0]||pick(k=>k.repeat)[0], move=pick(k=>k.move)[0];
  const sayCat=pick(k=>k.sayCat)[0]||pick(k=>k.say&&!k.sayDog)[0], bcast=pick(k=>k.bcast)[0], says=pick(k=>k.sayDog)[0]||pick(k=>k.say&&k!==K[sayCat&&sayCat.id])[0];
  const next=n=>n&&out[n.id].length?byId[out[n.id][0].to.node]:null;
  /* walk the cat's script: the LOOP repeats its body (the line that comes back), then leaves by the other line */
  const reach=(from,to)=>{ const seen=new Set([from]), q=[from]; while(q.length){ const id=q.shift(); if(id===to) return true; (out[id]||[]).forEach(e=>{ if(!seen.has(e.to.node)){ seen.add(e.to.node); q.push(e.to.node); } }); } return false; };
  const loopLines=n=>{ const es=out[n.id]||[]; let body=null, exit=null;
    es.forEach(e=>{ const lab=String(e.label||'').trim(); if(!body&&/^(yes|y|是|do|repeat|重複|loop)$/i.test(lab)) body=e; else if(!exit&&/^(no|n|否|done|end|exit|結束|完成)$/i.test(lab)) exit=e; });
    es.forEach(e=>{ if(e===body||e===exit) return; if(!body&&reach(e.to.node,n.id)) body=e; else if(!exit) exit=e; else if(!body) body=e; });
    return {body,exit}; };
  const trace=[]; let stop='';
  if(catStart){ let cur=next(catStart), steps=0; const left={};
    while(cur&&steps++<600){ const k=K[cur.id];
      if(cur.type==='loop'||k.repeat){ const lx=loopLines(cur);
        if(left[cur.id]===undefined){ const m=String(cur.text||'').match(/\d+/); left[cur.id]=m?Math.min(50,+m[0]):0; }
        if(left[cur.id]>0&&lx.body){ left[cur.id]--; cur=byId[lx.body.to.node]; continue; }
        delete left[cur.id]; cur=lx.exit?byId[lx.exit.to.node]:null; if(!lx.exit) stop='repeat 做完後沒有接到下一步'; continue; }
      trace.push({id:cur.id,k}); if(k.end) break;
      cur=next(cur); }
    if(steps>=600) stop='流程繞圈停不下來'; }
  const moves=trace.filter(x=>x.k.move).length, gotoAt=trace.findIndex(x=>x.k.goto), firstMove=trace.findIndex(x=>x.k.move);
  const sayAt=trace.findIndex(x=>x.k.sayCat||(x.k.say&&!x.k.sayDog)), bcAt=trace.findIndex(x=>x.k.bcastOK);
  const heard=bcAt>=0, dogTrace=[]; if(heard&&dogStart){ let cur=next(dogStart), s=0; while(cur&&s++<50){ dogTrace.push(K[cur.id]); if(K[cur.id].end) break; cur=next(cur); } }
  /* 1. shapes 60: rounded × 3 (two STARTs and the end), LOOP × 1, PROCESS / OUTPUT × 4 */
  const nTerm=N.filter(n=>n.type==='terminator').length, nLoop=N.filter(n=>n.type==='loop').length, nPO=N.filter(n=>n.type==='process'||n.type==='io').length;
  const items=[]; const shape=(label,have,need)=>{ const max=60*need/8; items.push({group:'圖形',label:`${label} × ${need}`,max,got:max*Math.min(need,have)/need,note:have<need?`已放 ${have} 個，需要 ${need} 個`:''}); };
  shape('START / END 圓角（貓、狗各一個 START，最後 broadcast 或 END）',nTerm,3); shape('LOOP 重複',nLoop,1); shape('PROCESS 處理／OUTPUT 輸出（go to、move、say、says）',nPO,4);
  /* 2. text 30 */
  const ok={catStart:!!catStart, goto:!!goto&&K[goto.id].gotoOK, repeat:!!loop&&K[loop.id].repeatOK, move:!!move&&K[move.id].moveOK,
    say:!!sayCat&&K[sayCat.id].sayCat, bcast:!!bcast&&K[bcast.id].bcastOK, dogStart:!!dogStart&&K[dogStart.id].receive&&/eat|吃/i.test(dogStart.text||''), says:!!says&&K[says.id].sayDog};
  const TXT={catStart:'貓的 START（START CAT）',goto:'go to (-160, 0)',repeat:'repeat 10',move:'move 10 steps',say:'say "eat together?"',bcast:'broadcast "eat"',dogStart:'狗的 START 收到 eat（START DOG receive "eat"）',says:'says "sure!"'};
  Object.keys(TXT).forEach(k=>items.push({group:'文字',label:TXT[k],max:30/8,got:ok[k]?30/8:0,note:ok[k]?'':'文字不對或還沒有這一步'}));
  /* 3. lines 10: connections 4 + run 6 */
  const L={cat1:!!catStart&&!!goto&&!!loop&&next(catStart)===goto&&reach(goto.id,loop.id),
    loopBack:!!loop&&!!move&&(()=>{ const lx=loopLines(loop); return !!lx.body&&reach(lx.body.to.node,move.id)&&reach(move.id,loop.id); })(),
    cat2:!!loop&&!!sayCat&&!!bcast&&(()=>{ const lx=loopLines(loop); return !!lx.exit&&reach(lx.exit.to.node,sayCat.id)&&reach(sayCat.id,bcast.id); })(),
    dog:!!dogStart&&!!says&&reach(dogStart.id,says.id)};
  const LT={cat1:'貓：START → go to → repeat 接上線',loopBack:'repeat 裡的 move 有線回到 repeat',cat2:'repeat 做完後 → say → broadcast 接上線',dog:'狗：START → says 接上線'};
  Object.keys(LT).forEach(k=>items.push({group:'線段',label:LT[k],max:1,got:L[k]?1:0,note:L[k]?'':'還沒接好'}));
  const full=[
    {lab:'貓先 go to，再走 10 次 move',exp:'move × 10',got:gotoAt<0?'沒有 go to':`move × ${moves}`,ok:gotoAt>=0&&moves===10&&gotoAt<firstMove},
    {lab:'走完後說 eat together? 再 broadcast eat',exp:'say → broadcast',got:sayAt<0?'沒有說話':bcAt<0?'沒有廣播 eat':sayAt<bcAt?'say → broadcast':'順序相反',ok:sayAt>=0&&bcAt>sayAt&&sayAt>firstMove&&!!sayCat&&ok.say},
    {lab:'狗收到 eat 後說 sure!',exp:'sure!',got:!heard?'貓沒有廣播':!dogStart||!ok.dogStart?'狗沒有收到 eat':dogTrace.some(k=>k.sayDog)?'sure!':'狗沒有說話',ok:heard&&ok.dogStart&&dogTrace.some(k=>k.sayDog)}];
  full.forEach(t=>items.push({group:'線段',label:'執行：'+t.lab,max:2,got:t.ok?2:0,note:t.ok?'':(stop||t.got)}));
  const allOK=full.every(t=>t.ok);
  if(allOK) items.forEach(i=>{ if(i.got<i.max){ i.got=i.max; i.note='執行結果全部正確，用不同畫法也算對'; } });
  const groups={}; items.forEach(i=>{ const x=groups[i.group]||(groups[i.group]={got:0,max:0}); x.got+=i.got; x.max+=i.max; });
  let total=Math.round(items.reduce((s,i)=>s+i.got,0)); if(!allOK) total=Math.min(total,99);
  const level=total>=90?'優秀':total>=75?'良好':total>=60?'及格':'需加強';
  const texts=N.filter(n=>String(n.text||'').trim()), zh=texts.filter(n=>/[㐀-鿿]/.test(n.text));
  const english=texts.length?Math.round(100*(texts.length-zh.length)/texts.length):0;
  const fixes=[]; DOG_STEPS.forEach(([k])=>{ if(!ok[k]) fixes.push(TXT[k]); }); Object.keys(LT).forEach(k=>{ if(!L[k]) fixes.push(LT[k]); });
  /* the eight steps in order, for the helper */
  const steps=DOG_STEPS.map(([k,name])=>({key:k,name,ok:ok[k],node:({catStart,goto,repeat:loop,move,say:sayCat,bcast,dogStart,says})[k]||null}));
  /* shapes to outline in red on the Grading Desk: a step whose text is wrong, or a shape with no line at all */
  const bad=new Set(steps.filter(s=>!s.ok&&s.node).map(s=>s.node.id));
  if(N.length>1) N.forEach(n=>{ if(!out[n.id].length&&!inc[n.id].length) bad.add(n.id); });
  return {task:'dog',total,level,items,groups,logic:[],full,fixes,bad:[...bad],badEdges:{},passed:allOK,english,zhWords:zh.map(n=>n.text),enTips:[],tiers:true,steps,lines:L,parts:{catStart,dogStart,goto,loop,move,sayCat,bcast,says}};
}
function feedbackDog(work,g){
  const enOK=g.english>=100;
  if(g.passed) return {en:'Excellent! The cat goes to (-160, 0), walks 10 times, asks "eat together?" and broadcasts "eat", and the dog answers "sure!".'+(enOK?' Everything is in English. Great job!':' Next time, try writing every label in English.'),
    zh:'流程圖完整又正確：貓定位、走 10 次、說話並廣播 eat，狗收到後回答 sure!'+(enOK?'而且全部用英文，非常棒！':'下次試著把文字都改成英文。')};
  const miss=(g.steps||[]).filter(s=>!s.ok).map(s=>s.name), bad=[...g.full].find(t=>!t.ok);
  let en=miss.length?`To improve: check ${miss.slice(0,3).join(', ')}.`:'Almost there! Check the lines.';
  let zh=miss.length?`需要修正：${miss.slice(0,3).join('、')}。`:'快完成了！檢查線有沒有接好。';
  if(bad){ en+=` Test: ${bad.lab} — got ${bad.got}.`; zh+=`測試：${bad.lab}，目前是「${bad.got}」。`; }
  return {en,zh};
}
(function(){
  const _taskOf=taskOf, _grade=gradeTask, _fb=feedbackTask;
  taskOf=function(w){ if(w&&w.task==='dog') return 'dog'; return _taskOf(w); };
  gradeTask=function(w){ return taskOf(w)==='dog'?gradeDog(w):_grade(w); };
  feedbackTask=function(w,g){ return (g&&g.task||taskOf(w))==='dog'?feedbackDog(w,g):_fb(w,g); };
})();
if(typeof module!=='undefined') Object.assign(module.exports,{gradeDog,feedbackDog,dogKind,gradeTask,feedbackTask,taskOf});
