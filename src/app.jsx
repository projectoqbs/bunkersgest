import React, { useState, useEffect, useRef } from "react";
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
import * as XLSX from "xlsx";

// CSS global: todos los inputs de texto en mayúsculas
const _style = document.createElement("style");
_style.textContent = `input[type="text"], input:not([type]) { text-transform: uppercase !important; }`;
document.head.appendChild(_style);

// ─── SUPABASE ─────────────────────────────────────────────────────────────────
const SUPABASE_URL = "https://pahulcaneuzfiknrzlbc.supabase.co";
const SUPABASE_KEY = "sb_publishable_6A3JvUT-O5UpP5FAYUIKaA_6-Xihr7N";
const SUPABASE_SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBhaHVsY2FuZXV6ZmlrbnJ6bGJjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTg3Mjg2OCwiZXhwIjoyMDk1NDQ4ODY4fQ.jwQZ3-FZe7zv3CGMgQvNiphxHtlFbfZX2HTq5orX46E";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// ─── CONSTANTES ───────────────────────────────────────────────────────────────
const MATERIAS_PRIMAS = ["FRONTERA","PENDARE","ALBERTA","CARRIZALES NORTE P","CARRIZALES NORTE B","OMI","VIGIA","KIMBO","CUERVA","SOGAMOSO","TK205","RUMBA","MATEGUAFA","DESTILADO REFISAMAG"];
const TABLA13 = {1:4.0346,2:4.0043,3:3.9745,4:3.9451,5:3.9162,6:3.8877,7:3.8596,8:3.8319,9:3.8046,10:3.7777,11:3.7511,12:3.7249,13:3.6991,14:3.6737,15:3.6486,16:3.6238,17:3.5994,18:3.5753,19:3.5515,20:3.528,21:3.5048,22:3.482,23:3.4594,24:3.4371,25:3.4151,26:3.3934,27:3.372,28:3.3508,29:3.3299,30:3.3093,31:3.2888,32:3.2687,33:3.2489,34:3.2292,35:3.2097,36:3.1906,37:3.1716,38:3.1529,39:3.1343,40:3.116,41:3.0979,42:3.0801,43:3.0624,44:3.0449,45:3.0276,46:3.0105,47:2.9937,48:2.9769,49:2.9604,50:2.9441};
const tabla13Factor = api => {
  if (!api || api <= 0) return "";
  const lo = Math.floor(api), hi = Math.ceil(api);
  if (lo === hi) return (TABLA13[lo]||"").toString();
  if (!TABLA13[lo] || !TABLA13[hi]) return (TABLA13[lo]||TABLA13[hi]||"").toString();
  const t = api - lo;
  return (TABLA13[lo] + t*(TABLA13[hi]-TABLA13[lo])).toFixed(4);
};
const SEDES = ["MALAMBO","SANTA MARTA","CARTAGENA"];
const PLANTAS = ["PLANTA 1","PLANTA 2"];
const TRANSPORTADORAS = ["COTRASUR","COVOLCO","LOGISTCARGA","TSCASANARE","TTC","TRUCKSOIL","INLOP","OXITRANS","RH GROUP","TRANSPORTES GAYCO","TRANSPORTES TMC","COPETRAN","TRANS AELLA","ICEBERG","OPL CARGA","LIMA TRANSPORTES","MOVITRANSAS","ECOPLANTA","TODOTER RENO","PUERTO PIMSA","CARGOANINA","TGCARGAS","INVERZAS"];
const BARCAZAS = ["QBS-002","QBS-003"];
const TANQUES_BARCAZA = {
  "QBS-002": ["PROA","1B","1E","2B","2E","3B","3E","4B","4E","5B","5E","POPA"],
  "QBS-003": ["PROA","1B","1E","2B","2E","3B","3E","4B","4E","5B","5E","6B","6E","POPA"],
};

const ROLES = {
  logistica:   { label:"Logística",          color:"#f59e0b", icon:"🚛" },
  laboratorio: { label:"Laboratorio",        color:"#00b4ff", icon:"🧪" },
  operaciones: { label:"Operaciones",        color:"#fb923c", icon:"⚙️" },
  coordinador: { label:"Coordinador Planta", color:"#00e5a0", icon:"📋" },
  despacho:    { label:"Despacho",           color:"#c084fc", icon:"🚢" },
  gerencia:    { label:"Gerencia",           color:"#fb7185", icon:"📊" },
  administrador: { label:"Administrador", color:"#FF6B35", icon:"👑" },
};

const NAV_META = {
  dashboard:    { label:"Dashboard",    icon:"▦" },
  viajes:       { label:"Logística",    icon:"🚛" },
  tiquetes:     { label:"Tiquetes MP",  icon:"🧪" },
  pbs:          { label:"PBS",          icon:"🔒" },
  cmt:          { label:"CMT",          icon:"📋" },
  tanques:      { label:"Tanques",      icon:"🛢" },
  despacho:     { label:"Despacho",     icon:"🚢" },
  trazabilidad: { label:"Trazabilidad", icon:"🔍" },
  usuarios: { label:"Usuarios", icon:"👥" },
};

const NAV_ROL = {
  logistica:   ["dashboard","viajes","pbs","trazabilidad"],
  laboratorio: ["dashboard","tiquetes","pbs","trazabilidad"],
  operaciones: ["dashboard","pbs","trazabilidad"],
  coordinador: ["dashboard","pbs","tanques","trazabilidad"],
  despacho:    ["dashboard","despacho","pbs","trazabilidad"],
  administrador:    ["dashboard","viajes","tiquetes","pbs","tanques","despacho","trazabilidad","usuarios"],
};

const PBS_PREGUNTAS = [
  "¿Todo el personal tiene el EPP necesario? (casco, guantes, botas, chaleco, protección auditiva, arnés, línea de vida, silbato, luz estroboscópica, radio)",
  "¿Se aseguró de tener línea de vida, arnés y equipo para trabajo en altura? ¿Tiene permiso vigente?",
  "¿Están abiertas las escotillas del carrotanque / Bodega?",
  "¿Inspeccionó la válvula de alivio o desfogue del carrotanque?",
  "¿En la reunión de seguridad se discutió y analizó la actividad?",
  "¿Están los extintores a la mano y listos para uso?",
  "¿La barrera de contención está dispuesta en el río? ¿Hace cierre completo?",
  "¿Todos los tapones de los imbornales están enroscados?",
  "¿El equipo SOPEP está completo y es de fácil acceso?",
  "¿Las mangueras que se usarán están en buen estado?",
  "¿Los acoples de las mangueras están en buen estado?",
  "¿Se realizó limpieza a la superficie del flanche?",
  "¿Se verificó que las conexiones de las mangueras tengan los empaques?",
  "¿Las conexiones flanchadas se hicieron con todos los tornillos requeridos?",
  "¿Se colocaron las bandejas de control de derrames debajo de cada conexión?",
  "¿Revisó que las mangueras no estén en contacto con bordes afilados?",
  "¿Cuál es el espacio disponible de los tanques a recibir?",
  "Volumen existente en el tanque que recibe [en galones]",
  "Volumen que se va a bombear al tanque que recibe [en galones]",
  "¿El producto cabe? ¿Está por debajo del 90% del volumen máximo?",
  "¿Verificó que la válvula del tanque que recibe está abierta?",
  "¿Verificó que las válvulas de los otros tanques estén cerradas?",
  "Si está bombeando a una motonave: ¿Ya tiene el visto bueno del Ingeniero de Operaciones?",
  "¿Cada miembro del equipo se encuentra en el lugar que le corresponde?",
];

const TIPO_COLOR = { materia_prima:"#f59e0b", mezcla:"#00b4ff", terminado:"#00e5a0" };
const TIPO_LABEL = { materia_prima:"Mat. Prima", mezcla:"Mezcla/Prod.", terminado:"Terminado" };
const fmt = n => Number(n||0).toLocaleString("es-CO");
const today = () => new Date().toISOString().slice(0,10);
const genId = (prefix, list) => `${prefix}-${String((list?.length||0)+1).padStart(3,"0")}`;

// Colores por producto para tanques Varec
const getProductColor = (producto) => {
  if (!producto) return "#2a2a2a";
  const upperProd = String(producto).toUpperCase();
  if (upperProd === "MGO" || upperProd === "DIESEL") return "#1abc9c"; // Verde turquesa
  if (upperProd === "VLSFO" || upperProd === "HSFO") return "#3d3d5c"; // Azul-negro distinguible del gris interior
  return "#6b4423"; // Marrón oscuro para materia prima (PENDARE, etc.)
};

// Genera el ID interno del CMT (registro DB)
const genIdCMT = (cmts, sede, planta) => {
  const prefijos = { "MALAMBO-PLANTA 1":"MAL1","MALAMBO-PLANTA 2":"MAL2","SANTA MARTA":"STM","CARTAGENA":"CTG" };
  const clave = sede === "MALAMBO" ? `${sede}-${planta||"PLANTA 1"}` : (sede||"MALAMBO");
  const prefijo = prefijos[clave] || "MAL1";
  const existentes = (cmts||[]).filter(c=>(c.numero_cmt||"").startsWith(`CMT-${prefijo}-`));
  const siguiente = String(existentes.length + 1).padStart(5,"0");
  return `CMT-${prefijo}-${siguiente}`;
};

// ─── UI COMPONENTS ─────────────────────────────────────────────────────────────
// ─── DESIGN TOKENS ────────────────────────────────────────────────────────────
const T = {
  navy:"#003D5C", sidebar:"#2D3142", orange:"#FF6B35", success:"#00B894",
  danger:"#D63031", bg:"#e8eaf0", text:"#1E1E24", card:"#ffffff",
  border:"#e0e0e0", muted:"#6b7a99",
};

function Badge({ label, color }) {
  return <span style={{ fontSize:10, fontWeight:700, color, background:color+"22", padding:"2px 10px", borderRadius:20, whiteSpace:"nowrap", letterSpacing:0.5 }}>{label}</span>;
}
function Card({ children, style }) {
  return <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:8, padding:20, boxShadow:"0 1px 3px rgba(0,0,0,0.08)", ...style }}>{children}</div>;
}
function Lbl({ children }) {
  return <div style={{ fontSize:10, color:T.navy, textTransform:"uppercase", letterSpacing:1.2, marginBottom:5, fontWeight:700, minHeight:24, display:"flex", alignItems:"flex-end" }}>{children}</div>;
}
function Inp({ label, type="text", onChange, readOnly, ...p }) {
  const isText = !["date","time","number","email","password"].includes(type);
  const handleChange = onChange ? e => {
    if (isText) { e.target.value = e.target.value.toUpperCase(); }
    onChange(e);
  } : undefined;
  return (
    <div style={{ marginBottom:12 }}>
      <style>{`input[type=number]::-webkit-inner-spin-button,input[type=number]::-webkit-outer-spin-button{-webkit-appearance:none;margin:0}`}</style>
      {label && <Lbl>{label}</Lbl>}
      <input type={type} onChange={handleChange} {...p} readOnly={readOnly} tabIndex={readOnly ? -1 : undefined} style={{ width:"100%", background: readOnly ? "#e8edf2" : T.card, border:`1px solid ${readOnly?"#c5cfd8":T.border}`, borderRadius:6, padding:"10px 12px", color: readOnly ? "#4a5568" : T.text, fontSize:13, fontFamily:"system-ui,sans-serif", outline:"none", boxSizing:"border-box", textTransform: isText?"uppercase":"none", cursor: readOnly ? "default" : "text", MozAppearance:"textfield", appearance:"textfield", fontWeight: readOnly ? 600 : 400 }} />
    </div>
  );
}
function Sel({ label, children, ...p }) {
  return (
    <div style={{ marginBottom:12 }}>
      {label && <Lbl>{label}</Lbl>}
      <select {...p} style={{ width:"100%", background:T.card, border:`1px solid ${T.border}`, borderRadius:6, padding:"10px 12px", color:T.text, fontSize:13, fontFamily:"system-ui,sans-serif", outline:"none", boxSizing:"border-box" }}>
        {children}
      </select>
    </div>
  );
}
function Btn({ children, color, variant, sm, onClick, disabled, type="button" }) {
  const bg = color || T.orange;
  const isDanger = bg === T.danger || bg === "#D63031" || bg === "#ff4d4d" || bg === "#D63031";
  return (
    <button type={type} disabled={disabled} onClick={onClick} style={{ background: variant==="outline" ? "transparent" : bg, color: variant==="outline" ? bg : "#ffffff", border:`2px solid ${bg}`, borderRadius:6, padding:sm?"5px 14px":"9px 20px", fontFamily:"system-ui,sans-serif", fontWeight:700, fontSize:sm?11:13, cursor:disabled?"not-allowed":"pointer", opacity:disabled?0.5:1, whiteSpace:"nowrap", letterSpacing:0.3 }}>
      {children}
    </button>
  );
}
function Modal({ title, onClose, children, wide, inline }) {
  const inner = (
    <div style={{ background:T.card, border: inline ? "none" : `1px solid ${T.border}`, borderRadius: inline ? 0 : 10, width:"100%", maxWidth: inline ? "none" : (wide?860:560), overflow:"hidden", boxShadow: inline ? "none" : "0 20px 60px rgba(0,0,0,0.3)", display: inline ? "flex" : "block", flexDirection:"column", height: inline ? "100%" : "auto" }}>
      <div style={{ background:T.navy, borderBottom:`3px solid ${T.orange}`, padding:"16px 24px", display:"flex", justifyContent:"space-between", alignItems:"center", flexShrink:0 }}>
        <span style={{ fontSize:15, fontWeight:800, color:"#ffffff", letterSpacing:1, textTransform:"uppercase" }}>{title}</span>
        <button onClick={onClose} style={{ background:"rgba(255,255,255,0.1)", border:"none", color:"#ffffff", fontSize:18, cursor:"pointer", borderRadius:6, width:30, height:30, display:"flex", alignItems:"center", justifyContent:"center" }}>✕</button>
      </div>
      <div style={{ padding:24, ...(inline ? { flex:1, overflowY:'auto' } : {}) }}>{children}</div>
    </div>
  );
  if (inline) return <div style={{ height:"100%", display:"flex", flexDirection:"column" }}>{inner}</div>;
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.6)", zIndex:1000, display:"flex", alignItems:"flex-start", justifyContent:"center", padding:20, overflowY:"auto" }}>
      <div style={{ width:"100%", maxWidth:wide?860:560, margin:"auto" }}>{inner}</div>
    </div>
  );
}
function Grid({ cols=2, children }) {
  return <div style={{ display:"grid", gridTemplateColumns:`repeat(${cols},1fr)`, gap:12, alignItems:"end" }}>{children}</div>;
}
function Section({ title, children }) {
  return (
    <div style={{ marginBottom:20 }}>
      <div style={{ fontSize:11, fontWeight:800, color:T.orange, letterSpacing:1.5, textTransform:"uppercase", marginBottom:10, paddingBottom:6, borderBottom:`2px solid ${T.orange}22` }}>{title}</div>
      {children}
    </div>
  );
}
function Stat({ label, value, color, sub }) {
  return (
    <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:8, padding:"16px 18px", borderLeft:`4px solid ${color||T.orange}`, boxShadow:"0 1px 3px rgba(0,0,0,0.06)" }}>
      <div style={{ fontSize:10, color:T.navy, textTransform:"uppercase", letterSpacing:1.2, fontWeight:700, marginBottom:6 }}>{label}</div>
      <div style={{ fontSize:24, fontWeight:800, color:color||T.orange, fontFamily:"system-ui,sans-serif" }}>{value}</div>
      {sub && <div style={{ fontSize:10, color:T.muted, marginTop:3 }}>{sub}</div>}
    </div>
  );
}
function Table({ cols, rows, emptyMsg }) {
  return (
    <div style={{ background:T.card, borderRadius:8, border:`1px solid ${T.border}`, overflow:"hidden", boxShadow:"0 1px 3px rgba(0,0,0,0.06)" }}>
      <table style={{ width:"100%", borderCollapse:"collapse", minWidth:500 }}>
        <thead><tr style={{ background:T.bg }}>{cols.map(c=><th key={c} style={{ padding:"10px 14px", textAlign:"left", fontSize:10, color:T.navy, letterSpacing:1, textTransform:"uppercase", fontWeight:700, whiteSpace:"nowrap", borderBottom:`2px solid ${T.border}` }}>{c}</th>)}</tr></thead>
        <tbody>
          {rows.length===0
            ? <tr><td colSpan={cols.length} style={{ padding:24, textAlign:"center", color:T.muted, fontSize:12 }}>{emptyMsg||"Sin registros"}</td></tr>
            : rows.map((r,i)=>{
                const bg = i%2===0 ? T.card : "#eef2f7";
                return <tr key={i}
                  style={{ borderTop:`1px solid ${T.border}`, background:bg, transition:"background 0.12s" }}
                  onMouseEnter={e=>e.currentTarget.style.background="#dde6f0"}
                  onMouseLeave={e=>e.currentTarget.style.background=bg}>
                  {r.map((cell,j)=><td key={j} style={{ padding:"9px 14px", fontSize:12, color:T.text, whiteSpace:"nowrap" }}>{cell}</td>)}
                </tr>;
              })
          }
        </tbody>
      </table>
    </div>
  );
}
function Spinner() {
  return <div style={{ width:28, height:28, border:`3px solid ${T.border}`, borderTop:`3px solid ${T.orange}`, borderRadius:"50%", animation:"spin 0.8s linear infinite" }} />;
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
const NO_SPINNER = `input[type=number]::-webkit-inner-spin-button,input[type=number]::-webkit-outer-spin-button{-webkit-appearance:none;margin:0}`;
export default function App() {
  const [session, setSession] = useState(null);
  const [perfil, setPerfil] = useState(null);
  const [loading, setLoading] = useState(true);
  const [labOpen, setLabOpen] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [navHovered, setNavHovered] = useState(null);

  // ── TAB SYSTEM ──
  const [tabs, setTabs] = useState([
    { id: 'tab-dashboard', type: 'nav', section: 'dashboard', title: 'Dashboard', icon: '▦', closeable: false }
  ]);
  const [activeTabId, setActiveTabId] = useState('tab-dashboard');
  const tabStateCache = useRef({});
  const cmtCarrosRef = useRef(null);

  // Data
  const [tanques, setTanques] = useState([]);
  const [viajes, setViajes] = useState([]);
  const [tiquetes, setTiquetes] = useState([]);
  const [pbsList, setPbsList] = useState([]);
  const [cmts, setCmts] = useState([]);
  const [despachos, setDespachos] = useState([]);
    const [perfiles, setPerfiles] = useState([]);
    const [permisosRoles, setPermisosRoles] = useState([]);

  // UI  (nav and modal are now DERIVED from the active tab — see below)
  const [form, setForm] = useState({});
  const [toast, setToast] = useState(null);
  const [saving, setSaving] = useState(false);
  const [pbsChecklist, setPbsChecklist] = useState(Array(27).fill(""));
  const [cmtProducto, setCmtProducto] = useState("");
  const [cmtAntes, setCmtAntes] = useState([{tanque:"",sonda:"",galones:""}]);
  const [cmtCarros, setCmtCarros] = useState([{placa:"", guia:"", tiquete:"", pbs_id:""}]);
  const [pbsParaCarro, setPbsParaCarro] = useState(null);
  const [pbsEsTrasiego, setPbsEsTrasiego] = useState(false);
  const [cmtDespues, setCmtDespues] = useState([{tanque:"",producto:"",sonda:"",galones:""}]);
  const [cmtRecepcion, setCmtRecepcion] = useState([{tanque:"",sondaInicial:"",tempInicial:"",apiInicial:"",galonesInicial:"",sondaFinal:"",tempFinal:"",apiFinal:"",galonesFinal:""}]);
  const [viajesBusqueda, setViajesBusqueda] = useState("");
  const [tankProdEdit, setTankProdEdit] = useState(null);   // {id, val} cuando se edita producto
  const [tankProdSaving, setTankProdSaving] = useState(false);
  const [tankFullscreen, setTankFullscreen] = useState(false);
  const [viajesFiltroEstado, setViajesFiltroEstado] = useState("");
  const [viajesFiltroProducto, setViajesFiltroProducto] = useState("");
  const [viajesFiltroFechaD, setViajesFiltroFechaD] = useState("");
  const [viajesFiltroFechaH, setViajesFiltroFechaH] = useState("");
  const [analisisNav, setAnalisisNav] = useState("");
  const [resFiltroTipo, setResFiltroTipo] = useState("");
  const [tiqBusqueda, setTiqBusqueda] = useState("");
  const [tiqFiltroProducto, setTiqFiltroProducto] = useState("");
  const [tiqFiltroResultado, setTiqFiltroResultado] = useState("");
  const [tiqFiltroFechaD, setTiqFiltroFechaD] = useState("");
  const [tiqFiltroFechaH, setTiqFiltroFechaH] = useState("");
  const [plantaBusqueda, setPlantaBusqueda] = useState("");
  const [plantaFiltroProducto, setPlantaFiltroProducto] = useState("");
  const [plantaFiltroFechaD, setPlantaFiltroFechaD] = useState("");
  const [plantaFiltroFechaH, setPlantaFiltroFechaH] = useState("");
  const [cmtBusqueda, setCmtBusqueda] = useState("");
  const [cmtFiltroTipo, setCmtFiltroTipo] = useState("");
  const [cmtFiltroFechaD, setCmtFiltroFechaD] = useState("");
  const [cmtFiltroFechaH, setCmtFiltroFechaH] = useState("");
  const [cmtExpandido, setCmtExpandido] = useState(null);
  const [cmtSnapshot, setCmtSnapshot] = useState(null);

  // Gestión de usuarios
  const [editUsuario, setEditUsuario] = useState(null);

  // Filtro por sede y planta
  const [sedeFiltro, setSedeFiltro] = useState(null);
  const [plantaFiltro, setPlantaFiltro] = useState(null);
  const [permsEdit, setPermsEdit] = useState({});

  // Auth form
  const [authMode, setAuthMode] = useState("login");
  const [authForm, setAuthForm] = useState({});
  const [authError, setAuthError] = useState("");

  const af = k => e => setAuthForm(p=>({...p,[k]:e.target.value}));
  const f  = k => e => setForm(p=>({...p,[k]: e.target.type==="text"||!e.target.type ? String(e.target.value).toUpperCase() : e.target.value}));

  function showToast(msg, ok=true) {
    setToast({msg,ok});
    setTimeout(()=>setToast(null),3500);
  }

  // ── TAB DERIVED STATE ──
  const activeTab = tabs.find(t => t.id === activeTabId) || tabs[0];
  const nav = activeTab?.type === 'nav' ? activeTab.section : '';
  const modal = activeTab?.type === 'form' ? activeTab.formType : null;

  // ── TAB HELPER FUNCTIONS ──
  function captureFormState() {
    return {
      form: {...form},
      cmtAntes: JSON.parse(JSON.stringify(cmtAntes)),
      cmtDespues: JSON.parse(JSON.stringify(cmtDespues)),
      cmtCarros: JSON.parse(JSON.stringify(cmtCarros)),
      cmtProducto,
      cmtRecepcion: JSON.parse(JSON.stringify(cmtRecepcion)),
      pbsChecklist: [...pbsChecklist],
      pbsParaCarro,
      pbsEsTrasiego,
      cmtSnapshot: cmtSnapshot ? JSON.parse(JSON.stringify(cmtSnapshot)) : null,
    };
  }

  function restoreFormState(cached) {
    if (!cached) return;
    setForm(cached.form || {});
    setCmtAntes(cached.cmtAntes || [{tanque:'',sonda:'',galones:''}]);
    setCmtDespues(cached.cmtDespues || [{tanque:'',producto:'',sonda:'',galones:''}]);
    setCmtCarros(cached.cmtCarros || [{placa:'',guia:'',tiquete:'',pbs_id:''}]);
    setCmtProducto(cached.cmtProducto || '');
    setCmtRecepcion(cached.cmtRecepcion || [{tanque:'',sondaInicial:'',tempInicial:'',apiInicial:'',galonesInicial:'',sondaFinal:'',tempFinal:'',apiFinal:'',galonesFinal:''}]);
    setPbsChecklist(cached.pbsChecklist || Array(26).fill(''));
    setPbsParaCarro(cached.pbsParaCarro ?? null);
    setPbsEsTrasiego(cached.pbsEsTrasiego || false);
    setCmtSnapshot(cached.cmtSnapshot || null);
  }

  function clearFormState() {
    setForm({});
    setCmtAntes([{tanque:'',sonda:'',galones:''}]);
    setCmtDespues([{tanque:'',producto:'',sonda:'',galones:''}]);
    setCmtCarros([{placa:'',guia:'',tiquete:'',pbs_id:''}]);
    setCmtProducto('');
    setCmtRecepcion([{tanque:'',sondaInicial:'',tempInicial:'',apiInicial:'',galonesInicial:'',sondaFinal:'',tempFinal:'',apiFinal:'',galonesFinal:''}]);
    setPbsChecklist(Array(26).fill(''));
    setPbsParaCarro(null);
    setPbsEsTrasiego(false);
    setCmtSnapshot(null);
  }

  function switchToTab(tabId) {
    if (tabId === activeTabId) return;
    if (activeTab?.type === 'form') {
      tabStateCache.current[activeTabId] = captureFormState();
    }
    setActiveTabId(tabId);
    const newTab = tabs.find(t => t.id === tabId);
    if (newTab?.type === 'form') {
      restoreFormState(tabStateCache.current[tabId]);
    } else {
      clearFormState();
    }
  }

  function closeTab(tabId) {
    const tab = tabs.find(t => t.id === tabId);
    if (!tab?.closeable) return;
    delete tabStateCache.current[tabId];
    const remaining = tabs.filter(t => t.id !== tabId);
    setTabs(remaining);
    if (activeTabId === tabId) {
      const prevTab = remaining[remaining.length - 1];
      setActiveTabId(prevTab?.id);
      if (prevTab?.type === 'form') {
        restoreFormState(tabStateCache.current[prevTab.id]);
      } else {
        clearFormState();
      }
    }
  }

  function openNavTab(section) {
    if (activeTab?.type === 'form') {
      tabStateCache.current[activeTabId] = captureFormState();
    }
    const existing = tabs.find(t => t.type === 'nav' && t.section === section);
    if (existing) {
      setActiveTabId(existing.id);
      clearFormState();
      return;
    }
    const meta = NAV_META[section] || { label: section, icon: '📄' };
    const id = `nav-${section}-${Date.now()}`;
    setTabs(prev => [...prev, { id, type:'nav', section, title: meta.label, icon: meta.icon, closeable: true }]);
    setActiveTabId(id);
    clearFormState();
  }

  function openFormTab(formType, initialState) {
    if (!formType) {
      closeTab(activeTabId);
      return;
    }
    // If there's already a tab of this formType, switch to it
    // (e.g. returning from PBS → CMT, or editing from a section with a tab already open)
    const existing = tabs.find(t => t.type === 'form' && t.formType === formType);
    if (existing) {
      if (activeTab?.type === 'form') {
        tabStateCache.current[activeTabId] = captureFormState();
      }
      setActiveTabId(existing.id);
      // If initialState provided or caller set form state (e.g. edit button), use current state;
      // otherwise restore cached state (e.g. returning from PBS → CMT with cmtSnapshot)
      if (initialState) {
        restoreFormState(initialState);
      }
      // Note: if caller did setForm({...v}) before calling openFormTab, that state is already in
      // React state and will be used — no need to restore cache
      return;
    }
    if (activeTab?.type === 'form') {
      tabStateCache.current[activeTabId] = captureFormState();
    }
    const FORM_META = {
      cmt:        { title: 'Nuevo CMT',      icon: '📋' },
      viaje:      { title: 'Nuevo Viaje',    icon: '🚛' },
      tiquete:    { title: 'Nuevo Tiquete',  icon: '🧪' },
      pbs:        { title: 'Nuevo PBS',      icon: '⚙️' },
      despacho:   { title: 'Nuevo Despacho', icon: '🚢' },
      usuario:    { title: 'Nuevo Usuario',  icon: '👥' },
      turno_carro:{ title: 'Turno Carro',    icon: '🚛' },
    };
    const meta = FORM_META[formType] || { title: formType, icon: '📄' };
    const id = `form-${formType}-${Date.now()}`;
    setTabs(prev => [...prev, { id, type:'form', formType, title: meta.title, icon: meta.icon, closeable: true }]);
    setActiveTabId(id);
    if (initialState) {
      restoreFormState(initialState);
    }
  }

  // Backward-compat shims so all existing setModal / setNav calls work
  function setModal(formType) { openFormTab(formType); }
  function setNav(section) { openNavTab(section); }

  // ── AUTH ──
  useEffect(()=>{
    supabase.auth.getSession().then(({data:{session}})=>{
      setSession(session);
      if (session) loadPerfil(session.user.id);
      else setLoading(false);
    });
    const {data:{subscription}} = supabase.auth.onAuthStateChange((_,session)=>{
      setSession(session);
      if (session) loadPerfil(session.user.id);
      else { setPerfil(null); setLoading(false); }
    });
    return ()=>subscription.unsubscribe();
  },[]);

  useEffect(()=>{
    if (!perfil) return;
    const reload = () => loadData();
    const channel = supabase.channel("bunkergest-realtime")
      .on("postgres_changes",{event:"*",schema:"public",table:"tanques"},   reload)
      .on("postgres_changes",{event:"*",schema:"public",table:"viajes"},    reload)
      .on("postgres_changes",{event:"*",schema:"public",table:"tiquetes"},  reload)
      .on("postgres_changes",{event:"*",schema:"public",table:"pbs"},       reload)
      .on("postgres_changes",{event:"*",schema:"public",table:"cmts"},      reload)
      .on("postgres_changes",{event:"*",schema:"public",table:"despachos"}, reload)
      .subscribe();
    return ()=>supabase.removeChannel(channel);
  },[perfil]);

  async function loadPerfil(uid) {
    const {data, error: aforoError} = await supabase.from("perfiles").select("*").eq("id",uid).maybeSingle();
    setPerfil(data);
    setLoading(false);
    if (data) {
      const esGlobal = ["administrador","gerencia"].includes(data?.rol);
      const sedeInicial = esGlobal ? "TODAS" : (data?.sede || "MALAMBO");
      setSedeFiltro(sedeInicial);
      setPlantaFiltro(esGlobal ? null : (data?.planta || (sedeInicial === "MALAMBO" ? "PLANTA 1" : "N/A")));
      loadData();
    }
  }

  async function loadData() {
    const [t,v,tq,p,c,d,pr,permR] = await Promise.all([
      supabase.from("tanques").select("*").order("id"),
      supabase.from("viajes").select("*").order("created_at",{ascending:false}),
      supabase.from("tiquetes").select("*").order("created_at",{ascending:false}),
      supabase.from("pbs").select("*").order("created_at",{ascending:false}),
      supabase.from("cmts").select("*").order("created_at",{ascending:false}),
      supabase.from("despachos").select("*").order("created_at",{ascending:false}),
      supabase.from("perfiles").select("*").order("nombre"),
      supabase.from("permisos_roles").select("*").order("rol").order("modulo"),
    ]);
    if (t.data) setTanques(t.data);
    if (v.data) setViajes(v.data);
    if (tq.data) setTiquetes(tq.data);
    if (p.data) setPbsList(p.data);
    if (c.data) setCmts(c.data);
    if (d.data) setDespachos(d.data);
    if (pr.data) setPerfiles(pr.data);
    if (permR.data) setPermisosRoles(permR.data);
  }

  const cedulaToEmail = (cedula) => cedula.includes("@") ? cedula : `${cedula}@quimibuques.com`;

  async function handleLogin(e) {
    e.preventDefault();
    setAuthError("");
    const emailFinal = cedulaToEmail(authForm.cedula||"");
    const {error} = await supabase.auth.signInWithPassword({email:emailFinal, password:authForm.password});
    if (error) setAuthError("Cédula/usuario o contraseña incorrectos");
  }

  async function handleRegister(e) {
    e.preventDefault();
    setAuthError("");
    if (!authForm.nombre||!authForm.rol||!authForm.cedula) return setAuthError("Completa todos los campos");
    const emailFinal = cedulaToEmail(authForm.cedula);
    const {error} = await supabase.auth.signUp({
      email:emailFinal, password:authForm.password,
      options:{ data:{ nombre:authForm.nombre, rol:authForm.rol, planta:authForm.planta||"QBS", cedula:authForm.cedula }}
    });
    if (error) setAuthError(error.message);
    else { setAuthMode("login"); setAuthError("Cuenta creada. Inicia sesión."); }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    setTabs([{ id: 'tab-dashboard', type: 'nav', section: 'dashboard', title: 'Dashboard', icon: '▦', closeable: false }]);
    setActiveTabId('tab-dashboard');
    tabStateCache.current = {};
  }

  // ── GUARDAR DATOS ──
  async function guardarViaje(e) {
    e.preventDefault(); setSaving(true);
    if (form.id) {
      const {error} = await supabaseAdmin.from("viajes").update({
        fecha:form.fecha, producto:form.producto, transportadora:form.transportadora,
        placa:form.placa, conductor:form.conductor, cedula:form.cedula,
        guia:form.guia, volumen_guia:Number(form.volumen_guia||0),
        planta:form.planta, standby:Number(form.standby||0), flete:Number(form.flete||0),
        bono:Number(form.bono||0), barriles_nsv:Number(form.barriles_nsv||0),
        gls_netos_guia:Number(form.gls_netos_guia||0), gls_recibidos:Number(form.gls_recibidos||0),
        fecha_llegada:form.fecha_llegada||null, fecha_aprox_llegada:form.fecha_aprox_llegada||null,
        fecha_descargue:form.fecha_descargue||null,
        valor_standby:Number(form.valor_standby||0), observacion:form.observacion||null,
      }).eq("id", form.id);
      setSaving(false);
      if (error) return showToast("Error: "+error.message, false);
      await loadData(); setModal(null); setForm({});
      showToast(`Viaje ${form.id} actualizado`);
    } else {
      const id = genId("VJ", viajes);
      const {error} = await supabaseAdmin.from("viajes").insert([{
        id, ...form, volumen_guia:Number(form.volumen_guia||0),
        standby:Number(form.standby||0), flete:Number(form.flete||0),
        bono:Number(form.bono||0), barriles_nsv:Number(form.barriles_nsv||0),
        gls_netos_guia:Number(form.gls_netos_guia||0), gls_recibidos:Number(form.gls_recibidos||0),
        valor_standby:Number(form.valor_standby||0), fecha_descargue:form.fecha_descargue||null,
        estado:"En Ruta", creado_por:session.user.id
      }]);
      setSaving(false);
      if (error) return showToast("Error al guardar: "+error.message,false);
      await loadData(); setModal(null); setForm({});
      showToast(`Viaje ${id} registrado — ${form.placa}`);
    }
  }

  async function guardarTiquete(e) {
    e.preventDefault(); setSaving(true);
    const esVLSFO = (form.producto||"").toUpperCase()==="VLSFO";
const aprueba = esVLSFO
  ? Number(form.agua_destilacion)<0.5 && Number(form.flash_point)>=60 && Number(form.viscosidad)<380 && Number(form.azufre)<0.5 && Number(form.tsa)<0.1
  : Number(form.agua_destilacion)<0.5 && Number(form.flash_point)>=60;
    const campos = {
      viaje_id:form.viaje_id||null,
      fecha:form.fecha||today(),
      proveedor:form.proveedor||null,
      producto:form.producto||null,
      placa:form.placa||null,
      cedula:form.cedula||null,
      fecha_cargue:form.fecha_cargue||null,
      fecha_llegada:form.fecha_llegada||null,
      api_reportado:Number(form.api_reportado||0),
      api_observado:Number(form.api_observado||0),
      api_corregido:Number(form.api_corregido||0),
      temp_observada:Number(form.temp_observada||0),
      temp_observada_f:Number(form.temp_observada_f||0),
      factor_conversion:Number(form.factor_conversion||0),
      factor_tabla13:Number(form.factor_tabla13||0),
      agua_destilacion:Number(form.agua_destilacion||0),
      flash_point:Number(form.flash_point||0),
      viscosidad:Number(form.viscosidad||0),
      azufre:Number(form.azufre||0),
      tsa:Number(form.tsa||0),
      observaciones:form.observaciones||null,
      tipo_analisis:form.tipo_analisis||"Tiquetes MP",
      autoriza:aprueba,
      autoriza_nombre:perfil.nombre,
      resultado:aprueba?"APROBADO":"RECHAZADO",
    };
    if (form.id) {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/tiquetes?id=eq.${encodeURIComponent(form.id)}`, {
        method:"PATCH",
        headers:{"apikey":SUPABASE_SERVICE_KEY,"Authorization":`Bearer ${SUPABASE_SERVICE_KEY}`,"Content-Type":"application/json","Prefer":"return=representation"},
        body:JSON.stringify(campos)
      });
      if (!res.ok) { setSaving(false); return showToast("Error: "+await res.text(), false); }
      if (form.viaje_id) {
        await fetch(`${SUPABASE_URL}/rest/v1/viajes?id=eq.${form.viaje_id}`, {
          method:"PATCH",
          headers:{"apikey":SUPABASE_SERVICE_KEY,"Authorization":`Bearer ${SUPABASE_SERVICE_KEY}`,"Content-Type":"application/json"},
          body:JSON.stringify({estado:aprueba?"En Planta":"Rechazado"})
        });
      }
      setSaving(false);
      await loadData(); setModal(null); setForm({});
      showToast(`Tiquete ${form.id} actualizado — ${aprueba?"APROBADO":"RECHAZADO"}`);
    } else {
      const id = `TQ-${String(tiquetes.length+1+19571).padStart(5,"0")}`;
      const {error} = await supabaseAdmin.from("tiquetes").insert([{
        id,
        ...campos,
        creado_por:session.user.id,
      }]);
      if (!error && form.viaje_id) {
        await supabaseAdmin.from("viajes").update({estado:aprueba?"En Planta":"Rechazado", tiquete_id:id}).eq("id",form.viaje_id);
      }
      setSaving(false);
      if (error) return showToast("Error: "+error.message,false);
      await loadData(); setModal(null); setForm({});
      showToast(aprueba?"Tiquete emitido — APROBADO ✔":"Tiquete emitido — RECHAZADO",aprueba);
    }
  }

  async function guardarPBS(e) {
    e.preventDefault(); setSaving(true);
    if (form.id) {
      const {error} = await supabaseAdmin.from("pbs").update({
        ...form, checklist:pbsChecklist,
      }).eq("id", form.id);
      setSaving(false);
      if (error) return showToast("Error: "+error.message,false);
      await loadData();
      if (pbsParaCarro !== null) {
        const snap = cmtSnapshot;
        if (snap) {
          setForm({...snap.form});
          setCmtAntes(snap.cmtAntes);
          setCmtDespues(snap.cmtDespues);
          setCmtCarros(snap.cmtCarros);
          setCmtProducto(snap.cmtProducto);
          setCmtRecepcion(snap.cmtRecepcion);
          setCmtSnapshot(null);
        }
        setPbsParaCarro(null);
        setModal("cmt");
        setTimeout(() => cmtCarrosRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 150);
      } else { setModal(null); setForm({}); }
      setPbsChecklist(Array(26).fill(""));
      showToast(`PBS ${form.id} guardado`);
    } else {
      const id = `PBS-${String(pbsList.length+1+19454).padStart(5,"0")}`;
      const {error} = await supabaseAdmin.from("pbs").insert([{
        id, ...form, checklist:pbsChecklist, fecha:today(),
        firma_auxiliar:perfil.nombre, creado_por:session.user.id
      }]);
      setSaving(false);
      if (error) return showToast("Error: "+error.message,false);
      await loadData(); setPbsChecklist(Array(26).fill(""));
      if (pbsParaCarro !== null || pbsEsTrasiego) {
        const snap = cmtSnapshot;
        if (snap) {
          if (pbsEsTrasiego) {
            setForm({...snap.form, pbs_id: id});
          } else {
            setForm({...snap.form});
            setCmtCarros(snap.cmtCarros.map((c,j)=> j===pbsParaCarro ? {...c, pbs_id:id} : c));
          }
          setCmtAntes(snap.cmtAntes);
          setCmtDespues(snap.cmtDespues);
          setCmtProducto(snap.cmtProducto);
          setCmtRecepcion(snap.cmtRecepcion);
          setCmtSnapshot(null);
        } else {
          if (pbsEsTrasiego) {
            setForm(prev=>({...prev, pbs_id: id}));
          } else {
            const n = [...cmtCarros];
            n[pbsParaCarro].pbs_id = id;
            setCmtCarros(n);
          }
        }
        setPbsParaCarro(null);
        setPbsEsTrasiego(false);
        // Go back to existing CMT tab or open a new one
        setTabs(prevTabs => {
          const cmtTab = prevTabs.find(t => t.type === 'form' && t.formType === 'cmt');
          const pbsTabId = activeTabId;
          if (cmtTab) {
            setActiveTabId(cmtTab.id);
            setTimeout(() => cmtCarrosRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 150);
            return prevTabs.filter(t => t.id !== pbsTabId);
          } else {
            // Open new CMT tab
            const newId = `form-cmt-${Date.now()}`;
            setTimeout(() => { setActiveTabId(newId); setTimeout(() => cmtCarrosRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 150); }, 0);
            return [...prevTabs.filter(t => t.id !== pbsTabId), { id: newId, type:'form', formType:'cmt', title:'Nuevo CMT', icon:'📋', closeable:true }];
          }
        });
        showToast(`PBS ${id} creado y vinculado al trasiego`);
      } else {
        setModal(null); setForm({});
        showToast(`PBS ${id} registrado correctamente`);
      }
    }
  }
async function calcularGalonesConSetter(tanque, ullage, temp, api, index, setter, campoGalones="galones") {
  if (!tanque || !ullage) return;
  const ullageNum = Number(ullage);
  const {data} = await supabase.from("aforo").select("galones_brutos").eq("tanque",tanque).eq("ullage_mm",ullageNum).maybeSingle();
  if (!data) return;
  const galonesB = Number(data.galones_brutos);
  let galonesResult = Math.round(galonesB);
  let vcfResult = null;
  if (temp && api) {
    const tempF = (Number(temp)*9/5)+32;
    const deltaT = tempF-60;
    const apiNum = Number(api);
    const rho = (141.5*999.012)/(131.5+apiNum);
    const k0 = apiNum<40?103.872:330.301;
    const k1 = apiNum<40?0.2701:0.6;
    const alpha = k0/(rho*rho)+k1/rho;
    const vcf = Math.exp(-alpha*deltaT*(1+0.8*alpha*deltaT));
    galonesResult = Math.round(galonesB*vcf);
    vcfResult = vcf.toFixed(4);
  }
  setter(prev => prev.map((r,j) => j===index ? {...r, [campoGalones]:galonesResult, galones_brutos:Math.round(galonesB), ...(vcfResult?{vcf:vcfResult}:{})} : r));
}
async function calcularGalones(tanque, ullage, temp, api, esDespues, index) {
  await calcularGalonesConSetter(tanque, ullage, temp, api, index, esDespues ? setCmtDespues : setCmtAntes);
}
  async function guardarCMT(e) {
    e.preventDefault(); setSaving(true);

    // Validaciones de campos requeridos
    const errores = [];
    if (!(form.fecha||"").trim()) errores.push("Fecha");
    if (!(form.tipo_operacion||"").trim()) errores.push("Tipo de Operación");
    if (!cmtProducto) errores.push("Producto del CMT");
    const tipoOp = (form.tipo_operacion||"");
    if (tipoOp === "DESCARGUE DE CARROTANQUE") {
      if (cmtCarros.length === 0) errores.push("Debe agregar al menos un Carro Descargado");
      else {
        cmtCarros.forEach((c, i) => {
          if (!c.placa) errores.push(`Carro ${i+1}: Placa`);
          if (!c.hora_inicio) errores.push(`Carro ${i+1}: Hora Inicio`);
          if (!c.hora_final) errores.push(`Carro ${i+1}: Hora Final`);
          if (!c.peso_ingreso) errores.push(`Carro ${i+1}: Peso Ingreso`);
          if (!c.peso_salida) errores.push(`Carro ${i+1}: Peso Salida`);
        });
      }
    }
    if (tipoOp === "ENTREGA A MOTONAVE" && !(form.nombre_motonave||"").trim()) errores.push("Nombre de la Motonave");
    if (errores.length > 0) {
      setSaving(false);
      return showToast(`Campos requeridos:\n• ${errores.join("\n• ")}`, false);
    }

    const totalAntes = cmtAntes.reduce((a,t)=>a+Number(t.galones||0),0);
    const totalDespues = cmtDespues.reduce((a,t)=>a+Number(t.galones||0),0);
    const totalMovido = totalDespues - totalAntes;
    if (!form.id && tipoOp !== "TRASIEGO DE PRODUCTO" && totalMovido<=0) { setSaving(false); return showToast("El total después debe ser mayor que antes",false); }

    if (form.id) {
      // EDICIÓN: revertir impacto original y aplicar nuevo
      const original = cmts.find(c=>c.id===form.id);
      const {error} = await supabaseAdmin.from("cmts").update({
        numero_cmt:form.numero_cmt, pbs_id:form.pbs_id||null,
        tiquete_entrada:form.tiquete_entrada||null, producto:cmtProducto,
        tipo_operacion:form.tipo_operacion, tanques_antes:cmtAntes,
        tanques_despues:cmtDespues, tanques_recepcion:cmtRecepcion, total_antes:totalAntes,
        total_despues:totalDespues, total_movido:totalMovido,
        sede:form.sede||"", planta:form.planta||"", operador:form.operador||"",
        placa:form.placa||"", carros:cmtCarros, guia:form.guia||"",
        nombre_motonave:form.nombre_motonave||"",
        peso_neto_salida:form.peso_neto_salida||"",
      }).eq("id", form.id);
      if (!error && original) {
        // Calcular impacto neto por tanque: (nuevo - anterior) - (original_despues - original_antes)
        const tanquesAfectados = new Set([
          ...(original.tanques_despues||[]).map(t=>t.tanque),
          ...cmtDespues.map(t=>t.tanque),
        ].filter(Boolean));
        for (const tanqueId of tanquesAfectados) {
          const origAntes = (original.tanques_antes||[]).find(t=>t.tanque===tanqueId);
          const origDespues = (original.tanques_despues||[]).find(t=>t.tanque===tanqueId);
          const nuevoAntes = cmtAntes.find(t=>t.tanque===tanqueId);
          const nuevoDespues = cmtDespues.find(t=>t.tanque===tanqueId);
          const diffOrig = Number(origDespues?.galones||0) - Number(origAntes?.galones||0);
          const diffNuevo = Number(nuevoDespues?.galones||0) - Number(nuevoAntes?.galones||0);
          const ajuste = diffNuevo - diffOrig;
          if (ajuste !== 0) {
            const tq = tanques.find(t=>t.id===tanqueId);
            if (tq) await supabaseAdmin.from("tanques").update({nivel:Math.max(0, tq.nivel+ajuste)}).eq("id",tanqueId);
          }
        }
        const placasCarros = cmtCarros.map(c=>c.placa).filter(Boolean);
        if (placasCarros.length > 0) {
          for (const placa of placasCarros) await supabaseAdmin.from("viajes").update({estado:"Descargado"}).eq("placa",placa);
        } else if (form.placa) {
          await supabaseAdmin.from("viajes").update({estado:"Descargado"}).eq("placa",form.placa);
        }
      }
      setSaving(false);
      if (error) return showToast("Error: "+error.message,false);
      await loadData(); setModal(null); setForm({});
      setCmtAntes([{tanque:"",sonda:"",galones:""}]); setCmtProducto("");
      setCmtCarros([{placa:"",guia:"",tiquete:"",pbs_id:""}]);
      setCmtDespues([{tanque:"",producto:"",sonda:"",galones:""}]);
      setCmtRecepcion([{tanque:"",sondaInicial:"",tempInicial:"",apiInicial:"",galonesInicial:"",sondaFinal:"",tempFinal:"",apiFinal:"",galonesFinal:""}]);
      showToast(`CMT ${form.numero_cmt} corregido — ${fmt(totalMovido)} Gls`);
    } else {
      const sedeActual = form.sede || perfil.sede || "MALAMBO";
      const plantaActual = sedeActual === "MALAMBO" ? (form.planta || perfil.planta || "PLANTA 1") : "";
      const numeroCmt = form.numero_cmt || genIdCMT(cmts, sedeActual, plantaActual);
      const id = `${numeroCmt}`;
      const {error} = await supabaseAdmin.from("cmts").insert([{
        id, numero_cmt:numeroCmt, pbs_id:form.pbs_id||null,
        tiquete_entrada:form.tiquete_entrada||null, fecha:form.fecha||today(),
        producto:cmtProducto,
        tipo_operacion:form.tipo_operacion, tanques_antes:cmtAntes,
        tanques_despues:cmtDespues, tanques_recepcion:cmtRecepcion, total_antes:totalAntes,
        total_despues:totalDespues, total_movido:totalMovido,
        sede:sedeActual, planta:plantaActual,
        placa:form.placa||"", carros:cmtCarros, guia:form.guia||"",
        nombre_motonave:form.nombre_motonave||"",
        peso_neto_salida:form.peso_neto_salida||"",
        operador:perfil.nombre, creado_por:session.user.id
      }]);
      if (!error) {
        for (const td of cmtDespues) {
          const ta = cmtAntes.find(t=>t.tanque===td.tanque);
          if (ta && td.tanque) {
            const diff = Number(td.galones||0)-Number(ta.galones||0);
            const tanque = tanques.find(t=>t.id===td.tanque);
            if (tanque) await supabaseAdmin.from("tanques").update({nivel:Math.max(0,tanque.nivel+diff)}).eq("id",td.tanque);
          }
        }
        const placasCarros = cmtCarros.map(c=>c.placa).filter(Boolean);
        if (placasCarros.length > 0) {
          for (const placa of placasCarros) await supabaseAdmin.from("viajes").update({estado:"Descargado"}).eq("placa",placa);
        } else if (form.placa) {
          await supabaseAdmin.from("viajes").update({estado:"Descargado"}).eq("placa",form.placa);
        }
      }
      setSaving(false);
      if (error) return showToast("Error: "+error.message,false);
      await loadData(); setModal(null); setForm({});
      setCmtAntes([{tanque:"",sonda:"",galones:""}]); setCmtProducto("");
      setCmtCarros([{placa:"",guia:"",tiquete:"",pbs_id:""}]);
      setCmtDespues([{tanque:"",producto:"",sonda:"",galones:""}]);
      setCmtRecepcion([{tanque:"",sondaInicial:"",tempInicial:"",apiInicial:"",galonesInicial:"",sondaFinal:"",tempFinal:"",apiFinal:"",galonesFinal:""}]);
      showToast(`CMT ${form.numero_cmt} registrado — ${fmt(totalMovido)} Gls`);
    }
  }

  async function guardarDespacho(e) {
    e.preventDefault(); setSaving(true);
    const vol = Number(form.volumen||0);
    if (form.id) {
      const original = despachos.find(d=>d.id===form.id);
      const volOrig = Number(original?.volumen||0);
      const tqOrig = tanques.find(t=>t.id===original?.tanque);
      const tqNuevo = tanques.find(t=>t.id===form.tanque);
      const mismoTanque = form.tanque === original?.tanque;
      const nivelDisponible = mismoTanque ? (tqOrig?.nivel||0)+volOrig : (tqNuevo?.nivel||0);
      if (vol > nivelDisponible) { setSaving(false); return showToast("Volumen supera stock disponible",false); }
      const {error} = await supabaseAdmin.from("despachos").update({...form, volumen:vol}).eq("id",form.id);
      if (!error) {
        if (mismoTanque && tqOrig) {
          await supabaseAdmin.from("tanques").update({nivel: tqOrig.nivel + volOrig - vol}).eq("id",form.tanque);
        } else {
          if (tqOrig) await supabaseAdmin.from("tanques").update({nivel: tqOrig.nivel + volOrig}).eq("id",original.tanque);
          if (tqNuevo) await supabaseAdmin.from("tanques").update({nivel: tqNuevo.nivel - vol}).eq("id",form.tanque);
        }
      }
      setSaving(false);
      if (error) return showToast("Error: "+error.message,false);
      await loadData(); setModal(null); setForm({});
      showToast(`Despacho ${form.id} actualizado`);
    } else {
      const tanque = tanques.find(t=>t.id===form.tanque);
      if (!tanque||vol>tanque.nivel) { setSaving(false); return showToast("Volumen supera stock disponible",false); }
      const id = genId("DSP", despachos);
      const {error} = await supabaseAdmin.from("despachos").insert([{
        id, ...form, volumen:vol, operador:perfil.nombre,
        sede: form.sede || perfil.sede || "MALAMBO",
        fecha:today(), creado_por:session.user.id
      }]);
      if (!error) await supabaseAdmin.from("tanques").update({nivel:tanque.nivel-vol}).eq("id",form.tanque);
      setSaving(false);
      if (error) return showToast("Error: "+error.message,false);
      await loadData(); setModal(null); setForm({});
      showToast(`Despacho ${id} — ${fmt(vol)} Gls a ${form.buque}`);
    }
  }

  // ── LOADING ──
  if (loading) return (
    <div style={{ minHeight:"100vh", background:T.navy, display:"flex", alignItems:"center", justifyContent:"center" }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{ textAlign:"center" }}>
        <Spinner />
        <div style={{ color:"#ffffff99", fontSize:12, marginTop:12 }}>Cargando...</div>
      </div>
    </div>
  );

  // ── LOGIN / REGISTRO ──
  if (!session) return (
    <div style={{ minHeight:"100vh", background:T.navy, display:"flex", alignItems:"center", justifyContent:"center" }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{ width:420, background:T.card, borderRadius:12, overflow:"hidden", boxShadow:"0 24px 64px rgba(0,0,0,0.4)" }}>
        <div style={{ background:T.navy, borderBottom:`3px solid ${T.orange}`, padding:"28px 32px", textAlign:"center" }}>
          <div style={{ fontSize:32, marginBottom:8 }}>🚢</div>
          <div style={{ fontWeight:800, fontSize:22, color:"#ffffff", letterSpacing:2 }}>BunkersGest</div>
          <div style={{ fontSize:10, color:"#ffffff88", marginTop:4, letterSpacing:3 }}>SISTEMA DE GESTIÓN OPERATIVA · COMBUSTIBLE MARINO</div>
        </div>
        <div style={{ padding:32 }}>
          {authError && <div style={{ background:authError.includes("creada")?`${T.success}18`:`${T.danger}18`, border:`1px solid ${authError.includes("creada")?T.success:T.danger}`, borderRadius:6, padding:"10px 14px", fontSize:12, color:authError.includes("creada")?T.success:T.danger, marginBottom:16 }}>{authError}</div>}
          {authMode==="login" ? (
            <>
              <Inp label="Cédula o Usuario" type="text" placeholder="Ej: 1234567890" value={authForm.cedula||""} onChange={af("cedula")} />
              <Inp label="Contraseña" type="password" placeholder="••••••••" value={authForm.password||""} onChange={af("password")} />
              <div style={{marginTop:4}}><Btn color={T.orange} onClick={handleLogin}>Iniciar Sesión</Btn></div>
            </>
          ) : (
            <>
              <Inp label="Nombre completo" type="text" placeholder="Tu nombre" value={authForm.nombre||""} onChange={af("nombre")} />
              <Inp label="Cédula" type="text" placeholder="Número de cédula" value={authForm.cedula||""} onChange={af("cedula")} />
              <Inp label="Contraseña" type="password" placeholder="Mínimo 6 caracteres" value={authForm.password||""} onChange={af("password")} />
              <Sel label="Rol" value={authForm.rol||""} onChange={af("rol")}>
                <option value="">Seleccionar rol...</option>
                {Object.entries(ROLES).map(([k,v])=><option key={k} value={k}>{v.icon} {v.label}</option>)}
              </Sel>
              <Sel label="Planta" value={authForm.planta||"QBS"} onChange={af("planta")}>
                {PLANTAS.map(p=><option key={p}>{p}</option>)}
              </Sel>
              <Btn color={T.navy} onClick={handleRegister}>Crear Cuenta</Btn>
              <div style={{ textAlign:"center", marginTop:14, fontSize:12, color:T.muted }}>
                ¿Ya tienes cuenta?{" "}
                <span onClick={()=>{setAuthMode("login");setAuthError("");}} style={{ color:T.orange, cursor:"pointer", fontWeight:700 }}>Inicia sesión</span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );

  if (!perfil) return (
    <div style={{ minHeight:"100vh", background:T.navy, display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div style={{ color:"#ffffff88", fontSize:13 }}>Cargando perfil...</div>
    </div>
  );

const rol = ROLES[perfil.rol] || ROLES.gerencia;
const permisos = perfil.permisos || {};
const puedeCrear = (modulo) => perfil.rol === 'administrador' || (permisos[modulo]?.crear === true);
const puedeEditar = (modulo, creado_por, created_at) => {
  if (perfil.rol === 'administrador') return true;
  if (!permisos[modulo]?.crear) return false;
  if (creado_por !== session.user.id) return false;
  const horas = (new Date() - new Date(created_at)) / 1000 / 3600;
  return horas <= 72;
};
  const ALL_MODULOS = ["dashboard","viajes","tiquetes","pbs","tanques","despacho","trazabilidad","usuarios"];
  const navItems = perfil.rol === "administrador"
    ? NAV_ROL.administrador
    : ALL_MODULOS.filter(m => {
        if (m === "dashboard") return true;
        if (m === "usuarios") return false;
        const base = (NAV_ROL[perfil.rol]||[]).includes(m);
        const permiso = permisos[m]?.ver === true;
        return base || permiso;
      });

  // Colecciones filtradas por sede
  const filtraSede = (arr, campo="sede") =>
    sedeFiltro === "TODAS" ? arr : arr.filter(r => (r[campo]||"MALAMBO") === sedeFiltro);
  const viajesFiltrados   = filtraSede(viajes);
  const tiquetesFiltrados = filtraSede(tiquetes, "sede");
  const cmtsFiltrados     = filtraSede(cmts, "sede");
  const despachosFiltrados= filtraSede(despachos, "sede");

  const enRuta = viajesFiltrados.filter(v=>v.estado==="En Ruta").length;
  const pendTiquetes = viajesFiltrados.filter(v=>v.estado==="En Planta"&&!v.tiquete_id).length;
  const pendPBS = tiquetesFiltrados.filter(t=>t.resultado==="APROBADO"&&!pbsList.find(p=>p.viaje_id===t.viaje_id)).length;
  const pendCMT = pbsList.filter(p=>!cmtsFiltrados.find(c=>c.pbs_id===p.id)).length;

  return (
    <div style={{ fontFamily:"system-ui,sans-serif", background:T.bg, height:"100vh", overflow:"hidden", display:"flex", flexDirection:"column", color:T.text }}>
      <style>{`html,body{margin:0;padding:0;overflow:hidden;height:100%} @keyframes spin{to{transform:rotate(360deg)}} @keyframes fadeSlideIn{from{opacity:0;transform:translateX(-8px)}to{opacity:1;transform:translateX(0)}}`}</style>

      {toast && <div style={{ position:"fixed", top:18, right:18, zIndex:9999, background:toast.ok?T.success:T.danger, borderRadius:8, padding:"12px 20px", color:"#ffffff", fontSize:13, fontWeight:700, boxShadow:"0 4px 16px rgba(0,0,0,0.25)", maxWidth:360 }}>{toast.msg}</div>}

      {/* Header */}
      <div style={{ background:T.navy, borderBottom:`3px solid ${T.orange}`, padding:"0 24px", height:64, display:"flex", alignItems:"center", justifyContent:"space-between", flexShrink:0 }}>
        <div style={{ display:"flex", alignItems:"center", gap:14 }}>
          <span style={{ fontSize:28 }}>🚢</span>
          <div>
            <div style={{ fontWeight:800, fontSize:18, color:"#ffffff", letterSpacing:2 }}>BunkersGest <span style={{color:T.orange, fontSize:12, fontWeight:700}}>v2.0</span></div>
            <div style={{ fontSize:9, color:"#ffffff66", letterSpacing:2, textTransform:"uppercase" }}>Sistema de Gestión Operativa · Combustible Marino</div>
          </div>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:16 }}>
          <div style={{ textAlign:"right" }}>
            <div style={{ fontSize:13, fontWeight:700, color:"#ffffff" }}>{(perfil.nombre||"").split(" ")[0]}</div>
            <div style={{ fontSize:10, color:T.orange }}>{rol.icon} {rol.label} · {perfil.sede||"MALAMBO"} · <span style={{color:T.success}}>● EN VIVO</span></div>
          </div>
          <Btn sm color={T.danger} onClick={handleLogout}>Salir</Btn>
        </div>
      </div>

      {/* Tab bar */}
      <div style={{ background:T.card, borderBottom:`1px solid ${T.border}`, padding:"0 16px", display:"flex", alignItems:"stretch", gap:0, overflowX:"auto", minHeight:38, flexShrink:0 }}>
        {tabs.map(tab => {
          const isActive = tab.id === activeTabId;
          return (
            <div key={tab.id}
              onClick={() => switchToTab(tab.id)}
              style={{ display:'flex', alignItems:'center', gap:6, padding:'0 14px', cursor:'pointer',
                borderBottom:`2px solid ${isActive ? T.orange : 'transparent'}`,
                borderRight:`1px solid ${T.border}`,
                background: isActive ? `${T.orange}10` : 'transparent',
                color: isActive ? T.orange : T.muted,
                fontWeight: isActive ? 700 : 400,
                fontSize:12, whiteSpace:'nowrap', flexShrink:0, minHeight:38,
                transition:'background 0.12s, color 0.12s',
              }}>
              <span style={{fontSize:13}}>{tab.icon}</span>
              <span>{tab.title}</span>
              {tab.closeable && (
                <button onClick={e => { e.stopPropagation(); closeTab(tab.id); }}
                  style={{ background:'none', border:'none', color:'inherit', cursor:'pointer', fontSize:14, padding:'0 0 0 4px', lineHeight:1, opacity:0.6 }}>×</button>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ display:"flex", flex:1, overflow:"hidden" }}>
        {/* Sidebar */}
        <div style={{ width:58, background:T.sidebar, borderRight:`1px solid rgba(255,255,255,0.06)`, padding:"10px 0", flexShrink:0, display:"flex", flexDirection:"column", alignItems:"center", gap:2, zIndex:100, overflow:"visible" }}>
          {(()=>{
            const GRUPOS = {
              viajes:   { icon:"🚛", label:"LOGÍSTICA",    subs:[{id:"viajes",label:"Listado Tránsito"},{id:"listado_planta",label:"Listado Planta"}] },
              tiquetes: { icon:"🧪", label:"LABORATORIO",  subs:[{id:"tiquetes",label:"Análisis",badge:pendTiquetes},{id:"resultados",label:"Resultados"}] },
              pbs:      { icon:"⚙️", label:"OPERACIONES",  subs:[{id:"pbs",label:"PBS",badge:pendPBS},{id:"cmt",label:"CMT",badge:pendCMT}] },
            };
            const badges = {};

            const btnStyle = (active, isHov, color) => ({
              width:42, height:42, border:"none", borderRadius:8, cursor:"pointer",
              display:"flex", alignItems:"center", justifyContent:"center", fontSize:18,
              transition:"background 0.15s, transform 0.15s",
              background: active ? T.orange : isHov ? "rgba(255,107,53,0.2)" : "transparent",
              transform: isHov ? "scale(1.08)" : "scale(1)",
              color: active ? "#ffffff" : isHov ? T.orange : "rgba(255,255,255,0.45)",
              position:"relative", outline:"none",
            });

            const flyoutBase = {
              position:"absolute", left:"100%", top:"-4px",
              paddingLeft:6, zIndex:9999, pointerEvents:"auto",
            };
            const flyoutInner = {
              background:T.sidebar,
              border:`1px solid rgba(255,255,255,0.1)`,
              borderLeft:`3px solid ${T.orange}`,
              borderRadius:"0 8px 8px 0",
              padding:"6px 0", minWidth:200,
              boxShadow:"8px 8px 32px rgba(0,0,0,0.4)",
              animation:"fadeSlideIn 0.15s ease",
            };

            const tooltipBase = {
              position:"absolute", left:"100%", top:"50%",
              paddingLeft:8, zIndex:9999, pointerEvents:"none",
            };
            const tooltipInner = {
              background:T.sidebar, border:`1px solid rgba(255,255,255,0.1)`, borderRadius:6,
              padding:"5px 12px", fontSize:11, color:"#ffffff",
              whiteSpace:"nowrap", boxShadow:"4px 4px 16px rgba(0,0,0,0.3)",
              transform:"translateY(-50%)",
              animation:"fadeSlideIn 0.12s ease",
            };

            const leaveTimer = {current:null};
            const onEnter = id => { clearTimeout(leaveTimer.current); setNavHovered(id); };
            const onLeave = ()  => { leaveTimer.current = setTimeout(()=>setNavHovered(null), 80); };

            const items = navItems.map(id => {
              const grupo = GRUPOS[id];
              if (grupo) {
                const active = grupo.subs.some(s=>s.id===nav);
                const isHov = navHovered===id;
                return (
                  <div key={id} style={{position:"relative", width:40}}
                    onMouseEnter={()=>onEnter(id)} onMouseLeave={onLeave}>
                    <button style={{...btnStyle(active, isHov, rol.color)}}>
                      {grupo.icon}
                    </button>
                    {isHov && (
                      <div style={flyoutBase} onMouseEnter={()=>onEnter(id)} onMouseLeave={onLeave}>
                        <div style={{...flyoutInner, borderLeftColor: rol.color+"88"}}>
                          <div style={{padding:"8px 16px 8px",fontSize:10,color:T.orange,fontWeight:800,letterSpacing:2,textTransform:"uppercase",borderBottom:"1px solid rgba(255,255,255,0.08)",marginBottom:4}}>{grupo.label}</div>
                          {grupo.subs.map(sub=>{
                            const subActive = nav===sub.id;
                            return (
                              <button key={sub.id} onClick={()=>{setNav(sub.id);setNavHovered(null);setAnalisisNav("");}}
                                style={{width:"100%",textAlign:"left",background:subActive?T.orange:"transparent",border:"none",borderLeft:`3px solid ${subActive?T.orange:"transparent"}`,padding:"9px 16px",color:subActive?"#ffffff":"rgba(255,255,255,0.65)",fontSize:12,fontFamily:"system-ui,sans-serif",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"space-between",transition:"background 0.12s, color 0.12s",boxSizing:"border-box",fontWeight:subActive?700:400}}
                                onMouseEnter={e=>{ if(!subActive){e.currentTarget.style.background="rgba(255,107,53,0.15)"; e.currentTarget.style.color="#ffffff";} }}
                                onMouseLeave={e=>{ if(!subActive){e.currentTarget.style.background="transparent"; e.currentTarget.style.color="rgba(255,255,255,0.65)";} }}>
                                <span>{sub.label}</span>
                                {sub.badge>0&&<span style={{background:T.danger,color:"#fff",fontSize:9,fontWeight:700,borderRadius:10,padding:"1px 6px"}}>{sub.badge}</span>}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              }
              const m = NAV_META[id];
              const active = nav===id;
              const badge = badges[id]||0;
              const isHov = navHovered===id;
              return (
                <div key={id} style={{position:"relative", width:40}}
                  onMouseEnter={()=>onEnter(id)} onMouseLeave={onLeave}>
                  <button onClick={()=>setNav(id)} style={btnStyle(active, isHov, rol.color)}>
                    {m.icon}
                    {badge>0&&<span style={{position:"absolute",top:2,right:2,background:"#ff4d4d",color:"#fff",fontSize:8,fontWeight:700,borderRadius:8,padding:"1px 4px",lineHeight:1}}>{badge}</span>}
                  </button>
                  {isHov && <div style={tooltipBase}><div style={tooltipInner}>{m.label}</div></div>}
                </div>
              );
            });
            items.push(
              <div key="reload" style={{position:"relative", width:40, marginTop:"auto"}}
                onMouseEnter={()=>onEnter("reload")} onMouseLeave={onLeave}>
                <button onClick={loadData} style={btnStyle(false, navHovered==="reload", "#6b8fa8")}>🔄</button>
                {navHovered==="reload" && <div style={tooltipBase}><div style={tooltipInner}>Actualizar</div></div>}
              </div>
            );
            return items;
          })()}
        </div>

        {/* Content */}
        <div style={{ flex:1, padding: modal ? 0 : 24, overflowY: modal ? "hidden" : "auto", background:T.bg }}>

          {/* DASHBOARD */}
          {nav==="dashboard" && (
            <div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:4,flexWrap:"wrap",gap:8}}>
                <div style={{ fontWeight:800, fontSize:20, color:T.navy }}>Panel Operativo</div>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  {(sedeFiltro==="TODAS"||["administrador","gerencia"].includes(perfil.rol)) && (
                    <select value={sedeFiltro} onChange={e=>setSedeFiltro(e.target.value)}
                      style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:6,padding:"6px 12px",color:T.text,fontSize:12,outline:"none",cursor:"pointer"}}>
                      <option value="TODAS">Todas las sedes</option>
                      {SEDES.map(s=><option key={s}>{s}</option>)}
                    </select>
                  )}
                  {!["administrador","gerencia"].includes(perfil.rol) && (
                    <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:6,padding:"6px 12px",color:T.navy,fontSize:12,fontWeight:700}}>
                      📍 {sedeFiltro}
                    </div>
                  )}
                </div>
              </div>
              <div style={{ fontSize:11, color:T.muted, marginBottom:22 }}>QBS · {new Date().toLocaleDateString("es-CO",{weekday:"long",day:"numeric",month:"long",year:"numeric"})}</div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))", gap:12, marginBottom:22 }}>
                <Stat label="🚚 Carros en Ruta" value={enRuta} color={T.orange} sub="hacia planta" />
                <Stat label="⏳ Tiquetes Pend." value={pendTiquetes} color={T.navy} sub="esperan laboratorio" />
                <Stat label="⚙️ PBS Pendientes" value={pendPBS} color="#f59e0b" sub="esperan operaciones" />
                <Stat label="✅ CMT Pendientes" value={pendCMT} color={T.success} sub="esperan coordinador" />
                <Stat label="⛽ Stock VLSFO" value={`${fmt(tanques.filter(t=>t.producto==="VLSFO").reduce((a,t)=>a+t.nivel,0))} Gls`} color={T.success} />
                <Stat label="⛽ Stock MGO" value={`${fmt(tanques.filter(t=>t.producto==="MGO").reduce((a,t)=>a+t.nivel,0))} Gls`} color={T.navy} />
              </div>
              <div style={{ fontWeight:800, fontSize:14, color:T.navy, marginBottom:12, paddingBottom:6, borderBottom:`2px solid ${T.orange}22` }}>🛢 Inventario de Tanques</div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))", gap:10 }}>
                {tanques.map(t=>{
                  const pct = Math.round((t.nivel/t.capacidad)*100);
                  const barColor = pct > 80 ? T.danger : pct > 50 ? T.success : "#f59e0b";
                  return (
                  <Card key={t.id} style={{ padding:"14px 16px" }}>
                    <div style={{ display:"flex", justifyContent:"space-between", marginBottom:8 }}>
                      <div>
                        <div style={{ fontWeight:800, fontSize:13, color:T.navy }}>{t.id}</div>
                        <div style={{ fontSize:10, color:T.muted }}>{t.producto}</div>
                      </div>
                      <Badge label={TIPO_LABEL[t.tipo]} color={TIPO_COLOR[t.tipo]} />
                    </div>
                    <div style={{ background:T.border, borderRadius:4, height:8, overflow:"hidden", marginBottom:6 }}>
                      <div style={{ height:"100%", width:`${pct}%`, background:barColor, borderRadius:4, transition:"width 0.3s" }} />
                    </div>
                    <div style={{ display:"flex", justifyContent:"space-between", fontSize:10 }}>
                      <span style={{ color:T.muted }}>{fmt(t.nivel)} / {fmt(t.capacidad)} Gls</span>
                      <span style={{ fontWeight:800, color:barColor }}>{pct}%</span>
                    </div>
                  </Card>
                  );
                })}
              </div>
            </div>
          )}

          {/* VIAJES */}
          {nav==="viajes" && (()=>{
            const selStyle = {background:T.card,border:`1px solid ${T.border}`,borderRadius:6,padding:"6px 10px",color:T.text,fontSize:11,fontFamily:"system-ui,sans-serif",outline:"none"};
            const productosUnicos = [...new Set(viajesFiltrados.map(v=>v.producto).filter(Boolean))].sort();
            const viajesFinal = viajesFiltrados.filter(v=>{
              const q = viajesBusqueda.toLowerCase();
              if (q && ![(v.placa||""),(v.guia||""),(v.transportadora||""),(v.producto||""),(v.id||"")].some(x=>x.toLowerCase().includes(q))) return false;
              // Por defecto solo mostrar En Ruta (carros aún en tránsito)
              const estadoFiltro = viajesFiltroEstado || "En Ruta";
              if (v.estado !== estadoFiltro) return false;
              if (viajesFiltroProducto && v.producto !== viajesFiltroProducto) return false;
              if (viajesFiltroFechaD && v.fecha < viajesFiltroFechaD) return false;
              if (viajesFiltroFechaH && v.fecha > viajesFiltroFechaH) return false;
              return true;
            }).sort((a,b)=> new Date(b.fecha) - new Date(a.fecha));
            return (
            <div style={{display:"flex",flexDirection:"column",height:"calc(100vh - 120px)"}}>
              <div style={{flexShrink:0,marginBottom:12}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                  <div>
                    <div style={{ fontWeight:800, fontSize:20, color:T.navy }}>Listado Tránsito</div>
                    <div style={{ fontSize:11, color:T.muted }}>Carros en ruta · <b style={{color:"#f59e0b"}}>{viajesFinal.length}</b> resultado(s)</div>
                  </div>
                  {puedeCrear("viajes") && <Btn onClick={()=>{setForm({fecha:today(),sede:sedeFiltro==="TODAS"?"MALAMBO":sedeFiltro,planta:"PLANTA 1"});setModal("viaje");}}>+ Nuevo Viaje</Btn>}
                </div>
                <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
                  <input value={viajesBusqueda} onChange={e=>setViajesBusqueda(e.target.value)} placeholder="🔍 Buscar placa, guía, transportadora..." style={{...selStyle,width:240,padding:"6px 12px"}}/>
                  {["administrador","gerencia"].includes(perfil.rol) && (
                    <select value={sedeFiltro} onChange={e=>setSedeFiltro(e.target.value)} style={selStyle}>
                      <option value="TODAS">Todas las sedes</option>
                      {SEDES.map(s=><option key={s}>{s}</option>)}
                    </select>
                  )}
                  <select value={viajesFiltroEstado} onChange={e=>setViajesFiltroEstado(e.target.value)} style={selStyle}>
                    <option value="">Todos los estados</option>
                    <option>En Ruta</option>
                    <option>En Planta</option>
                    <option>Descargado</option>
                    <option>Rechazado</option>
                  </select>
                  <select value={viajesFiltroProducto} onChange={e=>setViajesFiltroProducto(e.target.value)} style={selStyle}>
                    <option value="">Todos los productos</option>
                    {productosUnicos.map(p=><option key={p}>{p}</option>)}
                  </select>
                  <input type="date" value={viajesFiltroFechaD} onChange={e=>setViajesFiltroFechaD(e.target.value)} style={selStyle} title="Fecha cargue desde"/>
                  <input type="date" value={viajesFiltroFechaH} onChange={e=>setViajesFiltroFechaH(e.target.value)} style={selStyle} title="Fecha cargue hasta"/>
                  {(viajesBusqueda||viajesFiltroEstado||viajesFiltroProducto||viajesFiltroFechaD||viajesFiltroFechaH) && (
                    <button onClick={()=>{setViajesBusqueda("");setViajesFiltroEstado("");setViajesFiltroProducto("");setViajesFiltroFechaD("");setViajesFiltroFechaH("");}} style={{background:"#ff4d4d22",border:"1px solid #ff4d4d44",borderRadius:8,color:"#ff4d4d",padding:"6px 12px",cursor:"pointer",fontSize:11,fontFamily:"monospace"}}>✕ Limpiar</button>
                  )}
                </div>
              </div>
              <div style={{flex:1,overflow:"auto",borderRadius:12,border:"1px solid #ffffff0a"}}>
              <Table
                cols={["ID","Sede","F. Cargue","F. Llegada","Producto","Transportadora","Placa","Guía","Gls Guía","Gls Recib.","Faltantes","Stand By","Estado",""]}
                rows={viajesFinal.map(v=>{
                  const faltantes = Math.max(0, Number(v.gls_netos_guia||v.volumen_guia||0) - Number(v.gls_recibidos||0));
                  // Stand by en horas desde llegada. Verde <8h, Amarillo 8-16h, Rojo 16-24h, luego días.
                  const sbFinalizado = !!(v.fecha_llegada && v.fecha_descargue);
                  const horasStandby = v.fecha_llegada
                    ? (new Date(v.fecha_descargue||new Date()) - new Date(v.fecha_llegada)) / 3600000
                    : null;
                  const diasStandby = horasStandby !== null ? Math.floor(horasStandby / 24) : null;
                  const horasRestantes = horasStandby !== null ? Math.floor(horasStandby % 24) : null;
                  const sbLabel = horasStandby === null ? null
                    : horasStandby < 24
                      ? `${Math.floor(horasStandby)}h`
                      : diasStandby === 1 ? `1d ${horasRestantes}h` : `${diasStandby}d ${horasRestantes}h`;
                  const sbColor = horasStandby === null ? null
                    : horasStandby < 8   ? "#00e5a0"
                    : horasStandby < 16  ? "#f59e0b"
                    : "#ff4d4d";
                  return [
                    <span style={{color:"#f59e0b"}}>{v.id}</span>,
                    <Badge label={v.sede||"MALAMBO"} color={v.sede==="SANTA MARTA"?"#c084fc":v.sede==="CARTAGENA"?"#fb923c":"#00b4ff"}/>,
                    v.fecha,
                    v.fecha_llegada||<span style={{color:T.muted,fontSize:10}}>—</span>,
                    v.producto, v.transportadora, v.placa, v.guia,
                    fmt(v.gls_netos_guia||v.volumen_guia||0),
                    v.gls_recibidos>0?<span style={{color:"#00e5a0",fontWeight:700}}>{fmt(v.gls_recibidos)}</span>:<span style={{color:T.muted,fontSize:10}}>—</span>,
                    faltantes>0?<span style={{color:"#ff4d4d",fontWeight:700}}>{fmt(faltantes)}</span>:<span style={{color:"#00e5a0"}}>OK</span>,
                    sbLabel !== null
                      ? <span style={{display:"inline-flex",alignItems:"center",gap:4}}>
                          <Badge label={sbLabel} color={sbColor}/>
                          {!sbFinalizado && horasStandby>=24 && <span style={{fontSize:9,color:"#ff4d4d",fontWeight:700}}>COBRO</span>}
                          {!sbFinalizado && horasStandby<24 && <span style={{fontSize:9,color:T.muted,fontStyle:"italic"}}>en curso</span>}
                        </span>
                      : <span style={{color:"#ffffff18"}}>—</span>,
                    <Badge label={v.estado} color={v.estado==="Descargado"?"#00e5a0":v.estado==="En Ruta"?"#f59e0b":v.estado==="Rechazado"?"#ff4d4d":"#00b4ff"}/>,
                    puedeEditar("viajes",v.creado_por,v.created_at)
                      ? <button onClick={()=>{setForm({...v});setModal("viaje");}} style={{background:"#f59e0b22",border:"1px solid #f59e0b55",borderRadius:6,color:"#f59e0b",padding:"3px 10px",fontSize:11,cursor:"pointer",fontFamily:"monospace"}}>✏ Editar</button>
                      : null,
                  ];
                })}
              />
              </div>
            </div>
            );
          })()}

          {/* LISTADO PLANTA */}
          {nav==="listado_planta" && (()=>{
            const selStyle = {background:T.card,border:`1px solid ${T.border}`,borderRadius:6,padding:"6px 10px",color:T.text,fontSize:11,fontFamily:"system-ui,sans-serif",outline:"none"};
            const productosPlanta = [...new Set(viajesFiltrados.map(v=>v.producto).filter(Boolean))].sort();
            const enPlanta = viajesFiltrados
              .filter(v => v.fecha_llegada)
              .filter(v => v.estado !== "Descargado")
              .filter(v => {
                const q = (plantaBusqueda||"").toLowerCase();
                if (q && ![(v.placa||""),(v.producto||""),(v.id||""),(v.guia||"")].some(x=>x.toLowerCase().includes(q))) return false;
                if (plantaFiltroProducto && v.producto !== plantaFiltroProducto) return false;
                if (plantaFiltroFechaD && v.fecha_llegada < plantaFiltroFechaD) return false;
                if (plantaFiltroFechaH && v.fecha_llegada > plantaFiltroFechaH) return false;
                return true;
              })
              .sort((a,b) => {
                if (a.turno_planta && b.turno_planta) return a.turno_planta - b.turno_planta;
                if (a.turno_planta) return -1;
                if (b.turno_planta) return 1;
                return new Date(a.updated_at||0) - new Date(b.updated_at||0);
              });
            const COLOR = "#00b4ff";
            return (
            <div style={{display:"flex",flexDirection:"column",height:"calc(100vh - 100px)"}}>
              {/* Header */}
              <div style={{flexShrink:0,marginBottom:12}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                  <div>
                    <div style={{fontWeight:800,fontSize:22,color:T.navy,letterSpacing:0.5}}>Listado Planta</div>
                    <div style={{fontSize:11,color:T.muted,marginTop:2}}>
                      Enturne de carros para descargue · <b style={{color:COLOR}}>{enPlanta.length}</b> carro(s)
                    </div>
                  </div>
                  <Btn onClick={()=>{setForm({fecha_llegada:today()});setModal("turno_carro");}}>+ TURNO CARRO</Btn>
                </div>
                <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
                  <input value={plantaBusqueda||""} onChange={e=>setPlantaBusqueda(e.target.value)} placeholder="🔍 Buscar placa, producto, guía..." style={{...selStyle,width:240,padding:"6px 12px"}}/>
                  {["administrador","gerencia"].includes(perfil.rol) && (
                    <select value={sedeFiltro} onChange={e=>setSedeFiltro(e.target.value)} style={selStyle}>
                      <option value="TODAS">Todas las sedes</option>
                      {SEDES.map(s=><option key={s}>{s}</option>)}
                    </select>
                  )}
                  <select value={plantaFiltroProducto||""} onChange={e=>setPlantaFiltroProducto(e.target.value)} style={selStyle}>
                    <option value="">Todos los productos</option>
                    {productosPlanta.map(p=><option key={p}>{p}</option>)}
                  </select>
                  <input type="date" value={plantaFiltroFechaD||""} onChange={e=>setPlantaFiltroFechaD(e.target.value)} style={selStyle} title="Llegada desde"/>
                  <input type="date" value={plantaFiltroFechaH||""} onChange={e=>setPlantaFiltroFechaH(e.target.value)} style={selStyle} title="Llegada hasta"/>
                  {(plantaBusqueda||plantaFiltroProducto||plantaFiltroFechaD||plantaFiltroFechaH) && (
                    <button onClick={()=>{setPlantaBusqueda("");setPlantaFiltroProducto("");setPlantaFiltroFechaD("");setPlantaFiltroFechaH("");}} style={{background:"#ff4d4d22",border:"1px solid #ff4d4d44",borderRadius:8,color:"#ff4d4d",padding:"6px 12px",cursor:"pointer",fontSize:11}}>✕ Limpiar</button>
                  )}
                </div>
              </div>

              {/* Tabla */}
              <div style={{flex:1,overflow:"auto",borderRadius:8,border:`1px solid ${T.border}`,background:T.card,boxShadow:"0 1px 3px rgba(0,0,0,0.06)"}}>
                <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                  <thead>
                    <tr style={{background:T.bg,position:"sticky",top:0,zIndex:2}}>
                      {["#","FECHA LLEGADA","FECHA CARGUE","PLACA","PRODUCTO","OBSERVACIONES",""].map((h,i)=>(
                        <th key={i} style={{padding:"11px 14px",textAlign:"left",fontSize:10,color:T.navy,fontWeight:700,letterSpacing:1.2,textTransform:"uppercase",borderBottom:`2px solid ${T.border}`,whiteSpace:"nowrap"}}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {enPlanta.length===0 && (
                      <tr><td colSpan={7} style={{padding:40,textAlign:"center",color:T.muted,fontSize:13}}>No hay carros en planta</td></tr>
                    )}
                    {enPlanta.map((v,idx)=>{
                      const llegó = !!v.fecha_llegada;
                      const turno = v.turno_planta||null;
                      return (
                        <tr key={v.id} style={{borderTop:`1px solid ${T.border}`,background:idx%2===0?T.card:"#eef2f7",transition:"background 0.12s"}}
                          onMouseEnter={e=>e.currentTarget.style.background="#dde6f0"}
                          onMouseLeave={e=>e.currentTarget.style.background=idx%2===0?T.card:"#eef2f7"}>
                          {/* Número de turno */}
                          <td style={{padding:"12px 14px"}}>
                            {turno
                              ? <div style={{width:28,height:28,borderRadius:"50%",background:turno===1?`${T.success}22`:`${T.orange}22`,border:`2px solid ${turno===1?T.success:T.orange}`,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,fontSize:12,color:turno===1?T.success:T.orange}}>{turno}</div>
                              : <div style={{width:28,height:28,borderRadius:"50%",background:"#f59e0b22",border:"2px solid #f59e0b66",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,color:"#f59e0b"}}>—</div>
                            }
                          </td>
                          {/* Fecha llegada */}
                          <td style={{padding:"12px 14px"}}>
                            {llegó
                              ? <span style={{color:T.success,fontWeight:700}}>{v.fecha_llegada}</span>
                              : <span style={{color:"#f59e0b",fontSize:11}}>Pendiente</span>
                            }
                          </td>
                          {/* Fecha cargue */}
                          <td style={{padding:"12px 14px",color:T.muted}}>{v.fecha||"—"}</td>
                          {/* Placa */}
                          <td style={{padding:"12px 14px"}}>
                            <span style={{background:`${T.orange}18`,border:`1px solid ${T.orange}44`,borderRadius:6,padding:"3px 9px",color:T.orange,fontWeight:700,letterSpacing:1}}>{v.placa||"—"}</span>
                          </td>
                          {/* Producto */}
                          <td style={{padding:"12px 14px",color:T.text,maxWidth:160}}>
                            <div style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{v.producto||"—"}</div>
                          </td>
                          {/* Observaciones — valores fuera de spec del tiquete */}
                          <td style={{padding:"12px 14px",maxWidth:220}}>
                            {(()=>{
                              const tq = tiquetes.find(t=>t.viaje_id===v.id);
                              if (!tq) return <span style={{color:T.muted,fontStyle:"italic",fontSize:11}}>Sin análisis</span>;
                              const esV = (tq.producto||"").toUpperCase()==="VLSFO";
                              const fuera = [];
                              if (Number(tq.flash_point)<60)       fuera.push(`Flash ${tq.flash_point}°C`);
                              if (Number(tq.agua_destilacion)>=0.5) fuera.push(`Agua ${tq.agua_destilacion}%`);
                              if (esV && Number(tq.viscosidad)>=380) fuera.push(`Visc. ${tq.viscosidad}`);
                              if (esV && Number(tq.azufre)>=0.5)    fuera.push(`Azufre ${tq.azufre}%`);
                              if (esV && Number(tq.tsa)>=0.1)       fuera.push(`TSA ${tq.tsa}`);
                              if (fuera.length===0) return <span style={{color:"#00e5a0",fontWeight:700,fontSize:11}}>✔ Listo para descargue</span>;
                              return <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
                                {fuera.map(f=><span key={f} style={{background:"#ff4d4d18",border:"1px solid #ff4d4d55",borderRadius:5,padding:"2px 7px",color:"#ff4d4d",fontSize:10,fontWeight:700}}>{f}</span>)}
                              </div>;
                            })()}
                          </td>
                          {/* Acción */}
                          <td style={{padding:"12px 14px"}}>
                            <div style={{display:"flex",gap:6}}>
                              <button onClick={()=>{setForm({...v});setModal("viaje");}}
                                style={{background:T.navy,border:"none",borderRadius:6,color:"#ffffff",padding:"5px 14px",fontSize:11,cursor:"pointer",fontWeight:700,whiteSpace:"nowrap"}}
                                onMouseEnter={e=>e.currentTarget.style.background=T.orange}
                                onMouseLeave={e=>e.currentTarget.style.background=T.navy}>
                                {llegó ? "✏ Editar" : "📍 Registrar llegada"}
                              </button>
                              {perfil.rol==="administrador" && (
                                <button onClick={async()=>{
                                  if (!confirm(`¿Eliminar carro ${v.placa} del listado? Esta acción no se puede deshacer.`)) return;
                                  // Cascada completa antes de eliminar viaje
                                  const {data:pbsIds} = await supabaseAdmin.from("pbs").select("id").eq("viaje_id",v.id);
                                  if (pbsIds?.length) {
                                    for (const p of pbsIds) {
                                      await supabaseAdmin.from("cmts").delete().eq("pbs_id",p.id);
                                    }
                                  }
                                  await supabaseAdmin.from("tiquetes").delete().eq("viaje_id",v.id);
                                  await supabaseAdmin.from("pbs").delete().eq("viaje_id",v.id);
                                  await supabaseAdmin.from("despachos").delete().eq("viaje_id",v.id);
                                  // Llamada directa a la REST API con service role para garantizar el delete
                                  const res = await fetch(`${SUPABASE_URL}/rest/v1/viajes?id=eq.${v.id}`, {
                                    method:"DELETE",
                                    headers:{"apikey":SUPABASE_SERVICE_KEY,"Authorization":`Bearer ${SUPABASE_SERVICE_KEY}`,"Content-Type":"application/json","Prefer":"return=representation"}
                                  });
                                  if (!res.ok) return showToast(`Error viaje: ${res.status} ${await res.text()}`, false);
                                  const deleted = await res.json();
                                  if (!deleted.length) return showToast("No se eliminó: puede haber otra FK pendiente", false);
                                  await loadData();
                                  showToast(`Carro ${v.placa} eliminado del listado`);
                                }}
                                style={{background:"#ff4d4d22",border:"1px solid #ff4d4d55",borderRadius:6,color:"#ff4d4d",padding:"5px 10px",fontSize:11,cursor:"pointer",fontWeight:700,whiteSpace:"nowrap"}}
                                onMouseEnter={e=>e.currentTarget.style.background="#ff4d4d44"}
                                onMouseLeave={e=>e.currentTarget.style.background="#ff4d4d22"}>
                                  🗑
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
            );
          })()}

          {/* ANÁLISIS (antes Tiquetes MP) */}
          {nav==="tiquetes" && (()=>{
            const selSt = {background:T.card,border:`1px solid ${T.border}`,borderRadius:6,padding:"6px 10px",color:T.text,fontSize:11,fontFamily:"system-ui,sans-serif",outline:"none"};
            const prodsTiq = [...new Set(tiquetesFiltrados.map(t=>t.producto).filter(Boolean))].sort();
            const tiqFinal = tiquetesFiltrados.filter(t=>{
              const q=(tiqBusqueda||"").toLowerCase();
              if(q&&![(t.id||""),(t.placa||""),(t.producto||""),(t.viaje_id||"")].some(x=>x.toLowerCase().includes(q))) return false;
              if(tiqFiltroProducto&&t.producto!==tiqFiltroProducto) return false;
              if(tiqFiltroResultado&&t.resultado!==tiqFiltroResultado) return false;
              if(tiqFiltroFechaD&&(t.fecha_llegada||t.fecha)<tiqFiltroFechaD) return false;
              if(tiqFiltroFechaH&&(t.fecha_llegada||t.fecha)>tiqFiltroFechaH) return false;
              return true;
            });

            /* ── LANDING: 4 tarjetas ── */
            if (!analisisNav) return (
              <div>
                <div style={{fontWeight:800,fontSize:22,color:T.navy,marginBottom:6}}>Análisis de Laboratorio</div>
                <div style={{fontSize:12,color:T.muted,marginBottom:36}}>Selecciona el tipo de análisis que deseas gestionar</div>
                <div style={{display:"flex",gap:24,flexWrap:"wrap",justifyContent:"center",marginTop:40}}>
                  {[
                    { key:"tiquetes_mp", icon:(
                        <svg viewBox="0 0 64 64" width="64" height="64" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <rect x="4" y="28" width="38" height="20" rx="3" fill="#00b4ff33" stroke="#00b4ff" strokeWidth="2"/>
                          <rect x="42" y="34" width="16" height="14" rx="2" fill="#00b4ff22" stroke="#00b4ff" strokeWidth="2"/>
                          <rect x="8" y="22" width="20" height="8" rx="2" fill="#00b4ff55" stroke="#00b4ff" strokeWidth="1.5"/>
                          <circle cx="14" cy="50" r="5" fill="#071422" stroke="#00b4ff" strokeWidth="2"/>
                          <circle cx="34" cy="50" r="5" fill="#071422" stroke="#00b4ff" strokeWidth="2"/>
                          <circle cx="52" cy="50" r="4" fill="#071422" stroke="#00b4ff" strokeWidth="2"/>
                          <rect x="24" y="31" width="6" height="9" rx="1" fill="#00b4ff"/>
                        </svg>
                      ), label:"Tiquetes MP", color:"#00b4ff", desc:"Materia prima recibida en carrotanque" },
                    { key:"planta2", icon:(
                        <svg viewBox="0 0 64 64" width="64" height="64" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <ellipse cx="32" cy="16" rx="22" ry="8" fill="#00e5a033" stroke="#00e5a0" strokeWidth="2"/>
                          <rect x="10" y="16" width="44" height="30" rx="0" fill="#00e5a018" stroke="#00e5a0" strokeWidth="2"/>
                          <ellipse cx="32" cy="46" rx="22" ry="6" fill="#00e5a033" stroke="#00e5a0" strokeWidth="2"/>
                          <line x1="32" y1="8" x2="32" y2="2" stroke="#00e5a0" strokeWidth="2"/>
                          <line x1="25" y1="8" x2="25" y2="2" stroke="#00e5a0" strokeWidth="1.5"/>
                          <line x1="39" y1="8" x2="39" y2="2" stroke="#00e5a0" strokeWidth="1.5"/>
                        </svg>
                      ), label:"Planta 2", color:"#00e5a0", desc:"Tanques de almacenamiento Planta 2" },
                    { key:"planta1", icon:(
                        <svg viewBox="0 0 64 64" width="64" height="64" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <rect x="4" y="36" width="56" height="12" rx="4" fill="#c084fc33" stroke="#c084fc" strokeWidth="2"/>
                          <rect x="10" y="28" width="44" height="10" rx="2" fill="#c084fc22" stroke="#c084fc" strokeWidth="1.5"/>
                          <rect x="18" y="20" width="28" height="10" rx="2" fill="#c084fc18" stroke="#c084fc" strokeWidth="1.5"/>
                          <rect x="26" y="14" width="12" height="8" rx="1" fill="#c084fc33" stroke="#c084fc" strokeWidth="1.5"/>
                          <line x1="4" y1="48" x2="4" y2="56" stroke="#c084fc" strokeWidth="3"/>
                          <line x1="60" y1="48" x2="60" y2="56" stroke="#c084fc" strokeWidth="3"/>
                          <line x1="2" y1="56" x2="62" y2="56" stroke="#c084fc" strokeWidth="2"/>
                        </svg>
                      ), label:"Planta 1", color:"#c084fc", desc:"Barcaza y despacho Planta 1" },
                    { key:"no_rutinarios", icon:(
                        <svg viewBox="0 0 64 64" width="64" height="64" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <rect x="22" y="4" width="12" height="16" rx="3" fill="#fb923c33" stroke="#fb923c" strokeWidth="2"/>
                          <path d="M18 20 L10 52 Q10 58 18 58 L46 58 Q54 58 54 52 L46 20 Z" fill="#fb923c18" stroke="#fb923c" strokeWidth="2"/>
                          <circle cx="30" cy="38" r="6" fill="#fb923c55" stroke="#fb923c" strokeWidth="2"/>
                          <line x1="30" y1="32" x2="30" y2="44" stroke="#fb923c" strokeWidth="2"/>
                          <line x1="24" y1="38" x2="36" y2="38" stroke="#fb923c" strokeWidth="2"/>
                        </svg>
                      ), label:"No Rutinarios", color:"#fb923c", desc:"Análisis especiales y muestras puntuales" },
                  ].map(card=>(
                    <div key={card.key} onClick={()=>{ card.key==="tiquetes_mp" ? setAnalisisNav("tiquetes_mp") : (setForm({tipo_analisis:card.label}),setModal("tiquete")); }}
                      style={{background:T.card,border:`2px solid ${card.color}33`,borderRadius:16,padding:"32px 28px",display:"flex",flexDirection:"column",alignItems:"center",gap:16,cursor:"pointer",width:180,transition:"all 0.2s",boxShadow:`0 4px 20px ${card.color}18`}}
                      onMouseEnter={e=>{e.currentTarget.style.border=`2px solid ${card.color}`;e.currentTarget.style.transform="translateY(-4px)";e.currentTarget.style.boxShadow=`0 8px 28px ${card.color}44`;}}
                      onMouseLeave={e=>{e.currentTarget.style.border=`2px solid ${card.color}33`;e.currentTarget.style.transform="translateY(0)";e.currentTarget.style.boxShadow=`0 4px 20px ${card.color}18`;}}>
                      {card.icon}
                      <div style={{fontWeight:800,fontSize:14,color:card.color,textAlign:"center",letterSpacing:1}}>{card.label}</div>
                      <div style={{fontSize:11,color:T.muted,textAlign:"center",lineHeight:1.4}}>{card.desc}</div>
                    </div>
                  ))}
                </div>
              </div>
            );

            /* ── DETALLE: tabla de tiquetes ── */
            const labelNav = {tiquetes_mp:"Tiquetes MP",planta2:"Planta 2",planta1:"Planta 1",no_rutinarios:"No Rutinarios"}[analisisNav]||"";
            return (
            <div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
                <div>
                  <button onClick={()=>setAnalisisNav("")} style={{background:"none",border:"none",color:T.muted,cursor:"pointer",fontSize:11,padding:"0 0 4px 0",display:"flex",alignItems:"center",gap:4}}>← Análisis</button>
                  <div style={{ fontWeight:800, fontSize:20, color:T.navy }}>{labelNav}</div>
                  <div style={{ fontSize:11, color:T.muted }}>Emitido por laboratorio · <b style={{color:"#00b4ff"}}>{tiqFinal.length}</b> resultado(s)</div>
                </div>
                {puedeCrear("tiquetes") && <Btn color="#00b4ff" onClick={()=>{setForm({});setModal("tiquete");}}>+ Nuevo Tiquete</Btn>}
              </div>
              <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center",marginBottom:16}}>
                <input value={tiqBusqueda||""} onChange={e=>setTiqBusqueda(e.target.value)} placeholder="🔍 Buscar tiquete, placa, viaje..." style={{...selSt,width:220,padding:"6px 12px"}}/>
                {["administrador","gerencia"].includes(perfil.rol) && (
                  <select value={sedeFiltro} onChange={e=>setSedeFiltro(e.target.value)} style={selSt}>
                    <option value="TODAS">Todas las sedes</option>
                    {SEDES.map(s=><option key={s}>{s}</option>)}
                  </select>
                )}
                <select value={tiqFiltroProducto||""} onChange={e=>setTiqFiltroProducto(e.target.value)} style={selSt}>
                  <option value="">Todos los productos</option>
                  {prodsTiq.map(p=><option key={p}>{p}</option>)}
                </select>
                <select value={tiqFiltroResultado||""} onChange={e=>setTiqFiltroResultado(e.target.value)} style={selSt}>
                  <option value="">Todos los resultados</option>
                  <option>APROBADO</option>
                  <option>RECHAZADO</option>
                </select>
                <input type="date" value={tiqFiltroFechaD||""} onChange={e=>setTiqFiltroFechaD(e.target.value)} style={selSt} title="Desde"/>
                <input type="date" value={tiqFiltroFechaH||""} onChange={e=>setTiqFiltroFechaH(e.target.value)} style={selSt} title="Hasta"/>
                {(tiqBusqueda||tiqFiltroProducto||tiqFiltroResultado||tiqFiltroFechaD||tiqFiltroFechaH) && (
                  <button onClick={()=>{setTiqBusqueda("");setTiqFiltroProducto("");setTiqFiltroResultado("");setTiqFiltroFechaD("");setTiqFiltroFechaH("");}} style={{background:"#ff4d4d22",border:"1px solid #ff4d4d44",borderRadius:8,color:"#ff4d4d",padding:"6px 12px",cursor:"pointer",fontSize:11}}>✕ Limpiar</button>
                )}
              </div>
              {viajes.filter(v=>v.estado==="En Planta"&&!v.tiquete_id).length>0 && (
                <Card style={{ marginBottom:18, borderColor:"#f59e0b33" }}>
                  <div style={{ fontSize:12, fontWeight:700, color:"#f59e0b", marginBottom:10 }}>⚠ Carros en planta sin tiquete</div>
                  <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
                    {viajes.filter(v=>v.estado==="En Planta"&&!v.tiquete_id).map(v=>(
                      <div key={v.id} style={{ background:"#f59e0b18", border:"1px solid #f59e0b33", borderRadius:8, padding:"8px 14px", fontSize:12 }}>
                        <b>{v.placa}</b> · {v.producto}
                        {puedeCrear("tiquetes") && (
                          <button onClick={()=>{setForm({viaje_id:v.id,producto:v.producto,placa:v.placa,conductor:v.conductor,fecha_cargue:v.fecha,fecha_llegada:today()});setModal("tiquete");}} style={{ marginLeft:10, background:"#00b4ff", color:"#071422", border:"none", borderRadius:6, padding:"3px 10px", fontSize:11, fontWeight:700, cursor:"pointer" }}>Emitir</button>
                        )}
                      </div>
                    ))}
                  </div>
                </Card>
              )}
              <Table
                cols={["No. Tiquete","Viaje","Producto","Placa","API Corr.","Gls Recibidos","Flash","Agua %","Resultado","Analista",""]}
                rows={tiqFinal.map(t=>[
                  <span style={{color:"#00b4ff"}}>{t.id}</span>,
                  t.viaje_id, t.producto, t.placa,
                  `${t.api_corregido}°`, fmt(t.galones_recibidos), `${t.flash_point}°C`, `${t.agua_destilacion}%`,
                  <Badge label={t.resultado} color={t.resultado==="APROBADO"?"#00e5a0":"#ff4d4d"}/>,
                  t.autoriza_nombre,
                  puedeEditar("tiquetes",t.creado_por,t.created_at)
                    ? <button onClick={()=>{setForm({...t});setModal("tiquete");}} style={{background:"#00b4ff22",border:"1px solid #00b4ff55",borderRadius:6,color:"#00b4ff",padding:"3px 10px",fontSize:11,cursor:"pointer",fontFamily:"monospace"}}>✏ Editar</button>
                    : null,
                ])}
              />
            </div>
            );
          })()}

          {/* RESULTADOS LABORATORIO */}
          {nav==="resultados" && (()=>{
            const selSt = {background:T.card,border:`1px solid ${T.border}`,borderRadius:6,padding:"6px 10px",color:T.text,fontSize:11,fontFamily:"system-ui,sans-serif",outline:"none"};
            const prodsRes = [...new Set(tiquetesFiltrados.map(t=>t.producto).filter(Boolean))].sort();
            const resFinal = tiquetesFiltrados.filter(t=>{
              const q=(tiqBusqueda||"").toLowerCase();
              if(q&&![(t.id||""),(t.placa||""),(t.producto||""),(t.viaje_id||"")].some(x=>x.toLowerCase().includes(q))) return false;
              if(tiqFiltroProducto&&t.producto!==tiqFiltroProducto) return false;
              if(tiqFiltroResultado&&t.resultado!==tiqFiltroResultado) return false;
              if(tiqFiltroFechaD&&(t.fecha_llegada||t.fecha)<tiqFiltroFechaD) return false;
              if(tiqFiltroFechaH&&(t.fecha_llegada||t.fecha)>tiqFiltroFechaH) return false;
              return true;
            });
            const resFinalTyped = resFinal.filter(t=>!resFiltroTipo||(t.tipo_analisis||"Tiquetes MP")===resFiltroTipo);
            const TIPOS_ANALISIS = ["Tiquetes MP","Planta 2","Planta 1","No Rutinarios"];
            const tipoColor = {"Tiquetes MP":"#00b4ff","Planta 2":"#00e5a0","Planta 1":"#c084fc","No Rutinarios":"#fb923c"};
            return (
            <div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
                <div>
                  <div style={{ fontWeight:800, fontSize:20, color:T.navy }}>Resultados de Laboratorio</div>
                  <div style={{ fontSize:11, color:T.muted }}>Consolidado de análisis · <b style={{color:"#00b4ff"}}>{resFinalTyped.length}</b> resultado(s)</div>
                </div>
              </div>
              {/* Filtro rápido por tipo */}
              <div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap"}}>
                {["", ...TIPOS_ANALISIS].map(tipo=>(
                  <button key={tipo||"todos"} onClick={()=>setResFiltroTipo(tipo)}
                    style={{padding:"5px 14px",borderRadius:20,border:`1px solid ${tipo?(tipoColor[tipo]+"55"):(T.border)}`,background:resFiltroTipo===tipo?(tipo?tipoColor[tipo]+"33":"#ffffff22"):"transparent",color:tipo?tipoColor[tipo]:T.muted,fontSize:11,cursor:"pointer",fontWeight:resFiltroTipo===tipo?700:400,transition:"all 0.15s"}}>
                    {tipo||"Todos"}
                  </button>
                ))}
              </div>
              <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center",marginBottom:16}}>
                <input value={tiqBusqueda||""} onChange={e=>setTiqBusqueda(e.target.value)} placeholder="🔍 Buscar tiquete, placa, viaje..." style={{...selSt,width:220,padding:"6px 12px"}}/>
                <select value={tiqFiltroProducto||""} onChange={e=>setTiqFiltroProducto(e.target.value)} style={selSt}>
                  <option value="">Todos los productos</option>
                  {prodsRes.map(p=><option key={p}>{p}</option>)}
                </select>
                <select value={tiqFiltroResultado||""} onChange={e=>setTiqFiltroResultado(e.target.value)} style={selSt}>
                  <option value="">Todos los resultados</option>
                  <option>APROBADO</option>
                  <option>RECHAZADO</option>
                </select>
                <input type="date" value={tiqFiltroFechaD||""} onChange={e=>setTiqFiltroFechaD(e.target.value)} style={selSt} title="Desde"/>
                <input type="date" value={tiqFiltroFechaH||""} onChange={e=>setTiqFiltroFechaH(e.target.value)} style={selSt} title="Hasta"/>
                {(tiqBusqueda||tiqFiltroProducto||tiqFiltroResultado||tiqFiltroFechaD||tiqFiltroFechaH||resFiltroTipo) && (
                  <button onClick={()=>{setTiqBusqueda("");setTiqFiltroProducto("");setTiqFiltroResultado("");setTiqFiltroFechaD("");setTiqFiltroFechaH("");setResFiltroTipo("");}} style={{background:"#ff4d4d22",border:"1px solid #ff4d4d44",borderRadius:8,color:"#ff4d4d",padding:"6px 12px",cursor:"pointer",fontSize:11}}>✕ Limpiar</button>
                )}
              </div>
              <Table
                cols={["No. Tiquete","Tipo","Fecha","Producto","Placa","API Corr.","Flash °C","Agua %","Viscosidad","Azufre %","TSA","Resultado",""]}
                rows={resFinalTyped.map(t=>{
                  const esV = (t.producto||"").toUpperCase()==="VLSFO";
                  const flashOk = Number(t.flash_point)>=60;
                  const aguaOk  = Number(t.agua_destilacion)<0.5;
                  const viscOk  = !esV || Number(t.viscosidad)<380;
                  const azuOk   = !esV || Number(t.azufre)<0.5;
                  const tsaOk   = !esV || Number(t.tsa)<0.1;
                  const tipo = t.tipo_analisis||"Tiquetes MP";
                  return [
                    <span style={{color:"#00b4ff",fontFamily:"monospace"}}>{t.id}</span>,
                    <Badge label={tipo} color={tipoColor[tipo]||"#00b4ff"}/>,
                    t.fecha_llegada||"—", t.producto, t.placa,
                    <span style={{color:T.text,fontWeight:600}}>{t.api_corregido}°</span>,
                    <span style={{color:flashOk?T.text:T.danger,fontWeight:flashOk?400:700}}>{t.flash_point}°C</span>,
                    <span style={{color:aguaOk?T.text:T.danger,fontWeight:aguaOk?400:700}}>{t.agua_destilacion}%</span>,
                    <span style={{color:viscOk?T.text:T.danger,fontWeight:viscOk?400:700}}>{t.viscosidad||"—"}</span>,
                    <span style={{color:azuOk?T.text:T.danger,fontWeight:azuOk?400:700}}>{t.azufre||"—"}</span>,
                    <span style={{color:tsaOk?T.text:T.danger,fontWeight:tsaOk?400:700}}>{t.tsa||"—"}</span>,
                    <Badge label={t.resultado} color={t.resultado==="APROBADO"?"#00e5a0":T.danger}/>,
                    <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                      {puedeEditar("tiquetes",t.creado_por,t.created_at) && (
                        <button onClick={()=>{setForm({...t});setModal("tiquete");}} style={{background:"#00b4ff22",border:"1px solid #00b4ff55",borderRadius:6,color:"#00b4ff",padding:"3px 8px",fontSize:11,cursor:"pointer",fontFamily:"monospace"}}>✏ Editar</button>
                      )}
                      {perfil.rol==="administrador" && t.resultado==="RECHAZADO" && t.viaje_id && (()=>{
                        const viaje = viajes.find(v=>v.id===t.viaje_id);
                        if (!viaje || viaje.estado==="Descargado") return null;
                        const autorizado = viaje.autorizado_descargue;
                        return (
                          <button onClick={async()=>{
                            await supabaseAdmin.from("viajes").update({autorizado_descargue:!autorizado, autorizado_por: !autorizado?perfil.nombre:null}).eq("id",t.viaje_id);
                            await loadData();
                            showToast(!autorizado?"Descargue autorizado ✔":"Autorización retirada", !autorizado);
                          }} style={{background:autorizado?"#ff4d4d22":"#f59e0b22",border:`1px solid ${autorizado?"#ff4d4d55":"#f59e0b55"}`,borderRadius:6,color:autorizado?"#ff4d4d":"#f59e0b",padding:"3px 8px",fontSize:11,cursor:"pointer",fontWeight:700,whiteSpace:"nowrap"}}>
                            {autorizado?"✕ Revocar":"✔ Autorizar"}
                          </button>
                        );
                      })()}
                    </div>,
                  ];
                })}
              />
            </div>
            );
          })()}

          {/* PBS */}
          {nav==="pbs" && (
            <div>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:22 }}>
                <div>
                  <div style={{ fontWeight:800, fontSize:20, color:T.navy }}>Permiso de Bombeo Seguro</div>
                  <div style={{ fontSize:11, color:T.muted }}>Checklist de 27 puntos por cada descargue</div>
                </div>
                {puedeCrear("pbs") && <Btn color="#fb923c" onClick={()=>{setForm({fecha:today()});setPbsChecklist(Array(27).fill(""));setModal("pbs");}}>+ Nuevo PBS</Btn>}
              </div>
              <Table
                cols={["No. PBS","Fecha","Producto","Tipo Operación","Bodega Recibe","Hora Inicio","Hora Final","Firma",""]}
                rows={pbsList.map(p=>[
                  <span style={{color:"#fb923c"}}>{p.id}</span>,
                  p.fecha, p.producto,
                  <Badge label={p.tipo_operacion} color="#fb923c"/>,
                  p.bodega_recibe, p.hora_inicio||"-", p.hora_final||"-", p.firma_auxiliar,
                  puedeEditar("pbs",p.creado_por,p.created_at)
                    ? <button onClick={()=>{setForm({...p});setPbsChecklist(p.checklist||Array(27).fill(""));setModal("pbs");}} style={{background:"#fb923c22",border:"1px solid #fb923c55",borderRadius:6,color:"#fb923c",padding:"3px 10px",fontSize:11,cursor:"pointer",fontFamily:"monospace"}}>✏ Editar</button>
                    : null,
                ])}
              />
            </div>
          )}

          {/* CMT */}
          {nav==="cmt" && (
            <div>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:22 }}>
                <div>
                  <div style={{ fontWeight:800, fontSize:20, color:T.navy }}>CMT — Control de Movimiento de Tanques</div>
                  <div style={{ fontSize:11, color:T.muted }}>Registro oficial de movimientos en tanques</div>
                </div>
                <div style={{display:"flex",gap:12,alignItems:"flex-end"}}>
                  {["administrador","gerencia"].includes(perfil.rol) && (<>
                    <div style={{display:"flex",flexDirection:"column",gap:3}}>
                      <div style={{fontSize:10,color:T.muted,textTransform:"uppercase",letterSpacing:1,fontFamily:"monospace"}}>Sede</div>
                      <select value={sedeFiltro||"TODAS"} onChange={e=>{setSedeFiltro(e.target.value);setPlantaFiltro(null);}}
                        style={{background:(!sedeFiltro||sedeFiltro==="TODAS")?`${T.orange}18`:T.card,border:(!sedeFiltro||sedeFiltro==="TODAS")?`1px solid ${T.orange}`:`1px solid ${T.border}`,borderRadius:6,padding:"6px 12px",color:(!sedeFiltro||sedeFiltro==="TODAS")?T.orange:T.text,fontSize:12,outline:"none",cursor:"pointer"}}>
                        <option value="TODAS">— Seleccionar sede —</option>
                        {SEDES.map(s=><option key={s}>{s}</option>)}
                      </select>
                    </div>
                    {sedeFiltro==="MALAMBO" && (
                      <div style={{display:"flex",flexDirection:"column",gap:3}}>
                        <div style={{fontSize:10,color:T.muted,textTransform:"uppercase",letterSpacing:1,fontFamily:"monospace"}}>Planta</div>
                        <select value={plantaFiltro||""} onChange={e=>setPlantaFiltro(e.target.value)}
                          style={{background:!plantaFiltro?`${T.orange}18`:T.card,border:!plantaFiltro?`1px solid ${T.orange}`:`1px solid ${T.border}`,borderRadius:6,padding:"6px 12px",color:!plantaFiltro?T.orange:T.text,fontSize:12,outline:"none",cursor:"pointer"}}>
                          <option value="">— Seleccionar planta —</option>
                          {PLANTAS.map(p=><option key={p}>{p}</option>)}
                        </select>
                      </div>
                    )}
                  </>)}
                  {puedeCrear("cmt") && <Btn
                    disabled={["administrador","gerencia"].includes(perfil.rol) && (
                      !sedeFiltro || sedeFiltro==="TODAS" || (sedeFiltro==="MALAMBO" && !plantaFiltro)
                    )}
                    onClick={()=>{
                    if (!sedeFiltro || sedeFiltro==="TODAS") return showToast("Seleccione una sede para crear un CMT",false);
                    if (sedeFiltro==="MALAMBO" && !plantaFiltro) return showToast("Seleccione una planta para crear un CMT",false);
                    const sede = sedeFiltro;
                    const planta = sede==="MALAMBO" ? plantaFiltro : "";
                    const numCmt = genIdCMT(cmts, sede, planta);
                    setForm({sede, planta, numero_cmt:numCmt});
                    setCmtAntes([{tanque:"",sonda:"",galones:""}]); setCmtProducto("");
                    setCmtCarros([{placa:"",guia:"",tiquete:"",pbs_id:""}]);
                    setCmtDespues([{tanque:"",producto:"",sonda:"",galones:""}]);
                    setModal("cmt");
                  }}>+ Nuevo CMT</Btn>}
                </div>
              </div>

              {/* Aviso prominente cuando no hay sede seleccionada (solo admin/gerencia) */}
              {["administrador","gerencia"].includes(perfil.rol) && ((!sedeFiltro||sedeFiltro==="TODAS") || (sedeFiltro==="MALAMBO"&&!plantaFiltro)) && (
                <div style={{background:"#1a1200",border:"2px solid #f59e0b",borderRadius:12,padding:"20px 24px",marginBottom:20,display:"flex",alignItems:"flex-start",gap:16}}>
                  <div style={{fontSize:28,lineHeight:1}}>📍</div>
                  <div>
                    {(!sedeFiltro||sedeFiltro==="TODAS") ? (<>
                      <div style={{fontWeight:800,fontSize:15,color:T.orange,marginBottom:6}}>Paso 1 — Seleccione la sede donde va a trabajar</div>
                      <div style={{fontSize:13,color:"#c9a84c",lineHeight:1.6}}>
                        Use el selector <b style={{color:"#f59e0b"}}>"Sede"</b> arriba a la derecha para elegir entre {SEDES.join(", ")}.<br/>
                        <span style={{fontSize:11,color:"#8a7040",marginTop:4,display:"block"}}>Cada CMT queda registrado en la sede donde se realizó el movimiento. Esto no se puede cambiar después.</span>
                      </div>
                    </>) : (<>
                      <div style={{fontWeight:800,fontSize:15,color:T.orange,marginBottom:6}}>Paso 2 — Seleccione la planta dentro de MALAMBO</div>
                      <div style={{fontSize:13,color:"#c9a84c",lineHeight:1.6}}>
                        MALAMBO tiene dos plantas de recibo. Use el selector <b style={{color:"#f59e0b"}}>"Planta"</b> para elegir entre {PLANTAS.join(" o ")}.<br/>
                        <span style={{fontSize:11,color:"#8a7040",marginTop:4,display:"block"}}>El número del CMT cambia según la planta elegida (MAL1 o MAL2). Esto garantiza trazabilidad exacta del movimiento.</span>
                      </div>
                    </>)}
                  </div>
                </div>
              )}

              {(()=>{
                const tiposUnicos = [...new Set(cmts.map(c=>c.tipo_operacion).filter(Boolean))];
                const cmtsFinal = cmtsFiltrados.filter(c=>{
                  const q = cmtBusqueda.toUpperCase();
                  const matchQ = !q || (c.numero_cmt||c.id||"").toUpperCase().includes(q) || (c.operador||"").toUpperCase().includes(q) || (c.producto||"").toUpperCase().includes(q) || (c.placa||"").toUpperCase().includes(q);
                  const matchTipo = !cmtFiltroTipo || c.tipo_operacion===cmtFiltroTipo;
                  const matchFD = !cmtFiltroFechaD || (c.fecha||"")>=cmtFiltroFechaD;
                  const matchFH = !cmtFiltroFechaH || (c.fecha||"")<=cmtFiltroFechaH;
                  return matchQ && matchTipo && matchFD && matchFH;
                });
                const thStyle = {padding:"10px 12px",fontSize:10,color:T.navy,textTransform:"uppercase",letterSpacing:1,fontWeight:700,borderBottom:`2px solid ${T.border}`,whiteSpace:"nowrap",textAlign:"left",background:T.bg};
                const tdStyle = {padding:"10px 12px",fontSize:12,fontFamily:"monospace",borderBottom:"1px solid #ffffff08",verticalAlign:"middle"};
                return (<>
                  <div style={{display:"flex",gap:10,marginBottom:14,flexWrap:"wrap",alignItems:"flex-end"}}>
                    <div style={{flex:1,minWidth:180}}>
                      <div style={{fontSize:10,color:T.muted,marginBottom:3,textTransform:"uppercase",letterSpacing:1}}>Buscar</div>
                      <input value={cmtBusqueda} onChange={e=>setCmtBusqueda(e.target.value)} placeholder="N° CMT, operador, producto, placa..." style={{width:"100%",background:T.card,border:`1px solid ${T.border}`,borderRadius:6,padding:"7px 12px",color:T.text,fontSize:12,outline:"none",boxSizing:"border-box"}}/>
                    </div>
                    <div>
                      <div style={{fontSize:10,color:T.muted,marginBottom:3,textTransform:"uppercase",letterSpacing:1}}>Tipo operación</div>
                      <select value={cmtFiltroTipo} onChange={e=>setCmtFiltroTipo(e.target.value)} style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:6,padding:"7px 12px",color:T.text,fontSize:12,outline:"none"}}>
                        <option value="">Todos</option>
                        {tiposUnicos.map(t=><option key={t}>{t}</option>)}
                      </select>
                    </div>
                    <div>
                      <div style={{fontSize:10,color:T.muted,marginBottom:3,textTransform:"uppercase",letterSpacing:1}}>Desde</div>
                      <input type="date" value={cmtFiltroFechaD} onChange={e=>setCmtFiltroFechaD(e.target.value)} style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:6,padding:"7px 10px",color:T.text,fontSize:12,outline:"none"}}/>
                    </div>
                    <div>
                      <div style={{fontSize:10,color:T.muted,marginBottom:3,textTransform:"uppercase",letterSpacing:1}}>Hasta</div>
                      <input type="date" value={cmtFiltroFechaH} onChange={e=>setCmtFiltroFechaH(e.target.value)} style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:6,padding:"7px 10px",color:T.text,fontSize:12,outline:"none"}}/>
                    </div>
                    <div style={{display:"flex",alignItems:"center",gap:10,paddingBottom:6}}>
                      <span style={{fontSize:11,color:T.muted}}>{cmtsFinal.length} registro(s)</span>
                      <button onClick={()=>{
                        const wb = XLSX.utils.book_new();
                        // Hoja 1: Resumen general
                        const resumen = cmtsFinal.map(c=>({
                          "N° CMT": c.numero_cmt||c.id,
                          "Fecha": c.fecha||"",
                          "Tipo Operación": c.tipo_operacion||"",
                          "Producto": c.producto||"",
                          "Sede": c.sede||"",
                          "Planta": c.planta||"",
                          "Gls Iniciales": Number(c.total_antes||0),
                          "Gls Finales": Number(c.total_despues||0),
                          "Gls Movidos": Math.abs(Number(c.total_movido||0)),
                          "Tiquete Entrada": c.tiquete_entrada||"",
                          "Operador": c.operador||"",
                        }));
                        const wsRes = XLSX.utils.json_to_sheet(resumen);
                        wsRes["!cols"] = [{wch:18},{wch:12},{wch:24},{wch:14},{wch:14},{wch:12},{wch:14},{wch:14},{wch:14},{wch:16},{wch:18}];
                        XLSX.utils.book_append_sheet(wb, wsRes, "Resumen");
                        // Hoja 2: Medidas por tanque
                        const medidas = [];
                        cmtsFinal.forEach(c=>{
                          (c.tanques_antes||[]).forEach((t,i)=>{
                            const td = (c.tanques_despues||[])[i]||{};
                            medidas.push({
                              "N° CMT": c.numero_cmt||c.id,
                              "Fecha": c.fecha||"",
                              "Tipo Operación": c.tipo_operacion||"",
                              "Producto": c.producto||"",
                              "Tanque": t.tanque||"",
                              "Sonda Inicial": t.sonda||"",
                              "Temp Inicial": t.temp||"",
                              "API Inicial": t.api||"",
                              "Gls Iniciales": Number(t.galones||0),
                              "Sonda Final": td.sonda||"",
                              "Temp Final": td.temp||"",
                              "API Final": td.api||"",
                              "Gls Finales": Number(td.galones||0),
                              "Diferencia Gls": Math.abs(Number(td.galones||0)-Number(t.galones||0)),
                            });
                          });
                          // Tanques recepción (trasiego)
                          (c.tanques_recepcion||[]).forEach(r=>{
                            medidas.push({
                              "N° CMT": c.numero_cmt||c.id,
                              "Fecha": c.fecha||"",
                              "Tipo Operación": c.tipo_operacion||"",
                              "Producto": c.producto||"",
                              "Tanque": (r.tanque||"")+" (Recepción)",
                              "Sonda Inicial": r.sondaInicial||"",
                              "Temp Inicial": r.tempInicial||"",
                              "API Inicial": r.apiInicial||"",
                              "Gls Iniciales": Number(r.galonesInicial||0),
                              "Sonda Final": r.sondaFinal||"",
                              "Temp Final": r.tempFinal||"",
                              "API Final": r.apiFinal||"",
                              "Gls Finales": Number(r.galonesFinal||0),
                              "Diferencia Gls": Math.abs(Number(r.galonesFinal||0)-Number(r.galonesInicial||0)),
                            });
                          });
                        });
                        const wsMed = XLSX.utils.json_to_sheet(medidas);
                        wsMed["!cols"] = [{wch:18},{wch:12},{wch:22},{wch:14},{wch:14},{wch:14},{wch:12},{wch:10},{wch:14},{wch:12},{wch:12},{wch:10},{wch:14},{wch:14}];
                        XLSX.utils.book_append_sheet(wb, wsMed, "Medidas por Tanque");
                        // Hoja 3: Carros descargados
                        const carros = [];
                        cmtsFinal.forEach(c=>{
                          (c.carros||[]).forEach(cr=>{
                            carros.push({
                              "N° CMT": c.numero_cmt||c.id,
                              "Fecha": c.fecha||"",
                              "Sede": c.sede||"",
                              "Planta": c.planta||"",
                              "Producto": c.producto||"",
                              "Placa": cr.placa||"",
                              "Guía": cr.guia||"",
                              "Tiquete": cr.tiquete||"",
                              "Hora Inicio": cr.hora_inicio||"",
                              "Hora Final": cr.hora_final||"",
                              "Peso Neto (Kg)": cr.peso_neto||"",
                              "PBS": cr.pbs_id||"",
                            });
                          });
                        });
                        if (carros.length>0) {
                          const wsCar = XLSX.utils.json_to_sheet(carros);
                          wsCar["!cols"] = [{wch:18},{wch:12},{wch:14},{wch:12},{wch:14},{wch:10},{wch:14},{wch:14},{wch:12},{wch:12},{wch:14},{wch:14}];
                          XLSX.utils.book_append_sheet(wb, wsCar, "Carros Descargados");
                        }
                        XLSX.writeFile(wb, `CMT_${new Date().toISOString().slice(0,10)}.xlsx`);
                      }} style={{background:"#00e5a022",border:"1px solid #00e5a055",borderRadius:8,color:"#00e5a0",padding:"6px 14px",fontSize:11,cursor:"pointer",fontFamily:"monospace",fontWeight:700,display:"flex",alignItems:"center",gap:6}}>
                        ⬇ Exportar Excel
                      </button>
                    </div>
                  </div>
                  <div style={{overflowX:"auto"}}>
                    <table style={{width:"100%",borderCollapse:"collapse",background:T.card,borderRadius:8,overflow:"hidden",border:`1px solid ${T.border}`}}>
                      <thead>
                        <tr style={{background:T.bg}}>
                          <th style={thStyle}>N° CMT</th>
                          <th style={thStyle}>Fecha</th>
                          <th style={thStyle}>Tipo Operación</th>
                          <th style={thStyle}>Producto</th>
                          <th style={thStyle}>Tanques</th>
                          <th style={thStyle}>Gls Iniciales</th>
                          <th style={thStyle}>Gls Finales</th>
                          <th style={thStyle}>Movido</th>
                          <th style={thStyle}>Operador</th>
                          <th style={thStyle}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {cmtsFinal.length===0 && (
                          <tr><td colSpan={10} style={{...tdStyle,textAlign:"center",color:T.muted,padding:28}}>Sin registros</td></tr>
                        )}
                        {cmtsFinal.map((c,idx)=>{
                          const tanquesNombres = [...new Set([...(c.tanques_antes||[]).map(t=>t.tanque), ...(c.tanques_despues||[]).map(t=>t.tanque)].filter(Boolean))].join(", ");
                          const movido = Number(c.total_movido||0);
                          const expandido = cmtExpandido===c.id;
                          const bgRow = expandido ? "#dde6f0" : idx%2===0 ? T.card : "#eef2f7";
                          return (
                          <React.Fragment key={c.id}>
                          <tr onClick={()=>setCmtExpandido(expandido?null:c.id)} style={{cursor:"pointer",background:bgRow,transition:"background 0.15s",borderTop:`1px solid ${T.border}`}} onMouseEnter={e=>{if(!expandido)e.currentTarget.style.background="#dde6f0"}} onMouseLeave={e=>{if(!expandido)e.currentTarget.style.background=bgRow}}>
                            <td style={tdStyle}><span style={{color:"#00e5a0",fontWeight:700,letterSpacing:0.5}}>{c.numero_cmt||c.id}</span></td>
                            <td style={tdStyle}><span style={{color:T.muted}}>{c.fecha}</span></td>
                            <td style={tdStyle}><Badge label={c.tipo_operacion||"—"} color="#00e5a0"/></td>
                            <td style={tdStyle}><span style={{color:"#f59e0b"}}>{c.producto||"—"}</span></td>
                            <td style={tdStyle}><span style={{color:T.text,fontSize:11}}>{tanquesNombres||"—"}</span></td>
                            <td style={tdStyle}><span style={{color:T.text}}>{fmt(c.total_antes)}</span></td>
                            <td style={tdStyle}><span style={{color:T.text}}>{fmt(c.total_despues)}</span></td>
                            <td style={tdStyle}><span style={{color:"#00e5a0",fontWeight:700}}>{fmt(Math.abs(movido))}</span></td>
                            <td style={tdStyle}><span style={{color:T.muted,fontSize:11}}>{c.operador||"—"}</span></td>
                            <td style={{...tdStyle,whiteSpace:"nowrap"}} onClick={e=>e.stopPropagation()}>
                              <div style={{display:"flex",gap:6}}>
                                <button onClick={()=>setCmtExpandido(expandido?null:c.id)} style={{background:"#00b4ff22",border:"1px solid #00b4ff55",borderRadius:6,color:"#00b4ff",padding:"4px 10px",fontSize:11,cursor:"pointer",fontFamily:"monospace",fontWeight:700}}>
                                  {expandido?"▲ Cerrar":"▼ Ver"}
                                </button>
                                {puedeEditar("cmt",c.creado_por,c.created_at) && (
                                  <button onClick={()=>{
                                    setForm({...c});
                                    setCmtAntes(c.tanques_antes||[{tanque:"",sonda:"",galones:""}]); setCmtProducto(c.producto||"");
                                    setCmtDespues(c.tanques_despues||[{tanque:"",producto:"",sonda:"",galones:""}]);
                                    setCmtCarros(c.carros||[{placa:"",guia:"",tiquete:"",pbs_id:""}]);
                                    setCmtRecepcion(c.tanques_recepcion||[{tanque:"",sondaInicial:"",tempInicial:"",apiInicial:"",galonesInicial:"",sondaFinal:"",tempFinal:"",apiFinal:"",galonesFinal:""}]);
                                    setModal("cmt");
                                  }} style={{background:"#00e5a022",border:"1px solid #00e5a055",borderRadius:6,color:"#00e5a0",padding:"4px 10px",fontSize:11,cursor:"pointer",fontFamily:"monospace",fontWeight:700}}>
                                    ✏ Corregir
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                          {expandido && (
                            <tr>
                              <td colSpan={10} style={{padding:"0 0 2px 0",background:"#f1f5f9",borderBottom:`2px solid ${T.border}`}}>
                                <div style={{padding:"16px 20px",display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
                                  <div style={{background:"#ffffff",borderRadius:8,padding:"12px 14px",border:`1px solid ${T.border}`,borderLeft:"3px solid #3b82f6"}}>
                                    <div style={{fontSize:10,color:"#3b82f6",fontWeight:700,textTransform:"uppercase",letterSpacing:1,marginBottom:8}}>Medida Inicial</div>
                                    {(c.tanques_antes||[]).map((t,i)=>(
                                      <div key={i} style={{display:"flex",justifyContent:"space-between",fontSize:11,marginBottom:4,paddingBottom:4,borderBottom:`1px solid ${T.border}`}}>
                                        <span style={{color:T.navy,fontWeight:700}}>{t.tanque||"—"}</span>
                                        <span style={{color:T.muted}}>Sonda: {t.sonda||"—"}</span>
                                        <span style={{color:"#f59e0b",fontWeight:700}}>{fmt(t.galones)} Gls</span>
                                      </div>
                                    ))}
                                    <div style={{fontSize:11,color:T.muted,marginTop:4}}>Total: <b style={{color:T.navy}}>{fmt(c.total_antes)} Gls</b></div>
                                  </div>
                                  <div style={{background:"#ffffff",borderRadius:8,padding:"12px 14px",border:`1px solid ${T.border}`,borderLeft:"3px solid #8b5cf6"}}>
                                    <div style={{fontSize:10,color:"#8b5cf6",fontWeight:700,textTransform:"uppercase",letterSpacing:1,marginBottom:8}}>Medida Final</div>
                                    {(c.tanques_despues||[]).map((t,i)=>(
                                      <div key={i} style={{display:"flex",justifyContent:"space-between",fontSize:11,marginBottom:4,paddingBottom:4,borderBottom:`1px solid ${T.border}`}}>
                                        <span style={{color:T.navy,fontWeight:700}}>{t.tanque||"—"}</span>
                                        <span style={{color:T.muted}}>Sonda: {t.sonda||"—"}</span>
                                        <span style={{color:"#f59e0b",fontWeight:700}}>{fmt(t.galones)} Gls</span>
                                      </div>
                                    ))}
                                    <div style={{fontSize:11,color:T.muted,marginTop:4}}>Total: <b style={{color:T.navy}}>{fmt(c.total_despues)} Gls</b></div>
                                  </div>
                                  {(c.carros||[]).length>0 && (c.tipo_operacion||"")==="DESCARGUE DE CARROTANQUE" && (
                                    <div style={{background:"#ffffff",borderRadius:8,padding:"12px 14px",border:`1px solid ${T.border}`,borderLeft:"3px solid #6b8fa8",gridColumn:"1/-1"}}>
                                      <div style={{fontSize:10,color:"#6b8fa8",fontWeight:700,textTransform:"uppercase",letterSpacing:1,marginBottom:8}}>Carros Descargados</div>
                                      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:8}}>
                                        {(c.carros||[]).map((cr,i)=>(
                                          <div key={i} style={{background:"#f8fafc",borderRadius:8,padding:"8px 10px",fontSize:11,border:`1px solid ${T.border}`}}>
                                            <div style={{color:T.navy,fontWeight:700,marginBottom:3}}>{cr.placa||"Sin placa"}</div>
                                            {cr.tiquete&&<div style={{color:"#3b82f6"}}>Tiquete: {cr.tiquete}</div>}
                                            {cr.guia&&<div style={{color:T.muted}}>Guía: {cr.guia}</div>}
                                            {cr.pbs_id&&<div style={{color:T.orange}}>PBS: {cr.pbs_id}</div>}
                                            {cr.hora_inicio&&<div style={{color:T.muted}}>Inicio: {cr.hora_inicio} — Fin: {cr.hora_final||"—"}</div>}
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                  {(c.tipo_operacion||"")==="TRASIEGO DE PRODUCTO" && (c.tanques_recepcion||[]).length>0 && (
                                    <div style={{background:"#ffffff",borderRadius:8,padding:"12px 14px",border:`1px solid ${T.border}`,borderLeft:"3px solid #10b981",gridColumn:"1/-1"}}>
                                      <div style={{fontSize:10,color:"#10b981",fontWeight:700,textTransform:"uppercase",letterSpacing:1,marginBottom:8}}>Tanque de Recepción</div>
                                      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))",gap:8}}>
                                        {(c.tanques_recepcion||[]).map((r,i)=>(
                                          <div key={i} style={{background:"#f8fafc",borderRadius:8,padding:"8px 12px",fontSize:11,border:`1px solid ${T.border}`}}>
                                            <div style={{color:"#10b981",fontWeight:700,marginBottom:6,fontSize:12}}>{r.tanque||"—"}</div>
                                            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:4}}>
                                              <div style={{color:"#3b82f6",fontSize:10,fontWeight:700,marginBottom:2}}>INICIAL</div>
                                              <div style={{color:"#8b5cf6",fontSize:10,fontWeight:700,marginBottom:2}}>FINAL</div>
                                              <div style={{color:T.muted}}>Sonda: <b style={{color:T.navy}}>{r.sondaInicial||"—"}</b></div>
                                              <div style={{color:T.muted}}>Sonda: <b style={{color:T.navy}}>{r.sondaFinal||"—"}</b></div>
                                              <div style={{color:T.muted}}>Temp: <b style={{color:T.navy}}>{r.tempInicial||"—"}</b></div>
                                              <div style={{color:T.muted}}>Temp: <b style={{color:T.navy}}>{r.tempFinal||"—"}</b></div>
                                              <div style={{color:"#f59e0b",fontWeight:700}}>{fmt(r.galonesInicial||0)} Gls</div>
                                              <div style={{color:"#f59e0b",fontWeight:700}}>{fmt(r.galonesFinal||0)} Gls</div>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                  <div style={{gridColumn:"1/-1",display:"flex",gap:20,fontSize:11,color:T.muted,flexWrap:"wrap",paddingTop:4,borderTop:`1px solid ${T.border}`,marginTop:4}}>
                                    {c.sede&&<span>Sede: <b style={{color:T.navy}}>{c.sede}{c.planta?` · ${c.planta}`:""}</b></span>}
                                    {c.operador&&<span>Operador: <b style={{color:T.navy}}>{c.operador}</b></span>}
                                    {c.placa&&<span>Placa: <b style={{color:T.navy}}>{c.placa}</b></span>}
                                    {c.guia&&<span>Guía: <b style={{color:T.navy}}>{c.guia}</b></span>}
                                    {c.tiquete_entrada&&<span>Tiquete: <b style={{color:"#3b82f6"}}>{c.tiquete_entrada}</b></span>}
                                    {(c.tipo_operacion||"")==="TRASIEGO DE PRODUCTO"&&c.pbs_id&&<span>PBS: <b style={{color:T.orange}}>{c.pbs_id}</b></span>}
                                    <span style={{marginLeft:"auto",color: movido>=0?"#059669":"#dc2626",fontWeight:700,fontSize:13}}>
                                      {movido>=0?"▲ Recibido:":"▼ Despachado:"} {fmt(Math.abs(movido))} Gls
                                    </span>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                          </React.Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </>);
              })()}
            </div>
          )}

          {/* TANQUES */}
          {nav==="tanques" && (()=>{
            const REMANENTE = id => ["TK-111","TK-116","TK-117"].includes(id) ? 4500 : 3800;
            const CAP_OPERATIVA = t => Math.round(t.capacidad * 0.9);
            const CARROS = 9200;
            const byId = id => tanques.find(t=>t.id===id);

            // Escala 1-100: h = proporción de altura en la columna (flex-grow)
            //               w = % del ancho de la columna que ocupa el tanque
            // TK-111 es referencia. Las demás capacidades:
            //   TK-112 = 70% h de 111 → h=39 (70% de 55)
            //   TK-116/117 = 66% h de 111 → h=36 (66% de 55)
            //   TK-113/114/115 = 55% h de 111 → h=30 (55% de 55)
            const CFG = {
              "TK-111": { h: 55, w: 86 },
              "TK-112": { h: 55, w: 86 },
              "TK-113": { h: 55, w: 86 },
              "TK-114": { h: 55, w: 86 },
              "TK-115": { h: 55, w: 86 },
              "TK-116": { h: 55, w: 86 },
              "TK-117": { h: 55, w: 86 },
            };

            // Tanque 3D: perspectiva frontal ligera desde arriba
            // Tanque 3D industrial: paredes negras, interior gris metálico, líquido visible
            const CilindroSVG = ({pct, color, label, producto="", W=300, H=300}) => {
              const cx    = W / 2;
              const ew    = W * 0.86;
              const eh    = ew * 0.20;
              const lx    = cx - ew/2;
              const rx    = cx + ew/2;
              const botY  = H - eh/2 - 6;
              const cylH  = H * 0.52;
              const topY  = botY - cylH;
              const domeH = cylH * 0.19;
              const peakY = topY - domeH;

              // Zona interior (descuenta grosor de pared ~9% cada lado)
              const wall  = ew * 0.09;
              const iRX   = ew/2 - wall;       // radio interior
              const iLX   = cx - iRX;
              const iRX2  = cx + iRX;

              const fillH  = cylH * Math.min(pct, 100) / 100;
              const fillTopY = botY - fillH;
              const fc = color || "#3d3d5c";

              const domePath    = `M ${lx},${topY} Q ${lx+ew*0.08},${peakY+domeH*0.1} ${cx},${peakY} Q ${rx-ew*0.08},${peakY+domeH*0.1} ${rx},${topY} A ${ew/2},${eh/2} 0 0,1 ${lx},${topY} Z`;
              const domeOutline = `M ${lx},${topY} Q ${lx+ew*0.08},${peakY+domeH*0.1} ${cx},${peakY} Q ${rx-ew*0.08},${peakY+domeH*0.1} ${rx},${topY}`;

              return (
                <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" style={{width:"100%",height:"100%",display:"block"}}>
                  <defs>
                    {/* Clip baranda amarilla: solo zona del domo, borde inferior = topY */}
                    <clipPath id={`ry-${label}`}>
                      <rect x={lx} y={topY - domeH - 20} width={ew} height={domeH + 20}/>
                    </clipPath>
                    {/* Clip arco rojo: ancho del tanque, zona justo en topY */}
                    <clipPath id={`rr-${label}`}>
                      <rect x={lx} y={topY - 10} width={ew} height={25}/>
                    </clipPath>
                    {/* Clip zona interior: mitad derecha (corte transversal) */}
                    <clipPath id={`ci-${label}`}>
                      <rect x={cx} y={topY} width={iRX} height={cylH+2}/>
                    </clipPath>

                    {/* Gradiente cuerpo: mitad izq negra (exterior), mitad der gris (interior) */}
                    <linearGradient id={`cg-${label}`} x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%"   stopColor="#0a0a0a"/>
                      <stop offset="7%"   stopColor="#0f0f0f"/>
                      <stop offset="49%"  stopColor="#0f0f0f"/>
                      <stop offset="51%"  stopColor="#606060"/>
                      <stop offset="89%"  stopColor="#4e4e4e"/>
                      <stop offset="97%"  stopColor="#111111"/>
                      <stop offset="100%" stopColor="#050505"/>
                    </linearGradient>

                    {/* Gradiente gris interior (vacío) */}
                    <linearGradient id={`ig-${label}`} x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%"   stopColor="#707070"/>
                      <stop offset="40%"  stopColor="#686868"/>
                      <stop offset="100%" stopColor="#505050"/>
                    </linearGradient>

                    {/* Gradiente líquido vertical */}
                    <linearGradient id={`lg-${label}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%"   stopColor={fc} stopOpacity="0.9"/>
                      <stop offset="100%" stopColor={fc} stopOpacity="1"/>
                    </linearGradient>

                    {/* Gradiente domo */}
                    <linearGradient id={`dg-${label}`} x1="0" y1="1" x2="0" y2="0">
                      <stop offset="0%"   stopColor="#1a1a1a"/>
                      <stop offset="100%" stopColor="#0a0a0a"/>
                    </linearGradient>

                    {/* Sombra profundidad interior derecha */}
                    <linearGradient id={`sd-${label}`} x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%"   stopColor="#000000" stopOpacity="0.0"/>
                      <stop offset="45%"  stopColor="#000000" stopOpacity="0.08"/>
                      <stop offset="80%"  stopColor="#000000" stopOpacity="0.35"/>
                      <stop offset="100%" stopColor="#000000" stopOpacity="0.65"/>
                    </linearGradient>
                  </defs>

                  {/* ── CUERPO: paredes negras + zona interior gris en gradiente ── */}
                  <rect x={lx} y={topY} width={ew} height={cylH} fill={`url(#cg-${label})`}/>

                  {/* ── INTERIOR GRIS (espacio vacío) ── */}
                  <rect x={iLX} y={topY} width={iRX*2} height={cylH} fill={`url(#ig-${label})`} clipPath={`url(#ci-${label})`}/>

                  {/* ── LÍQUIDO (sube desde el fondo) ── */}
                  {pct > 0 && (
                    <g clipPath={`url(#ci-${label})`}>
                      <rect x={iLX} y={fillTopY} width={iRX*2} height={fillH+2} fill={`url(#lg-${label})`}/>
                      {/* Superficie del líquido */}
                      <ellipse cx={cx} cy={fillTopY} rx={iRX} ry={eh*0.32} fill={fc}/>
                      {/* Reflejo en superficie */}
                      <ellipse cx={cx-iRX*0.2} cy={fillTopY} rx={iRX*0.35} ry={eh*0.12} fill="#ffffff" opacity="0.10"/>
                    </g>
                  )}

                  {/* ── SOMBRA PROFUNDIDAD: simula curvatura interior fondo ── */}
                  <rect x={cx} y={topY} width={iRX} height={cylH}
                    fill={`url(#sd-${label})`} clipPath={`url(#ci-${label})`}/>

                  {/* ── ELIPSE BASE (fondo) ── */}
                  <ellipse cx={cx} cy={botY} rx={ew/2} ry={eh/2} fill="#0d0d0d"/>

                  {/* ── ARO SUPERIOR ── */}
                  <ellipse cx={cx} cy={topY} rx={ew/2} ry={eh/2} fill="#1a1a1a"/>

                  {/* ── DOMO CONVEXO ── */}
                  <path d={domePath} fill={`url(#dg-${label})`}/>
                  <path d={domeOutline} fill="none" stroke="#333" strokeWidth="1.2"/>
                  {/* Reflejo sutil domo */}
                  <path d={`M ${cx-ew*0.22},${topY-domeH*0.28} Q ${cx},${peakY+domeH*0.25} ${cx+ew*0.18},${topY-domeH*0.45}`}
                    fill="none" stroke="#fff" strokeWidth="0.7" opacity="0.05"/>

                  {/* ── BARANDA AMARILLA (encima del domo, clippeada hasta topY) ── */}
                  <g clipPath={`url(#ry-${label})`}>
                    {(()=>{ const yw=12.5, yo=yw/2, erx=ew/2+yo, ery=eh/2+yo;
                      const d=`M ${cx},${topY-ery} A ${erx},${ery} 0 0,0 ${cx-erx},${topY}`; return (<>
                      <path d={d} fill="none" stroke="#f5c400" strokeWidth={yw}/>
                      <path d={d} fill="none" stroke="#e8eef4" strokeWidth={yw*0.52}
                        strokeDasharray="11 3" strokeDashoffset="11" strokeLinecap="butt"/>
                    </>); })()}
                  </g>
                  {/* ── ARO ROJO (cuarto derecho, encima del domo) ── */}
                  <g clipPath={`url(#rr-${label})`}>
                    {(()=>{ const rw=7.5, rcy=topY+rw/2; return (
                      <path d={`M ${rx},${rcy} A ${ew/2},${eh/2} 0 0,1 ${cx},${rcy+eh/2}`}
                        fill="none" stroke="#cc2200" strokeWidth={rw}/>
                    ); })()}
                  </g>

                  {/* ── CARA INTERNA DEL TECHO (corte derecho) ── */}
                  {(()=>{
                    const innerDomeDepth = domeH * 0.82;
                    const innerPeakY = topY - innerDomeDepth;
                    return (
                      <g clipPath={`url(#ci-${label})`}>
                        <path d={`M ${cx},${topY} Q ${cx+iRX*0.5},${innerPeakY+innerDomeDepth*0.12} ${cx+iRX},${topY} L ${cx+iRX},${topY-2} Q ${cx+iRX*0.5},${innerPeakY} ${cx},${topY-2} Z`}
                          fill="#2a2a2a"/>
                        <path d={`M ${cx},${topY} Q ${cx+iRX*0.5},${innerPeakY+innerDomeDepth*0.12} ${cx+iRX},${topY}`}
                          fill="none" stroke="#444" strokeWidth="0.8" opacity="0.7"/>
                      </g>
                    );
                  })()}

                  {/* ── PORCENTAJE ── */}
                  <text x={cx + ew/4} y={topY + cylH*0.52} textAnchor="middle" dominantBaseline="middle"
                    fill={pct > 15 ? "#ffffff" : "#cccccc"}
                    fontSize={W*0.11} fontWeight="bold" fontFamily="monospace" opacity="0.9">{pct}%</text>

                  {/* ── IDENTIFICADOR: círculo blanco con número rojo + producto editable ── */}
                  {(()=>{
                    const bx = lx + ew * 0.26;
                    const by = topY + cylH * 0.50;
                    const br = W * 0.095;
                    const num = label.replace("TK-","");
                    return (
                      <g>
                        <circle cx={bx} cy={by} r={br} fill="#ffffff" opacity="0.95"/>
                        <circle cx={bx} cy={by} r={br} fill="none" stroke="#cccccc" strokeWidth="1.2"/>
                        <text x={bx} y={by} textAnchor="middle" dominantBaseline="middle"
                          fill="#cc0000" fontSize={W*0.085} fontWeight="900" fontFamily="monospace">{num}</text>
                        {producto && (
                          <text x={bx} y={by + br + W*0.055} textAnchor="middle" dominantBaseline="middle"
                            fill="#ffffff" fontSize={W*0.058} fontWeight="700" fontFamily="monospace"
                            opacity="0.92" style={{cursor:"pointer"}}
                            onClick={()=>setTankProdEdit({id:label, val:producto})}>{producto}</text>
                        )}
                      </g>
                    );
                  })()}
                </svg>
              );
            };

            const guardarProductoTanque = async (tkId, nuevo) => {
              const val = (nuevo||"").trim().toUpperCase();
              const t = byId(tkId);
              if (!val || val === (t?.producto||"").toUpperCase()) { setTankProdEdit(null); return; }
              setTankProdSaving(true);
              const {error} = await supabase.from("tanques").update({producto: val}).eq("id", tkId);
              setTankProdSaving(false);
              setTankProdEdit(null);
              if (error) { showToast("Error al guardar producto", false); return; }
              // Actualizar estado local inmediatamente sin esperar real-time
              setTanques(prev => prev.map(tk => tk.id === tkId ? {...tk, producto: val} : tk));
              showToast(`Producto actualizado a ${val}`, true);
            };

            const TankCard = ({id}) => {
              const cfg = CFG[id] || {h:40, w:75};
              const t = byId(id);
              if (!t) return <div style={{flex:cfg.h}}/>;
              const editProd = tankProdEdit?.id === id;
              const rem = REMANENTE(t.id);
              const capOp = CAP_OPERATIVA(t);
              const nivel = Number(t.nivel||0);
              const pct = Math.round((nivel / t.capacidad) * 100);
              const color = getProductColor(t.producto);
              const dispCargue = Math.max(0, nivel - rem);
              const carrosCargue = Math.floor(dispCargue / CARROS);
              const espLibre = Math.max(0, capOp - nivel);
              const carrosDesc = Math.floor(espLibre / CARROS);
              const stats = [
                {label:"Nivel",    val:fmt(nivel),           color:"#dff0f8", icon:"▊"},
                {label:"Cargue",   val:`${carrosCargue} c`,  color:"#f59e0b", icon:"▲"},
                {label:"Libre",    val:fmt(espLibre),         color:"#00e5a0", icon:"◻"},
                {label:"Descargue",val:`${carrosDesc} c`,     color:"#38bdf8", icon:"▼"},
              ];

              const SH=300, sew=SH*0.86, seh=sew*0.20;
              const sbotY=SH-seh/2-6, scylH=SH*0.52, stopY=sbotY-scylH;
              const aboveRailing = stopY - scylH*0.19*0.05;
              const belowCyl = SH - sbotY;

              return (
                <div style={{ width: id==="TK-111" ? 312 : id==="TK-112" ? 315 : 260, height: id==="TK-111" ? 372 : id==="TK-112" ? 246 : 204, display:"flex", flexDirection:"column", alignItems:"center", flexShrink:0 }}>
                  <div style={{ width:"100%", height:"100%", display:"flex", gap:0 }}>
                    {/* SVG */}
                    <div style={{ flex:1, minWidth:0, minHeight:0, overflow:"hidden", position:"relative" }}>
                      <CilindroSVG pct={pct} color={color} label={t.id} producto={t.producto||""} H={id==="TK-111" ? 432 : id==="TK-112" ? 363 : 300}/>
                      {editProd && (
                        <div style={{ position:"absolute", bottom:"28%", left:"18%", zIndex:10 }}>
                          <input autoFocus value={tankProdEdit.val}
                            onChange={e=>setTankProdEdit({id, val:e.target.value})}
                            onKeyDown={e=>{ if(e.key==="Enter") guardarProductoTanque(id, tankProdEdit.val); if(e.key==="Escape") setTankProdEdit(null); }}
                            onBlur={()=>guardarProductoTanque(id, tankProdEdit.val)}
                            style={{ background:"#0f1e2e", border:"2px solid #3b82f6", borderRadius:6,
                              color:"#fff", fontSize:11, fontWeight:700, padding:"3px 8px",
                              width:72, textTransform:"uppercase", outline:"none", textAlign:"center" }}/>
                          {tankProdSaving && <div style={{fontSize:8,color:"#6b8fa8",textAlign:"center"}}>guardando...</div>}
                        </div>
                      )}
                    </div>
                    {/* Panel stats vertical alineado con cilindro */}
                    <div style={{ flexShrink:0, width:68, display:"flex", flexDirection:"column", marginLeft:-18 }}>
                      <div style={{ flex: aboveRailing }}/>
                      <div style={{ flex: scylH, display:"flex", flexDirection:"column", gap:3 }}>
                        {stats.map(s=>(
                          <div key={s.label} style={{ flex:1, background:"#0f1e2e", borderRadius:6, padding:"3px 6px",
                            borderLeft:`3px solid ${s.color}`, display:"flex", flexDirection:"column", justifyContent:"center", gap:1 }}>
                            <div style={{ fontSize:6.5, color:"#ffffff", textTransform:"uppercase", letterSpacing:0.8, lineHeight:1 }}>{s.icon} {s.label}</div>
                            <div style={{ fontSize:10, fontWeight:800, color:s.color, fontFamily:"monospace", lineHeight:1.2 }}>{s.val}</div>
                          </div>
                        ))}
                      </div>
                      <div style={{ flex: belowCyl }}/>
                    </div>
                  </div>
                </div>
              );
            };

            const TanquesLayout = ({fs}) => (
              <div style={{ position:"relative", width:"100%", height:"100%", background:"#e8eef4", borderRadius: fs ? 0 : 12, overflow:"visible" }}>
                {/* Botón fullscreen */}
                <button onClick={()=>setTankFullscreen(!fs)}
                  style={{ position:"absolute", top:10, right:10, zIndex:10, background:"#1e3a5f", border:"none", borderRadius:8,
                    color:"#fff", padding:"6px 12px", cursor:"pointer", fontSize:13, fontWeight:700, display:"flex", alignItems:"center", gap:6, opacity:0.85 }}>
                  {fs ? "✕ Salir" : "⛶ Presentación"}
                </button>
                {/* Izquierda */}
                <div style={{ position:"absolute", left:8, top:-13 }}><TankCard id="TK-112"/></div>
                <div style={{ position:"absolute", left:8, bottom:8 }}><TankCard id="TK-111"/></div>
                {/* Derecha */}
                <div style={{ position:"absolute", right:8, top:8 }}><TankCard id="TK-117"/></div>
                <div style={{ position:"absolute", right:8, bottom:8 }}><TankCard id="TK-116"/></div>
                {/* Centro — escalonados */}
                <div style={{ position:"absolute", left:"calc(50% - 130px)", top:0 }}><TankCard id="TK-115"/></div>
                <div style={{ position:"absolute", left:"calc(50% - 130px)", top:"calc(50% - 102px)" }}><TankCard id="TK-114"/></div>
                <div style={{ position:"absolute", left:"calc(50% - 130px)", top:"calc(90% - 204px + 50px)" }}><TankCard id="TK-113"/></div>
              </div>
            );

            return (
              <>
                {/* Modo presentación — overlay pantalla completa */}
                {tankFullscreen && (
                  <div style={{ position:"fixed", inset:0, zIndex:9999, background:"#e8eef4" }}
                    onKeyDown={e=>{ if(e.key==="Escape") setTankFullscreen(false); }} tabIndex={-1}>
                    <TanquesLayout fs={true}/>
                  </div>
                )}
                <div style={{ height:"calc(100vh - 118px)", display:"flex", flexDirection:"column" }}>
                  <TanquesLayout fs={false}/>
                </div>
              </>
            );
          })()}

          {/* DESPACHO */}
          {nav==="despacho" && (
            <div>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:22 }}>
                <div>
                  <div style={{ fontWeight:800, fontSize:20, color:T.navy }}>Despacho a Buques</div>
                  <div style={{ fontSize:11, color:T.muted }}>Carga en barcaza → manguera al buque</div>
                </div>
                <div style={{display:"flex",gap:8,alignItems:"center"}}>
                  {["administrador","gerencia"].includes(perfil.rol) && (
                    <select value={sedeFiltro} onChange={e=>setSedeFiltro(e.target.value)}
                      style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:6,padding:"6px 12px",color:T.text,fontSize:12,outline:"none"}}>
                      <option value="TODAS">Todas</option>
                      {SEDES.map(s=><option key={s}>{s}</option>)}
                    </select>
                  )}
                  {puedeCrear("despachos") && <Btn color="#c084fc" onClick={()=>{setForm({fecha:today(),sede:sedeFiltro==="TODAS"?"MALAMBO":sedeFiltro});setModal("despacho");}}>+ Nuevo Despacho</Btn>}
                </div>
              </div>
              <Table
                cols={["ID","Fecha","Buque","Producto","Volumen (Gls)","Barcaza","Tanque","Destino","Operador",""]}
                rows={despachosFiltrados.map(d=>[
                  <span style={{color:"#c084fc"}}>{d.id}</span>,
                  d.fecha, d.buque,
                  <Badge label={d.producto} color={d.producto==="MGO"?"#c084fc":"#00e5a0"}/>,
                  <span style={{fontWeight:700}}>{fmt(d.volumen)}</span>,
                  d.barcaza, d.tanque, d.destino, d.operador,
                  puedeEditar("despachos",d.creado_por,d.created_at)
                    ? <button onClick={()=>{setForm({...d});setModal("despacho");}} style={{background:"#c084fc22",border:"1px solid #c084fc55",borderRadius:6,color:"#c084fc",padding:"3px 10px",fontSize:11,cursor:"pointer",fontFamily:"monospace"}}>✏ Editar</button>
                    : null,
                ])}
              />
            </div>
          )}

          {/* TRAZABILIDAD */}
          {nav==="trazabilidad" && (
            <div>
              <div style={{ fontWeight:800, fontSize:20, color:T.navy, marginBottom:4 }}>Trazabilidad Completa</div>
              <div style={{ fontSize:11, color:T.muted, marginBottom:22 }}>Cargue → Tiquete → PBS → CMT → Despacho</div>
              <div style={{ display:"grid", gap:14 }}>
                {viajes.map(v=>{
                  const tq = tiquetes.find(t=>t.viaje_id===v.id);
                  const pb = pbsList.find(p=>p.viaje_id===v.id);
                  const cm = cmts.find(c=>c.placa===v.placa);
                  return (
                    <Card key={v.id}>
                      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
                        <div style={{ display:"flex", alignItems:"center", gap:10, flexWrap:"wrap" }}>
                          <span style={{ color:"#f59e0b", fontWeight:700 }}>{v.id}</span>
                          <span style={{ fontWeight:700 }}>{v.producto}</span>
                          <span style={{ color:T.muted, fontSize:11 }}>{v.placa} · {v.fecha}</span>
                        </div>
                        <Badge label={v.estado} color={v.estado==="Descargado"?"#00e5a0":v.estado==="Rechazado"?"#ff4d4d":"#f59e0b"}/>
                      </div>
                      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))", gap:10 }}>
                        <div style={{ background:"#162535", borderRadius:10, padding:"10px 12px", borderLeft:"3px solid #f59e0b" }}>
                          <div style={{ fontSize:10, color:"#f59e0b", marginBottom:6 }}>🚛 LOGÍSTICA</div>
                          <div style={{ fontSize:11 }}>{v.transportadora}</div>
                          <div style={{ fontSize:11, color:T.muted }}>Guía: {v.guia}</div>
                          <div style={{ fontSize:11, color:T.muted }}>{fmt(v.volumen_guia)} Gls</div>
                        </div>
                        <div style={{ background:"#162535", borderRadius:10, padding:"10px 12px", borderLeft:`3px solid ${tq?(tq.resultado==="APROBADO"?"#00e5a0":"#ff4d4d"):"#6b8fa8"}` }}>
                          <div style={{ fontSize:10, color:"#00b4ff", marginBottom:6 }}>🧪 TIQUETE</div>
                          {tq?<><Badge label={tq.resultado} color={tq.resultado==="APROBADO"?"#00e5a0":"#ff4d4d"}/><div style={{ fontSize:11, color:T.muted, marginTop:4 }}>API: {tq.api_corregido}° · {fmt(tq.galones_recibidos)} Gls</div></>:<div style={{ fontSize:11, color:"#f59e0b" }}>Pendiente</div>}
                        </div>
                        <div style={{ background:"#162535", borderRadius:10, padding:"10px 12px", borderLeft:`3px solid ${pb?"#fb923c":"#6b8fa8"}` }}>
                          <div style={{ fontSize:10, color:"#fb923c", marginBottom:6 }}>🔒 PBS</div>
                          {pb?<><div style={{ fontSize:11 }}>{pb.id}</div><div style={{ fontSize:11, color:T.muted }}>{pb.bodega_recibe}</div></>:<div style={{ fontSize:11, color:"#f59e0b" }}>Pendiente</div>}
                        </div>
                        <div style={{ background:"#162535", borderRadius:10, padding:"10px 12px", borderLeft:`3px solid ${cm?"#00e5a0":"#6b8fa8"}` }}>
                          <div style={{ fontSize:10, color:"#00e5a0", marginBottom:6 }}>📋 CMT</div>
                          {cm?<><div style={{ fontSize:11 }}>No. {cm.numero_cmt}</div><div style={{ fontSize:11, fontWeight:700, color:"#00e5a0" }}>+{fmt(cm.total_movido)} Gls</div></>:<div style={{ fontSize:11, color:"#f59e0b" }}>Pendiente</div>}
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}
         {nav==="usuarios" && (
  <div>
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:22 }}>
      <div>
        <div style={{ fontWeight:800, fontSize:20, color:T.navy }}>Gestión de Usuarios</div>
        <div style={{ fontSize:11, color:T.muted }}>Roles, permisos y accesos · {perfiles.length} usuarios</div>
      </div>
      <Btn color={T.orange} onClick={()=>{setForm({planta:"PLANTA 1",rol:"logistica"});setModal("usuario");}}>+ Nuevo Usuario</Btn>
    </div>
    <div style={{ display:"grid", gap:12 }}>
      {perfiles.map(p=>(
        <Card key={p.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"14px 20px" }}>
          <div style={{ display:"flex", alignItems:"center", gap:16 }}>
            <div style={{ width:40, height:40, background:ROLES[p.rol]?.color+"22", border:`1px solid ${ROLES[p.rol]?.color}44`, borderRadius:10, display:"flex", alignItems:"center", justifyContent:"center", fontSize:18 }}>{ROLES[p.rol]?.icon}</div>
            <div>
              <div style={{ fontWeight:700, fontSize:14 }}>{p.nombre}</div>
              <div style={{ fontSize:11, color:T.muted }}>
                Cédula: {p.cedula || (p.email||"").replace("@quimibuques.com","") || "—"} · {p.planta}
              </div>
            </div>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            {p.activo===false && <Badge label="Deshabilitado" color="#aaa"/>}
            <Badge label={ROLES[p.rol]?.label||p.rol} color={ROLES[p.rol]?.color||"#6b8fa8"}/>
            <Btn sm color={T.orange} outline onClick={()=>{
              const MODS = ["viajes","tiquetes","pbs","cmt","tanques","despachos","trazabilidad"];
              const base = MODS.reduce((acc,m)=>({...acc,[m]:{ver:false,crear:false,editar:false,eliminar:false,...((p.permisos||{})[m]||{})}}),{});
              setEditUsuario({...p});
              setPermsEdit(base);
            }}>Gestionar Usuario</Btn>
          </div>
        </Card>
      ))}
    </div>
  </div>
)}

      {/* ═══ FORMS (inline in content area) ═══ */}

      {modal==="viaje" && (
        <Modal title={form.id ? `Editar Viaje ${form.id}` : "Registrar Nuevo Viaje"} onClose={()=>setModal(null)} wide inline>
          <Section title="Identificación del Viaje" color="#f59e0b">
            <Grid cols={3}>
              <Sel label="Sede de Destino" value={form.sede||"MALAMBO"} onChange={f("sede")}>
                {SEDES.map(s=><option key={s}>{s}</option>)}
              </Sel>
              <Sel label="Planta de Recibo" value={form.planta||""} onChange={f("planta")}>
                <option value="">Seleccionar...</option>
                {SEDES.map(s=><option key={s}>{s}</option>)}
              </Sel>
              <Inp label="Fecha de Cargue" type="date" value={form.fecha||""} onChange={f("fecha")}/>
            </Grid>
            <Grid cols={2}>
              <Sel label="Producto" value={form.producto||""} onChange={f("producto")}>
                <option value="">Seleccionar...</option>
                {MATERIAS_PRIMAS.map(p=><option key={p}>{p}</option>)}
                <option value="VLSFO">VLSFO</option>
                <option value="MGO">MGO</option>
              </Sel>
              <Sel label="Transportadora" value={form.transportadora||""} onChange={f("transportadora")}>
                <option value="">Seleccionar...</option>
                {TRANSPORTADORAS.map(t=><option key={t}>{t}</option>)}
              </Sel>
              <Inp label="Placa" type="text" value={form.placa||""} onChange={f("placa")}/>
              <Inp label="Número de Guía" type="text" value={form.guia||""} onChange={f("guia")}/>
              <Inp label="Conductor" type="text" value={form.conductor||""} onChange={f("conductor")}/>
              <Inp label="Cédula Conductor" type="text" value={form.cedula||""} onChange={f("cedula")}/>
              <Inp label="Barriles NSV (campo)" type="number" value={form.barriles_nsv||""} onChange={f("barriles_nsv")}/>
            </Grid>
          </Section>
          <Section title="Volúmenes y Financiero" color="#00b4ff">
            <Grid cols={3}>
              <Inp label="Gls Netos Guía" type="number" value={form.gls_netos_guia||""} onChange={f("gls_netos_guia")}/>
              <Inp label="Gls Recibidos" type="number" value={form.gls_recibidos||""} onChange={f("gls_recibidos")}/>
              <div>
                <Lbl>Gls Faltantes</Lbl>
                <div style={{background:"#162535",border:"1px solid #ffffff14",borderRadius:8,padding:"8px 10px",fontSize:12,fontFamily:"monospace",color:Number(form.gls_netos_guia||0)-Number(form.gls_recibidos||0)>0?"#ff4d4d":"#00e5a0",fontWeight:700}}>
                  {fmt(Math.max(0, Number(form.gls_netos_guia||0)-Number(form.gls_recibidos||0)))} Gls
                </div>
              </div>
              <Inp label="Flete ($ x Gal)" type="number" value={form.flete||""} onChange={f("flete")}/>
              <Inp label="Bono ($)" type="number" value={form.bono||""} onChange={f("bono")}/>
              <div>
                <Lbl>Total Flete ($)</Lbl>
                <div style={{background:"#162535",border:"1px solid #ffffff14",borderRadius:8,padding:"8px 10px",fontSize:12,fontFamily:"monospace",color:"#00e5a0",fontWeight:700}}>
                  {fmt(Number(form.gls_netos_guia||0)*Number(form.flete||0)+Number(form.bono||0))}
                </div>
              </div>
            </Grid>
          </Section>
          <Section title="Logística en Planta" color="#c084fc">
            <Grid cols={3}>
              <Inp label="Fecha Aprox. Llegada" type="date" value={form.fecha_aprox_llegada||""} onChange={f("fecha_aprox_llegada")}/>
              <Inp label="Fecha de Llegada" type="date" value={form.fecha_llegada||""} onChange={f("fecha_llegada")}/>
              <Inp label="Fecha de Descargue" type="date" value={form.fecha_descargue||""} onChange={f("fecha_descargue")}/>
              <Inp label="Stand By (días)" type="number" min="0" value={form.standby||0} onChange={f("standby")}/>
              <Inp label="Valor Stand By ($)" type="number" value={form.valor_standby||""} onChange={f("valor_standby")}/>
            </Grid>
            <Grid cols={1}>
              <Inp label="Observación" type="text" value={form.observacion||""} onChange={f("observacion")}/>
            </Grid>
          </Section>
          <div style={{ display:"flex", justifyContent:"flex-end", gap:10, marginTop:12 }}>
            <Btn outline onClick={()=>setModal(null)}>Cancelar</Btn>
            <Btn color="#f59e0b" onClick={guardarViaje} disabled={saving}>{saving?"Guardando...":form.id?"Actualizar Viaje":"Registrar Viaje"}</Btn>
          </div>
        </Modal>
      )}

      {modal==="tiquete" && (()=>{
        const esAdmin = perfil.rol === "administrador";
        const tieneViaje = !!form.viaje_id;
        const soloLab = !esAdmin && tieneViaje;
        const tipoA = form.tipo_analisis||"Tiquetes MP";
        const esMP = tipoA === "Tiquetes MP";
        const tituloModal = form.id
          ? `Editar ${esMP?"Tiquete":("Análisis "+tipoA.replace("Tiquetes MP",""))} ${form.id}`
          : esMP ? "Tiquete de Ingreso de Materia Prima"
          : `Análisis ${tipoA}`;
        return (
        <Modal title={tituloModal} onClose={()=>setModal(null)} wide inline>
          <Section title="Identificación" color="#00b4ff">
            <Grid cols={esMP?2:3}>
              <Inp label="Proveedor / Campo Origen" type="text" value={form.proveedor||""} onChange={f("proveedor")}/>
              <Inp label="Producto" type="text" value={form.producto||""} onChange={f("producto")} readOnly={soloLab}/>
              {esMP && <Inp label="Placa" type="text" value={form.placa||""} onChange={f("placa")} readOnly={soloLab}/>}
              {esMP && <Inp label="Cédula Conductor" type="text" value={form.cedula||""} onChange={f("cedula")}/>}
              {esMP && <Inp label="Nombre Conductor" type="text" value={form.nombre_conductor||""} onChange={f("nombre_conductor")}/>}
              {esMP && <Inp label="Fecha Cargue" type="date" value={form.fecha_cargue||""} onChange={f("fecha_cargue")} readOnly={soloLab}/>}
              <Inp label="Fecha de Análisis" type="date" value={form.fecha_llegada||today()} onChange={f("fecha_llegada")} readOnly={esMP&&soloLab}/>
            </Grid>
          </Section>
          <Section title="Análisis API" color="#00b4ff">
            <Grid cols={7}>
              <Inp label="API Reportado" type="number" step="0.1" value={form.api_reportado||""} onChange={e=>{const v=e.target.value;const d=v.split(".");if(d[1]&&d[1].length>1)return;setForm(p=>({...p,api_reportado:v}));}}/>
              <Inp label="API Observado" type="number" step="0.1" value={form.api_observado||""} onChange={e=>{const v=e.target.value;const d=v.split(".");if(d[1]&&d[1].length>1)return;setForm(p=>({...p,api_observado:v}));}}/>
              <Inp label="API Corregido 60°F" type="number" step="0.1" value={form.api_corregido||""} onChange={e=>{
                const v=e.target.value; const d=v.split("."); if(d[1]&&d[1].length>1)return;
                const api = Number(v||0);
                const temp = Number(form.temp_observada||0);
                setForm(prev=>{
                  const next = {...prev, api_corregido: e.target.value};
                  if (api > 0 && form.temp_observada) {
                    const rho15 = 141500/(131.5+api);
                    const alpha = 631.2283/(rho15*rho15);
                    const vcf = Math.exp(-alpha*(temp-15)*(1+0.8*alpha*(temp-15)));
                    next.factor_conversion = vcf.toFixed(4);
                  }
                  if (api > 0) next.factor_tabla13 = tabla13Factor(api);
                  return next;
                });
              }}/>
              <Inp label="Temperatura Obs. (°C)" type="number" step="0.1" value={form.temp_observada||""} onChange={e=>{
                const temp = e.target.value;
                const api = Number(form.api_corregido||0);
                setForm(prev=>{
                  const next = {...prev, temp_observada: temp};
                  if (temp !== "") next.temp_observada_f = (Number(temp)*9/5+32).toFixed(1);
                  if (api > 0 && temp !== "") {
                    const rho15 = 141500/(131.5+api);
                    const alpha = 631.2283/(rho15*rho15);
                    const vcf = Math.exp(-alpha*(Number(temp)-15)*(1+0.8*alpha*(Number(temp)-15)));
                    next.factor_conversion = vcf.toFixed(4);
                  }
                  return next;
                });
              }}/>
              <Inp label="Temperatura Obs. (°F)" type="number" step="0.1" value={form.temp_observada_f||""} onChange={f("temp_observada_f")} readOnly/>
              <Inp label="Factor VCF" type="number" step="0.0001" value={form.factor_conversion||""} onChange={f("factor_conversion")} readOnly/>
              <Inp label="Factor Tabla 13" type="number" step="0.0001" value={form.factor_tabla13||""} onChange={f("factor_tabla13")} readOnly/>
            </Grid>
          </Section>
          <Section title="Calidad" color="#00b4ff">
            <Grid cols={5}>
              <Inp label="Agua Destilación (%)" type="number" step="0.01" value={form.agua_destilacion||""} onChange={f("agua_destilacion")}/>
              <Inp label="Flash Point (°C)" type="number" value={form.flash_point||""} onChange={f("flash_point")}/>
              <Inp label="Viscosidad 50°C (cSt)" type="number" step="0.1" value={form.viscosidad||""} onChange={f("viscosidad")}/>
              <Inp label="Azufre (%)" type="number" step="0.001" value={form.azufre||""} onChange={f("azufre")}/>
              <Inp label="TSA" type="number" step="0.01" value={form.tsa||""} onChange={f("tsa")}/>
            </Grid>
          </Section>
          <Section title="Observaciones">
            <Inp label="Observaciones" type="text" value={form.observaciones||""} onChange={f("observaciones")}/>
          </Section>
          <div style={{ display:"flex", justifyContent:"flex-end", gap:10 }}>
            <Btn outline onClick={()=>setModal(null)}>Cancelar</Btn>
            <Btn color="#00b4ff" onClick={guardarTiquete} disabled={saving}>{saving?"Guardando...":form.id?"Actualizar Tiquete":"Emitir Tiquete"}</Btn>
          </div>
        </Modal>
        );
      })()}

      {modal==="pbs" && (
        <Modal title={form.id ? `Editar PBS ${form.id}` : "Permiso de Bombeo Seguro"} onClose={()=>{ pbsParaCarro!==null ? setModal("cmt") : setModal(null); }} wide inline>
          <Section title="Encabezado" color="#fb923c">
            <Grid cols={2}>
              <Inp label="Fecha" type="date" value={form.fecha||today()} onChange={f("fecha")}/>
              <Inp label="Responsable Parada Emergencia" type="text" value={form.responsable_emergencia||""} onChange={f("responsable_emergencia")}/>
              <Inp label="Responsable Tanque / Carro que Despacha" type="text" value={form.responsable_despacha||""} onChange={f("responsable_despacha")}/>
              <Inp label="Responsable Tanque / Carro que Recibe" type="text" value={form.responsable_recibe||""} onChange={f("responsable_recibe")}/>
              <Inp label="Nombre Conductor" type="text" value={form.conductor_nombre||""} onChange={f("conductor_nombre")}/>
            </Grid>
            <div style={{marginTop:12,display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}>
              <div>
                <Lbl>Tipo de Operación</Lbl>
                <div style={{background:T.bg,borderRadius:6,padding:"8px 12px",fontSize:13,color:T.orange,fontWeight:700,border:`1px solid ${T.border}`}}>{form.tipo_operacion||"—"}</div>
              </div>
              <div>
                <Lbl>Bodega / Tanque que Recibe</Lbl>
                <div style={{background:T.bg,borderRadius:6,padding:"8px 12px",fontSize:13,color:T.text,border:`1px solid ${T.border}`}}>{form.bodega_recibe||"—"}</div>
              </div>
              <div>
                <Lbl>Bodega / Carrotanque que Despacha</Lbl>
                <div style={{background:T.bg,borderRadius:6,padding:"8px 12px",fontSize:13,color:T.text,border:`1px solid ${T.border}`}}>{form.bodega_despacha||"—"}</div>
              </div>
            </div>
          </Section>
          <Section title="Lista de Chequeo — 25 Puntos" color="#fb923c">
            <div style={{ display:"grid", gap:8 }}>
              {PBS_PREGUNTAS.map((p,i)=>{
                // Punto 17 (índice 16): espacio vacío calculado de los tanques del CMT
                if (i===16) {
                  const espacioVacio = cmtDespues.filter(t=>t.tanque).reduce((acc,t,idx)=>{
                    const tq = tanques.find(tk=>tk.id===t.tanque);
                    const galonesIniciales = Number(cmtAntes[idx]?.galones||0);
                    return acc + (tq ? Math.max(0, tq.capacidad - galonesIniciales) : 0);
                  }, 0);
                  return (
                    <div key={i} style={{ background:T.bg, borderRadius:6, padding:"10px 12px", display:"flex", alignItems:"center", justifyContent:"space-between", gap:12, border:`1px solid ${T.border}` }}>
                      <span style={{ fontSize:11, flex:1, color:T.text }}><b style={{color:T.orange}}>{i+1}.</b> {p}</span>
                      <div style={{background:T.card,borderRadius:6,padding:"6px 14px",fontSize:13,fontWeight:700,color:T.success,border:`1px solid ${T.border}`,whiteSpace:"nowrap"}}>
                        {fmt(espacioVacio)} Gls
                      </div>
                    </div>
                  );
                }
                if (i===17) {
                  const totalInicial = cmtAntes.reduce((acc,t)=>acc+Number(t.galones||0),0);
                  return (
                    <div key={i} style={{ background:T.bg, borderRadius:6, padding:"10px 12px", display:"flex", alignItems:"center", justifyContent:"space-between", gap:12, border:`1px solid ${T.border}` }}>
                      <span style={{ fontSize:11, flex:1, color:T.text }}><b style={{color:T.orange}}>{i+1}.</b> {p}</span>
                      <div style={{background:T.card,borderRadius:6,padding:"6px 14px",fontSize:13,fontWeight:700,color:"#f59e0b",border:`1px solid ${T.border}`,whiteSpace:"nowrap"}}>
                        {fmt(totalInicial)} Gls
                      </div>
                    </div>
                  );
                }
                if (i===18) {
                  return (
                    <div key={i} style={{ background:T.bg, borderRadius:6, padding:"10px 12px", display:"flex", alignItems:"center", justifyContent:"space-between", gap:12, border:`1px solid ${T.border}` }}>
                      <span style={{ fontSize:11, flex:1, color:T.text }}><b style={{color:T.orange}}>{i+1}.</b> {p}</span>
                      <div style={{display:"flex",alignItems:"center",gap:6}}>
                        <input type="number" min="0" value={pbsChecklist[i]} onChange={e=>{const n=[...pbsChecklist];n[i]=e.target.value;setPbsChecklist(n);}} placeholder="0" style={{ width:110, background:T.card, border:`1px solid ${T.border}`, borderRadius:6, padding:"5px 10px", color:T.text, fontSize:13, outline:"none", textAlign:"right" }} />
                        <span style={{fontSize:11,color:T.muted}}>Gls</span>
                      </div>
                    </div>
                  );
                }
                if (i===24 || i===25) {
                  return (
                    <div key={i} style={{ background:T.bg, borderRadius:6, padding:"10px 12px", display:"flex", alignItems:"center", justifyContent:"space-between", gap:12, border:`1px solid ${T.border}` }}>
                      <span style={{ fontSize:11, flex:1, color:T.text }}><b style={{color:T.orange}}>{i+1}.</b> {p}</span>
                      <input type="text" value={pbsChecklist[i]} onChange={e=>{const n=[...pbsChecklist];n[i]=e.target.value;setPbsChecklist(n);}} placeholder="Registrar..." style={{ width:150, background:T.card, border:`1px solid ${T.border}`, borderRadius:6, padding:"5px 10px", color:T.text, fontSize:13, outline:"none" }} />
                    </div>
                  );
                }
                return (
                  <div key={i} style={{ background:T.bg, borderRadius:6, padding:"10px 12px", display:"flex", alignItems:"center", justifyContent:"space-between", gap:12, border:`1px solid ${T.border}` }}>
                    <span style={{ fontSize:11, flex:1, color:T.text }}><b style={{color:T.orange}}>{i+1}.</b> {p}</span>
                    <select value={pbsChecklist[i]} onChange={e=>{const n=[...pbsChecklist];n[i]=e.target.value;setPbsChecklist(n);}} style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:6, padding:"6px 10px", color:T.text, fontSize:13, outline:"none", minWidth:80 }}>
                      <option value="">—</option>
                      <option value="SI">SI</option>
                      <option value="NO">NO</option>
                      <option value="N/A">N/A</option>
                    </select>
                  </div>
                );
              })}
            </div>
          </Section>
          <div style={{ display:"flex", justifyContent:"flex-end", gap:10, marginTop:8 }}>
            <Btn outline onClick={()=>{ pbsParaCarro!==null ? setModal("cmt") : setModal(null); }}>Cancelar</Btn>
            <Btn color="#fb923c" onClick={guardarPBS} disabled={saving}>{saving?"Guardando...":form.id?"Guardar Cambios":"Registrar PBS"}</Btn>
          </div>
        </Modal>
      )}

      {modal==="cmt" && (
        <Modal title={form.id ? `Corregir CMT — ${form.numero_cmt}` : "Control de Movimiento de Tanques"} onClose={()=>setModal(null)} wide inline>
          <div style={{background:T.bg,border:`1px solid ${T.border}`,borderRadius:8,padding:"12px 16px",marginBottom:16,display:"flex",alignItems:"center",gap:24,flexWrap:"wrap"}}>
            <div>
              <div style={{fontSize:10,color:T.muted,textTransform:"uppercase",letterSpacing:1,marginBottom:2}}>No. CMT</div>
              <div style={{fontSize:20,fontWeight:900,color:T.success,letterSpacing:2}}>{form.numero_cmt||"—"}</div>
            </div>
            <div>
              <div style={{fontSize:10,color:T.muted,textTransform:"uppercase",letterSpacing:1,marginBottom:2}}>Sede</div>
              <div style={{fontSize:13,fontWeight:700,color:T.navy}}>{form.sede||perfil.sede||"MALAMBO"}</div>
            </div>
            {(form.sede||perfil.sede||"MALAMBO")==="MALAMBO" && (
              <div>
                <div style={{fontSize:10,color:T.muted,textTransform:"uppercase",letterSpacing:1,marginBottom:2}}>Planta</div>
                <div style={{fontSize:13,fontWeight:700,color:T.navy}}>{form.planta||perfil.planta||"PLANTA 1"}</div>
              </div>
            )}
            <div style={{marginLeft:"auto",fontSize:11,color:T.muted}}>Generado automáticamente</div>
          </div>
          <div style={{display:"flex",gap:12,alignItems:"flex-start",marginBottom:18,flexWrap:"nowrap"}}>
            <div style={{width:155,flexShrink:0}}><Inp label="Fecha" type="date" value={form.fecha||today()} onChange={f("fecha")}/></div>
            <div style={{width:260,flexShrink:0}}><Sel label="Tipo de Operación" value={form.tipo_operacion||""} onChange={f("tipo_operacion")}>
              <option value="">Seleccionar...</option>
              <option>DESCARGUE DE CARROTANQUE</option>
              <option>ENTREGA A MOTONAVE</option>
              <option>ENTREGA A CARROTANQUE</option>
              <option>TRASIEGO DE PRODUCTO</option>
              <option>PORTEO</option>
            </Sel></div>
            <div style={{width:200,flexShrink:0}}>
              <Lbl>Producto del CMT</Lbl>
              {(()=>{
                const prodAprobados = [...new Set(
                  viajes
                    .filter(v => v.estado === "En Planta")
                    .filter(v => tiquetes.some(t => (t.viaje_id === v.id || t.id === v.tiquete_id) && t.resultado === "APROBADO"))
                    .map(v => (v.producto||"").toUpperCase())
                    .filter(Boolean)
                )];
                const opciones = [...new Set([...prodAprobados, "VLSFO", "HSFO"])].sort();
                return (
                  <select value={cmtProducto} onChange={e=>{
                    const val = e.target.value;
                    setCmtProducto(val);
                    setCmtDespues(prev=>prev.map(r=>({...r,producto:val})));
                    setCmtAntes(prev=>prev.map(r=>({...r,producto:val})));
                  }} style={{width:"100%",background:T.card,border:`1px solid ${T.border}`,borderRadius:6,padding:"10px 12px",color:T.text,fontSize:13,fontFamily:"system-ui,sans-serif",outline:"none",boxSizing:"border-box"}}>
                    <option value="">Seleccionar...</option>
                    {opciones.map(p=><option key={p} value={p}>{p}</option>)}
                  </select>
                );
              })()}
            </div>
          </div>
          <div style={{marginBottom:18}}>
            <div style={{display:"flex",alignItems:"center",marginBottom:10,paddingBottom:6,borderBottom:"1px solid #f59e0b33"}}>
              <span style={{fontSize:11,fontWeight:700,color:"#f59e0b",letterSpacing:1,textTransform:"uppercase"}}>{(form.tipo_operacion||"")==="TRASIEGO DE PRODUCTO"?"Tanque de Despacho":"Medida Inicial"}</span>
            </div>
            {(()=>{
              const cmtSede = form.sede || (sedeFiltro!=="TODAS"?sedeFiltro:"MALAMBO");
              const cmtPlanta = form.planta || perfil?.planta || "PLANTA 1";
              const tanquesDisponibles = (cmtSede==="MALAMBO" && cmtPlanta==="PLANTA 2") ? tanques : [];
              const esTrasiego = (form.tipo_operacion||"")==="TRASIEGO DE PRODUCTO";
              const inputStyle = { width:"100%", background:T.card, border:`1px solid ${T.border}`, borderRadius:6, padding:"8px 10px", color:T.text, fontSize:13, fontFamily:"system-ui,sans-serif", outline:"none", boxSizing:"border-box" };
              return cmtAntes.map((row,i)=>{
                const rowD = cmtDespues[i]||{};
                return esTrasiego ? (
                <div key={i} style={{background:T.bg,borderRadius:8,padding:"12px 14px",marginBottom:10,border:`1px solid ${T.border}`}}>
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                      <span style={{fontSize:10,color:T.muted,textTransform:"uppercase",letterSpacing:1}}>Tanque:</span>
                      <select value={row.tanque} onChange={e=>{
                        const val=e.target.value;
                        const na=[...cmtAntes]; na[i].tanque=val; setCmtAntes(na);
                        setCmtDespues(prev=>{const nd=[...prev]; if(nd[i]) nd[i]={...nd[i],tanque:val}; return nd;});
                        calcularGalones(val,na[i].sonda,na[i].temp,na[i].api,false,i);
                      }} style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:6,padding:"6px 10px",color:T.text,fontSize:13,fontFamily:"system-ui,sans-serif",outline:"none"}}>
                        <option value="">—</option>{tanquesDisponibles.map(t=><option key={t.id}>{t.id}</option>)}
                      </select>
                    </div>
                    <button onClick={()=>{setCmtAntes(cmtAntes.filter((_,j)=>j!==i));setCmtDespues(cmtDespues.filter((_,j)=>j!==i));}} style={{background:"#ff4d4d22",border:"1px solid #ff4d4d44",borderRadius:8,color:"#ff4d4d",padding:"4px 10px",cursor:"pointer",fontSize:11}}>✕</button>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"80px 1fr 1fr 1fr 1fr",gap:8,alignItems:"end",marginBottom:6}}>
                    <div style={{fontSize:10,color:"#00b4ff",fontWeight:700,textTransform:"uppercase",paddingBottom:4}}>Medida Inicial</div>
                    <div><Lbl>Sonda</Lbl><input type="number" value={row.sonda||""} onChange={e=>{const n=[...cmtAntes];n[i].sonda=e.target.value;setCmtAntes(n);}} onBlur={e=>calcularGalones(row.tanque,e.target.value,row.temp,row.api,false,i)} style={inputStyle}/></div>
                    <div><Lbl>Temp °C</Lbl><input type="number" step="0.1" placeholder="" value={row.temp||""} onChange={e=>{const n=[...cmtAntes];n[i].temp=e.target.value;setCmtAntes(n);calcularGalones(n[i].tanque,n[i].sonda,e.target.value,n[i].api,false,i);}} style={inputStyle}/></div>
                    <div><Lbl>API</Lbl><input type="number" step="0.1" placeholder="" value={row.api||""} onChange={e=>{const n=[...cmtAntes];n[i].api=e.target.value;setCmtAntes(n);calcularGalones(n[i].tanque,n[i].sonda,n[i].temp,e.target.value,false,i);}} style={inputStyle}/></div>
                    <div><Lbl>{row.temp&&row.api?"Galones Netos":"Galones Brutos"}</Lbl><input type="number" value={row.galones||""} onChange={e=>{const n=[...cmtAntes];n[i].galones=e.target.value;setCmtAntes(n);}} style={inputStyle}/></div>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"80px 1fr 1fr 1fr 1fr",gap:8,alignItems:"end"}}>
                    <div style={{fontSize:10,color:"#c084fc",fontWeight:700,textTransform:"uppercase",paddingBottom:4}}>Medida Final</div>
                    <div><Lbl>Sonda</Lbl><input type="number" value={rowD.sonda||""} onChange={e=>{const n=[...cmtDespues];n[i]={...n[i],sonda:e.target.value};setCmtDespues(n);}} onBlur={e=>calcularGalones(row.tanque,e.target.value,rowD.temp,rowD.api,true,i)} style={inputStyle}/></div>
                    <div><Lbl>Temp °C</Lbl><input type="number" step="0.1" placeholder="" value={rowD.temp||""} onChange={e=>{const n=[...cmtDespues];n[i]={...n[i],temp:e.target.value};setCmtDespues(n);calcularGalones(row.tanque,rowD.sonda,e.target.value,rowD.api,true,i);}} style={inputStyle}/></div>
                    <div><Lbl>API</Lbl><input type="number" step="0.1" placeholder="" value={rowD.api||""} onChange={e=>{const n=[...cmtDespues];n[i]={...n[i],api:e.target.value};setCmtDespues(n);calcularGalones(row.tanque,rowD.sonda,rowD.temp,e.target.value,true,i);}} style={inputStyle}/></div>
                    <div><Lbl>{rowD.temp&&rowD.api?"Galones Netos":"Galones Brutos"}</Lbl><input type="number" value={rowD.galones||""} onChange={e=>{const n=[...cmtDespues];n[i]={...n[i],galones:e.target.value};setCmtDespues(n);}} style={inputStyle}/></div>
                  </div>
                </div>
                ) : (
                <div key={i} style={{background:"#f1f5f9",borderRadius:8,padding:"12px 14px",marginBottom:10,border:`1px solid ${T.border}`}}>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr 1fr auto",gap:8,alignItems:"end"}}>
                    <div><Lbl>Tanque</Lbl>
                    <select value={row.tanque} onChange={e=>{
                      const val=e.target.value;
                      const na=[...cmtAntes]; na[i].tanque=val; setCmtAntes(na);
                      setCmtDespues(prev=>{const nd=[...prev]; if(nd[i]) nd[i]={...nd[i],tanque:val}; return nd;});
                      calcularGalones(val,na[i].sonda,na[i].temp,na[i].api,false,i);
                    }} style={{width:"100%",background:"#ffffff",border:`1px solid ${T.border}`,borderRadius:6,padding:"8px 10px",color:T.text,fontSize:13,fontFamily:"system-ui,sans-serif",outline:"none"}}><option value="">—</option>{tanquesDisponibles.map(t=><option key={t.id}>{t.id}</option>)}</select>
                    </div>
                    <div><Lbl>Sonda</Lbl><input type="number" value={row.sonda} onChange={e=>{const n=[...cmtAntes];n[i].sonda=e.target.value;setCmtAntes(n);}} onBlur={e=>calcularGalones(row.tanque,e.target.value,row.temp,row.api,false,i)} style={{...inputStyle,background:"#ffffff"}}/></div>
                    <div><Lbl>Temp °C</Lbl><input type="number" step="0.1" placeholder="" value={row.temp||""} onChange={e=>{const n=[...cmtAntes];n[i].temp=e.target.value;setCmtAntes(n);calcularGalones(n[i].tanque,n[i].sonda,e.target.value,n[i].api,false,i);}} style={{...inputStyle,background:"#ffffff"}}/></div>
                    <div><Lbl>API</Lbl><input type="number" step="0.1" placeholder="" value={row.api||""} onChange={e=>{const n=[...cmtAntes];n[i].api=e.target.value;setCmtAntes(n);calcularGalones(n[i].tanque,n[i].sonda,n[i].temp,e.target.value,false,i);}} style={{...inputStyle,background:"#ffffff"}}/></div>
                    <div><Lbl>{row.temp&&row.api?"Galones Netos":"Galones Brutos"}</Lbl><input type="number" value={row.galones} onChange={e=>{const n=[...cmtAntes];n[i].galones=e.target.value;setCmtAntes(n);}} style={{...inputStyle,background:"#ffffff"}}/></div>
                    <button onClick={()=>{setCmtAntes(cmtAntes.filter((_,j)=>j!==i));setCmtDespues(cmtDespues.filter((_,j)=>j!==i));}} style={{background:"#ff4d4d22",border:"1px solid #ff4d4d44",borderRadius:8,color:"#ff4d4d",padding:"8px 10px",cursor:"pointer",fontSize:12}}>✕</button>
                  </div>
                </div>
                );
              });
            })()}
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <Btn sm outline color="#f59e0b" onClick={()=>{
                setCmtAntes([...cmtAntes,{tanque:"",sonda:"",galones:""}]);
                setCmtDespues([...cmtDespues,{tanque:"",producto:cmtProducto,sonda:"",galones:""}]);
              }}>+ TK</Btn>
              <span style={{ fontSize:12, color:"#f59e0b" }}>Total: {fmt(cmtAntes.reduce((a,t)=>a+Number(t.galones||0),0))} Gls</span>
            </div>
          </div>
          {(form.tipo_operacion||"")==="TRASIEGO DE PRODUCTO" && <div style={{marginBottom:18}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10,paddingBottom:6,borderBottom:"1px solid #00e5a033"}}>
              <span style={{fontSize:11,fontWeight:700,color:"#00e5a0",letterSpacing:1,textTransform:"uppercase"}}>Tanque de Recepción</span>
            </div>
            {(()=>{
              const cmtSede = form.sede || (sedeFiltro!=="TODAS"?sedeFiltro:"MALAMBO");
              const cmtPlanta = form.planta || perfil?.planta || "PLANTA 1";
              const tanquesDisponibles = (cmtSede==="MALAMBO" && cmtPlanta==="PLANTA 2") ? tanques : [];
              const inputStyle = { width:"100%", background:T.card, border:`1px solid ${T.border}`, borderRadius:6, padding:"8px 10px", color:T.text, fontSize:13, fontFamily:"system-ui,sans-serif", outline:"none", boxSizing:"border-box" };
              return cmtRecepcion.map((rec,i)=>(
                <div key={i} style={{background:T.bg,borderRadius:8,padding:"12px 14px",marginBottom:10,border:`1px solid ${T.border}`}}>
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                      <span style={{fontSize:10,color:T.muted,textTransform:"uppercase",letterSpacing:1}}>Tanque:</span>
                      <select value={rec.tanque} onChange={e=>{const n=[...cmtRecepcion];n[i]={...n[i],tanque:e.target.value};setCmtRecepcion(n);}} style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:6,padding:"6px 10px",color:T.text,fontSize:13,fontFamily:"system-ui,sans-serif",outline:"none"}}>
                        <option value="">—</option>{tanquesDisponibles.map(t=><option key={t.id}>{t.id}</option>)}
                      </select>
                    </div>
                    <button onClick={()=>setCmtRecepcion(cmtRecepcion.filter((_,j)=>j!==i))} style={{background:"#ff4d4d22",border:"1px solid #ff4d4d44",borderRadius:8,color:"#ff4d4d",padding:"4px 10px",cursor:"pointer",fontSize:11}}>✕</button>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"80px 1fr 1fr 1fr 1fr",gap:8,alignItems:"end",marginBottom:6}}>
                    <div style={{fontSize:10,color:"#00b4ff",fontWeight:700,textTransform:"uppercase",paddingBottom:4}}>Medida Inicial</div>
                    <div><Lbl>Sonda</Lbl><input type="number" value={rec.sondaInicial||""} onChange={e=>{const n=[...cmtRecepcion];n[i]={...n[i],sondaInicial:e.target.value};setCmtRecepcion(n);}} onBlur={e=>calcularGalonesConSetter(rec.tanque,e.target.value,rec.tempInicial,rec.apiInicial,i,setCmtRecepcion,"galonesInicial")} style={inputStyle}/></div>
                    <div><Lbl>Temp °C</Lbl><input type="number" step="0.1" placeholder="" value={rec.tempInicial||""} onChange={e=>{const n=[...cmtRecepcion];n[i]={...n[i],tempInicial:e.target.value};setCmtRecepcion(n);}} onBlur={e=>calcularGalonesConSetter(rec.tanque,rec.sondaInicial,e.target.value,rec.apiInicial,i,setCmtRecepcion,"galonesInicial")} style={inputStyle}/></div>
                    <div><Lbl>API</Lbl><input type="number" step="0.1" placeholder="" value={rec.apiInicial||""} onChange={e=>{const n=[...cmtRecepcion];n[i]={...n[i],apiInicial:e.target.value};setCmtRecepcion(n);}} onBlur={e=>calcularGalonesConSetter(rec.tanque,rec.sondaInicial,rec.tempInicial,e.target.value,i,setCmtRecepcion,"galonesInicial")} style={inputStyle}/></div>
                    <div><Lbl>{rec.tempInicial&&rec.apiInicial?"Galones Netos":"Galones Brutos"}</Lbl><input type="number" value={rec.galonesInicial||""} onChange={e=>{const n=[...cmtRecepcion];n[i]={...n[i],galonesInicial:e.target.value};setCmtRecepcion(n);}} style={inputStyle}/></div>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"80px 1fr 1fr 1fr 1fr",gap:8,alignItems:"end"}}>
                    <div style={{fontSize:10,color:"#c084fc",fontWeight:700,textTransform:"uppercase",paddingBottom:4}}>Medida Final</div>
                    <div><Lbl>Sonda</Lbl><input type="number" value={rec.sondaFinal||""} onChange={e=>{const n=[...cmtRecepcion];n[i]={...n[i],sondaFinal:e.target.value};setCmtRecepcion(n);}} onBlur={e=>calcularGalonesConSetter(rec.tanque,e.target.value,rec.tempFinal,rec.apiFinal,i,setCmtRecepcion,"galonesFinal")} style={inputStyle}/></div>
                    <div><Lbl>Temp °C</Lbl><input type="number" step="0.1" placeholder="" value={rec.tempFinal||""} onChange={e=>{const n=[...cmtRecepcion];n[i]={...n[i],tempFinal:e.target.value};setCmtRecepcion(n);}} onBlur={e=>calcularGalonesConSetter(rec.tanque,rec.sondaFinal,e.target.value,rec.apiFinal,i,setCmtRecepcion,"galonesFinal")} style={inputStyle}/></div>
                    <div><Lbl>API</Lbl><input type="number" step="0.1" placeholder="" value={rec.apiFinal||""} onChange={e=>{const n=[...cmtRecepcion];n[i]={...n[i],apiFinal:e.target.value};setCmtRecepcion(n);}} onBlur={e=>calcularGalonesConSetter(rec.tanque,rec.sondaFinal,rec.tempFinal,e.target.value,i,setCmtRecepcion,"galonesFinal")} style={inputStyle}/></div>
                    <div><Lbl>{rec.tempFinal&&rec.apiFinal?"Galones Netos":"Galones Brutos"}</Lbl><input type="number" value={rec.galonesFinal||""} onChange={e=>{const n=[...cmtRecepcion];n[i]={...n[i],galonesFinal:e.target.value};setCmtRecepcion(n);}} style={inputStyle}/></div>
                  </div>
                </div>
              ));
            })()}
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:4}}>
              <Btn sm outline color="#00e5a0" onClick={()=>setCmtRecepcion([...cmtRecepcion,{tanque:"",sondaInicial:"",tempInicial:"",apiInicial:"",galonesInicial:"",sondaFinal:"",tempFinal:"",apiFinal:"",galonesFinal:""}])}>+ TK</Btn>
            </div>
          </div>}
          {(form.tipo_operacion||"")!=="TRASIEGO DE PRODUCTO" && <div style={{marginBottom:18}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10,paddingBottom:6,borderBottom:"1px solid #00e5a033"}}>
              <span style={{fontSize:11,fontWeight:700,color:"#00e5a0",letterSpacing:1,textTransform:"uppercase"}}>Medida Final</span>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <span style={{fontSize:11,color:T.muted,fontFamily:"monospace"}}>Producto:</span>
                <div style={{background:T.bg,border:`1px solid ${T.border}`,borderRadius:6,padding:"6px 14px",fontSize:13,fontFamily:"system-ui,sans-serif",color:T.navy,fontWeight:700,minWidth:180}}>{cmtProducto||"—"}</div>
              </div>
            </div>
            {cmtDespues.map((row,i)=>{
              const tqInfo = tanques.find(t=>t.id===row.tanque);
              const capMaxOp = tqInfo ? tqInfo.capacidad : null;
              const galonesIniciales = Number(cmtAntes[i]?.galones||0);
              const espacioDisponible = capMaxOp !== null ? Math.max(0, capMaxOp - galonesIniciales) : null;
              const galonesFinales = Number(row.galones||0);
              const excede = espacioDisponible !== null && galonesFinales > capMaxOp;
              return (
              <div key={i} style={{background:"#f1f5f9",borderRadius:8,padding:"12px 14px",marginBottom:10,border:`1px solid ${T.border}`}}>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr 1fr", gap:8, alignItems:"end" }}>
                  <div>
                    <Lbl>Tanque</Lbl>
                    <div style={{background:"#e2e8f0",border:`1px solid ${T.border}`,borderRadius:6,padding:"8px 10px",fontSize:13,fontFamily:"system-ui,sans-serif",color:T.navy,fontWeight:700}}>{row.tanque||"—"}</div>
                  </div>
                  <div><Lbl>Sonda</Lbl><input type="number" value={row.sonda} onChange={e=>{const n=[...cmtDespues];n[i].sonda=e.target.value;setCmtDespues(n);}} onBlur={e=>{calcularGalones(row.tanque,e.target.value,row.temp,row.api,true,i);}} style={{ width:"100%", background:"#ffffff", border:`1px solid ${T.border}`, borderRadius:6, padding:"8px 10px", color:T.text, fontSize:13, fontFamily:"system-ui,sans-serif", outline:"none", boxSizing:"border-box" }}/></div>
                  <div><Lbl>Temp °C</Lbl><input type="number" step="0.1" placeholder="" value={row.temp||""} onChange={e=>{const n=[...cmtDespues];n[i].temp=e.target.value;setCmtDespues(n);calcularGalones(n[i].tanque,n[i].sonda,e.target.value,n[i].api,true,i);}} style={{width:"100%",background:"#ffffff",border:`1px solid ${T.border}`,borderRadius:6,padding:"8px 10px",color:T.text,fontSize:13,fontFamily:"system-ui,sans-serif",outline:"none",boxSizing:"border-box"}}/></div>
                  <div><Lbl>API</Lbl><input type="number" step="0.1" placeholder="" value={row.api||""} onChange={e=>{const n=[...cmtDespues];n[i].api=e.target.value;setCmtDespues(n);calcularGalones(n[i].tanque,n[i].sonda,n[i].temp,e.target.value,true,i);}} style={{width:"100%",background:"#ffffff",border:`1px solid ${T.border}`,borderRadius:6,padding:"8px 10px",color:T.text,fontSize:13,fontFamily:"system-ui,sans-serif",outline:"none",boxSizing:"border-box"}}/></div>
                  <div><Lbl>{row.temp&&row.api?"Galones Netos":"Galones Brutos"}</Lbl><input type="number" value={row.galones} onChange={e=>{const n=[...cmtDespues];n[i].galones=e.target.value;setCmtDespues(n);}} style={{ width:"100%", background:"#ffffff", border:`1px solid ${excede?T.danger:T.border}`, borderRadius:6, padding:"8px 10px", color: excede?T.danger:T.text, fontSize:13, fontFamily:"system-ui,sans-serif", outline:"none", boxSizing:"border-box" }}/></div>
                </div>
                {espacioDisponible !== null && row.tanque && (()=>{
                  const capTotal = capMaxOp / 0.9;
                  const pctActual = capTotal > 0 ? Math.round((galonesIniciales / capTotal) * 100) : 0;
                  const enAlerta = galonesIniciales >= capMaxOp;
                  return (
                    <div style={{marginTop:8,padding:"6px 10px",background:"#e2e8f0",border:`1px solid ${T.border}`,borderRadius:6,display:"flex",alignItems:"center",gap:16,flexWrap:"wrap"}}>
                      <span style={{fontSize:11,color:T.muted}}>Espacio disponible: <b style={{color: enAlerta?"#ff4d4d":"#059669"}}>{fmt(Math.max(0,espacioDisponible))} Gls</b></span>
                      {enAlerta && (
                        <span style={{fontSize:11,fontWeight:800,color:"#ff4d4d",background:"#fee2e2",border:"1px solid #fca5a5",borderRadius:6,padding:"2px 10px",letterSpacing:0.5}}>
                          ⚠ ALERTA CAPACIDAD EN {pctActual}%
                        </span>
                      )}
                    </div>
                  );
                })()}
              </div>
              );
            })}
            <div style={{ display:"flex", justifyContent:"flex-end" }}>
              <span style={{ fontSize:12, color:"#00e5a0" }}>Total: {fmt(cmtDespues.reduce((a,t)=>a+Number(t.galones||0),0))} Gls</span>
            </div>
          </div>}
          {(form.tipo_operacion||"")==="DESCARGUE DE CARROTANQUE" && <><div ref={cmtCarrosRef}/><Section title="Carros Descargados" color="#6b8fa8">
            <div style={{fontSize:11,color:T.muted,marginBottom:10}}>Un registro por cada carro descargado en este CMT</div>
            {cmtCarros.map((carro,i)=>(
              <div key={i} style={{background:T.bg,borderRadius:8,padding:"12px 14px",marginBottom:12,border:`1px solid ${T.border}`}}>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:8}}>
                  <div><Lbl>Placa</Lbl>
                  {(()=>{
                    const prodUpper = (cmtProducto||"").toUpperCase();
                    const esGlobal = ["HSFO","VLSFO"].includes(prodUpper);
                    const placasUsadas = cmtCarros.filter((_,j)=>j!==i).map(c=>c.placa).filter(Boolean);
                    const matchProducto = (vProd) => {
                      if (!cmtProducto || esGlobal) return true;
                      const vUp = (vProd||"").toUpperCase();
                      // Si cualquiera de los dos contiene "PENDARE", mostrar todos los PENDARE
                      if (prodUpper.includes("PENDARE") || vUp.includes("PENDARE")) return vUp.includes("PENDARE");
                      return vUp === prodUpper;
                    };
                    const enPlanta = viajes.filter(v =>
                      !placasUsadas.includes(v.placa) &&
                      matchProducto(v.producto) &&
                      (v.estado === "En Planta" || (v.estado === "Rechazado" && v.autorizado_descargue))
                    );
                    return enPlanta.length > 0 ? (
                      <select value={carro.placa} onChange={e=>{
                        const placa = e.target.value;
                        const viaje = viajes.find(v=>v.placa===placa);
                        const tq = viaje ? tiquetes.find(t=>t.viaje_id===viaje.id || t.id===viaje.tiquete_id) : null;
                        const n=[...cmtCarros];
                        n[i] = {...n[i], placa, guia: viaje?.guia||n[i].guia, tiquete: tq?.id||n[i].tiquete, galones_guia: viaje?.gls_netos_guia||""};
                        setCmtCarros(n);
                      }} style={{width:"100%",background:T.card,border:`1px solid ${T.border}`,borderRadius:6,padding:"10px 12px",color:T.text,fontSize:13,fontFamily:"system-ui,sans-serif",outline:"none",boxSizing:"border-box"}}>
                        <option value="">Seleccionar placa...</option>
                        {enPlanta.map(v=><option key={v.id} value={v.placa}>{v.placa} — {v.producto}{v.autorizado_descargue?" [AUTORIZADO]":""}</option>)}
                      </select>
                    ) : (
                      <input type="text" placeholder="ABC123" maxLength={6} value={carro.placa} onChange={e=>{const n=[...cmtCarros];n[i].placa=e.target.value.toUpperCase().replace(/\s/g,"");setCmtCarros(n);}} style={{width:"100%",background:T.card,border:`1px solid ${T.border}`,borderRadius:6,padding:"10px 12px",color:T.text,fontSize:13,fontFamily:"system-ui,sans-serif",outline:"none",boxSizing:"border-box",textTransform:"uppercase"}}/>
                    );
                  })()}
                  </div>
                  <div><Lbl>Guía</Lbl><input type="text" value={carro.guia} onChange={e=>{const n=[...cmtCarros];n[i].guia=e.target.value.toUpperCase();setCmtCarros(n);}} style={{width:"100%",background:T.card,border:`1px solid ${T.border}`,borderRadius:6,padding:"10px 12px",color:T.text,fontSize:13,fontFamily:"system-ui,sans-serif",outline:"none",boxSizing:"border-box",textTransform:"uppercase"}}/></div>
                  <div><Lbl>Tiquete</Lbl><input type="text" value={carro.tiquete} onChange={e=>{const n=[...cmtCarros];n[i].tiquete=e.target.value.toUpperCase();setCmtCarros(n);}} style={{width:"100%",background:T.card,border:`1px solid ${T.border}`,borderRadius:6,padding:"10px 12px",color:T.text,fontSize:13,fontFamily:"system-ui,sans-serif",outline:"none",boxSizing:"border-box",textTransform:"uppercase"}}/></div>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(10,1fr)",gap:8,alignItems:"end"}}>
                  <div><Lbl>Hora Inicio</Lbl><input type="time" value={carro.hora_inicio||""} onChange={e=>{const n=[...cmtCarros];n[i].hora_inicio=e.target.value;setCmtCarros(n);}} style={{width:"100%",background:T.card,border:`1px solid ${T.border}`,borderRadius:6,padding:"10px 12px",color:T.text,fontSize:13,fontFamily:"system-ui,sans-serif",outline:"none",boxSizing:"border-box"}}/></div>
                  <div><Lbl>Hora Final</Lbl><input type="time" value={carro.hora_final||""} onChange={e=>{const n=[...cmtCarros];n[i].hora_final=e.target.value;setCmtCarros(n);}} style={{width:"100%",background:T.card,border:`1px solid ${T.border}`,borderRadius:6,padding:"10px 12px",color:T.text,fontSize:13,fontFamily:"system-ui,sans-serif",outline:"none",boxSizing:"border-box"}}/></div>
                  <div><Lbl>Peso Ingreso (Kg)</Lbl><input type="number" value={carro.peso_ingreso||""} onChange={e=>{const n=[...cmtCarros];n[i].peso_ingreso=e.target.value;const neto=Number(e.target.value||0)-Number(n[i].peso_salida||0);if(n[i].peso_salida)n[i].peso_neto=neto>0?String(neto):"";setCmtCarros(n);}} style={{width:"100%",background:T.card,border:`1px solid ${T.border}`,borderRadius:6,padding:"10px 12px",color:T.text,fontSize:13,fontFamily:"system-ui,sans-serif",outline:"none",boxSizing:"border-box"}}/></div>
                  <div><Lbl>Peso Salida (Kg)</Lbl><input type="number" value={carro.peso_salida||""} onChange={async e=>{const val=e.target.value;const n=[...cmtCarros];n[i].peso_salida=val;const neto=Number(n[i].peso_ingreso||0)-Number(val||0);if(n[i].peso_ingreso)n[i].peso_neto=neto>0?String(neto):"";setCmtCarros(n);if(val && n[i].placa){await supabaseAdmin.from("viajes").update({estado:"Descargado"}).eq("placa",n[i].placa);await loadData();}}} style={{width:"100%",background:T.card,border:`1px solid ${T.border}`,borderRadius:6,padding:"10px 12px",color:T.text,fontSize:13,fontFamily:"system-ui,sans-serif",outline:"none",boxSizing:"border-box"}}/></div>
                  <div><Lbl>Peso Neto (Kg)</Lbl><input type="text" readOnly value={carro.peso_neto||""} style={{width:"100%",background:"#e8edf2",border:`1px solid ${T.border}`,borderRadius:6,padding:"10px 12px",color:"#4a5568",fontSize:13,fontFamily:"system-ui,sans-serif",outline:"none",boxSizing:"border-box",fontWeight:600,cursor:"default"}}/></div>
                  <div><Lbl>Galones Guía</Lbl><input type="text" readOnly value={carro.galones_guia ? fmt(Number(carro.galones_guia)) : ""} style={{width:"100%",background:"#e8edf2",border:`1px solid ${T.border}`,borderRadius:6,padding:"10px 12px",color:"#4a5568",fontSize:13,fontFamily:"system-ui,sans-serif",outline:"none",boxSizing:"border-box",fontWeight:600,cursor:"default"}}/></div>
                  <div><Lbl>Gls Descargados</Lbl><input type="text" readOnly value={(()=>{const tq=tiquetes.find(t=>t.id===carro.tiquete);const factor=Number(tq?.factor_tabla13||0);const pesoNeto=Number(carro.peso_neto||0);return (factor>0&&pesoNeto>0)?fmt(Math.round(pesoNeto/factor)):(carro.galones_descargados||"");})()}  style={{width:"100%",background:"#e8edf2",border:`1px solid ${T.border}`,borderRadius:6,padding:"10px 12px",color:"#4a5568",fontSize:13,fontFamily:"system-ui,sans-serif",outline:"none",boxSizing:"border-box",fontWeight:600,cursor:"default"}}/></div>
                  <div><Lbl>RPM</Lbl><input type="text" value={carro.rpm||""} onChange={e=>{const n=[...cmtCarros];n[i].rpm=e.target.value;setCmtCarros(n);}} style={{width:"100%",background:T.card,border:`1px solid ${T.border}`,borderRadius:6,padding:"10px 12px",color:T.text,fontSize:13,fontFamily:"system-ui,sans-serif",outline:"none",boxSizing:"border-box"}}/></div>
                  <div><Lbl>Presión (Bar)</Lbl><input type="text" value={carro.presion||""} onChange={e=>{const n=[...cmtCarros];n[i].presion=e.target.value;setCmtCarros(n);}} style={{width:"100%",background:T.card,border:`1px solid ${T.border}`,borderRadius:6,padding:"10px 12px",color:T.text,fontSize:13,fontFamily:"system-ui,sans-serif",outline:"none",boxSizing:"border-box"}}/></div>
                  <div><Lbl>PBS</Lbl><div style={{background:T.card,border:`1px solid ${carro.pbs_id?T.orange:T.border}`,borderRadius:6,padding:"10px 12px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:6}}>
                    {carro.pbs_id
                      ? <button onClick={()=>{
                          const pbsExistente = pbsList.find(p=>p.id===carro.pbs_id);
                          const tanquesRecibe = cmtDespues.filter(t=>t.tanque).map(t=>t.tanque).join(", ");
                          const snap = {form:{...form}, cmtAntes:[...cmtAntes], cmtDespues:[...cmtDespues], cmtCarros:[...cmtCarros], cmtProducto, cmtRecepcion:[...cmtRecepcion]};
                          setCmtSnapshot(snap);
                          setPbsParaCarro(i);
                          const pbsForm = pbsExistente ? {...pbsExistente} : { id: carro.pbs_id, tipo_operacion: form.tipo_operacion||"", bodega_recibe: tanquesRecibe, bodega_despacha: carro.placa||"", conductor_nombre: carro.conductor||"" };
                          const pbsCl = pbsExistente?.checklist || Array(26).fill("");
                          const pbsInitialState = { form: pbsForm, pbsChecklist: pbsCl, cmtAntes:[...cmtAntes], cmtDespues:[...cmtDespues], cmtCarros:[...cmtCarros], cmtProducto, cmtRecepcion:[...cmtRecepcion], pbsParaCarro: i, pbsEsTrasiego: false, cmtSnapshot: snap };
                          openFormTab("pbs", pbsInitialState);
                        }} style={{background:"none",border:"none",color:T.orange,fontWeight:700,fontSize:11,cursor:"pointer",padding:0,fontFamily:"monospace",textDecoration:"underline"}}>{carro.pbs_id}</button>
                      : <><span style={{fontSize:11,color:T.muted}}>Sin PBS</span><button onClick={()=>{
                          const tanquesRecibe = cmtDespues.filter(t=>t.tanque).map(t=>t.tanque).join(", ");
                          const snap = {form:{...form}, cmtAntes:[...cmtAntes], cmtDespues:[...cmtDespues], cmtCarros:[...cmtCarros], cmtProducto, cmtRecepcion:[...cmtRecepcion]};
                          const cl = Array(26).fill("");
                          if (carro.galones_guia) cl[18] = String(carro.galones_guia);
                          const pbsForm = { tipo_operacion: form.tipo_operacion||"", bodega_recibe: tanquesRecibe, bodega_despacha: carro.placa||"", conductor_nombre: carro.conductor||"" };
                          const pbsInitialState = { form: pbsForm, pbsChecklist: cl, cmtAntes:[...cmtAntes], cmtDespues:[...cmtDespues], cmtCarros:[...cmtCarros], cmtProducto, cmtRecepcion:[...cmtRecepcion], pbsParaCarro: i, pbsEsTrasiego: false, cmtSnapshot: snap };
                          openFormTab("pbs", pbsInitialState);
                        }} style={{background:T.orange,border:"none",borderRadius:6,color:"#ffffff",padding:"4px 8px",cursor:"pointer",fontSize:10,fontWeight:700,whiteSpace:"nowrap"}}>+ PBS</button></>
                    }
                  </div></div>
                </div>
                <div style={{display:"flex",justifyContent:"flex-end",marginTop:8}}>
                  <button onClick={()=>setCmtCarros(cmtCarros.filter((_,j)=>j!==i))} style={{background:`${T.danger}15`,border:`1px solid ${T.danger}55`,borderRadius:6,color:T.danger,padding:"5px 14px",cursor:"pointer",fontSize:11,fontFamily:"system-ui,sans-serif"}}>✕ Eliminar carro</button>
                </div>
              </div>
            ))}
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:4}}>
              <Btn sm outline color="#6b8fa8" onClick={()=>setCmtCarros([...cmtCarros,{placa:"",guia:"",tiquete:"",pbs_id:"",hora_inicio:"",hora_final:"",peso_ingreso:"",peso_salida:"",peso_neto:""}])}>+ Agregar Carro</Btn>
              <span style={{fontSize:11,color:T.muted}}>{cmtCarros.length} carro(s)</span>
            </div>
            {form.tipo_operacion==="Entrega a motonave" && (
              <div style={{marginTop:14}}>
                <Inp label="Nombre Motonave" type="text" value={form.nombre_motonave||""} onChange={f("nombre_motonave")}/>
              </div>
            )}
          </Section></> }
          {(form.tipo_operacion||"")==="TRASIEGO DE PRODUCTO" && (
            <Section title="Permiso de Bombeo Seguro" color="#fb923c">
              <div style={{display:"flex",alignItems:"center",gap:12}}>
                <div style={{flex:1,background:T.card,border:`1px solid ${form.pbs_id?T.orange:T.border}`,borderRadius:6,padding:"10px 14px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                  {form.pbs_id
                    ? <span style={{fontSize:12,color:T.orange,fontWeight:700}}>{form.pbs_id}</span>
                    : <span style={{fontSize:12,color:T.muted}}>Sin PBS vinculado</span>}
                  <button onClick={()=>{
                    const tanquesDespacho = cmtAntes.filter(t=>t.tanque).map(t=>t.tanque).join(", ");
                    const tanquesRecibe = cmtRecepcion.filter(t=>t.tanque).map(t=>t.tanque).join(", ");
                    setCmtSnapshot({form:{...form}, cmtAntes:[...cmtAntes], cmtDespues:[...cmtDespues], cmtCarros:[...cmtCarros], cmtProducto, cmtRecepcion:[...cmtRecepcion]});
                    setPbsEsTrasiego(true);
                    setPbsParaCarro(null);
                    setForm({
                      tipo_operacion: form.tipo_operacion||"",
                      bodega_despacha: tanquesDespacho,
                      bodega_recibe: tanquesRecibe,
                    });
                    setPbsChecklist(Array(27).fill(""));
                    setModal("pbs");
                  }} style={{background:T.orange,border:"none",borderRadius:6,color:"#ffffff",padding:"5px 12px",cursor:"pointer",fontSize:11,fontWeight:700}}>
                    {form.pbs_id ? "↺ Cambiar PBS" : "+ Generar PBS"}
                  </button>
                </div>
              </div>
            </Section>
          )}
          {(form.tipo_operacion||"")==="TRASIEGO DE PRODUCTO" ? (()=>{
            const galonesDespachoInicial = cmtAntes.reduce((a,t)=>a+Number(t.galones||0),0);
            const galonesDespachoFinal = cmtDespues.reduce((a,t)=>a+Number(t.galones||0),0);
            const galonajeTraseado = Math.max(0, galonesDespachoInicial - galonesDespachoFinal);
            return galonajeTraseado > 0 ? (
              <Card style={{ background:"#00b4ff18", borderColor:"#00b4ff33", marginBottom:14 }}>
                <div style={{ fontSize:13, color:"#00b4ff", fontWeight:700 }}>
                  Galonaje Trasegado: {fmt(galonajeTraseado)} Galones
                </div>
                <div style={{ fontSize:11, color:T.muted, marginTop:4 }}>
                  Salida Tanque de Despacho: {fmt(galonesDespachoInicial)} → {fmt(galonesDespachoFinal)} Gls
                </div>
              </Card>
            ) : null;
          })() : (
            cmtDespues.reduce((a,t)=>a+Number(t.galones||0),0) > cmtAntes.reduce((a,t)=>a+Number(t.galones||0),0) && (
            <Card style={{ background:"#00e5a018", borderColor:"#00e5a033", marginBottom:14 }}>
              <div style={{ fontSize:13, color:"#00e5a0", fontWeight:700 }}>
                Total Recibido / Entregado: {fmt(cmtDespues.reduce((a,t)=>a+Number(t.galones||0),0) - cmtAntes.reduce((a,t)=>a+Number(t.galones||0),0))} Galones
              </div>
            </Card>
          ))}
          <div style={{ display:"flex", justifyContent:"flex-end", gap:10 }}>
            <Btn outline onClick={()=>setModal(null)}>Cancelar</Btn>
            <Btn color="#00e5a0" onClick={guardarCMT} disabled={saving}>{saving?"Guardando...":form.id?"Guardar Corrección":"Guardar CMT"}</Btn>
          </div>
        </Modal>
      )}

      {modal==="despacho" && (
        <Modal title={form.id ? `Editar Despacho ${form.id}` : "Registrar Despacho a Buque"} onClose={()=>setModal(null)} wide inline>
          <Grid cols={2}>
            <Inp label="Fecha" type="date" value={form.fecha||""} onChange={f("fecha")}/>
            <Inp label="Nombre del Buque" type="text" placeholder="MV / MT / BT ..." value={form.buque||""} onChange={f("buque")}/>
            <Sel label="Tanque Origen" value={form.tanque||""} onChange={f("tanque")}>
              <option value="">Seleccionar...</option>
              {tanques.filter(t=>t.tipo==="terminado").map(t=><option key={t.id} value={t.id}>{t.id} · {t.producto} · {fmt(t.nivel)} Gls disponibles</option>)}
            </Sel>
            <Inp label="Volumen (Gls)" type="number" value={form.volumen||""} onChange={f("volumen")}/>
            <Sel label="Barcaza" value={form.barcaza||""} onChange={f("barcaza")}>
              <option value="">Seleccionar...</option>
              {BARCAZAS.map(b=><option key={b}>{b}</option>)}
            </Sel>
            {form.barcaza && TANQUES_BARCAZA[form.barcaza] && (
              <Sel label={`Compartimento ${form.barcaza}`} value={form.compartimento||""} onChange={f("compartimento")}>
                <option value="">Seleccionar compartimento...</option>
                {TANQUES_BARCAZA[form.barcaza].map(c=><option key={c}>{c}</option>)}
              </Sel>
            )}
            <Inp label="Guía de Despacho" type="text" value={form.guia||""} onChange={f("guia")}/>
            <Inp label="Puerto Destino" type="text" placeholder="SPSM / Cartagena / Palermo" value={form.destino||""} onChange={f("destino")}/>
          </Grid>
          <div style={{ display:"flex", justifyContent:"flex-end", gap:10, marginTop:12 }}>
            <Btn outline onClick={()=>setModal(null)}>Cancelar</Btn>
            <Btn color="#c084fc" onClick={guardarDespacho} disabled={saving}>{saving?"Guardando...":form.id?"Actualizar Despacho":"Confirmar Despacho"}</Btn>
          </div>
        </Modal>
      )}

{/* TURNO CARRO */}
{modal==="turno_carro" && (()=>{
  const enRuta = viajes.filter(v=>v.estado==="En Ruta"&&!v.fecha_llegada)
    .sort((a,b)=>new Date(a.fecha)-new Date(b.fecha));
  const selViaje = enRuta.find(v=>v.id===form.viaje_id);
  return (
    <Modal title="Registrar Llegada a Planta" onClose={()=>{setModal(null);setForm({});}} inline>
      <div style={{marginBottom:14,position:"relative"}}>
        <Lbl>Buscar Carro por Placa, Guía o Producto</Lbl>
        <input
          autoFocus
          value={form._busqueda !== undefined ? form._busqueda : (selViaje ? `${selViaje.placa} · ${selViaje.producto}` : "")}
          onChange={e=>setForm(p=>({...p,_busqueda:e.target.value,viaje_id:""}))}
          placeholder="Ej: WOM853, FRONTERA, guía 123..."
          style={{width:"100%",background:T.card,border:`1px solid ${T.border}`,borderRadius:6,padding:"10px 12px",color:T.text,fontSize:13,outline:"none",boxSizing:"border-box"}}
        />
        {form._busqueda && !form.viaje_id && (()=>{
          const q = form._busqueda.toLowerCase();
          const matches = enRuta.filter(v=>
            (v.placa||"").toLowerCase().includes(q) ||
            (v.producto||"").toLowerCase().includes(q) ||
            (v.guia||"").toLowerCase().includes(q) ||
            (v.conductor||"").toLowerCase().includes(q)
          ).slice(0,8);
          if(!matches.length) return <div style={{position:"absolute",top:"100%",left:0,right:0,background:T.card,border:`1px solid ${T.border}`,borderRadius:"0 0 8px 8px",padding:"10px 14px",fontSize:12,color:T.muted,zIndex:50}}>Sin resultados</div>;
          return (
            <div style={{position:"absolute",top:"100%",left:0,right:0,background:"#0d1f30",border:"1px solid #ffffff14",borderTop:"none",borderRadius:"0 0 10px 10px",zIndex:50,overflow:"hidden",boxShadow:"0 8px 24px #000c"}}>
              {matches.map(v=>(
                <div key={v.id} onClick={()=>setForm(p=>({...p,viaje_id:v.id,_busqueda:undefined}))}
                  style={{padding:"10px 14px",cursor:"pointer",display:"grid",gridTemplateColumns:"auto 1fr auto",gap:"0 12px",alignItems:"center",borderBottom:"1px solid #ffffff08",transition:"background 0.1s"}}
                  onMouseEnter={e=>e.currentTarget.style.background="#ffffff0d"}
                  onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                  <span style={{background:"#f59e0b18",border:"1px solid #f59e0b44",borderRadius:6,padding:"3px 9px",color:"#f59e0b",fontWeight:700,fontSize:12,letterSpacing:1}}>{v.placa}</span>
                  <span style={{color:"#c8dce8",fontSize:12}}>{v.producto}</span>
                  <span style={{color:T.muted,fontSize:11}}>{v.fecha}</span>
                </div>
              ))}
            </div>
          );
        })()}
      </div>
      {selViaje && (
        <div style={{background:"#0d1f30",borderRadius:10,padding:"12px 16px",marginBottom:14,fontSize:12,display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
          <div><span style={{color:T.muted}}>Placa: </span><b style={{color:"#f59e0b"}}>{selViaje.placa}</b></div>
          <div><span style={{color:T.muted}}>Producto: </span>{selViaje.producto}</div>
          <div><span style={{color:T.muted}}>Transportadora: </span>{selViaje.transportadora}</div>
          <div><span style={{color:T.muted}}>F. Cargue: </span>{selViaje.fecha}</div>
          <div><span style={{color:T.muted}}>Guía: </span>{selViaje.guia||"—"}</div>
          <div><span style={{color:T.muted}}>Conductor: </span>{selViaje.conductor||"—"}</div>
        </div>
      )}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:14}}>
        <div>
          <Lbl>Fecha de Llegada</Lbl>
          <Inp type="date" value={form.fecha_llegada||""} onChange={e=>setForm(p=>({...p,fecha_llegada:e.target.value}))}/>
        </div>
        <div>
          <Lbl>Hora de Llegada</Lbl>
          <Inp type="time" value={form.hora_llegada||""} onChange={e=>setForm(p=>({...p,hora_llegada:e.target.value}))}/>
        </div>
      </div>
      <div style={{marginBottom:18}}>
        <Lbl>Observaciones</Lbl>
        <textarea value={form.observacion||""} onChange={e=>setForm(p=>({...p,observacion:e.target.value}))}
          rows={2} placeholder="Ej: llegó con sello roto, carro en buen estado..."
          style={{width:"100%",background:T.card,border:`1px solid ${T.border}`,borderRadius:6,padding:"10px 12px",color:T.text,fontSize:12,outline:"none",resize:"vertical",boxSizing:"border-box"}}/>
      </div>
      <Btn disabled={!form.viaje_id||!form.fecha_llegada||saving} onClick={async()=>{
        if(!form.viaje_id){showToast("Selecciona un carro primero",false);return;}
        setSaving(true);
        const viajeTarget = enRuta.find(v=>v.id===form.viaje_id);
        // Calcular siguiente turno: máximo turno_planta actual + 1
        const {data:turnos} = await supabase.from("viajes").select("turno_planta").not("turno_planta","is",null);
        const maxTurno = turnos&&turnos.length>0 ? Math.max(...turnos.map(t=>t.turno_planta||0)) : 0;
        const {error, data} = await supabaseAdmin.from("viajes").update({
          fecha_llegada: form.fecha_llegada,
          observacion: form.observacion||null,
          estado: "En Planta",
          turno_planta: maxTurno + 1,
        }).eq("id", form.viaje_id).select();
        setSaving(false);
        if(error){showToast("Error: "+error.message,false);return;}
        if(!data||data.length===0){showToast("No se pudo actualizar. Verifica permisos.",false);return;}
        await loadData();
        setModal(null); setForm({});
        showToast(`✅ ${viajeTarget?.placa} · Turno #${maxTurno+1}`,true);
      }}>{saving?"Registrando...":"Registrar en Planta"}</Btn>
    </Modal>
  );
})()}

{/* GESTIONAR USUARIO — modal completo */}
{editUsuario && (()=>{
  const MODS = ["viajes","tiquetes","pbs","cmt","tanques","despachos","trazabilidad"];
  const ACCIONES = ["ver","crear","editar","eliminar"];
  const COLOR_ACCION = {ver:"#00b4ff",crear:"#00e5a0",editar:"#f59e0b",eliminar:"#ff4d4d"};
  const cedula = editUsuario.cedula || (editUsuario.email||"").replace("@quimibuques.com","");
  return (
    <Modal title={`Gestionar Usuario — ${editUsuario.nombre}`} onClose={()=>setEditUsuario(null)} wide inline>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12,marginBottom:18}}>
        <div>
          <Lbl>Cédula</Lbl>
          <div style={{background:T.bg,border:`1px solid ${T.border}`,borderRadius:6,padding:"10px 12px",fontSize:13,color:T.muted}}>{cedula||"—"}</div>
        </div>
        <div>
          <Lbl>Rol</Lbl>
          <select value={editUsuario.rol} onChange={e=>setEditUsuario(u=>({...u,rol:e.target.value}))}
            style={{width:"100%",background:T.card,border:`1px solid ${T.border}`,borderRadius:6,padding:"10px 12px",color:T.text,fontSize:13,outline:"none"}}>
            {Object.entries(ROLES).map(([k,v])=><option key={k} value={k}>{v.icon} {v.label}</option>)}
          </select>
        </div>
        <div>
          <Lbl>Sede</Lbl>
          <select value={editUsuario.sede||"MALAMBO"} onChange={e=>setEditUsuario(u=>({...u,sede:e.target.value}))}
            style={{width:"100%",background:T.card,border:`1px solid ${T.border}`,borderRadius:6,padding:"10px 12px",color:T.text,fontSize:13,outline:"none"}}>
            {SEDES.map(s=><option key={s}>{s}</option>)}
          </select>
        </div>
      </div>
      {(editUsuario.sede||"MALAMBO")==="MALAMBO" && (
        <div style={{marginBottom:18}}>
          <Lbl>Planta</Lbl>
          <select value={editUsuario.planta||"PLANTA 1"} onChange={e=>setEditUsuario(u=>({...u,planta:e.target.value}))}
            style={{width:"100%",background:T.card,border:`1px solid ${T.border}`,borderRadius:6,padding:"10px 12px",color:T.text,fontSize:13,outline:"none"}}>
            {PLANTAS.map(pl=><option key={pl}>{pl}</option>)}
          </select>
        </div>
      )}

      <div style={{fontSize:11,fontWeight:800,color:T.orange,letterSpacing:1.5,textTransform:"uppercase",marginBottom:10,paddingBottom:6,borderBottom:`2px solid ${T.orange}22`}}>Permisos por Módulo</div>
      <div style={{overflowX:"auto",marginBottom:18,borderRadius:8,border:`1px solid ${T.border}`,overflow:"hidden"}}>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
          <thead>
            <tr style={{background:T.bg}}>
              <th style={{padding:"10px 14px",textAlign:"left",color:T.navy,fontSize:10,textTransform:"uppercase",fontWeight:700,width:140,borderBottom:`2px solid ${T.border}`}}>Módulo</th>
              {ACCIONES.map(a=><th key={a} style={{padding:"10px 14px",textAlign:"center",color:COLOR_ACCION[a],fontSize:10,textTransform:"uppercase",fontWeight:700,borderBottom:`2px solid ${T.border}`}}>{a}</th>)}
            </tr>
          </thead>
          <tbody>
            {MODS.map((mod,i)=>(
              <tr key={mod} style={{borderTop:`1px solid ${T.border}`,background:i%2===0?T.card:"#fafbfc"}}>
                <td style={{padding:"10px 14px",color:T.navy,textTransform:"capitalize",fontWeight:600}}>{mod}</td>
                {ACCIONES.map(accion=>(
                  <td key={accion} style={{padding:"10px 14px",textAlign:"center"}}>
                    <input type="checkbox"
                      checked={permsEdit[mod]?.[accion]||false}
                      onChange={()=>setPermsEdit(prev=>({...prev,[mod]:{...prev[mod],[accion]:!prev[mod][accion]}}))}
                      style={{width:16,height:16,cursor:"pointer",accentColor:COLOR_ACCION[accion]}}/>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,marginTop:4}}>
        <div style={{display:"flex",gap:8}}>
          <Btn color={editUsuario.activo===false?"#00b894":"#f59e0b"} sm onClick={async()=>{
            const desactivar = editUsuario.activo !== false;
            const label = desactivar ? "deshabilitar" : "habilitar";
            if (!confirm(`¿${label.charAt(0).toUpperCase()+label.slice(1)} a ${editUsuario.nombre}?`)) return;
            const ban = desactivar ? "876600h" : "none";
            const {error:e1} = await supabaseAdmin.auth.admin.updateUserById(editUsuario.id, {ban_duration: ban});
            if (e1) return showToast("Error auth: "+e1.message, false);
            const {error:e2} = await supabaseAdmin.from("perfiles").update({activo: !desactivar}).eq("id",editUsuario.id);
            if (e2) return showToast("Error perfil: "+e2.message, false);
            await loadData(); setEditUsuario(null);
            showToast(`Usuario ${editUsuario.nombre} ${desactivar?"deshabilitado":"habilitado"}`);
          }}>{editUsuario.activo===false ? "✅ Habilitar" : "⛔ Deshabilitar"}</Btn>
          <Btn color={T.danger} sm onClick={async()=>{
            if (!confirm(`¿Eliminar a ${editUsuario.nombre}? Esta acción no se puede deshacer.`)) return;
            const {error:e1} = await supabaseAdmin.from("perfiles").delete().eq("id",editUsuario.id);
            if (e1) return showToast("Error perfil: "+e1.message, false);
            const {error:e2} = await supabaseAdmin.auth.admin.deleteUser(editUsuario.id);
            if (e2) return showToast("Error auth: "+e2.message, false);
            await loadData(); setEditUsuario(null);
            showToast(`Usuario ${editUsuario.nombre} eliminado`);
          }}>🗑 Eliminar</Btn>
        </div>
        <div style={{display:"flex",gap:10}}>
          <Btn outline onClick={()=>setEditUsuario(null)}>Cancelar</Btn>
          <Btn color={T.orange} disabled={saving} onClick={async()=>{
            setSaving(true);
            const {error} = await supabaseAdmin.from("perfiles").update({
              rol:editUsuario.rol, planta:editUsuario.planta||"PLANTA 1", permisos:permsEdit
            }).eq("id",editUsuario.id);
            setSaving(false);
            if (error) return showToast("Error: "+error.message, false);
            await loadData(); setEditUsuario(null);
            showToast(`Usuario ${editUsuario.nombre} actualizado`);
          }}>{saving?"Guardando...":"Guardar Cambios"}</Btn>
        </div>
      </div>
    </Modal>
  );
})()}

{modal==="usuario" && (()=>{
  const esAdmin = (form.rol||"logistica") === "administrador";
  return (
  <Modal title="Crear Nuevo Usuario" onClose={()=>setModal(null)} wide inline>
    <Grid cols={2}>
      <Inp label="Nombre completo" type="text" value={form.nombre||""} onChange={f("nombre")}/>
      <Inp label="Cédula (usuario de acceso)" type="text" placeholder="Número de cédula" value={form.cedula||""} onChange={f("cedula")}/>
    </Grid>
    <Grid cols={3}>
      <Inp label="Contraseña inicial" type="text" placeholder="Mínimo 6 caracteres" value={form.password||""} onChange={f("password")}/>
      <Sel label="Rol" value={form.rol||"logistica"} onChange={f("rol")}>
        {Object.entries(ROLES).map(([k,v])=><option key={k} value={k}>{v.icon} {v.label}</option>)}
      </Sel>
      <Sel label="Sede" value={form.sede||"MALAMBO"} onChange={f("sede")}>
        {SEDES.map(s=><option key={s}>{s}</option>)}
      </Sel>
    </Grid>
    {esAdmin && (
      <Inp label="Correo electrónico (obligatorio para Administrador)" type="email" placeholder="correo@empresa.com" value={form.email||""} onChange={f("email")}/>
    )}
    {(form.sede||"MALAMBO")==="MALAMBO" && (
      <Sel label="Planta" value={form.planta||"PLANTA 1"} onChange={f("planta")}>
        {PLANTAS.map(p=><option key={p}>{p}</option>)}
      </Sel>
    )}
    {form.cedula && form.password && (
      <div style={{background:`${T.success}18`,border:`1px solid ${T.success}33`,borderRadius:8,padding:"10px 14px",fontSize:12,marginBottom:8}}>
        <b style={{color:T.success}}>Datos de acceso a entregar:</b>&nbsp;
        {esAdmin ? <>Correo: <b>{form.email||"—"}</b>&nbsp;·&nbsp;</> : <>Usuario: <b>{form.cedula}</b>&nbsp;·&nbsp;</>}
        Clave: <b>{form.password}</b>
      </div>
    )}
    <div style={{ display:"flex", justifyContent:"flex-end", gap:10, marginTop:12 }}>
      <Btn outline onClick={()=>setModal(null)}>Cancelar</Btn>
      <Btn color={T.orange} disabled={saving} onClick={async()=>{
        const rolSel = form.rol||"logistica";
        if (!form.cedula||!form.password||!form.nombre) return showToast("Completa nombre, cédula y contraseña", false);
        if (rolSel==="administrador" && !form.email) return showToast("El correo es obligatorio para Administrador", false);
        setSaving(true);
        const emailFinal = rolSel==="administrador" ? form.email.trim().toLowerCase() : cedulaToEmail(form.cedula);
        let userId;
        const {data:newUser, error} = await supabaseAdmin.auth.admin.createUser({
          email:emailFinal, password:form.password, email_confirm:true,
          user_metadata:{nombre:form.nombre, rol:form.rol, planta:form.planta, sede:form.sede||"MALAMBO", cedula:form.cedula}
        });
        if (error) {
          if (error.message.includes("already been registered")) {
            // El usuario existe en Auth pero no en perfiles — buscamos el ID
            const {data:list} = await supabaseAdmin.auth.admin.listUsers();
            const existing = (list?.users||[]).find(u=>u.email===emailFinal);
            if (!existing) { setSaving(false); return showToast("Error: cédula ya registrada", false); }
            // Actualizamos contraseña y metadata
            await supabaseAdmin.auth.admin.updateUserById(existing.id, {
              password:form.password, email_confirm:true,
              user_metadata:{nombre:form.nombre, rol:form.rol, planta:form.planta, sede:form.sede||"MALAMBO", cedula:form.cedula}
            });
            userId = existing.id;
          } else { setSaving(false); return showToast("Error: "+error.message, false); }
        } else { userId = newUser.user.id; }
        const {error:e2} = await supabaseAdmin.from("perfiles").upsert({
          id:userId, nombre:form.nombre, email:emailFinal,
          rol:form.rol, planta:form.planta||"PLANTA 1", sede:form.sede||"MALAMBO",
          cedula:form.cedula, activo:true, permisos:{}
        });
        setSaving(false);
        if (e2) return showToast("Error perfil: "+e2.message, false);
        await loadData(); setModal(null); setForm({});
        showToast(`Usuario ${form.nombre} creado · Cédula: ${form.cedula}`);
      }}>{saving?"Creando...":"Crear Usuario"}</Btn>
    </div>
  </Modal>
  );
})()}

        </div>
      </div>
    </div>
  );
}