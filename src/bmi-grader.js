/* BMI flowchart grader — shared by the teacher page (inlined) and node tests */
const CATS=[
  {key:'thin',name:'thin',re:/thin|underweight|過輕|太瘦|偏瘦/i},
  {key:'normal',name:'normal',re:/normal|正常|適中/i},
  {key:'overweight',name:'overweight',re:/overweight|over weight|過重/i},
  {key:'obesity',name:'obesity',re:/obes|肥胖/i},
];
const EN_WORDS={'身高':'height','體重':'weight','輸入':'input','輸出':'output','過輕':'thin','偏瘦':'thin','太瘦':'thin','正常':'normal','適中':'normal','過重':'overweight','肥胖':'obesity','開始':'START','結束':'END','計算':'bmi =','公尺':'m','公分':'cm','公斤':'kg','小於':'<','大於':'>','等於':'=','是':'Yes','否':'No'};
/* lines that point the wrong way or to the wrong block */
function flowEdgeIssues(A,start,wrongRuns,opt){
  const allowLoops=!!(opt&&opt.loops);
  const bad={}, mark=(e,why)=>{ if(e&&e.id!=null&&!bad[e.id]) bad[e.id]=why; };
  const isStart=n=>n&&n.type==='terminator'&&RE_START.test(n.text||''), isEnd=n=>n&&n.type==='terminator'&&RE_END.test(n.text||'')&&!RE_START.test(n.text||'');
  A.edges.forEach(e=>{ const f=A.byId[e.from.node], t=A.byId[e.to.node]; if(!f||!t) return;
    if(e.from.node===e.to.node) mark(e,'線接回自己');
    else if(isStart(t)) mark(e,'線指向 START，方向拉反了');
    else if(isEnd(f)) mark(e,'線從 END 出去，方向拉反了'); });
  if(start){
    const reach=new Set([start.id]), q=[start.id];
    while(q.length){ const id=q.shift(); (A.out[id]||[]).forEach(e=>{ if(!reach.has(e.to.node)){ reach.add(e.to.node); q.push(e.to.node); } }); }
    A.edges.forEach(e=>{ if(!reach.has(e.from.node)&&reach.has(e.to.node)) mark(e,'這條線的方向可能拉反了（起點從 START 走不到）'); });
    const color={}, stack=[]; const dfs=id=>{ color[id]=1; stack.push(id); for(const e of (A.out[id]||[])){ if(bad[e.id]) continue; const c=color[e.to.node];
        if(c===1){ const cyc=stack.slice(stack.lastIndexOf(e.to.node)); const hasDec=cyc.some(x=>A.byId[x]&&(A.byId[x].type==='decision'||A.byId[x].type==='loop'));
          if(!allowLoops||!hasDec) mark(e,allowLoops?'形成迴圈，可是迴圈裡沒有判斷，會停不下來':'形成迴圈，方向可能拉反了'); }
        else if(!c) dfs(e.to.node); } stack.pop(); color[id]=2; };
    try{ dfs(start.id); }catch(err){}
  }
  (wrongRuns||[]).forEach(w=>{ for(let i=w.pe.length-1;i>=0;i--){ const e=w.pe[i], t=A.byId[e.to.node]; if(t&&w.cat(t.text)===w.got){ mark(e,`接到 ${w.got}，這裡應該是 ${w.exp}`); break; } } });
  return bad;
}
/* direction mistakes cost structure points (wrong targets are already caught by the tests) */
function applyEdgePenalty(items,badEdges){
  const n=Object.values(badEdges).filter(w=>!/^接到/.test(w)).length; if(!n) return;
  const it=items.find(i=>i.label.startsWith('每個圖形都有接上線')); if(!it) return;
  it.got=Math.max(0,it.got-2*n); it.note=(it.note?it.note+'；':'')+`有 ${n} 條線方向拉反或形成迴圈（紅線）`;
}
const expectCat=b=>b<18.5?'thin':b<24?'normal':b<27?'overweight':'obesity';
const CASES=[16,18.4,18.5,22,24,25.5,27,32];
const TEST_H=1.6;

const RE_START=/開始|start|begin/i, RE_END=/結束|end|stop|結尾|完成/i;
const RE_H=/身高|height|高度|(^|[^a-z])h([^a-z]|$)|^\s*(input|輸入)?\s*m\s*$/i, RE_W=/體重|weight|重量|(^|[^a-z])w([^a-z]|$)|(^|[^a-z(])kg([^a-z)]|$)/i;
const RE_IN=/輸入|input|讀入|讀取|read|enter|請輸入|scan/i, RE_OUT=/輸出|output|print|顯示|印出|show|display/i;
const RE_YES=/^(是|yes|y|true|t|對|成立|真|o|ok)$/i, RE_NO=/^(否|no|n|false|f|不成立|不是|假|x)$/i;

function catOf(text){ const t=String(text||''); for(const c of CATS) if(c.re.test(t)) return c.key; return null; }
function norm(s){
  return String(s||'').replace(/[（]/g,'(').replace(/[）]/g,')').replace(/[＜]/g,'<').replace(/[＞]/g,'>').replace(/[＝]/g,'=')
    .replace(/[≦≤]/g,'<=').replace(/[≧≥]/g,'>=').replace(/[．]/g,'.').replace(/[０-９]/g,d=>String.fromCharCode(d.charCodeAt(0)-0xFEE0))
    .replace(/[÷]/g,'/').replace(/[×✕·]/g,'*').replace(/²/g,'^2').replace(/[？?。，,：:]/g,' ');
}
function heightUnit(text){
  const t=norm(text).toLowerCase();
  if(/cm|公分|釐米|厘米/.test(t)) return 'cm';
  if(/\(m\)|公尺|米|(\d|\s)m(\s|$|\))|meter/.test(t)) return 'm';
  return null;
}
/* expression → function of vars, only H W B numbers and arithmetic */
function compileExpr(src){
  let e=norm(src).toLowerCase()
    .replace(/\((kg|cm|m|公斤|公分|公尺)\)/g,'')
    .replace(/bmi/g,'B').replace(/體重|weight|重量/g,'W').replace(/身高|height|高度/g,'H')
    .replace(/kg/g,'W').replace(/(^|[^a-z])w(?![a-z])/g,'$1W').replace(/(^|[^a-z])h(?![a-z])/g,'$1H').replace(/(^|[^a-z])m(?![a-z])/g,'$1H');
  e=e.replace(/(?<=[\dHWB)])\s*x\s*(?=[\dHWB(])/g,'*').replace(/\^/g,'**').replace(/\s+/g,'');
  e=e.replace(/(?<=[\dHWB)])(?=[HWB(])/g,'*'); // implicit multiplication like 2H or H(H)
  if(!e||!/^[\d.HWB+\-*/()]+$/.test(e)) return null;
  try{ const f=new Function('H','W','B','return ('+e+');'); f(1.7,60,20); return f; }catch(err){ return null; }
}
/* "BMI = expr" or "expr → BMI" */
function parseAssign(text){
  const t=norm(text);
  let m=t.match(/^\s*([^=←<>]+?)\s*(?:=|←|:=)\s*(.+)$/);
  let lhs,rhs; if(m){ lhs=m[1]; rhs=m[2]; } else { m=t.match(/^(.+?)(?:→|->)\s*(\S+)\s*$/); if(!m) return null; lhs=m[2]; rhs=m[1]; }
  const l=lhs.toLowerCase().replace(/計算|算出|令|set|let|\s/g,'');
  const target=/bmi/.test(l)?'B':/身高|height|^h$/.test(l)?'H':/體重|weight|^w$/.test(l)?'W':null;
  if(!target) return null;
  const f=compileExpr(rhs); return f?{target,f,rhs}:{target,f:null,rhs};
}
/* decision text → predicate on B */
function compileCond(text){
  let t=norm(text).toLowerCase()
    .replace(/大於或等於|大於等於|不小於/g,'>=').replace(/小於或等於|小於等於|不大於/g,'<=')
    .replace(/大於|超過|高於/g,'>').replace(/小於|低於|未滿/g,'<').replace(/等於/g,'=')
    .replace(/bmi(值)?/g,'B').replace(/嗎|是否|呢|值/g,'');
  const parts=t.split(/&&|且|and|並且|而且/);
  const fns=[];
  for(const p of parts){
    const toks=p.replace(/\s+/g,'').split(/(<=|>=|==|=|<|>)/).filter(x=>x!=='');
    if(toks.length<3||toks.length%2===0) return null;
    for(let i=1;i<toks.length;i+=2){
      const a=toks[i-1],op=toks[i],b=toks[i+1];
      const val=x=>x==='B'?(v=>v):/^\d+(\.\d+)?$/.test(x)?(()=>+x):null;
      const A=val(a),Bv=val(b); if(!A||!Bv) return null;
      const o=op==='='?'==':op;
      fns.push(v=>{ const x=A(v),y=Bv(v); return o==='<'?x<y:o==='<='?x<=y:o==='>'?x>y:o==='>='?x>=y:Math.abs(x-y)<1e-9; });
    }
  }
  if(!fns.length) return null;
  return v=>fns.every(f=>f(v));
}

function analyze(work){
  const nodes=work.nodes||[], edges=work.edges||[];
  const byId=Object.fromEntries(nodes.map(n=>[n.id,n]));
  const out={}, inc={};
  nodes.forEach(n=>{out[n.id]=[];inc[n.id]=[];});
  edges.forEach(e=>{ if(byId[e.from.node]&&byId[e.to.node]&&e.from.node!==e.to.node){ out[e.from.node].push(e); inc[e.to.node].push(e); } });
  const starts=nodes.filter(n=>n.type==='terminator'&&RE_START.test(n.text));
  const ends=nodes.filter(n=>n.type==='terminator'&&RE_END.test(n.text)&&!RE_START.test(n.text));
  const isProcessLike=n=>/=|←|→/.test(norm(n.text))&&!/[<>]/.test(norm(n.text));
  const role=n=>{
    const t=n.text||'';
    if(n.type==='terminator') return RE_START.test(t)?'start':RE_END.test(t)?'end':'terminator';
    if(n.type==='decision') return 'decision';
    if(catOf(t)&&!RE_IN.test(t)) return 'output';
    if(RE_IN.test(t)) return 'input';
    if(RE_OUT.test(t)) return 'output';
    if(isProcessLike(n)) return 'calc';
    if(RE_H.test(t)||RE_W.test(t)) return 'input';
    if(/[<>]/.test(norm(t))&&/bmi/i.test(t)) return 'decision-text';
    return 'other';
  };
  nodes.forEach(n=>n._role=role(n));
  /* decision exits */
  const exits=n=>{
    const es=out[n.id]; let yes=null,no=null; const unk=[];
    es.forEach(e=>{ const l=String(e.label||'').trim(); if(RE_YES.test(l)&&!yes) yes=e; else if(RE_NO.test(l)&&!no) no=e; else unk.push(e); });
    if(!yes&&no&&unk.length===1) yes=unk[0]; else if(yes&&!no&&unk.length===1) no=unk[0];
    return {yes,no,count:es.length};
  };
  return {nodes,edges,byId,out,inc,starts,ends,exits};
}

function inputUnit(A){
  const hn=A.nodes.find(n=>n._role==='input'&&RE_H.test(n.text));
  let u=hn?heightUnit(hn.text):null;
  if(!u){ const calc=A.nodes.filter(n=>n._role==='calc').map(n=>norm(n.text)).join(' '); u=/100/.test(calc)?'cm':'m'; }
  return u;
}

function run(A,startNode,vars,unit){
  const outputs=[], path=[], pe=[]; let n=startNode, steps=0, reachedEnd=false, stop=null;
  while(n&&steps++<200){
    path.push(n.id);
    const r=n._role;
    if(r==='end'){ reachedEnd=true; break; }
    if(r==='input'){ const t=n.text; if(RE_H.test(t)){ const u=heightUnit(t)||unit; vars.H=u==='cm'?TEST_H*100:TEST_H; } if(RE_W.test(t)) vars.W=vars._W; }
    else if(r==='calc'){ const a=parseAssign(n.text); if(a&&a.f){ try{ let v=a.f(vars.H,vars.W,vars.B); if(isFinite(v)){ if(a.target==='B') v=Math.round(v*100)/100; vars[a.target]=v; } }catch(e){} } }
    else if(r==='output'){ const c=catOf(n.text); if(c) outputs.push(c); }
    if(n.type==='decision'){
      const cond=compileCond(n.text);
      if(!cond){ stop={node:n.id,why:'看不懂判斷條件'}; break; }
      if(vars.B===undefined||!isFinite(vars.B)){ stop={node:n.id,why:'判斷前還沒有算出 BMI'}; break; }
      const ex=A.exits(n), ans=cond(vars.B), e=ans?ex.yes:ex.no;
      if(!e){ stop={node:n.id,why:`缺少「${ans?'是':'否'}」的路線`}; break; }
      pe.push(e); n=A.byId[e.to.node]; continue;
    }
    const es=A.out[n.id];
    if(!es.length){ stop={node:n.id,why:'這裡沒有接下一步'}; break; }
    pe.push(es[0]); n=A.byId[es[0].to.node];
  }
  if(steps>=200) stop={node:n&&n.id,why:'流程繞圈出不來'};
  return {outputs,path,reachedEnd,stop,pe};
}

function grade(work){
  const A=analyze(work), items=[], issues=[], bad=new Set(), fixes0=[];
  const add=(group,label,max,got,note)=>items.push({group,label,max,got:Math.max(0,Math.min(max,got)),note:note||''});
  const nodes=A.nodes;
  /* --- A structure (20) --- */
  const start=A.starts[0]||null, end=A.ends[0]||null;
  add('結構','有「開始」符號',3,start?3:0,start?'':'找不到寫著「開始」的開始／結束符號');
  add('結構','有「結束」符號',3,end?3:0,end?'':'找不到寫著「結束」的開始／結束符號');
  let reach=false;
  if(start&&end){ const seen=new Set([start.id]), q=[start.id]; while(q.length){ const id=q.shift(); if(id===end.id){reach=true;break;} for(const e of A.out[id]) if(!seen.has(e.to.node)){seen.add(e.to.node);q.push(e.to.node);} } }
  add('結構','從開始能一路走到結束',4,reach?4:0,reach?'':(start&&end?'開始和結束之間有斷掉的地方':'缺少開始或結束，無法檢查'));
  const loose=[];
  nodes.forEach(n=>{
    const r=n._role;
    if(r!=='start'&&!A.inc[n.id].length){ loose.push(`「${n.text||'(空白)'}」沒有線連進來`); bad.add(n.id); }
    if(r!=='end'&&!A.out[n.id].length){ loose.push(`「${n.text||'(空白)'}」沒有線連出去`); bad.add(n.id); }
  });
  add('結構','每個圖形都有接上線',4,4-loose.length,loose.join('；'));
  const decs=nodes.filter(n=>n.type==='decision'); let decOK=0; const decNotes=[];
  decs.forEach(n=>{ const ex=A.exits(n);
    if(ex.yes&&ex.no) decOK++;
    else { bad.add(n.id); decNotes.push(ex.count<2?`「${n.text}」只有 ${ex.count} 條出口，判斷要有「是」和「否」兩條路`:`「${n.text}」的出口沒有標清楚「是／否」`); } });
  add('結構','每個判斷都有「是／否」兩條路',6,decs.length?6*decOK/decs.length:0,decs.length?decNotes.join('；'):'沒有判斷符號');
  /* --- B input (15) --- */
  const hIn=nodes.filter(n=>n._role==='input'&&RE_H.test(n.text)), wIn=nodes.filter(n=>n._role==='input'&&RE_W.test(n.text));
  add('輸入','輸入身高',4,hIn.length?4:0,hIn.length?'':'沒有找到輸入身高的步驟');
  add('輸入','輸入體重',4,wIn.length?4:0,wIn.length?'':'沒有找到輸入體重的步驟');
  const ins=[...new Set([...hIn,...wIn])], insIO=ins.filter(n=>n.type==='io');
  add('輸入','輸入使用「輸入／輸出」符號',2,ins.length?2*insIO.length/ins.length:0,ins.length&&insIO.length<ins.length?'輸入要用平行四邊形（輸入／輸出）符號':(ins.length?'':'沒有輸入步驟'));
  /* --- C calc (15) --- */
  const unit=inputUnit(A);
  const calcs=nodes.filter(n=>n._role==='calc'), bmiCalc=calcs.find(n=>{const a=parseAssign(n.text);return a&&a.target==='B';});
  add('計算','有計算 BMI 的步驟',3,bmiCalc?(bmiCalc.type==='process'?3:2):0,bmiCalc?(bmiCalc.type==='process'?'':'計算要放在長方形（處理）符號裡'):'沒有找到「BMI = …」的計算');
  let fScore=0, fNote='沒有可以檢查的公式';
  if(bmiCalc){
    const pre=calcs.filter(n=>n!==bmiCalc).map(n=>parseAssign(n.text)).filter(a=>a&&a.f&&a.target!=='B');
    const evalWith=(hm,w)=>{ const v={H:unit==='cm'?hm*100:hm,W:w}; pre.forEach(a=>{try{const r=a.f(v.H,v.W,v.B); if(isFinite(r)) v[a.target]=r;}catch(e){}}); const a=parseAssign(bmiCalc.text); return a.f(v.H,v.W,v.B); };
    const a=parseAssign(bmiCalc.text);
    if(!a.f){ fNote=`看不懂算式「${a.rhs}」`; }
    else { let ok=false; try{ ok=[[1.6,56.32],[1.75,70]].every(([h,w])=>Math.abs(evalWith(h,w)-w/(h*h))<0.05); }catch(e){}
      const usesBoth=/W/.test(compileSrc(a.rhs))&&/H/.test(compileSrc(a.rhs));
      if(ok){ fScore=7; fNote=''; }
      else { fScore=usesBoth?3:1; fNote=`公式應為 體重 ÷ 身高²（身高用公尺）`+(unit==='cm'?'；身高用公分時要先 ÷100':''); bad.add(bmiCalc.id); } }
  }
  add('計算','BMI 公式正確',7,fScore,fNote);
  /* --- D decisions (20) --- */
  const decText=decs.map(n=>norm(n.text)).join(' '), allText=nodes.map(n=>norm(n.text)).join(' ');
  const has=(txt,num)=>new RegExp('(^|[^\\d.])'+num.replace('.','\\.')+'(?![\\d]|\\.\\d)').test(txt);
  [['18.5','thin 與 normal 的分界'],['24','normal 與 overweight 的分界'],['27','overweight 與 obesity 的分界']].forEach(([num,desc])=>{
    const inDec=has(decText,num), any=has(allText,num);
    add('判斷',`有 ${num} 的判斷（${desc}）`,5,inDec?5:any?3:0,inDec?'':any?`${num} 沒有寫在判斷符號裡`:`缺少 BMI 和 ${num} 的比較`);
  });
  const decTextNodes=nodes.filter(n=>n._role==='decision-text');
  add('判斷','條件寫在「判斷」符號（菱形）裡',5,decs.length&&!decTextNodes.length?5:decs.length?3:0,!decs.length?'沒有使用判斷符號':decTextNodes.length?'有條件寫在別的符號裡':'');
  /* --- E outputs (10) --- */
  CATS.forEach(c=>{
    const io=nodes.find(n=>n.type==='io'&&catOf(n.text)===c.key), other=nodes.find(n=>catOf(n.text)===c.key);
    add('輸出',`輸出 ${c.name}`,2.5,io?2.5:other?1:0,io?'':other?`「${c.name}」要用輸入／輸出符號`:`缺少 ${c.name} 的輸出`);
  });
  /* --- F tests (20) --- */
  const firstDec=(()=>{ const fromDec=new Set(); decs.forEach(d=>A.out[d.id].forEach(e=>fromDec.add(e.to.node)));
    const roots=decs.filter(d=>!fromDec.has(d.id)); return (roots.length?roots:decs).sort((a,b)=>a.y-b.y)[0]||null; })();
  const wrongRuns=[];
  const logic=CASES.map(b=>{ const exp=expectCat(b); if(!firstDec) return {bmi:b,exp,got:null,ok:false,why:'沒有判斷符號'};
    const r=run(A,firstDec,{B:b},unit); const got=r.outputs.length?r.outputs[r.outputs.length-1]:null;
    const ok=got===exp&&new Set(r.outputs).size===1; if(!ok&&got) wrongRuns.push({pe:r.pe,got,exp,cat:catOf}); return {bmi:b,exp,got,ok,why:got?'':(r.stop?r.stop.why:'沒有輸出結果')}; });
  const lp=logic.filter(t=>t.ok).length;
  add('執行測試','判斷邏輯測試（直接給 BMI）',15,15*lp/CASES.length,`${lp} / ${CASES.length} 題正確`);
  const full=CASES.map(b=>{ const exp=expectCat(b), w=+(b*TEST_H*TEST_H).toFixed(4); if(!start) return {bmi:b,exp,got:null,ok:false,why:'沒有開始'};
    const r=run(A,start,{_W:w},unit); const got=r.outputs.length?r.outputs[r.outputs.length-1]:null;
    const ok=got===exp&&new Set(r.outputs).size===1; return {bmi:b,h:TEST_H,w,exp,got,ok,why:got?'':(r.stop?r.stop.why:'沒有輸出結果'),stop:r.stop}; });
  const fp=full.filter(t=>t.ok).length;
  add('執行測試','完整流程測試（輸入身高體重）',15,15*fp/CASES.length,`${fp} / ${CASES.length} 題正確`);
  const firstStop=full.find(t=>t.stop);
  if(firstStop&&firstStop.stop.node) bad.add(firstStop.stop.node);
  const badEdges=flowEdgeIssues(A,start,wrongRuns); applyEdgePenalty(items,badEdges);
  if(Object.keys(badEdges).length) fixes0.push(`有 ${Object.keys(badEdges).length} 條紅色的線：方向拉反、形成迴圈或接到錯的方塊`);
  /* --- G English (10) --- */
  const CJK=/[\u3400-\u9fff]/;
  const textNodes=nodes.filter(n=>String(n.text||'').trim()&&['terminator','io','process','decision'].includes(n.type));
  const zhNodes=textNodes.filter(n=>CJK.test(n.text));
  const decLabels=A.edges.filter(e=>A.byId[e.from.node]&&A.byId[e.from.node].type==='decision'&&String(e.label||'').trim());
  const zhLabels=decLabels.filter(e=>CJK.test(e.label));
  const words=[...new Set([...zhNodes.map(n=>n.text),...zhLabels.map(e=>e.label)].join(' ').match(/[\u3400-\u9fff]+/g)||[])];
  const sug=words.map(w=>{ const k=Object.keys(EN_WORDS).find(z=>w.includes(z)); return k?`${k} → ${EN_WORDS[k]}`:null; }).filter(Boolean);
  const enNote=sug.length?'試試看用英文 Try English：'+[...new Set(sug)].slice(0,5).join('、'):'';
  const enUnits=textNodes.length+decLabels.length, english=enUnits?Math.round(100*(enUnits-zhNodes.length-zhLabels.length)/enUnits):0;
  /* totals */
  const groups={}; items.forEach(i=>{ const g=groups[i.group]||(groups[i.group]={got:0,max:0}); g.got+=i.got; g.max+=i.max; });
  const total=Math.round(items.reduce((s,i)=>s+i.got,0));
  const fixes=[...fixes0]; items.filter(i=>i.got<i.max&&i.note&&!/題正確$|無法檢查/.test(i.note)).forEach(i=>i.note.split('；').forEach(x=>{ if(!/（紅線）/.test(x)) fixes.push(x); }));
  logic.filter(t=>!t.ok&&t.got).slice(0,3).forEach(t=>fixes.push(`BMI ${t.bmi} 應該輸出 ${t.exp}，你的流程輸出 ${t.got}`));
  if(firstStop&&fp===0) fixes.push(`完整流程執行到「${(A.byId[firstStop.stop.node]||{}).text||''}」就停住：${firstStop.stop.why}`);
  const level=total>=90?'優秀':total>=75?'良好':total>=60?'及格':'需加強';
  const gotAll=items.reduce((s,i)=>s+i.got,0), maxAll=items.reduce((s,i)=>s+i.max,0);
  return {total,level,items,groups,logic,full,fixes:[...new Set(fixes)],bad:[...bad],badEdges,unit,passed:gotAll>=maxAll-1e-6,english,enNote,zhWords:words,enTips:[...new Set(sug)]};
}
function compileSrc(rhs){ return norm(rhs).toLowerCase().replace(/\((kg|cm|m|公斤|公分|公尺)\)/g,'').replace(/體重|weight|重量|kg/g,'W').replace(/身高|height|高度/g,'H').replace(/(^|[^a-z])w(?![a-z])/g,'$1W').replace(/(^|[^a-z])h(?![a-z])/g,'$1H').replace(/(^|[^a-z])m(?![a-z])/g,'$1H'); }

/* bilingual feedback built from a grade result */
function feedback(work,g){
  const it=l=>g.items.find(i=>i.label.startsWith(l)), full=i=>!!i&&i.got>=i.max-1e-9;
  const nodes=work.nodes||[], edges=work.edges||[], q=t=>`"${String(t||'').replace(/\n/g,' ')}"`;
  const enOK=g.english>=100;
  if(g.passed) return {
    en:'Excellent! Your flowchart is complete and all 8 BMI tests passed.'+(enOK?' You wrote everything in English. Great job!':' Next time, try writing every label in English'+(g.enTips.length?` (${g.enTips.slice(0,3).join(', ')}).`:'.')),
    zh:'流程圖完整又正確，八個測試全部通過！'+(enOK?'而且全部用英文，非常棒！':'下次試著把文字都改成英文'+(g.enTips.length?`（${g.enTips.slice(0,3).join('、')}）`:'')+'，讓作品更完整。')};
  const pos=[],posZ=[];
  if(full(it('BMI 公式正確'))){ pos.push('your BMI formula is correct'); posZ.push('BMI 公式寫得正確'); }
  if(full(it('輸入身高'))&&full(it('輸入體重'))){ pos.push('your height and weight inputs are clear'); posZ.push('身高和體重的輸入很清楚'); }
  if(['18.5','24','27'].every(n=>full(it('有 '+n)))){ pos.push('all three cut-off values are there'); posZ.push('三個分界值都有判斷到'); }
  if(enOK){ pos.push('you used English throughout'); posZ.push('全部都用英文'); }
  const fx=[],fz=[]; const add=(e,z)=>{ fx.push(e); fz.push(z); };
  const inc={},out={}; nodes.forEach(n=>{inc[n.id]=0;out[n.id]=0;});
  edges.forEach(e=>{ if(inc[e.to.node]!==undefined) inc[e.to.node]++; if(out[e.from.node]!==undefined) out[e.from.node]++; });
  const sorted=[...nodes].sort((a,b)=>a.y-b.y);
  const isS=n=>n.type==='terminator'&&RE_START.test(n.text), isE=n=>n.type==='terminator'&&RE_END.test(n.text)&&!RE_START.test(n.text);
  const loose=sorted.find(n=>(!isE(n)&&!out[n.id])||(!isS(n)&&!inc[n.id]));
  if(!nodes.some(isS)) add('add a START at the top','最前面要有 START（開始）');
  if(!(it('輸入身高')||{}).got||!(it('輸入體重')||{}).got) add('input both height and weight','要先輸入身高和體重');
  const calc=it('有計算 BMI');
  if(calc&&!calc.got) add('add a process: bmi = weight / height^2','加上計算步驟：bmi = weight / height^2');
  else if(!full(it('BMI 公式正確'))) add('fix the formula: BMI = weight ÷ height² (height in metres)','公式要改成「體重 ÷ 身高²」，身高用公尺');
  const miss=['18.5','24','27'].filter(n=>!full(it('有 '+n))); if(miss.length) add(`add decisions for ${miss.join(', ')}`,`還少了和 ${miss.join('、')} 比較的判斷`);
  const outs=CATS.filter(c=>!(it('輸出 '+c.name)||{}).got).map(c=>c.name); if(outs.length) add(`add outputs for ${outs.join(', ')}`,`缺少 ${outs.join('、')} 的輸出`);
  if(loose) add(`connect ${q(loose.text)} with lines`,`把 ${q(loose.text)} 用線接好，流程才不會斷掉`);
  const br=nodes.find(n=>n.type==='decision'&&edges.filter(e=>e.from.node===n.id).length<2);
  if(br) add(`the decision ${q(br.text)} needs two lines: Yes and No`,`判斷 ${q(br.text)} 要有 Yes 和 No 兩條線`);
  if(!nodes.some(isE)) add('finish with an END','最後記得加上 END（結束）');
  const wrong=g.logic.find(t=>!t.ok&&t.got);
  let en=(pos.length?`Good work: ${pos.slice(0,2).join(' and ')}.`:'Thank you for your flowchart!');
  let zh=(posZ.length?posZ.slice(0,2).join('，')+'，很不錯！':'謝謝你完成這份流程圖！');
  if(fx.length){ en+=` To improve: ${fx.slice(0,2).join('; ')}.`; zh+='需要修正：'+fz.slice(0,2).join('；')+'。'; }
  if(wrong){ en+=` Right now BMI ${wrong.bmi} gives ${wrong.got}, but it should be ${wrong.exp}.`; zh+=`目前 BMI ${wrong.bmi} 會變成 ${wrong.got}，正確應該是 ${wrong.exp}。`; }
  if(!enOK&&g.enTips.length){ en+=` Try more English: ${g.enTips.slice(0,3).join(', ')}.`; zh+=`也試著多用英文：${g.enTips.slice(0,3).join('、')}。`; }
  en+=g.level==='優秀'?' Almost perfect, keep going!':g.level==='良好'?' Fix these and you are done. You can do it!':' Fix these step by step and check again. You can do it!';
  zh+=g.level==='優秀'?'只差一點點，繼續保持！':g.level==='良好'?'修正後就完整了，加油！':'照著修改，再檢查一次，一定會更好！';
  return {en,zh};
}

if(typeof module!=='undefined') module.exports={feedback,grade,CASES,expectCat,CATS,parseAssign,compileCond,heightUnit,catOf,norm,RE_H,RE_W};
