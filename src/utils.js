// ── Pure helpers ───────────────────────────────────────────────────────────────
export const fmt=v=>new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(v??0);
export const td=()=>new Date().toISOString().split("T")[0];
export const pd=s=>new Date(s+"T12:00:00");

import {HOL} from "./constants";

export const isBiz=d=>{
  const w=d.getDay();
  if(w===0||w===6)return false;
  return!HOL.has(`${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`);
};

export const adjBiz=(s,r)=>{
  if(r==="ignore")return s;
  let d=pd(s);
  if(isBiz(d))return s;
  const st=r==="next"?1:-1;
  let g=0;
  while(!isBiz(d)&&g++<15)d.setDate(d.getDate()+st);
  return d.toISOString().split("T")[0];
};

export const addF=(s,f)=>{
  const d=pd(s);
  if(f==="weekly")       d.setDate(d.getDate()+7);
  else if(f==="biweekly")d.setDate(d.getDate()+14);
  else if(f==="monthly") d.setMonth(d.getMonth()+1);
  else if(f==="bimonthly")d.setMonth(d.getMonth()+2);
  else if(f==="quarterly")d.setMonth(d.getMonth()+3);
  else if(f==="semiannual")d.setMonth(d.getMonth()+6);
  else if(f==="annual")  d.setFullYear(d.getFullYear()+1);
  else return null;
  return d.toISOString().split("T")[0];
};

// Card billing cycle
// Regra: encontrar o próximo fechamento a partir da data da compra.
// O vencimento é sempre no mês seguinte ao fechamento.
//
// Exemplos com fechamento=29, vencimento=6:
//   Compra 28/03 → fecha 29/03 → vence 06/04  (compra <= fechamento → fecha este mês)
//   Compra 30/03 → fecha 29/04 → vence 06/05  (compra > fechamento → fecha mês seguinte)
//   Compra 29/03 → fecha 29/03 → vence 06/04  (dia igual ao fechamento → fecha este mês)
export const cardPayDate=(purchaseDate,closingDay,dueDay)=>{
  const closing=parseInt(closingDay)||10;
  const due=parseInt(dueDay)||17;
  const d=pd(purchaseDate);
  const day=d.getDate();
  const purchaseMonth=d.getMonth();
  const purchaseYear=d.getFullYear();

  // Find the closing date of this cycle:
  // If purchase day <= closing day → closes this month
  // If purchase day >  closing day → closes next month
  const closingMonth = day<=closing ? purchaseMonth : purchaseMonth+1;
  const closingYear  = purchaseYear + (closingMonth>11?1:0);

  // Due date is always the month after closing
  const dueMonth = (closingMonth%12)+1;
  const dueYear  = closingYear + (closingMonth>=11?1:0);

  return new Date(dueYear, dueMonth%12, due).toISOString().split("T")[0];
};

// ── Recurring helpers ──────────────────────────────────────────────────────────
export function autoOccs(tpl,done){
  const now=new Date();const res=[];let cur=tpl.startDate;let g=0;
  while(g++<600){
    const adj=adjBiz(cur,tpl.bday||"ignore");
    const d=pd(adj);
    if(d>now)break;
    const key=`${tpl.id}__${cur}`;
    if(!done.has(key))res.push({key,date:adj,orig:cur});
    const nx=addF(cur,tpl.freq);
    if(!nx||nx===cur)break;
    cur=nx;
  }
  return res;
}

export function recInMonth(tpl,m,y){
  const ms=new Date(y,m,1),me=new Date(y,m+1,0);
  const res=[];let cur=tpl.startDate;let g=0;
  while(g++<600){
    const adj=adjBiz(cur,tpl.bday||"ignore");
    const d=pd(adj);
    if(d>me)break;
    if(d>=ms)res.push({date:adj,orig:cur});
    const nx=addF(cur,tpl.freq);
    if(!nx||nx===cur)break;
    cur=nx;
  }
  return res;
}

export function instInMonth(ins,m,y){
  const res=[];
  for(let i=0;i<ins.icount;i++){
    const d=pd(ins.startDate);
    d.setMonth(d.getMonth()+i);
    const raw=d.toISOString().split("T")[0];
    const adj=adjBiz(raw,ins.bday||"ignore");
    const dd=pd(adj);
    if(dd.getMonth()===m&&dd.getFullYear()===y)
      res.push({date:adj,orig:raw,idx:i+1,amt:ins.tamt/ins.icount});
  }
  return res;
}