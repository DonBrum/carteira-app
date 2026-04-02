import {useState,useMemo} from "react";
import {fmt,td} from "../utils";
import {MS} from "../constants";

// ── Antecipação de Parcelas ────────────────────────────────────────────────────
export function AntecipacaoModal({ins,tx,bnks,bbal,crds,cardPayDate,pd,onCancel,onConfirm}){
  const parcValor=ins.tamt/ins.icount;

  // Find unpaid installment indices (future ones not yet paid)
  const unpaid=useMemo(()=>{
    const res=[];
    for(let i=1;i<=ins.icount;i++){
      const t=tx.find(t=>t.iid===ins.id&&t.iidx===i);
      if(!t||t.paid===false) res.push(i);
    }
    return res;
  },[tx,ins]);

  const [qtd,setQtd]       =useState(unpaid.length>0?1:0);
  const [bankId,setBankId] =useState(bnks[0]?.id||"");
  const [payDate,setPayDate]=useState(td());
  const [hasDesc,setHasDesc]=useState(false);
  const [totalStr,setTotalStr]=useState("");

  const valorPadrao=parcValor*qtd;
  const valorFinal=hasDesc&&parseFloat(totalStr.replace(",","."))||valorPadrao;
  const desconto=valorPadrao-valorFinal;
  const parcsToAntecip=unpaid.slice(0,qtd);

  if(!unpaid.length) return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.88)",zIndex:998,display:"flex",alignItems:"flex-end",justifyContent:"center"}}>
      <div className="card si" style={{width:"100%",maxWidth:480,borderRadius:"20px 20px 0 0",padding:"24px 20px 32px"}}>
        <div style={{width:36,height:4,background:"#334155",borderRadius:99,margin:"0 auto 20px"}}/>
        <p style={{fontSize:16,fontWeight:700,marginBottom:8}}>⚡ Antecipação</p>
        <p style={{fontSize:13,color:"#64748b",textAlign:"center",padding:"24px 0"}}>Todas as parcelas já foram pagas.</p>
        <button onClick={onCancel} style={{width:"100%",padding:13,background:"#334155",border:"none",borderRadius:12,color:"#e2e8f0",fontWeight:600,fontSize:14}}>Fechar</button>
      </div>
    </div>
  );

  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.88)",zIndex:998,display:"flex",alignItems:"flex-end",justifyContent:"center"}}>
      <div className="card si" style={{width:"100%",maxWidth:480,borderRadius:"20px 20px 0 0",padding:"24px 20px 32px",maxHeight:"90dvh",overflowY:"auto"}}>
        <div style={{width:36,height:4,background:"#334155",borderRadius:99,margin:"0 auto 20px"}}/>
        <p style={{fontSize:17,fontWeight:700,marginBottom:2}}>⚡ Antecipação de Parcelas</p>
        <p style={{fontSize:12,color:"#64748b",marginBottom:18}}>{ins.desc} · {unpaid.length} parcela{unpaid.length!==1?"s":""} restante{unpaid.length!==1?"s":""}</p>

        {/* Quantas parcelas */}
        <div style={{marginBottom:16}}>
          <p style={{fontSize:10,color:"#94a3b8",fontWeight:600,marginBottom:8}}>QUANTAS PARCELAS ANTECIPAR</p>
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
            {unpaid.map((_,i)=>{
              const n=i+1;
              return<button key={n} onClick={()=>{setQtd(n);setTotalStr("");}}
                style={{padding:"8px 12px",borderRadius:10,border:"1.5px solid",fontSize:12,fontWeight:600,
                  borderColor:qtd===n?"#818cf8":"#334155",background:qtd===n?"#1e1b4b":"transparent",
                  color:qtd===n?"#818cf8":"#64748b"}}>
                {n}x
                <br/><span style={{fontSize:10}}>{fmt(parcValor*n)}</span>
              </button>;
            })}
          </div>
        </div>

        {/* Parcelas selecionadas */}
        {parcsToAntecip.length>0&&<div style={{background:"#0f172a",borderRadius:10,padding:"10px 13px",marginBottom:16}}>
          <p style={{fontSize:9,color:"#64748b",marginBottom:6}}>PARCELAS SELECIONADAS</p>
          {parcsToAntecip.map(idx=><div key={idx} style={{display:"flex",justifyContent:"space-between",padding:"3px 0"}}>
            <span style={{fontSize:11,color:"#94a3b8"}}>Parcela {idx}/{ins.icount}</span>
            <span style={{fontSize:11,fontWeight:600,color:"#f87171"}}>{fmt(parcValor)}</span>
          </div>)}
          <div style={{borderTop:"1px solid #1e293b",marginTop:6,paddingTop:6,display:"flex",justifyContent:"space-between"}}>
            <span style={{fontSize:11,color:"#94a3b8"}}>Total padrão</span>
            <span style={{fontSize:12,fontWeight:700,color:"#e2e8f0"}}>{fmt(valorPadrao)}</span>
          </div>
        </div>}

        {/* Desconto */}
        <div style={{marginBottom:16}}>
          <div onClick={()=>{setHasDesc(h=>{if(h)setTotalStr("");return!h;})}}
            style={{display:"flex",alignItems:"center",justifyContent:"space-between",background:"#1e293b",borderRadius:12,padding:"11px 14px",cursor:"pointer",marginBottom:hasDesc?10:0}}>
            <div>
              <p style={{fontSize:13,fontWeight:600}}>💰 Aplicar desconto</p>
              <p style={{fontSize:11,color:"#64748b",marginTop:2}}>Informe o valor total com desconto</p>
            </div>
            <button className={`tog ${hasDesc?"on":"off"}`} onClick={e=>{e.stopPropagation();setHasDesc(h=>{if(h)setTotalStr("");return!h;});}}/>
          </div>
          {hasDesc&&<>
            <p style={{fontSize:10,color:"#94a3b8",fontWeight:600,marginBottom:5}}>VALOR TOTAL A PAGAR (com desconto)</p>
            <input className="fi" type="number" inputMode="decimal" placeholder={fmt(valorPadrao)}
              value={totalStr} onChange={e=>setTotalStr(e.target.value)}
              style={{fontSize:20,fontWeight:700,fontFamily:"'DM Mono',monospace",color:"#34d399"}}/>
            {desconto>0&&<p style={{fontSize:11,color:"#34d399",marginTop:5}}>✓ Desconto de {fmt(desconto)}</p>}
          </>}
        </div>

        {/* Banco + Data */}
        <div style={{display:"flex",flexDirection:"column",gap:12,marginBottom:20}}>
          <div>
            <p style={{fontSize:10,color:"#94a3b8",fontWeight:600,marginBottom:5}}>PAGAR COM</p>
            {bnks.length===0
              ?<p style={{fontSize:12,color:"#f87171"}}>Nenhuma conta cadastrada.</p>
              :<select className="fi" value={bankId} onChange={e=>setBankId(parseInt(e.target.value))}>
                {bnks.map(b=><option key={b.id} value={b.id}>{b.icon} {b.name} ({fmt(bbal(b))})</option>)}
              </select>
            }
          </div>
          <div>
            <p style={{fontSize:10,color:"#94a3b8",fontWeight:600,marginBottom:5}}>DATA DO PAGAMENTO</p>
            <input className="fi" type="date" value={payDate} onChange={e=>setPayDate(e.target.value)}/>
          </div>
        </div>

        {/* Resumo final */}
        <div style={{background:"#0f172a",borderRadius:12,padding:"14px 16px",marginBottom:20,textAlign:"center"}}>
          <p style={{fontSize:10,color:"#94a3b8",marginBottom:4}}>VOCÊ PAGARÁ</p>
          <p style={{fontSize:28,fontWeight:700,color:"#34d399",fontFamily:"'DM Mono',monospace"}}>{fmt(valorFinal)}</p>
          {desconto>0&&<p style={{fontSize:11,color:"#64748b",marginTop:2}}>economia de {fmt(desconto)}</p>}
        </div>

        <div style={{display:"flex",gap:10}}>
          <button onClick={onCancel}
            style={{flex:1,padding:13,background:"#334155",border:"none",borderRadius:12,color:"#e2e8f0",fontWeight:600,fontSize:14}}>
            Cancelar
          </button>
          <button
            disabled={!bankId||qtd===0||valorFinal<=0}
            onClick={()=>onConfirm({parcsToAntecip,bankId,payDate,valorFinal,desconto})}
            style={{flex:2,padding:13,background:(!bankId||qtd===0)?"#334155":"linear-gradient(135deg,#818cf8,#38bdf8)",border:"none",borderRadius:12,color:"#fff",fontWeight:700,fontSize:15,opacity:(!bankId||qtd===0)?0.5:1}}>
            Confirmar Antecipação
          </button>
        </div>
      </div>
    </div>
  );
}
