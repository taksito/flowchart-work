/* ===== Summation task: input n, add 1 + 2 + … + n with a loop, output the sum ===== */
const SUM_CASES=[1,2,3,4,5,10,20,100];
const sumOf=n=>n*(n+1)/2;
Object.assign(EN_WORDS,{'總和':'sum','和':'sum','累加':'sum = sum + i','計數':'i','次數':'i','加一':'i = i + 1','重複':'loop'});
/* value an OUTPUT shows: "output sum", "print total", "output 'Sum is' sum" */
function sumOutVal(n,e){
  const body=String(n.text||'').replace(/^\s*(output|輸出|print|印出|顯示|show|display)\s*[:：]?\s*/i,'').replace(/["'“”「」][^"'“”「」]*["'“”「」]/g,' ');
  const toks=sTokens(body); if(!toks) return undefined;
  const tk=toks.filter(x=>!(isId(x)&&STOP.has(idKey(x))));
  const ex=sExpr(tk); if(ex){ try{ const v=ex.f(e); if(typeof v==='number'&&isFinite(v)) return v; }catch(err){} }
  for(let i=tk.length-1;i>=0;i--){ const x=tk[i]; if(isId(x)&&typeof e[idKey(x)]==='number') return e[idKey(x)]; if(/^\d+(\.\d+)?$/.test(x)) return +x; }
  return undefined;
}
/* LOOP shape: "repeat n", "repeat n times", "重複 n 次" */
function loopCount(text){
  const body=String(text||'').replace(/repeat|loop|times?|重複|次數|次|做/gi,' ');
  const toks=sTokens(body); if(!toks) return null;
  const tk=toks.filter(x=>!(isId(x)&&STOP.has(idKey(x)))); return tk.length?sExpr(tk):null;
}
/* which line goes into the loop body and which leaves it */
function loopExits(A,n){
  const es=A.out[n.id]||[]; let body=null, exit=null; const rest=[];
  es.forEach(e=>{ const l=String(e.label||'').trim();
    if(!body&&/^(yes|y|是|do|loop|repeat|重複|true|t)$/i.test(l)) body=e; else if(!exit&&/^(no|n|否|done|end|exit|結束|完成|false|f)$/i.test(l)) exit=e; else rest.push(e); });
  const back=e=>{ const seen=new Set([e.to.node]), q=[e.to.node]; while(q.length){ const id=q.shift(); if(id===n.id) return true; (A.out[id]||[]).forEach(x=>{ if(!seen.has(x.to.node)){ seen.add(x.to.node); q.push(x.to.node); } }); } return false; };
  rest.forEach(e=>{ if(!body&&back(e)) body=e; else if(!exit) exit=e; else if(!body) body=e; });
  return {body,exit,count:es.length};
}
function sumRun(A,start,n){
  const e={}, q=[n], outputs=[], pe=[], visits={}, left={}; let cur=start, steps=0, stop=null;
  while(cur&&steps++<4000){
    visits[cur.id]=(visits[cur.id]||0)+1;
    const r=cur._r;
    if(r==='end') break;
    if(r==='input') sInputVars(cur).forEach(v=>{ e[v]=q.length?q.shift():undefined; });
    else if(r==='calc'){ const a=sAssign(cur.text); if(a&&a.expr){ try{ const v=a.expr.f(e); if(typeof v==='number'&&isFinite(v)) e[a.target]=v; }catch(err){} } }
    else if(r==='output'){ const v=sumOutVal(cur,e); if(v!==undefined) outputs.push(v); }
    if(cur.type==='loop'){
      const lx=loopExits(A,cur);
      if(left[cur.id]===undefined){ const c=loopCount(cur.text); if(!c){ stop={node:cur.id,why:'看不懂重複的次數，寫成 repeat n'}; break; }
        if([...c.vars].some(v=>e[v]===undefined)){ stop={node:cur.id,why:'重複次數用到還沒輸入的變數'}; break; }
        let k; try{ k=Math.round(+c.f(e)); }catch(err){ k=NaN; } if(!isFinite(k)){ stop={node:cur.id,why:'看不懂重複的次數，寫成 repeat n'}; break; } left[cur.id]=Math.max(0,Math.min(1000,k)); }
      if(left[cur.id]>0){ left[cur.id]--; if(!lx.body){ stop={node:cur.id,why:'重複裡面沒有要做的步驟'}; break; } pe.push(lx.body); cur=A.byId[lx.body.to.node]; continue; }
      delete left[cur.id]; if(!lx.exit){ stop={node:cur.id,why:'重複做完後，要接一條線到下一步（例如 output sum）'}; break; }
      pe.push(lx.exit); cur=A.byId[lx.exit.to.node]; continue;
    }
    if(cur.type==='decision'){
      const c=sCond(cur.text); if(!c){ stop={node:cur.id,why:'看不懂判斷條件'}; break; }
      if([...c.vars].some(v=>e[v]===undefined)){ stop={node:cur.id,why:'判斷用到還沒設定的變數'}; break; }
      let ans; try{ ans=!!c.f(e); }catch(err){ ans=false; }
      const ex=A.exits(cur), ed=ans?ex.yes:ex.no;
      if(!ed){ stop={node:cur.id,why:`缺少「${ans?'Yes':'No'}」的路線`}; break; }
      pe.push(ed); cur=A.byId[ed.to.node]; continue;
    }
    const es=A.out[cur.id]; if(!es.length){ stop={node:cur.id,why:'這裡沒有接下一步'}; break; }
    pe.push(es[0]); cur=A.byId[es[0].to.node];
  }
  if(steps>=4000) stop={node:cur&&cur.id,why:'流程繞圈出不來，迴圈停不下來'};
  return {outputs,env:e,stop,pe,visits};
}
/* roles of the process steps: start values, add (sum = sum + i), count (i = i + 1) */
function sumParts(A){
  const calcs=A.nodes.filter(n=>n._r==='calc').map(n=>({n,a:sAssign(n.text)})).filter(x=>x.a&&x.a.expr);
  const vs=x=>[...x.a.expr.vars];
  const inits=calcs.filter(x=>!vs(x).length);
  const adds=calcs.filter(x=>vs(x).includes(x.a.target)&&vs(x).length>=2);
  const counts=calcs.filter(x=>vs(x).includes(x.a.target)&&vs(x).length===1);
  return {calcs,inits,adds,counts};
}
/* is there a cycle that goes through a decision? */
function sumHasLoop(A,start){
  if(!start) return false; const color={}, stack=[]; let found=false;
  const dfs=id=>{ color[id]=1; stack.push(id); for(const e of (A.out[id]||[])){ const c=color[e.to.node];
    if(c===1){ const cyc=stack.slice(stack.lastIndexOf(e.to.node)); if(cyc.some(x=>A.byId[x]&&(A.byId[x].type==='decision'||A.byId[x].type==='loop'))) found=true; }
    else if(!c) dfs(e.to.node); } stack.pop(); color[id]=2; };
  try{ dfs(start.id); }catch(err){} return found;
}
function sumWhy(n,got,sb){
  if(got===undefined||got===null) return '';
  const exp=sumOf(n);
  if(got===exp) return '';
  if(got===exp-n&&n>1) return sb?`少加了最後一個數 ${n}：i 從 0 開始的話，要先 change i by 1 再加進 sum`:`少加了最後一個數 ${n}：用 repeat n 的話，i 從 0 開始、先 i = i + 1 再 sum = sum + i；用判斷的話條件要寫 i <= n`;
  if(got===exp+n+1) return sb?`多加了 ${n+1}：先加進 sum 再 change i by 1 的話，i 要從 1 開始`:`多加了 ${n+1}：先 sum = sum + i 再 i = i + 1 的話，i 要從 1 開始；用判斷的話條件改成 i <= n`;
  if(got===exp-n-(n-1)&&n>2) return '少加了最後兩個數，檢查判斷條件';
  if(got===n) return '只有輸出 n，要把 1 到 n 每個數都加進總和';
  if(got===n+1||got===n-1) return '輸出的好像是計數的變數 i，要輸出總和 sum';
  if(got===0) return '總和沒有加到東西，檢查 sum = sum + i 有沒有在迴圈裡';
  return '';
}
function gradeSum(work){
  const A=sAnalyze(work), items=[], bad=new Set();
  const add=(group,label,max,got,note)=>items.push({group,label,max,got:Math.max(0,Math.min(max,got)),note:note||''});
  const nodes=A.nodes; nodes.forEach(n=>{ if(n.type==='loop') n._r='loop'; });
  const loops=nodes.filter(n=>n.type==='loop');
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
  loops.forEach(n=>{ const lx=loopExits(A,n); if(lx.body&&lx.exit) decOK++; else { bad.add(n.id); dn.push(lx.body?`「${n.text}」重複做完後，要再拉一條線到下一步`:`「${n.text}」要拉一條線到重複的內容，最後再接回來`); } });
  const ctl=decs.length+loops.length;
  add('結構','每個判斷／重複都有兩條路',6,ctl?6*decOK/ctl:0,ctl?dn.join('；'):'沒有判斷或重複符號');
  /* input 10 */
  const ins=sOrderedInputs(A,start), inVars=[...new Set(ins.flatMap(sInputVars))];
  add('輸入','輸入 n',8,inVars.length?8:0,inVars.length?(inVars.length>1?`只要輸入一個數 n，目前輸入了 ${inVars.length} 個`:''):'沒有找到輸入 n 的步驟，例如 input n');
  if(inVars.length>1) items[items.length-1].got=6;
  const insIO=ins.filter(n=>n.type==='io');
  add('輸入','輸入使用「輸入／輸出」符號',2,ins.length?2*insIO.length/ins.length:0,ins.length&&insIO.length<ins.length?'輸入要用平行四邊形（INPUT）符號':(ins.length?'':'沒有輸入步驟'));
  /* process 25 */
  const P=sumParts(A), procOK=x=>x&&x.n.type==='process';
  add('計算','設定初始值（例如 sum = 0、i = 1）',5,P.inits.length>=2?5:P.inits.length?3:0,P.inits.length>=2?'':P.inits.length?'總和和計數都要先設定初始值，例如 sum = 0、i = 1':'迴圈前要先設定初始值，例如 sum = 0、i = 1');
  const addX=P.adds[0], cntX=P.counts[0];
  add('計算','累加（例如 sum = sum + i）',10,addX?(procOK(addX)?10:7):0,addX?(procOK(addX)?'':'計算要放在 PROCESS（長方形）裡'):'沒有找到累加的步驟，例如 sum = sum + i');
  add('計算','計數加一（例如 i = i + 1）',10,cntX?(procOK(cntX)?10:7):0,cntX?(procOK(cntX)?'':'計算要放在 PROCESS（長方形）裡'):'沒有找到讓 i 加一的步驟，例如 i = i + 1');
  /* loop 15 (sheet column 判斷) */
  const loopDec=loops.find(d=>{ const c=loopCount(d.text); return c&&[...c.vars].some(v=>inVars.includes(v)); })||decs.find(d=>{ const c=sCond(d.text); return c&&[...c.vars].some(v=>inVars.includes(v)); });
  add('判斷','用重複或判斷控制次數（例如 repeat n、i <= n）',5,loopDec?5:ctl?2:0,loopDec?'':loops.length?'重複的次數要用 n，例如 repeat n':decs.length?'判斷要和 n 比較，例如 i <= n':'用 LOOP（重複）寫 repeat n，或用 DECISION 寫 i <= n');
  const hasLoop=sumHasLoop(A,start);
  add('判斷','有線回到前面，形成迴圈',5,hasLoop?5:0,hasLoop?'':loops.length?'重複的最後一步要拉一條線回到 LOOP（重複）':'要從最後一步拉一條線回到判斷，讓流程重複');
  const condNodes=nodes.filter(n=>n.type!=='decision'&&/[<>]/.test(sNorm(n.text||''))&&n._r!=='calc');
  add('判斷','條件寫在 LOOP（重複）或 DECISION（菱形）裡',5,ctl&&!condNodes.length?5:ctl?3:0,!ctl?'沒有使用重複或判斷符號':condNodes.length?'有條件寫在別的符號裡':'');
  /* output 5 */
  const outs=nodes.filter(n=>n._r==='output'), outIO=outs.find(n=>n.type==='io');
  add('輸出','輸出總和',5,outIO?5:outs.length?2:0,outIO?'':outs.length?'輸出要用 OUTPUT 符號':'缺少輸出總和的步驟，例如 output sum');
  /* tests 25 */
  const full=SUM_CASES.map(n=>{ const exp=sumOf(n); if(!start) return {n,exp,got:null,ok:false,why:'沒有 START',lab:`n = ${n}`};
    const r=sumRun(A,start,n); const got=r.outputs.length?r.outputs[r.outputs.length-1]:null;
    const ok=got!==null&&Math.abs(got-exp)<1e-9;
    return {n,exp,got,ok,why:got!==null?sumWhy(n,got):(r.stop?r.stop.why:'沒有輸出結果'),stop:r.stop,lab:`n = ${n}`}; });
  const fp=full.filter(t=>t.ok).length;
  add('執行測試','完整流程測試（輸入八個 n）',25,25*fp/SUM_CASES.length,`${fp} / ${SUM_CASES.length} 題正確`);
  const st=full.find(t=>t.stop); if(st&&st.stop.node) bad.add(st.stop.node);
  const badEdges=flowEdgeIssues(A,start,[],{loops:true}); applyEdgePenalty(items,badEdges);
  /* english (not scored) */
  const CJK=/[㐀-鿿]/;
  const textNodes=nodes.filter(n=>String(n.text||'').trim()&&['terminator','io','process','decision'].includes(n.type));
  const zhNodes=textNodes.filter(n=>CJK.test(n.text));
  const decLabels=A.edges.filter(e=>A.byId[e.from.node]&&A.byId[e.from.node].type==='decision'&&String(e.label||'').trim());
  const zhLabels=decLabels.filter(e=>CJK.test(e.label));
  const words=[...new Set([...zhNodes.map(n=>n.text),...zhLabels.map(e=>e.label)].join(' ').match(/[㐀-鿿]+/g)||[])];
  const sug=[...new Set(words.map(w=>{ const k=Object.keys(EN_WORDS).find(z=>w.includes(z)); return k?`${k} → ${EN_WORDS[k]}`:null; }).filter(Boolean))];
  const enUnits=textNodes.length+decLabels.length, english=enUnits?Math.round(100*(enUnits-zhNodes.length-zhLabels.length)/enUnits):0;
  /* every answer right: other ways of writing it also count (the loop itself is still required) */
  if(fp===SUM_CASES.length){ items.forEach(i=>{ if((i.group==='計算'||i.label.startsWith('輸入 n')||i.group==='判斷'||(!ctl&&i.label.startsWith('每個判斷')))&&i.got<i.max){ i.got=i.max; i.note='答案全部正確，用不同寫法也算對'; } }); P.calcs.forEach(({n})=>bad.delete(n.id)); }
  const groups={}; items.forEach(i=>{ const g=groups[i.group]||(groups[i.group]={got:0,max:0}); g.got+=i.got; g.max+=i.max; });
  const total=Math.round(items.reduce((s,i)=>s+i.got,0));
  const fixes=[]; if(Object.keys(badEdges).length) fixes.push(`有 ${Object.keys(badEdges).length} 條紅色的線：方向拉反，或形成停不下來的迴圈`);
  items.filter(i=>i.got<i.max&&i.note&&!/題正確$|無法檢查|答案全部正確/.test(i.note)).forEach(i=>i.note.split('；').forEach(x=>{ if(!/（紅線）/.test(x)) fixes.push(x); }));
  full.filter(t=>!t.ok&&t.why&&t.got!==null).slice(-1).forEach(t=>fixes.push(t.why));
  full.filter(t=>!t.ok&&t.got!==null).slice(0,2).forEach(t=>fixes.push(`n = ${t.n} 應該輸出 ${t.exp}，你的流程輸出 ${t.got}`));
  if(st&&fp===0) fixes.push(`流程執行到「${(A.byId[st.stop.node]||{}).text||''}」就停住：${st.stop.why}`);
  const level=total>=90?'優秀':total>=75?'良好':total>=60?'及格':'需加強';
  const gotAll=items.reduce((s,i)=>s+i.got,0), maxAll=items.reduce((s,i)=>s+i.max,0);
  return {task:'sum',total,level,items,groups,logic:[],full,fixes:[...new Set(fixes)],bad:[...bad],badEdges,passed:gotAll>=maxAll-1e-6,english,zhWords:words,enTips:sug,inVars,parts:P,hasLoop,loopDec,loops};
}
function feedbackSum(work,g){
  const it=l=>g.items.find(i=>i.label.startsWith(l)), full=i=>!!i&&i.got>=i.max-1e-9, enOK=g.english>=100;
  if(g.passed) return {
    en:(g.hasLoop?'Excellent! Your loop adds 1 + 2 + … + n correctly':'Excellent! Your flowchart works out 1 + 2 + … + n correctly')+' and all 8 tests passed.'+(enOK?' You wrote everything in English. Great job!':' Next time, try writing every label in English'+(g.enTips.length?` (${g.enTips.slice(0,3).join(', ')}).`:'.')),
    zh:(g.hasLoop?'流程圖完整又正確，迴圈把 1 加到 n，':'流程圖完整又正確，')+'八個測試全部通過！'+(enOK?'而且全部用英文，非常棒！':'下次試著把文字都改成英文'+(g.enTips.length?`（${g.enTips.slice(0,3).join('、')}）`:'')+'。')};
  const pos=[],pz=[],fx=[],fz=[]; const add=(e,z)=>{fx.push(e);fz.push(z);};
  if(full(it('輸入 n'))){ pos.push('you input n'); pz.push('有輸入 n'); }
  if(full(it('累加'))){ pos.push('you add up the numbers with sum = sum + i'); pz.push('累加 sum = sum + i 寫對了'); }
  if(full(it('有線回到前面'))){ pos.push('your loop goes back to the decision'); pz.push('有做出迴圈'); }
  if(enOK){ pos.push('you used English throughout'); pz.push('全部都用英文'); }
  if(!full(it('有「開始」'))) add('add a START at the top','最前面要有 START');
  if(!full(it('輸入 n'))) add('input a number: input n','輸入一個數：input n');
  if(!full(it('設定初始值'))) add('set the start values before the loop: sum = 0, i = 1','迴圈前先設定初始值：sum = 0、i = 1');
  if(!full(it('用重複或判斷控制次數'))) add('add a LOOP: repeat n (or a decision: i <= n)','加一個 LOOP（重複）：repeat n，或用判斷 i <= n');
  if(!full(it('計數加一'))) add('count up: i = i + 1 (Scratch: change i by 1)','讓 i 加一：i = i + 1（就是 Scratch 的 change i by 1）');
  if(!full(it('累加'))) add('add i to the total: sum = sum + i (Scratch: change sum by i)','把 i 加進總和：sum = sum + i（就是 Scratch 的 change sum by i）');
  if(!full(it('有線回到前面'))) add('draw a line from the last step back to the LOOP','從最後一步拉一條線回到 LOOP（重複），形成迴圈');
  if(!full(it('輸出總和'))) add('add an OUTPUT: output sum','加上 OUTPUT：output sum');
  const loose=it('每個圖形都有接上線'); if(loose&&!full(loose)) add('connect every shape with lines','把每個圖形用線接好');
  if(!full(it('有「結束」'))) add('finish with an END','最後加上 END');
  const wrong=[...g.full].reverse().find(t=>!t.ok&&t.got!==null);
  let en=pos.length?`Good work: ${pos.slice(0,2).join(' and ')}.`:'Thank you for your flowchart!';
  let zh=pz.length?pz.slice(0,2).join('，')+'，很不錯！':'謝謝你完成這份流程圖！';
  if(fx.length){ en+=` To improve: ${fx.slice(0,2).join('; ')}.`; zh+='需要修正：'+fz.slice(0,2).join('；')+'。'; }
  if(wrong){ en+=` Right now n = ${wrong.n} gives ${wrong.got}, but it should be ${wrong.exp}.`; zh+=`目前 n = ${wrong.n} 會輸出 ${wrong.got}，正確應該是 ${wrong.exp}。`+(wrong.why?wrong.why+'。':''); }
  if(!enOK&&g.enTips.length){ en+=` Try more English: ${g.enTips.slice(0,3).join(', ')}.`; zh+=`也試著多用英文：${g.enTips.slice(0,3).join('、')}。`; }
  en+=g.level==='優秀'?' Almost perfect, keep going!':' Fix these step by step and check again. You can do it!';
  zh+=g.level==='優秀'?'只差一點點，繼續保持！':'照著修改，再檢查一次，一定會更好！';
  return {en,zh};
}

/* ===== Scratch summation (needs the Scratch engine; only called for Scratch works) ===== */
function sbNumIn(text){ const m=String(text||'').match(/-?\d+(\.\d+)?/g); return m?+m[m.length-1]:null; }
function gradeScratchSum(work){
  const ws=work.workspace||{}, F=sbFacts(ws), items=[], bad=new Set();
  const add=(group,label,max,got,note)=>items.push({group,label,max,got:Math.max(0,Math.min(max,got)),note:note||''});
  add('結構','有「當綠旗被點擊」',5,F.flags.length?5:0,F.flags.length?'':'程式要從「when ⚑ clicked 當綠旗被點擊」開始');
  add('結構','沒有散落的積木',5,5-2.5*F.loose.length,F.loose.length?`有 ${F.loose.length} 組積木沒有接在綠旗下面`:'');
  F.loose.forEach(b=>bad.add(b.id));
  /* loops and what is inside them */
  const names=F.names, loops=F.inFlag.filter(b=>b.type==='sc_repeat'||b.type==='sc_until');
  const inLoop=[]; loops.forEach(l=>{ const d=l.inputs&&l.inputs.DO&&l.inputs.DO.block; if(d) sbWalk(d,b=>inLoop.push(b)); });
  const refs=b=>{ const v=new Set(); let ans=false; sbWalk(b,x=>{ if(x.type==='sc_var') v.add(sbVarOf(x,names)); if(x.type==='sc_answer') ans=true; }); return {v,ans}; };
  const isOne=b=>b&&((b.type==='sc_num'&&sbNum(sbField(b,'NUM'))===1)||(b.type==='sc_text'&&String(sbField(b,'TEXT')).trim()==='1'));
  const addB=inLoop.find(b=>(b.type==='sc_change'&&sbIn(b,'BY')&&refs(sbIn(b,'BY')).v.size>0)||(b.type==='sc_set'&&sbIn(b,'VALUE')&&refs(sbIn(b,'VALUE')).v.has(sbVarOf(b,names))&&refs(sbIn(b,'VALUE')).v.size>=2));
  const cntB=inLoop.find(b=>(b.type==='sc_change'&&isOne(sbIn(b,'BY')))||(b.type==='sc_set'&&sbIn(b,'VALUE')&&sbIn(b,'VALUE').type==='sc_add'&&refs(sbIn(b,'VALUE')).v.has(sbVarOf(b,names))&&refs(sbIn(b,'VALUE')).v.size===1));
  const loopN=loops.find(l=>{ const x=l.type==='sc_repeat'?sbIn(l,'TIMES'):sbIn(l,'COND'); if(!x) return false; const r=refs(x); return r.ans||r.v.size>0; });
  /* tests */
  const full=SUM_CASES.map(n=>{ const exp=sumOf(n), r=sbRunFn(ws,()=>n); const nums=r.says.map(sbNumIn).filter(v=>v!==null); const got=nums.length?nums[nums.length-1]:null;
    return {n,exp,got,ok:got!==null&&Math.abs(got-exp)<1e-9,why:r.err?'程式停不下來':got!==null?sumWhy(n,got,true):(F.flags.length?'沒有說出總和':'沒有綠旗程式'),says:r.says,lab:`n = ${n}`,run:r}; });
  const r0=full[4].run;
  /* input 15 */
  add('輸入','詢問 n',8,r0.asks.length?8:0,r0.asks.length?(r0.asks.length>1?`詢問了 ${r0.asks.length} 次，只要問一次 n`:''):'用「ask 詢問並等待」問一個數字 n');
  if(r0.asks.length>1) items[items.length-1].got=6;
  add('輸入','把答案存進變數',7,F.stores.length?7:(loopN&&refs(sbIn(loopN,'TIMES')||sbIn(loopN,'COND')).ans?4:0),F.stores.length?'':'詢問後用「set [n] to (answer)」把答案存起來');
  /* process 20 */
  add('計算','累加（例如 change sum by i）',10,addB?10:0,addB?'':'在重複積木裡把 i 加進總和，例如 change sum by (i)');
  add('計算','計數加一（例如 change i by 1）',10,cntB?10:0,cntB?'':'在重複積木裡讓 i 加一：change i by 1');
  /* loop 20 */
  add('判斷','使用重複積木',10,loops.length?10:0,loops.length?'':'要用「repeat 重複」或「repeat until 重複直到」');
  add('判斷','重複的次數和 n 有關',10,loopN?10:loops.length?3:0,loopN?'':loops.length?'重複次數要用 n，例如 repeat (n)':'重複的次數要用 n');
  /* output 10 */
  const said=F.inFlag.some(b=>b.type==='sc_say'||b.type==='sc_saysecs');
  add('輸出','說出總和',10,said?10:0,said?'':'用「say 說」說出總和，例如 say (sum)');
  /* tests 25 */
  const fp=full.filter(t=>t.ok).length;
  add('執行測試','執行測試（輸入八個 n）',25,25*fp/SUM_CASES.length,`${fp} / ${SUM_CASES.length} 題正確`);
  /* english */
  const CJK=/[㐀-鿿]/; const units=[...F.texts,...F.varNames]; const zh=units.filter(t=>CJK.test(t));
  const english=units.length?Math.round(100*(units.length-zh.length)/units.length):0;
  const words=[...new Set(zh.join(' ').match(/[㐀-鿿]+/g)||[])];
  const sug=[...new Set(words.map(w=>{ const k=Object.keys(EN_WORDS).find(z=>w.includes(z)); return k?`${k} → ${EN_WORDS[k]}`:null; }).filter(Boolean))];
  if(fp===SUM_CASES.length){ items.forEach(i=>{ if((i.group==='計算'||i.group==='輸入'||i.group==='判斷')&&i.got<i.max){ i.got=i.max; i.note='答案全部正確，用不同寫法也算對'; } }); }
  const groups={}; items.forEach(i=>{ const g=groups[i.group]||(groups[i.group]={got:0,max:0}); g.got+=i.got; g.max+=i.max; });
  const total=Math.round(items.reduce((s,i)=>s+i.got,0));
  const fixes=[];
  items.filter(i=>i.got<i.max-1e-9&&i.note&&!/題正確$|答案全部正確/.test(i.note)).forEach(i=>fixes.push(i.note));
  full.filter(t=>!t.ok&&t.why&&t.got!==null).slice(-1).forEach(t=>fixes.push(t.why));
  full.filter(t=>!t.ok&&t.got!==null).slice(0,2).forEach(t=>fixes.push(`n = ${t.n} 應該說 ${t.exp}，你的程式說 ${t.got}`));
  const level=total>=90?'優秀':total>=75?'良好':total>=60?'及格':'需加強';
  const gotAll=items.reduce((s,i)=>s+i.got,0), maxAll=items.reduce((s,i)=>s+i.max,0);
  full.forEach(t=>delete t.run);
  return {task:'scratch-sum',total,level,items,groups,logic:[],full,fixes:[...new Set(fixes)],bad:[...bad],passed:gotAll>=maxAll-1e-6,english,zhWords:words,enTips:sug,facts:F,run0:r0,loops,addB,cntB,loopN};
}
function feedbackScratchSum(work,g){
  const it=l=>g.items.find(i=>i.label.startsWith(l)), full=i=>!!i&&i.got>=i.max-1e-9, enOK=g.english>=100;
  if(g.passed) return {en:'Excellent! Your program asks for n, adds 1 + 2 + … + n'+(g.loops.length?' with a loop':'')+' and says the right sum in all 8 tests.'+(enOK?' Everything is in English. Great job!':' Next time, try writing every message in English'+(g.enTips.length?` (${g.enTips.slice(0,3).join(', ')}).`:'.')),
    zh:'程式完整又正確，'+(g.loops.length?'用重複積木把 1 加到 n，':'')+'八個測試全部通過！'+(enOK?'而且全部用英文，非常棒！':'下次試著把文字都改成英文'+(g.enTips.length?`（${g.enTips.slice(0,3).join('、')}）`:'')+'。')};
  const pos=[],pz=[],fx=[],fz=[]; const add=(e,z)=>{fx.push(e);fz.push(z);};
  if(full(it('詢問 n'))){ pos.push('you ask for n'); pz.push('有詢問 n'); }
  if(full(it('使用重複積木'))){ pos.push('you used a repeat loop'); pz.push('有用到重複積木'); }
  if(full(it('累加'))){ pos.push('you add i to the sum'); pz.push('累加寫對了'); }
  if(!full(it('有「當綠旗'))) add('start with "when ⚑ clicked"','程式要從「當綠旗被點擊」開始');
  if(!full(it('詢問 n'))) add('ask for a number n','要詢問一個數字 n');
  if(!full(it('把答案存進變數'))) add('save the answer: set [n] to (answer)','把答案存起來：set [n] to (answer)');
  if(!full(it('使用重複積木'))) add('use a repeat block','用「repeat 重複」積木');
  if(!full(it('重複的次數'))) add('repeat n times: repeat (n)','重複 n 次：repeat (n)');
  if(!full(it('累加'))) add('inside the loop: change sum by (i)','在重複裡：change sum by (i)');
  if(!full(it('計數加一'))) add('inside the loop: change i by 1','在重複裡：change i by 1');
  if(!full(it('說出總和'))) add('say the sum at the end','最後說出總和');
  if(!full(it('沒有散落'))) add('attach every block under the green flag','把每塊積木都接在綠旗下面');
  const wrong=[...g.full].reverse().find(t=>!t.ok&&t.got!==null);
  let en=pos.length?`Good work: ${pos.slice(0,2).join(' and ')}.`:'Thank you for your program!';
  let zh=pz.length?pz.slice(0,2).join('，')+'，很不錯！':'謝謝你完成這個程式！';
  if(fx.length){ en+=` To improve: ${fx.slice(0,2).join('; ')}.`; zh+='需要修正：'+fz.slice(0,2).join('；')+'。'; }
  if(wrong){ en+=` Right now n = ${wrong.n} says ${wrong.got}, but it should say ${wrong.exp}.`; zh+=`目前 n = ${wrong.n} 會說 ${wrong.got}，正確應該是 ${wrong.exp}。`+(wrong.why?wrong.why+'。':''); }
  if(!enOK&&g.enTips.length){ en+=` Try more English: ${g.enTips.slice(0,3).join(', ')}.`; zh+=`也試著多用英文：${g.enTips.slice(0,3).join('、')}。`; }
  en+=g.level==='優秀'?' Almost perfect, keep going!':' Fix these step by step and run it again. You can do it!';
  zh+=g.level==='優秀'?'只差一點點，繼續保持！':'照著修改，再按綠旗試一次，一定會更好！';
  return {en,zh};
}
(function(){
  const _taskOf=taskOf, _grade=gradeTask, _fb=feedbackTask;
  taskOf=function(w){ if(w&&(w.task==='sum'||w.task==='scratch-sum')) return w.task; return _taskOf(w); };
  gradeTask=function(w){ const t=taskOf(w); if(t==='sum'){ const g=gradeSum(w); g.task='sum'; return g; } if(t==='scratch-sum') return gradeScratchSum(w); return _grade(w); };
  feedbackTask=function(w,g){ const t=g.task||taskOf(w); return t==='sum'?feedbackSum(w,g):t==='scratch-sum'?feedbackScratchSum(w,g):_fb(w,g); };
})();
if(typeof module!=='undefined') Object.assign(module.exports,{gradeSum,feedbackSum,gradeScratchSum,feedbackScratchSum,SUM_CASES,sumOf,gradeTask,feedbackTask,taskOf});
