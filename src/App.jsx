import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { auth, db, provider } from "./firebase";
import { signOut, onAuthStateChanged } from "firebase/auth";
import { doc, setDoc, getDoc, onSnapshot } from "firebase/firestore";

// ── External modules ───────────────────────────────────────────────────────────
import { DC, EMOJIS, BCOLS, CCOLS, PCOLS, MS, BICONS, CICONS, FREQS, EB, EC } from "./constants";
import { fmt, td, pd, adjBiz, addF, cardPayDate, autoOccs, recInMonth, instInMonth } from "./utils";
import { CSS } from "./styles";
import { Pie, Gauge } from "./components/Charts";
import { LoginScreen, PinScreen, Loader } from "./components/AuthScreens";
import { InvPayModal } from "./components/InvPayModal";
import { AntecipacaoModal } from "./components/AntecipacaoModal";
import { CashflowChart } from "./components/CashflowChart";
import { TxDetailDrawer } from "./components/TxDetailDrawer";

// ── Form default & Firestore ───────────────────────────────────────────────────
const mf=()=>({type:"despesa",amt:"",desc:"",cat:"alimentacao",date:td(),note:"",atype:"bank",aid:"",freq:"none",bday:"ignore",inst:false,icount:"2",tamt:"",isTransfer:false,toAtype:"bank",toAid:"",autoPaid:false});

const userDoc=uid=>doc(db,"users",uid);

// Firestore rejects undefined values — strip them recursively before saving
const stripUndefined=(obj)=>{
  if(Array.isArray(obj))return obj.map(stripUndefined);
  if(obj!==null&&typeof obj==="object"){
    const out={};
    for(const[k,v]of Object.entries(obj)){
      if(v!==undefined)out[k]=stripUndefined(v);
    }
    return out;
  }
  return obj;
};

const saveUserData=async(uid,data)=>{
  try{await setDoc(userDoc(uid),stripUndefined(data),{merge:true});}
  catch(e){console.error("Firestore save:",e);throw e;}
};

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
  // invoices: { "cardId_YYYY_MM": { status:"open"|"closed"|"paid", paidDate, bankId, txIds } }
  const [invoices, setInvoices]= useState({});

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
  const [selB, setSelB]= useState(null);
  const [mdl,  setMdl] = useState(null);
  const [tst,  setTst] = useState(null);
  const [rtab, setRtab]= useState("rec");
  const [dtab, setDtab]= useState("dashs"); // "dashs" | "metas"
  const [epk,  setEpk] = useState(false);
  const [recEditMdl, setRecEditMdl]= useState(null);
  const [invPayMdl,  setInvPayMdl] = useState(null);
  const [antecipMdl, setAntecipMdl]= useState(null); // {ins} for prepayment modal
  const [histFilter, setHistFilter]= useState({q:"",type:"all",cat:"",atype:""}); // extrato filters
  const [txDetail,   setTxDetail]  = useState(null);  // transaction open in detail drawer
  const saveTimer      = useRef(null);
  const mainRef        = useRef(null);
  const userRef        = useRef(null); // always current user for use in event handlers

  const nav=useCallback(v=>{setView(v);setTimeout(()=>mainRef.current?.scrollTo({top:0,behavior:"instant"}),0);},[]);

  // Keep userRef current for use in event listeners that can't close over state
  useEffect(()=>{userRef.current=user;},[user]);

  // ── Auth + real-time Firestore listener ──
  useEffect(()=>{
    let unsubFirestore=null;

    const unsubAuth=onAuthStateChanged(auth,async u=>{
      setUser(u);
      if(unsubFirestore){unsubFirestore();unsubFirestore=null;}

      if(u){
        // ── 1. Carga inicial com getDoc — rápido e confiável ──
        try{
          const snap=await getDoc(userDoc(u.uid));
          const data=snap.exists()?snap.data():{};
          if(data.tx)       setTx(data.tx);
          if(data.rec)      setRec(data.rec);
          if(data.inst)     setInst(data.inst);
          if(data.banks)    setBnks(data.banks);
          if(data.cards)    setCrds(data.cards);
          if(data.budg)     setBudg(data.budg);
          if(data.ccat)     setCcat(data.ccat);
          if(data.invoices) setInvoices(data.invoices);
          if(data.pin)      setSavedPin(data.pin);
        }catch(e){console.error("Initial load:",e);}
        setDataLoaded(true);
        setLocked(true);

        // ── 2. onSnapshot apenas para sync entre dispositivos ──
        // fromCache=true  → dado local, já carregamos com getDoc, ignora
        // hasPendingWrites=true → escrita deste dispositivo, ignora
        unsubFirestore=onSnapshot(
          userDoc(u.uid),
          snapshot=>{
            if(snapshot.metadata.hasPendingWrites) return;
            if(snapshot.metadata.fromCache) return;
            const data=snapshot.exists()?snapshot.data():{};
            if(data.tx)       setTx(data.tx);
            if(data.rec)      setRec(data.rec);
            if(data.inst)     setInst(data.inst);
            if(data.banks)    setBnks(data.banks);
            if(data.cards)    setCrds(data.cards);
            if(data.budg)     setBudg(data.budg);
            if(data.ccat)     setCcat(data.ccat);
            if(data.invoices) setInvoices(data.invoices);
            if(data.pin)      setSavedPin(data.pin);
          },
          err=>{console.error("Firestore sync:",err);}
        );
      } else {
        setTx([]);setRec([]);setInst([]);setBnks([]);setCrds([]);setBudg({});
        setCcat({receita:[],despesa:[]});setInvoices({});setSavedPin("");
        setDataLoaded(false);setLocked(true);
      }
    });

    return()=>{
      unsubAuth();
      if(unsubFirestore)unsubFirestore();
    };
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

  // ── Refs para ter sempre o valor atual nos saves ──
  const txRef   = useRef(tx);
  const recRef  = useRef(rec);
  const instRef = useRef(inst);
  const bnksRef = useRef(bnks);
  const crdsRef = useRef(crds);
  const budgRef = useRef(budg);
  const ccatRef = useRef(ccat);
  const invRef  = useRef(invoices);
  useEffect(()=>{txRef.current=tx;},[tx]);
  useEffect(()=>{recRef.current=rec;},[rec]);
  useEffect(()=>{instRef.current=inst;},[inst]);
  useEffect(()=>{bnksRef.current=bnks;},[bnks]);
  useEffect(()=>{crdsRef.current=crds;},[crds]);
  useEffect(()=>{budgRef.current=budg;},[budg]);
  useEffect(()=>{ccatRef.current=ccat;},[ccat]);
  useEffect(()=>{invRef.current=invoices;},[invoices]);

  // ── Debounced Firestore save com maxWait ──
  // Salva 800ms após a última mudança, mas garante save em no máximo 3s
  // mesmo que o usuário continue lançando sem parar.
  const saveMaxTimer = useRef(null); // garantia de save máximo

  const saveToFirestore=useCallback(()=>{
    if(!user)return;
    const doSave=()=>{
      if(saveTimer.current){clearTimeout(saveTimer.current);saveTimer.current=null;}
      if(saveMaxTimer.current){clearTimeout(saveMaxTimer.current);saveMaxTimer.current=null;}
      saveUserData(user.uid,{
        tx:       txRef.current,
        rec:      recRef.current,
        inst:     instRef.current,
        banks:    bnksRef.current,
        cards:    crdsRef.current,
        budg:     budgRef.current,
        ccat:     ccatRef.current,
        invoices: invRef.current,
      });
    };
    // Debounce: reinicia a cada mudança, salva 800ms após a última
    if(saveTimer.current)clearTimeout(saveTimer.current);
    saveTimer.current=setTimeout(doSave,800);
    // MaxWait: se ainda não salvou após 3s, salva de qualquer jeito
    if(!saveMaxTimer.current){
      saveMaxTimer.current=setTimeout(doSave,3000);
    }
  },[user]);

  // ── Immediate save — cancels both timers and saves right now ──
  // Overrides are applied to refs immediately to prevent debounce race conditions
  const saveNow=useCallback(async(overrides={})=>{
    const u=userRef.current;
    if(!u)return;
    // Apply overrides to refs immediately so any subsequent debounce reads correct data
    if(overrides.tx)       txRef.current=overrides.tx;
    if(overrides.rec)      recRef.current=overrides.rec;
    if(overrides.inst)     instRef.current=overrides.inst;
    if(overrides.banks)    bnksRef.current=overrides.banks;
    if(overrides.cards)    crdsRef.current=overrides.cards;
    if(overrides.budg)     budgRef.current=overrides.budg;
    if(overrides.ccat)     ccatRef.current=overrides.ccat;
    if(overrides.invoices) invRef.current=overrides.invoices;
    // Cancel pending debounce — refs are now up to date
    if(saveTimer.current){clearTimeout(saveTimer.current);saveTimer.current=null;}
    if(saveMaxTimer.current){clearTimeout(saveMaxTimer.current);saveMaxTimer.current=null;}
    await saveUserData(u.uid,{
      tx:       txRef.current,
      rec:      recRef.current,
      inst:     instRef.current,
      banks:    bnksRef.current,
      cards:    crdsRef.current,
      budg:     budgRef.current,
      ccat:     ccatRef.current,
      invoices: invRef.current,
    });
  },[]);

  // ── Save immediately when app goes to background ──
  useEffect(()=>{
    const handleHide=()=>{if(document.hidden)saveNow();};
    document.addEventListener("visibilitychange",handleHide);
    return()=>document.removeEventListener("visibilitychange",handleHide);
  },[saveNow]);

  useEffect(()=>{if(user&&dataLoaded)saveToFirestore();},[tx,user,dataLoaded]);
  useEffect(()=>{if(user&&dataLoaded)saveToFirestore();},[rec,user,dataLoaded]);
  useEffect(()=>{if(user&&dataLoaded)saveToFirestore();},[inst,user,dataLoaded]);
  useEffect(()=>{if(user&&dataLoaded)saveToFirestore();},[bnks,user,dataLoaded]);
  useEffect(()=>{if(user&&dataLoaded)saveToFirestore();},[crds,user,dataLoaded]);
  useEffect(()=>{if(user&&dataLoaded)saveToFirestore();},[budg,user,dataLoaded]);
  useEffect(()=>{if(user&&dataLoaded)saveToFirestore();},[ccat,user,dataLoaded]);
  useEffect(()=>{if(user&&dataLoaded)saveToFirestore();},[invoices,user,dataLoaded]);

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
        const card=tpl.atype==="card"?crds.find(c=>c.id==tpl.aid):null;
        const payDate=card?cardPayDate(o.date,card.closing,card.due):undefined;
        add.push({id:`r_${tpl.id}_${o.orig}`,rk:o.key,rid:tpl.id,type:tpl.type,amt:tpl.amt,desc:tpl.desc,cat:tpl.cat,date:o.date,payDate,note:tpl.note||"",atype:tpl.atype,aid:tpl.aid,auto:true,paid:tpl.autoPaid===true});
      }
    }
    if(add.length){
      const ex=new Set(txRef.current.map(t=>t.id));
      const toAdd=add.filter(t=>!ex.has(t.id));
      if(toAdd.length){
        const newTx=[...txRef.current,...toAdd];
        setTx(newTx);
        saveNow({tx:newTx});
      }
    }
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
        if(!txRef.current.find(t=>t.id===iid)){
          const card=ins.atype==="card"?crds.find(c=>c.id==ins.aid):null;
          const payDate=card?cardPayDate(adj,card.closing,card.due):undefined;
          add.push({id:iid,iid:ins.id,iidx:i+1,type:ins.type,amt:ins.tamt/ins.icount,desc:ins.desc,cat:ins.cat,date:adj,payDate,note:ins.note||"",atype:ins.atype,aid:ins.aid,auto:true,paid:false});
        }
      }
    }
    if(add.length){
      const ex=new Set(txRef.current.map(t=>t.id));
      const toAdd=add.filter(t=>!ex.has(t.id));
      if(toAdd.length){
        const newTx=[...txRef.current,...toAdd];
        setTx(newTx);
        saveNow({tx:newTx});
      }
    }
  },[inst,dataLoaded,crds]);

  // ── Derived data ──
  const {m,y}=filt;
  const NOW=useMemo(()=>new Date(),[]);

  // hiddenBankIds: set of bank ids marked as hidden (investment accounts)
  const hiddenBankIds=useMemo(()=>new Set(bnks.filter(b=>b.hidden).map(b=>b.id)),[bnks]);

  // confM: transactions in the filtered month, excluding hidden bank accounts
  const confM=useMemo(()=>tx.filter(t=>{
    if(t.atype==="bank"&&hiddenBankIds.has(t.aid))return false;
    const filterDate=t.atype==="card"&&t.payDate?t.payDate:t.date;
    const d=pd(filterDate);
    return d.getMonth()===m&&d.getFullYear()===y;
  }),[tx,m,y,hiddenBankIds]);

  const fcasts=useMemo(()=>{
    const items=[];
    const isFutureMonth=(new Date(y,m,1))>new Date(NOW.getFullYear(),NOW.getMonth(),1);
    for(const tpl of rec){if(!tpl.freq||tpl.freq==="none")continue;
      if(tpl.atype==="bank"&&hiddenBankIds.has(tpl.aid))continue;
      const tplCard=tpl.atype==="card"?crds.find(c=>c.id==tpl.aid):null;
      for(const o of recInMonth(tpl,m,y)){
        const card=tplCard;
        const payDate=card?cardPayDate(o.date,card.closing,card.due):undefined;
        // For card recurring: filter by payDate (billing month), not purchase date
        const billingDate=payDate?pd(payDate):pd(o.date);
        if(billingDate.getMonth()!==m||billingDate.getFullYear()!==y)continue;
        if(!isFutureMonth&&billingDate<=NOW)continue;
        if(!tx.find(t=>t.rk===`${tpl.id}__${o.orig}`)){
          items.push({_fid:`fr_${tpl.id}_${o.orig}`,type:tpl.type,amt:tpl.amt,desc:tpl.desc,cat:tpl.cat,date:o.date,payDate,atype:tpl.atype,aid:tpl.aid,isRF:true,rid:tpl.id,orig:o.orig});
        }
      }
    }
    for(const ins of inst){
      if(ins.atype==="bank"&&hiddenBankIds.has(ins.aid))continue;
      const insCard=ins.atype==="card"?crds.find(c=>c.id==ins.aid):null;
      // Iterate over ALL installments (not just those in purchase-month m/y)
      // because for card purchases we need to filter by payDate (billing month), not purchase date
      for(let idx=1;idx<=ins.icount;idx++){
        const d=pd(ins.startDate);d.setMonth(d.getMonth()+(idx-1));
        const purchaseDate=d.toISOString().split("T")[0];
        const payDate=insCard?cardPayDate(purchaseDate,insCard.closing,insCard.due):purchaseDate;
        // Filter by the month this installment actually BILLS in (payDate for card, purchaseDate for bank)
        const billingDate=pd(payDate);
        if(billingDate.getMonth()!==m||billingDate.getFullYear()!==y)continue;
        if(!isFutureMonth&&billingDate<=NOW)continue;
        // Bug 1 fix: skip if already materialised by ANY means (standard id OR antecipação)
        const alreadyMat=tx.some(t=>t.iid===ins.id&&t.iidx===idx);
        if(alreadyMat)continue;
        items.push({_fid:`fi_${ins.id}_${idx}`,type:ins.type,amt:ins.tamt/ins.icount,desc:ins.desc,cat:ins.cat,date:purchaseDate,payDate,atype:ins.atype,aid:ins.aid,isIF:true,iidx:idx,icount:ins.icount,tamt:ins.tamt});
      }
    }
    return items.sort((a,b)=>pd(a.date)-pd(b.date));
  },[rec,inst,tx,m,y,NOW,crds,hiddenBankIds]);

  // Deduplicates fcasts against confM — prevents double-listing
  const allM=useMemo(()=>{
    const confMRks=new Set(confM.filter(t=>t.rk).map(t=>t.rk));
    const confMInstKeys=new Set(confM.filter(t=>t.iid&&t.iidx).map(t=>`${t.iid}_${t.iidx}`));
    const dedupedFcasts=fcasts.filter(f=>{
      if(f.isRF&&f.rid&&f.orig)return!confMRks.has(`${f.rid}__${f.orig}`);
      if(f.isIF)return!confMInstKeys.has(`${f._fid.split("_")[1]}_${f.iidx}`);
      return true;
    });
    return[...confM.map(t=>({...t,real:true})),...dedupedFcasts].sort((a,b)=>pd(b.date)-pd(a.date));
  },[confM,fcasts]);

  // Filtered list for extrato view
  const allMFiltered=useMemo(()=>{
    const {q,type,cat,atype}=histFilter;
    return allM.filter(t=>{
      if(type!=="all"&&t.type!==type)return false;
      if(cat&&t.cat!==cat)return false;
      if(atype&&t.atype!==atype)return false;
      if(q){
        const ql=q.toLowerCase();
        if(!t.desc?.toLowerCase().includes(ql)&&!t.note?.toLowerCase().includes(ql))return false;
      }
      return true;
    });
  },[allM,histFilter]);

  // Saldo Real = pago + pendentes (tudo que já está no mês, confirmado ou não)
  const totR=useMemo(()=>confM.filter(t=>t.type==="receita"&&!t.isTE).reduce((s,t)=>s+t.amt,0),[confM]);
  const totD=useMemo(()=>confM.filter(t=>t.type==="despesa"&&!t.isTO).reduce((s,t)=>s+t.amt,0),[confM]);
  const saldo=totR-totD;
  // paid-only subtotals (for bank balance calculations)
  const totRPaid=useMemo(()=>confM.filter(t=>t.type==="receita"&&!t.isTE&&t.paid!==false).reduce((s,t)=>s+t.amt,0),[confM]);
  const totDPaid=useMemo(()=>confM.filter(t=>t.type==="despesa"&&!t.isTO&&t.paid!==false).reduce((s,t)=>s+t.amt,0),[confM]);
  // pending subtotals (for display)
  const pendR=useMemo(()=>confM.filter(t=>t.type==="receita"&&!t.isTE&&t.paid===false).reduce((s,t)=>s+t.amt,0),[confM]);
  const pendD=useMemo(()=>confM.filter(t=>t.type==="despesa"&&!t.isTO&&t.paid===false).reduce((s,t)=>s+t.amt,0),[confM]);

  // Saldo Previsto = Saldo Real + fcasts futuros ainda não materializados
  const fcR=useMemo(()=>fcasts.filter(f=>f.type==="receita").reduce((s,f)=>s+f.amt,0),[fcasts]);
  const fcD=useMemo(()=>fcasts.filter(f=>f.type==="despesa").reduce((s,f)=>s+f.amt,0),[fcasts]);
  const saldoP=saldo+(fcR-fcD);

  const catD=useMemo(()=>confM.filter(t=>t.type==="despesa"&&!t.isTO&&t.paid!==false).reduce((a,t)=>{a[t.cat]=(a[t.cat]||0)+t.amt;return a;},{}),[confM]);
  const catDF=useMemo(()=>[...confM.filter(t=>t.type==="despesa"&&!t.isTO),...fcasts.filter(f=>f.type==="despesa")].reduce((a,t)=>{a[t.cat]=(a[t.cat]||0)+t.amt;return a;},{}),[confM,fcasts]);

  // bbal: only paid bank transactions (hidden accounts still tracked separately)
  const bbal=useCallback(b=>{
    const s=tx.filter(t=>t.atype==="bank"&&t.aid===b.id&&t.paid!==false).reduce((s,t)=>s+(t.type==="receita"?t.amt:-t.amt),0);
    return(parseFloat(b.bal)||0)+s;
  },[tx]);

  // bbalUntil: balance up to (not including) a specific date — used for month opening balance
  const bbalUntil=useCallback((b,untilDate)=>{
    const s=tx.filter(t=>t.atype==="bank"&&t.aid===b.id&&t.paid!==false&&pd(t.date)<untilDate).reduce((s,t)=>s+(t.type==="receita"?t.amt:-t.amt),0);
    return(parseFloat(b.bal)||0)+s;
  },[tx]);

  // tbb: only visible (non-hidden) banks
  const visibleBnks=useMemo(()=>bnks.filter(b=>!b.hidden),[bnks]);
  const tbb=useMemo(()=>visibleBnks.reduce((s,b)=>s+bbal(b),0),[visibleBnks,bbal]);

  // carry forward: total visible bank balance at start of filtered month
  const carryBal=useMemo(()=>{
    const firstDay=new Date(y,m,1);
    return visibleBnks.reduce((s,b)=>s+bbalUntil(b,firstDay),0);
  },[visibleBnks,bbalUntil,m,y]);

  // csp: net card spend for billing cycle in m/y
  // For future months: includes materialized tx + forecasted items not yet in tx
  const csp=useCallback(cid=>{
    const card=crds.find(c=>c.id===cid);
    if(!card)return 0;
    const fromTx=tx.filter(t=>{
      if(t.atype!=="card"||t.aid!==cid)return false;
      const payD=t.payDate||cardPayDate(t.date,card.closing,card.due);
      const d=pd(payD);
      return d.getMonth()===m&&d.getFullYear()===y;
    }).reduce((s,t)=>s+(t.type==="despesa"?t.amt:-t.amt),0);
    // Add forecast items (future parcelas/recorrências not yet materialized)
    const fromFcasts=fcasts.filter(f=>{
      if(f.atype!=="card"||f.aid!==cid)return false;
      const payD=f.payDate||cardPayDate(f.date,card.closing,card.due);
      const d=pd(payD);
      return d.getMonth()===m&&d.getFullYear()===y;
    }).reduce((s,f)=>s+(f.type==="despesa"?f.amt:-f.amt),0);
    return fromTx+fromFcasts;
  },[tx,fcasts,crds,m,y]);
  const alab=useCallback(t=>{
    if(t.atype==="bank"){const b=bnks.find(b=>b.id===t.aid);return b?`${b.icon} ${b.name}`:""; }
    if(t.atype==="card"){const c=crds.find(c=>c.id===t.aid);return c?`${c.icon} ${c.name}`:""; }
    return "";
  },[bnks,crds]);

  const realPie=useMemo(()=>{
    const e=Object.entries(catD).filter(([,v])=>v>0);
    const sl=e.map(([id,v],i)=>({l:getCat(id).l,i:getCat(id).i,v,c:PCOLS[i%PCOLS.length]}));
    const used=e.reduce((s,[,v])=>s+v,0);
    if(totRPaid>used)sl.push({l:"Livre",v:totRPaid-used,c:"#1e3a5f"});
    return sl;
  },[catD,totRPaid,getCat]);
  const prevPie=useMemo(()=>{
    const e=Object.entries(catDF).filter(([,v])=>v>0);
    const sl=e.map(([id,v],i)=>({l:getCat(id).l,v,c:PCOLS[i%PCOLS.length]}));
    const used=e.reduce((s,[,v])=>s+v,0),tot=totR+fcR;
    if(tot>used)sl.push({l:"Livre",v:tot-used,c:"#1e3a5f"});
    return sl;
  },[catDF,totR,fcR,getCat]);
  const riskP=useMemo(()=>(totRPaid+fcR)>0?(totDPaid+fcD)/(totRPaid+fcR):0,[totRPaid,totDPaid,fcR,fcD]);
  const daysM=new Date(y,m+1,0).getDate();
  const dayN=m===NOW.getMonth()&&y===NOW.getFullYear()?NOW.getDate():daysM;

  const pM=useCallback(()=>setFilt(f=>f.m===0?{m:11,y:f.y-1}:{m:f.m-1,y:f.y}),[]);
  const nM=useCallback(()=>setFilt(f=>f.m===11?{m:0,y:f.y+1}:{m:f.m+1,y:f.y}),[]);
  const toast$=useCallback((msg,col="#22c55e")=>{setTst({msg,col});setTimeout(()=>setTst(null),2600);},[]);

  const handleUnlock=useCallback((newPin)=>{
    if(newPin){
      setSavedPin(newPin);
      // Save pin alongside full current state to avoid partial merge edge cases
      saveUserData(user.uid,{
        pin:newPin,
        tx:txRef.current,rec:recRef.current,inst:instRef.current,
        banks:bnksRef.current,cards:crdsRef.current,
        budg:budgRef.current,ccat:ccatRef.current,invoices:invRef.current,
      });
    }
    setLocked(false);
  },[user]);
  const handleLogout=useCallback(async()=>{
    if(saveTimer.current)clearTimeout(saveTimer.current);
    if(saveMaxTimer.current)clearTimeout(saveMaxTimer.current);
    await signOut(auth);
    toast$("Sessão encerrada","#f97316");
  },[toast$]);

  // ── Toggle paid ──
  const togglePaid=useCallback(id=>{
    const newTx=txRef.current.map(t=>t.id===id?{...t,paid:t.paid===false?true:false}:t);
    setTx(newTx);
    saveNow({tx:newTx});
  },[saveNow]);

  // ── Auto-confirm: bank auto transactions whose date has passed ──
  useEffect(()=>{
    if(!dataLoaded)return;
    const today=new Date();today.setHours(0,0,0,0);
    let changed=false;
    const next=txRef.current.map(t=>{
      if(t.atype==="bank"&&t.auto&&t.paid===false){
        const d=pd(t.date);d.setHours(0,0,0,0);
        if(d<=today){changed=true;return{...t,paid:true};}
      }
      return t;
    });
    if(changed){setTx(next);saveNow({tx:next});}
  },[dataLoaded,tx.length]);

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
      const pay=card?cardPayDate(adj,card.closing,card.due):adj;
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
      const newTxs=[
        {id:tid,  type:"despesa",amt:a,desc:`↔ Para: ${toLabel}`,cat:"transf",date:adjD,note:form.note||"",atype:form.atype,aid:parseInt(form.aid)||form.aid,isTO:true,pair:tid+1,paid:true},
        {id:tid+1,type:"receita",amt:a,desc:`↔ De: ${frLabel}`, cat:"transf",date:adjD,note:form.note||"",atype:form.toAtype,aid:parseInt(form.toAid)||form.toAid,isTE:true,pair:tid,paid:true},
        ...txRef.current
      ];
      setTx(newTxs);
      toast$("Transferência registrada ✓");setForm(mf());nav("home");
      saveNow({tx:newTxs});return;
    }
    const rawA=form.inst?parseFloat(String(form.tamt).replace(",",".")):parseFloat(String(form.amt).replace(",","."));
    if(!rawA||rawA<=0){toast$("Valor inválido","#ef4444");return;}
    if(!form.desc.trim()){toast$("Descrição obrigatória","#ef4444");return;}
    if(form.inst){
      const ic=parseInt(form.icount)||2;
      const newInst=[...instRef.current,{id:Date.now(),type:form.type,tamt:rawA,desc:form.desc,cat:form.cat,startDate:form.date,note:form.note||"",atype:form.atype,aid:parseInt(form.aid)||form.aid,icount:ic,bday:form.bday}];
      setInst(newInst);
      toast$(`Parcelado em ${ic}x de ${fmt(rawA/ic)} ✓`);setForm(mf());nav("home");
      saveNow({inst:newInst});return;
    }
    if(form.freq!=="none"||recEid){
      const tpl={id:recEid||Date.now(),type:form.type,amt:rawA,desc:form.desc,cat:form.cat,startDate:form.date,note:form.note||"",atype:form.atype,aid:parseInt(form.aid)||form.aid,freq:form.freq,bday:form.bday,autoPaid:form.autoPaid||false};
      if(recEid){
        setRecEditMdl({tpl, formSnap:{...form}});
        return;
      }
      const newRec=[...recRef.current,tpl];
      setRec(newRec);toast$("Recorrência salva ✓");
      setForm(mf());nav("home");
      saveNow({rec:newRec});return;
    }
    const adjD=adjBiz(form.date,form.bday);
    const cardObj=form.atype==="card"?crds.find(c=>c.id==(parseInt(form.aid)||form.aid)):null;
    const payDate=cardObj?cardPayDate(adjD,cardObj.closing,cardObj.due):undefined;
    if(eid){
      const newTx=txRef.current.map(t=>t.id===eid?{...t,type:form.type,amt:rawA,desc:form.desc,cat:form.cat,date:adjD,payDate,note:form.note||"",atype:form.atype,aid:parseInt(form.aid)||form.aid,...(form._editPaid!==undefined?{paid:form._editPaid}:{})}:t);
      setTx(newTx);
      setEid(null);toast$("Atualizado ✓");
      setForm(mf());nav("home");
      saveNow({tx:newTx});
    } else {
      const isPaidNow=form.atype==="card"?false:!!form.autoPaid;
      const newTx=[{id:Date.now(),type:form.type,amt:rawA,desc:form.desc,cat:form.cat,date:adjD,payDate,note:form.note||"",atype:form.atype,aid:parseInt(form.aid)||form.aid,paid:isPaidNow},...txRef.current];
      setTx(newTx);
      toast$(form.type==="receita"?"Receita adicionada ✓":"Despesa adicionada ✓");
      setForm(mf());nav("home");
      saveNow({tx:newTx});
    }
  };

  const startE=t=>{
    // If this tx was generated by a recurring template, route through the
    // "só este / este e seguintes" modal so the user can choose scope.
    if(t.rid){
      const tpl=rec.find(r=>r.id===t.rid);
      if(tpl){
        setEid(t.id);   // so the modal knows which specific tx to patch
        setRecEid(tpl.id);
        setForm({
          ...mf(),
          type:      t.type,
          amt:       String(t.amt),
          desc:      t.desc,
          cat:       t.cat,
          date:      t.date,
          note:      t.note||"",
          atype:     t.atype||"bank",
          aid:       t.aid||"",
          bday:      t.bday||tpl.bday||"ignore",
          freq:      tpl.freq||"monthly",
          autoPaid:  tpl.autoPaid||false,
          _editPaid: t.paid,
        });
        nav("add");
        return;
      }
    }
    // Regular (non-recurring) transaction — edit directly
    setEid(t.id);
    setForm({
      ...mf(),
      type:      t.type,
      amt:       String(t.amt),
      desc:      t.desc,
      cat:       t.cat,
      date:      t.date,
      note:      t.note||"",
      atype:     t.atype||"bank",
      aid:       t.aid||"",
      bday:      t.bday||"ignore",
      _editPaid: t.paid,
    });
    nav("add");
  };

  // Edit a pending (forecast) transaction — materialise it first then edit
  const startFcastE=fc=>{
    if(fc.isRF&&fc.rid&&fc.orig){
      const tpl=rec.find(r=>r.id===fc.rid);if(!tpl)return;
      const card=tpl.atype==="card"?crds.find(c=>c.id==tpl.aid):null;
      const payDate=card?cardPayDate(fc.date,card.closing,card.due):undefined;
      const newId=`r_${tpl.id}_${fc.orig}`;
      const existing=txRef.current.find(t=>t.id===newId);
      if(!existing){
        const newTx={id:newId,rk:`${tpl.id}__${fc.orig}`,rid:tpl.id,type:tpl.type,amt:tpl.amt,desc:tpl.desc,cat:tpl.cat,date:fc.date,payDate,note:tpl.note||"",atype:tpl.atype,aid:tpl.aid,auto:true,paid:false};
        const newTxList=[newTx,...txRef.current];
        setTx(newTxList);
        saveNow({tx:newTxList});
      }
      setEid(newId);
      setForm({...mf(),type:tpl.type,amt:String(tpl.amt),desc:tpl.desc,cat:tpl.cat,date:fc.date,note:tpl.note||"",atype:tpl.atype,aid:tpl.aid});
      nav("add");
    }
  };

  // Recurring edit — show modal: "só este" vs "este e seguintes"
  const startRecE=r=>{
    setRecEid(r.id);
    setForm({...mf(),type:r.type,amt:String(r.amt),desc:r.desc,cat:r.cat,date:r.startDate,note:r.note||"",atype:r.atype||"bank",aid:r.aid||"",freq:r.freq||"monthly",bday:r.bday||"ignore",autoPaid:r.autoPaid||false});
    nav("add");
  };
  const dTx=id=>{const newTx=txRef.current.filter(t=>t.id!==id);setTx(newTx);toast$("Removido","#f97316");saveNow({tx:newTx});};
  const dRec=id=>{
    const newRec=recRef.current.filter(r=>r.id!==id);
    const newTx=txRef.current.filter(t=>t.rid!==id);
    setRec(newRec);setTx(newTx);toast$("Removida","#f97316");
    saveNow({rec:newRec,tx:newTx});
  };
  const dInst=id=>{
    const newInst=instRef.current.filter(i=>i.id!==id);
    const newTx=txRef.current.filter(t=>t.iid!==id);
    setInst(newInst);setTx(newTx);toast$("Removido","#f97316");
    saveNow({inst:newInst,tx:newTx});
  };

  // ── Installment prepayment ──
  const antecipInst=({ins,parcsToAntecip,bankId,payDate,valorFinal})=>{
    const tid=Date.now();
    const bankName=bnksRef.current.find(b=>b.id===bankId)?.name||"conta";
    // Debit from bank
    const debit={id:tid,type:"despesa",amt:valorFinal,
      desc:`⚡ Antecip. ${ins.desc} (${parcsToAntecip.length}x)`,
      cat:ins.cat,date:payDate,note:"",atype:"bank",aid:bankId,
      isAntecip:true,instId:ins.id,paid:true};
    // Mark selected installment tx as paid (materialise if needed)
    let newTx=[debit,...txRef.current];
    const parcAmt=ins.tamt/ins.icount;
    parcsToAntecip.forEach(idx=>{
      const existing=newTx.find(t=>t.iid===ins.id&&t.iidx===idx);
      if(existing){
        newTx=newTx.map(t=>t.iid===ins.id&&t.iidx===idx?{...t,paid:true}:t);
      } else {
        // Materialise the future installment as paid
        const d=pd(ins.startDate);d.setMonth(d.getMonth()+(idx-1));
        const raw=d.toISOString().split("T")[0];
        const card=ins.atype==="card"?crdsRef.current.find(c=>c.id==ins.aid):null;
        const pDate=card?cardPayDate(raw,card.closing,card.due):undefined;
        newTx=[...newTx,{id:Date.now()+idx,iid:ins.id,iidx:idx,type:ins.type,
          amt:parcAmt,desc:ins.desc,cat:ins.cat,date:raw,payDate:pDate,
          note:"",atype:ins.atype,aid:ins.aid,auto:true,paid:true}];
      }
    });
    setTx(newTx);
    setAntecipMdl(null);
    toast$(`Antecipação de ${parcsToAntecip.length}x confirmada ✓`);
    saveNow({tx:newTx});
  };
  const sBank=()=>{
    const bal=parseFloat(String(bf.bal).replace(",","."));
    if(!bf.name.trim()){toast$("Nome obrigatório","#ef4444");return;}
    const newBnks=ebid
      ?bnksRef.current.map(b=>b.id===ebid?{...b,...bf,bal:isNaN(bal)?0:bal}:b)
      :[...bnksRef.current,{id:Date.now(),...bf,bal:isNaN(bal)?0:bal}];
    setBnks(newBnks);if(ebid)setEbid(null);setBf(EB);
    toast$("Banco salvo ✓");saveNow({banks:newBnks});
  };
  const sCard=()=>{
    const lim=parseFloat(String(cf.lim).replace(",","."));
    if(!cf.name.trim()){toast$("Nome obrigatório","#ef4444");return;}
    const newCrds=ecid
      ?crdsRef.current.map(c=>c.id===ecid?{...c,...cf,lim:isNaN(lim)?0:lim}:c)
      :[...crdsRef.current,{id:Date.now(),...cf,lim:isNaN(lim)?0:lim}];
    setCrds(newCrds);if(ecid)setEcid(null);setCf(EC);
    toast$("Cartão salvo ✓");saveNow({cards:newCrds});
  };
  const sCat=()=>{
    if(!catF.label.trim()){toast$("Nome obrigatório","#ef4444");return;}
    const nc={id:`c_${Date.now()}`,label:catF.label,icon:catF.icon,l:catF.label,i:catF.icon,custom:true};
    const newCcat={...ccatRef.current,[catF.type]:[...(ccatRef.current[catF.type]||[]),nc]};
    setCcat(newCcat);setCatF({label:"",icon:"🎯",type:"despesa"});
    toast$("Categoria criada ✓");saveNow({ccat:newCcat});
  };
  const dCat=(type,id)=>{
    const newCcat={...ccatRef.current,[type]:(ccatRef.current[type]||[]).filter(c=>c.id!==id)};
    setCcat(newCcat);toast$("Removida","#f97316");saveNow({ccat:newCcat});
  };
  const dBank=id=>{const newBnks=bnksRef.current.filter(b=>b.id!==id);setBnks(newBnks);toast$("Removido","#f97316");saveNow({banks:newBnks});};
  const dCard=id=>{const newCrds=crdsRef.current.filter(c=>c.id!==id);setCrds(newCrds);toast$("Removido","#f97316");saveNow({cards:newCrds});};
  const toggleHidden=id=>{const newBnks=bnksRef.current.map(b=>b.id===id?{...b,hidden:!b.hidden}:b);setBnks(newBnks);saveNow({banks:newBnks});};

  // ── Invoice helpers ──
  const invKey=(cardId,month,year)=>`${cardId}_${year}_${String(month).padStart(2,"0")}`;

  const invStatus=(card,month,year)=>{
    const key=invKey(card.id,month,year);
    if(invoices[key]?.status==="paid") return "paid";
    const closing=parseInt(card.closing)||10;
    const due=parseInt(card.due)||17;
    const today=new Date();today.setHours(0,0,0,0);
    // Compute actual closing month for the cycle DUE in month/year:
    // due >= closing → closes same month as due (ex: fecha 10, vence 17 → fecha/vence Abr)
    // due <  closing → closes month BEFORE due  (ex: fecha 29, vence 6  → fecha Mar, vence Abr)
    const closeMonth=due>=closing?month:(month===0?11:month-1);
    const closeYear =due>=closing?year :(month===0?year-1:year);
    const closeDate=new Date(closeYear,closeMonth,closing);closeDate.setHours(0,0,0,0);
    if(today>=closeDate)return "closed";
    return "open";
  };

  // Pay invoice: debit from bank, mark all card txs in the cycle as paid
  const payInvoice=(card,month,year,total,bankId,payDate)=>{
    const key=invKey(card.id,month,year);
    const tid=Date.now();
    const bankName=bnks.find(b=>b.id===bankId)?.name||"conta";
    const debit={id:tid,type:"despesa",amt:total,
      desc:`💳 Fatura ${card.name} ${MS[month]}/${year}`,
      cat:"fatura",date:payDate,note:"",
      atype:"bank",aid:bankId,
      isInvoicePay:true,cardId:card.id,invMonth:month,invYear:year,
      paid:true};
    const credit={id:tid+1,type:"receita",amt:total,
      desc:`✅ Pgto fatura ${MS[month]}/${year} — ${bankName}`,
      cat:"fatura",date:payDate,
      payDate:new Date(year,month,parseInt(card.due)||17).toISOString().split("T")[0],
      note:"",atype:"card",aid:card.id,
      isInvoiceCredit:true,cardId:card.id,invMonth:month,invYear:year,
      paid:true};
    // Mark all card transactions in this billing cycle as paid
    const newTx=[debit,credit,...txRef.current.map(t=>{
      if(t.atype!=="card"||t.aid!==card.id||t.isInvoiceCredit)return t;
      const payD=t.payDate||cardPayDate(t.date,card.closing,card.due);
      const d=pd(payD);
      if(d.getMonth()===month&&d.getFullYear()===year)return{...t,paid:true};
      return t;
    })];
    const newInv={...invRef.current,[key]:{status:"paid",paidDate:payDate,bankId,txIds:[tid,tid+1]}};
    setTx(newTx);
    setInvoices(newInv);
    toast$("Fatura paga ✓ 🎉");
    setInvPayMdl(null);
    saveNow({tx:newTx,invoices:newInv});
  };


  // ── Fix paid status for card transactions in already-paid invoices ──
  const fixInvoicePaid=()=>{
    const paidInvoices=Object.entries(invRef.current).filter(([,v])=>v.status==="paid");
    if(!paidInvoices.length){toast$("Nenhuma fatura paga encontrada","#f59e0b");return;}
    let fixed=0;
    const newTx=txRef.current.map(t=>{
      if(t.atype!=="card"||t.paid===true||t.isInvoiceCredit)return t;
      const card=crdsRef.current.find(c=>c.id===t.aid);
      if(!card)return t;
      const payD=t.payDate||cardPayDate(t.date,card.closing,card.due);
      const d=pd(payD);
      const key=invKey(t.aid,d.getMonth(),d.getFullYear());
      if(invRef.current[key]?.status==="paid"){fixed++;return{...t,paid:true};}
      return t;
    });
    if(fixed===0){toast$("Nenhuma transação para corrigir ✓","#34d399");return;}
    setTx(newTx);
    saveNow({tx:newTx});
    toast$(`${fixed} transação${fixed!==1?"ões":""} corrigida${fixed!==1?"s":""} ✓`,"#34d399");
  };
  const Hd=({back,title})=>(
    <div style={{display:"flex",alignItems:"center",gap:11}}>
      <button onClick={back} style={{background:"#1e293b",border:"none",color:"#94a3b8",width:36,height:36,borderRadius:10,fontSize:18,flexShrink:0}}>←</button>
      <h2 style={{fontSize:16,fontWeight:700}}>{title}</h2>
    </div>
  );

  // ── TxRow with swipe gestures ──────────────────────────────────────────────
  // Tap   → opens TxDetailDrawer
  // Swipe ← → reveals delete button (80px)
  // Swipe → → toggle paid (bank only)
  const TxRow=({t,onE,onD,onTogglePaid,onFcastE,compact=false})=>{
    const cat=getCat(t.cat);
    const isTr=t.isTO||t.isTE;
    const al=alab(t);
    const isCard=t.atype==="card";
    const isPaid=t.paid!==false;
    const billingDate=isCard&&t.payDate?t.payDate:null;
    const today=new Date();today.setHours(0,0,0,0);

    const isOverdue=t.real&&t.paid===false&&(()=>{
      if(isCard){
        const checkDate=billingDate?pd(billingDate):pd(t.date);
        checkDate.setHours(0,0,0,0);
        if(checkDate>=today)return false;
        if(billingDate){
          const bd=pd(billingDate);
          const iKey=`${t.aid}_${bd.getFullYear()}_${String(bd.getMonth()).padStart(2,"0")}`;
          if(invoices[iKey]?.status==="paid")return false;
        }
        return true;
      } else {
        const d=pd(t.date);d.setHours(0,0,0,0);
        return d<today;
      }
    })();

    // ── Swipe state ──
    const swipeRef=useRef({startX:0,startY:0,offsetX:0,dragging:false,decided:false,isHoriz:false,moved:false});
    const elRef=useRef(null);
    const [offsetX,setOffsetX]=useState(0);
    const SNAP=80;

    useEffect(()=>{
      const el=elRef.current;if(!el)return;
      const handler=e=>{
        const s=swipeRef.current;
        if(!s.dragging)return;
        const dx=e.touches[0].clientX-s.startX;
        const dy=e.touches[0].clientY-s.startY;
        if(!s.decided){
          // Use larger threshold (8px) to avoid accidental swipe detection
          if(Math.abs(dx)<8&&Math.abs(dy)<8)return;
          s.isHoriz=Math.abs(dx)>Math.abs(dy)*1.5; // stronger angle check
          s.decided=true;
        }
        if(!s.isHoriz)return;
        e.preventDefault();
        s.moved=true;
        const raw=s.offsetX+dx;
        const clamped=Math.max(-SNAP,Math.min(30,raw));
        setOffsetX(clamped);
      };
      el.addEventListener("touchmove",handler,{passive:false});
      return()=>el.removeEventListener("touchmove",handler);
    },[]);

    const onTouchStart=useCallback(e=>{
      const touch=e.touches[0];
      swipeRef.current={startX:touch.clientX,startY:touch.clientY,offsetX,dragging:true,decided:false,isHoriz:false,moved:false};
    },[offsetX]);

    const onTouchEnd=useCallback(e=>{
      const s=swipeRef.current;
      s.dragging=false;
      // If it was a swipe (moved horizontally), never open the drawer
      if(s.moved||s.isHoriz){
        const dx=e.changedTouches[0].clientX-s.startX;
        if(dx<-30){setOffsetX(-SNAP);return;}
        if(dx>30&&!isCard&&!isTr&&onTogglePaid&&t.real){onTogglePaid(t.id);}
        setOffsetX(0);
        return;
      }
      // Pure tap — open drawer only if panel is closed
      if(offsetX!==0){setOffsetX(0);return;}
      if(t.real!==false)setTxDetail(t);
    },[t,isCard,isTr,onTogglePaid,offsetX]);

    const handleRowClick=useCallback(e=>{
      // onClick fires after touchend on mobile — skip if swipe was detected
      if(swipeRef.current.moved){return;}
      if(offsetX!==0){setOffsetX(0);return;}
      if(t.real!==false)setTxDetail(t);
    },[offsetX,t]);

    return(
      <div style={{position:"relative",borderRadius:14,marginBottom:0}}>
        {/* Action layer — always present, visible only when swiped */}
        <div style={{position:"absolute",right:0,top:0,bottom:0,width:SNAP,
          display:"flex",alignItems:"center",justifyContent:"center",
          background:"#450a0a",borderRadius:"0 14px 14px 0",
          opacity:offsetX<-10?1:0,
          pointerEvents:offsetX<-40?"auto":"none",
          transition:"opacity .15s"}}>
          <button onPointerDown={e=>{e.stopPropagation();if(onD)onD(t.id);setOffsetX(0);}}
            style={{background:"none",border:"none",color:"#f87171",fontSize:22,cursor:"pointer",
              display:"flex",flexDirection:"column",alignItems:"center",gap:2,
              padding:"12px 16px"}}>
            🗑<span style={{fontSize:9,fontWeight:600}}>excluir</span>
          </button>
        </div>

        {/* Main row — slides left/right */}
        <div ref={elRef}
          className={`card ${t.real===false?"fc":""} ${!isPaid&&t.real&&!isCard?"unpaid-row":""} ${isOverdue?"overdue-row":""}`}
          style={{display:"flex",alignItems:"center",gap:10,padding:"11px 13px",
            transform:`translateX(${offsetX}px)`,
            transition:swipeRef.current.dragging?"none":"transform .2s ease",
            cursor:"pointer",userSelect:"none",WebkitUserSelect:"none",
            position:"relative",zIndex:1}}
          onClick={handleRowClick}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}>

          {/* Paid indicator dot — bank only */}
          {!isCard&&!isTr&&t.real&&(
            <div style={{width:6,height:6,borderRadius:"50%",flexShrink:0,
              background:isPaid?(isOverdue?"#ef4444":"#34d399"):"#f59e0b"}}/>
          )}

          <div style={{width:36,height:36,borderRadius:10,
            background:isTr?"#1e3a5f":t.type==="receita"?"#064e3b":"#450a0a",
            display:"flex",alignItems:"center",justifyContent:"center",fontSize:17,flexShrink:0}}>
            {isTr?"↔️":cat.i}
          </div>

          <div style={{flex:1,minWidth:0}}>
            <div style={{display:"flex",alignItems:"center",gap:4,flexWrap:"wrap"}}>
              <p style={{fontSize:13,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",
                whiteSpace:"nowrap",maxWidth:"100%"}}>{t.desc}</p>
              {t.iidx&&<span className="bdg" style={{background:"#1e3a5f",color:"#7dd3fc",flexShrink:0}}>{t.iidx}/{t.icount}</span>}
              {t.auto&&t.rid&&<span className="bdg" style={{background:"#2d1a4f",color:"#c4b5fd",flexShrink:0}}>🔁</span>}
              {!t.real&&<span className="bdg" style={{background:"#0c2340",color:"#7dd3fc",flexShrink:0}}>🔮</span>}
              {!isCard&&!isTr&&t.real&&!isPaid&&!isOverdue&&<span className="bdg" style={{background:"#451a03",color:"#f59e0b",flexShrink:0}}>pendente</span>}
              {!isCard&&!isTr&&t.real&&isOverdue&&<span className="bdg" style={{background:"#450a0a",color:"#ef4444",flexShrink:0}}>atrasado</span>}
              {t.real&&isCard&&isOverdue&&<span className="bdg" style={{background:"#450a0a",color:"#ef4444",flexShrink:0}}>fatura atrasada</span>}
            </div>
            <p style={{fontSize:10,color:"#64748b",marginTop:1}}>
              {compact
                ? pd(t.date).toLocaleDateString("pt-BR")
                : billingDate
                  ? <><span>compra {pd(t.date).toLocaleDateString("pt-BR")}</span><span style={{color:isOverdue?"#ef4444":"#64748b"}}> · venc {pd(billingDate).toLocaleDateString("pt-BR")}</span></>
                  : pd(t.date).toLocaleDateString("pt-BR")
              }
              {!compact&&al?` · ${al}`:""}
            </p>
          </div>

          <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:3,flexShrink:0}}>
            <span style={{fontWeight:700,fontSize:13,color:t.type==="receita"?"#34d399":"#f87171"}}>
              {t.type==="receita"?"+":"-"}{fmt(t.amt)}
            </span>
            {/* Status badge */}
            {!isTr&&t.real&&(
              isOverdue
                ?<span className="bdg" style={{background:"#450a0a",color:"#ef4444"}}>atrasado</span>
                :isCard
                  ?(invoices[billingDate?(()=>{const bd=pd(billingDate);return`${t.aid}_${bd.getFullYear()}_${String(bd.getMonth()).padStart(2,"0")}`;})():""]?.status==="paid"
                    ?<span className="bdg" style={{background:"#064e3b",color:"#34d399"}}>pago</span>
                    :<span className="bdg" style={{background:"#0c1e2e",color:"#38bdf8"}}>na fatura</span>)
                  :isPaid
                    ?<span className="bdg" style={{background:"#064e3b",color:"#34d399"}}>pago</span>
                    :<span className="bdg" style={{background:"#451a03",color:"#f59e0b"}}>pendente</span>
            )}
            {/* Forecast edit button */}
            {!t.real&&onFcastE&&t.isRF&&(
              <button onPointerDown={e=>{e.stopPropagation();onFcastE(t);}}
                className="ab" style={{background:"#1e3a5f",color:"#38bdf8"}}>editar</button>
            )}
            {/* Swipe hint on real items */}
            {t.real&&offsetX===0&&(
              <span style={{fontSize:9,color:"#334155"}}>←</span>
            )}
          </div>
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
        {crds.map(c=><option key={c.id} value={c.id}>{c.icon} {c.name} (fecha {c.closing||10} · vence {c.due})</option>)}
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

      {/* Recurring Edit Modal — "só este" vs "este e seguintes" */}
      {recEditMdl&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.85)",zIndex:998,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
          <div className="card si" style={{width:"100%",maxWidth:340}}>
            <p style={{fontSize:16,fontWeight:700,marginBottom:6}}>✏️ Editar recorrência</p>
            <p style={{fontSize:12,color:"#94a3b8",marginBottom:20,lineHeight:1.6}}>
              {eid
                ? "Deseja aplicar as alterações apenas a este lançamento, ou a partir deste em diante?"
                : "Deseja atualizar todos os lançamentos futuros desta recorrência?"}
            </p>
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              {/* "Somente este" — only shown when editing a specific materialised tx */}
              {eid&&<button onClick={()=>{
                const {tpl}=recEditMdl;
                const rawA=parseFloat(String(form.amt).replace(",","."));
                const txDate=form.date||tpl.startDate;
                const adjD=adjBiz(txDate,form.bday||"ignore");
                const cardObj=form.atype==="card"?crds.find(c=>c.id==(parseInt(form.aid)||form.aid)):null;
                const payDate=cardObj?cardPayDate(adjD,cardObj.closing,cardObj.due):undefined;
                const newTx=txRef.current.map(t=>t.id===eid?{...t,type:form.type,amt:rawA,desc:form.desc,cat:form.cat,date:adjD,payDate,note:form.note||"",atype:form.atype,aid:parseInt(form.aid)||form.aid,...(form._editPaid!==undefined?{paid:form._editPaid}:{})}:t);
                setTx(newTx);
                setEid(null);setRecEid(null);setRecEditMdl(null);toast$("Este lançamento atualizado ✓");setForm(mf());nav("home");
                saveNow({tx:newTx});
              }} style={{padding:14,background:"#1e3a5f",border:"1px solid #38bdf8",borderRadius:11,color:"#38bdf8",fontWeight:600,fontSize:14,textAlign:"left"}}>
                📌 Somente este lançamento
                <p style={{fontSize:11,color:"#64748b",fontWeight:400,marginTop:3}}>Altera apenas este mês. Os demais continuam iguais.</p>
              </button>}
              <button onClick={()=>{
                const {tpl}=recEditMdl;
                const rawA=parseFloat(String(form.amt).replace(",","."));
                const fromDate=form.date||tpl.startDate;
                const newTpl={...tpl,type:form.type,amt:rawA,desc:form.desc,cat:form.cat,startDate:fromDate,note:form.note||"",atype:form.atype,aid:parseInt(form.aid)||form.aid,freq:form.freq||tpl.freq,bday:form.bday||tpl.bday,autoPaid:form.autoPaid||false};
                const newTx=txRef.current.filter(t=>!(t.rid===tpl.id&&pd(t.date)>=pd(fromDate)&&t.auto));
                const newRec=recRef.current.map(r=>r.id===tpl.id?newTpl:r);
                setTx(newTx);setRec(newRec);
                setEid(null);setRecEid(null);setRecEditMdl(null);toast$("Recorrência atualizada ✓");setForm(mf());nav("home");
                saveNow({tx:newTx,rec:newRec});
              }} style={{padding:14,background:"#064e3b",border:"1px solid #34d399",borderRadius:11,color:"#34d399",fontWeight:600,fontSize:14,textAlign:"left"}}>
                🔄 {eid?"Este e os seguintes":"Atualizar recorrência"}
                <p style={{fontSize:11,color:"#64748b",fontWeight:400,marginTop:3}}>
                  {eid?"Atualiza o modelo. Lançamentos futuros usarão os novos valores.":"Todos os lançamentos futuros usarão os novos valores."}
                </p>
              </button>
              <button onClick={()=>{setRecEditMdl(null);setRecEid(null);setEid(null);}} style={{padding:12,background:"#334155",border:"none",borderRadius:11,color:"#e2e8f0",fontWeight:600,fontSize:14}}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Invoice Payment Modal ── */}
      {invPayMdl&&<InvPayModal
        invPayMdl={invPayMdl}
        bnks={bnks}
        bbal={bbal}
        fmt={fmt}
        MS={MS}
        td={td}
        onCancel={()=>setInvPayMdl(null)}
        onConfirm={(bankId,payD)=>{
          if(!bankId){toast$("Selecione a conta","#ef4444");return;}
          payInvoice(invPayMdl.card,invPayMdl.month,invPayMdl.year,invPayMdl.total,bankId,payD);
        }}
      />}

      {/* ── Antecipação Modal ── */}
      {antecipMdl&&<AntecipacaoModal
        ins={antecipMdl.ins}
        tx={tx}
        bnks={bnks}
        bbal={bbal}
        crds={crds}
        cardPayDate={cardPayDate}
        pd={pd}
        onCancel={()=>setAntecipMdl(null)}
        onConfirm={({parcsToAntecip,bankId,payDate,valorFinal,desconto})=>
          antecipInst({ins:antecipMdl.ins,parcsToAntecip,bankId,payDate,valorFinal})}
      />}

      {/* ── Transaction Detail Drawer ── */}
      {txDetail&&<TxDetailDrawer
        t={txDetail}
        cats={cats}
        bnks={bnks}
        crds={crds}
        invoices={invoices}
        fmt={fmt}
        pd={pd}
        MS={MS}
        onClose={()=>setTxDetail(null)}
        onEdit={t=>{startE(t);}}
        onDelete={id=>setMdl({title:"Remover lançamento?",body:"Esta ação não pode ser desfeita.",danger:true,btn:"Remover",action:()=>dTx(id)})}
        onTogglePaid={togglePaid}
      />}

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
                <p style={{fontSize:10,color:"#94a3b8",fontWeight:600,letterSpacing:.5}}>SALDO DO MÊS</p>
                <p style={{fontSize:30,fontWeight:700,color:saldo>=0?"#34d399":"#f87171",fontFamily:"'DM Mono',monospace",letterSpacing:-1}}>{fmt(saldo)}</p>
              </div>
              {fcasts.length>0&&<><div style={{width:1,background:"#334155",alignSelf:"stretch"}}/>
              <div>
                <p style={{fontSize:10,color:"#94a3b8",fontWeight:600,letterSpacing:.5}}>PREVISTO FIM DO MÊS</p>
                <p style={{fontSize:20,fontWeight:700,color:saldoP>=0?"#7dd3fc":"#fca5a5",fontFamily:"'DM Mono',monospace"}}>{fmt(saldoP)}</p>
              </div></>}
            </div>
            {/* Carry forward row */}
            {visibleBnks.length>0&&<div style={{display:"flex",alignItems:"center",gap:6,marginTop:8,paddingTop:8,borderTop:"1px solid #1e3a5f"}}>
              <span style={{fontSize:9,color:"#64748b"}}>Anterior</span>
              <span style={{fontSize:11,fontWeight:600,color:"#64748b",fontFamily:"'DM Mono',monospace"}}>{fmt(carryBal)}</span>
              <span style={{fontSize:9,color:"#334155",margin:"0 2px"}}>→</span>
              <span style={{fontSize:11,fontWeight:700,color:tbb>=0?"#38bdf8":"#f87171",fontFamily:"'DM Mono',monospace"}}>{fmt(tbb)}</span>
              <span style={{fontSize:9,color:"#64748b"}}>nos bancos</span>
            </div>}
            <div style={{display:"flex",gap:14,marginTop:10,flexWrap:"wrap"}}>
              <div><p style={{fontSize:9,color:"#94a3b8"}}>↑ Receitas</p><p style={{fontSize:13,fontWeight:600,color:"#34d399"}}>{fmt(totR)}</p></div>
              <div><p style={{fontSize:9,color:"#94a3b8"}}>↓ Despesas</p><p style={{fontSize:13,fontWeight:600,color:"#f87171"}}>{fmt(totD)}</p></div>
              {pendD>0&&<div><p style={{fontSize:9,color:"#94a3b8"}}>⏳ A pagar</p><p style={{fontSize:13,fontWeight:600,color:"#f59e0b"}}>{fmt(pendD)}</p></div>}
              {pendR>0&&<div><p style={{fontSize:9,color:"#94a3b8"}}>⏳ A receber</p><p style={{fontSize:13,fontWeight:600,color:"#34d399",opacity:.7}}>{fmt(pendR)}</p></div>}
              {(fcD>0||fcR>0)&&<div><p style={{fontSize:9,color:"#94a3b8"}}>🔮 Prev.</p><p style={{fontSize:13,fontWeight:600,color:"#7dd3fc"}}>{fmt(fcR-fcD)}</p></div>}
            </div>
          </div>

          {bnks.length>0&&<div>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
              <p style={{fontSize:10,fontWeight:700,color:"#94a3b8",textTransform:"uppercase",letterSpacing:.5}}>Contas</p>
              <button onClick={()=>{nav("accounts");setAtab("banks");}} style={{background:"none",border:"none",color:"#38bdf8",fontSize:12}}>gerenciar</button>
            </div>
            <div style={{display:"flex",gap:10,overflowX:"auto",paddingBottom:4,scrollbarWidth:"none"}}>
              {bnks.map(b=>{const bal=bbal(b);return(
                <div key={b.id} onClick={()=>{setSelB(b);nav("bank");}} style={{background:b.hidden?"#1e293b":b.color+"22",border:`1px solid ${b.hidden?"#334155":b.color+"44"}`,borderRadius:14,padding:"11px 14px",minWidth:140,flexShrink:0,opacity:b.hidden?0.5:1,cursor:"pointer"}}>
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
              {crds.map(c=>{
                const sp=csp(c.id),lim=parseFloat(c.lim)||0,pct=lim>0?Math.min((sp/lim)*100,100):0,ov=lim>0&&sp>lim;
                const col=c.color||"#1e40af";
                const iStat=invStatus(c,m,y);
                return(
                <div key={c.id} onClick={()=>{setSelC(c);nav("card");}} style={{background:col+"33",border:`1px solid ${col}55`,borderRadius:14,padding:"11px 14px",minWidth:160,flexShrink:0,cursor:"pointer"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                    <p style={{fontSize:18}}>{c.icon}</p>
                    {iStat==="paid"&&<span style={{fontSize:9,fontWeight:700,color:"#34d399"}}>✓ paga</span>}
                    {iStat==="closed"&&<span style={{fontSize:9,fontWeight:700,color:"#f59e0b"}}>⚠ vence</span>}
                  </div>
                  <p style={{fontSize:12,fontWeight:600,marginTop:4,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:135,color:"#e2e8f0"}}>{c.name}</p>
                  <p style={{fontSize:13,fontWeight:700,color:ov?"#f87171":"#e2e8f0",fontFamily:"'DM Mono',monospace",marginTop:2}}>{fmt(sp)}{lim>0?` / ${fmt(lim)}`:""}</p>
                  {lim>0&&<div className="pb" style={{marginTop:6}}><div className="pf" style={{width:`${pct}%`,background:ov?"#ef4444":col}}/></div>}
                  <p style={{fontSize:9,color:"#64748b",marginTop:4}}>Fecha {c.closing||10} · Vence {c.due}</p>
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
            {[...confM].sort((a,b)=>pd(b.date)-pd(a.date)).slice(0,5).map(t=>{
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
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
            <h2 style={{fontSize:16,fontWeight:700}}>📊 Dashboards</h2>
          </div>
          <div className="seg">
            <button className={`st ${dtab==="dashs"?"on":""}`} onClick={()=>setDtab("dashs")}>📊 Análise</button>
            <button className={`st ${dtab==="metas"?"on":""}`} onClick={()=>setDtab("metas")}>🎯 Metas</button>
          </div>

          {dtab==="metas"&&<>
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
                  <button onClick={()=>{const v=parseFloat((bi[cat.id]||"").replace(",","."));if(!v||v<=0)return;const newBudg={...budgRef.current,[cat.id]:v};setBudg(newBudg);setBi(p=>({...p,[cat.id]:""}));toast$("Meta salva ✓");saveNow({budg:newBudg});}} style={{background:"linear-gradient(135deg,#38bdf8,#818cf8)",border:"none",color:"#fff",borderRadius:10,padding:"0 14px",fontWeight:600,fontSize:13,flexShrink:0}}>Salvar</button>
                </div>
              </div>
            );})}
          </>}

          {dtab==="dashs"&&<>
          {/* Cashflow timeline */}
          {visibleBnks.length>0&&<div className="card">
            <p style={{fontSize:10,fontWeight:700,color:"#94a3b8",textTransform:"uppercase",letterSpacing:.5,marginBottom:12}}>📈 Cashflow — {MS[m]}/{y}</p>
            <CashflowChart tx={tx} bnks={visibleBnks} crds={crds} m={m} y={y}
              cardPayDate={cardPayDate} pd={pd} fmt={fmt}/>
          </div>}
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
          </>}{/* end dtab==="dashs" */}
        </div>}{/* end view==="dashs" */}

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

            {/* Paid status for bank transactions — shown on new entries and edits */}
            {form.atype==="bank"&&!form.inst&&form.freq==="none"&&!recEid&&<div
              onClick={()=>setForm(f=>({...f,autoPaid:!f.autoPaid}))}
              style={{display:"flex",alignItems:"center",justifyContent:"space-between",background:"#1e293b",borderRadius:12,padding:"11px 14px",cursor:"pointer"}}>
              <div>
                <p style={{fontSize:13,fontWeight:600}}>{form.autoPaid?"✅ Já foi pago / debitado":"⏳ Ainda não foi pago"}</p>
                <p style={{fontSize:11,color:"#64748b",marginTop:2}}>{form.autoPaid?"Saldo atualizado imediatamente":"Fica pendente até você confirmar"}</p>
              </div>
              <button className={`tog ${form.autoPaid?"on":"off"}`} onClick={e=>{e.stopPropagation();setForm(f=>({...f,autoPaid:!f.autoPaid}));}}/>
            </div>}

            {/* Card payDate preview */}
            {form.atype==="card"&&form.date&&!form.inst&&(()=>{
              const card=crds.find(c=>c.id==(parseInt(form.aid)||form.aid));
              if(!card)return null;
              const adj=adjBiz(form.date,form.bday||"ignore");
              const pay=cardPayDate(adj,card.closing,card.due);
              const isCredit=form.type==="receita";
              return<div style={{background:"#0f172a",borderRadius:10,padding:"9px 13px",border:`1px solid ${isCredit?"#064e3b":"#334155"}`}}>
                <p style={{fontSize:10,color:isCredit?"#34d399":"#94a3b8",marginBottom:3,fontWeight:600}}>
                  {isCredit?"✅ CRÉDITO NA FATURA":"VENCIMENTO NO CARTÃO"}
                </p>
                <div style={{display:"flex",justifyContent:"space-between"}}>
                  <div><p style={{fontSize:9,color:"#64748b"}}>{isCredit?"Data do crédito":"Compra"}</p><p style={{fontSize:12,fontWeight:600,color:"#e2e8f0"}}>{pd(adj).toLocaleDateString("pt-BR")}</p></div>
                  <div style={{color:isCredit?"#34d399":"#38bdf8",fontSize:16,alignSelf:"center"}}>→</div>
                  <div style={{textAlign:"right"}}><p style={{fontSize:9,color:"#64748b"}}>{isCredit?"Fatura de":"Pagamento"}</p><p style={{fontSize:12,fontWeight:600,color:isCredit?"#34d399":"#38bdf8"}}>{pd(pay).toLocaleDateString("pt-BR")}</p></div>
                </div>
                {isCredit&&<p style={{fontSize:9,color:"#64748b",marginTop:4}}>Reduz o valor da fatura neste ciclo</p>}
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

            {/* Débito automático toggle — only for recurring templates */}
            {(form.freq!=="none"||recEid)&&!eid&&<div
              onClick={()=>setForm(f=>({...f,autoPaid:!f.autoPaid}))}
              style={{display:"flex",alignItems:"center",justifyContent:"space-between",background:"#1e293b",borderRadius:12,padding:"11px 14px",cursor:"pointer"}}>
              <div>
                <p style={{fontSize:13,fontWeight:600}}>📅 Débito automático</p>
                <p style={{fontSize:11,color:"#64748b",marginTop:2}}>{form.autoPaid?"Entra como pago automaticamente na data":"Fica pendente — você confirma manualmente"}</p>
              </div>
              <button className={`tog ${form.autoPaid?"on":"off"}`} onClick={e=>{e.stopPropagation();setForm(f=>({...f,autoPaid:!f.autoPaid}));}}/>
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

          {/* Search bar */}
          <div style={{position:"relative"}}>
            <span style={{position:"absolute",left:12,top:"50%",transform:"translateY(-50%)",fontSize:14,color:"#475569",pointerEvents:"none"}}>🔍</span>
            <input className="fi" placeholder="Buscar lançamentos…" value={histFilter.q}
              onChange={e=>setHistFilter(f=>({...f,q:e.target.value}))}
              style={{paddingLeft:34,fontSize:14}}/>
            {histFilter.q&&<button onClick={()=>setHistFilter(f=>({...f,q:""}))}
              style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",color:"#64748b",fontSize:16}}>×</button>}
          </div>

          {/* Filter chips */}
          <div style={{display:"flex",gap:6,overflowX:"auto",paddingBottom:2,scrollbarWidth:"none"}}>
            {[
              {key:"type",val:"all",  label:"Todos"},
              {key:"type",val:"receita", label:"↑ Receitas"},
              {key:"type",val:"despesa", label:"↓ Despesas"},
            ].map(chip=>(
              <button key={chip.val} onClick={()=>setHistFilter(f=>({...f,type:chip.val}))}
                style={{flexShrink:0,padding:"5px 11px",borderRadius:99,border:"1.5px solid",fontSize:11,fontWeight:600,whiteSpace:"nowrap",
                  borderColor:histFilter.type===chip.val?"#38bdf8":"#334155",
                  background:histFilter.type===chip.val?"#0c1e2e":"transparent",
                  color:histFilter.type===chip.val?"#38bdf8":"#64748b"}}>
                {chip.label}
              </button>
            ))}
            {/* Account filter chips */}
            {bnks.length>0&&<button onClick={()=>setHistFilter(f=>({...f,atype:f.atype==="bank"?"":"bank"}))}
              style={{flexShrink:0,padding:"5px 11px",borderRadius:99,border:"1.5px solid",fontSize:11,fontWeight:600,
                borderColor:histFilter.atype==="bank"?"#38bdf8":"#334155",
                background:histFilter.atype==="bank"?"#0c1e2e":"transparent",
                color:histFilter.atype==="bank"?"#38bdf8":"#64748b"}}>🏦 Banco</button>}
            {crds.length>0&&<button onClick={()=>setHistFilter(f=>({...f,atype:f.atype==="card"?"":"card"}))}
              style={{flexShrink:0,padding:"5px 11px",borderRadius:99,border:"1.5px solid",fontSize:11,fontWeight:600,
                borderColor:histFilter.atype==="card"?"#818cf8":"#334155",
                background:histFilter.atype==="card"?"#1e1b4b":"transparent",
                color:histFilter.atype==="card"?"#818cf8":"#64748b"}}>💳 Cartão</button>}
            {/* Active filter clear */}
            {(histFilter.type!=="all"||histFilter.cat||histFilter.atype||histFilter.q)&&(
              <button onClick={()=>setHistFilter({q:"",type:"all",cat:"",atype:""})}
                style={{flexShrink:0,padding:"5px 11px",borderRadius:99,border:"1.5px solid #ef4444",fontSize:11,fontWeight:600,color:"#ef4444",background:"transparent"}}>
                ✕ Limpar
              </button>
            )}
          </div>

          {/* Results count */}
          {(histFilter.type!=="all"||histFilter.cat||histFilter.atype||histFilter.q)&&(
            <p style={{fontSize:11,color:"#64748b"}}>{allMFiltered.length} resultado{allMFiltered.length!==1?"s":""}</p>
          )}

          {allMFiltered.length===0&&<div style={{textAlign:"center",padding:"40px 0",color:"#475569"}}>
            <p style={{fontSize:24,marginBottom:8}}>{histFilter.q||histFilter.type!=="all"?"🔍":"📋"}</p>
            <p style={{fontSize:13}}>{histFilter.q||histFilter.type!=="all"?"Nenhum resultado encontrado":"Nenhum lançamento este mês"}</p>
          </div>}
          {allMFiltered.map((t,i)=><TxRow key={t.id||t._fid||i} t={{...t,real:!!t.real}} onE={startE} onFcastE={startFcastE} onTogglePaid={t.real&&!t.isTO&&!t.isTE?togglePaid:null} onD={id=>setMdl({title:"Remover lançamento?",body:"Esta ação não pode ser desfeita.",danger:true,btn:"Remover",action:()=>dTx(id)})}/>)}
        </div>}

        {/* ══ REC ══ */}
        {view==="cashflow"&&<div className="si" style={{padding:"12px 18px",display:"flex",flexDirection:"column",gap:12}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
            <Hd back={()=>nav("home")} title="Recorrências & Parcelamentos"/>
            <button onClick={()=>nav("hist")} style={{background:"#1e293b",border:"none",color:"#38bdf8",fontSize:12,fontWeight:600,padding:"7px 12px",borderRadius:9}}>📋 Extrato</button>
          </div>
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
                    {r.autoPaid&&<span className="bdg" style={{background:"#064e3b",color:"#34d399"}}>📅 débito auto</span>}
                    {!r.autoPaid&&<span className="bdg" style={{background:"#451a03",color:"#f59e0b"}}>✋ manual</span>}
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
                <div style={{display:"flex",gap:8}}>
                  <button onClick={()=>setAntecipMdl({ins})} className="ab"
                    style={{flex:1,background:"#1e1b4b",color:"#818cf8",padding:"9px",textAlign:"center"}}>
                    ⚡ Antecipar
                  </button>
                  <button onClick={()=>setMdl({title:"Remover parcelamento?",body:"Remove o modelo e todos os lançamentos gerados.",danger:true,btn:"Remover",action:()=>dInst(ins.id)})} className="ab" style={{flex:1,background:"#450a0a",color:"#f87171",padding:"9px",textAlign:"center"}}>× Remover</button>
                </div>
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
            {/* Fix button for existing data with wrong paid status */}
            {Object.values(invoices).some(v=>v.status==="paid")&&(
              <div style={{background:"#1e293b",borderRadius:12,padding:"12px 14px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:10}}>
                <div>
                  <p style={{fontSize:12,fontWeight:600,color:"#f59e0b"}}>🔧 Corrigir status de parcelas</p>
                  <p style={{fontSize:10,color:"#64748b",marginTop:2}}>Marca como pagas as parcelas de faturas já quitadas</p>
                </div>
                <button onClick={fixInvoicePaid} className="ab" style={{background:"#451a03",color:"#f59e0b",flexShrink:0,whiteSpace:"nowrap"}}>Corrigir</button>
              </div>
            )}
            {crds.map(c=>{const sp=csp(c.id),lim=parseFloat(c.lim)||0,av=lim>0?lim-sp:null,pct=lim>0?Math.min((sp/lim)*100,100):0;return(
              <div key={c.id}>
                <div className="vc" style={{background:`linear-gradient(135deg,${c.color},${c.color}88)`}}>
                  <div style={{position:"absolute",top:-18,right:-18,width:90,height:90,borderRadius:"50%",background:"rgba(255,255,255,.06)"}}/>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                    <p style={{fontSize:22}}>{c.icon}</p><p style={{fontSize:10,color:"rgba(255,255,255,.6)"}}>Fecha {c.closing||10} · Vence {c.due}</p>
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
                  <button onClick={()=>{setEcid(c.id);setCf({name:c.name,lim:String(c.lim),color:c.color,closing:c.closing||"10",due:c.due,icon:c.icon});}} className="ab" style={{background:"#1e3a5f",color:"#38bdf8"}}>editar</button>
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
                <p style={{fontSize:12,color:"#94a3b8",whiteSpace:"nowrap",flexShrink:0}}>Fecha dia:</p>
                <input className="fi" type="number" inputMode="numeric" min="1" max="31" placeholder="10" value={cf.closing} onChange={e=>setCf(f=>({...f,closing:e.target.value}))}/>
              </div>
              <div style={{display:"flex",gap:10,alignItems:"center"}}>
                <p style={{fontSize:12,color:"#94a3b8",whiteSpace:"nowrap",flexShrink:0}}>Vence dia:</p>
                <input className="fi" type="number" inputMode="numeric" min="1" max="31" placeholder="17" value={cf.due} onChange={e=>setCf(f=>({...f,due:e.target.value}))}/>
              </div>
              <div style={{background:"#0f172a",borderRadius:10,padding:"9px 13px",border:"1px solid #334155"}}>
                <p style={{fontSize:9,color:"#64748b",marginBottom:4}}>COMO FUNCIONA O CICLO</p>
                <p style={{fontSize:11,color:"#94a3b8",lineHeight:1.6}}>
                  Compras até dia <strong style={{color:"#38bdf8"}}>{cf.closing||10}</strong> → fecha neste mês → vence dia <strong style={{color:"#34d399"}}>{cf.due||17}</strong> {parseInt(cf.due||17)>=parseInt(cf.closing||10)?"deste mês":"do mês seguinte"}.<br/>
                  Compras após dia <strong style={{color:"#38bdf8"}}>{cf.closing||10}</strong> → fecha no mês seguinte → vence dia <strong style={{color:"#34d399"}}>{cf.due||17}</strong> {parseInt(cf.due||17)>=parseInt(cf.closing||10)?"do mês seguinte":"dois meses à frente"}.
                </p>
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
          // real===true ensures only materialized transactions, no forecasts
          const isFutureMonth=(new Date(y,m,1))>new Date(NOW.getFullYear(),NOW.getMonth(),1);
          const cItems=[...allM.filter(i=>i.atype==="card"&&i.aid===selC.id&&!i.isInvoiceCredit&&(i.real===true||isFutureMonth))].sort((a,b)=>pd(b.date)-pd(a.date));
          const cInst=inst.filter(i=>i.atype==="card"&&i.aid===selC.id);
          const iStat=invStatus(selC,m,y);
          const isPaid=iStat==="paid";
          const isClosed=iStat==="closed";
          const invData=invoices[invKey(selC.id,m,y)];
          return<div className="si" style={{padding:"12px 18px",display:"flex",flexDirection:"column",gap:12}}>
            <Hd back={()=>nav("home")} title={`Fatura — ${selC.name}`}/>
            <div className="vc" style={{background:`linear-gradient(135deg,${selC.color},${selC.color}88)`}}>
              <div style={{position:"absolute",top:-18,right:-18,width:90,height:90,borderRadius:"50%",background:"rgba(255,255,255,.06)"}}/>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <p style={{fontSize:22}}>{selC.icon}</p>
                {/* Invoice status badge */}
                {isPaid&&<span style={{background:"rgba(52,211,153,.2)",border:"1px solid #34d399",borderRadius:99,padding:"3px 10px",fontSize:11,fontWeight:700,color:"#34d399"}}>✓ Paga</span>}
                {isClosed&&!isPaid&&<span style={{background:"rgba(245,158,11,.2)",border:"1px solid #f59e0b",borderRadius:99,padding:"3px 10px",fontSize:11,fontWeight:700,color:"#f59e0b"}}>⚠ Aguardando pagamento</span>}
                {!isClosed&&!isPaid&&<span style={{background:"rgba(56,189,248,.15)",border:"1px solid #38bdf8",borderRadius:99,padding:"3px 10px",fontSize:11,fontWeight:700,color:"#38bdf8"}}>Em aberto</span>}
              </div>
              <p style={{fontSize:16,fontWeight:700,color:"#fff",marginTop:7}}>{selC.name}</p>
              <div style={{display:"flex",gap:20,marginTop:9}}>
                <div><p style={{fontSize:9,color:"rgba(255,255,255,.6)"}}>FATURA {MS[m].toUpperCase()}</p><p style={{fontSize:22,fontWeight:700,color:isPaid?"#a7f3d0":"#fff",fontFamily:"'DM Mono',monospace"}}>{fmt(sp)}</p></div>
                {lim>0&&<><div style={{width:1,background:"rgba(255,255,255,.2)"}}/>
                <div><p style={{fontSize:9,color:"rgba(255,255,255,.6)"}}>DISPONÍVEL</p><p style={{fontSize:14,fontWeight:700,color:av>=0?"#a7f3d0":"#fca5a5",fontFamily:"'DM Mono',monospace",marginTop:6}}>{fmt(av)}</p></div></>}
              </div>
              {lim>0&&<div style={{marginTop:10,height:4,background:"rgba(255,255,255,.2)",borderRadius:99,overflow:"hidden"}}><div style={{height:"100%",width:`${pct}%`,background:pct>85?"#f87171":"rgba(255,255,255,.8)",borderRadius:99,transition:"width .4s"}}/></div>}
              <p style={{fontSize:10,color:"rgba(255,255,255,.5)",marginTop:6}}>Fecha dia {selC.closing||10} · Vence dia {selC.due}</p>
              {isPaid&&invData?.paidDate&&<p style={{fontSize:10,color:"#34d399",marginTop:4}}>Pago em {pd(invData.paidDate).toLocaleDateString("pt-BR")} · {bnks.find(b=>b.id===invData.bankId)?.name||""}</p>}
            </div>

            {/* Pay Invoice button — shown when closed (past closing day) and not yet paid */}
            {isClosed&&!isPaid&&sp>0&&<button
              onClick={()=>setInvPayMdl({card:selC,month:m,year:y,total:sp})}
              style={{background:"linear-gradient(135deg,#f59e0b,#ef4444)",color:"#fff",border:"none",borderRadius:13,padding:14,fontSize:15,fontWeight:700,width:"100%"}}>
              💳 Pagar Fatura — {fmt(sp)}
            </button>}

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
            {cItems.map((t,i)=><TxRow key={t.id||t._fid||i} compact t={{...t,real:!!t.real}} onE={startE} onTogglePaid={t.real&&!t.isTO&&!t.isTE?togglePaid:null} onD={id=>setMdl({title:"Remover?",danger:true,btn:"Remover",action:()=>dTx(id)})}/>)}
          </div>;
        })()}

        {/* ══ BANK DETAIL ══ */}
        {view==="bank"&&selB&&(()=>{
          const firstOfMonth=new Date(y,m,1);
          const openBal=bbalUntil(selB,firstOfMonth);
          const bItems=tx.filter(t=>t.atype==="bank"&&t.aid===selB.id&&(()=>{const d=pd(t.date);return d.getMonth()===m&&d.getFullYear()===y;})());
          const bItemsAll=[...bItems].sort((a,b2)=>pd(b2.date)-pd(a.date));
          const paidIn=bItems.filter(t=>t.type==="receita"&&t.paid!==false).reduce((s,t)=>s+t.amt,0);
          const paidOut=bItems.filter(t=>t.type==="despesa"&&t.paid!==false).reduce((s,t)=>s+t.amt,0);
          const pendIn=bItems.filter(t=>t.type==="receita"&&t.paid===false).reduce((s,t)=>s+t.amt,0);
          const pendOut=bItems.filter(t=>t.type==="despesa"&&t.paid===false).reduce((s,t)=>s+t.amt,0);
          const closeBal=openBal+paidIn-paidOut;
          const projBal=closeBal+pendIn-pendOut;
          return<div className="si" style={{padding:"12px 18px",display:"flex",flexDirection:"column",gap:12}}>
            <Hd back={()=>nav("home")} title={`Extrato — ${selB.name}`}/>

            {/* Account header card */}
            <div className="vc" style={{background:`linear-gradient(135deg,${selB.color}cc,${selB.color}66)`,border:`1px solid ${selB.color}44`}}>
              <div style={{position:"absolute",top:-18,right:-18,width:90,height:90,borderRadius:"50%",background:"rgba(255,255,255,.06)"}}/>
              <p style={{fontSize:24}}>{selB.icon}</p>
              <p style={{fontSize:16,fontWeight:700,color:"#fff",marginTop:6}}>{selB.name}</p>
              {selB.hidden&&<span style={{fontSize:10,color:"rgba(255,255,255,.5)"}}>conta oculta</span>}

              {/* Balance row */}
              <div style={{display:"flex",gap:18,marginTop:10,flexWrap:"wrap"}}>
                <div>
                  <p style={{fontSize:9,color:"rgba(255,255,255,.6)"}}>SALDO ANTERIOR</p>
                  <p style={{fontSize:13,fontWeight:600,color:"rgba(255,255,255,.8)",fontFamily:"'DM Mono',monospace"}}>{fmt(openBal)}</p>
                </div>
                <div style={{width:1,background:"rgba(255,255,255,.2)"}}/>
                <div>
                  <p style={{fontSize:9,color:"rgba(255,255,255,.6)"}}>SALDO ATUAL</p>
                  <p style={{fontSize:20,fontWeight:700,color:closeBal>=0?"#a7f3d0":"#fca5a5",fontFamily:"'DM Mono',monospace"}}>{fmt(closeBal)}</p>
                </div>
                {(pendIn>0||pendOut>0)&&<>
                  <div style={{width:1,background:"rgba(255,255,255,.2)"}}/>
                  <div>
                    <p style={{fontSize:9,color:"rgba(255,255,255,.6)"}}>PROJETADO</p>
                    <p style={{fontSize:13,fontWeight:600,color:projBal>=0?"#7dd3fc":"#fca5a5",fontFamily:"'DM Mono',monospace"}}>{fmt(projBal)}</p>
                  </div>
                </>}
              </div>

              {/* Month summary */}
              <div style={{display:"flex",gap:14,marginTop:10}}>
                <div><p style={{fontSize:9,color:"rgba(255,255,255,.6)"}}>↑ Entradas</p><p style={{fontSize:12,fontWeight:600,color:"#a7f3d0"}}>{fmt(paidIn)}</p></div>
                <div><p style={{fontSize:9,color:"rgba(255,255,255,.6)"}}>↓ Saídas</p><p style={{fontSize:12,fontWeight:600,color:"#fca5a5"}}>{fmt(paidOut)}</p></div>
                {pendOut>0&&<div><p style={{fontSize:9,color:"rgba(255,255,255,.6)"}}>⏳ Pendente</p><p style={{fontSize:12,fontWeight:600,color:"#fde68a"}}>{fmt(pendOut)}</p></div>}
              </div>
            </div>

            <button onClick={()=>{setForm({...mf(),atype:"bank",aid:selB.id});nav("add");}}
              style={{background:`linear-gradient(135deg,${selB.color},${selB.color}99)`,color:"#fff",border:"none",borderRadius:13,padding:13,fontSize:14,fontWeight:700,width:"100%"}}>
              + Novo Lançamento
            </button>

            {!bItemsAll.length&&<p style={{textAlign:"center",fontSize:12,color:"#475569",padding:"28px 0"}}>Nenhum lançamento neste mês</p>}
            {bItemsAll.map((t,i)=><TxRow key={t.id||i} t={{...t,real:true}} onE={startE} onTogglePaid={!t.isTO&&!t.isTE?togglePaid:null} onD={id=>setMdl({title:"Remover lançamento?",body:"Esta ação não pode ser desfeita.",danger:true,btn:"Remover",action:()=>dTx(id)})}/>)}
          </div>;
        })()}

        {/* ══ BUDGETS ══ */}

      </div>{/* end scrollable */}

      {/* ── Bottom Nav ── */}
      <nav style={{position:"fixed",bottom:0,left:"50%",transform:"translateX(-50%)",width:"100%",maxWidth:480,background:"#1e293b",borderTop:"1px solid #2d3748",display:"flex",paddingTop:6,paddingBottom:"calc(8px + env(safe-area-inset-bottom))",zIndex:60}}>
        {[
          {id:"home",     label:"Início",   icon:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>},
          {id:"dashs",    label:"Dashs",    icon:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="9"/><path d="M12 12L8.5 8.5"/><path d="M12 7v1M17 12h-1M12 17v-1M7 12h1"/></svg>},
          {id:"add",      label:"Lançar",   icon:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/></svg>, action:()=>{setEid(null);setRecEid(null);setForm({...mf(),...firstAcc});nav("add");}},
          {id:"accounts", label:"Contas",   icon:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>},
          {id:"cashflow", label:"Recorrên.", icon:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M3 12h18M3 6l4 6-4 6M21 6l-4 6 4 6"/></svg>},
        ].map(tab=>(
          <button key={tab.id}
            className={`nb ${(view===tab.id||(tab.id==="accounts"&&["card","bank"].includes(view)))?"on":""}`}
            style={tab.id==="add"?{color:"#38bdf8"}:{}}
            onClick={()=>tab.action?tab.action():nav(tab.id)}>
            {tab.icon}{tab.label}
          </button>
        ))}
      </nav>
    </div>
  );
}