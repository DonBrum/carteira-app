import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { auth, db, provider } from "./firebase";
import { signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";
import { doc, setDoc, getDoc } from "firebase/firestore";

// ── Constants ──────────────────────────────────────────────────────────────────
const DC={
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

// ── Helpers ────────────────────────────────────────────────────────────────────
const fmt=v=>new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(v??0);
const td=()=>new Date().toISOString().split("T")[0];
const pd=s=>new Date(s+"T12:00:00");
const isBiz=d=>{const w=d.getDay();if(w===0||w===6)return false;return!HOL.has(`${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`);};
const adjBiz=(s,r)=>{if(r==="ignore")return s;let d=pd(s);if(isBiz(d))return s;const st=r==="next"?1:-1;let g=0;while(!isBiz(d)&&g++<15)d.setDate(d.getDate()+st);return d.toISOString().split("T")[0];};
const addF=(s,f)=>{const d=pd(s);if(f==="weekly")d.setDate(d.getDate()+7);else if(f==="biweekly")d.setDate(d.getDate()+14);else if(f==="monthly")d.setMonth(d.getMonth()+1);else if(f==="bimonthly")d.setMonth(d.getMonth()+2);else if(f==="quarterly")d.setMonth(d.getMonth()+3);else if(f==="semiannual")d.setMonth(d.getMonth()+6);else if(f==="annual")d.setFullYear(d.getFullYear()+1);else return null;return d.toISOString().split("T")[0];};

// ── NEW: card billing date ─────────────────────────────────────────────────────
// Returns the next due date on or after the purchase date based on card due day
const cardPayDate=(purchaseDate,dueDay)=>{
  const due=parseInt(dueDay)||10;
  const d=pd(purchaseDate);
  const day=d.getDate();
  // If purchased on or before due day → billing closes this month
  // If purchased after due day → billing closes next month
  const targetMonth=day<=due?d.getMonth():d.getMonth()+1;
  const targetYear=d.getFullYear()+(targetMonth>11?1:0);
  return new Date(targetYear,targetMonth%12,due).toISOString().split("T")[0];
};

const mf=()=>({type:"despesa",amt:"",desc:"",cat:"alimentacao",date:td(),note:"",atype:"bank",aid:"",freq:"none",bday:"ignore",inst:false,icount:"2",tamt:"",isTransfer:false,toAtype:"bank",toAid:""});
const EB={name:"",bal:"",color:BCOLS[0],icon:"🏦",hidden:false};
const EC={name:"",lim:"",color:CCOLS[0],icon:"💳",due:"10"};

// ── Firestore ──────────────────────────────────────────────────────────────────
const userDoc=uid=>doc(db,"users",uid);
const loadUserData=async uid=>{try{const s=await getDoc(userDoc(uid));return s.exists()?s.data():{}}catch{return{}}};
const saveUserData=async(uid,data)=>{try{await setDoc(userDoc(uid),data,{merge:true})}catch(e){console.error("Firestore save:",e)}};

// ── Charts ─────────────────────────────────────────────────────────────────────
function Pie({slices,sz=150,label,sub}){
  if(!slices?.length)return<div style={{width:sz,height:sz,borderRadius:"50%",background:"#1e293b",display:"flex",alignItems:"center",justifyContent:"center"}}><p style={{fontSize:11,color:"#475569"}}>Sem dados</p></div>;
  const tot=slices.reduce((s,x)=>s+x.v,0);if(!tot)return null;
  let a=0;
  const paths=slices.map((sl,i)=>{
    const sw=sl.v/tot*2*Math.PI,x1=Math.cos(a)*0.85,y1=Math.sin(a)*0.85,x2=Math.cos(a+sw)*0.85,y2=Math.sin(a+sw)*0.85,lg=sw>Math.PI?1:0;
    const p=<path key={i} d={`M${x1} ${y1}A0.85 0.85 0 ${lg} 1 ${x2} ${y2}L0 0Z`} fill={sl.c} stroke="#0f172a" strokeWidth="0.03"/>;
    a+=sw;return p;
  });
  return(
    <div style={{position:"relative",width:sz,height:sz,flexShrink:0}}>
      <svg viewBox="-1 -1 2 2" style={{width:sz,height:sz,transform:"rotate(-90deg)"}}>{paths}</svg>
      <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",pointerEvents:"none"}}>
        {label&&<p style={{fontSize:11,fontWeight:700,color:"#e2e8f0",fontFamily:"'DM Mono',monospace",textAlign:"center",lineHeight:1.2,padding:"0 10px"}}>{label}</p>}
        {sub&&<p style={{fontSize:9,color:"#94a3b8",marginTop:2,textAlign:"center"}}>{sub}</p>}
      </div>
    </div>
  );
}
function Gauge({pct=0,label,sub,sz=130}){
  const cp=Math.min(Math.max(pct,0),1),a=cp*Math.PI,r=0.75;
  const ex=Math.cos(Math.PI-a)*r,ey=-Math.sin(Math.PI-a)*r;
  const gc=pct>0.85?"#ef4444":pct>0.6?"#f59e0b":"#34d399";
  return(
    <div style={{position:"relative",width:sz,height:sz*0.6,flexShrink:0}}>
      <svg viewBox="-1.1 -1 2.2 1.1" style={{width:sz,height:sz*0.6}}>
        <path d={`M${-r} 0A${r} ${r} 0 0 1 ${r} 0`} fill="none" stroke="#1e293b" strokeWidth="0.22" strokeLinecap="round"/>
        {cp>0.01&&<path d={`M${-r} 0A${r} ${r} 0 ${a>Math.PI/2?1:0} 1 ${ex} ${ey}`} fill="none" stroke={gc} strokeWidth="0.22" strokeLinecap="round"/>}
      </svg>
      <div style={{position:"absolute",bottom:0,left:0,right:0,textAlign:"center"}}>
        {label&&<p style={{fontSize:13,fontWeight:700,color:gc,fontFamily:"'DM Mono',monospace"}}>{label}</p>}
        {sub&&<p style={{fontSize:9,color:"#64748b",marginTop:1}}>{sub}</p>}
      </div>
    </div>
  );
}

// ── PIN Screen ─────────────────────────────────────────────────────────────────
function PinScreen({savedPin,onUnlock}){
  const [input,setInput]=useState("");
  const [error,setError]=useState(false);
  const [confirm,setConfirm]=useState("");
  const [step,setStep]=useState(1);
  const isSetup=!savedPin;
  const press=useCallback(val=>{
    if(val==="del"){setInput(p=>p.slice(0,-1));setError(false);return;}
    if(input.length>=6)return;
    setInput(p=>p+val);
  },[input]);
  useEffect(()=>{
    if(isSetup||input.length!==4)return;
    if(input===savedPin)onUnlock();
    else{setError(true);setTimeout(()=>{setInput("");setError(false);},600);}
  },[input,isSetup,savedPin,onUnlock]);
  const handleConfirm=useCallback(()=>{
    if(step===1){if(input.length<4)return;setConfirm(input);setInput("");setStep(2);}
    else{if(input===confirm)onUnlock(input);else{setError(true);setTimeout(()=>{setInput("");setError(false);setStep(1);setConfirm("");},600);}}
  },[step,input,confirm,onUnlock]);
  const title=isSetup?(step===1?"🔐 Criar PIN":"🔐 Confirme o PIN"):"🔒 Digite seu PIN";
  return(
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",minHeight:"100dvh",background:"#0f172a",padding:"env(safe-area-inset-top) 20px env(safe-area-inset-bottom)"}}>
      <div style={{background:"#1e293b",borderRadius:24,padding:"32px 24px",width:"100%",maxWidth:340,display:"flex",flexDirection:"column",alignItems:"center",gap:20}}>
        <div style={{textAlign:"center"}}>
          <h2 style={{fontSize:19,fontWeight:700,color:"#e2e8f0",marginBottom:6}}>{title}</h2>
          <p style={{fontSize:13,color:"#64748b"}}>{isSetup?(step===1?"PIN de 4 a 6 dígitos":"Digite novamente para confirmar"):"Seu app está protegido"}</p>
        </div>
        <div style={{display:"flex",gap:14,padding:"4px 0"}}>
          {Array.from({length:Math.max(input.length,4)}).map((_,i)=>(
            <div key={i} style={{width:14,height:14,borderRadius:"50%",background:error?"#ef4444":i<input.length?"#38bdf8":"#334155",transition:"background .18s"}}/>
          ))}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,width:"100%"}}>
          {["1","2","3","4","5","6","7","8","9","del","0"].map(k=>(
            <button key={k} onClick={()=>press(k)} style={{background:"#0f172a",border:"1.5px solid #334155",borderRadius:14,padding:"18px 0",fontSize:k==="del"?18:22,fontWeight:700,color:k==="del"?"#94a3b8":"#e2e8f0",WebkitTapHighlightColor:"transparent"}}>
              {k==="del"?"⌫":k}
            </button>
          ))}
          {isSetup?<button disabled={input.length<4} onClick={handleConfirm} style={{background:input.length<4?"#334155":"linear-gradient(135deg,#38bdf8,#818cf8)",border:"none",borderRadius:14,padding:"18px 0",fontSize:13,fontWeight:700,color:"#fff",WebkitTapHighlightColor:"transparent",opacity:input.length<4?0.5:1}}>{step===1?"Próximo":"✓ Salvar"}</button>:<div/>}
        </div>
        {error&&<p style={{fontSize:12,color:"#f87171",fontWeight:600}}>{isSetup?"PINs não coincidem":"PIN incorreto"}</p>}
      </div>
    </div>
  );
}

// ── Login Screen ───────────────────────────────────────────────────────────────
function LoginScreen(){
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState("");
  const handleGoogle=async()=>{
    setLoading(true);setError("");
    try{await signInWithPopup(auth,provider);}
    catch(e){setError(e.code==="auth/popup-closed-by-user"?"Login cancelado.":"Erro ao entrar. Tente novamente.");setLoading(false);}
  };
  return(
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",minHeight:"100dvh",background:"#0f172a",padding:"env(safe-area-inset-top) 20px env(safe-area-inset-bottom)"}}>
      <div style={{background:"#1e293b",borderRadius:24,padding:"40px 28px",width:"100%",maxWidth:340,display:"flex",flexDirection:"column",alignItems:"center",gap:22,textAlign:"center"}}>
        <div style={{width:72,height:72,borderRadius:20,background:"linear-gradient(135deg,#1e3a5f,#1e293b)",border:"1px solid #2d4a6b",display:"flex",alignItems:"center",justifyContent:"center",fontSize:36}}>💰</div>
        <div>
          <h1 style={{fontSize:24,fontWeight:700,color:"#e2e8f0",marginBottom:8}}>Minha Carteira</h1>
          <p style={{fontSize:13,color:"#64748b",lineHeight:1.6}}>Dados sincronizados em todos os dispositivos em tempo real.</p>
        </div>
        <button onClick={handleGoogle} disabled={loading} style={{display:"flex",alignItems:"center",justifyContent:"center",gap:12,background:"#fff",border:"none",borderRadius:14,padding:"14px 24px",fontSize:15,fontWeight:600,color:"#1e293b",width:"100%",opacity:loading?0.7:1,WebkitTapHighlightColor:"transparent",transition:"opacity .2s"}}>
          <svg width="20" height="20" viewBox="0 0 48 48">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.35-8.16 2.35-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
          </svg>
          {loading?"Entrando…":"Entrar com Google"}
        </button>
        {error&&<p style={{fontSize:12,color:"#f87171"}}>{error}</p>}
        <p style={{fontSize:11,color:"#475569"}}>Cada conta Google tem seus dados separados e seguros.</p>
      </div>
    </div>
  );
}
function Loader({icon="💰",msg="Carregando…"}){
  return<div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",minHeight:"100dvh",background:"#0f172a",gap:14}}><p style={{fontSize:40}}>{icon}</p><p style={{fontSize:13,color:"#64748b",fontWeight:500}}>{msg}</p></div>;
}

// ── Recurring helpers ──────────────────────────────────────────────────────────
function autoOccs(tpl,done){
  const now=new Date();const res=[];let cur=tpl.startDate;let g=0;
  while(g++<600){const adj=adjBiz(cur,tpl.bday||"ignore");const d=pd(adj);if(d>now)break;
    const key=`${tpl.id}__${cur}`;if(!done.has(key))res.push({key,date:adj,orig:cur});
    const nx=addF(cur,tpl.freq);if(!nx||nx===cur)break;cur=nx;}
  return res;
}
function recInMonth(tpl,m,y){
  const ms=new Date(y,m,1),me=new Date(y,m+1,0);const res=[];let cur=tpl.startDate;let g=0;
  while(g++<600){const adj=adjBiz(cur,tpl.bday||"ignore");const d=pd(adj);if(d>me)break;
    if(d>=ms)res.push({date:adj,orig:cur});const nx=addF(cur,tpl.freq);if(!nx||nx===cur)break;cur=nx;}
  return res;
}
function instInMonth(ins,m,y){
  const res=[];
  for(let i=0;i<ins.icount;i++){const d=pd(ins.startDate);d.setMonth(d.getMonth()+i);const raw=d.toISOString().split("T")[0];const adj=adjBiz(raw,ins.bday||"ignore");const dd=pd(adj);
    if(dd.getMonth()===m&&dd.getFullYear()===y)res.push({date:adj,orig:raw,idx:i+1,amt:ins.tamt/ins.icount});}
  return res;
}

// ── CSS ────────────────────────────────────────────────────────────────────────
const CSS=`
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html,body{background:#0f172a;overscroll-behavior-y:none}
input,select,textarea{font-family:inherit;outline:none;color:#e2e8f0;font-size:16px;-webkit-appearance:none;appearance:none}
button{cursor:pointer;font-family:inherit;-webkit-tap-highlight-color:transparent;touch-action:manipulation}
::-webkit-scrollbar{width:4px}::-webkit-scrollbar-track{background:#1e293b}::-webkit-scrollbar-thumb{background:#334155;border-radius:4px}
.si{animation:si .22s ease}@keyframes si{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
.card{background:#1e293b;border-radius:14px;padding:14px}
.fi{background:#0f172a;border:1.5px solid #334155;border-radius:11px;padding:11px 14px;font-size:16px;width:100%;transition:border-color .2s;color:#e2e8f0}
.fi:focus{border-color:#38bdf8}
.seg{display:flex;background:#0f172a;border-radius:10px;padding:3px;gap:3px}
.st{flex:1;padding:8px 4px;border:none;border-radius:8px;font-size:11px;font-weight:600;transition:all .18s;background:transparent;color:#64748b;white-space:nowrap;touch-action:manipulation}
.st.on{background:#1e293b;color:#e2e8f0}
.tb{flex:1;padding:10px;border:none;border-radius:9px;font-size:14px;font-weight:600;transition:all .18s;touch-action:manipulation}
.tb.r.on{background:#064e3b;color:#34d399}.tb.d.on{background:#450a0a;color:#f87171}.tb:not(.on){background:transparent;color:#64748b}
.cg{display:grid;grid-template-columns:repeat(4,1fr);gap:7px}
.cb{background:#0f172a;border:1.5px solid #334155;border-radius:10px;padding:9px 3px;display:flex;flex-direction:column;align-items:center;gap:3px;font-size:10px;color:#94a3b8;transition:all .18s;touch-action:manipulation}
.cb.on{border-color:#38bdf8;color:#38bdf8;background:#0c1e2e}
.pb{height:5px;background:#0f172a;border-radius:99px;overflow:hidden}.pf{height:100%;border-radius:99px;transition:width .45s ease}
.nb{background:none;border:none;color:#64748b;font-size:9px;font-weight:500;display:flex;flex-direction:column;align-items:center;gap:2px;padding:6px 4px;transition:color .18s;flex:1;touch-action:manipulation;min-height:44px;justify-content:center}
.nb.on{color:#38bdf8}.nb svg{width:20px;height:20px}
.ab{padding:7px 11px;border:none;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;touch-action:manipulation;min-height:32px}
.cdot{width:22px;height:22px;border-radius:50%;border:2.5px solid transparent;cursor:pointer;flex-shrink:0;transition:transform .15s}
.cdot.on{border-color:#fff;transform:scale(1.25)}
.bdg{display:inline-flex;align-items:center;padding:2px 6px;border-radius:99px;font-size:9px;font-weight:700}
.tog{width:42px;height:24px;border-radius:99px;border:none;position:relative;transition:background .2s;cursor:pointer;flex-shrink:0;touch-action:manipulation}
.tog::after{content:'';position:absolute;top:3px;width:18px;height:18px;border-radius:50%;background:#fff;transition:left .2s}
.tog.on{background:#38bdf8}.tog.off{background:#334155}
.tog.on::after{left:21px}.tog.off::after{left:3px}
.vc{border-radius:18px;padding:18px;position:relative;overflow:hidden}
.fc{border-left:3px solid #7dd3fc;opacity:.75}
.unpaid-row{opacity:.6;border-left:3px solid #f59e0b}
select.fi{background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 13px center;padding-right:36px}
select option{background:#1e293b;color:#e2e8f0}
`;

// ═══════════════════════════════════════════════════════════════════════════════
export default function App(){
  // ── Auth ──
  const [user,       setUser]      = useState(undefined);
  const [locked,     setLocked]    = useState(true);
  const [savedPin,   setSavedPin]  = useState("");
  const [dataLoaded, setDataLoaded]= useState(false);

  // ── Data ──
  const [tx,   setTx]  = useState([]);
  const [rec,  setRec] = useState([]);
  const [inst, setInst]= useState([]);
  const [bnks, setBnks]= useState([]);
  const [crds, setCrds]= useState([]);
  const [budg, setBudg]= useState({});
  const [ccat, setCcat]= useState({receita:[],despesa:[]});

  // ── UI ──
  const [view, setView]= useState("home");
  const [filt, setFilt]= useState({m:new Date().getMonth(),y:new Date().getFullYear()});
  const [form, setForm]= useState(mf);
  const [eid,  setEid] = useState(null);   // tx being edited
  const [recEid,setRecEid]=useState(null); // rec template being edited
  const [bf,   setBf]  = useState(EB);
  const [cf,   setCf]  = useState(EC);
  const [catF, setCatF]= useState({label:"",icon:"🎯",type:"despesa"});
  const [ebid, setEbid]= useState(null);
  const [ecid, setEcid]= useState(null);
  const [atab, setAtab]= useState("banks");
  const [bi,   setBi]  = useState({});
  const [selC, setSelC]= useState(null);
  const [mdl,  setMdl] = useState(null);
  const [tst,  setTst] = useState(null);
  const [rtab, setRtab]= useState("rec");
  const [epk,  setEpk] = useState(false);
  const saveTimer      = useRef(null);
  const mainRef        = useRef(null);

  const nav=useCallback(v=>{setView(v);setTimeout(()=>mainRef.current?.scrollTo({top:0,behavior:"instant"}),0);},[]);

  // ── Auth listener ──
  useEffect(()=>{
    const unsub=onAuthStateChanged(auth,async u=>{
      setUser(u);
      if(u){
        const data=await loadUserData(u.uid);
        if(data.tx)    setTx(data.tx);
        if(data.rec)   setRec(data.rec);
        if(data.inst)  setInst(data.inst);
        if(data.banks) setBnks(data.banks);
        if(data.cards) setCrds(data.cards);
        if(data.budg)  setBudg(data.budg);
        if(data.ccat)  setCcat(data.ccat);
        if(data.pin)   setSavedPin(data.pin);
        setDataLoaded(true);setLocked(true);
      } else {
        setTx([]);setRec([]);setInst([]);setBnks([]);setCrds([]);setBudg({});
        setCcat({receita:[],despesa:[]});setSavedPin("");setDataLoaded(false);setLocked(true);
      }
    });
    return unsub;
  },[]);

  // ── Lock on hide ──
  useEffect(()=>{
    if(!savedPin||!user)return;
    const lock=()=>{if(document.hidden)setLocked(true);};
    const lockBlur=()=>setLocked(true);
    document.addEventListener("visibilitychange",lock);
    window.addEventListener("blur",lockBlur);
    return()=>{document.removeEventListener("visibilitychange",lock);window.removeEventListener("blur",lockBlur);};
  },[savedPin,user]);

  // ── Debounced Firestore save ──
  const saveToFirestore=useCallback((patch)=>{
    if(!user)return;
    if(saveTimer.current)clearTimeout(saveTimer.current);
    saveTimer.current=setTimeout(()=>saveUserData(user.uid,patch),1500);
  },[user]);

  useEffect(()=>{if(user&&dataLoaded)saveToFirestore({tx});},[tx,user,dataLoaded]);
  useEffect(()=>{if(user&&dataLoaded)saveToFirestore({rec});},[rec,user,dataLoaded]);
  useEffect(()=>{if(user&&dataLoaded)saveToFirestore({inst});},[inst,user,dataLoaded]);
  useEffect(()=>{if(user&&dataLoaded)saveToFirestore({banks:bnks});},[bnks,user,dataLoaded]);
  useEffect(()=>{if(user&&dataLoaded)saveToFirestore({cards:crds});},[crds,user,dataLoaded]);
  useEffect(()=>{if(user&&dataLoaded)saveToFirestore({budg});},[budg,user,dataLoaded]);
  useEffect(()=>{if(user&&dataLoaded)saveToFirestore({ccat});},[ccat,user,dataLoaded]);

  // ── Merged categories ──
  const cats=useMemo(()=>({
    receita:[...DC.receita,...(ccat.receita||[]).map(c=>({...c,l:c.label,i:c.icon}))],
    despesa:[...DC.despesa,...(ccat.despesa||[]).map(c=>({...c,l:c.label,i:c.icon}))]
  }),[ccat]);
  const getCat=useCallback(id=>{for(const list of Object.values(cats)){const f=list.find(c=>c.id===id);if(f)return f;}return{l:id,i:"•"};},[cats]);

  // ── Auto-materialise recurring ──
  useEffect(()=>{
    if(!rec.length||!dataLoaded)return;
    const done=new Set(tx.filter(t=>t.rk).map(t=>t.rk));
    const add=[];
    for(const tpl of rec){
      if(!tpl.freq||tpl.freq==="none")continue;
      for(const o of autoOccs(tpl,done)){
        // Compute payDate if card
        const card=tpl.atype==="card"?crds.find(c=>c.id==tpl.aid):null;
        const payDate=card?cardPayDate(o.date,card.due):undefined;
        add.push({id:`r_${tpl.id}_${o.orig}`,rk:o.key,rid:tpl.id,type:tpl.type,amt:tpl.amt,desc:tpl.desc,cat:tpl.cat,date:o.date,payDate,note:tpl.note||"",atype:tpl.atype,aid:tpl.aid,auto:true,paid:tpl.autoPaid===true});
      }
    }
    if(add.length)setTx(p=>{const ex=new Set(p.map(t=>t.id));return[...p,...add.filter(t=>!ex.has(t.id))];});
  },[rec,dataLoaded,crds]);

  // ── Auto-materialise installments ──
  useEffect(()=>{
    if(!inst.length||!dataLoaded)return;
    const now=new Date();const add=[];
    for(const ins of inst){
      for(let i=0;i<ins.icount;i++){
        const d=pd(ins.startDate);d.setMonth(d.getMonth()+i);
        const raw=d.toISOString().split("T")[0];const adj=adjBiz(raw,ins.bday||"ignore");
        if(pd(adj)>now)continue;
        const iid=`i_${ins.id}_${i+1}`;
        if(!tx.find(t=>t.id===iid)){
          const card=ins.atype==="card"?crds.find(c=>c.id==ins.aid):null;
          const payDate=card?cardPayDate(adj,card.due):undefined;
          add.push({id:iid,iid:ins.id,iidx:i+1,type:ins.type,amt:ins.tamt/ins.icount,desc:ins.desc,cat:ins.cat,date:adj,payDate,note:ins.note||"",atype:ins.atype,aid:ins.aid,auto:true,paid:false});
        }
      }
    }
    if(add.length)setTx(p=>{const ex=new Set(p.map(t=>t.id));return[...p,...add.filter(t=>!ex.has(t.id))];});
  },[inst,dataLoaded,crds]);

  // ── Derived data ──
  const {m,y}=filt;
  const NOW=useMemo(()=>new Date(),[]);

  // confM: for card transactions use payDate (billing month), for banks use date
  const confM=useMemo(()=>tx.filter(t=>{
    const filterDate=t.atype==="card"&&t.payDate?t.payDate:t.date;
    const d=pd(filterDate);
    return d.getMonth()===m&&d.getFullYear()===y;
  }),[tx,m,y]);

  const fcasts=useMemo(()=>{
    const items=[];
    for(const tpl of rec){if(!tpl.freq||tpl.freq==="none")continue;
      for(const o of recInMonth(tpl,m,y)){const d=pd(o.date);if(d<=NOW)continue;
        if(!tx.find(t=>t.rk===`${tpl.id}__${o.orig}`)){
          const card=tpl.atype==="card"?crds.find(c=>c.id==tpl.aid):null;
          const payDate=card?cardPayDate(o.date,card.due):undefined;
          items.push({_fid:`fr_${tpl.id}_${o.orig}`,type:tpl.type,amt:tpl.amt,desc:tpl.desc,cat:tpl.cat,date:o.date,payDate,atype:tpl.atype,aid:tpl.aid,isRF:true,rid:tpl.id,orig:o.orig});
        }
      }
    }
    for(const ins of inst){
      for(const o of instInMonth(ins,m,y)){const d=pd(o.date);if(d<=NOW)continue;
        const iid=`i_${ins.id}_${o.idx}`;
        if(!tx.find(t=>t.id===iid)){
          const card=ins.atype==="card"?crds.find(c=>c.id==ins.aid):null;
          const payDate=card?cardPayDate(o.date,card.due):undefined;
          items.push({_fid:`fi_${ins.id}_${o.idx}`,type:ins.type,amt:o.amt,desc:ins.desc,cat:ins.cat,date:o.date,payDate,atype:ins.atype,aid:ins.aid,isIF:true,iidx:o.idx,icount:ins.icount,tamt:ins.tamt});
        }
      }
    }
    return items.sort((a,b)=>pd(a.date)-pd(b.date));
  },[rec,inst,tx,m,y,NOW,crds]);

  const allM=useMemo(()=>[...confM.map(t=>({...t,real:true})),...fcasts].sort((a,b)=>{
    const da=pd((a.atype==="card"&&a.payDate)?a.payDate:a.date);
    const db2=pd((b.atype==="card"&&b.payDate)?b.payDate:b.date);
    return db2-da;
  }),[confM,fcasts]);

  // totR/totD: only PAID transactions for "real" balance
  const totR=useMemo(()=>confM.filter(t=>t.type==="receita"&&!t.isTE&&t.paid!==false).reduce((s,t)=>s+t.amt,0),[confM]);
  const totD=useMemo(()=>confM.filter(t=>t.type==="despesa"&&!t.isTO&&t.paid!==false).reduce((s,t)=>s+t.amt,0),[confM]);
  const saldo=totR-totD;
  // pending (unpaid) totals
  const pendR=useMemo(()=>confM.filter(t=>t.type==="receita"&&!t.isTE&&t.paid===false).reduce((s,t)=>s+t.amt,0),[confM]);
  const pendD=useMemo(()=>confM.filter(t=>t.type==="despesa"&&!t.isTO&&t.paid===false).reduce((s,t)=>s+t.amt,0),[confM]);

  const fcR=useMemo(()=>fcasts.filter(f=>f.type==="receita").reduce((s,f)=>s+f.amt,0),[fcasts]);
  const fcD=useMemo(()=>fcasts.filter(f=>f.type==="despesa").reduce((s,f)=>s+f.amt,0),[fcasts]);
  const saldoP=(totR+fcR+pendR)-(totD+fcD+pendD);

  const catD=useMemo(()=>confM.filter(t=>t.type==="despesa"&&!t.isTO&&t.paid!==false).reduce((a,t)=>{a[t.cat]=(a[t.cat]||0)+t.amt;return a;},{}),[confM]);
  const catDF=useMemo(()=>[...confM.filter(t=>t.type==="despesa"&&!t.isTO&&t.paid!==false),...fcasts.filter(f=>f.type==="despesa")].reduce((a,t)=>{a[t.cat]=(a[t.cat]||0)+t.amt;return a;},{}),[confM,fcasts]);

  // bbal: only paid bank transactions (hidden accounts still tracked separately)
  const bbal=useCallback(b=>{
    const s=tx.filter(t=>t.atype==="bank"&&t.aid===b.id&&t.paid!==false).reduce((s,t)=>s+(t.type==="receita"?t.amt:-t.amt),0);
    return(parseFloat(b.bal)||0)+s;
  },[tx]);

  // tbb: only visible (non-hidden) banks
  const visibleBnks=useMemo(()=>bnks.filter(b=>!b.hidden),[bnks]);
  const tbb=useMemo(()=>visibleBnks.reduce((s,b)=>s+bbal(b),0),[visibleBnks,bbal]);

  const csp=useCallback(cid=>confM.filter(t=>t.atype==="card"&&t.aid===cid&&t.type==="despesa"&&t.paid!==false).reduce((s,t)=>s+t.amt,0),[confM]);
  const alab=useCallback(t=>{
    if(t.atype==="bank"){const b=bnks.find(b=>b.id===t.aid);return b?`${b.icon} ${b.name}`:""; }
    if(t.atype==="card"){const c=crds.find(c=>c.id===t.aid);return c?`${c.icon} ${c.name}`:""; }
    return "";
  },[bnks,crds]);

  const realPie=useMemo(()=>{
    const e=Object.entries(catD).filter(([,v])=>v>0);
    const sl=e.map(([id,v],i)=>({l:getCat(id).l,i:getCat(id).i,v,c:PCOLS[i%PCOLS.length]}));
    const used=e.reduce((s,[,v])=>s+v,0);
    if(totR>used)sl.push({l:"Livre",v:totR-used,c:"#1e3a5f"});
    return sl;
  },[catD,totR,getCat]);
  const prevPie=useMemo(()=>{
    const e=Object.entries(catDF).filter(([,v])=>v>0);
    const sl=e.map(([id,v],i)=>({l:getCat(id).l,v,c:PCOLS[i%PCOLS.length]}));
    const used=e.reduce((s,[,v])=>s+v,0),tot=totR+fcR;
    if(tot>used)sl.push({l:"Livre",v:tot-used,c:"#1e3a5f"});
    return sl;
  },[catDF,totR,fcR,getCat]);
  const riskP=useMemo(()=>(totR+fcR)>0?(totD+fcD)/(totR+fcR):0,[totR,totD,fcR,fcD]);
  const daysM=new Date(y,m+1,0).getDate();
  const dayN=m===NOW.getMonth()&&y===NOW.getFullYear()?NOW.getDate():daysM;

  const pM=useCallback(()=>setFilt(f=>f.m===0?{m:11,y:f.y-1}:{m:f.m-1,y:f.y}),[]);
  const nM=useCallback(()=>setFilt(f=>f.m===11?{m:0,y:f.y+1}:{m:f.m+1,y:f.y}),[]);
  const toast$=useCallback((msg,col="#22c55e")=>{setTst({msg,col});setTimeout(()=>setTst(null),2600);},[]);

  const handleUnlock=useCallback((newPin)=>{
    if(newPin){setSavedPin(newPin);saveUserData(user.uid,{pin:newPin});}
    setLocked(false);
  },[user]);
  const handleLogout=useCallback(async()=>{
    if(saveTimer.current)clearTimeout(saveTimer.current);
    await signOut(auth);
    toast$("Sessão encerrada","#f97316");
  },[toast$]);

  // ── Toggle paid ──
  const togglePaid=useCallback(id=>{
    setTx(p=>p.map(t=>t.id===id?{...t,paid:t.paid===false?true:false}:t));
  },[]);

  // ── Installment preview (hook must be before any early return) ──
  const instPreview=useMemo(()=>{
    if(!form.inst||!form.tamt||!form.date)return[];
    const ic=parseInt(form.icount)||2;
    const amt=parseFloat(String(form.tamt).replace(",","."))||0;
    const card=form.atype==="card"?crds.find(c=>c.id==(parseInt(form.aid)||form.aid)):null;
    const res=[];
    for(let i=0;i<ic;i++){
      const d=pd(form.date);d.setMonth(d.getMonth()+i);
      const raw=d.toISOString().split("T")[0];
      const adj=adjBiz(raw,form.bday||"ignore");
      const pay=card?cardPayDate(adj,card.due):adj;
      res.push({n:i+1,purchaseDate:adj,payDate:pay,amt:amt/ic});
    }
    return res;
  },[form.inst,form.tamt,form.date,form.icount,form.atype,form.aid,form.bday,crds]);

  // ── All hooks before returns ──
  if(user===undefined)return<Loader/>;
  if(!user)return<LoginScreen/>;
  if(locked&&dataLoaded)return<PinScreen savedPin={savedPin} onUnlock={handleUnlock}/>;
  if(!dataLoaded)return<Loader icon="☁️" msg="Sincronizando dados…"/>;

  // ── Actions ──
  const submit=()=>{
    if(form.isTransfer){
      const a=parseFloat(String(form.amt).replace(",","."));
      if(!a||a<=0){toast$("Valor inválido","#ef4444");return;}
      if(!form.aid||!form.toAid){toast$("Selecione as contas","#ef4444");return;}
      if(String(form.aid)===String(form.toAid)&&form.atype===form.toAtype){toast$("Contas iguais","#ef4444");return;}
      const adjD=adjBiz(form.date,form.bday);const tid=Date.now();
      const toLabel=form.toAtype==="bank"?bnks.find(b=>b.id==form.toAid)?.name||"destino":crds.find(c=>c.id==form.toAid)?.name||"destino";
      const frLabel=form.atype==="bank"?bnks.find(b=>b.id==form.aid)?.name||"origem":crds.find(c=>c.id==form.aid)?.name||"origem";
      setTx(p=>[
        {id:tid,  type:"despesa",amt:a,desc:`↔ Para: ${toLabel}`,cat:"transf",date:adjD,note:form.note||"",atype:form.atype,aid:parseInt(form.aid)||form.aid,isTO:true,pair:tid+1,paid:true},
        {id:tid+1,type:"receita",amt:a,desc:`↔ De: ${frLabel}`, cat:"transf",date:adjD,note:form.note||"",atype:form.toAtype,aid:parseInt(form.toAid)||form.toAid,isTE:true,pair:tid,paid:true},
        ...p
      ]);
      toast$("Transferência registrada ✓");setForm(mf());nav("home");return;
    }
    const rawA=form.inst?parseFloat(String(form.tamt).replace(",",".")):parseFloat(String(form.amt).replace(",","."));
    if(!rawA||rawA<=0){toast$("Valor inválido","#ef4444");return;}
    if(!form.desc.trim()){toast$("Descrição obrigatória","#ef4444");return;}
    if(form.inst){
      const ic=parseInt(form.icount)||2;
      setInst(p=>[...p,{id:Date.now(),type:form.type,tamt:rawA,desc:form.desc,cat:form.cat,startDate:form.date,note:form.note||"",atype:form.atype,aid:parseInt(form.aid)||form.aid,icount:ic,bday:form.bday}]);
      toast$(`Parcelado em ${ic}x de ${fmt(rawA/ic)} ✓`);setForm(mf());nav("home");return;
    }
    if(form.freq!=="none"||recEid){
      const tpl={id:recEid||Date.now(),type:form.type,amt:rawA,desc:form.desc,cat:form.cat,startDate:form.date,note:form.note||"",atype:form.atype,aid:parseInt(form.aid)||form.aid,freq:form.freq,bday:form.bday,autoPaid:form.autoPaid||false};
      if(recEid){setRec(p=>p.map(r=>r.id===recEid?tpl:r));setRecEid(null);toast$("Recorrência atualizada ✓");}
      else{setRec(p=>[...p,tpl]);toast$("Recorrência salva ✓");}
      setForm(mf());nav("home");return;
    }
    const adjD=adjBiz(form.date,form.bday);
    // Compute card payDate
    const cardObj=form.atype==="card"?crds.find(c=>c.id==(parseInt(form.aid)||form.aid)):null;
    const payDate=cardObj?cardPayDate(adjD,cardObj.due):undefined;
    if(eid){
      setTx(p=>p.map(t=>t.id===eid?{...t,type:form.type,amt:rawA,desc:form.desc,cat:form.cat,date:adjD,payDate,note:form.note||"",atype:form.atype,aid:parseInt(form.aid)||form.aid}:t));
      setEid(null);toast$("Atualizado ✓");
    } else {
      setTx(p=>[{id:Date.now(),type:form.type,amt:rawA,desc:form.desc,cat:form.cat,date:adjD,payDate,note:form.note||"",atype:form.atype,aid:parseInt(form.aid)||form.aid,paid:true},...p]);
      toast$(form.type==="receita"?"Receita adicionada ✓":"Despesa adicionada ✓");
    }
    setForm(mf());nav("home");
  };

  const startE=t=>{setEid(t.id);setForm({...mf(),type:t.type,amt:String(t.amt),desc:t.desc,cat:t.cat,date:t.date,note:t.note||"",atype:t.atype||"bank",aid:t.aid||""});nav("add");};
  const startRecE=r=>{setRecEid(r.id);setForm({...mf(),type:r.type,amt:String(r.amt),desc:r.desc,cat:r.cat,date:r.startDate,note:r.note||"",atype:r.atype||"bank",aid:r.aid||"",freq:r.freq||"monthly",bday:r.bday||"ignore",autoPaid:r.autoPaid||false});nav("add");};
  const dTx=id=>{setTx(p=>p.filter(t=>t.id!==id));toast$("Removido","#f97316");};
  const dRec=id=>{setRec(p=>p.filter(r=>r.id!==id));setTx(p=>p.filter(t=>t.rid!==id));toast$("Removida","#f97316");};
  const dInst=id=>{setInst(p=>p.filter(i=>i.id!==id));setTx(p=>p.filter(t=>t.iid!==id));toast$("Removido","#f97316");};
  const sBank=()=>{const bal=parseFloat(String(bf.bal).replace(",","."));if(!bf.name.trim()){toast$("Nome obrigatório","#ef4444");return;}if(ebid){setBnks(p=>p.map(b=>b.id===ebid?{...b,...bf,bal:isNaN(bal)?0:bal}:b));setEbid(null);}else setBnks(p=>[...p,{id:Date.now(),...bf,bal:isNaN(bal)?0:bal}]);setBf(EB);toast$("Banco salvo ✓");};
  const sCard=()=>{const lim=parseFloat(String(cf.lim).replace(",","."));if(!cf.name.trim()){toast$("Nome obrigatório","#ef4444");return;}if(ecid){setCrds(p=>p.map(c=>c.id===ecid?{...c,...cf,lim:isNaN(lim)?0:lim}:c));setEcid(null);}else setCrds(p=>[...p,{id:Date.now(),...cf,lim:isNaN(lim)?0:lim}]);setCf(EC);toast$("Cartão salvo ✓");};
  const sCat=()=>{if(!catF.label.trim()){toast$("Nome obrigatório","#ef4444");return;}const nc={id:`c_${Date.now()}`,label:catF.label,icon:catF.icon,l:catF.label,i:catF.icon,custom:true};setCcat(p=>({...p,[catF.type]:[...(p[catF.type]||[]),nc]}));setCatF({label:"",icon:"🎯",type:"despesa"});toast$("Categoria criada ✓");};
  const dCat=(type,id)=>{setCcat(p=>({...p,[type]:(p[type]||[]).filter(c=>c.id!==id)}));toast$("Removida","#f97316");};
  const dBank=id=>{setBnks(p=>p.filter(b=>b.id!==id));toast$("Removido","#f97316");};
  const dCard=id=>{setCrds(p=>p.filter(c=>c.id!==id));toast$("Removido","#f97316");};
  const toggleHidden=id=>{setBnks(p=>p.map(b=>b.id===id?{...b,hidden:!b.hidden}:b));};



  // ── Shared UI ──
  const Hd=({back,title})=>(
    <div style={{display:"flex",alignItems:"center",gap:11}}>
      <button onClick={back} style={{background:"#1e293b",border:"none",color:"#94a3b8",width:36,height:36,borderRadius:10,fontSize:18,flexShrink:0}}>←</button>
      <h2 style={{fontSize:16,fontWeight:700}}>{title}</h2>
    </div>
  );

  const TxRow=({t,onE,onD,onTogglePaid})=>{
    const cat=getCat(t.cat);const isTr=t.isTO||t.isTE;const al=alab(t);
    const isPaid=t.paid!==false;
    const isCard=t.atype==="card";
    const billingDate=isCard&&t.payDate?t.payDate:null;
    return(
      <div className={`card ${t.real===false?"fc":""} ${!isPaid&&t.real?"unpaid-row":""}`} style={{display:"flex",alignItems:"center",gap:10,padding:"11px 13px"}}>
        {/* Paid indicator / toggle */}
        {t.real&&!isTr&&onTogglePaid&&(
          <button onClick={()=>onTogglePaid(t.id)} title={isPaid?"Marcar como pendente":"Confirmar pagamento"}
            style={{width:22,height:22,borderRadius:"50%",border:`2px solid ${isPaid?"#34d399":"#f59e0b"}`,background:isPaid?"#064e3b":"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontSize:12,color:isPaid?"#34d399":"#f59e0b",cursor:"pointer"}}>
            {isPaid?"✓":"○"}
          </button>
        )}
        <div style={{width:36,height:36,borderRadius:10,background:isTr?"#1e3a5f":t.type==="receita"?"#064e3b":"#450a0a",display:"flex",alignItems:"center",justifyContent:"center",fontSize:17,flexShrink:0}}>
          {isTr?"↔️":cat.i}
        </div>
        <div style={{flex:1,minWidth:0}}>
          <div style={{display:"flex",alignItems:"center",gap:4,flexWrap:"nowrap"}}>
            <p style={{fontSize:13,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.desc}</p>
            {t.iidx&&<span className="bdg" style={{background:"#1e3a5f",color:"#7dd3fc",flexShrink:0}}>{t.iidx}/{t.icount}</span>}
            {t.auto&&t.rid&&<span className="bdg" style={{background:"#2d1a4f",color:"#c4b5fd",flexShrink:0}}>🔁</span>}
            {!t.real&&<span className="bdg" style={{background:"#0c2340",color:"#7dd3fc",flexShrink:0}}>🔮</span>}
            {!isPaid&&t.real&&<span className="bdg" style={{background:"#451a03",color:"#f59e0b",flexShrink:0}}>pendente</span>}
          </div>
          <p style={{fontSize:10,color:"#64748b",marginTop:1}}>
            {billingDate
              ? <>compra {pd(t.date).toLocaleDateString("pt-BR")} · venc {pd(billingDate).toLocaleDateString("pt-BR")}</>
              : pd(t.date).toLocaleDateString("pt-BR")
            }
            {al?` · ${al}`:""}
          </p>
        </div>
        <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:5,flexShrink:0}}>
          <span style={{fontWeight:700,fontSize:13,color:t.type==="receita"?"#34d399":"#f87171"}}>
            {t.type==="receita"?"+":"-"}{fmt(t.amt)}
          </span>
          {t.real&&!t.auto&&!isTr&&(
            <div style={{display:"flex",gap:5}}>
              {onE&&<button onClick={()=>onE(t)} className="ab" style={{background:"#1e3a5f",color:"#38bdf8"}}>editar</button>}
              <button onClick={()=>onD(t.id)} className="ab" style={{background:"#450a0a",color:"#f87171"}}>×</button>
            </div>
          )}
          {t.real&&(t.auto||isTr)&&<button onClick={()=>onD(t.id)} className="ab" style={{background:"#450a0a",color:"#f87171"}}>×</button>}
        </div>
      </div>
    );
  };

  const BdayRow=()=>(
    <div>
      <p style={{fontSize:10,color:"#94a3b8",marginBottom:5,fontWeight:600}}>DIA ÚTIL</p>
      <div className="seg">{[{id:"ignore",l:"Ignorar"},{id:"next",l:"Próx. útil"},{id:"prev",l:"Útil ant."}].map(o=>(
        <button key={o.id} className={`st ${form.bday===o.id?"on":""}`} onClick={()=>setForm(f=>({...f,bday:o.id}))}>{o.l}</button>
      ))}</div>
    </div>
  );

  const AccPicker=({label,atKey,aidKey})=>(
    <div>
      <p style={{fontSize:10,color:"#94a3b8",marginBottom:5,fontWeight:600}}>{label}</p>
      <div className="seg" style={{marginBottom:8}}>
        {bnks.length>0&&<button className={`st ${form[atKey]==="bank"?"on":""}`} onClick={()=>setForm(f=>({...f,[atKey]:"bank",[aidKey]:bnks[0]?.id||""}))}>🏦 Banco</button>}
        {crds.length>0&&<button className={`st ${form[atKey]==="card"?"on":""}`} onClick={()=>setForm(f=>({...f,[atKey]:"card",[aidKey]:crds[0]?.id||""}))}>💳 Cartão</button>}
      </div>
      {form[atKey]==="bank"&&bnks.length>0&&<select className="fi" value={form[aidKey]} onChange={e=>setForm(f=>({...f,[aidKey]:parseInt(e.target.value)}))}>
        {bnks.map(b=><option key={b.id} value={b.id}>{b.icon} {b.name}{b.hidden?" (oculta)":""}{label==="CONTA ORIGEM"?` (${fmt(bbal(b))})`:""}</option>)}
      </select>}
      {form[atKey]==="card"&&crds.length>0&&<select className="fi" value={form[aidKey]} onChange={e=>setForm(f=>({...f,[aidKey]:parseInt(e.target.value)}))}>
        {crds.map(c=><option key={c.id} value={c.id}>{c.icon} {c.name} (vence dia {c.due})</option>)}
      </select>}
    </div>
  );

  const firstAcc=bnks.length>0?{atype:"bank",aid:bnks[0].id}:crds.length>0?{atype:"card",aid:crds[0].id}:{atype:"bank",aid:""};

  // ── RENDER ─────────────────────────────────────────────────────────────────
  return(
    <div style={{background:"#0f172a",minHeight:"100dvh",fontFamily:"'DM Sans',system-ui,sans-serif",color:"#e2e8f0",maxWidth:480,margin:"0 auto",position:"relative"}}>
      <style>{CSS}</style>

      {tst&&<div style={{position:"fixed",top:"calc(16px + env(safe-area-inset-top))",left:"50%",transform:"translateX(-50%)",background:tst.col,color:"#fff",padding:"9px 18px",borderRadius:99,fontSize:13,fontWeight:600,zIndex:999,whiteSpace:"nowrap",boxShadow:"0 4px 24px rgba(0,0,0,.5)",pointerEvents:"none"}}>{tst.msg}</div>}

      {mdl&&<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.8)",zIndex:998,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
        <div className="card si" style={{width:"100%",maxWidth:320}}>
          <p style={{fontSize:15,fontWeight:700,marginBottom:6}}>{mdl.title}</p>
          {mdl.body&&<p style={{fontSize:12,color:"#94a3b8",marginBottom:18,lineHeight:1.5}}>{mdl.body}</p>}
          <div style={{display:"flex",gap:10,marginTop:mdl.body?0:18}}>
            <button onClick={()=>setMdl(null)} style={{flex:1,padding:12,background:"#334155",border:"none",borderRadius:10,color:"#e2e8f0",fontWeight:600,fontSize:14}}>Cancelar</button>
            <button onClick={()=>{mdl.action();setMdl(null);}} style={{flex:1,padding:12,background:mdl.danger?"#ef4444":"linear-gradient(135deg,#38bdf8,#818cf8)",border:"none",borderRadius:10,color:"#fff",fontWeight:600,fontSize:14}}>{mdl.btn||"OK"}</button>
          </div>
        </div>
      </div>}

      {/* Header */}
      <div style={{padding:"calc(14px + env(safe-area-inset-top)) 18px 0",display:"flex",alignItems:"center",justifyContent:"space-between",background:"#0f172a",position:"sticky",top:0,zIndex:10}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          {user?.photoURL&&<img src={user.photoURL} style={{width:28,height:28,borderRadius:"50%",flexShrink:0}} alt="" referrerPolicy="no-referrer"/>}
          <span style={{fontSize:12,color:"#64748b",fontWeight:600,maxWidth:100,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{user?.displayName?.split(" ")[0]||"Carteira"}</span>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:7}}>
          <button onClick={pM} style={{background:"#1e293b",border:"none",color:"#94a3b8",width:30,height:30,borderRadius:9,fontSize:16}}>‹</button>
          <span style={{fontSize:13,fontWeight:700,color:"#e2e8f0",minWidth:80,textAlign:"center"}}>{MS[m]} {y}</span>
          <button onClick={nM} style={{background:"#1e293b",border:"none",color:"#94a3b8",width:30,height:30,borderRadius:9,fontSize:16}}>›</button>
          <button onClick={()=>setMdl({title:"Sair da conta?",body:user?.email,danger:false,btn:"Sair",action:handleLogout})} style={{background:"#1e293b",border:"none",color:"#64748b",width:30,height:30,borderRadius:9,fontSize:14}}>↩</button>
        </div>
      </div>

      {/* Scrollable content */}
      <div ref={mainRef} style={{overflowY:"auto",paddingBottom:"calc(76px + env(safe-area-inset-bottom))",WebkitOverflowScrolling:"touch"}}>

        {/* ══ HOME ══ */}
        {view==="home"&&<div className="si" style={{padding:"12px 18px",display:"flex",flexDirection:"column",gap:13}}>
          <div style={{background:"linear-gradient(135deg,#1e3a5f,#1e293b)",borderRadius:20,padding:18,border:"1px solid #2d4a6b"}}>
            <div style={{display:"flex",gap:14,flexWrap:"wrap",alignItems:"flex-end"}}>
              <div>
                <p style={{fontSize:10,color:"#94a3b8",fontWeight:600,letterSpacing:.5}}>SALDO REAL</p>
                <p style={{fontSize:30,fontWeight:700,color:saldo>=0?"#34d399":"#f87171",fontFamily:"'DM Mono',monospace",letterSpacing:-1}}>{fmt(saldo)}</p>
              </div>
              {(fcasts.length>0||pendD>0||pendR>0)&&<><div style={{width:1,background:"#334155",alignSelf:"stretch"}}/>
              <div>
                <p style={{fontSize:10,color:"#94a3b8",fontWeight:600,letterSpacing:.5}}>PREVISTO</p>
                <p style={{fontSize:20,fontWeight:700,color:saldoP>=0?"#7dd3fc":"#fca5a5",fontFamily:"'DM Mono',monospace"}}>{fmt(saldoP)}</p>
              </div></>}
            </div>
            <div style={{display:"flex",gap:14,marginTop:12,flexWrap:"wrap"}}>
              <div><p style={{fontSize:9,color:"#94a3b8"}}>↑ Receitas</p><p style={{fontSize:13,fontWeight:600,color:"#34d399"}}>{fmt(totR)}</p></div>
              <div><p style={{fontSize:9,color:"#94a3b8"}}>↓ Despesas</p><p style={{fontSize:13,fontWeight:600,color:"#f87171"}}>{fmt(totD)}</p></div>
              {tbb>0&&<div><p style={{fontSize:9,color:"#94a3b8"}}>🏦 Bancos</p><p style={{fontSize:13,fontWeight:600,color:"#38bdf8"}}>{fmt(tbb)}</p></div>}
              {(pendD>0||pendR>0)&&<div><p style={{fontSize:9,color:"#94a3b8"}}>⏳ Pendente</p><p style={{fontSize:13,fontWeight:600,color:"#f59e0b"}}>{pendD>0?`-${fmt(pendD)}`:`+${fmt(pendR)}`}</p></div>}
            </div>
          </div>

          {bnks.length>0&&<div>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
              <p style={{fontSize:10,fontWeight:700,color:"#94a3b8",textTransform:"uppercase",letterSpacing:.5}}>Contas</p>
              <button onClick={()=>{nav("accounts");setAtab("banks");}} style={{background:"none",border:"none",color:"#38bdf8",fontSize:12}}>gerenciar</button>
            </div>
            <div style={{display:"flex",gap:10,overflowX:"auto",paddingBottom:4,scrollbarWidth:"none"}}>
              {bnks.map(b=>{const bal=bbal(b);return(
                <div key={b.id} style={{background:b.hidden?"#1e293b":b.color+"22",border:`1px solid ${b.hidden?"#334155":b.color+"44"}`,borderRadius:14,padding:"11px 14px",minWidth:140,flexShrink:0,opacity:b.hidden?0.5:1}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <p style={{fontSize:18}}>{b.icon}</p>
                    {b.hidden&&<span style={{fontSize:9,color:"#64748b"}}>oculta</span>}
                  </div>
                  <p style={{fontSize:12,fontWeight:600,marginTop:4,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:120}}>{b.name}</p>
                  <p style={{fontSize:14,fontWeight:700,color:bal>=0?"#34d399":"#f87171",fontFamily:"'DM Mono',monospace",marginTop:2}}>{fmt(bal)}</p>
                </div>
              );})}
            </div>
          </div>}

          {crds.length>0&&<div>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
              <p style={{fontSize:10,fontWeight:700,color:"#94a3b8",textTransform:"uppercase",letterSpacing:.5}}>Cartões</p>
              <button onClick={()=>{nav("accounts");setAtab("cards");}} style={{background:"none",border:"none",color:"#38bdf8",fontSize:12}}>gerenciar</button>
            </div>
            <div style={{display:"flex",gap:10,overflowX:"auto",paddingBottom:4,scrollbarWidth:"none"}}>
              {crds.map(c=>{const sp=csp(c.id),lim=parseFloat(c.lim)||0,pct=lim>0?Math.min((sp/lim)*100,100):0,ov=lim>0&&sp>lim;return(
                <div key={c.id} onClick={()=>{setSelC(c);nav("card");}} style={{background:c.color+"33",border:`1px solid ${c.color}55`,borderRadius:14,padding:"11px 14px",minWidth:160,flexShrink:0,cursor:"pointer"}}>
                  <p style={{fontSize:18}}>{c.icon}</p>
                  <p style={{fontSize:12,fontWeight:600,marginTop:4,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:135}}>{c.name}</p>
                  <p style={{fontSize:13,fontWeight:700,color:ov?"#f87171":"#e2e8f0",fontFamily:"'DM Mono',monospace",marginTop:2}}>{fmt(sp)}{lim>0?` / ${fmt(lim)}`:""}</p>
                  {lim>0&&<div className="pb" style={{marginTop:6}}><div className="pf" style={{width:`${pct}%`,background:ov?"#ef4444":c.color}}/></div>}
                  <p style={{fontSize:9,color:"#64748b",marginTop:4}}>Vence dia {c.due}</p>
                </div>
              );})}
            </div>
          </div>}

          <button onClick={()=>{setEid(null);setRecEid(null);setForm({...mf(),...firstAcc});nav("add");}}
            style={{background:"linear-gradient(135deg,#38bdf8,#818cf8)",color:"#fff",border:"none",borderRadius:13,padding:14,fontSize:15,fontWeight:700,width:"100%"}}>
            + Adicionar Lançamento
          </button>

          {Object.keys(catD).length>0&&<div className="card">
            <p style={{fontSize:10,fontWeight:700,color:"#94a3b8",marginBottom:11,textTransform:"uppercase",letterSpacing:.5}}>Por Categoria</p>
            {Object.entries(catD).sort((a,b)=>b[1]-a[1]).map(([cid,val])=>{
              const cat=getCat(cid),pct=totD>0?(val/totD)*100:0,bg=budg[cid],ov=bg&&val>bg;
              return<div key={cid} style={{marginBottom:10}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                  <span style={{fontSize:12,display:"flex",alignItems:"center",gap:5}}>{cat.i} {cat.l}{ov&&<span className="bdg" style={{background:"#450a0a",color:"#f87171"}}>acima</span>}</span>
                  <span style={{fontSize:12,fontWeight:600,color:ov?"#f87171":"#e2e8f0"}}>{fmt(val)}</span>
                </div>
                <div className="pb"><div className="pf" style={{width:`${Math.min(pct,100)}%`,background:ov?"#ef4444":"linear-gradient(90deg,#38bdf8,#818cf8)"}}/></div>
                {bg&&<p style={{fontSize:9,color:"#64748b",marginTop:2}}>Meta: {fmt(bg)}</p>}
              </div>;
            })}
          </div>}

          {fcasts.length>0&&<div className="card" style={{borderLeft:"3px solid #38bdf8"}}>
            <p style={{fontSize:10,fontWeight:700,color:"#7dd3fc",marginBottom:10}}>🔮 Previsões — {fcasts.length} lançamento{fcasts.length!==1?"s":""}</p>
            {fcasts.slice(0,3).map((fc,i)=>{const cat=getCat(fc.cat);return(
              <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"6px 0",borderBottom:i<Math.min(fcasts.length,3)-1?"1px solid #0f172a":"none"}}>
                <span style={{fontSize:16}}>{cat.i}</span>
                <div style={{flex:1,minWidth:0}}>
                  <p style={{fontSize:12,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{fc.desc}</p>
                  <p style={{fontSize:9,color:"#64748b"}}>
                    {fc.payDate&&fc.payDate!==fc.date?`venc ${pd(fc.payDate).toLocaleDateString("pt-BR")}`:pd(fc.date).toLocaleDateString("pt-BR")}
                    {fc.isIF?` · ${fc.iidx}/${fc.icount}`:""}
                  </p>
                </div>
                <span style={{fontSize:12,fontWeight:700,color:fc.type==="receita"?"#34d399":"#f87171",flexShrink:0}}>{fc.type==="receita"?"+":"-"}{fmt(fc.amt)}</span>
              </div>
            );})}
            {fcasts.length>3&&<button onClick={()=>nav("hist")} style={{background:"none",border:"none",color:"#38bdf8",fontSize:12,marginTop:6}}>ver todos ({fcasts.length})</button>}
          </div>}

          {confM.length>0&&<div className="card">
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
              <p style={{fontSize:10,fontWeight:700,color:"#94a3b8",textTransform:"uppercase",letterSpacing:.5}}>Recentes</p>
              <button onClick={()=>nav("hist")} style={{background:"none",border:"none",color:"#38bdf8",fontSize:12}}>ver todos</button>
            </div>
            {[...confM].sort((a,b)=>{
              const da=pd(a.atype==="card"&&a.payDate?a.payDate:a.date);
              const db2=pd(b.atype==="card"&&b.payDate?b.payDate:b.date);
              return db2-da;
            }).slice(0,5).map(t=>{
              const cat=getCat(t.cat);const isTr=t.isTO||t.isTE;const al=alab(t);
              return<div key={t.id} style={{display:"flex",alignItems:"center",gap:10,padding:"7px 0",borderBottom:"1px solid #0f172a",opacity:t.paid===false?0.6:1}}>
                <div style={{width:33,height:33,borderRadius:9,background:isTr?"#1e3a5f":t.type==="receita"?"#064e3b":"#450a0a",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,flexShrink:0}}>{isTr?"↔️":cat.i}</div>
                <div style={{flex:1,minWidth:0}}>
                  <p style={{fontSize:12,fontWeight:500,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.desc}</p>
                  <p style={{fontSize:9,color:"#64748b"}}>{pd(t.date).toLocaleDateString("pt-BR")}{al?` · ${al}`:""}{t.paid===false?" · ⏳":""}</p>
                </div>
                <span style={{fontWeight:700,fontSize:12,color:t.type==="receita"?"#34d399":"#f87171",flexShrink:0}}>{t.type==="receita"?"+":"-"}{fmt(t.amt)}</span>
              </div>;
            })}
          </div>}

          {!tx.length&&!bnks.length&&<div style={{textAlign:"center",padding:"32px 0",color:"#475569"}}>
            <p style={{fontSize:36,marginBottom:12}}>📊</p>
            <p style={{fontSize:14,fontWeight:600,color:"#64748b"}}>Olá, {user?.displayName?.split(" ")[0]}!</p>
            <p style={{fontSize:12,marginTop:4,marginBottom:18}}>Seus dados sincronizam em todos os dispositivos ☁️</p>
            <button onClick={()=>nav("accounts")} style={{background:"linear-gradient(135deg,#38bdf8,#818cf8)",border:"none",color:"#fff",borderRadius:13,padding:"12px 24px",fontWeight:600,fontSize:14}}>Adicionar Conta</button>
          </div>}
        </div>}

        {/* ══ DASHS ══ */}
        {view==="dashs"&&<div className="si" style={{padding:"12px 18px",display:"flex",flexDirection:"column",gap:13}}>
          <h2 style={{fontSize:16,fontWeight:700}}>📊 Dashboards</h2>
          <div className="card">
            <p style={{fontSize:10,fontWeight:700,color:"#94a3b8",textTransform:"uppercase",letterSpacing:.5,marginBottom:12}}>Saúde Hoje — Dia {dayN}/{daysM}</p>
            <div style={{display:"flex",gap:14,flexWrap:"wrap",justifyContent:"space-around",alignItems:"center"}}>
              <Gauge pct={totD/(totR||1)} label={`${Math.round((totD/(totR||1))*100)}%`} sub="da receita gasta" sz={125}/>
              <div style={{display:"flex",flexDirection:"column",gap:8,minWidth:135}}>
                {[["Receita",fmt(totR),"#34d399"],["Despesas",fmt(totD),"#f87171"],["Saldo",fmt(saldo),saldo>=0?"#34d399":"#f87171"]].map(([l,v,c])=>(
                  <div key={l} style={{background:"#0f172a",borderRadius:10,padding:"8px 12px"}}><p style={{fontSize:9,color:"#94a3b8"}}>{l}</p><p style={{fontSize:13,fontWeight:700,color:c,fontFamily:"'DM Mono',monospace"}}>{v}</p></div>
                ))}
              </div>
            </div>
            {bnks.some(b=>b.hidden)&&<p style={{fontSize:10,color:"#64748b",marginTop:10,textAlign:"center"}}>* Contas ocultas excluídas da análise</p>}
          </div>
          <div className="card" style={{borderLeft:`3px solid ${riskP>0.85?"#ef4444":riskP>0.6?"#f59e0b":"#34d399"}`}}>
            <p style={{fontSize:10,fontWeight:700,color:"#94a3b8",textTransform:"uppercase",letterSpacing:.5,marginBottom:12}}>Risco até fim do mês</p>
            <div style={{display:"flex",gap:14,flexWrap:"wrap",justifyContent:"space-around",alignItems:"center"}}>
              <div style={{textAlign:"center"}}>
                <Gauge pct={riskP} label={`${Math.round(riskP*100)}%`} sub="despesas / receita" sz={125}/>
                <p style={{fontSize:11,fontWeight:600,marginTop:4,color:riskP>0.85?"#ef4444":riskP>0.6?"#f59e0b":"#34d399"}}>{riskP>0.85?"⚠️ Risco alto":riskP>0.6?"⚡ Atenção":"✅ Sob controle"}</p>
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:8,minWidth:135}}>
                {[["Desp. previstas",fmt(totD+fcD),"#f87171"],["Rec. prevista",fmt(totR+fcR),"#34d399"],["Sobra prev.",fmt(saldoP),saldoP>=0?"#34d399":"#f87171"]].map(([l,v,c])=>(
                  <div key={l} style={{background:"#0f172a",borderRadius:10,padding:"8px 12px"}}><p style={{fontSize:9,color:"#94a3b8"}}>{l}</p><p style={{fontSize:13,fontWeight:700,color:c,fontFamily:"'DM Mono',monospace"}}>{v}</p></div>
                ))}
              </div>
            </div>
          </div>
          <div className="card">
            <p style={{fontSize:10,fontWeight:700,color:"#94a3b8",textTransform:"uppercase",letterSpacing:.5,marginBottom:12}}>Consumo real da receita</p>
            {totR===0?<p style={{fontSize:12,color:"#475569",textAlign:"center",padding:"16px 0"}}>Nenhuma receita confirmada</p>:
            <div style={{display:"flex",gap:14,alignItems:"center",flexWrap:"wrap",justifyContent:"center"}}>
              <Pie slices={realPie} sz={155} label={fmt(saldo)} sub="saldo livre"/>
              <div style={{display:"flex",flexDirection:"column",gap:5,flex:1,minWidth:120}}>
                {realPie.map((sl,i)=><div key={i} style={{display:"flex",alignItems:"center",gap:6}}>
                  <div style={{width:9,height:9,borderRadius:2,background:sl.c,flexShrink:0}}/>
                  <p style={{fontSize:10,color:"#94a3b8",flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{sl.i||""} {sl.l}</p>
                  <p style={{fontSize:10,fontWeight:600,color:"#e2e8f0",flexShrink:0}}>{totR>0?Math.round((sl.v/totR)*100):0}%</p>
                </div>)}
              </div>
            </div>}
          </div>
          <div className="card" style={{borderLeft:"3px solid #7dd3fc"}}>
            <p style={{fontSize:10,fontWeight:700,color:"#94a3b8",textTransform:"uppercase",letterSpacing:.5,marginBottom:12}}>🔮 Consumo previsto</p>
            {(totR+fcR)===0?<p style={{fontSize:12,color:"#475569",textAlign:"center",padding:"16px 0"}}>Sem dados previstos</p>:
            <div style={{display:"flex",gap:14,alignItems:"center",flexWrap:"wrap",justifyContent:"center"}}>
              <Pie slices={prevPie} sz={155} label={fmt(saldoP)} sub="sobra prevista"/>
              <div style={{display:"flex",flexDirection:"column",gap:5,flex:1,minWidth:120}}>
                {prevPie.map((sl,i)=>{const tot=totR+fcR;return<div key={i} style={{display:"flex",alignItems:"center",gap:6}}>
                  <div style={{width:9,height:9,borderRadius:2,background:sl.c,flexShrink:0}}/>
                  <p style={{fontSize:10,color:"#94a3b8",flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{sl.l}</p>
                  <p style={{fontSize:10,fontWeight:600,color:"#e2e8f0",flexShrink:0}}>{tot>0?Math.round((sl.v/tot)*100):0}%</p>
                </div>;})}
              </div>
            </div>}
          </div>
          {Object.keys(catDF).length>0&&<div className="card">
            <p style={{fontSize:10,fontWeight:700,color:"#94a3b8",textTransform:"uppercase",letterSpacing:.5,marginBottom:12}}>Despesas por Categoria</p>
            {Object.entries(catDF).sort((a,b)=>b[1]-a[1]).map(([cid,val],i)=>{
              const cat=getCat(cid),rv=catD[cid]||0,bg=budg[cid],ov=bg&&val>bg,mx=Math.max(...Object.values(catDF));
              return<div key={cid} style={{marginBottom:10}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                  <span style={{fontSize:11,display:"flex",alignItems:"center",gap:4}}>{cat.i} {cat.l}{ov&&<span className="bdg" style={{background:"#450a0a",color:"#f87171"}}>acima</span>}</span>
                  <div style={{textAlign:"right"}}><span style={{fontSize:11,fontWeight:600}}>{fmt(rv)}</span>{val>rv&&<span style={{fontSize:9,color:"#7dd3fc",marginLeft:3}}>+{fmt(val-rv)}</span>}</div>
                </div>
                <div style={{height:7,background:"#0f172a",borderRadius:99,overflow:"hidden",position:"relative"}}>
                  <div style={{position:"absolute",top:0,left:0,height:"100%",width:`${(rv/mx)*100}%`,background:ov?"#ef4444":PCOLS[i%PCOLS.length],borderRadius:99}}/>
                  {val>rv&&<div style={{position:"absolute",top:0,left:`${(rv/mx)*100}%`,height:"100%",width:`${((val-rv)/mx)*100}%`,background:"#7dd3fc33",borderRadius:99}}/>}
                </div>
                {bg&&<p style={{fontSize:9,color:"#64748b",marginTop:2}}>Meta: {fmt(bg)}</p>}
              </div>;
            })}
          </div>}
        </div>}

        {/* ══ ADD ══ */}
        {view==="add"&&<div className="si" style={{padding:"12px 18px",display:"flex",flexDirection:"column",gap:12}}>
          <Hd back={()=>{nav("home");setEid(null);setRecEid(null);}} title={recEid?"Editar Recorrência":eid?"Editar Lançamento":"Novo Lançamento"}/>

          {!eid&&!recEid&&<div style={{display:"flex",alignItems:"center",justifyContent:"space-between",background:"#1e293b",borderRadius:12,padding:"11px 14px"}}>
            <div><p style={{fontSize:13,fontWeight:600}}>↔️ Transferência entre contas</p><p style={{fontSize:11,color:"#64748b",marginTop:2}}>Mover saldo de uma conta para outra</p></div>
            <button className={`tog ${form.isTransfer?"on":"off"}`} onClick={()=>setForm(f=>({...f,isTransfer:!f.isTransfer,inst:false,freq:"none"}))}/>
          </div>}

          {form.isTransfer?<>
            <div><p style={{fontSize:10,color:"#94a3b8",marginBottom:5,fontWeight:600}}>VALOR (R$)</p>
              <input className="fi" type="number" inputMode="decimal" placeholder="0,00" value={form.amt} onChange={e=>setForm(f=>({...f,amt:e.target.value}))} style={{fontSize:24,fontWeight:700,fontFamily:"'DM Mono',monospace",color:"#38bdf8"}}/>
            </div>
            <AccPicker label="CONTA ORIGEM" atKey="atype" aidKey="aid"/>
            <div style={{textAlign:"center",color:"#38bdf8",fontSize:20,padding:"4px 0"}}>↓</div>
            <AccPicker label="CONTA DESTINO" atKey="toAtype" aidKey="toAid"/>
            <div><p style={{fontSize:10,color:"#94a3b8",marginBottom:5,fontWeight:600}}>DATA</p><input className="fi" type="date" value={form.date} onChange={e=>setForm(f=>({...f,date:e.target.value}))}/></div>
            <BdayRow/>
            <div><p style={{fontSize:10,color:"#94a3b8",marginBottom:5,fontWeight:600}}>OBSERVAÇÃO (opcional)</p><textarea className="fi" rows={2} placeholder="Motivo…" value={form.note} onChange={e=>setForm(f=>({...f,note:e.target.value}))} style={{resize:"none"}}/></div>
            <button onClick={submit} style={{background:"linear-gradient(135deg,#38bdf8,#818cf8)",color:"#fff",border:"none",borderRadius:13,padding:14,fontSize:15,fontWeight:700,width:"100%"}}>Registrar Transferência</button>
          </>:<>
            <div style={{display:"flex",background:"#0f172a",borderRadius:12,padding:4,gap:4}}>
              <button className={`tb d ${form.type==="despesa"?"on":""}`} onClick={()=>setForm(f=>({...f,type:"despesa",cat:"alimentacao"}))}>↓ Despesa</button>
              <button className={`tb r ${form.type==="receita"?"on":""}`} onClick={()=>setForm(f=>({...f,type:"receita",cat:"salario"}))}>↑ Receita</button>
            </div>

            {!eid&&!recEid&&form.type==="despesa"&&form.atype==="card"&&<div style={{display:"flex",alignItems:"center",justifyContent:"space-between",background:"#1e293b",borderRadius:12,padding:"11px 14px"}}>
              <div><p style={{fontSize:13,fontWeight:600}}>💳 Parcelamento</p><p style={{fontSize:11,color:"#64748b",marginTop:2}}>Divide em parcelas mensais no cartão</p></div>
              <button className={`tog ${form.inst?"on":"off"}`} onClick={()=>setForm(f=>({...f,inst:!f.inst,freq:"none"}))}/>
            </div>}

            <div><p style={{fontSize:10,color:"#94a3b8",marginBottom:5,fontWeight:600}}>{form.inst?"VALOR TOTAL (R$)":"VALOR (R$)"}</p>
              <input className="fi" type="number" inputMode="decimal" placeholder="0,00"
                value={form.inst?form.tamt:form.amt}
                onChange={e=>setForm(f=>form.inst?{...f,tamt:e.target.value}:{...f,amt:e.target.value})}
                style={{fontSize:24,fontWeight:700,fontFamily:"'DM Mono',monospace",color:form.type==="receita"?"#34d399":"#f87171"}}/>
            </div>

            {form.inst&&<div>
              <p style={{fontSize:10,color:"#94a3b8",marginBottom:7,fontWeight:600}}>NÚMERO DE PARCELAS</p>
              <div style={{display:"flex",gap:7,flexWrap:"wrap"}}>
                {[2,3,4,5,6,8,10,12,18,24].map(n=>{const tot=parseFloat(String(form.tamt).replace(",","."))||0;return(
                  <button key={n} onClick={()=>setForm(f=>({...f,icount:String(n)}))}
                    style={{padding:"8px 12px",borderRadius:10,border:"1.5px solid",fontSize:12,fontWeight:600,lineHeight:1.4,
                      borderColor:form.icount==n?"#38bdf8":"#334155",background:form.icount==n?"#0c1e2e":"transparent",color:form.icount==n?"#38bdf8":"#64748b"}}>
                    {n}x{tot>0?<><br/><span style={{fontSize:10}}>{fmt(tot/n)}</span></>:""}
                  </button>
                );})}
              </div>
            </div>}

            <div><p style={{fontSize:10,color:"#94a3b8",marginBottom:5,fontWeight:600}}>DESCRIÇÃO</p>
              <input className="fi" type="text" placeholder="Ex: Mercado, Salário…" value={form.desc} onChange={e=>setForm(f=>({...f,desc:e.target.value}))}/>
            </div>

            {(bnks.length>0||crds.length>0)&&<AccPicker label="CONTA" atKey="atype" aidKey="aid"/>}

            {/* Card payDate preview */}
            {form.atype==="card"&&form.date&&!form.inst&&(()=>{
              const card=crds.find(c=>c.id==(parseInt(form.aid)||form.aid));
              if(!card)return null;
              const adj=adjBiz(form.date,form.bday||"ignore");
              const pay=cardPayDate(adj,card.due);
              return<div style={{background:"#0f172a",borderRadius:10,padding:"9px 13px",border:"1px solid #334155"}}>
                <p style={{fontSize:10,color:"#94a3b8",marginBottom:3,fontWeight:600}}>VENCIMENTO NO CARTÃO</p>
                <div style={{display:"flex",justifyContent:"space-between"}}>
                  <div><p style={{fontSize:9,color:"#64748b"}}>Compra</p><p style={{fontSize:12,fontWeight:600,color:"#e2e8f0"}}>{pd(adj).toLocaleDateString("pt-BR")}</p></div>
                  <div style={{color:"#38bdf8",fontSize:16,alignSelf:"center"}}>→</div>
                  <div style={{textAlign:"right"}}><p style={{fontSize:9,color:"#64748b"}}>Pagamento</p><p style={{fontSize:12,fontWeight:600,color:"#38bdf8"}}>{pd(pay).toLocaleDateString("pt-BR")}</p></div>
                </div>
              </div>;
            })()}

            <div><p style={{fontSize:10,color:"#94a3b8",marginBottom:6,fontWeight:600}}>CATEGORIA</p>
              <div className="cg">
                {cats[form.type].map(cat=>(
                  <button key={cat.id} className={`cb ${form.cat===cat.id?"on":""}`} onClick={()=>setForm(f=>({...f,cat:cat.id}))}>
                    <span style={{fontSize:19}}>{cat.i}</span><span style={{textAlign:"center",lineHeight:1.2}}>{cat.l}</span>
                  </button>
                ))}
              </div>
            </div>

            <div><p style={{fontSize:10,color:"#94a3b8",marginBottom:5,fontWeight:600}}>{form.inst?"DATA 1ª PARCELA":recEid?"DATA INÍCIO":"DATA"}</p>
              <input className="fi" type="date" value={form.date} onChange={e=>setForm(f=>({...f,date:e.target.value}))}/>
            </div>

            {!form.inst&&!eid&&<div>
              <p style={{fontSize:10,color:"#94a3b8",marginBottom:5,fontWeight:600}}>REPETIÇÃO</p>
              <select className="fi" value={form.freq} onChange={e=>setForm(f=>({...f,freq:e.target.value}))}>
                {FREQS.map(o=><option key={o.id} value={o.id}>{o.l}</option>)}
              </select>
            </div>}

            {/* autoPaid toggle for recurring */}
            {(form.freq!=="none"||recEid)&&!eid&&<div style={{display:"flex",alignItems:"center",justifyContent:"space-between",background:"#1e293b",borderRadius:12,padding:"11px 14px"}}>
              <div>
                <p style={{fontSize:13,fontWeight:600}}>✅ Confirmar automaticamente</p>
                <p style={{fontSize:11,color:"#64748b",marginTop:2}}>Se ativo, lançamentos já entram como pagos</p>
              </div>
              <button className={`tog ${form.autoPaid?"on":"off"}`} onClick={()=>setForm(f=>({...f,autoPaid:!f.autoPaid}))}/>
            </div>}

            <BdayRow/>

            <div><p style={{fontSize:10,color:"#94a3b8",marginBottom:5,fontWeight:600}}>OBSERVAÇÃO (opcional)</p>
              <textarea className="fi" rows={2} placeholder="Alguma nota…" value={form.note} onChange={e=>setForm(f=>({...f,note:e.target.value}))} style={{resize:"none"}}/>
            </div>

            {/* Installment preview */}
            {form.inst&&instPreview.length>0&&<div className="card" style={{borderLeft:"3px solid #818cf8"}}>
              <p style={{fontSize:10,fontWeight:700,color:"#94a3b8",marginBottom:10,textTransform:"uppercase",letterSpacing:.5}}>Prévia das Parcelas</p>
              {instPreview.map(p=>(
                <div key={p.n} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"5px 0",borderBottom:"1px solid #0f172a"}}>
                  <span className="bdg" style={{background:"#1e3a5f",color:"#7dd3fc",fontSize:10,padding:"3px 8px"}}>{p.n}ª</span>
                  <div style={{textAlign:"center"}}>
                    {p.payDate!==p.purchaseDate
                      ?<><p style={{fontSize:10,color:"#64748b"}}>compra {pd(p.purchaseDate).toLocaleDateString("pt-BR")}</p>
                        <p style={{fontSize:11,fontWeight:600,color:"#38bdf8"}}>venc {pd(p.payDate).toLocaleDateString("pt-BR")}</p></>
                      :<p style={{fontSize:11,fontWeight:600,color:"#e2e8f0"}}>{pd(p.purchaseDate).toLocaleDateString("pt-BR")}</p>
                    }
                  </div>
                  <span style={{fontSize:12,fontWeight:700,color:"#f87171"}}>{fmt(p.amt)}</span>
                </div>
              ))}
            </div>}

            <button onClick={submit} style={{background:"linear-gradient(135deg,#38bdf8,#818cf8)",color:"#fff",border:"none",borderRadius:13,padding:14,fontSize:15,fontWeight:700,width:"100%"}}>
              {recEid?"Salvar Recorrência":eid?"Salvar Alterações":form.inst?`Parcelar em ${form.icount}x`:form.freq!=="none"?"Salvar Recorrência":`Adicionar ${form.type==="receita"?"Receita":"Despesa"}`}
            </button>
          </>}
        </div>}

        {/* ══ HIST ══ */}
        {view==="hist"&&<div className="si" style={{padding:"12px 18px",display:"flex",flexDirection:"column",gap:11}}>
          <Hd back={()=>nav("home")} title={`Extrato — ${MS[m]}/${y}`}/>
          {allM.length===0&&<div style={{textAlign:"center",padding:"40px 0",color:"#475569"}}><p style={{fontSize:13}}>Nenhum lançamento este mês</p></div>}
          {allM.map((t,i)=><TxRow key={t.id||t._fid||i} t={{...t,real:!!t.real}} onE={startE} onTogglePaid={t.real&&!t.isTO&&!t.isTE?togglePaid:null} onD={id=>setMdl({title:"Remover lançamento?",body:"Esta ação não pode ser desfeita.",danger:true,btn:"Remover",action:()=>dTx(id)})}/>)}
        </div>}

        {/* ══ REC ══ */}
        {view==="cashflow"&&<div className="si" style={{padding:"12px 18px",display:"flex",flexDirection:"column",gap:12}}>
          <Hd back={()=>nav("home")} title="Recorrências & Parcelamentos"/>
          <div className="seg">
            <button className={`st ${rtab==="rec"?"on":""}`} onClick={()=>setRtab("rec")}>🔁 Recorrentes ({rec.length})</button>
            <button className={`st ${rtab==="inst"?"on":""}`} onClick={()=>setRtab("inst")}>📦 Parcelados ({inst.length})</button>
          </div>
          {rtab==="rec"&&<>
            {!rec.length&&<p style={{textAlign:"center",fontSize:12,color:"#475569",padding:"28px 0"}}>Nenhuma recorrência cadastrada</p>}
            {rec.map(r=>{const cat=getCat(r.cat),cnt=tx.filter(t=>t.rid===r.id).length,freq=FREQS.find(f=>f.id===r.freq);return(
              <div key={r.id} className="card" style={{display:"flex",alignItems:"center",gap:11}}>
                <div style={{width:40,height:40,borderRadius:11,background:r.type==="receita"?"#064e3b":"#450a0a",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>{cat.i}</div>
                <div style={{flex:1,minWidth:0}}>
                  <p style={{fontSize:13,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.desc}</p>
                  <p style={{fontSize:10,color:"#64748b"}}>{freq?.l} · desde {pd(r.startDate).toLocaleDateString("pt-BR")}</p>
                  <div style={{display:"flex",gap:5,marginTop:2,flexWrap:"wrap"}}>
                    <span className="bdg" style={{background:"#0f172a",color:"#64748b"}}>{cnt} gerado{cnt!==1?"s":""}</span>
                    {r.autoPaid&&<span className="bdg" style={{background:"#064e3b",color:"#34d399"}}>auto-pago</span>}
                    {!r.autoPaid&&<span className="bdg" style={{background:"#451a03",color:"#f59e0b"}}>manual</span>}
                  </div>
                </div>
                <div style={{textAlign:"right",display:"flex",flexDirection:"column",gap:5,alignItems:"flex-end"}}>
                  <p style={{fontSize:13,fontWeight:700,color:r.type==="receita"?"#34d399":"#f87171"}}>{r.type==="receita"?"+":"-"}{fmt(r.amt)}</p>
                  <div style={{display:"flex",gap:5}}>
                    <button onClick={()=>startRecE(r)} className="ab" style={{background:"#1e3a5f",color:"#38bdf8"}}>editar</button>
                    <button onClick={()=>setMdl({title:"Remover recorrência?",body:"Remove o modelo e todos os lançamentos gerados.",danger:true,btn:"Remover",action:()=>dRec(r.id)})} className="ab" style={{background:"#450a0a",color:"#f87171"}}>×</button>
                  </div>
                </div>
              </div>
            );})}
          </>}
          {rtab==="inst"&&<>
            {!inst.length&&<p style={{textAlign:"center",fontSize:12,color:"#475569",padding:"28px 0"}}>Nenhum parcelamento cadastrado</p>}
            {inst.map(ins=>{
              const cat=getCat(ins.cat),paid=tx.filter(t=>t.iid===ins.id&&t.paid!==false).length,pending=tx.filter(t=>t.iid===ins.id&&t.paid===false).length,rem=ins.icount-paid-pending,al=alab({atype:ins.atype,aid:ins.aid});
              return<div key={ins.id} className="card">
                <div style={{display:"flex",alignItems:"flex-start",gap:11,marginBottom:10}}>
                  <div style={{width:40,height:40,borderRadius:11,background:"#450a0a",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>{cat.i}</div>
                  <div style={{flex:1,minWidth:0}}>
                    <p style={{fontSize:13,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{ins.desc}</p>
                    <p style={{fontSize:10,color:"#64748b"}}>{al} · {pd(ins.startDate).toLocaleDateString("pt-BR")}</p>
                  </div>
                  <div style={{textAlign:"right",flexShrink:0}}>
                    <p style={{fontSize:14,fontWeight:700,color:"#f87171"}}>{fmt(ins.tamt/ins.icount)}<span style={{fontSize:9,color:"#64748b"}}>/mês</span></p>
                    <p style={{fontSize:9,color:"#64748b"}}>{fmt(ins.tamt)} total</p>
                  </div>
                </div>
                <div className="pb" style={{marginBottom:8,height:6}}><div className="pf" style={{width:`${Math.min((paid/ins.icount)*100,100)}%`,background:"linear-gradient(90deg,#38bdf8,#818cf8)"}}/></div>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:10}}>
                  <div style={{textAlign:"center"}}><p style={{fontSize:9,color:"#64748b"}}>PAGAS</p><p style={{fontSize:13,fontWeight:700,color:"#34d399"}}>{paid}</p><p style={{fontSize:9,color:"#475569"}}>{fmt(paid*(ins.tamt/ins.icount))}</p></div>
                  {pending>0&&<div style={{textAlign:"center"}}><p style={{fontSize:9,color:"#64748b"}}>PENDENTES</p><p style={{fontSize:13,fontWeight:700,color:"#f59e0b"}}>{pending}</p><p style={{fontSize:9,color:"#475569"}}>{fmt(pending*(ins.tamt/ins.icount))}</p></div>}
                  <div style={{textAlign:"center"}}><p style={{fontSize:9,color:"#64748b"}}>RESTANTES</p><p style={{fontSize:13,fontWeight:700,color:rem>0?"#f87171":"#34d399"}}>{rem}</p><p style={{fontSize:9,color:"#475569"}}>{fmt(rem*(ins.tamt/ins.icount))}</p></div>
                  <div style={{textAlign:"center"}}><p style={{fontSize:9,color:"#64748b"}}>TOTAL</p><p style={{fontSize:13,fontWeight:700}}>{ins.icount}x</p><p style={{fontSize:9,color:"#475569"}}>{fmt(ins.tamt)}</p></div>
                </div>
                <button onClick={()=>setMdl({title:"Remover parcelamento?",body:"Remove o modelo e todos os lançamentos gerados.",danger:true,btn:"Remover",action:()=>dInst(ins.id)})} className="ab" style={{background:"#450a0a",color:"#f87171",width:"100%",padding:"9px",textAlign:"center"}}>× remover parcelamento</button>
              </div>;
            })}
          </>}
        </div>}

        {/* ══ ACCOUNTS ══ */}
        {view==="accounts"&&<div className="si" style={{padding:"12px 18px",display:"flex",flexDirection:"column",gap:12}}>
          <Hd back={()=>nav("home")} title="Contas, Cartões & Categorias"/>
          <div className="seg">
            <button className={`st ${atab==="banks"?"on":""}`} onClick={()=>setAtab("banks")}>🏦 Bancos</button>
            <button className={`st ${atab==="cards"?"on":""}`} onClick={()=>setAtab("cards")}>💳 Cartões</button>
            <button className={`st ${atab==="cats"?"on":""}`} onClick={()=>setAtab("cats")}>🏷️ Cats</button>
          </div>

          {atab==="banks"&&<>
            {bnks.map(b=>{const bal=bbal(b);return(
              <div key={b.id} style={{background:b.hidden?"#1e293b":b.color+"1a",border:`1px solid ${b.hidden?"#334155":b.color+"33"}`,borderRadius:15,padding:"13px 15px",display:"flex",alignItems:"center",gap:12,opacity:b.hidden?0.7:1}}>
                <div style={{width:42,height:42,borderRadius:12,background:b.color+"33",display:"flex",alignItems:"center",justifyContent:"center",fontSize:21,flexShrink:0}}>{b.icon}</div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{display:"flex",alignItems:"center",gap:6}}>
                    <p style={{fontSize:14,fontWeight:600}}>{b.name}</p>
                    {b.hidden&&<span className="bdg" style={{background:"#1e293b",color:"#64748b",border:"1px solid #334155"}}>oculta</span>}
                  </div>
                  <p style={{fontSize:13,color:bal>=0?"#34d399":"#f87171",fontWeight:700,fontFamily:"'DM Mono',monospace"}}>{fmt(bal)}</p>
                  <p style={{fontSize:9,color:"#64748b"}}>Inicial: {fmt(parseFloat(b.bal)||0)}</p>
                </div>
                <div style={{display:"flex",flexDirection:"column",gap:5,alignItems:"flex-end"}}>
                  <div style={{display:"flex",gap:5}}>
                    <button onClick={()=>{setEbid(b.id);setBf({name:b.name,bal:String(b.bal),color:b.color,icon:b.icon,hidden:b.hidden||false});}} className="ab" style={{background:"#1e3a5f",color:"#38bdf8"}}>editar</button>
                    <button onClick={()=>setMdl({title:"Remover banco?",body:"Os lançamentos permanecem.",danger:true,btn:"Remover",action:()=>dBank(b.id)})} className="ab" style={{background:"#450a0a",color:"#f87171"}}>×</button>
                  </div>
                  <button onClick={()=>toggleHidden(b.id)} className="ab" style={{background:"#1e293b",color:b.hidden?"#38bdf8":"#64748b",fontSize:11,padding:"5px 9px"}}>
                    {b.hidden?"👁 Mostrar":"🙈 Ocultar"}
                  </button>
                </div>
              </div>
            );})}
            <div className="card" style={{display:"flex",flexDirection:"column",gap:11}}>
              <p style={{fontSize:13,fontWeight:700,color:"#94a3b8"}}>{ebid?"✏️ Editar banco":"➕ Novo banco"}</p>
              <div style={{display:"flex",gap:5}}>{BICONS.map(ic=><button key={ic} onClick={()=>setBf(f=>({...f,icon:ic}))} style={{background:bf.icon===ic?"#334155":"transparent",border:"none",fontSize:19,borderRadius:8,padding:5}}>{ic}</button>)}</div>
              <input className="fi" placeholder="Nome do banco" value={bf.name} onChange={e=>setBf(f=>({...f,name:e.target.value}))}/>
              <input className="fi" type="number" inputMode="decimal" placeholder="Saldo inicial (R$)" value={bf.bal} onChange={e=>setBf(f=>({...f,bal:e.target.value}))}/>
              {/* Hidden toggle in form */}
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",background:"#0f172a",borderRadius:10,padding:"10px 13px"}}>
                <div><p style={{fontSize:12,fontWeight:600}}>🙈 Conta oculta (investimento)</p><p style={{fontSize:10,color:"#64748b",marginTop:2}}>Excluída da análise financeira diária</p></div>
                <button className={`tog ${bf.hidden?"on":"off"}`} onClick={()=>setBf(f=>({...f,hidden:!f.hidden}))}/>
              </div>
              <div style={{display:"flex",gap:7,flexWrap:"wrap"}}>{BCOLS.map(c=><div key={c} className={`cdot ${bf.color===c?"on":""}`} onClick={()=>setBf(f=>({...f,color:c}))} style={{background:c}}/>)}</div>
              <div style={{display:"flex",gap:8}}>
                {ebid&&<button onClick={()=>{setEbid(null);setBf(EB);}} style={{flex:1,padding:11,background:"#334155",border:"none",borderRadius:11,color:"#e2e8f0",fontWeight:600}}>Cancelar</button>}
                <button onClick={sBank} style={{flex:1,padding:11,background:"linear-gradient(135deg,#38bdf8,#818cf8)",border:"none",borderRadius:11,color:"#fff",fontWeight:600}}>{ebid?"Salvar":"Adicionar"}</button>
              </div>
            </div>
          </>}

          {atab==="cards"&&<>
            {crds.map(c=>{const sp=csp(c.id),lim=parseFloat(c.lim)||0,av=lim>0?lim-sp:null,pct=lim>0?Math.min((sp/lim)*100,100):0;return(
              <div key={c.id}>
                <div className="vc" style={{background:`linear-gradient(135deg,${c.color},${c.color}88)`}}>
                  <div style={{position:"absolute",top:-18,right:-18,width:90,height:90,borderRadius:"50%",background:"rgba(255,255,255,.06)"}}/>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                    <p style={{fontSize:22}}>{c.icon}</p><p style={{fontSize:10,color:"rgba(255,255,255,.6)"}}>Vence dia {c.due}</p>
                  </div>
                  <p style={{fontSize:15,fontWeight:700,color:"#fff",marginTop:8}}>{c.name}</p>
                  <div style={{display:"flex",gap:18,marginTop:8}}>
                    <div><p style={{fontSize:9,color:"rgba(255,255,255,.6)"}}>FATURA</p><p style={{fontSize:14,fontWeight:700,color:"#fff",fontFamily:"'DM Mono',monospace"}}>{fmt(sp)}</p></div>
                    {lim>0&&<><div style={{width:1,background:"rgba(255,255,255,.2)"}}/>
                    <div><p style={{fontSize:9,color:"rgba(255,255,255,.6)"}}>DISPONÍVEL</p><p style={{fontSize:13,fontWeight:700,color:av>=0?"#a7f3d0":"#fca5a5",fontFamily:"'DM Mono',monospace"}}>{fmt(av)}</p></div></>}
                  </div>
                  {lim>0&&<div style={{marginTop:10,height:4,background:"rgba(255,255,255,.2)",borderRadius:99,overflow:"hidden"}}><div style={{height:"100%",width:`${pct}%`,background:pct>85?"#f87171":"rgba(255,255,255,.8)",borderRadius:99,transition:"width .4s"}}/></div>}
                </div>
                <div style={{display:"flex",gap:7,marginTop:8,marginBottom:6}}>
                  <button onClick={()=>{setSelC(c);nav("card");}} className="ab" style={{flex:1,background:"#1e293b",color:"#94a3b8",padding:"9px 0",textAlign:"center"}}>ver fatura</button>
                  <button onClick={()=>{setEcid(c.id);setCf({name:c.name,lim:String(c.lim),color:c.color,due:c.due,icon:c.icon});}} className="ab" style={{background:"#1e3a5f",color:"#38bdf8"}}>editar</button>
                  <button onClick={()=>setMdl({title:"Remover cartão?",body:"Os lançamentos permanecem.",danger:true,btn:"Remover",action:()=>dCard(c.id)})} className="ab" style={{background:"#450a0a",color:"#f87171"}}>×</button>
                </div>
              </div>
            );})}
            <div className="card" style={{display:"flex",flexDirection:"column",gap:11}}>
              <p style={{fontSize:13,fontWeight:700,color:"#94a3b8"}}>{ecid?"✏️ Editar cartão":"➕ Novo cartão"}</p>
              <div style={{display:"flex",gap:5}}>{CICONS.map(ic=><button key={ic} onClick={()=>setCf(f=>({...f,icon:ic}))} style={{background:cf.icon===ic?"#334155":"transparent",border:"none",fontSize:19,borderRadius:8,padding:5}}>{ic}</button>)}</div>
              <input className="fi" placeholder="Nome do cartão" value={cf.name} onChange={e=>setCf(f=>({...f,name:e.target.value}))}/>
              <input className="fi" type="number" inputMode="decimal" placeholder="Limite (R$) — opcional" value={cf.lim} onChange={e=>setCf(f=>({...f,lim:e.target.value}))}/>
              <div style={{display:"flex",gap:10,alignItems:"center"}}>
                <p style={{fontSize:12,color:"#94a3b8",whiteSpace:"nowrap",flexShrink:0}}>Vence dia:</p>
                <input className="fi" type="number" inputMode="numeric" min="1" max="31" placeholder="10" value={cf.due} onChange={e=>setCf(f=>({...f,due:e.target.value}))}/>
              </div>
              <div style={{background:"#0f172a",borderRadius:10,padding:"9px 13px",border:"1px solid #334155"}}>
                <p style={{fontSize:9,color:"#64748b",marginBottom:4}}>COMO FUNCIONA O VENCIMENTO</p>
                <p style={{fontSize:11,color:"#94a3b8",lineHeight:1.5}}>Compras antes do dia {cf.due||10} → pagamento neste mês. Compras após o dia {cf.due||10} → pagamento no mês seguinte.</p>
              </div>
              <div style={{display:"flex",gap:7,flexWrap:"wrap"}}>{CCOLS.map(c=><div key={c} className={`cdot ${cf.color===c?"on":""}`} onClick={()=>setCf(f=>({...f,color:c}))} style={{background:c}}/>)}</div>
              <div style={{display:"flex",gap:8}}>
                {ecid&&<button onClick={()=>{setEcid(null);setCf(EC);}} style={{flex:1,padding:11,background:"#334155",border:"none",borderRadius:11,color:"#e2e8f0",fontWeight:600}}>Cancelar</button>}
                <button onClick={sCard} style={{flex:1,padding:11,background:"linear-gradient(135deg,#38bdf8,#818cf8)",border:"none",borderRadius:11,color:"#fff",fontWeight:600}}>{ecid?"Salvar":"Adicionar"}</button>
              </div>
            </div>
          </>}

          {atab==="cats"&&<>
            {["despesa","receita"].map(type=>{const customs=(ccat[type]||[]);if(!customs.length)return null;return(
              <div key={type} className="card">
                <p style={{fontSize:10,fontWeight:700,color:"#94a3b8",textTransform:"uppercase",letterSpacing:.5,marginBottom:10}}>{type==="despesa"?"↓ Despesa":"↑ Receita"} — personalizadas</p>
                {customs.map(cat=><div key={cat.id} style={{display:"flex",alignItems:"center",gap:10,background:"#0f172a",borderRadius:10,padding:"9px 12px",marginBottom:7}}>
                  <span style={{fontSize:20}}>{cat.icon||cat.i}</span>
                  <p style={{fontSize:13,fontWeight:600,flex:1}}>{cat.label||cat.l}</p>
                  <button onClick={()=>setMdl({title:`Remover "${cat.label||cat.l}"?`,body:"Lançamentos existentes não serão afetados.",danger:true,btn:"Remover",action:()=>dCat(type,cat.id)})} className="ab" style={{background:"#450a0a",color:"#f87171"}}>×</button>
                </div>)}
              </div>
            );})}
            <div className="card" style={{display:"flex",flexDirection:"column",gap:11}}>
              <p style={{fontSize:13,fontWeight:700,color:"#94a3b8"}}>➕ Nova Categoria</p>
              <div className="seg">
                <button className={`st ${catF.type==="despesa"?"on":""}`} onClick={()=>setCatF(f=>({...f,type:"despesa"}))}>↓ Despesa</button>
                <button className={`st ${catF.type==="receita"?"on":""}`} onClick={()=>setCatF(f=>({...f,type:"receita"}))}>↑ Receita</button>
              </div>
              <input className="fi" placeholder="Nome da categoria" value={catF.label} onChange={e=>setCatF(f=>({...f,label:e.target.value}))}/>
              <div>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                  <p style={{fontSize:10,color:"#94a3b8",fontWeight:600}}>ÍCONE: <span style={{fontSize:18}}>{catF.icon}</span></p>
                  <button onClick={()=>setEpk(p=>!p)} style={{background:"#334155",border:"none",borderRadius:8,padding:"5px 11px",fontSize:11,color:"#94a3b8",fontWeight:600}}>{epk?"Fechar":"Escolher"}</button>
                </div>
                {epk&&<div style={{background:"#0f172a",borderRadius:10,padding:8,display:"grid",gridTemplateColumns:"repeat(8,1fr)",gap:3,maxHeight:155,overflowY:"auto"}}>
                  {EMOJIS.map(em=><button key={em} onClick={()=>{setCatF(f=>({...f,icon:em}));setEpk(false);}} style={{background:"none",border:"none",fontSize:20,borderRadius:8,padding:4}}>{em}</button>)}
                </div>}
              </div>
              <button onClick={sCat} style={{padding:12,background:"linear-gradient(135deg,#38bdf8,#818cf8)",border:"none",borderRadius:11,color:"#fff",fontWeight:600}}>Criar Categoria</button>
            </div>
            <div className="card">
              <p style={{fontSize:10,fontWeight:700,color:"#94a3b8",textTransform:"uppercase",letterSpacing:.5,marginBottom:10}}>Todas as Categorias</p>
              {["despesa","receita"].map(type=>(
                <div key={type} style={{marginBottom:12}}>
                  <p style={{fontSize:10,color:"#64748b",marginBottom:6}}>{type==="despesa"?"↓ Despesa":"↑ Receita"}</p>
                  <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                    {cats[type].map(cat=><div key={cat.id} style={{background:cat.custom?"#1e3a5f22":"#0f172a",border:`1px solid ${cat.custom?"#38bdf844":"#334155"}`,borderRadius:8,padding:"5px 10px",display:"flex",alignItems:"center",gap:5}}>
                      <span style={{fontSize:13}}>{cat.i}</span><span style={{fontSize:10,color:cat.custom?"#7dd3fc":"#94a3b8"}}>{cat.l}</span>
                    </div>)}
                  </div>
                </div>
              ))}
            </div>
          </>}
        </div>}

        {/* ══ CARD DETAIL ══ */}
        {view==="card"&&selC&&(()=>{
          const sp=csp(selC.id),lim=parseFloat(selC.lim)||0,av=lim>0?lim-sp:null,pct=lim>0?Math.min((sp/lim)*100,100):0;
          const cItems=allM.filter(i=>i.atype==="card"&&i.aid===selC.id);
          const cInst=inst.filter(i=>i.atype==="card"&&i.aid===selC.id);
          return<div className="si" style={{padding:"12px 18px",display:"flex",flexDirection:"column",gap:12}}>
            <Hd back={()=>nav("home")} title={`Fatura — ${selC.name}`}/>
            <div className="vc" style={{background:`linear-gradient(135deg,${selC.color},${selC.color}88)`}}>
              <div style={{position:"absolute",top:-18,right:-18,width:90,height:90,borderRadius:"50%",background:"rgba(255,255,255,.06)"}}/>
              <p style={{fontSize:22}}>{selC.icon}</p>
              <p style={{fontSize:16,fontWeight:700,color:"#fff",marginTop:7}}>{selC.name}</p>
              <div style={{display:"flex",gap:20,marginTop:9}}>
                <div><p style={{fontSize:9,color:"rgba(255,255,255,.6)"}}>FATURA {MS[m].toUpperCase()}</p><p style={{fontSize:22,fontWeight:700,color:"#fff",fontFamily:"'DM Mono',monospace"}}>{fmt(sp)}</p></div>
                {lim>0&&<><div style={{width:1,background:"rgba(255,255,255,.2)"}}/>
                <div><p style={{fontSize:9,color:"rgba(255,255,255,.6)"}}>DISPONÍVEL</p><p style={{fontSize:14,fontWeight:700,color:av>=0?"#a7f3d0":"#fca5a5",fontFamily:"'DM Mono',monospace",marginTop:6}}>{fmt(av)}</p></div></>}
              </div>
              {lim>0&&<div style={{marginTop:10,height:4,background:"rgba(255,255,255,.2)",borderRadius:99,overflow:"hidden"}}><div style={{height:"100%",width:`${pct}%`,background:pct>85?"#f87171":"rgba(255,255,255,.8)",borderRadius:99,transition:"width .4s"}}/></div>}
              <p style={{fontSize:10,color:"rgba(255,255,255,.5)",marginTop:6}}>Vencimento: dia {selC.due}</p>
            </div>
            {cInst.length>0&&<div className="card">
              <p style={{fontSize:10,fontWeight:700,color:"#94a3b8",marginBottom:10,textTransform:"uppercase",letterSpacing:.5}}>Parcelamentos neste cartão</p>
              {cInst.map(ins=>{const paid=tx.filter(t=>t.iid===ins.id&&t.paid!==false).length,rem=ins.icount-paid,p2=Math.min((paid/ins.icount)*100,100);return(
                <div key={ins.id} style={{marginBottom:12,paddingBottom:12,borderBottom:"1px solid #0f172a"}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}><p style={{fontSize:13,fontWeight:600}}>{ins.desc}</p><p style={{fontSize:12,fontWeight:700,color:"#f87171"}}>{fmt(ins.tamt/ins.icount)}/mês</p></div>
                  <div className="pb" style={{marginBottom:5,height:5}}><div className="pf" style={{width:`${p2}%`,background:"linear-gradient(90deg,#38bdf8,#818cf8)"}}/></div>
                  <div style={{display:"flex",justifyContent:"space-between"}}><p style={{fontSize:9,color:"#64748b"}}>{paid}/{ins.icount} pagas · {fmt(paid*(ins.tamt/ins.icount))}</p><p style={{fontSize:9,color:rem>0?"#f87171":"#34d399"}}>{rem} rest. · {fmt(rem*(ins.tamt/ins.icount))}</p></div>
                </div>
              );})}
            </div>}
            <button onClick={()=>{setForm({...mf(),type:"despesa",atype:"card",aid:selC.id});nav("add");}}
              style={{background:"linear-gradient(135deg,#7c3aed,#4f46e5)",color:"#fff",border:"none",borderRadius:13,padding:13,fontSize:14,fontWeight:700,width:"100%"}}>
              + Lançar na Fatura
            </button>
            {!cItems.length&&<p style={{textAlign:"center",fontSize:12,color:"#475569",padding:"22px 0"}}>Sem lançamentos neste mês</p>}
            {cItems.map((t,i)=><TxRow key={t.id||t._fid||i} t={{...t,real:!!t.real}} onTogglePaid={t.real&&!t.isTO&&!t.isTE?togglePaid:null} onD={id=>setMdl({title:"Remover?",danger:true,btn:"Remover",action:()=>dTx(id)})}/>)}
          </div>;
        })()}

        {/* ══ BUDGETS ══ */}
        {view==="budgets"&&<div className="si" style={{padding:"12px 18px",display:"flex",flexDirection:"column",gap:12}}>
          <h2 style={{fontSize:16,fontWeight:700}}>🎯 Metas por Categoria</h2>
          <p style={{fontSize:12,color:"#64748b",marginTop:-5}}>Limite mensal de despesas por categoria.</p>
          {cats.despesa.map(cat=>{const sp=catD[cat.id]||0,bg=budg[cat.id],pct=bg?Math.min((sp/bg)*100,100):0,ov=bg&&sp>bg;return(
            <div key={cat.id} className="card" style={{padding:"13px"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                <span style={{fontWeight:600,fontSize:13}}>{cat.i} {cat.l}</span>
                <span style={{fontSize:13,color:ov?"#f87171":"#94a3b8"}}>{fmt(sp)}{bg?` / ${fmt(bg)}`:""}</span>
              </div>
              {bg&&<div className="pb" style={{marginBottom:8,height:5}}><div className="pf" style={{width:`${pct}%`,background:ov?"#ef4444":"linear-gradient(90deg,#38bdf8,#818cf8)"}}/></div>}
              <div style={{display:"flex",gap:8}}>
                <input className="fi" type="number" inputMode="decimal" placeholder={bg?fmt(bg):"Definir meta…"} value={bi[cat.id]||""} onChange={e=>setBi(p=>({...p,[cat.id]:e.target.value}))} style={{fontSize:14}}/>
                <button onClick={()=>{const v=parseFloat((bi[cat.id]||"").replace(",","."));if(!v||v<=0)return;setBudg(p=>({...p,[cat.id]:v}));setBi(p=>({...p,[cat.id]:""}));toast$("Meta salva ✓");}} style={{background:"linear-gradient(135deg,#38bdf8,#818cf8)",border:"none",color:"#fff",borderRadius:10,padding:"0 14px",fontWeight:600,fontSize:13,flexShrink:0}}>Salvar</button>
              </div>
            </div>
          );})}
        </div>}

      </div>{/* end scrollable */}

      {/* ── Bottom Nav ── */}
      <nav style={{position:"fixed",bottom:0,left:"50%",transform:"translateX(-50%)",width:"100%",maxWidth:480,background:"#1e293b",borderTop:"1px solid #2d3748",display:"flex",paddingTop:6,paddingBottom:"calc(8px + env(safe-area-inset-bottom))"}}>
        {[
          {id:"home",    label:"Início",  icon:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>},
          {id:"dashs",   label:"Dashs",   icon:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="9"/><path d="M12 12L8.5 8.5"/><path d="M12 7v1M17 12h-1M12 17v-1M7 12h1"/></svg>},
          {id:"add",     label:"Lançar",  icon:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/></svg>},
          {id:"accounts",label:"Contas",  icon:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>},
          {id:"hist",    label:"Extrato", icon:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>},
        ].map(tab=>(
          <button key={tab.id}
            className={`nb ${(view===tab.id||(tab.id==="accounts"&&["card","budgets","cashflow"].includes(view)))?"on":""}`}
            style={tab.id==="add"?{color:"#38bdf8"}:{}}
            onClick={()=>nav(tab.id)}>
            {tab.icon}{tab.label}
          </button>
        ))}
      </nav>
    </div>
  );
}