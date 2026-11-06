/* ===== Scratch password check: at most 3 tries, then welcome or locked ===== */
const PW_DEFAULT='137';
const PW_WELCOME=/歡迎|welcome|成功|success|登入|log ?in|correct|正確|hello/i, PW_LOCK=/鎖|lock|封鎖|停用|blocked|3\s*次|三次|three/i, PW_WRONG=/錯|wrong|incorrect|再試|try again/i;
function pwCat(msg){ const m=String(msg||''); if(PW_LOCK.test(m)) return 'locked'; if(PW_WELCOME.test(m)&&!PW_WRONG.test(m)) return 'welcome'; if(PW_WRONG.test(m)) return 'wrong'; return null; }
function pwRun(ws,answers){ const r=sbRunFn(ws,(q,k)=>k<answers.length?answers[k]:'0'); const cats=r.says.map(pwCat); const last=[...cats].reverse().find(c=>c==='welcome'||c==='locked')||null; return {...r,result:last,cats}; }
/* the password the program checks against: 137, or a number the student set */
function pwFind(ws,F){
  const names=F.names, cands=[PW_DEFAULT];
  F.inFlag.forEach(b=>{ const add=x=>{ if(!x) return; const v=x.type==='sc_num'?sbField(x,'NUM'):x.type==='sc_text'?sbField(x,'TEXT'):null; if(v!=null&&String(v).trim()!==''&&!cands.includes(String(v).trim())) cands.push(String(v).trim()); };
    if(b.type==='sc_set') add(sbIn(b,'VALUE')); if(b.type==='sc_eq'){ add(sbIn(b,'A')); add(sbIn(b,'B')); } });
  return cands.find(c=>pwRun(ws,[c]).result==='welcome')||PW_DEFAULT;
}
function gradeScratchPw(work){
  const ws=work.workspace||{}, F=sbFacts(ws), items=[], bad=new Set();
  const add=(group,label,max,got,note)=>items.push({group,label,max,got:Math.max(0,Math.min(max,got)),note:note||''});
  const names=F.names;
  add('結構','有「當綠旗被點擊」',5,F.flags.length?5:0,F.flags.length?'':'程式要從「when ⚑ clicked 當綠旗被點擊」開始');
  add('結構','沒有散落的積木',5,5-2.5*F.loose.length,F.loose.length?`有 ${F.loose.length} 組積木沒有接在綠旗下面`:'');
  F.loose.forEach(b=>bad.add(b.id));
  const loops=F.inFlag.filter(b=>b.type==='sc_until'||b.type==='sc_repeat');
  const inLoop=[]; loops.forEach(l=>{ const d=l.inputs&&l.inputs.DO&&l.inputs.DO.block; if(d) sbWalk(d,b=>inLoop.push(b)); });
  const asks=F.inFlag.filter(b=>b.type==='sc_ask'), askIn=inLoop.some(b=>b.type==='sc_ask');
  /* input 15 */
  add('輸入','詢問密碼',8,asks.length?8:0,asks.length?'':'用「ask 詢問並等待」詢問密碼');
  add('輸入','答錯後在迴圈裡再詢問一次',7,askIn?7:0,askIn?'':'在重複積木裡面再放一個「ask 詢問」，讓使用者重新輸入');
  /* process 15 */
  const isConst=x=>x&&(x.type==='sc_num'||x.type==='sc_text');
  const consts=F.inFlag.filter(b=>b.type==='sc_set'&&isConst(sbIn(b,'VALUE'))&&!inLoop.includes(b));
  const one=x=>x&&((x.type==='sc_num'&&sbNum(sbField(x,'NUM'))===1)||(x.type==='sc_text'&&String(sbField(x,'TEXT')).trim()==='1'));
  const cnt=inLoop.find(b=>(b.type==='sc_change'&&one(sbIn(b,'BY')))||(b.type==='sc_set'&&sbIn(b,'VALUE')&&sbIn(b,'VALUE').type==='sc_add'));
  add('計算','設定初始值（密碼 = 137、次數 = 1）',10,consts.length>=2?10:consts.length?5:0,consts.length>=2?'':'迴圈前先設定：set password to 137、set count to 1');
  add('計算','次數加一（change count by 1）',5,cnt?5:0,cnt?'':'在重複積木裡讓次數加一：change count by 1');
  /* decision & loop 30 */
  const until=loops.find(b=>b.type==='sc_until'), cond=until&&sbIn(until,'COND');
  let hasOr=false, condAns=false, condCnt=false;
  if(cond) sbWalk(cond,x=>{ if(x.type==='sc_or') hasOr=true; if(x.type==='sc_answer') condAns=true; if(x.type==='sc_var') condCnt=true; });
  const ifAfter=F.inFlag.some(b=>(b.type==='sc_ifelse'||b.type==='sc_if')&&!inLoop.includes(b));
  add('判斷','使用重複積木（repeat until 重複直到）',10,until?10:loops.length?7:0,until?'':loops.length?'這題建議用「repeat until 重複直到」':'用「repeat until 重複直到」讓使用者重新輸入');
  add('判斷','停止條件：答對「或」次數到 3',10,cond&&hasOr&&condAns&&condCnt?10:cond&&(condAns||condCnt)?5:0,cond&&hasOr&&condAns&&condCnt?'':'條件要寫成 <(answer = password) or (count = 3)>，答對或試滿 3 次就停');
  add('判斷','迴圈結束後用「如果…否則」判斷結果',10,ifAfter?10:0,ifAfter?'':'迴圈結束後用「if … else 如果…否則」：答對說歡迎，否則說鎖定');
  /* output 5 */
  const texts=[]; F.inFlag.forEach(b=>{ if(b.type==='sc_say'||b.type==='sc_saysecs') sbWalk(sbIn(b,'MSG')||{},x=>{ if(x.type==='sc_text') texts.push(String(sbField(x,'TEXT')||'')); }); });
  const sayW=texts.some(t=>pwCat(t)==='welcome'), sayL=texts.some(t=>pwCat(t)==='locked');
  add('輸出','說出「歡迎」和「鎖定」兩種結果',5,(sayW?2.5:0)+(sayL?2.5:0),sayW&&sayL?'':!sayW?'答對時要說「歡迎使用本系統」':'3 次都錯要說「帳號已被鎖定」');
  /* tests 25 */
  const P=pwFind(ws,F), W=['1','2','3','999','0',P+'8'].filter(x=>x!==P);
  const CASES=[{a:[P],exp:'welcome',n:1},{a:[W[0],P],exp:'welcome',n:2},{a:[W[0],W[1],P],exp:'welcome',n:3},{a:[W[0],W[1],W[2]],exp:'locked',n:3},{a:[W[3],W[4],W[5]],exp:'locked',n:3},{a:[W[0],W[1],W[2],P],exp:'locked',n:3}];
  const NAME={welcome:'歡迎',locked:'鎖定'};
  const full=CASES.map(c=>{ const r=pwRun(ws,c.a); const ok=!r.err&&r.result===c.exp&&r.asks.length===c.n;
    let why='';
    if(r.err) why='程式停不下來：迴圈裡要讓次數加一，也要再詢問一次';
    else if(r.asks.length>c.n&&c.exp==='locked') why=`問了 ${r.asks.length} 次，最多只能試 3 次（條件用 count = 3，不是 count > 3）`;
    else if(r.asks.length>c.n) why='答對以後就不該再問了';
    else if(r.asks.length<c.n&&c.a[0]!==P&&r.asks.length===1) why='答錯之後要在迴圈裡再詢問一次';
    else if(r.asks.length<c.n) why=`只問了 ${r.asks.length} 次，要給使用者 3 次機會`;
    else if(!r.result) why='最後要說出「歡迎使用本系統」或「帳號已被鎖定」';
    else if(r.result!==c.exp) why=c.exp==='welcome'?'答對了卻說鎖定：迴圈後用「如果 answer = password」判斷':'3 次都錯卻說歡迎：檢查「如果…否則」的條件';
    return {a:c.a,exp:NAME[c.exp],got:r.result?NAME[r.result]:(r.says.length?r.says[r.says.length-1]:null),asks:r.asks.length,needAsks:c.n,ok,why,lab:`答 ${c.a.join('、')}`}; });
  const fp=full.filter(t=>t.ok).length;
  add('執行測試','執行測試（6 組輸入）',25,25*fp/full.length,`${fp} / ${full.length} 題正確`);
  /* english */
  const CJK=/[㐀-鿿]/; const units=[...F.texts,...F.varNames]; const zh=units.filter(t=>CJK.test(t));
  const english=units.length?Math.round(100*(units.length-zh.length)/units.length):0;
  const words=[...new Set(zh.join(' ').match(/[㐀-鿿]+/g)||[])];
  const sug=[...new Set(words.map(w=>{ const k=Object.keys(EN_WORDS).find(z=>w.includes(z)); return k?`${k} → ${EN_WORDS[k]}`:null; }).filter(Boolean))];
  if(fp===full.length) items.forEach(i=>{ if(i.got<i.max){ i.got=i.max; i.note='答案全部正確，用不同寫法也算對'; } });
  const groups={}; items.forEach(i=>{ const g=groups[i.group]||(groups[i.group]={got:0,max:0}); g.got+=i.got; g.max+=i.max; });
  const total=Math.round(items.reduce((s,i)=>s+i.got,0));
  const fixes=[]; items.filter(i=>i.got<i.max-1e-9&&i.note&&!/題正確$|答案全部正確/.test(i.note)).forEach(i=>fixes.push(i.note));
  full.filter(t=>!t.ok&&t.why).slice(0,1).forEach(t=>fixes.push(t.why));
  full.filter(t=>!t.ok).slice(0,2).forEach(t=>fixes.push(`依序輸入 ${t.a.join('、')}：應該問 ${t.needAsks} 次、最後說${t.exp}；你的程式問了 ${t.asks} 次${t.got?'、最後說'+t.got:''}`));
  const level=total>=90?'優秀':total>=75?'良好':total>=60?'及格':'需加強';
  return {task:'scratch-pw',total,level,items,groups,logic:[],full,fixes:[...new Set(fixes)],bad:[...bad],passed:fp===full.length&&total>=100,english,zhWords:words,enTips:sug,facts:F,password:P,until,cond,hasOr,ifAfter,askIn,cnt,consts};
}
function feedbackScratchPw(work,g){
  const it=l=>g.items.find(i=>i.label.startsWith(l)), full=i=>!!i&&i.got>=i.max-1e-9, enOK=g.english>=100;
  if(g.passed) return {en:'Excellent! Your program gives 3 tries, welcomes the right password and locks the account after 3 wrong ones. All 6 tests passed.'+(enOK?' Everything is in English. Great job!':''),
    zh:'程式完整又正確：最多試 3 次，答對說歡迎，3 次都錯就鎖定，6 組測試全部通過！'+(enOK?'而且全部用英文，非常棒！':'')};
  const pos=[],pz=[],fx=[],fz=[]; const add=(e,z)=>{fx.push(e);fz.push(z);};
  if(full(it('詢問密碼'))){ pos.push('you ask for the password'); pz.push('有詢問密碼'); }
  if(full(it('使用重複積木'))){ pos.push('you used repeat until'); pz.push('有用重複直到'); }
  if(full(it('迴圈結束後'))){ pos.push('you check the result with if-else'); pz.push('迴圈後有用如果…否則'); }
  if(!full(it('有「當綠旗'))) add('start with "when ⚑ clicked"','程式要從「當綠旗被點擊」開始');
  if(!full(it('設定初始值'))) add('set password to 137 and count to 1 first','先設定 password = 137、count = 1');
  if(!full(it('使用重複積木'))) add('use repeat until','用「repeat until 重複直到」');
  if(!full(it('停止條件'))) add('stop when (answer = password) or (count = 3)','條件寫 (answer = password) 或 (count = 3)');
  if(!full(it('答錯後'))) add('ask again inside the loop','迴圈裡要再詢問一次');
  if(!full(it('次數加一'))) add('change count by 1 inside the loop','迴圈裡 change count by 1');
  if(!full(it('迴圈結束後'))) add('after the loop, use if-else to say welcome or locked','迴圈後用如果…否則說歡迎或鎖定');
  const wrong=g.full.find(t=>!t.ok);
  let en=pos.length?`Good work: ${pos.slice(0,2).join(' and ')}.`:'Thank you for your program!';
  let zh=pz.length?pz.slice(0,2).join('，')+'，很不錯！':'謝謝你完成這個程式！';
  if(fx.length){ en+=` To improve: ${fx.slice(0,2).join('; ')}.`; zh+='需要修正：'+fz.slice(0,2).join('；')+'。'; }
  if(wrong){ en+=` Try typing ${wrong.a.join(', ')}: it should end with "${wrong.exp==='歡迎'?'welcome':'locked'}".`; zh+=`試試看依序輸入 ${wrong.a.join('、')}：應該${wrong.exp==='歡迎'?'說歡迎':'被鎖定'}。`+(wrong.why?wrong.why+'。':''); }
  en+=' Fix these step by step and run it again. You can do it!'; zh+='照著修改，再按綠旗試一次，一定會更好！';
  return {en,zh};
}
Object.assign(EN_WORDS,{'密碼':'password','次數':'count','歡迎':'welcome','鎖定':'locked','錯誤':'wrong'});
(function(){
  const _taskOf=taskOf, _grade=gradeTask, _fb=feedbackTask;
  taskOf=function(w){ if(w&&w.task==='scratch-pw') return 'scratch-pw'; return _taskOf(w); };
  gradeTask=function(w){ return taskOf(w)==='scratch-pw'?gradeScratchPw(w):_grade(w); };
  feedbackTask=function(w,g){ return (g&&g.task||taskOf(w))==='scratch-pw'?feedbackScratchPw(w,g):_fb(w,g); };
})();
if(typeof module!=='undefined') Object.assign(module.exports,{gradeScratchPw,feedbackScratchPw,pwCat,gradeTask,feedbackTask,taskOf});
