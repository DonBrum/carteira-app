// ── Constants ──────────────────────────────────────────────────────────────────
export const DC={
  receita:[{id:"salario",l:"Salário",i:"💼"},{id:"freelance",l:"Freelance",i:"💻"},{id:"investimento",l:"Investimento",i:"📈"},{id:"outros_r",l:"Outros",i:"➕"}],
  despesa:[{id:"moradia",l:"Moradia",i:"🏠"},{id:"alimentacao",l:"Alimentação",i:"🍽️"},{id:"transporte",l:"Transporte",i:"🚗"},{id:"saude",l:"Saúde",i:"❤️"},{id:"lazer",l:"Lazer",i:"🎉"},{id:"educacao",l:"Educação",i:"📚"},{id:"vestuario",l:"Vestuário",i:"👕"},{id:"outros_d",l:"Outros",i:"📦"}]
};
export const EMOJIS=["🏠","🍽️","🚗","❤️","🎉","📚","👕","📦","💼","💻","📈","➕","🎯","✈️","🐾","🎮","🎵","🌿","☕","🛒","💊","🔧","📱","🎓","🍕","🚀","⭐","🎁","🏦","💰","🪙","🎨","📷","🛋️","🌍","🏋️","🔑","💇","🏖️","🎪"];
export const BCOLS=["#3b82f6","#8b5cf6","#ec4899","#f97316","#10b981","#f59e0b","#06b6d4","#ef4444"];
export const CCOLS=["#1e40af","#6d28d9","#9d174d","#92400e","#065f46","#1e3a5f","#374151","#7f1d1d"];
export const PCOLS=["#38bdf8","#818cf8","#34d399","#f87171","#fbbf24","#a78bfa","#fb923c","#4ade80","#f472b6","#60a5fa"];
export const MS=["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
export const BICONS=["🏦","🏧","💰","🪙","🏛️"];
export const CICONS=["💳","🃏","💎","⭐","🔷"];
export const FREQS=[{id:"none",l:"Não repetir"},{id:"weekly",l:"Semanal"},{id:"biweekly",l:"Quinzenal"},{id:"monthly",l:"Mensal"},{id:"bimonthly",l:"Bimestral"},{id:"quarterly",l:"Trimestral"},{id:"semiannual",l:"Semestral"},{id:"annual",l:"Anual"}];
export const HOL=new Set(["01-01","04-21","05-01","09-07","10-12","11-02","11-15","11-20","12-25"]);

export const EB={name:"",bal:"",color:BCOLS[0],icon:"🏦",hidden:false};
export const EC={name:"",lim:"",color:CCOLS[0],icon:"💳",closing:"10",due:"17"};
