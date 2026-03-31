import {useState} from "react";
import {MS} from "../constants";
import {fmt,td,pd} from "../utils";

// ── Invoice Payment Modal ──────────────────────────────────────────────────────
export function InvPayModal({invPayMdl,bnks,bbal,onCancel,onConfirm}){
  const {card,month,year,total}=invPayMdl;
  const [selBank,setSelBank]=useState(bnks[0]?.id||"");
  const [payD,setPayD]=useState(td());

  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.88)",zIndex:998,display:"flex",alignItems:"flex-end",justifyContent:"center"}}>
      <div className="card si" style={{width:"100%",maxWidth:480,borderRadius:"20px 20px 0 0",padding:"24px 20px 32px"}}>
        <div style={{width:36,height:4,background:"#334155",borderRadius:99,margin:"0 auto 20px"}}/>
        <p style={{fontSize:17,fontWeight:700,marginBottom:4}}>💳 Pagar Fatura</p>
        <p style={{fontSize:12,color:"#64748b",marginBottom:18}}>{card.name} · {MS[month]}/{year}</p>

        <div style={{background:"#0f172a",borderRadius:12,padding:"14px 16px",marginBottom:18,textAlign:"center"}}>
          <p style={{fontSize:10,color:"#94a3b8",marginBottom:4}}>VALOR DA FATURA</p>
          <p style={{fontSize:28,fontWeight:700,color:"#f87171",fontFamily:"'DM Mono',monospace"}}>{fmt(total)}</p>
        </div>

        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          <div>
            <p style={{fontSize:10,color:"#94a3b8",marginBottom:5,fontWeight:600}}>PAGAR COM</p>
            {bnks.length===0
              ? <p style={{fontSize:12,color:"#f87171"}}>Nenhuma conta bancária cadastrada.</p>
              : <select className="fi" value={selBank} onChange={e=>setSelBank(parseInt(e.target.value))}>
                  {bnks.map(b=><option key={b.id} value={b.id}>{b.icon} {b.name} ({fmt(bbal(b))})</option>)}
                </select>
            }
          </div>
          <div>
            <p style={{fontSize:10,color:"#94a3b8",marginBottom:5,fontWeight:600}}>DATA DO PAGAMENTO</p>
            <input className="fi" type="date" value={payD} onChange={e=>setPayD(e.target.value)}/>
          </div>
        </div>

        <div style={{display:"flex",gap:10,marginTop:20}}>
          <button onClick={onCancel}
            style={{flex:1,padding:13,background:"#334155",border:"none",borderRadius:12,color:"#e2e8f0",fontWeight:600,fontSize:14}}>
            Cancelar
          </button>
          <button onClick={()=>onConfirm(selBank,payD)}
            style={{flex:2,padding:13,background:"linear-gradient(135deg,#34d399,#38bdf8)",border:"none",borderRadius:12,color:"#fff",fontWeight:700,fontSize:15}}>
            Confirmar Pagamento
          </button>
        </div>
      </div>
    </div>
  );
}
