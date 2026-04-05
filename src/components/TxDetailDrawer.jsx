// ── TxDetailDrawer ─────────────────────────────────────────────────────────────
// Bottom sheet showing full transaction details.
// Props: t, cats, bnks, crds, invoices, fmt, pd, MS, onClose, onEdit, onDelete, onTogglePaid
export function TxDetailDrawer({t,cats,bnks,crds,invoices,fmt,pd,MS,onClose,onEdit,onDelete,onTogglePaid}){
  if(!t)return null;

  const cat=[...cats.receita,...cats.despesa].find(c=>c.id===t.cat)||{l:t.cat,i:"•"};
  const isTr=t.isTO||t.isTE;
  const isCard=t.atype==="card";
  const isPaid=t.paid!==false;
  const bank=bnks.find(b=>b.id===t.aid);
  const card=crds.find(c=>c.id===t.aid);
  const acct=isCard?card:bank;

  // Invoice status for card transactions
  const invStatus=()=>{
    if(!isCard||!t.payDate)return null;
    const d=pd(t.payDate);
    const key=`${t.aid}_${d.getFullYear()}_${String(d.getMonth()).padStart(2,"0")}`;
    return invoices?.[key]?.status||null;
  };
  const iStat=invStatus();

  const Row=({label,value,color,mono})=>(
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"9px 0",borderBottom:"1px solid #0f172a"}}>
      <span style={{fontSize:11,color:"#64748b"}}>{label}</span>
      <span style={{fontSize:12,fontWeight:600,color:color||"#e2e8f0",fontFamily:mono?"'DM Mono',monospace":"inherit"}}>{value}</span>
    </div>
  );

  return(
    <div style={{position:"fixed",inset:0,zIndex:50,display:"flex",flexDirection:"column",justifyContent:"flex-end"}}
      onClick={onClose}>
      {/* Backdrop */}
      <div style={{position:"absolute",inset:0,background:"rgba(0,0,0,.7)"}}/>

      {/* Sheet */}
      <div onClick={e=>e.stopPropagation()}
        style={{position:"relative",background:"#1e293b",borderRadius:"22px 22px 0 0",
          padding:"0 0 calc(24px + env(safe-area-inset-bottom))",
          maxHeight:"85dvh",overflowY:"auto",width:"100%",maxWidth:480,margin:"0 auto"}}>

        {/* Handle */}
        <div style={{display:"flex",justifyContent:"center",padding:"12px 0 4px"}}>
          <div style={{width:38,height:4,background:"#334155",borderRadius:99}}/>
        </div>

        {/* Header */}
        <div style={{display:"flex",alignItems:"center",gap:14,padding:"12px 20px 16px",borderBottom:"1px solid #0f172a"}}>
          <div style={{width:48,height:48,borderRadius:14,flexShrink:0,
            background:isTr?"#1e3a5f":t.type==="receita"?"#064e3b":"#450a0a",
            display:"flex",alignItems:"center",justifyContent:"center",fontSize:22}}>
            {isTr?"↔️":cat.i}
          </div>
          <div style={{flex:1,minWidth:0}}>
            <p style={{fontSize:15,fontWeight:700,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.desc}</p>
            <p style={{fontSize:11,color:"#64748b",marginTop:2}}>{cat.l}{acct?` · ${acct.icon||""} ${acct.name||""}`:""}</p>
          </div>
          <div style={{textAlign:"right",flexShrink:0}}>
            <p style={{fontSize:22,fontWeight:700,fontFamily:"'DM Mono',monospace",
              color:t.type==="receita"?"#34d399":"#f87171"}}>
              {t.type==="receita"?"+":"-"}{fmt(t.amt)}
            </p>
            {/* Status badge */}
            {!isCard&&!isTr&&t.real&&(isPaid
              ?<span style={{fontSize:10,color:"#34d399",fontWeight:600}}>✓ pago</span>
              :<span style={{fontSize:10,color:"#f59e0b",fontWeight:600}}>⏳ pendente</span>
            )}
            {isCard&&iStat==="paid"&&<span style={{fontSize:10,color:"#34d399",fontWeight:600}}>✓ fatura paga</span>}
          </div>
        </div>

        {/* Details */}
        <div style={{padding:"4px 20px 16px"}}>
          <Row label="Data" value={pd(t.date).toLocaleDateString("pt-BR")}/>
          {isCard&&t.payDate&&<Row label="Vencimento fatura" value={pd(t.payDate).toLocaleDateString("pt-BR")} color="#38bdf8"/>}
          {t.iidx&&<Row label="Parcela" value={`${t.iidx} de ${t.icount}`} color="#7dd3fc"/>}
          {t.auto&&t.rid&&<Row label="Tipo" value="Recorrente 🔁" color="#c4b5fd"/>}
          {t.isAntecip&&<Row label="Tipo" value="Antecipação ⚡" color="#818cf8"/>}
          {isTr&&<Row label="Tipo" value="Transferência ↔️"/>}
          {t.note&&<Row label="Observação" value={t.note}/>}
          <Row label="Valor" value={fmt(t.amt)} mono color={t.type==="receita"?"#34d399":"#f87171"}/>
        </div>

        {/* Actions */}
        <div style={{display:"flex",flexDirection:"column",gap:8,padding:"0 20px"}}>
          {/* Toggle paid — bank only */}
          {!isCard&&!isTr&&t.real&&onTogglePaid&&(
            <button onClick={()=>{onTogglePaid(t.id);onClose();}}
              style={{padding:13,borderRadius:12,border:`1.5px solid ${isPaid?"#334155":"#34d399"}`,
                background:isPaid?"transparent":"#064e3b",
                color:isPaid?"#64748b":"#34d399",fontWeight:600,fontSize:14}}>
              {isPaid?"Marcar como pendente":"✓ Confirmar pagamento"}
            </button>
          )}
          {/* Edit */}
          {t.real&&!t.isInvoicePay&&onEdit&&(
            <button onClick={()=>{onEdit(t);onClose();}}
              style={{padding:13,borderRadius:12,border:"none",
                background:"#1e3a5f",color:"#38bdf8",fontWeight:600,fontSize:14}}>
              ✏️ Editar lançamento
            </button>
          )}
          {/* Delete */}
          {onDelete&&(
            <button onClick={()=>{onDelete(t.id);onClose();}}
              style={{padding:13,borderRadius:12,border:"none",
                background:"#450a0a",color:"#f87171",fontWeight:600,fontSize:14}}>
              🗑 Excluir
            </button>
          )}
        </div>
      </div>
    </div>
  );
}