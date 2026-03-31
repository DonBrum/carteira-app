import {useState,useEffect,useCallback} from "react";
import {auth,provider} from "../firebase";
import {signInWithPopup} from "firebase/auth";

// ── Loader ─────────────────────────────────────────────────────────────────────
export function Loader({icon="💰",msg="Carregando…"}){
  return(
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",minHeight:"100dvh",background:"#0f172a",gap:14}}>
      <p style={{fontSize:40}}>{icon}</p>
      <p style={{fontSize:13,color:"#64748b",fontWeight:500}}>{msg}</p>
    </div>
  );
}

// ── PIN Screen ─────────────────────────────────────────────────────────────────
export function PinScreen({savedPin,onUnlock}){
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
          {isSetup
            ? <button disabled={input.length<4} onClick={handleConfirm} style={{background:input.length<4?"#334155":"linear-gradient(135deg,#38bdf8,#818cf8)",border:"none",borderRadius:14,padding:"18px 0",fontSize:13,fontWeight:700,color:"#fff",WebkitTapHighlightColor:"transparent",opacity:input.length<4?0.5:1}}>
                {step===1?"Próximo":"✓ Salvar"}
              </button>
            : <div/>
          }
        </div>
        {error&&<p style={{fontSize:12,color:"#f87171",fontWeight:600}}>{isSetup?"PINs não coincidem":"PIN incorreto"}</p>}
      </div>
    </div>
  );
}

// ── Login Screen ───────────────────────────────────────────────────────────────
export function LoginScreen(){
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState("");

  const handleGoogle=async()=>{
    setLoading(true);setError("");
    try{await signInWithPopup(auth,provider);}
    catch(e){
      setError(e.code==="auth/popup-closed-by-user"?"Login cancelado.":"Erro ao entrar. Tente novamente.");
      setLoading(false);
    }
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
