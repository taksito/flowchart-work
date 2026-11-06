/* ===== Scratch-style block programs: interpreter, outline, grading (Pass or Fail) ===== */
const SB_CAT={sc_flag:'events',sc_ask:'sensing',sc_answer:'sensing',sc_say:'looks',sc_saysecs:'looks',sc_set:'variables',sc_change:'variables',sc_var:'variables',
  sc_add:'operators',sc_sub:'operators',sc_mul:'operators',sc_div:'operators',sc_gt:'operators',sc_lt:'operators',sc_eq:'operators',sc_and:'operators',sc_or:'operators',sc_not:'operators',sc_join:'operators',sc_round:'operators',
  sc_if:'control',sc_ifelse:'control',sc_repeat:'control',sc_until:'control',sc_stop:'control',sc_wait:'control',sc_num:'operators',sc_text:'operators'};
const SB_COLORS={events:'#FFBF00',sensing:'#5CB1D6',looks:'#9966FF',variables:'#FF8C1A',operators:'#59C059',control:'#FFAB19'};
const SB_CASES=(typeof SCORE_CASES!=='undefined'?SCORE_CASES:[[70,80,90,60],[60,60,60,60],[59,60,60,60],[100,100,100,0],[40,50,60,80],[0,0,0,0],[61,59,60,60],[100,90,80,70]]);

function sbVarNames(ws){ const m={}; (ws&&ws.variables||[]).forEach(v=>m[v.id]=v.name); return m; }
function sbTop(ws){ return (ws&&ws.blocks&&ws.blocks.blocks)||[]; }
function sbIn(b,name){ const i=b&&b.inputs&&b.inputs[name]; return i?(i.block||i.shadow||null):null; }
function sbField(b,name){ return b&&b.fields?b.fields[name]:undefined; }
function sbVarOf(b,names){ const f=sbField(b,'VAR'); if(!f) return ''; return typeof f==='object'?(names[f.id]||f.name||''):String(f); }
/* walk every block (including nested) */
function sbWalk(b,fn,depth=0){ while(b){ fn(b,depth); Object.values(b.inputs||{}).forEach(i=>{ const c=i.block||i.shadow; if(c) sbWalk(c,fn,depth+1); }); b=b.next&&b.next.block; } }
function sbAll(ws){ const out=[]; sbTop(ws).forEach(t=>sbWalk(t,b=>out.push(b))); return out; }

/* Scratch-like value rules */
const sbNum=v=>{ if(typeof v==='number') return isFinite(v)?v:0; if(typeof v==='boolean') return v?1:0; const s=String(v).trim(); if(s==='') return 0; const n=Number(s); return isFinite(n)?n:0; };
const sbStr=v=>{ if(typeof v==='number'){ return String(Math.round(v*1e10)/1e10); } return String(v); };
function sbCmp(a,b){ const na=Number(String(a).trim()), nb=Number(String(b).trim());
  if(String(a).trim()!==''&&String(b).trim()!==''&&isFinite(na)&&isFinite(nb)) return na===nb?0:na<nb?-1:1;
  const x=String(a).toLowerCase(), y=String(b).toLowerCase(); return x===y?0:x<y?-1:1; }

/* generator interpreter: yields {ask}|{say}|{wait}; receives answer for ask */
const SB_STOP={stop:true};
function* sbExec(ws,opts={}){
  const names=sbVarNames(ws), vars={}, init=opts.vars||{}; Object.values(names).forEach(n=>vars[n]=Object.prototype.hasOwnProperty.call(init,n)?init[n]:0);
  const st={answer:opts.answer!=null?String(opts.answer):'',steps:0,vars};
  if(opts.expose) opts.expose(st);
  const limit=opts.limit||20000;
  function tick(){ if(++st.steps>limit) throw new Error('too_many_steps'); }
  function ev(b){
    if(!b) return '';
    switch(b.type){
      case 'sc_num': return sbField(b,'NUM')??0;
      case 'sc_text': return sbField(b,'TEXT')??'';
      case 'sc_answer': return st.answer;
      case 'sc_var': return vars[sbVarOf(b,names)]??0;
      case 'sc_add': return sbNum(ev(sbIn(b,'A')))+sbNum(ev(sbIn(b,'B')));
      case 'sc_sub': return sbNum(ev(sbIn(b,'A')))-sbNum(ev(sbIn(b,'B')));
      case 'sc_mul': return sbNum(ev(sbIn(b,'A')))*sbNum(ev(sbIn(b,'B')));
      case 'sc_div': { const d=sbNum(ev(sbIn(b,'B'))); const n=sbNum(ev(sbIn(b,'A'))); return d===0?(n===0?NaN:n>0?Infinity:-Infinity):n/d; }
      case 'sc_round': return Math.round(sbNum(ev(sbIn(b,'A'))));
      case 'sc_join': return sbStr(ev(sbIn(b,'A')))+sbStr(ev(sbIn(b,'B')));
      case 'sc_gt': return sbCmp(ev(sbIn(b,'A')),ev(sbIn(b,'B')))>0;
      case 'sc_lt': return sbCmp(ev(sbIn(b,'A')),ev(sbIn(b,'B')))<0;
      case 'sc_eq': return sbCmp(ev(sbIn(b,'A')),ev(sbIn(b,'B')))===0;
      case 'sc_and': return !!ev(sbIn(b,'A'))&&!!ev(sbIn(b,'B'));
      case 'sc_or': return !!ev(sbIn(b,'A'))||!!ev(sbIn(b,'B'));
      case 'sc_not': return !ev(sbIn(b,'A'));
      default: return '';
    }
  }
  function* run(b){
    while(b){
      tick(); if(opts.onBlock) opts.onBlock(b.id);
      switch(b.type){
        case 'sc_ask': { const q=sbStr(ev(sbIn(b,'Q'))); st.answer=String(yield {type:'ask',q,id:b.id}); break; }
        case 'sc_say': yield {type:'say',msg:sbStr(ev(sbIn(b,'MSG'))),id:b.id}; break;
        case 'sc_saysecs': yield {type:'say',msg:sbStr(ev(sbIn(b,'MSG'))),secs:sbNum(ev(sbIn(b,'SECS'))),id:b.id}; break;
        case 'sc_set': { const n=sbVarOf(b,names); const v=ev(sbIn(b,'VALUE')); vars[n]=(typeof v==='boolean')?String(v):v; break; }
        case 'sc_change': { const n=sbVarOf(b,names); vars[n]=sbNum(vars[n])+sbNum(ev(sbIn(b,'BY'))); break; }
        case 'sc_wait': yield {type:'wait',secs:sbNum(ev(sbIn(b,'SECS'))),id:b.id}; break;
        case 'sc_stop': throw SB_STOP;
        case 'sc_if': if(ev(sbIn(b,'COND'))) yield* run(b.inputs&&b.inputs.DO&&b.inputs.DO.block); break;
        case 'sc_ifelse': if(ev(sbIn(b,'COND'))) yield* run(b.inputs&&b.inputs.DO&&b.inputs.DO.block); else yield* run(b.inputs&&b.inputs.ELSE&&b.inputs.ELSE.block); break;
        case 'sc_repeat': { const n=Math.min(1000,Math.round(sbNum(ev(sbIn(b,'TIMES'))))); for(let i=0;i<n;i++) yield* run(b.inputs&&b.inputs.DO&&b.inputs.DO.block); break; }
        case 'sc_until': { while(!ev(sbIn(b,'COND'))){ tick(); yield* run(b.inputs&&b.inputs.DO&&b.inputs.DO.block); } break; }
      }
      b=b.next&&b.next.block;
    }
  }
  if(opts.value){ st.value=ev(opts.value); return st; }   /* a clicked reporter: just work out its value */
  try{
    if(opts.start){ const b=opts.start; yield* run(b.type==='sc_flag'?b.next&&b.next.block:b); return st; }   /* a clicked stack */
    for(const t of sbTop(ws)) if(t.type==='sc_flag') yield* run(t.next&&t.next.block);
  }catch(e){ if(e!==SB_STOP) throw e; st.stopped=true; }   /* stop all */
  return st;
}
/* synchronous run for tests */
function sbRunSync(ws,answers){
  const q=[...answers].map(String), says=[], asks=[]; let err=null, st=null;
  const it=sbExec(ws); let r, send;
  try{
    while(true){ r=it.next(send); send=undefined; if(r.done){ st=r.value; break; }
      const e=r.value; if(e.type==='ask'){ asks.push(e.q); send=q.length?q.shift():''; } else if(e.type==='say') says.push(e.msg); }
  }catch(e){ err=e.message; }
  return {says,asks,vars:st?st.vars:{},err,extraAsks:Math.max(0,asks.length-answers.length)};
}

/* outline lines for previews / certificate */
function sbOutline(ws){
  const names=sbVarNames(ws), lines=[];
  const r=b=>{ if(!b) return '( )'; switch(b.type){
    case 'sc_num': return String(sbField(b,'NUM')??0); case 'sc_text': return `"${sbField(b,'TEXT')??''}"`;
    case 'sc_answer': return 'answer'; case 'sc_var': return sbVarOf(b,names)||'?';
    case 'sc_add': return `(${r(sbIn(b,'A'))} + ${r(sbIn(b,'B'))})`; case 'sc_sub': return `(${r(sbIn(b,'A'))} - ${r(sbIn(b,'B'))})`;
    case 'sc_mul': return `(${r(sbIn(b,'A'))} * ${r(sbIn(b,'B'))})`; case 'sc_div': return `(${r(sbIn(b,'A'))} / ${r(sbIn(b,'B'))})`;
    case 'sc_round': return `round ${r(sbIn(b,'A'))}`; case 'sc_join': return `join ${r(sbIn(b,'A'))} ${r(sbIn(b,'B'))}`;
    case 'sc_gt': return `<${r(sbIn(b,'A'))} > ${r(sbIn(b,'B'))}>`; case 'sc_lt': return `<${r(sbIn(b,'A'))} < ${r(sbIn(b,'B'))}>`; case 'sc_eq': return `<${r(sbIn(b,'A'))} = ${r(sbIn(b,'B'))}>`;
    case 'sc_and': return `<${r(sbIn(b,'A'))} and ${r(sbIn(b,'B'))}>`; case 'sc_or': return `<${r(sbIn(b,'A'))} or ${r(sbIn(b,'B'))}>`; case 'sc_not': return `<not ${r(sbIn(b,'A'))}>`;
    default: return b.type; } };
  const s=(b,d,loose)=>{ while(b){ const c=SB_CAT[b.type]||'operators'; const L=t=>lines.push({d,t,c,id:b.id,loose});
    switch(b.type){
      case 'sc_flag': L('when ⚑ clicked'); break;
      case 'sc_ask': L(`ask ${r(sbIn(b,'Q'))} and wait`); break;
      case 'sc_say': L(`say ${r(sbIn(b,'MSG'))}`); break;
      case 'sc_saysecs': L(`say ${r(sbIn(b,'MSG'))} for ${r(sbIn(b,'SECS'))} seconds`); break;
      case 'sc_set': L(`set ${sbVarOf(b,names)} to ${r(sbIn(b,'VALUE'))}`); break;
      case 'sc_change': L(`change ${sbVarOf(b,names)} by ${r(sbIn(b,'BY'))}`); break;
      case 'sc_wait': L(`wait ${r(sbIn(b,'SECS'))} seconds`); break;
      case 'sc_stop': L('stop all'); break;
      case 'sc_repeat': L(`repeat ${r(sbIn(b,'TIMES'))}`); s(b.inputs&&b.inputs.DO&&b.inputs.DO.block,d+1,loose); lines.push({d,t:'end',c,loose}); break;
      case 'sc_until': L(`repeat until ${r(sbIn(b,'COND'))}`); s(b.inputs&&b.inputs.DO&&b.inputs.DO.block,d+1,loose); lines.push({d,t:'end',c,loose}); break;
      case 'sc_if': L(`if ${r(sbIn(b,'COND'))} then`); s(b.inputs&&b.inputs.DO&&b.inputs.DO.block,d+1,loose); lines.push({d,t:'end',c,loose}); break;
      case 'sc_ifelse': L(`if ${r(sbIn(b,'COND'))} then`); s(b.inputs&&b.inputs.DO&&b.inputs.DO.block,d+1,loose); lines.push({d,t:'else',c,loose}); s(b.inputs&&b.inputs.ELSE&&b.inputs.ELSE.block,d+1,loose); lines.push({d,t:'end',c,loose}); break;
      default: L(r(b)); }
    b=b.next&&b.next.block; } };
  const tops=sbTop(ws);
  tops.filter(t=>t.type==='sc_flag').forEach(t=>s(t,0,false));
  tops.filter(t=>t.type!=='sc_flag').forEach(t=>{ lines.push({d:0,t:'— not attached 沒有接上 —',c:'gap',loose:true}); s(t,0,true); });
  return lines;
}

/* static facts about the program */
function sbFacts(ws){
  const names=sbVarNames(ws), tops=sbTop(ws), flags=tops.filter(t=>t.type==='sc_flag'), loose=tops.filter(t=>t.type!=='sc_flag');
  const inFlag=[]; flags.forEach(f=>sbWalk(f,b=>inFlag.push(b)));
  const asks=inFlag.filter(b=>b.type==='sc_ask');
  const stores=inFlag.filter(b=>b.type==='sc_set'&&sbIn(b,'VALUE')&&sbIn(b,'VALUE').type==='sc_answer').map(b=>sbVarOf(b,names));
  const ifs=inFlag.filter(b=>b.type==='sc_if'||b.type==='sc_ifelse');
  const conds=ifs.map(b=>sbIn(b,'COND')).filter(Boolean);
  const condText=conds.map(c=>{ const parts=[]; sbWalk(c,x=>{ if(x.type==='sc_num') parts.push(String(sbField(x,'NUM'))); if(x.type==='sc_text') parts.push(String(sbField(x,'TEXT'))); if(x.type==='sc_var') parts.push(sbVarOf(x,names)); }); return parts.join(' '); }).join(' | ');
  const sayTexts=inFlag.filter(b=>b.type==='sc_say'||b.type==='sc_saysecs').map(b=>{ const m=sbIn(b,'MSG'); return m&&m.type==='sc_text'?String(sbField(m,'TEXT')||''):''; });
  const texts=[]; sbAll(ws).forEach(b=>{ if(b.type==='sc_text'&&String(sbField(b,'TEXT')||'').trim()) texts.push(String(sbField(b,'TEXT'))); });
  return {names,flags,loose,inFlag,asks,stores:[...new Set(stores)],ifs,conds,condText,sayTexts,texts,varNames:Object.values(names)};
}

function gradeScratch(work){
  const ws=work.workspace||{}, F=sbFacts(ws), items=[], bad=new Set();
  const add=(group,label,max,got,note)=>items.push({group,label,max,got:Math.max(0,Math.min(max,got)),note:note||''});
  /* structure 15 */
  add('結構','有「當綠旗被點擊」',5,F.flags.length?5:0,F.flags.length?'':'程式要從「when ⚑ clicked 當綠旗被點擊」開始');
  add('結構','沒有散落的積木',5,5-2.5*F.loose.length,F.loose.length?`有 ${F.loose.length} 組積木沒有接在綠旗下面`:'');
  F.loose.forEach(b=>bad.add(b.id));
  add('結構','使用「如果…那麼…否則」',5,F.ifs.length?5:0,F.ifs.length?'':'要用「if then else 如果那麼否則」做判斷');
  /* run first case to inspect */
  const r0=sbRunSync(ws,SB_CASES[0].map(String)), sum0=SB_CASES[0].reduce((a,b)=>a+b,0), avg0=sum0/4;
  const near=(x,y)=>Math.abs(sbNum(x)-y)<1e-6&&String(x).trim()!=='';
  const varVals=Object.entries(r0.vars);
  const totalVar=varVals.find(([k,v])=>near(v,sum0)), avgVar=varVals.find(([k,v])=>near(v,avg0));
  /* input 15 */
  const askN=Math.min(4,r0.asks.length);
  add('輸入','詢問四個成績',8,2*askN,r0.asks.length>=4?(r0.asks.length>4?`詢問了 ${r0.asks.length} 次，只要 4 次`:''):`目前詢問了 ${r0.asks.length} 次，要詢問 4 次`);
  const stored=Math.min(4,F.stores.length);
  add('輸入','把答案存進變數',7,(avgVar||totalVar)&&!stored?4:7*stored/4,stored>=4?'':'每次詢問後，用「set [s1] to (answer)」把答案存進變數');
  /* process 20 */
  add('計算','計算總分（四個成績相加）',10,totalVar||avgVar?10:0,totalVar||avgVar?'':'用變數 total 存四個成績相加的結果');
  let avgNote='';
  if(!avgVar){ avgNote=varVals.some(([k,v])=>near(v,sum0/3))?'平均要除以 4，不是 3':'用變數 avg 存平均：total / 4'; }
  add('計算','計算平均（總分 ÷ 4）',10,avgVar?10:0,avgNote);
  /* decision 15 */
  const has60=(F.condText.match(/-?\d+(\.\d+)?/g)||[]).map(Number).some(v=>v>=59.9&&v<=60);
  add('判斷','判斷和 60 比較',10,has60?10:0,has60?'':'「如果」的條件要和 60 比較，例如 avg < 60');
  const usesAvg=avgVar&&F.condText.split(/\s+/).includes(avgVar[0]);
  add('判斷','用平均做判斷',5,usesAvg?5:(has60?2:0),usesAvg?'':'條件裡要用平均的變數');
  /* output 10 */
  ['pass','fail'].forEach(k=>{ const ok=F.sayTexts.some(t=>sCat(t)===k); add('輸出',`說出 ${k}`,5,ok?5:0,ok?'':`要用「say 說」說出 ${k}`); });
  /* tests 25 */
  const full=SB_CASES.map(sc=>{ const exp=sExpect(sc), r=sbRunSync(ws,sc.map(String)); const cats=r.says.map(sCat).filter(Boolean); const got=cats.length?cats[cats.length-1]:null;
    return {scores:sc,avg:sAvg(sc),exp,got,ok:got===exp&&new Set(cats).size===1,why:r.err?'程式停不下來':got?'':(F.flags.length?'沒有說出 pass 或 fail':'沒有綠旗程式'),says:r.says}; });
  const fp=full.filter(t=>t.ok).length;
  add('執行測試','執行測試（輸入八組成績）',25,25*fp/SB_CASES.length,`${fp} / ${SB_CASES.length} 題正確`);
  /* english (not scored) */
  const CJK=/[㐀-鿿]/; const units=[...F.texts,...F.varNames]; const zh=units.filter(t=>CJK.test(t));
  const english=units.length?Math.round(100*(units.length-zh.length)/units.length):0;
  const words=[...new Set(zh.join(' ').match(/[㐀-鿿]+/g)||[])];
  const sug=[...new Set(words.map(w=>{ const k=Object.keys(EN_WORDS).find(z=>w.includes(z)); return k?`${k} → ${EN_WORDS[k]}`:null; }).filter(Boolean))];
  /* totals */
  if(fp===SB_CASES.length){ items.forEach(i=>{ if((i.group==='計算'||i.group==='判斷'||/^(把答案存進變數|輸入四個成績|詢問四個成績)/.test(i.label))&&i.got<i.max){ i.got=i.max; i.note='答案全部正確，用不同寫法也算對'; } }); }
  const groups={}; items.forEach(i=>{ const g=groups[i.group]||(groups[i.group]={got:0,max:0}); g.got+=i.got; g.max+=i.max; });
  const total=Math.round(items.reduce((s,i)=>s+i.got,0));
  const fixes=[]; items.filter(i=>i.got<i.max&&i.note&&!/題正確$/.test(i.note)).forEach(i=>fixes.push(i.note));
  if(full.some(t=>t.avg===PASS_LINE&&!t.ok&&t.got==='fail')) fixes.push('平均剛好 60 也算 pass：用「avg < 60 → fail，否則 pass」');
  full.filter(t=>!t.ok&&t.got).slice(0,2).forEach(t=>fixes.push(`成績 ${t.scores.join('、')}（平均 ${t.avg}）應該說 ${t.exp}，你的程式說 ${t.got}`));
  const level=total>=90?'優秀':total>=75?'良好':total>=60?'及格':'需加強';
  const gotAll=items.reduce((s,i)=>s+i.got,0), maxAll=items.reduce((s,i)=>s+i.max,0);
  return {task:'scratch',total,level,items,groups,logic:[],full,fixes:[...new Set(fixes)],bad:[...bad],passed:gotAll>=maxAll-1e-6,english,zhWords:words,enTips:sug,facts:F,run0:r0,totalVar,avgVar};
}
function feedbackScratch(work,g){
  const it=l=>g.items.find(i=>i.label.startsWith(l)), full=i=>!!i&&i.got>=i.max-1e-9, enOK=g.english>=100;
  if(g.passed) return {en:'Excellent! Your program asks for four scores, works out the average and says pass or fail correctly in all 8 tests.'+(enOK?' Everything is in English. Great job!':' Next time, try writing every message in English'+(g.enTips.length?` (${g.enTips.slice(0,3).join(', ')}).`:'.')),
    zh:'程式完整又正確，八個測試全部通過！'+(enOK?'而且全部用英文，非常棒！':'下次試著把文字都改成英文'+(g.enTips.length?`（${g.enTips.slice(0,3).join('、')}）`:'')+'。')};
  const pos=[],pz=[],fx=[],fz=[]; const add=(e,z)=>{fx.push(e);fz.push(z);};
  if(full(it('詢問四個成績'))){ pos.push('you ask for all four scores'); pz.push('四個成績都有詢問'); }
  if(full(it('計算平均'))){ pos.push('your average is correct'); pz.push('平均算對了'); }
  if(full(it('使用「如果'))){ pos.push('you used if-then-else'); pz.push('有用到如果否則'); }
  if(!full(it('有「當綠旗'))) add('start with "when ⚑ clicked"','程式要從「當綠旗被點擊」開始');
  if(!full(it('詢問四個成績'))) add('ask for four scores','要詢問四個成績');
  if(!full(it('把答案存進變數'))) add('save each answer: set [s1] to (answer)','每次詢問後把答案存進變數：set [s1] to (answer)');
  if(!full(it('計算總分'))) add('set total to s1 + s2 + s3 + s4','用 total 把四個成績加起來');
  if(!full(it('計算平均'))) add('set avg to total / 4','用 avg 算平均：total / 4');
  if(!full(it('判斷和 60'))) add('compare the average with 60 in an if block','在「如果」裡把平均和 60 比較');
  ['pass','fail'].forEach(k=>{ if(!full(it('說出 '+k))) add(`say ${k}`,`用「說」說出 ${k}`); });
  if(!full(it('沒有散落'))) add('attach every block under the green flag','把每塊積木都接在綠旗下面');
  if(g.full.some(t=>t.avg===PASS_LINE&&!t.ok&&t.got==='fail')) add('an average of exactly 60 passes: use "avg < 60" for fail, else pass','平均剛好 60 也算及格：avg < 60 說 fail，否則說 pass');
  const wrong=g.full.find(t=>!t.ok&&t.got);
  let en=pos.length?`Good work: ${pos.slice(0,2).join(' and ')}.`:'Thank you for your program!';
  let zh=pz.length?pz.slice(0,2).join('，')+'，很不錯！':'謝謝你完成這個程式！';
  if(fx.length){ en+=` To improve: ${fx.slice(0,2).join('; ')}.`; zh+='需要修正：'+fz.slice(0,2).join('；')+'。'; }
  if(wrong){ en+=` Right now an average of ${wrong.avg} says ${wrong.got}, but it should say ${wrong.exp}.`; zh+=`目前平均 ${wrong.avg} 會說 ${wrong.got}，正確應該是 ${wrong.exp}。`; }
  if(!enOK&&g.enTips.length){ en+=` Try more English: ${g.enTips.slice(0,3).join(', ')}.`; zh+=`也試著多用英文：${g.enTips.slice(0,3).join('、')}。`; }
  en+=g.level==='優秀'?' Almost perfect, keep going!':' Fix these step by step and run it again. You can do it!';
  zh+=g.level==='優秀'?'只差一點點，繼續保持！':'照著修改，再按綠旗試一次，一定會更好！';
  return {en,zh};
}
/* hook into task dispatch */
(function(){
  const _taskOf=taskOf, _grade=gradeTask, _fb=feedbackTask;
  taskOf=function(w){ if(w&&(w.task==='scratch'||w.format==='blocklab-v1')) return 'scratch'; return _taskOf(w); };
  gradeTask=function(w){ return taskOf(w)==='scratch'?gradeScratch(w):_grade(w); };
  feedbackTask=function(w,g){ return (g.task||taskOf(w))==='scratch'?feedbackScratch(w,g):_fb(w,g); };
})();

/* ===== Scratch BMI task ===== */
const SBB_H=1.5, SBB_CASES=[16,18.4,18.5,22,24,25.5,27,32];
/* run where each ask is answered by a function of (question, index) */
function sbRunFn(ws,fn){
  const says=[], asks=[]; let err=null, st=null, send;
  const it=sbExec(ws);
  try{ while(true){ const r=it.next(send); send=undefined; if(r.done){ st=r.value; break; }
    const e=r.value; if(e.type==='ask'){ send=String(fn(e.q,asks.length)); asks.push(e.q); } else if(e.type==='say') says.push(e.msg); } }
  catch(e){ err=e.message; }
  return {says,asks,vars:st?st.vars:{},err};
}
const SBB_W=/weight|體重|kg|公斤|(^|[^a-z])w([^a-z]|$)/i, SBB_HT=/height|身高|cm|公分|(^|[^a-z])h([^a-z]|$)|(^|[^a-z])m([^a-z]|$)|公尺/i;
function sbbAnswerer(bmi,unit){
  const w=+(bmi*SBB_H*SBB_H).toFixed(4); let used={h:false,w:false};
  return (q)=>{ q=String(q||''); let kind=null;
    if(SBB_W.test(q)&&!/height|身高/i.test(q)) kind='w'; else if(SBB_HT.test(q)) kind='h';
    if(!kind) kind=!used.h?'h':'w';
    used[kind]=true;
    if(kind==='w') return w;
    const u=/cm|公分/i.test(q)?'cm':unit; return u==='cm'?SBB_H*100:SBB_H; };
}
function gradeScratchBMI(work){
  const ws=work.workspace||{}, F=sbFacts(ws), items=[], bad=new Set();
  const add=(group,label,max,got,note)=>items.push({group,label,max,got:Math.max(0,Math.min(max,got)),note:note||''});
  add('結構','有「當綠旗被點擊」',5,F.flags.length?5:0,F.flags.length?'':'程式要從「when ⚑ clicked 當綠旗被點擊」開始');
  add('結構','沒有散落的積木',5,5-2.5*F.loose.length,F.loose.length?`有 ${F.loose.length} 組積木沒有接在綠旗下面`:'');
  F.loose.forEach(b=>bad.add(b.id));
  add('結構','使用「如果…那麼…否則」',5,F.ifs.length?5:0,F.ifs.length?'':'要用「if then else 如果那麼否則」做判斷');
  /* choose the height unit that works best */
  const runAll=unit=>SBB_CASES.map(b=>{ const r=sbRunFn(ws,sbbAnswerer(b,unit)); const cats=r.says.map(catOf).filter(Boolean); const got=cats.length?cats[cats.length-1]:null;
    return {bmi:b,h:SBB_H,w:+(b*SBB_H*SBB_H).toFixed(4),exp:expectCat(b),got,ok:got===expectCat(b)&&new Set(cats).size===1,why:r.err?'程式停不下來':got?'':(F.flags.length?'沒有說出結果':'沒有綠旗程式'),run:r}; });
  let unit='m', full=runAll('m'); const cm=runAll('cm');
  if(cm.filter(t=>t.ok).length>full.filter(t=>t.ok).length){ unit='cm'; full=cm; }
  const r0=full[3].run, bmi0=22;
  const near=(x,y)=>String(x).trim()!==''&&Math.abs(sbNum(x)-y)<0.01;
  const bmiVar=Object.entries(r0.vars).find(([k,v])=>near(v,bmi0));
  /* input 15 */
  const askN=Math.min(2,r0.asks.length);
  add('輸入','詢問身高和體重',8,4*askN,r0.asks.length>=2?'':`目前詢問了 ${r0.asks.length} 次，要詢問身高和體重`);
  const stored=Math.min(2,F.stores.length);
  add('輸入','把答案存進變數',7,7*stored/2,stored>=2?'':'每次詢問後，用「set [height] to (answer)」把答案存進變數');
  /* process 20 */
  let bNote='';
  if(!bmiVar){ const vals=Object.values(r0.vars).map(sbNum), w=+(bmi0*SBB_H*SBB_H).toFixed(4);
    if(vals.some(v=>Math.abs(v-w/SBB_H)<0.01||Math.abs(v-w/(SBB_H*100))<0.001)) bNote='身高要平方：weight / (height * height)';
    else if(vals.some(v=>Math.abs(v-w/(SBB_H*100*SBB_H*100))<1e-6)) bNote='身高是公分，要先 ÷ 100 換成公尺';
    else bNote='用變數 bmi 存 weight / (height * height)'; }
  add('計算','算出 BMI',20,bmiVar?20:(Object.keys(r0.vars).length>2?5:0),bNote);
  /* decision 20 */
  const nums=(F.condText.match(/-?\d+(\.\d+)?/g)||[]).map(Number);
  [[18.5,'thin 與 normal'],[24,'normal 與 overweight'],[27,'overweight 與 obesity']].forEach(([t,d])=>{
    const ok=nums.some(v=>Math.abs(v-t)<0.011); add('判斷',`有 ${t} 的判斷（${d}）`,20/3,ok?20/3:0,ok?'':`「如果」裡缺少和 ${t} 的比較`); });
  /* output 10 */
  CATS.forEach(c=>{ const ok=F.sayTexts.some(t=>catOf(t)===c.key); add('輸出',`說出 ${c.name}`,2.5,ok?2.5:0,ok?'':`要用「say 說」說出 ${c.name}`); });
  /* tests 20 */
  const fp=full.filter(t=>t.ok).length;
  add('執行測試','執行測試（八組身高體重）',20,20*fp/SBB_CASES.length,`${fp} / ${SBB_CASES.length} 題正確`);
  /* english */
  const CJK=/[㐀-鿿]/; const units=[...F.texts,...F.varNames]; const zh=units.filter(t=>CJK.test(t));
  const english=units.length?Math.round(100*(units.length-zh.length)/units.length):0;
  const words=[...new Set(zh.join(' ').match(/[㐀-鿿]+/g)||[])];
  const sug=[...new Set(words.map(w=>{ const k=Object.keys(EN_WORDS).find(z=>w.includes(z)); return k?`${k} → ${EN_WORDS[k]}`:null; }).filter(Boolean))];
  const groups={}; items.forEach(i=>{ const g=groups[i.group]||(groups[i.group]={got:0,max:0}); g.got+=i.got; g.max+=i.max; });
  const total=Math.round(items.reduce((s,i)=>s+i.got,0));
  const fixes=[]; items.filter(i=>i.got<i.max-1e-9&&i.note&&!/題正確$/.test(i.note)).forEach(i=>fixes.push(i.note));
  full.filter(t=>!t.ok&&t.got).slice(0,2).forEach(t=>fixes.push(`BMI ${t.bmi} 應該說 ${t.exp}，你的程式說 ${t.got}`));
  const level=total>=90?'優秀':total>=75?'良好':total>=60?'及格':'需加強';
  const gotAll=items.reduce((s,i)=>s+i.got,0), maxAll=items.reduce((s,i)=>s+i.max,0);
  full.forEach(t=>delete t.run);
  return {task:'scratch-bmi',total,level,items,groups,logic:[],full,fixes:[...new Set(fixes)],bad:[...bad],passed:gotAll>=maxAll-1e-6,english,zhWords:words,enTips:sug,facts:F,run0:r0,bmiVar,unit};
}
function feedbackScratchBMI(work,g){
  const it=l=>g.items.find(i=>i.label.startsWith(l)), full=i=>!!i&&i.got>=i.max-1e-9, enOK=g.english>=100;
  if(g.passed) return {en:'Excellent! Your program asks for height and weight, works out the BMI and says the right result in all 8 tests.'+(enOK?' Everything is in English. Great job!':' Next time, try writing every message in English'+(g.enTips.length?` (${g.enTips.slice(0,3).join(', ')}).`:'.')),
    zh:'程式完整又正確，八個測試全部通過！'+(enOK?'而且全部用英文，非常棒！':'下次試著把文字都改成英文'+(g.enTips.length?`（${g.enTips.slice(0,3).join('、')}）`:'')+'。')};
  const pos=[],pz=[],fx=[],fz=[]; const add=(e,z)=>{fx.push(e);fz.push(z);};
  if(full(it('詢問身高'))){ pos.push('you ask for height and weight'); pz.push('身高體重都有詢問'); }
  if(full(it('算出 BMI'))){ pos.push('your BMI formula is correct'); pz.push('BMI 算對了'); }
  if(full(it('使用「如果'))){ pos.push('you used if-then-else'); pz.push('有用到如果否則'); }
  if(!full(it('有「當綠旗'))) add('start with "when ⚑ clicked"','程式要從「當綠旗被點擊」開始');
  if(!full(it('詢問身高'))) add('ask for height and weight','要詢問身高和體重');
  if(!full(it('把答案存進變數'))) add('save each answer: set [height] to (answer)','每次詢問後把答案存進變數');
  if(!full(it('算出 BMI'))) add('set bmi to weight / (height * height)','用 bmi 算出 weight / (height * height)');
  const miss=['18.5','24','27'].filter(t=>!full(it('有 '+t))); if(miss.length) add(`add if blocks for ${miss.join(', ')}`,`還少了和 ${miss.join('、')} 比較的判斷`);
  const outs=CATS.filter(c=>!full(it('說出 '+c.name))).map(c=>c.name); if(outs.length) add(`say ${outs.join(', ')}`,`還要說出 ${outs.join('、')}`);
  if(!full(it('沒有散落'))) add('attach every block under the green flag','把每塊積木都接在綠旗下面');
  const wrong=g.full.find(t=>!t.ok&&t.got);
  let en=pos.length?`Good work: ${pos.slice(0,2).join(' and ')}.`:'Thank you for your program!';
  let zh=pz.length?pz.slice(0,2).join('，')+'，很不錯！':'謝謝你完成這個程式！';
  if(fx.length){ en+=` To improve: ${fx.slice(0,2).join('; ')}.`; zh+='需要修正：'+fz.slice(0,2).join('；')+'。'; }
  if(wrong){ en+=` Right now BMI ${wrong.bmi} says ${wrong.got}, but it should say ${wrong.exp}.`; zh+=`目前 BMI ${wrong.bmi} 會說 ${wrong.got}，正確應該是 ${wrong.exp}。`; }
  if(!enOK&&g.enTips.length){ en+=` Try more English: ${g.enTips.slice(0,3).join(', ')}.`; zh+=`也試著多用英文：${g.enTips.slice(0,3).join('、')}。`; }
  en+=g.level==='優秀'?' Almost perfect, keep going!':' Fix these step by step and run it again. You can do it!';
  zh+=g.level==='優秀'?'只差一點點，繼續保持！':'照著修改，再按綠旗試一次，一定會更好！';
  return {en,zh};
}
(function(){
  const _taskOf=taskOf, _grade=gradeTask, _fb=feedbackTask;
  taskOf=function(w){ if(w&&w.task==='scratch-bmi') return 'scratch-bmi'; return _taskOf(w); };
  gradeTask=function(w){ return taskOf(w)==='scratch-bmi'?gradeScratchBMI(w):_grade(w); };
  feedbackTask=function(w,g){ return (g.task||taskOf(w))==='scratch-bmi'?feedbackScratchBMI(w,g):_fb(w,g); };
})();
Object.assign(EN_WORDS,{'答案':'answer','身高':'height','體重':'weight'});

if(typeof module!=='undefined') Object.assign(module.exports,{sbExec,sbRunSync,sbOutline,sbFacts,gradeScratch,feedbackScratch,gradeScratchBMI,feedbackScratchBMI,sbRunFn,gradeTask,feedbackTask,taskOf});
