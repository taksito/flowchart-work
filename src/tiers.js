/* ===== Flowchart scoring in three steps: shapes 60 → text 90 → lines 100 ===== */
const TIER_NEED={
  bmi:[['start','START 開始',1],['end','END 結束',1],['input','INPUT 輸入',2],['process','PROCESS 處理',1],['decision','DECISION 判斷',3],['output','OUTPUT 輸出',4]],
  score:[['start','START 開始',1],['end','END 結束',1],['input','INPUT 輸入',4],['process','PROCESS 處理',2],['decision','DECISION 判斷',1],['output','OUTPUT 輸出',2]],
  sum:[['start','START 開始',1],['end','END 結束',1],['input','INPUT 輸入',1],['process','PROCESS 處理',4],['control','LOOP 重複 或 DECISION 判斷',1],['output','OUTPUT 輸出',1]]
};
/* how many of each kind of shape the chart has (an INPUT holding "s1, s2" counts as two) */
function tierCount(work){
  const A=sAnalyze(work), c={start:0,end:0,input:0,output:0,process:0,decision:0,control:0};
  A.nodes.forEach(n=>{
    if(n.type==='terminator'){ if(n._r==='start') c.start++; else if(n._r==='end') c.end++; else if(!c.start) c.start++; else c.end++; }
    else if(n.type==='io'){ if(n._r==='output') c.output++; else c.input+=Math.max(1,sInputVars(n).length); }
    else if(n.type==='process') c.process++;
    else if(n.type==='decision'){ c.decision++; c.control++; }
    else if(n.type==='loop') c.control++;
  });
  return c;
}
const TIER_LINE=/一路走到結束|接上線|兩條路|有線回到前面/;
function tierFlow(g,work,task){
  const need=TIER_NEED[task]; if(!need||!g||!g.items) return g;
  const have=tierCount(work), totalNeed=need.reduce((s,x)=>s+x[2],0), items=[];
  /* 1. shapes: 60 */
  need.forEach(([k,label,n])=>{ const h=Math.min(n,have[k]||0), max=60*n/totalNeed;
    items.push({group:'圖形',label:`${label} × ${n}`,max,got:max*h/n,note:h<n?`已放 ${have[k]||0} 個，需要 ${n} 個`:''}); });
  /* 2. text: 30, from the content checks of the detailed rubric */
  /* (checks that only look at which shape was used, like "use the INPUT symbol", are covered by step 1) */
  const text=g.items.filter(i=>['輸入','計算','判斷','輸出'].includes(i.group)&&!TIER_LINE.test(i.label)&&!/符號|寫在/.test(i.label));
  const tmax=text.reduce((s,i)=>s+i.max,0)||1;
  text.forEach(i=>items.push({group:'文字',label:i.label,max:30*i.max/tmax,got:30*i.got/tmax,note:i.note}));
  /* 3. lines: 10 = connections 4 + test runs 6 */
  const lines=g.items.filter(i=>i.group==='結構'&&TIER_LINE.test(i.label)||i.group!=='結構'&&i.group!=='執行測試'&&TIER_LINE.test(i.label));
  const lmax=lines.reduce((s,i)=>s+i.max,0)||1;
  lines.forEach(i=>items.push({group:'線段',label:i.label,max:4*i.max/lmax,got:4*i.got/lmax,note:i.note}));
  const tests=g.items.filter(i=>i.group==='執行測試'), smax=tests.reduce((s,i)=>s+i.max,0)||1;
  tests.forEach(i=>items.push({group:'線段',label:i.label,max:6*i.max/smax,got:6*i.got/smax,note:i.note}));
  /* every test right: any correct way of drawing it gets full marks */
  const allOK=tests.length&&tests.every(i=>i.got>=i.max-1e-9);
  if(allOK) items.forEach(i=>{ if(i.got<i.max){ i.got=i.max; i.note='答案全部正確，用不同畫法也算對'; } });
  const groups={}; items.forEach(i=>{ const x=groups[i.group]||(groups[i.group]={got:0,max:0}); x.got+=i.got; x.max+=i.max; });
  let total=Math.round(items.reduce((s,i)=>s+i.got,0)); if(!allOK) total=Math.min(total,99);
  const level=total>=90?'優秀':total>=75?'良好':total>=60?'及格':'需加強';
  const out=Object.assign({},g,{items,groups,total,level,passed:!!allOK,tiers:true});
  Object.defineProperty(out,'_orig',{value:g,enumerable:false});
  return out;
}
(function(){
  const _grade=gradeTask, _fb=feedbackTask;
  gradeTask=function(w){ const g=_grade(w); const t=g&&g.task||taskOf(w); return TIER_NEED[t]?tierFlow(g,w,t):g; };
  feedbackTask=function(w,g){ return _fb(w,(g&&g._orig)||g); };
})();
if(typeof module!=='undefined') Object.assign(module.exports,{tierFlow,tierCount,TIER_NEED,gradeTask,feedbackTask});
