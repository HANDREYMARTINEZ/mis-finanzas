import { useState, useMemo, useRef, useEffect } from "react";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, AreaChart, Area } from "recharts";

const DEFAULT_EXPENSE_CATS = ["Alimentación","Transporte","Vivienda","Salud","Entretenimiento","Ropa","Tecnología","Educación","Otros gastos"];
const DEFAULT_INCOME_CATS  = ["Salario","Freelance","Inversiones","Ventas","Otros ingresos"];

const PAYMENT_METHODS = {
  expense: ["Efectivo","Tarjeta crédito","Tarjeta débito","QR / Nequi","PSE / Transferencia","Daviplata","Otro"],
  income:  ["Transferencia","Efectivo","Consignación","Nequi","Daviplata","Cheque","Otro"],
};

const METHOD_ICONS = {
  "Efectivo":"💵","Tarjeta crédito":"💳","Tarjeta débito":"💳","QR / Nequi":"📱",
  "PSE / Transferencia":"🏦","Daviplata":"📲","Transferencia":"🏦","Consignación":"🏧",
  "Nequi":"📱","Cheque":"📄","Otro":"💱",
};

const P = {
  income:"#34d399", expense:"#f87171", accent:"#818cf8", loan:"#fbbf24",
  bg:"#0f0f13", card:"#17171f", cardBorder:"#2a2a3a", muted:"#4a4a6a",
  text:"#e2e2f0", textSub:"#8888aa",
};
const CAT_COLORS=["#818cf8","#34d399","#f87171","#fbbf24","#60a5fa","#a78bfa","#fb923c","#38bdf8","#f472b6","#4ade80","#e879f9","#22d3ee"];

// Logos predefinidos (bancos/billeteras CO) + genéricos. `logo` en una cuenta puede ser
// un id de esta lista, un data: URL (imagen subida por el usuario), o vacío (ícono por tipo).
const BANK_LOGOS = [
  {id:"bancolombia", label:"Bancolombia",     bg:"#ffe600", fg:"#1a1a1a", t:"B"},
  {id:"nequi",       label:"Nequi",           bg:"#20063b", fg:"#da0081", t:"N"},
  {id:"daviplata",   label:"Daviplata",       bg:"#e2001a", fg:"#ffffff", t:"D"},
  {id:"davivienda",  label:"Davivienda",      bg:"#ed1c27", fg:"#ffffff", t:"D"},
  {id:"bbva",        label:"BBVA",            bg:"#004481", fg:"#ffffff", t:"B"},
  {id:"bogota",      label:"Banco de Bogotá", bg:"#12325b", fg:"#ffd200", t:"B"},
  {id:"occidente",   label:"Occidente",       bg:"#f5a800", fg:"#7a1f1f", t:"O"},
  {id:"efectivo",    label:"Efectivo",        bg:"rgba(251,191,36,.16)", fg:"#fbbf24", t:"$"},
  {id:"estrella",    label:"Genérico",        bg:"rgba(129,140,248,.16)", fg:"#818cf8", t:"★"},
];
const bankLogo = id => BANK_LOGOS.find(b=>b.id===id);
function renderLogo(card, size){
  const s = size||38;
  const box = {width:s,height:s,borderRadius:Math.round(s*0.29),flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",overflow:"hidden"};
  if(card && typeof card.logo==="string" && card.logo.startsWith("data:"))
    return <div style={box}><img src={card.logo} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/></div>;
  const preset = card && bankLogo(card.logo);
  if(preset) return <div style={{...box,background:preset.bg,color:preset.fg,fontWeight:800,fontSize:Math.round(s*0.46)}}>{preset.t}</div>;
  const t = card ? card.type : "";
  const emoji = t==="credito"?"💳":t==="efectivo"?"💵":"🏦";
  return <div style={{...box,background:"rgba(129,140,248,0.12)",fontSize:Math.round(s*0.46)}}>{emoji}</div>;
}

// Scrollbars: nativas ocultas en las sub-tabs, delgadas y oscuras en el resto
const SCROLLBAR_CSS = `
  .fin-app * { scrollbar-width: thin; scrollbar-color: rgba(129,140,248,0.3) transparent; }
  .fin-app *::-webkit-scrollbar { width: 6px; height: 6px; }
  .fin-app *::-webkit-scrollbar-track { background: transparent; }
  .fin-app *::-webkit-scrollbar-thumb { background: rgba(129,140,248,0.3); border-radius: 999px; }
  .fin-app *::-webkit-scrollbar-thumb:hover { background: rgba(129,140,248,0.5); }
  .fin-app *::-webkit-scrollbar-corner { background: transparent; }
  .fin-app .hide-sb { scrollbar-width: none; -ms-overflow-style: none; }
  .fin-app .hide-sb::-webkit-scrollbar { width: 0; height: 0; display: none; }
  /* Alto real de viewport en móvil (la barra de URL/gestos no lo recorta) */
  @supports (min-height:100dvh){ .fin-app, .fin-screen { min-height:100dvh !important; } }
`;

const fmtCOP = n => new Intl.NumberFormat("es-CO",{style:"currency",currency:"COP",maximumFractionDigits:0}).format(n);
const onlyDigits = v => (v==null?"":String(v)).replace(/\D/g,"");                 // "30.000" -> "30000"
const fmtMiles   = v => { const d=onlyDigits(v); return d?Number(d).toLocaleString("es-CO"):""; }; // 30000 -> "30.000"
const fmtDate = d => new Date(d).toLocaleDateString("es-CO",{day:"2-digit",month:"short"});
const today = () => { const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; }; // fecha LOCAL (antes UTC: fechaba de noche al día siguiente en COT)

// ── AREA CHART COMPONENT ──────────────────────────────────────────
const PERIODS = [
  {id:"day",   label:"Día"},
  {id:"week",  label:"Semana"},
  {id:"15d",   label:"15 días"},
  {id:"month", label:"Mes"},
  {id:"year",  label:"Año"},
  {id:"custom",label:"Rango"},
];

function CustomSelect({value, onChange, options, placeholder="Seleccionar...", P}){
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(()=>{
    const handler = e => { if(ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return ()=>document.removeEventListener("mousedown", handler);
  },[]);
  const selected = options.find(o=>(o.value||o)===value);
  const label = selected ? (selected.label||selected) : placeholder;
  return (
    <div ref={ref} style={{position:"relative",userSelect:"none"}}>
      <div onClick={()=>setOpen(o=>!o)} style={{width:"100%",padding:"14px 16px",background:"rgba(255,255,255,0.04)",border:`1.5px solid ${open?"#818cf8":"rgba(255,255,255,0.1)"}`,borderRadius:14,color:value?"#e2e2f0":"#8888aa",fontSize:15,cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center",boxSizing:"border-box",transition:"border-color 0.2s"}}>
        <span>{label}</span>
        <span style={{fontSize:10,color:"#8888aa",transform:open?"rotate(180deg)":"rotate(0deg)",transition:"transform 0.2s"}}>▼</span>
      </div>
      {open&&(
        <div style={{position:"absolute",top:"calc(100% + 6px)",left:0,right:0,background:"#1e1e2e",border:"1.5px solid rgba(129,140,248,0.3)",borderRadius:14,zIndex:999,overflow:"hidden",boxShadow:"0 8px 32px rgba(0,0,0,0.5)"}}>
          {placeholder&&<div onClick={()=>{onChange({target:{value:""}});setOpen(false);}} style={{padding:"12px 16px",color:"#8888aa",fontSize:14,cursor:"pointer",borderBottom:"1px solid rgba(255,255,255,0.05)"}}>{placeholder}</div>}
          <div style={{maxHeight:220,overflowY:"auto"}}>
            {options.map(o=>{
              const v=o.value||o; const l=o.label||o;
              return(
                <div key={v} onClick={()=>{onChange({target:{value:v}});setOpen(false);}}
                  style={{padding:"12px 16px",fontSize:14,color:v===value?"#818cf8":"#e2e2f0",background:v===value?"rgba(129,140,248,0.1)":"transparent",cursor:"pointer",fontWeight:v===value?600:400,transition:"background 0.15s"}}>
                  {l}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Fondos disponibles de una cuenta ────────────────────────────
// Débito/ahorros/efectivo: "used" es el saldo actual disponible.
// Crédito: lo disponible es cupo total menos lo ya usado.
function availableFunds(card){
  if(!card) return 0;
  return card.type==="credito" ? Math.max(0,(card.limit||0)-(card.used||0)) : (card.used||0);
}

// ── Selector de pago dividido entre varias cuentas ──────────────
// `value` es un array [{accountId, amount}]. `mode`: "out" valida fondos
// disponibles (gasto/pago sale de la cuenta); "in" no valida (ingreso/abono
// entra a la cuenta). Muestra cuánto falta o sobra por asignar.
function PaymentSplitter({total, cards, value, onChange, P, mode="out"}){
  const assigned  = value.reduce((s,r)=>s+(parseFloat(r.amount)||0),0);
  const remaining = Math.round(total - assigned);
  const addRow = () => onChange([...value, {accountId:"", amount: remaining>0?remaining:0}]);
  const updateRow = (i,patch) => onChange(value.map((r,idx)=>idx===i?{...r,...patch}:r));
  const removeRow = (i) => onChange(value.filter((_,idx)=>idx!==i));

  return (
    <div>
      {value.map((row,i)=>{
        const card = cards.find(c=>c.id===row.accountId);
        const avail = availableFunds(card);
        const over  = mode==="out" && card && (parseFloat(row.amount)||0) > avail;
        return (
          <div key={i} style={{marginBottom:10}}>
            <div style={{display:"flex",gap:8}}>
              <div style={{flex:1.3}}>
                <CustomSelect
                  value={row.accountId}
                  onChange={e=>updateRow(i,{accountId:e.target.value})}
                  options={cards.map(c=>({value:c.id,label: c.type==="credito" ? `${c.name} · cupo $${fmtMiles(Math.max(0,(c.limit||0)-(c.used||0)))}` : `${c.name} · $${fmtMiles(c.used||0)}`}))}
                  placeholder="Cuenta..."
                  P={P}
                />
              </div>
              <input type="text" inputMode="numeric" placeholder="0"
                value={fmtMiles(row.amount)}
                onChange={e=>updateRow(i,{amount:parseFloat(onlyDigits(e.target.value))||0})}
                style={{flex:1,padding:"14px 12px",background:"rgba(255,255,255,0.04)",border:`1.5px solid ${over?P.expense:"rgba(255,255,255,0.1)"}`,borderRadius:14,color:P.text,fontSize:14,outline:"none",boxSizing:"border-box"}}/>
              <button type="button" onClick={()=>removeRow(i)} style={{background:"rgba(248,113,113,0.1)",border:"none",color:P.expense,borderRadius:12,padding:"0 14px",cursor:"pointer",fontSize:14}}>✕</button>
            </div>
            {over && <div style={{fontSize:11,color:P.expense,marginTop:4}}>Supera lo disponible en esa cuenta ({fmtCOP(avail)}). Elige otra cuenta o reduce el monto.</div>}
          </div>
        );
      })}
      <button type="button" onClick={addRow} style={{width:"100%",padding:"10px",borderRadius:12,border:`1.5px dashed ${P.cardBorder}`,background:"transparent",color:P.accent,fontSize:13,fontWeight:600,cursor:"pointer",marginBottom:6}}>
        + Agregar cuenta
      </button>
      <div style={{fontSize:12,fontWeight:600,textAlign:"right",color: remaining===0?P.income:remaining>0?P.loan:P.expense}}>
        {remaining===0 ? "✓ Monto completo asignado" : remaining>0 ? `Falta asignar ${fmtCOP(remaining)}` : `Sobran ${fmtCOP(-remaining)} asignados de más`}
      </div>
    </div>
  );
}

// Valida que el split esté completo y ninguna cuenta se pase de lo disponible
// (solo aplica el chequeo de fondos cuando mode="out"). Devuelve {ok, reason}.
function validateSplit(splits, total, cards, mode="out"){
  if(!splits.length) return {ok:false, reason:"Agrega al menos una cuenta"};
  const assigned = splits.reduce((s,r)=>s+(parseFloat(r.amount)||0),0);
  if(Math.round(assigned)!==Math.round(total)) return {ok:false, reason:"El monto asignado no coincide con el total"};
  if(splits.some(r=>!r.accountId)) return {ok:false, reason:"Selecciona una cuenta en cada fila"};
  if(mode==="out"){
    for(const r of splits){
      const card = cards.find(c=>c.id===r.accountId);
      if((parseFloat(r.amount)||0) > availableFunds(card)) return {ok:false, reason:`Fondos insuficientes en ${card?card.name:"una cuenta"}`};
    }
  }
  return {ok:true};
}

function AreaChartCard({transactions, P, fmtCOP}){
  const [period, setPeriod] = useState("month");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo,   setCustomTo]   = useState("");

  const chartData = useMemo(()=>{
    if(!transactions.length) return [];

    const now   = new Date();
    const toD   = (s)=>new Date(s+"T00:00:00");
    const ymd   = (d)=>d.toISOString().split("T")[0];

    // Determine window
    let fromDate, toDate = new Date(now);
    if(period==="day"){
      fromDate = new Date(now); fromDate.setHours(0,0,0,0); toDate = new Date(now);
    } else if(period==="week"){
      fromDate = new Date(now); fromDate.setDate(now.getDate()-6); fromDate.setHours(0,0,0,0);
    } else if(period==="15d"){
      fromDate = new Date(now); fromDate.setDate(now.getDate()-14); fromDate.setHours(0,0,0,0);
    } else if(period==="month"){
      fromDate = new Date(now.getFullYear(), now.getMonth(), 1);
    } else if(period==="year"){
      fromDate = new Date(now.getFullYear(), 0, 1);
    } else if(period==="custom"){
      if(!customFrom||!customTo) return [];
      fromDate = toD(customFrom); toDate = toD(customTo);
    }

    // Group key based on period
    const key = (dateStr)=>{
      const d = toD(dateStr);
      if(d < fromDate || d > toDate) return null;
      if(period==="year") return dateStr.slice(0,7);         // YYYY-MM
      if(period==="month"||period==="15d"||period==="custom") return dateStr.slice(0,10); // YYYY-MM-DD
      return dateStr.slice(0,10);
    };

    const map={};
    transactions.forEach(t=>{
      const k=key(t.date);
      if(!k) return;
      if(!map[k]) map[k]={label:k,income:0,expense:0};
      map[k][t.type]+=t.amount;
    });

    // Fill gaps for day/week/15d/month/year so chart is continuous
    const filled=[];
    if(period!=="custom"||( customFrom&&customTo )){
      const cur = new Date(period==="year"? new Date(fromDate.getFullYear(),fromDate.getMonth(),1) : fromDate);
      const end = new Date(toDate);
      while(cur<=end){
        const k = period==="year"? ymd(cur).slice(0,7) : ymd(cur);
        if(!filled.find(f=>f.label===k)){
          filled.push(map[k]||{label:k,income:0,expense:0});
        }
        if(period==="year"){ cur.setMonth(cur.getMonth()+1); }
        else { cur.setDate(cur.getDate()+1); }
      }
    } else {
      filled.push(...Object.values(map).sort((a,b)=>a.label.localeCompare(b.label)));
    }

    // Shorten label for display
    return filled.map(d=>({
      ...d,
      displayLabel: period==="year"
        ? new Date(d.label+"-01").toLocaleDateString("es-CO",{month:"short"})
        : new Date(d.label+"T00:00:00").toLocaleDateString("es-CO",{day:"2-digit",month:"short"}),
    }));
  },[transactions,period,customFrom,customTo]);

  const hasData = chartData.some(d=>d.income>0||d.expense>0);

  return (
    <div style={{background:"#17171f",border:"1px solid #2a2a3a",borderRadius:16,padding:"16px",marginBottom:14}}>
      {/* Title + legend */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
        <span style={{fontSize:13,fontWeight:600,color:P.textSub,letterSpacing:0.5,textTransform:"uppercase"}}>Ingresos vs Gastos</span>
        <div style={{display:"flex",gap:10,fontSize:11}}>
          <span style={{color:P.income}}>▲ Ingr.</span>
          <span style={{color:P.expense}}>▼ Gast.</span>
        </div>
      </div>

      {/* Period pills */}
      <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:12}}>
        {PERIODS.map(p=>(
          <button key={p.id} onClick={()=>setPeriod(p.id)}
            style={{padding:"5px 11px",borderRadius:20,border:`1.5px solid ${period===p.id?P.accent:"#2a2a3a"}`,background:period===p.id?"rgba(129,140,248,0.13)":"transparent",color:period===p.id?P.accent:"#8888aa",fontSize:12,fontWeight:600,cursor:"pointer"}}>
            {p.label}
          </button>
        ))}
      </div>

      {/* Custom date range inputs */}
      {period==="custom" && (
        <div style={{display:"flex",gap:8,marginBottom:12}}>
          <input type="date" value={customFrom} onChange={e=>setCustomFrom(e.target.value)}
            style={{flex:1,padding:"8px 10px",background:"#17171f",border:"1.5px solid #2a2a3a",borderRadius:10,color:P.text,fontSize:13,outline:"none"}}/>
          <span style={{color:P.textSub,alignSelf:"center"}}>→</span>
          <input type="date" value={customTo} onChange={e=>setCustomTo(e.target.value)}
            style={{flex:1,padding:"8px 10px",background:"#17171f",border:"1.5px solid #2a2a3a",borderRadius:10,color:P.text,fontSize:13,outline:"none"}}/>
        </div>
      )}

      {/* Chart or empty state */}
      {!hasData ? (
        <div style={{textAlign:"center",padding:"28px 0",color:"#4a4a6a",fontSize:13}}>Sin datos en este período</div>
      ):(
        <ResponsiveContainer width="100%" height={160}>
          <AreaChart data={chartData} margin={{top:4,right:4,left:0,bottom:0}}>
            <defs>
              <linearGradient id="gI" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#34d399" stopOpacity={0.28}/>
                <stop offset="95%" stopColor="#34d399" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="gE" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#f87171" stopOpacity={0.28}/>
                <stop offset="95%" stopColor="#f87171" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <XAxis dataKey="displayLabel" tick={{fill:"#8888aa",fontSize:9}} axisLine={false} tickLine={false} interval="preserveStartEnd"/>
            <YAxis tick={{fill:"#8888aa",fontSize:9}} axisLine={false} tickLine={false} tickFormatter={v=>v>=1000000?`${(v/1000000).toFixed(1)}M`:v>=1000?`${(v/1000).toFixed(0)}K`:v} width={38}/>
            <Tooltip formatter={v=>fmtCOP(v)} contentStyle={{background:"#17171f",border:"1px solid #2a2a3a",borderRadius:8,color:"#e2e2f0",fontSize:12}} labelStyle={{color:"#8888aa"}}/>
            <Area type="monotone" dataKey="income"  stroke="#34d399" strokeWidth={2} fill="url(#gI)" name="Ingresos" dot={chartData.length<=15?{fill:"#34d399",r:3}:false}/>
            <Area type="monotone" dataKey="expense" stroke="#f87171" strokeWidth={2} fill="url(#gE)" name="Gastos"   dot={chartData.length<=15?{fill:"#f87171",r:3}:false}/>
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
// ─────────────────────────────────────────────────────────────────

// ── PUENTE NATIVO (Capacitor) ─────────────────────────────────────
// Se resuelve en runtime: dentro del APK usa los plugins nativos, en
// navegador cae a las APIs web. Así el MISMO archivo sirve para el
// preview y para el build de Android, sin imports que no resuelvan.
//
// (Ver SETUP-ANDROID.md si prefieres resolver los plugins con imports
// estáticos en vez de por runtime.)
const CAP      = typeof window !== "undefined" ? window.Capacitor : undefined;
const isNative = !!(CAP && typeof CAP.isNativePlatform === "function" && CAP.isNativePlatform());
const nativePlugin = name => (CAP && CAP.Plugins ? CAP.Plugins[name] : undefined);

// Guarda un archivo y lo entrega al usuario.
// Android: escribe en caché y abre la hoja de compartir (Drive, WhatsApp, correo).
// Web: descarga normal. `a.download` NO funciona dentro de un WebView.
async function saveFile(filename, content, mime){
  if(isNative){
    const FS = nativePlugin("Filesystem"), SH = nativePlugin("Share");
    if(FS && SH){
      try{
        const written = await FS.writeFile({path:filename, data:content, directory:"CACHE", encoding:"utf8"});
        await SH.share({title:filename, url:written.uri, dialogTitle:"Guardar o enviar respaldo"});
        return true;
      }catch(e){ return false; }
    }
  }
  try{
    const blob = new Blob([content],{type:mime});
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
    return true;
  }catch(e){ return false; }
}

// ── PERSISTENCIA ──────────────────────────────────────────────────
// Guarda todo bajo UNA sola clave, con el mismo esquema que ya usa
// Exportar/Importar. Si el navegador bloquea el almacenamiento (modo
// privado, iframe con sandbox), degrada a memoria sin romper nada.
const STORAGE_KEY = "finanzas.v1";

const storageOK = (() => {
  try {
    const k = "__probe__";
    window.localStorage.setItem(k, k);
    window.localStorage.removeItem(k);
    return true;
  } catch (e) { return false; }
})();

function loadState(){
  if(!storageOK) return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}

function saveState(state){
  const json = JSON.stringify(state);
  // localStorage: copia rápida y síncrona, permite arranque instantáneo
  if(storageOK){ try { window.localStorage.setItem(STORAGE_KEY, json); } catch (e) {} }
  // Preferences: fuente de verdad en Android. Vive en SharedPreferences
  // nativo, así que sobrevive a la limpieza de caché del WebView.
  const PREFS = nativePlugin("Preferences");
  if(PREFS){ PREFS.set({key:STORAGE_KEY, value:json}).catch(()=>{}); }
}

const SAVED = loadState();
// Si hay algo guardado usa eso; si no, cae al valor por defecto del archivo.
const pick = (key, fallback) => (SAVED && SAVED[key] !== undefined ? SAVED[key] : fallback);

export default function App() {
  // Core data
  const [transactions, setTransactions]   = useState(()=>pick("transactions", []));
  const [expCats, setExpCats]             = useState(()=>pick("expCats", DEFAULT_EXPENSE_CATS));
  const [incCats, setIncCats]             = useState(()=>pick("incCats", DEFAULT_INCOME_CATS));
  const [budgets, setBudgets]             = useState(()=>pick("budgets", {}));   // {catName: amount}
  const [goals, setGoals]                 = useState(()=>pick("goals", []));   // [{id,name,target,saved}]
  const [loans, setLoans]                 = useState(()=>pick("loans", []));
  const [debts, setDebts]                 = useState(()=>pick("debts", []));  // dinero que ME prestan a mí
  const [cards, setCards]                 = useState(()=>pick("cards", []));   // [{id,bank,name,type,limit,used,color}]
  const [recurringTx, setRecurringTx]     = useState(()=>pick("recurringTx", []));  // [{id,type,amount,category,note,dayOfMonth,lastMonth}]
  const [creditPlans, setCreditPlans]     = useState(()=>pick("creditPlans", []));  // [{id,cardId,category,note,total,cuotas,cuotasPaid,cuotaAmount,date}]
  const [nextId, setNextId]               = useState(()=>pick("nextId", 1));

  // UI state
  const [view, setView]       = useState("dashboard");
  const [subView, setSubView] = useState(null); // for nested panels
  const [delConfirm, setDelConfirm] = useState(null);
  const [expandedLoan, setExpandedLoan] = useState(null);
  const [expandedDebt, setExpandedDebt] = useState(null);
  const [statsFilter, setStatsFilter] = useState("total");
  const [statsFrom, setStatsFrom] = useState("");
  const [statsTo, setStatsTo]     = useState("");

  // Forms
  const [txForm, setTxForm]     = useState({type:"expense",amount:"",category:"",note:"",date:today(),method:"",accountId:"",cuotas:"1",useSplit:false,splits:[]});
  const [filterType, setFilter] = useState("all");
  const [newCat, setNewCat]     = useState({type:"expense",name:""});
  const [goalForm, setGoalForm] = useState({name:"",target:"",saved:""});
  const [editGoal, setEditGoal] = useState(null);
  const [loanForm, setLoanForm] = useState({debtor:"",amount:"",interest:"",interestType:"simple",months:"",date:today(),note:"",account:"",useSplit:false,splits:[]});
  const [editLoan, setEditLoan] = useState(null);
  const [debtForm, setDebtForm] = useState({lender:"",amount:"",interest:"",interestType:"simple",months:"",date:today(),note:"",account:"",useSplit:false,splits:[]});
  const [editDebt, setEditDebt] = useState(null);
  const [cardForm, setCardForm] = useState({bank:"",name:"",type:"credito",limit:"",used:"",color:"#818cf8",logo:""});
  const [editCard, setEditCard] = useState(null);
  const [showCardForm, setShowCardForm] = useState(false); // abre el editor de cuenta/tarjeta
  const [aiLoading, setAiLoading] = useState(false);
  const [aiTip, setAiTip]         = useState(null);
  const [aiSuggestion, setAiSuggestion] = useState(null);
  const [uiError, setUiError] = useState(null); // mensaje de error breve (toast propio, no alert() nativo)
  const notify = (msg)=>{ setUiError(msg); };
  useEffect(()=>{ if(!uiError) return; const t=setTimeout(()=>setUiError(null), 5000); return ()=>clearTimeout(t); },[uiError]);
  const [recurForm, setRecurForm] = useState({type:"expense",amount:"",category:"",note:"",dayOfMonth:"1",account:""});
  const [creditTab, setCreditTab] = useState("cards"); // cards | score | tips | recurring
  const [receiveAcct, setReceiveAcct] = useState({}); // {loanId: accountId} cuenta donde entra el abono
  const [receiveSplitOn, setReceiveSplitOn] = useState({}); // {loanId: bool} recibir dividido en varias cuentas
  const [receiveSplits, setReceiveSplits]   = useState({}); // {loanId: [{accountId,amount}]}
  const [payAcct, setPayAcct]         = useState({}); // {planId: accountId} cuenta de donde sale el pago de cuota
  const [paySplitOn, setPaySplitOn]   = useState({}); // {planId: bool} modo de pago dividido
  const [paySplits, setPaySplits]     = useState({}); // {planId: [{accountId,amount}]}
  const [receiveAmt, setReceiveAmt]   = useState({}); // {loanId: monto} cuánto pagó el deudor (libre)
  const [debtPaySplitOn, setDebtPaySplitOn] = useState({}); // {debtId: bool} pago dividido al pagarle a quien te prestó
  const [debtPaySplits, setDebtPaySplits]   = useState({}); // {debtId: [{accountId,amount}]}
  const [debtPayAcct, setDebtPayAcct]       = useState({}); // {debtId: accountId} cuenta única de pago
  const [debtPayAmt, setDebtPayAmt]         = useState({}); // {debtId: monto} cuánto le pagas ahora (libre)

  // ── Hidratación desde el storage nativo ─────────────────────────
  // Preferences es asíncrono, así que arrancamos con lo que haya en
  // localStorage y reemplazamos en cuanto responda el plugin nativo.
  const [hydrated, setHydrated] = useState(!isNative);
  useEffect(()=>{
    if(!isNative) return;
    let cancelled = false;
    (async()=>{
      try{
        const PREFS = nativePlugin("Preferences");
        const res   = PREFS ? await PREFS.get({key:STORAGE_KEY}) : null;
        if(!cancelled && res && res.value){
          const d = JSON.parse(res.value);
          if(d.transactions) setTransactions(d.transactions);
          if(d.expCats)      setExpCats(d.expCats);
          if(d.incCats)      setIncCats(d.incCats);
          if(d.budgets)      setBudgets(d.budgets);
          if(d.goals)        setGoals(d.goals);
          if(d.loans)        setLoans(d.loans);
          if(d.debts)        setDebts(d.debts);
          if(d.cards)        setCards(d.cards);
          if(d.recurringTx)  setRecurringTx(d.recurringTx);
          if(d.creditPlans)  setCreditPlans(d.creditPlans);
          if(d.nextId)       setNextId(d.nextId);
        }
      }catch(e){ /* si falla, seguimos con lo que ya hay en memoria */ }
      if(!cancelled) setHydrated(true);
    })();
    return ()=>{ cancelled = true; };
  },[]);

  // Persistir en cada cambio de datos. Nunca antes de hidratar, o
  // sobrescribiríamos lo guardado en nativo con el estado inicial.
  useEffect(()=>{
    if(!hydrated) return;
    saveState({ version:1, transactions, expCats, incCats, budgets, goals, loans, debts, cards, recurringTx, creditPlans, nextId });
  },[hydrated,transactions,expCats,incCats,budgets,goals,loans,debts,cards,recurringTx,creditPlans,nextId]);
  // ── Barra de estado (Android) ───────────────────────────────────
  useEffect(()=>{
    if(!isNative) return;
    const SB = nativePlugin("StatusBar");
    if(!SB) return;
    SB.setStyle({ style: "DARK" });
    SB.setBackgroundColor({ color: "#060609" });
    SB.setOverlaysWebView({ overlay: false });
  },[]);
  // ── Botón atrás de Android ──────────────────────────────────────
  // Sin esto, el gesto de atrás cierra la app desde cualquier pantalla.
  useEffect(()=>{
    if(!isNative) return;
    const CAPP = nativePlugin("App");
    if(!CAPP || !CAPP.addListener) return;
    let handle;
    const onBack = ()=>{
      if(aiSuggestion){ setAiSuggestion(null); return; }   // cierra el modal
      if(delConfirm){   setDelConfirm(null);   return; }   // cancela el borrado
      if(subView){      setSubView(null);      return; }   // sube un nivel
      if(view!=="dashboard"){ setView("dashboard"); return; }
      CAPP.exitApp();                                       // ya en inicio: salir
    };
    Promise.resolve(CAPP.addListener("backButton", onBack)).then(h=>{ handle = h; });
    return ()=>{ if(handle && handle.remove) handle.remove(); };
  },[view,subView,aiSuggestion,delConfirm]);

  // Derived
  const totalIncome  = useMemo(()=>transactions.filter(t=>t.type==="income").reduce((s,t)=>s+t.amount,0),[transactions]);
  const totalExpense = useMemo(()=>transactions.filter(t=>t.type==="expense").reduce((s,t)=>s+t.amount,0),[transactions]);
  const balance = totalIncome - totalExpense;

  // ── Mes en curso vs mes anterior ────────────────────────────────
  const monthKeys = useMemo(()=>{
    const n = new Date();
    const mk = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
    const p  = new Date(n.getFullYear(), n.getMonth()-1, 1);
    return {
      cur: mk(n), prev: mk(p),
      label:     n.toLocaleDateString("es-CO",{month:"long"}),
      prevLabel: p.toLocaleDateString("es-CO",{month:"long"}),
    };
  },[]);

  const sumMonth = (mk,type) => transactions
    .filter(t=>t.date.slice(0,7)===mk && t.type===type)
    .reduce((s,t)=>s+t.amount,0);

  const monthIncome  = useMemo(()=>sumMonth(monthKeys.cur,"income"), [transactions,monthKeys]);
  const monthExpense = useMemo(()=>sumMonth(monthKeys.cur,"expense"),[transactions,monthKeys]);
  const monthBalance = monthIncome - monthExpense;
  const prevBalance  = useMemo(()=>sumMonth(monthKeys.prev,"income")-sumMonth(monthKeys.prev,"expense"),[transactions,monthKeys]);
  const monthDelta   = prevBalance!==0 ? Math.round(((monthBalance-prevBalance)/Math.abs(prevBalance))*100) : null;
  const monthSaveRate = monthIncome>0 ? Math.round((monthBalance/monthIncome)*100) : 0;

  // Gasto por categoría SOLO del mes en curso (para presupuestos)
  const monthCatSpend = useMemo(()=>{
    const m={};
    transactions
      .filter(t=>t.type==="expense" && t.date.slice(0,7)===monthKeys.cur)
      .forEach(t=>{ m[t.category]=(m[t.category]||0)+t.amount; });
    return m;
  },[transactions,monthKeys]);

  const budgetRows = useMemo(()=>Object.entries(budgets)
    .filter(([,limit])=>limit>0)
    .map(([cat,limit])=>{
      const spent = monthCatSpend[cat]||0;
      return {cat, limit, spent, pct: Math.round((spent/limit)*100)};
    })
    .sort((a,b)=>b.pct-a.pct)
  ,[budgets,monthCatSpend]);

  const budgetColor = pct => pct>=100 ? P.expense : pct>=80 ? P.loan : P.income;

  const catSpend = useMemo(()=>{
    const m={};
    transactions.filter(t=>t.type==="expense").forEach(t=>{ m[t.category]=(m[t.category]||0)+t.amount; });
    return m;
  },[transactions]);

  const categoryData = useMemo(()=>
    Object.entries(catSpend).map(([name,value])=>({name,value})).sort((a,b)=>b.value-a.value)
  ,[catSpend]);

  const monthlyData = useMemo(()=>{
    const m={};
    transactions.forEach(t=>{ const mo=t.date.slice(0,7); if(!m[mo])m[mo]={month:mo,income:0,expense:0}; m[mo][t.type]+=t.amount; });
    return Object.values(m).sort((a,b)=>a.month.localeCompare(b.month));
  },[transactions]);

  const filtered = useMemo(()=>[...transactions]
    .filter(t=>filterType==="all"||t.type===filterType)
    .sort((a,b)=>b.date.localeCompare(a.date))
  ,[transactions,filterType]);

  // Stats period filter
  const filteredForStats = useMemo(()=>{
    const now = new Date();
    const toD = s => new Date(s+"T00:00:00");
    let from, to = now;
    if(statsFilter==="total") return transactions;
    if(statsFilter==="week"){ from=new Date(now); from.setDate(now.getDate()-6); from.setHours(0,0,0,0); }
    else if(statsFilter==="15d"){ from=new Date(now); from.setDate(now.getDate()-14); from.setHours(0,0,0,0); }
    else if(statsFilter==="month"){ from=new Date(now.getFullYear(),now.getMonth(),1); }
    else if(statsFilter==="custom"){
      if(!statsFrom||!statsTo) return transactions;
      from=toD(statsFrom); to=toD(statsTo);
    }
    return transactions.filter(t=>{ const d=toD(t.date); return d>=from && d<=to; });
  },[transactions,statsFilter,statsFrom,statsTo]);

  const statsIncome  = filteredForStats.filter(t=>t.type==="income").reduce((s,t)=>s+t.amount,0);
  const statsExpense = filteredForStats.filter(t=>t.type==="expense").reduce((s,t)=>s+t.amount,0);
  const statsBalance = statsIncome - statsExpense;

  const statsCatData = useMemo(()=>{
    const m={};
    filteredForStats.filter(t=>t.type==="expense").forEach(t=>{ m[t.category]=(m[t.category]||0)+t.amount; });
    return Object.entries(m).map(([name,value])=>({name,value})).sort((a,b)=>b.value-a.value);
  },[filteredForStats]);

  const statsMonthlyData = useMemo(()=>{
    const m={};
    filteredForStats.forEach(t=>{ const mo=t.date.slice(0,7); if(!m[mo])m[mo]={month:mo,income:0,expense:0}; m[mo][t.type]+=t.amount; });
    return Object.values(m).sort((a,b)=>a.month.localeCompare(b.month));
  },[filteredForStats]);

  // Loan calculations
  function calcLoan(loan) {
    const p = loan.amount, r = loan.interest/100, m = loan.months||1;
    let total, interest;
    if(loan.interestType==="compound"){
      total = p * Math.pow(1+r, m);
    } else {
      total = p * (1 + r * m);
    }
    interest = total - p;
    const monthly = total/m;
    // Per-period schedule
    const schedule = Array.from({length:m},(_,i)=>{
      const cuota = i+1;
      let interestThisPeriod, balanceAfter;
      if(loan.interestType==="compound"){
        const balBefore = p * Math.pow(1+r, i);
        interestThisPeriod = balBefore * r;
        balanceAfter = p * Math.pow(1+r, cuota) - monthly*(cuota);
      } else {
        interestThisPeriod = p * r;
        balanceAfter = total - monthly*cuota; // antes: p+p*r*(m-cuota) -> el saldo terminaba en el capital, nunca en 0
      }
      return {
        cuota,
        interes: Math.round(interestThisPeriod),
        cuotaTotal: Math.round(monthly),
        saldoPendiente: Math.max(0, Math.round(balanceAfter)),
      };
    });
    return { total: Math.round(total), interest: Math.round(interest), monthly: Math.round(monthly), schedule };
  }

  // Handlers
  const resetTxForm = ()=>setTxForm({type:"expense",amount:"",category:"",note:"",date:today(),method:"",accountId:"",cuotas:"1",useSplit:false,splits:[]});

  function addTransaction(e){
    e.preventDefault();
    if(!txForm.amount||!txForm.category)return;
    const amount = parseFloat(txForm.amount);
    let id = nextId;

    // ── Pago/ingreso dividido entre varias cuentas ──────────────
    if(txForm.useSplit){
      const splitCards = txForm.type==="expense" ? cards : cards.filter(c=>c.type!=="credito");
      const check = validateSplit(txForm.splits, amount, splitCards, txForm.type==="expense"?"out":"in");
      if(!check.ok){ notify(check.reason); return; }
      let cashPortion = 0;
      const newPlans = [];
      txForm.splits.forEach(r=>{
        const card = cards.find(c=>c.id===r.accountId);
        const amt  = parseFloat(r.amount)||0;
        if(!card||amt<=0) return;
        if(txForm.type==="expense" && card.type==="credito"){
          // Porción pagada con tarjeta de crédito: sube la deuda como compra a 1 cuota.
          newPlans.push({ id:id++, cardId:card.id, category:txForm.category, note:txForm.note, total:amt, cuotas:1, cuotasPaid:0, cuotaAmount:amt, date:txForm.date });
          adjustAccount(card.id, amt);
        } else {
          adjustAccount(card.id, txForm.type==="income"?amt:-amt);
          cashPortion += amt;
        }
      });
      if(newPlans.length) setCreditPlans(prev=>[...prev, ...newPlans]);
      if(cashPortion>0){
        setTransactions(prev=>[...prev,{ type:txForm.type, amount:cashPortion, category:txForm.category, note:txForm.note, date:txForm.date, method:txForm.method, accountId:null, splits:txForm.splits, id:id++ }]);
      }
      setNextId(id);
      resetTxForm();
      setView(txForm.type==="expense" && newPlans.length && !cashPortion ? "credit" : "transactions");
      return;
    }

    // ── Una sola cuenta (flujo simple) ───────────────────────────
    const accId  = (txForm.accountId===""||txForm.accountId==null) ? null : txForm.accountId;
    const selCard = accId!=null ? cards.find(c=>c.id===accId) : null;
    // Bloquea si no alcanza el saldo (débito/efectivo/ahorros). Para tarjetas de crédito no aplica: ahí lo que se valida es el cupo.
    if(selCard && txForm.type==="expense" && selCard.type!=="credito" && amount>availableFunds(selCard)){
      notify(`${selCard.name} no tiene fondos suficientes (disponible: ${fmtCOP(availableFunds(selCard))}). Elige otra cuenta o divide el pago entre varias.`);
      return;
    }
    // Compra a crédito: sube la deuda de la tarjeta (baja el cupo). NO toca el efectivo hasta pagar cada cuota.
    if(selCard && selCard.type==="credito" && txForm.type==="expense"){
      const cuotas = Math.max(1, parseInt(txForm.cuotas)||1);
      const plan = { id, cardId:accId, category:txForm.category, note:txForm.note, total:amount, cuotas, cuotasPaid:0, cuotaAmount:Math.round(amount/cuotas), date:txForm.date };
      setCreditPlans(prev=>[...prev, plan]);
      adjustAccount(accId, amount);   // aumenta la deuda usada de la tarjeta
      setNextId(id+1);
      resetTxForm();
      setCreditTab("cards"); setSubView(null); setView("credit");
      return;
    }
    setTransactions(prev=>[...prev,{...txForm, amount, accountId:accId, id}]);
    if(accId!=null) adjustAccount(accId, txForm.type==="income"?amount:-amount);  // ajusta el saldo de la cuenta elegida
    setNextId(id+1);
    resetTxForm();
    setView("transactions");
  }

  function addCategory(){
    if(!newCat.name.trim())return;
    if(newCat.type==="expense") setExpCats(p=>[...p,newCat.name.trim()]);
    else setIncCats(p=>[...p,newCat.name.trim()]);
    setNewCat(c=>({...c,name:""}));
  }

  function deleteCategory(type,name){
    if(type==="expense"){
      setExpCats(p=>p.filter(c=>c!==name));
      setBudgets(prev=>{ const next={...prev}; delete next[name]; return next; }); // no dejar presupuesto huérfano
    }
    else setIncCats(p=>p.filter(c=>c!==name));
  }

  function saveBudget(cat,val){
    setBudgets(p=>({...p,[cat]:parseFloat(val)||0}));
  }

  function addGoal(e){
    e.preventDefault();
    if(!goalForm.name||!goalForm.target)return;
    if(editGoal!==null){
      setGoals(prev=>prev.map(g=>g.id===editGoal?{...g,name:goalForm.name,target:parseFloat(goalForm.target),saved:parseFloat(goalForm.saved)||g.saved}:g));
      setEditGoal(null);
    } else {
      setGoals(prev=>[...prev,{id:nextId,name:goalForm.name,target:parseFloat(goalForm.target),saved:parseFloat(goalForm.saved)||0}]);
      setNextId(n=>n+1);
    }
    setGoalForm({name:"",target:"",saved:""});
  }

  function addToGoal(id, amount){
    setGoals(prev=>prev.map(g=>g.id===id?{...g,saved:Math.min(g.saved+amount,g.target)}:g));
  }

  function addLoan(e){
    e.preventDefault();
    if(!loanForm.debtor||!loanForm.amount)return;
    const amount = parseFloat(loanForm.amount);
    const data={...loanForm,amount,interest:parseFloat(loanForm.interest)||0,months:parseInt(loanForm.months)||1,paid:false,id:nextId};
    if(editLoan!==null){
      // Editar sólo metadatos; no re-ajusta saldos (el préstamo ya se descontó al crearlo).
      setLoans(prev=>prev.map(l=>l.id===editLoan?{...data,id:editLoan,paid:l.paid,paidCuotas:l.paidCuotas||0,received:l.received||0,account:l.account}:l));
      setEditLoan(null);
    } else if(loanForm.useSplit){
      const check = validateSplit(loanForm.splits, amount, accounts, "out");
      if(!check.ok){ notify(check.reason); return; }
      loanForm.splits.forEach(r=>adjustAccount(r.accountId, -(parseFloat(r.amount)||0)));  // sale de varias cuentas
      data.paidCuotas = 0; data.received = 0; data.account = null;
      setLoans(prev=>[...prev,data]);
      setNextId(n=>n+1);
    } else {
      if(data.account){
        const src = accounts.find(a=>a.id===data.account);
        if(src && amount>availableFunds(src)){ notify(`${src.name} no tiene fondos suficientes (disponible: ${fmtCOP(availableFunds(src))}). Elige otra cuenta o divide el préstamo entre varias.`); return; }
      }
      data.paidCuotas = 0; data.received = 0;
      setLoans(prev=>[...prev,data]);
      if(data.account) adjustAccount(data.account, -data.amount);   // el dinero prestado sale de la cuenta origen
      setNextId(n=>n+1);
    }
    setLoanForm({debtor:"",amount:"",interest:"",interestType:"simple",months:"",date:today(),note:"",account:"",useSplit:false,splits:[]});
  }

  function toggleLoanPaid(id){
    setLoans(prev=>prev.map(l=>l.id===id?{...l,paid:!l.paid}:l));
  }

  // Estado de cobro de un préstamo. Basado en MONTO recibido (pueden pagar cualquier cantidad).
  // El interés se reconoce proporcional al total (así la ganancia acumulada = interés del préstamo).
  function loanStatus(loan){
    const {total, interest, monthly, schedule} = calcLoan(loan);
    const received         = Math.min(total, loan.received || 0);
    const receivedInterest = total>0 ? Math.round(received * interest/total) : 0;
    const principalOut     = Math.max(0, Math.round(loan.amount - (received - receivedInterest)));
    const totalOut         = Math.max(0, total - received);
    const pct              = total>0 ? Math.round((received/total)*100) : 0;
    const suggested        = Math.min(monthly, totalOut);   // sugerencia = una cuota
    return { total, interest, monthly, schedule, received, receivedInterest, principalOut, totalOut, pct, suggested };
  }

  // Registrar un abono recibido de monto libre. Entra completo a la cuenta; SÓLO el interés (proporcional) es ingreso.
  // Recibir un abono del deudor. `destOrSplits`: cuenta única (id) o, si vienes del
  // selector dividido, un array [{accountId,amount}] — repartes el dinero que te
  // devuelven entre varias cuentas (nunca tarjetas de crédito, no tiene sentido recibir ahí).
  function receiveLoanPayment(loan, amountStr, destOrSplits){
    const st = loanStatus(loan);
    let amt = parseFloat(onlyDigits(amountStr));
    if(!amt || amt<=0) amt = st.suggested;        // vacío = una cuota
    amt = Math.min(amt, st.totalOut);             // no recibir más de lo que deben
    if(amt<=0) return;

    if(Array.isArray(destOrSplits)){
      const check = validateSplit(destOrSplits, amt, accounts, "in");
      if(!check.ok){ notify(check.reason); return; }
      destOrSplits.forEach(r=>adjustAccount(r.accountId, parseFloat(r.amount)||0));
    } else {
      const dest = (destOrSplits===undefined||destOrSplits===null||destOrSplits==="") ? loan.account : destOrSplits;
      if(dest==null||dest==="") return;             // sin cuenta destino
      adjustAccount(dest, amt);                     // el capital + interés vuelve a tu cuenta
    }
    const newReceived = (loan.received||0) + amt;
    const settles = newReceived >= st.total - 0.5;
    // Interés proporcional; en el pago que SALDA reconoce el interés restante EXACTO (evita el desvío de 1 peso).
    const interesPortion = settles ? Math.max(0, st.interest - st.receivedInterest) : (st.total>0 ? Math.round(amt * st.interest/st.total) : 0);
    if(interesPortion>0){
      // El interés es la ganancia. accountId:null porque el saldo ya se ajustó arriba (no duplicar).
      setTransactions(prev=>[...prev,{ id:nextId, type:"income", amount:interesPortion, category:"Intereses", note:`Interés préstamo — ${loan.debtor}`, date:today(), method:"", accountId:null }]);
      setNextId(n=>n+1);
    }
    setLoans(prev=>prev.map(l=>l.id===loan.id?{...l, received:newReceived, paid:settles}:l));
    setReceiveAmt(m=>({...m,[loan.id]:""}));
  }

  // Borrar un préstamo: devuelve el CAPITAL PENDIENTE a la cuenta origen (lo ya recibido se queda). Patrimonio neutro.
  function deleteLoan(loan){
    const out = loanStatus(loan).principalOut;
    if(loan.account && out>0) adjustAccount(loan.account, out);
    setLoans(prev=>prev.filter(x=>x.id!==loan.id));
  }

  // ═══════════════ DEUDAS (dinero que ME prestan a mí) ═══════════════
  // Espejo de Préstamos: al crearla, el dinero ENTRA a tu cuenta. Al pagarle
  // a quien te prestó, el capital sale de tus cuentas (con validación de
  // fondos / pago dividido) y el interés que pagas de más se registra como
  // GASTO en la categoría "Intereses pagados".
  function addDebt(e){
    e.preventDefault();
    if(!debtForm.lender||!debtForm.amount)return;
    const amount = parseFloat(debtForm.amount);
    const data={...debtForm,amount,interest:parseFloat(debtForm.interest)||0,months:parseInt(debtForm.months)||1,paid:false,id:nextId};
    if(editDebt!==null){
      // Editar sólo metadatos; no re-ajusta saldos (ya se acreditó al crearla).
      setDebts(prev=>prev.map(d=>d.id===editDebt?{...data,id:editDebt,paid:d.paid,paidAmt:d.paidAmt||0,account:d.account}:d));
      setEditDebt(null);
    } else if(debtForm.useSplit){
      const check = validateSplit(debtForm.splits, amount, accounts, "in");  // "in": sin validar fondos, solo que cuadre
      if(!check.ok){ notify(check.reason); return; }
      debtForm.splits.forEach(r=>adjustAccount(r.accountId, parseFloat(r.amount)||0));  // entra repartido en varias cuentas
      data.paidAmt = 0; data.account = null;
      setDebts(prev=>[...prev,data]);
      setNextId(n=>n+1);
    } else {
      data.paidAmt = 0;
      setDebts(prev=>[...prev,data]);
      if(data.account) adjustAccount(data.account, data.amount);   // el dinero prestado ENTRA a la cuenta destino
      setNextId(n=>n+1);
    }
    setDebtForm({lender:"",amount:"",interest:"",interestType:"simple",months:"",date:today(),note:"",account:"",useSplit:false,splits:[]});
  }

  // Estado de una deuda: cuánto debes en total (capital+interés), cuánto ya pagaste, cuánto falta.
  function debtStatus(debt){
    const {total, interest, monthly, schedule} = calcLoan(debt);
    const paidAmt   = Math.min(total, debt.paidAmt || 0);
    const paidInterest = total>0 ? Math.round(paidAmt * interest/total) : 0;
    const principalLeft = Math.max(0, Math.round(debt.amount - (paidAmt - paidInterest)));
    const totalOut  = Math.max(0, total - paidAmt);
    const pct       = total>0 ? Math.round((paidAmt/total)*100) : 0;
    const suggested = Math.min(monthly, totalOut);
    return { total, interest, monthly, schedule, paidAmt, paidInterest, principalLeft, totalOut, pct, suggested };
  }

  // Pagar (abonar) a quien te prestó. `srcOrSplits`: cuenta única (id) o array de splits.
  function payDebt(debt, amountStr, srcOrSplits){
    const st = debtStatus(debt);
    let amt = parseFloat(onlyDigits(amountStr));
    if(!amt || amt<=0) amt = st.suggested;
    amt = Math.min(amt, st.totalOut);
    if(amt<=0) return;

    if(Array.isArray(srcOrSplits)){
      const check = validateSplit(srcOrSplits, amt, accounts, "out");
      if(!check.ok){ notify(check.reason); return; }
      srcOrSplits.forEach(r=>adjustAccount(r.accountId, -(parseFloat(r.amount)||0)));
    } else {
      const src = (srcOrSplits===undefined||srcOrSplits===null||srcOrSplits==="") ? debt.account : srcOrSplits;
      if(src==null||src==="") return;
      const card = accounts.find(a=>a.id===src);
      if(!card || amt>availableFunds(card)){ notify(`${card?card.name:"Esa cuenta"} no tiene fondos suficientes para este pago. Elige otra cuenta o divide el pago.`); return; }
      adjustAccount(src, -amt);
    }

    const newPaid = (debt.paidAmt||0) + amt;
    const settles = newPaid >= st.total - 0.5;
    const interesPortion = settles ? Math.max(0, st.interest - st.paidInterest) : (st.total>0 ? Math.round(amt * st.interest/st.total) : 0);
    if(interesPortion>0){
      // El interés que pagas de más es un gasto real. accountId:null porque el saldo ya se ajustó arriba.
      setTransactions(prev=>[...prev,{ id:nextId, type:"expense", amount:interesPortion, category:"Otros gastos", note:`Interés deuda — ${debt.lender}`, date:today(), method:"", accountId:null }]);
      setNextId(n=>n+1);
    }
    setDebts(prev=>prev.map(d=>d.id===debt.id?{...d, paidAmt:newPaid, paid:settles}:d));
    setDebtPayAmt(m=>({...m,[debt.id]:""}));
  }

  // Borrar una deuda: si aún no la saldas del todo, se descuenta de la cuenta
  // destino el capital pendiente (revierte el ingreso que aún no es realmente tuyo).
  function deleteDebt(debt){
    const left = debtStatus(debt).principalLeft;
    if(debt.account && left>0) adjustAccount(debt.account, -left);
    setDebts(prev=>prev.filter(x=>x.id!==debt.id));
  }

  // Pagar una cuota de una compra a crédito. `srcOrSplits` es una cuenta única (id) o,
  // si vienes del selector dividido, un array [{accountId,amount}]. Bloquea si no alcanza.
  function payCreditCuota(plan, srcOrSplits){
    if(plan.cuotasPaid>=plan.cuotas) return;
    const last = plan.cuotasPaid+1===plan.cuotas;
    const pay  = last ? Math.max(0, plan.total - plan.cuotaAmount*(plan.cuotas-1)) : plan.cuotaAmount;  // la última salda el resto exacto

    if(Array.isArray(srcOrSplits)){
      const check = validateSplit(srcOrSplits, pay, accounts, "out");
      if(!check.ok){ notify(check.reason); return; }
      srcOrSplits.forEach(r=>adjustAccount(r.accountId, -(parseFloat(r.amount)||0)));
    } else {
      const src = (srcOrSplits===undefined||srcOrSplits===null||srcOrSplits==="") ? (accounts[0] && accounts[0].id) : srcOrSplits;
      if(src==null) return;                 // no hay cuenta de dónde pagar
      const card = accounts.find(a=>a.id===src);
      if(!card || pay>availableFunds(card)){ notify(`${card?card.name:"Esa cuenta"} no tiene fondos suficientes para esta cuota (${fmtCOP(pay)}). Elige otra cuenta o divide el pago.`); return; }
      adjustAccount(src, -pay);             // sale el efectivo de la cuenta elegida
    }
    adjustAccount(plan.cardId, -pay);     // baja la deuda usada / libera cupo de la tarjeta
    // Movimiento de gasto (cuenta el gasto en su categoría). accountId:null: el saldo ya se ajustó arriba.
    setTransactions(prev=>[...prev,{ id:nextId, type:"expense", amount:pay, category:plan.category, note:`${plan.note||plan.category} · cuota ${plan.cuotasPaid+1}/${plan.cuotas}`, date:today(), method:"Tarjeta crédito", accountId:null }]);
    setNextId(n=>n+1);
    setCreditPlans(prev=>prev.map(p=>p.id===plan.id?{...p,cuotasPaid:plan.cuotasPaid+1}:p));
  }

  // Cancelar una compra a crédito: libera el cupo de las cuotas NO pagadas (lo ya pagado queda como gasto real).
  function deleteCreditPlan(plan){
    const remaining = Math.max(0, plan.total - plan.cuotaAmount*plan.cuotasPaid);
    if(remaining>0) adjustAccount(plan.cardId, -remaining);
    setCreditPlans(prev=>prev.filter(p=>p.id!==plan.id));
  }

  // Sube una imagen de logo: la reescala a 96x96 (recorte central) y la guarda como data URL pequeño.
  function onLogoUpload(e){
    const file = e.target.files && e.target.files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const img = new Image();
      img.onload = ()=>{
        const S=96, cv=document.createElement("canvas"); cv.width=S; cv.height=S;
        const ctx=cv.getContext("2d");
        const sc=Math.max(S/img.width, S/img.height), w=img.width*sc, h=img.height*sc;
        ctx.drawImage(img,(S-w)/2,(S-h)/2,w,h);
        try{ setCardForm(f=>({...f, logo:cv.toDataURL("image/jpeg",0.82)})); }catch(err){}
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
    e.target.value="";
  }

  // Encabezado de acordeón para la vista de Cuentas. Una sección abierta a la vez.
  const accHead = (id, icon, label) => {
    const open = creditTab===id;
    return (
      <button onClick={()=>setCreditTab(t=>t===id?null:id)}
        style={{width:"100%",display:"flex",alignItems:"center",gap:11,background:open?"rgba(129,140,248,0.08)":P.card,border:`1px solid ${open?P.accent:P.cardBorder}`,borderRadius:14,padding:"14px 16px",marginBottom:10,cursor:"pointer"}}>
        <span style={{fontSize:18}}>{icon}</span>
        <span style={{flex:1,textAlign:"left",fontWeight:700,fontSize:15,color:open?P.accent:P.text}}>{label}</span>
        <span style={{color:open?P.accent:P.muted,fontSize:16,display:"inline-block",transform:open?"rotate(90deg)":"none",transition:"transform 0.2s"}}>›</span>
      </button>
    );
  };

  const s = ST(P);
  const navItems=[
    {id:"dashboard",icon:"◈",label:"Inicio"},
    {id:"add",icon:"+",label:"Agregar"},
    {id:"transactions",icon:"≡",label:"Movimientos"},
    {id:"stats",icon:"◉",label:"Stats"},
    {id:"credit",icon:"👛",label:"Cuentas"},
  ];

  const headerTitles={dashboard:"Mi Finanzas",add:"Nuevo movimiento",transactions:"Movimientos",stats:"Estadísticas",loans:"Préstamos",credit:"Cuentas",settings:"Configuración",goals:"Metas",budget:"Presupuesto",categories:"Categorías"};

  // Credit score calculation
  // Solo tarjetas de crédito: en débito/ahorros `used` es "saldo disponible", no deuda.
  const creditOnly = cards.filter(c=>c.type==="credito");
  const totalLimit = creditOnly.reduce((s,c)=>s+(c.limit||0),0);
  const totalUsed  = creditOnly.reduce((s,c)=>s+(c.used||0),0);

  // ── Cuentas con saldo (efectivo / débito / ahorros) ─────────────
  // En estas cuentas `used` guarda el SALDO ACTUAL (no una deuda).
  const accounts    = cards.filter(c=>c.type!=="credito");
  const liquidTotal = accounts.reduce((s,c)=>s+(c.used||0),0);
  const creditDebt  = totalUsed;                              // deuda total en tarjetas de crédito
  const porCobrar   = loans.filter(l=>!l.paid).reduce((s,l)=>s+loanStatus(l).principalOut,0);  // capital pendiente (no cuenta interés futuro)
  const porPagar    = debts.filter(d=>!d.paid).reduce((s,d)=>s+debtStatus(d).principalLeft,0); // lo que TÚ debes a quien te prestó
  const patrimonio  = liquidTotal + porCobrar - porPagar;   // efectivo disponible + lo que te deben − lo que debes. La deuda de tarjeta se descuenta al pagar cada cuota, no antes.
  // Mueve el saldo de una cuenta (delta + entra / − sale). No aplica a tarjetas de crédito.
  const adjustAccount = (id, delta) => { if(id===null||id===undefined||id==="") return; setCards(prev=>prev.map(c=>c.id===id?{...c,used:(c.used||0)+delta}:c)); };
  const utilPct    = totalLimit>0 ? Math.round((totalUsed/totalLimit)*100) : 0;
  const creditScore = utilPct<=10?"Excelente":utilPct<=30?"Bueno":utilPct<=50?"Regular":utilPct<=75?"Malo":"Crítico";
  const scoreColor  = utilPct<=10?"#34d399":utilPct<=30?"#4ade80":utilPct<=50?"#fbbf24":utilPct<=75?"#fb923c":"#f87171";

  // Auto-apply recurring transactions
  function applyRecurring(){
    const now = new Date();
    const thisMonth = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;
    const toApply = recurringTx.filter(r=>r.lastMonth!==thisMonth && now.getDate()>=parseInt(r.dayOfMonth));
    if(!toApply.length) return;
    let id = nextId;
    const newTx = toApply.map(r=>({ id:id++, type:r.type, amount:r.amount, category:r.category, note:r.note, date:today(), accountId:(r.account!=null&&r.account!=="")?r.account:null }));
    setTransactions(prev=>[...prev,...newTx]);
    toApply.forEach(r=>{ if(r.account!=null&&r.account!=="") adjustAccount(r.account, r.type==="income"?r.amount:-r.amount); }); // ajusta el saldo de cada cuenta
    setRecurringTx(prev=>prev.map(r=>toApply.find(a=>a.id===r.id)?{...r,lastMonth:thisMonth}:r));
    setNextId(id);
  }

  // Static credit tips based on rules (no API needed)
  function getAiCreditTip(){
    setAiLoading(true); setAiTip(null);
    setTimeout(()=>{
      const consejos = [];
      const alertas  = [];

      // Utilization rules
      if(utilPct > 75)      alertas.push("Tu utilización es crítica ("+utilPct+"%). Riesgo de bloqueo de cupo y afectación severa a tu historial.");
      else if(utilPct > 50) alertas.push("Utilización alta ("+utilPct+"%). Intenta reducirla por debajo del 30% para mejorar tu score.");
      else if(utilPct > 30) alertas.push("Estás por encima del 30% recomendado. Pequeños pagos adicionales pueden marcar la diferencia.");

      if(utilPct > 30)  consejos.push("Haz pagos adicionales al mínimo en tus tarjetas con mayor % de uso para bajar la utilización.");
      if(utilPct <= 10) consejos.push("Excelente uso del crédito. Mantén esta disciplina para construir un historial sólido.");
      if(utilPct > 0 && utilPct <= 30) consejos.push("Estás en zona óptima. Paga el total de tu tarjeta cada mes para evitar intereses.");

      // Per-card rules
      const highCards = cards.filter(c=>c.type==="credito"&&c.limit>0&&(c.used/c.limit)>0.5);
      if(highCards.length > 0) consejos.push(`Prioriza pagar: ${highCards.map(c=>c.name).join(", ")}. Están por encima del 50% de uso.`);

      const lowCards = cards.filter(c=>c.type==="credito"&&c.limit>0&&(c.used/c.limit)<0.1);
      if(lowCards.length > 0) consejos.push(`Usa ocasionalmente ${lowCards.map(c=>c.name).join(", ")} para mantener las cuentas activas.`);

      // Balance rules
      if(balance < 0)  alertas.push("Tus gastos superan tus ingresos este período. Revisa tus gastos fijos.");
      if(balance >= 0) consejos.push("Destina parte de tu balance positivo ("+fmtCOP(balance)+") a pagar deuda de tarjeta.");

      // Spending rules
      const topCat = Object.entries(catSpend).sort((a,b)=>b[1]-a[1])[0];
      if(topCat) consejos.push(`Tu mayor gasto es "${topCat[0]}" (${fmtCOP(topCat[1])}). Evalúa si puedes optimizarlo.`);

      // Payment suggestion
      const worstCard = cards.filter(c=>c.type==="credito"&&c.limit>0).sort((a,b)=>(b.used/b.limit)-(a.used/a.limit))[0];
      const pagoSugerido = worstCard
        ? `Paga primero "${worstCard.name}" (${Math.round((worstCard.used/worstCard.limit)*100)}% usado). Es tu tarjeta con mayor utilización y la que más impacta tu score.`
        : "Mantén tus pagos al día y nunca pagues solo el mínimo — los intereses pueden duplicar tu deuda.";

      if(consejos.length===0) consejos.push("Agrega tus tarjetas y registra gastos para recibir consejos personalizados.");

      setAiTip({
        score: creditScore,
        resumen: utilPct===0
          ? "No tienes tarjetas de crédito registradas o sin uso reportado."
          : `Utilizas el ${utilPct}% de tu cupo total. ${creditScore === "Excelente" || creditScore === "Bueno" ? "Vas bien, sigue así." : "Hay margen de mejora importante."}`,
        consejos,
        alertas,
        pagoSugerido,
      });
      setAiLoading(false);
    }, 600);
  }

  // Static payment suggestion based on rules
  function getAiSuggestion(tx){
    const amount = tx.amount;

    // Find best card: credit with lowest utilization and enough available
    const creditCards = cards.filter(c=>c.type==="credito"&&c.limit>0&&(c.limit-c.used)>=amount);
    const bestCredit  = creditCards.sort((a,b)=>(a.used/a.limit)-(b.used/b.limit))[0];

    const debitCards  = cards.filter(c=>c.type==="debito"||c.type==="ahorros");
    const bestDebit   = debitCards[0];

    // Category-based rules
    const catLower = tx.category.toLowerCase();
    let metodoPago, tarjetaSugerida, razon, impactoCredito, tip;

    if(["alimentación","transporte","salud"].includes(catLower)){
      // Essential: prefer debit or QR to protect credit limit
      if(bestDebit){
        metodoPago="Tarjeta débito"; tarjetaSugerida=bestDebit.name;
        razon="Para gastos esenciales es mejor débito o QR — preservas tu cupo de crédito para emergencias.";
        impactoCredito="positivo"; tip="Reserva tu tarjeta de crédito para gastos que puedas pagar en totalidad al mes.";
      } else if(bestCredit&&utilPct<30){
        metodoPago="Tarjeta crédito"; tarjetaSugerida=bestCredit.name;
        razon="Tu utilización está en zona segura. Úsala y paga el total al corte para acumular historial sin intereses.";
        impactoCredito="neutral"; tip="Nunca pagues solo el mínimo — los intereses pueden superar el 30% EA.";
      } else {
        metodoPago="QR / Transferencia"; tarjetaSugerida=null;
        razon="Con utilización alta, mejor pagar por PSE, Nequi o QR para no aumentar tu deuda.";
        impactoCredito="positivo"; tip="Daviplata y Nequi no cobran comisión en la mayoría de comercios.";
      }
    } else if(["entretenimiento","ropa","tecnología"].includes(catLower)){
      // Non-essential: use credit only if low utilization
      if(bestCredit&&utilPct<50){
        metodoPago="Tarjeta crédito"; tarjetaSugerida=bestCredit.name;
        razon="Gastos no esenciales en crédito son aceptables si tu utilización está controlada.";
        impactoCredito="neutral"; tip="Considera diferir a cuotas sin interés si el comercio lo ofrece.";
      } else {
        metodoPago="Efectivo / QR"; tarjetaSugerida=null;
        razon="Tu utilización no permite aumentar más la deuda en tarjeta sin afectar tu score.";
        impactoCredito="positivo"; tip="Si necesitas diferir este gasto, busca opciones de crédito con menor tasa que tu tarjeta.";
      }
    } else if(catLower==="vivienda"){
      metodoPago="QR / Transferencia"; tarjetaSugerida=null;
      razon="Arriendo y servicios van mejor por PSE o transferencia — sin comisiones y sin usar cupo.";
      impactoCredito="positivo"; tip="Automatiza el pago del arriendo para nunca caer en mora.";
    } else {
      // Default
      if(bestCredit&&utilPct<30){
        metodoPago="Tarjeta crédito"; tarjetaSugerida=bestCredit.name;
        razon="Buena utilización actual. Usar crédito y pagar al corte construye historial positivo.";
        impactoCredito="neutral"; tip="Paga el total del extracto, no el mínimo.";
      } else if(bestDebit){
        metodoPago="Tarjeta débito"; tarjetaSugerida=bestDebit.name;
        razon="Mejor débito para mantener tu utilización de crédito bajo control.";
        impactoCredito="positivo"; tip="Una utilización baja puede mejorar tu acceso a crédito futuro.";
      } else {
        metodoPago="Efectivo"; tarjetaSugerida=null;
        razon="Sin tarjetas configuradas. Agrega tus cuentas para recibir sugerencias personalizadas.";
        impactoCredito="neutral"; tip="Registra tus tarjetas en la pestaña Crédito → Tarjetas.";
      }
    }

    setAiSuggestion({metodoPago,tarjetaSugerida,razon,impactoCredito,tip,tx});
  }

  return (
    <div style={s.root} className="fin-app">
      <style>{SCROLLBAR_CSS}</style>
      <div style={s.screen} className="fin-screen">
        {/* HEADER */}
        <div style={s.header}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
            <div>
              {subView && <button onClick={()=>setSubView(null)} style={s.backBtn}>← Atrás</button>}
              <span style={s.headerTitle}>{subView?headerTitles[subView]:headerTitles[view]||"Mi Finanzas"}</span>
              <span style={s.headerSub}>{new Date().toLocaleDateString("es-CO",{month:"long",year:"numeric"})}</span>
            </div>
            {!subView && (
              <button onClick={()=>{setView("settings");setSubView(null);}} style={{background:view==="settings"?"rgba(129,140,248,0.15)":"rgba(255,255,255,0.04)",border:`1px solid ${view==="settings"?P.accent:"rgba(255,255,255,0.08)"}`,borderRadius:12,padding:"9px 11px",color:view==="settings"?P.accent:P.muted,fontSize:18,cursor:"pointer",marginTop:4,backdropFilter:"blur(8px)"}}>⚙️</button>
            )}
          </div>
        </div>

        <div style={s.content}>

          {/* ── DASHBOARD ── */}
          {view==="dashboard" && !subView && (
            <div>
              {/* HERO BALANCE CARD — mes en curso */}
              <div style={{...s.balanceCard, borderColor: monthBalance>=0?"rgba(52,211,153,0.2)":"rgba(248,113,113,0.2)", background: monthBalance>=0?"linear-gradient(135deg,#0a1a12 0%,#0d1a1a 50%,#0a0f1a 100%)":"linear-gradient(135deg,#1a0a0a 0%,#1a0d0d 50%,#0f0a1a 100%)"}}>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                  <div style={{width:6,height:6,borderRadius:"50%",flexShrink:0,background:monthBalance>=0?P.income:P.expense,boxShadow:`0 0 8px ${monthBalance>=0?P.income:P.expense}`}}/>
                  <span style={{...s.balanceLabel,marginBottom:0}}>Balance de {monthKeys.label}</span>
                  {monthDelta!==null&&(
                    <span style={{marginLeft:"auto",fontSize:10,fontWeight:700,padding:"3px 8px",borderRadius:20,whiteSpace:"nowrap",background:monthDelta>=0?"rgba(52,211,153,0.12)":"rgba(248,113,113,0.12)",color:monthDelta>=0?P.income:P.expense}}>
                      {monthDelta>=0?"▲":"▼"}{Math.abs(monthDelta)}% vs {monthKeys.prevLabel}
                    </span>
                  )}
                </div>
                <div style={{...s.balanceAmount,marginBottom:20,fontVariantNumeric:"tabular-nums",color:monthBalance>=0?P.income:P.expense,textShadow:`0 0 40px ${monthBalance>=0?"rgba(52,211,153,0.3)":"rgba(248,113,113,0.3)"}`}}>{fmtCOP(monthBalance)}</div>
                <div style={s.balanceRow}>
                  <div style={s.balanceStat}>
                    <div style={{width:32,height:32,borderRadius:10,flexShrink:0,background:"rgba(52,211,153,0.1)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,color:P.income}}>▲</div>
                    <div><div style={s.statLabel}>Ingresos</div><div style={{color:P.income,fontWeight:700,fontSize:16,fontVariantNumeric:"tabular-nums"}}>{fmtCOP(monthIncome)}</div></div>
                  </div>
                  <div style={s.dividerV}/>
                  <div style={s.balanceStat}>
                    <div style={{width:32,height:32,borderRadius:10,flexShrink:0,background:"rgba(248,113,113,0.1)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,color:P.expense}}>▼</div>
                    <div><div style={s.statLabel}>Gastos</div><div style={{color:P.expense,fontWeight:700,fontSize:16,fontVariantNumeric:"tabular-nums"}}>{fmtCOP(monthExpense)}</div></div>
                  </div>
                </div>
                <div style={{marginTop:18,paddingTop:14,borderTop:"1px solid rgba(255,255,255,0.06)",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <span style={{fontSize:11,color:P.textSub}}>Acumulado histórico</span>
                  <span style={{fontSize:13,fontWeight:700,fontVariantNumeric:"tabular-nums",color:balance>=0?P.income:P.expense}}>{fmtCOP(balance)}</span>
                </div>
              </div>

              {/* Cuentas y patrimonio */}
              <div style={s.card}>
                <div style={s.cardRowSb}>
                  <span style={s.cardTitle}>Cuentas y patrimonio</span>
                  <button onClick={()=>{setView("credit");setCreditTab("cards");setSubView(null);}} style={{background:"none",border:"none",color:P.accent,fontSize:12,fontWeight:600,cursor:"pointer",padding:0}}>Gestionar</button>
                </div>
                <div style={{fontSize:11,color:P.textSub,letterSpacing:0.5,textTransform:"uppercase",marginBottom:2}}>Patrimonio total</div>
                <div style={{fontSize:28,fontWeight:800,color:patrimonio>=0?P.income:P.expense,fontVariantNumeric:"tabular-nums",marginBottom:4}}>{fmtCOP(patrimonio)}</div>
                <div style={{display:"flex",flexWrap:"wrap",gap:"2px 12px",fontSize:11,color:P.textSub,marginBottom:accounts.length?12:0}}>
                  <span>Líquido {fmtCOP(liquidTotal)}</span>
                  {porCobrar>0 && <span>· Por cobrar {fmtCOP(porCobrar)}</span>}
                  {porPagar>0 && <span style={{color:P.expense}}>· Debes (deudas) {fmtCOP(porPagar)}</span>}
                  {creditDebt>0 && <span style={{color:P.textSub}}>· Debes en tarjetas {fmtCOP(creditDebt)} (se paga por cuotas)</span>}
                </div>
                {accounts.length===0 ? (
                  <div style={{fontSize:12,color:P.textSub}}>Crea tus cuentas (Efectivo, Bancolombia, Nequi…) en <strong style={{color:P.accent}}>Crédito → Tarjetas</strong> para ver y configurar tus saldos aquí.</div>
                ) : accounts.map(a=>(
                  <div key={a.id} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0",borderBottom:"1px solid rgba(255,255,255,0.04)"}}>
                    {renderLogo(a,30)}
                    <div style={{flex:1}}>
                      <div style={{fontSize:13,color:P.text,fontWeight:600}}>{a.name}</div>
                      <div style={{fontSize:11,color:P.textSub,textTransform:"capitalize"}}>{a.type}</div>
                    </div>
                    <div style={{fontSize:14,fontWeight:700,color:(a.used||0)>=0?P.text:P.expense,fontVariantNumeric:"tabular-nums"}}>{fmtCOP(a.used||0)}</div>
                  </div>
                ))}
              </div>

              {/* Area Chart Ingresos vs Gastos con filtros */}
              <AreaChartCard transactions={transactions} P={P} fmtCOP={fmtCOP} />

              {/* Savings rate — del mes */}
              <div style={s.card}>
                <div style={s.cardRowSb}>
                  <span style={s.cardTitle}>Tasa de ahorro · {monthKeys.label}</span>
                  <span style={{color:monthSaveRate>=20?P.income:monthSaveRate>=0?P.accent:P.expense,fontWeight:700,fontVariantNumeric:"tabular-nums"}}>{monthSaveRate}%</span>
                </div>
                <div style={s.progressBg}><div style={{...s.progressBar,width:`${Math.max(0,Math.min(100,monthSaveRate))}%`}}/></div>
              </div>

              {/* Presupuesto del mes */}
              {budgetRows.length>0 && (
                <div style={s.card}>
                  <div style={s.cardRowSb}>
                    <span style={s.cardTitle}>Presupuesto · {monthKeys.label}</span>
                    <button onClick={()=>{setView("settings");setSubView("budget");}} style={{background:"none",border:"none",color:P.accent,fontSize:12,fontWeight:600,cursor:"pointer",padding:0}}>Editar</button>
                  </div>
                  {budgetRows.slice(0,3).map(b=>(
                    <div key={b.cat} style={{marginBottom:13}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:4}}>
                        <span style={{fontSize:13,color:P.text,fontWeight:600}}>{b.cat}</span>
                        <span style={{fontSize:11,fontWeight:700,color:budgetColor(b.pct),fontVariantNumeric:"tabular-nums"}}>{b.pct}%</span>
                      </div>
                      <div style={{fontSize:11,color:P.textSub,marginBottom:6,fontVariantNumeric:"tabular-nums"}}>{fmtCOP(b.spent)} / {fmtCOP(b.limit)}</div>
                      <div style={s.progressBg}>
                        <div style={{height:"100%",width:`${Math.min(100,b.pct)}%`,background:budgetColor(b.pct),borderRadius:999,transition:"width 0.6s cubic-bezier(0.4,0,0.2,1)"}}/>
                      </div>
                      {b.pct>=100&&<div style={{fontSize:11,color:P.expense,marginTop:6,fontWeight:600}}>Excedido por {fmtCOP(b.spent-b.limit)}</div>}
                    </div>
                  ))}
                  {budgetRows.length>3&&(
                    <div style={{fontSize:11,color:P.textSub,textAlign:"center",marginTop:2}}>+{budgetRows.length-3} categoría(s) más</div>
                  )}
                </div>
              )}

              {/* Goals quick view */}
              {goals.length>0 && (
                <div style={s.card}>
                  <div style={s.cardTitle}>Metas de ahorro</div>
                  {goals.slice(0,2).map(g=>{
                    const pct=Math.min(100,Math.round((g.saved/g.target)*100));
                    return (
                      <div key={g.id} style={{marginBottom:12}}>
                        <div style={s.cardRowSb}><span style={{fontSize:13,color:P.text,fontWeight:600}}>{g.name}</span><span style={{fontSize:12,color:P.accent}}>{pct}%</span></div>
                        <div style={{fontSize:11,color:P.textSub,marginBottom:5}}>{fmtCOP(g.saved)} / {fmtCOP(g.target)}</div>
                        <div style={s.progressBg}><div style={{...s.progressBar,width:`${pct}%`,background:`linear-gradient(90deg,${P.accent},#c084fc)`}}/></div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Loans quick view */}
              {loans.filter(l=>!l.paid).length>0 && (
                <div style={s.card}>
                  <div style={s.cardTitle}>Préstamos activos</div>
                  {loans.filter(l=>!l.paid).slice(0,2).map(l=>{
                    const st=loanStatus(l);
                    return (
                      <div key={l.id} style={s.txRow}>
                        <div style={{...s.txIcon("loan")}}>💸</div>
                        <div style={{flex:1}}><div style={s.txCat}>{l.debtor}</div><div style={s.txNote}>Prestaste {fmtCOP(l.amount)} · recibido {fmtCOP(st.received)}</div></div>
                        <div style={{textAlign:"right"}}><div style={{color:P.loan,fontWeight:600,fontSize:14}}>Te deben {fmtCOP(st.totalOut)}</div><div style={s.txDate}>{st.pct}% recibido</div></div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Debts quick view */}
              {debts.filter(d=>!d.paid).length>0 && (
                <div style={s.card}>
                  <div style={s.cardTitle}>Deudas activas</div>
                  {debts.filter(d=>!d.paid).slice(0,2).map(d=>{
                    const st=debtStatus(d);
                    return (
                      <div key={d.id} style={s.txRow}>
                        <div style={{...s.txIcon("expense")}}>🙏</div>
                        <div style={{flex:1}}><div style={s.txCat}>{d.lender}</div><div style={s.txNote}>Te prestaron {fmtCOP(d.amount)} · pagado {fmtCOP(st.paidAmt)}</div></div>
                        <div style={{textAlign:"right"}}><div style={{color:P.expense,fontWeight:600,fontSize:14}}>Debes {fmtCOP(st.totalOut)}</div><div style={s.txDate}>{st.pct}% pagado</div></div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Recent transactions */}
              <div style={s.card}>
                <div style={s.cardTitle}>Últimos movimientos</div>
                {transactions.length===0?(
                  <div style={{textAlign:"center",padding:"24px 0"}}>
                    <div style={{fontSize:36,marginBottom:10}}>◈</div>
                    <div style={{color:P.text,fontWeight:600,marginBottom:6}}>Todo listo para empezar</div>
                    <div style={{color:P.textSub,fontSize:13,marginBottom:16}}>Registra tu primer ingreso o gasto</div>
                    <button onClick={()=>setView("add")} style={s.accentBtn}>+ Agregar movimiento</button>
                  </div>
                ):transactions.slice(-4).reverse().map(t=>(
                  <div key={t.id} style={s.txRow}>
                    <div style={s.txIcon(t.type)}>{t.type==="income"?"▲":"▼"}</div>
                    <div style={{flex:1}}>
                      <div style={s.txCat}>{t.category}</div>
                      <div style={{display:"flex",alignItems:"center",gap:6,marginTop:2,flexWrap:"wrap"}}>
                        {t.method&&<span style={{fontSize:11,padding:"2px 7px",borderRadius:20,background:"rgba(129,140,248,0.1)",color:P.accent,fontWeight:600}}>{METHOD_ICONS[t.method]||"💱"} {t.method}</span>}
                        <span style={s.txNote}>{t.note||"—"}</span>
                      </div>
                    </div>
                    <div style={{textAlign:"right"}}>
                      <div style={{color:t.type==="income"?P.income:P.expense,fontWeight:600,fontSize:14}}>{t.type==="income"?"+":"-"}{fmtCOP(t.amount)}</div>
                      <div style={s.txDate}>{fmtDate(t.date)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── ADD TRANSACTION ── */}
          {view==="add" && (
            <form onSubmit={addTransaction}>
              <div style={s.toggleRow}>
                {["expense","income"].map(t=>(
                  <button key={t} type="button" onClick={()=>setTxForm(f=>({...f,type:t,category:"",method:"",accountId:"",cuotas:"1",useSplit:false,splits:[]}))} style={s.toggleBtn(txForm.type===t,t)}>
                    {t==="income"?"▲ Ingreso":"▼ Gasto"}
                  </button>
                ))}
              </div>
              <div style={s.fieldGroup}><label style={s.label}>Monto (COP)</label>
                <input style={s.input} type="text" inputMode="numeric" placeholder="0" value={fmtMiles(txForm.amount)} onChange={e=>setTxForm(f=>({...f,amount:onlyDigits(e.target.value)}))} required/>
              </div>
              <div style={s.fieldGroup}><label style={s.label}>Categoría</label>
                <CustomSelect
                  value={txForm.category}
                  onChange={e=>setTxForm(f=>({...f,category:e.target.value}))}
                  options={(txForm.type==="expense"?expCats:incCats)}
                  placeholder="Seleccionar..."
                  P={P}
                />
              </div>
              {txForm.type==="expense" && txForm.category && budgets[txForm.category]>0 && (()=>{
                const limit = budgets[txForm.category];
                const after = (monthCatSpend[txForm.category]||0) + (parseFloat(txForm.amount)||0);
                const pct   = Math.round((after/limit)*100);
                if(pct < 80) return null;
                const over = pct >= 100;
                return (
                  <div style={{marginTop:-8,marginBottom:18,padding:"11px 13px",borderRadius:12,background:over?"rgba(248,113,113,0.09)":"rgba(251,191,36,0.09)",border:`1px solid ${over?"rgba(248,113,113,0.35)":"rgba(251,191,36,0.35)"}`}}>
                    <div style={{fontSize:12,fontWeight:700,marginBottom:3,color:over?P.expense:P.loan}}>
                      {over?"Excede el presupuesto":"Cerca del límite"}
                    </div>
                    <div style={{fontSize:11,color:P.textSub,fontVariantNumeric:"tabular-nums"}}>
                      {txForm.category}: {fmtCOP(after)} de {fmtCOP(limit)} ({pct}%) este mes
                    </div>
                  </div>
                );
              })()}

              {(accounts.length>0 || creditOnly.length>0) ? (
                <div style={s.fieldGroup}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                    <label style={{...s.label,marginBottom:0}}>{txForm.type==="income"?"Cuenta (entra a)":"Pagar con"}</label>
                    <button type="button" onClick={()=>setTxForm(f=>({...f,useSplit:!f.useSplit,accountId:"",splits:f.useSplit?[]:[{accountId:"",amount:parseFloat(f.amount)||0}]}))}
                      style={{background:"none",border:"none",color:P.accent,fontSize:11,fontWeight:600,cursor:"pointer",padding:0,textDecoration:"underline"}}>
                      {txForm.useSplit?"Usar una sola cuenta":"Dividir entre varias cuentas"}
                    </button>
                  </div>

                  {txForm.useSplit ? (
                    <PaymentSplitter
                      total={parseFloat(txForm.amount)||0}
                      cards={txForm.type==="expense" ? cards : cards.filter(c=>c.type!=="credito")}
                      value={txForm.splits}
                      onChange={splits=>setTxForm(f=>({...f,splits}))}
                      P={P}
                      mode={txForm.type==="expense"?"out":"in"}
                    />
                  ) : (
                    <>
                      <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
                        {accounts.map(a=>(
                          <button key={a.id} type="button" onClick={()=>setTxForm(f=>({...f,accountId:f.accountId===a.id?"":a.id}))}
                            style={{padding:"7px 12px",borderRadius:20,border:`1.5px solid ${txForm.accountId===a.id?P.accent:P.cardBorder}`,background:txForm.accountId===a.id?"rgba(129,140,248,0.13)":"transparent",color:txForm.accountId===a.id?P.accent:P.textSub,fontSize:12,fontWeight:600,cursor:"pointer",display:"flex",alignItems:"center",gap:6}}>
                            <span style={{width:8,height:8,borderRadius:"50%",background:a.color||P.accent}}/>{a.name} · {fmtCOP(a.used||0)}
                          </button>
                        ))}
                        {txForm.type==="expense" && creditOnly.map(c=>{
                          const avail=Math.max(0,(c.limit||0)-(c.used||0));
                          const on=txForm.accountId===c.id;
                          return (
                            <button key={c.id} type="button" onClick={()=>setTxForm(f=>({...f,accountId:f.accountId===c.id?"":c.id}))}
                              style={{padding:"7px 12px",borderRadius:20,border:`1.5px solid ${on?P.loan:P.cardBorder}`,background:on?"rgba(251,191,36,0.13)":"transparent",color:on?P.loan:P.textSub,fontSize:12,fontWeight:600,cursor:"pointer",display:"flex",alignItems:"center",gap:6}}>
                              💳 {c.name} · cupo {fmtCOP(avail)}
                            </button>
                          );
                        })}
                      </div>
                      {(() => {
                        const sel = txForm.accountId!==""?cards.find(c=>c.id===txForm.accountId):null;
                        if(sel && sel.type==="credito" && txForm.type==="expense"){
                          const amt=parseFloat(txForm.amount)||0;
                          const n=Math.max(1,parseInt(txForm.cuotas)||1);
                          return (
                            <div style={{marginTop:12}}>
                              <label style={s.label}>Cuotas</label>
                              <input style={s.input} type="number" min="1" value={txForm.cuotas} onChange={e=>setTxForm(f=>({...f,cuotas:e.target.value}))}/>
                              <div style={{fontSize:11,color:P.loan,marginTop:8,lineHeight:1.5}}>Compra a crédito: sube la deuda {fmtCOP(amt)} de {sel.name} (baja el cupo). {n>1?`${n} cuotas de ~${fmtCOP(Math.round(amt/n))}. `:""}El efectivo sale cuando pagues cada cuota, no ahora.</div>
                            </div>
                          );
                        }
                        return <div style={{fontSize:11,color:P.textSub,marginTop:6}}>Ajusta el saldo de esa cuenta. Opcional.</div>;
                      })()}
                    </>
                  )}
                </div>
              ) : (
                <div style={{...s.card,padding:"12px 14px"}}>
                  <div style={{fontSize:12,color:P.textSub}}>Aún no tienes cuentas ni tarjetas. Créalas en <strong style={{color:P.accent}}>Crédito → Tarjetas</strong> y los movimientos ajustarán tu saldo.</div>
                </div>
              )}

              {!txForm.useSplit && (()=>{
                const sel = txForm.accountId!==""?cards.find(c=>c.id===txForm.accountId):null;
                if(txForm.type!=="expense" || !sel || sel.type==="credito") return null;
                const amt = parseFloat(txForm.amount)||0;
                if(amt<=0 || amt<=(sel.used||0)) return null;
                return (
                  <div style={{marginTop:-8,marginBottom:18,padding:"11px 13px",borderRadius:12,background:"rgba(248,113,113,0.09)",border:"1px solid rgba(248,113,113,0.35)"}}>
                    <div style={{fontSize:12,fontWeight:700,marginBottom:3,color:P.expense}}>Saldo insuficiente</div>
                    <div style={{fontSize:11,color:P.textSub}}>{sel.name} tiene {fmtCOP(sel.used||0)}. Este gasto no se puede registrar con esta cuenta — elige otra o divide el pago entre varias.</div>
                  </div>
                );
              })()}

              <div style={s.fieldGroup}>
                <label style={s.label}>Método de {txForm.type==="income"?"cobro":"pago"}</label>
                <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
                  {PAYMENT_METHODS[txForm.type].map(m=>(
                    <button key={m} type="button" onClick={()=>setTxForm(f=>({...f,method:m}))}
                      style={{padding:"7px 12px",borderRadius:20,border:`1.5px solid ${txForm.method===m?P.accent:P.cardBorder}`,background:txForm.method===m?"rgba(129,140,248,0.13)":"transparent",color:txForm.method===m?P.accent:P.textSub,fontSize:12,fontWeight:600,cursor:"pointer",display:"flex",alignItems:"center",gap:5}}>
                      <span>{METHOD_ICONS[m]||"💱"}</span>{m}
                    </button>
                  ))}
                </div>
              </div>
              <div style={s.fieldGroup}><label style={s.label}>Nota (opcional)</label>
                <input style={s.input} type="text" placeholder="Descripción breve..." value={txForm.note} onChange={e=>setTxForm(f=>({...f,note:e.target.value}))}/>
              </div>
              <div style={s.fieldGroup}><label style={s.label}>Fecha</label>
                <input style={s.input} type="date" value={txForm.date} onChange={e=>setTxForm(f=>({...f,date:e.target.value}))}/>
              </div>
              <button type="submit" style={s.submitBtn(txForm.type)}>{txForm.type==="income"?"Registrar ingreso ▲":"Registrar gasto ▼"}</button>
            </form>
          )}

          {/* ── TRANSACTIONS ── */}
          {view==="transactions" && (
            <div>
              <div style={s.filterRow}>
                {[["all","Todos"],["income","Ingresos"],["expense","Gastos"]].map(([v,l])=>(
                  <button key={v} onClick={()=>setFilter(v)} style={s.filterBtn(filterType===v)}>{l}</button>
                ))}
              </div>
              {loans.filter(l=>!l.paid).length>0 && (
                <div style={{...s.card,marginBottom:14}}>
                  <div style={s.cardTitle}>Préstamos por cobrar</div>
                  {loans.filter(l=>!l.paid).map(l=>{
                    const st=loanStatus(l);
                    return (
                      <div key={l.id} style={s.txRow}>
                        <div style={{...s.txIcon("loan")}}>💸</div>
                        <div style={{flex:1}}>
                          <div style={s.txCat}>{l.debtor}</div>
                          <div style={s.txNote}>Prestaste {fmtCOP(l.amount)} · te deben {fmtCOP(st.totalOut)}</div>
                        </div>
                        <div style={{textAlign:"right"}}>
                          <div style={{color:P.income,fontWeight:700,fontSize:13}}>{fmtCOP(st.received)}</div>
                          <div style={s.txDate}>recibido · {st.pct}%</div>
                        </div>
                      </div>
                    );
                  })}
                  <button onClick={()=>{setView("credit");setCreditTab("loans");setSubView(null);}} style={{...s.accentBtn,width:"100%",marginTop:10,padding:"9px"}}>Gestionar préstamos →</button>
                </div>
              )}
              {filtered.length===0?<div style={s.empty}>Sin movimientos</div>:filtered.map(t=>(
                <div key={t.id} style={s.txCard}>
                  <div style={s.txIcon(t.type)}>{t.type==="income"?"▲":"▼"}</div>
                  <div style={{flex:1}}>
                    <div style={s.txCat}>{t.category}</div>
                    <div style={{display:"flex",alignItems:"center",gap:6,marginTop:2,flexWrap:"wrap"}}>
                      {t.method&&<span style={{fontSize:11,padding:"2px 7px",borderRadius:20,background:"rgba(129,140,248,0.1)",color:P.accent,fontWeight:600}}>{METHOD_ICONS[t.method]||"💱"} {t.method}</span>}
                      <span style={s.txNote}>{t.note||"—"} · {fmtDate(t.date)}</span>
                    </div>
                  </div>
                  <div style={{textAlign:"right",display:"flex",flexDirection:"column",alignItems:"flex-end",gap:4}}>
                    <div style={{color:t.type==="income"?P.income:P.expense,fontWeight:700,fontSize:14}}>{t.type==="income"?"+":"-"}{fmtCOP(t.amount)}</div>
                    <div style={{display:"flex",gap:4}}>
                      {t.type==="expense"&&<button onClick={()=>getAiSuggestion(t)} style={{background:"rgba(129,140,248,0.1)",border:"none",color:P.accent,borderRadius:8,padding:"3px 7px",cursor:"pointer",fontSize:11}}>✨</button>}
                      {delConfirm===t.id?(
                        <div style={{display:"flex",gap:6}}>
                          <button onClick={()=>{if(t.accountId!=null)adjustAccount(t.accountId,t.type==="income"?-t.amount:t.amount);setTransactions(p=>p.filter(x=>x.id!==t.id));setDelConfirm(null);}} style={s.delConfirm}>Sí</button>
                          <button onClick={()=>setDelConfirm(null)} style={s.delCancel}>No</button>
                        </div>
                      ):<button onClick={()=>setDelConfirm(t.id)} style={s.delBtn}>✕</button>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── STATS ── */}
          {view==="stats" && (
            <div>
              {/* Filtro de período */}
              <div style={s.card}>
                <div style={s.cardTitle}>Período</div>
                <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:statsFilter==="custom"?12:0}}>
                  {[["total","Total"],["week","Semana"],["15d","15 días"],["month","Mes"],["custom","Rango"]].map(([v,l])=>(
                    <button key={v} onClick={()=>setStatsFilter(v)}
                      style={{padding:"6px 12px",borderRadius:20,border:`1.5px solid ${statsFilter===v?P.accent:P.cardBorder}`,background:statsFilter===v?"rgba(129,140,248,0.13)":"transparent",color:statsFilter===v?P.accent:P.textSub,fontSize:12,fontWeight:600,cursor:"pointer"}}>
                      {l}
                    </button>
                  ))}
                </div>
                {statsFilter==="custom"&&(
                  <div style={{display:"flex",gap:8,marginTop:12}}>
                    <input type="date" value={statsFrom} onChange={e=>setStatsFrom(e.target.value)} style={{flex:1,padding:"8px 10px",background:P.bg,border:`1.5px solid ${P.cardBorder}`,borderRadius:10,color:P.text,fontSize:13,outline:"none"}}/>
                    <span style={{color:P.textSub,alignSelf:"center"}}>→</span>
                    <input type="date" value={statsTo} onChange={e=>setStatsTo(e.target.value)} style={{flex:1,padding:"8px 10px",background:P.bg,border:`1.5px solid ${P.cardBorder}`,borderRadius:10,color:P.text,fontSize:13,outline:"none"}}/>
                  </div>
                )}
              </div>

              {/* Resumen del período */}
              <div style={{background:"linear-gradient(135deg,#1a1a2e,#16213e)",border:`1px solid ${P.cardBorder}`,borderRadius:16,padding:16,marginBottom:14}}>
                <div style={s.cardTitle}>
                  Resumen — {statsFilter==="total"?"Todo el tiempo":statsFilter==="week"?"Últimos 7 días":statsFilter==="15d"?"Últimos 15 días":statsFilter==="month"?"Este mes":"Rango personalizado"}
                </div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
                  {[["▲ Ingresos",fmtCOP(statsIncome),P.income],["▼ Gastos",fmtCOP(statsExpense),P.expense],["◈ Balance",fmtCOP(statsBalance),statsBalance>=0?P.income:P.expense],["# Movimientos",filteredForStats.length,P.accent]].map(([l,v,c])=>(
                    <div key={l} style={{background:"rgba(255,255,255,0.03)",borderRadius:12,padding:"12px"}}>
                      <div style={{fontSize:11,color:P.textSub,marginBottom:4}}>{l}</div>
                      <div style={{fontSize:15,fontWeight:700,color:c}}>{v}</div>
                    </div>
                  ))}
                </div>
                <div style={{fontSize:11,color:P.textSub,marginBottom:6}}>Tasa de ahorro</div>
                <div style={s.progressBg}>
                  <div style={{...s.progressBar,width:`${Math.max(0,Math.min(100,statsIncome>0?(statsBalance/statsIncome)*100:0))}%`}}/>
                </div>
                <div style={{textAlign:"right",fontSize:12,color:P.accent,fontWeight:700,marginTop:4}}>
                  {statsIncome>0?Math.round((statsBalance/statsIncome)*100):0}%
                </div>
              </div>

              {/* Donut categorías */}
              <div style={s.card}>
                <div style={s.cardTitle}>Gastos por categoría</div>
                {statsCatData.length===0?<div style={s.empty}>Sin datos en este período</div>:(
                  <>
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie data={statsCatData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} dataKey="value" paddingAngle={3}>
                          {statsCatData.map((_,i)=><Cell key={i} fill={CAT_COLORS[i%CAT_COLORS.length]}/>)}
                        </Pie>
                        <Tooltip formatter={v=>fmtCOP(v)} contentStyle={{background:P.card,border:`1px solid ${P.cardBorder}`,borderRadius:8,color:P.text}}/>
                      </PieChart>
                    </ResponsiveContainer>
                    <div style={{display:"flex",flexWrap:"wrap",gap:"6px 14px",marginTop:4}}>
                      {statsCatData.map((d,i)=>(
                        <div key={d.name} style={{display:"flex",alignItems:"center",gap:5,fontSize:12,color:P.textSub}}>
                          <div style={{width:8,height:8,borderRadius:"50%",background:CAT_COLORS[i%CAT_COLORS.length]}}/>
                          {d.name}
                        </div>
                      ))}
                    </div>
                    {/* Top categorías */}
                    <div style={{marginTop:14}}>
                      {statsCatData.slice(0,4).map((d,i)=>{
                        const pct=Math.round((d.value/statsExpense)*100);
                        return(
                          <div key={d.name} style={{marginBottom:8}}>
                            <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:3}}>
                              <span style={{color:P.text}}>{d.name}</span>
                              <span style={{color:CAT_COLORS[i%CAT_COLORS.length],fontWeight:600}}>{fmtCOP(d.value)} · {pct}%</span>
                            </div>
                            <div style={s.progressBg}>
                              <div style={{...s.progressBar,width:`${pct}%`,background:CAT_COLORS[i%CAT_COLORS.length]}}/>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>

              {/* Barras mensuales */}
              <div style={s.card}>
                <div style={s.cardTitle}>Ingresos vs Gastos</div>
                {statsMonthlyData.length===0?<div style={s.empty}>Sin datos en este período</div>:(
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={statsMonthlyData} barGap={4}>
                      <XAxis dataKey="month" tick={{fill:P.textSub,fontSize:11}} axisLine={false} tickLine={false}/>
                      <YAxis tick={{fill:P.textSub,fontSize:10}} axisLine={false} tickLine={false} tickFormatter={v=>`${(v/1000000).toFixed(1)}M`}/>
                      <Tooltip formatter={v=>fmtCOP(v)} contentStyle={{background:P.card,border:`1px solid ${P.cardBorder}`,borderRadius:8,color:P.text}}/>
                      <Bar dataKey="income" fill={P.income} radius={[4,4,0,0]} name="Ingresos"/>
                      <Bar dataKey="expense" fill={P.expense} radius={[4,4,0,0]} name="Gastos"/>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* Balance acumulado */}
              <div style={s.card}>
                <div style={s.cardTitle}>Balance acumulado</div>
                {statsMonthlyData.length===0?<div style={s.empty}>Sin datos en este período</div>:(
                  <ResponsiveContainer width="100%" height={140}>
                    <LineChart data={statsMonthlyData.map((d,i,arr)=>({...d,balance:arr.slice(0,i+1).reduce((s,x)=>s+x.income-x.expense,0)}))}>
                      <XAxis dataKey="month" tick={{fill:P.textSub,fontSize:11}} axisLine={false} tickLine={false}/>
                      <YAxis tick={{fill:P.textSub,fontSize:10}} axisLine={false} tickLine={false} tickFormatter={v=>`${(v/1000000).toFixed(1)}M`}/>
                      <Tooltip formatter={v=>fmtCOP(v)} contentStyle={{background:P.card,border:`1px solid ${P.cardBorder}`,borderRadius:8,color:P.text}}/>
                      <Line type="monotone" dataKey="balance" stroke={P.accent} strokeWidth={2.5} dot={{fill:P.accent,r:4}} name="Balance"/>
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          )}

          {/* ── SETTINGS (menu) ── */}
          {view==="settings" && !subView && (
            <div>
              {[
                {id:"goals",icon:"🎯",label:"Metas de ahorro",sub:"Objetivos con progreso visual"},
                {id:"budget",icon:"📊",label:"Presupuesto mensual",sub:"Límites por categoría"},
                {id:"categories",icon:"🏷️",label:"Categorías",sub:"Personaliza tus categorías"},
                {id:"exportimport",icon:"💾",label:"Exportar / Importar",sub:"Backup y transferencia entre equipos"},
              ].map(item=>(
                <button key={item.id} onClick={()=>setSubView(item.id)} style={s.menuItem}>
                  <span style={{fontSize:24}}>{item.icon}</span>
                  <div style={{flex:1,textAlign:"left"}}>
                    <div style={{color:P.text,fontWeight:600,fontSize:15}}>{item.label}</div>
                    <div style={{color:P.textSub,fontSize:12}}>{item.sub}</div>
                  </div>
                  <span style={{color:P.muted}}>›</span>
                </button>
              ))}

              {/* About / Credits */}
              <div style={{...s.card,marginTop:8,background:"linear-gradient(135deg,#1a1a2e,#16213e)",borderColor:"rgba(129,140,248,0.2)",textAlign:"center",padding:"28px 20px"}}>
                <div style={{fontSize:36,marginBottom:12}}>◈</div>
                <div style={{fontSize:20,fontWeight:800,color:P.text,letterSpacing:-0.5,marginBottom:4}}>Mis Finanzas</div>
                <div style={{fontSize:12,color:P.accent,fontWeight:600,letterSpacing:1,textTransform:"uppercase",marginBottom:20}}>Control financiero personal</div>
                <div style={{width:40,height:1,background:P.cardBorder,margin:"0 auto 20px"}}/>
                <div style={{fontSize:13,color:P.textSub,marginBottom:6}}>Desarrollado por</div>
                <div style={{fontSize:17,fontWeight:700,color:P.text,marginBottom:4}}>Andrey Martinez</div>
                <div style={{fontSize:12,color:P.textSub,marginBottom:2}}>📧 martinezcortezandrey@gmail.com</div>
                <div style={{fontSize:12,color:P.textSub,marginBottom:2}}>🇨🇴 Colombia</div>
                <div style={{fontSize:12,color:P.textSub,marginBottom:20}}>Cod: 440</div>
                <div style={{width:40,height:1,background:P.cardBorder,margin:"0 auto 16px"}}/>
                <div style={{fontSize:11,color:P.muted}}>Versión 1.1.0-beta · 2026</div>
                <div style={{display:"inline-block",marginTop:8,fontSize:10,fontWeight:700,letterSpacing:0.8,textTransform:"uppercase",color:P.loan,background:"rgba(251,191,36,0.12)",border:"1px solid rgba(251,191,36,0.3)",borderRadius:20,padding:"3px 10px"}}>🚧 En desarrollo</div>
              </div>
            </div>
          )}

          {/* ── EXPORT / IMPORT ── */}
          {view==="settings" && subView==="exportimport" && (
            <div>
              {/* EXPORT JSON */}
              <div style={s.card}>
                <div style={s.cardTitle}>📤 Exportar datos</div>
                <div style={{fontSize:13,color:P.textSub,marginBottom:16}}>Descarga un archivo con <strong style={{color:P.text}}>todo tu historial</strong>: movimientos, tarjetas, metas, préstamos, recurrentes y configuración. Úsalo para hacer backup o transferir a otro equipo.</div>
                <button onClick={()=>{
                  const payload = {
                    version:"1.0.0",
                    exportDate: new Date().toISOString(),
                    transactions, cards, loans, debts, recurringTx, creditPlans,
                    goals, budgets, expCats, incCats, nextId,
                  };
                  saveFile(
                    `mis-finanzas-${new Date().toISOString().slice(0,10)}.json`,
                    JSON.stringify(payload,null,2),
                    "application/json"
                  );
                }} style={{...s.submitBtn("income"),background:`linear-gradient(135deg,#059669,#34d399)`,marginBottom:0}}>
                  💾 Exportar JSON completo
                </button>
              </div>

              {/* EXPORT CSV */}
              <div style={s.card}>
                <div style={s.cardTitle}>📊 Exportar movimientos (CSV)</div>
                <div style={{fontSize:13,color:P.textSub,marginBottom:16}}>Solo los movimientos en formato CSV. Ábrelo en Excel, Google Sheets, o adjúntalo a Claude / ChatGPT / Gemini para análisis.</div>
                <button onClick={()=>{
                  const headers = ["Fecha","Tipo","Categoría","Monto","Método","Nota"];
                  const rows = [...transactions]
                    .sort((a,b)=>a.date.localeCompare(b.date))
                    .map(t=>[t.date, t.type==="income"?"Ingreso":"Gasto", t.category, t.amount, t.method||"", t.note||""]);
                  const csv = [headers,...rows].map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(",")).join("\n");
                  saveFile(
                    `movimientos-${new Date().toISOString().slice(0,10)}.csv`,
                    "\uFEFF"+csv,
                    "text/csv;charset=utf-8"
                  );
                }} style={{...s.submitBtn("income"),background:`linear-gradient(135deg,#1d4ed8,#60a5fa)`,marginBottom:0}}>
                  📋 Exportar CSV (Excel / IA)
                </button>
              </div>

              {/* IMPORT JSON */}
              <div style={s.card}>
                <div style={s.cardTitle}>📥 Importar datos</div>
                <div style={{fontSize:13,color:P.textSub,marginBottom:4}}>Selecciona un archivo <strong style={{color:P.text}}>.json</strong> exportado desde esta app para restaurar todos tus datos.</div>
                <div style={{fontSize:12,color:P.expense,marginBottom:16}}>⚠️ Esto reemplaza todos los datos actuales.</div>
                <label style={{...s.submitBtn("expense"),background:`linear-gradient(135deg,#7c2d12,#f87171)`,display:"block",textAlign:"center",cursor:"pointer",marginBottom:0}}>
                  📂 Seleccionar archivo .json
                  <input type="file" accept=".json" style={{display:"none"}} onChange={e=>{
                    const file = e.target.files?.[0];
                    if(!file) return;
                    const reader = new FileReader();
                    reader.onload = ev => {
                      try {
                        const data = JSON.parse(ev.target.result);
                        if(!data.version||!data.transactions) throw new Error("Formato inválido");
                        if(!window.confirm("¿Importar y reemplazar todos los datos actuales?")) return;
                        if(data.transactions)  setTransactions(data.transactions);
                        if(data.cards)         setCards(data.cards);
                        if(data.loans)         setLoans(data.loans);
                        if(data.debts)         setDebts(data.debts);
                        if(data.recurringTx)   setRecurringTx(data.recurringTx);
                        if(data.creditPlans)   setCreditPlans(data.creditPlans);
                        if(data.goals)         setGoals(data.goals);
                        if(data.budgets)       setBudgets(data.budgets);
                        if(data.expCats)       setExpCats(data.expCats);
                        if(data.incCats)       setIncCats(data.incCats);
                        if(data.nextId)        setNextId(data.nextId);
                        alert("✅ Datos importados correctamente");
                        setSubView(null);
                      } catch(err){
                        alert("❌ Archivo inválido. Asegúrate de usar un JSON exportado desde esta app.");
                      }
                    };
                    reader.readAsText(file);
                    e.target.value="";
                  }}/>
                </label>
              </div>

              {/* TIP para IA */}
              <div style={{...s.card,background:"rgba(129,140,248,0.05)",borderColor:"rgba(129,140,248,0.2)"}}>
                <div style={{...s.cardTitle,color:P.accent}}>🤖 Tip: Análisis con IA</div>
                <div style={{fontSize:13,color:P.textSub,lineHeight:1.6}}>
                  Exporta el <strong style={{color:P.text}}>JSON completo</strong> o el <strong style={{color:P.text}}>CSV</strong> y adjúntalo en cualquier IA:<br/><br/>
                  <span style={{color:P.text}}>Claude · ChatGPT · Gemini</span><br/><br/>
                  Luego pregunta:<br/>
                  <span style={{fontStyle:"italic",color:P.accent}}>"Analiza mis finanzas, identifica en qué gasto más, cómo mejorar y qué hábitos cambiar"</span>
                </div>
              </div>
            </div>
          )}

          {/* ── GOALS ── */}
          {view==="settings" && subView==="goals" && (
            <div>
              <form onSubmit={addGoal} style={{...s.card,marginBottom:16}}>
                <div style={s.cardTitle}>{editGoal!==null?"Editar meta":"Nueva meta"}</div>
                <div style={s.fieldGroup}><label style={s.label}>Nombre</label>
                  <input style={s.input} placeholder="Ej: Fondo emergencias" value={goalForm.name} onChange={e=>setGoalForm(f=>({...f,name:e.target.value}))} required/>
                </div>
                <div style={s.fieldGroup}><label style={s.label}>Monto objetivo (COP)</label>
                  <input style={s.input} type="text" inputMode="numeric" placeholder="0" value={fmtMiles(goalForm.target)} onChange={e=>setGoalForm(f=>({...f,target:onlyDigits(e.target.value)}))} required/>
                </div>
                <div style={s.fieldGroup}><label style={s.label}>Ya tengo ahorrado (COP)</label>
                  <input style={s.input} type="text" inputMode="numeric" placeholder="0" value={fmtMiles(goalForm.saved)} onChange={e=>setGoalForm(f=>({...f,saved:onlyDigits(e.target.value)}))}/>
                </div>
                <button type="submit" style={{...s.submitBtn("income"),background:"linear-gradient(135deg,#6d28d9,#818cf8)"}}>
                  {editGoal!==null?"Guardar cambios":"Crear meta"}
                </button>
                {editGoal!==null&&<button type="button" onClick={()=>{setEditGoal(null);setGoalForm({name:"",target:"",saved:""});}} style={{...s.submitBtn("expense"),marginTop:8,background:"transparent",border:`1px solid ${P.cardBorder}`,color:P.textSub}}>Cancelar</button>}
              </form>

              {goals.length===0?<div style={s.empty}>Sin metas aún</div>:goals.map(g=>{
                const pct=Math.min(100,Math.round((g.saved/g.target)*100));
                const remaining=g.target-g.saved;
                return (
                  <div key={g.id} style={s.card}>
                    <div style={s.cardRowSb}>
                      <span style={{fontSize:15,fontWeight:700,color:P.text}}>{g.name}</span>
                      <span style={{fontSize:13,fontWeight:700,color:pct>=100?P.income:P.accent}}>{pct}%</span>
                    </div>
                    <div style={{fontSize:12,color:P.textSub,marginBottom:8}}>{fmtCOP(g.saved)} ahorrado · falta {fmtCOP(Math.max(0,remaining))}</div>
                    <div style={s.progressBg}><div style={{...s.progressBar,width:`${pct}%`,background:`linear-gradient(90deg,#6d28d9,${P.accent})`}}/></div>
                    {pct>=100&&<div style={{color:P.income,fontSize:12,fontWeight:600,marginTop:6}}>🎉 ¡Meta alcanzada!</div>}
                    <div style={{display:"flex",gap:8,marginTop:12}}>
                      <input type="text" inputMode="numeric" placeholder="Abonar..." onChange={e=>{e.target.value=fmtMiles(e.target.value);}} style={{...s.input,flex:1,padding:"8px 10px",fontSize:13}} id={`ab-${g.id}`}/>
                      <button onClick={()=>{const v=parseFloat(onlyDigits(document.getElementById(`ab-${g.id}`).value))||0;if(v>0)addToGoal(g.id,v);document.getElementById(`ab-${g.id}`).value="";}} style={{padding:"8px 14px",borderRadius:10,background:"rgba(129,140,248,0.15)",border:`1px solid ${P.accent}`,color:P.accent,fontWeight:600,fontSize:13,cursor:"pointer"}}>+</button>
                      <button onClick={()=>{setEditGoal(g.id);setGoalForm({name:g.name,target:String(g.target),saved:String(g.saved)});window.scrollTo(0,0);}} style={{padding:"8px 10px",borderRadius:10,background:"transparent",border:`1px solid ${P.cardBorder}`,color:P.textSub,fontSize:13,cursor:"pointer"}}>✏️</button>
                      <button onClick={()=>setGoals(p=>p.filter(x=>x.id!==g.id))} style={{padding:"8px 10px",borderRadius:10,background:"rgba(248,113,113,0.1)",border:"none",color:P.expense,fontSize:13,cursor:"pointer"}}>✕</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── BUDGET ── */}
          {view==="settings" && subView==="budget" && (
            <div>
              <div style={{...s.card,marginBottom:16}}>
                <div style={s.cardTitle}>Define límites mensuales por categoría de gasto</div>
                <div style={{fontSize:12,color:P.textSub,marginBottom:12}}>Deja en 0 para no tener límite</div>
              </div>
              {expCats.map(cat=>{
                const spent=catSpend[cat]||0;
                const limit=budgets[cat]||0;
                const pct=limit>0?Math.min(100,Math.round((spent/limit)*100)):0;
                const over=limit>0&&spent>limit;
                return (
                  <div key={cat} style={s.card}>
                    <div style={s.cardRowSb}>
                      <span style={{fontWeight:600,color:P.text,fontSize:14}}>{cat}</span>
                      {limit>0&&<span style={{fontSize:12,color:over?P.expense:P.accent}}>{over?"⚠️ Excedido":pct+"%"}</span>}
                    </div>
                    <div style={{fontSize:12,color:P.textSub,marginBottom:8}}>Gastado: {fmtCOP(spent)}{limit>0?` / límite: ${fmtCOP(limit)}`:""}</div>
                    {limit>0&&<div style={{...s.progressBg,marginBottom:10}}><div style={{...s.progressBar,width:`${pct}%`,background:over?`linear-gradient(90deg,#dc2626,${P.expense})`:`linear-gradient(90deg,#059669,${P.income})`}}/></div>}
                    <div style={{display:"flex",gap:8}}>
                      <input type="text" inputMode="numeric" placeholder="Límite mensual..." defaultValue={limit?fmtMiles(limit):""} onChange={e=>{e.target.value=fmtMiles(e.target.value);}} style={{...s.input,flex:1,padding:"8px 10px",fontSize:13}} id={`bgt-${cat}`}/>
                      <button onClick={()=>saveBudget(cat,onlyDigits(document.getElementById(`bgt-${cat}`).value))} style={{padding:"8px 14px",borderRadius:10,background:"rgba(129,140,248,0.15)",border:`1px solid ${P.accent}`,color:P.accent,fontWeight:600,fontSize:13,cursor:"pointer"}}>Guardar</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── CATEGORIES ── */}
          {view==="settings" && subView==="categories" && (
            <div>
              <div style={s.card}>
                <div style={s.cardTitle}>Agregar nueva categoría</div>
                <div style={{display:"flex",gap:8,marginBottom:12}}>
                  {["expense","income"].map(t=>(
                    <button key={t} type="button" onClick={()=>setNewCat(c=>({...c,type:t}))}
                      style={{flex:1,padding:"9px",borderRadius:10,border:`1.5px solid ${newCat.type===t?(t==="income"?P.income:P.expense):P.cardBorder}`,background:newCat.type===t?(t==="income"?"rgba(52,211,153,0.1)":"rgba(248,113,113,0.1)"):"transparent",color:newCat.type===t?(t==="income"?P.income:P.expense):P.textSub,fontWeight:600,fontSize:13,cursor:"pointer"}}>
                      {t==="income"?"Ingreso":"Gasto"}
                    </button>
                  ))}
                </div>
                <div style={{display:"flex",gap:8}}>
                  <input style={{...s.input,flex:1,padding:"10px 12px"}} placeholder="Nombre de categoría..." value={newCat.name} onChange={e=>setNewCat(c=>({...c,name:e.target.value}))} onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();addCategory();}}}/>
                  <button onClick={addCategory} style={{padding:"10px 16px",borderRadius:12,background:`rgba(129,140,248,0.15)`,border:`1px solid ${P.accent}`,color:P.accent,fontWeight:700,fontSize:16,cursor:"pointer"}}>+</button>
                </div>
              </div>

              {[["expense","▼ Gastos",P.expense,expCats],["income","▲ Ingresos",P.income,incCats]].map(([type,label,color,cats])=>(
                <div key={type} style={s.card}>
                  <div style={{...s.cardTitle,color:color}}>{label}</div>
                  {cats.map((cat,i)=>(
                    <div key={cat} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"9px 0",borderBottom:i<cats.length-1?`1px solid ${P.cardBorder}`:"none"}}>
                      <span style={{fontSize:14,color:P.text}}>{cat}</span>
                      <button onClick={()=>deleteCategory(type,cat)} style={{background:"rgba(248,113,113,0.1)",border:"none",color:P.expense,borderRadius:8,padding:"4px 10px",cursor:"pointer",fontSize:12}}>✕</button>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}

          {/* ── CREDIT ── */}
          {view==="credit" && (
            <div>
              {accHead("cards","👛","Cuentas y tarjetas")}

              {/* CARDS TAB */}
              {creditTab==="cards" && (
                <div>
                  {(showCardForm || editCard!==null) && (
                  <form onSubmit={e=>{
                    e.preventDefault();
                    const data={...cardForm,limit:parseFloat(cardForm.limit)||0,used:parseFloat(cardForm.used)||0};
                    if(editCard!==null){ setCards(prev=>prev.map(c=>c.id===editCard?{...data,id:editCard}:c)); setEditCard(null); }
                    else { setCards(prev=>[...prev,{...data,id:nextId}]); setNextId(n=>n+1); }
                    setCardForm({bank:"",name:"",type:"credito",limit:"",used:"",color:"#818cf8",logo:""}); setShowCardForm(false);
                  }} style={{...s.card,marginBottom:16}}>
                    <div style={s.cardTitle}>{editCard!==null?"Editar":"Nueva cuenta / tarjeta"}</div>
                    <div style={s.fieldGroup}><label style={s.label}>Nombre / alias</label><input style={s.input} placeholder="Visa Oro, Cuenta Ahorros..." value={cardForm.name} onChange={e=>setCardForm(f=>({...f,name:e.target.value}))} required/></div>
                    <div style={s.fieldGroup}><label style={s.label}>Tipo</label>
                      <div style={{display:"flex",gap:8}}>
                        {[["efectivo","Efectivo"],["credito","Crédito"],["debito","Débito"],["ahorros","Ahorros"]].map(([v,l])=>(
                          <button key={v} type="button" onClick={()=>setCardForm(f=>({...f,type:v}))} style={{flex:1,padding:"9px",borderRadius:10,border:`1.5px solid ${cardForm.type===v?P.accent:P.cardBorder}`,background:cardForm.type===v?"rgba(129,140,248,0.1)":"transparent",color:cardForm.type===v?P.accent:P.textSub,fontWeight:600,fontSize:12,cursor:"pointer"}}>{l}</button>
                        ))}
                      </div>
                    </div>
                    <div style={s.fieldGroup}><label style={s.label}>Banco {cardForm.type==="efectivo"&&<span style={{color:P.textSub}}>(opcional)</span>}</label><input style={s.input} placeholder={cardForm.type==="efectivo"?"Efectivo, Billetera...":"Bancolombia, Nequi..."} value={cardForm.bank} onChange={e=>setCardForm(f=>({...f,bank:e.target.value}))} required={cardForm.type!=="efectivo"}/></div>
                    <div style={s.fieldGroup}><label style={s.label}>Logo — elige o sube el tuyo</label>
                      <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:8}}>
                        {BANK_LOGOS.map(b=>(
                          <button key={b.id} type="button" title={b.label} onClick={()=>setCardForm(f=>({...f,logo:b.id}))}
                            style={{aspectRatio:"1",borderRadius:12,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,fontSize:17,background:b.bg,color:b.fg,border:cardForm.logo===b.id?"2.5px solid #fff":"2.5px solid transparent",cursor:"pointer"}}>{b.t}</button>
                        ))}
                        <label style={{aspectRatio:"1",borderRadius:12,display:"flex",alignItems:"center",justifyContent:"center",overflow:"hidden",border:`1.5px dashed ${P.accent}`,color:P.accent,cursor:"pointer",fontSize:18}}>
                          {(cardForm.logo&&cardForm.logo.startsWith("data:"))?<img src={cardForm.logo} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>:"⬆"}
                          <input type="file" accept="image/*" style={{display:"none"}} onChange={onLogoUpload}/>
                        </label>
                      </div>
                      <div style={{fontSize:11,color:P.textSub,marginTop:6}}>El último cuadro (⬆) sube tu propia imagen. Se guarda dentro de la app.</div>
                    </div>
                    {cardForm.type==="credito"&&<div style={s.fieldGroup}><label style={s.label}>Cupo total (COP)</label><input style={s.input} type="text" inputMode="numeric" placeholder="0" value={fmtMiles(cardForm.limit)} onChange={e=>setCardForm(f=>({...f,limit:onlyDigits(e.target.value)}))}/></div>}
                    <div style={s.fieldGroup}><label style={s.label}>{cardForm.type==="credito"?"Cupo usado (COP)":"Saldo actual (COP)"}</label><input style={s.input} type="text" inputMode="numeric" placeholder="0" value={fmtMiles(cardForm.used)} onChange={e=>setCardForm(f=>({...f,used:onlyDigits(e.target.value)}))}/></div>
                    <div style={s.fieldGroup}><label style={s.label}>Color de identificación</label>
                      <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                        {["#818cf8","#34d399","#f87171","#fbbf24","#60a5fa","#f472b6","#fb923c"].map(c=>(
                          <button key={c} type="button" onClick={()=>setCardForm(f=>({...f,color:c}))} style={{width:28,height:28,borderRadius:"50%",background:c,border:cardForm.color===c?"3px solid #fff":"3px solid transparent",cursor:"pointer"}}/>
                        ))}
                      </div>
                    </div>
                    <button type="submit" style={{...s.submitBtn("income"),background:`linear-gradient(135deg,#6d28d9,${P.accent})`}}>{editCard!==null?"Guardar":"Agregar"}</button>
                    <button type="button" onClick={()=>{setShowCardForm(false);setEditCard(null);setCardForm({bank:"",name:"",type:"credito",limit:"",used:"",color:"#818cf8",logo:""});}} style={{...s.submitBtn("expense"),marginTop:8,background:"transparent",border:`1px solid ${P.cardBorder}`,color:P.textSub}}>Cancelar</button>
                    {editCard!==null && <button type="button" onClick={()=>{ if(window.confirm("¿Eliminar esta cuenta/tarjeta? Se pierde su saldo registrado.")){ setCards(p=>p.filter(x=>x.id!==editCard)); setEditCard(null); setShowCardForm(false); setCardForm({bank:"",name:"",type:"credito",limit:"",used:"",color:"#818cf8",logo:""}); } }} style={{...s.submitBtn("expense"),marginTop:8,background:"rgba(248,113,113,0.08)",color:P.expense,boxShadow:"none"}}>Eliminar</button>}
                  </form>
                  )}

                  {/* Grupo: Cuentas de dinero */}
                  <div style={s.card}>
                    <div style={s.cardTitle}>Cuentas de dinero</div>
                    {accounts.length===0 ? <div style={{fontSize:12,color:P.textSub,marginBottom:12}}>Aún no tienes cuentas de dinero.</div> :
                      accounts.map(a=>(
                        <button key={a.id} onClick={()=>{setEditCard(a.id);setShowCardForm(true);setCardForm({bank:a.bank||"",name:a.name,type:a.type,limit:String(a.limit||""),used:String(a.used||""),color:a.color||"#818cf8",logo:a.logo||""});window.scrollTo(0,0);}}
                          style={{width:"100%",display:"flex",alignItems:"center",gap:11,background:"transparent",border:"none",borderBottom:`1px solid ${P.cardBorder}`,padding:"11px 0",cursor:"pointer",textAlign:"left"}}>
                          {renderLogo(a,38)}
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{fontSize:14,fontWeight:650,color:P.text}}>{a.name}</div>
                            <div style={{fontSize:11.5,color:P.textSub}}>{a.bank?`${a.bank} · `:""}{a.type==="efectivo"?"Efectivo":a.type==="debito"?"Débito":"Ahorros"}</div>
                          </div>
                          <div style={{color:P.income,fontWeight:700,fontSize:14,fontVariantNumeric:"tabular-nums"}}>{fmtCOP(a.used||0)}</div>
                          <span style={{color:P.muted,fontSize:16,marginLeft:2}}>›</span>
                        </button>
                      ))
                    }
                    <button onClick={()=>{setEditCard(null);setCardForm({bank:"",name:"",type:"efectivo",limit:"",used:"",color:"#fbbf24",logo:"efectivo"});setShowCardForm(true);window.scrollTo(0,0);}}
                      style={{width:"100%",marginTop:12,border:`1.5px dashed ${P.cardBorder}`,background:"transparent",color:P.accent,borderRadius:14,padding:"11px",fontSize:13,fontWeight:600,cursor:"pointer"}}>＋ Agregar cuenta</button>
                  </div>

                  {/* Grupo: Tarjetas de crédito */}
                  <div style={s.card}>
                    <div style={s.cardTitle}>Tarjetas de crédito</div>
                    {creditOnly.length===0 ? <div style={{fontSize:12,color:P.textSub,marginBottom:12}}>Aún no tienes tarjetas de crédito.</div> :
                      creditOnly.map(c=>{
                        const pct=c.limit>0?Math.round((c.used/c.limit)*100):0;
                        const col=pct<=30?P.income:pct<=60?P.loan:P.expense;
                        return (
                          <button key={c.id} onClick={()=>{setEditCard(c.id);setShowCardForm(true);setCardForm({bank:c.bank||"",name:c.name,type:c.type,limit:String(c.limit||""),used:String(c.used||""),color:c.color||"#818cf8",logo:c.logo||""});window.scrollTo(0,0);}}
                            style={{width:"100%",display:"flex",flexDirection:"column",gap:8,background:"transparent",border:"none",borderBottom:`1px solid ${P.cardBorder}`,padding:"12px 0",cursor:"pointer",textAlign:"left"}}>
                            <div style={{display:"flex",alignItems:"center",gap:11,width:"100%"}}>
                              {renderLogo(c,38)}
                              <div style={{flex:1,minWidth:0}}>
                                <div style={{fontSize:14,fontWeight:650,color:P.text}}>{c.name}</div>
                                <div style={{fontSize:11.5,color:P.textSub}}>{c.bank?`${c.bank} · `:""}<span style={{color:col,fontWeight:700}}>{pct}% usado</span></div>
                              </div>
                              <div style={{textAlign:"right"}}>
                                <div style={{color:P.expense,fontWeight:700,fontSize:14,fontVariantNumeric:"tabular-nums"}}>{fmtCOP(c.used)}</div>
                                <div style={{fontSize:11,color:P.textSub}}>de {fmtCOP(c.limit)}</div>
                              </div>
                            </div>
                            {c.limit>0&&<div style={{...s.progressBg,width:"100%"}}><div style={{...s.progressBar,width:`${pct}%`,background:pct<=30?`linear-gradient(90deg,#059669,#34d399)`:pct<=60?`linear-gradient(90deg,#b45309,#fbbf24)`:`linear-gradient(90deg,#dc2626,#f87171)`}}/></div>}
                          </button>
                        );
                      })
                    }
                    <button onClick={()=>{setEditCard(null);setCardForm({bank:"",name:"",type:"credito",limit:"",used:"",color:"#818cf8",logo:""});setShowCardForm(true);window.scrollTo(0,0);}}
                      style={{width:"100%",marginTop:12,border:`1.5px dashed ${P.cardBorder}`,background:"transparent",color:P.accent,borderRadius:14,padding:"11px",fontSize:13,fontWeight:600,cursor:"pointer"}}>＋ Agregar tarjeta</button>
                  </div>

                  {/* Compras a crédito — cuotas pendientes */}
                  {creditPlans.filter(p=>p.cuotasPaid<p.cuotas).length>0 && (
                    <div style={{...s.card,marginTop:4}}>
                      <div style={s.cardTitle}>Compras a crédito · cuotas pendientes</div>
                      {creditPlans.filter(p=>p.cuotasPaid<p.cuotas).map(p=>{
                        const card=cards.find(c=>c.id===p.cardId);
                        const last=p.cuotasPaid+1===p.cuotas;
                        const nextPay=last?Math.max(0,p.total-p.cuotaAmount*(p.cuotas-1)):p.cuotaAmount;
                        const paidAmt=p.total-Math.max(0,p.total-p.cuotaAmount*p.cuotasPaid);
                        const src=(payAcct[p.id]!==undefined?payAcct[p.id]:(accounts[0]&&accounts[0].id));
                        return (
                          <div key={p.id} style={{borderTop:`1px solid ${P.cardBorder}`,paddingTop:12,marginTop:12}}>
                            <div style={s.cardRowSb}>
                              <span style={{fontSize:14,fontWeight:600,color:P.text}}>{p.note||p.category}</span>
                              <div style={{display:"flex",alignItems:"center",gap:8}}>
                                <span style={{fontSize:12,color:P.loan,fontWeight:700}}>{p.cuotasPaid}/{p.cuotas}</span>
                                <button onClick={()=>{if(window.confirm(`¿Cancelar esta compra a crédito? Se libera el cupo de las cuotas sin pagar (${fmtCOP(Math.max(0,p.total-p.cuotaAmount*p.cuotasPaid))}).`)) deleteCreditPlan(p);}} title="Cancelar compra" style={{background:"rgba(248,113,113,0.1)",border:"none",color:P.expense,borderRadius:8,padding:"3px 8px",cursor:"pointer",fontSize:12}}>✕</button>
                              </div>
                            </div>
                            <div style={{fontSize:11,color:P.textSub,marginBottom:6}}>{card?`💳 ${card.name} · `:""}Total {fmtCOP(p.total)} · pagado {fmtCOP(p.cuotaAmount*p.cuotasPaid)}</div>
                            <div style={{...s.progressBg,marginBottom:10}}><div style={{...s.progressBar,width:`${Math.round((p.cuotasPaid/p.cuotas)*100)}%`,background:`linear-gradient(90deg,#6d28d9,${P.accent})`}}/></div>
                            {accounts.length===0 ? (
                              <div style={{fontSize:11,color:P.expense}}>Crea una cuenta (Efectivo/Débito) para poder pagar la cuota.</div>
                            ) : (
                              <>
                                <div style={{display:"flex",justifyContent:"flex-end",marginBottom:6}}>
                                  <button onClick={()=>setPaySplitOn(m=>({...m,[p.id]:!m[p.id]}))} style={{background:"none",border:"none",color:P.accent,fontSize:11,fontWeight:600,cursor:"pointer",padding:0,textDecoration:"underline"}}>
                                    {paySplitOn[p.id]?"Pagar con una sola cuenta":"Dividir este pago"}
                                  </button>
                                </div>
                                {paySplitOn[p.id] ? (
                                  <>
                                    <PaymentSplitter total={nextPay} cards={accounts} value={paySplits[p.id]||[]} onChange={v=>setPaySplits(m=>({...m,[p.id]:v}))} P={P} mode="out"/>
                                    <button onClick={()=>{payCreditCuota(p, paySplits[p.id]||[]); setPaySplits(m=>({...m,[p.id]:[]}));}}
                                      style={{width:"100%",padding:"10px",borderRadius:10,border:"none",background:`linear-gradient(135deg,#6d28d9,${P.accent})`,color:"#fff",fontWeight:700,fontSize:13,cursor:"pointer",marginTop:10}}>
                                      Pagar cuota {p.cuotasPaid+1} · {fmtCOP(nextPay)}
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:10,alignItems:"center"}}>
                                      <span style={{fontSize:11,color:P.textSub}}>Pagar desde:</span>
                                      {accounts.map(a=>(
                                        <button key={a.id} onClick={()=>setPayAcct(m=>({...m,[p.id]:a.id}))}
                                          style={{padding:"4px 9px",borderRadius:16,border:`1.5px solid ${src===a.id?P.accent:P.cardBorder}`,background:src===a.id?"rgba(129,140,248,0.13)":"transparent",color:src===a.id?P.accent:P.textSub,fontSize:11,fontWeight:600,cursor:"pointer"}}>{a.name} · {fmtCOP(a.used||0)}</button>
                                      ))}
                                    </div>
                                    <button onClick={()=>payCreditCuota(p, src)}
                                      style={{width:"100%",padding:"10px",borderRadius:10,border:"none",background:`linear-gradient(135deg,#6d28d9,${P.accent})`,color:"#fff",fontWeight:700,fontSize:13,cursor:"pointer"}}>
                                      Pagar cuota {p.cuotasPaid+1} · {fmtCOP(nextPay)}
                                    </button>
                                  </>
                                )}
                              </>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {accHead("score","📊","Score de crédito")}
              {/* SCORE TAB */}
              {creditTab==="score" && (
                <div>
                  {cards.length===0?(
                    <div style={s.empty}>Agrega tus tarjetas primero</div>
                  ):(
                    <>
                      {/* Semáforo */}
                      <div style={{background:"linear-gradient(135deg,#1a1a2e,#16213e)",border:`2px solid ${scoreColor}`,borderRadius:20,padding:"24px 20px",marginBottom:14,textAlign:"center"}}>
                        <div style={{fontSize:48,marginBottom:8}}>{utilPct<=10?"🟢":utilPct<=30?"🟢":utilPct<=50?"🟡":utilPct<=75?"🟠":"🔴"}</div>
                        <div style={{fontSize:26,fontWeight:800,color:scoreColor,marginBottom:4}}>{creditScore}</div>
                        <div style={{fontSize:13,color:P.textSub,marginBottom:16}}>Utilizas el {utilPct}% de tu cupo total</div>
                        <div style={{...s.progressBg,height:10,marginBottom:8}}>
                          <div style={{...s.progressBar,width:`${utilPct}%`,height:"100%",background:utilPct<=30?`linear-gradient(90deg,#059669,#34d399)`:utilPct<=60?`linear-gradient(90deg,#b45309,#fbbf24)`:`linear-gradient(90deg,#dc2626,#f87171)`}}/>
                        </div>
                        <div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:P.muted}}>
                          <span>0% Óptimo</span><span>30% Límite recomendado</span><span>100%</span>
                        </div>
                      </div>

                      {/* Por tarjeta */}
                      {cards.filter(c=>c.type==="credito").map(c=>{
                        const p=c.limit>0?Math.round((c.used/c.limit)*100):0;
                        const col=p<=30?P.income:p<=60?P.loan:P.expense;
                        return(
                          <div key={c.id} style={{...s.card,borderLeft:`4px solid ${c.color}`}}>
                            <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
                              <span style={{fontWeight:600,color:P.text}}>{c.name} — {c.bank}</span>
                              <span style={{color:col,fontWeight:700}}>{p}%</span>
                            </div>
                            <div style={s.progressBg}>
                              <div style={{...s.progressBar,width:`${p}%`,background:col}}/>
                            </div>
                            <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:P.textSub,marginTop:4}}>
                              <span>Usado: {fmtCOP(c.used)}</span><span>Disponible: {fmtCOP(Math.max(0,c.limit-c.used))}</span>
                            </div>
                          </div>
                        );
                      })}

                      {/* Guía semáforo */}
                      <div style={s.card}>
                        <div style={s.cardTitle}>Guía de utilización</div>
                        {[["🟢","0% – 10%","Excelente. Impacto muy positivo en tu historial.",P.income],["🟢","11% – 30%","Bueno. Zona recomendada por expertos.",P.income],["🟡","31% – 50%","Regular. Empieza a afectar tu score.",P.loan],["🟠","51% – 75%","Malo. Reducir urgente.",P.expense],["🔴","76% – 100%","Crítico. Riesgo de mora y bloqueo de cupo.",P.expense]].map(([e,r,d,c])=>(
                          <div key={r} style={{display:"flex",gap:10,padding:"8px 0",borderBottom:`1px solid ${P.cardBorder}`}}>
                            <span style={{fontSize:18}}>{e}</span>
                            <div><div style={{fontSize:13,fontWeight:600,color:c}}>{r}</div><div style={{fontSize:11,color:P.textSub}}>{d}</div></div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}

              {accHead("tips","🤖","Consejos IA")}
              {/* TIPS IA TAB */}
              {creditTab==="tips" && (
                <div>
                  <div style={s.card}>
                    <div style={s.cardTitle}>Análisis IA de tu vida crediticia</div>
                    <div style={{fontSize:13,color:P.textSub,marginBottom:14}}>Claude analiza tus tarjetas y gastos recientes para darte consejos personalizados.</div>
                    <button onClick={getAiCreditTip} disabled={aiLoading} style={{...s.submitBtn("income"),background:`linear-gradient(135deg,#6d28d9,${P.accent})`,opacity:aiLoading?0.7:1}}>
                      {aiLoading?"⏳ Analizando...":"✨ Analizar mi situación"}
                    </button>
                  </div>

                  {aiTip&&(
                    <>
                      <div style={{background:"linear-gradient(135deg,#1a1a2e,#16213e)",border:`1px solid ${P.accent}`,borderRadius:16,padding:16,marginBottom:14}}>
                        <div style={{fontSize:11,color:P.accent,fontWeight:700,letterSpacing:0.8,textTransform:"uppercase",marginBottom:8}}>Diagnóstico IA</div>
                        <div style={{fontSize:16,fontWeight:700,color:P.text,marginBottom:6}}>{aiTip.score}</div>
                        <div style={{fontSize:13,color:P.textSub}}>{aiTip.resumen}</div>
                      </div>

                      {aiTip.alertas?.length>0&&(
                        <div style={{...s.card,borderColor:"rgba(248,113,113,0.4)",background:"rgba(248,113,113,0.05)"}}>
                          <div style={{...s.cardTitle,color:P.expense}}>⚠️ Alertas</div>
                          {aiTip.alertas.map((a,i)=><div key={i} style={{fontSize:13,color:P.text,padding:"6px 0",borderBottom:`1px solid ${P.cardBorder}`}}>• {a}</div>)}
                        </div>
                      )}

                      <div style={s.card}>
                        <div style={s.cardTitle}>💡 Consejos</div>
                        {aiTip.consejos?.map((c,i)=>(
                          <div key={i} style={{display:"flex",gap:10,padding:"10px 0",borderBottom:`1px solid ${P.cardBorder}`}}>
                            <span style={{color:P.accent,fontWeight:700,fontSize:14}}>{i+1}.</span>
                            <span style={{fontSize:13,color:P.text}}>{c}</span>
                          </div>
                        ))}
                      </div>

                      {aiTip.pagoSugerido&&(
                        <div style={{...s.card,borderColor:"rgba(52,211,153,0.3)"}}>
                          <div style={{...s.cardTitle,color:P.income}}>💰 Pago sugerido</div>
                          <div style={{fontSize:13,color:P.text}}>{aiTip.pagoSugerido}</div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {accHead("recurring","🔁","Recurrentes")}
              {/* RECURRING TAB */}
              {creditTab==="recurring" && (                <div>
                  <form onSubmit={e=>{
                    e.preventDefault();
                    if(!recurForm.amount||!recurForm.category)return;
                    setRecurringTx(prev=>[...prev,{...recurForm,amount:parseFloat(recurForm.amount),id:nextId,lastMonth:null}]);
                    setNextId(n=>n+1);
                    setRecurForm({type:"expense",amount:"",category:"",note:"",dayOfMonth:"1",account:""});
                  }} style={{...s.card,marginBottom:16}}>
                    <div style={s.cardTitle}>Nuevo gasto / ingreso recurrente</div>
                    <div style={s.toggleRow}>
                      {["expense","income"].map(t=>(
                        <button key={t} type="button" onClick={()=>setRecurForm(f=>({...f,type:t,category:""}))} style={s.toggleBtn(recurForm.type===t,t)}>
                          {t==="income"?"▲ Ingreso":"▼ Gasto"}
                        </button>
                      ))}
                    </div>
                    <div style={s.fieldGroup}><label style={s.label}>Monto (COP)</label><input style={s.input} type="text" inputMode="numeric" placeholder="0" value={fmtMiles(recurForm.amount)} onChange={e=>setRecurForm(f=>({...f,amount:onlyDigits(e.target.value)}))} required/></div>
                    <div style={s.fieldGroup}><label style={s.label}>Categoría</label>
                      <CustomSelect
                        value={recurForm.category}
                        onChange={e=>setRecurForm(f=>({...f,category:e.target.value}))}
                        options={(recurForm.type==="expense"?expCats:incCats)}
                        placeholder="Seleccionar..."
                        P={P}
                      />
                    </div>
                    <div style={s.fieldGroup}><label style={s.label}>Nota</label><input style={s.input} placeholder="Netflix, Arriendo..." value={recurForm.note} onChange={e=>setRecurForm(f=>({...f,note:e.target.value}))}/></div>
                    {accounts.length>0 && (
                      <div style={s.fieldGroup}><label style={s.label}>Cuenta ({recurForm.type==="income"?"entra a":"sale de"})</label>
                        <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
                          {accounts.map(a=>(
                            <button key={a.id} type="button" onClick={()=>setRecurForm(f=>({...f,account:f.account===a.id?"":a.id}))}
                              style={{padding:"7px 12px",borderRadius:20,border:`1.5px solid ${recurForm.account===a.id?P.accent:P.cardBorder}`,background:recurForm.account===a.id?"rgba(129,140,248,0.13)":"transparent",color:recurForm.account===a.id?P.accent:P.textSub,fontSize:12,fontWeight:600,cursor:"pointer",display:"flex",alignItems:"center",gap:6}}>
                              <span style={{width:8,height:8,borderRadius:"50%",background:a.color||P.accent}}/>{a.name}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    <div style={s.fieldGroup}><label style={s.label}>Día del mes que se aplica</label><input style={s.input} type="number" min="1" max="28" value={recurForm.dayOfMonth} onChange={e=>setRecurForm(f=>({...f,dayOfMonth:e.target.value}))}/></div>
                    <button type="submit" style={s.submitBtn("expense")}>Agregar recurrente</button>
                  </form>

                  <button onClick={applyRecurring} style={{...s.accentBtn,width:"100%",marginBottom:14,padding:"12px"}}>🔁 Aplicar recurrentes de este mes</button>

                  {recurringTx.length===0?<div style={s.empty}>Sin gastos recurrentes</div>:recurringTx.map(r=>{
                    const thisMonth=`${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,"0")}`;
                    const applied=r.lastMonth===thisMonth;
                    return(
                      <div key={r.id} style={{...s.card,borderLeft:`4px solid ${r.type==="income"?P.income:P.expense}`}}>
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                          <div>
                            <div style={{fontWeight:600,color:P.text,fontSize:14}}>{r.note||r.category}</div>
                            <div style={{fontSize:12,color:P.textSub}}>Día {r.dayOfMonth} · {r.category}</div>
                          </div>
                          <div style={{textAlign:"right"}}>
                            <div style={{color:r.type==="income"?P.income:P.expense,fontWeight:700}}>{r.type==="income"?"+":"-"}{fmtCOP(r.amount)}</div>
                            <div style={{fontSize:11,color:applied?P.income:P.muted}}>{applied?"✓ Aplicado este mes":"Pendiente"}</div>
                          </div>
                        </div>
                        <button onClick={()=>setRecurringTx(p=>p.filter(x=>x.id!==r.id))} style={{marginTop:10,width:"100%",padding:"7px",borderRadius:10,background:"rgba(248,113,113,0.08)",border:"none",color:P.expense,fontSize:12,cursor:"pointer"}}>Eliminar recurrente</button>
                      </div>
                    );
                  })}
                </div>
              )}

              {accHead("loans","💸","Préstamos")}
              {/* LOANS SUB-TAB */}
              {creditTab==="loans" && (
                <div>
                  <form onSubmit={addLoan} style={{...s.card,marginBottom:16}}>
                    <div style={s.cardTitle}>{editLoan!==null?"Editar préstamo":"Nuevo préstamo"}</div>
                    <div style={s.fieldGroup}><label style={s.label}>¿A quién le presté?</label>
                      <input style={s.input} placeholder="Nombre del deudor" value={loanForm.debtor} onChange={e=>setLoanForm(f=>({...f,debtor:e.target.value}))} required/>
                    </div>
                    <div style={s.fieldGroup}><label style={s.label}>Monto prestado (COP)</label>
                      <input style={s.input} type="text" inputMode="numeric" placeholder="0" value={fmtMiles(loanForm.amount)} onChange={e=>setLoanForm(f=>({...f,amount:onlyDigits(e.target.value)}))} required/>
                    </div>
                    {accounts.length>0 && (
                      <div style={s.fieldGroup}>
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                          <label style={{...s.label,marginBottom:0}}>¿De qué cuenta sale?</label>
                          {editLoan===null && (
                            <button type="button" onClick={()=>setLoanForm(f=>({...f,useSplit:!f.useSplit,account:"",splits:f.useSplit?[]:[{accountId:"",amount:parseFloat(f.amount)||0}]}))}
                              style={{background:"none",border:"none",color:P.accent,fontSize:11,fontWeight:600,cursor:"pointer",padding:0,textDecoration:"underline"}}>
                              {loanForm.useSplit?"Usar una sola cuenta":"Dividir entre varias cuentas"}
                            </button>
                          )}
                        </div>
                        {loanForm.useSplit ? (
                          <PaymentSplitter total={parseFloat(loanForm.amount)||0} cards={accounts} value={loanForm.splits} onChange={splits=>setLoanForm(f=>({...f,splits}))} P={P} mode="out"/>
                        ) : (
                          <>
                            <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
                              {accounts.map(a=>(
                                <button key={a.id} type="button" onClick={()=>setLoanForm(f=>({...f,account:f.account===a.id?"":a.id}))}
                                  style={{padding:"7px 12px",borderRadius:20,border:`1.5px solid ${loanForm.account===a.id?P.accent:P.cardBorder}`,background:loanForm.account===a.id?"rgba(129,140,248,0.13)":"transparent",color:loanForm.account===a.id?P.accent:P.textSub,fontSize:12,fontWeight:600,cursor:"pointer",display:"flex",alignItems:"center",gap:6}}>
                                  <span style={{width:8,height:8,borderRadius:"50%",background:a.color||P.accent}}/>{a.name} · {fmtCOP(a.used||0)}
                                </button>
                              ))}
                            </div>
                            {editLoan===null && <div style={{fontSize:11,color:P.textSub,marginTop:6}}>Se descontará el monto prestado de esa cuenta.</div>}
                          </>
                        )}
                      </div>
                    )}
                    <div style={s.fieldGroup}><label style={s.label}>Tasa de interés (%)</label>
                      <input style={s.input} type="number" placeholder="0" step="0.01" value={loanForm.interest} onChange={e=>setLoanForm(f=>({...f,interest:e.target.value}))}/>
                    </div>
                    <div style={s.fieldGroup}><label style={s.label}>Tipo de interés</label>
                      <div style={{display:"flex",gap:8}}>
                        {["simple","compound"].map(t=>(
                          <button key={t} type="button" onClick={()=>setLoanForm(f=>({...f,interestType:t}))}
                            style={{flex:1,padding:"10px",borderRadius:10,border:`1.5px solid ${loanForm.interestType===t?P.loan:P.cardBorder}`,background:loanForm.interestType===t?"rgba(251,191,36,0.1)":"transparent",color:loanForm.interestType===t?P.loan:P.textSub,fontWeight:600,fontSize:13,cursor:"pointer"}}>
                            {t==="simple"?"Simple":"Compuesto"}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div style={s.fieldGroup}><label style={s.label}>Plazo (meses)</label>
                      <input style={s.input} type="number" placeholder="1" value={loanForm.months} onChange={e=>setLoanForm(f=>({...f,months:e.target.value}))}/>
                    </div>
                    <div style={s.fieldGroup}><label style={s.label}>Fecha</label>
                      <input style={s.input} type="date" value={loanForm.date} onChange={e=>setLoanForm(f=>({...f,date:e.target.value}))}/>
                    </div>
                    <div style={s.fieldGroup}><label style={s.label}>Nota (opcional)</label>
                      <input style={s.input} placeholder="Motivo del préstamo..." value={loanForm.note} onChange={e=>setLoanForm(f=>({...f,note:e.target.value}))}/>
                    </div>
                    {loanForm.amount&&parseFloat(loanForm.amount)>0&&(()=>{
                      const preview=calcLoan({...loanForm,amount:parseFloat(loanForm.amount)||0,interest:parseFloat(loanForm.interest)||0,months:parseInt(loanForm.months)||1});
                      return (
                        <div style={{background:"rgba(251,191,36,0.07)",border:`1px solid rgba(251,191,36,0.2)`,borderRadius:12,padding:"12px 14px",marginBottom:14}}>
                          <div style={{fontSize:12,color:P.loan,fontWeight:600,marginBottom:8}}>Vista previa</div>
                          {[["Capital",fmtCOP(parseFloat(loanForm.amount)||0)],["Interés total",fmtCOP(preview.interest)],["Total a recibir",fmtCOP(preview.total)],["Cuota mensual",fmtCOP(preview.monthly)]].map(([l,v])=>(
                            <div key={l} style={{display:"flex",justifyContent:"space-between",fontSize:13,padding:"3px 0"}}>
                              <span style={{color:P.textSub}}>{l}</span><span style={{color:P.text,fontWeight:600}}>{v}</span>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                    <button type="submit" style={{...s.submitBtn("income"),background:"linear-gradient(135deg,#b45309,#fbbf24)"}}>{editLoan!==null?"Guardar cambios":"Registrar préstamo"}</button>
                    {editLoan!==null&&<button type="button" onClick={()=>{setEditLoan(null);setLoanForm({debtor:"",amount:"",interest:"",interestType:"simple",months:"",date:today(),note:"",account:"",useSplit:false,splits:[]});}} style={{...s.submitBtn("expense"),marginTop:8,background:"transparent",border:`1px solid ${P.cardBorder}`,color:P.textSub}}>Cancelar</button>}
                  </form>
                  {loans.length===0?<div style={s.empty}>Sin préstamos registrados</div>:loans.map(l=>{
                    const {total,interest,monthly,schedule}=calcLoan(l);
                    const st=loanStatus(l);
                    const recvAcct=(receiveAcct[l.id]!==undefined?receiveAcct[l.id]:l.account);
                    const isExpanded=expandedLoan===l.id;
                    return(
                      <div key={l.id} style={{...s.card,borderColor:l.paid?"#2a3a2a":P.cardBorder,opacity:l.paid?0.65:1}}>
                        <div style={s.cardRowSb}>
                          <span style={{fontWeight:700,fontSize:16,color:P.text}}>{l.debtor}</span>
                          <span style={{fontSize:12,padding:"3px 10px",borderRadius:20,background:l.paid?"rgba(52,211,153,0.1)":"rgba(251,191,36,0.1)",color:l.paid?P.income:P.loan,fontWeight:600}}>{l.paid?"Pagado":"Pendiente"}</span>
                        </div>
                        {l.note&&<div style={{fontSize:12,color:P.textSub,marginBottom:10}}>{l.note}</div>}
                        <div style={{background:"rgba(251,191,36,0.06)",border:"1px solid rgba(251,191,36,0.15)",borderRadius:12,padding:"12px 14px",marginBottom:12}}>
                          <div style={{fontSize:11,color:P.loan,fontWeight:700,letterSpacing:0.8,textTransform:"uppercase",marginBottom:10}}>Resumen financiero</div>
                          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"10px 0"}}>
                            {[["💵 Capital",fmtCOP(l.amount),P.text],["📅 Plazo",`${l.months} mes(es)`,P.text],["📈 Tasa",`${l.interest}% ${l.interestType==="compound"?"comp.":"simple"}`,P.text],["💰 Cuota/mes",fmtCOP(monthly),P.loan],["🎁 Interés",fmtCOP(interest),P.income],["✅ Total",fmtCOP(total),P.income]].map(([lbl,val,col])=>(
                              <div key={lbl}><div style={{fontSize:10,color:P.textSub,marginBottom:2}}>{lbl}</div><div style={{fontSize:13,fontWeight:700,color:col}}>{val}</div></div>
                            ))}
                          </div>
                          <div style={{marginTop:12}}>
                            <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:P.textSub,marginBottom:4}}>
                              <span>Capital {Math.round((l.amount/total)*100)}%</span>
                              <span>Interés {Math.round((interest/total)*100)}%</span>
                            </div>
                            <div style={{height:6,borderRadius:999,background:P.cardBorder,overflow:"hidden",display:"flex"}}>
                              <div style={{width:`${(l.amount/total)*100}%`,background:"linear-gradient(90deg,#818cf8,#60a5fa)",borderRadius:"999px 0 0 999px"}}/>
                              <div style={{flex:1,background:"linear-gradient(90deg,#34d399,#059669)",borderRadius:"0 999px 999px 0"}}/>
                            </div>
                          </div>
                        </div>
                        {/* Cobros / abonos recibidos (monto libre) */}
                        <div style={{background:"rgba(52,211,153,0.05)",border:"1px solid rgba(52,211,153,0.15)",borderRadius:12,padding:"12px 14px",marginBottom:12}}>
                          <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:6}}>
                            <span style={{color:P.textSub}}>Recibido ({st.pct}%)</span>
                            <span style={{color:P.income,fontWeight:700}}>{fmtCOP(st.received)} / {fmtCOP(total)}</span>
                          </div>
                          <div style={{...s.progressBg,marginBottom:6}}><div style={{...s.progressBar,width:`${st.pct}%`,background:`linear-gradient(90deg,#059669,${P.income})`}}/></div>
                          <div style={{fontSize:11,color:P.textSub}}>Te deben {fmtCOP(st.totalOut)} · capital pendiente {fmtCOP(st.principalOut)}</div>
                          {!l.paid && st.totalOut>0 && (
                            <>
                              <div style={{marginTop:10}}>
                                <label style={{...s.label,marginBottom:6}}>¿Cuánto pagó?</label>
                                <input type="text" inputMode="numeric" placeholder={fmtMiles(st.suggested)+" (una cuota)"}
                                  value={receiveAmt[l.id]!==undefined?fmtMiles(receiveAmt[l.id]):""}
                                  onChange={e=>setReceiveAmt(m=>({...m,[l.id]:onlyDigits(e.target.value)}))}
                                  style={{...s.input,padding:"10px 12px",fontSize:14}}/>
                                <div style={{fontSize:10,color:P.textSub,marginTop:4}}>Déjalo vacío para una cuota. Puede pagar más o menos; el interés se reconoce proporcional.</div>
                              </div>
                              {accounts.length>0 && (
                                <div style={{display:"flex",justifyContent:"flex-end",marginTop:8}}>
                                  <button onClick={()=>setReceiveSplitOn(m=>({...m,[l.id]:!m[l.id]}))} style={{background:"none",border:"none",color:P.accent,fontSize:11,fontWeight:600,cursor:"pointer",padding:0,textDecoration:"underline"}}>
                                    {receiveSplitOn[l.id]?"Recibir en una sola cuenta":"Dividir entre varias cuentas"}
                                  </button>
                                </div>
                              )}
                              {receiveSplitOn[l.id] ? (
                                <>
                                  <PaymentSplitter total={parseFloat(onlyDigits(receiveAmt[l.id]))||st.suggested} cards={accounts} value={receiveSplits[l.id]||[]} onChange={v=>setReceiveSplits(m=>({...m,[l.id]:v}))} P={P} mode="in"/>
                                  <button onClick={()=>{receiveLoanPayment(l, receiveAmt[l.id], receiveSplits[l.id]||[]); setReceiveSplits(m=>({...m,[l.id]:[]}));}}
                                    style={{width:"100%",marginTop:10,padding:"10px",borderRadius:10,border:"none",background:`linear-gradient(135deg,#059669,${P.income})`,color:"#fff",fontWeight:700,fontSize:13,cursor:"pointer"}}>
                                    + Registrar pago recibido
                                  </button>
                                </>
                              ) : (
                                <>
                                  {accounts.length>0 && (
                                    <div style={{display:"flex",flexWrap:"wrap",gap:6,marginTop:10,alignItems:"center"}}>
                                      <span style={{fontSize:11,color:P.textSub}}>Recibir en:</span>
                                      {accounts.map(a=>(
                                        <button key={a.id} onClick={()=>setReceiveAcct(m=>({...m,[l.id]:a.id}))}
                                          style={{padding:"4px 9px",borderRadius:16,border:`1.5px solid ${recvAcct===a.id?P.accent:P.cardBorder}`,background:recvAcct===a.id?"rgba(129,140,248,0.13)":"transparent",color:recvAcct===a.id?P.accent:P.textSub,fontSize:11,fontWeight:600,cursor:"pointer"}}>{a.name} · {fmtCOP(a.used||0)}</button>
                                      ))}
                                    </div>
                                  )}
                                  <button onClick={()=>receiveLoanPayment(l, receiveAmt[l.id], recvAcct)}
                                    style={{width:"100%",marginTop:10,padding:"10px",borderRadius:10,border:"none",background:`linear-gradient(135deg,#059669,${P.income})`,color:"#fff",fontWeight:700,fontSize:13,cursor:"pointer"}}>
                                    + Registrar pago recibido
                                  </button>
                                </>
                              )}
                            </>
                          )}
                        </div>
                        <button onClick={()=>setExpandedLoan(isExpanded?null:l.id)}
                          style={{width:"100%",padding:"9px",borderRadius:10,border:`1px solid ${isExpanded?P.accent:P.cardBorder}`,background:isExpanded?"rgba(129,140,248,0.08)":"transparent",color:isExpanded?P.accent:P.textSub,fontWeight:600,fontSize:13,cursor:"pointer",marginBottom:isExpanded?12:0}}>
                          {isExpanded?"▲ Ocultar tabla":"▼ Ver tabla cuota a cuota"}
                        </button>
                        {isExpanded&&(
                          <div style={{overflowX:"auto"}}>
                            <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                              <thead><tr style={{borderBottom:`1px solid ${P.cardBorder}`}}>
                                {["Cuota","Interés","Total","Saldo"].map(h=>(
                                  <th key={h} style={{padding:"6px 4px",color:P.textSub,fontWeight:600,textAlign:"right"}}>{h}</th>
                                ))}
                              </tr></thead>
                              <tbody>
                                {schedule.map((row,i)=>(
                                  <tr key={i} style={{borderBottom:`1px solid rgba(42,42,58,0.5)`,background:i%2===0?"transparent":"rgba(255,255,255,0.015)"}}>
                                    <td style={{padding:"6px 4px",color:P.accent,fontWeight:700,textAlign:"right"}}>#{row.cuota}</td>
                                    <td style={{padding:"6px 4px",color:P.income,textAlign:"right"}}>{fmtCOP(row.interes)}</td>
                                    <td style={{padding:"6px 4px",color:P.loan,textAlign:"right"}}>{fmtCOP(row.cuotaTotal)}</td>
                                    <td style={{padding:"6px 4px",color:row.saldoPendiente===0?P.income:P.text,textAlign:"right"}}>{row.saldoPendiente===0?"✓":fmtCOP(row.saldoPendiente)}</td>
                                  </tr>
                                ))}
                              </tbody>
                              <tfoot><tr style={{borderTop:`2px solid ${P.cardBorder}`}}>
                                <td style={{padding:"6px 4px",color:P.textSub,fontSize:11,fontWeight:700}}>TOTAL</td>
                                <td style={{padding:"6px 4px",color:P.income,fontWeight:700,textAlign:"right"}}>{fmtCOP(interest)}</td>
                                <td style={{padding:"6px 4px",color:P.loan,fontWeight:700,textAlign:"right"}}>{fmtCOP(total)}</td>
                                <td style={{padding:"6px 4px",textAlign:"right"}}>—</td>
                              </tr></tfoot>
                            </table>
                          </div>
                        )}
                        <div style={{display:"flex",gap:8,marginTop:12}}>
                          {l.paid && <button onClick={()=>toggleLoanPaid(l.id)} style={{flex:1,padding:"9px",borderRadius:10,border:`1px solid ${P.cardBorder}`,background:"transparent",color:P.textSub,fontWeight:600,fontSize:13,cursor:"pointer"}}>↩ Reactivar</button>}
                          <button onClick={()=>{setEditLoan(l.id);setLoanForm({debtor:l.debtor,amount:String(l.amount),interest:String(l.interest),interestType:l.interestType,months:String(l.months),date:l.date,note:l.note||""});window.scrollTo(0,0);}} style={{padding:"9px 12px",borderRadius:10,border:`1px solid ${P.cardBorder}`,background:"transparent",color:P.textSub,fontSize:13,cursor:"pointer"}}>✏️</button>
                          <button onClick={()=>deleteLoan(l)} style={{padding:"9px 12px",borderRadius:10,background:"rgba(248,113,113,0.1)",border:"none",color:P.expense,fontSize:13,cursor:"pointer"}}>✕</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {accHead("debts","🙏","Deudas (te prestan a ti)")}
              {/* DEBTS SUB-TAB */}
              {creditTab==="debts" && (
                <div>
                  <form onSubmit={addDebt} style={{...s.card,marginBottom:16}}>
                    <div style={s.cardTitle}>{editDebt!==null?"Editar deuda":"Nueva deuda"}</div>
                    <div style={s.fieldGroup}><label style={s.label}>¿Quién te prestó?</label>
                      <input style={s.input} placeholder="Nombre de quien te prestó" value={debtForm.lender} onChange={e=>setDebtForm(f=>({...f,lender:e.target.value}))} required/>
                    </div>
                    <div style={s.fieldGroup}><label style={s.label}>Monto que te prestaron (COP)</label>
                      <input style={s.input} type="text" inputMode="numeric" placeholder="0" value={fmtMiles(debtForm.amount)} onChange={e=>setDebtForm(f=>({...f,amount:onlyDigits(e.target.value)}))} required/>
                    </div>
                    {accounts.length>0 && (
                      <div style={s.fieldGroup}>
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                          <label style={{...s.label,marginBottom:0}}>¿A qué cuenta entra?</label>
                          {editDebt===null && (
                            <button type="button" onClick={()=>setDebtForm(f=>({...f,useSplit:!f.useSplit,account:"",splits:f.useSplit?[]:[{accountId:"",amount:parseFloat(f.amount)||0}]}))}
                              style={{background:"none",border:"none",color:P.accent,fontSize:11,fontWeight:600,cursor:"pointer",padding:0,textDecoration:"underline"}}>
                              {debtForm.useSplit?"Usar una sola cuenta":"Dividir entre varias cuentas"}
                            </button>
                          )}
                        </div>
                        {debtForm.useSplit ? (
                          <PaymentSplitter total={parseFloat(debtForm.amount)||0} cards={accounts} value={debtForm.splits} onChange={splits=>setDebtForm(f=>({...f,splits}))} P={P} mode="in"/>
                        ) : (
                          <>
                            <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
                              {accounts.map(a=>(
                                <button key={a.id} type="button" onClick={()=>setDebtForm(f=>({...f,account:f.account===a.id?"":a.id}))}
                                  style={{padding:"7px 12px",borderRadius:20,border:`1.5px solid ${debtForm.account===a.id?P.accent:P.cardBorder}`,background:debtForm.account===a.id?"rgba(129,140,248,0.13)":"transparent",color:debtForm.account===a.id?P.accent:P.textSub,fontSize:12,fontWeight:600,cursor:"pointer",display:"flex",alignItems:"center",gap:6}}>
                                  <span style={{width:8,height:8,borderRadius:"50%",background:a.color||P.accent}}/>{a.name} · {fmtCOP(a.used||0)}
                                </button>
                              ))}
                            </div>
                            {editDebt===null && <div style={{fontSize:11,color:P.textSub,marginTop:6}}>Se sumará el monto prestado a esa cuenta.</div>}
                          </>
                        )}
                      </div>
                    )}
                    <div style={s.fieldGroup}><label style={s.label}>Tasa de interés (%)</label>
                      <input style={s.input} type="number" placeholder="0" step="0.01" value={debtForm.interest} onChange={e=>setDebtForm(f=>({...f,interest:e.target.value}))}/>
                    </div>
                    <div style={s.fieldGroup}><label style={s.label}>Tipo de interés</label>
                      <div style={{display:"flex",gap:8}}>
                        {["simple","compound"].map(t=>(
                          <button key={t} type="button" onClick={()=>setDebtForm(f=>({...f,interestType:t}))}
                            style={{flex:1,padding:"10px",borderRadius:10,border:`1.5px solid ${debtForm.interestType===t?P.expense:P.cardBorder}`,background:debtForm.interestType===t?"rgba(248,113,113,0.1)":"transparent",color:debtForm.interestType===t?P.expense:P.textSub,fontWeight:600,fontSize:13,cursor:"pointer"}}>
                            {t==="simple"?"Simple":"Compuesto"}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div style={s.fieldGroup}><label style={s.label}>Plazo (meses)</label>
                      <input style={s.input} type="number" placeholder="1" value={debtForm.months} onChange={e=>setDebtForm(f=>({...f,months:e.target.value}))}/>
                    </div>
                    <div style={s.fieldGroup}><label style={s.label}>Fecha</label>
                      <input style={s.input} type="date" value={debtForm.date} onChange={e=>setDebtForm(f=>({...f,date:e.target.value}))}/>
                    </div>
                    <div style={s.fieldGroup}><label style={s.label}>Nota (opcional)</label>
                      <input style={s.input} placeholder="Motivo de la deuda..." value={debtForm.note} onChange={e=>setDebtForm(f=>({...f,note:e.target.value}))}/>
                    </div>
                    {debtForm.amount&&parseFloat(debtForm.amount)>0&&(()=>{
                      const preview=calcLoan({...debtForm,amount:parseFloat(debtForm.amount)||0,interest:parseFloat(debtForm.interest)||0,months:parseInt(debtForm.months)||1});
                      return (
                        <div style={{background:"rgba(248,113,113,0.06)",border:`1px solid rgba(248,113,113,0.2)`,borderRadius:12,padding:"12px 14px",marginBottom:14}}>
                          <div style={{fontSize:12,color:P.expense,fontWeight:600,marginBottom:8}}>Vista previa</div>
                          {[["Capital",fmtCOP(parseFloat(debtForm.amount)||0)],["Interés total",fmtCOP(preview.interest)],["Total a pagar",fmtCOP(preview.total)],["Cuota mensual",fmtCOP(preview.monthly)]].map(([l,v])=>(
                            <div key={l} style={{display:"flex",justifyContent:"space-between",fontSize:13,padding:"3px 0"}}>
                              <span style={{color:P.textSub}}>{l}</span><span style={{color:P.text,fontWeight:600}}>{v}</span>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                    <button type="submit" style={{...s.submitBtn("expense")}}>{editDebt!==null?"Guardar cambios":"Registrar deuda"}</button>
                    {editDebt!==null&&<button type="button" onClick={()=>{setEditDebt(null);setDebtForm({lender:"",amount:"",interest:"",interestType:"simple",months:"",date:today(),note:"",account:"",useSplit:false,splits:[]});}} style={{...s.submitBtn("expense"),marginTop:8,background:"transparent",border:`1px solid ${P.cardBorder}`,color:P.textSub}}>Cancelar</button>}
                  </form>

                  {debts.length===0?<div style={s.empty}>Sin deudas registradas</div>:debts.map(d=>{
                    const {total,interest,monthly,schedule}=calcLoan(d);
                    const st=debtStatus(d);
                    const isExpanded=expandedDebt===d.id;
                    const src=(debtPayAcct[d.id]!==undefined?debtPayAcct[d.id]:d.account);
                    return(
                      <div key={d.id} style={{...s.card,borderColor:d.paid?"#2a3a2a":P.cardBorder,opacity:d.paid?0.65:1}}>
                        <div style={s.cardRowSb}>
                          <span style={{fontWeight:700,fontSize:16,color:P.text}}>{d.lender}</span>
                          <span style={{fontSize:12,padding:"3px 10px",borderRadius:20,background:d.paid?"rgba(52,211,153,0.1)":"rgba(248,113,113,0.1)",color:d.paid?P.income:P.expense,fontWeight:600}}>{d.paid?"Pagado":"Pendiente"}</span>
                        </div>
                        {d.note&&<div style={{fontSize:12,color:P.textSub,marginBottom:10}}>{d.note}</div>}
                        <div style={{background:"rgba(248,113,113,0.06)",border:"1px solid rgba(248,113,113,0.15)",borderRadius:12,padding:"12px 14px",marginBottom:12}}>
                          <div style={{fontSize:11,color:P.expense,fontWeight:700,letterSpacing:0.8,textTransform:"uppercase",marginBottom:10}}>Resumen financiero</div>
                          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"10px 0"}}>
                            {[["💵 Capital",fmtCOP(d.amount),P.text],["📅 Plazo",`${d.months} mes(es)`,P.text],["📈 Tasa",`${d.interest}% ${d.interestType==="compound"?"comp.":"simple"}`,P.text],["💰 Cuota/mes",fmtCOP(monthly),P.expense],["🎁 Interés",fmtCOP(interest),P.expense],["✅ Total a pagar",fmtCOP(total),P.expense]].map(([lbl,val,col])=>(
                              <div key={lbl}><div style={{fontSize:10,color:P.textSub,marginBottom:2}}>{lbl}</div><div style={{fontSize:13,fontWeight:700,color:col}}>{val}</div></div>
                            ))}
                          </div>
                        </div>
                        {/* Pagos hechos a quien te prestó */}
                        <div style={{background:"rgba(129,140,248,0.05)",border:"1px solid rgba(129,140,248,0.15)",borderRadius:12,padding:"12px 14px",marginBottom:12}}>
                          <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:6}}>
                            <span style={{color:P.textSub}}>Pagado ({st.pct}%)</span>
                            <span style={{color:P.accent,fontWeight:700}}>{fmtCOP(st.paidAmt)} / {fmtCOP(total)}</span>
                          </div>
                          <div style={{...s.progressBg,marginBottom:6}}><div style={{...s.progressBar,width:`${st.pct}%`}}/></div>
                          <div style={{fontSize:11,color:P.textSub}}>Debes {fmtCOP(st.totalOut)} · capital pendiente {fmtCOP(st.principalLeft)}</div>
                          {!d.paid && st.totalOut>0 && accounts.length>0 && (
                            <>
                              <div style={{marginTop:10}}>
                                <label style={{...s.label,marginBottom:6}}>¿Cuánto vas a pagar?</label>
                                <input type="text" inputMode="numeric" placeholder={fmtMiles(st.suggested)+" (una cuota)"}
                                  value={debtPayAmt[d.id]!==undefined?fmtMiles(debtPayAmt[d.id]):""}
                                  onChange={e=>setDebtPayAmt(m=>({...m,[d.id]:onlyDigits(e.target.value)}))}
                                  style={{...s.input,padding:"10px 12px",fontSize:14}}/>
                                <div style={{fontSize:10,color:P.textSub,marginTop:4}}>Déjalo vacío para una cuota.</div>
                              </div>
                              <div style={{display:"flex",justifyContent:"flex-end",marginTop:8}}>
                                <button onClick={()=>setDebtPaySplitOn(m=>({...m,[d.id]:!m[d.id]}))} style={{background:"none",border:"none",color:P.accent,fontSize:11,fontWeight:600,cursor:"pointer",padding:0,textDecoration:"underline"}}>
                                  {debtPaySplitOn[d.id]?"Pagar con una sola cuenta":"Dividir este pago"}
                                </button>
                              </div>
                              {debtPaySplitOn[d.id] ? (
                                <>
                                  <PaymentSplitter total={parseFloat(onlyDigits(debtPayAmt[d.id]))||st.suggested} cards={accounts} value={debtPaySplits[d.id]||[]} onChange={v=>setDebtPaySplits(m=>({...m,[d.id]:v}))} P={P} mode="out"/>
                                  <button onClick={()=>{payDebt(d, debtPayAmt[d.id], debtPaySplits[d.id]||[]); setDebtPaySplits(m=>({...m,[d.id]:[]}));}}
                                    style={{width:"100%",marginTop:10,padding:"10px",borderRadius:10,border:"none",background:`linear-gradient(135deg,#dc2626,${P.expense})`,color:"#fff",fontWeight:700,fontSize:13,cursor:"pointer"}}>
                                    + Registrar pago
                                  </button>
                                </>
                              ) : (
                                <>
                                  <div style={{display:"flex",flexWrap:"wrap",gap:6,marginTop:10,alignItems:"center"}}>
                                    <span style={{fontSize:11,color:P.textSub}}>Pagar desde:</span>
                                    {accounts.map(a=>(
                                      <button key={a.id} onClick={()=>setDebtPayAcct(m=>({...m,[d.id]:a.id}))}
                                        style={{padding:"4px 9px",borderRadius:16,border:`1.5px solid ${src===a.id?P.accent:P.cardBorder}`,background:src===a.id?"rgba(129,140,248,0.13)":"transparent",color:src===a.id?P.accent:P.textSub,fontSize:11,fontWeight:600,cursor:"pointer"}}>{a.name} · {fmtCOP(a.used||0)}</button>
                                    ))}
                                  </div>
                                  <button onClick={()=>payDebt(d, debtPayAmt[d.id], src)}
                                    style={{width:"100%",marginTop:10,padding:"10px",borderRadius:10,border:"none",background:`linear-gradient(135deg,#dc2626,${P.expense})`,color:"#fff",fontWeight:700,fontSize:13,cursor:"pointer"}}>
                                    + Registrar pago
                                  </button>
                                </>
                              )}
                            </>
                          )}
                          {!d.paid && st.totalOut>0 && accounts.length===0 && (
                            <div style={{fontSize:11,color:P.expense,marginTop:10}}>Crea una cuenta (Efectivo/Débito) para poder pagar.</div>
                          )}
                        </div>
                        <button onClick={()=>setExpandedDebt(isExpanded?null:d.id)}
                          style={{width:"100%",padding:"9px",borderRadius:10,border:`1px solid ${isExpanded?P.accent:P.cardBorder}`,background:isExpanded?"rgba(129,140,248,0.08)":"transparent",color:isExpanded?P.accent:P.textSub,fontWeight:600,fontSize:13,cursor:"pointer",marginBottom:isExpanded?12:0}}>
                          {isExpanded?"▲ Ocultar tabla":"▼ Ver tabla cuota a cuota"}
                        </button>
                        {isExpanded&&(
                          <div style={{overflowX:"auto"}}>
                            <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                              <thead><tr style={{borderBottom:`1px solid ${P.cardBorder}`}}>
                                {["Cuota","Interés","Total","Saldo"].map(h=>(
                                  <th key={h} style={{padding:"6px 4px",color:P.textSub,fontWeight:600,textAlign:"right"}}>{h}</th>
                                ))}
                              </tr></thead>
                              <tbody>
                                {schedule.map((row,i)=>(
                                  <tr key={i} style={{borderBottom:`1px solid rgba(42,42,58,0.5)`,background:i%2===0?"transparent":"rgba(255,255,255,0.015)"}}>
                                    <td style={{padding:"6px 4px",color:P.accent,fontWeight:700,textAlign:"right"}}>#{row.cuota}</td>
                                    <td style={{padding:"6px 4px",color:P.expense,textAlign:"right"}}>{fmtCOP(row.interes)}</td>
                                    <td style={{padding:"6px 4px",color:P.loan,textAlign:"right"}}>{fmtCOP(row.cuotaTotal)}</td>
                                    <td style={{padding:"6px 4px",color:row.saldoPendiente===0?P.income:P.text,textAlign:"right"}}>{row.saldoPendiente===0?"✓":fmtCOP(row.saldoPendiente)}</td>
                                  </tr>
                                ))}
                              </tbody>
                              <tfoot><tr style={{borderTop:`2px solid ${P.cardBorder}`}}>
                                <td style={{padding:"6px 4px",color:P.textSub,fontSize:11,fontWeight:700}}>TOTAL</td>
                                <td style={{padding:"6px 4px",color:P.expense,fontWeight:700,textAlign:"right"}}>{fmtCOP(interest)}</td>
                                <td style={{padding:"6px 4px",color:P.loan,fontWeight:700,textAlign:"right"}}>{fmtCOP(total)}</td>
                                <td style={{padding:"6px 4px",textAlign:"right"}}>—</td>
                              </tr></tfoot>
                            </table>
                          </div>
                        )}
                        <div style={{display:"flex",gap:8,marginTop:12}}>
                          <button onClick={()=>{setEditDebt(d.id);setDebtForm({lender:d.lender,amount:String(d.amount),interest:String(d.interest),interestType:d.interestType,months:String(d.months),date:d.date,note:d.note||"",account:d.account||""});window.scrollTo(0,0);}} style={{flex:1,padding:"9px 12px",borderRadius:10,border:`1px solid ${P.cardBorder}`,background:"transparent",color:P.textSub,fontSize:13,cursor:"pointer"}}>✏️ Editar</button>
                          <button onClick={()=>{if(window.confirm(`¿Borrar esta deuda? ${!d.paid&&st.principalLeft>0?`Se descontará ${fmtCOP(st.principalLeft)} de la cuenta donde entró.`:""}`)) deleteDebt(d);}} style={{padding:"9px 12px",borderRadius:10,background:"rgba(248,113,113,0.1)",border:"none",color:P.expense,fontSize:13,cursor:"pointer"}}>✕</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

            </div>
          )}

          {/* ── AI SUGGESTION MODAL ── */}
          {/* ── TOAST DE ERROR (propio, no alert() nativo) ── */}
          {uiError&&(
            <div style={{position:"fixed",left:16,right:16,bottom:96,zIndex:60,maxWidth:398,margin:"0 auto",display:"flex",justifyContent:"center"}}>
              <div style={{background:"#1e1215",border:"1px solid rgba(248,113,113,0.4)",borderRadius:16,padding:"14px 16px",boxShadow:"0 8px 32px rgba(0,0,0,0.5)",width:"100%",display:"flex",gap:10,alignItems:"flex-start"}}>
                <span style={{fontSize:16,flexShrink:0}}>⚠️</span>
                <div style={{flex:1,fontSize:13,color:P.text,lineHeight:1.4}}>{uiError}</div>
                <button onClick={()=>setUiError(null)} style={{background:"none",border:"none",color:P.textSub,fontSize:14,cursor:"pointer",padding:0,flexShrink:0}}>✕</button>
              </div>
            </div>
          )}

          {aiSuggestion&&(
            <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",zIndex:50,display:"flex",alignItems:"flex-end",justifyContent:"center"}} onClick={()=>setAiSuggestion(null)}>
              <div style={{background:P.card,borderRadius:"20px 20px 0 0",padding:"24px 20px 40px",width:"100%",maxWidth:430,border:`1px solid ${P.cardBorder}`}} onClick={e=>e.stopPropagation()}>
                <div style={{width:36,height:4,background:P.cardBorder,borderRadius:999,margin:"0 auto 20px"}}/>
                {aiSuggestion.loading?(
                  <div style={{textAlign:"center",padding:"20px 0",color:P.textSub}}>✨ Analizando gasto...</div>
                ):aiSuggestion.error?(
                  <div style={{textAlign:"center",color:P.expense}}>Error al conectar con IA</div>
                ):(
                  <>
                    <div style={{fontSize:13,color:P.textSub,marginBottom:4}}>Sugerencia para</div>
                    <div style={{fontSize:16,fontWeight:700,color:P.text,marginBottom:16}}>{aiSuggestion.tx?.category} — {fmtCOP(aiSuggestion.tx?.amount)}</div>
                    <div style={{background:"rgba(129,140,248,0.08)",border:`1px solid ${P.accent}`,borderRadius:14,padding:"14px",marginBottom:14}}>
                      <div style={{fontSize:12,color:P.accent,fontWeight:700,marginBottom:6}}>Método sugerido</div>
                      <div style={{fontSize:18,fontWeight:800,color:P.text,marginBottom:4}}>{aiSuggestion.metodoPago}</div>
                      {aiSuggestion.tarjetaSugerida&&<div style={{fontSize:13,color:P.accent}}>🏦 {aiSuggestion.tarjetaSugerida}</div>}
                    </div>
                    <div style={{fontSize:13,color:P.text,marginBottom:10}}>{aiSuggestion.razon}</div>
                    <div style={{fontSize:12,color:P.textSub,marginBottom:16,padding:"10px",background:"rgba(255,255,255,0.03)",borderRadius:10}}>💡 {aiSuggestion.tip}</div>
                    <div style={{display:"flex",gap:8}}>
                      <button onClick={()=>setAiSuggestion(null)} style={{flex:1,padding:"12px",borderRadius:12,border:`1px solid ${P.cardBorder}`,background:"transparent",color:P.textSub,fontWeight:600,cursor:"pointer"}}>Cerrar</button>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          <div style={{height:80}}/>
        </div>

        {/* BOTTOM NAV */}
        <div style={s.nav}>
          {navItems.map(n=>{
            const isAdd = n.id==="add";
            return(
              <button key={n.id} onClick={()=>{setView(n.id);setSubView(null);}} style={s.navBtn(view===n.id, isAdd)}>
                <span style={{fontSize:isAdd?26:17,fontWeight:isAdd?300:400,lineHeight:1,marginTop:isAdd?-2:0}}>{n.icon}</span>
                {!isAdd&&<span style={{fontSize:10,marginTop:3,letterSpacing:0.3}}>{n.label}</span>}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ST(P){
  return {
    root:{minHeight:"100vh",background:"#060609",display:"flex",justifyContent:"center",alignItems:"flex-start",fontFamily:"'Inter','Segoe UI',sans-serif"},
    screen:{width:"100%",maxWidth:430,minHeight:"100vh",background:P.bg,display:"flex",flexDirection:"column"},
    header:{padding:"max(52px, calc(env(safe-area-inset-top, 0px) + 20px)) 20px 16px",background:`linear-gradient(180deg,${P.bg} 80%,transparent)`,position:"sticky",top:0,zIndex:10,backdropFilter:"blur(12px)"},
    backBtn:{background:"none",border:"none",color:P.accent,fontSize:15,cursor:"pointer",marginBottom:4,padding:0,display:"flex",alignItems:"center",gap:4},
    headerTitle:{display:"block",fontSize:24,fontWeight:800,color:P.text,letterSpacing:-0.8},
    headerSub:{display:"block",fontSize:12,color:P.textSub,marginTop:3,textTransform:"capitalize"},
    content:{flex:1,overflowY:"auto",padding:"16px 16px 0"},

    // HERO BALANCE CARD
    balanceCard:{background:"linear-gradient(135deg,#0d0d1a 0%,#111128 40%,#0a0a1f 100%)",border:`1px solid rgba(129,140,248,0.2)`,borderRadius:24,padding:"28px 24px 24px",marginBottom:16,boxShadow:"0 8px 32px rgba(0,0,0,0.4),0 0 0 1px rgba(129,140,248,0.05)"},
    balanceLabel:{fontSize:11,color:P.textSub,letterSpacing:2,textTransform:"uppercase",marginBottom:8},
    balanceAmount:{fontSize:38,fontWeight:900,letterSpacing:-1.5,marginBottom:24,lineHeight:1},
    balanceRow:{display:"flex",alignItems:"center"},
    balanceStat:{flex:1,display:"flex",alignItems:"center",gap:10},
    dividerV:{width:1,height:36,background:"rgba(255,255,255,0.08)",margin:"0 16px"},
    statLabel:{fontSize:11,color:P.textSub,marginBottom:2},

    // CARDS
    card:{background:P.card,border:`1px solid ${P.cardBorder}`,borderRadius:18,padding:"18px",marginBottom:14,boxShadow:"0 2px 12px rgba(0,0,0,0.2)"},
    cardElevated:{background:`linear-gradient(135deg,${P.card},#1c1c28)`,border:`1px solid rgba(129,140,248,0.15)`,borderRadius:18,padding:"18px",marginBottom:14,boxShadow:"0 4px 24px rgba(0,0,0,0.3)"},
    cardRowSb:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10},
    cardTitle:{fontSize:11,fontWeight:700,color:P.textSub,letterSpacing:1.2,textTransform:"uppercase",marginBottom:14},

    // PROGRESS
    progressBg:{height:6,background:"rgba(255,255,255,0.06)",borderRadius:999,overflow:"hidden"},
    progressBar:{height:"100%",background:`linear-gradient(90deg,${P.accent},${P.income})`,borderRadius:999,transition:"width 0.6s cubic-bezier(0.4,0,0.2,1)"},

    // TRANSACTIONS
    txRow:{display:"flex",alignItems:"center",gap:12,padding:"12px 0",borderBottom:`1px solid rgba(255,255,255,0.04)`},
    txCard:{background:P.card,border:`1px solid ${P.cardBorder}`,borderRadius:16,padding:"14px",marginBottom:10,display:"flex",alignItems:"center",gap:12,boxShadow:"0 2px 8px rgba(0,0,0,0.15)"},
    txIcon:(type)=>({width:40,height:40,borderRadius:12,background:type==="income"?"rgba(52,211,153,0.12)":type==="loan"?"rgba(251,191,36,0.12)":"rgba(248,113,113,0.1)",color:type==="income"?P.income:type==="loan"?P.loan:P.expense,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,flexShrink:0,boxShadow:type==="income"?"0 0 12px rgba(52,211,153,0.15)":type==="loan"?"0 0 12px rgba(251,191,36,0.1)":"0 0 12px rgba(248,113,113,0.1)"}),
    txCat:{fontSize:14,fontWeight:600,color:P.text},
    txNote:{fontSize:12,color:P.textSub,marginTop:2},
    txDate:{fontSize:11,color:P.muted},

    // FORMS
    toggleRow:{display:"flex",gap:10,marginBottom:20},
    toggleBtn:(active,type)=>({flex:1,padding:"13px",borderRadius:14,border:`1.5px solid ${active?(type==="income"?P.income:P.expense):P.cardBorder}`,background:active?(type==="income"?"rgba(52,211,153,0.1)":"rgba(248,113,113,0.1)"):"transparent",color:active?(type==="income"?P.income:P.expense):P.textSub,fontWeight:700,fontSize:14,cursor:"pointer",transition:"all 0.2s"}),
    fieldGroup:{marginBottom:18},
    label:{display:"block",fontSize:11,color:P.textSub,marginBottom:8,fontWeight:600,letterSpacing:0.8,textTransform:"uppercase"},
    input:{width:"100%",padding:"14px 16px",background:"rgba(255,255,255,0.04)",border:`1.5px solid ${P.cardBorder}`,borderRadius:14,color:P.text,fontSize:15,outline:"none",boxSizing:"border-box",appearance:"none",transition:"border-color 0.2s"},
    submitBtn:(type)=>({width:"100%",padding:"16px",borderRadius:16,border:"none",background:type==="income"?`linear-gradient(135deg,#059669,#34d399)`:`linear-gradient(135deg,#dc2626,#f87171)`,color:"#fff",fontWeight:700,fontSize:16,cursor:"pointer",marginTop:8,boxShadow:type==="income"?"0 4px 20px rgba(52,211,153,0.25)":"0 4px 20px rgba(248,113,113,0.25)",letterSpacing:0.3}),

    // FILTERS
    filterRow:{display:"flex",gap:8,marginBottom:16},
    filterBtn:(active)=>({padding:"8px 16px",borderRadius:20,border:`1.5px solid ${active?P.accent:P.cardBorder}`,background:active?"rgba(129,140,248,0.15)":"transparent",color:active?P.accent:P.textSub,fontSize:13,fontWeight:600,cursor:"pointer",transition:"all 0.2s"}),

    // EMPTY STATE
    empty:{textAlign:"center",color:P.muted,padding:"48px 0",fontSize:14},

    // ACTION BUTTONS
    delBtn:{background:"rgba(248,113,113,0.08)",border:"none",color:P.expense,borderRadius:8,padding:"5px 9px",cursor:"pointer",fontSize:12},
    delConfirm:{background:P.expense,border:"none",color:"#fff",borderRadius:8,padding:"5px 11px",cursor:"pointer",fontSize:12,fontWeight:700},
    delCancel:{background:"rgba(255,255,255,0.06)",border:"none",color:P.text,borderRadius:8,padding:"5px 11px",cursor:"pointer",fontSize:12},
    summaryRow:{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 0",borderBottom:`1px solid rgba(255,255,255,0.05)`},

    // BOTTOM NAV — con + flotante
    nav:{position:"sticky",bottom:0,background:`rgba(23,23,31,0.95)`,borderTop:`1px solid rgba(255,255,255,0.06)`,display:"flex",padding:"10px 8px max(20px, env(safe-area-inset-bottom, 0px))",zIndex:20,backdropFilter:"blur(16px)",alignItems:"center"},
    navBtn:(active,isAdd)=>({
      // OJO: el boton de agregar NO lleva flex:1. flex-basis:0 + grow le
      // gana al width y lo estira a un quinto de la barra -> elipse.
      flex: isAdd ? "0 0 auto" : 1,
      background: isAdd
        ? "linear-gradient(135deg,#6d28d9,#818cf8)"
        : active ? "rgba(129,140,248,0.1)" : "transparent",
      border: isAdd ? "1px solid rgba(167,139,250,0.45)" : "none",
      display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",
      padding: isAdd ? 0 : "6px 0",
      color: isAdd ? "#fff" : active ? P.accent : P.muted,
      cursor:"pointer",
      fontWeight: active ? 700 : 400,
      // radio 16 = mismo lenguaje que las tarjetas (18) y los inputs (14)
      borderRadius: isAdd ? 16 : 12,
      height: isAdd ? 46 : "auto",
      width:  isAdd ? 46 : "auto",
      flexShrink: isAdd ? 0 : 1,
      margin: isAdd ? "0 10px" : 0,
      boxShadow: isAdd
        ? "0 6px 18px rgba(109,40,217,0.38), inset 0 1px 0 rgba(255,255,255,0.18)"
        : "none",
      transition:"all 0.2s",
    }),
    menuItem:{width:"100%",background:P.card,border:`1px solid ${P.cardBorder}`,borderRadius:18,padding:"18px",marginBottom:12,display:"flex",alignItems:"center",gap:14,cursor:"pointer",boxShadow:"0 2px 8px rgba(0,0,0,0.15)"},
    accentBtn:{background:"rgba(129,140,248,0.12)",border:`1.5px solid rgba(129,140,248,0.3)`,color:P.accent,borderRadius:12,padding:"10px 24px",fontWeight:600,fontSize:14,cursor:"pointer",transition:"all 0.2s"},
  };
}
