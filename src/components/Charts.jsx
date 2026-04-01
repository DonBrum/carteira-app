// ── Chart components ───────────────────────────────────────────────────────────
export function Pie({slices,sz=150,label,sub}){
  if(!slices?.length)return(
    <div style={{width:sz,height:sz,borderRadius:"50%",background:"#1e293b",display:"flex",alignItems:"center",justifyContent:"center"}}>
      <p style={{fontSize:11,color:"#475569"}}>Sem dados</p>
    </div>
  );
  const tot=slices.reduce((s,x)=>s+x.v,0);if(!tot)return null;
  let a=0;
  const paths=slices.map((sl,i)=>{
    const sw=sl.v/tot*2*Math.PI,x1=Math.cos(a)*0.85,y1=Math.sin(a)*0.85,
          x2=Math.cos(a+sw)*0.85,y2=Math.sin(a+sw)*0.85,lg=sw>Math.PI?1:0;
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

export function Gauge({pct=0,label,sub,sz=130}){
  const cp=Math.min(Math.max(pct,0),1);
  const r=0.75;
  const gc=pct>0.85?"#ef4444":pct>0.6?"#f59e0b":"#34d399";
  // Arc starts at left (-r,0) and sweeps clockwise to right (r,0)
  // Progress sweeps cp*180 degrees from the left
  const angle=cp*Math.PI; // 0 to PI
  const ex= -Math.cos(angle)*r;  // x end point
  const ey= -Math.sin(angle)*r;  // y end point (negative = up in SVG)
  const largeArc=cp>0.5?1:0;
  return(
    <div style={{position:"relative",width:sz,height:sz*0.6,flexShrink:0}}>
      <svg viewBox="-1.1 -1.1 2.2 1.2" style={{width:sz,height:sz*0.6}}>
        {/* Background track */}
        <path d={`M${-r} 0A${r} ${r} 0 0 1 ${r} 0`} fill="none" stroke="#1e293b" strokeWidth="0.22" strokeLinecap="round"/>
        {/* Progress arc */}
        {cp>0.01&&<path d={`M${-r} 0A${r} ${r} 0 ${largeArc} 1 ${ex} ${ey}`} fill="none" stroke={gc} strokeWidth="0.22" strokeLinecap="round"/>}
      </svg>
      <div style={{position:"absolute",bottom:0,left:0,right:0,textAlign:"center"}}>
        {label&&<p style={{fontSize:13,fontWeight:700,color:gc,fontFamily:"'DM Mono',monospace"}}>{label}</p>}
        {sub&&<p style={{fontSize:9,color:"#64748b",marginTop:1}}>{sub}</p>}
      </div>
    </div>
  );
}