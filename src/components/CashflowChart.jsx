import {useMemo} from "react";
import {pd,fmt} from "../utils";

// ── Cashflow Timeline Chart ────────────────────────────────────────────────────
// Shows day-by-day bank balance for the month
// Solid line = confirmed (past + today), dashed = projected (future)
export function CashflowChart({tx,rec,inst,bnks,crds,m,y,cardPayDate,adjBiz,addF,autoOccs,recInMonth,instInMonth}){
  const daysInMonth=new Date(y,m+1,0).getDate();
  const today=new Date();today.setHours(0,0,0,0);
  const isCurrentMonth=today.getMonth()===m&&today.getFullYear()===y;

  // Opening balance = sum of all visible bank account balances up to first day of month
  const openBal=useMemo(()=>{
    const firstDay=new Date(y,m,1);
    return bnks.filter(b=>!b.hidden).reduce((sum,b)=>{
      const s=tx.filter(t=>t.atype==="bank"&&t.aid===b.id&&t.paid!==false&&pd(t.date)<firstDay)
        .reduce((a,t)=>a+(t.type==="receita"?t.amt:-t.amt),0);
      return sum+(parseFloat(b.bal)||0)+s;
    },0);
  },[tx,bnks,m,y]);

  // Build daily balance array
  const points=useMemo(()=>{
    const pts=[];
    let bal=openBal;

    // Confirmed bank transactions in this month (paid only)
    const confirmedTx=tx.filter(t=>{
      if(t.atype!=="bank"||t.paid===false)return false;
      const d=pd(t.date);
      return d.getMonth()===m&&d.getFullYear()===y;
    });

    // Pending/forecast bank transactions
    const pendingTx=tx.filter(t=>{
      if(t.atype!=="bank"||t.paid!==false)return false;
      const d=pd(t.date);
      return d.getMonth()===m&&d.getFullYear()===y;
    });

    for(let day=1;day<=daysInMonth;day++){
      const dayDate=new Date(y,m,day);dayDate.setHours(0,0,0,0);
      const dayStr=`${y}-${String(m+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
      const isPast=dayDate<=today;

      // Add confirmed transactions for this day
      confirmedTx.filter(t=>t.date===dayStr).forEach(t=>{
        bal+=t.type==="receita"?t.amt:-t.amt;
      });

      // Add pending/forecast for this day (projected)
      const proj=isPast?0:pendingTx.filter(t=>t.date===dayStr)
        .reduce((s,t)=>s+(t.type==="receita"?t.amt:-t.amt),0);

      pts.push({day,bal,proj:bal+proj,isPast,isToday:dayDate.getTime()===today.getTime()});
    }
    return pts;
  },[tx,bnks,m,y,openBal,daysInMonth,today]);

  if(!points.length)return null;

  const allVals=points.flatMap(p=>[p.bal,p.proj]);
  const minV=Math.min(...allVals);
  const maxV=Math.max(...allVals);
  const range=maxV-minV||1;
  const pad=range*0.12;
  const lo=minV-pad,hi=maxV+pad,rng=hi-lo;

  const W=440,H=120;
  const xOf=day=>((day-1)/(daysInMonth-1||1))*(W-20)+10;
  const yOf=val=>H-((val-lo)/rng)*H;

  // Build SVG paths
  const confirmedPath=points.filter(p=>p.isPast||p.isToday)
    .map((p,i)=>`${i===0?"M":"L"}${xOf(p.day)},${yOf(p.bal)}`).join(" ");
  const projectedPath=points.filter(p=>!p.isPast)
    .map((p,i)=>`${i===0?`M${xOf(points.find(x=>x.isToday)?.day||p.day)},${yOf(points.find(x=>x.isToday)?.bal||p.bal)} L`:"L"}${xOf(p.day)},${yOf(p.proj)}`).join(" ");

  const todayPt=points.find(p=>p.isToday);
  const lastPt=points[points.length-1];
  const endBal=isCurrentMonth?(todayPt?.bal||points[points.length-1].bal):lastPt.bal;
  const endProj=lastPt.proj;

  const zeroY=yOf(0);
  const showZero=lo<0&&hi>0;

  return(
    <div style={{position:"relative"}}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{width:"100%",height:H,overflow:"visible"}}>
        {/* Zero line */}
        {showZero&&<line x1={0} y1={zeroY} x2={W} y2={zeroY} stroke="#334155" strokeWidth="1" strokeDasharray="4,4"/>}

        {/* Projected area fill */}
        {projectedPath&&<path d={`${projectedPath} L${xOf(lastPt.day)},${H} L${xOf(todayPt?.day||1)},${H} Z`}
          fill={endProj>=0?"#34d39915":"#f8717115"}/>}

        {/* Confirmed area fill */}
        {confirmedPath&&<path d={`${confirmedPath} L${xOf(points.filter(p=>p.isPast||p.isToday).at(-1)?.day||1)},${H} L${xOf(points[0].day)},${H} Z`}
          fill={endBal>=0?"#34d39922":"#f8717122"}/>}

        {/* Projected line (dashed) */}
        {projectedPath&&<path d={projectedPath} fill="none"
          stroke={endProj>=0?"#34d399":"#f87171"} strokeWidth="2"
          strokeDasharray="5,4" strokeLinecap="round"/>}

        {/* Confirmed line (solid) */}
        {confirmedPath&&<path d={confirmedPath} fill="none"
          stroke={endBal>=0?"#34d399":"#f87171"} strokeWidth="2.5"
          strokeLinecap="round" strokeLinejoin="round"/>}

        {/* Today marker */}
        {todayPt&&isCurrentMonth&&<>
          <line x1={xOf(todayPt.day)} y1={0} x2={xOf(todayPt.day)} y2={H}
            stroke="#38bdf8" strokeWidth="1" strokeDasharray="3,3" opacity="0.6"/>
          <circle cx={xOf(todayPt.day)} cy={yOf(todayPt.bal)} r="4"
            fill="#38bdf8" stroke="#0f172a" strokeWidth="2"/>
        </>}

        {/* End balance dot */}
        <circle cx={xOf(lastPt.day)} cy={yOf(lastPt.proj)} r="3"
          fill={endProj>=0?"#34d399":"#f87171"} stroke="#0f172a" strokeWidth="2"/>
      </svg>

      {/* Labels */}
      <div style={{display:"flex",justifyContent:"space-between",marginTop:4}}>
        <span style={{fontSize:9,color:"#475569"}}>1</span>
        {isCurrentMonth&&todayPt&&<span style={{fontSize:9,color:"#38bdf8",fontWeight:600}}>Hoje {todayPt.day}</span>}
        <span style={{fontSize:9,color:"#475569"}}>{daysInMonth}</span>
      </div>

      <div style={{display:"flex",justifyContent:"space-between",marginTop:8,flexWrap:"wrap",gap:8}}>
        <div>
          <p style={{fontSize:9,color:"#94a3b8"}}>Saldo anterior</p>
          <p style={{fontSize:11,fontWeight:600,color:"#64748b",fontFamily:"'DM Mono',monospace"}}>{fmt(openBal)}</p>
        </div>
        {isCurrentMonth&&todayPt&&<div>
          <p style={{fontSize:9,color:"#38bdf8"}}>Hoje</p>
          <p style={{fontSize:11,fontWeight:600,color:todayPt.bal>=0?"#34d399":"#f87171",fontFamily:"'DM Mono',monospace"}}>{fmt(todayPt.bal)}</p>
        </div>}
        <div style={{textAlign:"right"}}>
          <p style={{fontSize:9,color:"#94a3b8"}}>Projetado fim do mês</p>
          <p style={{fontSize:11,fontWeight:600,color:endProj>=0?"#34d399":"#f87171",fontFamily:"'DM Mono',monospace"}}>{fmt(endProj)}</p>
        </div>
      </div>
    </div>
  );
}
