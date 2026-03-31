import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { auth, db, provider } from "./firebase";
import { signOut, onAuthStateChanged } from "firebase/auth";
import { doc, setDoc, getDoc, onSnapshot } from "firebase/firestore";

// ── External modules ───────────────────────────────────────────────────────────
import { DC, EMOJIS, BCOLS, CCOLS, PCOLS, MS, BICONS, CICONS, FREQS, EB, EC } from "./constants";
import { fmt, td, pd, adjBiz, cardPayDate, autoOccs, recInMonth, instInMonth } from "./utils";
import { CSS } from "./styles";
import { Pie, Gauge } from "./components/Charts";
import { LoginScreen, PinScreen, Loader } from "./components/AuthScreens";
import { InvPayModal } from "./components/InvPayModal";

// ── Form default & Firestore ───────────────────────────────────────────────────
const mf=()=>({type:"despesa",amt:"",desc:"",cat:"alimentacao",date:td(),note:"",atype:"bank",aid:"",freq:"none",bday:"ignore",inst:false,icount:"2",tamt:"",isTransfer:false,toAtype:"bank",toAid:"",autoPaid:false});

const userDoc=uid=>doc(db,"users",uid);
const saveUserData=async(uid,data)=>{try{await setDoc(userDoc(uid),data,{merge:true})}catch(e){console.error("Firestore save:",e)}};

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
  const [epk,  setEpk] = useState(false);
  const [recEditMdl, setRecEditMdl]= useState(null); // {rec, form} for "só este / seguintes" modal
  const [invPayMdl,  setInvPayMdl] = useState(null); // {card, month, year, total} for invoice payment
  const saveTimer      = useRef(null);
  const mainRef        = useRef(null);
  const userRef        = useRef(null); // always current user for use in event handlers

  // Pull-to-refresh state
  const [ptr,     setPtr]    = useState(0);    // drag distance px
  const [ptrSaving,setPtrSaving]=useState(false); // showing sync indicator
  const ptrActive  = useRef(false);
  const ptrStartY  = useRef(0);

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

  // ── Debounced Firestore save — salva TUDO de uma vez ──
  const saveToFirestore=useCallback(()=>{
    if(!user)return;
    if(saveTimer.current)clearTimeout(saveTimer.current);
    saveTimer.current=setTimeout(()=>{
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
    },800);
  },[user]);

  // ── Immediate save — cancels debounce and saves right now ──
  const saveNow=useCallback(async()=>{
    const u=userRef.current;
    if(!u)return;
    if(saveTimer.current){clearTimeout(saveTimer.current);saveTimer.current=null;}
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

  // ── Pull-to-refresh ──
  useEffect(()=>{
    const el=mainRef.current;
    if(!el)return;
    const onStart=e=>{
      if(el.scrollTop>0)return;
      ptrActive.current=true;
      ptrStartY.current=e.touches[0].clientY;
    };
    const onMove=e=>{
      if(!ptrActive.current)return;
      const dy=e.touches[0].clientY-ptrStartY.current;
      if(dy<0){ptrActive.current=false;setPtr(0);return;}
      e.preventDefault();
      setPtr(Math.min(dy,80));
    };
    const onEnd=async()=>{
      if(!ptrActive.current)return;
      ptrActive.current=false;
      if(ptr>=60){
        setPtrSaving(true);
        await saveNow();
        try{
          const snap=await getDoc(userDoc(userRef.current?.uid));
          if(snap.exists()){
            const d=snap.data();
            if(d.tx)       setTx(d.tx);
            if(d.rec)      setRec(d.rec);
            if(d.inst)     setInst(d.inst);
            if(d.banks)    setBnks(d.banks);
            if(d.cards)    setCrds(d.cards);
            if(d.budg)     setBudg(d.budg);
            if(d.ccat)     setCcat(d.ccat);
            if(d.invoices) setInvoices(d.invoices);
          }
        }catch(e){console.error("PTR sync:",e);}
        setTimeout(()=>setPtrSaving(false),1200);
        toast$("Sincronizado ✓","#34d399");
      }
      setPtr(0);
    };
    el.addEventListener("touchstart",onStart,{passive:true});
    el.addEventListener("touchmove",onMove,{passive:false});
    el.addEventListener("touchend",onEnd);
    return()=>{
      el.removeEventListener("touchstart",onStart);
      el.removeEventListener("touchmove",onMove);
      el.removeEventListener("touchend",onEnd);
    };
  },[ptr,saveNow]);

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
        // Compute payDate if card
        const card=tpl.atype==="card"?crds.find(c=>c.id==tpl.aid):null;
        const payDate=card?cardPayDate(o.date,card.closing,card.due):undefined;
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
          const payDate=card?cardPayDate(adj,card.closing,card.due):undefined;
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
          const payDate=card?cardPayDate(o.date,card.closing,card.due):undefined;
          items.push({_fid:`fr_${tpl.id}_${o.orig}`,type:tpl.type,amt:tpl.amt,desc:tpl.desc,cat:tpl.cat,date:o.date,payDate,atype:tpl.atype,aid:tpl.aid,isRF:true,rid:tpl.id,orig:o.orig});
        }
      }
    }
    for(const ins of inst){
      for(const o of instInMonth(ins,m,y)){const d=pd(o.date);if(d<=NOW)continue;
        const iid=`i_${ins.id}_${o.idx}`;
        if(!tx.find(t=>t.id===iid)){
          const card=ins.atype==="card"?crds.find(c=>c.id==ins.aid):null;
          const payDate=card?cardPayDate(o.date,card.closing,card.due):undefined;
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

  // bbalUntil: balance up to (not including) a specific date — used for month opening balance
  const bbalUntil=useCallback((b,untilDate)=>{
    const s=tx.filter(t=>t.atype==="bank"&&t.aid===b.id&&t.paid!==false&&pd(t.date)<untilDate).reduce((s,t)=>s+(t.type==="receita"?t.amt:-t.amt),0);
    return(parseFloat(b.bal)||0)+s;
  },[tx]);

  // tbb: only visible (non-hidden) banks
  const visibleBnks=useMemo(()=>bnks.filter(b=>!b.hidden),[bnks]);
  const tbb=useMemo(()=>visibleBnks.reduce((s,b)=>s+bbal(b),0),[visibleBnks,bbal]);

  // csp: total spent on card IN THE CURRENT BILLING CYCLE
  // Cycle = purchases whose payDate falls in month m/y
  // This correctly shows what will be billed regardless of purchase month
  const csp=useCallback(cid=>{
    const card=crds.find(c=>c.id===cid);
    if(!card)return 0;
    return tx.filter(t=>{
      if(t.atype!=="card"||t.aid!==cid||t.type!=="despesa")return false;
      // Compute payDate for this tx (it may already be stored, or compute it)
      const payD=t.payDate||cardPayDate(t.date,card.closing,card.due);
      const d=pd(payD);
      return d.getMonth()===m&&d.getFullYear()===y;
    }).reduce((s,t)=>s+t.amt,0);
  },[tx,crds,m,y]);
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

  // ── Auto-confirm: bank auto transactions whose date has passed ──
  useEffect(()=>{
    if(!dataLoaded)return;
    const today=new Date();today.setHours(0,0,0,0);
    setTx(p=>{
      let changed=false;
      const next=p.map(t=>{
        // Only bank auto transactions that are still pending
        if(t.atype==="bank"&&t.auto&&t.paid===false){
          const d=pd(t.date);d.setHours(0,0,0,0);
          if(d<=today){changed=true;return{...t,paid:true};}
        }
        return t;
      });
      return changed?next:p;
    });
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
      if(recEid){
        // Show choice: update only template (future) or also this single occurrence
        setRecEditMdl({tpl, formSnap:{...form}});
        return; // modal will call submitRecEdit
      }
      setRec(p=>[...p,tpl]);toast$("Recorrência salva ✓");
      setForm(mf());nav("home");return;
    }
    const adjD=adjBiz(form.date,form.bday);
    // Compute card payDate
    const cardObj=form.atype==="card"?crds.find(c=>c.id==(parseInt(form.aid)||form.aid)):null;
    const payDate=cardObj?cardPayDate(adjD,cardObj.closing,cardObj.due):undefined;
    if(eid){
      setTx(p=>p.map(t=>t.id===eid?{...t,type:form.type,amt:rawA,desc:form.desc,cat:form.cat,date:adjD,payDate,note:form.note||"",atype:form.atype,aid:parseInt(form.aid)||form.aid,...(form._editPaid!==undefined?{paid:form._editPaid}:{})}:t));
      setEid(null);toast$("Atualizado ✓");
    } else {
      const isPaidNow=form.atype==="card"?false:!!form.autoPaid;
      setTx(p=>[{id:Date.now(),type:form.type,amt:rawA,desc:form.desc,cat:form.cat,date:adjD,payDate,note:form.note||"",atype:form.atype,aid:parseInt(form.aid)||form.aid,paid:isPaidNow},...p]);
      toast$(form.type==="receita"?"Receita adicionada ✓":"Despesa adicionada ✓");
    }
    setForm(mf());nav("home");
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
    // For forecast recurring: create the tx entry then edit
    if(fc.isRF&&fc.rid&&fc.orig){
      const tpl=rec.find(r=>r.id===fc.rid);if(!tpl)return;
      const card=tpl.atype==="card"?crds.find(c=>c.id==tpl.aid):null;
      const payDate=card?cardPayDate(fc.date,card.closing,card.due):undefined;
      const newId=`r_${tpl.id}_${fc.orig}`;
      const newTx={id:newId,rk:`${tpl.id}__${fc.orig}`,rid:tpl.id,type:tpl.type,amt:tpl.amt,desc:tpl.desc,cat:tpl.cat,date:fc.date,payDate,note:tpl.note||"",atype:tpl.atype,aid:tpl.aid,auto:true,paid:false};
      setTx(p=>{const ex=new Set(p.map(t=>t.id));return ex.has(newId)?p:[newTx,...p];});
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

  // ── Invoice helpers ──
  const invKey=(cardId,month,year)=>`${cardId}_${year}_${String(month).padStart(2,"0")}`;

  // Returns the status of a card invoice for a given month/year
  // "paid" | "closed" (past closing day, unpaid) | "open" (current cycle)
  const invStatus=(card,month,year)=>{
    const key=invKey(card.id,month,year);
    if(invoices[key]?.status==="paid") return "paid";
    const today=new Date();
    const closing=parseInt(card.closing)||10;
    // Closing date for this cycle
    const closeDate=new Date(year,month,closing);
    if(today>closeDate) return "closed";
    return "open";
  };

  // Pay invoice: debit from bank, mark fatura as paid
  const payInvoice=(card,month,year,total,bankId,payDate)=>{
    const key=invKey(card.id,month,year);
    const tid=Date.now();
    const bankName=bnks.find(b=>b.id===bankId)?.name||"conta";
    // Debit from bank account
    const debit={id:tid,type:"despesa",amt:total,
      desc:`💳 Fatura ${card.name} ${MS[month]}/${year}`,
      cat:"fatura",date:payDate,note:"",
      atype:"bank",aid:bankId,
      isInvoicePay:true,cardId:card.id,invMonth:month,invYear:year,
      paid:true};
    // Credit on card (zeroes the fatura visually)
    const credit={id:tid+1,type:"receita",amt:total,
      desc:`✅ Pgto fatura ${MS[month]}/${year} — ${bankName}`,
      cat:"fatura",date:payDate,
      payDate:new Date(year,month,parseInt(card.due)||17).toISOString().split("T")[0],
      note:"",atype:"card",aid:card.id,
      isInvoiceCredit:true,cardId:card.id,invMonth:month,invYear:year,
      paid:true};
    setTx(p=>[debit,credit,...p]);
    setInvoices(p=>({...p,[key]:{status:"paid",paidDate:payDate,bankId,txIds:[tid,tid+1]}}));
    toast$("Fatura paga ✓ 🎉");
    setInvPayMdl(null);
  };

  // ── Recurring edit handlers ──
  // "Só este e seguintes" — update template startDate + amt/desc from the chosen date
  const submitRecEditFuture=()=>{
    if(!recEditMdl)return;
    const {tpl}=recEditMdl;
    // Remove future auto-generated tx from the old template (from chosen startDate onwards)
    setTx(p=>p.filter(t=>!(t.rid===tpl.id&&pd(t.date)>=pd(tpl.startDate))));
    setRec(p=>p.map(r=>r.id===tpl.id?tpl:r));
    setRecEid(null);setRecEditMdl(null);toast$("Recorrência atualizada (seguintes) ✓");
    setForm(mf());nav("home");
  };
  // "Somente este" — keep template unchanged, just update the single materialised tx
  const submitRecEditOne=()=>{
    if(!recEditMdl||!eid)return;
    const {tpl}=recEditMdl;
    // Keep template, only update this specific tx
    const cardObj=form.atype==="card"?crds.find(c=>c.id==(parseInt(form.aid)||form.aid)):null;
    const payDate=cardObj?cardPayDate(tpl.startDate,cardObj.closing,cardObj.due):undefined;
    const rawA=parseFloat(String(form.amt).replace(",","."));
    setTx(p=>p.map(t=>t.id===eid?{...t,type:form.type,amt:rawA,desc:form.desc,cat:form.cat,date:tpl.startDate,payDate,note:form.note||"",atype:form.atype,aid:parseInt(form.aid)||form.aid}:t));
    setEid(null);setRecEid(null);setRecEditMdl(null);toast$("Lançamento atualizado ✓");
    setForm(mf());nav("home");
  };



  // ── Shared UI ──
  const Hd=({back,title})=>(
    <div style={{display:"flex",alignItems:"center",gap:11}}>
      <button onClick={back} style={{background:"#1e293b",border:"none",color:"#94a3b8",width:36,height:36,borderRadius:10,fontSize:18,flexShrink:0}}>←</button>
      <h2 style={{fontSize:16,fontWeight:700}}>{title}</h2>
    </div>
  );

  const TxRow=({t,onE,onD,onTogglePaid,onFcastE})=>{
    const cat=getCat(t.cat);
    const isTr=t.isTO||t.isTE;
    const al=alab(t);
    const isCard=t.atype==="card";
    const isPaid=t.paid!==false;
    const billingDate=isCard&&t.payDate?t.payDate:null;
    const today=new Date();today.setHours(0,0,0,0);

    // Badge logic:
    // Card purchase: no paid/pending badge (purchase already happened); show "atrasado" only if fatura date passed unpaid
    // Bank manual: pending → atrasado if date passed
    // Bank auto: auto-confirmed by effect, so if still pending here it's edge case
    const isOverdue=t.real&&t.paid===false&&(()=>{
      if(isCard){
        // Card: overdue if payDate has passed
        const checkDate=billingDate?pd(billingDate):pd(t.date);
        checkDate.setHours(0,0,0,0);
        return checkDate<today;
      } else {
        const d=pd(t.date);d.setHours(0,0,0,0);
        return d<today;
      }
    })();

    const showPaidToggle=t.real&&!isTr&&!isCard&&onTogglePaid;
    const showCardStatus=t.real&&!isTr&&isCard;

    return(
      <div className={`card ${t.real===false?"fc":""} ${!isPaid&&t.real&&!isCard?"unpaid-row":""} ${isOverdue?"overdue-row":""}`}
        style={{display:"flex",alignItems:"center",gap:10,padding:"11px 13px"}}>

        {/* Paid toggle — only for bank transactions */}
        {showPaidToggle&&(
          <button onClick={()=>onTogglePaid(t.id)}
            title={isPaid?"Marcar como pendente":"Confirmar pagamento"}
            style={{width:24,height:24,borderRadius:"50%",border:`2px solid ${isOverdue?"#ef4444":isPaid?"#34d399":"#f59e0b"}`,background:isPaid?"#064e3b":"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontSize:12,color:isPaid?"#34d399":isOverdue?"#ef4444":"#f59e0b"}}>
            {isPaid?"✓":"!"}
          </button>
        )}

        <div style={{width:36,height:36,borderRadius:10,background:isTr?"#1e3a5f":t.type==="receita"?"#064e3b":"#450a0a",display:"flex",alignItems:"center",justifyContent:"center",fontSize:17,flexShrink:0}}>
          {isTr?"↔️":cat.i}
        </div>

        <div style={{flex:1,minWidth:0}}>
          <div style={{display:"flex",alignItems:"center",gap:4,flexWrap:"wrap"}}>
            <p style={{fontSize:13,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:"100%"}}>{t.desc}</p>
            {t.iidx&&<span className="bdg" style={{background:"#1e3a5f",color:"#7dd3fc",flexShrink:0}}>{t.iidx}/{t.icount}</span>}
            {t.auto&&t.rid&&<span className="bdg" style={{background:"#2d1a4f",color:"#c4b5fd",flexShrink:0}}>🔁</span>}
            {!t.real&&<span className="bdg" style={{background:"#0c2340",color:"#7dd3fc",flexShrink:0}}>🔮</span>}
            {/* Bank status badges */}
            {!isCard&&!isTr&&t.real&&!isPaid&&!isOverdue&&<span className="bdg" style={{background:"#451a03",color:"#f59e0b",flexShrink:0}}>pendente</span>}
            {!isCard&&!isTr&&t.real&&isOverdue&&<span className="bdg" style={{background:"#450a0a",color:"#ef4444",flexShrink:0}}>atrasado</span>}
            {/* Card fatura overdue badge */}
            {showCardStatus&&isOverdue&&<span className="bdg" style={{background:"#450a0a",color:"#ef4444",flexShrink:0}}>fatura atrasada</span>}
          </div>
          <p style={{fontSize:10,color:"#64748b",marginTop:1}}>
            {billingDate
              ? <><span>compra {pd(t.date).toLocaleDateString("pt-BR")}</span><span style={{color:isOverdue?"#ef4444":"#64748b"}}> · venc {pd(billingDate).toLocaleDateString("pt-BR")}</span></>
              : pd(t.date).toLocaleDateString("pt-BR")
            }
            {al?` · ${al}`:""}
          </p>
        </div>

        <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:5,flexShrink:0}}>
          <span style={{fontWeight:700,fontSize:13,color:t.type==="receita"?"#34d399":"#f87171"}}>
            {t.type==="receita"?"+":"-"}{fmt(t.amt)}
          </span>
          {/* Edit button for pending/forecast */}
          {!t.real&&onFcastE&&(t.isRF)&&(
            <button onClick={()=>onFcastE(t)} className="ab" style={{background:"#1e3a5f",color:"#38bdf8"}}>editar</button>
          )}
          {/* Edit/delete for ALL real non-transfer transactions */}
          {t.real&&!isTr&&(
            <div style={{display:"flex",gap:5}}>
              {onE&&<button onClick={()=>onE(t)} className="ab" style={{background:"#1e3a5f",color:"#38bdf8"}}>editar</button>}
              <button onClick={()=>onD(t.id)} className="ab" style={{background:"#450a0a",color:"#f87171"}}>×</button>
            </div>
          )}
          {t.real&&isTr&&<button onClick={()=>onD(t.id)} className="ab" style={{background:"#450a0a",color:"#f87171"}}>×</button>}
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
            <p style={{fontSize:12,color:"#94a3b8",marginBottom:20,lineHeight:1.6}}>Deseja aplicar as alterações apenas a este mês, ou a partir deste mês em diante?</p>
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              <button onClick={()=>{
                // "Somente este" — patch only this specific tx, keep template untouched
                const {tpl}=recEditMdl;
                const rawA=parseFloat(String(form.amt).replace(",","."));
                const txDate=form.date||tpl.startDate;
                const adjD=adjBiz(txDate,form.bday||"ignore");
                const cardObj=form.atype==="card"?crds.find(c=>c.id==(parseInt(form.aid)||form.aid)):null;
                const payDate=cardObj?cardPayDate(adjD,cardObj.closing,cardObj.due):undefined;
                if(eid){
                  setTx(p=>p.map(t=>t.id===eid?{...t,type:form.type,amt:rawA,desc:form.desc,cat:form.cat,date:adjD,payDate,note:form.note||"",atype:form.atype,aid:parseInt(form.aid)||form.aid,...(form._editPaid!==undefined?{paid:form._editPaid}:{})}:t));
                } else {
                  // Materialise as a one-off override
                  const key=`${tpl.id}__${txDate}`;
                  const newId=`r_${tpl.id}_${txDate}`;
                  setTx(p=>{const ex=new Set(p.map(t=>t.id));return ex.has(newId)?p:[{id:newId,rk:key,rid:tpl.id,type:form.type,amt:rawA,desc:form.desc,cat:form.cat,date:adjD,payDate,note:form.note||"",atype:form.atype,aid:parseInt(form.aid)||form.aid,auto:true,paid:false},...p];});
                }
                setEid(null);setRecEid(null);setRecEditMdl(null);toast$("Este lançamento atualizado ✓");setForm(mf());nav("home");
              }} style={{padding:14,background:"#1e3a5f",border:"1px solid #38bdf8",borderRadius:11,color:"#38bdf8",fontWeight:600,fontSize:14,textAlign:"left"}}>
                📌 Somente este lançamento
                <p style={{fontSize:11,color:"#64748b",fontWeight:400,marginTop:3}}>Altera apenas este mês. Os demais continuam iguais.</p>
              </button>
              <button onClick={()=>{
                // "Este e seguintes" — update template from the tx date onwards
                const {tpl}=recEditMdl;
                const rawA=parseFloat(String(form.amt).replace(",","."));
                const fromDate=form.date||tpl.startDate;
                const newTpl={...tpl,type:form.type,amt:rawA,desc:form.desc,cat:form.cat,startDate:fromDate,note:form.note||"",atype:form.atype,aid:parseInt(form.aid)||form.aid,freq:form.freq||tpl.freq,bday:form.bday||tpl.bday,autoPaid:form.autoPaid||false};
                // Remove auto-generated tx from this date onwards so they regenerate with new values
                setTx(p=>p.filter(t=>!(t.rid===tpl.id&&pd(t.date)>=pd(fromDate)&&t.auto)));
                setRec(p=>p.map(r=>r.id===tpl.id?newTpl:r));
                setEid(null);setRecEid(null);setRecEditMdl(null);toast$("Recorrência atualizada (seguintes) ✓");setForm(mf());nav("home");
              }} style={{padding:14,background:"#064e3b",border:"1px solid #34d399",borderRadius:11,color:"#34d399",fontWeight:600,fontSize:14,textAlign:"left"}}>
                🔄 Este e os seguintes
                <p style={{fontSize:11,color:"#64748b",fontWeight:400,marginTop:3}}>Atualiza o modelo. Lançamentos futuros usarão os novos valores.</p>
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

      {/* ── Pull-to-refresh indicator ── */}
      {(ptr>0||ptrSaving)&&(
        <div style={{
          position:"fixed",top:"calc(56px + env(safe-area-inset-top))",left:"50%",
          transform:"translateX(-50%)",zIndex:20,
          display:"flex",alignItems:"center",justifyContent:"center",
          width:40,height:40,borderRadius:"50%",
          background:"#1e293b",border:"1px solid #334155",
          boxShadow:"0 4px 16px rgba(0,0,0,.4)",
          transition:"opacity .2s",
          opacity:ptrSaving?1:ptr/60,
        }}>
          {ptrSaving
            ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2.5" style={{animation:"spin 0.8s linear infinite"}}>
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
              </svg>
            : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={ptr>=60?"#34d399":"#64748b"} strokeWidth="2.5">
                <path d="M12 5v14M5 12l7-7 7 7"/>
              </svg>
          }
        </div>
      )}
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>

      {/* Scrollable content */}
      <div ref={mainRef} style={{
        overflowY:"auto",
        paddingBottom:"calc(76px + env(safe-area-inset-bottom))",
        WebkitOverflowScrolling:"touch",
        transform:ptr>0?`translateY(${ptr*0.4}px)`:"none",
        transition:ptr>0?"none":"transform .25s ease",
      }}>

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
              {crds.map(c=>{const sp=csp(c.id),lim=parseFloat(c.lim)||0,pct=lim>0?Math.min((sp/lim)*100,100):0,ov=lim>0&&sp>lim;return(
                <div key={c.id} onClick={()=>{setSelC(c);nav("card");}} style={{background:c.color+"33",border:`1px solid ${c.color}55`,borderRadius:14,padding:"11px 14px",minWidth:160,flexShrink:0,cursor:"pointer"}}>
                  <p style={{fontSize:18}}>{c.icon}</p>
                  <p style={{fontSize:12,fontWeight:600,marginTop:4,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:135}}>{c.name}</p>
                  <p style={{fontSize:13,fontWeight:700,color:ov?"#f87171":"#e2e8f0",fontFamily:"'DM Mono',monospace",marginTop:2}}>{fmt(sp)}{lim>0?` / ${fmt(lim)}`:""}</p>
                  {lim>0&&<div className="pb" style={{marginTop:6}}><div className="pf" style={{width:`${pct}%`,background:ov?"#ef4444":c.color}}/></div>}
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
          {allM.length===0&&<div style={{textAlign:"center",padding:"40px 0",color:"#475569"}}><p style={{fontSize:13}}>Nenhum lançamento este mês</p></div>}
          {allM.map((t,i)=><TxRow key={t.id||t._fid||i} t={{...t,real:!!t.real}} onE={startE} onFcastE={startFcastE} onTogglePaid={t.real&&!t.isTO&&!t.isTE?togglePaid:null} onD={id=>setMdl({title:"Remover lançamento?",body:"Esta ação não pode ser desfeita.",danger:true,btn:"Remover",action:()=>dTx(id)})}/>)}
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
                  Compras até dia <strong style={{color:"#38bdf8"}}>{cf.closing||10}</strong> → fecha neste mês → vence dia <strong style={{color:"#34d399"}}>{cf.due||17}</strong> do mês seguinte.<br/>
                  Compras após dia <strong style={{color:"#38bdf8"}}>{cf.closing||10}</strong> → fecha no mês seguinte → vence dia <strong style={{color:"#34d399"}}>{cf.due||17}</strong> dois meses à frente.
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
          const cItems=allM.filter(i=>i.atype==="card"&&i.aid===selC.id&&!i.isInvoiceCredit);
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
            {cItems.map((t,i)=><TxRow key={t.id||t._fid||i} t={{...t,real:!!t.real}} onE={startE} onTogglePaid={t.real&&!t.isTO&&!t.isTE?togglePaid:null} onD={id=>setMdl({title:"Remover?",danger:true,btn:"Remover",action:()=>dTx(id)})}/>)}
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
            className={`nb ${(view===tab.id||(tab.id==="accounts"&&["card","budgets","cashflow","bank"].includes(view)))?"on":""}`}
            style={tab.id==="add"?{color:"#38bdf8"}:{}}
            onClick={()=>nav(tab.id)}>
            {tab.icon}{tab.label}
          </button>
        ))}
      </nav>
    </div>
  );
}