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
  const empty=!(work.nodes||[]).length;
  lines.forEach(i=>items.push({group:'線段',label:i.label,max:4*i.max/lmax,got:empty?0:4*i.got/lmax,note:i.note}));
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

/* ===== Scratch in three steps: blocks 60 → text 90 → snapped together 100 ===== */
const SB_KIND={flag:['sc_flag'],ask:['sc_ask'],set:['sc_set'],change:['sc_change'],add:['sc_add'],mul:['sc_mul'],div:['sc_div'],cmp:['sc_gt','sc_lt','sc_eq'],or:['sc_or'],
  if:['sc_if','sc_ifelse'],loop:['sc_repeat','sc_until'],say:['sc_say','sc_saysecs']};
const SB_KIND_LABEL={flag:'when ⚑ clicked 當綠旗被點擊',ask:'ask 詢問',set:'set 設為',change:'change 改變',add:'+ 加',mul:'× 乘',div:'÷ 除',cmp:'> < = 比較',or:'or 或',
  if:'if 如果',loop:'repeat 重複',say:'say 說'};
const TIER_SB={
  scratch:[['flag',1],['ask',4],['set',6],['add',3],['div',1],['cmp',1],['if',1],['say',2]],
  'scratch-bmi':[['flag',1],['ask',2],['set',3],['mul',1],['div',1],['cmp',3],['if',3],['say',4]],
  'scratch-sum':[['flag',1],['ask',1],['set',3],['loop',1],['change',2],['say',1]],
  'scratch-pw':[['flag',1],['set',2],['ask',2],['loop',1],['or',1],['cmp',3],['change',1],['if',1],['say',3]]
};
const SB_REPORTER=/^sc_(var|answer|add|sub|mul|div|join|round|gt|lt|eq|and|or|not|num|text)$/;
/* every block in the code area, attached or not (shadows such as typed numbers are not counted) */
function sbCountAll(ws){ const c={}; sbTop(ws).forEach(t=>{ const walk=b=>{ while(b){ c[b.type]=(c[b.type]||0)+1; Object.values(b.inputs||{}).forEach(i=>{ if(i.block) walk(i.block); }); b=b.next&&b.next.block; } }; walk(t); }); return c; }
/* the same blocks, all hung under one green flag, so the text can be checked before the blocks are snapped together */
function sbJoined(ws){
  const tops=JSON.parse(JSON.stringify(sbTop(ws))), stacks=tops.filter(t=>!SB_REPORTER.test(t.type));
  if(!stacks.length) return ws;
  let flag=stacks.find(t=>t.type==='sc_flag'); const rest=stacks.filter(t=>t!==flag&&t.type!=='sc_flag');
  if(!flag) flag={type:'sc_flag',id:'__flag',x:0,y:0};
  let tail=flag; const last=b=>{ while(b.next&&b.next.block) b=b.next.block; return b; };
  rest.forEach(st=>{ tail=last(tail); tail.next={block:st}; delete st.x; delete st.y; tail=st; });
  return Object.assign({},ws,{blocks:{languageVersion:0,blocks:[flag]}});
}
function tierScratch(g,gJoined,work,task){
  const need=TIER_SB[task]; if(!need||!g||!g.items) return g;
  const have=sbCountAll(work.workspace||{}), totalNeed=need.reduce((s,x)=>s+x[1],0), items=[];
  need.forEach(([k,n])=>{ const h=Math.min(n,SB_KIND[k].reduce((s,t)=>s+(have[t]||0),0)), max=60*n/totalNeed;
    items.push({group:'圖形',label:`${SB_KIND_LABEL[k]} × ${n}`,max,got:max*h/n,note:h<n?`已拉 ${h} 個，需要 ${n} 個`:''}); });
  const src=(gJoined&&gJoined.items)||g.items;
  const text=src.filter(i=>['輸入','計算','判斷','輸出'].includes(i.group)&&!/^使用|使用重複積木/.test(i.label));
  const tmax=text.reduce((s,i)=>s+i.max,0)||1;
  text.forEach(i=>items.push({group:'文字',label:i.label,max:30*i.max/tmax,got:30*i.got/tmax,note:i.note}));
  const conn=g.items.filter(i=>i.group==='結構'&&!/當綠旗/.test(i.label)), cmax=conn.reduce((s,i)=>s+i.max,0)||1;
  const noFlag=!have.sc_flag;
  conn.forEach(i=>items.push({group:'線段',label:i.label,max:4*i.max/cmax,got:noFlag?0:4*i.got/cmax,note:i.note}));
  const tests=g.items.filter(i=>i.group==='執行測試'), smax=tests.reduce((s,i)=>s+i.max,0)||1;
  tests.forEach(i=>items.push({group:'線段',label:i.label,max:6*i.max/smax,got:6*i.got/smax,note:i.note}));
  const allOK=tests.length&&tests.every(i=>i.got>=i.max-1e-9);
  if(allOK) items.forEach(i=>{ if(i.got<i.max){ i.got=i.max; i.note='答案全部正確，用不同寫法也算對'; } });
  const groups={}; items.forEach(i=>{ const x=groups[i.group]||(groups[i.group]={got:0,max:0}); x.got+=i.got; x.max+=i.max; });
  let total=Math.round(items.reduce((s,i)=>s+i.got,0)); if(!allOK) total=Math.min(total,99);
  const level=total>=90?'優秀':total>=75?'良好':total>=60?'及格':'需加強';
  const out=Object.assign({},g,{items,groups,total,level,passed:!!allOK,tiers:true});
  Object.defineProperty(out,'_orig',{value:g,enumerable:false});
  return out;
}
(function(){
  const _grade=gradeTask, _fb=feedbackTask;
  gradeTask=function(w){ const g=_grade(w); const t=g&&g.task||taskOf(w);
    if(TIER_NEED[t]) return tierFlow(g,w,t);
    if(TIER_SB[t]&&w&&w.workspace){ let gj=null; try{ gj=_grade(Object.assign({},w,{workspace:sbJoined(w.workspace)})); }catch(e){} return tierScratch(g,gj,w,t); }
    return g; };
  feedbackTask=function(w,g){ return _fb(w,(g&&g._orig)||g); };
})();
if(typeof module!=='undefined') Object.assign(module.exports,{tierFlow,tierCount,TIER_NEED,tierScratch,sbJoined,TIER_SB,gradeTask,feedbackTask});
