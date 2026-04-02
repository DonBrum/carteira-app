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
// Regra:
//   1. Encontrar o mês de fechamento (mesmo mês se compra <= fechamento, mês seguinte se depois)
//   2. Se dueDay >= closingDay → vence no mesmo mês do fechamento
//      Se dueDay <  closingDay → vence no mês seguinte ao fechamento
//
// Exemplos com fechamento=10, vencimento=17:
//   Compra 05/04 → fecha 10/04 → vence 17/04  (dueDay 17 >= closingDay 10 → mesmo mês)
//   Compra 15/04 → fecha 10/05 → vence 17/05  (dueDay 17 >= closingDay 10 → mesmo mês)
//
// Exemplos com fechamento=29, vencimento=6:
//   Compra 05/04 → fecha 29/04 → vence 06/05  (dueDay 6 < closingDay 29 → mês seguinte)
//   Compra 30/04 → fecha 29/05 → vence 06/06  (dueDay 6 < closingDay 29 → mês seguinte)
export const cardPayDate=(purchaseDate,closingDay,dueDay)=>{
  const closing=parseInt(closingDay)||10;
  const due=parseInt(dueDay)||17;
  const d=pd(purchaseDate);
  const day=d.getDate();
  const purchaseMonth=d.getMonth(); // 0-11
  const purchaseYear=d.getFullYear();

  // Step 1: find closing month (0-11 normalized)
  const rawClosingMonth = day<=closing ? purchaseMonth : purchaseMonth+1;
  const closingYear  = purchaseYear + (rawClosingMonth>11?1:0);
  const closingMonth = rawClosingMonth%12; // normalize to 0-11

  // Step 2: due date — same month as closing if dueDay >= closingDay, else next month
  const addMonthForDue = due>=closing ? 0 : 1;
  const rawDueMonth = closingMonth + addMonthForDue;
  const dueYear  = closingYear + (rawDueMonth>11?1:0);
  const dueMonth = rawDueMonth%12; // normalize to 0-11

  return new Date(dueYear, dueMonth, due).toISOString().split("T")[0];
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