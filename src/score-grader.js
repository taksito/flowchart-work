/* ===== Average score task: input 4 scores, total, average, pass/fail ===== */
const PASS_LINE=60;
const SCORE_CASES=[[70,80,90,60],[60,60,60,60],[59,60,60,60],[100,100,100,0],[40,50,60,80],[0,0,0,0],[61,59,60,60],[100,90,80,70]];
const sAvg=a=>(a[0]+a[1]+a[2]+a[3])/4;
const sExpect=a=>sAvg(a)>=PASS_LINE?'pass':'fail';
const STOP=new Set(['input','output','print','read','enter','scan','set','let','if','then','and','or','is','the','輸入','輸出','印出','顯示','計算','令','是否','嗎','和','與','及','請']);
function sCat(text){ const t=String(text||''); if(/fail|不及格|不通過|沒過/i.test(t)) return 'fail'; if(/pass|及格|通過/i.test(t)) return 'pass'; return null; }
function sNorm(s){
  return norm(s).replace(/大於或等於|大於等於|不小於|至少/g,'>=').replace(/小於或等於|小於等於|不大於|至多/g,'<=')
    .replace(/大於|超過|高於/g,'>').replace(/小於|低於|未滿/g,'<').replace(/不等於/g,'!=').replace(/等於/g,'==')
    .replace(/[÷]/g,'/').replace(/[×]/g,'*').replace(/[＋]/g,'+').replace(/[－−]/g,'-');
}
/* tokens -> js using env lookups */
function sTokens(src){
  const t=sNorm(src), out=[]; const re=/\s*(<=|>=|==|!=|←|:=|->|→|[<>=+\-*/^()]|\d+(?:\.\d+)?|[A-Za-z_][A-Za-z0-9_]*|[㐀-鿿]+)/gy; let m, last=0;
  while((m=re.exec(t))){ out.push(m[1]); last=re.lastIndex; }
  if(t.slice(last).trim()) return null; return out;
}
const isId=x=>/^([A-Za-z_][A-Za-z0-9_]*|[㐀-鿿]+)$/.test(x);
const idKey=x=>/^[A-Za-z_]/.test(x)?x.toLowerCase():x;
function sJs(toks){
  const vars=new Set(); const js=toks.map(x=>{ if(isId(x)){ const k=idKey(x); vars.add(k); return `e[${JSON.stringify(k)}]`; } if(x==='^') return '**'; if(x==='=') return '=='; return x; }).join(' ');
  return {js,vars};
}
function sExpr(toks){ if(!toks||!toks.length) return null; const {js,vars}=sJs(toks); try{ const f=new Function('e','return ('+js+');'); return {f,vars}; }catch(e){ return null; } }
function sAssign(text){
  const toks=sTokens(text); if(!toks) return null;
  const tk=toks.filter(x=>!(isId(x)&&STOP.has(idKey(x))));
  let i=tk.findIndex(x=>x==='='||x==='←'||x===':=');
  if(i===1&&isId(tk[0])){ const ex=sExpr(tk.slice(2)); return {target:idKey(tk[0]),expr:ex,rhs:tk.slice(2).join(' ')}; }
  i=tk.findIndex(x=>x==='->'||x==='→');
  if(i>0&&i===tk.length-2&&isId(tk[i+1])){ const ex=sExpr(tk.slice(0,i)); return {target:idKey(tk[i+1]),expr:ex,rhs:tk.slice(0,i).join(' ')}; }
  return null;
}
function sCond(text){
  const toks=sTokens(text); if(!toks) return null;
  const tk=toks.filter(x=>!(isId(x)&&STOP.has(idKey(x))));
  if(!tk.some(x=>/^(<=|>=|==|!=|<|>|=)$/.test(x))) return null;
  // chained comparisons a<=b<c -> (a<=b)&&(b<c)
  const parts=[]; let cur=[]; const ops=[];
  tk.forEach(x=>{ if(/^(<=|>=|==|!=|<|>|=)$/.test(x)){ parts.push(cur); ops.push(x==='='?'==':x); cur=[]; } else cur.push(x); }); parts.push(cur);
  if(parts.some(p=>!p.length)) return null;
  const sides=parts.map(p=>sJs(p)); const vars=new Set(); sides.forEach(s=>s.vars.forEach(v=>vars.add(v)));
  const js=ops.map((o,k)=>`((${sides[k].js}) ${o} (${sides[k+1].js}))`).join('&&');
  try{ const f=new Function('e','return ('+js+');'); return {f,vars,nums:(tk.join(' ').match(/\d+(\.\d+)?/g)||[]).map(Number)}; }catch(e){ return null; }
}
function sInputVars(n){
  const body=String(n.text||'').replace(/^(input|輸入|read|enter)\s*[:：]?\s*/i,'');
  return (sNorm(body).match(/[A-Za-z_][A-Za-z0-9_]*|[㐀-鿿]+/g)||[]).map(idKey).filter(v=>!STOP.has(v)&&!/^(cm|kg|分)$/.test(v));
}
function sAnalyze(work){
  const A=analyze(work);
  A.nodes.forEach(n=>{ const t=n.text||'';
    if(n.type==='terminator') n._r=RE_START.test(t)?'start':RE_END.test(t)?'end':'term';
    else if(n.type==='decision') n._r='decision';
    else if(n.type==='io'&&(n.role==='output'||(!n.role&&/^(output|輸出|print|印出|顯示)/i.test(t)))) n._r='output';
    else if(n.type==='io') n._r='input';
    else if(sCat(t)&&RE_OUT.test(t)) n._r='output';
    else if(sAssign(t)) n._r='calc';
    else if(RE_IN.test(t)) n._r='input';
    else n._r='other'; });
  return A;
}
function sOrderedInputs(A,start){
  const seen=new Set(), order=[]; const q=start?[start.id]:[];
  while(q.length){ const id=q.shift(); if(seen.has(id)) continue; seen.add(id); const n=A.byId[id]; if(n&&n._r==='input') order.push(n);
    A.out[id].forEach(e=>q.push(e.to.node)); }
  A.nodes.filter(n=>n._r==='input'&&!seen.has(n.id)).sort((a,b)=>a.y-b.y).forEach(n=>order.push(n));
  return order;
}
function sRun(A,start,scores){
  const e={}, q=[...scores], outputs=[]; let n=start, steps=0, stop=null;
  while(n&&steps++<200){
    const r=n._r;
    if(r==='end') break;
    if(r==='input') sInputVars(n).forEach(v=>{ e[v]=q.length?q.shift():undefined; });
    else if(r==='calc'){ const a=sAssign(n.text); if(a&&a.expr){ try{ const v=a.expr.f(e); if(typeof v==='number'&&isFinite(v)) e[a.target]=v; }catch(err){} } }
    else if(r==='output'){ const c=sCat(n.text); if(c) outputs.push(c); }
    if(n.type==='decision'){
      const c=sCond(n.text); if(!c){ stop={node:n.id,why:'看不懂判斷條件'}; break; }
      let ans; try{ ans=!!c.f(e); }catch(err){ ans=false; }
      if([...c.vars].some(v=>e[v]===undefined)){ stop={node:n.id,why:'判斷用到還沒算出來的變數'}; break; }
      const ex=A.exits(n), ed=ans?ex.yes:ex.no;
      if(!ed){ stop={node:n.id,why:`缺少「${ans?'Yes':'No'}」的路線`}; break; }
      n=A.byId[ed.to.node]; continue;
    }
    const es=A.out[n.id]; if(!es.length){ stop={node:n.id,why:'這裡沒有接下一步'}; break; }
    n=A.byId[es[0].to.node];
  }
  if(steps>=200) stop={node:n&&n.id,why:'流程繞圈出不來'};
  return {outputs,env:e,stop};
}
/* simulate process steps (by flow order, then by y) to find total / average vars */
function sCalcCheck(A,inVars){
  const calcs=A.nodes.filter(n=>n._r==='calc').sort((a,b)=>a.y-b.y).map(n=>({n,a:sAssign(n.text)})).filter(x=>x.a);
  const sample=[70,80,90,61];
  const e={}; inVars.slice(0,4).forEach((v,i)=>e[v]=sample[i]);
  for(let pass=0;pass<3;pass++) calcs.forEach(({a})=>{ if(a.expr){ try{ const v=a.expr.f(e); if(typeof v==='number'&&isFinite(v)) e[a.target]=v; }catch(err){} } });
  const sum=sample.reduce((x,y)=>x+y,0), avg=sum/4;
  const near=(x,y)=>typeof x==='number'&&Math.abs(x-y)<1e-6;
  const totalC=calcs.find(({a})=>near(e[a.target],sum)), avgC=calcs.find(({a})=>near(e[a.target],avg));
  return {calcs,e,totalC,avgC,sum,avg};
}
function gradeScore(work){
  const A=sAnalyze(work), items=[], bad=new Set();
  const add=(group,label,max,got,note)=>items.push({group,label,max,got:Math.max(0,Math.min(max,got)),note:note||''});
  const nodes=A.nodes;
  const start=nodes.find(n=>n._r==='start')||null, end=nodes.find(n=>n._r==='end')||null;
  /* structure 20 */
  add('結構','有「開始」符號',3,start?3:0,start?'':'找不到 START（開始）');
  add('結構','有「結束」符號',3,end?3:0,end?'':'找不到 END（結束）');
  let reach=false; if(start&&end){ const seen=new Set([start.id]),q=[start.id]; while(q.length){ const id=q.shift(); if(id===end.id){reach=true;break;} A.out[id].forEach(e=>{ if(!seen.has(e.to.node)){seen.add(e.to.node);q.push(e.to.node);} }); } }
  add('結構','從開始能一路走到結束',4,reach?4:0,reach?'':(start&&end?'開始和結束之間有斷掉的地方':'缺少開始或結束，無法檢查'));
  const loose=[]; nodes.forEach(n=>{ if(n._r!=='start'&&!A.inc[n.id].length){ loose.push(`「${n.text||'(空白)'}」沒有線連進來`); bad.add(n.id); } if(n._r!=='end'&&!A.out[n.id].length){ loose.push(`「${n.text||'(空白)'}」沒有線連出去`); bad.add(n.id); } });
  add('結構','每個圖形都有接上線',4,4-loose.length,loose.join('；'));
  const decs=nodes.filter(n=>n.type==='decision'); let decOK=0; const dn=[];
  decs.forEach(n=>{ const ex=A.exits(n); if(ex.yes&&ex.no) decOK++; else { bad.add(n.id); dn.push(`「${n.text}」要有 Yes 和 No 兩條路`); } });
  add('結構','每個判斷都有 Yes／No 兩條路',6,decs.length?6*decOK/decs.length:0,decs.length?dn.join('；'):'沒有判斷符號');
  /* input 10 */
  const ins=sOrderedInputs(A,start), inVars=[...new Set(ins.flatMap(sInputVars))];
  add('輸入','輸入四個成績',8,2*Math.min(4,inVars.length),inVars.length>=4?'':`目前輸入了 ${inVars.length} 個成績，要輸入 4 個`);
  const insIO=ins.filter(n=>n.type==='io');
  add('輸入','輸入使用「輸入／輸出」符號',2,ins.length?2*insIO.length/ins.length:0,ins.length&&insIO.length<ins.length?'輸入要用平行四邊形（INPUT）符號':(ins.length?'':'沒有輸入步驟'));
  /* calc 20 */
  const C=sCalcCheck(A,inVars);
  const procOK=c=>c&&c.n.type==='process';
  add('計算','計算總分（四個成績相加）',10,C.totalC?(procOK(C.totalC)?10:7):(C.avgC?10:(C.calcs.length?3:0)),C.totalC||C.avgC?(C.totalC&&!procOK(C.totalC)?'計算要放在 PROCESS（長方形）裡':''):(C.calcs.length?'總分要把四個成績全部加起來':'沒有找到計算總分的步驟，例如 total = s1 + s2 + s3 + s4'));
  let avgNote='';
  if(!C.avgC){ const near=(x,y)=>Math.abs(x-y)<1e-6; const vals=C.calcs.map(({a})=>C.e[a.target]);
    avgNote=vals.some(v=>near(v,C.sum/3))?'平均要除以 4，不是 3':vals.some(v=>near(v,C.sum))&&C.calcs.length<2?'還要再算平均：總分 ÷ 4':'沒有找到計算平均的步驟，例如 avg = total / 4';
    C.calcs.forEach(({n})=>bad.add(n.id)); }
  add('計算','計算平均（總分 ÷ 4）',10,C.avgC?(procOK(C.avgC)?10:7):0,avgNote);
  /* decision 15 */
  const decText=decs.map(n=>sNorm(n.text)).join(' ');
  const has60=/(^|[^\d.])60(?![\d]|\.\d)/.test(decText);
  add('判斷','和及格分數 60 比較',10,has60?10:(/(^|[^\d.])60(?![\d])/.test(nodes.map(n=>n.text).join(' '))?5:0),has60?'':'缺少平均和 60 的比較');
  const condNodes=nodes.filter(n=>n.type!=='decision'&&/[<>]/.test(sNorm(n.text||''))&&n._r!=='calc');
  add('判斷','條件寫在 DECISION（菱形）裡',5,decs.length&&!condNodes.length?5:decs.length?3:0,!decs.length?'沒有使用判斷符號':condNodes.length?'有條件寫在別的符號裡':'');
  /* output 10 */
  [['pass','pass'],['fail','fail']].forEach(([k,name])=>{ const io=nodes.find(n=>n.type==='io'&&n._r==='output'&&sCat(n.text)===k), other=nodes.find(n=>sCat(n.text)===k);
    add('輸出',`輸出 ${name}`,5,io?5:other?2:0,io?'':other?`「${name}」要用 OUTPUT 符號`:`缺少 ${name} 的輸出`); });
  /* tests 25 */
  const full=SCORE_CASES.map(sc=>{ const exp=sExpect(sc); if(!start) return {scores:sc,avg:sAvg(sc),exp,got:null,ok:false,why:'沒有 START'};
    const r=sRun(A,start,sc); const got=r.outputs.length?r.outputs[r.outputs.length-1]:null;
    return {scores:sc,avg:sAvg(sc),exp,got,ok:got===exp&&new Set(r.outputs).size===1,why:got?'':(r.stop?r.stop.why:'沒有輸出結果'),stop:r.stop}; });
  const fp=full.filter(t=>t.ok).length;
  add('執行測試','完整流程測試（輸入四個成績）',25,25*fp/SCORE_CASES.length,`${fp} / ${SCORE_CASES.length} 題正確`);
  const st=full.find(t=>t.stop); if(st&&st.stop.node) bad.add(st.stop.node);
  const b60=full.find(t=>t.avg===PASS_LINE&&!t.ok&&t.got==='fail');
  /* english (not scored) */
  const CJK=/[㐀-鿿]/;
  const textNodes=nodes.filter(n=>String(n.text||'').trim()&&['terminator','io','process','decision'].includes(n.type));
  const zhNodes=textNodes.filter(n=>CJK.test(n.text));
  const decLabels=A.edges.filter(e=>A.byId[e.from.node]&&A.byId[e.from.node].type==='decision'&&String(e.label||'').trim());
  const zhLabels=decLabels.filter(e=>CJK.test(e.label));
  const words=[...new Set([...zhNodes.map(n=>n.text),...zhLabels.map(e=>e.label)].join(' ').match(/[㐀-鿿]+/g)||[])];
  const sug=[...new Set(words.map(w=>{ const k=Object.keys(EN_WORDS).find(z=>w.includes(z)); return k?`${k} → ${EN_WORDS[k]}`:null; }).filter(Boolean))];
  const enUnits=textNodes.length+decLabels.length, english=enUnits?Math.round(100*(enUnits-zhNodes.length-zhLabels.length)/enUnits):0;
  /* totals */
  if(fp===SCORE_CASES.length){ items.forEach(i=>{ if((i.group==='計算'||i.group==='判斷'||/^(把答案存進變數|輸入四個成績|詢問四個成績)/.test(i.label))&&i.got<i.max){ i.got=i.max; i.note='答案全部正確，用不同寫法也算對'; } }); C.calcs.forEach(({n})=>bad.delete(n.id)); }
  const groups={}; items.forEach(i=>{ const g=groups[i.group]||(groups[i.group]={got:0,max:0}); g.got+=i.got; g.max+=i.max; });
  const total=Math.round(items.reduce((s,i)=>s+i.got,0));
  const fixes=[]; items.filter(i=>i.got<i.max&&i.note&&!/題正確$|無法檢查/.test(i.note)).forEach(i=>i.note.split('；').forEach(x=>fixes.push(x)));
  if(b60) fixes.push('平均剛好 60 也算 pass，判斷要用 >= 60');
  full.filter(t=>!t.ok&&t.got).slice(0,2).forEach(t=>fixes.push(`成績 ${t.scores.join('、')}（平均 ${t.avg}）應該是 ${t.exp}，你的流程輸出 ${t.got}`));
  if(st&&fp===0) fixes.push(`流程執行到「${(A.byId[st.stop.node]||{}).text||''}」就停住：${st.stop.why}`);
  const level=total>=90?'優秀':total>=75?'良好':total>=60?'及格':'需加強';
  const gotAll=items.reduce((s,i)=>s+i.got,0), maxAll=items.reduce((s,i)=>s+i.max,0);
  return {task:'score',total,level,items,groups,logic:[],full,fixes:[...new Set(fixes)],bad:[...bad],passed:gotAll>=maxAll-1e-6,english,zhWords:words,enTips:sug,inVars,calc:C};
}
function feedbackScore(work,g){
  const it=l=>g.items.find(i=>i.label.startsWith(l)), full=i=>!!i&&i.got>=i.max-1e-9, enOK=g.english>=100;
  if(g.passed) return {
    en:'Excellent! Your flowchart is complete and all 8 score tests passed.'+(enOK?' You wrote everything in English. Great job!':' Next time, try writing every label in English'+(g.enTips.length?` (${g.enTips.slice(0,3).join(', ')}).`:'.')),
    zh:'流程圖完整又正確，八個測試全部通過！'+(enOK?'而且全部用英文，非常棒！':'下次試著把文字都改成英文'+(g.enTips.length?`（${g.enTips.slice(0,3).join('、')}）`:'')+'。')};
  const pos=[],pz=[],fx=[],fz=[]; const add=(e,z)=>{fx.push(e);fz.push(z);};
  if(full(it('輸入四個成績'))){ pos.push('you input all four scores'); pz.push('四個成績都有輸入'); }
  if(full(it('計算總分'))){ pos.push('your total is correct'); pz.push('總分算對了'); }
  if(full(it('計算平均'))){ pos.push('your average is correct'); pz.push('平均算對了'); }
  if(enOK){ pos.push('you used English throughout'); pz.push('全部都用英文'); }
  if(!full(it('有「開始」'))) add('add a START at the top','最前面要有 START');
  if(!full(it('輸入四個成績'))) add('input four scores, e.g. s1, s2, s3, s4','要輸入四個成績，例如 s1、s2、s3、s4');
  if(!full(it('計算總分'))) add('add the four scores: total = s1 + s2 + s3 + s4','把四個成績加起來：total = s1 + s2 + s3 + s4');
  if(!full(it('計算平均'))) add('divide the total by 4: avg = total / 4','總分除以 4 算平均：avg = total / 4');
  if(!full(it('和及格分數'))) add('compare the average with 60','用平均和 60 比較');
  ['pass','fail'].forEach(k=>{ if(!(it('輸出 '+k)||{}).got) add(`add an OUTPUT: ${k}`,`加上 OUTPUT：${k}`); });
  if(g.full.some(t=>t.avg===PASS_LINE&&!t.ok&&t.got==='fail')) add('use >= 60, because an average of exactly 60 passes','平均剛好 60 也算及格，要用 >= 60');
  const loose=it('每個圖形都有接上線'); if(loose&&!full(loose)) add('connect every shape with lines','把每個圖形用線接好');
  if(!full(it('有「結束」'))) add('finish with an END','最後加上 END');
  const wrong=g.full.find(t=>!t.ok&&t.got);
  let en=pos.length?`Good work: ${pos.slice(0,2).join(' and ')}.`:'Thank you for your flowchart!';
  let zh=pz.length?pz.slice(0,2).join('，')+'，很不錯！':'謝謝你完成這份流程圖！';
  if(fx.length){ en+=` To improve: ${fx.slice(0,2).join('; ')}.`; zh+='需要修正：'+fz.slice(0,2).join('；')+'。'; }
  if(wrong){ en+=` Right now an average of ${wrong.avg} gives ${wrong.got}, but it should be ${wrong.exp}.`; zh+=`目前平均 ${wrong.avg} 會變成 ${wrong.got}，正確應該是 ${wrong.exp}。`; }
  if(!enOK&&g.enTips.length){ en+=` Try more English: ${g.enTips.slice(0,3).join(', ')}.`; zh+=`也試著多用英文：${g.enTips.slice(0,3).join('、')}。`; }
  en+=g.level==='優秀'?' Almost perfect, keep going!':' Fix these step by step and check again. You can do it!';
  zh+=g.level==='優秀'?'只差一點點，繼續保持！':'照著修改，再檢查一次，一定會更好！';
  return {en,zh};
}
Object.assign(EN_WORDS,{'成績':'score','分數':'score','總分':'total','總和':'total','平均':'avg','不及格':'fail','及格':'pass','通過':'pass'});
function taskOf(work){ if(work&&(work.task==='score'||work.task==='bmi')) return work.task;
  const t=(work&&work.nodes||[]).map(n=>n.text||'').join(' ');
  return /pass|fail|及格|平均|avg|average|total|總分/i.test(t)&&!/bmi|height|weight|身高|體重/i.test(t)?'score':'bmi'; }
function gradeTask(work){ const t=taskOf(work); const g=t==='score'?gradeScore(work):grade(work); g.task=t; return g; }
function feedbackTask(work,g){ return (g.task||taskOf(work))==='score'?feedbackScore(work,g):feedback(work,g); }
if(typeof module!=='undefined') Object.assign(module.exports,{gradeScore,feedbackScore,gradeTask,feedbackTask,taskOf,sAssign,sCond,sInputVars,sCat,sNorm,SCORE_CASES,PASS_LINE});
