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
  COUNTIFS(s,a){ if(a.length<2||a.length%2) throw shErr('#N/A'); let ok=null;
    for(let i=0;i<a.length;i+=2){ if(a[i].k!=='range') throw shErr('#N/A'); const f=critFn(s.evalNode(a[i+1])), vals=s.range(a[i].a,a[i].b);
      if(ok&&ok.length!==vals.length) throw shErr('#VALUE!'); ok=vals.map((v,j)=>(ok?ok[j]:true)&&f(v)); }
    return ok.filter(Boolean).length; },
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

/* ---------- the tasks: 1 = score sheet (rows 4–26, columns I–L); 2 = the same as review + counts (rows 31–37, columns D–H) ---------- */
const SH_FIRST=4, SH_LAST=26, SH_SUBJ=['D','E','F','G','H'];
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
/* rows 31–37 of task 2: [row, label in B, label in C, test for one score] */
const SH_BANDS=[[31,'Participant counts','參加人數',null],[32,'Score counts','100',v=>v===100],[33,'','99-90',v=>v>=90&&v<=99],[34,'','89-80',v=>v>=80&&v<90],[35,'','79-70',v=>v>=70&&v<80],[36,'','69-60',v=>v>=60&&v<70],[37,'','<60',v=>v<60]];
function shStart(task){ const cells={}; SH_DATA.forEach((row,r)=>row.forEach((v,c)=>{ if(v!==''&&v!=null) cells[refName(c,r)]=String(v); }));
  if(task===2) SH_BANDS.forEach(([r,b,c])=>{ if(b) cells['B'+r]=b; cells['C'+r]=c; });
  return cells; }
/* the cells students fill: [row, col] zero-based */
function shTodo(task,r,c){ if(r>=SH_FIRST-1&&r<=SH_LAST-1&&c>=8&&c<=11) return true; return task===2&&r>=30&&r<=36&&c>=3&&c<=7; }

const SH_PASS=/及格|pass|yes|通過|○|✓|⭕/i, SH_FAIL=/不及格|未及格|fail|\bno\b|不通過|×|✗|❌/i;
function shPassCat(v){ if(v===true) return 'pass'; if(v===false) return 'fail'; const t=String(v==null?'':v).trim(); if(!t) return null; if(SH_FAIL.test(t)) return 'fail'; if(SH_PASS.test(t)) return 'pass'; return null; }
/* does a formula point at cells (not just numbers typed into it)? */
const shHasRef=raw=>/(^|[^A-Za-z0-9_.])\$?[A-L]\$?\d+(?![0-9(])/i.test(String(raw).replace(/"[^"]*"/g,''));
/* one group: the first cells are typed (function + right answer), the rest must be filled by dragging the fill handle.
   Typed numbers, formulas without cell references, and cells typed or pasted where dragging is needed get nothing. */
function shPart(S,how,o){
  let typed=0, noRef=0, notDragged=0, errs=0, rightFirst=0, rightFill=0, formulas=0; const bad=[];
  const okCell=name=>{ const raw=S.raw(name), v=S.value(name); return raw[0]==='='&&shHasRef(raw)&&o.ok(v,name); };
  const look=name=>{ const raw=S.raw(name), v=S.value(name);
    if(raw[0]==='='){ formulas++; if(!shHasRef(raw)) noRef++; } else if(raw.trim()!=='') typed++;
    if(isErr(v)) errs++; };
  let firstGot=0;
  o.first.forEach(name=>{ look(name);
    if(okCell(name)){ rightFirst++; firstGot+=(o.fn.test(S.raw(name))?1:0.5)*o.firstPts/o.first.length; }
    else bad.push(name); });
  o.filled.forEach(name=>{ look(name);
    if(okCell(name)&&how[name]==='fill') rightFill++;
    else { bad.push(name); if(okCell(name)) notDragged++; } });
  const got=Math.round((firstGot+o.fillPts*rightFill/o.filled.length)*10)/10;
  const note=[];
  if(!formulas&&!typed) note.push('還沒有填。');
  if(typed) note.push(`有 ${typed} 格是直接打的數字或文字，不算分，要用公式（= 開頭）。`);
  if(noRef) note.push(`有 ${noRef} 個公式沒有參照格子（例如 =93+98），不算分，要寫成 D4、D4:H4 這樣的參照。`);
  if(o.first.some(n=>S.raw(n)[0]==='='&&!o.fn.test(S.raw(n)))) note.push(`請用 ${o.fnName} 函數（沒用只得一半）。`);
  if(notDragged) note.push(`有 ${notDragged} 格答案對了，但不是用拖曳的（打字、複製貼上或 Ctrl+D），不算分：請拖曳 ${o.first.join('、')} 右下角的小方塊${o.dir}。`);
  if(errs) note.push(`有 ${errs} 格出現錯誤（例如 #DIV/0!、#NAME?、#N/A）。`);
  return {rightFirst,rightFill,nFirst:o.first.length,nFill:o.filled.length,formulas,bad,got,note,max:o.firstPts+o.fillPts};
}
function gradeSheet(cells,task,how){
  task=task===2?2:1; how=how||{};
  const S=new Sheet(cells), base=new Sheet(shStart(task));
  const rows=[]; for(let r=SH_FIRST;r<=SH_LAST;r++) rows.push(r);
  /* the right answers, worked out from the scores on the student's own sheet */
  const scores=r=>SH_SUBJ.map(c=>S.value(c+r)).filter(v=>typeof v==='number');
  const exp={};
  rows.forEach(r=>{ const n=scores(r), t=n.reduce((a,b)=>a+b,0); exp[r]={total:t,avg:n.length?t/n.length:null}; });
  const rankOf=(key,r)=>1+rows.filter(q=>exp[q][key]!=null&&exp[q][key]>exp[r][key]+1e-9).length;
  rows.forEach(r=>{ exp[r].rankT=rankOf('total',r); exp[r].rankA=exp[r].avg==null?null:rankOf('avg',r); });
  const close=(v,x,tol)=>typeof v==='number'&&x!=null&&Math.abs(v-x)<=tol;
  const rowOf=name=>Number(name.slice(1));
  /* points: sheet 1 = 25 a column (first row 10, dragged rows 15); sheet 2 review = 10 a column (4 + 6) */
  const firstPts=task===2?4:10, fillPts=task===2?6:15;
  const tops=[
    {key:'sum',col:'I',name:'Total 總分（SUM）',fn:/SUM\s*\(/i,fnName:'SUM',ok:(v,n)=>close(v,exp[rowOf(n)].total,1e-6),want:r=>fmtNum(exp[r].total)},
    {key:'avg',col:'J',name:'Average 平均（AVERAGE）',fn:/AVERAGE\s*\(/i,fnName:'AVERAGE',ok:(v,n)=>close(v,exp[rowOf(n)].avg,0.051),want:r=>exp[r].avg==null?'':fmtNum(Math.round(exp[r].avg*100)/100)},
    {key:'if',col:'K',name:'Passed or not 及格與否（IF）',fn:/IF\s*\(/i,fnName:'IF',ok:(v,n)=>{ const e=exp[rowOf(n)]; return e.avg!=null&&shPassCat(v)===(e.avg>=60?'pass':'fail'); },want:r=>exp[r].avg==null?'':exp[r].avg>=60?'及格':'不及格'},
    {key:'rank',col:'L',name:'Rank 名次（RANK）',fn:/RANK(\.EQ)?\s*\(/i,fnName:'RANK',ok:(v,n)=>{ const e=exp[rowOf(n)]; return typeof v==='number'&&(v===e.rankT||v===e.rankA); },want:r=>String(exp[r].rankT)}];
  const items=[], wrong=[], notes=[];
  tops.forEach(P=>{
    const g=shPart(S,how,{first:[P.col+SH_FIRST],filled:rows.slice(1).map(r=>P.col+r),fn:P.fn,fnName:P.fnName,ok:P.ok,firstPts,fillPts,dir:'往下拖到第 '+SH_LAST+' 列'});
    if(P.key==='rank'&&g.formulas&&g.rightFill<g.nFill){ const f=S.raw('L'+SH_LAST); if(f[0]==='='&&!/\$[A-L]\$4\s*:\s*\$[A-L]\$26/i.test(f)) g.note.push('往下拖曳後範圍跑掉了：範圍的開頭和結尾都要加 $ 鎖住，例如 $I$4:$I$26（在參照上按 F4）。'); }
    if(P.key==='avg'&&g.formulas&&g.bad.length){ if(/\/\s*5/.test(S.raw('J'+SH_FIRST))) g.note.push('除以 5 會把缺考（空白）當成 0 分；AVERAGE 會自動略過空白的格子。'); }
    if(P.key==='if'&&g.formulas&&g.bad.some(n=>S.raw(n)[0]==='='&&!P.ok(S.value(n),n))) g.note.push('平均 60 分以上是及格，剛好 60 也算及格：用 >=60。');
    items.push({key:P.key,name:(task===2?'複習 Review · ':'')+P.name,col:P.col,max:g.max,got:g.got,detail:`第 ${SH_FIRST} 列公式 ${g.rightFirst}/1，拖曳 ${g.rightFill}/${g.nFill} 格`,note:g.note.join(' ')});
    wrong.push(...g.bad);
    g.bad.filter(n=>S.raw(n)[0]==='='&&!P.ok(S.value(n),n)).slice(0,task===2?1:2).forEach(name=>{ const r=rowOf(name); notes.push(`${name}（${S.raw('C'+r)||S.raw('B'+r)}）：應該是 ${P.want(r)}，現在是 ${shShow(S.value(name))||'空白'}`); });
  });
  if(task===2){
    /* counts per subject: type in column D, then drag right to H */
    const col=c=>rows.map(r=>S.value(c+r)).filter(v=>typeof v==='number');
    const want=(c,r)=>{ const b=SH_BANDS.find(x=>x[0]===r), v=col(c); return b[3]?v.filter(b[3]).length:v.length; };
    const okCount=(v,name)=>typeof v==='number'&&v===want(name[0],rowOf(name));
    const right4=['E','F','G','H'], bandRows=[32,33,34,35,36,37];
    const parts=[
      {key:'count',name:'Participant counts 參加人數（COUNT）',first:['D31'],filled:right4.map(c=>c+'31'),fn:/COUNTA?\s*\(/i,fnName:'COUNT',firstPts:4,fillPts:6},
      {key:'bands',name:'Score counts 分數段人數（COUNTIF）',first:bandRows.map(r=>'D'+r),filled:bandRows.flatMap(r=>right4.map(c=>c+r)),fn:/COUNTIFS?\s*\(/i,fnName:'COUNTIF 或 COUNTIFS',firstPts:20,fillPts:30}];
    parts.forEach(P=>{
      const g=shPart(S,how,{first:P.first,filled:P.filled,fn:P.fn,fnName:P.fnName,ok:okCount,firstPts:P.firstPts,fillPts:P.fillPts,dir:'往右拖到 H 欄'});
      if(P.key==='count'&&g.bad.length&&/COUNTA\s*\(/i.test(S.raw('D31'))) g.note.push('COUNTA 會把文字也算進去；只數有分數的人用 COUNT。');
      if(P.key==='bands'&&g.bad.some(n=>S.raw(n)[0]==='='&&!okCount(S.value(n),n))){
        g.note.push('每一段要同時有「下限」和「上限」，例如 99-90 是 >=90 而且 <=99：用 COUNTIFS，或用 COUNTIF(>=90) 減掉 COUNTIF(=100)。');
        const sumBad=SH_SUBJ.filter(c=>{ const t=bandRows.reduce((a,r)=>a+(typeof S.value(c+r)==='number'?S.value(c+r):0),0), n=S.value(c+'31'); return typeof n==='number'&&t!==n; });
        if(sumBad.length) g.note.push(`檢查看看：每一科六段的人數加起來，要等於參加人數（${sumBad.join('、')} 欄對不起來）。`); }
      items.push({key:P.key,name:P.name,col:'D–H',max:g.max,got:g.got,detail:`D 欄公式 ${g.rightFirst}/${g.nFirst}，往右拖曳 ${g.rightFill}/${g.nFill} 格`,note:g.note.join(' ')});
      wrong.push(...g.bad);
      g.bad.filter(n=>S.raw(n)[0]==='='&&!okCount(S.value(n),n)).slice(0,2).forEach(name=>{ notes.push(`${name}（${S.raw('C'+rowOf(name))||'參加人數'}，${S.raw(name[0]+'3').replace(/\(.*/,'')}）：應該是 ${want(name[0],rowOf(name))}，現在是 ${shShow(S.value(name))||'空白'}`); });
    });
  }
  /* the given scores must stay as they were */
  const changed=[]; rows.forEach(r=>['A','B','C',...SH_SUBJ].forEach(c=>{ if(S.raw(c+r)!==base.raw(c+r)) changed.push(c+r); }));
  const total=Math.round(items.reduce((s,i)=>s+i.got,0));
  return {task,total,items,wrong,notes:notes.slice(0,6),changed,passed:total>=100&&!changed.length};
}
if(typeof module!=='undefined') module.exports={shHasRef,Sheet,shParse,shShift,shShow,shStart,shTodo,gradeSheet,parseRef,refName,isErr,SH_COLS,SH_ROWS};
