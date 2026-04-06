import {useState,useMemo} from "react";

// ── SplitModal ─────────────────────────────────────────────────────────────────
// Shows a split detail: list of people, amounts, paid status.
// Allows marking each person as paid → generates bank receipt.
export function SplitModal({split,bnks,bbal,fmt,td,pd,MS,onClose,onMarkPaid}){
  const [selBank,setSelBank]=useState(bnks[0]?.id||"");
  const [payDate,setPayDate]=useState(td());
  const [confirming,setConfirming]=useState(null); // person id being confirmed

  const pending=split.people.filter(p=>!p.paid);
  const done=split.people.filter(p=>p.paid);
  const totalPending=pending.reduce((s,p)=>s+p.share,0);

  return(
    <div style={{position:"fixed",inset:0,zIndex:50,display:"flex",flexDirection:"column",justifyContent:"flex-end"}}
      onClick={onClose}>
      <div style={{position:"absolute",inset:0,background:"rgba(0,0,0,.75)"}}/>
      <div onClick={e=>e.stopPropagation()}
        style={{position:"relative",background:"#1e293b",borderRadius:"22px 22px 0 0",
          padding:"0 0 calc(24px + env(safe-area-inset-bottom))",
          maxHeight:"88dvh",overflowY:"auto",width:"100%",maxWidth:480,margin:"0 auto"}}>

        {/* Handle */}
        <div style={{display:"flex",justifyContent:"center",padding:"12px 0 4px"}}>
          <div style={{width:38,height:4,background:"#334155",borderRadius:99}}/>
        </div>

        {/* Header */}
        <div style={{padding:"10px 20px 14px",borderBottom:"1px solid #0f172a"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
            <div>
              <p style={{fontSize:16,fontWeight:700,color:"#e2e8f0"}}>{split.desc}</p>
              <p style={{fontSize:11,color:"#64748b",marginTop:2}}>
                {pd(split.date).toLocaleDateString("pt-BR")} · {split.people.length} pessoa{split.people.length!==1?"s":""}
              </p>
            </div>
            <div style={{textAlign:"right"}}>
              <p style={{fontSize:22,fontWeight:700,color:"#f87171",fontFamily:"'DM Mono',monospace"}}>
                {fmt(split.amt)}
              </p>
              {totalPending>0&&<p style={{fontSize:11,color:"#f59e0b",marginTop:1}}>{fmt(totalPending)} a receber</p>}
            </div>
          </div>
        </div>

        {/* Pending people */}
        {pending.length>0&&<div style={{padding:"14px 20px 0"}}>
          <p style={{fontSize:10,fontWeight:700,color:"#f59e0b",marginBottom:10,letterSpacing:.5}}>AGUARDANDO REEMBOLSO</p>
          {pending.map(p=>(
            <div key={p.id}>
              {confirming===p.id?(
                /* Confirmation panel */
                <div style={{background:"#0f172a",borderRadius:12,padding:14,marginBottom:10}}>
                  <p style={{fontSize:13,fontWeight:600,marginBottom:12}}>
                    Confirmar recebimento de <span style={{color:"#34d399"}}>{fmt(p.share)}</span> de {p.name}?
                  </p>
                  <div style={{display:"flex",flexDirection:"column",gap:10}}>
                    <div>
                      <p style={{fontSize:10,color:"#94a3b8",fontWeight:600,marginBottom:5}}>DEPOSITAR EM</p>
                      <select className="fi" value={selBank} onChange={e=>setSelBank(parseInt(e.target.value))}>
                        {bnks.map(b=><option key={b.id} value={b.id}>{b.icon} {b.name} ({fmt(bbal(b))})</option>)}
                      </select>
                    </div>
                    <div>
                      <p style={{fontSize:10,color:"#94a3b8",fontWeight:600,marginBottom:5}}>DATA DO RECEBIMENTO</p>
                      <input className="fi" type="date" value={payDate} onChange={e=>setPayDate(e.target.value)}/>
                    </div>
                    <div style={{display:"flex",gap:8}}>
                      <button onClick={()=>setConfirming(null)}
                        style={{flex:1,padding:12,background:"#334155",border:"none",borderRadius:11,color:"#e2e8f0",fontWeight:600,fontSize:14}}>
                        Cancelar
                      </button>
                      <button onClick={()=>{onMarkPaid(split.id,p.id,selBank,payDate);setConfirming(null);}}
                        style={{flex:2,padding:12,background:"linear-gradient(135deg,#34d399,#38bdf8)",border:"none",borderRadius:11,color:"#fff",fontWeight:700,fontSize:14}}>
                        ✓ Confirmar Recebimento
                      </button>
                    </div>
                  </div>
                </div>
              ):(
                <div style={{display:"flex",alignItems:"center",gap:12,background:"#0f172a",borderRadius:12,padding:"12px 14px",marginBottom:8}}>
                  <div style={{width:38,height:38,borderRadius:"50%",background:"#451a03",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,flexShrink:0}}>
                    {p.name[0].toUpperCase()}
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <p style={{fontSize:13,fontWeight:600}}>{p.name}</p>
                    {p.email&&<p style={{fontSize:10,color:"#64748b",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.email}</p>}
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:10,flexShrink:0}}>
                    <p style={{fontSize:14,fontWeight:700,color:"#f87171",fontFamily:"'DM Mono',monospace"}}>{fmt(p.share)}</p>
                    <button onClick={()=>setConfirming(p.id)}
                      style={{background:"#064e3b",border:"1px solid #34d399",borderRadius:9,padding:"6px 12px",color:"#34d399",fontWeight:600,fontSize:12}}>
                      Recebi ✓
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>}

        {/* Done people */}
        {done.length>0&&<div style={{padding:"14px 20px 0"}}>
          <p style={{fontSize:10,fontWeight:700,color:"#34d399",marginBottom:10,letterSpacing:.5}}>RECEBIDOS</p>
          {done.map(p=>(
            <div key={p.id} style={{display:"flex",alignItems:"center",gap:12,background:"#0f172a",borderRadius:12,padding:"12px 14px",marginBottom:8,opacity:.7}}>
              <div style={{width:38,height:38,borderRadius:"50%",background:"#064e3b",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,flexShrink:0}}>
                {p.name[0].toUpperCase()}
              </div>
              <div style={{flex:1,minWidth:0}}>
                <p style={{fontSize:13,fontWeight:600}}>{p.name}</p>
                {p.paidDate&&<p style={{fontSize:10,color:"#64748b"}}>{pd(p.paidDate).toLocaleDateString("pt-BR")}</p>}
              </div>
              <div style={{display:"flex",alignItems:"center",gap:8,flexShrink:0}}>
                <p style={{fontSize:14,fontWeight:700,color:"#34d399",fontFamily:"'DM Mono',monospace"}}>{fmt(p.share)}</p>
                <span style={{fontSize:16}}>✓</span>
              </div>
            </div>
          ))}
        </div>}

        <div style={{padding:"16px 20px 0"}}>
          <button onClick={onClose}
            style={{width:"100%",padding:13,background:"#334155",border:"none",borderRadius:12,color:"#e2e8f0",fontWeight:600,fontSize:14}}>
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
