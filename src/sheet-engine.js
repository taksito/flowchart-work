/* ===== Sheet Lab: a small spreadsheet engine (A1 refs, $ locks, SUM AVERAGE RANK IF …) and the score-sheet grader ===== */
const SH_COLS=12, SH_ROWS=40;
class ShErr{ constructor(c){ this.c=c; } toString(){ return this.c; } }
const shErr=c=>new ShErr(c), isErr=v=>v instanceof ShErr;
const colName=i=>String.fromCharCode(65+i);
const colIndex=s=>s.charCodeAt(0)-65;
function parseRef(s){ const m=/^(\$?)([A-Z])(\$?)(\d+)$/.exec(String(s).toUpperCase()); if(!m) return null; return {absC:!!m[1],c:colIndex(m[2]),absR:!!m[3],r:Number(m[4])-1}; }
const refName=(c,r)=>colName(c)+(r+1);

/* ---------- tokenizer and parser ---------- */
function shTokens(src){
  const out=[]; let i=0;
  while(i<src.length){
    const ch=src[i];
    if(/\s/.test(ch)){ i++; continue; }
    if(ch==='"'){ let j=i+1, s=''; while(j<src.length){ if(src[j]==='"'){ if(src[j+1]==='"'){ s+='"'; j+=2; continue; } break; } s+=src[j++]; } if(j>=src.length) throw shErr('#ERROR!'); out.push({t:'str',v:s}); i=j+1; continue; }
    const num=/^(\d+\.?\d*|\.\d+)(E[+-]?\d+)?/i.exec(src.slice(i)); if(num){ out.push({t:'num',v:Number(num[0])}); i+=num[0].length; continue; }
    const id=/^\$?[A-Za-z][A-Za-z0-9_.]*\$?\d*/.exec(src.slice(i));
    if(id){ const w=id[0]; i+=w.length;
      if(/^\$?[A-Za-z]\$?\d+$/.test(w)) out.push({t:'ref',v:w.toUpperCase()});
      else out.push({t:'id',v:w.toUpperCase()});
      continue; }
    const two=src.slice(i,i+2); if(['<=','>=','<>'].includes(two)){ out.push({t:'op',v:two}); i+=2; continue; }
    if('+-*/^&=<>(),:%;'.includes(ch)){ out.push({t:'op',v:ch===';'?',':ch}); i++; continue; }
    throw shErr('#ERROR!');
  }
  return out;
}
function shParse(src){
  const T=shTokens(src); let p=0;
  const peek=()=>T[p], next=()=>T[p++], isOp=v=>T[p]&&T[p].t==='op'&&T[p].v===v;
  const expect=v=>{ if(!isOp(v)) throw shErr('#ERROR!'); p++; };
  function cmp(){ let a=cat(); while(T[p]&&T[p].t==='op'&&['=','<>','<','>','<=','>='].includes(T[p].v)){ const o=next().v; a={k:'bin',o,a,b:cat()}; } return a; }
  function cat(){ let a=add(); while(isOp('&')){ p++; a={k:'bin',o:'&',a,b:add()}; } return a; }
  function add(){ let a=mul(); while(isOp('+')||isOp('-')){ const o=next().v; a={k:'bin',o,a,b:mul()}; } return a; }
  function mul(){ let a=pow(); while(isOp('*')||isOp('/')){ const o=next().v; a={k:'bin',o,a,b:pow()}; } return a; }
  function pow(){ let a=una(); while(isOp('^')){ p++; a={k:'bin',o:'^',a,b:una()}; } return a; }
  function una(){ if(isOp('-')){ p++; return {k:'neg',a:una()}; } if(isOp('+')){ p++; return una(); } let a=prim(); if(isOp('%')){ p++; a={k:'bin',o:'/',a,b:{k:'num',v:100}}; } return a; }
  function prim(){
    const t=next(); if(!t) throw shErr('#ERROR!');
    if(t.t==='num') return {k:'num',v:t.v};
    if(t.t==='str') return {k:'str',v:t.v};
    if(t.t==='ref'){ if(isOp(':')){ p++; const u=next(); if(!u||u.t!=='ref') throw shErr('#ERROR!'); return {k:'range',a:t.v,b:u.v}; } return {k:'ref',v:t.v}; }
    if(t.t==='id'){
      if(isOp('(')){ p++; const args=[]; if(!isOp(')')){ args.push(cmp()); while(isOp(',')){ p++; args.push(isOp(',')||isOp(')')?{k:'blank'}:cmp()); } } expect(')'); return {k:'fn',n:t.v,args}; }
      if(t.v==='TRUE'||t.v==='FALSE') return {k:'bool',v:t.v==='TRUE'};
      return {k:'name',v:t.v};
    }
    if(t.t==='op'&&t.v==='('){ const e=cmp(); expect(')'); return e; }
    throw shErr('#ERROR!');
  }
  const e=cmp(); if(p<T.length) throw shErr('#ERROR!'); return e;
}

/* ---------- evaluation ---------- */
function Sheet(cells){
  this.cells=cells||{}; this.cache={}; this.busy={};
}
Sheet.prototype.raw=function(name){ return this.cells[name]==null?'':String(this.cells[name]); };
Sheet.prototype.reset=function(){ this.cache={}; this.busy={}; };
/* the value of a cell: number, string, boolean, error, or null for empty */
Sheet.prototype.value=function(name){
  if(name in this.cache) return this.cache[name];
  const raw=this.raw(name);
  let v;
  if(raw==='') v=null;
  else if(raw[0]==='='){
    if(this.busy[name]) return shErr('#REF!');
    this.busy[name]=true;
    try{ const r=this.evalNode(shParse(raw.slice(1))); v=Array.isArray(r)?(r.length?r[0]:null):r; if(v===null) v=0; }
    catch(e){ v=isErr(e)?e:shErr('#ERROR!'); }
    delete this.busy[name];
  }
  else { const t=raw.trim(); v=t!==''&&isFinite(Number(t))?Number(t):/^(TRUE|FALSE)$/i.test(t)?t.toUpperCase()==='TRUE':raw; }
  this.cache[name]=v; return v;
};
Sheet.prototype.range=function(a,b){
  const A=parseRef(a), B=parseRef(b); if(!A||!B) throw shErr('#REF!');
  const out=[]; for(let r=Math.min(A.r,B.r);r<=Math.max(A.r,B.r);r++) for(let c=Math.min(A.c,B.c);c<=Math.max(A.c,B.c);c++){ if(c>=SH_COLS||r>=SH_ROWS) throw shErr('#REF!'); out.push(this.value(refName(c,r))); }
  return out;
};
const toNum=v=>{ if(isErr(v)) throw v; if(v===null||v==='') return 0; if(typeof v==='number') return v; if(typeof v==='boolean') return v?1:0; const t=String(v).trim(); if(t!==''&&isFinite(Number(t))) return Number(t); throw shErr('#VALUE!'); };
const toStr=v=>{ if(isErr(v)) throw v; if(v===null) return ''; if(typeof v==='boolean') return v?'TRUE':'FALSE'; if(typeof v==='number') return fmtNum(v); return String(v); };
const toBool=v=>{ if(isErr(v)) throw v; if(typeof v==='boolean') return v; if(v===null) return false; if(typeof v==='number') return v!==0; const t=String(v).toUpperCase(); if(t==='TRUE') return true; if(t==='FALSE') return false; throw shErr('#VALUE!'); };
function fmtNum(n){ if(!isFinite(n)) return '#NUM!'; const r=Math.round(n*1e9)/1e9; return String(r); }
function cmpVals(a,b){
  if(isErr(a)) throw a; if(isErr(b)) throw b;
  if(a===null) a=typeof b==='string'?'':0; if(b===null) b=typeof a==='string'?'':0;
  const ta=typeof a, tb=typeof b;
  if(ta==='number'&&tb==='number') return a===b?0:a<b?-1:1;
  if(ta==='string'&&tb==='string'){ const x=a.toLowerCase(), y=b.toLowerCase(); return x===y?0:x<y?-1:1; }
  if(ta==='boolean'&&tb==='boolean') return a===b?0:a?1:-1;
  const rank={number:0,string:1,boolean:2}; return rank[ta]<rank[tb]?-1:1;
}
/* numbers to add up: from ranges only real numbers count; typed arguments are converted */
Sheet.prototype.nums=function(args){
  const out=[];
  args.forEach(n=>{
    if(n.k==='range'){ this.range(n.a,n.b).forEach(v=>{ if(isErr(v)) throw v; if(typeof v==='number') out.push(v); }); }
    else if(n.k==='ref'){ const v=this.value(n.v); if(isErr(v)) throw v; if(typeof v==='number') out.push(v); }
    else if(n.k!=='blank') out.push(toNum(this.evalNode(n)));
  });
  return out;
};
function critFn(c){
  if(isErr(c)) throw c;
  let s=c===null?'':String(c), op='=';
  const m=/^(<=|>=|<>|<|>|=)(.*)$/.exec(s); if(m){ op=m[1]; s=m[2]; }
  const val=s.trim()!==''&&isFinite(Number(s))?Number(s):s;
  return v=>{ if(v===null) return op==='<>'?val!=='':val===''&&op==='='; if(isErr(v)) return false;
    if(typeof val==='number'&&typeof v!=='number') return op==='<>';
    if(typeof val==='string'&&typeof v==='number') return op==='<>';
    const d=cmpVals(v,val); return op==='='?d===0:op==='<>'?d!==0:op==='<'?d<0:op==='>'?d>0:op==='<='?d<=0:d>=0; };
}
const SH_FN={
  SUM(s,a){ return s.nums(a).reduce((x,y)=>x+y,0); },
  AVERAGE(s,a){ const n=s.nums(a); if(!n.length) throw shErr('#DIV/0!'); return n.reduce((x,y)=>x+y,0)/n.length; },
  MAX(s,a){ const n=s.nums(a); return n.length?Math.max(...n):0; },
  MIN(s,a){ const n=s.nums(a); return n.length?Math.min(...n):0; },
  COUNT(s,a){ return s.nums(a).length; },
  COUNTA(s,a){ let k=0; a.forEach(n=>{ if(n.k==='range') s.range(n.a,n.b).forEach(v=>{ if(v!==null&&v!=='') k++; }); else if(n.k!=='blank'){ const v=s.evalNode(n); if(v!==null&&v!=='') k++; } }); return k; },
  COUNTIF(s,a){ if(a.length!==2||a[0].k!=='range') throw shErr('#N/A'); const f=critFn(s.evalNode(a[1])); return s.range(a[0].a,a[0].b).filter(f).length; },
  ROUND(s,a){ if(a.length<1) throw shErr('#N/A'); const x=toNum(s.evalNode(a[0])), d=a[1]?toNum(s.evalNode(a[1])):0, f=Math.pow(10,d); return Math.round(x*f+Math.sign(x)*1e-9)/f; },
  ABS(s,a){ return Math.abs(toNum(s.evalNode(a[0]))); },
  IF(s,a){ if(a.length<2||a.length>3) throw shErr('#N/A'); const c=toBool(s.evalNode(a[0])); const n=c?a[1]:a[2]; if(!n||n.k==='blank') return c?0:false; const v=s.evalNode(n); return Array.isArray(v)?v[0]:v; },
  AND(s,a){ return a.every(n=>toBool(s.evalNode(n))); },
  OR(s,a){ return a.some(n=>toBool(s.evalNode(n))); },
  NOT(s,a){ return !toBool(s.evalNode(a[0])); },
  RANK(s,a){ if(a.length<2||a[1].k!=='range') throw shErr('#N/A'); const x=toNum(s.evalNode(a[0])); const asc=a[2]&&a[2].k!=='blank'?toNum(s.evalNode(a[2]))!==0:false;
    const list=[]; s.range(a[1].a,a[1].b).forEach(v=>{ if(isErr(v)) throw v; if(typeof v==='number') list.push(v); });
    if(!list.some(v=>Math.abs(v-x)<1e-9)) throw shErr('#N/A');
    return 1+list.filter(v=>asc?v<x-1e-9:v>x+1e-9).length; }
};
SH_FN['RANK.EQ']=SH_FN.RANK;
Sheet.prototype.evalNode=function(n){
  switch(n.k){
    case 'num': return n.v;
    case 'str': return n.v;
    case 'bool': return n.v;
    case 'blank': return null;
    case 'ref': { const R=parseRef(n.v); if(!R||R.c>=SH_COLS||R.r>=SH_ROWS) throw shErr('#REF!'); const v=this.value(refName(R.c,R.r)); if(isErr(v)) throw v; return v; }
    case 'range': return this.range(n.a,n.b);
    case 'name': throw shErr('#NAME?');
    case 'neg': return -toNum(this.evalNode(n.a));
    case 'fn': { const f=SH_FN[n.n]; if(!f) throw shErr('#NAME?'); return f(this,n.args); }
    case 'bin': {
      const a=this.evalNode(n.a), b=this.evalNode(n.b);
      const one=v=>Array.isArray(v)?(v.length===1?v[0]:(()=>{ throw shErr('#VALUE!'); })()):v;
      const x=one(a), y=one(b);
      switch(n.o){
        case '+': return toNum(x)+toNum(y);
        case '-': return toNum(x)-toNum(y);
        case '*': return toNum(x)*toNum(y);
        case '/': { const d=toNum(y); if(d===0) throw shErr('#DIV/0!'); return toNum(x)/d; }
        case '^': return Math.pow(toNum(x),toNum(y));
        case '&': return toStr(x)+toStr(y);
        case '=': return cmpVals(x,y)===0; case '<>': return cmpVals(x,y)!==0;
        case '<': return cmpVals(x,y)<0; case '>': return cmpVals(x,y)>0;
        case '<=': return cmpVals(x,y)<=0; case '>=': return cmpVals(x,y)>=0;
      }
    }
  }
  throw shErr('#ERROR!');
};
/* what a cell shows: long decimals are cut to 5 places, like a narrow column */
function shShow(v){ if(v===null) return ''; if(isErr(v)) return v.c; if(typeof v==='boolean') return v?'TRUE':'FALSE'; if(typeof v==='number') return isFinite(v)?String(Math.round(v*1e5)/1e5):'#NUM!'; return String(v); }

/* copy a formula dRow rows down and dCol columns right: refs move unless locked with $ */
function shShift(raw,dr,dc){
  if(!raw||raw[0]!=='=') return raw;
  let out='', inStr=false;
  const s=raw;
  for(let i=0;i<s.length;){
    if(s[i]==='"'){ inStr=!inStr; out+=s[i++]; continue; }
    if(!inStr){
      const m=/^(\$?)([A-Za-z])(\$?)(\d+)(?![A-Za-z0-9_(.])/.exec(s.slice(i));
      const prev=i>0?s[i-1]:'';
      if(m&&!/[A-Za-z0-9_.]/.test(prev)){
        let c=colIndex(m[2].toUpperCase()), r=Number(m[4]);
        if(!m[1]) c+=dc; if(!m[3]) r+=dr;
        out+=(c<0||r<1||c>=SH_COLS)?'#REF!':m[1]+colName(c)+m[3]+r; i+=m[0].length; continue;
      }
    }
    out+=s[i++];
  }
  return out;
}

/* ---------- the task: score sheet, rows 4–26 ---------- */
const SH_FIRST=4, SH_LAST=26;
const SH_DATA=[
['Mandon Junior High School First Term Exam 漫動國中第一次段考成績'],
['Analyser:','','serial:',799],
['Seat No.(座號)','English name','Chinese Name','Chinese(中文)','English(英文)','Math(數學)','Science(科學)','Social Study(社會)','Total','Average(平均)','Passed or not(及格與否)','Rank(名次)'],
[1,'Eren Yeager','艾連·葉卡',93,98,93,100,100],[2,'Mikasa Ackerman','米卡莎·阿卡曼',98,85,87,20,96],[3,'Armin Arlert','阿爾敏·亞魯雷特',74,'','',78,65],
[4,'Reiner Braun','萊納·布朗',15,43,44,22,100],[5,'Bertholdt Fubar','貝爾托特·胡佛',45,100,21,99,70],[6,'Annie Leonhart','亞妮·雷恩哈特',77,14,42,53,88],
[7,'Jean Kirstein','約翰·基爾休坦',99,78,73,'',32],[8,'Marco Bott','馬可·波特',100,66,44,83,34],[9,'Connie Springer','柯尼·史普林格',87,94,2,32,68],
[10,'Sasha Blouse','莎夏·布勞斯','',77,46,78,11],[11,'Krista Lenz','克里斯塔·連茲',100,100,100,100,100],[12,'Ymir','尤米爾',58,79,64,45,53],
[13,'Thomas Wagner','托馬斯·瓦格納',75,15,67,77,100],[14,'Mina Carolina','米娜·卡羅萊納',34,77,83,23,88],[15,'Samuel','山謬',88,2,77,45,66],
[16,'Natsu Dragneel','納茲·多拉格尼爾',41,42,50,31,99],[17,'Reborn','里包恩',14,71,28,89,60],[18,'Tsunayoshi Sawada','澤田綱吉',59,43,96,17,43],
[19,'Hayato Gokudera','獄寺隼人',50,30,'',74,12],[20,'Takeshi Yamamoto','山本武',40,35,17,39,55],[21,'Ryohei Sasagawa','笹川了平','',73,51,'',''],
[22,'Lambo','藍波',73,51,15,17,17],[23,'Kyoya Hibari','雲雀恭彌',69,'',91,83,71]];
function shStart(){ const cells={}; SH_DATA.forEach((row,r)=>row.forEach((v,c)=>{ if(v!==''&&v!=null) cells[refName(c,r)]=String(v); })); return cells; }

const SH_PASS=/及格|pass|yes|通過|○|✓|⭕/i, SH_FAIL=/不及格|未及格|fail|\bno\b|不通過|×|✗|❌/i;
function shPassCat(v){ if(v===true) return 'pass'; if(v===false) return 'fail'; const t=String(v==null?'':v).trim(); if(!t) return null; if(SH_FAIL.test(t)) return 'fail'; if(SH_PASS.test(t)) return 'pass'; return null; }
/* grade one sheet: columns I (Total), J (Average), K (Pass or not), L (Rank) for rows 4–26 */
function gradeSheet(cells){
  const S=new Sheet(cells), base=new Sheet(shStart());
  const rows=[]; for(let r=SH_FIRST;r<=SH_LAST;r++) rows.push(r);
  /* the right answers, worked out from the scores on the student's own sheet (so a changed score is still checked fairly) */
  const scores=r=>['D','E','F','G','H'].map(c=>S.value(c+r)).filter(v=>typeof v==='number');
  const exp={};
  rows.forEach(r=>{ const n=scores(r), t=n.reduce((a,b)=>a+b,0); exp[r]={total:t,avg:n.length?t/n.length:null}; });
  const rankOf=(key,r)=>1+rows.filter(q=>exp[q][key]!=null&&exp[q][key]>exp[r][key]+1e-9).length;
  rows.forEach(r=>{ exp[r].rankT=rankOf('total',r); exp[r].rankA=exp[r].avg==null?null:rankOf('avg',r); });
  const close=(v,x,tol)=>typeof v==='number'&&x!=null&&Math.abs(v-x)<=tol;
  const parts=[
    {key:'sum',col:'I',name:'Total 總分（SUM）',fn:/SUM\s*\(/i,ok:(v,r)=>close(v,exp[r].total,1e-6),want:r=>fmtNum(exp[r].total)},
    {key:'avg',col:'J',name:'Average 平均（AVERAGE）',fn:/AVERAGE\s*\(/i,ok:(v,r)=>close(v,exp[r].avg,0.051),want:r=>exp[r].avg==null?'':fmtNum(Math.round(exp[r].avg*100)/100)},
    {key:'if',col:'K',name:'Pass or not 及格與否（IF）',fn:/IF\s*\(/i,ok:(v,r)=>exp[r].avg!=null&&shPassCat(v)===(exp[r].avg>=60?'pass':'fail'),want:r=>exp[r].avg==null?'':exp[r].avg>=60?'及格':'不及格'},
    {key:'rank',col:'L',name:'Rank 名次（RANK）',fn:/RANK(\.EQ)?\s*\(/i,ok:(v,r)=>typeof v==='number'&&(v===exp[r].rankT||v===exp[r].rankA),want:r=>String(exp[r].rankT)}
  ];
  const wrong=[], items=[], notes=[];
  parts.forEach(P=>{
    let right=0, formulas=0, typed=0, usesFn=0, errs=0; const bad=[];
    rows.forEach(r=>{
      const name=P.col+r, raw=S.raw(name), v=S.value(name), isF=raw[0]==='=';
      if(isF) formulas++; else if(raw.trim()!=='') typed++;
      if(isF&&P.fn.test(raw)) usesFn++;
      if(isErr(v)) errs++;
      if(isF&&P.ok(v,r)) right++; else { bad.push(r); wrong.push(name); }
    });
    const n=rows.length, useOK=usesFn>=Math.ceil(n*0.8);
    const got=Math.round(((useOK?5:usesFn?2:0)+20*right/n)*10)/10;
    const note=[];
    if(!formulas&&!typed) note.push('還沒有填。');
    if(typed) note.push(`有 ${typed} 格是直接打的數字或文字，要用公式（= 開頭）才算分。`);
    if(!useOK&&formulas) note.push(`請用 ${P.key==='sum'?'SUM':P.key==='avg'?'AVERAGE':P.key==='if'?'IF':'RANK'} 函數。`);
    if(errs) note.push(`有 ${errs} 格出現錯誤（例如 #DIV/0!、#NAME?、#N/A）。`);
    if(P.key==='rank'&&formulas&&right<n){ const f=S.raw('L'+SH_LAST); if(f[0]==='='&&!/\$[A-L]\$4\s*:\s*\$[A-L]\$26/i.test(f)) note.push('往下複製後範圍跑掉了：範圍的開頭和結尾都要加 $ 鎖住，例如 $I$4:$I$26（在參照上按 F4）。'); }
    if(P.key==='avg'&&formulas&&right<n){ const f=S.raw('J'+SH_FIRST); if(/\/\s*5/.test(f)) note.push('除以 5 會把缺考（空白）當成 0 分；AVERAGE 會自動略過空白的格子。'); }
    if(P.key==='if'&&formulas&&right<n) note.push('平均 60 分以上是及格，剛好 60 也算及格：用 >=60。');
    items.push({key:P.key,name:P.name,col:P.col,max:25,got,right,n,note:note.join(' ')});
    bad.slice(0,3).forEach(r=>{ if(S.raw(P.col+r)[0]==='=') notes.push(`${P.col}${r}（${S.raw('C'+r)||S.raw('B'+r)}）：應該是 ${P.want(r)}，現在是 ${shShow(S.value(P.col+r))||'空白'}`); });
  });
  /* the given scores must stay as they were */
  const changed=[]; rows.forEach(r=>['A','B','C','D','E','F','G','H'].forEach(c=>{ if(S.raw(c+r)!==base.raw(c+r)) changed.push(c+r); }));
  const total=Math.round(items.reduce((s,i)=>s+i.got,0));
  return {total,items,wrong,notes:notes.slice(0,6),changed,passed:total>=100&&!changed.length};
}
if(typeof module!=='undefined') module.exports={Sheet,shParse,shShift,shShow,shStart,gradeSheet,parseRef,refName,isErr,SH_COLS,SH_ROWS};
