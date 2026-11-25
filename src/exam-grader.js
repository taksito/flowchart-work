/* ===== Scratch exam: remedial score. Ask a score; below 60 say 進行教學 and ask again until it is 60 or more;
   80 or more says 很棒, otherwise 剛好及格; last, say the score and 恭喜你完成測驗 ===== */
const EX_TEACH=/教學|補救|上課|teach|lesson|study|review/i, EX_GREAT=/很棒|太棒|很好|優秀|great|excellent|awesome|good job|well done/i,
  EX_PASS=/剛好及格|及格|pass/i, EX_DONE=/恭喜|完成|congrat|finish|complete/i;
function exCat(msg){ const m=String(msg||'');
  if(EX_DONE.test(m)) return 'done';
  if(EX_TEACH.test(m)&&!EX_GREAT.test(m)) return 'teach';
  if(EX_GREAT.test(m)) return 'great';
  if(EX_PASS.test(m)) return 'pass';
  return null; }
/* run with answers in order; after they run out the program gets 100, so a loop that never ends still stops */
function exRun(ws,answers){
  const r=sbRunFn(ws,(q,k)=>k<answers.length?answers[k]:'100');
  const cats=r.says.map(exCat), teach=cats.filter(c=>c==='teach').length;
  const lastTeach=cats.lastIndexOf('teach');
  const after=cats.slice(lastTeach+1), result=after.find(c=>c==='great'||c==='pass')||null;
  const last=r.says.length?r.says[r.says.length-1]:'';
  return {...r,cats,teach,result,last};
}
const EX_CASES=[{a:[90],exp:'great'},{a:[70],exp:'pass'},{a:[80],exp:'great'},{a:[79],exp:'pass'},{a:[60],exp:'pass'},
  {a:[59,75],exp:'pass'},{a:[30,45,95],exp:'great'},{a:[10,60],exp:'pass'}];
const EX_NAME={great:'很棒',pass:'剛好及格'};
function exTests(ws){
  return EX_CASES.map(c=>{
    const r=exRun(ws,c.a.map(String)), n=c.a.length, fin=String(c.a[n-1]);
    const finalOK=new RegExp('(^|[^0-9.])'+fin+'([^0-9]|$)').test(r.last)&&EX_DONE.test(r.last);
    const ok=!r.err&&r.asks.length===n&&r.teach===n-1&&r.result===c.exp&&finalOK;
    let why='';
    if(r.err) why='程式停不下來：重複裡要再詢問一次成績';
    else if(r.asks.length<n) why=n>1?`只問了 ${r.asks.length} 次：不到 60 分要在重複裡再詢問一次`:'要用 ask 詢問成績';
    else if(r.asks.length>n) why=c.a[n-1]>=60&&c.a[n-1]<61?'剛好 60 分已經及格，不用再教學（條件寫 score > 59，或 not score < 60）':`問了 ${r.asks.length} 次：成績到 60 分就要停止重複`;
    else if(r.teach!==n-1) why=r.teach<n-1?'不到 60 分要說「進行教學」':'及格的成績不用說「進行教學」';
    else if(!r.result) why='重複結束後要說「很棒」或「剛好及格」';
    else if(r.result!==c.exp) why=c.exp==='great'?(c.a[n-1]===80?'80 分也算很棒（條件寫 score > 79，或 not score < 80）':'80 分以上要說「很棒」'):'60 到 79 分要說「剛好及格」';
    else if(!finalOK) why='最後要說「您的成績是 '+fin+'，恭喜你完成測驗」：用 join 字串組合把成績接進去';
    return {a:c.a,exp:EX_NAME[c.exp],got:r.result?EX_NAME[r.result]:(r.last||null),asks:r.asks.length,needAsks:n,teach:r.teach,last:r.last,ok,why,lab:`輸入 ${c.a.join('、')}`};
  });
}
function gradeScratchExam(work){
  const ws=work.workspace||{}, F=sbFacts(ws), items=[], bad=new Set(), names=F.names;
  const add=(group,label,max,got,note)=>items.push({group,label,max,got:Math.max(0,Math.min(max,got)),note:note||''});
  add('結構','有「當綠旗被點擊」',5,F.flags.length?5:0,F.flags.length?'':'程式要從「when ⚑ clicked 當綠旗被點擊」開始');
  add('結構','沒有散落的積木',5,5-2.5*F.loose.length,F.loose.length?`有 ${F.loose.length} 組積木沒有接在綠旗下面`:'');
  F.loose.forEach(b=>bad.add(b.id));
  const loops=F.inFlag.filter(b=>b.type==='sc_until'||b.type==='sc_repeat');
  const inLoop=[]; loops.forEach(l=>{ const d=l.inputs&&l.inputs.DO&&l.inputs.DO.block; if(d) sbWalk(d,b=>inLoop.push(b)); });
  const asks=F.inFlag.filter(b=>b.type==='sc_ask'), askIn=inLoop.some(b=>b.type==='sc_ask');
  add('輸入','詢問成績',8,asks.length?8:0,asks.length?'':'用「ask 詢問並等待」詢問成績');
  add('輸入','不及格時在重複裡再詢問一次',7,askIn?7:0,askIn?'':'在 repeat until 裡面再放一個「ask 詢問」，教學後重新輸入成績');
  add('計算','把答案存進變數（set score to answer）',10,F.stores.length?10:0,F.stores.length?'':'詢問後用「set score to (answer)」把成績存起來');
  const until=loops.find(b=>b.type==='sc_until'), cond=until&&sbIn(until,'COND');
  const nums=x=>{ const out=[]; if(x) sbWalk(x,y=>{ if(y.type==='sc_num') out.push(sbNum(sbField(y,'NUM'))); if(y.type==='sc_text'&&isFinite(Number(sbField(y,'TEXT')))) out.push(Number(sbField(y,'TEXT'))); }); return out; };
  const c60=cond&&nums(cond).some(v=>v===59||v===60);
  const ifAfter=F.inFlag.filter(b=>(b.type==='sc_ifelse'||b.type==='sc_if')&&!inLoop.includes(b));
  const if80=ifAfter.some(b=>nums(sbIn(b,'COND')).some(v=>v===79||v===80));
  add('判斷','使用重複積木（repeat until 重複直到）',10,until?10:loops.length?6:0,until?'':loops.length?'這題建議用「repeat until 重複直到」':'用「repeat until 重複直到」：成績不到 60 就一直重複');
  add('判斷','重複的停止條件和 60 比較',10,c60?10:cond?5:0,c60?'':'停止條件寫 score > 59（成績到 60 分就停）');
  add('判斷','重複結束後用「如果…否則」和 80 比較',10,if80?10:ifAfter.length?5:0,if80?'':'重複結束後用「if … else」：score > 79 說很棒，否則說剛好及格');
  const sayIn=b=>b.type==='sc_say'||b.type==='sc_saysecs';
  const loopSays=inLoop.filter(sayIn), allSays=F.inFlag.filter(sayIn);
  const sayText=b=>{ const t=[]; sbWalk(sbIn(b,'MSG')||{},x=>{ if(x.type==='sc_text') t.push(String(sbField(x,'TEXT')||'')); }); return t.join(''); };
  const teachIn=loopSays.some(b=>exCat(sayText(b))==='teach');
  const both=allSays.some(b=>exCat(sayText(b))==='great')&&allSays.some(b=>exCat(sayText(b))==='pass');
  const joinFinal=allSays.some(b=>{ let j=false; sbWalk(sbIn(b,'MSG')||{},x=>{ if(x.type==='sc_join') j=true; }); return j&&EX_DONE.test(sayText(b)); });
  add('輸出','重複裡說「進行教學」',3,teachIn?3:0,teachIn?'':'在 repeat until 裡說「進行教學」');
  add('輸出','說出「很棒」和「剛好及格」',3,both?3:0,both?'':'if 裡說「很棒」，else 裡說「剛好及格」');
  add('輸出','最後用 join 說出成績與恭喜',4,joinFinal?4:0,joinFinal?'':'最後用 join 字串組合說「您的成績是 (score)，恭喜你完成測驗」');
  const full=exTests(ws), fp=full.filter(t=>t.ok).length;
  add('執行測試','執行測試（8 組輸入）',25,25*fp/full.length,`${fp} / ${full.length} 題正確`);
  /* english */
  const CJK=/[㐀-鿿]/; const units=[...F.texts,...F.varNames]; const zh=units.filter(t=>CJK.test(t));
  const english=units.length?Math.round(100*(units.length-zh.length)/units.length):0;
  if(fp===full.length) items.forEach(i=>{ if(i.got<i.max){ i.got=i.max; i.note='答案全部正確，用不同寫法也算對'; } });
  const groups={}; items.forEach(i=>{ const g=groups[i.group]||(groups[i.group]={got:0,max:0}); g.got+=i.got; g.max+=i.max; });
  const total=Math.round(items.reduce((s,i)=>s+i.got,0));
  const fixes=[]; items.filter(i=>i.got<i.max-1e-9&&i.note&&!/題正確$|答案全部正確/.test(i.note)).forEach(i=>fixes.push(i.note));
  full.filter(t=>!t.ok&&t.why).slice(0,2).forEach(t=>fixes.push(`${t.lab}：${t.why}`));
  const level=total>=90?'優秀':total>=75?'良好':total>=60?'及格':'需加強';
  return {task:'exam',total,level,items,groups,logic:[],full,fixes:[...new Set(fixes)],bad:[...bad],passed:fp===full.length&&total>=100,english,zhWords:[],enTips:[],facts:F};
}
function feedbackScratchExam(work,g){
  if(g.passed) return {en:'All 8 tests passed.',zh:'8 組測試全部通過。'};
  return {en:`${g.full.filter(t=>t.ok).length} of 8 tests passed.`,zh:g.fixes.slice(0,3).join('；')||'請檢查程式。'};
}
(function(){
  const _taskOf=taskOf, _grade=gradeTask, _fb=feedbackTask;
  taskOf=function(w){ if(w&&w.task==='exam') return 'exam'; return _taskOf(w); };
  gradeTask=function(w){ return taskOf(w)==='exam'?gradeScratchExam(w):_grade(w); };
  feedbackTask=function(w,g){ return (g&&g.task||taskOf(w))==='exam'?feedbackScratchExam(w,g):_fb(w,g); };
})();
if(typeof module!=='undefined') Object.assign(module.exports,{gradeScratchExam,feedbackScratchExam,exCat,exRun,exTests,gradeTask,feedbackTask,taskOf});
