import { useState, useEffect, useMemo, useCallback } from "react";

// ── Constants ─────────────────────────────────────────────────────────────────
const DC = {
  receita:[{id:"salario",l:"Salário",i:"💼"},{id:"freelance",l:"Freelance",i:"💻"},{id:"investimento",l:"Investimento",i:"📈"},{id:"outros_r",l:"Outros",i:"➕"}],
  despesa:[{id:"moradia",l:"Moradia",i:"🏠"},{id:"alimentacao",l:"Alimentação",i:"🍽️"},{id:"transporte",l:"Transporte",i:"🚗"},{id:"saude",l:"Saúde",i:"❤️"},{id:"lazer",l:"Lazer",i:"🎉"},{id:"educacao",l:"Educação",i:"📚"},{id:"vestuario",l:"Vestuário",i:"👕"},{id:"outros_d",l:"Outros",i:"📦"}]
};
const EMOJIS=["🏠","🍽️","🚗","❤️","🎉","📚","👕","📦","💼","💻","📈","➕","🎯","✈️","🐾","🎮","🎵","🌿","☕","🛒","💊","🔧","📱","🎓","🍕","🚀","⭐","🎁","🏦","💰","🪙","🎨","📷","🛋️","🌍","🏋️","🔑","💇","🏖️","🎪"];
const BCOLS=["#3b82f6","#8b5cf6","#ec4899","#f97316","#10b981","#f59e0b","#06b6d4","#ef4444"];
const CCOLS=["#1e40af","#6d28d9","#9d174d","#92400e","#065f46","#1e3a5f","#374151","#7f1d1d"];
const PCOLS=["#38bdf8","#818cf8","#34d399","#f87171","#fbbf24","#a78bfa","#fb923c","#4ade80","#f472b6","#60a5fa"];
const MS=["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
const BICONS=["🏦","🏧","💰","🪙","🏛️"];
const CICONS=["💳","🃏","💎","⭐","🔷"];
const FREQS=[{id:"none",l:"Não repetir"},{id:"weekly",l:"Semanal"},{id:"biweekly",l:"Quinzenal"},{id:"monthly",l:"Mensal"},{id:"bimonthly",l:"Bimestral"},{id:"quarterly",l:"Trimestral"},{id:"semiannual",l:"Semestral"},{id:"annual",l:"Anual"}];
const HOL=new Set(["01-01","04-21","05-01","09-07","10-12","11-02","11-15","11-20","12-25"]);

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt=v=>new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(v??0);
const td=()=>new Date().toISOString().split("T")[0];
const pd=s=>new Date(s+"T12:00:00");
const isBiz=d=>{const w=d.getDay();if(w===0||w===6)return false;return!HOL.has(`${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`);};
const adjBiz=(s,r)=>{if(r==="ignore")return s;let d=pd(s);if(isBiz(d))return s;const st=r==="next"?1:-1;let g=0;while(!isBiz(d)&&g++<15)d.setDate(d.getDate()+st);return d.toISOString().split("T")[0];};
const addF=(s,f)=>{const d=pd(s);if(f==="weekly")d.setDate(d.getDate()+7);else if(f==="biweekly")d.setDate(d.getDate()+14);else if(f==="monthly")d.setMonth(d.getMonth()+1);else if(f==="bimonthly")d.setMonth(d.getMonth()+2);else if(f==="quarterly")d.setMonth(d.getMonth()+3);else if(f==="semiannual")d.setMonth(d.getMonth()+6);else if(f==="annual")d.setFullYear(d.getFullYear()+1);else return null;return d.toISOString().split("T")[0];};
const LS={g:(k,d)=>{try{const v=localStorage.getItem(k);return v?JSON.parse(v):d;}catch{return d;}},s:(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v));}catch{}}};
const mf=()=>({type:"despesa",amt:"",desc:"",cat:"alimentacao",date:td(),note:"",atype:"bank",aid:"",freq:"none",bday:"ignore",inst:false,icount:"2",tamt:"",isTransfer:false,toAtype:"bank",toAid:""});
const EB={name:"",bal:"",color:BCOLS[0],icon:"🏦"};
const EC={name:"",lim:"",color:CCOLS[0],icon:"💳",due:"10"};

// ── Pie Chart ─────────────────────────────────────────────────────────────────
function Pie({slices,sz=150,label,sub}){
  if(!slices?.length)return<div style={{width:sz,height:sz,borderRadius:"50%",background:"#1e293b",display:"flex",alignItems:"center",justifyContent:"center"}}><p style={{fontSize:11,color:"#475569"}}>Sem dados</p></div>;
  const tot=slices.reduce((s,x)=>s+x.v,0);if(!tot)return null;
  let a=0;const paths=slices.map((sl,i)=>{const sw=sl.v/tot*2*Math.PI,x1=Math.cos(a)*0.85,y1=Math.sin(a)*0.85,x2=Math.cos(a+sw)*0.85,y2=Math.sin(a+sw)*0.85,lg=sw>Math.PI?1:0;const p=<path key={i} d={`M${x1} ${y1}A0.85 0.85 0 ${lg} 1 ${x2} ${y2}L0 0Z`} fill={sl.c} stroke="#0f172a" strokeWidth="0.03"/>;a+=sw;return p;});
  return<div style={{position:"relative",width:sz,height:sz}}>
    <svg viewBox="-1 -1 2 2" style={{width:sz,height:sz,transform:"rotate(-90deg)"}}>{paths}</svg>
    <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}>
      {label&&<p style={{fontSize:11,fontWeight:700,color:"#e2e8f0",fontFamily:"monospace",textAlign:"center",lineHeight:1.2,padding:"0 8px"}}>{label}</p>}
      {sub&&<p style={{fontSize:9,color:"#94a3b8",marginTop:1,textAlign:"center"}}>{sub}</p>}
    </div>
  </div>;
}

// ── Gauge ─────────────────────────────────────────────────────────────────────
function Gauge({pct=0,label,sub,sz=130}){
  const cp=Math.min(pct,1),a=cp*Math.PI,r=0.75;
  const ex=Math.cos(Math.PI-a)*r,ey=-Math.sin(Math.PI-a)*r;
  const gc=pct>0.85?"#ef4444":pct>0.6?"#f59e0b":"#34d399";
  return<div style={{position:"relative",width:sz,height:sz*0.6}}>
    <svg viewBox="-1.1 -1 2.2 1.1" style={{width:sz,height:sz*0.6}}>
      <path d={`M${-r} 0A${r} ${r} 0 0 1 ${r} 0`} fill="none" stroke="#1e293b" strokeWidth="0.22" strokeLinecap="round"/>
      {cp>0&&<path d={`M${-r} 0A${r} ${r} 0 ${a>Math.PI/2?1:0} 1 ${ex} ${ey}`} fill="none" stroke={gc} strokeWidth="0.22" strokeLinecap="round"/>}
    </svg>
    <div style={{position:"absolute",bottom:0,left:0,right:0,textAlign:"center"}}>
      {label&&<p style={{fontSize:13,fontWeight:700,color:gc,fontFamily:"monospace"}}>{label}</p>}
      {sub&&<p style={{fontSize:9,color:"#64748b",marginTop:1}}>{sub}</p>}
    </div>
  </div>;
}

// ── CSS ───────────────────────────────────────────────────────────────────────
const CSS=`
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=DM+Mono:wght@400;500&display=swap');
*{box-sizing:border-box;margin:0;padding:0}html,body{background:#0f172a}
input,select,textarea{font-family:inherit;outline:none;color:#e2e8f0}button{cursor:pointer;font-family:inherit}
::-webkit-scrollbar{width:4px}::-webkit-scrollbar-track{background:#1e293b}::-webkit-scrollbar-thumb{background:#334155;border-radius:4px}
.si{animation:si .2s ease}@keyframes si{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
.card{background:#1e293b;border-radius:14px;padding:14px}
.fi{background:#0f172a;border:1.5px solid #334155;border-radius:10px;padding:9px 12px;font-size:13px;width:100%;transition:border-color .2s}.fi:focus{border-color:#38bdf8}
.seg{display:flex;background:#0f172a;border-radius:9px;padding:3px;gap:3px}
.st{flex:1;padding:7px 4px;border:none;border-radius:7px;font-size:11px;font-weight:600;transition:all .2s;background:transparent;color:#64748b;white-space:nowrap}
.st.on{background:#1e293b;color:#e2e8f0}
.tb{flex:1;padding:8px;border:none;border-radius:8px;font-size:13px;font-weight:600;transition:all .2s}
.tb.r.on{background:#064e3b;color:#34d399}.tb.d.on{background:#450a0a;color:#f87171}.tb:not(.on){background:transparent;color:#64748b}
.cg{display:grid;grid-template-columns:repeat(4,1fr);gap:6px}
.cb{background:#0f172a;border:1.5px solid #334155;border-radius:9px;padding:7px 2px;display:flex;flex-direction:column;align-items:center;gap:2px;font-size:9px;color:#94a3b8;transition:all .2s}
.cb.on{border-color:#38bdf8;color:#38bdf8;background:#0c1e2e}
.pb{height:5px;background:#0f172a;border-radius:99px;overflow:hidden}.pf{height:100%;border-radius:99px;transition:width .4s}
.nb{background:none;border:none;color:#64748b;font-size:9px;font-weight:500;display:flex;flex-direction:column;align-items:center;gap:1px;padding:4px;transition:color .2s;flex:1}
.nb.on{color:#38bdf8}.nb svg{width:18px;height:18px}
.ab{padding:4px 8px;border:none;border-radius:6px;font-size:11px;font-weight:600;cursor:pointer}
.cdot{width:19px;height:19px;border-radius:50%;border:2px solid transparent;cursor:pointer;flex-shrink:0}
.cdot.on{border-color:#fff;transform:scale(1.2)}
.bdg{display:inline-flex;align-items:center;padding:1px 5px;border-radius:99px;font-size:9px;font-weight:700}
.tog{width:40px;height:22px;border-radius:99px;border:none;position:relative;transition:background .2s;cursor:pointer;flex-shrink:0}
.tog::after{content:'';position:absolute;top:2px;width:18px;height:18px;border-radius:50%;background:#fff;transition:left .2s}
.tog.on{background:#38bdf8}.tog.off{background:#334155}
.tog.on::after{left:20px}.tog.off::after{left:2px}
.vc{border-radius:16px;padding:15px;position:relative;overflow:hidden}
.fc{border-left:3px solid #7dd3fc;opacity:.72}
select option{background:#1e293b;color:#e2e8f0}
`;

// ── Recurring helpers ─────────────────────────────────────────────────────────
function autoOccs(tpl,done){
  const now=new Date();const res=[];let cur=tpl.startDate;let g=0;
  while(g++<1200){const adj=adjBiz(cur,tpl.bday||"ignore");const d=pd(adj);if(d>now)break;
    const key=`${tpl.id}__${cur}`;if(!done.has(key))res.push({key,date:adj,orig:cur});
    const nx=addF(cur,tpl.freq);if(!nx||nx===cur)break;cur=nx;}
  return res;
}
function recInMonth(tpl,m,y){
  const ms=new Date(y,m,1),me=new Date(y,m+1,0);const res=[];let cur=tpl.startDate;let g=0;
  while(g++<1200){const adj=adjBiz(cur,tpl.bday||"ignore");const d=pd(adj);if(d>me)break;
    if(d>=ms)res.push({date:adj,orig:cur});const nx=addF(cur,tpl.freq);if(!nx||nx===cur)break;cur=nx;}
  return res;
}
function instInMonth(inst,m,y){
  const res=[];
  for(let i=0;i<inst.icount;i++){const d=pd(inst.startDate);d.setMonth(d.getMonth()+i);const raw=d.toISOString().split("T")[0];const adj=adjBiz(raw,inst.bday||"ignore");const dd=pd(adj);
    if(dd.getMonth()===m&&dd.getFullYear()===y)res.push({date:adj,orig:raw,idx:i+1,amt:inst.tamt/inst.icount});}
  return res;
}

// ═════════════════════════════════════════════════════════════════════════════
export default function App() {
  const handleUnlock = () => {
  if (!savedPin) {
    if (!pinInput || pinInput.length < 4) {
      alert("PIN deve ter pelo menos 4 dígitos");
      return;
    }

    localStorage.setItem("app_pin", pinInput);
    setSavedPin(pinInput);
    setLocked(false);
  } else if (pinInput === savedPin) {
    setLocked(false);
  } else {
    alert("PIN incorreto");
    setPinInput("");
  }
};
  // 🔐 ADICIONE AQUI
  const [locked, setLocked] = useState(true);
  const [pinInput, setPinInput] = useState("");
  const [savedPin, setSavedPin] = useState(() => localStorage.getItem("app_pin") || "");

  const [tx,   setTx]  =useState(()=>LS.g("wt",[]));
  const [rec,  setRec] =useState(()=>LS.g("wr",[]));
  const [inst, setInst]=useState(()=>LS.g("wi",[]));
  const [bnks, setBnks]=useState(()=>LS.g("wb",[]));
  const [crds, setCrds]=useState(()=>LS.g("wc",[]));
  const [budg, setBudg]=useState(()=>LS.g("wbd",{}));
  const [ccat, setCcat]=useState(()=>LS.g("wcc",{receita:[],despesa:[]}));
  const [view, setView]=useState("home");
  const [filt, setFilt]=useState({m:new Date().getMonth(),y:new Date().getFullYear()});
  const [form, setForm]=useState(mf);
  const [eid,  setEid] =useState(null);
  const [bf,   setBf]  =useState(EB);
  const [cf,   setCf]  =useState(EC);
  const [catF, setCatF]=useState({label:"",icon:"🎯",type:"despesa"});
  const [ebid, setEbid]=useState(null);
  const [ecid, setEcid]=useState(null);
  const [atab, setAtab]=useState("banks");
  const [bi,   setBi]  =useState({});
  const [selC, setSelC]=useState(null);
  const [mdl,  setMdl] =useState(null);
  const [tst,  setTst] =useState(null);
  const [rtab, setRtab]=useState("rec");
  const [epk,  setEpk] =useState(false);

  useEffect(()=>{LS.s("wt",tx);},[tx]);
  useEffect(()=>{LS.s("wr",rec);},[rec]);
  useEffect(()=>{LS.s("wi",inst);},[inst]);
  useEffect(()=>{LS.s("wb",bnks);},[bnks]);
  useEffect(()=>{LS.s("wc",crds);},[crds]);
  useEffect(()=>{LS.s("wbd",budg);},[budg]);
  useEffect(()=>{LS.s("wcc",ccat);},[ccat]);

  // 🔐 AQUI
useEffect(() => {
  const handleBlur = () => setLocked(true);

  window.addEventListener("blur", handleBlur);

  return () => window.removeEventListener("blur", handleBlur);
}, []);

  const toast$=(msg,col="#22c55e")=>{setTst({msg,col});setTimeout(()=>setTst(null),2600);};

  const cats=useMemo(()=>({
    receita:[...DC.receita,...(ccat.receita||[]).map(c=>({...c,id:c.id,l:c.label,i:c.icon}))],
    despesa:[...DC.despesa,...(ccat.despesa||[]).map(c=>({...c,id:c.id,l:c.label,i:c.icon}))]
  }),[ccat]);
  const getCat=useCallback(id=>{for(const list of Object.values(cats)){const f=list.find(c=>c.id===id);if(f)return f;}return{l:id,i:"•"};},[cats]);

  useEffect(()=>{
    if(!rec.length)return;
    const done=new Set(tx.filter(t=>t.rk).map(t=>t.rk));
    const add=[];
    for(const tpl of rec){
      if(!tpl.freq||tpl.freq==="none")continue;
      for(const o of autoOccs(tpl,done))
        add.push({id:`r_${tpl.id}_${o.orig}`,rk:o.key,rid:tpl.id,type:tpl.type,amt:tpl.amt,desc:tpl.desc,cat:tpl.cat,date:o.date,note:tpl.note||"",atype:tpl.atype,aid:tpl.aid,auto:true});
    }
    if(add.length)setTx(p=>{const ex=new Set(p.map(t=>t.id));return[...p,...add.filter(t=>!ex.has(t.id))];});
  },[rec]);

  useEffect(()=>{
    if(!inst.length)return;
    const now=new Date();const add=[];
    for(const ins of inst){
      for(let i=0;i<ins.icount;i++){
        const d=pd(ins.startDate);d.setMonth(d.getMonth()+i);
        const raw=d.toISOString().split("T")[0];const adj=adjBiz(raw,ins.bday||"ignore");
        if(pd(adj)>now)continue;
        const iid=`i_${ins.id}_${i+1}`;
        if(!tx.find(t=>t.id===iid))
          add.push({id:iid,iid:ins.id,iidx:i+1,type:ins.type,amt:ins.tamt/ins.icount,desc:ins.desc,cat:ins.cat,date:adj,note:ins.note||"",atype:ins.atype,aid:ins.aid,auto:true});
      }
    }
    if(add.length)setTx(p=>{const ex=new Set(p.map(t=>t.id));return[...p,...add.filter(t=>!ex.has(t.id))];});
  },[inst]);

  const {m,y}=filt;
  const NOW=new Date();

  const confM=useMemo(()=>tx.filter(t=>{const d=pd(t.date);return d.getMonth()===m&&d.getFullYear()===y;}),[tx,m,y]);

  const fcasts=useMemo(()=>{
    const items=[];
    for(const tpl of rec){if(!tpl.freq||tpl.freq==="none")continue;
      for(const o of recInMonth(tpl,m,y)){const d=pd(o.date);if(d<=NOW)continue;
        if(!tx.find(t=>t.rk===`${tpl.id}__${o.orig}`))items.push({_fid:`fr_${tpl.id}_${o.orig}`,type:tpl.type,amt:tpl.amt,desc:tpl.desc,cat:tpl.cat,date:o.date,atype:tpl.atype,aid:tpl.aid,isRF:true});}}
    for(const ins of inst){
      for(const o of instInMonth(ins,m,y)){const d=pd(o.date);if(d<=NOW)continue;
        const iid=`i_${ins.id}_${o.idx}`;
        if(!tx.find(t=>t.id===iid))items.push({_fid:`fi_${ins.id}_${o.idx}`,type:ins.type,amt:o.amt,desc:ins.desc,cat:ins.cat,date:o.date,atype:ins.atype,aid:ins.aid,isIF:true,iidx:o.idx,icount:ins.icount,tamt:ins.tamt});}}
    return items.sort((a,b)=>pd(a.date)-pd(b.date));
  },[rec,inst,tx,m,y]);

  const allM=useMemo(()=>[...confM.map(t=>({...t,real:true})),...fcasts].sort((a,b)=>pd(b.date)-pd(a.date)),[confM,fcasts]);

  const totR=confM.filter(t=>t.type==="receita"&&!t.isTE).reduce((s,t)=>s+t.amt,0);
  const totD=confM.filter(t=>t.type==="despesa"&&!t.isTO).reduce((s,t)=>s+t.amt,0);
  const saldo=totR-totD;
  const fcR=fcasts.filter(f=>f.type==="receita").reduce((s,f)=>s+f.amt,0);
  const fcD=fcasts.filter(f=>f.type==="despesa").reduce((s,f)=>s+f.amt,0);
  const saldoP=(totR+fcR)-(totD+fcD);

  const catD=useMemo(()=>confM.filter(t=>t.type==="despesa"&&!t.isTO).reduce((a,t)=>{a[t.cat]=(a[t.cat]||0)+t.amt;return a;},{}),[confM]);
  const catDF=useMemo(()=>[...confM.filter(t=>t.type==="despesa"&&!t.isTO),...fcasts.filter(f=>f.type==="despesa")].reduce((a,t)=>{a[t.cat]=(a[t.cat]||0)+t.amt;return a;},{}),[confM,fcasts]);

  const bbal=b=>{const s=tx.filter(t=>t.atype==="bank"&&t.aid===b.id).reduce((s,t)=>s+(t.type==="receita"?t.amt:-t.amt),0);return(parseFloat(b.bal)||0)+s;};
  const tbb=bnks.reduce((s,b)=>s+bbal(b),0);
  const csp=cid=>confM.filter(t=>t.atype==="card"&&t.aid===cid&&t.type==="despesa").reduce((s,t)=>s+t.amt,0);

  const alab=t=>{
    if(t.atype==="bank"){const b=bnks.find(b=>b.id===t.aid);return b?`${b.icon} ${b.name}`:"";}
    if(t.atype==="card"){const c=crds.find(c=>c.id===t.aid);return c?`${c.icon} ${c.name}`:""; }
    return "";
  };

  const pM=()=>setFilt(f=>f.m===0?{m:11,y:f.y-1}:{m:f.m-1,y:f.y});
  const nM=()=>setFilt(f=>f.m===11?{m:0,y:f.y+1}:{m:f.m+1,y:f.y});

  const realPie=useMemo(()=>{
    const e=Object.entries(catD).filter(([,v])=>v>0);
    const sl=e.map(([id,v],i)=>({l:getCat(id).l,i:getCat(id).i,v,c:PCOLS[i%PCOLS.length]}));
    const used=e.reduce((s,[,v])=>s+v,0);
    if(totR>used)sl.push({l:"Saldo livre",v:totR-used,c:"#1e3a5f"});
    return sl;
  },[catD,totR,getCat]);

  const prevPie=useMemo(()=>{
    const e=Object.entries(catDF).filter(([,v])=>v>0);
    const sl=e.map(([id,v],i)=>({l:getCat(id).l,v,c:PCOLS[i%PCOLS.length]}));
    const used=e.reduce((s,[,v])=>s+v,0),tot=totR+fcR;
    if(tot>used)sl.push({l:"Saldo livre",v:tot-used,c:"#1e3a5f"});
    return sl;
  },[catDF,totR,fcR,getCat]);

  const riskP=(totR+fcR)>0?(totD+fcD)/(totR+fcR):0;
  const daysM=new Date(y,m+1,0).getDate();
  const dayN=m===NOW.getMonth()&&y===NOW.getFullYear()?NOW.getDate():daysM;

  const submit=()=>{
    if(form.isTransfer){
      const a=parseFloat(String(form.amt).replace(",","."));
      if(!a||a<=0){toast$("Valor inválido","#ef4444");return;}
      if(!form.aid||!form.toAid){toast$("Selecione as contas","#ef4444");return;}
      const adjD=adjBiz(form.date,form.bday);const tid=Date.now();
      const toLabel=form.toAtype==="bank"?bnks.find(b=>b.id==form.toAid)?.name||"destino":crds.find(c=>c.id==form.toAid)?.name||"destino";
      const frLabel=form.atype==="bank"?bnks.find(b=>b.id==form.aid)?.name||"origem":crds.find(c=>c.id==form.aid)?.name||"origem";
      setTx(p=>[{id:tid,type:"despesa",amt:a,desc:`↔ Para: ${toLabel}`,cat:"transf",date:adjD,note:form.note||"",atype:form.atype,aid:parseInt(form.aid)||form.aid,isTO:true,pair:tid+1},{id:tid+1,type:"receita",amt:a,desc:`↔ De: ${frLabel}`,cat:"transf",date:adjD,note:form.note||"",atype:form.toAtype,aid:parseInt(form.toAid)||form.toAid,isTE:true,pair:tid},...p]);
      toast$("Transferência registrada ✓");setForm(mf());setView("home");return;
    }
    const rawA=form.inst?parseFloat(String(form.tamt).replace(",",".")):parseFloat(String(form.amt).replace(",","."));
    if(!rawA||rawA<=0){toast$("Valor inválido","#ef4444");return;}
    if(!form.desc.trim()){toast$("Descrição obrigatória","#ef4444");return;}
    if(form.inst){
      const ic=parseInt(form.icount)||2;
      setInst(p=>[...p,{id:Date.now(),type:form.type,tamt:rawA,desc:form.desc,cat:form.cat,startDate:form.date,note:form.note||"",atype:form.atype,aid:parseInt(form.aid)||form.aid,icount:ic,bday:form.bday}]);
      toast$(`Parcelado em ${ic}x de ${fmt(rawA/ic)} ✓`);setForm(mf());setView("home");return;
    }
    if(form.freq!=="none"){
      const tpl={id:eid||Date.now(),type:form.type,amt:rawA,desc:form.desc,cat:form.cat,startDate:form.date,note:form.note||"",atype:form.atype,aid:parseInt(form.aid)||form.aid,freq:form.freq,bday:form.bday};
      if(eid){setRec(p=>p.map(r=>r.id===eid?tpl:r));setEid(null);}else setRec(p=>[...p,tpl]);
      toast$("Recorrência salva ✓");setForm(mf());setView("home");return;
    }
    const adjD=adjBiz(form.date,form.bday);
    if(eid){setTx(p=>p.map(t=>t.id===eid?{...t,type:form.type,amt:rawA,desc:form.desc,cat:form.cat,date:adjD,note:form.note||"",atype:form.atype,aid:parseInt(form.aid)||form.aid}:t));setEid(null);toast$("Atualizado ✓");}
    else{setTx(p=>[{id:Date.now(),type:form.type,amt:rawA,desc:form.desc,cat:form.cat,date:adjD,note:form.note||"",atype:form.atype,aid:parseInt(form.aid)||form.aid},...p]);toast$(form.type==="receita"?"Receita adicionada ✓":"Despesa adicionada ✓");}
    setForm(mf());setView("home");
  };

  const startE=t=>{setEid(t.id);setForm({...mf(),type:t.type,amt:String(t.amt),desc:t.desc,cat:t.cat,date:t.date,note:t.note||"",atype:t.atype||"bank",aid:t.aid||""});setView("add");};
  const dTx=id=>{setTx(p=>p.filter(t=>t.id!==id));toast$("Removido","#f97316");};
  const dRec=id=>{setRec(p=>p.filter(r=>r.id!==id));setTx(p=>p.filter(t=>t.rid!==id));toast$("Removida","#f97316");};
  const dInst=id=>{setInst(p=>p.filter(i=>i.id!==id));setTx(p=>p.filter(t=>t.iid!==id));toast$("Removido","#f97316");};
  const sBank=()=>{const bal=parseFloat(String(bf.bal).replace(",","."));if(!bf.name.trim()){toast$("Nome obrigatório","#ef4444");return;}if(ebid){setBnks(p=>p.map(b=>b.id===ebid?{...b,...bf,bal:isNaN(bal)?0:bal}:b));setEbid(null);}else setBnks(p=>[...p,{id:Date.now(),...bf,bal:isNaN(bal)?0:bal}]);setBf(EB);toast$("Banco salvo ✓");};
  const sCard=()=>{const lim=parseFloat(String(cf.lim).replace(",","."));if(!cf.name.trim()){toast$("Nome obrigatório","#ef4444");return;}if(ecid){setCrds(p=>p.map(c=>c.id===ecid?{...c,...cf,lim:isNaN(lim)?0:lim}:c));setEcid(null);}else setCrds(p=>[...p,{id:Date.now(),...cf,lim:isNaN(lim)?0:lim}]);setCf(EC);toast$("Cartão salvo ✓");};
  const sCat=()=>{if(!catF.label.trim()){toast$("Nome obrigatório","#ef4444");return;}const nc={id:`c_${Date.now()}`,label:catF.label,icon:catF.icon,l:catF.label,i:catF.icon,custom:true};setCcat(p=>({...p,[catF.type]:[...(p[catF.type]||[]),nc]}));setCatF({label:"",icon:"🎯",type:"despesa"});toast$("Categoria criada ✓");};
  const dCat=(type,id)=>{setCcat(p=>({...p,[type]:(p[type]||[]).filter(c=>c.id!==id)}));toast$("Removida","#f97316");};
  const dBank=id=>{setBnks(p=>p.filter(b=>b.id!==id));toast$("Removido","#f97316");};
  const dCard=id=>{setCrds(p=>p.filter(c=>c.id!==id));toast$("Removido","#f97316");};

  const Hd=({back,title})=><div style={{display:"flex",alignItems:"center",gap:10}}>
    <button onClick={back} style={{background:"#1e293b",border:"none",color:"#94a3b8",width:32,height:32,borderRadius:9,fontSize:16}}>←</button>
    <h2 style={{fontSize:15,fontWeight:700}}>{title}</h2>
  </div>;

  const TxRow=({t,onE,onD})=>{const cat=getCat(t.cat);const isTr=t.isTO||t.isTE;const al=alab(t);return(
    <div className={`card ${t.real===false?"fc":""}`} style={{display:"flex",alignItems:"center",gap:9,padding:"10px 12px"}}>
      <div style={{width:35,height:35,borderRadius:9,background:isTr?"#1e3a5f":t.type==="receita"?"#064e3b":"#450a0a",display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,flexShrink:0}}>{isTr?"↔️":cat.i}</div>
      <div style={{flex:1,minWidth:0}}>
        <div style={{display:"flex",alignItems:"center",gap:4}}>
          <p style={{fontSize:12,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.desc}</p>
          {t.iidx&&<span className="bdg" style={{background:"#1e3a5f",color:"#7dd3fc",flexShrink:0}}>{t.iidx}/{t.icount}</span>}
          {t.auto&&t.rid&&<span className="bdg" style={{background:"#2d1a4f",color:"#c4b5fd",flexShrink:0}}>🔁</span>}
          {!t.real&&<span className="bdg" style={{background:"#0c2340",color:"#7dd3fc",flexShrink:0}}>🔮</span>}
        </div>
        <p style={{fontSize:10,color:"#64748b"}}>{pd(t.date).toLocaleDateString("pt-BR")}{al?` · ${al}`:""}</p>
      </div>
      <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:4,flexShrink:0}}>
        <span style={{fontWeight:700,fontSize:12,color:t.type==="receita"?"#34d399":"#f87171"}}>{t.type==="receita"?"+":"-"}{fmt(t.amt)}</span>
        {t.real&&!t.auto&&!isTr&&<div style={{display:"flex",gap:4}}>{onE&&<button onClick={()=>onE(t)} className="ab" style={{background:"#1e3a5f",color:"#38bdf8"}}>editar</button>}<button onClick={()=>onD(t.id)} className="ab" style={{background:"#450a0a",color:"#f87171"}}>×</button></div>}
        {t.real&&(t.auto||isTr)&&<button onClick={()=>onD(t.id)} className="ab" style={{background:"#450a0a",color:"#f87171"}}>×</button>}
      </div>
    </div>
  );};

  const BdayRow=()=><div>
    <p style={{fontSize:10,color:"#94a3b8",marginBottom:4,fontWeight:600}}>DIA ÚTIL</p>
    <div className="seg">{[{id:"ignore",l:"Ignorar"},{id:"next",l:"Próx. útil"},{id:"prev",l:"Útil ant."}].map(o=><button key={o.id} className={`st ${form.bday===o.id?"on":""}`} onClick={()=>setForm(f=>({...f,bday:o.id}))}>{o.l}</button>)}</div>
  </div>;

  const AccPicker=({label,atKey,aidKey})=><div>
    <p style={{fontSize:10,color:"#94a3b8",marginBottom:5,fontWeight:600}}>{label}</p>
    <div className="seg" style={{marginBottom:7}}>
      {bnks.length>0&&<button className={`st ${form[atKey]==="bank"?"on":""}`} onClick={()=>setForm(f=>({...f,[atKey]:"bank",[aidKey]:bnks[0]?.id||""}))}>🏦 Banco</button>}
      {crds.length>0&&<button className={`st ${form[atKey]==="card"?"on":""}`} onClick={()=>setForm(f=>({...f,[atKey]:"card",[aidKey]:crds[0]?.id||""}))}>💳 Cartão</button>}
    </div>
    {form[atKey]==="bank"&&<select className="fi" value={form[aidKey]} onChange={e=>setForm(f=>({...f,[aidKey]:parseInt(e.target.value)}))}>{bnks.map(b=><option key={b.id} value={b.id}>{b.icon} {b.name}{label==="CONTA ORIGEM"?` (${fmt(bbal(b))})`:""}</option>)}</select>}
    {form[atKey]==="card"&&<select className="fi" value={form[aidKey]} onChange={e=>setForm(f=>({...f,[aidKey]:parseInt(e.target.value)}))}>{crds.map(c=><option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}</select>}
  </div>;
if (locked) {
  return (
    <form style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100vh',
      flexDirection: 'column',
      background: '#0f172a',
      color: '#e2e8f0'
    }}>
      <h2 style={{marginBottom: 10}}>
        {savedPin ? "🔒 Digite seu PIN" : "🔐 Crie um PIN"}
      </h2>

      <input
        type="password"
  value={pinInput}
  onChange={(e) => setPinInput(e.target.value)}
  placeholder="••••"
        style={{
          padding: 10,
          fontSize: 18,
          textAlign: 'center',
          borderRadius: 8,
          border: '1px solid #334155',
          background: '#1e293b',
          color: '#fff'
        }}
      />

      <button
        onClick={handleUnlock}
        style={{
          marginTop: 10,
          padding: 10,
          borderRadius: 8,
          background: '#38bdf8',
          border: 'none',
          color: '#fff',
          fontWeight: 'bold'
        }}
      >
        {savedPin ? "Entrar" : "Salvar PIN"}
      </button>
    </form>
  );
}
  return(
    <div style={{background:"#0f172a",minHeight:"100vh",fontFamily:"'DM Sans',system-ui,sans-serif",color:"#e2e8f0",maxWidth:480,margin:"0 auto",paddingBottom:80}}>
      <style>{CSS}</style>

      {tst&&<div style={{position:"fixed",top:13,left:"50%",transform:"translateX(-50%)",background:tst.col,color:"#fff",padding:"7px 16px",borderRadius:99,fontSize:12,fontWeight:600,zIndex:999,whiteSpace:"nowrap",boxShadow:"0 4px 20px rgba(0,0,0,.5)"}}>{tst.msg}</div>}

      {mdl&&<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.75)",zIndex:998,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
        <div className="card si" style={{width:"100%",maxWidth:320}}>
          <p style={{fontSize:14,fontWeight:700,marginBottom:5}}>{mdl.title}</p>
          {mdl.body&&<p style={{fontSize:12,color:"#94a3b8",marginBottom:18}}>{mdl.body}</p>}
          <div style={{display:"flex",gap:9,marginTop:mdl.body?0:16}}>
            <button onClick={()=>setMdl(null)} style={{flex:1,padding:10,background:"#334155",border:"none",borderRadius:9,color:"#e2e8f0",fontWeight:600}}>Cancelar</button>
            <button onClick={()=>{mdl.action();setMdl(null);}} style={{flex:1,padding:10,background:mdl.danger?"#ef4444":"linear-gradient(135deg,#38bdf8,#818cf8)",border:"none",borderRadius:9,color:"#fff",fontWeight:600}}>{mdl.btn||"OK"}</button>
          </div>
        </div>
      </div>}

      <div style={{padding:"15px 18px 0",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <span style={{fontSize:12,color:"#64748b",fontWeight:600}}>💰 Minha Carteira</span>
        <div style={{display:"flex",alignItems:"center",gap:7}}>
          <button onClick={pM} style={{background:"#1e293b",border:"none",color:"#94a3b8",width:26,height:26,borderRadius:7,fontSize:14}}>‹</button>
          <span style={{fontSize:12,fontWeight:700,color:"#e2e8f0",minWidth:76,textAlign:"center"}}>{MS[m]} {y}</span>
          <button onClick={nM} style={{background:"#1e293b",border:"none",color:"#94a3b8",width:26,height:26,borderRadius:7,fontSize:14}}>›</button>
        </div>
      </div>

      {/* ══ HOME ══ */}
      {view==="home"&&<div className="si" style={{padding:"12px 18px",display:"flex",flexDirection:"column",gap:12}}>
        <div style={{background:"linear-gradient(135deg,#1e3a5f,#1e293b)",borderRadius:18,padding:16,border:"1px solid #2d4a6b"}}>
          <div style={{display:"flex",gap:14,flexWrap:"wrap",alignItems:"flex-end"}}>
            <div><p style={{fontSize:10,color:"#94a3b8",fontWeight:600}}>SALDO REAL</p><p style={{fontSize:28,fontWeight:700,color:saldo>=0?"#34d399":"#f87171",fontFamily:"'DM Mono',monospace",letterSpacing:-1}}>{fmt(saldo)}</p></div>
            {fcasts.length>0&&<><div style={{width:1,background:"#334155",alignSelf:"stretch"}}/>
            <div><p style={{fontSize:10,color:"#94a3b8",fontWeight:600}}>PREVISTO</p><p style={{fontSize:18,fontWeight:700,color:saldoP>=0?"#7dd3fc":"#fca5a5",fontFamily:"'DM Mono',monospace"}}>{fmt(saldoP)}</p></div></>}
          </div>
          <div style={{display:"flex",gap:12,marginTop:10,flexWrap:"wrap"}}>
            <div><p style={{fontSize:9,color:"#94a3b8"}}>↑ Receitas</p><p style={{fontSize:12,fontWeight:600,color:"#34d399"}}>{fmt(totR)}</p></div>
            <div><p style={{fontSize:9,color:"#94a3b8"}}>↓ Despesas</p><p style={{fontSize:12,fontWeight:600,color:"#f87171"}}>{fmt(totD)}</p></div>
            {tbb>0&&<div><p style={{fontSize:9,color:"#94a3b8"}}>🏦 Bancos</p><p style={{fontSize:12,fontWeight:600,color:"#38bdf8"}}>{fmt(tbb)}</p></div>}
          </div>
        </div>

        {bnks.length>0&&<div>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:7}}>
            <p style={{fontSize:10,fontWeight:700,color:"#94a3b8",textTransform:"uppercase",letterSpacing:.5}}>Contas</p>
            <button onClick={()=>{setView("accounts");setAtab("banks");}} style={{background:"none",border:"none",color:"#38bdf8",fontSize:11}}>gerenciar</button>
          </div>
          <div style={{display:"flex",gap:9,overflowX:"auto",paddingBottom:3}}>
            {bnks.map(b=>{const bal=bbal(b);return<div key={b.id} style={{background:b.color+"22",border:`1px solid ${b.color}44`,borderRadius:12,padding:"9px 12px",minWidth:125,flexShrink:0}}>
              <p style={{fontSize:16}}>{b.icon}</p><p style={{fontSize:11,fontWeight:600,marginTop:3,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:105}}>{b.name}</p>
              <p style={{fontSize:13,fontWeight:700,color:bal>=0?"#34d399":"#f87171",fontFamily:"'DM Mono',monospace",marginTop:2}}>{fmt(bal)}</p>
            </div>;})}
          </div>
        </div>}

        {crds.length>0&&<div>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:7}}>
            <p style={{fontSize:10,fontWeight:700,color:"#94a3b8",textTransform:"uppercase",letterSpacing:.5}}>Cartões</p>
            <button onClick={()=>{setView("accounts");setAtab("cards");}} style={{background:"none",border:"none",color:"#38bdf8",fontSize:11}}>gerenciar</button>
          </div>
          <div style={{display:"flex",gap:9,overflowX:"auto",paddingBottom:3}}>
            {crds.map(c=>{const sp=csp(c.id),lim=parseFloat(c.lim)||0,pct=lim>0?Math.min((sp/lim)*100,100):0,ov=lim>0&&sp>lim;
              return<div key={c.id} onClick={()=>{setSelC(c);setView("card");}} style={{background:c.color+"33",border:`1px solid ${c.color}55`,borderRadius:12,padding:"9px 12px",minWidth:145,flexShrink:0,cursor:"pointer"}}>
                <p style={{fontSize:16}}>{c.icon}</p><p style={{fontSize:11,fontWeight:600,marginTop:3,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:120}}>{c.name}</p>
                <p style={{fontSize:12,fontWeight:700,color:ov?"#f87171":"#e2e8f0",fontFamily:"'DM Mono',monospace",marginTop:2}}>{fmt(sp)}{lim>0?` / ${fmt(lim)}`:""}</p>
                {lim>0&&<div className="pb" style={{marginTop:4}}><div className="pf" style={{width:`${pct}%`,background:ov?"#ef4444":c.color}}/></div>}
                <p style={{fontSize:9,color:"#64748b",marginTop:3}}>Vence dia {c.due}</p>
              </div>;})}
          </div>
        </div>}

        <button onClick={()=>{setEid(null);setForm({...mf(),atype:bnks.length>0?"bank":"card",aid:bnks[0]?.id||crds[0]?.id||""});setView("add");}}
          style={{background:"linear-gradient(135deg,#38bdf8,#818cf8)",color:"#fff",border:"none",borderRadius:11,padding:12,fontSize:14,fontWeight:700,width:"100%"}}>
          + Adicionar Lançamento
        </button>

        {Object.keys(catD).length>0&&<div className="card">
          <p style={{fontSize:10,fontWeight:700,color:"#94a3b8",marginBottom:10,textTransform:"uppercase",letterSpacing:.5}}>Por Categoria</p>
          {Object.entries(catD).sort((a,b)=>b[1]-a[1]).map(([cid,val])=>{const cat=getCat(cid),pct=totD>0?(val/totD)*100:0,bg=budg[cid],ov=bg&&val>bg;return<div key={cid} style={{marginBottom:9}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:3}}>
              <span style={{fontSize:12,display:"flex",alignItems:"center",gap:4}}>{cat.i} {cat.l}{ov&&<span className="bdg" style={{background:"#450a0a",color:"#f87171"}}>acima</span>}</span>
              <span style={{fontSize:12,fontWeight:600,color:ov?"#f87171":"#e2e8f0"}}>{fmt(val)}</span>
            </div>
            <div className="pb"><div className="pf" style={{width:`${Math.min(pct,100)}%`,background:ov?"#ef4444":"linear-gradient(90deg,#38bdf8,#818cf8)"}}/></div>
            {bg&&<p style={{fontSize:9,color:"#64748b",marginTop:1}}>Meta: {fmt(bg)}</p>}
          </div>;})}
        </div>}

        {fcasts.length>0&&<div className="card" style={{borderLeft:"3px solid #38bdf8"}}>
          <p style={{fontSize:10,fontWeight:700,color:"#7dd3fc",marginBottom:9}}>🔮 Previsões — {fcasts.length} lançamento{fcasts.length!==1?"s":""}</p>
          {fcasts.slice(0,3).map((fc,i)=>{const cat=getCat(fc.cat);return<div key={i} style={{display:"flex",alignItems:"center",gap:9,padding:"5px 0",borderBottom:i<Math.min(fcasts.length,3)-1?"1px solid #0f172a":"none"}}>
            <span style={{fontSize:15}}>{cat.i}</span>
            <div style={{flex:1,minWidth:0}}><p style={{fontSize:11,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{fc.desc}</p><p style={{fontSize:9,color:"#64748b"}}>{pd(fc.date).toLocaleDateString("pt-BR")}{fc.isIF?` · ${fc.iidx}/${fc.icount}`:""}</p></div>
            <span style={{fontSize:11,fontWeight:700,color:fc.type==="receita"?"#34d399":"#f87171",flexShrink:0}}>{fc.type==="receita"?"+":"-"}{fmt(fc.amt)}</span>
          </div>;})}
          {fcasts.length>3&&<button onClick={()=>setView("hist")} style={{background:"none",border:"none",color:"#38bdf8",fontSize:11,marginTop:5}}>ver todos ({fcasts.length})</button>}
        </div>}

        {confM.length>0&&<div className="card">
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:9}}>
            <p style={{fontSize:10,fontWeight:700,color:"#94a3b8",textTransform:"uppercase",letterSpacing:.5}}>Recentes</p>
            <button onClick={()=>setView("hist")} style={{background:"none",border:"none",color:"#38bdf8",fontSize:11}}>ver todos</button>
          </div>
          {[...confM].sort((a,b)=>pd(b.date)-pd(a.date)).slice(0,4).map(t=>{const cat=getCat(t.cat);const isTr=t.isTO||t.isTE;const al=alab(t);return<div key={t.id} style={{display:"flex",alignItems:"center",gap:9,padding:"6px 0",borderBottom:"1px solid #0f172a"}}>
            <div style={{width:30,height:30,borderRadius:8,background:isTr?"#1e3a5f":t.type==="receita"?"#064e3b":"#450a0a",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,flexShrink:0}}>{isTr?"↔️":cat.i}</div>
            <div style={{flex:1,minWidth:0}}><p style={{fontSize:11,fontWeight:500,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.desc}</p><p style={{fontSize:9,color:"#64748b"}}>{pd(t.date).toLocaleDateString("pt-BR")}{al?` · ${al}`:""}</p></div>
            <span style={{fontWeight:700,fontSize:11,color:t.type==="receita"?"#34d399":"#f87171",flexShrink:0}}>{t.type==="receita"?"+":"-"}{fmt(t.amt)}</span>
          </div>;})}
        </div>}

        {!tx.length&&!bnks.length&&<div style={{textAlign:"center",padding:"28px 0",color:"#475569"}}>
          <p style={{fontSize:32,marginBottom:9}}>📊</p>
          <p style={{fontSize:13,fontWeight:600}}>Bem-vindo à sua carteira!</p>
          <p style={{fontSize:11,marginTop:3,marginBottom:14}}>Comece adicionando um banco ou cartão</p>
          <button onClick={()=>setView("accounts")} style={{background:"linear-gradient(135deg,#38bdf8,#818cf8)",border:"none",color:"#fff",borderRadius:11,padding:"10px 20px",fontWeight:600,fontSize:13}}>Adicionar Conta</button>
        </div>}
      </div>}

      {/* ══ DASHS ══ */}
      {view==="dashs"&&<div className="si" style={{padding:"12px 18px",display:"flex",flexDirection:"column",gap:12}}>
        <h2 style={{fontSize:15,fontWeight:700}}>📊 Dashboards</h2>
        <div className="card">
          <p style={{fontSize:10,fontWeight:700,color:"#94a3b8",textTransform:"uppercase",letterSpacing:.5,marginBottom:11}}>Saúde Hoje — Dia {dayN}/{daysM}</p>
          <div style={{display:"flex",gap:14,flexWrap:"wrap",justifyContent:"space-around",alignItems:"center"}}>
            <Gauge pct={totD/(totR||1)} label={`${Math.round((totD/(totR||1))*100)}%`} sub="da receita gasta" sz={125}/>
            <div style={{display:"flex",flexDirection:"column",gap:7,minWidth:130}}>
              {[["Receita",fmt(totR),"#34d399"],["Despesas",fmt(totD),"#f87171"],["Saldo",fmt(saldo),saldo>=0?"#34d399":"#f87171"]].map(([l,v,c])=>
                <div key={l} style={{background:"#0f172a",borderRadius:9,padding:"7px 11px"}}><p style={{fontSize:9,color:"#94a3b8"}}>{l}</p><p style={{fontSize:13,fontWeight:700,color:c,fontFamily:"monospace"}}>{v}</p></div>
              )}
            </div>
          </div>
        </div>
        <div className="card" style={{borderLeft:`3px solid ${riskP>0.85?"#ef4444":riskP>0.6?"#f59e0b":"#34d399"}`}}>
          <p style={{fontSize:10,fontWeight:700,color:"#94a3b8",textTransform:"uppercase",letterSpacing:.5,marginBottom:11}}>Risco até fim do mês</p>
          <div style={{display:"flex",gap:14,flexWrap:"wrap",justifyContent:"space-around",alignItems:"center"}}>
            <div style={{textAlign:"center"}}>
              <Gauge pct={riskP} label={`${Math.round(riskP*100)}%`} sub="despesas / receita" sz={125}/>
              <p style={{fontSize:10,fontWeight:600,marginTop:3,color:riskP>0.85?"#ef4444":riskP>0.6?"#f59e0b":"#34d399"}}>{riskP>0.85?"⚠️ Risco alto":riskP>0.6?"⚡ Atenção":"✅ Sob controle"}</p>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:7,minWidth:130}}>
              {[["Desp. previstas",fmt(totD+fcD),"#f87171"],["Rec. prevista",fmt(totR+fcR),"#34d399"],["Sobra prev.",fmt(saldoP),saldoP>=0?"#34d399":"#f87171"]].map(([l,v,c])=>
                <div key={l} style={{background:"#0f172a",borderRadius:9,padding:"7px 11px"}}><p style={{fontSize:9,color:"#94a3b8"}}>{l}</p><p style={{fontSize:13,fontWeight:700,color:c,fontFamily:"monospace"}}>{v}</p></div>
              )}
            </div>
          </div>
        </div>
        <div className="card">
          <p style={{fontSize:10,fontWeight:700,color:"#94a3b8",textTransform:"uppercase",letterSpacing:.5,marginBottom:11}}>Consumo real da receita</p>
          {totR===0?<p style={{fontSize:12,color:"#475569",textAlign:"center",padding:"14px 0"}}>Nenhuma receita confirmada</p>:
          <div style={{display:"flex",gap:14,alignItems:"center",flexWrap:"wrap",justifyContent:"center"}}>
            <Pie slices={realPie} sz={150} label={fmt(saldo)} sub="saldo livre"/>
            <div style={{display:"flex",flexDirection:"column",gap:4,flex:1,minWidth:120}}>
              {realPie.map((sl,i)=><div key={i} style={{display:"flex",alignItems:"center",gap:5}}>
                <div style={{width:9,height:9,borderRadius:2,background:sl.c,flexShrink:0}}/>
                <p style={{fontSize:10,color:"#94a3b8",flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{sl.i||""} {sl.l}</p>
                <p style={{fontSize:10,fontWeight:600,color:"#e2e8f0",flexShrink:0}}>{totR>0?Math.round((sl.v/totR)*100):0}%</p>
              </div>)}
            </div>
          </div>}
        </div>
        <div className="card" style={{borderLeft:"3px solid #7dd3fc"}}>
          <p style={{fontSize:10,fontWeight:700,color:"#94a3b8",textTransform:"uppercase",letterSpacing:.5,marginBottom:11}}>🔮 Consumo previsto da receita</p>
          {(totR+fcR)===0?<p style={{fontSize:12,color:"#475569",textAlign:"center",padding:"14px 0"}}>Sem dados previstos</p>:
          <div style={{display:"flex",gap:14,alignItems:"center",flexWrap:"wrap",justifyContent:"center"}}>
            <Pie slices={prevPie} sz={150} label={fmt(saldoP)} sub="sobra prevista"/>
            <div style={{display:"flex",flexDirection:"column",gap:4,flex:1,minWidth:120}}>
              {prevPie.map((sl,i)=>{const tot=totR+fcR;return<div key={i} style={{display:"flex",alignItems:"center",gap:5}}>
                <div style={{width:9,height:9,borderRadius:2,background:sl.c,flexShrink:0}}/>
                <p style={{fontSize:10,color:"#94a3b8",flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{sl.l}</p>
                <p style={{fontSize:10,fontWeight:600,color:"#e2e8f0",flexShrink:0}}>{tot>0?Math.round((sl.v/tot)*100):0}%</p>
              </div>;})}
            </div>
          </div>}
        </div>
        {Object.keys(catDF).length>0&&<div className="card">
          <p style={{fontSize:10,fontWeight:700,color:"#94a3b8",textTransform:"uppercase",letterSpacing:.5,marginBottom:11}}>Despesas por Categoria</p>
          {Object.entries(catDF).sort((a,b)=>b[1]-a[1]).map(([cid,val],i)=>{
            const cat=getCat(cid),rv=catD[cid]||0,bg=budg[cid],ov=bg&&val>bg,mx=Math.max(...Object.values(catDF));
            return<div key={cid} style={{marginBottom:9}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:3}}>
                <span style={{fontSize:11,display:"flex",alignItems:"center",gap:4}}>{cat.i} {cat.l}{ov&&<span className="bdg" style={{background:"#450a0a",color:"#f87171"}}>acima</span>}</span>
                <div style={{textAlign:"right"}}><span style={{fontSize:11,fontWeight:600}}>{fmt(rv)}</span>{val>rv&&<span style={{fontSize:9,color:"#7dd3fc",marginLeft:3}}>+{fmt(val-rv)}</span>}</div>
              </div>
              <div style={{height:7,background:"#0f172a",borderRadius:99,overflow:"hidden",position:"relative"}}>
                <div style={{position:"absolute",top:0,left:0,height:"100%",width:`${(rv/mx)*100}%`,background:ov?"#ef4444":PCOLS[i%PCOLS.length],borderRadius:99}}/>
                {val>rv&&<div style={{position:"absolute",top:0,left:`${(rv/mx)*100}%`,height:"100%",width:`${((val-rv)/mx)*100}%`,background:"#7dd3fc33",borderRadius:99}}/>}
              </div>
              {bg&&<p style={{fontSize:9,color:"#64748b",marginTop:1}}>Meta: {fmt(bg)}</p>}
            </div>;
          })}
        </div>}
      </div>}

      {/* ══ ADD ══ */}
      {view==="add"&&<div className="si" style={{padding:"12px 18px",display:"flex",flexDirection:"column",gap:11}}>
        <Hd back={()=>{setView("home");setEid(null);}} title={eid?"Editar":"Novo Lançamento"}/>
        {!eid&&<div style={{display:"flex",alignItems:"center",justifyContent:"space-between",background:"#1e293b",borderRadius:10,padding:"9px 12px"}}>
          <div><p style={{fontSize:12,fontWeight:600}}>↔️ Transferência entre contas</p><p style={{fontSize:10,color:"#64748b"}}>Mover saldo de uma conta para outra</p></div>
          <button className={`tog ${form.isTransfer?"on":"off"}`} onClick={()=>setForm(f=>({...f,isTransfer:!f.isTransfer,inst:false,freq:"none"}))}/>
        </div>}
        {form.isTransfer?<>
          <div><p style={{fontSize:10,color:"#94a3b8",marginBottom:4,fontWeight:600}}>VALOR (R$)</p>
            <input className="fi" type="number" inputMode="decimal" placeholder="0,00" value={form.amt} onChange={e=>setForm(f=>({...f,amt:e.target.value}))} style={{fontSize:22,fontWeight:700,fontFamily:"monospace",color:"#38bdf8"}}/>
          </div>
          <AccPicker label="CONTA ORIGEM" atKey="atype" aidKey="aid"/>
          <div style={{textAlign:"center",color:"#38bdf8",fontSize:18}}>↓</div>
          <AccPicker label="CONTA DESTINO" atKey="toAtype" aidKey="toAid"/>
          <div><p style={{fontSize:10,color:"#94a3b8",marginBottom:4,fontWeight:600}}>DATA</p><input className="fi" type="date" value={form.date} onChange={e=>setForm(f=>({...f,date:e.target.value}))}/></div>
          <BdayRow/>
          <div><p style={{fontSize:10,color:"#94a3b8",marginBottom:4,fontWeight:600}}>OBSERVAÇÃO (opcional)</p><textarea className="fi" rows={2} placeholder="Motivo…" value={form.note} onChange={e=>setForm(f=>({...f,note:e.target.value}))} style={{resize:"none"}}/></div>
          <button onClick={submit} style={{background:"linear-gradient(135deg,#38bdf8,#818cf8)",color:"#fff",border:"none",borderRadius:11,padding:12,fontSize:14,fontWeight:700,width:"100%"}}>Registrar Transferência</button>
        </>:<>
          <div style={{display:"flex",background:"#0f172a",borderRadius:10,padding:3,gap:3}}>
            <button className={`tb d ${form.type==="despesa"?"on":""}`} onClick={()=>setForm(f=>({...f,type:"despesa",cat:"alimentacao"}))}>↓ Despesa</button>
            <button className={`tb r ${form.type==="receita"?"on":""}`} onClick={()=>setForm(f=>({...f,type:"receita",cat:"salario"}))}>↑ Receita</button>
          </div>
          {!eid&&form.type==="despesa"&&form.atype==="card"&&<div style={{display:"flex",alignItems:"center",justifyContent:"space-between",background:"#1e293b",borderRadius:10,padding:"9px 12px"}}>
            <div><p style={{fontSize:12,fontWeight:600}}>💳 Parcelamento</p><p style={{fontSize:10,color:"#64748b"}}>Divide em parcelas mensais no cartão</p></div>
            <button className={`tog ${form.inst?"on":"off"}`} onClick={()=>setForm(f=>({...f,inst:!f.inst,freq:"none"}))}/>
          </div>}
          <div><p style={{fontSize:10,color:"#94a3b8",marginBottom:4,fontWeight:600}}>{form.inst?"VALOR TOTAL (R$)":"VALOR (R$)"}</p>
            <input className="fi" type="number" inputMode="decimal" placeholder="0,00"
              value={form.inst?form.tamt:form.amt}
              onChange={e=>setForm(f=>form.inst?{...f,tamt:e.target.value}:{...f,amt:e.target.value})}
              style={{fontSize:22,fontWeight:700,fontFamily:"monospace",color:form.type==="receita"?"#34d399":"#f87171"}}/>
          </div>
          {form.inst&&<div>
            <p style={{fontSize:10,color:"#94a3b8",marginBottom:6,fontWeight:600}}>NÚMERO DE PARCELAS</p>
            <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
              {[2,3,4,5,6,8,10,12,18,24].map(n=>{const tot=parseFloat(form.tamt)||0;return(
                <button key={n} onClick={()=>setForm(f=>({...f,icount:String(n)}))}
                  style={{padding:"6px 10px",borderRadius:8,border:"1.5px solid",fontSize:11,fontWeight:600,
                    borderColor:form.icount==n?"#38bdf8":"#334155",
                    background:form.icount==n?"#0c1e2e":"transparent",
                    color:form.icount==n?"#38bdf8":"#64748b",lineHeight:1.4}}>
                  {n}x{tot>0?<><br/><span style={{fontSize:9}}>{fmt(tot/n)}</span></>:""}
                </button>);})}
            </div>
          </div>}
          <div><p style={{fontSize:10,color:"#94a3b8",marginBottom:4,fontWeight:600}}>DESCRIÇÃO</p>
            <input className="fi" type="text" placeholder="Ex: Mercado, Salário…" value={form.desc} onChange={e=>setForm(f=>({...f,desc:e.target.value}))}/>
          </div>
          {(bnks.length>0||crds.length>0)&&<AccPicker label="CONTA" atKey="atype" aidKey="aid"/>}
          <div><p style={{fontSize:10,color:"#94a3b8",marginBottom:5,fontWeight:600}}>CATEGORIA</p>
            <div className="cg">{cats[form.type].map(cat=>(
              <button key={cat.id} className={`cb ${form.cat===cat.id?"on":""}`} onClick={()=>setForm(f=>({...f,cat:cat.id}))}>
                <span style={{fontSize:17}}>{cat.i}</span><span style={{textAlign:"center",lineHeight:1.2}}>{cat.l}</span>
              </button>
            ))}</div>
          </div>
          <div><p style={{fontSize:10,color:"#94a3b8",marginBottom:4,fontWeight:600}}>{form.inst?"DATA 1ª PARCELA":"DATA"}</p>
            <input className="fi" type="date" value={form.date} onChange={e=>setForm(f=>({...f,date:e.target.value}))}/>
          </div>
          {!form.inst&&!eid&&<div>
            <p style={{fontSize:10,color:"#94a3b8",marginBottom:4,fontWeight:600}}>REPETIÇÃO</p>
            <select className="fi" value={form.freq} onChange={e=>setForm(f=>({...f,freq:e.target.value}))}>
              {FREQS.map(o=><option key={o.id} value={o.id}>{o.l}</option>)}
            </select>
          </div>}
          <BdayRow/>
          <div><p style={{fontSize:10,color:"#94a3b8",marginBottom:4,fontWeight:600}}>OBSERVAÇÃO (opcional)</p>
            <textarea className="fi" rows={2} placeholder="Alguma nota…" value={form.note} onChange={e=>setForm(f=>({...f,note:e.target.value}))} style={{resize:"none"}}/>
          </div>
          <button onClick={submit} style={{background:"linear-gradient(135deg,#38bdf8,#818cf8)",color:"#fff",border:"none",borderRadius:11,padding:12,fontSize:14,fontWeight:700,width:"100%"}}>
            {eid?"Salvar":form.inst?`Parcelar em ${form.icount}x`:form.freq!=="none"?"Salvar Recorrência":`Adicionar ${form.type==="receita"?"Receita":"Despesa"}`}
          </button>
        </>}
      </div>}

      {/* ══ HIST ══ */}
      {view==="hist"&&<div className="si" style={{padding:"12px 18px",display:"flex",flexDirection:"column",gap:10}}>
        <Hd back={()=>setView("home")} title={`Extrato — ${MS[m]}/${y}`}/>
        {allM.length===0&&<div style={{textAlign:"center",padding:"36px 0",color:"#475569"}}><p style={{fontSize:12}}>Nenhum lançamento</p></div>}
        {allM.map((t,i)=><TxRow key={t.id||t._fid||i} t={{...t,real:!!t.real}} onE={startE} onD={id=>setMdl({title:"Remover?",danger:true,btn:"Remover",action:()=>dTx(id)})}/>)}
      </div>}

      {/* ══ REC ══ */}
      {view==="cashflow"&&<div className="si" style={{padding:"12px 18px",display:"flex",flexDirection:"column",gap:11}}>
        <Hd back={()=>setView("home")} title="Recorrências & Parcelamentos"/>
        <div className="seg">
          <button className={`st ${rtab==="rec"?"on":""}`} onClick={()=>setRtab("rec")}>🔁 Recorrentes ({rec.length})</button>
          <button className={`st ${rtab==="inst"?"on":""}`} onClick={()=>setRtab("inst")}>📦 Parcelados ({inst.length})</button>
        </div>
        {rtab==="rec"&&<>
          {!rec.length&&<p style={{textAlign:"center",fontSize:12,color:"#475569",padding:"24px 0"}}>Nenhuma recorrência cadastrada</p>}
          {rec.map(r=>{const cat=getCat(r.cat),cnt=tx.filter(t=>t.rid===r.id).length,freq=FREQS.find(f=>f.id===r.freq);return(
            <div key={r.id} className="card" style={{display:"flex",alignItems:"center",gap:10}}>
              <div style={{width:38,height:38,borderRadius:10,background:r.type==="receita"?"#064e3b":"#450a0a",display:"flex",alignItems:"center",justifyContent:"center",fontSize:17,flexShrink:0}}>{cat.i}</div>
              <div style={{flex:1,minWidth:0}}><p style={{fontSize:12,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.desc}</p>
                <p style={{fontSize:10,color:"#64748b"}}>{freq?.l} · desde {pd(r.startDate).toLocaleDateString("pt-BR")}</p>
                <p style={{fontSize:9,color:"#475569"}}>{cnt} lançamento{cnt!==1?"s":""} gerado{cnt!==1?"s":""}</p>
              </div>
              <div style={{textAlign:"right"}}><p style={{fontSize:13,fontWeight:700,color:r.type==="receita"?"#34d399":"#f87171"}}>{r.type==="receita"?"+":"-"}{fmt(r.amt)}</p>
                <button onClick={()=>setMdl({title:"Remover recorrência?",body:"Remove o modelo e todos os lançamentos gerados.",danger:true,btn:"Remover tudo",action:()=>dRec(r.id)})} className="ab" style={{background:"#450a0a",color:"#f87171",marginTop:4}}>× remover</button>
              </div>
            </div>);})}
        </>}
        {rtab==="inst"&&<>
          {!inst.length&&<p style={{textAlign:"center",fontSize:12,color:"#475569",padding:"24px 0"}}>Nenhum parcelamento cadastrado</p>}
          {inst.map(ins=>{
            const cat=getCat(ins.cat),paid=tx.filter(t=>t.iid===ins.id).length,rem=ins.icount-paid,al=alab({atype:ins.atype,aid:ins.aid});
            return<div key={ins.id} className="card">
              <div style={{display:"flex",alignItems:"flex-start",gap:10,marginBottom:9}}>
                <div style={{width:38,height:38,borderRadius:10,background:"#450a0a",display:"flex",alignItems:"center",justifyContent:"center",fontSize:17,flexShrink:0}}>{cat.i}</div>
                <div style={{flex:1,minWidth:0}}><p style={{fontSize:12,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{ins.desc}</p><p style={{fontSize:10,color:"#64748b"}}>{al} · {pd(ins.startDate).toLocaleDateString("pt-BR")}</p></div>
                <div style={{textAlign:"right",flexShrink:0}}><p style={{fontSize:13,fontWeight:700,color:"#f87171"}}>{fmt(ins.tamt/ins.icount)}<span style={{fontSize:9,color:"#64748b"}}>/mês</span></p><p style={{fontSize:9,color:"#64748b"}}>{fmt(ins.tamt)} total</p></div>
              </div>
              <div className="pb" style={{marginBottom:7,height:6}}><div className="pf" style={{width:`${Math.min((paid/ins.icount)*100,100)}%`,background:"linear-gradient(90deg,#38bdf8,#818cf8)"}}/></div>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:9}}>
                <div style={{textAlign:"center"}}><p style={{fontSize:9,color:"#64748b"}}>PAGAS</p><p style={{fontSize:12,fontWeight:700,color:"#34d399"}}>{paid}/{ins.icount}</p><p style={{fontSize:9,color:"#475569"}}>{fmt(paid*(ins.tamt/ins.icount))}</p></div>
                <div style={{textAlign:"center"}}><p style={{fontSize:9,color:"#64748b"}}>RESTANTES</p><p style={{fontSize:12,fontWeight:700,color:rem>0?"#f87171":"#34d399"}}>{rem}</p><p style={{fontSize:9,color:"#475569"}}>{fmt(rem*(ins.tamt/ins.icount))}</p></div>
                <div style={{textAlign:"center"}}><p style={{fontSize:9,color:"#64748b"}}>TOTAL</p><p style={{fontSize:12,fontWeight:700}}>{ins.icount}x</p><p style={{fontSize:9,color:"#475569"}}>{fmt(ins.tamt)}</p></div>
              </div>
              <button onClick={()=>setMdl({title:"Remover parcelamento?",body:"Remove o modelo e todos os lançamentos gerados.",danger:true,btn:"Remover tudo",action:()=>dInst(ins.id)})} className="ab" style={{background:"#450a0a",color:"#f87171",width:"100%",padding:"7px",textAlign:"center"}}>× remover parcelamento</button>
            </div>;})}
        </>}
      </div>}

      {/* ══ ACCOUNTS ══ */}
      {view==="accounts"&&<div className="si" style={{padding:"12px 18px",display:"flex",flexDirection:"column",gap:11}}>
        <Hd back={()=>setView("home")} title="Contas, Cartões & Categorias"/>
        <div className="seg">
          <button className={`st ${atab==="banks"?"on":""}`} onClick={()=>setAtab("banks")}>🏦 Bancos</button>
          <button className={`st ${atab==="cards"?"on":""}`} onClick={()=>setAtab("cards")}>💳 Cartões</button>
          <button className={`st ${atab==="cats"?"on":""}`} onClick={()=>setAtab("cats")}>🏷️ Categorias</button>
        </div>
        {atab==="banks"&&<>
          {bnks.map(b=>{const bal=bbal(b);return<div key={b.id} style={{background:b.color+"1a",border:`1px solid ${b.color}33`,borderRadius:13,padding:"12px 14px",display:"flex",alignItems:"center",gap:11}}>
            <div style={{width:39,height:39,borderRadius:10,background:b.color+"33",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0}}>{b.icon}</div>
            <div style={{flex:1,minWidth:0}}><p style={{fontSize:13,fontWeight:600}}>{b.name}</p><p style={{fontSize:12,color:bal>=0?"#34d399":"#f87171",fontWeight:700,fontFamily:"monospace"}}>{fmt(bal)}</p><p style={{fontSize:9,color:"#64748b"}}>Inicial: {fmt(parseFloat(b.bal)||0)}</p></div>
            <div style={{display:"flex",gap:5}}>
              <button onClick={()=>{setEbid(b.id);setBf({name:b.name,bal:String(b.bal),color:b.color,icon:b.icon});}} className="ab" style={{background:"#1e3a5f",color:"#38bdf8"}}>editar</button>
              <button onClick={()=>setMdl({title:"Remover banco?",danger:true,btn:"Remover",action:()=>dBank(b.id)})} className="ab" style={{background:"#450a0a",color:"#f87171"}}>×</button>
            </div>
          </div>;})}
          <div className="card" style={{display:"flex",flexDirection:"column",gap:10}}>
            <p style={{fontSize:12,fontWeight:700,color:"#94a3b8"}}>{ebid?"✏️ Editar banco":"➕ Novo banco"}</p>
            <div style={{display:"flex",gap:4}}>{BICONS.map(ic=><button key={ic} onClick={()=>setBf(f=>({...f,icon:ic}))} style={{background:bf.icon===ic?"#334155":"transparent",border:"none",fontSize:17,borderRadius:7,padding:3}}>{ic}</button>)}</div>
            <input className="fi" placeholder="Nome" value={bf.name} onChange={e=>setBf(f=>({...f,name:e.target.value}))} style={{padding:"8px 12px",fontSize:12}}/>
            <input className="fi" type="number" placeholder="Saldo inicial (R$)" value={bf.bal} onChange={e=>setBf(f=>({...f,bal:e.target.value}))} style={{padding:"8px 12px",fontSize:12}}/>
            <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>{BCOLS.map(c=><div key={c} className={`cdot ${bf.color===c?"on":""}`} onClick={()=>setBf(f=>({...f,color:c}))} style={{background:c}}/>)}</div>
            <div style={{display:"flex",gap:7}}>
              {ebid&&<button onClick={()=>{setEbid(null);setBf(EB);}} style={{flex:1,padding:9,background:"#334155",border:"none",borderRadius:9,color:"#e2e8f0",fontWeight:600,fontSize:12}}>Cancelar</button>}
              <button onClick={sBank} style={{flex:1,padding:9,background:"linear-gradient(135deg,#38bdf8,#818cf8)",border:"none",borderRadius:9,color:"#fff",fontWeight:600,fontSize:12}}>{ebid?"Salvar":"Adicionar"}</button>
            </div>
          </div>
        </>}
        {atab==="cards"&&<>
          {crds.map(c=>{const sp=csp(c.id),lim=parseFloat(c.lim)||0,av=lim>0?lim-sp:null,pct=lim>0?Math.min((sp/lim)*100,100):0;return<div key={c.id}>
            <div className="vc" style={{background:`linear-gradient(135deg,${c.color},${c.color}88)`}}>
              <div style={{position:"absolute",top:-16,right:-16,width:75,height:75,borderRadius:"50%",background:"rgba(255,255,255,.06)"}}/>
              <div style={{display:"flex",justifyContent:"space-between"}}><p style={{fontSize:20}}>{c.icon}</p><p style={{fontSize:9,color:"rgba(255,255,255,.6)"}}>Vence dia {c.due}</p></div>
              <p style={{fontSize:14,fontWeight:700,color:"#fff",marginTop:6}}>{c.name}</p>
              <div style={{display:"flex",gap:16,marginTop:6}}>
                <div><p style={{fontSize:8,color:"rgba(255,255,255,.6)"}}>USADO</p><p style={{fontSize:13,fontWeight:700,color:"#fff",fontFamily:"monospace"}}>{fmt(sp)}</p></div>
                {lim>0&&<><div style={{width:1,background:"rgba(255,255,255,.2)"}}/>
                <div><p style={{fontSize:8,color:"rgba(255,255,255,.6)"}}>DISPONÍVEL</p><p style={{fontSize:12,fontWeight:700,color:av>=0?"#a7f3d0":"#fca5a5",fontFamily:"monospace"}}>{fmt(av)}</p></div></>}
              </div>
              {lim>0&&<div style={{marginTop:7,height:3,background:"rgba(255,255,255,.2)",borderRadius:99,overflow:"hidden"}}><div style={{height:"100%",width:`${pct}%`,background:pct>85?"#f87171":"rgba(255,255,255,.7)",borderRadius:99}}/></div>}
            </div>
            <div style={{display:"flex",gap:6,marginTop:7,marginBottom:7}}>
              <button onClick={()=>{setSelC(c);setView("card");}} className="ab" style={{flex:1,background:"#1e293b",color:"#94a3b8",padding:7}}>ver fatura</button>
              <button onClick={()=>{setEcid(c.id);setCf({name:c.name,lim:String(c.lim),color:c.color,due:c.due,icon:c.icon});}} className="ab" style={{background:"#1e3a5f",color:"#38bdf8"}}>editar</button>
              <button onClick={()=>setMdl({title:"Remover cartão?",danger:true,btn:"Remover",action:()=>dCard(c.id)})} className="ab" style={{background:"#450a0a",color:"#f87171"}}>×</button>
            </div>
          </div>;})}
          <div className="card" style={{display:"flex",flexDirection:"column",gap:10}}>
            <p style={{fontSize:12,fontWeight:700,color:"#94a3b8"}}>{ecid?"✏️ Editar":"➕ Novo cartão"}</p>
            <div style={{display:"flex",gap:4}}>{CICONS.map(ic=><button key={ic} onClick={()=>setCf(f=>({...f,icon:ic}))} style={{background:cf.icon===ic?"#334155":"transparent",border:"none",fontSize:17,borderRadius:7,padding:3}}>{ic}</button>)}</div>
            <input className="fi" placeholder="Nome" value={cf.name} onChange={e=>setCf(f=>({...f,name:e.target.value}))} style={{padding:"8px 12px",fontSize:12}}/>
            <input className="fi" type="number" placeholder="Limite (R$) — opcional" value={cf.lim} onChange={e=>setCf(f=>({...f,lim:e.target.value}))} style={{padding:"8px 12px",fontSize:12}}/>
            <div style={{display:"flex",gap:9,alignItems:"center"}}>
              <p style={{fontSize:11,color:"#94a3b8",whiteSpace:"nowrap"}}>Vence dia:</p>
              <input className="fi" type="number" min="1" max="31" placeholder="10" value={cf.due} onChange={e=>setCf(f=>({...f,due:e.target.value}))} style={{padding:"8px 12px",fontSize:12}}/>
            </div>
            <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>{CCOLS.map(c=><div key={c} className={`cdot ${cf.color===c?"on":""}`} onClick={()=>setCf(f=>({...f,color:c}))} style={{background:c}}/>)}</div>
            <div style={{display:"flex",gap:7}}>
              {ecid&&<button onClick={()=>{setEcid(null);setCf(EC);}} style={{flex:1,padding:9,background:"#334155",border:"none",borderRadius:9,color:"#e2e8f0",fontWeight:600,fontSize:12}}>Cancelar</button>}
              <button onClick={sCard} style={{flex:1,padding:9,background:"linear-gradient(135deg,#38bdf8,#818cf8)",border:"none",borderRadius:9,color:"#fff",fontWeight:600,fontSize:12}}>{ecid?"Salvar":"Adicionar"}</button>
            </div>
          </div>
        </>}
        {atab==="cats"&&<>
          {["despesa","receita"].map(type=>{const customs=(ccat[type]||[]);if(!customs.length)return null;return<div key={type} className="card">
            <p style={{fontSize:10,fontWeight:700,color:"#94a3b8",textTransform:"uppercase",letterSpacing:.5,marginBottom:9}}>{type==="despesa"?"↓ Despesa":"↑ Receita"} — personalizadas</p>
            {customs.map(cat=><div key={cat.id} style={{display:"flex",alignItems:"center",gap:9,background:"#0f172a",borderRadius:9,padding:"7px 11px",marginBottom:6}}>
              <span style={{fontSize:18}}>{cat.icon||cat.i}</span>
              <p style={{fontSize:12,fontWeight:600,flex:1}}>{cat.label||cat.l}</p>
              <button onClick={()=>setMdl({title:`Remover "${cat.label||cat.l}"?`,body:"Lançamentos existentes não serão afetados.",danger:true,btn:"Remover",action:()=>dCat(type,cat.id)})} className="ab" style={{background:"#450a0a",color:"#f87171"}}>×</button>
            </div>)}
          </div>;})}
          <div className="card" style={{display:"flex",flexDirection:"column",gap:10}}>
            <p style={{fontSize:12,fontWeight:700,color:"#94a3b8"}}>➕ Nova Categoria</p>
            <div className="seg">
              <button className={`st ${catF.type==="despesa"?"on":""}`} onClick={()=>setCatF(f=>({...f,type:"despesa"}))}>↓ Despesa</button>
              <button className={`st ${catF.type==="receita"?"on":""}`} onClick={()=>setCatF(f=>({...f,type:"receita"}))}>↑ Receita</button>
            </div>
            <input className="fi" placeholder="Nome da categoria" value={catF.label} onChange={e=>setCatF(f=>({...f,label:e.target.value}))} style={{padding:"8px 12px",fontSize:12}}/>
            <div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:5}}>
                <p style={{fontSize:10,color:"#94a3b8",fontWeight:600}}>ÍCONE: {catF.icon}</p>
                <button onClick={()=>setEpk(p=>!p)} style={{background:"#334155",border:"none",borderRadius:7,padding:"3px 9px",fontSize:11,color:"#94a3b8",fontWeight:600}}>{epk?"Fechar":"Escolher"}</button>
              </div>
              {epk&&<div style={{background:"#0f172a",borderRadius:9,padding:7,display:"grid",gridTemplateColumns:"repeat(8,1fr)",gap:3,maxHeight:150,overflowY:"auto"}}>
                {EMOJIS.map(em=><button key={em} onClick={()=>{setCatF(f=>({...f,icon:em}));setEpk(false);}} style={{background:"none",border:"none",fontSize:18,borderRadius:7,padding:3,cursor:"pointer"}}>{em}</button>)}
              </div>}
            </div>
            <button onClick={sCat} style={{padding:10,background:"linear-gradient(135deg,#38bdf8,#818cf8)",border:"none",borderRadius:9,color:"#fff",fontWeight:600,fontSize:12}}>Criar Categoria</button>
          </div>
          <div className="card">
            <p style={{fontSize:10,fontWeight:700,color:"#94a3b8",textTransform:"uppercase",letterSpacing:.5,marginBottom:9}}>Todas as Categorias</p>
            {["despesa","receita"].map(type=><div key={type} style={{marginBottom:10}}>
              <p style={{fontSize:10,color:"#64748b",marginBottom:5}}>{type==="despesa"?"↓ Despesa":"↑ Receita"}</p>
              <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
                {cats[type].map(cat=><div key={cat.id} style={{background:cat.custom?"#1e3a5f22":"#0f172a",border:`1px solid ${cat.custom?"#38bdf844":"#334155"}`,borderRadius:7,padding:"4px 9px",display:"flex",alignItems:"center",gap:4}}>
                  <span style={{fontSize:12}}>{cat.i}</span><span style={{fontSize:10,color:cat.custom?"#7dd3fc":"#94a3b8"}}>{cat.l}</span>
                </div>)}
              </div>
            </div>)}
          </div>
        </>}
      </div>}

      {/* ══ CARD ══ */}
      {view==="card"&&selC&&(()=>{
        const sp=csp(selC.id),lim=parseFloat(selC.lim)||0,av=lim>0?lim-sp:null,pct=lim>0?Math.min((sp/lim)*100,100):0;
        const cItems=allM.filter(i=>i.atype==="card"&&i.aid===selC.id);
        const cInst=inst.filter(i=>i.atype==="card"&&i.aid===selC.id);
        return<div className="si" style={{padding:"12px 18px",display:"flex",flexDirection:"column",gap:11}}>
          <Hd back={()=>setView("home")} title={`Fatura — ${selC.name}`}/>
          <div className="vc" style={{background:`linear-gradient(135deg,${selC.color},${selC.color}88)`}}>
            <div style={{position:"absolute",top:-16,right:-16,width:80,height:80,borderRadius:"50%",background:"rgba(255,255,255,.06)"}}/>
            <p style={{fontSize:20}}>{selC.icon}</p>
            <p style={{fontSize:15,fontWeight:700,color:"#fff",marginTop:5}}>{selC.name}</p>
            <div style={{display:"flex",gap:18,marginTop:6}}>
              <div><p style={{fontSize:8,color:"rgba(255,255,255,.6)"}}>FATURA {MS[m].toUpperCase()}</p><p style={{fontSize:18,fontWeight:700,color:"#fff",fontFamily:"monospace"}}>{fmt(sp)}</p></div>
              {lim>0&&<><div style={{width:1,background:"rgba(255,255,255,.2)"}}/>
              <div><p style={{fontSize:8,color:"rgba(255,255,255,.6)"}}>DISPONÍVEL</p><p style={{fontSize:13,fontWeight:700,color:av>=0?"#a7f3d0":"#fca5a5",fontFamily:"monospace",marginTop:4}}>{fmt(av)}</p></div></>}
            </div>
            {lim>0&&<div style={{marginTop:7,height:3,background:"rgba(255,255,255,.2)",borderRadius:99,overflow:"hidden"}}><div style={{height:"100%",width:`${pct}%`,background:pct>85?"#f87171":"rgba(255,255,255,.7)",borderRadius:99}}/></div>}
            <p style={{fontSize:9,color:"rgba(255,255,255,.5)",marginTop:4}}>Vencimento: dia {selC.due}</p>
          </div>
          {cInst.length>0&&<div className="card">
            <p style={{fontSize:10,fontWeight:700,color:"#94a3b8",marginBottom:9,textTransform:"uppercase",letterSpacing:.5}}>Parcelamentos neste cartão</p>
            {cInst.map(ins=>{const paid=tx.filter(t=>t.iid===ins.id).length,rem=ins.icount-paid,p2=Math.min((paid/ins.icount)*100,100);return<div key={ins.id} style={{marginBottom:11,paddingBottom:11,borderBottom:"1px solid #0f172a"}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><p style={{fontSize:12,fontWeight:600}}>{ins.desc}</p><p style={{fontSize:11,fontWeight:700,color:"#f87171"}}>{fmt(ins.tamt/ins.icount)}/mês</p></div>
              <div className="pb" style={{marginBottom:4,height:5}}><div className="pf" style={{width:`${p2}%`,background:"linear-gradient(90deg,#38bdf8,#818cf8)"}}/></div>
              <div style={{display:"flex",justifyContent:"space-between"}}><p style={{fontSize:9,color:"#64748b"}}>{paid}/{ins.icount} pagas · {fmt(paid*(ins.tamt/ins.icount))}</p><p style={{fontSize:9,color:rem>0?"#f87171":"#34d399"}}>{rem} rest. · {fmt(rem*(ins.tamt/ins.icount))}</p></div>
            </div>;})}
          </div>}
          <button onClick={()=>{setForm({...mf(),type:"despesa",atype:"card",aid:selC.id});setView("add");}}
            style={{background:"linear-gradient(135deg,#7c3aed,#4f46e5)",color:"#fff",border:"none",borderRadius:11,padding:11,fontSize:13,fontWeight:700,width:"100%"}}>
            + Lançar na Fatura
          </button>
          {!cItems.length&&<p style={{textAlign:"center",fontSize:12,color:"#475569",padding:"20px 0"}}>Sem lançamentos neste mês</p>}
          {cItems.map((t,i)=><TxRow key={t.id||t._fid||i} t={{...t,real:!!t.real}} onD={id=>setMdl({title:"Remover?",danger:true,btn:"Remover",action:()=>dTx(id)})}/>)}
        </div>;
      })()}

      {/* ══ BUDGETS ══ */}
      {view==="budgets"&&<div className="si" style={{padding:"12px 18px",display:"flex",flexDirection:"column",gap:11}}>
        <h2 style={{fontSize:15,fontWeight:700}}>🎯 Metas por Categoria</h2>
        <p style={{fontSize:11,color:"#64748b",marginTop:-5}}>Limite mensal por categoria de despesa.</p>
        {cats.despesa.map(cat=>{const sp=catD[cat.id]||0,bg=budg[cat.id],pct=bg?Math.min((sp/bg)*100,100):0,ov=bg&&sp>bg;return<div key={cat.id} className="card" style={{padding:"12px"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:7}}>
            <span style={{fontWeight:600,fontSize:12}}>{cat.i} {cat.l}</span>
            <span style={{fontSize:12,color:ov?"#f87171":"#94a3b8"}}>{fmt(sp)}{bg?` / ${fmt(bg)}`:""}</span>
          </div>
          {bg&&<div className="pb" style={{marginBottom:7,height:5}}><div className="pf" style={{width:`${pct}%`,background:ov?"#ef4444":"linear-gradient(90deg,#38bdf8,#818cf8)"}}/></div>}
          <div style={{display:"flex",gap:7}}>
            <input className="fi" type="number" placeholder={bg?fmt(bg):"Definir meta…"} value={bi[cat.id]||""} onChange={e=>setBi(p=>({...p,[cat.id]:e.target.value}))} style={{fontSize:12,padding:"7px 11px"}}/>
            <button onClick={()=>{const v=parseFloat((bi[cat.id]||"").replace(",","."));if(!v||v<=0)return;setBudg(p=>({...p,[cat.id]:v}));setBi(p=>({...p,[cat.id]:""}));toast$("Meta salva ✓");}} style={{background:"linear-gradient(135deg,#38bdf8,#818cf8)",border:"none",color:"#fff",borderRadius:9,padding:"7px 12px",fontWeight:600,fontSize:12,flexShrink:0}}>Salvar</button>
          </div>
        </div>;})}
      </div>}

      {/* ── Nav ── */}
      <nav style={{position:"fixed",bottom:0,left:"50%",transform:"translateX(-50%)",width:"100%",maxWidth:480,background:"#1e293b",borderTop:"1px solid #334155",display:"flex",padding:"5px 0 9px"}}>
        {[
          {id:"home",    label:"Início",  icon:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>},
          {id:"dashs",   label:"Dashs",   icon:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="9"/><path d="M12 12L8.5 8.5"/><path d="M12 7v1M17 12h-1M12 17v-1M7 12h1"/></svg>},
          {id:"add",     label:"Lançar",  icon:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/></svg>},
          {id:"accounts",label:"Contas",  icon:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>},
          {id:"hist",    label:"Extrato", icon:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>},
        ].map(tab=>(
          <button key={tab.id} className={`nb ${(view===tab.id||(tab.id==="accounts"&&["card","budgets","cashflow"].includes(view)))?"on":""}`}
            style={tab.id==="add"?{color:"#38bdf8"}:{}}
            onClick={()=>setView(tab.id)}>
            {tab.icon}{tab.label}
          </button>
        ))}
      </nav>
    </div>
  );
}