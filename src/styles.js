// ── App CSS ────────────────────────────────────────────────────────────────────
export const CSS=`
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html,body{background:#0f172a;overscroll-behavior-y:none}
input,select,textarea{font-family:inherit;outline:none;color:#e2e8f0;font-size:16px;-webkit-appearance:none;appearance:none}
button{cursor:pointer;font-family:inherit;-webkit-tap-highlight-color:transparent;touch-action:manipulation}
::-webkit-scrollbar{width:4px}::-webkit-scrollbar-track{background:#1e293b}::-webkit-scrollbar-thumb{background:#334155;border-radius:4px}
.si{animation:si .22s ease}@keyframes si{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
.card{background:#1e293b;border-radius:14px;padding:14px}
.fi{background:#0f172a;border:1.5px solid #334155;border-radius:11px;padding:11px 14px;font-size:16px;width:100%;transition:border-color .2s;color:#e2e8f0}
.fi:focus{border-color:#38bdf8}
.seg{display:flex;background:#0f172a;border-radius:10px;padding:3px;gap:3px}
.st{flex:1;padding:8px 4px;border:none;border-radius:8px;font-size:11px;font-weight:600;transition:all .18s;background:transparent;color:#64748b;white-space:nowrap;touch-action:manipulation}
.st.on{background:#1e293b;color:#e2e8f0}
.tb{flex:1;padding:10px;border:none;border-radius:9px;font-size:14px;font-weight:600;transition:all .18s;touch-action:manipulation}
.tb.r.on{background:#064e3b;color:#34d399}.tb.d.on{background:#450a0a;color:#f87171}.tb:not(.on){background:transparent;color:#64748b}
.cg{display:grid;grid-template-columns:repeat(4,1fr);gap:7px}
.cb{background:#0f172a;border:1.5px solid #334155;border-radius:10px;padding:9px 3px;display:flex;flex-direction:column;align-items:center;gap:3px;font-size:10px;color:#94a3b8;transition:all .18s;touch-action:manipulation}
.cb.on{border-color:#38bdf8;color:#38bdf8;background:#0c1e2e}
.pb{height:5px;background:#0f172a;border-radius:99px;overflow:hidden}.pf{height:100%;border-radius:99px;transition:width .45s ease}
.nb{background:none;border:none;color:#64748b;font-size:9px;font-weight:500;display:flex;flex-direction:column;align-items:center;gap:2px;padding:6px 4px;transition:color .18s;flex:1;touch-action:manipulation;min-height:44px;justify-content:center}
.nb.on{color:#38bdf8}.nb svg{width:20px;height:20px}
.ab{padding:7px 11px;border:none;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;touch-action:manipulation;min-height:32px}
.cdot{width:22px;height:22px;border-radius:50%;border:2.5px solid transparent;cursor:pointer;flex-shrink:0;transition:transform .15s}
.cdot.on{border-color:#fff;transform:scale(1.25)}
.bdg{display:inline-flex;align-items:center;padding:2px 6px;border-radius:99px;font-size:9px;font-weight:700}
.tog{width:42px;height:24px;border-radius:99px;border:none;position:relative;transition:background .2s;cursor:pointer;flex-shrink:0;touch-action:manipulation}
.tog::after{content:'';position:absolute;top:3px;width:18px;height:18px;border-radius:50%;background:#fff;transition:left .2s}
.tog.on{background:#38bdf8}.tog.off{background:#334155}
.tog.on::after{left:21px}.tog.off::after{left:3px}
.vc{border-radius:18px;padding:18px;position:relative;overflow:hidden}
.fc{border-left:3px solid #7dd3fc;opacity:.75}
.unpaid-row{opacity:.65;border-left:3px solid #f59e0b}
.overdue-row{opacity:.8;border-left:3px solid #ef4444}
select.fi{background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 13px center;padding-right:36px}
select option{background:#1e293b;color:#e2e8f0}
`;