import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
import * as XLSX from "xlsx";
import LiquidadorPlanta1 from "./components/LiquidadorPlanta1";
import InventarioDiario from "./components/InventarioDiario";
import { calcularGalonesP1, parseTankId } from "./utils/aforoP1";
import LiquidadorPlanta2 from "./components/LiquidadorPlanta2";
import { initScrollRestore } from "./utils/scrollRestore";
import { LayoutDashboard, Truck, FlaskConical, Settings2, ClipboardList, Cylinder, Ship, Search, Users, CalendarDays, Calculator, RefreshCw, Crown, BarChart2, Package, Lock, AlertTriangle, CheckCircle, X, Pencil, Trash2, Save, Fuel, Anchor, MapPin, ArrowDownToLine, Wrench, HardHat, Factory, Clock, CircleCheck, CirclePause, Timer, Beaker, ChevronRight, GaugeCircle, Droplets, Flame } from "lucide-react";

const ICON_MAP = {
  dashboard:    LayoutDashboard,
  viajes:       Truck,
  tiquetes:     FlaskConical,
  pbs:          Settings2,
  cmt:          ClipboardList,
  tanques:      Cylinder,
  despacho:     Ship,
  trazabilidad: Search,
  usuarios:     Users,
  programacion: CalendarDays,
  liquidador:   Calculator,
};
function NavIcon({id, size=17, color}){
  const Ic=ICON_MAP[id];
  if(!Ic)return null;
  return <Ic size={size} color={color||"currentColor"} strokeWidth={1.8}/>;
}

// CSS global: todos los inputs de texto en mayúsculas
const _style = document.createElement("style");
_style.textContent = `input[type="text"], input:not([type]) { text-transform: uppercase !important; }`;
document.head.appendChild(_style);

// ─── SUPABASE ─────────────────────────────────────────────────────────────────
const SUPABASE_URL = "https://pahulcaneuzfiknrzlbc.supabase.co";
const SUPABASE_KEY = "sb_publishable_6A3JvUT-O5UpP5FAYUIKaA_6-Xihr7N";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ─── API HELPERS (service_role vive solo en el servidor) ──────────────────────
async function getToken() {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token || "";
}
async function dbCall({ table, op, data, filters = [], select = "*", single = false }) {
  const token = await getToken();
  const res = await fetch("/api/db", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
    body: JSON.stringify({ table, op, data, filters, select, single }),
  });
  return res.json();
}
async function authAdminCall({ op, userId, data }) {
  const token = await getToken();
  const res = await fetch("/api/auth-admin", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
    body: JSON.stringify({ op, userId, data }),
  });
  return res.json();
}

// ─── CONSTANTES ───────────────────────────────────────────────────────────────
const MATERIAS_PRIMAS = ["FRONTERA","PENDARE","ALBERTA","CARRIZALES NORTE P","CARRIZALES NORTE B","OMI","VIGIA","KIMBO","CUERVA","SOGAMOSO","TK205","RUMBA","MATEGUAFA","DESTILADO REFISAMAG"];

const PRODUCTO_NORMALIZACION = {
  "PENDARE": "PENDARE",
  "PENDARE TFG": "PENDARE",
  "PENDARE REGULAR": "PENDARE",
  "CARRIZALES NORTE B": "CARRIZALES NORTE",
  "CARRIZALES NORTE P": "CARRIZALES NORTE",
  "CARRIZALES NORTE": "CARRIZALES NORTE",
  "OMI": "OMI",
  "OMI TFG": "OMI",
  "FRONTERA": "FRONTERA",
  "VASCONIA": "VASCONIA",
  "CUERVA": "CUERVA",
  "ALBERTA": "ALBERTA",
  "VIGIA": "VIGIA",
};

function normalizarProducto(producto) {
  return PRODUCTO_NORMALIZACION[producto?.trim()] || producto;
}

function agruparDescarguesPorProducto(descarguesArray) {
  if (!descarguesArray || descarguesArray.length === 0) return [];
  const agrupados = {};
  descarguesArray.forEach(d => {
    const productoBase = normalizarProducto(d.producto || d.nombre || "");
    if (!agrupados[productoBase]) {
      agrupados[productoBase] = { productoBase, galones_planeado: 0, galones_descargado: 0, plancas: [], estado: "pendiente" };
    }
    agrupados[productoBase].galones_planeado += Number(d.galones_planeado || 0);
    agrupados[productoBase].galones_descargado += Number(d.galones_descargado || 0);
    agrupados[productoBase].plancas.push({
      id: d.id,
      placa: d.placa,
      galones: Number(d.galones_planeado || 0),
      producto_original: d.producto || d.nombre || "",
      galones_descargados: Number(d.galones_descargado || 0),
      estado: d.estado,
      _idx: descarguesArray.indexOf(d),
    });
    if (d.estado === "descargando") agrupados[productoBase].estado = "descargando";
  });
  return Object.values(agrupados).map(g => ({
    ...g,
    carrotanques: (g.galones_planeado / 9300).toFixed(1),
  }));
}

function fmtNum(num) {
  return Number(num).toLocaleString("es-CO", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}
// Calcula diferencia entre dos strings "HH:MM" → "Xh Ym"
// Soporta cruce de medianoche: si fin < inicio asume que pasó al día siguiente
function duracion(inicio, fin) {
  if (!inicio || !fin) return "";
  const [h1,m1] = inicio.split(":").map(Number);
  const [h2,m2] = fin.split(":").map(Number);
  if (isNaN(h1)||isNaN(m1)||isNaN(h2)||isNaN(m2)) return "";
  let mins = (h2*60+m2) - (h1*60+m1);
  if (mins < 0) mins += 24*60; // cruzó medianoche
  if (mins === 0) return "";
  const h = Math.floor(mins/60), m = mins%60;
  return h>0 ? `${h}h ${m}m` : `${m}m`;
}
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
  operaciones: { label:"Operaciones",        color:"#005fa3", icon:"⚙️" },
  coordinador: { label:"Coordinador Planta", color:"#00B894", icon:"📋" },
  despacho:    { label:"Despacho",           color:"#003B73", icon:"🚢" },
  gerencia:    { label:"Gerencia",           color:"#6E7781", icon:"📊" },
  administrador: { label:"Administrador", color:"#0077CC", icon:"👑" },
};

const NAV_META = {
  dashboard:    { label:"Dashboard",    icon:"▦" },
  viajes:       { label:"Listado Tránsito", icon:"🚛" },
  tiquetes:     { label:"Tiquetes MP",  icon:"🧪" },
  pbs:          { label:"PBS",          icon:"🔒" },
  cmt:          { label:"CMT",          icon:"📋" },
  tanques:      { label:"Planta 2",     icon:"🛢" },
  tanques_p1:   { label:"Planta 1",    icon:"🚢" },
  despacho:     { label:"Despacho",     icon:"🚢" },
  trazabilidad:  { label:"Trazabilidad",  icon:"🔍" },
  usuarios:      { label:"Usuarios",      icon:"👥" },
  programacion:  { label:"Programación",  icon:"📅" },
  liquidador:    { label:"Liquidador",    icon:"🔢" },
  inventario_diario: { label:"Inventario Diario", icon:"📊" },
  auditoria:         { label:"Auditoría",          icon:"🔎" },
};

const NAV_ROL = {
  logistica:   ["dashboard","viajes","pbs","trazabilidad"],
  laboratorio: ["dashboard","tiquetes","pbs","trazabilidad"],
  operaciones: ["dashboard","pbs","trazabilidad","liquidador","inventario_diario"],
  coordinador: ["dashboard","pbs","tanques","programacion","trazabilidad","liquidador","inventario_diario"],
  despacho:    ["dashboard","despacho","pbs","trazabilidad"],
  administrador: [
    "dashboard",
    "usuarios",
    "trazabilidad",
    "viajes",
    "tiquetes",
    "pbs",
    "despacho",
    "programacion",
    "tanques",
    "liquidador",
    "inventario_diario",
    "auditoria",
  ],
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

const TIPO_COLOR = { materia_prima:"#4a7c59", mezcla:"#00b4ff", terminado:"#4a7c59" };
const TIPO_LABEL = { materia_prima:"Mat. Prima", mezcla:"Mezcla/Prod.", terminado:"Terminado" };
const fmt = n => Number(n||0).toLocaleString("es-CO");
const today = () => new Date().toISOString().slice(0,10);
const genId = (prefix, list) => `${prefix}-${String((list?.length||0)+1).padStart(3,"0")}`;

// Colores por producto para tanques Varec
const getProductColor = (producto) => {
  if (!producto) return "#1a1a1a";
  const upperProd = String(producto).toUpperCase();
  if (upperProd === "MGO" || upperProd === "DIESEL") return "#3b2200"; // Crudo claro/diesel: marrón oscuro ámbar
  if (upperProd === "VLSFO" || upperProd === "HSFO") return "#0d0800"; // Bunker pesado: negro-café
  return "#1a0d00"; // Materia prima cruda: marrón-negro
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
  navy:"#003B73",   // Azul Marino corporativo
  sidebar:"#121212",
  orange:"#0077CC", // Azul Operativo (acento corporativo)
  success:"#00B894",
  danger:"#D63031",
  bg:"#f0f4f8",
  text:"#121212",   // Negro VLSFO
  card:"#ffffff",
  border:"#d1d9e0",
  muted:"#6E7781",  // Gris Metálico
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
      <div style={{ padding:24, background:T.bg, ...(inline ? { flex:1, overflowY:'auto' } : {}) }}>{children}</div>
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
    <div style={{ background:T.card, borderRadius:8, border:`1px solid ${T.border}`, overflow:"auto", boxShadow:"0 1px 3px rgba(0,0,0,0.06)" }}>
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
  const scrollPosCache = useRef({});
  const mainContentRef = useRef(null);
  const cmtCarrosRef = useRef(null);
  const otContextRef = useRef({ot_id:null, ot_numero:null});

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
  const PORTEO_ROW = {tanque:"",sondaInicial:"",tempInicial:"",apiInicial:"",galonesInicial:"",sondaFinal:"",tempFinal:"",apiFinal:"",galonesFinal:""};
  const PORTEO_CARRO = {placa:"",transportadora:"",hora_inicio_cargue:"",hora_final_cargue:"",hora_inicio_descargue:"",hora_final_descargue:"",numero_pbs:"",galones_contador:"",peso_ingreso:"",peso_salida:"",galones_bascula:""};
  const [cmtPorteoCargaPlanta, setCmtPorteoCargaPlanta] = useState("");
  const [cmtPorteoDescargaPlanta, setCmtPorteoDescargaPlanta] = useState("");
  const [cmtPorteoCarga, setCmtPorteoCarga] = useState([{...PORTEO_ROW}]);
  const [cmtPorteoDescarga, setCmtPorteoDescarga] = useState([{...PORTEO_ROW}]);
  const [cmtPorteoCarros, setCmtPorteoCarros] = useState([{...PORTEO_CARRO}]);
  const [viajesBusqueda, setViajesBusqueda] = useState("");
  const [programaciones, setProgramaciones] = useState([]);
  const [formulaciones, setFormulaciones] = useState([]);
  const [ordenesTrabaio, setOrdenesTrabajo] = useState([]);
  // Cache aforo Planta 2 — se carga una sola vez al iniciar sesión
  const [afoP2, setAfoP2] = useState({});
  const [afoP2Loading, setAfoP2Loading] = useState(false);
  const [otModal, setOtModal] = useState(null); // null | {step:1|2|3, trasiegos, formulacionId, recircHoras}
  const [otEditando, setOtEditando] = useState(null); // {otId, trasiegos:[...]} cuando el coordinador edita una OT
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditFiltro, setAuditFiltro] = useState({ tabla:"", accion:"", usuario:"" });
  const [recircDates, setRecircDates] = useState({}); // {[otId]: {inicio, fin}}
  const [otSaving, setOtSaving] = useState(false);
  const [progTab, setProgTab] = useState("programaciones"); // "programaciones" | "formulaciones"
  const [modalVinculacionOT, setModalVinculacionOT] = useState({mostrar:false, cmtId:null, cmtNumero:null});
  const [otVincSeleccionada, setOtVincSeleccionada] = useState("");
  const [formFormulacion, setFormFormulacion] = useState(null); // null=cerrado, {}=nuevo, {id,...}=editar
  const [trazBuscar, setTrazBuscar] = useState("");
  const [trazDesde, setTrazDesde] = useState("");
  const [trazHasta, setTrazHasta] = useState("");
  const [trazEstado, setTrazEstado] = useState("DESCARGUE");
  const [trazColsDesc, setTrazColsDesc] = useState(new Set(["placa","fecha","cmt","producto","transportadora","guia","tiquete","api","glsGuia","glsBas","pbs","ot","tanques","horaInicio","horaFinal","duracion","pesoIng","pesoSal","pesoNeto","rpm","presion"]));
  const [trazColsPorteo, setTrazColsPorteo] = useState(new Set(["placa","fecha","cmt","transportadora","tqsCarga","inicio","fin","durCargue","inicioDesc","finDesc","durDescargue","contador","pesoIng","pesoSal","bascula","ot","tqsDesc"]));
  const [trazColPanel, setTrazColPanel] = useState(false);
  const [mps, setMps] = useState([ // materias primas en el modal formulación
    { nombre:"PENDARE", galones:"", api:"", visc:"", azufre:"", agua:"", flash:"" }
  ]);
  const [tankProdEdit, setTankProdEdit] = useState(null);   // {id, val} cuando se edita producto
  const [tankProdSaving, setTankProdSaving] = useState(false);
  const [tankFullscreen, setTankFullscreen] = useState(false);
  const fsContainerRef = React.useRef(null);
  const togglePresentation = React.useCallback(() => {
    if (!document.fullscreenElement) {
      fsContainerRef.current?.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
  }, []);
  React.useEffect(() => {
    const handler = () => setTankFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  // Inicializar sistema global de restauración de scroll (data-scroll-key)
  React.useEffect(() => initScrollRestore(), []);
  const [otExpandidos, setOtExpandidos] = useState({});
  const toggleOtExpandir = (productoBase) => setOtExpandidos(prev => ({ ...prev, [productoBase]: !prev[productoBase] }));
  const [viajesFiltroEstado, setViajesFiltroEstado] = useState("");
  const [viajesFiltroProducto, setViajesFiltroProducto] = useState("");
  const [viajesFiltroTrans, setViajesFiltroTrans] = useState("");
  const [dashFamilia, setDashFamiliaState] = useState(()=>{try{return localStorage.getItem("dashFamilia")||"negro";}catch{return "negro";}});
  const setDashFamilia = v => { setDashFamiliaState(v); try{localStorage.setItem("dashFamilia",v);}catch{} };
  const [tankFamilias, setTankFamilias] = useState(() => { try { return JSON.parse(localStorage.getItem("tankFamilias")||"{}"); } catch{ return {}; } });
  const [modalTankAdmin, setModalTankAdmin] = useState(false);
  const [viajesFiltroFechaD, setViajesFiltroFechaD] = useState("");
  const [viajesFiltroFechaH, setViajesFiltroFechaH] = useState("");
  const [importExcel, setImportExcel] = useState(null); // null | { rows, preview, pestaña }
  const [importLoading, setImportLoading] = useState(false);
  const [importFechaDesde, setImportFechaDesde] = useState("");
  const [modalFlota, setModalFlota] = useState(false);
  const [modalLiqDetalle, setModalLiqDetalle] = useState(null); // {liq, despacho}
  const [liqEditMode, setLiqEditMode] = useState(false);
  const [liqEditForm, setLiqEditForm] = useState({});
  const [liqSaving, setLiqSaving] = useState(false);
  const [flotaDiasProducto, setFlotaDiasProducto] = useState(()=>{
    try { return JSON.parse(localStorage.getItem("flota_dias_producto")||"{}"); } catch{ return {}; }
  });
  const [flotaFechaDesde, setFlotaFechaDesde] = useState("");
  const [flotaFechaHasta, setFlotaFechaHasta] = useState("");
  const [flotaRedirDesde, setFlotaRedirDesde] = useState("");
  const [flotaRedirHasta, setFlotaRedirHasta] = useState("");
  const [flotaRedirSede, setFlotaRedirSede] = useState("MALAMBO");
  const [flotaRedirTrans, setFlotaRedirTrans] = useState("");
  const [flotaRedirProducto, setFlotaRedirProducto] = useState("");
  const [flotaRedirPlaca, setFlotaRedirPlaca] = useState("");
  const [flotaRedirSedeActual, setFlotaRedirSedeActual] = useState("");
  const [flotaElimDesde, setFlotaElimDesde] = useState("");
  const [flotaElimHasta, setFlotaElimHasta] = useState("");
  const [flotaElimTrans, setFlotaElimTrans] = useState("");
  const [flotaElimProducto, setFlotaElimProducto] = useState("");
  const [flotaElimPlaca, setFlotaElimPlaca] = useState("");
  const [flotaElimConfirm, setFlotaElimConfirm] = useState(false);
  const [flotaAccion, setFlotaAccion] = useState("");
  const [despachoSeccion, setDespachoSeccion] = useState("buques");
  const [flotaEditCampo, setFlotaEditCampo] = useState("");
  const [flotaEditValor, setFlotaEditValor] = useState("");
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
  const [cmtPlantaSelector, setCmtPlantaSelector] = useState(false);
  const [cmtBusqueda, setCmtBusqueda] = useState("");
  const [cmtFiltroTipo, setCmtFiltroTipo] = useState("");
  const [cmtFiltroFechaD, setCmtFiltroFechaD] = useState("");
  const [cmtFiltroFechaH, setCmtFiltroFechaH] = useState("");
  const [cmtVistaCarros, setCmtVistaCarros] = useState(false);
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
  const fPlaca = k => e => setForm(p=>({...p,[k]: e.target.value.replace(/[^A-Z0-9]/gi,"").toUpperCase().slice(0,6)}));
  const abrirCmt = c => {
    // Usar numero_cmt como key única — más confiable que c.id que puede variar
    const cmtKey = c.numero_cmt || c.id || `cmt-${Date.now()}`;
    // Si ya hay un tab abierto para este CMT, simplemente cambiar a él
    const existingTab = tabs.find(t => t.type === 'form' && t.formType === 'cmt' && t.cmtKey === cmtKey);
    if (existingTab) { switchToTab(existingTab.id); return; }
    // Guardar estado del tab actual antes de abrir el nuevo
    if (activeTab?.type === 'form') { tabStateCache.current[activeTabId] = captureFormState(); }
    const cmtState = {
      form: {...c},
      cmtAntes: c.tanques_antes||[{tanque:"",sonda:"",galones:""}],
      cmtDespues: c.tanques_despues||[{tanque:"",producto:"",sonda:"",galones:""}],
      cmtCarros: c.carros||[{placa:"",guia:"",tiquete:"",pbs_id:""}],
      cmtProducto: c.producto||"",
      cmtRecepcion: c.tanques_recepcion||[{tanque:"",sondaInicial:"",tempInicial:"",apiInicial:"",galonesInicial:"",sondaFinal:"",tempFinal:"",apiFinal:"",galonesFinal:""}],
      cmtPorteoCargaPlanta: c.porteo_carga_planta||"",
      cmtPorteoDescargaPlanta: c.porteo_descarga_planta||"",
      cmtPorteoCarga: c.porteo_carga_tanques||[{tanque:"",sondaInicial:"",tempInicial:"",apiInicial:"",galonesInicial:"",sondaFinal:"",tempFinal:"",apiFinal:"",galonesFinal:""}],
      cmtPorteoDescarga: c.porteo_descarga_tanques||[{tanque:"",sondaInicial:"",tempInicial:"",apiInicial:"",galonesInicial:"",sondaFinal:"",tempFinal:"",apiFinal:"",galonesFinal:""}],
      cmtPorteoCarros: (c.porteo_carros||[{placa:"",transportadora:"",hora_inicio_cargue:"",hora_final_cargue:"",numero_pbs:"",galones_contador:"",peso_ingreso:"",peso_salida:"",galones_bascula:""}]).map(cr=>({...cr,galones_bascula:Number(cr.peso_salida)>0?cr.galones_bascula:""})),
      pbsChecklist: Array(26).fill(''), pbsParaCarro: null, pbsEsTrasiego: false, cmtSnapshot: null,
    };
    const newTabId = `form-cmt-${cmtKey}`;
    tabStateCache.current[newTabId] = cmtState;
    setTabs(prev => [...prev, { id: newTabId, type:'form', formType:'cmt', cmtKey, cmtId: c.id, title: cmtKey, icon:'📋', closeable: true }]);
    setActiveTabId(newTabId);
    restoreFormState(cmtState);
  };

  function showToast(msg, ok=true) {
    setToast({msg,ok});
    setTimeout(()=>setToast(null),3500);
  }

  // ── TAB DERIVED STATE ──
  const activeTab = tabs.find(t => t.id === activeTabId) || tabs[0];
  const nav = activeTab?.type === 'nav' ? activeTab.section : '';
  const modal = activeTab?.type === 'form' ? activeTab.formType : null;
  const isFormulacionTab = activeTab?.type === 'formulacion';
  const isLiqDespachoTab = activeTab?.type === 'liquidacion_despacho';

  // ── TAB HELPER FUNCTIONS ──
  function captureFormState() {
    return {
      form: {...form},
      cmtAntes: JSON.parse(JSON.stringify(cmtAntes)),
      cmtDespues: JSON.parse(JSON.stringify(cmtDespues)),
      cmtCarros: JSON.parse(JSON.stringify(cmtCarros)),
      cmtProducto,
      cmtRecepcion: JSON.parse(JSON.stringify(cmtRecepcion)),
      cmtPorteoCargaPlanta,
      cmtPorteoDescargaPlanta,
      cmtPorteoCarga: JSON.parse(JSON.stringify(cmtPorteoCarga)),
      cmtPorteoDescarga: JSON.parse(JSON.stringify(cmtPorteoDescarga)),
      cmtPorteoCarros: JSON.parse(JSON.stringify(cmtPorteoCarros)),
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
    setCmtPorteoCargaPlanta(cached.cmtPorteoCargaPlanta || '');
    setCmtPorteoDescargaPlanta(cached.cmtPorteoDescargaPlanta || '');
    setCmtPorteoCarga(cached.cmtPorteoCarga || [{tanque:'',sondaInicial:'',tempInicial:'',apiInicial:'',galonesInicial:'',sondaFinal:'',tempFinal:'',apiFinal:'',galonesFinal:''}]);
    setCmtPorteoDescarga(cached.cmtPorteoDescarga || [{tanque:'',sondaInicial:'',tempInicial:'',apiInicial:'',galonesInicial:'',sondaFinal:'',tempFinal:'',apiFinal:'',galonesFinal:''}]);
    setCmtPorteoCarros(cached.cmtPorteoCarros || [{placa:'',transportadora:'',hora_inicio_cargue:'',hora_final_cargue:'',numero_pbs:'',galones_contador:'',peso_ingreso:'',peso_salida:'',galones_bascula:''}]);
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
    setCmtPorteoCargaPlanta(''); setCmtPorteoDescargaPlanta('');
    setCmtPorteoCarga([{tanque:'',sondaInicial:'',tempInicial:'',apiInicial:'',galonesInicial:'',sondaFinal:'',tempFinal:'',apiFinal:'',galonesFinal:''}]);
    setCmtPorteoDescarga([{tanque:'',sondaInicial:'',tempInicial:'',apiInicial:'',galonesInicial:'',sondaFinal:'',tempFinal:'',apiFinal:'',galonesFinal:''}]);
    setCmtPorteoCarros([{placa:'',transportadora:'',hora_inicio_cargue:'',hora_final_cargue:'',numero_pbs:'',galones_contador:'',peso_ingreso:'',peso_salida:'',galones_bascula:''}]);
    setPbsChecklist(Array(26).fill(''));
    setPbsParaCarro(null);
    setPbsEsTrasiego(false);
    setCmtSnapshot(null);
  }

  function switchToTab(tabId) {
    if (tabId === activeTabId) return;
    // Guardar scroll actual antes de salir
    if (mainContentRef.current) {
      scrollPosCache.current[activeTabId] = {
        top:  mainContentRef.current.scrollTop,
        left: mainContentRef.current.scrollLeft,
      };
    }
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
    // formulacion tabs carry their own state in tabStateCache — no extra restore needed
  }

  // Restaurar scroll al volver a una pestaña
  useEffect(() => {
    const el = mainContentRef.current;
    if (!el) return;
    const saved = scrollPosCache.current[activeTabId];
    if (!saved) return;
    // requestAnimationFrame asegura que el contenido ya se renderizó antes de restaurar
    requestAnimationFrame(() => {
      el.scrollTop  = saved.top;
      el.scrollLeft = saved.left;
    });
  }, [activeTabId]);

  // Auto-sync: keep tabStateCache fresh whenever form state changes while a form tab is active.
  // This ensures state is never lost regardless of how navigation happens.
  useEffect(() => {
    if (activeTab?.type === 'form') {
      tabStateCache.current[activeTabId] = captureFormState();
    }
  }, [form, cmtAntes, cmtDespues, cmtCarros, cmtProducto, cmtRecepcion,
      cmtPorteoCargaPlanta, cmtPorteoDescargaPlanta,
      cmtPorteoCarga, cmtPorteoDescarga, cmtPorteoCarros,
      pbsChecklist, pbsParaCarro, pbsEsTrasiego, cmtSnapshot, activeTabId]);

  // Actualizar título de la pestaña con la placa cuando es PORTEO
  useEffect(() => {
    if (activeTab?.type !== 'form' || activeTab?.formType !== 'cmt') return;
    const placas = cmtPorteoCarros.map(cr => cr.placa).filter(Boolean);
    const titulo = (form.tipo_operacion === 'PORTEO' && placas.length > 0)
      ? placas.join(' · ')
      : (form.numero_cmt || 'Nuevo CMT');
    setTabs(prev => prev.map(t => t.id === activeTabId ? {...t, title: titulo} : t));
  }, [cmtPorteoCarros, form.tipo_operacion, form.numero_cmt, activeTabId]);

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
      if (section === "usuarios") loadPerfilesConEmail();
      return;
    }
    const meta = NAV_META[section] || { label: section, icon: '📄' };
    const id = `nav-${section}-${Date.now()}`;
    setTabs(prev => [...prev, { id, type:'nav', section, title: meta.label, icon: meta.icon, closeable: true }]);
    setActiveTabId(id);
    clearFormState();
    if (section === "usuarios") loadPerfilesConEmail();
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

  function openFormulacionTab(foData) {
    // foData: null = nueva, o registro existente para editar
    const isNew = !foData?.id;
    const title = isNew ? 'Nueva Formulación' : `Formulación ${foData.fecha||''}`;
    const id = `formulacion-${foData?.id||Date.now()}`;
    // Si ya existe pestaña para este id, solo activarla
    const existing = tabs.find(t => t.id === id);
    if (existing) { setActiveTabId(id); return; }
    const initMps = foData?.mps && Array.isArray(foData.mps) ? foData.mps : [
      { nombre:"PENDARE",  galones:"", api:"", visc:"", azufre:"", agua:"", flash:"" },
      { nombre:"FRONTERA", galones:"", api:"", visc:"", azufre:"", agua:"", flash:"" },
    ];
    const initForm = foData
      ? { id:foData.id, tanque:foData.tanque||"TK-116", producto:foData.producto||"VLSFO", fecha:foData.fecha||today(), estado:foData.estado||"PLANEADA" }
      : { tanque:"TK-116", producto:"VLSFO", fecha:today(), estado:"PLANEADA" };
    tabStateCache.current[id] = { formulacionForm: initForm, formulacionMps: initMps };
    setTabs(prev => [...prev, { id, type:'formulacion', title, icon:'🧪', closeable:true }]);
    setActiveTabId(id);
  }

  // Abre pestaña de liquidación de despacho (una por buque+producto)
  function openLiquidacionDespachoTab(despacho, prod, mt) {
    const id = `liq-despacho-${despacho.id}-${prod}`;
    const existing = tabs.find(t => t.id === id);
    if (existing) { setActiveTabId(id); return; }
    const title = `${despacho.buque} · ${mt} MT · ${prod}`;
    tabStateCache.current[id] = { barcaza: "" };
    setTabs(prev => [...prev, { id, type:'liquidacion_despacho', title, icon:'🚢', closeable:true, despacho, prod, mt }]);
    setActiveTabId(id);
  }

  // Abre una pestaña única por viaje (permite múltiples viajes abiertos simultáneamente)
  function openViajeTab(v) {
    const tabId = `form-viaje-${v.id}`;
    const existing = tabs.find(t => t.id === tabId);
    if (existing) { switchToTab(tabId); return; }
    if (activeTab?.type === 'form') tabStateCache.current[activeTabId] = captureFormState();
    setForm({...v});
    setTabs(prev => [...prev, { id: tabId, type:'form', formType:'viaje_edit', title: v.id, icon:'🚛', closeable: true }]);
    setActiveTabId(tabId);
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
    let timer = null;
    const reload = () => { clearTimeout(timer); timer = setTimeout(()=>loadData(), 800); };
    const channel = supabase.channel("bunkergest-realtime")
      .on("postgres_changes",{event:"*",schema:"public",table:"tanques"},   reload)
      .on("postgres_changes",{event:"*",schema:"public",table:"viajes"},    reload)
      .on("postgres_changes",{event:"*",schema:"public",table:"tiquetes"},  reload)
      .on("postgres_changes",{event:"*",schema:"public",table:"pbs"},       reload)
      .on("postgres_changes",{event:"*",schema:"public",table:"cmts"},      reload)
      .on("postgres_changes",{event:"*",schema:"public",table:"despachos"},     reload)
      .on("postgres_changes",{event:"*",schema:"public",table:"programaciones"}, reload)
      .subscribe();
    return ()=>supabase.removeChannel(channel);
  },[perfil]);

  async function loadAuditLogs() {
    setAuditLoading(true);
    const { data } = await supabase.from("audit_log").select("*").order("created_at", { ascending: false }).limit(500);
    if (data) setAuditLogs(data);
    setAuditLoading(false);
  }

  React.useEffect(() => { if (nav === "auditoria" && perfil?.rol === "administrador") loadAuditLogs(); }, [nav]);

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
      precargarAforoP2();
    }
  }

  // Precarga aforo Planta 2 en background al iniciar sesión
  async function precargarAforoP2(){
    if(afoP2Loading||Object.keys(afoP2).length>0) return;
    setAfoP2Loading(true);
    const TANQUES=["TK-111","TK-112","TK-113","TK-114","TK-115","TK-116","TK-117"];
    async function fetchTk(tk){
      const PAGE=1000; let rows=[], from=0;
      while(true){
        const {data,error}=await supabase.from("aforo")
          .select("ullage_mm,galones_brutos").eq("tanque",tk).order("ullage_mm")
          .range(from,from+PAGE-1);
        if(error||!data||data.length===0)break;
        rows=rows.concat(data);
        if(data.length<PAGE)break;
        from+=PAGE;
      }
      return {tk,rows};
    }
    try{
      const results=await Promise.all(TANQUES.map(tk=>fetchTk(tk)));
      const tbl={};
      for(const {tk,rows} of results) tbl[tk]=rows.map(r=>[r.ullage_mm,r.galones_brutos]);
      setAfoP2(tbl);
    }catch(e){console.error("Error precargando aforo P2:",e);}
    setAfoP2Loading(false);
  }

  async function loadData() {
    const [t,v,tq,p,c,d,pr,permR,prog,form2,ot] = await Promise.all([
      supabase.from("tanques").select("*").order("id"),
      supabase.from("viajes").select("*").order("created_at",{ascending:false}).limit(300),
      supabase.from("tiquetes").select("*").order("created_at",{ascending:false}).limit(300),
      supabase.from("pbs").select("*").order("created_at",{ascending:false}).limit(300),
      supabase.from("cmts").select("*").order("created_at",{ascending:false}).limit(200),
      supabase.from("despachos").select("*").order("created_at",{ascending:false}).limit(300),
      supabase.from("perfiles").select("*").order("nombre"),
      supabase.from("permisos_roles").select("*").order("rol").order("modulo"),
      supabase.from("programaciones").select("*").order("fecha",{ascending:false}).limit(100),
      supabase.from("formulaciones").select("*").order("created_at",{ascending:false}).limit(100),
      supabase.from("ordenes_trabajo").select("*").order("created_at",{ascending:false}).limit(200),
    ]);
    if (t.data) setTanques(t.data);
    if (v.data) setViajes(v.data);
    if (tq.data) setTiquetes(tq.data);
    if (p.data) setPbsList(p.data);
    if (c.data) setCmts(c.data);
    if (d.data) setDespachos(d.data);
    if (pr.data) setPerfiles(pr.data);
    if (permR.data) setPermisosRoles(permR.data);
    if (prog?.data) setProgramaciones(prog.data);
    if (form2?.data) setFormulaciones(form2.data);
    if (ot?.data) setOrdenesTrabajo(ot.data);
    if (t.data && c.data) await reconciliarNivelesTanques(c.data, t.data);
  }

  async function logAudit({ tabla, registro_id, accion, datos_antes=null, datos_despues=null }) {
    try {
      await supabase.from("audit_log").insert({
        tabla, registro_id: String(registro_id||""), accion,
        usuario_id: session?.user?.id || null,
        usuario_nombre: perfil?.nombre || session?.user?.email || "Desconocido",
        datos_antes, datos_despues,
        created_at: new Date().toISOString(),
      });
    } catch(_) {}
  }

  async function reconciliarNivelesTanques(cmtsData, tanquesData) {
    // Cada lectura tiene su propio timestamp según cuándo ocurrió el evento real:
    // - tanques_despues / tanques_recepcion → fecha de operación del CMT
    // - porteo_carga_tanques (origen)       → created_at (el carro se cargó al crear el CMT)
    // - porteo_descarga_tanques (destino)   → updated_at (el carro descargó al editar el CMT)
    const ultimaLectura = {}; // tankId -> { galones, ts }

    const registrar = (tankId, galones, ts) => {
      if (!tankId || galones === "" || galones === null || galones === undefined) return;
      const g = Number(galones);
      if (isNaN(g)) return;
      if (!ultimaLectura[tankId] || ts >= ultimaLectura[tankId].ts)
        ultimaLectura[tankId] = { galones: g, ts };
    };

    for (const cmt of cmtsData) {
      const tsFecha   = new Date(cmt.fecha      || cmt.created_at || 0).getTime();
      const tsCreated = new Date(cmt.created_at || cmt.fecha      || 0).getTime();
      const tsUpdated = new Date(cmt.updated_at || cmt.created_at || cmt.fecha || 0).getTime();

      for (const td of cmt.tanques_despues||[])
        registrar(td.tanque, td.galones, tsFecha);
      for (const tr of cmt.tanques_recepcion||[])
        registrar(tr.tanque, tr.galonesFinal, tsFecha);
      // Origen del porteo: evento de carga (al crear el CMT)
      for (const tc of cmt.porteo_carga_tanques||[])
        registrar(tc.tanque, tc.galonesFinal, tsCreated);
      // Destino del porteo: evento de descargue (al editar el CMT cuando llega el carro)
      for (const td of cmt.porteo_descarga_tanques||[])
        registrar(td.tanque, td.galonesFinal, tsUpdated);
    }

    // Aplicar siempre la última lectura (sin umbral) para asegurar corrección
    for (const tanque of tanquesData) {
      const lectura = ultimaLectura[tanque.id];
      if (!lectura) continue;
      if (Math.round(Number(tanque.nivel||0)) !== Math.round(lectura.galones)) {
        await dbCall({ table:"tanques", op:"update", data:{ nivel: lectura.galones }, filters:[{col:"id",val:tanque.id}] });
        setTanques(prev => prev.map(t => t.id === tanque.id ? {...t, nivel: lectura.galones} : t));
      }
    }
  }

  // Carga enriquecida de perfiles con email de auth (solo para pantalla de usuarios)
  async function loadPerfilesConEmail() {
    const { data: pr } = await supabase.from("perfiles").select("*").order("nombre");
    if (!pr) return;
    try {
      const { data: authUsers } = await authAdminCall({ op:"listUsers", data:{ perPage: 1000 } });
      const emailMap = {};
      (authUsers?.users||[]).forEach(u => { emailMap[u.id] = u.email; });
      setPerfiles(pr.map(p => ({
        ...p,
        email: p.email || emailMap[p.id] || "",
        cedula: p.cedula || (emailMap[p.id]||"").replace("@quimibuques.com",""),
      })));
    } catch(_) { setPerfiles(pr); }
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

  // ── IMPORTAR EXCEL VIAJES ──
  function leerExcelViajes(file) {
    setImportLoading(true);
    const reader = new FileReader();
    reader.onload = e => {
      setTimeout(() => { // cede el hilo para que el spinner aparezca antes del procesamiento
      try {

      const wb = XLSX.read(e.target.result, { type:"array", cellDates:true });
      const pestañas = wb.SheetNames.filter(n => {
        const u = n.toUpperCase();
        // Acepta hojas FLOTA o de producto blanco (MGO, DIESEL, DISEL, BLANCO)
        return u.includes("FLOTA") || u.includes("MGO") || u.includes("DIESEL") || u.includes("DISEL") || u.includes("BLANCO");
      });
      if (!pestañas.length) {
        // Si no coincide ningún nombre, intentar con todas las hojas que tengan encabezados conocidos
        pestañas.push(...wb.SheetNames);
      }

      const MAPA = {
        "N° GUIA":"guia","NUMERO DE GUIA":"guia","GUIA":"guia","N GUIA":"guia",
        "TRANSPORTADORA":"transportadora","EMPRESA":"transportadora",
        "PLACA":"placa","PLACA ":"placa","VEHICULO":"placa",
        "PRODUCTO":"producto","COMBUSTIBLE":"producto","TIPO DE PRODUCTO":"producto",
        "FECHA DE CARGUE":"fecha","FECHA CARGUE":"fecha",
        "FECHA APROX. DE LLEGADA":"fecha_aprox_llegada","FECHA APROX DE LLEGADA":"fecha_aprox_llegada",
        "GLS NETOS GUIA":"gls_netos_guia","GLS NETOS":"gls_netos_guia",
        "OBSERVACIÓN":"observacion","OBSERVACION":"observacion",
        "NOMBRE":"conductor","CONDUCTOR":"conductor",
        "CEDULA":"cedula","CEDULA ":"cedula",
        "FLETE":"flete","BONO":"bono",
        "BARRILES NSV":"barriles_nsv","STAND BY":"standby",
        "VOLUMEN":"volumen_guia","GALONES":"volumen_guia",
        // Columnas producto blanco
        "OPS":"ops",
        "PLANTA ORIGEN":"planta_origen","PLANTA DE ORIGEN":"planta_origen",
        "BODEGA O TANQUE DESCARGUE":"bodega_tanque","BODEGA TANQUE":"bodega_tanque","TANQUE DESCARGUE":"bodega_tanque",
        "FECHA DE DESCARGUE":"fecha_descargue","FECHA DESCARGUE":"fecha_descargue",
      };

      const todasFilas = [];
      pestañas.forEach(nombre => {
        const ws = wb.Sheets[nombre];
        const raw = XLSX.utils.sheet_to_json(ws, { header:1, defval:"" });
        // Buscar fila de encabezados: la que contenga al menos 2 palabras clave conocidas
        const KEYWORDS = ["PLACA","GUIA","GUÍA","TRANSPORTADORA","PRODUCTO","CONDUCTOR","FLETE","OPS","PLANTA ORIGEN"];
        let hdrIdx = raw.findIndex(r => {
          const cels = r.map(c=>String(c||"").trim().toUpperCase());
          return KEYWORDS.filter(k => cels.some(c=>c.includes(k))).length >= 2;
        });
        if (hdrIdx < 0) return;
        const hdrs = raw[hdrIdx].map(h => String(h||"").trim().toUpperCase());
        const mapIdx = {};
        hdrs.forEach((h,i) => { if (MAPA[h]) mapIdx[MAPA[h]] = i; });

        for (let i = hdrIdx+1; i < raw.length; i++) {
          const r = raw[i];
          if (r.every(c=>c===""||c===null)) continue;
          const get = campo => {
            const idx = mapIdx[campo];
            if (idx === undefined) return "";
            const v = r[idx];
            if (v === "" || v === null || v === undefined) return "";
            // Fechas Excel (número serial) → string YYYY-MM-DD
            if (campo.includes("fecha") || campo === "fecha") {
              if (v instanceof Date) return v.toISOString().slice(0,10);
              if (typeof v === "number") {
                const d = XLSX.SSF.parse_date_code(v);
                if (d) return `${d.y}-${String(d.m).padStart(2,"0")}-${String(d.d).padStart(2,"0")}`;
              }
            }
            return String(v).trim();
          };
          const placa = get("placa").toUpperCase();
          const transportadora = get("transportadora").toUpperCase();
          const prodRaw = get("producto").toUpperCase();
          const producto = prodRaw === "NACIONAL" ? "DIESEL NACIONAL" : prodRaw === "INTERNACIONAL" ? "DIESEL INTERNACIONAL" : prodRaw;
          if (!placa && !transportadora) continue;
          todasFilas.push({
            _pestaña: nombre,
            placa, transportadora, producto,
            guia: get("guia"),
            fecha: get("fecha") || today(),
            fecha_aprox_llegada: get("fecha_aprox_llegada"),
            gls_netos_guia: get("gls_netos_guia") ? Number(get("gls_netos_guia")) : 0,
            observacion: get("observacion"),
            conductor: get("conductor"),
            cedula: get("cedula"),
            flete: get("flete") ? Number(get("flete")) : 0,
            bono: get("bono") ? Number(get("bono")) : 0,
            barriles_nsv: get("barriles_nsv") ? Number(get("barriles_nsv")) : 0,
            standby: get("standby") ? Number(get("standby")) : 0,
            ops: get("ops"),
            planta_origen: get("planta_origen"),
            bodega_tanque: get("bodega_tanque"),
            fecha_descargue: get("fecha_descargue") || null,
          });
        }
      });

      if (!todasFilas.length) { setImportLoading(false); return showToast("No se encontraron filas con datos", false); }

      // Marcar duplicados por guía
      const guiasExistentes = new Set((viajes||[]).map(v=>v.guia).filter(Boolean));
      const preview = todasFilas.map(f => ({
        ...f,
        _duplicado: f.guia && guiasExistentes.has(f.guia),
      }));
      setImportLoading(false);
      setImportFechaDesde("");
      setImportExcel({ preview, pestañas });
      } catch(err) { setImportLoading(false); showToast("Error al leer el archivo: "+err.message, false); }
      }, 50); // fin setTimeout
    };
    reader.readAsArrayBuffer(file);
  }

  async function aplicarFechasFlota() {
    const viajesToUpdate = (viajes||[]).filter(v =>
      v.estado === "En Ruta" &&
      (!flotaFechaDesde || v.fecha >= flotaFechaDesde) &&
      (!flotaFechaHasta || v.fecha <= flotaFechaHasta) &&
      flotaDiasProducto[v.producto] > 0
    );
    if (!viajesToUpdate.length) return showToast("No hay viajes en ese rango con días configurados", false);
    setSaving(true);
    let ok = 0, err = 0;
    for (const v of viajesToUpdate) {
      const dias = Number(flotaDiasProducto[v.producto]||0);
      if (!dias) continue;
      const fechaLlegada = new Date(v.fecha);
      fechaLlegada.setDate(fechaLlegada.getDate() + dias);
      const fechaStr = fechaLlegada.toISOString().slice(0,10);
      const {error} = await dbCall({ table:"viajes", op:"update",
        data:{ fecha_aprox_llegada: fechaStr },
        filters:[{col:"id",val:v.id}] });
      if (error) err++; else ok++;
    }
    setSaving(false);
    await loadData();
    setFlotaFechaDesde(""); setFlotaFechaHasta("");
    showToast(`Fechas actualizadas: ${ok} viajes${err>0?` · ${err} errores`:""}`, err===0);
  }

  async function redirigirSedeFlota() {
    const viajesToUpdate = (viajes||[]).filter(v =>
      v.estado === "En Ruta" &&
      (!flotaRedirDesde || v.fecha >= flotaRedirDesde) &&
      (!flotaRedirHasta || v.fecha <= flotaRedirHasta) &&
      (!flotaRedirTrans || v.transportadora === flotaRedirTrans) &&
      (!flotaRedirProducto || v.producto === flotaRedirProducto) &&
      (!flotaRedirPlaca || (v.placa||"").toUpperCase().includes(flotaRedirPlaca.toUpperCase())) &&
      (!flotaRedirSedeActual || v.sede === flotaRedirSedeActual)
    );
    if (!viajesToUpdate.length) return showToast("No hay viajes en ese rango", false);
    setSaving(true);
    let ok = 0, err = 0;
    for (const v of viajesToUpdate) {
      const {error} = await dbCall({ table:"viajes", op:"update",
        data:{ sede: flotaRedirSede },
        filters:[{col:"id",val:v.id}] });
      if (error) err++; else ok++;
    }
    setSaving(false);
    await loadData();
    showToast(`Sede actualizada: ${ok} viajes → ${flotaRedirSede}${err>0?` · ${err} errores`:""}`, err===0);
  }

  async function modificarCampoFlota(viajesAModificar, campo, valor) {
    if (!campo || !valor) return;
    setSaving(true);
    let ok = 0, err = 0;
    for (const v of viajesAModificar) {
      const {error} = await dbCall({ table:"viajes", op:"update", data:{ [campo]: valor }, filters:[{col:"id",val:v.id}] });
      if (error) err++; else ok++;
    }
    setSaving(false);
    setFlotaEditCampo(""); setFlotaEditValor("");
    await loadData();
    showToast(`Modificados: ${ok} viajes${err>0?` · ${err} errores`:""}`, err===0);
  }

  async function eliminarViajesFlota(viajesAEliminar) {
    setSaving(true);
    let ok = 0, err = 0;
    for (const v of viajesAEliminar) {
      const {error} = await dbCall({ table:"viajes", op:"delete", filters:[{col:"id",val:v.id}] });
      if (error) err++; else ok++;
    }
    setSaving(false);
    setFlotaElimConfirm(false);
    setFlotaElimDesde(""); setFlotaElimHasta("");
    setFlotaElimTrans(""); setFlotaElimProducto(""); setFlotaElimPlaca("");
    await loadData();
    showToast(`Eliminados: ${ok} viajes${err>0?` · ${err} errores`:""}`, err===0);
  }

  async function confirmarImportExcel() {
    if (!importExcel) return;
    setSaving(true);
    const filas = importExcel.preview.filter(f => !f._duplicado && (!importFechaDesde || f.fecha >= importFechaDesde));
    let ok = 0, err = 0;
    // Calcular el número máximo actual para no colisionar IDs en el loop
    const maxVJ = (viajes||[]).reduce((max, v) => {
      const n = parseInt((v.id||"").replace("VJ-","")) || 0;
      return Math.max(max, n);
    }, 0);
    let nextVJ = maxVJ;
    for (const f of filas) {
      nextVJ++;
      const id = `VJ-${String(nextVJ).padStart(3,"0")}`;
      const { error } = await dbCall({ table:"viajes", op:"insert", data:{
        id, placa:f.placa, transportadora:f.transportadora, producto:f.producto,
        guia:f.guia||"", fecha:f.fecha, fecha_aprox_llegada:f.fecha_aprox_llegada||null,
        gls_netos_guia:f.gls_netos_guia||0, observacion:f.observacion||"",
        conductor:f.conductor||"", cedula:f.cedula||"",
        flete:f.flete||0, bono:f.bono||0, barriles_nsv:f.barriles_nsv||0,
        standby:f.standby||0, estado:"En Ruta", creado_por:session.user.id,
        sede:perfil.sede||"MALAMBO", planta:perfil.planta||"PLANTA 1",
        ops:f.ops||null, planta_origen:f.planta_origen||null,
        bodega_tanque:f.bodega_tanque||null, fecha_descargue:f.fecha_descargue||null,
      }});
      if (error) { err++; if (err===1) { setSaving(false); setImportExcel(null); showToast(`Error: ${error}`, false); return; } } else ok++;
    }
    setSaving(false);
    setImportExcel(null);
    await loadData();
    showToast(`Importados: ${ok} viajes${err>0?` · ${err} errores`:""}`, err===0);
  }

  // ── GUARDAR DATOS ──
  async function guardarViaje(e) {
    e.preventDefault(); setSaving(true);
    if (form.id) {
      const {error} = await dbCall({ table:"viajes", op:"update", data:{
        fecha:form.fecha, producto:form.producto, transportadora:form.transportadora,
        placa:form.placa, conductor:form.conductor, cedula:form.cedula,
        guia:form.guia, volumen_guia:Number(form.volumen_guia||0),
        planta:form.planta, standby:Number(form.standby||0), flete:Number(form.flete||0),
        bono:Number(form.bono||0), barriles_nsv:Number(form.barriles_nsv||0),
        gls_netos_guia:Number(form.gls_netos_guia||0), gls_recibidos:Number(form.gls_recibidos||0),
        fecha_llegada:form.fecha_llegada||null, fecha_aprox_llegada:form.fecha_aprox_llegada||null,
        fecha_descargue:form.fecha_descargue||null,
        ops:form.ops||null, planta_origen:form.planta_origen||null, bodega_tanque:form.bodega_tanque||null,
        valor_standby:Number(form.valor_standby||0), observacion:form.observacion||null,
      }, filters:[{col:"id",val:form.id}] });
      setSaving(false);
      if (error) return showToast("Error: "+error, false);
      await loadData();
      if (modal) { setModal(null); } else { closeTab(activeTabId); }
      setForm({});
      showToast(`Viaje ${form.id} actualizado`);
    } else {
      const id = genId("VJ", viajes);
      const {error} = await dbCall({ table:"viajes", op:"insert", data:{
        id, ...form, volumen_guia:Number(form.volumen_guia||0),
        standby:Number(form.standby||0), flete:Number(form.flete||0),
        bono:Number(form.bono||0), barriles_nsv:Number(form.barriles_nsv||0),
        gls_netos_guia:Number(form.gls_netos_guia||0), gls_recibidos:Number(form.gls_recibidos||0),
        valor_standby:Number(form.valor_standby||0), fecha_descargue:form.fecha_descargue||null,
        estado:"En Ruta", creado_por:session.user.id
      }});
      setSaving(false);
      if (error) return showToast("Error al guardar: "+error,false);
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
      tanque:form.tanque||null,
      ot_id:form.ot_id||null,
      autoriza:aprueba,
      autoriza_nombre:perfil.nombre,
      resultado:aprueba?"APROBADO":"RECHAZADO",
    };
    if (form.id) {
      const {error} = await dbCall({ table:"tiquetes", op:"update", data:campos, filters:[{col:"id",val:form.id}] });
      if (error) { setSaving(false); return showToast("Error: "+error, false); }
      if (form.viaje_id) {
        await dbCall({ table:"viajes", op:"update", data:{estado:aprueba?"En Planta":"Rechazado"}, filters:[{col:"id",val:form.viaje_id}] });
      }
      setSaving(false);
      await loadData(); setModal(null); setForm({});
      showToast(`Tiquete ${form.id} actualizado — ${aprueba?"APROBADO":"RECHAZADO"}`);
    } else {
      const {count: tqCount} = await supabase.from("tiquetes").select("id",{count:"exact",head:true});
      const id = `TQ-${String((tqCount||0)+1+19571).padStart(5,"0")}`;
      const {error} = await dbCall({ table:"tiquetes", op:"insert", data:{ id, ...campos, creado_por:session.user.id } });
      if (!error && form.viaje_id) {
        await dbCall({ table:"viajes", op:"update", data:{estado:aprueba?"En Planta":"Rechazado", tiquete_id:id}, filters:[{col:"id",val:form.viaje_id}] });
      }
      if (!error && form.ot_id) {
        await dbCall({ table:"ordenes_trabajo", op:"update", data:{estado:"ANALIZADA", tiquete_id:id, updated_at:new Date().toISOString()}, filters:[{col:"id",val:form.ot_id}] });
      }
      setSaving(false);
      if (error) return showToast("Error: "+error,false);
      await loadData(); setModal(null); setForm({});
      showToast(aprueba?"Tiquete emitido — APROBADO ✔":"Tiquete emitido — RECHAZADO",aprueba);
    }
  }

  async function guardarPBS(e) {
    e.preventDefault(); setSaving(true);
    if (form.id) {
      const {error} = await dbCall({ table:"pbs", op:"update", data:{ ...form, checklist:pbsChecklist }, filters:[{col:"id",val:form.id}] });
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
      const {error} = await dbCall({ table:"pbs", op:"insert", data:{
        id, ...form, checklist:pbsChecklist, fecha:today(),
        firma_auxiliar:perfil.nombre, creado_por:session.user.id
      }});
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
  // Buscar coincidencia exacta primero
  let galonesB = null;
  const {data:exact} = await supabase.from("aforo").select("galones_brutos").eq("tanque",tanque).eq("ullage_mm",ullageNum).maybeSingle();
  if (exact) {
    galonesB = Number(exact.galones_brutos);
  } else {
    // Interpolación: buscar el punto inferior y superior
    const [{data:below},{data:above}] = await Promise.all([
      supabase.from("aforo").select("ullage_mm,galones_brutos").eq("tanque",tanque).lt("ullage_mm",ullageNum).order("ullage_mm",{ascending:false}).limit(1).maybeSingle(),
      supabase.from("aforo").select("ullage_mm,galones_brutos").eq("tanque",tanque).gt("ullage_mm",ullageNum).order("ullage_mm",{ascending:true}).limit(1).maybeSingle(),
    ]);
    if (below && above) {
      const ratio = (ullageNum - below.ullage_mm) / (above.ullage_mm - below.ullage_mm);
      galonesB = Number(below.galones_brutos) + ratio * (Number(above.galones_brutos) - Number(below.galones_brutos));
    } else if (below) {
      galonesB = Number(below.galones_brutos);
    } else if (above) {
      galonesB = Number(above.galones_brutos);
    }
  }
  // Fallback: tablas embebidas de Planta 1 (barcaza QBS-002)
  if (galonesB === null) {
    const glsP1 = calcularGalonesP1(tanque, ullageNum, api, temp);
    if (glsP1 !== null) {
      setter(prev => prev.map((r,j) => j===index ? {...r, [campoGalones]: glsP1} : r));
    }
    return;
  }
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
  function abrirCmtDesdeOt(ot, productoBase) {
    const sedeActual = ot.sede || perfil?.sede || "MALAMBO";
    const plantaActual = sedeActual === "MALAMBO" ? (perfil?.planta || "PLANTA 1") : "";
    const tanquesOT = [...new Set([
      ot.tanque_destino,
      ...(ot.trasiegos||[]).map(t=>t.origen),
      ...(ot.trasiegos||[]).map(t=>t.destino),
    ].filter(Boolean))];
    setForm({
      ot_id: ot.id,
      ot_numero: ot.numero_ot,
      bloqueado_ot: true,
      sede: sedeActual,
      planta: plantaActual,
      fecha: today(),
      tipo_operacion: "DESCARGUE DE CARROTANQUE",
      tanques_ot: tanquesOT,
    });
    setCmtProducto(productoBase || "");
    setCmtDespues([{tanque: ot.tanque_destino||"", producto: productoBase||"", sonda:"", galones:""}]);
    setCmtCarros([{placa:"", guia:"", tiquete:"", pbs_id:""}]);
    setCmtAntes([{tanque:"", sonda:"", galones:""}]);
    setModal("cmt");
  }

  async function handleConfirmarVinculacionOT(ot_id, ot_numero) {
    if (ot_id) {
      await dbCall({ table:"cmts", op:"update", data:{ot_id, ot_numero}, filters:[{col:"id",val:modalVinculacionOT.cmtId}] });
    }
    await loadData();
    const num = modalVinculacionOT.cmtNumero;
    setModalVinculacionOT({mostrar:false, cmtId:null, cmtNumero:null});
    setOtVincSeleccionada("");
    setForm({});
    setCmtAntes([{tanque:"",sonda:"",galones:""}]); setCmtProducto("");
    setCmtCarros([{placa:"",guia:"",tiquete:"",pbs_id:""}]);
    setCmtDespues([{tanque:"",producto:"",sonda:"",galones:""}]);
    setCmtRecepcion([{tanque:"",sondaInicial:"",tempInicial:"",apiInicial:"",galonesInicial:"",sondaFinal:"",tempFinal:"",apiFinal:"",galonesFinal:""}]);
    showToast(ot_id ? `CMT${num} vinculado a ${ot_numero}` : `CMT${num} guardado como autónomo`);
  }

  async function aplicarTanquesDesdeCMT(cmt) {
    const tipoOp = (cmt.tipo_operacion||"");
    for (const td of cmt.tanques_despues||[]) {
      if (!td.tanque || !td.galones) continue;
      await dbCall({ table:"tanques", op:"update", data:{ nivel: Math.max(0, Number(td.galones)) }, filters:[{col:"id",val:td.tanque}] });
    }
    const deltaOrigen = tipoOp === "TRASIEGO DE PRODUCTO"
      ? (cmt.tanques_antes||[]).reduce((s,ta,i) => {
          const td = (cmt.tanques_despues||[])[i];
          return s + Math.max(0, Number(ta.galones||0) - Number(td?.galones||0));
        }, 0)
      : 0;
    for (const tr of cmt.tanques_recepcion||[]) {
      if (!tr.tanque) continue;
      if (tr.galonesFinal) {
        await dbCall({ table:"tanques", op:"update", data:{ nivel: Math.max(0, Number(tr.galonesFinal)) }, filters:[{col:"id",val:tr.tanque}] });
      } else if (deltaOrigen > 0) {
        const {data: tqDB} = await dbCall({ table:"tanques", op:"select", select:"nivel", filters:[{col:"id",val:tr.tanque}], single:true });
        if (tqDB) await dbCall({ table:"tanques", op:"update", data:{ nivel: Math.max(0, Number(tqDB.nivel||0) + deltaOrigen) }, filters:[{col:"id",val:tr.tanque}] });
      }
    }
    for (const td of cmt.porteo_descarga_tanques||[]) {
      if (!td.tanque || !td.galonesFinal) continue;
      const upd = { nivel: Math.max(0, Number(td.galonesFinal)) };
      if (cmt.producto) upd.producto = cmt.producto;
      await dbCall({ table:"tanques", op:"update", data:upd, filters:[{col:"id",val:td.tanque}] });
    }
    for (const tc of cmt.porteo_carga_tanques||[]) {
      if (!tc.tanque || !tc.galonesFinal) continue;
      await dbCall({ table:"tanques", op:"update", data:{ nivel: Math.max(0, Number(tc.galonesFinal)) }, filters:[{col:"id",val:tc.tanque}] });
    }
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
    const totalMovido = tipoOp==="PORTEO"
      ? cmtPorteoDescarga.reduce((a,r)=>a+Math.max(0,Number(r.galonesFinal||0)-Number(r.galonesInicial||0)),0)
      : totalDespues - totalAntes;
    if (!form.id && tipoOp !== "TRASIEGO DE PRODUCTO" && tipoOp !== "PORTEO" && totalMovido<=0) { setSaving(false); return showToast("El total después debe ser mayor que antes",false); }

    // Calcular y persistir galones_bascula en carros de TODOS los tipos antes de guardar
    const carrosConGls = cmtCarros.map(carro => {
      const tq = tiquetes.find(t => t.id === carro.tiquete);
      const factor = Number(tq?.factor_tabla13 || 0);
      const pesoNeto = Number(carro.peso_neto||0) || Math.max(0, Number(carro.peso_ingreso||0)-Number(carro.peso_salida||0));
      const glsCalc = factor>0 && pesoNeto>0 ? Math.round(pesoNeto/factor) : "";
      return glsCalc ? {...carro, galones_bascula: glsCalc} : carro;
    });
    const porteoCarrosConGls = tipoOp==="PORTEO" ? (() => {
      const factorApi = cmtPorteoCarga.map(r=>Number(r.apiInicial||r.apiFinal||0)).find(a=>a>0) || 0;
      const factor = factorApi>0 ? Number(tabla13Factor(factorApi)||0) : 0;
      return cmtPorteoCarros.map(cr => {
        if (Number(cr.peso_salida)>0 && factor>0) {
          const pn = Number(cr.peso_ingreso||0)-Number(cr.peso_salida);
          return {...cr, galones_bascula: pn>0 ? Math.round(pn/factor) : (cr.galones_bascula||"")};
        }
        return cr;
      });
    })() : cmtPorteoCarros;

    // Validar pbs_id: si no existe en pbsList, crearlo automáticamente para evitar FK violation
    let pbsIdValidado = null;
    if (form.pbs_id) {
      const {data: pbsExiste} = await dbCall({ table:"pbs", op:"select", select:"id", filters:[{col:"id",val:form.pbs_id}], single:true });
      if (!pbsExiste) {
        const {error: pbsErr} = await dbCall({ table:"pbs", op:"insert", data:{
          id: form.pbs_id, fecha: form.fecha||today(),
          creado_por: session.user.id, firma_auxiliar: perfil.nombre,
          checklist: Array(26).fill(""),
        }});
        if (pbsErr && !pbsErr.includes("23505")) {
          setSaving(false);
          return showToast("Error al registrar PBS: " + pbsErr, false);
        }
      }
      pbsIdValidado = form.pbs_id;
    }

    if (form.id) {
      // EDICIÓN: revertir impacto original y aplicar nuevo
      const original = cmts.find(c=>c.id===form.id);
      const {error} = await dbCall({ table:"cmts", op:"update", data:{
        numero_cmt:form.numero_cmt, pbs_id:pbsIdValidado,
        tiquete_entrada:form.tiquete_entrada||null, producto:cmtProducto,
        tipo_operacion:form.tipo_operacion, tanques_antes:cmtAntes,
        tanques_despues:cmtDespues, tanques_recepcion:cmtRecepcion, total_antes:totalAntes,
        total_despues:totalDespues, total_movido:totalMovido,
        sede:form.sede||"", planta:form.planta||"", operador:form.operador||"",
        placa:form.placa||"", carros:carrosConGls, guia:form.guia||"",
        nombre_motonave:form.nombre_motonave||"",
        peso_neto_salida:form.peso_neto_salida||"",
        porteo_carga_planta:cmtPorteoCargaPlanta||null,
        porteo_descarga_planta:cmtPorteoDescargaPlanta||null,
        porteo_carga_tanques:cmtPorteoCarga,
        porteo_descarga_tanques:cmtPorteoDescarga,
        porteo_carros:porteoCarrosConGls,
      }, filters:[{col:"id",val:form.id}] });
      if (!error && original) {
        // Recolectar todos los tanques afectados y calcular ajuste neto
        const ajustesPorTanque = {};
        const acumular = (id, delta) => { if (id) ajustesPorTanque[id] = (ajustesPorTanque[id]||0) + delta; };

        // CMT normal: delta = (nuevo despues - nuevo antes) - (orig despues - orig antes)
        const tanquesAfectados = new Set([
          ...(original.tanques_despues||[]).map(t=>t.tanque),
          ...cmtDespues.map(t=>t.tanque),
        ].filter(Boolean));
        for (const id of tanquesAfectados) {
          const origA = (original.tanques_antes||[]).find(t=>t.tanque===id);
          const origD = (original.tanques_despues||[]).find(t=>t.tanque===id);
          const nuevoA = cmtAntes.find(t=>t.tanque===id);
          const nuevoD = cmtDespues.find(t=>t.tanque===id);
          const ajuste = (Number(nuevoD?.galones||0)-Number(nuevoA?.galones||0)) - (Number(origD?.galones||0)-Number(origA?.galones||0));
          acumular(id, ajuste);
        }
        // Recepción: ajuste neto en tanques destino via galonesFinal
        const recepcionTqIds = new Set([
          ...(original.tanques_recepcion||[]).map(t=>t.tanque),
          ...cmtRecepcion.map(t=>t.tanque),
        ].filter(Boolean));
        for (const id of recepcionTqIds) {
          const oR = (original.tanques_recepcion||[]).find(t=>t.tanque===id);
          const nR = cmtRecepcion.find(t=>t.tanque===id);
          const ajuste = Number(nR?.galonesFinal||0) - Number(oR?.galonesFinal||0);
          acumular(id, ajuste);
        }
        // PORTEO: galonesFinal es lectura absoluta de sonda — actualizar nivel directo, no como delta
        const porteoAbsolutos = {}; // tankId -> nuevo nivel absoluto
        for (const td of cmtPorteoDescarga) {
          if (td.tanque && td.galonesFinal) porteoAbsolutos[td.tanque] = Math.max(0, Number(td.galonesFinal));
        }
        for (const tc of cmtPorteoCarga) {
          if (tc.tanque && tc.galonesFinal) porteoAbsolutos[tc.tanque] = Math.max(0, Number(tc.galonesFinal));
        }
        // Aplicar ajustes de tanques normales (delta) leyendo nivel actual desde DB
        const idsAfectados = Object.keys(ajustesPorTanque).filter(id => ajustesPorTanque[id] !== 0);
        if (idsAfectados.length > 0) {
          const { data: tqsActuales } = await dbCall({ table:"tanques", op:"select", select:"id,nivel", filters:[] });
          for (const tq of (tqsActuales||[]).filter(t=>idsAfectados.includes(t.id))) {
            const nuevoNivel = Math.max(0, Number(tq.nivel||0) + ajustesPorTanque[tq.id]);
            await dbCall({ table:"tanques", op:"update", data:{ nivel: nuevoNivel }, filters:[{col:"id",val:tq.id}] });
          }
        }
        // Aplicar niveles absolutos de porteo
        for (const [id, nivel] of Object.entries(porteoAbsolutos)) {
          await dbCall({ table:"tanques", op:"update", data:{ nivel }, filters:[{col:"id",val:id}] });
        }
        const placasCarros = cmtCarros.map(c=>c.placa).filter(Boolean);
        if (placasCarros.length > 0) {
          for (const placa of placasCarros) await dbCall({ table:"viajes", op:"update", data:{estado:"Descargado"}, filters:[{col:"placa",val:placa}] });
        } else if (form.placa) {
          await dbCall({ table:"viajes", op:"update", data:{estado:"Descargado"}, filters:[{col:"placa",val:form.placa}] });
        }
      }
      setSaving(false);
      if (error) return showToast("Error: "+error.message,false);
      await logAudit({ tabla:"cmts", registro_id:form.id, accion:"editar", datos_antes:{ numero_cmt:original?.numero_cmt, tipo_operacion:original?.tipo_operacion, fecha:original?.fecha }, datos_despues:{ numero_cmt:form.numero_cmt, tipo_operacion:form.tipo_operacion, fecha:form.fecha } });
      // Refrescar cmts de forma independiente para evitar que fallas en otras tablas dejen datos viejos
      const {data: freshCmts} = await supabase.from("cmts").select("*").order("created_at",{ascending:false});
      if (freshCmts) setCmts(freshCmts);
      loadData().catch(()=>{});
      setModal(null); setForm({});
      setCmtAntes([{tanque:"",sonda:"",galones:""}]); setCmtProducto("");
      setCmtCarros([{placa:"",guia:"",tiquete:"",pbs_id:""}]);
      setCmtDespues([{tanque:"",producto:"",sonda:"",galones:""}]);
      setCmtRecepcion([{tanque:"",sondaInicial:"",tempInicial:"",apiInicial:"",galonesInicial:"",sondaFinal:"",tempFinal:"",apiFinal:"",galonesFinal:""}]);
      setCmtPorteoCargaPlanta(""); setCmtPorteoDescargaPlanta("");
      setCmtPorteoCarga([{tanque:"",sondaInicial:"",tempInicial:"",apiInicial:"",galonesInicial:"",sondaFinal:"",tempFinal:"",apiFinal:"",galonesFinal:""}]);
      setCmtPorteoDescarga([{tanque:"",sondaInicial:"",tempInicial:"",apiInicial:"",galonesInicial:"",sondaFinal:"",tempFinal:"",apiFinal:"",galonesFinal:""}]);
      setCmtPorteoCarros([{placa:"",transportadora:"",hora_inicio_cargue:"",hora_final_cargue:"",numero_pbs:"",galones_contador:"",peso_ingreso:"",peso_salida:"",galones_bascula:""}]);
      showToast(`CMT ${form.numero_cmt} corregido — ${fmt(totalMovido)} Gls`);
    } else {
      const sedeActual = form.sede || perfil.sede || "MALAMBO";
      let plantaActual = sedeActual === "MALAMBO" ? (form.planta || perfil.planta || "PLANTA 1") : "";
      if (sedeActual === "MALAMBO") {
        const tanqueOrigen = tipoOp === "TRASIEGO DE PRODUCTO" ? cmtAntes[0]?.tanque
          : tipoOp === "PORTEO" ? (cmtPorteoCarga[0]?.tanque || "")
          : cmtDespues[0]?.tanque;
        if (tanqueOrigen) {
          if (tanqueOrigen.startsWith("TK-")) plantaActual = "PLANTA 2";
          else if (tanqueOrigen.startsWith("QBS002-") || tanqueOrigen.startsWith("TKT-")) plantaActual = "PLANTA 1";
        }
      }
      const {data: cmtsFrescos} = await supabase.from("cmts").select("numero_cmt").order("created_at",{ascending:false});
      const numeroCmt = genIdCMT(cmtsFrescos||cmts, sedeActual, plantaActual);
      const id = `${numeroCmt}`;
      const {error} = await dbCall({ table:"cmts", op:"insert", data:{
        id, numero_cmt:numeroCmt, pbs_id:pbsIdValidado,
        ot_id:form.ot_id||otContextRef.current.ot_id||null, ot_numero:form.ot_numero||otContextRef.current.ot_numero||null,
        tiquete_entrada:form.tiquete_entrada||null, fecha:form.fecha||today(),
        producto:cmtProducto,
        tipo_operacion:form.tipo_operacion, tanques_antes:cmtAntes,
        tanques_despues:cmtDespues, tanques_recepcion:cmtRecepcion, total_antes:totalAntes,
        total_despues:totalDespues, total_movido:totalMovido,
        sede:sedeActual, planta:plantaActual,
        placa:form.placa||"", carros:carrosConGls, guia:form.guia||"",
        nombre_motonave:form.nombre_motonave||"",
        peso_neto_salida:form.peso_neto_salida||"",
        porteo_carga_planta:cmtPorteoCargaPlanta||null,
        porteo_descarga_planta:cmtPorteoDescargaPlanta||null,
        porteo_carga_tanques:cmtPorteoCarga,
        porteo_descarga_tanques:cmtPorteoDescarga,
        porteo_carros:porteoCarrosConGls,
        operador:perfil.nombre, creado_por:session.user.id
      }});
      if (!error) {
        const {data: cmtGuardado} = await dbCall({ table:"cmts", op:"select", filters:[{col:"id",val:id}], single:true });
        if (cmtGuardado) await aplicarTanquesDesdeCMT(cmtGuardado);
        await logAudit({ tabla:"cmts", registro_id:id, accion:"crear", datos_despues:{ numero_cmt:form.numero_cmt, tipo_operacion:form.tipo_operacion, fecha:form.fecha } });
        const placasCarros = cmtCarros.map(c=>c.placa).filter(Boolean);
        if (placasCarros.length > 0) {
          for (const placa of placasCarros) await dbCall({ table:"viajes", op:"update", data:{estado:"Descargado"}, filters:[{col:"placa",val:placa}] });
        } else if (form.placa) {
          await dbCall({ table:"viajes", op:"update", data:{estado:"Descargado"}, filters:[{col:"placa",val:form.placa}] });
        }
      }
      setSaving(false);
      if (error) return showToast("Error: "+error.message,false);
      await loadData();
      const otIdUsado = form.ot_id || otContextRef.current.ot_id;
      otContextRef.current = {ot_id:null, ot_numero:null};
      if (otIdUsado) {
        // CMT de porteo: no auto-marcar trasiegos; el usuario avanza la OT desde el detalle
        // Vino desde OT → cerrar directo
        setModal(null); setForm({});
        setCmtAntes([{tanque:"",sonda:"",galones:""}]); setCmtProducto("");
        setCmtCarros([{placa:"",guia:"",tiquete:"",pbs_id:""}]);
        setCmtDespues([{tanque:"",producto:"",sonda:"",galones:""}]);
        setCmtRecepcion([{tanque:"",sondaInicial:"",tempInicial:"",apiInicial:"",galonesInicial:"",sondaFinal:"",tempFinal:"",apiFinal:"",galonesFinal:""}]);
        setCmtPorteoCargaPlanta(""); setCmtPorteoDescargaPlanta("");
        setCmtPorteoCarga([{tanque:"",sondaInicial:"",tempInicial:"",apiInicial:"",galonesInicial:"",sondaFinal:"",tempFinal:"",apiFinal:"",galonesFinal:""}]);
        setCmtPorteoDescarga([{tanque:"",sondaInicial:"",tempInicial:"",apiInicial:"",galonesInicial:"",sondaFinal:"",tempFinal:"",apiFinal:"",galonesFinal:""}]);
        setCmtPorteoCarros([{placa:"",transportadora:"",hora_inicio_cargue:"",hora_final_cargue:"",numero_pbs:"",galones_contador:"",peso_ingreso:"",peso_salida:"",galones_bascula:""}]);
        showToast(`CMT${numeroCmt} vinculado a ${form.ot_numero||otContextRef.current?.ot_numero||"OT"}`);
      } else {
        // CMT autónomo → preguntar si vincular a OT
        setModal(null);
        setModalVinculacionOT({mostrar:true, cmtId:id, cmtNumero:numeroCmt});
      }
    }
  }

  async function guardarDespacho(e) {
    e.preventDefault(); setSaving(true);
    if (!form.buque) { setSaving(false); return showToast("El nombre del buque es obligatorio", false); }
    const vlso=Number(form.mt_vlso||0), hsfo=Number(form.mt_hsfo||0), mgo=Number(form.mt_mgo||0);
    const productoDerivado = [["VLSO",vlso],["HSFO",hsfo],["MGO",mgo]].sort((a,b)=>b[1]-a[1])[0][1]>0
      ? [["VLSO",vlso],["HSFO",hsfo],["MGO",mgo]].filter(([,v])=>v>0).map(([p])=>p).join("/")
      : "BUNKERS";
    const campos = {
      buque: form.buque||"", imo: form.imo||"", bandera: form.bandera||"",
      eta: form.eta||"", agencia: form.agencia||"", etd: form.etd||"",
      mt_vlso: vlso, mt_hsfo: hsfo, mt_mgo: mgo,
      producto: productoDerivado,
      volumen: vlso + hsfo + mgo,
      destino: form.destino||"", horas_op: Number(form.horas_op||0),
      contrato: form.contrato||"", ciudad: form.ciudad||perfil.sede||"MALAMBO",
      estado: form.estado||"PENDIENTE",
      operador: perfil.nombre, creado_por: session.user.id,
    };
    if (form.id) {
      const {error} = await dbCall({ table:"despachos", op:"update", data:campos, filters:[{col:"id",val:form.id}] });
      setSaving(false);
      if (error) return showToast("Error: "+error, false);
      await loadData(); setModal(null); setForm({});
      showToast(`Despacho ${form.id} actualizado`);
    } else {
      const num = String((despachos||[]).length + 1).padStart(5, "0");
      const id = `DESP-${num}`;
      const {error} = await dbCall({ table:"despachos", op:"insert", data:{ id, fecha: form.fecha||today(), ...campos } });
      setSaving(false);
      if (error) return showToast("Error: "+error, false);
      await loadData(); setModal(null); setForm({});
      showToast(`Despacho ${id} registrado — ${form.buque}`);
    }
  }

  // ── LOADING ──
  if (loading) return (
    <div style={{ minHeight:"100vh", background:"#121212", display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div style={{ textAlign:"center" }}>
        <img src="/logo.svg" alt="BunkersGest" style={{ width:220, height:"auto", display:"block", margin:"0 auto" }}/>
        <div style={{ marginTop:18, fontWeight:900, fontSize:28, fontFamily:"Arial Black, system-ui, sans-serif", letterSpacing:1 }}>
          <span style={{ color:"#ffffff" }}>Bunkers</span><span style={{ color:T.orange }}>Gest</span>
        </div>
        <div style={{ color:"#ffffff55", fontSize:11, letterSpacing:3, textTransform:"uppercase", marginTop:8 }}>Cargando...</div>
      </div>
    </div>
  );

  // ── LOGIN / REGISTRO ──
  if (!session) return (
    <div style={{ minHeight:"100vh", background:"#121212", display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div style={{ width:420, background:"#1c1c1c", borderRadius:14, overflow:"hidden", boxShadow:"0 24px 64px rgba(0,0,0,0.6)", border:`1px solid #2a2a2a` }}>
        {/* Cabecera con logo */}
        <div style={{ background:"#121212", borderBottom:`3px solid ${T.orange}`, padding:"28px 32px", textAlign:"center" }}>
          <img src="/logo.svg" alt="BunkersGest" style={{ width:110, height:"auto", display:"block", margin:"0 auto 12px" }}/>
          <div style={{ fontWeight:900, fontSize:22, fontFamily:"Arial Black, system-ui, sans-serif", letterSpacing:1 }}>
            <span style={{ color:"#ffffff" }}>Bunkers</span><span style={{ color:T.orange }}>Gest</span>
          </div>
          <div style={{ fontSize:10, color:"#ffffff55", marginTop:5, letterSpacing:3, textTransform:"uppercase" }}>Sistema de Gestión Operativa · Combustible Marino</div>
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
    <div style={{ minHeight:"100vh", background:"#121212", display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div style={{ color:"#ffffff55", fontSize:13 }}>Cargando perfil...</div>
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
  const ALL_MODULOS = ["dashboard","viajes","tiquetes","pbs","tanques","despacho","trazabilidad","programacion","usuarios","liquidador","inventario_diario"];
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
  const pendTiquetes = viajesFiltrados.filter(v=>v.estado==="En Planta"&&!v.tiquete_id).length + (ordenesTrabaio||[]).filter(o=>o.estado==="COMPLETADA").length;
  const pendPBS = tiquetesFiltrados.filter(t=>t.resultado==="APROBADO"&&!pbsList.find(p=>p.viaje_id===t.viaje_id)).length;
  const pendCMT = pbsList.filter(p=>!cmtsFiltrados.find(c=>c.pbs_id===p.id)).length;

  return (
    <div style={{ fontFamily:"system-ui,sans-serif", background:T.bg, height:"100vh", overflow:"hidden", display:"flex", flexDirection:"column", color:T.text }}>
      <style>{`html,body{margin:0;padding:0;overflow:hidden;height:100%} @keyframes spin{to{transform:rotate(360deg)}} @keyframes fadeSlideIn{from{opacity:0;transform:translateX(-8px)}to{opacity:1;transform:translateX(0)}}`}</style>

      {toast && <div style={{ position:"fixed", top:18, right:18, zIndex:9999, background:toast.ok?T.success:T.danger, borderRadius:8, padding:"12px 20px", color:"#ffffff", fontSize:13, fontWeight:700, boxShadow:"0 4px 16px rgba(0,0,0,0.25)", maxWidth:360 }}>{toast.msg}</div>}

      {/* Header */}
      <div style={{ background:T.text, borderBottom:`3px solid ${T.orange}`, padding:"0 20px", height:68, display:"flex", alignItems:"center", justifyContent:"space-between", flexShrink:0, boxShadow:"0 2px 8px rgba(0,0,0,0.08)" }}>
        <div style={{ display:"flex", alignItems:"center", gap:0 }}>
          {/* Logo barcos */}
          <img src="/logo.svg" alt="BunkersGest" style={{ height:52, width:"auto", display:"block", flexShrink:0, position:"relative", left:0, top:-6 }}/>
          {/* Separador vertical */}
          <div style={{ width:2, height:44, background:T.orange, borderRadius:2, margin:"0 18px", flexShrink:0 }}/>
          <div>
            <div style={{ fontWeight:900, fontSize:22, letterSpacing:0.5, lineHeight:1.1, fontFamily:"Arial Black, system-ui, sans-serif" }}>
              <span style={{ color:"#ffffff" }}>Bunkers</span><span style={{ color:T.orange }}>Gest</span>
            </div>
            <div style={{ fontSize:9, color:"#aab4be", letterSpacing:2, textTransform:"uppercase", marginTop:3 }}>Sistema de Gestión Operativa de Combustible Marino</div>
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
        <div style={{ width:58, background:"#121212", borderRight:`1px solid rgba(0,119,204,0.2)`, padding:"10px 0", flexShrink:0, display:"flex", flexDirection:"column", alignItems:"center", gap:2, zIndex:100, overflow:"visible" }}>
          {(()=>{
            const GRUPOS = {
              viajes:       { icon:"🚛", label:"LOGÍSTICA",     subs:[{id:"viajes",label:"Listado Tránsito"},{id:"listado_planta",label:"Listado Planta"}] },
              despacho:     { icon:"🚢", label:"DESPACHO",      subs:[{id:"despacho",label:"Listado Buques"},{id:"despacho_entrega",label:"Entrega"},{id:"despacho_historial",label:"Historial"}] },
              tiquetes:     { icon:"🧪", label:"LABORATORIO",   subs:[{id:"tiquetes",label:"Análisis",badge:pendTiquetes},{id:"resultados",label:"Resultados"}] },
              pbs:          { icon:"⚙️", label:"OPERACIONES",   subs:[{id:"ot_ops",label:"Órdenes de Trabajo",badge:(ordenesTrabaio||[]).filter(o=>!["COMPLETADA","RECHAZADA","ANALIZADA"].includes(o.estado)).length||null},{id:"cmt",label:"CMT"},{id:"inventario_diario",label:"Inventario Diario"}] },
              programacion: { icon:"📅", label:"PROGRAMACIÓN",  subs: perfil?.rol==="operaciones" ? [{id:"programacion",label:"Órdenes de Trabajo"}] : [{id:"programacion",label:"Órdenes de Trabajo"},{id:"formulaciones",label:"Formulaciones"}] },
              liquidador:   { icon:"🔢", label:"LIQUIDADOR",    subs:[{id:"liquidador",label:"Planta 1"},{id:"liquidador_p2",label:"Planta 2"}] },
              tanques:      { icon:"🛢", label:"TANQUES",        subs:[{id:"tanques",label:"Planta 2 (TK-111–117)"},{id:"tanques_p1",label:"Planta 1 — QBS002"}] },
            };
            const badges = {};

            const btnStyle = (active, isHov, color) => ({
              width:42, height:42, border:"none", borderRadius:8, cursor:"pointer",
              display:"flex", alignItems:"center", justifyContent:"center", fontSize:18,
              transition:"background 0.18s cubic-bezier(.23,1,.32,1), color 0.18s cubic-bezier(.23,1,.32,1), box-shadow 0.18s cubic-bezier(.23,1,.32,1)",
              background: active ? T.orange : isHov ? "rgba(0,119,204,0.22)" : "transparent",
              boxShadow: active ? `0 2px 12px ${T.orange}55` : isHov ? "0 2px 10px rgba(0,119,204,0.25)" : "none",
              color: active ? "#ffffff" : isHov ? "#60b4ff" : "rgba(255,255,255,0.45)",
              position:"relative", outline:"none",
            });

            const flyoutBase = {
              position:"absolute", left:"100%", top:"-4px",
              paddingLeft:6, zIndex:9999, pointerEvents:"auto",
            };
            const flyoutInner = {
              background:"#121212",
              border:`1px solid rgba(255,255,255,0.1)`,
              borderLeft:`3px solid ${T.orange}`,
              borderRadius:"0 8px 8px 0",
              padding:"6px 0", minWidth:200,
              boxShadow:"8px 8px 32px rgba(0,0,0,0.4)",
            };

            const tooltipBase = {
              position:"absolute", left:"100%", top:"50%",
              paddingLeft:8, zIndex:9999, pointerEvents:"none",
            };
            const tooltipInner = {
              background:"#001f47", border:`1px solid rgba(0,119,204,0.25)`, borderRadius:6,
              padding:"5px 12px", fontSize:11, color:"#ffffff",
              whiteSpace:"nowrap", boxShadow:"4px 4px 16px rgba(0,0,0,0.3)",
              transform:"translateY(-50%)",
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
                    <motion.button
                      style={{...btnStyle(active, isHov, rol.color)}}
                      whileHover={{ scale: 1.12 }}
                      whileTap={{ scale: 0.93 }}
                      transition={{ type:"spring", stiffness:400, damping:22 }}>
                      <NavIcon id={id} size={17}/>
                    </motion.button>
                    <AnimatePresence>
                      {isHov && (
                        <motion.div
                          key="flyout"
                          initial={{ opacity:0, x:-10 }}
                          animate={{ opacity:1, x:0 }}
                          exit={{ opacity:0, x:-10 }}
                          transition={{ duration:0.18, ease:[0.23,1,0.32,1] }}
                          style={flyoutBase} onMouseEnter={()=>onEnter(id)} onMouseLeave={onLeave}>
                          <div style={{...flyoutInner, borderLeftColor: rol.color+"88"}}>
                            <div style={{padding:"8px 16px 8px",fontSize:10,color:T.orange,fontWeight:800,letterSpacing:2,textTransform:"uppercase",borderBottom:"1px solid rgba(255,255,255,0.08)",marginBottom:4}}>{grupo.label}</div>
                            {grupo.subs.map((sub,si)=>{
                              const subActive = nav===sub.id;
                              return (
                                <motion.button key={sub.id}
                                  initial={{ opacity:0, x:-6 }}
                                  animate={{ opacity:1, x:0 }}
                                  transition={{ delay: si*0.04, duration:0.14, ease:"easeOut" }}
                                  onClick={()=>{setNav(sub.id);setNavHovered(null);setAnalisisNav("");}}
                                  style={{width:"100%",textAlign:"left",background:subActive?T.orange:"transparent",border:"none",borderLeft:`3px solid ${subActive?T.orange:"transparent"}`,padding:"9px 16px",color:subActive?"#ffffff":"rgba(255,255,255,0.65)",fontSize:12,fontFamily:"system-ui,sans-serif",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"space-between",transition:"background 0.15s, color 0.15s",boxSizing:"border-box",fontWeight:subActive?700:400}}
                                  onMouseEnter={e=>{ if(!subActive){e.currentTarget.style.background="rgba(0,119,204,0.18)"; e.currentTarget.style.color="#ffffff";} }}
                                  onMouseLeave={e=>{ if(!subActive){e.currentTarget.style.background="transparent"; e.currentTarget.style.color="rgba(255,255,255,0.65)";} }}>
                                  <span>{sub.label}</span>
                                  {sub.badge>0&&<span style={{background:T.danger,color:"#fff",fontSize:9,fontWeight:700,borderRadius:10,padding:"1px 6px"}}>{sub.badge}</span>}
                                </motion.button>
                              );
                            })}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
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
                  <motion.button onClick={()=>setNav(id)} style={btnStyle(active, isHov, rol.color)}
                    whileHover={{ scale: 1.12 }}
                    whileTap={{ scale: 0.93 }}
                    transition={{ type:"spring", stiffness:400, damping:22 }}>
                    {ICON_MAP[id] ? <NavIcon id={id} size={17}/> : m.icon}
                    {badge>0&&<span style={{position:"absolute",top:2,right:2,background:T.danger,color:"#fff",fontSize:8,fontWeight:700,borderRadius:8,padding:"1px 4px",lineHeight:1}}>{badge}</span>}
                  </motion.button>
                  <AnimatePresence>
                    {isHov && (
                      <motion.div key="tooltip"
                        initial={{ opacity:0, x:-6 }}
                        animate={{ opacity:1, x:0 }}
                        exit={{ opacity:0, x:-6 }}
                        transition={{ duration:0.13, ease:"easeOut" }}
                        style={tooltipBase}>
                        <div style={tooltipInner}>{m.label}</div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            });
            return items;
          })()}
        </div>

        {/* Content */}
        <AnimatePresence mode="wait">
        <motion.div key={nav}
          initial={{ opacity:0, y:8 }}
          animate={{ opacity:1, y:0 }}
          exit={{ opacity:0, y:-8 }}
          transition={{ duration:0.2, ease:[0.23,1,0.32,1] }}
          ref={mainContentRef}
          style={{ flex:1, padding: modal ? 0 : 24, overflowY: modal ? "hidden" : "auto", background:T.bg }}>

          {/* DASHBOARD */}
          {nav==="dashboard" && (()=>{
            // ── helpers ──────────────────────────────────────────────
            const CAP_QBS002_DASH = {
              "QBS002-1B":26903,"QBS002-1E":26903,
              "QBS002-2B":47238,"QBS002-2E":47415,
              "QBS002-3B":26874,"QBS002-3E":26874,
              "QBS002-4B":47110,"QBS002-4E":47144,
              "QBS002-5B":27194,"QBS002-5E":26935,
            };
            const tkCap = t => Math.round((Number(t.capacidad) || CAP_QBS002_DASH[t.id] || 27000) * 0.9);
            const isPlanta1 = id => id.startsWith("QBS002") || id === "TKT-1" || id === "TKT-2";
            const isPlanta2 = id => id.startsWith("TK-");

            const p1Tanks = tanques.filter(t => isPlanta1(t.id));
            const p2Tanks = tanques.filter(t => isPlanta2(t.id));

            const p1Cap   = p1Tanks.reduce((a,t)=>a+tkCap(t),0);
            const p1Nivel = p1Tanks.reduce((a,t)=>a+Number(t.nivel||0),0);
            const p2Cap   = p2Tanks.reduce((a,t)=>a+tkCap(t),0);
            const p2Nivel = p2Tanks.reduce((a,t)=>a+Number(t.nivel||0),0);

            // clasificación por familia usando configuración de tankFamilias (localStorage)
            const isProdBlanco = p => { const u=(p||"").toUpperCase(); return u.includes("MGO")||u.includes("DIESEL")||u.includes("DISEL")||u==="NACIONAL"||u==="INTERNACIONAL"; };
            const isTankBlanco = t => tankFamilias[t.id] ? tankFamilias[t.id]==="blanco" : isProdBlanco(t.producto);
            const isTankNegro  = t => !isTankBlanco(t);
            const isBlanco = p => isProdBlanco(p);
            const isNegro  = p => !isBlanco(p);

            // galones por viaje: blanco usa 10 500 gls como fallback si no tiene gls_netos_guia
            const GLS_BLANCO_CARRO = 10500;
            const glsViaje = v => isBlanco(v.producto)
              ? (Number(v.gls_netos_guia)||GLS_BLANCO_CARRO)
              : Number(v.gls_netos_guia||0);

            // carros en tránsito y en planta
            const vTransito = (viajes||[]).filter(v=>v.estado==="En Ruta");
            const vEnPlanta = (viajes||[]).filter(v=>v.estado==="En Planta");

            // viajes con galones y fecha estimada (para la tabla de proyección)
            const vEnRuta = vTransito.filter(v=>v.fecha_aprox_llegada && glsViaje(v)>0);
            const allActivos = [...vTransito, ...vEnPlanta];
            const glsEntrantesNegro  = allActivos.filter(v=>isNegro(v.producto)).reduce((a,v)=>a+glsViaje(v),0);
            const glsEntrantesBlanco = allActivos.filter(v=>isBlanco(v.producto)).reduce((a,v)=>a+glsViaje(v),0);
            const totalEntrante = glsEntrantesNegro + glsEntrantesBlanco;

            // capacidad por familia (P1 + P2 juntas)
            const allTanks = [...p1Tanks, ...p2Tanks];
            const tanksNegro  = allTanks.filter(t=>isTankNegro(t));
            const tanksBlanco = allTanks.filter(t=>isTankBlanco(t));

            const capNegro   = tanksNegro.reduce((a,t)=>a+tkCap(t),0);
            const nivelNegro = tanksNegro.reduce((a,t)=>a+Number(t.nivel||0),0);
            const capBlanco   = tanksBlanco.reduce((a,t)=>a+tkCap(t),0);
            const nivelBlanco = tanksBlanco.reduce((a,t)=>a+Number(t.nivel||0),0);

            const espacioDispNegro  = Math.max(0, capNegro  - nivelNegro);
            const espacioDispBlanco = Math.max(0, capBlanco - nivelBlanco);
            const espacioPorCargarNegro  = Math.max(0, espacioDispNegro  - glsEntrantesNegro);
            const espacioPorCargarBlanco = Math.max(0, espacioDispBlanco - glsEntrantesBlanco);

            // agrupar entradas proyectadas por fecha y producto (solo en tránsito con fecha)
            const byFecha = {};
            vEnRuta.forEach(v=>{
              const key = v.fecha_aprox_llegada;
              if(!byFecha[key]) byFecha[key] = {};
              const prod = v.producto||"Sin producto";
              byFecha[key][prod] = (byFecha[key][prod]||0) + glsViaje(v);
            });
            const fechas = Object.keys(byFecha).sort();

            // colores producto
            const prodColor = p => {
              const u = (p||"").toUpperCase();
              if(u.includes("VLSFO")) return "#0077CC";
              if(u.includes("MGO") || u.includes("DISEL") || u.includes("DIESEL")) return "#06b6d4";
              // Resto de materias primas → gris oscuro
              return "#374151";
            };

            // alertas por familia
            const alertNegro  = (nivelNegro  + glsEntrantesNegro)  > capNegro;
            const alertBlanco = (nivelBlanco + glsEntrantesBlanco) > capBlanco;
            const p2Alert = false; // se usa alertNegro/alertBlanco abajo
            const p1Alert = false;

            // barra de capacidad
            const CapBar = ({ nivel, cap, incoming, label, alert }) => {
              const pctAct = cap>0 ? Math.min(100, (nivel/cap)*100) : 0;
              const pctIn  = cap>0 ? Math.min(100-pctAct, (incoming/cap)*100) : 0;
              const libre  = Math.max(0, cap - nivel);
              const pctColor = pctAct>80 ? T.danger : pctAct>50 ? T.success : T.orange;
              return (
                <div style={{marginBottom:6}}>
                  <div style={{display:"flex",justifyContent:"space-between",fontSize:11,marginBottom:4}}>
                    <span style={{fontWeight:700,color:T.navy}}>{label}</span>
                    <span style={{color:alert?T.danger:T.muted,fontWeight:alert?800:400}}>
                      {alert?"⚠ Capacidad excedida":""}
                    </span>
                  </div>
                  <div style={{background:T.border,borderRadius:6,height:18,overflow:"hidden",position:"relative",display:"flex"}}>
                    <div style={{height:"100%",width:`${pctAct}%`,background:pctColor,transition:"width 0.4s"}}/>
                    <div style={{height:"100%",width:`${pctIn}%`,background:"#f59e0b",opacity:0.85,transition:"width 0.4s"}}/>
                  </div>
                  <div style={{display:"flex",gap:16,fontSize:10,marginTop:4,flexWrap:"wrap"}}>
                    <span style={{color:pctColor,fontWeight:700}}>Actual: {fmt(nivel)} gls</span>
                    <span style={{color:T.muted}}>Libre: {fmt(libre)} gls</span>
                  </div>
                </div>
              );
            };

            // productos únicos en las entradas
            const allProds = [...new Set(vEnRuta.map(v=>v.producto||"Sin producto"))].sort();

            return (
            <div>
              {/* Cabecera */}
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:4,flexWrap:"wrap",gap:8}}>
                <div>
                  <div style={{ fontWeight:800, fontSize:20, color:T.navy }}>Panel Operativo</div>
                  <div style={{ fontSize:11, color:T.muted }}>QBS · {new Date().toLocaleDateString("es-CO",{weekday:"long",day:"numeric",month:"long",year:"numeric"})}</div>
                </div>
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

              {/* Selector familia + botón admin tanques */}
              <div style={{display:"flex",alignItems:"center",gap:12,margin:"16px 0 12px",flexWrap:"wrap"}}>
              <div style={{display:"flex",gap:0,borderRadius:8,overflow:"hidden",border:`1px solid ${T.border}`,width:"fit-content"}}>
                {[{k:"negro",label:"⬛ Producto Negro"},{k:"blanco",label:"⬜ Producto Blanco"}].map(({k,label})=>(
                  <button key={k} onClick={()=>setDashFamilia(k)}
                    style={{padding:"8px 22px",fontWeight:700,fontSize:12,cursor:"pointer",border:"none",outline:"none",
                      background:dashFamilia===k ? T.navy : T.card,
                      color:dashFamilia===k ? "#fff" : T.muted,
                      transition:"background 0.2s"}}>
                    {label}
                  </button>
                ))}
              </div>
              {["administrador","logistica"].includes(perfil?.rol) && (
                <button onClick={()=>setModalTankAdmin(true)}
                  style={{padding:"8px 16px",fontWeight:700,fontSize:12,cursor:"pointer",borderRadius:8,
                    border:`1px solid ${T.border}`,background:T.card,color:T.navy,display:"flex",alignItems:"center",gap:6}}>
                  <Wrench size={13}/> Administrar Tanques
                </button>
              )}
              </div>

              {/* Stats rápidas — filtradas por familia */}
              {(()=>{
                const esNegro = dashFamilia==="negro";
                const cap      = esNegro ? capNegro      : capBlanco;
                const nivel    = esNegro ? nivelNegro     : nivelBlanco;
                const espDisp  = esNegro ? espacioDispNegro  : espacioDispBlanco;
                const glsEnt   = esNegro ? glsEntrantesNegro : glsEntrantesBlanco;
                const espCarg  = esNegro ? espacioPorCargarNegro : espacioPorCargarBlanco;
                const alert    = esNegro ? alertNegro     : alertBlanco;
                const nCarros  = allActivos.filter(v=> esNegro ? isNegro(v.producto) : isBlanco(v.producto)).length;
                const acColor  = esNegro ? T.navy : "#38bdf8";
                const carrosTransito = vTransito.filter(v=>esNegro?isNegro(v.producto):isBlanco(v.producto));
                const carrosPlanta   = vEnPlanta.filter(v=>esNegro?isNegro(v.producto):isBlanco(v.producto));
                const glsTransito = carrosTransito.reduce((a,v)=>a+Number(v.gls_netos_guia||0),0);
                const glsPlanta   = carrosPlanta.reduce((a,v)=>a+Number(v.gls_netos_guia||0),0);
                return (
                  <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))", gap:10, marginBottom:16 }}>
                    <Stat label="Carros en Tránsito" value={carrosTransito.length} color={T.orange} sub={glsTransito>0?`${fmt(glsTransito)} gls guía`:"en camino a planta"} />
                    <Stat label="Carros en Planta"   value={carrosPlanta.length}   color={T.navy}   sub={glsPlanta>0?`${fmt(glsPlanta)} gls guía`:"pendientes descargue"} />
                    <Stat label="Capacidad Total"    value={`${fmt(cap)} gls`}    color={acColor} sub={`${esNegro?"negro":"blanco"} P1+P2`} />
                    <Stat label="Inventario Actual"  value={`${fmt(nivel)} gls`}  color={acColor} sub={`${Math.round(cap>0?(nivel/cap)*100:0)}% lleno`} />
                    <Stat label="Espacio Disponible" value={`${fmt(espDisp)} gls`} color={T.success} sub="libre ahora" />
                    <Stat label="Galones Entrantes"  value={`${fmt(glsEnt)} gls`} color={T.orange} sub={`${nCarros} carros`} />
                    <Stat label="Espacio por Cargar" value={`${fmt(espCarg)} gls`} color={alert?T.danger:T.success} sub={alert?"⚠ Sin espacio":"tras descontar entrantes"} />
                  </div>
                );
              })()}

              {/* Capacidad por planta */}
              <div style={{ fontWeight:800, fontSize:14, color:T.navy, marginBottom:12, paddingBottom:6, borderBottom:`2px solid ${T.orange}22`, display:"flex", alignItems:"center", gap:6 }}>
                <Cylinder size={15}/>Capacidad de Almacenamiento
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:22}}>
                {/* Planta 1 */}
                <Card style={{padding:"16px 18px"}}>
                  <div style={{fontWeight:800,fontSize:13,color:T.navy,marginBottom:10,display:"flex",alignItems:"center",gap:6}}>
                    <Ship size={14}/> Planta 1 · Barcaza + TKT
                  </div>
                  {(()=>{
                    const sub=p1Tanks.filter(t=>dashFamilia==="negro"?isTankNegro(t):isTankBlanco(t));
                    const subP2=p2Tanks.filter(t=>dashFamilia==="negro"?isTankNegro(t):isTankBlanco(t));
                    const inc=dashFamilia==="negro"?glsEntrantesNegro:glsEntrantesBlanco;
                    const capP2=subP2.reduce((a,t)=>a+tkCap(t),0);
                    const nivP2=subP2.reduce((a,t)=>a+Number(t.nivel||0),0);
                    const libreP2=Math.max(0,capP2-nivP2);
                    // Overflow: lo que no cabe en P2 desborda a P1
                    const incP1=Math.max(0,inc-libreP2);
                    const capP1=sub.reduce((a,t)=>a+tkCap(t),0);
                    const nivP1=sub.reduce((a,t)=>a+Number(t.nivel||0),0);
                    const alP1=(nivP1+incP1)>capP1;
                    return sub.length>0 ? <CapBar nivel={nivP1} cap={capP1} incoming={incP1} label={dashFamilia==="negro"?"⬛ Negro":"⬜ Blanco"} alert={alP1}/> : <div style={{fontSize:11,color:T.muted,padding:"8px 0"}}>Sin tanques de producto {dashFamilia} en Planta 1</div>;
                  })()}
                  {/* Detalle por tanque */}
                  <div style={{marginTop:10,display:"flex",flexDirection:"column",gap:4}}>
                    {p1Tanks.filter(t=>dashFamilia==="negro"?isTankNegro(t):isTankBlanco(t)).map(t=>{
                      const cap=tkCap(t); const niv=Number(t.nivel||0);
                      const pct=cap>0?Math.min(100,Math.round((niv/cap)*100)):0;
                      const bc=prodColor(t.producto);
                      return (
                        <div key={t.id} style={{display:"flex",alignItems:"center",gap:8,fontSize:10}}>
                          <span style={{width:80,fontWeight:700,color:T.navy,flexShrink:0}}>{t.id.replace("QBS002-","")}</span>
                          <div style={{flex:1,background:T.border,borderRadius:3,height:6,overflow:"hidden"}}>
                            <div style={{height:"100%",width:`${pct}%`,background:bc,transition:"width 0.4s"}}/>
                          </div>
                          <span style={{color:T.muted,width:80,textAlign:"right"}}>{fmt(niv)}/{fmt(cap)}</span>
                          <span style={{color:prodColor(t.producto),fontWeight:700,width:60,textAlign:"right"}}>{t.producto||"—"}</span>
                        </div>
                      );
                    })}
                  </div>
                </Card>
                {/* Planta 2 */}
                <Card style={{padding:"16px 18px"}}>
                  <div style={{fontWeight:800,fontSize:13,color:T.navy,marginBottom:10,display:"flex",alignItems:"center",gap:6}}>
                    <Factory size={14}/> Planta 2 · TK-111 a TK-117
                  </div>
                  {(()=>{ const sub=p2Tanks.filter(t=>dashFamilia==="negro"?isTankNegro(t):isTankBlanco(t)); const inc=dashFamilia==="negro"?glsEntrantesNegro:glsEntrantesBlanco; const al=dashFamilia==="negro"?alertNegro:alertBlanco; return sub.length>0 ? <CapBar nivel={sub.reduce((a,t)=>a+Number(t.nivel||0),0)} cap={sub.reduce((a,t)=>a+tkCap(t),0)} incoming={inc} label={dashFamilia==="negro"?"⬛ Negro":"⬜ Blanco"} alert={al}/> : <div style={{fontSize:11,color:T.muted,padding:"8px 0"}}>Sin tanques de producto {dashFamilia} en Planta 2</div>; })()}
                  <div style={{marginTop:10,display:"flex",flexDirection:"column",gap:4}}>
                    {p2Tanks.filter(t=>dashFamilia==="negro"?isTankNegro(t):isTankBlanco(t)).map(t=>{
                      const cap=tkCap(t); const niv=Number(t.nivel||0);
                      const pct=cap>0?Math.min(100,Math.round((niv/cap)*100)):0;
                      const bc=prodColor(t.producto);
                      return (
                        <div key={t.id} style={{display:"flex",alignItems:"center",gap:8,fontSize:10}}>
                          <span style={{width:60,fontWeight:700,color:T.navy,flexShrink:0}}>{t.id}</span>
                          <div style={{flex:1,background:T.border,borderRadius:3,height:6,overflow:"hidden"}}>
                            <div style={{height:"100%",width:`${pct}%`,background:bc,transition:"width 0.4s"}}/>
                          </div>
                          <span style={{color:T.muted,width:80,textAlign:"right"}}>{fmt(niv)}/{fmt(cap)}</span>
                          <span style={{color:prodColor(t.producto),fontWeight:700,width:60,textAlign:"right"}}>{t.producto||"—"}</span>
                        </div>
                      );
                    })}
                  </div>
                </Card>
              </div>

              {/* Fecha límite de recibo */}
              {(()=>{
                const cap   = dashFamilia==="negro" ? capNegro   : capBlanco;
                const nivel = dashFamilia==="negro" ? nivelNegro : nivelBlanco;
                const vFilt = vEnRuta.filter(v=>dashFamilia==="negro"?isNegro(v.producto):isBlanco(v.producto));
                const byF = {};
                vFilt.forEach(v=>{ const k=v.fecha_aprox_llegada; if(k) byF[k]=(byF[k]||0)+glsViaje(v); });
                const fechas = Object.keys(byF).sort();
                let acum = nivel;
                let fechaLleno = null;
                for (const f of fechas) {
                  acum += byF[f];
                  if (acum >= cap) { fechaLleno = f; break; }
                }
                const libreActual = Math.max(0, cap - nivel);
                const pctActual = cap>0 ? Math.round((nivel/cap)*100) : 0;
                if (!fechaLleno) return (
                  <div style={{background:`${T.success}15`,border:`1px solid ${T.success}44`,borderRadius:8,padding:"10px 16px",marginBottom:14,display:"flex",alignItems:"center",gap:10,fontSize:12}}>
                    <span style={{fontSize:18}}>✅</span>
                    <span>Con los <b>{vFilt.length} viajes</b> en tránsito ({fmt(vFilt.reduce((a,v)=>a+glsViaje(v),0))} gls) hay espacio suficiente. Libre actual: <b>{fmt(libreActual)} gls</b> ({100-pctActual}% disponible).</span>
                  </div>
                );
                const label = new Date(fechaLleno+"T12:00:00").toLocaleDateString("es-CO",{weekday:"long",day:"2-digit",month:"long",year:"numeric"});
                return (
                  <div style={{background:`${T.danger}15`,border:`1px solid ${T.danger}55`,borderRadius:8,padding:"10px 16px",marginBottom:14,display:"flex",alignItems:"center",gap:10,fontSize:12}}>
                    <span style={{fontSize:18}}>🚨</span>
                    <span>Capacidad completa estimada: <b style={{color:T.danger}}>{label}</b> — a partir de esa fecha no hay espacio para más materia prima sin antes mover producto a buques.</span>
                  </div>
                );
              })()}

              {/* Entradas proyectadas por fecha */}
              <div style={{ fontWeight:800, fontSize:14, color:T.navy, marginBottom:12, paddingBottom:6, borderBottom:`2px solid ${T.orange}22`, display:"flex", alignItems:"center", gap:6 }}>
                <Truck size={15}/> Entradas Proyectadas · {dashFamilia==="negro"?"Producto Negro":"Producto Blanco"}
              </div>
              {(()=>{
                const hoy = new Date().toISOString().slice(0,10);
                const vFiltrados = vEnRuta.filter(v=>dashFamilia==="negro"?isNegro(v.producto):isBlanco(v.producto));
                const byFechaFam = {};
                vFiltrados.forEach(v=>{
                  // Carros con fecha pasada se mueven a hoy (retraso en ruta)
                  const key = (v.fecha_aprox_llegada && v.fecha_aprox_llegada < hoy) ? hoy : v.fecha_aprox_llegada;
                  if(!byFechaFam[key]) byFechaFam[key]={};
                  const p=v.producto||"Sin producto"; byFechaFam[key][p]=(byFechaFam[key][p]||0)+glsViaje(v);
                });
                const fechasFam = Object.keys(byFechaFam).sort();
                const prodsFam = [...new Set(vFiltrados.map(v=>v.producto||"Sin producto"))].sort();
                const totalFam = vFiltrados.reduce((a,v)=>a+glsViaje(v),0);

                // ── Línea de tiempo de espacio libre ──────────────────────
                const MT_A_GLS = 264; // toneladas métricas → galones (VLSFO/HSFO negro)
                const MT_A_GLS_B = 282; // MGO/diesel blanco

                // Galones que descargan HOY: carros en planta de la familia activa
                const glsEnPlantaHoy = vEnPlanta
                  .filter(v=>dashFamilia==="negro"?isNegro(v.producto):isBlanco(v.producto))
                  .reduce((a,v)=>a+glsViaje(v),0);

                // Salidas por buque agrupadas por ETD
                const salidasPorFecha = {};
                (despachos||[]).filter(d=>d.etd && d.estado!=="ENTREGADO").forEach(d=>{
                  const gls = dashFamilia==="negro"
                    ? (Number(d.mt_vlso||0)+Number(d.mt_hsfo||0))*MT_A_GLS
                    : Number(d.mt_mgo||0)*MT_A_GLS_B;
                  if (gls>0) salidasPorFecha[d.etd] = (salidasPorFecha[d.etd]||0)+gls;
                });

                // Espacio inicial = libre actual - carros ya en planta (descargan hoy)
                const libreActualFam = dashFamilia==="negro" ? espacioDispNegro : espacioDispBlanco;
                let espacioRunning = libreActualFam - glsEnPlantaHoy;

                // Todas las fechas relevantes (llegadas + ETDs de buques)
                const todasFechas = [...new Set([...fechasFam, ...Object.keys(salidasPorFecha)])].sort();

                // Balance acumulado por fecha
                const espacioPorFecha = {};
                for (const f of todasFechas) {
                  const entran = Object.values(byFechaFam[f]||{}).reduce((a,b)=>a+b,0);
                  const salen  = salidasPorFecha[f]||0;
                  espacioRunning = espacioRunning - entran + salen;
                  espacioPorFecha[f] = espacioRunning;
                }
              return vFiltrados.length === 0 ? (
                <div style={{color:T.muted,fontSize:12,padding:"20px 0"}}>No hay viajes en tránsito con fecha estimada para producto {dashFamilia}.</div>
              ) : (
                <div data-scroll-key="viajes-prog-llegadas" style={{overflowX:"auto"}}>
                  <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
                    <thead>
                      <tr style={{background:T.navy+"18"}}>
                        <th style={{padding:"7px 10px",textAlign:"left",fontWeight:700,color:T.navy}}>F. Llegada Est.</th>
                        {prodsFam.map(p=>(
                          <th key={p} style={{padding:"7px 10px",textAlign:"right",fontWeight:700,color:prodColor(p)}}>{p}</th>
                        ))}
                        <th style={{padding:"7px 10px",textAlign:"right",fontWeight:700,color:T.navy}}>Total (gls)</th>
                        <th style={{padding:"7px 10px",textAlign:"right",fontWeight:700,color:T.success}}>Espacio libre</th>
                      </tr>
                    </thead>
                    <tbody>
                      {fechasFam.map((f,i)=>{
                        const row = byFechaFam[f];
                        const total = Object.values(row).reduce((a,b)=>a+b,0);
                        const esHoy = f === new Date().toISOString().slice(0,10);
                        const eLibre = espacioPorFecha[f] ?? libreActualFam;
                        const hayEspacio = eLibre > 0;
                        return (
                          <tr key={f} style={{background:i%2===0?T.bg:T.card,borderTop:`1px solid ${T.border}`}}>
                            <td style={{padding:"6px 10px",fontWeight:600,color:T.navy}}>
                              {hayEspacio?"🟢 ":"🔴 "}{new Date(f+"T12:00:00").toLocaleDateString("es-CO",{weekday:"short",day:"2-digit",month:"short"})}
                            </td>
                            {prodsFam.map(p=>(
                              <td key={p} style={{padding:"6px 10px",textAlign:"right",color:row[p]?prodColor(p):T.muted}}>
                                {row[p]?fmt(row[p]):"—"}
                              </td>
                            ))}
                            <td style={{padding:"6px 10px",textAlign:"right",fontWeight:800,color:T.navy}}>{fmt(total)}</td>
                            <td style={{padding:"6px 10px",textAlign:"right",fontWeight:700,color:hayEspacio?T.success:T.danger}}>
                              {hayEspacio?fmt(Math.round(eLibre)):"Sin espacio"}
                            </td>
                          </tr>
                        );
                      })}
                      <tr style={{background:T.navy+"22",borderTop:`2px solid ${T.navy}44`}}>
                        <td style={{padding:"7px 10px",fontWeight:800,color:T.navy}}>TOTAL ENTRANTE</td>
                        {prodsFam.map(p=>{
                          const tot = vFiltrados.filter(v=>(v.producto||"Sin producto")===p).reduce((a,v)=>a+glsViaje(v),0);
                          return <td key={p} style={{padding:"7px 10px",textAlign:"right",fontWeight:800,color:prodColor(p)}}>{fmt(tot)}</td>;
                        })}
                        <td style={{padding:"7px 10px",textAlign:"right",fontWeight:800,color:T.navy}}>{fmt(totalFam)}</td>
                        <td style={{padding:"7px 10px",textAlign:"right",color:T.muted,fontSize:10}}>proyectado</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              );
              })()}

              {/* Alertas */}
              {(alertNegro || alertBlanco) && (
                <div style={{marginTop:16,background:"#fff0f0",border:`1px solid ${T.danger}`,borderRadius:8,padding:"12px 16px",display:"flex",gap:10,alignItems:"flex-start"}}>
                  <AlertTriangle size={18} style={{color:T.danger,flexShrink:0,marginTop:1}}/>
                  <div>
                    <div style={{fontWeight:800,color:T.danger,fontSize:13,marginBottom:4}}>Alerta de Capacidad</div>
                    {alertNegro  && <div style={{fontSize:12,color:T.danger,marginBottom:2}}>⬛ Producto Negro: inventario actual ({fmt(nivelNegro)} gls) + entrantes ({fmt(glsEntrantesNegro)} gls) = {fmt(nivelNegro+glsEntrantesNegro)} gls — supera capacidad disponible ({fmt(capNegro)} gls).</div>}
                    {alertBlanco && <div style={{fontSize:12,color:T.danger}}>⬜ Producto Blanco: inventario actual ({fmt(nivelBlanco)} gls) + entrantes ({fmt(glsEntrantesBlanco)} gls) = {fmt(nivelBlanco+glsEntrantesBlanco)} gls — supera capacidad disponible ({fmt(capBlanco)} gls).</div>}
                  </div>
                </div>
              )}
            </div>
            );
          })()}

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
              if (viajesFiltroTrans && v.transportadora !== viajesFiltroTrans) return false;
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
                    <div style={{ fontSize:11, color:T.muted }}>Carros en ruta · <b style={{color:T.orange}}>{viajesFinal.length}</b> resultado(s)</div>
                  </div>
                  <div style={{display:"flex",gap:8}}>
                    {puedeCrear("viajes") && (<>
                      <label style={{background:importLoading?`${T.success}88`:T.success,color:"#fff",border:"none",borderRadius:6,padding:"9px 20px",fontWeight:700,fontSize:13,cursor:importLoading?"not-allowed":"pointer",whiteSpace:"nowrap",letterSpacing:0.3,display:"flex",alignItems:"center",gap:8}}>
                        {importLoading ? <><span style={{display:"inline-block",width:14,height:14,border:"2px solid #fff",borderTopColor:"transparent",borderRadius:"50%",animation:"spin 0.7s linear infinite"}}/>Analizando...</> : "↑ Importar Excel"}
                        <input type="file" accept=".xlsx,.xls" style={{display:"none"}} disabled={importLoading} onChange={e=>{if(e.target.files[0])leerExcelViajes(e.target.files[0]);e.target.value="";}}/>
                      </label>
                      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
                      {["logistica","administrador"].includes(perfil?.rol) && (
                        <Btn outline onClick={()=>setModalFlota(true)}>⚙ Administrar Flota</Btn>
                      )}
                      <Btn onClick={()=>{setForm({fecha:today(),sede:sedeFiltro==="TODAS"?"MALAMBO":sedeFiltro,planta:"PLANTA 1"});setModal("viaje");}}>+ Nuevo Viaje</Btn>
                    </>)}
                  </div>
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
                  <select value={viajesFiltroTrans} onChange={e=>setViajesFiltroTrans(e.target.value)} style={selStyle}>
                    <option value="">Todas las transportadoras</option>
                    {[...new Set((viajes||[]).map(v=>v.transportadora).filter(Boolean))].sort().map(t=><option key={t}>{t}</option>)}
                  </select>
                  <input type="date" value={viajesFiltroFechaD} onChange={e=>setViajesFiltroFechaD(e.target.value)} style={selStyle} title="Fecha cargue desde"/>
                  <input type="date" value={viajesFiltroFechaH} onChange={e=>setViajesFiltroFechaH(e.target.value)} style={selStyle} title="Fecha cargue hasta"/>
                  {(viajesBusqueda||viajesFiltroEstado||viajesFiltroProducto||viajesFiltroTrans||viajesFiltroFechaD||viajesFiltroFechaH) && (
                    <button onClick={()=>{setViajesBusqueda("");setViajesFiltroEstado("");setViajesFiltroProducto("");setViajesFiltroTrans("");setViajesFiltroFechaD("");setViajesFiltroFechaH("");}} style={{background:`${T.danger}22`,border:`1px solid ${T.danger}44`,borderRadius:8,color:T.danger,padding:"6px 12px",cursor:"pointer",fontSize:11,fontFamily:"monospace"}}>Limpiar</button>
                  )}
                </div>
              </div>
              <div data-scroll-key="viajes-tabla" style={{flex:1,overflow:"auto",borderRadius:12,border:"1px solid #ffffff0a"}}>
              <Table
                cols={["ID","Sede","F. Cargue","F. Llegada","Producto","Transportadora","Placa","Guía","Gls Guía","Gls Recib.","Faltantes","Stand By","Estado",""]}
                rows={viajesFinal.map(v=>{
                  const faltantes = v.gls_recibidos>0 ? Math.max(0, Number(v.gls_netos_guia||v.volumen_guia||0) - Number(v.gls_recibidos||0)) : 0;
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
                    : horasStandby < 8   ? T.success
                    : horasStandby < 16  ? T.orange
                    : T.danger;
                  return [
                    <a onClick={()=>openViajeTab(v)} style={{color:T.orange,fontWeight:700,cursor:"pointer",textDecoration:"underline",fontFamily:"monospace"}}>{v.id}</a>,
                    <Badge label={v.sede||"MALAMBO"} color={v.sede==="SANTA MARTA"?T.muted:v.sede==="CARTAGENA"?T.danger:T.orange}/>,
                    v.fecha,
                    v.fecha_aprox_llegada
                      ? <span style={{color:T.success,fontWeight:600}}>{v.fecha_aprox_llegada}</span>
                      : <span style={{color:T.muted,fontSize:10}}>—</span>,
                    v.producto, v.transportadora, v.placa, v.guia,
                    fmt(v.gls_netos_guia||v.volumen_guia||0),
                    v.gls_recibidos>0?<span style={{color:T.success,fontWeight:700}}>{fmt(v.gls_recibidos)}</span>:<span style={{color:T.muted,fontSize:10}}>—</span>,
                    faltantes>0?<span style={{color:T.danger,fontWeight:700}}>{fmt(faltantes)}</span>:v.gls_recibidos>0?<span style={{color:T.success}}>OK</span>:<span style={{color:T.muted}}>0</span>,
                    sbLabel !== null
                      ? <span style={{display:"inline-flex",alignItems:"center",gap:4}}>
                          <Badge label={sbLabel} color={sbColor}/>
                          {!sbFinalizado && horasStandby>=24 && <span style={{fontSize:9,color:T.danger,fontWeight:700}}>COBRO</span>}
                          {!sbFinalizado && horasStandby<24 && <span style={{fontSize:9,color:T.muted,fontStyle:"italic"}}>en curso</span>}
                        </span>
                      : <span style={{color:"#ffffff18"}}>—</span>,
                    <Badge label={v.estado} color={v.estado==="Descargado"?T.success:v.estado==="En Ruta"?T.orange:v.estado==="Rechazado"?T.danger:T.orange}/>,
                    null,
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
                // Primero por fecha de llegada (más viejos primero), luego por turno asignado
                const fa = a.fecha_llegada||"9999", fb = b.fecha_llegada||"9999";
                if (fa !== fb) return fa < fb ? -1 : 1;
                if (a.turno_planta && b.turno_planta) return a.turno_planta - b.turno_planta;
                if (a.turno_planta) return -1;
                if (b.turno_planta) return 1;
                return new Date(a.updated_at||0) - new Date(b.updated_at||0);
              });
            const COLOR = T.orange;
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
                    <button onClick={()=>{setPlantaBusqueda("");setPlantaFiltroProducto("");setPlantaFiltroFechaD("");setPlantaFiltroFechaH("");}} style={{background:`${T.danger}22`,border:`1px solid ${T.danger}44`,borderRadius:8,color:T.danger,padding:"6px 12px",cursor:"pointer",fontSize:11}}>Limpiar</button>
                  )}
                </div>
              </div>

              {/* Tabla */}
              <div data-scroll-key="listado-planta-tabla" style={{flex:1,overflow:"auto",borderRadius:8,border:`1px solid ${T.border}`,background:T.card,boxShadow:"0 1px 3px rgba(0,0,0,0.06)"}}>
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
                      const turno = idx + 1;
                      return (
                        <tr key={v.id} style={{borderTop:`1px solid ${T.border}`,background:idx%2===0?T.card:"#eef2f7",transition:"background 0.12s"}}
                          onMouseEnter={e=>e.currentTarget.style.background="#dde6f0"}
                          onMouseLeave={e=>e.currentTarget.style.background=idx%2===0?T.card:"#eef2f7"}>
                          {/* Número de turno (posición en cola, calculado dinámicamente) */}
                          <td style={{padding:"12px 14px"}}>
                            <div style={{width:28,height:28,borderRadius:"50%",background:turno===1?`${T.success}22`:`${T.orange}22`,border:`2px solid ${turno===1?T.success:T.orange}`,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,fontSize:12,color:turno===1?T.success:T.orange}}>{turno}</div>
                          </td>
                          {/* Fecha llegada */}
                          <td style={{padding:"12px 14px"}}>
                            {llegó
                              ? <span style={{color:T.success,fontWeight:700}}>{v.fecha_llegada}</span>
                              : <span style={{color:T.orange,fontSize:11}}>Pendiente</span>
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
                              if (fuera.length===0) return <span style={{color:T.success,fontWeight:700,fontSize:11}}>✔ Listo para descargue</span>;
                              return <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
                                {fuera.map(f=><span key={f} style={{background:`${T.danger}18`,border:`1px solid ${T.danger}55`,borderRadius:5,padding:"2px 7px",color:T.danger,fontSize:10,fontWeight:700}}>{f}</span>)}
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
                                {llegó ? "Editar" : "📍 Registrar llegada"}
                              </button>
                              {perfil.rol==="administrador" && (
                                <button onClick={async()=>{
                                  if (!confirm(`¿Eliminar carro ${v.placa} del listado? Esta acción no se puede deshacer.`)) return;
                                  // Cascada completa antes de eliminar viaje
                                  const {data:pbsIds} = await dbCall({ table:"pbs", op:"select", select:"id", filters:[{col:"viaje_id",val:v.id}] });
                                  if (pbsIds?.length) {
                                    for (const p of pbsIds) {
                                      await dbCall({ table:"cmts", op:"delete", filters:[{col:"pbs_id",val:p.id}] });
                                    }
                                  }
                                  await dbCall({ table:"tiquetes", op:"delete", filters:[{col:"viaje_id",val:v.id}] });
                                  await dbCall({ table:"pbs", op:"delete", filters:[{col:"viaje_id",val:v.id}] });
                                  await dbCall({ table:"despachos", op:"delete", filters:[{col:"viaje_id",val:v.id}] });
                                  const {error:errViaje} = await dbCall({ table:"viajes", op:"delete", filters:[{col:"id",val:v.id}] });
                                  if (errViaje) return showToast(`Error viaje: ${errViaje}`, false);
                                  await loadData();
                                  showToast(`Carro ${v.placa} eliminado del listado`);
                                }}
                                style={{background:`${T.danger}22`,border:`1px solid ${T.danger}55`,borderRadius:6,color:T.danger,padding:"5px 10px",fontSize:11,cursor:"pointer",fontWeight:700,whiteSpace:"nowrap"}}
                                onMouseEnter={e=>e.currentTarget.style.background=`${T.danger}44`}
                                onMouseLeave={e=>e.currentTarget.style.background=`${T.danger}22`}>
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
            if (!analisisNav) {
              const otsPendientesLab = (ordenesTrabaio||[]).filter(o=>o.estado==="COMPLETADA");
              const carrosSinTiquete = viajes.filter(v=>v.estado==="En Planta"&&!v.tiquete_id);
              const navBtns = [
                {key:"tiquetes_mp",label:"Tiquetes MP",color:"#0077CC"},
                {key:"planta2",label:"Planta 2",color:"#00B894"},
                {key:"planta1",label:"Planta 1",color:"#c084fc"},
                {key:"no_rutinarios",label:"No Rutinarios",color:"#fb923c"},
              ];
              return (
              <div>
                {/* Header con título y botones */}
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
                  <div style={{fontWeight:800,fontSize:22,color:T.navy}}>Análisis de Laboratorio</div>
                  <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                    {navBtns.map(b=>(
                      <button key={b.key}
                        onClick={()=>{ b.key==="tiquetes_mp" ? setAnalisisNav("tiquetes_mp") : (setForm({tipo_analisis:b.label}),setModal("tiquete")); }}
                        style={{background:T.card,border:`1.5px solid ${b.color}55`,borderRadius:8,padding:"7px 16px",color:b.color,fontWeight:700,fontSize:12,cursor:"pointer",transition:"all 0.15s"}}
                        onMouseEnter={e=>{e.currentTarget.style.background=b.color;e.currentTarget.style.color="#fff";}}
                        onMouseLeave={e=>{e.currentTarget.style.background=T.card;e.currentTarget.style.color=b.color;}}>
                        {b.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Carros en planta sin tiquete */}
                <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:10,padding:"14px 18px",marginBottom:16}}>
                  <div style={{fontSize:12,fontWeight:700,color:T.navy,marginBottom:10}}>Carros en planta pendientes de análisis</div>
                  {carrosSinTiquete.length===0
                    ? <div style={{fontSize:12,color:T.muted}}>Sin carros pendientes</div>
                    : <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
                        {carrosSinTiquete.map(v=>(
                          <div key={v.id} style={{background:`${T.navy}10`,border:`1px solid ${T.navy}33`,borderRadius:8,padding:"8px 14px",fontSize:12}}>
                            <b>{v.placa}</b> · {v.producto}
                            {puedeCrear("tiquetes") && (
                              <button onClick={()=>{setForm({viaje_id:v.id,producto:v.producto,placa:v.placa,conductor:v.conductor,fecha_cargue:v.fecha,fecha_llegada:today()});setModal("tiquete");}}
                                style={{marginLeft:10,background:T.navy,color:"#fff",border:"none",borderRadius:6,padding:"3px 10px",fontSize:11,fontWeight:700,cursor:"pointer"}}>Emitir</button>
                            )}
                          </div>
                        ))}
                      </div>
                  }
                </div>

                {/* Recirculaciones pendientes de análisis — una muestra por tanque destino */}
                <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:10,padding:"14px 18px"}}>
                  <div style={{fontSize:12,fontWeight:700,color:T.orange,marginBottom:10}}>Recirculaciones pendientes de análisis</div>
                  {(()=>{
                    // Aplanar: una entrada por tanque destino de cada OT completada
                    const muestras = [];
                    for (const o of otsPendientesLab) {
                      const trasiegos = o.trasiegos||[];
                      // Tiquetes ya emitidos para esta OT (para marcar cuáles ya tienen análisis)
                      const tiqOT = tiquetes.filter(t=>t.ot_id===o.id);
                      for (const tr of trasiegos) {
                        if (!tr.destino) continue;
                        const tq = tanques.find(t=>t.id===tr.destino);
                        const yaAnalizado = tiqOT.some(t=>t.tanque_id===tr.destino||t.tanque===tr.destino);
                        const horasRecirc = tr.recirculacion_inicio&&tr.recirculacion_fin
                          ? ((new Date(tr.recirculacion_fin)-new Date(tr.recirculacion_inicio))/3600000).toFixed(1)+"h" : null;
                        muestras.push({ ot:o, tr, tq, yaAnalizado, horasRecirc });
                      }
                    }
                    if (muestras.length===0) return <div style={{fontSize:12,color:T.muted}}>Sin recirculaciones pendientes</div>;
                    return (
                      <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
                        {muestras.map(({ot:o,tr,tq,yaAnalizado,horasRecirc},idx)=>(
                          <div key={`${o.id}-${tr.destino}-${idx}`} style={{background:yaAnalizado?`${T.success}10`:`${T.orange}10`,border:`1px solid ${yaAnalizado?T.success:T.orange}44`,borderRadius:8,padding:"8px 14px",fontSize:12}}>
                            <b>{o.numero_ot}</b> · <b style={{color:T.navy}}>{tr.destino}</b>
                            {tq?.nombre && <span style={{color:T.muted,fontSize:11}}> ({tq.nombre})</span>}
                            {horasRecirc && <span style={{color:T.muted,fontSize:11}}> · {horasRecirc}</span>}
                            {yaAnalizado
                              ? <span style={{marginLeft:10,fontSize:11,color:T.success,fontWeight:700}}>✅ Analizado</span>
                              : <button onClick={()=>{setForm({tipo_analisis:"Planta 2",ot_id:o.id,ot_numero:o.numero_ot,tanque_id:tr.destino,tanque:tr.destino});setModal("tiquete");}}
                                  style={{marginLeft:10,background:T.orange,color:"#071422",border:"none",borderRadius:6,padding:"3px 10px",fontSize:11,fontWeight:700,cursor:"pointer"}}>Analizar</button>
                            }
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              </div>
              );
            }

            /* ── DETALLE: tabla de tiquetes ── */
            const labelNav = {tiquetes_mp:"Tiquetes MP",planta2:"Planta 2",planta1:"Planta 1",no_rutinarios:"No Rutinarios"}[analisisNav]||"";
            return (
            <div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
                <div>
                  <button onClick={()=>setAnalisisNav("")} style={{background:"none",border:"none",color:T.muted,cursor:"pointer",fontSize:11,padding:"0 0 4px 0",display:"flex",alignItems:"center",gap:4}}>← Análisis</button>
                  <div style={{ fontWeight:800, fontSize:20, color:T.navy }}>{labelNav}</div>
                  <div style={{ fontSize:11, color:T.muted }}>Emitido por laboratorio · <b style={{color:T.orange}}>{tiqFinal.length}</b> resultado(s)</div>
                </div>
                {puedeCrear("tiquetes") && <Btn color={T.orange} onClick={()=>{setForm({});setModal("tiquete");}}>+ Nuevo Tiquete</Btn>}
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
                  <button onClick={()=>{setTiqBusqueda("");setTiqFiltroProducto("");setTiqFiltroResultado("");setTiqFiltroFechaD("");setTiqFiltroFechaH("");}} style={{background:`${T.danger}22`,border:`1px solid ${T.danger}44`,borderRadius:8,color:T.danger,padding:"6px 12px",cursor:"pointer",fontSize:11}}>Limpiar</button>
                )}
              </div>
              {viajes.filter(v=>v.estado==="En Planta"&&!v.tiquete_id).length>0 && (
                <Card style={{ marginBottom:18, borderColor:`${T.orange}33` }}>
                  <div style={{ fontSize:12, fontWeight:700, color:T.orange, marginBottom:10 }}>Carros en planta sin tiquete</div>
                  <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
                    {viajes.filter(v=>v.estado==="En Planta"&&!v.tiquete_id).map(v=>(
                      <div key={v.id} style={{ background:`${T.orange}18`, border:`1px solid ${T.orange}33`, borderRadius:8, padding:"8px 14px", fontSize:12 }}>
                        <b>{v.placa}</b> · {v.producto}
                        {puedeCrear("tiquetes") && (
                          <button onClick={()=>{setForm({viaje_id:v.id,producto:v.producto,placa:v.placa,conductor:v.conductor,fecha_cargue:v.fecha,fecha_llegada:today()});setModal("tiquete");}} style={{ marginLeft:10, background:T.orange, color:"#071422", border:"none", borderRadius:6, padding:"3px 10px", fontSize:11, fontWeight:700, cursor:"pointer" }}>Emitir</button>
                        )}
                      </div>
                    ))}
                  </div>
                </Card>
              )}
              <Table
                cols={["No. Tiquete","Viaje","Producto","Placa","API Corr.","Gls Recibidos","Flash","Agua %","Resultado","Analista",""]}
                rows={tiqFinal.map(t=>[
                  <span style={{color:T.orange}}>{t.id}</span>,
                  t.viaje_id, t.producto, t.placa,
                  `${t.api_corregido}°`, fmt(t.galones_recibidos), `${t.flash_point}°C`, `${t.agua_destilacion}%`,
                  <Badge label={t.resultado} color={t.resultado==="APROBADO"?T.success:T.danger}/>,
                  t.autoriza_nombre,
                  puedeEditar("tiquetes",t.creado_por,t.created_at)
                    ? <button onClick={()=>{setForm({...t});setModal("tiquete");}} style={{background:`${T.orange}22`,border:`1px solid ${T.orange}55`,borderRadius:6,color:T.orange,padding:"3px 10px",fontSize:11,cursor:"pointer",fontFamily:"monospace"}}>Editar</button>
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
            const tipoColor = {"Tiquetes MP":"#0077CC","Planta 2":"#00B894","Planta 1":"#003B73","No Rutinarios":"#D63031"};
            return (
            <div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
                <div>
                  <div style={{ fontWeight:800, fontSize:20, color:T.navy }}>Resultados de Laboratorio</div>
                  <div style={{ fontSize:11, color:T.muted }}>Consolidado de análisis · <b style={{color:T.orange}}>{resFinalTyped.length}</b> resultado(s)</div>
                </div>
              </div>
              {/* Filtro rápido por tipo */}
              <div style={{display:"flex",gap:6,marginBottom:14,flexWrap:"wrap"}}>
                {["", ...TIPOS_ANALISIS].map(tipo=>{
                  const activo = resFiltroTipo===tipo;
                  return (
                    <button key={tipo||"todos"} onClick={()=>setResFiltroTipo(tipo)}
                      style={{padding:"6px 16px",borderRadius:6,border:`1.5px solid ${activo?T.navy:T.border}`,background:activo?T.navy:"transparent",color:activo?"#fff":T.muted,fontSize:12,cursor:"pointer",fontWeight:activo?700:400,transition:"all 0.15s"}}>
                      {tipo||"Todos"}
                    </button>
                  );
                })}
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
                  <button onClick={()=>{setTiqBusqueda("");setTiqFiltroProducto("");setTiqFiltroResultado("");setTiqFiltroFechaD("");setTiqFiltroFechaH("");setResFiltroTipo("");}} style={{background:`${T.danger}22`,border:`1px solid ${T.danger}44`,borderRadius:8,color:T.danger,padding:"6px 12px",cursor:"pointer",fontSize:11}}>Limpiar</button>
                )}
              </div>
              <Table
                cols={["No. Tiquete","Tipo","Fecha","Producto","Placa","Tanque","OT","API Corr.","Flash °C","Agua %","Viscosidad","Azufre %","TSA","Resultado",""]}
                rows={resFinalTyped.map(t=>{
                  const esV = (t.producto||"").toUpperCase()==="VLSFO";
                  const flashOk = Number(t.flash_point)>=60;
                  const aguaOk  = Number(t.agua_destilacion)<0.5;
                  const viscOk  = !esV || Number(t.viscosidad)<380;
                  const azuOk   = !esV || Number(t.azufre)<0.5;
                  const tsaOk   = !esV || Number(t.tsa)<0.1;
                  const tipo = t.tipo_analisis||"Tiquetes MP";
                  const ot = (ordenesTrabaio||[]).find(o=>o.id===t.ot_id || o.tiquete_id===t.id) || null;
                  const tanquesOT = ot ? [...new Set([ot.tanque_destino,...(ot.descargues||[]).map(d=>d.tanque),...(ot.trasiegos||[]).map(tr=>tr.destino)].filter(Boolean))] : [];
                  const tanqueLabel = t.tanque || (tanquesOT.length ? tanquesOT.join(", ") : null);
                  const tanqueCell = tanqueLabel ? <span style={{fontFamily:"monospace",fontWeight:700,color:T.navy}}>{tanqueLabel}</span> : <span style={{color:T.muted}}>—</span>;
                  return [
                    <span style={{color:T.orange,fontFamily:"monospace",cursor:"pointer",textDecoration:"underline",fontWeight:700}} onClick={()=>{setForm({...t});setModal("tiquete");}}>{t.id}</span>,
                    <Badge label={tipo} color={tipoColor[tipo]||T.orange}/>,
                    t.fecha_llegada||t.fecha||"—", t.producto, t.placa||"—", tanqueCell,
                    ot ? <span style={{fontFamily:"monospace",fontWeight:700,color:T.navy,cursor:"pointer",textDecoration:"underline"}} onClick={()=>{ const id=`ot-${ot.id}`; const ex=tabs.find(tb=>tb.id===id); if(ex){setActiveTabId(id);return;} setTabs(p=>[...p,{id,type:"orden_trabajo",title:ot.numero_ot,icon:"🏗️",closeable:true,otId:ot.id}]); setActiveTabId(id); }}>{ot.numero_ot}</span> : <span style={{color:T.muted}}>—</span>,
                    <span style={{color:T.text,fontWeight:600}}>{t.api_corregido}°</span>,
                    <span style={{color:flashOk?T.text:T.danger,fontWeight:flashOk?400:700}}>{t.flash_point}°C</span>,
                    <span style={{color:aguaOk?T.text:T.danger,fontWeight:aguaOk?400:700}}>{t.agua_destilacion}%</span>,
                    <span style={{color:viscOk?T.text:T.danger,fontWeight:viscOk?400:700}}>{t.viscosidad||"—"}</span>,
                    <span style={{color:azuOk?T.text:T.danger,fontWeight:azuOk?400:700}}>{t.azufre||"—"}</span>,
                    <span style={{color:tsaOk?T.text:T.danger,fontWeight:tsaOk?400:700}}>{t.tsa||"—"}</span>,
                    <Badge label={t.resultado} color={t.resultado==="APROBADO"?T.success:T.danger}/>,
                    <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                      {perfil.rol==="administrador" && t.resultado==="RECHAZADO" && t.viaje_id && (()=>{
                        const viaje = viajes.find(v=>v.id===t.viaje_id);
                        if (!viaje || viaje.estado==="Descargado") return null;
                        const autorizado = viaje.autorizado_descargue;
                        return (
                          <button onClick={async()=>{
                            await dbCall({ table:"viajes", op:"update", data:{autorizado_descargue:!autorizado, autorizado_por: !autorizado?perfil.nombre:null}, filters:[{col:"id",val:t.viaje_id}] });
                            await loadData();
                            showToast(!autorizado?"Descargue autorizado ✔":"Autorización retirada", !autorizado);
                          }} style={{background:autorizado?`${T.danger}22`:`${T.orange}22`,border:`1px solid ${autorizado?`${T.danger}55`:`${T.orange}55`}`,borderRadius:6,color:autorizado?T.danger:T.orange,padding:"3px 8px",fontSize:11,cursor:"pointer",fontWeight:700,whiteSpace:"nowrap"}}>
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
          {nav==="pbs" && (()=>{
            /* ── PBS DIGITAL (reservado para implementación futura) ──────────────────
             * Todo el sistema PBS completo (checklist 27 puntos, modal, tabla, guardarPBS)
             * está preservado en el código. Para activarlo, reemplazar este bloque por
             * la vista completa que está comentada abajo.
             * ─────────────────────────────────────────────────────────────────────── */
            const [pbsNumeroManual, setPbsNumeroManual] = React.useState("");
            return (
            <div style={{maxWidth:480}}>
              <div style={{fontWeight:800,fontSize:20,color:T.navy,marginBottom:4}}>Permiso de Bombeo Seguro</div>
              <div style={{fontSize:12,color:T.muted,marginBottom:28}}>El PBS se gestiona de forma manual. Registra aquí el número de PBS para trazabilidad.</div>
              <Card style={{padding:24}}>
                <div style={{fontSize:12,fontWeight:700,color:T.muted,marginBottom:8,textTransform:"uppercase",letterSpacing:0.5}}>Número de PBS</div>
                <div style={{display:"flex",gap:10,alignItems:"center"}}>
                  <input
                    value={pbsNumeroManual}
                    onChange={e=>setPbsNumeroManual(e.target.value)}
                    placeholder="Ej: PBS-2026-001"
                    style={{flex:1,padding:"10px 14px",border:`1.5px solid ${T.border}`,borderRadius:8,fontSize:14,color:T.text,background:T.card,outline:"none",fontFamily:"monospace"}}
                  />
                  <button
                    disabled={!pbsNumeroManual.trim()}
                    onClick={()=>{navigator.clipboard?.writeText(pbsNumeroManual);showToast(`PBS ${pbsNumeroManual} registrado`);}}
                    style={{background:pbsNumeroManual.trim()?T.navy:"#ccc",color:"#fff",border:"none",borderRadius:8,padding:"10px 20px",fontWeight:700,fontSize:13,cursor:pbsNumeroManual.trim()?"pointer":"not-allowed"}}>
                    Registrar
                  </button>
                </div>
                {pbsList.length>0 && (
                  <div style={{marginTop:20,paddingTop:16,borderTop:`1px solid ${T.border}`}}>
                    <div style={{fontSize:11,color:T.muted,fontWeight:700,marginBottom:8,textTransform:"uppercase",letterSpacing:0.5}}>Últimos PBS registrados</div>
                    {pbsList.slice(0,5).map(p=>(
                      <div key={p.id} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:`1px solid ${T.border}55`,fontSize:12}}>
                        <span style={{color:"#fb923c",fontFamily:"monospace",fontWeight:700}}>{p.id}</span>
                        <span style={{color:T.muted}}>{p.fecha}</span>
                        <span style={{color:T.text}}>{p.producto||"—"}</span>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>
            );
          })()}

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
                    onClick={()=>{
                    const esAdmin = ["administrador","gerencia"].includes(perfil.rol);
                    const sede = esAdmin ? (sedeFiltro!=="TODAS"?sedeFiltro:"MALAMBO") : (perfil.sede||"MALAMBO");
                    if (activeTab?.type === 'form') { tabStateCache.current[activeTabId] = captureFormState(); }
                    const newTabId = `form-cmt-${Date.now()}`;
                    const newCmtState = {
                      form: {sede, fecha:today()},
                      cmtAntes: [{tanque:'',sonda:'',galones:''}],
                      cmtDespues: [{tanque:'',producto:'',sonda:'',galones:''}],
                      cmtCarros: [{placa:'',guia:'',tiquete:'',pbs_id:''}],
                      cmtProducto: '',
                      cmtRecepcion: [{tanque:'',sondaInicial:'',tempInicial:'',apiInicial:'',galonesInicial:'',sondaFinal:'',tempFinal:'',apiFinal:'',galonesFinal:''}],
                      cmtPorteoCargaPlanta: '', cmtPorteoDescargaPlanta: '',
                      cmtPorteoCarga: [{tanque:'',sondaInicial:'',tempInicial:'',apiInicial:'',galonesInicial:'',sondaFinal:'',tempFinal:'',apiFinal:'',galonesFinal:''}],
                      cmtPorteoDescarga: [{tanque:'',sondaInicial:'',tempInicial:'',apiInicial:'',galonesInicial:'',sondaFinal:'',tempFinal:'',apiFinal:'',galonesFinal:''}],
                      cmtPorteoCarros: [{placa:'',transportadora:'',hora_inicio_cargue:'',hora_final_cargue:'',numero_pbs:'',galones_contador:'',peso_ingreso:'',peso_salida:'',galones_bascula:''}],
                      pbsChecklist: Array(26).fill(''), pbsParaCarro: null, pbsEsTrasiego: false, cmtSnapshot: null,
                    };
                    tabStateCache.current[newTabId] = newCmtState;
                    setTabs(prev => [...prev, { id: newTabId, type:'form', formType:'cmt', title: 'Nuevo CMT', icon:'📋', closeable: true }]);
                    setActiveTabId(newTabId);
                    restoreFormState(newCmtState);
                  }}>+ Nuevo CMT</Btn>}
                </div>
              </div>


              {/* Aviso prominente cuando no hay sede seleccionada (solo admin/gerencia) */}
              {["administrador","gerencia"].includes(perfil.rol) && ((!sedeFiltro||sedeFiltro==="TODAS") || (sedeFiltro==="MALAMBO"&&!plantaFiltro)) && (
                <div style={{background:`${T.navy}18`,border:`2px solid ${T.orange}`,borderRadius:12,padding:"20px 24px",marginBottom:20,display:"flex",alignItems:"flex-start",gap:16}}>
                  <div style={{fontSize:28,lineHeight:1}}>📍</div>
                  <div>
                    {(!sedeFiltro||sedeFiltro==="TODAS") ? (<>
                      <div style={{fontWeight:800,fontSize:15,color:T.navy,marginBottom:6}}>Paso 1 — Seleccione la sede donde va a trabajar</div>
                      <div style={{fontSize:13,color:T.text,lineHeight:1.6}}>
                        Use el selector <b style={{color:T.orange}}>"Sede"</b> arriba a la derecha para elegir entre {SEDES.join(", ")}.<br/>
                        <span style={{fontSize:11,color:T.muted,marginTop:4,display:"block"}}>Cada CMT queda registrado en la sede donde se realizó el movimiento. Esto no se puede cambiar después.</span>
                      </div>
                    </>) : (<>
                      <div style={{fontWeight:800,fontSize:15,color:T.navy,marginBottom:6}}>Paso 2 — Seleccione la planta dentro de MALAMBO</div>
                      <div style={{fontSize:13,color:T.text,lineHeight:1.6}}>
                        MALAMBO tiene dos plantas de recibo. Use el selector <b style={{color:T.orange}}>"Planta"</b> para elegir entre {PLANTAS.join(" o ")}.<br/>
                        <span style={{fontSize:11,color:T.muted,marginTop:4,display:"block"}}>El número del CMT cambia según la planta elegida (MAL1 o MAL2). Esto garantiza trazabilidad exacta del movimiento.</span>
                      </div>
                    </>)}
                  </div>
                </div>
              )}

              {(()=>{
                const tiposUnicos = [...new Set(cmts.map(c=>(c.tipo_operacion||"").toUpperCase().trim()).filter(Boolean))];
                const cmtsFinal = cmtsFiltrados.filter(c=>{
                  const q = cmtBusqueda.toUpperCase();
                  const matchQ = !q || (c.numero_cmt||c.id||"").toUpperCase().includes(q) || (c.operador||"").toUpperCase().includes(q) || (c.producto||"").toUpperCase().includes(q) || (c.placa||"").toUpperCase().includes(q);
                  const matchTipo = !cmtFiltroTipo || (c.tipo_operacion||"").toUpperCase().trim()===cmtFiltroTipo;
                  const matchFD = !cmtFiltroFechaD || (c.fecha||"")>=cmtFiltroFechaD;
                  const matchFH = !cmtFiltroFechaH || (c.fecha||"")<=cmtFiltroFechaH;
                  return matchQ && matchTipo && matchFD && matchFH;
                });
                const thStyle = {padding:"10px 12px",fontSize:10,color:T.navy,textTransform:"uppercase",letterSpacing:1,fontWeight:700,borderBottom:`2px solid ${T.border}`,whiteSpace:"nowrap",textAlign:"left",background:T.bg,position:"sticky",top:0,zIndex:2};
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
                      <button onClick={()=>setCmtVistaCarros(v=>!v)} style={{background:cmtVistaCarros?`${T.navy}22`:`${T.muted}15`,border:`1px solid ${cmtVistaCarros?T.navy:T.border}`,borderRadius:8,color:cmtVistaCarros?T.navy:T.muted,padding:"6px 14px",fontSize:11,cursor:"pointer",fontWeight:700}}>
                        {cmtVistaCarros?"▦ Ver CMTs":"🚛 Ver Carros"}
                      </button>
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
                      }} style={{background:`${T.success}22`,border:`1px solid ${T.success}55`,borderRadius:8,color:T.success,padding:"6px 14px",fontSize:11,cursor:"pointer",fontFamily:"monospace",fontWeight:700,display:"flex",alignItems:"center",gap:6}}>
                        ⬇ Exportar Excel
                      </button>
                    </div>
                  </div>
                  {cmtVistaCarros ? (()=>{
                    // Vista por carros: flatten todos los carros de todos los CMTs filtrados
                    const todosCarros = cmtsFinal.flatMap(cmt=>{
                      const reg = (cmt.carros||[]).filter(cr=>cr.placa).map(cr=>({
                        cmt: cmt.numero_cmt||cmt.id, fecha: cmt.fecha, tipo: cmt.tipo_operacion,
                        sede: cmt.sede, planta: cmt.planta, producto: cmt.producto,
                        placa: cr.placa, guia: cr.guia||"", tiquete: cr.tiquete||"",
                        hora_inicio: cr.hora_inicio||"", hora_final: cr.hora_final||"",
                        peso_ingreso: Number(cr.peso_ingreso||0), peso_salida: Number(cr.peso_salida||0),
                        peso_neto: Number(cr.peso_neto||0)||Math.max(0,Number(cr.peso_ingreso||0)-Number(cr.peso_salida||0)),
                        gls_guia: Number(cr.galones_guia||0), gls_bascula: (()=>{
                          if (Number(cr.galones_bascula||0) > 0) return Number(cr.galones_bascula);
                          const tiq = tiquetes.find(t=>t.id===cr.tiquete);
                          const factor = Number(tiq?.factor_tabla13||0);
                          const pn = Number(cr.peso_neto||0)||Math.max(0,Number(cr.peso_ingreso||0)-Number(cr.peso_salida||0));
                          return factor>0 && pn>0 ? Math.round(pn/factor) : 0;
                        })(),
                      }));
                      const porteo = (cmt.porteo_carros||[]).filter(cr=>cr.placa).map(cr=>({
                        cmt: cmt.numero_cmt||cmt.id, fecha: cmt.fecha, tipo: cmt.tipo_operacion,
                        sede: cmt.sede, planta: cmt.planta, producto: cmt.producto,
                        placa: cr.placa, guia: "", tiquete: "",
                        hora_inicio: cr.hora_inicio_cargue||"", hora_final: cr.hora_final_cargue||"",
                        peso_ingreso: Number(cr.peso_ingreso||0), peso_salida: Number(cr.peso_salida||0),
                        peso_neto: Math.max(0,Number(cr.peso_ingreso||0)-Number(cr.peso_salida||0)),
                        gls_guia: Number(cr.galones_contador||0), gls_bascula: Number(cr.galones_bascula||0),
                      }));
                      return [...reg,...porteo];
                    });
                    const totalPesoNeto = todosCarros.reduce((a,r)=>a+r.peso_neto,0);
                    const totalGlsBascula = todosCarros.reduce((a,r)=>a+r.gls_bascula,0);
                    const totalGlsGuia = todosCarros.reduce((a,r)=>a+r.gls_guia,0);
                    return (
                      <div>
                        <div style={{fontSize:11,color:T.muted,marginBottom:8}}>{todosCarros.length} carro(s) encontrados</div>
                        <div data-scroll-key="trazabilidad-carros" style={{overflow:"auto",maxHeight:"calc(100vh - 280px)",borderRadius:8,border:`1px solid ${T.border}`}}>
                        <table style={{width:"100%",borderCollapse:"collapse",background:T.card}}>
                          <thead>
                            <tr style={{background:T.bg}}>
                              {["N° CMT","Fecha","Tipo","Sede","Planta","Producto","Placa","Guía","Tiquete","H. Inicio","H. Final","Peso Ing.","Peso Sal.","Peso Neto","Gls Guía","Gls Báscula"].map(h=>(
                                <th key={h} style={{padding:"9px 10px",fontSize:10,color:T.navy,textTransform:"uppercase",letterSpacing:1,fontWeight:700,borderBottom:`2px solid ${T.border}`,whiteSpace:"nowrap",textAlign:"left",background:T.bg,position:"sticky",top:0,zIndex:2}}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {todosCarros.map((r,i)=>(
                              <tr key={i} style={{background:i%2===0?T.card:"transparent"}}>
                                <td style={{padding:"8px 10px",fontSize:11,fontFamily:"monospace",borderBottom:`1px solid ${T.border}`,color:T.navy,fontWeight:700}}>{r.cmt}</td>
                                <td style={{padding:"8px 10px",fontSize:11,fontFamily:"monospace",borderBottom:`1px solid ${T.border}`}}>{r.fecha}</td>
                                <td style={{padding:"8px 10px",fontSize:11,borderBottom:`1px solid ${T.border}`,color:T.muted,whiteSpace:"nowrap"}}>{r.tipo}</td>
                                <td style={{padding:"8px 10px",fontSize:11,borderBottom:`1px solid ${T.border}`,color:T.muted}}>{r.sede}</td>
                                <td style={{padding:"8px 10px",fontSize:11,borderBottom:`1px solid ${T.border}`,color:T.muted}}>{r.planta}</td>
                                <td style={{padding:"8px 10px",fontSize:11,borderBottom:`1px solid ${T.border}`}}>{r.producto}</td>
                                <td style={{padding:"8px 10px",fontSize:11,fontFamily:"monospace",borderBottom:`1px solid ${T.border}`,fontWeight:700}}>{r.placa}</td>
                                <td style={{padding:"8px 10px",fontSize:11,fontFamily:"monospace",borderBottom:`1px solid ${T.border}`,color:T.muted}}>{r.guia||"—"}</td>
                                <td style={{padding:"8px 10px",fontSize:11,fontFamily:"monospace",borderBottom:`1px solid ${T.border}`,color:T.muted}}>{r.tiquete||"—"}</td>
                                <td style={{padding:"8px 10px",fontSize:11,fontFamily:"monospace",borderBottom:`1px solid ${T.border}`,color:T.muted}}>{r.hora_inicio||"—"}</td>
                                <td style={{padding:"8px 10px",fontSize:11,fontFamily:"monospace",borderBottom:`1px solid ${T.border}`,color:T.muted}}>{r.hora_final||"—"}</td>
                                <td style={{padding:"8px 10px",fontSize:11,fontFamily:"monospace",borderBottom:`1px solid ${T.border}`,textAlign:"right"}}>{r.peso_ingreso>0?fmt(r.peso_ingreso):"—"}</td>
                                <td style={{padding:"8px 10px",fontSize:11,fontFamily:"monospace",borderBottom:`1px solid ${T.border}`,textAlign:"right"}}>{r.peso_salida>0?fmt(r.peso_salida):"—"}</td>
                                <td style={{padding:"8px 10px",fontSize:11,fontFamily:"monospace",borderBottom:`1px solid ${T.border}`,textAlign:"right",color:T.navy,fontWeight:700}}>{r.peso_neto>0?fmt(r.peso_neto):"—"}</td>
                                <td style={{padding:"8px 10px",fontSize:11,fontFamily:"monospace",borderBottom:`1px solid ${T.border}`,textAlign:"right"}}>{r.gls_guia>0?fmt(r.gls_guia):"—"}</td>
                                <td style={{padding:"8px 10px",fontSize:11,fontFamily:"monospace",borderBottom:`1px solid ${T.border}`,textAlign:"right",color:T.success,fontWeight:700}}>{r.gls_bascula>0?fmt(r.gls_bascula):"—"}</td>
                              </tr>
                            ))}
                            {todosCarros.length>0 && (
                              <tr style={{background:`${T.navy}10`,fontWeight:700}}>
                                <td colSpan={11} style={{padding:"8px 10px",fontSize:11,borderTop:`2px solid ${T.border}`,color:T.navy}}>TOTAL ({todosCarros.length} carros)</td>
                                <td colSpan={2} style={{padding:"8px 10px",fontSize:11,borderTop:`2px solid ${T.border}`}}></td>
                                <td style={{padding:"8px 10px",fontSize:11,fontFamily:"monospace",borderTop:`2px solid ${T.border}`,textAlign:"right",color:T.navy}}>{fmt(totalPesoNeto)} kg</td>
                                <td style={{padding:"8px 10px",fontSize:11,fontFamily:"monospace",borderTop:`2px solid ${T.border}`,textAlign:"right"}}>{totalGlsGuia>0?fmt(totalGlsGuia)+" gls":""}</td>
                                <td style={{padding:"8px 10px",fontSize:11,fontFamily:"monospace",borderTop:`2px solid ${T.border}`,textAlign:"right",color:T.success}}>{totalGlsBascula>0?fmt(totalGlsBascula)+" gls":""}</td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                        </div>
                      </div>
                    );
                  })() : <div data-scroll-key="cmt-lista" style={{overflow:"auto",maxHeight:"calc(100vh - 280px)",borderRadius:8,border:`1px solid ${T.border}`}}>
                    <table style={{width:"100%",borderCollapse:"collapse",background:T.card}}>
                      <thead>
                        <tr style={{background:T.bg}}>
                          <th style={thStyle}>N° CMT</th>
                          <th style={thStyle}>OT</th>
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
                          const esPorteo = (c.tipo_operacion||"")==="PORTEO";
                          const cargaTanques = c.porteo_carga_tanques||[];
                          const tanquesNombres = esPorteo
                            ? (cargaTanques[0]?.tanque||"—")
                            : [...new Set([...(c.tanques_antes||[]).map(t=>t.tanque), ...(c.tanques_despues||[]).map(t=>t.tanque)].filter(Boolean))].join(", ");
                          const glsIni = esPorteo ? Number(cargaTanques[0]?.galonesInicial||0) : Number(c.total_antes||0);
                          const glsFin = esPorteo ? Number(cargaTanques[0]?.galonesFinal||0) : Number(c.total_despues||0);
                          const movido = esPorteo ? Math.abs(glsIni - glsFin) : Number(c.total_movido||0);
                          const expandido = cmtExpandido===c.id;
                          const bgRow = expandido ? "#dde6f0" : idx%2===0 ? T.card : "#eef2f7";
                          return (
                          <React.Fragment key={c.id}>
                          <tr onClick={()=>setCmtExpandido(expandido?null:c.id)} style={{cursor:"pointer",background:bgRow,transition:"background 0.15s",borderTop:`1px solid ${T.border}`}} onMouseEnter={e=>{if(!expandido)e.currentTarget.style.background="#dde6f0"}} onMouseLeave={e=>{if(!expandido)e.currentTarget.style.background=bgRow}}>
                            <td style={tdStyle}><span style={{color:T.orange,fontWeight:700,letterSpacing:0.5,cursor:"pointer",textDecoration:"underline"}} onClick={e=>{e.stopPropagation();abrirCmt(c);}}>{c.numero_cmt||c.id}</span></td>
                            <td style={tdStyle}>{c.ot_numero ? <span style={{color:T.orange,fontWeight:600,fontSize:11}}>{c.ot_numero}</span> : <span style={{color:T.muted,fontSize:10}}>Autónomo</span>}</td>
                            <td style={tdStyle}><span style={{color:T.muted}}>{c.fecha}</span></td>
                            <td style={tdStyle}><Badge label={c.tipo_operacion||"—"} color={T.navy}/></td>
                            <td style={tdStyle}><span style={{color:T.navy,fontWeight:600}}>{c.producto||"—"}</span></td>
                            <td style={tdStyle}><span style={{color:T.text,fontSize:11}}>{tanquesNombres||"—"}</span></td>
                            <td style={tdStyle}><span style={{color:T.text}}>{fmt(glsIni)}</span></td>
                            <td style={tdStyle}><span style={{color:T.text}}>{fmt(glsFin)}</span></td>
                            <td style={tdStyle}><span style={{color:T.success,fontWeight:700}}>{fmt(Math.abs(movido))}</span></td>
                            <td style={tdStyle}><span style={{color:T.muted,fontSize:11}}>{c.operador||"—"}</span></td>
                          </tr>
                          {expandido && (
                            <tr>
                              <td colSpan={9} style={{padding:"0 0 2px 0",background:"#f1f5f9",borderBottom:`2px solid ${T.border}`}}>
                                <div style={{padding:"16px 20px",display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
                                  {esPorteo ? (<>
                                    {/* PORTEO — Planta de Cargue */}
                                    <div style={{background:"#ffffff",borderRadius:8,padding:"12px 14px",border:`1px solid ${T.border}`,borderLeft:`3px solid ${T.navy}`}}>
                                      <div style={{fontSize:10,color:T.navy,fontWeight:700,textTransform:"uppercase",letterSpacing:1,marginBottom:2}}>Planta de Cargue</div>
                                      <div style={{fontSize:11,color:T.muted,marginBottom:8}}>{c.porteo_carga_planta||"—"}</div>
                                      {cargaTanques.map((t,i)=>(
                                        <div key={i} style={{marginBottom:8,paddingBottom:8,borderBottom:`1px solid ${T.border}`}}>
                                          <div style={{color:T.navy,fontWeight:700,marginBottom:4}}>{t.tanque||"—"}</div>
                                          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:4,fontSize:11}}>
                                            <div><span style={{color:T.muted}}>Sonda ini: </span><b>{t.sondaInicial||"—"}</b></div>
                                            <div><span style={{color:T.muted}}>Sonda fin: </span><b>{t.sondaFinal||"—"}</b></div>
                                            <div style={{color:T.orange,fontWeight:700}}>{fmt(t.galonesInicial||0)} Gls ini</div>
                                            <div style={{color:T.orange,fontWeight:700}}>{fmt(t.galonesFinal||0)} Gls fin</div>
                                          </div>
                                          <div style={{marginTop:4,fontSize:11,color:T.success,fontWeight:700}}>Salida: {fmt(Math.abs(Number(t.galonesInicial||0)-Number(t.galonesFinal||0)))} Gls</div>
                                        </div>
                                      ))}
                                      {(c.porteo_carros||[]).map((cr,i)=>(
                                        <div key={i} style={{fontSize:11,color:T.muted,marginTop:4}}>
                                          <b style={{color:T.navy}}>{cr.placa||"—"}</b>
                                          {cr.galones_contador&&<span> · Contador: <b style={{color:T.text}}>{fmt(cr.galones_contador)} Gls</b></span>}
                                        </div>
                                      ))}
                                    </div>
                                    {/* PORTEO — Planta de Descargue */}
                                    <div style={{background:"#ffffff",borderRadius:8,padding:"12px 14px",border:`1px solid ${T.border}`,borderLeft:`3px solid ${T.orange}`}}>
                                      <div style={{fontSize:10,color:T.orange,fontWeight:700,textTransform:"uppercase",letterSpacing:1,marginBottom:2}}>Planta de Descargue</div>
                                      <div style={{fontSize:11,color:T.muted,marginBottom:8}}>{c.porteo_descarga_planta||"—"}</div>
                                      {(c.porteo_descarga_tanques||[]).filter(t=>t.tanque).length>0 ? (c.porteo_descarga_tanques||[]).filter(t=>t.tanque).map((t,i)=>(
                                        <div key={i} style={{marginBottom:8,paddingBottom:8,borderBottom:`1px solid ${T.border}`}}>
                                          <div style={{color:T.navy,fontWeight:700,marginBottom:4}}>{t.tanque||"—"}</div>
                                          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:4,fontSize:11}}>
                                            <div><span style={{color:T.muted}}>Sonda ini: </span><b>{t.sondaInicial||"—"}</b></div>
                                            <div><span style={{color:T.muted}}>Sonda fin: </span><b>{t.sondaFinal||"—"}</b></div>
                                            <div style={{color:T.success,fontWeight:700}}>{fmt(t.galonesInicial||0)} Gls ini</div>
                                            <div style={{color:T.success,fontWeight:700}}>{fmt(t.galonesFinal||0)} Gls fin</div>
                                          </div>
                                          {(Number(t.galonesFinal||0)>0) && <div style={{marginTop:4,fontSize:11,color:T.success,fontWeight:700}}>Recibido: {fmt(Math.abs(Number(t.galonesFinal||0)-Number(t.galonesInicial||0)))} Gls</div>}
                                        </div>
                                      )) : (
                                        <div style={{fontSize:11,color:T.muted,fontStyle:"italic",marginTop:8}}>Pendiente de diligenciar en planta de descargue</div>
                                      )}
                                      {(()=>{
                                        const carrosConPlaca = (c.porteo_carros||[]).filter(cr=>cr.placa);
                                        if (!carrosConPlaca.length) return null;
                                        const factorApiV = (c.porteo_carga_tanques||[]).map(r=>Number(r.apiInicial||r.apiFinal||0)).find(a=>a>0)||0;
                                        const factorV = factorApiV>0 ? Number(tabla13Factor(factorApiV)||0) : 0;
                                        return (
                                          <div style={{marginTop:6,paddingTop:6,borderTop:`1px solid ${T.border}`}}>
                                            {carrosConPlaca.map((cr,i)=>{
                                              const pn = Math.max(0, Number(cr.peso_ingreso||0)-Number(cr.peso_salida||0));
                                              const glsBas = Number(cr.galones_bascula||0) || (factorV>0&&pn>0?Math.round(pn/factorV):0);
                                              return (
                                                <div key={i} style={{fontSize:11,color:T.muted,marginTop:4,paddingBottom:4,borderBottom:i<carrosConPlaca.length-1?`1px solid ${T.border}33`:"none"}}>
                                                  <div style={{display:"flex",gap:10,flexWrap:"wrap",alignItems:"center"}}>
                                                    <b style={{color:T.navy}}>{cr.placa}</b>
                                                    {Number(cr.peso_salida)>0&&<span>Báscula: <b style={{color:glsBas?T.success:T.muted}}>{glsBas?`${fmt(glsBas)} Gls`:"—"}</b></span>}
                                                  </div>
                                                </div>
                                              );
                                            })}
                                          </div>
                                        );
                                      })()}
                                    </div>
                                  </>) : (<>
                                  <div style={{background:"#ffffff",borderRadius:8,padding:"12px 14px",border:`1px solid ${T.border}`,borderLeft:`3px solid ${T.navy}`}}>
                                    <div style={{fontSize:10,color:T.navy,fontWeight:700,textTransform:"uppercase",letterSpacing:1,marginBottom:8}}>Medida Inicial</div>
                                    {(c.tanques_antes||[]).map((t,i)=>(
                                      <div key={i} style={{display:"flex",justifyContent:"space-between",fontSize:11,marginBottom:4,paddingBottom:4,borderBottom:`1px solid ${T.border}`}}>
                                        <span style={{color:T.navy,fontWeight:700}}>{t.tanque||"—"}</span>
                                        <span style={{color:T.muted}}>Sonda: {t.sonda||"—"}</span>
                                        <span style={{color:T.orange,fontWeight:700}}>{fmt(t.galones)} Gls</span>
                                      </div>
                                    ))}
                                    <div style={{fontSize:11,color:T.muted,marginTop:4}}>Total: <b style={{color:T.navy}}>{fmt(c.total_antes)} Gls</b></div>
                                  </div>
                                  <div style={{background:"#ffffff",borderRadius:8,padding:"12px 14px",border:`1px solid ${T.border}`,borderLeft:`3px solid ${T.orange}`}}>
                                    <div style={{fontSize:10,color:T.orange,fontWeight:700,textTransform:"uppercase",letterSpacing:1,marginBottom:8}}>Medida Final</div>
                                    {(c.tanques_despues||[]).map((t,i)=>(
                                      <div key={i} style={{display:"flex",justifyContent:"space-between",fontSize:11,marginBottom:4,paddingBottom:4,borderBottom:`1px solid ${T.border}`}}>
                                        <span style={{color:T.navy,fontWeight:700}}>{t.tanque||"—"}</span>
                                        <span style={{color:T.muted}}>Sonda: {t.sonda||"—"}</span>
                                        <span style={{color:T.orange,fontWeight:700}}>{fmt(t.galones)} Gls</span>
                                      </div>
                                    ))}
                                    <div style={{fontSize:11,color:T.muted,marginTop:4}}>Total: <b style={{color:T.navy}}>{fmt(c.total_despues)} Gls</b></div>
                                  </div>
                                  </>)}
                                  {(c.carros||[]).length>0 && (c.tipo_operacion||"")==="DESCARGUE DE CARROTANQUE" && (
                                    <div style={{background:"#ffffff",borderRadius:8,padding:"12px 14px",border:`1px solid ${T.border}`,borderLeft:`3px solid ${T.muted}`,gridColumn:"1/-1"}}>
                                      <div style={{fontSize:10,color:T.muted,fontWeight:700,textTransform:"uppercase",letterSpacing:1,marginBottom:8}}>Carros Descargados</div>
                                      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:8}}>
                                        {(c.carros||[]).map((cr,i)=>(
                                          <div key={i} style={{background:"#f8fafc",borderRadius:8,padding:"8px 10px",fontSize:11,border:`1px solid ${T.border}`}}>
                                            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:3,flexWrap:"wrap"}}>
                                              <span style={{color:T.navy,fontWeight:700}}>{cr.placa||"Sin placa"}</span>
                                              {(()=>{const tq=tiquetes.find(x=>x.id===cr.tiquete);return tq?.producto?<span style={{fontSize:10,background:`${T.orange}18`,color:T.orange,borderRadius:4,padding:"1px 6px",fontWeight:600}}>{tq.producto}</span>:null;})()}
                                            </div>
                                            {cr.tiquete&&<div style={{color:T.navy}}>Tiquete: <span style={{cursor:"pointer",textDecoration:"underline",fontWeight:700}} onClick={()=>{ const t=tiquetes.find(x=>x.id===cr.tiquete); if(t){setForm({...t});setModal("tiquete");} }}>{cr.tiquete}</span></div>}
                                            {cr.guia&&<div style={{color:T.muted}}>Guía: {cr.guia}</div>}
                                            {cr.pbs_id&&<div style={{color:T.orange}}>PBS: <span style={{cursor:"pointer",textDecoration:"underline",fontWeight:700}} onClick={()=>{ const p=(pbsList||[]).find(x=>x.id===cr.pbs_id); if(p){setForm({...p});setPbsChecklist(p.checklist||Array(27).fill(""));setModal("pbs");} }}>{cr.pbs_id}</span></div>}
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
                                              <div style={{color:T.navy,fontSize:10,fontWeight:700,marginBottom:2}}>INICIAL</div>
                                              <div style={{color:T.navy,fontSize:10,fontWeight:700,marginBottom:2}}>FINAL</div>
                                              <div style={{color:T.muted}}>Sonda: <b style={{color:T.navy}}>{r.sondaInicial||"—"}</b></div>
                                              <div style={{color:T.muted}}>Sonda: <b style={{color:T.navy}}>{r.sondaFinal||"—"}</b></div>
                                              <div style={{color:T.muted}}>Temp: <b style={{color:T.navy}}>{r.tempInicial||"—"}</b></div>
                                              <div style={{color:T.muted}}>Temp: <b style={{color:T.navy}}>{r.tempFinal||"—"}</b></div>
                                              <div style={{color:T.orange,fontWeight:700}}>{fmt(r.galonesInicial||0)} Gls</div>
                                              <div style={{color:T.orange,fontWeight:700}}>{fmt(r.galonesFinal||0)} Gls</div>
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
                                    {c.tiquete_entrada&&<span>Tiquete: <b style={{color:T.navy}}>{c.tiquete_entrada}</b></span>}
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
                  </div>}
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
              const domeH = ew * 0.115; // fijo relativo al ancho → misma curvatura en todos los tanques
              const peakY = topY - domeH;

              // Zona interior (descuenta grosor de pared ~2% cada lado)
              const wall  = ew * 0.01;
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
                    {/* Clip baranda amarilla: solo ancho del tanque, altura libre */}
                    <clipPath id={`ry-${label}`}>
                      <rect x={lx} y={topY - domeH - 14} width={ew} height={domeH + 14}/>
                    </clipPath>
                    {/* Clip arco rojo: ancho del tanque, zona topY hasta frente del aro */}
                    <clipPath id={`rr-${label}`}>
                      <rect x={cx} y={topY - 10} width={ew/2} height={eh + 20}/>
                    </clipPath>
                    {/* Clip zona interior: mitad derecha (corte transversal) */}
                    <clipPath id={`ci-${label}`}>
                      <rect x={cx} y={topY} width={iRX} height={cylH+2}/>
                    </clipPath>

                    {/* Gradiente cuerpo: mitad izq negra pura (exterior), mitad der gris (interior) */}
                    <linearGradient id={`cg-${label}`} x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%"   stopColor="#000000"/>
                      <stop offset="49%"  stopColor="#000000"/>
                      <stop offset="51%"  stopColor="#606060"/>
                      <stop offset="89%"  stopColor="#4e4e4e"/>
                      <stop offset="97%"  stopColor="#111111"/>
                      <stop offset="100%" stopColor="#050505"/>
                    </linearGradient>

                    {/* Gradiente gris interior (vacío) - horizontal 3D */}
                    <linearGradient id={`ig-${label}`} x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%"   stopColor="#888888"/>
                      <stop offset="35%"  stopColor="#747474"/>
                      <stop offset="100%" stopColor="#404040"/>
                    </linearGradient>
                    {/* Gradiente vertical interior: oscuro arriba y abajo, claro al centro */}
                    <linearGradient id={`iv-${label}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%"   stopColor="#000000" stopOpacity="0.55"/>
                      <stop offset="18%"  stopColor="#000000" stopOpacity="0.20"/>
                      <stop offset="45%"  stopColor="#000000" stopOpacity="0.0"/>
                      <stop offset="72%"  stopColor="#000000" stopOpacity="0.15"/>
                      <stop offset="100%" stopColor="#000000" stopOpacity="0.60"/>
                    </linearGradient>

                    {/* Gradiente líquido horizontal: crudo viscoso opaco con curvatura 3D */}
                    <linearGradient id={`lg-${label}`} x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%"   stopColor="#000000" stopOpacity="0.70"/>
                      <stop offset="15%"  stopColor="#000000" stopOpacity="0.20"/>
                      <stop offset="50%"  stopColor="#3a1800" stopOpacity="0.10"/>
                      <stop offset="75%"  stopColor="#000000" stopOpacity="0.25"/>
                      <stop offset="100%" stopColor="#000000" stopOpacity="0.75"/>
                    </linearGradient>
                    {/* Superficie crudo: oscura con leve brillo ámbar-metálico, sin transparencia */}
                    <radialGradient id={`ls-${label}`} cx="35%" cy="35%" r="65%">
                      <stop offset="0%"   stopColor="#5c3010" stopOpacity="0.90"/>
                      <stop offset="40%"  stopColor={fc}      stopOpacity="1.00"/>
                      <stop offset="100%" stopColor="#000000" stopOpacity="1.00"/>
                    </radialGradient>

                    {/* Gradiente domo */}
                    <linearGradient id={`dg-${label}`} x1="0" y1="1" x2="0" y2="0">
                      <stop offset="0%"   stopColor="#1a1a1a"/>
                      <stop offset="100%" stopColor="#0a0a0a"/>
                    </linearGradient>

                    {/* Gradiente vertical oscuridad profundidad crudo */}
                    <linearGradient id="vd" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%"   stopColor="#000000" stopOpacity="0.0"/>
                      <stop offset="100%" stopColor="#000000" stopOpacity="0.6"/>
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
                  {/* Sombra curvatura interna: oscurece bordes arriba/abajo simulando cilindro */}
                  <rect x={iLX} y={topY} width={iRX*2} height={cylH} fill={`url(#iv-${label})`} clipPath={`url(#ci-${label})`}/>

                  {/* ── LÍQUIDO (sube desde el fondo) ── */}
                  {pct > 0 && (
                    <g clipPath={`url(#ci-${label})`}>
                      {/* Base sólida del color: crudo oscuro opaco */}
                      <rect x={iLX} y={fillTopY} width={iRX*2} height={fillH+2} fill={fc}/>
                      {/* Gradiente vertical: más oscuro abajo (profundidad) */}
                      <rect x={iLX} y={fillTopY} width={iRX*2} height={fillH+2} fill="url(#vd)" opacity="0.55"/>
                      {/* Gradiente horizontal 3D encima */}
                      <rect x={iLX} y={fillTopY} width={iRX*2} height={fillH+2} fill={`url(#lg-${label})`}/>
                      {/* Superficie del líquido: gradiente radial más claro, diferente al frente */}
                      <ellipse cx={cx} cy={fillTopY} rx={iRX} ry={eh*0.34} fill={`url(#ls-${label})`}/>
                      {/* Menisco: borde oscuro perimetral de la superficie */}
                      <ellipse cx={cx} cy={fillTopY} rx={iRX} ry={eh*0.34}
                        fill="none" stroke="#000000" strokeWidth="1.5" opacity="0.35"/>
                      {/* Reflejo especular mínimo: crudo viscoso casi sin brillo */}
                      <rect x={cx-iRX*0.06} y={fillTopY+eh*0.15} width={iRX*0.08} height={fillH*0.3}
                        fill="#7a3a10" opacity="0.12" rx="3"/>
                    </g>
                  )}

                  {/* ── SOMBRA PROFUNDIDAD: simula curvatura interior fondo ── */}
                  <rect x={cx} y={topY} width={iRX} height={cylH}
                    fill={`url(#sd-${label})`} clipPath={`url(#ci-${label})`}/>

                  {/* ── ELIPSE BASE (fondo) ── */}
                  {/* Mitad izquierda base: negro puro */}
                  <path d={`M ${cx},${botY-eh/2} A ${ew/2},${eh/2} 0 0,0 ${lx},${botY} A ${ew/2},${eh/2} 0 0,0 ${cx},${botY+eh/2} Z`} fill="#000000"/>
                  {/* Mitad derecha base: color producto si hay nivel, gris interior si vacío */}
                  <path d={`M ${cx},${botY-eh/2} A ${ew/2},${eh/2} 0 0,1 ${rx},${botY} A ${ew/2},${eh/2} 0 0,1 ${cx},${botY+eh/2} Z`} fill={pct > 0 ? fc : "#686868"}/>

                  {/* ── ARO SUPERIOR ── */}
                  <ellipse cx={cx} cy={topY} rx={ew/2} ry={eh/2} fill="#1a1a1a"/>
                  {/* Semi-elipse izquierda: tapa exactamente la mitad izquierda del aro */}
                  <path d={`M ${cx},${topY-eh/2} A ${ew/2},${eh/2} 0 0,0 ${lx},${topY} A ${ew/2},${eh/2} 0 0,0 ${cx},${topY+eh/2} Z`} fill="#0a0a0a"/>

                  {/* ── DOMO CONVEXO ── */}
                  <path d={domePath} fill={`url(#dg-${label})`}/>
                  <path d={domeOutline} fill="none" stroke="#333" strokeWidth="1.2"/>
                  {/* Reflejo sutil domo */}
                  <path d={`M ${cx-ew*0.22},${topY-domeH*0.28} Q ${cx},${peakY+domeH*0.25} ${cx+ew*0.18},${topY-domeH*0.45}`}
                    fill="none" stroke="#fff" strokeWidth="0.7" opacity="0.05"/>

                  {/* ── BARANDA AMARILLA (encima del domo, borde inferior = topY exacto) ── */}
                  <g clipPath={`url(#ry-${label})`}>
                    {(()=>{ const yw=12.5, half=yw/2;
                      /* misma curva bezier que el domo, desplazada half hacia arriba */
                      const d=`M ${lx},${topY-half} Q ${lx+ew*0.08},${peakY+domeH*0.1-half} ${cx},${peakY-half}`; return (<>
                      <path d={d} fill="none" stroke="#f5c400" strokeWidth={yw} strokeLinecap="round"/>
                      <path d={d} fill="none" stroke="#e8eef4" strokeWidth={yw*0.52}
                        strokeDasharray="11 3" strokeDashoffset="11" strokeLinecap="butt"/>
                    </>); })()}
                  </g>
                  {/* ── ARO ROJO (cuarto derecho, encima del domo) ── */}
                  <g clipPath={`url(#rr-${label})`}>
                    {(()=>{ const rw=7.5; return (
                      <path d={`M ${rx},${topY} A ${ew/2},${eh/2} 0 0,1 ${cx},${topY+eh/2}`}
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
                {label:"Cargue",   val:`${carrosCargue} c`,  color:T.orange, icon:"▲"},
                {label:"Libre",    val:fmt(espLibre),         color:T.success, icon:"◻"},
                {label:"Descargue",val:`${carrosDesc} c`,     color:T.orange, icon:"▼"},
              ];

              // Calcular marginLeft del panel stats para que el gap con el tanque sea consistente
              const cW = id==="TK-111"?312 : id==="TK-112"?315 : (id==="TK-116"||id==="TK-117")?329 : 260;
              const cH = id==="TK-111"?372 : id==="TK-112"?246 : (id==="TK-116"||id==="TK-117")?259 : 204;
              const svgH = id==="TK-111"?432 : id==="TK-112"?363 : 300;
              // Usar H real del SVG para que los ratios coincidan con la geometría del tanque
              const SH=svgH, sew=300*0.86, seh=sew*0.20;
              const sbotY=SH-seh/2-6, scylH=SH*0.52, stopY=sbotY-scylH;
              const aboveRailing = stopY;
              const belowCyl = SH - sbotY;
              const scl = Math.min(cW/300, cH/svgH);
              const rendW = 300*scl;
              const centerOff = (cW - rendW)/2;
              const tankRightPx = 279*scl + centerOff;
              const emptyRight = cW - tankRightPx;
              const statsMargin = -(emptyRight - 24.3);

              return (
                <div style={{ width: id==="TK-111" ? 312 : id==="TK-112" ? 315 : (id==="TK-116"||id==="TK-117") ? 329 : 260, height: id==="TK-111" ? 372 : id==="TK-112" ? 246 : (id==="TK-116"||id==="TK-117") ? 259 : 204, display:"flex", flexDirection:"column", alignItems:"center", flexShrink:0 }}>
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
                            style={{ background:"#0f1e2e", border:`2px solid ${T.navy}`, borderRadius:6,
                              color:"#fff", fontSize:11, fontWeight:700, padding:"3px 8px",
                              width:72, textTransform:"uppercase", outline:"none", textAlign:"center" }}/>
                          {tankProdSaving && <div style={{fontSize:8,color:T.muted,textAlign:"center"}}>guardando...</div>}
                        </div>
                      )}
                    </div>
                    {/* Panel stats vertical alineado con cilindro */}
                    <div style={{ flexShrink:0, width:68, display:"flex", flexDirection:"column", marginLeft:statsMargin }}>
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
                {/* Botón presentación — solo visible fuera de fullscreen */}
                {!fs && (
                  <button onClick={togglePresentation}
                    style={{ position:"absolute", top:10, right:10, zIndex:10, background:"#1e3a5f", border:"none", borderRadius:8,
                      color:"#fff", padding:"6px 12px", cursor:"pointer", fontSize:13, fontWeight:700, display:"flex", alignItems:"center", gap:6, opacity:0.85 }}>
                    ⛶ Presentación
                  </button>
                )}
                {/* Izquierda */}
                <div style={{ position:"absolute", left:58, top:-13 }}><TankCard id="TK-112"/></div>
                <div style={{ position:"absolute", left:58, bottom:8 }}><TankCard id="TK-111"/></div>
                {/* Derecha */}
                <div style={{ position:"absolute", right:68, top:8 }}><TankCard id="TK-117"/></div>
                <div style={{ position:"absolute", right:68, bottom:8 }}><TankCard id="TK-116"/></div>
                {/* Centro — escalonados */}
                <div style={{ position:"absolute", left:"calc(50% - 130px)", top:0 }}><TankCard id="TK-115"/></div>
                <div style={{ position:"absolute", left:"calc(50% - 130px)", top:"calc(50% - 102px)" }}><TankCard id="TK-114"/></div>
                <div style={{ position:"absolute", left:"calc(50% - 130px)", top:"calc(90% - 204px + 50px)" }}><TankCard id="TK-113"/></div>
              </div>
            );

            return (
              <>
                {/* Contenedor fullscreen nativo */}
                <div ref={fsContainerRef} style={{ display: tankFullscreen ? "flex" : "none", flexDirection:"column", position:"fixed", inset:0, zIndex:9999, background:"#e8eef4" }}>
                  {/* Header BunkersGest en modo presentación */}
                  <div style={{ background:T.navy, borderBottom:`3px solid ${T.orange}`, padding:"0 24px", height:64, display:"flex", alignItems:"center", justifyContent:"space-between", flexShrink:0 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:14 }}>
                      <span style={{ fontSize:28 }}>🚢</span>
                      <div>
                        <div style={{ fontWeight:800, fontSize:18, color:"#ffffff", letterSpacing:2 }}>BunkersGest <span style={{color:T.orange, fontSize:12, fontWeight:700}}>v2.0</span></div>
                        <div style={{ fontSize:9, color:"#ffffff66", letterSpacing:2, textTransform:"uppercase" }}>Sistema de Gestión Operativa · Combustible Marino</div>
                      </div>
                    </div>
                  </div>
                  <div style={{ flex:1, overflow:"hidden" }}>
                    {tankFullscreen && <TanquesLayout fs={true}/>}
                  </div>
                </div>
                <div style={{ height:"calc(100vh - 118px)", display:"flex", flexDirection:"column" }}>
                  <TanquesLayout fs={false}/>
                </div>
              </>
            );
          })()}

          {/* TANQUES PLANTA 1 — Barcaza QBS002 */}
          {nav==="tanques_p1" && (()=>{
            const BABOR    = ["QBS002-1B","QBS002-2B","QBS002-3B","QBS002-4B","QBS002-5B"];
            const ESTRIBOR = ["QBS002-1E","QBS002-2E","QBS002-3E","QBS002-4E","QBS002-5E"];
            const REMANENTE = 4500;
            const CARROS    = 9200;
            // Capacidades reales de tablas de aforo QBS002 (galones)
            const CAP_QBS002 = {
              "QBS002-1B":26903,"QBS002-1E":26903,
              "QBS002-2B":47238,"QBS002-2E":47415,
              "QBS002-3B":26874,"QBS002-3E":26874,
              "QBS002-4B":47110,"QBS002-4E":47144,
              "QBS002-5B":27194,"QBS002-5E":26935,
            };
            const byId = id => tanques.find(t => t.id === id) || { id, nivel:0, capacidad: CAP_QBS002[id]||27000, producto:"—" };
            const capOp = t => Math.round((t.capacidad||100000) * 0.9);

            const guardarProductoTanque2 = async (tkId, nuevo) => {
              setTankProdEdit(p => p ? {...p, saving:true} : null);
              const { error } = await supabase.from("tanques").update({ producto: nuevo.toUpperCase() }).eq("id", tkId);
              setTankProdEdit(null);
              if (!error) await loadData();
              else showToast("Error al guardar producto", false);
            };

            const TanqueVertical = ({ id }) => {
              const t      = byId(id);
              const nivel  = Number(t.nivel||0);
              const cap    = Number(t.capacidad || CAP_QBS002[id] || 27000);
              const pct    = cap > 0 ? Math.min(100, Math.round((nivel/cap)*100)) : 0;
              const color  = getProductColor(t.producto);
              const libre  = Math.max(0, capOp(t) - nivel);
              const editando = tankProdEdit?.id === id;
              const pctColor = "#0077CC";
              const h = 140;
              const label = id.replace("QBS002-","");

              return (
                <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:4, flex:1, minWidth:0 }}>
                  {/* Tanque vertical */}
                  <div
                    title={`${label} · ${t.producto||"sin producto"} · ${fmt(nivel)} gls`}
                    onDoubleClick={() => setTankProdEdit({ id, val: t.producto||"" })}
                    style={{ width:"100%", height:h, position:"relative", cursor:"pointer",
                      background:"#c8d6e5", border:"2px solid #7a9dbf",
                      borderRadius:"6px 6px 4px 4px", overflow:"hidden",
                      boxShadow:"inset 0 2px 6px rgba(0,0,0,0.18), 0 2px 6px rgba(0,0,0,0.15)" }}>
                    {/* Relleno desde abajo */}
                    <div style={{ position:"absolute", bottom:0, left:0, right:0,
                      height:`${pct}%`, background: color || "#3d7ab5",
                      transition:"height 0.6s ease", opacity:0.85,
                      borderRadius:"0 0 3px 3px" }}/>
                    {/* Línea de nivel */}
                    {pct > 0 && pct < 100 && (
                      <div style={{ position:"absolute", left:0, right:0,
                        bottom:`${pct}%`, height:2,
                        background:"rgba(255,255,255,0.6)", pointerEvents:"none" }}/>
                    )}
                    {/* % badge */}
                    <div style={{ position:"absolute", top:4, left:0, right:0, textAlign:"center" }}>
                      <span style={{ fontSize:11, fontWeight:900, color:pctColor,
                        textShadow:"0 1px 2px rgba(0,0,0,0.5)", fontFamily:"monospace" }}>{pct}%</span>
                    </div>
                    {/* Producto editable */}
                    <div style={{ position:"absolute", bottom:6, left:2, right:2, textAlign:"center" }}>
                      {editando ? (
                        <input autoFocus value={tankProdEdit.val}
                          onChange={e => setTankProdEdit({ id, val:e.target.value })}
                          onKeyDown={e=>{ if(e.key==="Enter") guardarProductoTanque2(id, tankProdEdit.val); if(e.key==="Escape") setTankProdEdit(null); }}
                          onBlur={() => guardarProductoTanque2(id, tankProdEdit.val)}
                          style={{ background:"rgba(0,0,0,0.65)", border:`1px solid ${T.orange}`, borderRadius:3,
                            color:"#fff", fontSize:9, fontWeight:700, padding:"1px 4px", width:"90%",
                            textTransform:"uppercase", outline:"none", textAlign:"center" }}/>
                      ) : (
                        <span style={{ fontSize:9, fontWeight:800,
                          color: (t.producto && t.producto!=="—") ? "#fff" : "rgba(255,255,255,0.45)",
                          textShadow:"0 1px 3px rgba(0,0,0,0.8)", letterSpacing:0.5,
                          display:"block", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                          {t.producto && t.producto !== "—" ? t.producto : "—"}
                        </span>
                      )}
                    </div>
                    {/* Líneas decorativas de refuerzo */}
                    {[25,50,75].map(p => (
                      <div key={p} style={{ position:"absolute", left:0, right:0, bottom:`${p}%`,
                        height:1, background:"rgba(0,0,0,0.08)", pointerEvents:"none" }}/>
                    ))}
                  </div>
                  {/* Etiqueta y stats */}
                  <div style={{ width:"100%", textAlign:"center" }}>
                    <div style={{ fontWeight:900, fontSize:12, color:"#fff",
                      fontFamily:"monospace", letterSpacing:1, background:"rgba(0,0,0,0.35)",
                      borderRadius:4, padding:"1px 4px", display:"inline-block", marginBottom:2 }}>{label}</div>
                    <div style={{ fontSize:9, color:"rgba(255,255,255,0.75)", fontFamily:"monospace", lineHeight:1.3 }}>
                      <div>{fmt(nivel)} gls</div>
                      <div style={{ color:"#6ee7b7" }}>{fmt(libre)} libre</div>
                    </div>
                  </div>
                </div>
              );
            };

            const totalNivel = [...BABOR,...ESTRIBOR].reduce((a,id)=>a+Number(byId(id).nivel||0),0);
            const totalLibre = [...BABOR,...ESTRIBOR].reduce((a,id)=>{ const t=byId(id); return a+Math.max(0,capOp(t)-Number(t.nivel||0)); },0);

            // Colores de banda lateral para orientación
            const BAND_E = "#1e6fa8";
            const BAND_B = "#0d3d5c";

            return (
              <div style={{ padding:"16px 20px" }}>
                {/* Header */}
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16 }}>
                  <div>
                    <div style={{ fontWeight:900, fontSize:20, color:T.navy, display:"flex", alignItems:"center", gap:8 }}><Ship size={20}/>Planta 1 — Barcaza QBS002</div>
                    <div style={{ fontSize:11, color:T.muted }}>10 tanques · Estribor (E) proa · Babor (B) popa · doble-clic para editar producto</div>
                  </div>
                  <div style={{ display:"flex", gap:10 }}>
                    <div style={{ background:T.navy, borderRadius:10, padding:"8px 16px", textAlign:"center" }}>
                      <div style={{ fontSize:9, color:"rgba(255,255,255,0.55)", fontWeight:700, letterSpacing:1.2, textTransform:"uppercase" }}>Stock</div>
                      <div style={{ fontSize:16, fontWeight:900, color:T.orange, fontFamily:"monospace" }}>{fmt(totalNivel)} gls</div>
                    </div>
                    <div style={{ background:"#0d3d5c", borderRadius:10, padding:"8px 16px", textAlign:"center" }}>
                      <div style={{ fontSize:9, color:"rgba(255,255,255,0.55)", fontWeight:700, letterSpacing:1.2, textTransform:"uppercase" }}>Libre</div>
                      <div style={{ fontSize:16, fontWeight:900, color:"#6ee7b7", fontFamily:"monospace" }}>{fmt(totalLibre)} gls</div>
                    </div>
                  </div>
                </div>

                {/* BARCAZA QBS002 */}
                <div style={{
                  background:"linear-gradient(180deg,#0d2136 0%,#0f2a42 60%,#0d2136 100%)",
                  borderRadius:"18px 18px 40px 40px",
                  border:"3px solid #1a4a6e",
                  boxShadow:"0 8px 32px rgba(0,0,0,0.45), inset 0 0 40px rgba(0,0,0,0.3)",
                  padding:"0 0 20px 0",
                  position:"relative",
                  overflow:"hidden"
                }}>
                  {/* Placa nombre barcaza */}
                  <div style={{ textAlign:"center", padding:"10px 0 6px",
                    borderBottom:"2px solid #1a4a6e", marginBottom:4 }}>
                    <span style={{ fontWeight:900, fontSize:13, color:"#7ec8e3",
                      letterSpacing:4, textTransform:"uppercase", fontFamily:"monospace", display:"flex", alignItems:"center", gap:5 }}><Anchor size={13}/>QBS002</span>
                  </div>

                  {/* ESTRIBOR (E) — fila superior */}
                  <div style={{ padding:"10px 16px 6px" }}>
                    <div style={{ display:"flex", alignItems:"center", marginBottom:8 }}>
                      <div style={{ width:10, height:"100%", alignSelf:"stretch", background:BAND_E,
                        borderRadius:3, marginRight:8, minHeight:16 }}/>
                      <span style={{ fontWeight:800, fontSize:10, color:"#7ec8e3",
                        letterSpacing:2, textTransform:"uppercase" }}>Estribor (E)</span>
                      <span style={{ marginLeft:"auto", fontSize:10, color:"rgba(255,255,255,0.5)",
                        fontFamily:"monospace" }}>{fmt(ESTRIBOR.reduce((a,id)=>a+Number(byId(id).nivel||0),0))} gls</span>
                    </div>
                    <div style={{ display:"flex", gap:8, alignItems:"flex-end" }}>
                      {ESTRIBOR.map(id => <TanqueVertical key={id} id={id}/>)}
                    </div>
                  </div>

                  {/* Separador central */}
                  <div style={{ height:2, background:"linear-gradient(90deg,transparent,#1a4a6e 20%,#2a6a9e 50%,#1a4a6e 80%,transparent)",
                    margin:"8px 16px" }}/>

                  {/* BABOR (B) — fila inferior */}
                  <div style={{ padding:"6px 16px 0" }}>
                    <div style={{ display:"flex", alignItems:"center", marginBottom:8 }}>
                      <div style={{ width:10, height:"100%", alignSelf:"stretch", background:BAND_B,
                        borderRadius:3, marginRight:8, minHeight:16 }}/>
                      <span style={{ fontWeight:800, fontSize:10, color:"#93c5fd",
                        letterSpacing:2, textTransform:"uppercase" }}>Babor (B)</span>
                      <span style={{ marginLeft:"auto", fontSize:10, color:"rgba(255,255,255,0.5)",
                        fontFamily:"monospace" }}>{fmt(BABOR.reduce((a,id)=>a+Number(byId(id).nivel||0),0))} gls</span>
                    </div>
                    <div style={{ display:"flex", gap:8, alignItems:"flex-end" }}>
                      {BABOR.map(id => <TanqueVertical key={id} id={id}/>)}
                    </div>
                  </div>

                  {/* Decoración casco */}
                  <div style={{ position:"absolute", bottom:0, left:0, right:0, height:8,
                    background:"linear-gradient(90deg,#0a1e30,#1a4a6e 30%,#2a6a9e 50%,#1a4a6e 70%,#0a1e30)",
                    borderRadius:"0 0 38px 38px" }}/>
                </div>

                {/* TANQUES TIERRA — TKT-1 y TKT-2 */}
                {(()=>{
                  const TIERRA = ["TKT-1","TKT-2"];
                  const CAP_TIERRA = { "TKT-1": 16021, "TKT-2": 16021 };
                  const byIdT = id => tanques.find(t=>t.id===id) || { id, nivel:0, capacidad:CAP_TIERRA[id]||16021, producto:"—" };
                  const REMANENTE_T = 2000;

                  const TanqueTierra = ({ id }) => {
                    const t      = byIdT(id);
                    const nivel  = Number(t.nivel||0);
                    const cap    = Number(t.capacidad||16021);
                    const pct    = cap > 0 ? Math.min(100, Math.round((nivel/cap)*100)) : 0;
                    const color  = getProductColor(t.producto);
                    const capOp_ = Math.round(cap * 0.9);
                    const libre  = Math.max(0, capOp_ - nivel);
                    const editando = tankProdEdit?.id === id;
                    const pctColor = "#0077CC";
                    const label = id;

                    return (
                      <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:4, flex:1, minWidth:0 }}>
                        <div
                          title={`${label} · ${t.producto||"sin producto"} · ${fmt(nivel)} gls`}
                          onDoubleClick={() => setTankProdEdit({ id, val: t.producto||"" })}
                          style={{ width:"100%", height:140, position:"relative", cursor:"pointer",
                            background:"#c8d6e5", border:"2px solid #7a9dbf",
                            borderRadius:"6px 6px 4px 4px", overflow:"hidden",
                            boxShadow:"inset 0 2px 6px rgba(0,0,0,0.18), 0 2px 6px rgba(0,0,0,0.12)" }}>
                          <div style={{ position:"absolute", bottom:0, left:0, right:0,
                            height:`${pct}%`, background: color || "#8a6a20",
                            transition:"height 0.6s ease", opacity:0.85, borderRadius:"0 0 3px 3px" }}/>
                          {pct > 0 && pct < 100 && (
                            <div style={{ position:"absolute", left:0, right:0, bottom:`${pct}%`,
                              height:2, background:"rgba(255,255,255,0.5)", pointerEvents:"none" }}/>
                          )}
                          <div style={{ position:"absolute", top:4, left:0, right:0, textAlign:"center" }}>
                            <span style={{ fontSize:11, fontWeight:900, color:pctColor,
                              textShadow:"0 1px 2px rgba(0,0,0,0.5)", fontFamily:"monospace" }}>{pct}%</span>
                          </div>
                          <div style={{ position:"absolute", bottom:6, left:2, right:2, textAlign:"center" }}>
                            {editando ? (
                              <input autoFocus value={tankProdEdit.val}
                                onChange={e => setTankProdEdit({ id, val:e.target.value })}
                                onKeyDown={e=>{ if(e.key==="Enter") guardarProductoTanque2(id, tankProdEdit.val); if(e.key==="Escape") setTankProdEdit(null); }}
                                onBlur={() => guardarProductoTanque2(id, tankProdEdit.val)}
                                style={{ background:"rgba(0,0,0,0.65)", border:`1px solid ${T.orange}`, borderRadius:3,
                                  color:"#fff", fontSize:9, fontWeight:700, padding:"1px 4px", width:"90%",
                                  textTransform:"uppercase", outline:"none", textAlign:"center" }}/>
                            ) : (
                              <span style={{ fontSize:9, fontWeight:800,
                                color: (t.producto && t.producto!=="—") ? "#fff" : "rgba(0,0,0,0.3)",
                                textShadow:"0 1px 3px rgba(0,0,0,0.6)", letterSpacing:0.5,
                                display:"block", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                                {t.producto && t.producto !== "—" ? t.producto : "—"}
                              </span>
                            )}
                          </div>
                          {[25,50,75].map(p => (
                            <div key={p} style={{ position:"absolute", left:0, right:0, bottom:`${p}%`,
                              height:1, background:"rgba(0,0,0,0.1)", pointerEvents:"none" }}/>
                          ))}
                        </div>
                        <div style={{ width:"100%", textAlign:"center" }}>
                          <div style={{ fontWeight:900, fontSize:12, color:"#fff",
                            fontFamily:"monospace", letterSpacing:1, background:"rgba(0,0,0,0.35)",
                            borderRadius:4, padding:"1px 4px", display:"inline-block", marginBottom:2 }}>{label}</div>
                          <div style={{ fontSize:9, color:"rgba(255,255,255,0.75)", fontFamily:"monospace", lineHeight:1.3 }}>
                            <div>{fmt(nivel)} gls</div>
                            <div style={{ color:"#6ee7b7" }}>{fmt(libre)} libre</div>
                          </div>
                        </div>
                      </div>
                    );
                  };

                  const totalTierra = TIERRA.reduce((a,id)=>a+Number(byIdT(id).nivel||0),0);

                  return (
                    <div style={{ marginTop:20,
                      background:T.card, borderRadius:14, border:`2px solid ${T.border}`,
                      boxShadow:"0 2px 10px rgba(0,0,0,0.07)", overflow:"hidden" }}>
                      {/* Header */}
                      <div style={{ background:"linear-gradient(90deg,#0d2136,#1a4a6e)",
                        padding:"10px 16px", display:"flex", alignItems:"center", gap:10 }}>
                        <span style={{ fontSize:18 }}>🏭</span>
                        <div>
                          <div style={{ fontWeight:900, fontSize:12, color:"#7ec8e3", letterSpacing:2, textTransform:"uppercase" }}>Tanques Tierra — Planta 1</div>
                          <div style={{ fontSize:10, color:"rgba(126,200,227,0.6)" }}>TKT-1 · TKT-2 · doble-clic para editar producto</div>
                        </div>
                        <div style={{ marginLeft:"auto", textAlign:"right" }}>
                          <div style={{ fontSize:9, color:"rgba(255,255,255,0.5)", fontWeight:700, letterSpacing:1, textTransform:"uppercase" }}>Stock</div>
                          <div style={{ fontSize:15, fontWeight:900, color:T.orange, fontFamily:"monospace" }}>{fmt(totalTierra)} gls</div>
                        </div>
                      </div>
                      {/* Tanques */}
                      <div style={{ padding:"16px", display:"flex", gap:20 }}>
                        {TIERRA.map(id => <TanqueTierra key={id} id={id}/>)}
                        {/* Espaciador para que no ocupen todo el ancho */}
                        <div style={{ flex:3 }}/>
                      </div>
                    </div>
                  );
                })()}
              </div>
            );
          })()}

          {/* DESPACHO */}
          {nav==="despacho" && (
            <div>
              {/* LISTADO BUQUES */}
              {true && <div>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:22 }}>
                <div>
                  <div style={{ fontWeight:800, fontSize:20, color:T.navy }}>Listado Buques</div>
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
              <div data-scroll-key="despacho-tabla" style={{overflowX:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
                <thead>
                  <tr>{[["ID",90],["Fecha Reg.",90],["MN",140],["ETA",90],["ETD",90],["Agencia",110],["MT VLSO",80],["MT HSFO",80],["MT MGO",80],["Puerto",110],["Horas Op.",80],["Contrato",100],["IMO",100],["Bandera",90],["Ciudad",100],["Estado",100]].map(([c,w])=>{
                    const isNum = ["MT VLSO","MT HSFO","MT MGO","Horas Op."].includes(c);
                    return <th key={c} style={{padding:"12px 16px",fontSize:9,color:T.navy,textTransform:"uppercase",letterSpacing:1,fontWeight:700,borderBottom:`2px solid ${T.border}`,whiteSpace:"nowrap",textAlign:isNum?"center":"left",background:T.bg,minWidth:w}}>{c}</th>;
                  })}</tr>
                </thead>
                <tbody>
                  {despachosFiltrados.filter(d=>d.estado!=="ENTREGADO").map((d,i)=>{
                    const estadoColor = d.estado==="COMPLETADO"?T.success:d.estado==="EN OPERACIÓN"?T.orange:T.muted;
                    return (
                      <tr key={d.id} style={{background:i%2===0?T.bg:T.card,borderBottom:`1px solid ${T.border}`}}>
                        <td style={{padding:"12px 16px",fontFamily:"monospace",fontWeight:700,whiteSpace:"nowrap"}}><span onClick={()=>{setForm({...d});setModal("despacho");}} style={{color:T.primary,cursor:"pointer",textDecoration:"underline",textUnderlineOffset:3}}>{d.id}</span></td>
                        <td style={{padding:"12px 16px",whiteSpace:"nowrap"}}>{d.fecha}</td>
                        <td style={{padding:"12px 16px",fontWeight:700,whiteSpace:"nowrap"}}>{d.buque}</td>
                        <td style={{padding:"12px 16px",whiteSpace:"nowrap"}}>{d.eta||"—"}</td>
                        <td style={{padding:"12px 16px",whiteSpace:"nowrap"}}>{d.etd||"—"}</td>
                        <td style={{padding:"12px 16px",whiteSpace:"nowrap"}}>{d.agencia||"—"}</td>
                        <td style={{padding:"12px 16px",textAlign:"center",whiteSpace:"nowrap"}}>{d.mt_vlso>0?Number(d.mt_vlso).toLocaleString():"—"}</td>
                        <td style={{padding:"12px 16px",textAlign:"center",whiteSpace:"nowrap"}}>{d.mt_hsfo>0?Number(d.mt_hsfo).toLocaleString():"—"}</td>
                        <td style={{padding:"12px 16px",textAlign:"center",whiteSpace:"nowrap"}}>{d.mt_mgo>0?Number(d.mt_mgo).toLocaleString():"—"}</td>
                        <td style={{padding:"12px 16px",whiteSpace:"nowrap"}}>{d.destino||d.puerto||"—"}</td>
                        <td style={{padding:"12px 16px",textAlign:"center",whiteSpace:"nowrap"}}>{d.horas_op>0?d.horas_op:"—"}</td>
                        <td style={{padding:"12px 16px",whiteSpace:"nowrap"}}>{d.contrato||"—"}</td>
                        <td style={{padding:"12px 16px",fontFamily:"monospace",whiteSpace:"nowrap"}}>{d.imo||"—"}</td>
                        <td style={{padding:"12px 16px",whiteSpace:"nowrap"}}>{d.bandera||"—"}</td>
                        <td style={{padding:"12px 16px",whiteSpace:"nowrap"}}>{d.puerto||d.ciudad||"—"}</td>
                        <td style={{padding:"12px 16px",whiteSpace:"nowrap"}}><span style={{background:`${estadoColor}22`,color:estadoColor,padding:"2px 8px",borderRadius:10,fontWeight:700,fontSize:10}}>{d.estado||"PENDIENTE"}</span></td>
                      </tr>
                    );
                  })}
                  {despachosFiltrados.filter(d=>d.estado!=="ENTREGADO").length===0&&<tr><td colSpan={16} style={{padding:"28px",textAlign:"center",color:T.muted,fontSize:12}}>Sin despachos registrados</td></tr>}
                </tbody>
              </table>
              </div>
              </div>}
            </div>
          )}

          {/* DESPACHO — ENTREGA */}
          {nav==="despacho_entrega" && (
            <div>
              <div style={{fontWeight:800,fontSize:20,color:T.navy,marginBottom:4}}>Entrega</div>
              <div style={{fontSize:11,color:T.muted,marginBottom:20}}>Entrega de combustible al buque</div>
              <div data-scroll-key="despacho-entrega-tabla" style={{overflowX:"auto"}}>
                <table style={{width:"100%",borderCollapse:"collapse",fontSize:12,tableLayout:"fixed",minWidth:900}}>
                  <colgroup>
                    <col style={{width:"20%"}}/><col style={{width:"12%"}}/><col style={{width:"12%"}}/><col style={{width:"12%"}}/><col style={{width:"11%"}}/><col style={{width:"11%"}}/><col style={{width:"22%"}}/>
                  </colgroup>
                  <thead>
                    <tr style={{background:T.navy+"18"}}>
                      {[["Buque","left"],["Producto","left"],["Cantidad (MT)","center"],["Puerto","left"],["Contrato","left"],["Estado","left"],["","left"]].map(([c,al])=>(
                        <th key={c} style={{padding:"12px 16px",textAlign:al,fontSize:10,color:T.navy,textTransform:"uppercase",letterSpacing:1,fontWeight:700,borderBottom:`2px solid ${T.border}`}}>{c}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(despachosFiltrados||[]).filter(d=>d.estado!=="ENTREGADO").length===0 && (
                      <tr><td colSpan={7} style={{padding:28,textAlign:"center",color:T.muted,fontSize:12}}>No hay entregas pendientes</td></tr>
                    )}
                    {(despachosFiltrados||[]).filter(d=>d.estado!=="ENTREGADO").flatMap((d,i)=>{
                      const estadoColor = d.estado==="COMPLETADO"?T.success:d.estado==="EN OPERACIÓN"?T.orange:T.muted;
                      const filas = [
                        {prod:"VLSFO", mt:Number(d.mt_vlso||0)},
                        {prod:"HSFO",  mt:Number(d.mt_hsfo||0)},
                        {prod:"MGO",   mt:Number(d.mt_mgo||0)},
                      ].filter(p=>p.mt>0);
                      if(filas.length===0) filas.push({prod:"—", mt:0});
                      return filas.map((p,j)=>(
                        <tr key={`${d.id}-${p.prod}`} style={{borderBottom:`1px solid ${T.border}`,background:i%2===0?T.bg:T.card}}>
                          <td style={{padding:"12px 16px",fontWeight:700,color:T.navy}}>{j===0?(d.buque||"—"):""}</td>
                          <td style={{padding:"12px 16px",fontWeight:600,color:T.text}}>{p.prod}</td>
                          <td style={{padding:"12px 16px",fontWeight:700,fontFamily:"monospace"}}><div style={{textAlign:"center"}}>{p.mt>0?p.mt.toLocaleString():"—"}</div></td>
                          <td style={{padding:"12px 16px",color:T.muted}}>{j===0?(d.destino||d.puerto||"—"):""}</td>
                          <td style={{padding:"12px 16px",color:T.muted}}>{j===0?(d.contrato||"—"):""}</td>
                          <td style={{padding:"12px 16px"}}>{j===0&&<span style={{background:`${estadoColor}22`,color:estadoColor,padding:"2px 8px",borderRadius:10,fontWeight:700,fontSize:10}}>{d.estado||"PENDIENTE"}</span>}</td>
                          <td style={{padding:"12px 16px"}}>
                            <button onClick={()=>openLiquidacionDespachoTab(d, p.prod, p.mt)}
                              style={{padding:"7px 16px",fontWeight:700,fontSize:11,cursor:"pointer",borderRadius:6,
                                border:"1px solid #0077CC",background:"#0077CC",color:"#fff",
                                whiteSpace:"nowrap",transition:"opacity 0.15s"}}
                              onMouseOver={e=>e.currentTarget.style.opacity="0.85"}
                              onMouseOut={e=>e.currentTarget.style.opacity="1"}>
                              📄 Generar Liquidación
                            </button>
                          </td>
                        </tr>
                      ));
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* DESPACHO — HISTORIAL */}
          {nav==="despacho_historial" && (()=>{
            const entregados = (despachosFiltrados||[]).filter(d=>d.estado==="ENTREGADO");
            const thS = {padding:"10px 14px",fontSize:10,color:T.navy,textTransform:"uppercase",letterSpacing:1,fontWeight:700,borderBottom:`2px solid ${T.border}`,background:T.bg,whiteSpace:"nowrap"};
            const tdS = {padding:"10px 14px",fontSize:12,borderBottom:`1px solid ${T.border}`};
            return (
              <div>
                <div style={{fontWeight:800,fontSize:20,color:T.navy,marginBottom:4}}>Historial de Entregas</div>
                <div style={{fontSize:11,color:T.muted,marginBottom:20}}>Buques con entrega completada · <b style={{color:T.orange}}>{entregados.length}</b> registro(s)</div>
                <div data-scroll-key="despacho-historial-tabla" style={{overflowX:"auto"}}>
                  <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                    <thead>
                      <tr>{[["Buque","left"],["IMO","left"],["Producto","left"],["Cantidad (MT)","center"],["Puerto","left"],["Ciudad","left"],["Contrato","left"],["Fecha Entrega","center"],["Estado","center"]].map(([c,al])=>(
                        <th key={c} style={{...thS,textAlign:al}}>{c}</th>
                      ))}</tr>
                    </thead>
                    <tbody>
                      {entregados.length===0 && <tr><td colSpan={9} style={{padding:28,textAlign:"center",color:T.muted,fontSize:12}}>Sin entregas completadas aún</td></tr>}
                      {entregados.flatMap((d,i)=>{
                        const filas=[
                          {prod:"VLSFO",mt:Number(d.mt_vlso||0)},
                          {prod:"HSFO", mt:Number(d.mt_hsfo||0)},
                          {prod:"MGO",  mt:Number(d.mt_mgo||0)},
                        ].filter(p=>p.mt>0);
                        if(filas.length===0) filas.push({prod:"—",mt:0});
                        const bg = i%2===0?T.card:T.bg;
                        return filas.map((p,j)=>(
                          <tr key={`${d.id}-${p.prod}`} style={{background:bg}}>
                            <td style={{...tdS,fontWeight:700}}>{j===0?(
                              <span
                                onClick={async()=>{
                                  const {data:liq}=await supabase.from("liquidaciones_qbs002").select("*").eq("motonave",d.buque).order("created_at",{ascending:false}).limit(1).maybeSingle();
                                  if(liq) setModalLiqDetalle({liq,despacho:d});
                                  else showToast("No se encontró liquidación para este buque",false);
                                }}
                                style={{color:T.orange,cursor:"pointer",textDecoration:"underline",fontWeight:800}}
                              >{d.buque||"—"}</span>
                            ):""}</td>
                            <td style={{...tdS,fontFamily:"monospace",color:T.muted}}>{j===0?(d.imo||"—"):""}</td>
                            <td style={{...tdS}}>{p.prod}</td>
                            <td style={{...tdS,textAlign:"center",fontWeight:700}}>{p.mt>0?p.mt.toLocaleString():"—"}</td>
                            <td style={{...tdS,color:T.muted}}>{j===0?(d.destino||d.puerto||"—"):""}</td>
                            <td style={{...tdS,color:T.muted}}>{j===0?(d.ciudad||"—"):""}</td>
                            <td style={{...tdS,color:T.muted}}>{j===0?(d.contrato||"—"):""}</td>
                            <td style={{...tdS,textAlign:"center",color:T.muted}}>{j===0?(d.fecha_entrega?new Date(d.fecha_entrega+"T12:00:00").toLocaleDateString("es-CO"):"—"):""}</td>
                            <td style={{...tdS,textAlign:"center"}}>{j===0&&<span style={{background:`${T.success}22`,color:T.success,padding:"2px 10px",borderRadius:10,fontWeight:700,fontSize:10}}>ENTREGADO</span>}</td>
                          </tr>
                        ));
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })()}

          {/* TRAZABILIDAD */}
          {nav==="trazabilidad" && (()=>{
            const q = trazBuscar.trim().toUpperCase();
            const thStyle = {padding:"10px 12px",fontSize:9,color:T.navy,textTransform:"uppercase",letterSpacing:1,fontWeight:700,borderBottom:`2px solid ${T.border}`,whiteSpace:"nowrap",textAlign:"left",background:T.bg,position:"sticky",top:0,zIndex:2};
            const tdS = (extra={}) => ({padding:"10px 12px",fontSize:11,whiteSpace:"nowrap",...extra});
            const mono = {fontFamily:"monospace",fontWeight:700};

            // ── DESCARGUE ─────────────────────────────────────────────────
            const filasDescargue = (() => {
              const rows = [];
              (cmts||[]).filter(c=>(c.tipo_operacion||"")==="DESCARGUE DE CARROTANQUE").forEach(cm => {
                const ot = cm.ot_id ? (ordenesTrabaio||[]).find(o=>o.id===cm.ot_id) : null;
                const tanquesDesc = (cm.tanques_despues||[]).filter(t=>t.tanque);
                (cm.carros||[]).forEach(cr => {
                  if (!cr.placa) return;
                  const tq = tiquetes.find(t=>t.id===cr.tiquete || t.placa===cr.placa);
                  const viaje = viajes.find(v=>v.placa===cr.placa || v.id===cr.viaje_id);
                  const pbDirecto = cr.pbs_id || cr.numero_pbs || "";
                  const pb = pbDirecto ? {id:pbDirecto} : pbsList.find(p=>p.placa===cr.placa || p.viaje_id===cr.viaje_id || (tq&&p.viaje_id===tq.viaje_id));
                  const factor = Number(tq?.factor_tabla13||0);
                  const pn = Number(cr.peso_neto||0) || Math.max(0,Number(cr.peso_ingreso||0)-Number(cr.peso_salida||0));
                  const glsBas = Number(cr.galones_bascula||0)||(factor>0&&pn>0?Math.round(pn/factor):0);
                  rows.push({cm,cr,tq,pb,ot,viaje,tanquesDesc,glsBas});
                });
              });
              return rows;
            })();

            const descFiltradas = filasDescargue.filter(({cm,cr,tq,pb,ot,viaje})=>{
              if (trazDesde && cm.fecha < trazDesde) return false;
              if (trazHasta && cm.fecha > trazHasta) return false;
              if (!q) return true;
              return [cr.placa,cm.numero_cmt,tq?.id,pb?.id,ot?.numero_ot,cr.transportadora,viaje?.guia,cm.producto||viaje?.producto]
                .some(v=>(v||"").toUpperCase().includes(q));
            });

            // ── PORTEO ────────────────────────────────────────────────────
            const filasPorteo = (() => {
              const rows = [];
              (cmts||[]).filter(c=>(c.tipo_operacion||"")==="PORTEO").forEach(cm => {
                const ot = cm.ot_id ? (ordenesTrabaio||[]).find(o=>o.id===cm.ot_id) : null;
                const tqsCarga = (cm.porteo_carga_tanques||cm.tanques_antes||[]).filter(t=>t.tanque);
                const tqsDesc  = (cm.porteo_descarga_tanques||cm.tanques_despues||[]).filter(t=>t.tanque);
                (cm.porteo_carros||cm.carros||[]).forEach(cr => {
                  if (!cr.placa) return;
                  rows.push({cm,cr,ot,tqsCarga,tqsDesc});
                });
              });
              return rows;
            })();

            const porteoFiltradas = filasPorteo.filter(({cm,cr,ot})=>{
              if (trazDesde && cm.fecha < trazDesde) return false;
              if (trazHasta && cm.fecha > trazHasta) return false;
              if (!q) return true;
              return [cr.placa,cm.numero_cmt,ot?.numero_ot,cr.transportadora,cr.numero_pbs]
                .some(v=>(v||"").toUpperCase().includes(q));
            });

            const TabBtn = ({id,label,count}) => (
              <button onClick={()=>setTrazEstado(id)} style={{padding:"8px 20px",borderRadius:8,border:"none",fontWeight:700,fontSize:12,cursor:"pointer",
                background:trazEstado===id?T.navy:"transparent",color:trazEstado===id?"#fff":T.muted,
                borderBottom:trazEstado===id?`3px solid ${T.orange}`:"3px solid transparent"}}>
                {label} <span style={{fontSize:10,opacity:0.7}}>({count})</span>
              </button>
            );

            const modoActivo = ["TODOS","Descargado","Rechazado","En Planta","En Tránsito"].includes(trazEstado) ? "DESCARGUE"
              : trazEstado === "PORTEO" ? "PORTEO" : "CARGUE";

            return (
              <div style={{padding:"0 0 20px"}}>
                {/* Header */}
                <div style={{marginBottom:14}}>
                  <div style={{fontWeight:900,fontSize:20,color:T.navy}}>Trazabilidad de Carros</div>
                  <div style={{fontSize:11,color:T.muted}}>Movimientos de producto por carrotanque</div>
                </div>

                {/* Pestañas de modo */}
                <div style={{display:"flex",gap:4,marginBottom:16,borderBottom:`1px solid ${T.border}`,paddingBottom:2}}>
                  <TabBtn id="DESCARGUE" label="Descargue" count={filasDescargue.length}/>
                  <TabBtn id="PORTEO"    label="Porteo"    count={filasPorteo.length}/>
                  <TabBtn id="CARGUE"    label="Cargue"    count={0}/>
                </div>

                {/* Barra de búsqueda, fechas y selector de columnas */}
                <div style={{display:"flex",gap:10,marginBottom:14,flexWrap:"wrap",alignItems:"center",position:"relative"}}>
                  <input placeholder="Buscar placa, CMT, tiquete, PBS, OT, transportadora..." value={trazBuscar}
                    onChange={e=>setTrazBuscar(e.target.value)}
                    style={{flex:1,minWidth:240,background:T.card,border:`1px solid ${T.border}`,borderRadius:8,padding:"8px 14px",color:T.text,fontSize:12,outline:"none"}}/>
                  <input type="date" value={trazDesde} onChange={e=>setTrazDesde(e.target.value)}
                    style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:8,padding:"8px 10px",color:T.text,fontSize:12,outline:"none"}}/>
                  <span style={{color:T.muted,fontSize:11}}>—</span>
                  <input type="date" value={trazHasta} onChange={e=>setTrazHasta(e.target.value)}
                    style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:8,padding:"8px 10px",color:T.text,fontSize:12,outline:"none"}}/>
                  {(trazBuscar||trazDesde||trazHasta) && (
                    <button onClick={()=>{setTrazBuscar("");setTrazDesde("");setTrazHasta("");}}
                      style={{background:"transparent",border:`1px solid ${T.border}`,borderRadius:8,padding:"8px 12px",color:T.muted,fontSize:12,cursor:"pointer"}}>✕</button>
                  )}
                  {/* Botón columnas */}
                  {trazEstado!=="CARGUE" && (
                    <div style={{position:"relative"}}>
                      <button onClick={()=>setTrazColPanel(p=>!p)}
                        style={{background:trazColPanel?T.navy:"transparent",border:`1px solid ${trazColPanel?T.navy:T.border}`,borderRadius:8,padding:"8px 14px",color:trazColPanel?"#fff":T.muted,fontSize:12,cursor:"pointer",display:"flex",alignItems:"center",gap:6,fontWeight:600}}>
                        ⊞ Columnas
                      </button>
                      {trazColPanel && (()=>{
                        const colsDef = trazEstado==="DESCARGUE"
                          ? [
                              {k:"placa",l:"Placa"},{k:"fecha",l:"Fecha CMT"},{k:"cmt",l:"CMT"},{k:"producto",l:"Producto"},
                              {k:"transportadora",l:"Transportadora"},{k:"guia",l:"Guía"},{k:"tiquete",l:"Tiquete"},
                              {k:"api",l:"API"},{k:"glsGuia",l:"Gls Guía"},{k:"glsBas",l:"Gls Báscula"},
                              {k:"horaInicio",l:"Hora Inicio"},{k:"horaFinal",l:"Hora Final"},{k:"duracion",l:"Duración"},
                              {k:"pesoIng",l:"Peso Ingreso (Kg)"},{k:"pesoSal",l:"Peso Salida (Kg)"},{k:"pesoNeto",l:"Peso Neto (Kg)"},
                              {k:"rpm",l:"RPM"},{k:"presion",l:"Presión (Bar)"},
                              {k:"pbs",l:"PBS"},{k:"ot",l:"OT"},{k:"tanques",l:"Tanques descargados"}
                            ]
                          : [
                              {k:"placa",l:"Placa"},{k:"fecha",l:"Fecha CMT"},{k:"cmt",l:"CMT"},{k:"transportadora",l:"Transportadora"},
                              {k:"tqsCarga",l:"Tanques Carga"},
                              {k:"inicio",l:"Inicio Cargue"},{k:"fin",l:"Fin Cargue"},{k:"durCargue",l:"Dur. Cargue"},
                              {k:"inicioDesc",l:"Inicio Descargue"},{k:"finDesc",l:"Fin Descargue"},{k:"durDescargue",l:"Dur. Descargue"},
                              {k:"contador",l:"Gls Contador"},{k:"pesoIng",l:"Peso Ingreso"},{k:"pesoSal",l:"Peso Salida"},
                              {k:"bascula",l:"Gls Báscula"},{k:"ot",l:"OT"},{k:"tqsDesc",l:"Tanques Descarga"}
                            ];
                        const cols = trazEstado==="DESCARGUE" ? trazColsDesc : trazColsPorteo;
                        const setCols = trazEstado==="DESCARGUE" ? setTrazColsDesc : setTrazColsPorteo;
                        const toggle = k => setCols(prev=>{const s=new Set(prev);s.has(k)?s.delete(k):s.add(k);return s;});
                        const allOn = colsDef.every(c=>cols.has(c.k));
                        return (
                          <div style={{position:"absolute",top:"calc(100% + 6px)",right:0,background:T.card,border:`1px solid ${T.border}`,borderRadius:10,padding:"12px 16px",zIndex:50,minWidth:200,boxShadow:"0 8px 24px #0006"}}>
                            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10,paddingBottom:8,borderBottom:`1px solid ${T.border}`}}>
                              <span style={{fontSize:11,fontWeight:700,color:T.navy,textTransform:"uppercase",letterSpacing:1}}>Columnas visibles</span>
                              <button onClick={()=>setCols(allOn?new Set(["placa"]):new Set(colsDef.map(c=>c.k)))}
                                style={{fontSize:10,color:T.muted,background:"transparent",border:"none",cursor:"pointer",textDecoration:"underline"}}>
                                {allOn?"Ocultar todas":"Mostrar todas"}
                              </button>
                            </div>
                            {colsDef.map(({k,l})=>(
                              <label key={k} style={{display:"flex",alignItems:"center",gap:8,padding:"5px 0",cursor:"pointer",userSelect:"none"}}>
                                <input type="checkbox" checked={cols.has(k)} onChange={()=>toggle(k)}
                                  style={{width:14,height:14,accentColor:T.navy,cursor:"pointer"}}/>
                                <span style={{fontSize:12,color:cols.has(k)?T.text:T.muted}}>{l}</span>
                              </label>
                            ))}
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>

                {/* ── TABLA DESCARGUE ────────────────────────────────────── */}
                {trazEstado==="DESCARGUE" && (()=>{
                  const C = trazColsDesc;
                  const colCount = C.size;
                  return (
                  <div data-scroll-key="trazabilidad-descargue" style={{overflow:"auto",maxHeight:"calc(100vh - 310px)",borderRadius:10,border:`1px solid ${T.border}`}}>
                    <table style={{width:"100%",borderCollapse:"collapse",background:T.card,minWidth:400}}>
                      <thead><tr>
                        {C.has("placa")          && <th style={thStyle}>Placa</th>}
                        {C.has("fecha")          && <th style={thStyle}>Fecha CMT</th>}
                        {C.has("cmt")            && <th style={thStyle}>CMT</th>}
                        {C.has("producto")       && <th style={thStyle}>Producto</th>}
                        {C.has("transportadora") && <th style={thStyle}>Transportadora</th>}
                        {C.has("guia")           && <th style={thStyle}>Guía</th>}
                        {C.has("tiquete")        && <th style={thStyle}>Tiquete</th>}
                        {C.has("api")            && <th style={thStyle}>API</th>}
                        {C.has("glsGuia")        && <th style={thStyle}>Gls Guía</th>}
                        {C.has("glsBas")         && <th style={thStyle}>Gls Báscula</th>}
                        {C.has("horaInicio")     && <th style={thStyle}>Hora Inicio</th>}
                        {C.has("horaFinal")      && <th style={thStyle}>Hora Final</th>}
                        {C.has("duracion")       && <th style={thStyle}>Duración</th>}
                        {C.has("pesoIng")        && <th style={thStyle}>Peso Ingreso (Kg)</th>}
                        {C.has("pesoSal")        && <th style={thStyle}>Peso Salida (Kg)</th>}
                        {C.has("pesoNeto")       && <th style={thStyle}>Peso Neto (Kg)</th>}
                        {C.has("rpm")            && <th style={thStyle}>RPM</th>}
                        {C.has("presion")        && <th style={thStyle}>Presión (Bar)</th>}
                        {C.has("pbs")            && <th style={thStyle}>PBS</th>}
                        {C.has("ot")             && <th style={thStyle}>OT</th>}
                        {C.has("tanques")        && <th style={thStyle}>Tanques descargados</th>}
                      </tr></thead>
                      <tbody>
                        {descFiltradas.length===0 && <tr><td colSpan={C.size} style={{padding:40,textAlign:"center",color:T.muted}}>Sin registros</td></tr>}
                        {descFiltradas.map(({cm,cr,tq,pb,ot,viaje,tanquesDesc,glsBas},i)=>{
                          const pesoNeto = Number(cr.peso_neto||0)||Math.max(0,Number(cr.peso_ingreso||0)-Number(cr.peso_salida||0));
                          return (
                          <tr key={`${cm.id}-${cr.placa}-${i}`} style={{background:i%2===0?T.card:"transparent",borderBottom:`1px solid ${T.border}`}}>
                            {C.has("placa")          && <td style={tdS({...mono,color:T.navy,fontSize:13})}>{cr.placa}</td>}
                            {C.has("fecha")          && <td style={tdS({color:T.muted})}>{cm.fecha}</td>}
                            {C.has("cmt")            && <td style={tdS({...mono,color:T.success})}>{cm.numero_cmt}</td>}
                            {C.has("producto")       && <td style={tdS({fontWeight:700})}>{cm.producto||viaje?.producto||"—"}</td>}
                            {C.has("transportadora") && <td style={tdS({color:T.muted,maxWidth:140,overflow:"hidden",textOverflow:"ellipsis"})}>{viaje?.transportadora||cr.transportadora||"—"}</td>}
                            {C.has("guia")           && <td style={tdS({...mono,color:T.muted})}>{viaje?.guia||"—"}</td>}
                            {C.has("tiquete")        && <td style={tdS()}>
                              {tq?(()=>{const res=(tq.resultado||"").toUpperCase();const col=res==="APROBADO"?T.success:res==="RECHAZADO"?T.danger:T.muted;return<><span style={{...mono,color:col}}>{tq.id}</span><div style={{fontSize:9,color:col,marginTop:1}}>{tq.resultado}</div></>;})():<span style={{color:T.muted,fontSize:10}}>—</span>}
                            </td>}
                            {C.has("api")            && <td style={tdS({color:T.muted})}>{tq?.api_corregido?`${tq.api_corregido}°`:"—"}</td>}
                            {C.has("glsGuia")        && <td style={tdS({color:T.muted})}>{Number(cr.galones_guia||viaje?.volumen_guia||0)>0?fmt(Number(cr.galones_guia||viaje?.volumen_guia)):"—"}</td>}
                            {C.has("glsBas")         && <td style={tdS({fontWeight:700,color:glsBas>0?T.success:T.muted})}>{glsBas>0?fmt(glsBas):"—"}</td>}
                            {C.has("horaInicio")     && <td style={tdS({color:T.muted,fontSize:11})}>{cr.hora_inicio||"—"}</td>}
                            {C.has("horaFinal")      && <td style={tdS({color:T.muted,fontSize:11})}>{cr.hora_final||"—"}</td>}
                            {C.has("duracion")       && <td style={tdS({...mono,color:T.navy,fontWeight:700})}>{duracion(cr.hora_inicio,cr.hora_final)||"—"}</td>}
                            {C.has("pesoIng")        && <td style={tdS({color:T.muted})}>{Number(cr.peso_ingreso||0)>0?fmt(cr.peso_ingreso):"—"}</td>}
                            {C.has("pesoSal")        && <td style={tdS({color:T.muted})}>{Number(cr.peso_salida||0)>0?fmt(cr.peso_salida):"—"}</td>}
                            {C.has("pesoNeto")       && <td style={tdS({fontWeight:700,color:pesoNeto>0?T.text:T.muted})}>{pesoNeto>0?fmt(pesoNeto):"—"}</td>}
                            {C.has("rpm")            && <td style={tdS({color:T.muted})}>{cr.rpm||"—"}</td>}
                            {C.has("presion")        && <td style={tdS({color:T.muted})}>{cr.presion||"—"}</td>}
                            {C.has("pbs")            && <td style={tdS({...mono,color:T.orange})}>{pb?.id||"—"}</td>}
                            {C.has("ot")             && <td style={tdS({...mono,color:T.navy})}>{ot?.numero_ot||"—"}</td>}
                            {C.has("tanques")        && <td style={{padding:"10px 12px",fontSize:11}}>
                              {tanquesDesc.length>0?tanquesDesc.map((t,j)=>(
                                <div key={j}><span style={{...mono,color:T.navy,fontSize:11}}>{t.tanque}</span></div>
                              )):<span style={{color:T.muted,fontSize:10}}>—</span>}
                            </td>}
                          </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  );
                })()}

                {/* ── TABLA PORTEO ───────────────────────────────────────── */}
                {trazEstado==="PORTEO" && (()=>{
                  const C = trazColsPorteo;
                  const glsCarga = t => Math.abs(Number(t.galonesInicial||0) - Number(t.galonesFinal||0));
                  const glsDesc  = t => Math.abs(Number(t.galonesFinal||0) - Number(t.galonesInicial||0));
                  return (
                  <div data-scroll-key="trazabilidad-porteo" style={{overflow:"auto",maxHeight:"calc(100vh - 310px)",borderRadius:10,border:`1px solid ${T.border}`}}>
                    <table style={{width:"100%",borderCollapse:"collapse",background:T.card,minWidth:400}}>
                      <thead><tr>
                        {C.has("placa")          && <th style={thStyle}>Placa</th>}
                        {C.has("fecha")          && <th style={thStyle}>Fecha CMT</th>}
                        {C.has("cmt")            && <th style={thStyle}>CMT</th>}
                        {C.has("transportadora") && <th style={thStyle}>Transportadora</th>}
                        {C.has("tqsCarga")       && <th style={thStyle}>Tanques Carga (gls salidos)</th>}
                        {C.has("inicio")         && <th style={thStyle}>Inicio Cargue</th>}
                        {C.has("fin")            && <th style={thStyle}>Fin Cargue</th>}
                        {C.has("durCargue")      && <th style={thStyle}>Dur. Cargue</th>}
                        {C.has("inicioDesc")     && <th style={thStyle}>Inicio Descargue</th>}
                        {C.has("finDesc")        && <th style={thStyle}>Fin Descargue</th>}
                        {C.has("durDescargue")   && <th style={thStyle}>Dur. Descargue</th>}
                        {C.has("contador")       && <th style={thStyle}>Gls Contador</th>}
                        {C.has("pesoIng")        && <th style={thStyle}>Peso Ingreso</th>}
                        {C.has("pesoSal")        && <th style={thStyle}>Peso Salida</th>}
                        {C.has("bascula")        && <th style={thStyle}>Gls Báscula</th>}
                        {C.has("ot")             && <th style={thStyle}>OT</th>}
                        {C.has("tqsDesc")        && <th style={thStyle}>Tanques Descarga (gls recibidos)</th>}
                      </tr></thead>
                      <tbody>
                        {porteoFiltradas.length===0 && <tr><td colSpan={C.size} style={{padding:40,textAlign:"center",color:T.muted}}>Sin registros</td></tr>}
                        {porteoFiltradas.map(({cm,cr,ot,tqsCarga,tqsDesc},i)=>{
                          const pn = Math.max(0,Number(cr.peso_ingreso||0)-Number(cr.peso_salida||0));
                          const gls = Number(cr.galones_bascula||0)||0;
                          return (
                            <tr key={`${cm.id}-${cr.placa}-${i}`} style={{background:i%2===0?T.card:"transparent",borderBottom:`1px solid ${T.border}`}}>
                              {C.has("placa")          && <td style={tdS({...mono,color:T.navy,fontSize:13})}>{cr.placa}</td>}
                              {C.has("fecha")          && <td style={tdS({color:T.muted})}>{cm.fecha}</td>}
                              {C.has("cmt")            && <td style={tdS({...mono,color:T.success})}>{cm.numero_cmt}</td>}
                              {C.has("transportadora") && <td style={tdS({color:T.muted})}>{cr.transportadora||"—"}</td>}
                              {C.has("tqsCarga")       && <td style={{padding:"10px 12px",fontSize:11}}>
                                {tqsCarga.length>0?tqsCarga.map((t,j)=>{const g=glsCarga(t);return <div key={j} style={{whiteSpace:"nowrap"}}><span style={{...mono,color:T.navy,fontSize:11}}>{t.tanque}</span>{g>0&&<span style={{fontSize:10,color:T.danger,fontWeight:700}}> {fmt(g)} gls</span>}</div>;}):<span style={{color:T.muted,fontSize:10}}>—</span>}
                              </td>}
                              {C.has("inicio")         && <td style={tdS({color:T.muted,fontSize:10})}>{cr.hora_inicio_cargue||"—"}</td>}
                              {C.has("fin")            && <td style={tdS({color:T.muted,fontSize:10})}>{cr.hora_final_cargue||"—"}</td>}
                              {C.has("durCargue")      && <td style={tdS({...mono,color:T.navy,fontWeight:700})}>{duracion(cr.hora_inicio_cargue,cr.hora_final_cargue)||"—"}</td>}
                              {C.has("inicioDesc")     && <td style={tdS({color:T.muted,fontSize:10})}>{cr.hora_inicio_descargue||"—"}</td>}
                              {C.has("finDesc")        && <td style={tdS({color:T.muted,fontSize:10})}>{cr.hora_final_descargue||"—"}</td>}
                              {C.has("durDescargue")   && <td style={tdS({...mono,color:T.navy,fontWeight:700})}>{duracion(cr.hora_inicio_descargue,cr.hora_final_descargue)||"—"}</td>}
                              {C.has("contador")       && <td style={tdS({color:cr.galones_contador>0?T.text:T.muted,fontWeight:cr.galones_contador>0?700:400})}>{cr.galones_contador>0?fmt(cr.galones_contador):"—"}</td>}
                              {C.has("pesoIng")        && <td style={tdS({color:T.muted})}>{cr.peso_ingreso>0?fmt(cr.peso_ingreso):"—"}</td>}
                              {C.has("pesoSal")        && <td style={tdS({color:T.muted})}>{cr.peso_salida>0?fmt(cr.peso_salida):"—"}</td>}
                              {C.has("bascula")        && <td style={tdS({fontWeight:700,color:gls>0?T.orange:pn>0?T.orange:T.muted})}>{gls>0?fmt(gls):pn>0?fmt(pn):"—"}</td>}
                              {C.has("ot")             && <td style={tdS({...mono,color:T.navy})}>{ot?.numero_ot||"—"}</td>}
                              {C.has("tqsDesc")        && <td style={{padding:"10px 12px",fontSize:11}}>
                                {tqsDesc.length>0?tqsDesc.map((t,j)=>{const g=glsDesc(t);return <div key={j} style={{whiteSpace:"nowrap"}}><span style={{...mono,color:T.navy,fontSize:11}}>{t.tanque}</span>{g>0&&<span style={{fontSize:10,color:T.success,fontWeight:700}}> +{fmt(g)} gls</span>}</div>;}):<span style={{color:T.muted,fontSize:10}}>—</span>}
                              </td>}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  );
                })()}

                {/* ── RESUMEN TOTALES PORTEO ─────────────────────────────── */}
                {trazEstado==="PORTEO" && porteoFiltradas.length>0 && (()=>{
                  const glsCargaFn = t => Math.abs(Number(t.galonesInicial||0) - Number(t.galonesFinal||0));
                  const glsDescFn  = t => Math.abs(Number(t.galonesFinal||0) - Number(t.galonesInicial||0));
                  const totCargados  = porteoFiltradas.reduce((s,{tqsCarga})=> s + tqsCarga.reduce((a,t)=>a+glsCargaFn(t),0), 0);
                  const totContador  = porteoFiltradas.reduce((s,{cr})=> s + Number(cr.galones_contador||0), 0);
                  const totBascula   = porteoFiltradas.reduce((s,{cr})=> {
                    const pn = Math.max(0,Number(cr.peso_ingreso||0)-Number(cr.peso_salida||0));
                    return s + (Number(cr.galones_bascula||0)||pn);
                  }, 0);
                  const totRecibidos = porteoFiltradas.reduce((s,{tqsDesc})=> s + tqsDesc.reduce((a,t)=>a+glsDescFn(t),0), 0);

                  const Stat = ({label, valor, color}) => (
                    <div style={{flex:1,minWidth:160,background:T.card,border:`1px solid ${T.border}`,borderTop:`3px solid ${color}`,borderRadius:8,padding:"14px 18px",textAlign:"center"}}>
                      <div style={{fontSize:10,color:T.muted,textTransform:"uppercase",letterSpacing:1,marginBottom:6}}>{label}</div>
                      <div style={{fontSize:22,fontWeight:900,fontFamily:"monospace",color}}>{fmt(Math.round(totCargados===0&&label.includes("Cargados")?0:valor))}</div>
                      <div style={{fontSize:10,color:T.muted,marginTop:2}}>galones</div>
                    </div>
                  );

                  return (
                    <div style={{marginTop:16,display:"flex",gap:12,flexWrap:"wrap"}}>
                      <div style={{flex:1,minWidth:160,background:T.card,border:`1px solid ${T.border}`,borderTop:`3px solid ${T.danger}`,borderRadius:8,padding:"14px 18px",textAlign:"center"}}>
                        <div style={{fontSize:10,color:T.muted,textTransform:"uppercase",letterSpacing:1,marginBottom:6}}>Gls Cargados (tanques)</div>
                        <div style={{fontSize:22,fontWeight:900,fontFamily:"monospace",color:T.danger}}>{fmt(Math.round(totCargados))}</div>
                        <div style={{fontSize:10,color:T.muted,marginTop:2}}>salieron de tanques</div>
                      </div>
                      <div style={{flex:1,minWidth:160,background:T.card,border:`1px solid ${T.border}`,borderTop:`3px solid ${T.muted}`,borderRadius:8,padding:"14px 18px",textAlign:"center"}}>
                        <div style={{fontSize:10,color:T.muted,textTransform:"uppercase",letterSpacing:1,marginBottom:6}}>Gls por Contador</div>
                        <div style={{fontSize:22,fontWeight:900,fontFamily:"monospace",color:T.text}}>{fmt(Math.round(totContador))}</div>
                        <div style={{fontSize:10,color:T.muted,marginTop:2}}>medición contador</div>
                      </div>
                      <div style={{flex:1,minWidth:160,background:T.card,border:`1px solid ${T.border}`,borderTop:`3px solid ${T.orange}`,borderRadius:8,padding:"14px 18px",textAlign:"center"}}>
                        <div style={{fontSize:10,color:T.muted,textTransform:"uppercase",letterSpacing:1,marginBottom:6}}>Gls por Báscula</div>
                        <div style={{fontSize:22,fontWeight:900,fontFamily:"monospace",color:T.orange}}>{fmt(Math.round(totBascula))}</div>
                        <div style={{fontSize:10,color:T.muted,marginTop:2}}>peso neto / factor</div>
                      </div>
                      <div style={{flex:1,minWidth:160,background:T.card,border:`1px solid ${T.border}`,borderTop:`3px solid ${T.success}`,borderRadius:8,padding:"14px 18px",textAlign:"center"}}>
                        <div style={{fontSize:10,color:T.muted,textTransform:"uppercase",letterSpacing:1,marginBottom:6}}>Gls Recibidos (tanques)</div>
                        <div style={{fontSize:22,fontWeight:900,fontFamily:"monospace",color:T.success}}>{fmt(Math.round(totRecibidos))}</div>
                        <div style={{fontSize:10,color:T.muted,marginTop:2}}>entraron a tanques</div>
                      </div>
                    </div>
                  );
                })()}

                {/* ── CARGUE (por implementar) ───────────────────────────── */}
                {trazEstado==="CARGUE" && (
                  <div style={{textAlign:"center",padding:"60px 20px",color:T.muted}}>
                    <div style={{fontSize:40,marginBottom:12}}>🚛</div>
                    <div style={{fontWeight:700,fontSize:16,marginBottom:6}}>Cargue hacia proveedor externo</div>
                    <div style={{fontSize:12}}>Esta funcionalidad estará disponible cuando se registren operaciones de cargue en el sistema</div>
                  </div>
                )}
              </div>
            );
          })()}
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
            <Badge label={ROLES[p.rol]?.label||p.rol} color={ROLES[p.rol]?.color||T.muted}/>
            <Btn sm color={T.orange} outline onClick={()=>{
              const MODS = ["viajes","tiquetes","pbs","cmt","tanques","despachos","trazabilidad"];
              const base = MODS.reduce((acc,m)=>({...acc,[m]:{ver:false,crear:false,editar:false,eliminar:false,...((p.permisos||{})[m]||{})}}),{});
              const plantasArr = (p.planta||"PLANTA 1").split(",").map(s=>s.trim()).filter(Boolean);
              setEditUsuario({...p, plantas: plantasArr});
              setPermsEdit(base);
            }}>Gestionar Usuario</Btn>
          </div>
        </Card>
      ))}
    </div>
  </div>
)}

          {(nav==="programacion"||nav==="ot_ops") && (()=>{
            const esProgramacion = nav==="programacion";
            const estadoColor = e => e==="ANALIZADA"?T.success:e==="COMPLETADA"?T.success:e==="RECIRCULANDO"?T.orange:e==="DESCARGANDO"?T.orange:e==="TRASIEGOS"?T.navy:e==="RECHAZADA"?T.danger:T.muted;
            const estadoLabel = e => e==="ANALIZADA"?"COMPLETADA":e;
            const activas = (ordenesTrabaio||[]).filter(o=>!["COMPLETADA","RECHAZADA","ANALIZADA"].includes(o.estado));
            const cerradas = (ordenesTrabaio||[]).filter(o=>["COMPLETADA","RECHAZADA","ANALIZADA"].includes(o.estado));
            return (
            <div>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:22 }}>
                <div>
                  <div style={{ fontWeight:800, fontSize:20, color:T.navy }}>Órdenes de Trabajo</div>
                  <div style={{ fontSize:11, color:T.muted }}>{perfil?.rol==="operaciones" ? "Órdenes asignadas para ejecución" : "Trasiegos · Descargues · Recirculación"}</div>
                </div>
                {esProgramacion && perfil?.rol!=="operaciones" && <Btn color={T.orange} onClick={()=>setOtModal({step:1,trasiegos:[{origen:"",destino:"",galones:""}],necesitaTrasiego:"si",tipoOp:"directo",formulacionId:"",recircHoras:4})}>+ Nueva Orden</Btn>}
              </div>

              {/* Órdenes activas */}
              {activas.length===0 && cerradas.length===0 && (
                <Card><div style={{ padding:40,textAlign:"center",color:T.muted }}>Sin órdenes de trabajo registradas</div></Card>
              )}
              {activas.length>0 && (
                <div style={{ marginBottom:24 }}>
                  <div style={{ fontSize:11,fontWeight:700,color:T.muted,textTransform:"uppercase",letterSpacing:1,marginBottom:10 }}>En progreso</div>
                  <div style={{ display:"flex",flexDirection:"column",gap:12 }}>
                    {activas.map(ot=>{
                      const desc = (ot.descargues||[]);
                      const totalPlan = desc.reduce((a,d)=>a+Number(d.galones_planeado||0),0);
                      const cmtsOt = (cmts||[]).filter(c=>c.ot_id===ot.id);
                      const glsCarroCmt = (carro)=>{ const tiq=tiquetes.find(t=>t.id===carro.tiquete); const factor=Number(tiq?.factor_tabla13||0),pn=Number(carro.peso_neto||0); return (factor>0&&pn>0)?Math.round(pn/factor):Number(carro.galones_descargados||0); };
                      const totalDesc = cmtsOt.reduce((sum,c)=>sum+(c.carros||[]).reduce((s,cr)=>s+glsCarroCmt(cr),0),0);
                      const pct = totalPlan>0?Math.round(totalDesc/totalPlan*100):0;
                      const fo = formulaciones.find(f=>f.id===ot.formulacion_id);
                      return (
                        <Card key={ot.id} style={{ padding:16 }}>
                          <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10 }}>
                            <div style={{ display:"flex",gap:12,alignItems:"center" }}>
                              <div style={{ fontWeight:800,fontSize:16,color:T.navy }}>{ot.numero_ot}</div>
                              <Badge label={estadoLabel(ot.estado)} color={estadoColor(ot.estado)}/>
                              <span style={{ fontSize:12,color:T.muted }}>{fo?.producto||""} · {ot.tanque_destino}</span>
                              {ot.tiquete_id && (
                                <span style={{fontSize:11,background:`${T.success}18`,border:`1px solid ${T.success}44`,borderRadius:6,padding:"2px 8px",cursor:"pointer",color:T.success,fontFamily:"monospace",fontWeight:700}} onClick={()=>{const tq=tiquetes.find(x=>x.id===ot.tiquete_id);if(tq){setForm({...tq});setModal("tiquete");}}}>🧪 {ot.tiquete_id}</span>
                              )}
                            </div>
                            <div style={{ display:"flex",gap:8 }}>
                              <button onClick={()=>{ const id=`ot-${ot.id}`; const ex=tabs.find(t=>t.id===id); if(ex){setActiveTabId(id);return;} setTabs(p=>[...p,{id,type:"orden_trabajo",title:ot.numero_ot,icon:"🏗️",closeable:true,otId:ot.id,source:"programacion"}]); setActiveTabId(id); }} style={{ background:T.orange,border:"none",color:"#fff",borderRadius:6,padding:"5px 14px",cursor:"pointer",fontWeight:700,fontSize:12 }}>Ver / Gestionar →</button>
                              {esProgramacion && perfil?.rol!=="operaciones" && <button onClick={()=>setOtEditando({otId:ot.id,trasiegos:(ot.trasiegos||[]).map(t=>({...t}))})} style={{ background:`${T.navy}18`,border:`1px solid ${T.navy}44`,color:T.navy,borderRadius:6,padding:"5px 14px",cursor:"pointer",fontWeight:700,fontSize:12 }}>✏️ Editar</button>}
                            </div>
                          </div>
                          {/* Progreso descargues */}
                          {ot.estado==="DESCARGANDO" && (
                            <div style={{ marginBottom:8 }}>
                              <div style={{ display:"flex",justifyContent:"space-between",fontSize:11,color:T.muted,marginBottom:4 }}>
                                <span>Descargues: {fmt(totalDesc)} / {fmt(totalPlan)} gls</span>
                                <span style={{ fontWeight:700,color:T.orange }}>{pct}%</span>
                              </div>
                              <div style={{ background:T.border,borderRadius:4,height:6 }}>
                                <div style={{ width:`${pct}%`,background:T.orange,height:6,borderRadius:4,transition:"width 0.3s" }}/>
                              </div>
                            </div>
                          )}
                          {ot.estado==="RECIRCULANDO" && (
                            <div style={{ fontSize:11,color:T.orange }}>⏱️ Recirculando — {ot.recirculacion_tiempo_total} min programados</div>
                          )}
                          {/* Pasos */}
                          <div style={{ display:"flex",gap:8,marginTop:6 }}>
                            {[["TRASIEGOS","TRASIEGOS"],["DESCARGANDO","DESCARGUES"],["RECIRCULANDO","RECIRCULAR"]].map(([st,lbl],i)=>{
                              const estados = ["TRASIEGOS","DESCARGANDO","RECIRCULANDO","COMPLETADA"];
                              const idxActual = estados.indexOf(ot.estado);
                              const idxEste = i;
                              const done = idxActual>idxEste+1; // +1 porque TRASIEGOS es idx 0
                              const activo = idxActual===idxEste;
                              return <span key={st} style={{ fontSize:10,fontWeight:700,padding:"2px 8px",borderRadius:10,background:done?`${T.success}22`:activo?`${T.orange}22`:`${T.border}`,color:done?T.success:activo?T.orange:T.muted,border:`1px solid ${done?`${T.success}55`:activo?T.orange:T.border}` }}>{done?"✅ ":activo?"⏳ ":"⏸️ "}{lbl}</span>;
                            })}
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Cerradas */}
              {cerradas.length>0 && (
                <div>
                  <div style={{ fontSize:11,fontWeight:700,color:T.muted,textTransform:"uppercase",letterSpacing:1,marginBottom:10 }}>Completadas / Rechazadas</div>
                  <Card style={{ padding:0 }}>
                    <table style={{ width:"100%",borderCollapse:"collapse",fontSize:13 }}>
                      <thead>
                        <tr style={{ borderBottom:`2px solid ${T.border}` }}>
                          {["OT","Tanque","Formulación","Estado","Fecha","Análisis",""].map(h=><th key={h} style={{ padding:"10px 14px",textAlign:"left",color:T.muted,fontWeight:600,fontSize:11,textTransform:"uppercase" }}>{h}</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        {cerradas.map(ot=>{
                          const fo = formulaciones.find(f=>f.id===ot.formulacion_id);
                          return (
                            <tr key={ot.id} style={{ borderBottom:`1px solid ${T.border}` }}>
                              <td style={{ padding:"10px 14px",fontWeight:700,color:T.navy }}>{ot.numero_ot}</td>
                              <td style={{ padding:"10px 14px",color:T.text }}>{ot.tanque_destino}</td>
                              <td style={{ padding:"10px 14px",color:T.muted }}>{fo?.producto||"—"} {fo?.fecha?`(${fo.fecha})`:""}</td>
                              <td style={{ padding:"10px 14px" }}><Badge label={estadoLabel(ot.estado)} color={estadoColor(ot.estado)}/></td>
                              <td style={{ padding:"10px 14px",color:T.muted,fontSize:11 }}>{(ot.created_at||"").slice(0,10)}</td>
                              <td style={{ padding:"10px 14px" }}>{ot.tiquete_id ? <span style={{color:T.success,fontFamily:"monospace",fontWeight:700,cursor:"pointer",textDecoration:"underline"}} onClick={()=>{const tq=tiquetes.find(x=>x.id===ot.tiquete_id);if(tq){setForm({...tq});setModal("tiquete");}}}>{ot.tiquete_id}</span> : <span style={{color:T.muted,fontSize:11}}>Sin análisis</span>}</td>
                              <td style={{ padding:"10px 14px" }}><button onClick={()=>{ const id=`ot-${ot.id}`; const ex=tabs.find(t=>t.id===id); if(ex){setActiveTabId(id);return;} setTabs(p=>[...p,{id,type:"orden_trabajo",title:ot.numero_ot,icon:"🏗️",closeable:true,otId:ot.id,source:"programacion"}]); setActiveTabId(id); }} style={{ background:"none",border:"none",color:T.orange,cursor:"pointer",fontSize:12,fontWeight:700 }}>Ver →</button></td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </Card>
                </div>
              )}
            </div>
            );
          })()}

          {nav==="formulaciones" && (
            <div>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:22 }}>
                <div>
                  <div style={{ fontWeight:800, fontSize:20, color:T.navy }}>Formulaciones</div>
                  <div style={{ fontSize:11, color:T.muted }}>Cálculo de mezclas y parámetros ponderados</div>
                </div>
                <Btn color={T.orange} onClick={()=>openFormulacionTab(null)}>+ Nueva Formulación</Btn>
              </div>
              <Card>
                <div data-scroll-key="formulaciones-lista" style={{ overflowX:"auto" }}>
                  <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
                    <thead>
                      <tr style={{ borderBottom:`2px solid ${T.border}` }}>
                        {["Fecha","Tanque","Producto","# MPs","Azufre %","Galones","Carros","Estado",""].map(h=>(
                          <th key={h} style={{ padding:"10px 14px", textAlign:"left", color:T.muted, fontWeight:600, fontSize:11, textTransform:"uppercase", letterSpacing:1 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {formulaciones.length===0 ? (
                        <tr><td colSpan={9} style={{ padding:"40px", textAlign:"center", color:T.muted }}>Sin formulaciones registradas</td></tr>
                      ) : formulaciones.map(fo=>(
                        <tr key={fo.id} style={{ borderBottom:`1px solid ${T.border}` }}>
                          <td style={{ padding:"12px 14px", color:T.muted }}>{fo.fecha}</td>
                          <td style={{ padding:"12px 14px", color:T.text, fontWeight:600 }}>{fo.tanque}</td>
                          <td style={{ padding:"12px 14px", color:T.text }}>{fo.producto}</td>
                          <td style={{ padding:"12px 14px", color:T.muted, textAlign:"center" }}>{(fo.mps||[]).length}</td>
                          <td style={{ padding:"12px 14px" }}><span style={{ color:Number(fo.azufre_planeado)>0.48?T.danger:T.success, fontWeight:700 }}>{Number(fo.azufre_planeado||0).toFixed(4)}%</span></td>
                          <td style={{ padding:"12px 14px", color:T.success, fontWeight:700 }}>{fmt(Number(fo.total_galones||0))}</td>
                          <td style={{ padding:"12px 14px", color:T.muted }}>{Number(fo.total_carros||0).toFixed(1)}</td>
                          <td style={{ padding:"12px 14px" }}><Badge label={fo.estado||"PLANEADA"} color={fo.estado==="APROBADA"?T.success:fo.estado==="EJECUTADA"?T.orange:T.orange}/></td>
                          <td style={{ padding:"12px 14px", display:"flex", gap:8 }}>
                            <button onClick={()=>openFormulacionTab(fo)} style={{ background:"none",border:"none",color:T.orange,cursor:"pointer",fontSize:12,fontWeight:700 }}>Editar</button>
                            {(()=>{ const otAsoc = (ordenesTrabaio||[]).find(o=>o.formulacion_id===fo.id); return otAsoc ? <button onClick={()=>{ const id=`ot-${otAsoc.id}`; const ex=tabs.find(t=>t.id===id); if(ex){setActiveTabId(id);return;} setTabs(p=>[...p,{id,type:"orden_trabajo",title:otAsoc.numero_ot,icon:"🏗️",closeable:true,otId:otAsoc.id}]); setActiveTabId(id); }} style={{ background:"none",border:"none",color:T.success,cursor:"pointer",fontSize:12,fontWeight:700 }}>{otAsoc.numero_ot}</button> : <button onClick={()=>setOtModal({step:1,trasiegos:[{origen:"",destino:"",galones:""}],necesitaTrasiego:"si",formulacionId:fo.id,recircHoras:4})} style={{ background:"none",border:"none",color:T.orange,cursor:"pointer",fontSize:12,fontWeight:700 }}>+ OT</button>; })()}
                            <button onClick={async()=>{ if(!confirm(`¿Eliminar formulación del ${fo.fecha}?`)) return; await dbCall({ table:"formulaciones", op:"delete", filters:[{col:"id",val:fo.id}] }); await loadData(); }} style={{ background:"none",border:"none",color:"#ef4444",cursor:"pointer",fontSize:12,fontWeight:700 }}>Eliminar</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          )}

          {/* ── LIQUIDACIÓN DESPACHO ── */}
          {isLiqDespachoTab && (()=>{
            const tab = activeTab;
            const { despacho, prod, mt } = tab;
            const cache = tabStateCache.current[tab.id] || {};
            const barcazaSelec = cache.barcaza || "";
            const setBarcaza = v => {
              tabStateCache.current[tab.id] = { ...cache, barcaza: v };
              setTabs(prev => [...prev]); // fuerza re-render
            };
            // Barcazas disponibles: prefijos únicos de tanques de Planta 1
            const isP1 = id => id.startsWith("QBS002") || id.startsWith("TKT");
            const p1Tanks = (tanques||[]).filter(t=>isP1(t.id));
            const barcazas = [...new Set(p1Tanks.map(t => t.id.startsWith("QBS002") ? "QBS002" : "TANQUES TIERRA"))];

            return (
              <div>
                {/* Cabecera */}
                <div style={{marginBottom:20}}>
                  <div style={{fontWeight:800,fontSize:20,color:T.navy}}>Liquidación de Despacho</div>
                  <div style={{fontSize:12,color:T.muted,marginTop:2}}>
                    <span style={{fontWeight:700,color:T.navy}}>{despacho.buque}</span>
                    {" · "}<span style={{color:T.primary,fontWeight:700}}>{prod}</span>
                    {" · "}<span style={{fontWeight:700}}>{mt.toLocaleString()} MT</span>
                    {" · Puerto: "}{despacho.puerto||"—"}
                    {despacho.contrato ? ` · Contrato: ${despacho.contrato}` : ""}
                  </div>
                </div>

                {/* Selector barcaza */}
                <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:24,padding:"14px 18px",background:T.card,borderRadius:10,border:`1px solid ${T.border}`,width:"fit-content"}}>
                  <span style={{fontWeight:700,fontSize:13,color:T.navy}}>Seleccionar Barcaza:</span>
                  <select value={barcazaSelec} onChange={e=>setBarcaza(e.target.value)}
                    style={{background:T.bg,border:`1px solid ${T.border}`,borderRadius:6,padding:"8px 14px",color:barcazaSelec?T.text:T.muted,fontSize:13,fontWeight:barcazaSelec?700:400,outline:"none",cursor:"pointer",minWidth:200}}>
                    <option value="">— Seleccionar barcaza —</option>
                    {barcazas.map(b=><option key={b} value={b}>{b==="QBS002"?"Barcaza QBS002":"Tanques Tierra (TKT-1 / TKT-2)"}</option>)}
                  </select>
                </div>

                {/* Liquidador según barcaza */}
                {!barcazaSelec && (
                  <div style={{color:T.muted,fontSize:13,padding:"40px 0",textAlign:"center"}}>Selecciona una barcaza para iniciar la liquidación</div>
                )}
                {barcazaSelec && (
                  <LiquidadorPlanta1
                    key={barcazaSelec}
                    supabase={supabase}
                    session={session}
                    perfil={perfil}
                    showToast={showToast}
                    dbCall={dbCall}
                    barcazaFiltro={barcazaSelec}
                    despachoCtx={{ buque:despacho.buque, imo:despacho.imo||"", prod, mt, contrato:despacho.contrato, despachoId:despacho.id, puerto:despacho.destino||despacho.puerto||"" }}
                  />
                )}
              </div>
            );
          })()}

          {isFormulacionTab && (()=>{
            const COL_W = 130; // ancho fijo columna MP (equivale a ~7 cols visibles)
            const tabCache = tabStateCache.current[activeTabId] || {};
            const fForm  = tabCache.formulacionForm || { tanque:"TK-116", producto:"VLSFO", fecha:today(), estado:"PLANEADA" };
            const fMps   = tabCache.formulacionMps  || [
              { nombre:"PENDARE",  galones:"", api:"", visc:"", azufre:"", agua:"", flash:"" },
              { nombre:"FRONTERA", galones:"", api:"", visc:"", azufre:"", agua:"", flash:"" },
            ];
            const fModo  = tabCache.formulacionModo || "MANUAL"; // MANUAL | AUTO | POR_CARRO
            const setFForm = updater => {
              const prev = tabStateCache.current[activeTabId] || {};
              const next = typeof updater==="function" ? updater(prev.formulacionForm||{}) : updater;
              tabStateCache.current[activeTabId] = { ...prev, formulacionForm: next };
              setTabs(t=>[...t]);
            };
            const setFMps = updater => {
              const prev = tabStateCache.current[activeTabId] || {};
              const next = typeof updater==="function" ? updater(prev.formulacionMps||[]) : updater;
              tabStateCache.current[activeTabId] = { ...prev, formulacionMps: next };
              setTabs(t=>[...t]);
            };
            const setFModo = modo => {
              const prev = tabStateCache.current[activeTabId] || {};
              tabStateCache.current[activeTabId] = { ...prev, formulacionModo: modo };
              setTabs(t=>[...t]);
            };
            // AUTO: busca en campo 'producto' del tiquete (ej: "PENDARE TFG" matchea "PENDARE")
            const calcAutoParams = (nombreMp) => {
              const key = (nombreMp||"").toUpperCase().trim();
              const muestras = (tiquetes||[]).filter(t=> t.resultado==="APROBADO" && ((t.producto||"").toUpperCase().includes(key) || (t.proveedor||"").toUpperCase().includes(key)));
              if(!muestras.length) return null;
              const avg = key => { const vals=muestras.map(t=>Number(t[key]||0)).filter(v=>v>0); return vals.length?vals.reduce((a,b)=>a+b,0)/vals.length:0; };
              return { api:avg("api_corregido"), visc:avg("viscosidad"), azufre:avg("azufre"), agua:avg("agua_destilacion"), flash:avg("flash_point") };
            };
            const aplicarAuto = () => {
              const nuevasMps = fMps.map(mp=>{
                const hist = calcAutoParams(mp.nombre);
                if(!hist) return mp;
                return { ...mp, api:hist.api?hist.api.toFixed(2):"", visc:hist.visc?hist.visc.toFixed(2):"", azufre:hist.azufre?hist.azufre.toFixed(4):"", agua:hist.agua?hist.agua.toFixed(4):"", flash:hist.flash?hist.flash.toFixed(1):"" };
              });
              setFMps(nuevasMps);
            };
            const totalG = fMps.reduce((a,m)=>a+Number(m.galones||0),0);
            const pcts   = fMps.map(m=>Number(m.galones||0)/(totalG||1));
            const sgPond = fMps.reduce((a,m,i)=>{ const api=Number(m.api||0); return api?a+pcts[i]*(141.5/(api+131.5)):a; },0);
            const biPond = fMps.reduce((a,m,i)=>{ const v=Number(m.visc||0); return v?a+pcts[i]*Math.log10(Math.log10(v+0.7)):a; },0);
            const pond = {
              totalG, carros:totalG/9300,
              api:    sgPond>0 ? 141.5/sgPond-131.5 : 0,
              visc:   biPond  ? Math.pow(10,Math.pow(10,biPond))-0.7 : 0,
              azufre: fMps.reduce((a,m,i)=>a+pcts[i]*Number(m.azufre||0),0),
              agua:   fMps.reduce((a,m,i)=>a+pcts[i]*Number(m.agua||0),0),
              flash:  fMps.reduce((a,m,i)=>a+pcts[i]*Number(m.flash||0),0),
            };
            const esVLSFO = (fForm.producto||"").toUpperCase()==="VLSFO";
            const azufreOk=pond.azufre<=0.48, aguaOk=pond.agua<=0.5, flashOk=pond.flash>=60;
            const PARAMS = ["Galones","API","Visc (cSt)","Azufre (%)","Agua (%)","Flash (°C)"];
            const PARAM_KEYS = ["galones","api","visc","azufre","agua","flash"];
            return (
            <div>
              {/* Header */}
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:16 }}>
                <div>
                  <div style={{ fontWeight:800, fontSize:20, color:T.navy }}>{fForm.id?"Editar Formulación":"Nueva Formulación"}</div>
                  <div style={{ fontSize:11, color:T.muted }}>Cálculo de mezclas y parámetros ponderados</div>
                </div>
              </div>

              {/* Menú modo */}
              <div style={{ display:"flex", gap:0, background:T.bg, borderRadius:10, padding:4, marginBottom:20, width:"fit-content", border:`1px solid ${T.border}` }}>
                {[["MANUAL","✏️ Manual","Ingresa todos los parámetros manualmente"],["AUTO","⚡ Auto","Parámetros calculados del histórico de Laboratorio"],["POR_CARRO","🚛 Por Carro","Selecciona carros analizados del historial"]].map(([key,lbl,tip])=>(
                  <button key={key} title={tip} onClick={()=>{ setFModo(key); if(key==="AUTO") setTimeout(aplicarAuto,0); if(key==="POR_CARRO"){ setFMps([]); tabStateCache.current[activeTabId]={...(tabStateCache.current[activeTabId]||{}),carrosSelIds:[]}; } }}
                    style={{ padding:"7px 18px",borderRadius:8,border:"none",cursor:"pointer",fontWeight:700,fontSize:12,
                      background: fModo===key ? T.orange : "transparent",
                      color: fModo===key ? "#fff" : T.muted,
                      transition:"all 0.15s" }}>
                    {lbl}
                  </button>
                ))}
              </div>

              {/* Campos header */}
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12, marginBottom:20 }}>
                <div><Lbl>Tanque</Lbl>
                  <select value={fForm.tanque||""} onChange={e=>setFForm(p=>({...p,tanque:e.target.value}))} style={{ width:"100%",background:T.bg,border:`1px solid ${T.border}`,borderRadius:6,padding:"10px 12px",color:T.text,fontSize:13,outline:"none" }}>
                    {["TK-111","TK-112","TK-113","TK-114","TK-115","TK-116","TK-117"].map(t=><option key={t}>{t}</option>)}
                  </select>
                </div>
                <div><Lbl>Producto Final</Lbl>
                  <select value={fForm.producto||""} onChange={e=>setFForm(p=>({...p,producto:e.target.value}))} style={{ width:"100%",background:T.bg,border:`1px solid ${T.border}`,borderRadius:6,padding:"10px 12px",color:T.text,fontSize:13,outline:"none" }}>
                    <option>VLSFO</option><option>HSFO</option><option>MGO</option>
                  </select>
                </div>
                <div><Lbl>Fecha</Lbl>
                  <input type="date" value={fForm.fecha||today()} onChange={e=>setFForm(p=>({...p,fecha:e.target.value}))} style={{ width:"100%",background:T.bg,border:`1px solid ${T.border}`,borderRadius:6,padding:"10px 12px",color:T.text,fontSize:13,outline:"none",boxSizing:"border-box" }}/>
                </div>
              </div>

              {/* Aviso AUTO */}
              {fModo==="AUTO" && (
                <div style={{ background:`${T.navy}18`,border:`1px solid ${T.navy}55`,borderRadius:8,padding:"10px 14px",marginBottom:14,fontSize:12,color:T.navy }}>
                  ⚡ <b>Modo Auto:</b> los parámetros se calculan como promedio histórico de tiquetes APROBADOS por producto. Solo ingresa los galones. Puedes ajustar los valores manualmente si lo necesitas.
                </div>
              )}

              {/* ── POR CARRO ── */}
              {fModo==="POR_CARRO" && (()=>{
                const selIds = tabCache.carrosSelIds || [];
                const setSelIds = ids => { tabStateCache.current[activeTabId] = {...(tabStateCache.current[activeTabId]||{}), carrosSelIds:ids}; setTabs(t=>[...t]); };
                // tiquetes con resultado registrado
                // carros físicamente en planta: aprobados o rechazados (no En Ruta ni Descargado)
                const viajesEnPlanta = (viajes||[]).filter(v=>v.estado==="En Planta"||v.estado==="Rechazado");
                const enPlantaAhora  = viajesEnPlanta;
                const placasEnPlanta = new Set(viajesEnPlanta.map(v=>v.placa));
                const cntPorProducto = {};
                enPlantaAhora.forEach(v=>{ const p=v.producto||""; cntPorProducto[p]=(cntPorProducto[p]||0)+1; });
                // todos los tiquetes con resultado cuya placa esté en planta o rechazada
                const tiqBase = (tiquetes||[]).filter(t=>t.resultado && placasEnPlanta.has(t.placa));
                // agrupar por producto, ordenar por cantidad de carros desc
                const productosOrden = [...new Set(tiqBase.map(t=>t.producto||""))].sort((a,b)=>(cntPorProducto[b]||0)-(cntPorProducto[a]||0)||(a>b?1:-1));
                const tiqDisp = productosOrden.flatMap(prod=>
                  tiqBase.filter(t=>(t.producto||"")=== prod).sort((a,b)=>(b.fecha||"").localeCompare(a.fecha||""))
                );
                // mapa placa → galones del viaje en planta (incluye rechazados autorizados)
                const galonesDeViaje = {};
                viajesEnPlanta.forEach(v=>{ if(v.placa && v.gls_netos_guia) galonesDeViaje[v.placa]=v.gls_netos_guia; });
                const toggleCarro = (id) => {
                  const nuevo = selIds.includes(id) ? selIds.filter(x=>x!==id) : [...selIds,id];
                  setSelIds(nuevo);
                  // Actualizar fMps desde selección
                  const selTiq = tiqDisp.filter(t=>nuevo.includes(t.id));
                  const nuevasMps = selTiq.map(t=>({
                    nombre: t.placa||(t.producto||""),
                    _producto: t.producto||"",
                    galones: galonesDeViaje[t.placa]?String(galonesDeViaje[t.placa]):(t.galones_recibidos?String(t.galones_recibidos):""),
                    api:   t.api_corregido?String(Number(t.api_corregido).toFixed(2)):"",
                    visc:  t.viscosidad?String(Number(t.viscosidad).toFixed(2)):"",
                    azufre:t.azufre?String(Number(t.azufre).toFixed(4)):"",
                    agua:  t.agua_destilacion?String(Number(t.agua_destilacion).toFixed(4)):"",
                    flash: t.flash_point?String(Number(t.flash_point).toFixed(1)):"",
                    _tiquete_id: t.id,
                    _placa: t.placa,
                  }));
                  setFMps(nuevasMps.length ? nuevasMps : [{nombre:"PENDARE",galones:"",api:"",visc:"",azufre:"",agua:"",flash:""}]);
                };
                return (
                  <div style={{ marginBottom:20 }}>
                    <div style={{ fontSize:12,color:T.muted,marginBottom:10 }}>
                      🚛 <b style={{color:T.text}}>Selecciona los carros analizados</b> para incluir en la formulación. Los parámetros se toman directamente del tiquete de laboratorio.
                    </div>
                    {/* Columnas por producto */}
                    <div style={{ display:"flex", gap:10, overflowX:"auto", paddingBottom:4 }}>
                      {productosOrden.map(prod=>{
                        const tiqProd = tiqDisp.filter(t=>(t.producto||"")=== prod);
                        const cnt = cntPorProducto[prod]||0;
                        const selEnProd = tiqProd.filter(t=>selIds.includes(t.id)).length;
                        return (
                          <div key={prod} style={{ minWidth:220, flexShrink:0, border:`1px solid ${T.border}`, borderRadius:10, overflow:"hidden" }}>
                            {/* Header columna */}
                            <div style={{ background:T.navy, padding:"8px 12px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                              <div style={{ fontWeight:800, fontSize:11, color:"#fff", textTransform:"uppercase", letterSpacing:1 }}>{prod}</div>
                              <div style={{ display:"flex", gap:5, alignItems:"center" }}>
                                {cnt>0 && <span style={{ background:T.orange, color:"#fff", borderRadius:10, padding:"2px 7px", fontSize:10, fontWeight:700 }}>{cnt} en planta</span>}
                                {selEnProd>0 && <span style={{ background:T.success, color:"#071422", borderRadius:10, padding:"2px 7px", fontSize:10, fontWeight:700 }}>✓{selEnProd}</span>}
                              </div>
                            </div>
                            {/* Filas de carros */}
                            {tiqProd.map(t=>{
                              const sel = selIds.includes(t.id);
                              const aprobado = t.resultado==="APROBADO";
                              const enPlanta = placasEnPlanta.has(t.placa);
                              return (
                                <div key={t.id} onClick={()=>toggleCarro(t.id)}
                                  style={{ padding:"8px 12px", borderBottom:`1px solid ${T.border}`, cursor:"pointer",
                                    background: sel?`${T.orange}18`:aprobado?`${T.success}08`:`${T.danger}08`, transition:"background 0.12s" }}
                                  onMouseEnter={e=>{ if(!sel) e.currentTarget.style.background=`${T.border}66`; }}
                                  onMouseLeave={e=>{ e.currentTarget.style.background=sel?`${T.orange}18`:aprobado?`${T.success}08`:`${T.danger}08`; }}>
                                  {/* Fila superior: checkbox + placa + badge */}
                                  <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                                    <div style={{ width:15,height:15,borderRadius:3,border:`2px solid ${sel?T.orange:T.border}`,background:sel?T.orange:"transparent",display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,color:"#fff",fontWeight:800,flexShrink:0 }}>
                                      {sel?"✓":""}
                                    </div>
                                    <span style={{ fontWeight:800, fontSize:13, color:T.text, flex:1 }}>{t.placa}</span>
                                    <span style={{ background:aprobado?`${T.success}22`:`${T.danger}22`,border:`1px solid ${aprobado?`${T.success}55`:`${T.danger}55`}`,borderRadius:4,padding:"1px 6px",color:aprobado?T.success:T.danger,fontWeight:700,fontSize:9,whiteSpace:"nowrap" }}>
                                      {aprobado?"APROBADO":"RECHAZADO"}
                                    </span>
                                  </div>
                                  {/* Parámetros fuera de spec solo si rechazado */}
                                  {!aprobado && (()=>{
                                    const azufre=Number(t.azufre||0), agua=Number(t.agua_destilacion||0), flash=Number(t.flash_point||0), api=Number(t.api_corregido||0), visc=Number(t.viscosidad||0);
                                    const params=[
                                      {lbl:"API",    val:`${api.toFixed(2)}°`,  bad: api<10||api>40 },
                                      {lbl:"Visc",   val:`${visc.toFixed(1)}`,   bad: visc>700 },
                                      {lbl:"Azufre", val:`${azufre.toFixed(4)}%`,bad: azufre>0.5 },
                                      {lbl:"Agua",   val:`${agua.toFixed(4)}%`,  bad: agua>0.5 },
                                      {lbl:"Flash",  val:`${flash.toFixed(1)}°C`,bad: flash<60 },
                                    ];
                                    return (
                                      <div style={{ display:"flex", flexWrap:"wrap", gap:"3px 8px", marginTop:5, paddingLeft:23 }}>
                                        {params.map(p=>(
                                          <span key={p.lbl} style={{ fontSize:9, fontWeight:700, color:p.bad?"#ef4444":T.muted }}>
                                            {p.lbl}: <b style={{ color:p.bad?"#ef4444":T.text }}>{p.val}</b>
                                          </span>
                                        ))}
                                      </div>
                                    );
                                  })()}
                                </div>
                              );
                            })}
                          </div>
                        );
                      })}
                    </div>
                    {selIds.length>0 && (
                      <div style={{ marginTop:8,fontSize:11,color:T.orange,fontWeight:700 }}>
                        {selIds.length} carro(s) seleccionado(s) → matriz actualizada abajo ↓
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Matriz */}
              <Card style={{ marginBottom:16, padding:0, overflow:"hidden" }}>
                <div data-scroll-key="formulaciones-matriz" style={{ overflowX:"auto" }}>
                  <table style={{ borderCollapse:"collapse", fontSize:12, tableLayout:"fixed", width:`${120 + COL_W*Math.max(fMps.length,7) + COL_W}px` }}>
                    <colgroup>
                      <col style={{ width:120 }}/>
                      {fMps.map((_,ci)=><col key={ci} style={{ width:COL_W }}/>)}
                      <col style={{ width:COL_W }}/>
                    </colgroup>
                    <thead>
                      <tr style={{ background:T.bg }}>
                        <th style={{ padding:"10px 14px",textAlign:"left",color:T.muted,fontWeight:700,fontSize:11,textTransform:"uppercase",position:"sticky",left:0,background:T.bg,zIndex:3,borderBottom:`2px solid ${T.border}`,borderRight:`1px solid ${T.border}` }}>Parámetro</th>
                        {fMps.map((mp,ci)=>(
                          <th key={ci} style={{ padding:"8px 6px",textAlign:"center",color:T.navy,fontWeight:700,fontSize:12,borderBottom:`2px solid ${T.border}`,borderRight:`1px solid ${T.border}` }}>
                            <div style={{ display:"flex",flexDirection:"column",gap:3,alignItems:"center" }}>
                              {mp._producto && <div style={{ fontSize:9,fontWeight:700,color:T.muted,textTransform:"uppercase",letterSpacing:0.5,textAlign:"center",lineHeight:1.2 }}>{mp._producto}</div>}
                              <input value={mp.nombre} onChange={e=>{const n=[...fMps];n[ci].nombre=e.target.value; if(fModo==="AUTO"){const h=calcAutoParams(e.target.value);if(h){n[ci]={...n[ci],nombre:e.target.value,api:h.api?h.api.toFixed(2):"",visc:h.visc?h.visc.toFixed(2):"",azufre:h.azufre?h.azufre.toFixed(4):"",agua:h.agua?h.agua.toFixed(4):"",flash:h.flash?h.flash.toFixed(1):""};}} setFMps(n);}} style={{ width:COL_W-20,textAlign:"center",background:T.card,border:`1px solid ${T.border}`,borderRadius:4,padding:"3px 6px",color:T.text,fontSize:11,fontWeight:700,outline:"none" }}/>
                              {fMps.length>2 && <button onClick={()=>setFMps(fMps.filter((_,j)=>j!==ci))} style={{ background:"#ef444420",border:"1px solid #ef444455",borderRadius:4,color:"#ef4444",padding:"2px 6px",cursor:"pointer",fontSize:10,fontWeight:700 }}>Eliminar</button>}
                            </div>
                          </th>
                        ))}
                        <th style={{ padding:"10px 8px",textAlign:"center",color:T.orange,fontWeight:700,fontSize:11,textTransform:"uppercase",position:"sticky",right:0,background:T.bg,zIndex:3,borderBottom:`2px solid ${T.border}`,borderLeft:`2px solid ${T.orange}` }}>TOTAL</th>
                      </tr>
                    </thead>
                    <tbody>
                      {PARAMS.map((param,ri)=>{
                        const key=PARAM_KEYS[ri], isG=key==="galones";
                        const rowBg = ri%2===0?T.bg:T.card;
                        const pv=isG?totalG:key==="api"?pond.api:key==="visc"?pond.visc:key==="azufre"?pond.azufre:key==="agua"?pond.agua:pond.flash;
                        const dec=["azufre","agua"].includes(key)?4:2;
                        let pc=T.text,pi="";
                        if(key==="azufre"&&esVLSFO){pc=azufreOk?T.success:T.danger;pi=azufreOk?" ✅":" 🔴";}
                        if(key==="agua"){pc=aguaOk?T.success:T.orange;pi=aguaOk?" ✅":" ⚠️";}
                        if(key==="flash"){pc=flashOk?T.success:T.orange;pi=flashOk?" ✅":" ⚠️";}
                        const readOnly = fModo==="AUTO" && !isG;
                        return (
                          <tr key={key} style={{ borderBottom:`1px solid ${T.border}`,background:rowBg }}>
                            <td style={{ padding:"8px 14px",fontWeight:700,color:T.muted,fontSize:11,textTransform:"uppercase",position:"sticky",left:0,background:rowBg,zIndex:2,borderRight:`1px solid ${T.border}` }}>{param}</td>
                            {fMps.map((mp,ci)=>(
                              <td key={ci} style={{ padding:"5px 6px",textAlign:"center",borderRight:`1px solid ${T.border}` }}>
                                <input type="number" step="any" value={mp[key]||""} readOnly={readOnly}
                                  onChange={e=>{if(readOnly)return;const n=[...fMps];n[ci][key]=e.target.value;setFMps(n);}}
                                  style={{ width:COL_W-22,textAlign:"center",background:readOnly?T.bg:T.card,border:`1px solid ${readOnly?"transparent":T.border}`,borderRadius:4,padding:"5px 4px",color:readOnly?T.muted:T.text,fontSize:12,outline:"none",cursor:readOnly?"default":"text" }} placeholder="0"/>
                              </td>
                            ))}
                            <td style={{ padding:"8px 10px",textAlign:"center",fontWeight:700,color:isG?T.success:pc,fontSize:13,position:"sticky",right:0,background:T.bg,zIndex:2,borderLeft:`2px solid ${T.orange}` }}>
                              {isG?fmt(totalG):(pv>0?pv.toFixed(dec):"—")}{pi}
                            </td>
                          </tr>
                        );
                      })}
                      <tr style={{ borderBottom:`1px solid ${T.border}`,background:T.bg }}>
                        <td style={{ padding:"8px 14px",fontWeight:700,color:T.muted,fontSize:11,textTransform:"uppercase",position:"sticky",left:0,background:T.bg,zIndex:2,borderRight:`1px solid ${T.border}` }}>% Total</td>
                        {fMps.map((mp,ci)=>{ const p=totalG>0?((Number(mp.galones||0)/totalG)*100).toFixed(1):0; return <td key={ci} style={{ padding:"8px 6px",textAlign:"center",color:T.orange,fontWeight:700,fontSize:12,borderRight:`1px solid ${T.border}` }}>{p}%</td>; })}
                        <td style={{ padding:"8px 10px",textAlign:"center",fontWeight:700,color:T.success,position:"sticky",right:0,background:T.bg,zIndex:2,borderLeft:`2px solid ${T.orange}` }}>100% {totalG>0?"✅":""}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </Card>

              <div style={{ marginBottom:20, display:"flex", gap:10, alignItems:"center" }}>
                <button onClick={()=>{ const nueva={nombre:"NUEVA MP",galones:"",api:"",visc:"",azufre:"",agua:"",flash:""}; setFMps(p=>[...p,nueva]); }}
                  style={{ background:`${T.orange}18`,border:`1px solid ${T.orange}55`,borderRadius:6,color:T.orange,padding:"6px 14px",cursor:"pointer",fontSize:12,fontWeight:700 }}>
                  + Agregar MP
                </button>
                {fModo==="AUTO" && <button onClick={aplicarAuto} style={{ background:`${T.navy}18`,border:`1px solid ${T.navy}55`,borderRadius:6,color:T.navy,padding:"6px 14px",cursor:"pointer",fontSize:12,fontWeight:700 }}>Recalcular histórico</button>}
              </div>

              {/* Cards resumen */}
              {totalG>0 && (
                <div style={{ marginBottom:20 }}>
                  <div style={{ fontSize:12,color:T.muted,marginBottom:10 }}>
                    Total: <b style={{color:T.success}}>{fmt(totalG)} Gls</b> = <b style={{color:T.text}}>{pond.carros.toFixed(1)} carros</b>
                    {esVLSFO&&!azufreOk&&<span style={{marginLeft:12,color:"#ef4444",fontWeight:700}}>⚠️ AZUFRE SOBRE LÍMITE VLSFO (≤0.48%)</span>}
                  </div>
                  <div style={{ display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:10 }}>
                    {[
                      {label:"🔥 AZUFRE",    val:`${pond.azufre.toFixed(4)}%`,  sub:esVLSFO?(azufreOk?"✅ OK VLSFO":"🔴 SOBRE LÍMITE"):"",  color:esVLSFO&&!azufreOk?"#ef4444":T.success},
                      {label:"📊 API",        val:`${pond.api.toFixed(2)}°`,     sub:"(Info)", color:T.text},
                      {label:"💧 AGUA",       val:`${pond.agua.toFixed(4)}%`,    sub:aguaOk?"✅ OK":"⚠️ >0.5%",    color:aguaOk?T.success:T.orange},
                      {label:"📈 VISCOSIDAD", val:`${pond.visc.toFixed(2)} cSt`, sub:"@ 50°C · ASTM D341",       color:T.text},
                      {label:"🔥 FLASH PT",   val:`${pond.flash.toFixed(1)}°C`,  sub:flashOk?"✅ ≥60°C":"⚠️ <60°C", color:flashOk?T.success:T.orange},
                    ].map(c=>(
                      <div key={c.label} style={{ background:T.bg,borderRadius:8,padding:"12px 14px",border:`1px solid ${T.border}` }}>
                        <div style={{ fontSize:10,color:T.muted,fontWeight:600,marginBottom:4 }}>{c.label}</div>
                        <div style={{ fontSize:18,fontWeight:800,color:c.color }}>{c.val}</div>
                        <div style={{ fontSize:10,color:c.color,marginTop:2 }}>{c.sub}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Guardar */}
              <div style={{ display:"flex",justifyContent:"flex-end",gap:10 }}>
                <Btn color={T.orange} disabled={saving} onClick={async()=>{
                  if(!totalG) return showToast("Ingresa galones para al menos una MP",false);
                  setSaving(true);
                  const payload={fecha:fForm.fecha||today(),tanque:fForm.tanque||null,producto:fForm.producto||null,mps:fMps,api_planeado:pond.api,visc_planeado:pond.visc,azufre_planeado:pond.azufre,agua_planeada:pond.agua,flash_point_planeado:pond.flash,total_galones:totalG,total_carros:pond.carros,estado:fForm.estado||"PLANEADA",created_by:session.user.id};
                  const {error}=fForm.id
                    ? await dbCall({ table:"formulaciones", op:"update", data:payload, filters:[{col:"id",val:fForm.id}] })
                    : await dbCall({ table:"formulaciones", op:"insert", data:payload });
                  setSaving(false);
                  if(error) return showToast("Error: "+error,false);
                  await loadData();
                  closeTab(activeTabId);
                  showToast("Formulación guardada");
                }}>{saving?"Guardando...":"Guardar Formulación"}</Btn>
              </div>
            </div>
            );
          })()}

      {/* ═══ ORDEN DE TRABAJO — TAB DETALLE ═══ */}
      {activeTab?.type==="orden_trabajo" && (()=>{
        const otId = activeTab.otId;
        const ot = (ordenesTrabaio||[]).find(o=>o.id===otId);
        if(!ot) return <div style={{ padding:40,textAlign:"center",color:T.muted }}>Cargando orden...</div>;
        const fo = formulaciones.find(f=>f.id===ot.formulacion_id);
        const desc = ot.descargues||[];
        const tras = ot.trasiegos||[];
        const totalPlan = desc.reduce((a,d)=>a+Number(d.galones_planeado||0),0);
        const cmtsDeEstaOT = (cmts||[]).filter(c=>c.ot_id===ot.id);
        const glsDescargadosCarro = (carro)=>{
          const tiq=tiquetes.find(t=>t.id===carro.tiquete);
          const factor=Number(tiq?.factor_tabla13||0), pesoNeto=Number(carro.peso_neto||0);
          return (factor>0&&pesoNeto>0)?Math.round(pesoNeto/factor):Number(carro.galones_descargados||0);
        };
        const prodCarro = (carro)=>normalizarProducto((tiquetes.find(t=>t.id===carro.tiquete))?.producto||"");
        const totalDesc = cmtsDeEstaOT.reduce((sum,c)=>sum+(c.carros||[]).reduce((s,carro)=>s+glsDescargadosCarro(carro),0),0);
        const pct = totalPlan>0?Math.round(totalDesc/totalPlan*100):0;
        const estadoColor = e=>e==="ANALIZADA"?T.success:e==="COMPLETADA"?T.success:e==="RECIRCULANDO"?T.orange:e==="DESCARGANDO"?T.orange:e==="TRASIEGOS"?T.navy:e==="RECHAZADA"?T.danger:T.muted;
        const estadoLabel = e=>e==="ANALIZADA"?"COMPLETADA":e;

        const actualizarOT = async(patch) => {
          await dbCall({ table:"ordenes_trabajo", op:"update", data:{...patch,updated_at:new Date().toISOString()}, filters:[{col:"id",val:ot.id}] });
          await loadData();
        };

        return (
          <div style={{ padding:24, maxWidth:900 }}>
            {/* Header */}
            <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20 }}>
              <div>
                <div style={{ fontWeight:800,fontSize:22,color:T.navy }}>{ot.numero_ot}</div>
                <div style={{ fontSize:12,color:T.muted,marginTop:2 }}>{fo?.producto||""} · {ot.tanque_destino} · {(ot.created_at||"").slice(0,10)}</div>
              </div>
              <Badge label={estadoLabel(ot.estado)} color={estadoColor(ot.estado)}/>
            </div>

            {/* PASO 1: TRASIEGOS */}
            <Card style={{ marginBottom:16,padding:16 }}>
              <div style={{ fontWeight:700,fontSize:13,color:T.navy,marginBottom:10 }}>
                PASO 1 — TRASIEGOS
              </div>
              {tras.length===0 ? (
                <div style={{ color:T.muted,fontSize:12 }}>Sin trasiegos requeridos</div>
              ) : (()=>{
                const esPorteo = (ot.tipo_operacion||"").toLowerCase()==="porteo" || cmtsDeEstaOT.some(c=>c.tipo_operacion==="PORTEO");
                // Calcular galones recibidos por tanque destino desde CMTs de porteo vinculados
                const recibidoPorDestino = {};
                if (esPorteo) {
                  cmtsDeEstaOT.forEach(c=>{
                    if (c.tipo_operacion==="PORTEO") {
                      (c.porteo_descarga_tanques||[]).forEach(r=>{
                        if (r.tanque) recibidoPorDestino[r.tanque]=(recibidoPorDestino[r.tanque]||0)+Math.max(0,Number(r.galonesFinal||0)-Number(r.galonesInicial||0));
                      });
                    }
                  });
                }
                const todosPorteoCompletos = esPorteo && tras.every(t=>(recibidoPorDestino[t.destino]||0)>=Number(t.galones||0));
                return (
                  <>
                    {esPorteo ? (
                      <>
                        <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr 1fr",gap:8,paddingBottom:8,borderBottom:`1px solid ${T.border}`,fontSize:10,fontWeight:600,color:T.muted,marginBottom:6 }}>
                          <div>DESTINO</div>
                          <div style={{ textAlign:"right" }}>PLANEADO</div>
                          <div style={{ textAlign:"right" }}>RECIBIDO</div>
                          <div style={{ textAlign:"right",color:"#ef4444" }}>PENDIENTE</div>
                          <div style={{ textAlign:"right" }}>%</div>
                        </div>
                        {tras.map((t,i)=>{
                          const planeado=Number(t.galones||0);
                          const recibido=recibidoPorDestino[t.destino]||0;
                          const pendiente=Math.max(0,planeado-recibido);
                          const pctT=planeado>0?Math.min(100,Math.round(recibido/planeado*100)):0;
                          const completo=recibido>=planeado&&planeado>0;
                          return (
                            <div key={i} style={{ display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr 1fr",gap:8,padding:"8px 0",borderBottom:`1px solid ${T.border}`,fontSize:12,alignItems:"center" }}>
                              <div style={{ fontWeight:700,color:T.text }}>{t.destino}</div>
                              <div style={{ textAlign:"right",fontWeight:700,color:T.text }}>{fmt(planeado)}</div>
                              <div style={{ textAlign:"right",fontWeight:700,color:recibido>0?T.success:T.muted }}>{fmt(recibido)}</div>
                              <div style={{ textAlign:"right",fontWeight:700,color:pendiente>0?"#ef4444":T.success }}>{fmt(pendiente)}</div>
                              <div style={{ textAlign:"right" }}><span style={{ fontSize:11,fontWeight:700,color:completo?T.success:T.orange }}>{completo?"✅":pctT+"%"}</span></div>
                            </div>
                          );
                        })}
                        {ot.estado==="TRASIEGOS" && todosPorteoCompletos && (
                          <div style={{ marginTop:10 }}>
                            <button onClick={()=>actualizarOT({estado:"RECIRCULANDO",fecha_inicio_recirculacion:new Date().toISOString()})} style={{ background:T.success,border:"none",color:"#fff",borderRadius:6,padding:"7px 18px",cursor:"pointer",fontWeight:700,fontSize:12 }}>Avanzar a Recirculación →</button>
                          </div>
                        )}
                        {ot.estado==="TRASIEGOS" && !todosPorteoCompletos && (
                          <div style={{ marginTop:10 }}>
                            <button onClick={()=>actualizarOT({estado:"RECIRCULANDO",fecha_inicio_recirculacion:new Date().toISOString()})} style={{ background:`${T.orange}22`,border:`1px solid ${T.orange}55`,color:T.orange,borderRadius:6,padding:"7px 18px",cursor:"pointer",fontWeight:700,fontSize:12 }}>Avanzar a Recirculación (manual) →</button>
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        <table style={{ width:"100%",borderCollapse:"collapse",fontSize:12 }}>
                          <thead><tr style={{ borderBottom:`1px solid ${T.border}` }}>
                            {["Origen","Galones","Destino","Estado",""].map(h=><th key={h} style={{ padding:"6px 10px",textAlign:"left",color:T.muted,fontWeight:600,fontSize:10,textTransform:"uppercase" }}>{h}</th>)}
                          </tr></thead>
                          <tbody>
                            {tras.map((t,i)=>(
                              <tr key={i} style={{ borderBottom:`1px solid ${T.border}` }}>
                                <td style={{ padding:"8px 10px",fontWeight:700,color:T.text }}>{t.origen}</td>
                                <td style={{ padding:"8px 10px",color:T.success,fontWeight:700 }}>{fmt(Number(t.galones||0))}</td>
                                <td style={{ padding:"8px 10px",fontWeight:700,color:T.text }}>{t.destino}</td>
                                <td style={{ padding:"8px 10px" }}><span style={{ fontSize:10,fontWeight:700,color:t.completado?T.success:T.orange }}>{t.completado?"✅ Completado":"⏳ Pendiente"}</span></td>
                                <td style={{ padding:"8px 10px" }}>
                                  {!t.completado && ot.estado==="TRASIEGOS" && (
                                    <button onClick={async()=>{
                                      const nuevo=tras.map((tr,j)=>j===i?{...tr,completado:true,fecha:new Date().toISOString()}:tr);
                                      const todosOk=nuevo.every(tr=>tr.completado);
                                      await actualizarOT({trasiegos:nuevo,...(todosOk?{estado:"DESCARGANDO",fecha_inicio_descargue:new Date().toISOString()}:{})});
                                    }} style={{ background:`${T.success}22`,border:`1px solid ${T.success}55`,color:T.success,borderRadius:5,padding:"3px 10px",cursor:"pointer",fontSize:11,fontWeight:700 }}>Marcar ✅</button>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {ot.estado==="TRASIEGOS" && (tras.length===0||tras.every(t=>t.completado)) && (
                          <div style={{ marginTop:10 }}>
                            <button onClick={()=>actualizarOT({estado:"DESCARGANDO",fecha_inicio_descargue:new Date().toISOString()})} style={{ background:T.orange,border:"none",color:"#fff",borderRadius:6,padding:"7px 18px",cursor:"pointer",fontWeight:700,fontSize:12 }}>Iniciar Descargues →</button>
                          </div>
                        )}
                      </>
                    )}
                  </>
                );
              })()}
              {tras.length>0 && (
                <div style={{ marginTop:12,paddingTop:10,borderTop:`1px solid ${T.border}`,display:"flex",alignItems:"center",gap:8,flexWrap:"wrap" }}>
                  {cmtsDeEstaOT.map(c=>{
                    const glsPorteo = c.tipo_operacion==="PORTEO"
                      ? (c.porteo_descarga_tanques||[]).reduce((a,r)=>a+Math.max(0,Number(r.galonesFinal||0)-Number(r.galonesInicial||0)),0)
                      : 0;
                    const gls = c.tipo_operacion==="PORTEO" ? glsPorteo : Number(c.total_movido||0);
                    const esPorteo = c.tipo_operacion==="PORTEO";
                    const placas = esPorteo ? (c.porteo_carros||[]).map(cr=>cr.placa).filter(Boolean) : [];
                    const sufijo = esPorteo
                      ? (placas.length > 0 ? placas.join(" · ") : "Sin placa")
                      : "";
                    return (
                    <span key={c.id}
                      style={{ background:`${T.orange}22`,border:`1px solid ${T.orange}55`,color:T.orange,borderRadius:6,padding:"4px 10px",fontSize:11,fontWeight:700,cursor:"pointer" }}
                      onClick={()=>abrirCmt(c)}>
                      📋 {c.numero_cmt}{sufijo ? ` · ${sufijo}` : ""} — {fmt(gls)} gls
                    </span>
                    );
                  })}
                  <button onClick={()=>{
                    const sede=ot.sede||perfil?.sede||"MALAMBO", planta=ot.planta||perfil?.planta||"PLANTA 1";
                    const tanquesOT=[...new Set([ot.tanque_destino,...(tras||[]).map(t=>t.origen),...(tras||[]).map(t=>t.destino)].filter(Boolean))];
                    const esPorteo = (ot.tipo_operacion||"").toLowerCase()==="porteo" || cmtsDeEstaOT.some(c=>c.tipo_operacion==="PORTEO");
                    otContextRef.current = {ot_id:ot.id, ot_numero:ot.numero_ot};
                    if (esPorteo) {
                      setForm({ot_id:ot.id,ot_numero:ot.numero_ot,bloqueado_ot:true,tipo_operacion:"PORTEO",sede,fecha:today(),tanques_ot:tanquesOT});
                      setCmtPorteoCargaPlanta("");
                      setCmtPorteoCarga([{tanque:"",sondaInicial:"",tempInicial:"",apiInicial:"",galonesInicial:"",sondaFinal:"",tempFinal:"",apiFinal:"",galonesFinal:""}]);
                      setCmtPorteoDescargaPlanta("");
                      setCmtPorteoDescarga([{tanque:"",sondaInicial:"",tempInicial:"",apiInicial:"",galonesInicial:"",sondaFinal:"",tempFinal:"",apiFinal:"",galonesFinal:""}]);
                    } else {
                      setForm({ot_id:ot.id,ot_numero:ot.numero_ot,bloqueado_ot:true,tipo_operacion:"TRASIEGO DE PRODUCTO",sede,fecha:today(),tanques_ot:tanquesOT});
                      setCmtProducto(fo?.producto||"");
                      setCmtAntes([{tanque:"",sonda:"",galones:""}]);
                      setCmtDespues([{tanque:"",producto:fo?.producto||"",sonda:"",galones:""}]);
                    }
                    setCmtCarros([{placa:"",guia:"",tiquete:"",pbs_id:""}]);
                    setModal("cmt");
                  }} style={{ background:T.orange,border:"none",color:"#071422",borderRadius:6,padding:"6px 16px",cursor:"pointer",fontWeight:700,fontSize:12 }}>+ Crear CMT</button>
                  {/* Vincular CMT existente */}
                  {(()=>{
                    const cmtsSinOT = (cmts||[]).filter(c=>!c.ot_id).sort((a,b)=>new Date(b.created_at||0)-new Date(a.created_at||0)).slice(0,20);
                    if(!cmtsSinOT.length) return null;
                    return (
                      <select onChange={async e=>{
                        if(!e.target.value) return;
                        await dbCall({table:"cmts",op:"update",data:{ot_id:ot.id,ot_numero:ot.numero_ot},filters:[{col:"id",val:e.target.value}]});
                        await loadData(); showToast("CMT vinculado a "+ot.numero_ot);
                        e.target.value="";
                      }} style={{padding:"6px 10px",borderRadius:6,border:`1px solid ${T.border}`,background:T.card,color:T.text,fontSize:12,cursor:"pointer"}}>
                        <option value="">Vincular CMT existente…</option>
                        {cmtsSinOT.map(c=><option key={c.id} value={c.id}>{c.numero_cmt} · {c.tipo_operacion} · {c.fecha}</option>)}
                      </select>
                    );
                  })()}
                </div>
              )}
            </Card>

            {/* PASO 2: DESCARGUES */}
            <Card style={{ marginBottom:16,padding:16 }}>
              <div style={{ fontWeight:700,fontSize:13,color:T.navy,marginBottom:10 }}>
                PASO 2 — DESCARGUES
                {ot.estado==="DESCARGANDO" && <span style={{ marginLeft:10,fontSize:11,color:T.orange }}>{pct}% completado</span>}
              </div>
              {desc.length===0 ? <div style={{ color:T.muted,fontSize:12 }}>Sin descargues</div> : (() => {
                const grupos = agruparDescarguesPorProducto(desc);
                return (
                  <>
                    {ot.estado==="DESCARGANDO" && (
                      <div style={{ background:T.border,borderRadius:4,height:8,marginBottom:12 }}>
                        <div style={{ width:`${pct}%`,background:T.orange,height:8,borderRadius:4,transition:"width 0.3s" }}/>
                      </div>
                    )}
                    {/* Encabezados */}
                    <div style={{ display:"grid",gridTemplateColumns:"2fr 1fr 1fr 1fr 1.4fr 0.3fr",gap:8,paddingBottom:8,borderBottom:`1px solid ${T.border}`,fontSize:10,fontWeight:600,color:T.muted,marginBottom:6 }}>
                      <div>PRODUCTO</div>
                      <div style={{ textAlign:"right" }}>PLANEADO</div>
                      <div style={{ textAlign:"right" }}>DESCARGADO</div>
                      <div style={{ textAlign:"right",color:"#ef4444" }}>PENDIENTE</div>
                      <div style={{ textAlign:"center" }}>ACCIÓN</div>
                      <div></div>
                    </div>
                    {/* Filas agrupadas */}
                    {grupos.map(grupo => {
                      const gPlan = grupo.galones_planeado;
                      const gReal = cmtsDeEstaOT.reduce((sum,c)=>sum+(c.carros||[]).reduce((s,carro)=>{
                        if(prodCarro(carro)!==grupo.productoBase) return s;
                        return s+glsDescargadosCarro(carro);
                      },0),0);
                      const gFalta = Math.max(0, gPlan - gReal);
                      const gPct = gPlan > 0 ? Math.round(gReal / gPlan * 100) : 0;
                      return (
                        <div key={grupo.productoBase} style={{ marginBottom:6 }}>
                          {/* Fila principal */}
                          <div onClick={() => toggleOtExpandir(grupo.productoBase)} style={{ display:"grid",gridTemplateColumns:"2fr 1fr 1fr 1fr 1.4fr 0.3fr",gap:8,padding:"9px 10px",background:T.card,borderRadius:6,cursor:"pointer",borderLeft:`3px solid ${gPct>=100?T.success:T.orange}`,transition:"background 0.15s" }}
                            onMouseEnter={e=>e.currentTarget.style.background=T.bg}
                            onMouseLeave={e=>e.currentTarget.style.background=T.card}
                          >
                            <div style={{ fontWeight:700,color:T.text,fontSize:12 }}>{grupo.productoBase}</div>
                            <div style={{ textAlign:"right",color:T.muted,fontSize:12 }}>{fmtNum(gPlan)}</div>
                            <div style={{ textAlign:"right",color:T.success,fontWeight:700,fontSize:12 }}>{fmtNum(gReal)}</div>
                            <div style={{ textAlign:"right",color:"#ef4444",fontWeight:700,fontSize:12 }}>{fmtNum(Math.max(0,gPlan-gReal))}</div>
                            <div style={{ textAlign:"center" }}>
                              {ot.estado==="DESCARGANDO" && gPct<100 && (
                                <div style={{ display:"flex",gap:4,alignItems:"center",justifyContent:"center" }} onClick={e=>e.stopPropagation()}>
                                  <input type="number" placeholder="gls" style={{ width:90,padding:"3px 6px",border:`1px solid ${T.border}`,borderRadius:4,fontSize:11,background:T.bg,color:T.text,outline:"none" }}
                                    onKeyDown={async e=>{ if(e.key==="Enter"){
                                      const val = Number(e.target.value || 0);
                                      const nuevo = desc.map(dd => {
                                        const pb = normalizarProducto(dd.producto || dd.nombre || "");
                                        if (pb !== grupo.productoBase) return dd;
                                        const ddPlan = Number(dd.galones_planeado || 0);
                                        const ddReal = Number(dd.galones_descargado || 0);
                                        const ddFalta = Math.max(0, ddPlan - ddReal);
                                        const ddAgregar = Math.min(ddFalta, val * (ddFalta / Math.max(1, gFalta)));
                                        return { ...dd, galones_descargado: Math.min(ddPlan, ddReal + ddAgregar) };
                                      });
                                      const todos = nuevo.every(dd => Number(dd.galones_descargado||0) >= Number(dd.galones_planeado||0));
                                      await actualizarOT({descargues:nuevo,...(todos?{estado:"RECIRCULANDO",fecha_fin_descargue:new Date().toISOString(),fecha_inicio_recirculacion:new Date().toISOString(),recirculacion_estado:"en_progreso"}:{})});
                                      e.target.value="";
                                    }}}/>
                                  <span style={{ fontSize:9,color:T.muted }}>↵</span>
                                </div>
                              )}
                              {gPct>=100 && <span style={{ fontSize:10,fontWeight:700,color:T.success }}>✅ Completo</span>}
                            </div>
                            <div style={{ textAlign:"center",color:T.muted,fontSize:12 }}>{otExpandidos[grupo.productoBase]?"▲":"▼"}</div>
                          </div>
                          {/* Detalle expandido */}
                          {otExpandidos[grupo.productoBase] && (
                            <div style={{ background:T.bg,padding:"8px 12px",marginTop:2,borderRadius:6,fontSize:10,color:T.muted,borderLeft:`3px solid ${T.orange}` }}>
                              <div style={{ marginBottom:6,fontWeight:600,color:T.orange }}>Carros descargados:</div>
                              {cmtsDeEstaOT.flatMap(c=>(c.carros||[]).filter(cr=>prodCarro(cr)===grupo.productoBase).map(cr=>({cr,cmt:c}))).map(({cr,cmt},pi) => (
                                <div key={pi} style={{ display:"flex",justifyContent:"space-between",marginBottom:3,paddingLeft:8 }}>
                                  <span>├─ {cr.placa||"—"} <span style={{ color:T.muted }}>({cmt.numero_cmt})</span></span>
                                  <span style={{ color:T.success,fontWeight:500 }}>{fmtNum(glsDescargadosCarro(cr))} gls</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {/* Fila total */}
                    <div style={{ display:"grid",gridTemplateColumns:"2fr 1fr 1fr 1fr 1.4fr 0.3fr",gap:8,padding:"10px",background:T.bg,borderRadius:6,marginTop:8,borderTop:`2px solid ${T.orange}`,fontWeight:700,fontSize:12 }}>
                      <div style={{ color:T.muted }}>TOTAL</div>
                      <div style={{ textAlign:"right",color:T.text }}>{fmt(totalPlan)}</div>
                      <div style={{ textAlign:"right",color:T.success }}>{fmt(totalDesc)}</div>
                      <div style={{ textAlign:"right",color:"#ef4444" }}>{fmt(Math.max(0,totalPlan-totalDesc))}</div>
                      <div style={{ textAlign:"center",color:T.orange }}>{pct}%</div>
                      <div></div>
                    </div>
                    {ot.estado==="DESCARGANDO" && pct>=90 && (
                      <div style={{ marginTop:10, display:"flex", alignItems:"center", gap:12 }}>
                        <button onClick={()=>actualizarOT({estado:"RECIRCULANDO",fecha_fin_descargue:new Date().toISOString(),fecha_inicio_recirculacion:new Date().toISOString(),recirculacion_estado:"en_progreso"})}
                          style={{ background:T.success,border:"none",color:"#071422",borderRadius:6,padding:"8px 20px",cursor:"pointer",fontWeight:700,fontSize:12 }}>
                          ✅ Descargue Finalizado → Iniciar Recirculación
                        </button>
                        {pct<100 && <span style={{ fontSize:11,color:T.muted }}>({pct}% completado — variación permisible)</span>}
                      </div>
                    )}
                  </>
                );
              })()}
              {desc.length>0 && (
                <div style={{ marginTop:12,paddingTop:10,borderTop:`1px solid ${T.border}`,display:"flex",alignItems:"center",gap:8,flexWrap:"wrap" }}>
                  {cmtsDeEstaOT.filter(c=>c.tipo_operacion!=="TRASIEGO DE PRODUCTO").map(c=>(
                    <span key={c.id} style={{ background:`${T.orange}22`,border:`1px solid ${T.orange}55`,color:T.orange,borderRadius:6,padding:"4px 10px",fontSize:11,fontWeight:700,cursor:"pointer" }}
                      onClick={()=>abrirCmt(c)}>
                      📋 {c.numero_cmt} — {fmt(Number(c.total_movido||0))} gls
                    </span>
                  ))}
                  <button onClick={()=>abrirCmtDesdeOt(ot, "")}
                    style={{ background:T.orange,border:"none",color:"#071422",borderRadius:6,padding:"6px 16px",cursor:"pointer",fontWeight:700,fontSize:12 }}>+ Crear CMT</button>
                </div>
              )}
            </Card>

            {/* PASO 3: RECIRCULACIÓN */}
            <Card style={{ marginBottom:16,padding:16 }}>
              <div style={{ fontWeight:700,fontSize:13,color:T.navy,marginBottom:10 }}>
                PASO 3 — RECIRCULACIÓN
              </div>
              <div style={{ fontSize:12,color:T.muted,marginBottom:12 }}>Tiempo programado: <b style={{ color:T.text }}>{ot.recirculacion_tiempo_total} min ({(ot.recirculacion_tiempo_total/60).toFixed(1)}h)</b></div>
              {ot.estado==="RECIRCULANDO" && (()=>{
                const trasiegos = ot.trasiegos || [];
                // Tiempos por tanque guardados en recircDates[otId][i] = {inicio, fin}
                const getVal = (i, campo) => {
                  const local = recircDates[ot.id]?.[i]?.[campo];
                  if (local !== undefined) return local;
                  const tr = trasiegos[i];
                  const iso = tr?.[`recirculacion_${campo}`];
                  return iso ? iso.slice(0,16) : "";
                };
                const setVal = (i, campo, val) =>
                  setRecircDates(prev=>({...prev,[ot.id]:{...prev[ot.id],[i]:{...prev[ot.id]?.[i],[campo]:val}}}));
                const guardaTrasiegosRecirc = async () => {
                  const nuevos = trasiegos.map((tr,i)=>({
                    ...tr,
                    recirculacion_inicio: recircDates[ot.id]?.[i]?.inicio !== undefined
                      ? (recircDates[ot.id][i].inicio ? new Date(recircDates[ot.id][i].inicio).toISOString() : null)
                      : tr.recirculacion_inicio || null,
                    recirculacion_fin: recircDates[ot.id]?.[i]?.fin !== undefined
                      ? (recircDates[ot.id][i].fin ? new Date(recircDates[ot.id][i].fin).toISOString() : null)
                      : tr.recirculacion_fin || null,
                  }));
                  await actualizarOT({ trasiegos: nuevos });
                };
                const todosListos = trasiegos.length > 0 && trasiegos.every((_,i)=>getVal(i,"inicio") && getVal(i,"fin"));
                const inSt = { width:"100%",padding:"7px 8px",borderRadius:6,border:`1px solid ${T.border}`,background:T.card,color:T.text,fontSize:11,outline:"none",boxSizing:"border-box" };
                return (
                  <div>
                    {/* Fila de cabecera */}
                    <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:6 }}>
                      <div style={{ fontSize:10,fontWeight:700,color:T.muted,textTransform:"uppercase",letterSpacing:0.5 }}>Tanque</div>
                      <div style={{ fontSize:10,fontWeight:700,color:T.muted,textTransform:"uppercase",letterSpacing:0.5 }}>Inicio recirculación</div>
                      <div style={{ fontSize:10,fontWeight:700,color:T.muted,textTransform:"uppercase",letterSpacing:0.5 }}>Fin recirculación</div>
                    </div>
                    {trasiegos.map((tr,i)=>(
                      <div key={i} style={{ display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:8,alignItems:"center" }}>
                        <div style={{ fontWeight:700,fontSize:12,color:T.navy }}>
                          {tr.destino || `Trasiego ${i+1}`}
                          {tr.origen && <span style={{ fontWeight:400,fontSize:11,color:T.muted }}> (desde {tr.origen})</span>}
                        </div>
                        <input type="datetime-local" style={inSt}
                          value={getVal(i,"inicio")}
                          onChange={e=>{ setVal(i,"inicio",e.target.value); }}
                          onBlur={guardaTrasiegosRecirc}/>
                        <input type="datetime-local" style={inSt}
                          value={getVal(i,"fin")}
                          onChange={e=>{ setVal(i,"fin",e.target.value); }}
                          onBlur={guardaTrasiegosRecirc}/>
                      </div>
                    ))}
                    <div style={{ marginTop:14 }}>
                      <button disabled={!todosListos}
                        onClick={async()=>{
                          await guardaTrasiegosRecirc();
                          await actualizarOT({estado:"COMPLETADA",fecha_fin_recirculacion:new Date().toISOString(),recirculacion_estado:"completada"});
                        }}
                        style={{ background:todosListos?T.success:"#ccc",border:"none",color:todosListos?"#071422":"#888",borderRadius:6,padding:"7px 18px",cursor:todosListos?"pointer":"not-allowed",fontWeight:700,fontSize:12,transition:"background 0.2s" }}>
                        ✅ Recirculación Completada → Enviar a Lab
                      </button>
                      {!todosListos && <div style={{ fontSize:11,color:T.muted,marginTop:6 }}>⚠️ Completa inicio y fin de recirculación para cada tanque</div>}
                    </div>
                  </div>
                );
              })()}
              {ot.estado==="COMPLETADA" && (
                <div style={{ fontSize:12,color:T.orange,fontWeight:700 }}>⏳ Pendiente análisis Laboratorio (Tiquete Planta 2)</div>
              )}
              {ot.estado==="ANALIZADA" && (
                <div style={{ fontSize:12,color:T.success,fontWeight:700 }}>✅ Analizada — Resultado disponible en Laboratorio</div>
              )}
            </Card>

            {/* Análisis planeado vs real */}
            {fo && (()=>{
              const tiqLab = ot.tiquete_id ? tiquetes.find(t=>t.id===ot.tiquete_id) : tiquetes.find(t=>t.ot_id===ot.id);
              const params = [
                {lbl:"API",   plan:fo.api_planeado,         real:tiqLab?.api_corregido,      u:"°",   danger:(p,r)=>Math.abs(p-r)>1},
                {lbl:"Visc",  plan:fo.visc_planeado,        real:tiqLab?.viscosidad,         u:" cSt",danger:(p,r)=>Math.abs(p-r)>30},
                {lbl:"Azufre",plan:fo.azufre_planeado,      real:tiqLab?.azufre,             u:"%",   danger:(p,r)=>Math.abs(p-r)>0.05},
                {lbl:"Agua",  plan:fo.agua_planeada,        real:tiqLab?.agua_destilacion,   u:"%",   danger:(p,r)=>Math.abs(p-r)>0.1},
                {lbl:"Flash", plan:fo.flash_point_planeado, real:tiqLab?.flash_point,        u:"°C",  danger:(p,r)=>Math.abs(p-r)>5},
                {lbl:"TSA",   plan:null,                   real:tiqLab?.tsa,                u:"%",   danger:(_,r)=>Number(r)>=0.1},
              ];
              return (
                <Card style={{ padding:16 }}>
                  <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12 }}>
                    <div style={{ fontWeight:700,fontSize:12,color:T.muted,textTransform:"uppercase" }}>Análisis Planeado vs Real</div>
                    {tiqLab ? (
                      <span style={{ fontSize:11,color:T.success,fontFamily:"monospace",fontWeight:700,cursor:"pointer",textDecoration:"underline" }}
                        onClick={()=>{setForm({...tiqLab});setModal("tiquete");}}>🧪 {tiqLab.id} · {tiqLab.resultado}</span>
                    ) : (
                      <span style={{ fontSize:11,color:T.muted,fontStyle:"italic" }}>Sin análisis de laboratorio vinculado</span>
                    )}
                  </div>
                  <div style={{ display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:10 }}>
                    {params.map(({lbl,plan,real,u,danger})=>{
                      const hayReal = real!=null && real!==undefined && real!=="";
                      const desviacion = hayReal && plan ? danger(Number(plan),Number(real)) : false;
                      return (
                        <div key={lbl} style={{ borderRadius:8,border:`1px solid ${desviacion?T.danger:T.border}`,overflow:"hidden" }}>
                          <div style={{ background:desviacion?`${T.danger}18`:T.bg,padding:"6px 10px",borderBottom:`1px solid ${desviacion?T.danger:T.border}` }}>
                            <div style={{ fontSize:10,color:desviacion?T.danger:T.muted,fontWeight:700,textAlign:"center" }}>{lbl}</div>
                          </div>
                          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr" }}>
                            <div style={{ padding:"8px 6px",textAlign:"center",borderRight:`1px solid ${T.border}` }}>
                              <div style={{ fontSize:9,color:T.muted,marginBottom:2 }}>Planeado</div>
                              <div style={{ fontSize:13,fontWeight:700,color:T.text }}>{Number(plan||0).toFixed(2)}{u}</div>
                            </div>
                            <div style={{ padding:"8px 6px",textAlign:"center" }}>
                              <div style={{ fontSize:9,color:T.muted,marginBottom:2 }}>Real</div>
                              <div style={{ fontSize:13,fontWeight:700,color:hayReal?(desviacion?T.danger:T.success):T.muted }}>
                                {hayReal ? `${Number(real).toFixed(2)}${u}` : "—"}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </Card>
              );
            })()}

            {/* Botones peligrosos — solo coordinador y administrador */}
            {!["COMPLETADA","RECHAZADA"].includes(ot.estado) && ["coordinador","administrador"].includes(perfil?.rol) && (
              <div style={{ marginTop:16,display:"flex",gap:10 }}>
                <button onClick={async()=>{ if(!confirm("¿Rechazar esta OT?")) return; await actualizarOT({estado:"RECHAZADA"}); }} style={{ background:"#ef444422",border:"1px solid #ef444455",color:"#ef4444",borderRadius:6,padding:"7px 16px",cursor:"pointer",fontWeight:700,fontSize:12 }}>✗ Rechazar OT</button>
              </div>
            )}
          </div>
        );
      })()}

      {/* ═══ FORMS (inline in content area) ═══ */}

      {importExcel && (
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
          <div style={{background:T.card,borderRadius:12,width:"100%",maxWidth:900,maxHeight:"90vh",display:"flex",flexDirection:"column",overflow:"hidden",boxShadow:"0 20px 60px rgba(0,0,0,0.5)"}}>
            <div style={{background:T.navy,borderBottom:`3px solid ${T.orange}`,padding:"16px 24px",display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0}}>
              <div>
                <div style={{fontWeight:800,fontSize:15,color:"#fff",letterSpacing:1}}>VISTA PREVIA — IMPORTAR EXCEL</div>
                <div style={{fontSize:11,color:"#ffffff88",marginTop:2}}>Pestañas: {importExcel.pestañas.join(", ")} · {importExcel.preview.length} filas leídas</div>
              </div>
              <button onClick={()=>setImportExcel(null)} style={{background:"rgba(255,255,255,0.1)",border:"none",color:"#fff",fontSize:18,cursor:"pointer",borderRadius:6,width:30,height:30,display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
            </div>
            <div style={{padding:"12px 16px",background:T.bg,flexShrink:0,display:"flex",gap:16,alignItems:"center",fontSize:12,flexWrap:"wrap"}}>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <span style={{color:T.muted,fontWeight:700,fontSize:11,textTransform:"uppercase",letterSpacing:1}}>Importar desde:</span>
                <input type="date" value={importFechaDesde} onChange={e=>setImportFechaDesde(e.target.value)}
                  style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:6,padding:"5px 10px",color:T.text,fontSize:12,outline:"none"}}/>
                {importFechaDesde && <button onClick={()=>setImportFechaDesde("")} style={{background:"none",border:"none",color:T.muted,cursor:"pointer",fontSize:12}}>✕ Quitar filtro</button>}
              </div>
              {(()=>{
                const filtradas = importExcel.preview.filter(f=>!f._duplicado&&(!importFechaDesde||f.fecha>=importFechaDesde));
                const dupls = importExcel.preview.filter(f=>f._duplicado);
                const omitFecha = importExcel.preview.filter(f=>!f._duplicado&&importFechaDesde&&f.fecha<importFechaDesde).length;
                return (<>
                  <span style={{color:T.success,fontWeight:700}}>✔ {filtradas.length} para importar</span>
                  <span style={{color:T.danger,fontWeight:700}}>✖ {dupls.length} duplicadas</span>
                  {omitFecha>0&&<span style={{color:T.muted,fontWeight:700}}>⊘ {omitFecha} anteriores a la fecha</span>}
                </>);
              })()}
            </div>
            <div data-scroll-key="viajes-import" style={{overflowY:"auto",flex:1}}>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
                <thead>
                  <tr>{["Estado","Pestaña","Placa","Transportadora","Producto","Guía","Fecha","Gls Guía","Conductor"].map(c=>(
                    <th key={c} style={{padding:"8px 10px",fontSize:9,color:T.navy,textTransform:"uppercase",letterSpacing:1,fontWeight:700,borderBottom:`2px solid ${T.border}`,whiteSpace:"nowrap",background:T.bg,textAlign:"left"}}>{c}</th>
                  ))}</tr>
                </thead>
                <tbody>
                  {importExcel.preview.map((f,i)=>{
                    const omitida = !f._duplicado && importFechaDesde && f.fecha < importFechaDesde;
                    return (
                    <tr key={i} style={{background:f._duplicado||omitida?"#f5f5f5":i%2===0?T.bg:T.card,opacity:f._duplicado||omitida?0.4:1,borderBottom:`1px solid ${T.border}`}}>
                      <td style={{padding:"7px 10px",whiteSpace:"nowrap"}}>
                        {f._duplicado ? <span style={{color:T.danger,fontWeight:700,fontSize:10}}>DUPLICADA</span>
                          : omitida ? <span style={{color:T.muted,fontWeight:700,fontSize:10}}>OMITIDA</span>
                          : <span style={{color:T.success,fontWeight:700,fontSize:10}}>IMPORTAR</span>}
                      </td>
                      <td style={{padding:"7px 10px",whiteSpace:"nowrap",color:T.muted,fontSize:10}}>{f._pestaña}</td>
                      <td style={{padding:"7px 10px",fontWeight:700,whiteSpace:"nowrap"}}>{f.placa}</td>
                      <td style={{padding:"7px 10px",whiteSpace:"nowrap"}}>{f.transportadora}</td>
                      <td style={{padding:"7px 10px",whiteSpace:"nowrap"}}>{f.producto}</td>
                      <td style={{padding:"7px 10px",fontFamily:"monospace",whiteSpace:"nowrap"}}>{f.guia||<span style={{color:T.muted}}>—</span>}</td>
                      <td style={{padding:"7px 10px",whiteSpace:"nowrap"}}>{f.fecha}</td>
                      <td style={{padding:"7px 10px",textAlign:"right",whiteSpace:"nowrap"}}>{f.gls_netos_guia>0?f.gls_netos_guia.toLocaleString():"—"}</td>
                      <td style={{padding:"7px 10px",whiteSpace:"nowrap"}}>{f.conductor||"—"}</td>
                    </tr>
                  )})}
                </tbody>
              </table>
            </div>
            <div style={{padding:16,background:T.bg,borderTop:`1px solid ${T.border}`,display:"flex",justifyContent:"flex-end",gap:10,flexShrink:0}}>
              <Btn outline onClick={()=>setImportExcel(null)}>Cancelar</Btn>
              {(()=>{
                const n = importExcel.preview.filter(f=>!f._duplicado&&(!importFechaDesde||f.fecha>=importFechaDesde)).length;
                return <Btn color={T.success} onClick={confirmarImportExcel} disabled={saving||n===0}>
                  {saving?"Importando...":`Importar ${n} viajes`}
                </Btn>;
              })()}
            </div>
          </div>
        </div>
      )}

      {modalTankAdmin && (
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.45)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
          <div style={{background:T.card,borderRadius:14,padding:24,width:"100%",maxWidth:520,maxHeight:"85vh",overflowY:"auto",boxShadow:"0 8px 32px rgba(0,0,0,0.22)"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18}}>
              <div style={{fontWeight:800,fontSize:16,color:T.navy,display:"flex",alignItems:"center",gap:8}}><Wrench size={16}/>Asignación de Tanques por Familia</div>
              <button onClick={()=>setModalTankAdmin(false)} style={{background:"none",border:"none",cursor:"pointer",color:T.muted,fontSize:20,lineHeight:1}}>×</button>
            </div>
            <div style={{fontSize:11,color:T.muted,marginBottom:16}}>Define si cada tanque almacena producto Negro o Blanco (MGO/Diesel). Esta configuración se guarda localmente.</div>
            <div style={{display:"flex",flexDirection:"column",gap:6}}>
              {[...tanques].sort((a,b)=>a.id.localeCompare(b.id)).map(t=>{
                const current = tankFamilias[t.id] || ((() => { const u=(t.producto||"").toUpperCase(); return u.includes("MGO")||u.includes("DIESEL")||u.includes("DISEL")||u==="NACIONAL"||u==="INTERNACIONAL" ? "blanco" : "negro"; })());
                return (
                  <div key={t.id} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 10px",background:T.bg,borderRadius:8,border:`1px solid ${T.border}`}}>
                    <span style={{fontWeight:700,color:T.navy,width:90,flexShrink:0,fontSize:12}}>{t.id}</span>
                    <span style={{flex:1,fontSize:11,color:T.muted}}>{t.producto||"Sin producto"} · {((t.nivel||0)/1000).toFixed(1)}k / {((t.capacidad||0)/1000).toFixed(1)}k gls</span>
                    <div style={{display:"flex",gap:0,borderRadius:6,overflow:"hidden",border:`1px solid ${T.border}`}}>
                      {["negro","blanco"].map(fam=>(
                        <button key={fam} onClick={()=>{
                          const nuevo = {...tankFamilias, [t.id]:fam};
                          setTankFamilias(nuevo);
                          localStorage.setItem("tankFamilias", JSON.stringify(nuevo));
                        }} style={{padding:"4px 12px",fontSize:11,fontWeight:700,cursor:"pointer",border:"none",outline:"none",
                          background:current===fam?(fam==="negro"?T.navy:"#38bdf8"):T.card,
                          color:current===fam?"#fff":T.muted,transition:"background 0.15s"}}>
                          {fam==="negro"?"⬛":"⬜"} {fam}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{display:"flex",justifyContent:"flex-end",marginTop:18}}>
              <button onClick={()=>setModalTankAdmin(false)}
                style={{padding:"9px 24px",background:T.navy,color:"#fff",border:"none",borderRadius:8,fontWeight:700,fontSize:13,cursor:"pointer"}}>
                Listo
              </button>
            </div>
          </div>
        </div>
      )}

      {modalFlota && (()=>{
        const productos = [...new Set((viajes||[]).map(v=>v.producto).filter(Boolean))].sort();
        const viajesFechas = (viajes||[]).filter(v =>
          v.estado==="En Ruta" &&
          (!flotaFechaDesde || v.fecha >= flotaFechaDesde) &&
          (!flotaFechaHasta || v.fecha <= flotaFechaHasta)
        );
        const viajesConDias = viajesFechas.filter(v => Number(flotaDiasProducto[v.producto]||0) > 0);
        const transUnicos = [...new Set((viajes||[]).map(v=>v.transportadora).filter(Boolean))].sort();
        const productosRedir = [...new Set((viajes||[]).map(v=>v.producto).filter(Boolean))].sort();
        const viajesRedir = (viajes||[]).filter(v =>
          v.estado==="En Ruta" &&
          (!flotaRedirDesde || v.fecha >= flotaRedirDesde) &&
          (!flotaRedirHasta || v.fecha <= flotaRedirHasta) &&
          (!flotaRedirTrans || v.transportadora === flotaRedirTrans) &&
          (!flotaRedirProducto || v.producto === flotaRedirProducto) &&
          (!flotaRedirPlaca || (v.placa||"").toUpperCase().includes(flotaRedirPlaca.toUpperCase())) &&
          (!flotaRedirSedeActual || v.sede === flotaRedirSedeActual)
        );
        const inpStyle = {background:T.card,border:`1px solid ${T.border}`,borderRadius:6,padding:"6px 10px",color:T.text,fontSize:12,outline:"none",fontFamily:"system-ui,sans-serif"};
        const numStyle = {background:T.card,border:`1px solid ${T.border}`,borderRadius:6,padding:"4px 8px",color:T.text,fontSize:12,outline:"none",width:60,textAlign:"center"};
        const ACCIONES_FLOTA = [
          { k:"fechas",    label:"Calcular Fechas Estimadas de Llegada", color:T.orange },
          { k:"redirigir", label:"Redirigir Sede de Destino",            color:"#6366f1" },
          { k:"eliminar",  label:"Editar / Eliminar Registros",           color:T.danger  },
        ];
        const accionActual = ACCIONES_FLOTA.find(a=>a.k===flotaAccion);
        return (
        <Modal title="⚙ Administrar Flota" onClose={()=>{ setModalFlota(false); setFlotaAccion(""); }} wide>
          {/* Selector de acción */}
          <div style={{marginBottom:20}}>
            <Lbl>Selecciona la operación a realizar</Lbl>
            <select value={flotaAccion} onChange={e=>{ setFlotaAccion(e.target.value); setFlotaElimConfirm(false); }}
              style={{width:"100%",background:T.card,border:`1px solid ${T.border}`,borderRadius:8,padding:"10px 14px",
                color:flotaAccion?accionActual?.color:T.muted,fontSize:13,fontWeight:flotaAccion?700:400,outline:"none",cursor:"pointer"}}>
              <option value="">— Seleccionar operación —</option>
              {ACCIONES_FLOTA.map(a=><option key={a.k} value={a.k}>{a.label}</option>)}
            </select>
          </div>

          {flotaAccion==="" && (
            <div style={{textAlign:"center",padding:"32px 0",color:T.muted,fontSize:13}}>
              Selecciona una operación arriba para continuar.
            </div>
          )}

          {/* SECCIÓN 1: Calcular fechas estimadas */}
          {flotaAccion==="fechas" && <Section title="Calcular Fechas Estimadas de Llegada" color={T.orange}>
            <div style={{fontSize:12,color:T.muted,marginBottom:10}}>
              Selecciona el período de cargue y configura los días de viaje por producto. Se actualizará la fecha estimada de llegada de todos los viajes "En Ruta" en ese rango.
            </div>
            <div style={{display:"flex",gap:12,alignItems:"center",marginBottom:14,flexWrap:"wrap"}}>
              <div><Lbl>Fecha cargue desde</Lbl><input type="date" value={flotaFechaDesde} onChange={e=>setFlotaFechaDesde(e.target.value)} style={inpStyle}/></div>
              <div><Lbl>Fecha cargue hasta</Lbl><input type="date" value={flotaFechaHasta} onChange={e=>setFlotaFechaHasta(e.target.value)} style={inpStyle}/></div>
              <div style={{marginTop:16,fontSize:12,color:T.muted}}>
                {viajesFechas.length} viajes en el rango · <b style={{color:T.orange}}>{viajesConDias.length}</b> con días configurados
              </div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:8,marginBottom:14}}>
              {productos.map(p => (
                <div key={p} style={{display:"flex",alignItems:"center",justifyContent:"space-between",background:T.bg,borderRadius:6,padding:"6px 10px",gap:8}}>
                  <span style={{fontSize:12,fontWeight:600,color:T.text}}>{p}</span>
                  <div style={{display:"flex",alignItems:"center",gap:4}}>
                    <input type="number" min="0" max="30" value={flotaDiasProducto[p]||""} placeholder="días"
                      style={numStyle}
                      onChange={e=>{
                        const v={...flotaDiasProducto,[p]:e.target.value};
                        setFlotaDiasProducto(v);
                        localStorage.setItem("flota_dias_producto",JSON.stringify(v));
                      }}/>
                    <span style={{fontSize:11,color:T.muted}}>días</span>
                  </div>
                </div>
              ))}
            </div>
            <div style={{display:"flex",justifyContent:"flex-end"}}>
              <Btn color={T.orange} onClick={aplicarFechasFlota} disabled={saving||viajesConDias.length===0}>
                {saving?"Aplicando...": `Aplicar a ${viajesConDias.length} viajes`}
              </Btn>
            </div>
          </Section>}

          {/* SECCIÓN 2: Redirigir sede */}
          {flotaAccion==="redirigir" && <Section title="Redirigir Sede de Destino" color="#6366f1">
            <div style={{fontSize:12,color:T.muted,marginBottom:10}}>
              Selecciona viajes por período de cargue y asígnales una nueva sede destino. Útil cuando un lote cargado se redirige internamente a otra planta.
            </div>
            <div style={{display:"flex",gap:12,alignItems:"flex-end",flexWrap:"wrap",marginBottom:10}}>
              <div><Lbl>Fecha cargue desde</Lbl><input type="date" value={flotaRedirDesde} onChange={e=>setFlotaRedirDesde(e.target.value)} style={inpStyle}/></div>
              <div><Lbl>Fecha cargue hasta</Lbl><input type="date" value={flotaRedirHasta} onChange={e=>setFlotaRedirHasta(e.target.value)} style={inpStyle}/></div>
              <div>
                <Lbl>Transportadora</Lbl>
                <select value={flotaRedirTrans} onChange={e=>setFlotaRedirTrans(e.target.value)} style={inpStyle}>
                  <option value="">Todas</option>
                  {transUnicos.map(t=><option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <Lbl>Producto</Lbl>
                <select value={flotaRedirProducto} onChange={e=>setFlotaRedirProducto(e.target.value)} style={inpStyle}>
                  <option value="">Todos</option>
                  {productosRedir.map(p=><option key={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <Lbl>Placa</Lbl>
                <input type="text" value={flotaRedirPlaca} onChange={e=>setFlotaRedirPlaca(e.target.value)} placeholder="Buscar..." style={{...inpStyle,width:90}}/>
              </div>
              <div>
                <Lbl>Sede actual</Lbl>
                <select value={flotaRedirSedeActual} onChange={e=>setFlotaRedirSedeActual(e.target.value)} style={inpStyle}>
                  <option value="">Todas</option>
                  {SEDES.map(s=><option key={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <div style={{display:"flex",gap:12,alignItems:"center",marginBottom:14}}>
              <div>
                <Lbl>Nueva sede destino</Lbl>
                <select value={flotaRedirSede} onChange={e=>setFlotaRedirSede(e.target.value)} style={{...inpStyle,fontWeight:700}}>
                  {SEDES.map(s=><option key={s}>{s}</option>)}
                </select>
              </div>
              <div style={{fontSize:12,color:T.muted,paddingTop:16}}>
                <b style={{color:"#6366f1"}}>{viajesRedir.length}</b> viajes seleccionados
              </div>
            </div>
            {viajesRedir.length>0 && (
              <div style={{maxHeight:160,overflowY:"auto",background:T.bg,borderRadius:8,padding:"8px 12px",marginBottom:12,fontSize:11}}>
                {viajesRedir.slice(0,50).map(v=>(
                  <div key={v.id} style={{display:"flex",gap:8,padding:"3px 0",borderBottom:`1px solid ${T.border}`}}>
                    <span style={{color:T.orange,fontFamily:"monospace",minWidth:70}}>{v.id}</span>
                    <span style={{color:T.muted,minWidth:80}}>{v.fecha}</span>
                    <span style={{color:T.text,minWidth:100}}>{v.producto}</span>
                    <span style={{color:T.muted}}>{v.placa}</span>
                    <span style={{marginLeft:"auto",color:T.danger,fontSize:10}}>{v.sede} →</span>
                    <span style={{color:"#6366f1",fontWeight:700,fontSize:10}}>{flotaRedirSede}</span>
                  </div>
                ))}
                {viajesRedir.length>50 && <div style={{color:T.muted,textAlign:"center",paddingTop:4}}>…y {viajesRedir.length-50} más</div>}
              </div>
            )}
            <div style={{display:"flex",justifyContent:"flex-end"}}>
              <Btn color="#6366f1" onClick={redirigirSedeFlota} disabled={saving||viajesRedir.length===0}>
                {saving?"Aplicando...":`Redirigir ${viajesRedir.length} viajes → ${flotaRedirSede}`}
              </Btn>
            </div>
          </Section>}

          {/* SECCIÓN 3: Eliminar registros */}
          {flotaAccion==="eliminar" && (()=>{
            const viajesElim = (viajes||[]).filter(v =>
              (!flotaElimDesde || v.fecha >= flotaElimDesde) &&
              (!flotaElimHasta || v.fecha <= flotaElimHasta) &&
              (!flotaElimTrans || v.transportadora === flotaElimTrans) &&
              (!flotaElimProducto || v.producto === flotaElimProducto) &&
              (!flotaElimPlaca || (v.placa||"").toUpperCase().includes(flotaElimPlaca.toUpperCase()))
            );
            const hayFiltro = flotaElimDesde||flotaElimHasta||flotaElimTrans||flotaElimProducto||flotaElimPlaca;
            return (
            <Section title="Editar / Eliminar Registros" color={T.danger}>
              <div style={{fontSize:12,color:T.muted,marginBottom:10}}>
                Filtra los viajes y luego modifica un campo en masa o elimínalos. Se requiere al menos un filtro.
              </div>
              <div style={{display:"flex",gap:12,alignItems:"flex-end",flexWrap:"wrap",marginBottom:10}}>
                <div><Lbl>Fecha cargue desde</Lbl><input type="date" value={flotaElimDesde} onChange={e=>setFlotaElimDesde(e.target.value)} style={inpStyle}/></div>
                <div><Lbl>Fecha cargue hasta</Lbl><input type="date" value={flotaElimHasta} onChange={e=>setFlotaElimHasta(e.target.value)} style={inpStyle}/></div>
                <div>
                  <Lbl>Transportadora</Lbl>
                  <select value={flotaElimTrans} onChange={e=>setFlotaElimTrans(e.target.value)} style={inpStyle}>
                    <option value="">Todas</option>
                    {[...new Set((viajes||[]).map(v=>v.transportadora).filter(Boolean))].sort().map(t=><option key={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <Lbl>Producto</Lbl>
                  <select value={flotaElimProducto} onChange={e=>setFlotaElimProducto(e.target.value)} style={inpStyle}>
                    <option value="">Todos</option>
                    {[...new Set((viajes||[]).map(v=>v.producto).filter(Boolean))].sort().map(p=><option key={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <Lbl>Placa</Lbl>
                  <input type="text" value={flotaElimPlaca} onChange={e=>setFlotaElimPlaca(e.target.value)} placeholder="Buscar..." style={{...inpStyle,width:90}}/>
                </div>
                <div style={{fontSize:12,paddingBottom:4}}>
                  <b style={{color:T.danger}}>{viajesElim.length}</b> <span style={{color:T.muted}}>viajes seleccionados</span>
                </div>
              </div>
              {viajesElim.length>0 && hayFiltro && (
                <div style={{maxHeight:150,overflowY:"auto",background:T.bg,borderRadius:8,padding:"8px 12px",marginBottom:12,fontSize:11}}>
                  {viajesElim.slice(0,60).map(v=>(
                    <div key={v.id} style={{display:"flex",gap:8,padding:"3px 0",borderBottom:`1px solid ${T.border}`}}>
                      <span style={{color:T.danger,fontFamily:"monospace",minWidth:70}}>{v.id}</span>
                      <span style={{color:T.muted,minWidth:80}}>{v.fecha}</span>
                      <span style={{color:T.text,minWidth:100}}>{v.producto}</span>
                      <span style={{color:T.muted,minWidth:80}}>{v.placa}</span>
                      <span style={{color:T.muted}}>{v.transportadora}</span>
                    </div>
                  ))}
                  {viajesElim.length>60 && <div style={{color:T.muted,textAlign:"center",paddingTop:4}}>…y {viajesElim.length-60} más</div>}
                </div>
              )}
              {/* Modificar campo en masa */}
              {viajesElim.length>0 && hayFiltro && (
                <div style={{background:T.bg,borderRadius:8,padding:"12px 14px",marginBottom:14,border:`1px solid ${T.border}`}}>
                  <div style={{fontWeight:700,fontSize:12,color:T.navy,marginBottom:10}}>✏️ Modificar campo en los {viajesElim.length} viajes filtrados</div>
                  <div style={{display:"flex",gap:10,alignItems:"flex-end",flexWrap:"wrap"}}>
                    <div>
                      <Lbl>Campo a modificar</Lbl>
                      <select value={flotaEditCampo} onChange={e=>{setFlotaEditCampo(e.target.value);setFlotaEditValor("");}}
                        style={inpStyle}>
                        <option value="">— Seleccionar —</option>
                        <option value="fecha">Fecha de cargue</option>
                        <option value="producto">Producto</option>
                        <option value="placa">Placa</option>
                        <option value="transportadora">Transportadora</option>
                        <option value="conductor">Conductor</option>
                        <option value="sede">Sede de destino</option>
                      </select>
                    </div>
                    {flotaEditCampo && (
                      <div>
                        <Lbl>Nuevo valor</Lbl>
                        {flotaEditCampo==="fecha" ? (
                          <input type="date" value={flotaEditValor} onChange={e=>setFlotaEditValor(e.target.value)} style={inpStyle}/>
                        ) : flotaEditCampo==="producto" ? (
                          <select value={flotaEditValor} onChange={e=>setFlotaEditValor(e.target.value)} style={inpStyle}>
                            <option value="">— Seleccionar —</option>
                            {[...MATERIAS_PRIMAS,"VLSFO","MGO","DIESEL NACIONAL","DIESEL INTERNACIONAL"].map(p=><option key={p}>{p}</option>)}
                          </select>
                        ) : flotaEditCampo==="sede" ? (
                          <select value={flotaEditValor} onChange={e=>setFlotaEditValor(e.target.value)} style={inpStyle}>
                            <option value="">— Seleccionar —</option>
                            {SEDES.map(s=><option key={s}>{s}</option>)}
                          </select>
                        ) : flotaEditCampo==="transportadora" ? (
                          <select value={flotaEditValor} onChange={e=>setFlotaEditValor(e.target.value)} style={inpStyle}>
                            <option value="">— Seleccionar —</option>
                            {transUnicos.map(t=><option key={t}>{t}</option>)}
                          </select>
                        ) : (
                          <input type="text" value={flotaEditValor} onChange={e=>setFlotaEditValor(e.target.value)}
                            placeholder={flotaEditCampo==="placa"?"Ej: ABC123":""}
                            style={{...inpStyle,width:130,textTransform:"uppercase"}}/>
                        )}
                      </div>
                    )}
                    <Btn color={T.navy} disabled={!flotaEditCampo||!flotaEditValor||saving}
                      onClick={()=>modificarCampoFlota(viajesElim, flotaEditCampo, flotaEditCampo==="fecha"?flotaEditValor:flotaEditValor.toUpperCase())}>
                      {saving?"Aplicando...":"Aplicar cambio"}
                    </Btn>
                  </div>
                </div>
              )}

              {!flotaElimConfirm ? (
                <div style={{display:"flex",justifyContent:"flex-end"}}>
                  <Btn color={T.danger} disabled={!hayFiltro||viajesElim.length===0}
                    onClick={()=>setFlotaElimConfirm(true)}>
                    🗑 Eliminar {viajesElim.length} viajes
                  </Btn>
                </div>
              ) : (
                <div style={{background:`${T.danger}18`,border:`1px solid ${T.danger}44`,borderRadius:8,padding:"12px 16px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:12}}>
                  <span style={{fontSize:13,fontWeight:700,color:T.danger}}>
                    ⚠ ¿Confirmas eliminar {viajesElim.length} viajes? Esta acción no se puede deshacer.
                  </span>
                  <div style={{display:"flex",gap:8}}>
                    <Btn outline onClick={()=>setFlotaElimConfirm(false)}>Cancelar</Btn>
                    <Btn color={T.danger} onClick={()=>eliminarViajesFlota(viajesElim)} disabled={saving}>
                      {saving?"Eliminando...":"Sí, eliminar"}
                    </Btn>
                  </div>
                </div>
              )}
            </Section>
            );
          })()}
        </Modal>
        );
      })()}

      {(modal==="viaje" || modal==="viaje_edit") && (
        <Modal title={form.id ? `Editar Viaje ${form.id}` : "Registrar Nuevo Viaje"} onClose={()=>setModal(null)} wide inline>
          <Section title="Identificación del Viaje" color={T.orange}>
            <Grid cols={3}>
              <Sel label="Sede de Destino" value={form.sede||"MALAMBO"} onChange={f("sede")}>
                {SEDES.map(s=><option key={s}>{s}</option>)}
              </Sel>
              <Sel label="Planta de Recibo" value={form.planta||""} onChange={f("planta")}>
                <option value="">Seleccionar...</option>
                {SEDES.map(s=><option key={s}>{s}</option>)}
              </Sel>
              <Inp label="Fecha de Cargue" type="date" value={form.fecha||""} onChange={f("fecha")}/>
              {form.id && (
                <div>
                  <Lbl>Fecha de Registro</Lbl>
                  <div style={{background:"#c8d0d8",border:"1px solid #b0bac4",borderRadius:8,padding:"8px 10px",fontSize:12,fontFamily:"monospace",color:"#555e6a"}}>
                    {form.created_at ? new Date(form.created_at).toLocaleString("es-CO",{day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit"}) : "—"}
                  </div>
                </div>
              )}
            </Grid>
            <Grid cols={2}>
              <Sel label="Producto" value={form.producto||""} onChange={f("producto")}>
                <option value="">Seleccionar...</option>
                {MATERIAS_PRIMAS.map(p=><option key={p}>{p}</option>)}
                <option value="VLSFO">VLSFO</option>
                <option value="MGO">MGO</option>
                <option value="DIESEL NACIONAL">DIESEL NACIONAL</option>
                <option value="DIESEL INTERNACIONAL">DIESEL INTERNACIONAL</option>
              </Sel>
              <Sel label="Transportadora" value={form.transportadora||""} onChange={f("transportadora")}>
                <option value="">Seleccionar...</option>
                {TRANSPORTADORAS.map(t=><option key={t}>{t}</option>)}
              </Sel>
              <Inp label="Placa" type="text" value={form.placa||""} onChange={fPlaca("placa")} maxLength={6} placeholder="ABC123"/>
              <Inp label="Número de Guía" type="text" value={form.guia||""} onChange={f("guia")}/>
              <Inp label="Conductor" type="text" value={form.conductor||""} onChange={f("conductor")}/>
              <Inp label="Cédula Conductor" type="text" value={form.cedula||""} onChange={f("cedula")}/>
              <Inp label="Barriles NSV (campo)" type="number" value={form.barriles_nsv||""} onChange={f("barriles_nsv")}/>
            </Grid>
          </Section>
          <Section title="Volúmenes y Financiero" color={T.orange}>
            <Grid cols={3}>
              <Inp label="Gls Netos Guía" type="number" value={form.gls_netos_guia||""} onChange={f("gls_netos_guia")}/>
              <Inp label="Gls Recibidos" type="number" value={form.gls_recibidos||""} onChange={f("gls_recibidos")}/>
              <div>
                <Lbl>Gls Faltantes</Lbl>
                {(()=>{
                  const faltante = form.gls_recibidos ? Math.max(0, Number(form.gls_netos_guia||0)-Number(form.gls_recibidos||0)) : 0;
                  return <div style={{background:T.bg,border:`1px solid ${T.border}`,borderRadius:8,padding:"8px 10px",fontSize:12,fontFamily:"monospace",color:faltante>0?T.danger:T.success,fontWeight:700}}>{fmt(faltante)} Gls</div>;
                })()}
              </div>
              <Inp label="Flete ($ x Gal)" type="number" value={form.flete||""} onChange={f("flete")}/>
              <Inp label="Bono ($)" type="number" value={form.bono||""} onChange={f("bono")}/>
              <div>
                <Lbl>Total Flete ($)</Lbl>
                <div style={{background:T.bg,border:`1px solid ${T.border}`,borderRadius:8,padding:"8px 10px",fontSize:12,fontFamily:"monospace",color:T.success,fontWeight:700}}>
                  {fmt(Number(form.gls_netos_guia||0)*Number(form.flete||0)+Number(form.bono||0))}
                </div>
              </div>
            </Grid>
          </Section>
          {(()=>{ const u=(form.producto||"").toUpperCase(); return u.includes("MGO")||u.includes("DIESEL")||u.includes("DISEL")||u==="NACIONAL"||u==="INTERNACIONAL"; })() && (
            <Section title="Datos Producto Blanco (MGO / Diesel)" color="#38bdf8">
              <Grid cols={3}>
                <Inp label="OPS (Orden de Cargue)" type="text" value={form.ops||""} onChange={f("ops")}/>
                <Inp label="Planta Origen" type="text" value={form.planta_origen||""} onChange={f("planta_origen")}/>
                <Inp label="Bodega / Tanque Descargue" type="text" value={form.bodega_tanque||""} onChange={f("bodega_tanque")}/>
              </Grid>
            </Section>
          )}
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
            <Btn color={T.orange} onClick={guardarViaje} disabled={saving}>{saving?"Guardando...":form.id?"Actualizar Viaje":"Registrar Viaje"}</Btn>
          </div>
        </Modal>
      )}

      {modal==="tiquete" && (()=>{
        const esLab = perfil.rol === "laboratorio" || perfil.rol === "administrador";
        const soloVista = !!form.id && !esLab;
        const tieneViaje = !!form.viaje_id;
        const soloLab = !esLab && tieneViaje;
        const tipoA = form.tipo_analisis||"Tiquetes MP";
        const esMP = tipoA === "Tiquetes MP";
        const otVinculada = form.id ? (ordenesTrabaio||[]).find(o=>o.id===form.ot_id||o.tiquete_id===form.id) : null;
        const otsSinTiquete = (ordenesTrabaio||[]).filter(o=>!o.tiquete_id&&!o.ot_id);
        const tituloModal = form.id
          ? `${soloVista?"Ver":"Editar"} ${esMP?"Tiquete":("Análisis "+tipoA.replace("Tiquetes MP",""))} ${form.id}`
          : esMP ? "Tiquete de Ingreso de Materia Prima"
          : `Análisis ${tipoA}`;
        return (
        <Modal title={tituloModal} onClose={()=>setModal(null)} wide inline>
          <Section title="Identificación" color={T.orange}>
            <Grid cols={esMP?2:3}>
              <Inp label="Proveedor / Campo Origen" type="text" value={form.proveedor||""} onChange={f("proveedor")} readOnly={soloVista}/>
              <Inp label="Producto" type="text" value={form.producto||""} onChange={f("producto")} readOnly={soloVista||soloLab}/>
              {!esMP && (()=>{
                const tanquesOpts = tipoA==="Planta 1"
                  ? ["QBS002-1B","QBS002-1E","QBS002-2B","QBS002-2E","QBS002-3B","QBS002-3E","QBS002-4B","QBS002-4E","QBS002-5B","QBS002-5E"]
                  : tipoA==="Planta 2"
                  ? ["TK-111","TK-112","TK-113","TK-114","TK-115","TK-116","TK-117"]
                  : ["QBS002-1B","QBS002-1E","QBS002-2B","QBS002-2E","QBS002-3B","QBS002-3E","QBS002-4B","QBS002-4E","QBS002-5B","QBS002-5E","TKT-1","TKT-2","TK-111","TK-112","TK-113","TK-114","TK-115","TK-116","TK-117"];
                return (
                  <div style={{display:"flex",flexDirection:"column",gap:4}}>
                    <label style={{fontSize:12,fontWeight:600,color:T.muted}}>Tanque</label>
                    <select value={form.tanque||""} disabled={soloVista} onChange={e=>setForm(p=>({...p,tanque:e.target.value||null}))}
                      style={{padding:"6px 10px",borderRadius:6,border:`1px solid ${T.border}`,fontSize:14,background:T.card,color:T.text}}>
                      <option value="">— Seleccionar tanque —</option>
                      {tanquesOpts.map(t=><option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                );
              })()}
              {esMP && <Inp label="Placa" type="text" value={form.placa||""} onChange={fPlaca("placa")} maxLength={6} placeholder="ABC123" readOnly={soloVista||soloLab}/>}
              {esMP && <Inp label="Cédula Conductor" type="text" value={form.cedula||""} onChange={f("cedula")} readOnly={soloVista}/>}
              {esMP && <Inp label="Nombre Conductor" type="text" value={form.nombre_conductor||""} onChange={f("nombre_conductor")} readOnly={soloVista}/>}
              {esMP && <Inp label="Fecha Cargue" type="date" value={form.fecha_cargue||""} onChange={f("fecha_cargue")} readOnly={soloVista||soloLab}/>}
              <Inp label="Fecha de Análisis" type="date" value={form.fecha_llegada||today()} onChange={f("fecha_llegada")} readOnly={soloVista||(esMP&&soloLab)}/>
            </Grid>
          </Section>
          <Section title="Análisis API" color={T.orange}>
            <Grid cols={7}>
              <Inp label="API Reportado" type="number" step="0.1" value={form.api_reportado||""} onChange={e=>{const v=e.target.value;const d=v.split(".");if(d[1]&&d[1].length>1)return;setForm(p=>({...p,api_reportado:v}));}} readOnly={soloVista}/>
              <Inp label="API Observado" type="number" step="0.1" value={form.api_observado||""} onChange={e=>{const v=e.target.value;const d=v.split(".");if(d[1]&&d[1].length>1)return;setForm(p=>({...p,api_observado:v}));}} readOnly={soloVista}/>
              <Inp label="API Corregido 60°F" type="number" step="0.1" value={form.api_corregido||""} readOnly={soloVista} onChange={e=>{
                if(soloVista) return;
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
              <Inp label="Temperatura Obs. (°C)" type="number" step="0.1" value={form.temp_observada||""} readOnly={soloVista} onChange={e=>{
                if(soloVista) return;
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
          <Section title="Calidad" color={T.orange}>
            <Grid cols={5}>
              <Inp label="Agua Destilación (%)" type="number" step="0.01" value={form.agua_destilacion||""} onChange={f("agua_destilacion")} readOnly={soloVista}/>
              <Inp label="Flash Point (°C)" type="number" value={form.flash_point||""} onChange={f("flash_point")} readOnly={soloVista}/>
              <Inp label="Viscosidad 50°C (cSt)" type="number" step="0.1" value={form.viscosidad||""} onChange={f("viscosidad")} readOnly={soloVista}/>
              <Inp label="Azufre (%)" type="number" step="0.001" value={form.azufre||""} onChange={f("azufre")} readOnly={soloVista}/>
              <Inp label="TSA" type="number" step="0.01" value={form.tsa||""} onChange={f("tsa")} readOnly={soloVista}/>
            </Grid>
          </Section>
          <Section title="Observaciones">
            <Inp label="Observaciones" type="text" value={form.observaciones||""} onChange={f("observaciones")} readOnly={soloVista}/>
          </Section>
          {!esMP && form.id && esLab && (
            <Section title="Orden de Trabajo vinculada" color={T.navy}>
              {otVinculada ? (
                <div style={{display:"flex",alignItems:"center",gap:12,padding:"10px 14px",background:`${T.success}12`,border:`1px solid ${T.success}44`,borderRadius:8}}>
                  <span style={{fontSize:18}}>🏗️</span>
                  <div>
                    <div style={{fontWeight:700,color:T.navy,fontSize:14}}>{otVinculada.numero_ot}</div>
                    <div style={{fontSize:11,color:T.muted}}>Vinculada · Estado: {otVinculada.estado}</div>
                  </div>
                  <span style={{marginLeft:"auto",cursor:"pointer",color:T.orange,fontWeight:700,fontSize:12,textDecoration:"underline"}} onClick={()=>{const id=`ot-${otVinculada.id}`;const ex=tabs.find(tb=>tb.id===id);if(ex){setActiveTabId(id);setModal(null);return;}setTabs(p=>[...p,{id,type:"orden_trabajo",title:otVinculada.numero_ot,icon:"🏗️",closeable:true,otId:otVinculada.id}]);setActiveTabId(id);setModal(null);}}>Ver OT →</span>
                </div>
              ) : (
                <div>
                  <div style={{fontSize:12,color:T.muted,marginBottom:8}}>Este análisis no está vinculado a ninguna OT. Selecciona la OT correspondiente:</div>
                  <div style={{display:"flex",gap:8,alignItems:"center"}}>
                    <select value={form._vincularOT||""} onChange={e=>setForm(p=>({...p,_vincularOT:e.target.value}))}
                      style={{flex:1,background:T.card,border:`1.5px solid ${T.border}`,borderRadius:6,padding:"8px 10px",color:T.text,fontSize:13}}>
                      <option value="">— Seleccionar OT —</option>
                      {(ordenesTrabaio||[]).filter(o=>!o.tiquete_id).map(o=><option key={o.id} value={o.id}>{o.numero_ot} · {o.estado}</option>)}
                    </select>
                    <Btn color={T.navy} disabled={!form._vincularOT||saving} onClick={async()=>{
                      setSaving(true);
                      await dbCall({ table:"tiquetes", op:"update", data:{ot_id:form._vincularOT}, filters:[{col:"id",val:form.id}] });
                      await dbCall({ table:"ordenes_trabajo", op:"update", data:{tiquete_id:form.id}, filters:[{col:"id",val:form._vincularOT}] });
                      await loadData();
                      setSaving(false);
                      setForm(p=>({...p,ot_id:form._vincularOT,_vincularOT:""}));
                      showToast("Análisis vinculado a la OT");
                    }}>Vincular</Btn>
                  </div>
                </div>
              )}
            </Section>
          )}
          <div style={{ display:"flex", justifyContent:"flex-end", gap:10 }}>
            <Btn outline onClick={()=>setModal(null)}>{soloVista?"Cerrar":"Cancelar"}</Btn>
            {!soloVista && <Btn color={T.orange} onClick={guardarTiquete} disabled={saving}>{saving?"Guardando...":form.id?"Actualizar Tiquete":"Emitir Tiquete"}</Btn>}
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
                      <div style={{background:T.card,borderRadius:6,padding:"6px 14px",fontSize:13,fontWeight:700,color:T.orange,border:`1px solid ${T.border}`,whiteSpace:"nowrap"}}>
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

      {modalLiqDetalle && (()=>{
        const {liq,despacho:d} = modalLiqDetalle;
        const fmtN=(v,dec=0)=>v!=null&&!isNaN(v)?Number(v).toLocaleString("es-CO",{minimumFractionDigits:dec,maximumFractionDigits:dec}):"—";
        const filas=JSON.parse(liq.filas_barcaza||"[]").filter(f=>f.activo);
        const isAdmin = perfil?.rol==="administrador";
        const ef = liqEditForm;
        const setEf = (k,v) => setLiqEditForm(p=>({...p,[k]:v}));

        const inpStyle = {padding:"5px 8px",border:`1px solid ${T.border}`,borderRadius:5,fontSize:12,
          color:T.text,background:"#fff",width:"100%",fontFamily:"monospace",fontWeight:700};

        const saveLiq = async () => {
          setLiqSaving(true);
          const n = (v) => v !== "" ? Number(v) : null;
          const patch = {
            motonave:      ef.motonave,
            imo_numero:    ef.imo_numero,
            producto:      ef.producto,
            fecha:         ef.fecha,
            puerto:        ef.puerto,
            bdn_numero:    ef.bdn_numero,
            contrato:      ef.contrato,
            mt_firmadas:   n(ef.mt_firmadas),
            mt_entregadas: n(ef.mt_entregadas),
            gls_brutos_entregados: n(ef.gls_brutos_entregados),
            gls_entregados: n(ef.gls_entregados),
            gls_flowmeter: n(ef.gls_flowmeter),
            factor:        n(ef.factor),
          };
          patch.coordinador = ef.coordinador;
          patch.operador    = ef.operador;
          const { error } = await dbCall({ table:"liquidaciones_qbs002", op:"update", data:patch, filters:[{col:"id",val:liq.id}] });
          if(error){ setLiqSaving(false); showToast("Error al guardar: "+error,"error"); return; }
          // Sincronizar fecha en despacho y CMT
          console.log("DEBUG despacho:", d?.id, d?.buque, d?.fecha_entrega, "nueva fecha:", ef.fecha);
          if(ef.fecha && d?.id){
            const { error: errD } = await supabase.from("despachos").update({ fecha_entrega: ef.fecha }).eq("id", d.id);
            if(errD) showToast("Error actualizando fecha del despacho: "+errD.message, "error");
            else setDespachos(prev=>prev.map(x=>x.id===d.id?{...x,fecha_entrega:ef.fecha}:x));
          }
          if(ef.fecha){
            const cmtAsoc = cmts.find(c=>c.nombre_motonave===(ef.motonave||liq.motonave||d?.buque) && c.tipo_operacion==="ENTREGA A MOTONAVE");
            if(cmtAsoc){
              await dbCall({ table:"cmts", op:"update", data:{fecha:ef.fecha}, filters:[{col:"id",val:cmtAsoc.id}] });
              setCmts(prev=>prev.map(c=>c.id===cmtAsoc.id?{...c,fecha:ef.fecha}:c));
            }
          }
          setLiqSaving(false);
          showToast("Liquidación actualizada","success");
          setModalLiqDetalle(prev=>({...prev, liq:{...prev.liq,...patch}, despacho:{...prev.despacho, fecha_entrega:ef.fecha||prev.despacho.fecha_entrega}}));
          setLiqEditMode(false);
        };

        // Campos editables
        const EDIT_FIELDS = [
          {k:"motonave",         l:"Buque",                 type:"text"},
          {k:"imo_numero",       l:"IMO",                   type:"text"},
          {k:"producto",         l:"Producto",              type:"text"},
          {k:"fecha",            l:"Fecha",                 type:"date"},
          {k:"puerto",           l:"Puerto",                type:"text"},
          {k:"bdn_numero",       l:"BDN N°",               type:"text"},
          {k:"contrato",         l:"Contrato",              type:"text"},
          {k:"mt_firmadas",      l:"MT Firmadas",           type:"number"},
          {k:"mt_entregadas",    l:"MT Entregadas",         type:"number"},
          {k:"gls_brutos_entregados", l:"Gls Brutos",      type:"number"},
          {k:"gls_entregados",   l:"Gls Netos Entregados",  type:"number"},
          {k:"gls_flowmeter",    l:"Gls Flowmeter",         type:"number"},
          {k:"factor",           l:"Factor",                type:"number"},
          {k:"coordinador",      l:"Coordinador",           type:"text"},
          {k:"operador",         l:"Operador",              type:"text"},
        ];

        return (
          <Modal title={`Liquidación — ${liq.motonave||d.buque}`} onClose={()=>{ setModalLiqDetalle(null); setLiqEditMode(false); }} wide>

            {/* ── Campos de cabecera ── */}
            {!liqEditMode ? (
              <div style={{display:"flex",gap:32,flexWrap:"wrap",marginBottom:20,padding:"12px 16px",background:T.bg,borderRadius:8,border:`1px solid ${T.border}`}}>
                {[["Buque",liq.motonave||d.buque],["IMO",liq.imo_numero||d.imo||"—"],["Producto",liq.producto||d.producto||"—"],["Fecha",liq.fecha||"—"],["Puerto",liq.puerto||d.destino||"—"],["Contrato",liq.contrato||d.contrato||"—"],["MT Firmadas",fmtN(liq.mt_firmadas,3)],["MT Entregadas",fmtN(liq.mt_entregadas,3)],["Gls Brutos Entregados",fmtN(liq.gls_brutos_entregados,0)],["Gls Netos Entregados",fmtN(liq.gls_entregados,0)],["Gls Flowmeter",fmtN(liq.gls_flowmeter,0)],["Factor",fmtN(liq.factor,2)],["BDN N°",liq.bdn_numero||"—"],["Coordinador",liq.coordinador||"—"],["Operador",liq.operador||"—"]].map(([l,v])=>(
                  <div key={l}><div style={{fontSize:9,color:T.muted,textTransform:"uppercase",letterSpacing:1,marginBottom:2}}>{l}</div><div style={{fontSize:13,fontWeight:700,color:T.navy}}>{v}</div></div>
                ))}
              </div>
            ) : (
              <div style={{marginBottom:20,padding:"16px",background:"#fffbeb",borderRadius:8,border:`2px solid ${T.warn||"#f59e0b"}`}}>
                <div style={{fontSize:11,fontWeight:800,color:T.warn||"#f59e0b",marginBottom:12,textTransform:"uppercase",letterSpacing:1}}>
                  ✏ Modo edición — Administrador
                </div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(180px,1fr))",gap:10}}>
                  {EDIT_FIELDS.map(({k,l,type})=>(
                    <div key={k}>
                      <div style={{fontSize:9,color:T.navy,fontWeight:700,textTransform:"uppercase",letterSpacing:1,marginBottom:4}}>{l}</div>
                      <input type={type} value={ef[k]??""} onChange={e=>setEf(k,e.target.value)} style={inpStyle}/>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Tabla de tanques ── */}
            {filas.length>0 && (
              <div data-scroll-key="tanques-tabla" style={{overflowX:"auto"}}>
                <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
                  <thead><tr style={{background:T.navy}}>
                    {["Tanque","Sonda Ini","Temp Ini","API Ini","Sonda Fin","Temp Fin","API Fin","Gls.N Ini","Gls.N Fin","Gls Entregados"].map(h=>(
                      <th key={h} style={{padding:"8px 10px",color:"#fff",fontWeight:700,textAlign:"center",whiteSpace:"nowrap"}}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>{(()=>{
                    const cmt = cmts.find(c=>c.nombre_motonave===liq.motonave&&c.tipo_operacion==="ENTREGA A MOTONAVE");
                    return filas.map((f,i)=>{
                      const tanqueId=`QBS002-${f.tanque}`;
                      const tr=(cmt?.tanques_recepcion||[]).find(r=>r.tanque===tanqueId);
                      return(
                        <tr key={i} style={{background:i%2===0?T.card:T.bg}}>
                          <td style={{padding:"7px 10px",fontWeight:700,color:T.navy,textAlign:"center"}}>{tanqueId}</td>
                          <td style={{padding:"7px 10px",textAlign:"center"}}>{f.sIni||"—"}</td>
                          <td style={{padding:"7px 10px",textAlign:"center"}}>{f.tIni||"—"}</td>
                          <td style={{padding:"7px 10px",textAlign:"center"}}>{f.aIni||"—"}</td>
                          <td style={{padding:"7px 10px",textAlign:"center"}}>{f.sFin||"—"}</td>
                          <td style={{padding:"7px 10px",textAlign:"center"}}>{f.tFin||"—"}</td>
                          <td style={{padding:"7px 10px",textAlign:"center"}}>{f.aFin||"—"}</td>
                          <td style={{padding:"7px 10px",textAlign:"center",color:T.orange,fontWeight:700}}>{tr?fmtN(tr.galonesInicial,0):"—"}</td>
                          <td style={{padding:"7px 10px",textAlign:"center",color:T.success,fontWeight:700}}>{tr?fmtN(tr.galonesFinal,0):"—"}</td>
                          <td style={{padding:"7px 10px",textAlign:"center",fontWeight:900,color:T.navy}}>{tr?fmtN((tr.galonesInicial||0)-(tr.galonesFinal||0),0):"—"}</td>
                        </tr>
                      );
                    });
                  })()}</tbody>
                </table>
              </div>
            )}

            {/* ── Botones ── */}
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:16}}>
              <div>
                {isAdmin && !liqEditMode && (
                  <button onClick={()=>{ setLiqEditForm({
                    motonave: liq.motonave||d.buque||"",
                    imo_numero: liq.imo_numero||d.imo||"",
                    producto: liq.producto||d.producto||"",
                    fecha: liq.fecha||"",
                    puerto: liq.puerto||d.destino||"",
                    bdn_numero: liq.bdn_numero||"",
                    contrato: liq.contrato||"",
                    mt_firmadas: liq.mt_firmadas??"",
                    mt_entregadas: liq.mt_entregadas??"",
                    gls_brutos_entregados: liq.gls_brutos_entregados??"",
                    gls_entregados: liq.gls_entregados??"",
                    gls_flowmeter: liq.gls_flowmeter??"",
                    factor: liq.factor??"",
                    coordinador: liq.coordinador||"",
                    operador: liq.operador||"",
                  }); setLiqEditMode(true); }}
                    style={{background:"#f59e0b",color:"#fff",border:"none",borderRadius:8,
                      padding:"9px 22px",fontWeight:700,fontSize:13,cursor:"pointer"}}>
                    ✏ Editar
                  </button>
                )}
                {liqEditMode && (
                  <button onClick={()=>setLiqEditMode(false)}
                    style={{background:T.bg,color:T.muted,border:`1px solid ${T.border}`,borderRadius:8,
                      padding:"9px 22px",fontWeight:700,fontSize:13,cursor:"pointer"}}>
                    Cancelar
                  </button>
                )}
              </div>
              <div style={{display:"flex",gap:10}}>
                {liqEditMode && (
                  <button onClick={saveLiq} disabled={liqSaving}
                    style={{background:T.success,color:"#fff",border:"none",borderRadius:8,
                      padding:"9px 28px",fontWeight:700,fontSize:13,cursor:liqSaving?"not-allowed":"pointer",opacity:liqSaving?0.6:1}}>
                    {liqSaving?"Guardando...":"Guardar cambios"}
                  </button>
                )}
                <button onClick={()=>{ setModalLiqDetalle(null); setLiqEditMode(false); }}
                  style={{background:T.navy,color:"#fff",border:"none",borderRadius:8,padding:"9px 28px",fontWeight:700,fontSize:13,cursor:"pointer"}}>
                  Cerrar
                </button>
              </div>
            </div>
          </Modal>
        );
      })()}

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
                <div style={{fontSize:10,color:T.muted,textTransform:"uppercase",letterSpacing:1,marginBottom:2}}>{(form.tipo_operacion||"")==="ENTREGA A MOTONAVE"?"Barcaza":"Planta"}</div>
                <div style={{fontSize:12,fontWeight:700,color:T.navy}}>{form.planta||<span style={{color:T.muted,fontWeight:400}}>Por seleccionar</span>}</div>
              </div>
            )}
            <div style={{marginLeft:"auto",fontSize:11,color:T.muted}}>Generado automáticamente</div>
          </div>
          {form.ot_numero && (
            <div style={{gridColumn:"1/-1",background:`${T.success}18`,border:`1px solid ${T.success}33`,borderRadius:8,padding:"10px 14px",marginBottom:12}}>
              <div style={{fontSize:10,color:T.muted,fontWeight:600,marginBottom:2}}>VINCULADO A ORDEN DE TRABAJO</div>
              <div style={{fontSize:13,fontWeight:700,color:T.success,fontFamily:"monospace"}}>{form.ot_numero} <span style={{fontSize:10,color:T.muted,fontWeight:400}}>(no editable)</span></div>
            </div>
          )}
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
                const prodEnPlanta = [...new Set(
                  viajes
                    .filter(v => v.estado === "En Planta" || v.estado === "Rechazado")
                    .map(v => normalizarProducto(v.producto||""))
                    .filter(Boolean)
                )];
                const prodTanques = [...new Set(tanques.map(t => t.producto||"").filter(Boolean))];
                const opciones = [...new Set([...prodEnPlanta, ...prodTanques, "VLSFO", "HSFO", "MGO"])].sort();
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
            {(form.sede||perfil.sede||"MALAMBO")==="MALAMBO" && (form.tipo_operacion||"")!=="TRASIEGO DE PRODUCTO" && (form.tipo_operacion||"")!=="PORTEO" && (
              <div style={{width:160,flexShrink:0}}>
                {(form.tipo_operacion||"")==="ENTREGA A MOTONAVE" ? (
                  <Sel label="Barcaza" value={form.planta||""} onChange={e=>{setForm(prev=>({...prev,planta:e.target.value}));}}>
                    <option value="">Seleccionar...</option>
                    <option value="QBS002">QBS002</option>
                    <option value="TANQUES TIERRA">TANQUES TIERRA</option>
                  </Sel>
                ) : (
                  <Sel label="Planta" value={form.planta||""} onChange={e=>{setForm(prev=>({...prev,planta:e.target.value}));}}>
                    <option value="">Seleccionar...</option>
                    <option value="PLANTA 1">PLANTA 1</option>
                    <option value="PLANTA 2">PLANTA 2</option>
                  </Sel>
                )}
              </div>
            )}
            {(form.tipo_operacion||"")==="ENTREGA A MOTONAVE" && (
              <div style={{minWidth:220,flexShrink:0}}>
                <Sel label="Buque / Motonave" value={form.nombre_motonave||""} onChange={e=>{
                  const val=e.target.value;
                  const d=despachos.find(d=>d.buque===val&&d.estado!=="ENTREGADO");
                  setForm(prev=>({...prev,nombre_motonave:val,imo_motonave:d?.imo||prev.imo_motonave||""}));
                }}>
                  <option value="">Seleccionar buque...</option>
                  {[...new Set(despachos.filter(d=>d.estado!=="ENTREGADO"&&d.buque).map(d=>d.buque))].map(b=><option key={b} value={b}>{b}</option>)}
                </Sel>
              </div>
            )}
          </div>
          {(form.tipo_operacion||"")!=="PORTEO" && (<div style={{marginBottom:18}}>
            <div style={{display:"flex",alignItems:"center",marginBottom:10,paddingBottom:6,borderBottom:`1px solid ${T.orange}33`}}>
              <span style={{fontSize:11,fontWeight:700,color:T.orange,letterSpacing:1,textTransform:"uppercase"}}>{(form.tipo_operacion||"")==="TRASIEGO DE PRODUCTO"?"Tanque de Despacho":"Medida Inicial"}</span>
            </div>
            {(()=>{
              const cmtSede = form.sede || (sedeFiltro!=="TODAS"?sedeFiltro:"MALAMBO");
              const cmtPlantaRaw = form.planta || "";
              const esTrasiegoInterplanta = (form.tipo_operacion||"")==="TRASIEGO DE PRODUCTO";
              const esEntregaMot = (form.tipo_operacion||"")==="ENTREGA A MOTONAVE";
              const tankEnPlanta = (t, p) => {
                if (!p || esTrasiegoInterplanta) return true;
                if (esEntregaMot) {
                  if (p==="QBS002") return t.id.startsWith("QBS002-");
                  if (p==="TANQUES TIERRA") return t.id.startsWith("TKT-");
                  return t.id.startsWith("QBS002-")||t.id.startsWith("TKT-");
                }
                if (p==="PLANTA 1") return t.id.startsWith("QBS002-") || t.id.startsWith("TKT-");
                if (p==="PLANTA 2") return t.id.startsWith("TK-");
                return true;
              };
              const tanquesBase = cmtSede==="MALAMBO" ? tanques.filter(t=>tankEnPlanta(t,cmtPlantaRaw)) : [];
              const tanquesDisponibles = form.tanques_ot?.length ? tanquesBase.filter(t=>form.tanques_ot.includes(t.id)) : tanquesBase;
              const esTrasiego = (form.tipo_operacion||"")==="TRASIEGO DE PRODUCTO";
              const inputStyle = { width:"100%", background:T.card, border:`1px solid ${T.border}`, borderRadius:6, padding:"8px 10px", color:T.text, fontSize:13, fontFamily:"system-ui,sans-serif", outline:"none", boxSizing:"border-box" };
              return cmtAntes.map((row,i)=>{
                const rowD = cmtDespues[i]||{};
                const tqDispRow = (p) => {
                  if (!p) return tanques.filter(t=>t.id.startsWith("TK-")||t.id.startsWith("QBS002-")||t.id.startsWith("TKT-"));
                  if (esEntregaMot) {
                    if (p==="QBS002") return tanques.filter(t=>t.id.startsWith("QBS002-"));
                    if (p==="TANQUES TIERRA") return tanques.filter(t=>t.id.startsWith("TKT-"));
                    return tanques.filter(t=>t.id.startsWith("QBS002-")||t.id.startsWith("TKT-"));
                  }
                  if (p==="PLANTA 1") return tanques.filter(t=>t.id.startsWith("QBS002-")||t.id.startsWith("TKT-"));
                  if (p==="PLANTA 2") return tanques.filter(t=>t.id.startsWith("TK-"));
                  return tanques;
                };
                return esTrasiego ? (
                <div key={i} style={{background:T.bg,borderRadius:8,padding:"12px 14px",marginBottom:10,border:`1px solid ${T.border}`}}>
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                      <select value={row.plantaFiltro||""} onChange={e=>{const na=[...cmtAntes];na[i]={...na[i],plantaFiltro:e.target.value,tanque:""};setCmtAntes(na);setCmtDespues(prev=>{const nd=[...prev];if(nd[i])nd[i]={...nd[i],tanque:""};return nd;});}}
                        style={{background:T.navy,color:"#fff",border:"none",borderRadius:6,padding:"5px 10px",fontSize:11,fontWeight:700,cursor:"pointer",outline:"none"}}>
                        <option value="">Planta...</option>
                        <option value="PLANTA 1">PLANTA 1</option>
                        <option value="PLANTA 2">PLANTA 2</option>
                      </select>
                      <span style={{fontSize:10,color:T.muted,textTransform:"uppercase",letterSpacing:1}}>Tanque:</span>
                      <select value={row.tanque} onChange={e=>{
                        const val=e.target.value;
                        const na=[...cmtAntes]; na[i].tanque=val; setCmtAntes(na);
                        setCmtDespues(prev=>{const nd=[...prev]; if(nd[i]){const tq=tanques.find(t=>t.id===val); nd[i]={...nd[i],tanque:val,producto:normalizarProducto(tq?.producto||"")};} return nd;});
                        calcularGalones(val,na[i].sonda,na[i].temp,na[i].api,false,i);
                      }} style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:6,padding:"6px 10px",color:T.text,fontSize:13,fontFamily:"system-ui,sans-serif",outline:"none"}}>
                        <option value="">—</option>{tqDispRow(row.plantaFiltro).map(t=><option key={t.id}>{t.id}</option>)}
                      </select>
                    </div>
                    <button onClick={()=>{setCmtAntes(cmtAntes.filter((_,j)=>j!==i));setCmtDespues(cmtDespues.filter((_,j)=>j!==i));}} style={{background:`${T.danger}22`,border:`1px solid ${T.danger}44`,borderRadius:8,color:T.danger,padding:"4px 10px",cursor:"pointer",fontSize:11}}>✕</button>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"80px 1fr 1fr 1fr 1fr",gap:8,alignItems:"end",marginBottom:6}}>
                    <div style={{fontSize:10,color:T.orange,fontWeight:700,textTransform:"uppercase",paddingBottom:4}}>Medida Inicial</div>
                    <div><Lbl>Sonda</Lbl><input type="number" value={row.sonda||""} onChange={e=>{const n=[...cmtAntes];n[i].sonda=e.target.value;setCmtAntes(n);}} onBlur={e=>calcularGalones(row.tanque,e.target.value,row.temp,row.api,false,i)} style={inputStyle}/></div>
                    <div><Lbl>Temp °C</Lbl><input type="number" step="0.1" placeholder="" value={row.temp||""} onChange={e=>{const n=[...cmtAntes];n[i].temp=e.target.value;setCmtAntes(n);calcularGalones(n[i].tanque,n[i].sonda,e.target.value,n[i].api,false,i);}} style={inputStyle}/></div>
                    <div><Lbl>API</Lbl><input type="number" step="0.1" placeholder="" value={row.api||""} onChange={e=>{const n=[...cmtAntes];n[i].api=e.target.value;setCmtAntes(n);calcularGalones(n[i].tanque,n[i].sonda,n[i].temp,e.target.value,false,i);}} style={inputStyle}/></div>
                    <div><Lbl>{row.temp&&row.api?"Galones Netos":"Galones Brutos"}</Lbl><input type="number" readOnly value={row.galones||""} style={{...inputStyle,background:"#e8edf2",color:"#4a5568",cursor:"default"}}/></div>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"80px 1fr 1fr 1fr 1fr",gap:8,alignItems:"end"}}>
                    <div style={{fontSize:10,color:T.muted,fontWeight:700,textTransform:"uppercase",paddingBottom:4}}>Medida Final</div>
                    <div><Lbl>Sonda</Lbl><input type="number" value={rowD.sonda||""} onChange={e=>{const n=[...cmtDespues];n[i]={...n[i],sonda:e.target.value};setCmtDespues(n);}} onBlur={e=>calcularGalones(row.tanque,e.target.value,rowD.temp,rowD.api,true,i)} style={inputStyle}/></div>
                    <div><Lbl>Temp °C</Lbl><input type="number" step="0.1" placeholder="" value={rowD.temp||""} onChange={e=>{const n=[...cmtDespues];n[i]={...n[i],temp:e.target.value};setCmtDespues(n);calcularGalones(row.tanque,rowD.sonda,e.target.value,rowD.api,true,i);}} style={inputStyle}/></div>
                    <div><Lbl>API</Lbl><input type="number" step="0.1" placeholder="" value={rowD.api||""} onChange={e=>{const n=[...cmtDespues];n[i]={...n[i],api:e.target.value};setCmtDespues(n);calcularGalones(row.tanque,rowD.sonda,rowD.temp,e.target.value,true,i);}} style={inputStyle}/></div>
                    <div><Lbl>{rowD.temp&&rowD.api?"Galones Netos":"Galones Brutos"}</Lbl><input type="number" readOnly value={rowD.galones||""} style={{...inputStyle,background:"#e8edf2",color:"#4a5568",cursor:"default"}}/></div>
                  </div>
                  {(()=>{const diff=Number(row.galones||0)-Number(rowD.galones||0);return diff>0&&<div style={{marginTop:8,textAlign:"right",fontSize:12,color:T.orange,fontWeight:700}}>Despachado: {fmt(diff)} Gls</div>})()}
                </div>
                ) : (
                <div key={i} style={{background:"#f1f5f9",borderRadius:8,padding:"12px 14px",marginBottom:10,border:`1px solid ${T.border}`}}>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr 1fr auto",gap:8,alignItems:"end"}}>
                    <div><Lbl>Tanque</Lbl>
                    <select value={row.tanque} onChange={e=>{
                      const val=e.target.value;
                      const na=[...cmtAntes]; na[i].tanque=val; setCmtAntes(na);
                      setCmtDespues(prev=>{const nd=[...prev]; if(nd[i]){const tq=tanques.find(t=>t.id===val); nd[i]={...nd[i],tanque:val,producto:normalizarProducto(tq?.producto||"")};} return nd;});
                      calcularGalones(val,na[i].sonda,na[i].temp,na[i].api,false,i);
                    }} style={{width:"100%",background:"#ffffff",border:`1px solid ${T.border}`,borderRadius:6,padding:"8px 10px",color:T.text,fontSize:13,fontFamily:"system-ui,sans-serif",outline:"none"}}><option value="">—</option>{tanquesDisponibles.map(t=><option key={t.id}>{t.id}</option>)}</select>
                    </div>
                    <div><Lbl>Sonda</Lbl><input type="number" value={row.sonda} onChange={e=>{const n=[...cmtAntes];n[i].sonda=e.target.value;setCmtAntes(n);}} onBlur={e=>calcularGalones(row.tanque,e.target.value,row.temp,row.api,false,i)} style={{...inputStyle,background:"#ffffff"}}/></div>
                    <div><Lbl>Temp °C</Lbl><input type="number" step="0.1" placeholder="" value={row.temp||""} onChange={e=>{const n=[...cmtAntes];n[i].temp=e.target.value;setCmtAntes(n);calcularGalones(n[i].tanque,n[i].sonda,e.target.value,n[i].api,false,i);}} style={{...inputStyle,background:"#ffffff"}}/></div>
                    <div><Lbl>API</Lbl><input type="number" step="0.1" placeholder="" value={row.api||""} onChange={e=>{const n=[...cmtAntes];n[i].api=e.target.value;setCmtAntes(n);calcularGalones(n[i].tanque,n[i].sonda,n[i].temp,e.target.value,false,i);}} style={{...inputStyle,background:"#ffffff"}}/></div>
                    <div><Lbl>{row.temp&&row.api?"Galones Netos":"Galones Brutos"}</Lbl><input type="number" readOnly value={row.galones||""} style={{...inputStyle,background:"#e8edf2",color:"#4a5568",cursor:"default"}}/></div>
                    <button onClick={()=>{setCmtAntes(cmtAntes.filter((_,j)=>j!==i));setCmtDespues(cmtDespues.filter((_,j)=>j!==i));}} style={{background:`${T.danger}22`,border:`1px solid ${T.danger}44`,borderRadius:8,color:T.danger,padding:"8px 10px",cursor:"pointer",fontSize:12}}>✕</button>
                  </div>
                </div>
                );
              });
            })()}
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <Btn sm outline color={T.orange} onClick={()=>{
                setCmtAntes([...cmtAntes,{tanque:"",sonda:"",galones:""}]);
                setCmtDespues([...cmtDespues,{tanque:"",producto:cmtProducto,sonda:"",galones:""}]);
              }}>+ TK</Btn>
              {(form.tipo_operacion||"")!=="TRASIEGO DE PRODUCTO" &&
                <span style={{ fontSize:12, color:T.orange }}>Total: {fmt(cmtAntes.reduce((a,t)=>a+Number(t.galones||0),0))} Gls</span>
              }
            </div>
          </div>)}
          {(form.tipo_operacion||"")==="TRASIEGO DE PRODUCTO" && <div style={{marginBottom:18}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10,paddingBottom:6,borderBottom:`1px solid ${T.success}33`}}>
              <span style={{fontSize:11,fontWeight:700,color:T.success,letterSpacing:1,textTransform:"uppercase"}}>
                {(form.tipo_operacion||"")==="ENTREGA A MOTONAVE" ? "Medidas de Tanques Barcaza" : "Tanque de Recepción"}
              </span>
            </div>
            {(()=>{
              const cmtSede = form.sede || (sedeFiltro!=="TODAS"?sedeFiltro:"MALAMBO");
              const cmtPlantaRaw = form.planta || "";
              const esTrasiegoInterplanta = (form.tipo_operacion||"")==="TRASIEGO DE PRODUCTO";
              const tankEnPlanta = (t, p) => {
                if (!p || esTrasiegoInterplanta) return true;
                if (p==="PLANTA 1") return t.id.startsWith("QBS002-") || t.id.startsWith("TKT-");
                if (p==="PLANTA 2") return t.id.startsWith("TK-");
                return true;
              };
              const tanquesBase = cmtSede==="MALAMBO" ? tanques.filter(t=>tankEnPlanta(t,cmtPlantaRaw)) : [];
              const tanquesDisponibles = form.tanques_ot?.length ? tanquesBase.filter(t=>form.tanques_ot.includes(t.id)) : tanquesBase;
              const inputStyle = { width:"100%", background:T.card, border:`1px solid ${T.border}`, borderRadius:6, padding:"8px 10px", color:T.text, fontSize:13, fontFamily:"system-ui,sans-serif", outline:"none", boxSizing:"border-box" };
              return cmtRecepcion.map((rec,i)=>(
                <div key={i} style={{background:T.bg,borderRadius:8,padding:"12px 14px",marginBottom:10,border:`1px solid ${T.border}`}}>
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                      {(form.tipo_operacion||"")==="ENTREGA A MOTONAVE" ? (
                        <select value={rec.plantaFiltro||""} onChange={e=>{const n=[...cmtRecepcion];n[i]={...n[i],plantaFiltro:e.target.value,tanque:""};setCmtRecepcion(n);}}
                          style={{background:T.navy,color:"#fff",border:"none",borderRadius:6,padding:"5px 10px",fontSize:11,fontWeight:700,cursor:"pointer",outline:"none"}}>
                          <option value="">Barcaza...</option>
                          <option value="QBS002">QBS002</option>
                          <option value="TANQUES TIERRA">TANQUES TIERRA</option>
                        </select>
                      ) : (
                        <select value={rec.plantaFiltro||""} onChange={e=>{const n=[...cmtRecepcion];n[i]={...n[i],plantaFiltro:e.target.value,tanque:""};setCmtRecepcion(n);}}
                          style={{background:T.navy,color:"#fff",border:"none",borderRadius:6,padding:"5px 10px",fontSize:11,fontWeight:700,cursor:"pointer",outline:"none"}}>
                          <option value="">Planta...</option>
                          <option value="PLANTA 1">PLANTA 1</option>
                          <option value="PLANTA 2">PLANTA 2</option>
                        </select>
                      )}
                      <span style={{fontSize:10,color:T.muted,textTransform:"uppercase",letterSpacing:1}}>Tanque:</span>
                      <select value={rec.tanque} onChange={e=>{const n=[...cmtRecepcion];n[i]={...n[i],tanque:e.target.value};setCmtRecepcion(n);}} style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:6,padding:"6px 10px",color:T.text,fontSize:13,fontFamily:"system-ui,sans-serif",outline:"none"}}>
                        <option value="">—</option>{(()=>{
                          const p=rec.plantaFiltro||"";
                          const esEntrega=(form.tipo_operacion||"")==="ENTREGA A MOTONAVE";
                          if(esEntrega){
                            if(p==="QBS002") return tanques.filter(t=>t.id.startsWith("QBS002-"));
                            if(p==="TANQUES TIERRA") return tanques.filter(t=>t.id.startsWith("TKT-"));
                            return tanques.filter(t=>t.id.startsWith("QBS002-")||t.id.startsWith("TKT-"));
                          }
                          if(p==="PLANTA 1") return tanques.filter(t=>t.id.startsWith("QBS002-")||t.id.startsWith("TKT-"));
                          if(p==="PLANTA 2") return tanques.filter(t=>t.id.startsWith("TK-"));
                          return tanques.filter(t=>t.id.startsWith("TK-")||t.id.startsWith("QBS002-")||t.id.startsWith("TKT-"));
                        })().map(t=><option key={t.id}>{t.id}</option>)}
                      </select>
                    </div>
                    <button onClick={()=>setCmtRecepcion(cmtRecepcion.filter((_,j)=>j!==i))} style={{background:`${T.danger}22`,border:`1px solid ${T.danger}44`,borderRadius:8,color:T.danger,padding:"4px 10px",cursor:"pointer",fontSize:11}}>✕</button>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"80px 1fr 1fr 1fr 1fr",gap:8,alignItems:"end",marginBottom:6}}>
                    <div style={{fontSize:10,color:T.orange,fontWeight:700,textTransform:"uppercase",paddingBottom:4}}>Medida Inicial</div>
                    <div><Lbl>Sonda</Lbl><input type="number" value={rec.sondaInicial||""} onChange={e=>{const n=[...cmtRecepcion];n[i]={...n[i],sondaInicial:e.target.value};setCmtRecepcion(n);}} onBlur={e=>calcularGalonesConSetter(rec.tanque,e.target.value,rec.tempInicial,rec.apiInicial,i,setCmtRecepcion,"galonesInicial")} style={inputStyle}/></div>
                    <div><Lbl>Temp °C</Lbl><input type="number" step="0.1" placeholder="" value={rec.tempInicial||""} onChange={e=>{const n=[...cmtRecepcion];n[i]={...n[i],tempInicial:e.target.value};setCmtRecepcion(n);}} onBlur={e=>calcularGalonesConSetter(rec.tanque,rec.sondaInicial,e.target.value,rec.apiInicial,i,setCmtRecepcion,"galonesInicial")} style={inputStyle}/></div>
                    <div><Lbl>API</Lbl><input type="number" step="0.1" placeholder="" value={rec.apiInicial||""} onChange={e=>{const n=[...cmtRecepcion];n[i]={...n[i],apiInicial:e.target.value};setCmtRecepcion(n);}} onBlur={e=>calcularGalonesConSetter(rec.tanque,rec.sondaInicial,rec.tempInicial,e.target.value,i,setCmtRecepcion,"galonesInicial")} style={inputStyle}/></div>
                    <div><Lbl>{rec.tempInicial&&rec.apiInicial?"Galones Netos":"Galones Brutos"}</Lbl><input type="number" readOnly value={rec.galonesInicial||""} style={{...inputStyle,background:"#e8edf2",color:"#4a5568",cursor:"default"}}/></div>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"80px 1fr 1fr 1fr 1fr",gap:8,alignItems:"end"}}>
                    <div style={{fontSize:10,color:T.muted,fontWeight:700,textTransform:"uppercase",paddingBottom:4}}>Medida Final</div>
                    <div><Lbl>Sonda</Lbl><input type="number" value={rec.sondaFinal||""} onChange={e=>{const n=[...cmtRecepcion];n[i]={...n[i],sondaFinal:e.target.value};setCmtRecepcion(n);}} onBlur={e=>calcularGalonesConSetter(rec.tanque,e.target.value,rec.tempFinal,rec.apiFinal,i,setCmtRecepcion,"galonesFinal")} style={inputStyle}/></div>
                    <div><Lbl>Temp °C</Lbl><input type="number" step="0.1" placeholder="" value={rec.tempFinal||""} onChange={e=>{const n=[...cmtRecepcion];n[i]={...n[i],tempFinal:e.target.value};setCmtRecepcion(n);}} onBlur={e=>calcularGalonesConSetter(rec.tanque,rec.sondaFinal,e.target.value,rec.apiFinal,i,setCmtRecepcion,"galonesFinal")} style={inputStyle}/></div>
                    <div><Lbl>API</Lbl><input type="number" step="0.1" placeholder="" value={rec.apiFinal||""} onChange={e=>{const n=[...cmtRecepcion];n[i]={...n[i],apiFinal:e.target.value};setCmtRecepcion(n);}} onBlur={e=>calcularGalonesConSetter(rec.tanque,rec.sondaFinal,rec.tempFinal,e.target.value,i,setCmtRecepcion,"galonesFinal")} style={inputStyle}/></div>
                    <div><Lbl>{rec.tempFinal&&rec.apiFinal?"Galones Netos":"Galones Brutos"}</Lbl><input type="number" readOnly value={rec.galonesFinal||""} style={{...inputStyle,background:"#e8edf2",color:"#4a5568",cursor:"default"}}/></div>
                  </div>
                  {(()=>{const diff=Number(rec.galonesFinal||0)-Number(rec.galonesInicial||0);return diff>0&&<div style={{marginTop:8,textAlign:"right",fontSize:12,color:T.success,fontWeight:700}}>Recibido: {fmt(diff)} Gls</div>})()}
                </div>
              ));
            })()}
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:4}}>
              <Btn sm outline color={T.success} onClick={()=>setCmtRecepcion([...cmtRecepcion,{tanque:"",sondaInicial:"",tempInicial:"",apiInicial:"",galonesInicial:"",sondaFinal:"",tempFinal:"",apiFinal:"",galonesFinal:""}])}>+ TK</Btn>
            </div>
          </div>}
          {(form.tipo_operacion||"")!=="TRASIEGO DE PRODUCTO" && (form.tipo_operacion||"")!=="PORTEO" && (<div style={{marginBottom:18}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10,paddingBottom:6,borderBottom:`1px solid ${T.success}33`}}>
              <span style={{fontSize:11,fontWeight:700,color:T.success,letterSpacing:1,textTransform:"uppercase"}}>Medida Final</span>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <span style={{fontSize:11,color:T.muted,fontFamily:"monospace"}}>Producto:</span>
                <div style={{background:T.bg,border:`1px solid ${T.border}`,borderRadius:6,padding:"6px 14px",fontSize:13,fontFamily:"system-ui,sans-serif",color:T.navy,fontWeight:700,minWidth:180}}>{cmtProducto||"—"}</div>
              </div>
            </div>
            {cmtDespues.map((row,i)=>{
              const tqInfo = tanques.find(t=>t.id===row.tanque);
              const capTotal = tqInfo ? tqInfo.capacidad : null;
              const capMaxOp = capTotal !== null ? capTotal * 0.9 : null;
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
                  <div><Lbl>{row.temp&&row.api?"Galones Netos":"Galones Brutos"}</Lbl><input type="number" readOnly value={row.galones||""} style={{ width:"100%", background:"#e8edf2", border:`1px solid ${excede?T.danger:T.border}`, borderRadius:6, padding:"8px 10px", color: excede?T.danger:"#4a5568", fontSize:13, fontFamily:"system-ui,sans-serif", outline:"none", boxSizing:"border-box", cursor:"default" }}/></div>
                </div>
                {espacioDisponible !== null && row.tanque && (()=>{
                  const pctActual = capTotal > 0 ? Math.round((galonesIniciales / capTotal) * 100) : 0;
                  const enAlerta = galonesIniciales >= capMaxOp;
                  return (
                    <div style={{marginTop:8,padding:"6px 10px",background:"#e2e8f0",border:`1px solid ${T.border}`,borderRadius:6,display:"flex",alignItems:"center",gap:16,flexWrap:"wrap"}}>
                      <span style={{fontSize:11,color:T.muted}}>Espacio disponible: <b style={{color: enAlerta?T.danger:T.success}}>{fmt(Math.max(0,espacioDisponible))} Gls</b></span>
                      {enAlerta && (
                        <span style={{fontSize:11,fontWeight:800,color:T.danger,background:`${T.danger}18`,border:`1px solid ${T.danger}55`,borderRadius:6,padding:"2px 10px",letterSpacing:0.5}}>
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
              <span style={{ fontSize:12, color:T.success }}>Total: {fmt(cmtDespues.reduce((a,t)=>a+Number(t.galones||0),0))} Gls</span>
            </div>
          </div>)}
          {(form.tipo_operacion||"")==="DESCARGUE DE CARROTANQUE" && <><div ref={cmtCarrosRef}/><Section title="Carros Descargados" color={T.muted}>
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
                      (v.estado === "En Planta" || v.estado === "Rechazado")
                    );
                    return enPlanta.length > 0 ? (
                      <select value={carro.viaje_id||""} onChange={e=>{
                        const viajeId = e.target.value;
                        const viaje = viajes.find(v=>v.id===viajeId);
                        const tq = viaje ? tiquetes.find(t=>t.viaje_id===viaje.id || t.id===viaje.tiquete_id) : null;
                        const n=[...cmtCarros];
                        n[i] = {...n[i], viaje_id: viajeId, placa: viaje?.placa||"", guia: viaje?.guia||n[i].guia, tiquete: tq?.id||"", galones_guia: viaje?.gls_netos_guia||""};
                        setCmtCarros(n);
                      }} style={{width:"100%",background:T.card,border:`1px solid ${T.border}`,borderRadius:6,padding:"10px 12px",color:T.text,fontSize:13,fontFamily:"system-ui,sans-serif",outline:"none",boxSizing:"border-box"}}>
                        <option value="">{carro.placa ? `${carro.placa} (actual)` : "Seleccionar placa..."}</option>
                        {enPlanta.map(v=><option key={v.id} value={v.id}>{v.placa} — {v.producto}{v.autorizado_descargue?" [AUTORIZADO]":""}</option>)}
                      </select>
                    ) : (
                      <input type="text" placeholder="ABC123" maxLength={6} value={carro.placa} onChange={e=>{const n=[...cmtCarros];n[i].placa=e.target.value.replace(/[^A-Z0-9]/gi,"").toUpperCase().slice(0,6);setCmtCarros(n);}} style={{width:"100%",background:T.card,border:`1px solid ${T.border}`,borderRadius:6,padding:"10px 12px",color:T.text,fontSize:13,fontFamily:"system-ui,sans-serif",outline:"none",boxSizing:"border-box",textTransform:"uppercase"}}/>
                    );
                  })()}
                  </div>
                  <div><Lbl>Guía</Lbl><input type="text" readOnly value={carro.guia||""} style={{width:"100%",background:"#e8edf2",border:`1px solid #c5cfd8`,borderRadius:6,padding:"10px 12px",color:"#4a5568",fontSize:13,fontFamily:"system-ui,sans-serif",outline:"none",boxSizing:"border-box",fontWeight:600,cursor:"default"}}/></div>
                  <div><Lbl>Tiquete</Lbl><input type="text" readOnly value={carro.tiquete||""} style={{width:"100%",background:"#e8edf2",border:`1px solid #c5cfd8`,borderRadius:6,padding:"10px 12px",color:"#4a5568",fontSize:13,fontFamily:"system-ui,sans-serif",outline:"none",boxSizing:"border-box",fontWeight:600,cursor:"default"}}/></div>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(11,1fr)",gap:8,alignItems:"end"}}>
                  <div><Lbl>Hora Inicio</Lbl><input type="time" value={carro.hora_inicio||""} onChange={e=>{const n=[...cmtCarros];n[i].hora_inicio=e.target.value;setCmtCarros(n);}} style={{width:"100%",background:T.card,border:`1px solid ${T.border}`,borderRadius:6,padding:"10px 12px",color:T.text,fontSize:13,fontFamily:"system-ui,sans-serif",outline:"none",boxSizing:"border-box"}}/></div>
                  <div><Lbl>Hora Final</Lbl><input type="time" value={carro.hora_final||""} onChange={e=>{const n=[...cmtCarros];n[i].hora_final=e.target.value;setCmtCarros(n);}} style={{width:"100%",background:T.card,border:`1px solid ${T.border}`,borderRadius:6,padding:"10px 12px",color:T.text,fontSize:13,fontFamily:"system-ui,sans-serif",outline:"none",boxSizing:"border-box"}}/></div>
                  <div><Lbl>Duración</Lbl><div style={{background:"#e8edf2",border:`1px solid #c5cfd8`,borderRadius:6,padding:"10px 12px",fontSize:13,fontFamily:"monospace",color:duracion(carro.hora_inicio,carro.hora_final)?T.navy:"#aab4be",fontWeight:700,minHeight:43,display:"flex",alignItems:"center"}}>{duracion(carro.hora_inicio,carro.hora_final)||"—"}</div></div>
                  <div><Lbl>Peso Ingreso (Kg)</Lbl><input type="number" value={carro.peso_ingreso||""} onChange={e=>{const n=[...cmtCarros];n[i].peso_ingreso=e.target.value;const neto=Number(e.target.value||0)-Number(n[i].peso_salida||0);if(n[i].peso_salida)n[i].peso_neto=neto>0?String(neto):"";setCmtCarros(n);}} style={{width:"100%",background:T.card,border:`1px solid ${T.border}`,borderRadius:6,padding:"10px 12px",color:T.text,fontSize:13,fontFamily:"system-ui,sans-serif",outline:"none",boxSizing:"border-box"}}/></div>
                  <div><Lbl>Peso Salida (Kg)</Lbl><input type="number" value={carro.peso_salida||""} onChange={e=>{const val=e.target.value;const n=[...cmtCarros];n[i].peso_salida=val;const neto=Number(n[i].peso_ingreso||0)-Number(val||0);if(n[i].peso_ingreso)n[i].peso_neto=neto>0?String(neto):"";setCmtCarros(n);}} style={{width:"100%",background:T.card,border:`1px solid ${T.border}`,borderRadius:6,padding:"10px 12px",color:T.text,fontSize:13,fontFamily:"system-ui,sans-serif",outline:"none",boxSizing:"border-box"}}/></div>
                  <div><Lbl>Peso Neto (Kg)</Lbl><input type="text" readOnly value={carro.peso_neto||""} style={{width:"100%",background:"#e8edf2",border:`1px solid ${T.border}`,borderRadius:6,padding:"10px 12px",color:"#4a5568",fontSize:13,fontFamily:"system-ui,sans-serif",outline:"none",boxSizing:"border-box",fontWeight:600,cursor:"default"}}/></div>
                  <div><Lbl>Galones Guía</Lbl><input type="text" readOnly value={carro.galones_guia ? fmt(Number(carro.galones_guia)) : ""} style={{width:"100%",background:"#e8edf2",border:`1px solid ${T.border}`,borderRadius:6,padding:"10px 12px",color:"#4a5568",fontSize:13,fontFamily:"system-ui,sans-serif",outline:"none",boxSizing:"border-box",fontWeight:600,cursor:"default"}}/></div>
                  <div><Lbl>Gls Descargados</Lbl><input type="text" readOnly value={(()=>{const tq=tiquetes.find(t=>t.id===carro.tiquete);const factor=Number(tq?.factor_tabla13||0);const pesoNeto=Number(carro.peso_neto||0);return (factor>0&&pesoNeto>0)?fmt(Math.round(pesoNeto/factor)):(carro.galones_descargados||"");})()}  style={{width:"100%",background:"#e8edf2",border:`1px solid ${T.border}`,borderRadius:6,padding:"10px 12px",color:"#4a5568",fontSize:13,fontFamily:"system-ui,sans-serif",outline:"none",boxSizing:"border-box",fontWeight:600,cursor:"default"}}/></div>
                  <div><Lbl>RPM</Lbl><input type="text" value={carro.rpm||""} onChange={e=>{const n=[...cmtCarros];n[i].rpm=e.target.value;setCmtCarros(n);}} style={{width:"100%",background:T.card,border:`1px solid ${T.border}`,borderRadius:6,padding:"10px 12px",color:T.text,fontSize:13,fontFamily:"system-ui,sans-serif",outline:"none",boxSizing:"border-box"}}/></div>
                  <div><Lbl>Presión (Bar)</Lbl><input type="text" value={carro.presion||""} onChange={e=>{const n=[...cmtCarros];n[i].presion=e.target.value;setCmtCarros(n);}} style={{width:"100%",background:T.card,border:`1px solid ${T.border}`,borderRadius:6,padding:"10px 12px",color:T.text,fontSize:13,fontFamily:"system-ui,sans-serif",outline:"none",boxSizing:"border-box"}}/></div>
                  <div><Lbl>PBS</Lbl><input
                    type="text"
                    value={(carro.pbs_id||"").replace(/^PBS-/,"")}
                    onChange={e=>{const n=[...cmtCarros];const v=e.target.value.replace(/\D/g,"");n[i].pbs_id=v?"PBS-"+v:"";setCmtCarros(n);}}
                    placeholder="Ej: 19442"
                    style={{width:"100%",background:T.card,border:`1.5px solid ${carro.pbs_id?T.orange:T.border}`,borderRadius:6,padding:"10px 12px",color:carro.pbs_id?T.orange:T.text,fontSize:13,fontFamily:"monospace",outline:"none",boxSizing:"border-box",fontWeight:carro.pbs_id?700:400}}
                  /></div>
                </div>
                <div style={{display:"flex",justifyContent:"flex-end",marginTop:8}}>
                  <button onClick={()=>setCmtCarros(cmtCarros.filter((_,j)=>j!==i))} style={{background:`${T.danger}15`,border:`1px solid ${T.danger}55`,borderRadius:6,color:T.danger,padding:"5px 14px",cursor:"pointer",fontSize:11,fontFamily:"system-ui,sans-serif"}}>✕ Eliminar carro</button>
                </div>
              </div>
            ))}
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:4}}>
              <Btn sm outline color={T.muted} onClick={()=>setCmtCarros([...cmtCarros,{placa:"",guia:"",tiquete:"",pbs_id:"",hora_inicio:"",hora_final:"",peso_ingreso:"",peso_salida:"",peso_neto:""}])}>+ Agregar Carro</Btn>
              <span style={{fontSize:11,color:T.muted}}>{cmtCarros.length} carro(s)</span>
            </div>
          </Section></> }
          {(form.tipo_operacion||"")==="TRASIEGO DE PRODUCTO" && (
            <Section title="Permiso de Bombeo Seguro" color="#fb923c">
              <Inp label="Número PBS" value={(form.pbs_id||"").replace(/^PBS-/,"")} onChange={e=>{const v=e.target.value.replace(/\D/g,"");setForm(prev=>({...prev,pbs_id:v?"PBS-"+v:""}));}} placeholder="Ej: 19442" style={{fontFamily:"monospace",color:form.pbs_id?T.orange:T.text,fontWeight:form.pbs_id?700:400}}/>
              {form.pbs_id && <div style={{fontSize:11,color:T.orange,marginTop:4}}>Se guardará como: <b>{form.pbs_id}</b></div>}
            </Section>
          )}
          {/* ── PORTEO ─────────────────────────────────────────────────────────── */}
          {(form.tipo_operacion||"")==="PORTEO" && (()=>{
            const allPlantas = ["PLANTA 1","PLANTA 2"];
            const inSt = {width:"100%",background:T.card,border:`1px solid ${T.border}`,borderRadius:6,padding:"8px 10px",color:T.text,fontSize:13,outline:"none",boxSizing:"border-box"};
            const roSt = {...inSt,background:"#f1f5f9",color:T.navy,fontWeight:700,cursor:"default"};

            // helper: API corregido y factor tabla13 por tanque
            const getLabInfo = (tanqueId) => {
              if (!tanqueId) return {api:"",factor:"",fuente:""};
              // 1. Tiquete de análisis directamente para este tanque (Planta 2, Planta 1, etc.)
              const tiqDirecto = [...(tiquetes||[])]
                .filter(t=>t.tanque===tanqueId && t.tipo_analisis && t.tipo_analisis!=="Tiquetes MP" && t.api_corregido)
                .sort((a,b)=>new Date(b.created_at||0)-new Date(a.created_at||0))[0];
              if (tiqDirecto) return {api: tiqDirecto.api_corregido, factor: tiqDirecto.factor_tabla13||tabla13Factor(tiqDirecto.api_corregido)||"", fuente:"lab"};
              // 2. Tiquete de análisis de planta vinculado a OT del tanque
              const ots = [...(ordenesTrabaio||[])].filter(o=>o.tanque_destino===tanqueId && o.tiquete_id).sort((a,b)=>new Date(b.updated_at||b.created_at||0)-new Date(a.updated_at||a.created_at||0));
              for (const ot of ots) {
                const tiq = (tiquetes||[]).find(t=>t.id===ot.tiquete_id && t.tipo_analisis && t.tipo_analisis!=="Tiquetes MP");
                if (tiq?.api_corregido) return {api: tiq.api_corregido, factor: tiq.factor_tabla13||"", fuente:"lab"};
              }
              // 2. Fallback para tanques MP: promedio ponderado de api de tiquetes MP descargados en este tanque
              const cmtsDescargue = (cmts||[]).filter(c=>
                c.tipo_operacion==="DESCARGUE DE CARROTANQUE" &&
                (c.tanques_despues||[]).some(td=>String(td.tanque)===String(tanqueId))
              );
              const puntos = [];
              cmtsDescargue.forEach(c=>{
                (c.carros||[]).forEach(cr=>{
                  if (!cr.tiquete) return;
                  const tiq = (tiquetes||[]).find(t=>(t.id===cr.tiquete || t.numero_tiquete===cr.tiquete) && (!t.tipo_analisis || t.tipo_analisis==="Tiquetes MP"));
                  if (!tiq?.api_corregido) return;
                  const api = Number(tiq.api_corregido);
                  // galones: del tiquete, del viaje o del carro en ese orden
                  const viaje = tiq.viaje_id ? (viajes||[]).find(v=>v.id===tiq.viaje_id) : null;
                  const gls = Number(tiq.galones_recibidos||0) || Number(viaje?.gls_recibidos||0) || Number(cr.galones_descargados||0) || Number(cr.galones_guia||0);
                  if (api>0 && gls>0) puntos.push({api,gls});
                });
              });
              if (puntos.length===0) return {api:"",factor:"",fuente:""};
              const totalGls = puntos.reduce((s,p)=>s+p.gls,0);
              const apiProm = puntos.reduce((s,p)=>s+(p.api*p.gls),0)/totalGls;
              const apiRound = Math.round(apiProm*10)/10;
              return {api: apiRound, factor: tabla13Factor(apiRound)||"", fuente:"mp"};
            };

            // Estilo compacto para inputs del formulario PORTEO
            const cInSt = {width:"100%",background:T.card,border:`1px solid ${T.border}`,borderRadius:5,padding:"6px 8px",color:T.text,fontSize:12,fontFamily:"system-ui,sans-serif",outline:"none",boxSizing:"border-box"};
            const cRoSt = {...cInSt,background:"#e8edf2",color:"#4a5568",cursor:"default"};
            const CLbl = ({children}) => <div style={{fontSize:10,color:T.muted,fontWeight:600,marginBottom:2,letterSpacing:0.2}}>{children}</div>;

            const renderTanqueSection = (color, planta, setPlanta, rows, setRows, isDescarga=false) => {
              const tanquesPlanta = tanques.filter(t=>t.planta===planta);
              return (<>
                <div style={{marginBottom:10}}>
                  <CLbl>Planta</CLbl>
                  <select value={planta} onChange={e=>{setPlanta(e.target.value);setRows([{tanque:"",sondaInicial:"",tempInicial:"",apiInicial:"",galonesInicial:"",sondaFinal:"",tempFinal:"",apiFinal:"",galonesFinal:""}]);}} style={{...cInSt,fontWeight:700}}>
                    <option value="">Seleccionar...</option>
                    {allPlantas.map(p=><option key={p}>{p}</option>)}
                  </select>
                </div>
                {planta && rows.map((rec,i)=>{
                  const lab = getLabInfo(rec.tanque);
                  return (
                  <div key={i} style={{background:T.bg,borderRadius:8,padding:"10px 12px",marginBottom:8,border:`1px solid ${color}33`}}>
                    {/* Selector tanque */}
                    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8,gap:6,flexWrap:"wrap"}}>
                      <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
                        <select value={rec.tanque} onChange={e=>{const tId=e.target.value;const labI=getLabInfo(tId);const n=[...rows];n[i]={...n[i],tanque:tId,apiInicial:labI.api||n[i].apiInicial,apiFinal:labI.api||n[i].apiFinal};setRows(n);}} style={{...cInSt,width:"auto",fontWeight:700,color:color}}>
                          <option value="">— Tanque —</option>
                          {tanquesPlanta.map(t=><option key={t.id}>{t.id}</option>)}
                        </select>
                        {rec.tanque && lab.api && <span style={{fontSize:10,background:`${T.navy}15`,borderRadius:4,padding:"2px 6px",color:T.navy,fontWeight:700}}>API {lab.api}°</span>}
                        {rec.tanque && lab.factor && <span style={{fontSize:10,background:`${T.navy}15`,borderRadius:4,padding:"2px 6px",color:T.navy,fontWeight:700}}>F {lab.factor}</span>}
                      </div>
                      {rows.length>1 && <button onClick={()=>setRows(rows.filter((_,j)=>j!==i))} style={{background:`${T.danger}22`,border:`1px solid ${T.danger}44`,borderRadius:6,color:T.danger,padding:"2px 8px",cursor:"pointer",fontSize:10}}>✕</button>}
                    </div>
                    {/* Medidas: Inicial | Final */}
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                      {/* Medida Inicial */}
                      <div>
                        <div style={{fontSize:10,color,fontWeight:700,textTransform:"uppercase",letterSpacing:0.5,marginBottom:6,paddingBottom:3,borderBottom:`1px solid ${color}44`}}>Medida Inicial</div>
                        <div style={{display:"grid",gap:5}}>
                          <div><CLbl>Sonda</CLbl><input type="number" value={rec.sondaInicial||""} onChange={e=>{const n=[...rows];n[i]={...n[i],sondaInicial:e.target.value};setRows(n);}} onBlur={e=>calcularGalonesConSetter(rec.tanque,e.target.value,rec.tempInicial,rec.apiInicial,i,setRows,"galonesInicial")} style={cInSt}/></div>
                          <div><CLbl>Temp °C</CLbl><input type="number" step="0.1" value={rec.tempInicial||""} onChange={e=>{const n=[...rows];n[i]={...n[i],tempInicial:e.target.value};setRows(n);}} onBlur={e=>calcularGalonesConSetter(rec.tanque,rec.sondaInicial,e.target.value,rec.apiInicial,i,setRows,"galonesInicial")} style={cInSt}/></div>
                          <div><CLbl>API{lab.api?" (Lab)":""}</CLbl><input type="number" step="0.1" value={rec.apiInicial||""} onChange={e=>{const n=[...rows];n[i]={...n[i],apiInicial:e.target.value};setRows(n);}} onBlur={e=>calcularGalonesConSetter(rec.tanque,rec.sondaInicial,rec.tempInicial,e.target.value,i,setRows,"galonesInicial")} style={lab.api?{...cRoSt,color:T.navy}:cInSt}/></div>
                          <div><CLbl>{rec.tempInicial&&rec.apiInicial?"Gls Netos":"Gls Brutos"}</CLbl><input type="number" readOnly value={rec.galonesInicial||""} style={{...cRoSt,fontWeight:700,color:T.orange}}/></div>
                        </div>
                      </div>
                      {/* Medida Final */}
                      <div>
                        <div style={{fontSize:10,color:T.muted,fontWeight:700,textTransform:"uppercase",letterSpacing:0.5,marginBottom:6,paddingBottom:3,borderBottom:`1px solid ${T.border}`}}>Medida Final</div>
                        <div style={{display:"grid",gap:5}}>
                          <div><CLbl>Sonda</CLbl><input type="number" value={rec.sondaFinal||""} onChange={e=>{const n=[...rows];n[i]={...n[i],sondaFinal:e.target.value};setRows(n);}} onBlur={e=>calcularGalonesConSetter(rec.tanque,e.target.value,rec.tempFinal,rec.apiFinal,i,setRows,"galonesFinal")} style={cInSt}/></div>
                          <div><CLbl>Temp °C</CLbl><input type="number" step="0.1" value={rec.tempFinal||""} onChange={e=>{const n=[...rows];n[i]={...n[i],tempFinal:e.target.value};setRows(n);}} onBlur={e=>calcularGalonesConSetter(rec.tanque,rec.sondaFinal,e.target.value,rec.apiFinal,i,setRows,"galonesFinal")} style={cInSt}/></div>
                          <div><CLbl>API{lab.api?" (Lab)":""}</CLbl><input type="number" step="0.1" value={rec.apiFinal||""} onChange={e=>{const n=[...rows];n[i]={...n[i],apiFinal:e.target.value};setRows(n);}} onBlur={e=>calcularGalonesConSetter(rec.tanque,rec.sondaFinal,rec.tempFinal,e.target.value,i,setRows,"galonesFinal")} style={lab.api?{...cRoSt,color:T.navy}:cInSt}/></div>
                          <div><CLbl>{rec.tempFinal&&rec.apiFinal?"Gls Netos":"Gls Brutos"}</CLbl><input type="number" readOnly value={rec.galonesFinal||""} style={{...cRoSt,fontWeight:700,color:isDescarga?T.success:T.muted}}/></div>
                        </div>
                      </div>
                    </div>
                    {/* Subtotal */}
                    {(Number(rec.galonesInicial||0)>0||Number(rec.galonesFinal||0)>0) && (
                      <div style={{marginTop:8,paddingTop:6,borderTop:`1px solid ${T.border}`,fontSize:11,textAlign:"right"}}>
                        {isDescarga
                          ? <span style={{color:T.success,fontWeight:700}}>↑ {fmt(Math.max(0,Number(rec.galonesFinal||0)-Number(rec.galonesInicial||0)))} Gls recibidos</span>
                          : <span style={{color:T.orange,fontWeight:700}}>↓ {fmt(Math.max(0,Number(rec.galonesInicial||0)-Number(rec.galonesFinal||0)))} Gls despachados</span>
                        }
                      </div>
                    )}
                  </div>
                );})}
                {planta && (
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:2}}>
                    <Btn sm outline color={color} onClick={()=>setRows([...rows,{tanque:"",sondaInicial:"",tempInicial:"",apiInicial:"",galonesInicial:"",sondaFinal:"",tempFinal:"",apiFinal:"",galonesFinal:""}])}>+ TK</Btn>
                    <span style={{fontSize:11,fontWeight:700,color}}>
                      {isDescarga
                        ? <>{fmt(rows.reduce((a,r)=>a+Math.max(0,Number(r.galonesFinal||0)-Number(r.galonesInicial||0)),0))} Gls recibidos</>
                        : <>{fmt(rows.reduce((a,r)=>a+Math.max(0,Number(r.galonesInicial||0)-Number(r.galonesFinal||0)),0))} Gls despachados</>
                      }
                    </span>
                  </div>
                )}
              </>);
            };

            // factor tabla13 del primer tanque de carga con info de lab
            const factorCarga = (() => {
              for (const r of cmtPorteoCarga) {
                const lab = getLabInfo(r.tanque);
                if (lab.factor) return Number(lab.factor);
              }
              return 0;
            })();

            const onPorteoKey = e => {
              if (e.key !== 'Enter') return;
              if (e.target.tagName !== 'INPUT') return;
              e.preventDefault();
              const all = Array.from(e.currentTarget.querySelectorAll('input,select'));
              const idx = all.indexOf(e.target);
              if (idx >= 0 && idx < all.length - 1) all[idx + 1].focus();
            };

            return (<>
              {/* ── LAYOUT DOS COLUMNAS: CARGUE | DESCARGUE ── */}
              <div onKeyDown={onPorteoKey} style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,alignItems:"start",marginBottom:14}}>

                {/* ── COLUMNA IZQUIERDA: Planta de Carga + Carros ── */}
                <div style={{background:T.card,borderRadius:10,border:`2px solid ${T.orange}55`,overflow:"hidden"}}>
                  <div style={{background:`${T.orange}18`,padding:"8px 14px",borderBottom:`1px solid ${T.orange}44`,display:"flex",alignItems:"center",gap:8}}>
                    <span style={{fontSize:12,fontWeight:700,color:T.orange,textTransform:"uppercase",letterSpacing:0.5,display:"flex",alignItems:"center",gap:5}}><Truck size={13}/>Planta de Carga</span>
                    <span style={{fontSize:11,color:T.muted,fontWeight:600}}>{fmt(cmtPorteoCarga.reduce((a,r)=>a+Math.max(0,Number(r.galonesInicial||0)-Number(r.galonesFinal||0)),0))} Gls despachados</span>
                  </div>
                  <div style={{padding:"12px 14px"}}>
                    {renderTanqueSection(T.orange, cmtPorteoCargaPlanta, setCmtPorteoCargaPlanta, cmtPorteoCarga, setCmtPorteoCarga)}

                    {/* Carros */}
                    <div style={{marginTop:12,paddingTop:10,borderTop:`1px solid ${T.orange}33`}}>
                      <div style={{fontSize:10,fontWeight:700,color:T.orange,textTransform:"uppercase",letterSpacing:0.5,marginBottom:8}}>Carros</div>
                      {cmtPorteoCarros.map((c,i)=>(
                        <div key={i} style={{background:`${T.orange}08`,border:`1px solid ${T.orange}33`,borderRadius:8,padding:"10px 12px",marginBottom:8}}>
                          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:6,marginBottom:6}}>
                            <div style={{gridColumn:"span 2"}}><CLbl>Placa</CLbl><input value={c.placa||""} onChange={e=>{const n=[...cmtPorteoCarros];n[i]={...n[i],placa:e.target.value.replace(/[^A-Z0-9]/gi,"").toUpperCase().slice(0,6)};setCmtPorteoCarros(n);}} placeholder="ABC123" maxLength={6} style={{...cInSt,fontFamily:"monospace",fontWeight:700}}/></div>
                            <div style={{gridColumn:"span 2"}}><CLbl>Transportadora</CLbl><input value={c.transportadora||""} onChange={e=>{const n=[...cmtPorteoCarros];n[i]={...n[i],transportadora:e.target.value};setCmtPorteoCarros(n);}} style={cInSt}/></div>
                          </div>
                          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:6,marginBottom:6}}>
                            <div><CLbl>H. Inicio Cargue</CLbl><input type="time" value={c.hora_inicio_cargue||""} onChange={e=>{const n=[...cmtPorteoCarros];n[i]={...n[i],hora_inicio_cargue:e.target.value};setCmtPorteoCarros(n);}} style={cInSt}/></div>
                            <div><CLbl>H. Final Cargue</CLbl><input type="time" value={c.hora_final_cargue||""} onChange={e=>{const n=[...cmtPorteoCarros];n[i]={...n[i],hora_final_cargue:e.target.value};setCmtPorteoCarros(n);}} style={cInSt}/></div>
                            <div><CLbl>Dur. Cargue</CLbl><div style={{background:"#e8edf2",border:`1px solid #c5cfd8`,borderRadius:6,padding:"0 10px",fontSize:13,fontFamily:"monospace",color:duracion(c.hora_inicio_cargue,c.hora_final_cargue)?T.navy:"#aab4be",fontWeight:700,height:38,display:"flex",alignItems:"center",boxSizing:"border-box"}}>{duracion(c.hora_inicio_cargue,c.hora_final_cargue)||"—"}</div></div>
                            <div><CLbl>N° PBS Cargue</CLbl><input type="text" value={c.numero_pbs||""} onChange={e=>{const n=[...cmtPorteoCarros];n[i]={...n[i],numero_pbs:e.target.value.toUpperCase()};setCmtPorteoCarros(n);}} placeholder="PBS-001" style={cInSt}/></div>
                          </div>
                          <div>
                            <CLbl>Gls por Contador</CLbl>
                            <input type="number" value={c.galones_contador||""} onChange={e=>{const n=[...cmtPorteoCarros];n[i]={...n[i],galones_contador:e.target.value};setCmtPorteoCarros(n);}} style={cInSt}/>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* ── COLUMNA DERECHA: Planta de Descarga ── */}
                <div style={{background:T.card,borderRadius:10,border:`2px solid ${T.success}55`,overflow:"hidden"}}>
                  <div style={{background:`${T.success}18`,padding:"8px 14px",borderBottom:`1px solid ${T.success}44`,display:"flex",alignItems:"center",gap:8}}>
                    <span style={{fontSize:12,fontWeight:700,color:T.success,textTransform:"uppercase",letterSpacing:0.5,display:"flex",alignItems:"center",gap:5}}><ArrowDownToLine size={13}/>Planta de Descarga</span>
                    <span style={{fontSize:11,color:T.muted,fontWeight:600}}>{fmt(cmtPorteoDescarga.reduce((a,r)=>a+Math.max(0,Number(r.galonesFinal||0)-Number(r.galonesInicial||0)),0))} Gls recibidos</span>
                  </div>
                  <div style={{padding:"12px 14px"}}>
                    {renderTanqueSection(T.success, cmtPorteoDescargaPlanta, setCmtPorteoDescargaPlanta, cmtPorteoDescarga, setCmtPorteoDescarga, true)}
                    {/* Carros — descargue */}
                    {cmtPorteoCarros.some(c=>c.placa) && (
                      <div style={{marginTop:12,paddingTop:10,borderTop:`1px solid ${T.success}33`}}>
                        <div style={{fontSize:10,fontWeight:700,color:T.success,textTransform:"uppercase",letterSpacing:0.5,marginBottom:8}}>Carros</div>
                        {cmtPorteoCarros.filter(c=>c.placa).map((c,idx)=>{
                          const i = cmtPorteoCarros.indexOf(c);
                          const pesoNeto = Number(c.peso_salida)>0 ? Number(c.peso_ingreso||0)-Number(c.peso_salida) : 0;
                          const glsBascula = factorCarga>0 && pesoNeto>0 ? Math.round(pesoNeto/factorCarga) : "";
                          return (
                          <div key={i} style={{background:`${T.success}08`,border:`1px solid ${T.success}33`,borderRadius:8,padding:"10px 12px",marginBottom:8}}>
                            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:6}}>
                              <div><CLbl>Placa</CLbl><input value={c.placa} readOnly style={{...cRoSt,fontFamily:"monospace",fontWeight:700,color:T.navy}}/></div>
                              <div><CLbl>Transportadora</CLbl><input value={c.transportadora||""} readOnly style={cRoSt}/></div>
                            </div>
                            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:6,marginBottom:6}}>
                              <div><CLbl>H. Inicio Descargue</CLbl><input type="time" value={c.hora_inicio_descargue||""} onChange={e=>{const n=[...cmtPorteoCarros];n[i]={...n[i],hora_inicio_descargue:e.target.value};setCmtPorteoCarros(n);}} style={cInSt}/></div>
                              <div><CLbl>H. Final Descargue</CLbl><input type="time" value={c.hora_final_descargue||""} onChange={e=>{const n=[...cmtPorteoCarros];n[i]={...n[i],hora_final_descargue:e.target.value};setCmtPorteoCarros(n);}} style={cInSt}/></div>
                              <div><CLbl>Dur. Descargue</CLbl><div style={{background:"#e8edf2",border:`1px solid #c5cfd8`,borderRadius:6,padding:"0 10px",fontSize:13,fontFamily:"monospace",color:duracion(c.hora_inicio_descargue,c.hora_final_descargue)?T.navy:"#aab4be",fontWeight:700,height:38,display:"flex",alignItems:"center",boxSizing:"border-box"}}>{duracion(c.hora_inicio_descargue,c.hora_final_descargue)||"—"}</div></div>
                              <div><CLbl>N° PBS Descargue</CLbl><input type="text" value={c.numero_pbs_descargue||""} onChange={e=>{const n=[...cmtPorteoCarros];n[i]={...n[i],numero_pbs_descargue:e.target.value};setCmtPorteoCarros(n);}} style={cInSt}/></div>
                            </div>
                            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6}}>
                              <div><CLbl>Peso Ing. (kg)</CLbl><input type="number" value={c.peso_ingreso||""} onChange={e=>{const n=[...cmtPorteoCarros];n[i]={...n[i],peso_ingreso:e.target.value};setCmtPorteoCarros(n);}} style={cInSt}/></div>
                              <div><CLbl>Peso Sal. (kg)</CLbl><input type="number" value={c.peso_salida||""} onChange={e=>{const n=[...cmtPorteoCarros];n[i]={...n[i],peso_salida:e.target.value};setCmtPorteoCarros(n);}} style={cInSt}/></div>
                              <div><CLbl>Gls Báscula</CLbl><input type="number" value={glsBascula||(Number(c.peso_salida)>0?c.galones_bascula:"")||""} onChange={e=>{const n=[...cmtPorteoCarros];n[i]={...n[i],galones_bascula:e.target.value};setCmtPorteoCarros(n);}} style={glsBascula?{...cRoSt,fontWeight:700,color:T.success}:cInSt} readOnly={!!glsBascula}/></div>
                            </div>
                            {pesoNeto>0 && factorCarga>0 && (
                              <div style={{marginTop:4,fontSize:10,color:T.muted}}>{fmt(pesoNeto)} kg ÷ {factorCarga} = <b style={{color:T.success}}>{fmt(glsBascula)} Gls</b></div>
                            )}
                          </div>
                        );})}
                        {cmtPorteoCarros.some(c=>Number(c.peso_salida)>0) && (
                          <div style={{textAlign:"right",fontSize:11,fontWeight:700,color:T.success}}>
                            {fmt(cmtPorteoCarros.reduce((a,c)=>{const pn=Number(c.peso_salida)>0?Number(c.peso_ingreso||0)-Number(c.peso_salida):0;return a+(factorCarga>0&&pn>0?Math.round(pn/factorCarga):Number(c.galones_bascula||0));},0))} Gls báscula total
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Resumen */}
              {(cmtPorteoCarros.some(c=>c.placa)||cmtPorteoCarga.some(r=>r.tanque)) && (
                <Card style={{background:`${T.navy}10`,borderColor:`${T.navy}33`,marginBottom:14}}>
                  <div style={{fontSize:13,color:T.navy,fontWeight:700}}>
                    {cmtPorteoCargaPlanta||"Origen"} → {cmtPorteoDescargaPlanta||"Destino"} · {cmtPorteoCarros.filter(c=>c.placa).length} carro(s)
                  </div>
                  <div style={{fontSize:11,color:T.muted,marginTop:4,display:"flex",gap:18,flexWrap:"wrap"}}>
                    <span>Despachados: <b style={{color:T.orange}}>{fmt(cmtPorteoCarga.reduce((a,r)=>a+Math.max(0,Number(r.galonesInicial||0)-Number(r.galonesFinal||0)),0))} Gls</b></span>
                    <span>Contador: <b>{fmt(cmtPorteoCarros.reduce((a,c)=>a+Number(c.galones_contador||0),0))} Gls</b></span>
                    {cmtPorteoDescarga.some(r=>Number(r.galonesFinal||0)>0) && <span>Recibidos: <b style={{color:T.success}}>{fmt(cmtPorteoDescarga.reduce((a,r)=>a+Math.max(0,Number(r.galonesFinal||0)-Number(r.galonesInicial||0)),0))} Gls</b></span>}
                    {cmtPorteoCarros.some(c=>Number(c.peso_salida)>0) && <span>Báscula: <b>{fmt(cmtPorteoCarros.reduce((a,c)=>{const pn=Number(c.peso_salida)>0?Number(c.peso_ingreso||0)-Number(c.peso_salida):0;return a+(factorCarga>0&&pn>0?Math.round(pn/factorCarga):Number(c.galones_bascula||0));},0))} Gls</b></span>}
                  </div>
                </Card>
              )}
            </>);
          })()}
          {(form.tipo_operacion||"")==="TRASIEGO DE PRODUCTO" ? (()=>{
            const galonesDespachoInicial = cmtAntes.reduce((a,t)=>a+Number(t.galones||0),0);
            const galonesDespachoFinal = cmtDespues.reduce((a,t)=>a+Number(t.galones||0),0);
            const galonajeTraseado = Math.max(0, galonesDespachoInicial - galonesDespachoFinal);
            return galonajeTraseado > 0 ? (
              <Card style={{ background:`${T.orange}18`, borderColor:`${T.orange}33`, marginBottom:14 }}>
                <div style={{ fontSize:13, color:T.orange, fontWeight:700 }}>
                  Galonaje Trasegado: {fmt(galonajeTraseado)} Galones
                </div>
                <div style={{ fontSize:11, color:T.muted, marginTop:4 }}>
                  Salida Tanque de Despacho: {fmt(galonesDespachoInicial)} → {fmt(galonesDespachoFinal)} Gls
                </div>
              </Card>
            ) : null;
          })() : (
            cmtDespues.reduce((a,t)=>a+Number(t.galones||0),0) > cmtAntes.reduce((a,t)=>a+Number(t.galones||0),0) && (
            <Card style={{ background:`${T.success}18`, borderColor:`${T.success}33`, marginBottom:14 }}>
              <div style={{ fontSize:13, color:T.success, fontWeight:700 }}>
                Total Recibido / Entregado: {fmt(cmtDespues.reduce((a,t)=>a+Number(t.galones||0),0) - cmtAntes.reduce((a,t)=>a+Number(t.galones||0),0))} Galones
              </div>
            </Card>
          ))}
          <div style={{ display:"flex", justifyContent:"flex-end", gap:10 }}>
            <Btn outline onClick={()=>setModal(null)}>Cancelar</Btn>
            <Btn color={T.success} onClick={guardarCMT} disabled={saving}>{saving?"Guardando...":form.id?"Guardar Cambios":"Guardar CMT"}</Btn>
          </div>
        </Modal>
      )}

      {modal==="despacho" && (
        <Modal title={form.id ? `Editar Despacho ${form.id}` : "Registrar Despacho a Buque"} onClose={()=>setModal(null)} wide inline>
          <Grid cols={3}>
            <Inp label="Fecha Registro" type="date" value={form.fecha||today()} onChange={f("fecha")}/>
            <div style={{gridColumn:"span 2"}}><Inp label="MN (Nombre del Buque)" type="text" placeholder="MV / MT / BT ..." value={form.buque||""} onChange={f("buque")}/></div>
            <Inp label="IMO" type="text" placeholder="IMO 1234567" value={form.imo||""} onChange={f("imo")}/>
            <Inp label="Bandera" type="text" placeholder="Colombia / Panama ..." value={form.bandera||""} onChange={f("bandera")}/>
            <Inp label="Agencia" type="text" placeholder="Agencia naviera" value={form.agencia||""} onChange={f("agencia")}/>
            <Inp label="ETA" type="date" value={form.eta||""} onChange={f("eta")}/>
            <Inp label="ETD" type="date" value={form.etd||""} onChange={f("etd")}/>
            <Inp label="Horas Op." type="number" placeholder="0" value={form.horas_op||""} onChange={f("horas_op")}/>
            <Inp label="MT VLSO" type="number" placeholder="0" value={form.mt_vlso||""} onChange={f("mt_vlso")}/>
            <Inp label="MT HSFO" type="number" placeholder="0" value={form.mt_hsfo||""} onChange={f("mt_hsfo")}/>
            <Inp label="MT MGO" type="number" placeholder="0" value={form.mt_mgo||""} onChange={f("mt_mgo")}/>
            <Inp label="Ciudad" type="text" placeholder="Barranquilla / Cartagena / Santa Marta" value={form.ciudad||perfil.sede||""} onChange={f("ciudad")}/>
            <Inp label="Puerto de Entrega" type="text" placeholder="SPRB / SPSM / Palermo / ..." value={form.destino||""} onChange={f("destino")}/>
            <Inp label="Contrato" type="text" placeholder="N° Contrato" value={form.contrato||""} onChange={f("contrato")}/>
            <Sel label="Estado" value={form.estado||"PENDIENTE"} onChange={f("estado")}>
              {["PENDIENTE","EN OPERACIÓN","COMPLETADO","CANCELADO"].map(s=><option key={s}>{s}</option>)}
            </Sel>
          </Grid>
          <div style={{ display:"flex", justifyContent:"flex-end", gap:10, marginTop:12 }}>
            <Btn outline onClick={()=>setModal(null)}>Cancelar</Btn>
            <Btn color="#c084fc" onClick={guardarDespacho} disabled={saving}>{saving?"Guardando...":form.id?"Actualizar Despacho":"Registrar Despacho"}</Btn>
          </div>
        </Modal>
      )}

{modalVinculacionOT.mostrar && (()=>{
  const otsDisponibles = (ordenesTrabaio||[]).filter(o=>(o.estado==="COMPLETADA"||o.estado==="ANALIZADA") && !(cmts||[]).some(c=>c.ot_id===o.id));
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{background:T.card,borderRadius:12,padding:28,width:440,maxWidth:"95vw",boxShadow:"0 20px 60px rgba(0,0,0,0.5)"}}>
        <div style={{fontWeight:800,fontSize:16,color:T.navy,marginBottom:16}}>¿Vincular a una Orden de Trabajo?</div>
        <div style={{background:`${T.success}18`,border:`1px solid ${T.success}33`,borderRadius:8,padding:"10px 14px",fontSize:12,color:T.success,marginBottom:16}}>CMT{modalVinculacionOT.cmtNumero} creado exitosamente</div>
        <div style={{fontSize:11,color:T.muted,fontWeight:600,marginBottom:6}}>ÓRDENES DISPONIBLES</div>
        {otsDisponibles.length===0 ? (
          <div style={{background:T.bg,borderRadius:8,padding:"12px 14px",color:T.muted,fontSize:12,textAlign:"center",marginBottom:16}}>No hay OTs completadas disponibles<br/><span style={{fontSize:11}}>El CMT se guardará como autónomo</span></div>
        ) : (
          <select value={otVincSeleccionada} onChange={e=>setOtVincSeleccionada(e.target.value)} style={{width:"100%",padding:"9px 12px",borderRadius:8,border:`1px solid ${T.border}`,background:T.bg,color:T.text,fontSize:13,marginBottom:16,outline:"none"}}>
            <option value="">— No vincular (autónomo) —</option>
            {otsDisponibles.map(o=><option key={o.id} value={o.id}>{o.numero_ot} · {o.tanque_destino}</option>)}
          </select>
        )}
        <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
          <button onClick={()=>handleConfirmarVinculacionOT(null,null)} style={{background:"transparent",border:`1px solid ${T.border}`,color:T.muted,borderRadius:6,padding:"8px 16px",cursor:"pointer",fontWeight:700,fontSize:12}}>Guardar autónomo</button>
          <button onClick={()=>{ if(!otVincSeleccionada) return; const o=(ordenesTrabaio||[]).find(x=>x.id===otVincSeleccionada); handleConfirmarVinculacionOT(otVincSeleccionada,o?.numero_ot); }} disabled={!otVincSeleccionada} style={{background:otVincSeleccionada?T.success:`${T.success}44`,border:"none",color:otVincSeleccionada?"#071422":`${T.success}88`,borderRadius:6,padding:"8px 20px",cursor:otVincSeleccionada?"pointer":"default",fontWeight:700,fontSize:12}}>Vincular a OT</button>
        </div>
      </div>
    </div>
  );
})()}

{modal==="programacion" && (
  <Modal title={form.id ? "Editar Programación" : "Nueva Programación"} onClose={()=>{ setModal(null); setForm({}); }}>
    <Grid cols={2}>
      <Inp label="Fecha" type="date" value={form.fecha||today()} onChange={f("fecha")}/>
      <Sel label="Producto" value={form.producto||""} onChange={f("producto")}>
        <option value="">Seleccionar...</option>
        {[...MATERIAS_PRIMAS,"VLSFO","MGO","HSFO"].map(p=><option key={p}>{p}</option>)}
      </Sel>
      <Sel label="Tipo de Operación" value={form.operacion||""} onChange={f("operacion")}>
        <option value="">Seleccionar...</option>
        <option>DESCARGUE DE CARROTANQUE</option>
        <option>ENTREGA A MOTONAVE</option>
        <option>ENTREGA A CARROTANQUE</option>
        <option>TRASIEGO DE PRODUCTO</option>
        <option>PORTEO</option>
      </Sel>
      <Inp label="Placa / Buque / Referencia" value={form.referencia||""} onChange={f("referencia")}/>
      <Inp label="Volumen Estimado (Gls)" type="number" value={form.volumen||""} onChange={f("volumen")}/>
      <Sel label="Estado" value={form.estado||"Pendiente"} onChange={f("estado")}>
        <option>Pendiente</option>
        <option>En curso</option>
        <option>Completado</option>
        <option>Cancelado</option>
      </Sel>
    </Grid>
    <Inp label="Observaciones" type="text" value={form.observaciones||""} onChange={f("observaciones")}/>
    <div style={{ display:"flex", justifyContent:"flex-end", gap:10, marginTop:16 }}>
      <Btn outline onClick={()=>{ setModal(null); setForm({}); }}>Cancelar</Btn>
      <Btn color={T.orange} disabled={saving} onClick={async ()=>{
        setSaving(true);
        const id = form.id || `PROG-${String(Date.now()).slice(-6)}`;
        const payload = { id, fecha:form.fecha||today(), producto:form.producto||null, operacion:form.operacion||null, referencia:form.referencia||null, volumen:form.volumen?Number(form.volumen):null, estado:form.estado||"Pendiente", observaciones:form.observaciones||null, sede:perfil.sede||null, creado_por:session.user.id };
        const { error } = form.id
          ? await dbCall({ table:"programaciones", op:"update", data:payload, filters:[{col:"id",val:id}] })
          : await dbCall({ table:"programaciones", op:"insert", data:payload });
        setSaving(false);
        if (error) return showToast("Error: "+error, false);
        await loadData();
        setModal(null); setForm({});
      }}>{saving?"Guardando...":form.id ? "Guardar Cambios" : "Registrar"}</Btn>
    </div>
  </Modal>
)}

{/* AUDITORÍA — solo administrador */}
{nav==="auditoria" && perfil?.rol==="administrador" && (()=>{
  const TABLAS = [...new Set(auditLogs.map(l=>l.tabla))].sort();
  const USUARIOS = [...new Set(auditLogs.map(l=>l.usuario_nombre).filter(Boolean))].sort();
  const logs = auditLogs.filter(l=>
    (!auditFiltro.tabla   || l.tabla===auditFiltro.tabla) &&
    (!auditFiltro.accion  || l.accion===auditFiltro.accion) &&
    (!auditFiltro.usuario || l.usuario_nombre===auditFiltro.usuario)
  );
  const accionColor = a => a==="crear"?"#00B894":a==="editar"?T.orange:a==="eliminar"?"#ef4444":T.muted;
  const accionIcon  = a => a==="crear"?"✚":a==="editar"?"✏️":a==="eliminar"?"🗑️":"·";
  return (
  <div style={{ maxWidth:1100 }}>
    <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:22 }}>
      <div>
        <div style={{ fontWeight:800,fontSize:20,color:T.navy }}>Auditoría del Sistema</div>
        <div style={{ fontSize:11,color:T.muted }}>Registro de todas las acciones · {logs.length} eventos</div>
      </div>
      <button onClick={loadAuditLogs} style={{ background:T.navy,border:"none",color:"#fff",borderRadius:6,padding:"7px 16px",cursor:"pointer",fontWeight:700,fontSize:12 }}>↺ Actualizar</button>
    </div>

    {/* Filtros */}
    <div style={{ display:"flex",gap:10,marginBottom:16,flexWrap:"wrap" }}>
      <select value={auditFiltro.tabla} onChange={e=>setAuditFiltro(p=>({...p,tabla:e.target.value}))}
        style={{ padding:"7px 12px",borderRadius:6,border:`1px solid ${T.border}`,background:T.card,color:T.text,fontSize:12 }}>
        <option value="">Todas las tablas</option>
        {TABLAS.map(t=><option key={t} value={t}>{t}</option>)}
      </select>
      <select value={auditFiltro.accion} onChange={e=>setAuditFiltro(p=>({...p,accion:e.target.value}))}
        style={{ padding:"7px 12px",borderRadius:6,border:`1px solid ${T.border}`,background:T.card,color:T.text,fontSize:12 }}>
        <option value="">Todas las acciones</option>
        <option value="crear">Crear</option>
        <option value="editar">Editar</option>
        <option value="eliminar">Eliminar</option>
      </select>
      <select value={auditFiltro.usuario} onChange={e=>setAuditFiltro(p=>({...p,usuario:e.target.value}))}
        style={{ padding:"7px 12px",borderRadius:6,border:`1px solid ${T.border}`,background:T.card,color:T.text,fontSize:12 }}>
        <option value="">Todos los usuarios</option>
        {USUARIOS.map(u=><option key={u} value={u}>{u}</option>)}
      </select>
      {(auditFiltro.tabla||auditFiltro.accion||auditFiltro.usuario) && (
        <button onClick={()=>setAuditFiltro({tabla:"",accion:"",usuario:""})}
          style={{ background:"transparent",border:`1px solid ${T.border}`,color:T.muted,borderRadius:6,padding:"7px 12px",cursor:"pointer",fontSize:12 }}>
          ✕ Limpiar
        </button>
      )}
    </div>

    {auditLoading ? (
      <div style={{ textAlign:"center",color:T.muted,padding:40 }}>Cargando...</div>
    ) : logs.length===0 ? (
      <div style={{ textAlign:"center",color:T.muted,padding:40 }}>Sin registros</div>
    ) : (
      <div style={{ overflowX:"auto" }}>
        <table style={{ width:"100%",borderCollapse:"collapse",fontSize:12 }}>
          <thead>
            <tr style={{ borderBottom:`2px solid ${T.border}` }}>
              {["Fecha / Hora","Acción","Tabla","Registro","Usuario","Detalle"].map(h=>(
                <th key={h} style={{ padding:"8px 12px",textAlign:"left",color:T.muted,fontWeight:700,fontSize:10,textTransform:"uppercase",whiteSpace:"nowrap" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {logs.map((l,i)=>{
              const fecha = l.created_at ? new Date(l.created_at) : null;
              const fechaStr = fecha ? fecha.toLocaleDateString("es-CO",{day:"2-digit",month:"2-digit",year:"numeric"}) : "—";
              const horaStr  = fecha ? fecha.toLocaleTimeString("es-CO",{hour:"2-digit",minute:"2-digit",second:"2-digit"}) : "";
              const cambios = [];
              if (l.datos_antes && l.datos_despues) {
                const keys = [...new Set([...Object.keys(l.datos_antes||{}), ...Object.keys(l.datos_despues||{})])];
                for (const k of keys) {
                  const ant = JSON.stringify(l.datos_antes?.[k]);
                  const nvo = JSON.stringify(l.datos_despues?.[k]);
                  if (ant !== nvo) cambios.push(`${k}: ${ant} → ${nvo}`);
                }
              } else if (l.datos_despues) {
                cambios.push(...Object.entries(l.datos_despues).map(([k,v])=>`${k}: ${JSON.stringify(v)}`));
              }
              return (
                <tr key={l.id||i} style={{ borderBottom:`1px solid ${T.border}`,background:i%2===0?T.card:T.bg }}>
                  <td style={{ padding:"10px 12px",whiteSpace:"nowrap",color:T.muted }}>
                    <div style={{ fontWeight:700,color:T.text }}>{fechaStr}</div>
                    <div style={{ fontSize:10 }}>{horaStr}</div>
                  </td>
                  <td style={{ padding:"10px 12px",whiteSpace:"nowrap" }}>
                    <span style={{ background:`${accionColor(l.accion)}22`,color:accionColor(l.accion),borderRadius:5,padding:"3px 8px",fontWeight:700,fontSize:11 }}>
                      {accionIcon(l.accion)} {(l.accion||"").toUpperCase()}
                    </span>
                  </td>
                  <td style={{ padding:"10px 12px",fontFamily:"monospace",color:T.navy,fontWeight:700 }}>{l.tabla}</td>
                  <td style={{ padding:"10px 12px",fontFamily:"monospace",fontSize:11,color:T.muted }}>{l.registro_id||"—"}</td>
                  <td style={{ padding:"10px 12px",fontWeight:700,color:T.text }}>{l.usuario_nombre||"—"}</td>
                  <td style={{ padding:"10px 12px",maxWidth:320 }}>
                    {cambios.length>0 ? (
                      <ul style={{ margin:0,paddingLeft:16,color:T.muted,fontSize:11 }}>
                        {cambios.slice(0,5).map((c,j)=><li key={j}>{c}</li>)}
                        {cambios.length>5 && <li style={{ color:T.navy }}>+{cambios.length-5} más...</li>}
                      </ul>
                    ) : <span style={{ color:T.muted,fontSize:11 }}>—</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    )}
  </div>
  );
})()}

{/* LIQUIDADOR PLANTA 1 */}
{nav==="liquidador" && (
  <LiquidadorPlanta1
    supabase={supabase}
    session={session}
    perfil={perfil}
    showToast={showToast}
    dbCall={dbCall}
  />
)}

{/* LIQUIDADOR PLANTA 2 */}
{nav==="liquidador_p2" && (
  <LiquidadorPlanta2 supabase={supabase} session={session} perfil={perfil} showToast={showToast} afoCache={afoP2} afoCacheLoading={afoP2Loading}/>
)}

{/* INVENTARIO DIARIO */}
{nav==="inventario_diario" && (
  <InventarioDiario supabase={supabase} session={session} perfil={perfil} showToast={showToast} tanques={tanques} dbCall={dbCall}/>
)}

{/* ═══ MODAL EDITAR OT ═══ */}
{otEditando && (()=>{
  const ed = otEditando;
  const setEd = patch => setOtEditando(p=>({...p,...patch}));
  const TANQUES_LIST = (tanques||[]).map(t=>t.id);
  const guardar = async () => {
    const otActual = (ordenesTrabaio||[]).find(o=>o.id===ed.otId);
    if(!otActual) return;
    await dbCall({ table:"ordenes_trabajo", op:"update", data:{ trasiegos: ed.trasiegos, updated_at: new Date().toISOString() }, filters:[{col:"id",val:ed.otId}] });
    await logAudit({ tabla:"ordenes_trabajo", registro_id:ed.otId, accion:"editar", datos_antes:{ trasiegos:otActual.trasiegos }, datos_despues:{ trasiegos:ed.trasiegos } });
    await loadData();
    setOtEditando(null);
    showToast("OT actualizada");
  };
  return (
    <div style={{ position:"fixed",inset:0,background:"#00000088",zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center" }} onClick={()=>setOtEditando(null)}>
      <div style={{ background:T.card,borderRadius:12,padding:28,width:560,maxWidth:"95vw",maxHeight:"85vh",overflowY:"auto" }} onClick={e=>e.stopPropagation()}>
        <div style={{ fontWeight:800,fontSize:17,color:T.navy,marginBottom:16 }}>Editar OT · Trasiegos</div>

        {/* Filas editables */}
        {ed.trasiegos.length === 0 && (
          <div style={{ color:T.muted,fontSize:13,marginBottom:12 }}>Sin trasiegos. Agrega uno abajo.</div>
        )}
        {ed.trasiegos.map((tr,i)=>{
          const tqOrigen  = tr.origen  ? tanques.find(t=>t.id===tr.origen)  : null;
          const tqDestino = tr.destino ? tanques.find(t=>t.id===tr.destino) : null;
          const yaComprometidoOrigen  = tr.origen  ? ed.trasiegos.slice(0,i).filter(t=>t.origen===tr.origen).reduce((s,t)=>s+Number(t.galones||0),0) : 0;
          const yaComprometidoDestino = tr.destino ? ed.trasiegos.slice(0,i).filter(t=>t.destino===tr.destino).reduce((s,t)=>s+Number(t.galones||0),0) : 0;
          const disponibleOrigen = tqOrigen  ? Math.max(0, Number(tqOrigen.nivel||0) - yaComprometidoOrigen) : null;
          const espacioDisp      = tqDestino ? Math.max(0, Math.round((tqDestino.capacidad||0)*0.9) - (tqDestino.nivel||0) - yaComprometidoDestino) : null;
          const superaOrigen  = tr.galones && disponibleOrigen!=null && Number(tr.galones) > disponibleOrigen;
          const superaDestino = tr.galones && espacioDisp!=null      && Number(tr.galones) > espacioDisp;
          return (
            <div key={i} style={{ marginBottom:10,padding:12,background:T.bg,borderRadius:8,border:`1px solid ${T.border}` }}>
              <div style={{ display:"grid",gridTemplateColumns:"1fr auto 1fr auto",gap:8,alignItems:"end" }}>
                <div>
                  <div style={{ fontSize:10,color:T.muted,fontWeight:600,marginBottom:4 }}>ORIGEN</div>
                  <select value={tr.origen} onChange={e=>{const n=[...ed.trasiegos];n[i]={...n[i],origen:e.target.value};setEd({trasiegos:n});}}
                    style={{ width:"100%",padding:"7px 10px",borderRadius:6,border:`1px solid ${T.border}`,background:T.card,color:T.text,fontSize:12 }}>
                    <option value="">Seleccionar...</option>
                    {TANQUES_LIST.map(t=><option key={t}>{t}</option>)}
                  </select>
                  {tqOrigen && (
                    <div style={{ fontSize:11,marginTop:4,fontWeight:700,color:superaOrigen?T.danger:T.success }}>
                      📦 Disponible: {fmt(disponibleOrigen)} gls
                      {superaOrigen && <span style={{ marginLeft:6 }}>⚠️ Insuficiente</span>}
                    </div>
                  )}
                </div>
                <div>
                  <div style={{ fontSize:10,color:T.muted,fontWeight:600,marginBottom:4 }}>GALONES</div>
                  <input type="number" value={tr.galones} onChange={e=>{const n=[...ed.trasiegos];n[i]={...n[i],galones:e.target.value};setEd({trasiegos:n});}}
                    placeholder="0" style={{ width:90,padding:"7px 10px",borderRadius:6,border:`1px solid ${T.border}`,background:T.card,color:T.text,fontSize:12,outline:"none" }}/>
                </div>
                <div>
                  <div style={{ fontSize:10,color:T.muted,fontWeight:600,marginBottom:4 }}>DESTINO</div>
                  <select value={tr.destino} onChange={e=>{const n=[...ed.trasiegos];n[i]={...n[i],destino:e.target.value};setEd({trasiegos:n});}}
                    style={{ width:"100%",padding:"7px 10px",borderRadius:6,border:`1px solid ${T.border}`,background:T.card,color:T.text,fontSize:12 }}>
                    <option value="">Seleccionar...</option>
                    {TANQUES_LIST.filter(t=>t!==tr.origen).map(t=><option key={t}>{t}</option>)}
                  </select>
                  {tqDestino && (
                    <div style={{ fontSize:11,marginTop:4 }}>
                      {!tr.galones || Number(tr.galones)===0 ? (
                        <button onClick={()=>{const n=[...ed.trasiegos];n[i]={...n[i],galones:String(espacioDisp)};setEd({trasiegos:n});}}
                          style={{ background:`${T.orange}18`,border:`1px solid ${T.orange}55`,color:T.orange,borderRadius:6,padding:"2px 8px",cursor:"pointer",fontWeight:700,fontSize:11 }}>
                          🏷️ Usar espacio libre (90%): {fmt(espacioDisp)} gls
                        </button>
                      ) : (
                        <span style={{ fontWeight:700,color:superaDestino?T.danger:T.orange }}>
                          🏷️ Espacio libre (90%): {fmt(espacioDisp)} gls
                          {superaDestino && <span style={{ marginLeft:6 }}>⚠️ Supera capacidad</span>}
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <button onClick={()=>setEd({trasiegos:ed.trasiegos.filter((_,j)=>j!==i)})}
                  style={{ background:"#ef444418",border:"1px solid #ef444455",color:"#ef4444",borderRadius:6,padding:"7px 10px",cursor:"pointer",fontWeight:700,fontSize:12,alignSelf:"flex-start",marginTop:20 }}>✕</button>
              </div>
            </div>
          );
        })}

        <button onClick={()=>setEd({trasiegos:[...ed.trasiegos,{origen:"",destino:"",galones:"",completado:false}]})}
          style={{ background:"transparent",border:`1px dashed ${T.border}`,color:T.muted,borderRadius:6,padding:"7px 16px",cursor:"pointer",fontSize:12,fontWeight:600,width:"100%",marginBottom:16 }}>
          + Agregar trasiego
        </button>

        <div style={{ display:"flex",gap:10,justifyContent:"flex-end" }}>
          <button onClick={()=>setOtEditando(null)}
            style={{ background:"transparent",border:`1px solid ${T.border}`,color:T.muted,borderRadius:6,padding:"8px 20px",cursor:"pointer",fontWeight:700,fontSize:13 }}>
            Cancelar
          </button>
          <button onClick={guardar}
            style={{ background:T.success,border:"none",color:"#071422",borderRadius:6,padding:"8px 24px",cursor:"pointer",fontWeight:700,fontSize:13 }}>
            Guardar cambios
          </button>
        </div>
      </div>
    </div>
  );
})()}

{/* ═══ MODAL NUEVA OT ═══ */}
{otModal && (()=>{
  const m = otModal;
  const setM = patch => setOtModal(p=>({...p,...patch}));
  const fo = formulaciones.find(f=>f.id===m.formulacionId);
  const foMps = fo?.mps||[];
  const pond = fo ? {api:fo.api_planeado,visc:fo.visc_planeado,azufre:fo.azufre_planeado,agua:fo.agua_planeada,flash:fo.flash_point_planeado} : {};
  const TANQUES_LIST = (tanques||[]).map(t=>t.id);

  const crearOT = async()=>{
    const trasiegos = m.necesitaTrasiego==="si" ? (m.trasiegos||[]).filter(t=>t.origen&&t.destino&&t.galones).map(t=>({...t,completado:false})) : [];
    if(!m.formulacionId && trasiegos.length===0) return showToast("Selecciona una formulación o agrega al menos un trasiego",false);
    setOtSaving(true);
    // Generar número OT
    const countRes = await supabase.from("ordenes_trabajo").select("id",{count:"exact",head:true});
    const num = String((countRes.count||0)+1).padStart(3,"0");
    const numeroOt = `OT-${num}`;
    // Descargues desde mps de formulación
    const descargues = foMps.map(mp=>({
      producto: mp._producto||mp.nombre||"",
      placa: mp._placa||"",
      galones_planeado: Number(mp.galones||0),
      galones_descargado: 0,
      estado: "pendiente",
    })).filter(d=>d.galones_planeado>0);
    const estadoInicial = trasiegos.length>0 ? "TRASIEGOS" : "DESCARGANDO";
    const payload = {
      numero_ot: numeroOt,
      formulacion_id: m.formulacionId||null,
      tipo_operacion: m.tipoOp||"directo",
      tanque_destino: fo?.tanque || (trasiegos.length>0 ? trasiegos.map(t=>t.destino).join(",") : ""),
      estado: estadoInicial,
      trasiegos,
      descargues,
      recirculacion_tiempo_total: Number(m.recircHoras||4)*60,
      sede: perfil?.sede||null,
      creado_por: session.user.id,
      ...(estadoInicial==="DESCARGANDO"?{fecha_inicio_descargue:new Date().toISOString()}:{fecha_inicio_trasiegos:new Date().toISOString()}),
    };
    const {error, data: otCreada} = await dbCall({ table:"ordenes_trabajo", op:"insert", data:payload });
    setOtSaving(false);
    if(error) return showToast("Error: "+error,false);
    await logAudit({ tabla:"ordenes_trabajo", registro_id:otCreada?.id||numeroOt, accion:"crear", datos_despues:{ numero_ot:numeroOt, tipo_operacion:payload.tipo_operacion, trasiegos:payload.trasiegos } });
    await loadData();
    setOtModal(null);
    showToast(`${numeroOt} creada exitosamente`);
  };

  return (
    <div style={{ position:"fixed",inset:0,background:"#00000088",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center" }} onClick={e=>{ if(e.target===e.currentTarget) setOtModal(null); }}>
      <div style={{ background:T.card,borderRadius:14,padding:28,width:"min(700px,95vw)",maxHeight:"90vh",overflowY:"auto",boxShadow:"0 20px 60px #00000066" }}>
        {/* Header con pasos */}
        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:22 }}>
          <div style={{ fontWeight:800,fontSize:17,color:T.navy }}>Nueva Orden de Trabajo</div>
          <button onClick={()=>setOtModal(null)} style={{ background:"none",border:"none",color:T.muted,fontSize:20,cursor:"pointer" }}>✕</button>
        </div>
        <div style={{ display:"flex",gap:6,marginBottom:22 }}>
          {[["1","Trasiegos"],["2","Descargues"],["3","Recirculación"]].map(([n,lbl])=>(
            <div key={n} style={{ flex:1,padding:"7px 10px",borderRadius:8,textAlign:"center",fontSize:11,fontWeight:700,
              background:m.step===Number(n)?T.orange:Number(n)<m.step?`${T.success}22`:T.bg,
              color:m.step===Number(n)?"#fff":Number(n)<m.step?T.success:T.muted,
              border:`1px solid ${m.step===Number(n)?T.orange:Number(n)<m.step?`${T.success}55`:T.border}` }}>
              {Number(n)<m.step?"✅ ":""}{lbl}
            </div>
          ))}
        </div>

        {/* PASO 1 */}
        {m.step===1 && (
          <div>
            {/* Tipo de operación */}
            <div style={{ fontWeight:700,fontSize:13,color:T.text,marginBottom:10 }}>Tipo de operación</div>
            <div style={{ display:"flex",gap:10,marginBottom:20 }}>
              {[{v:"directo",lbl:"Descargue directo",desc:"Carros cisterna → tanque"},{v:"porteo",lbl:"Porteo inter-planta",desc:"Planta 2 → Planta 1 por carros"}].map(({v,lbl,desc})=>(
                <button key={v} onClick={()=>setM({tipoOp:v})}
                  style={{ flex:1,padding:"10px 12px",borderRadius:8,border:`2px solid ${m.tipoOp===v?T.navy:T.border}`,
                    background:m.tipoOp===v?`${T.navy}12`:"transparent",
                    color:m.tipoOp===v?T.navy:T.muted,fontWeight:700,fontSize:12,cursor:"pointer",textAlign:"left" }}>
                  <div>{lbl}</div>
                  <div style={{ fontSize:10,fontWeight:400,marginTop:2,opacity:0.7 }}>{desc}</div>
                </button>
              ))}
            </div>
            <div style={{ fontWeight:700,fontSize:13,color:T.text,marginBottom:14 }}>¿Necesitas trasiegos previos?</div>
            <div style={{ display:"flex",gap:10,marginBottom:18 }}>
              {["si","no"].map(v=>(
                <button key={v} onClick={()=>setM({necesitaTrasiego:v})} style={{ flex:1,padding:"10px",borderRadius:8,border:`2px solid ${m.necesitaTrasiego===v?T.orange:T.border}`,background:m.necesitaTrasiego===v?`${T.orange}18`:"transparent",color:m.necesitaTrasiego===v?T.orange:T.muted,fontWeight:700,fontSize:13,cursor:"pointer",textTransform:"uppercase" }}>{v==="si"?"Sí":"No"}</button>
              ))}
            </div>
            {m.necesitaTrasiego==="si" && (
              <div>
                {(m.trasiegos||[]).map((tr,i)=>{
                  const tqOrigen  = tr.origen  ? tanques.find(t=>t.id===tr.origen)  : null;
                  const tqDestino = tr.destino ? tanques.find(t=>t.id===tr.destino) : null;
                  const yaComprometidoOrigen = tr.origen ? m.trasiegos.slice(0,i).filter(t=>t.origen===tr.origen).reduce((s,t)=>s+Number(t.galones||0),0) : 0;
                  const disponibleOrigen = tqOrigen ? Math.max(0, (tqOrigen.nivel||0) - yaComprometidoOrigen) : null;
                  const yaComprometidoDestino = tr.destino ? m.trasiegos.slice(0,i).filter(t=>t.destino===tr.destino).reduce((s,t)=>s+Number(t.galones||0),0) : 0;
                  const espacioDisp = tqDestino ? Math.max(0, Math.round((tqDestino.capacidad||0) * 0.9) - (tqDestino.nivel||0) - yaComprometidoDestino) : null;
                  return (
                  <div key={i} style={{ marginBottom:10,padding:12,background:T.bg,borderRadius:8,border:`1px solid ${T.border}` }}>
                    <div style={{ display:"grid",gridTemplateColumns:"1fr auto 1fr auto",gap:8,alignItems:"end" }}>
                      <div>
                        <div style={{ fontSize:10,color:T.muted,fontWeight:600,marginBottom:4 }}>ORIGEN</div>
                        <select value={tr.origen} onChange={e=>{ const n=[...m.trasiegos];n[i]={...n[i],origen:e.target.value};setM({trasiegos:n}); }} style={{ width:"100%",padding:"7px 10px",borderRadius:6,border:`1px solid ${T.border}`,background:T.card,color:T.text,fontSize:12 }}>
                          <option value="">Seleccionar...</option>
                          {TANQUES_LIST.map(t=><option key={t}>{t}</option>)}
                        </select>
                      </div>
                      <div>
                        <div style={{ fontSize:10,color:T.muted,fontWeight:600,marginBottom:4 }}>GALONES</div>
                        <input type="number" value={tr.galones} onChange={e=>{ const n=[...m.trasiegos];n[i]={...n[i],galones:e.target.value};setM({trasiegos:n}); }} placeholder="0" style={{ width:90,padding:"7px 10px",borderRadius:6,border:`1px solid ${T.border}`,background:T.card,color:T.text,fontSize:12,outline:"none" }}/>
                      </div>
                      <div>
                        <div style={{ fontSize:10,color:T.muted,fontWeight:600,marginBottom:4 }}>DESTINO</div>
                        <select value={tr.destino} onChange={e=>{ const n=[...m.trasiegos];n[i]={...n[i],destino:e.target.value};setM({trasiegos:n}); }} style={{ width:"100%",padding:"7px 10px",borderRadius:6,border:`1px solid ${T.border}`,background:T.card,color:T.text,fontSize:12 }}>
                          <option value="">Seleccionar...</option>
                          {TANQUES_LIST.filter(t=>t!==tr.origen).map(t=><option key={t}>{t}</option>)}
                        </select>
                      </div>
                      <button onClick={()=>setM({trasiegos:m.trasiegos.filter((_,j)=>j!==i)})} style={{ background:"#ef444418",border:"1px solid #ef444455",color:"#ef4444",borderRadius:6,padding:"7px 10px",cursor:"pointer",fontWeight:700,fontSize:12,alignSelf:"flex-end" }}>✕</button>
                    </div>
                    {(tqOrigen || tqDestino) && (
                      <div style={{ display:"grid",gridTemplateColumns:"1fr auto 1fr auto",gap:8,marginTop:6 }}>
                        <div style={{ fontSize:11,color:T.navy,fontWeight:700,paddingLeft:2 }}>
                          {tqOrigen
                            ? <span>📦 Disponible: <span style={{ color: disponibleOrigen < (tqOrigen.nivel||0) ? T.orange : T.success }}>{fmt(Math.round(disponibleOrigen))} gls</span>{tqOrigen.producto ? <span style={{ color:T.muted,fontWeight:400 }}> · {tqOrigen.producto}</span> : ""}</span>
                            : null}
                        </div>
                        <div/>
                        <div style={{ fontSize:11,color:T.navy,fontWeight:700,paddingLeft:2 }}>
                          {tqDestino
                            ? <span>🏷️ Espacio libre (90%): <span style={{ color: espacioDisp > 0 ? T.orange : T.danger }}>{fmt(Math.round(espacioDisp))} gls</span></span>
                            : null}
                        </div>
                        <div/>
                      </div>
                    )}
                  </div>
                  );
                })}
                <button onClick={()=>setM({trasiegos:[...m.trasiegos,{origen:"",destino:"",galones:""}]})} style={{ background:"transparent",border:`1px dashed ${T.border}`,color:T.muted,borderRadius:6,padding:"7px 16px",cursor:"pointer",fontSize:12,fontWeight:600,width:"100%",marginBottom:14 }}>+ Agregar trasiego</button>
              </div>
            )}
            <div style={{ display:"flex",justifyContent:"flex-end" }}>
              <button onClick={()=>setM({step: m.tipoOp==="porteo" ? 3 : 2})}
                style={{ background:T.orange,border:"none",color:"#fff",borderRadius:6,padding:"9px 22px",cursor:"pointer",fontWeight:700,fontSize:13 }}>
                {m.tipoOp==="porteo" ? "Siguiente: Recirculación →" : "Siguiente: Descargues →"}
              </button>
            </div>
          </div>
        )}

        {/* PASO 2 */}
        {m.step===2 && (
          <div>
            <div style={{ fontWeight:700,fontSize:13,color:T.text,marginBottom:12 }}>Selecciona la formulación</div>
            <select value={m.formulacionId} onChange={e=>setM({formulacionId:e.target.value})} style={{ width:"100%",padding:"9px 12px",borderRadius:8,border:`1px solid ${T.border}`,background:T.card,color:T.text,fontSize:13,marginBottom:16,outline:"none" }}>
              <option value="">— Seleccionar formulación —</option>
              {formulaciones.filter(f=>(f.estado==="PLANEADA"||!f.estado) && !(ordenesTrabaio||[]).some(o=>o.formulacion_id===f.id)).map(f=><option key={f.id} value={f.id}>{f.fecha} · {f.tanque} · {f.producto} ({fmt(Number(f.total_galones||0))} gls)</option>)}
            </select>
            {fo && (
              <div style={{ background:T.bg,borderRadius:10,padding:14,border:`1px solid ${T.border}`,marginBottom:16 }}>
                <div style={{ fontSize:11,color:T.muted,fontWeight:700,marginBottom:10,textTransform:"uppercase" }}>Desglose de Descargues — Tanque {fo.tanque}</div>
                {(() => {
                  const mpsFiltrados = foMps.filter(mp=>Number(mp.galones||0)>0);
                  const descPrev = mpsFiltrados.map(mp=>({ producto: mp._producto||mp.nombre||"", placa: mp._placa||mp.nombre||"", galones_planeado: Number(mp.galones||0), galones_descargado:0 }));
                  const grupos = agruparDescarguesPorProducto(descPrev);
                  return (
                    <>
                      <div style={{ display:"grid",gridTemplateColumns:"2fr 1fr 0.8fr 0.3fr",gap:8,paddingBottom:6,borderBottom:`1px solid ${T.border}`,fontSize:10,fontWeight:600,color:T.muted,marginBottom:6 }}>
                        <div>PRODUCTO</div><div style={{ textAlign:"right" }}>GLS PLANEADO</div><div style={{ textAlign:"right" }}>CARROS</div><div></div>
                      </div>
                      {grupos.map(g => (
                        <div key={g.productoBase} style={{ marginBottom:4 }}>
                          <div onClick={()=>toggleOtExpandir("prev_"+g.productoBase)} style={{ display:"grid",gridTemplateColumns:"2fr 1fr 0.8fr 0.3fr",gap:8,padding:"8px 10px",background:T.card,borderRadius:6,cursor:"pointer",borderLeft:`3px solid ${T.orange}`,fontSize:12 }}
                            onMouseEnter={e=>e.currentTarget.style.background=T.bg}
                            onMouseLeave={e=>e.currentTarget.style.background=T.card}
                          >
                            <div style={{ fontWeight:700,color:T.text }}>{g.productoBase}</div>
                            <div style={{ textAlign:"right",color:T.success,fontWeight:700 }}>{fmtNum(g.galones_planeado)}</div>
                            <div style={{ textAlign:"right",color:T.muted }}>{g.carrotanques}</div>
                            <div style={{ textAlign:"center",color:T.muted }}>{otExpandidos["prev_"+g.productoBase]?"▲":"▼"}</div>
                          </div>
                          {otExpandidos["prev_"+g.productoBase] && (
                            <div style={{ background:T.bg,padding:"6px 12px",marginTop:2,borderRadius:6,fontSize:10,color:T.muted,borderLeft:`3px solid ${T.orange}` }}>
                              {g.plancas.map((p,pi)=>(
                                <div key={pi} style={{ display:"flex",justifyContent:"space-between",marginBottom:2,paddingLeft:8 }}>
                                  <span>├─ {p.placa||"—"} <span style={{ color:T.muted }}>({p.producto_original})</span></span>
                                  <span style={{ color:T.success }}>{fmtNum(p.galones)} gls</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                      <div style={{ display:"grid",gridTemplateColumns:"2fr 1fr 0.8fr 0.3fr",gap:8,padding:"8px 10px",background:`${T.orange}08`,borderRadius:6,marginTop:6,fontWeight:800,fontSize:12,borderTop:`1px solid ${T.border}` }}>
                        <div style={{ color:T.text }}>TOTAL</div>
                        <div style={{ textAlign:"right",color:T.success }}>{fmt(Number(fo.total_galones||0))}</div>
                        <div style={{ textAlign:"right",color:T.muted }}>{(Number(fo.total_galones||0)/9300).toFixed(1)} carros</div>
                        <div></div>
                      </div>
                    </>
                  );
                })()}
                {fo.producto==="VLSFO" && (
                  <div style={{ marginTop:10,display:"flex",gap:8,flexWrap:"wrap" }}>
                    {[["Azufre",Number(fo.azufre_planeado||0).toFixed(4)+"%",Number(fo.azufre_planeado||0)<=0.5],["Agua",Number(fo.agua_planeada||0).toFixed(4)+"%",true],["Flash",Number(fo.flash_point_planeado||0).toFixed(1)+"°C",Number(fo.flash_point_planeado||0)>=60]].map(([lbl,val,ok])=>(
                      <span key={lbl} style={{ fontSize:10,fontWeight:700,padding:"2px 8px",borderRadius:6,background:ok?`${T.success}18`:`${T.danger}18`,border:`1px solid ${ok?`${T.success}55`:`${T.danger}55`}`,color:ok?T.success:T.danger }}>{lbl}: {val} {ok?"✅":"🔴"}</span>
                    ))}
                  </div>
                )}
              </div>
            )}
            <div style={{ display:"flex",justifyContent:"space-between" }}>
              <button onClick={()=>setM({step:1})} style={{ background:"transparent",border:`1px solid ${T.border}`,color:T.muted,borderRadius:6,padding:"9px 18px",cursor:"pointer",fontWeight:700,fontSize:13 }}>← Atrás</button>
              <button onClick={()=>setM({step:3})} style={{ background:T.orange,border:"none",color:"#fff",borderRadius:6,padding:"9px 22px",cursor:"pointer",fontWeight:700,fontSize:13 }}>Siguiente: Recirculación →</button>
            </div>
          </div>
        )}

        {/* PASO 3 */}
        {m.step===3 && (
          <div>
            <div style={{ fontWeight:700,fontSize:13,color:T.text,marginBottom:14 }}>Tanque destino: <span style={{ color:T.orange }}>{fo?.tanque||"—"}</span></div>
            <div style={{ marginBottom:18 }}>
              <div style={{ fontSize:11,color:T.muted,fontWeight:600,marginBottom:6 }}>TIEMPO DE RECIRCULACIÓN (horas)</div>
              <input type="number" min={1} max={24} value={m.recircHoras} onChange={e=>setM({recircHoras:e.target.value})} style={{ width:100,padding:"9px 14px",borderRadius:8,border:`2px solid ${T.orange}`,background:T.card,color:T.text,fontSize:18,fontWeight:700,outline:"none",textAlign:"center" }}/>
              <span style={{ marginLeft:10,fontSize:12,color:T.muted }}>= {Number(m.recircHoras||4)*60} minutos</span>
            </div>
            {fo && (
              <div style={{ background:T.bg,borderRadius:10,padding:14,border:`1px solid ${T.border}`,marginBottom:18 }}>
                <div style={{ fontSize:11,color:T.muted,fontWeight:700,marginBottom:10 }}>ANÁLISIS PONDERADO PLANEADO</div>
                <div style={{ display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:8 }}>
                  {[["API",fo.api_planeado,"°"],["Visc",fo.visc_planeado," cSt"],["Azufre",fo.azufre_planeado,"%"],["Agua",fo.agua_planeada,"%"],["Flash",fo.flash_point_planeado,"°C"]].map(([lbl,val,u])=>(
                    <div key={lbl} style={{ background:T.card,borderRadius:8,padding:"10px",border:`1px solid ${T.border}`,textAlign:"center" }}>
                      <div style={{ fontSize:9,color:T.muted,fontWeight:600,marginBottom:3 }}>{lbl}</div>
                      <div style={{ fontSize:15,fontWeight:800,color:T.text }}>{Number(val||0).toFixed(2)}{u}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div style={{ display:"flex",justifyContent:"space-between" }}>
              <button onClick={()=>setM({step:2})} style={{ background:"transparent",border:`1px solid ${T.border}`,color:T.muted,borderRadius:6,padding:"9px 18px",cursor:"pointer",fontWeight:700,fontSize:13 }}>← Atrás</button>
              <button onClick={crearOT} disabled={otSaving} style={{ background:T.success,border:"none",color:"#071422",borderRadius:6,padding:"9px 22px",cursor:"pointer",fontWeight:800,fontSize:13 }}>{otSaving?"Creando...":"Crear Orden de Trabajo"}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
})()}

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
            <div style={{position:"absolute",top:"100%",left:0,right:0,background:T.card,border:`1px solid ${T.border}`,borderTop:"none",borderRadius:"0 0 10px 10px",zIndex:50,overflow:"hidden",boxShadow:"0 8px 24px #0002"}}>
              {matches.map(v=>(
                <div key={v.id} onClick={()=>setForm(p=>({...p,viaje_id:v.id,_busqueda:undefined}))}
                  style={{padding:"10px 14px",cursor:"pointer",display:"grid",gridTemplateColumns:"auto 1fr auto",gap:"0 12px",alignItems:"center",borderBottom:`1px solid ${T.border}`,transition:"background 0.1s"}}
                  onMouseEnter={e=>e.currentTarget.style.background=T.bg}
                  onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                  <span style={{background:`${T.orange}18`,border:`1px solid ${T.orange}44`,borderRadius:6,padding:"3px 9px",color:T.orange,fontWeight:700,fontSize:12,letterSpacing:1}}>{v.placa}</span>
                  <span style={{color:T.text,fontSize:12}}>{v.producto}</span>
                  <span style={{color:T.muted,fontSize:11}}>{v.fecha}</span>
                </div>
              ))}
            </div>
          );
        })()}
      </div>
      {selViaje && (
        <div style={{background:T.bg,border:`1px solid ${T.border}`,borderRadius:10,padding:"12px 16px",marginBottom:14,fontSize:12,display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
          <div><span style={{color:T.muted}}>Placa: </span><b style={{color:T.orange}}>{selViaje.placa}</b></div>
          <div><span style={{color:T.muted}}>Producto: </span><span style={{color:T.text}}>{selViaje.producto}</span></div>
          <div><span style={{color:T.muted}}>Transportadora: </span><span style={{color:T.text}}>{selViaje.transportadora}</span></div>
          <div><span style={{color:T.muted}}>F. Cargue: </span><span style={{color:T.text}}>{selViaje.fecha}</span></div>
          <div><span style={{color:T.muted}}>Guía: </span><span style={{color:T.text}}>{selViaje.guia||"—"}</span></div>
          <div><span style={{color:T.muted}}>Conductor: </span><span style={{color:T.text}}>{selViaje.conductor||"—"}</span></div>
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
        // Turno global: máximo turno_planta entre todos los carros activos (En Planta) + 1
        const {data:turnos} = await supabase.from("viajes").select("turno_planta").eq("estado","En Planta").not("turno_planta","is",null);
        const maxTurno = turnos&&turnos.length>0 ? Math.max(...turnos.map(t=>t.turno_planta||0)) : 0;
        const {error} = await dbCall({ table:"viajes", op:"update", data:{
          fecha_llegada: form.fecha_llegada,
          observacion: form.observacion||null,
          estado: "En Planta",
          turno_planta: maxTurno + 1,
        }, filters:[{col:"id",val:form.viaje_id}] });
        setSaving(false);
        if(error){showToast("Error: "+error,false);return;}
        await loadData();
        setModal(null); setForm({});
        setNav("listado_planta");
        showToast(`✅ ${viajeTarget?.placa} · Turno #${maxTurno+1}`,true);
      }}>{saving?"Registrando...":"Registrar en Planta"}</Btn>
    </Modal>
  );
})()}

{/* GESTIONAR USUARIO — modal completo */}
{editUsuario && (()=>{
  const MODS = ["viajes","tiquetes","pbs","cmt","tanques","despachos","trazabilidad"];
  const ACCIONES = ["ver","crear","editar","eliminar"];
  const COLOR_ACCION = {ver:T.orange,crear:T.success,editar:T.orange,eliminar:T.danger};
  const cedula = editUsuario.cedula || (editUsuario.email||"").replace("@quimibuques.com","");
  return (
    <Modal title={`Gestionar Usuario — ${editUsuario.nombre}`} onClose={()=>setEditUsuario(null)} wide inline>
      {/* Cédula destacada */}
      <div style={{background:T.bg,border:`1px solid ${T.border}`,borderRadius:8,padding:"10px 16px",marginBottom:16,display:"flex",alignItems:"center",gap:12}}>
        <span style={{fontSize:11,fontWeight:700,color:T.muted,textTransform:"uppercase",letterSpacing:1}}>Cédula:</span>
        <span style={{fontSize:15,fontWeight:900,color:T.navy,letterSpacing:1}}>{cedula||"—"}</span>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:18}}>
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
          <Lbl>Planta(s)</Lbl>
          <div style={{display:"flex",gap:12}}>
            {PLANTAS.map(pl=>{
              const plantas = Array.isArray(editUsuario.plantas) ? editUsuario.plantas : [editUsuario.planta||"PLANTA 1"];
              const checked = plantas.includes(pl);
              return (
                <label key={pl} onClick={()=>{
                  const prev = Array.isArray(editUsuario.plantas) ? editUsuario.plantas : [editUsuario.planta||"PLANTA 1"];
                  const next = checked ? prev.filter(p=>p!==pl) : [...prev, pl];
                  setEditUsuario(u=>({...u, plantas: next.length ? next : [pl], planta: next[0]||pl}));
                }} style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",padding:"8px 16px",borderRadius:6,border:`2px solid ${checked?T.orange:T.border}`,background:checked?`${T.orange}15`:T.card,userSelect:"none"}}>
                  <div style={{width:18,height:18,borderRadius:4,border:`2px solid ${checked?T.orange:T.border}`,background:checked?T.orange:"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                    {checked&&<span style={{color:"#fff",fontSize:12,fontWeight:900,lineHeight:1}}>✓</span>}
                  </div>
                  <span style={{fontSize:13,fontWeight:700,color:checked?T.orange:T.text}}>{pl}</span>
                </label>
              );
            })}
          </div>
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
          <Btn color={editUsuario.activo===false?T.success:T.orange} sm onClick={async()=>{
            const desactivar = editUsuario.activo !== false;
            const label = desactivar ? "deshabilitar" : "habilitar";
            if (!confirm(`¿${label.charAt(0).toUpperCase()+label.slice(1)} a ${editUsuario.nombre}?`)) return;
            const ban = desactivar ? "876600h" : "none";
            const {error:e1} = await authAdminCall({ op:"updateUser", userId:editUsuario.id, data:{ban_duration: ban} });
            if (e1) return showToast("Error auth: "+e1, false);
            const {error:e2} = await dbCall({ table:"perfiles", op:"update", data:{activo: !desactivar}, filters:[{col:"id",val:editUsuario.id}] });
            if (e2) return showToast("Error perfil: "+e2, false);
            await loadData(); setEditUsuario(null);
            showToast(`Usuario ${editUsuario.nombre} ${desactivar?"deshabilitado":"habilitado"}`);
          }}>{editUsuario.activo===false ? "Habilitar" : "Deshabilitar"}</Btn>
          <Btn color={T.danger} sm onClick={async()=>{
            if (!confirm(`¿Eliminar a ${editUsuario.nombre}? Esta acción no se puede deshacer.`)) return;
            const {error:e1} = await dbCall({ table:"perfiles", op:"delete", filters:[{col:"id",val:editUsuario.id}] });
            if (e1) return showToast("Error perfil: "+e1, false);
            const {error:e2} = await authAdminCall({ op:"deleteUser", userId:editUsuario.id });
            if (e2) return showToast("Error auth: "+e2, false);
            await loadData(); setEditUsuario(null);
            showToast(`Usuario ${editUsuario.nombre} eliminado`);
          }}>Eliminar</Btn>
        </div>
        <div style={{display:"flex",gap:10}}>
          <Btn outline onClick={()=>setEditUsuario(null)}>Cancelar</Btn>
          <Btn color={T.orange} disabled={saving} onClick={async()=>{
            setSaving(true);
            const plantasArr = Array.isArray(editUsuario.plantas) ? editUsuario.plantas : [editUsuario.planta||"PLANTA 1"];
            const plantaGuardar = plantasArr.join(",") || "PLANTA 1";
            const {error} = await dbCall({ table:"perfiles", op:"update", data:{ rol:editUsuario.rol, planta:plantaGuardar, permisos:permsEdit }, filters:[{col:"id",val:editUsuario.id}] });
            setSaving(false);
            if (error) return showToast("Error: "+error, false);
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
        const {data:newUser, error} = await authAdminCall({ op:"createUser", data:{
          email:emailFinal, password:form.password, email_confirm:true,
          user_metadata:{nombre:form.nombre, rol:form.rol, planta:form.planta, sede:form.sede||"MALAMBO", cedula:form.cedula}
        }});
        if (error) {
          if ((error||"").includes("already been registered")) {
            const {data:list} = await authAdminCall({ op:"listUsers" });
            const existing = (list?.users||[]).find(u=>u.email===emailFinal);
            if (!existing) { setSaving(false); return showToast("Error: cédula ya registrada", false); }
            await authAdminCall({ op:"updateUser", userId:existing.id, data:{
              password:form.password, email_confirm:true,
              user_metadata:{nombre:form.nombre, rol:form.rol, planta:form.planta, sede:form.sede||"MALAMBO", cedula:form.cedula}
            }});
            userId = existing.id;
          } else { setSaving(false); return showToast("Error: "+error, false); }
        } else { userId = newUser.user.id; }
        const {error:e2} = await dbCall({ table:"perfiles", op:"upsert", data:{
          id:userId, nombre:form.nombre, email:emailFinal,
          rol:form.rol, planta:form.planta||"PLANTA 1", sede:form.sede||"MALAMBO",
          cedula:form.cedula, activo:true, permisos:{}
        }});
        setSaving(false);
        if (e2) return showToast("Error perfil: "+e2, false);
        await loadData(); setModal(null); setForm({});
        showToast(`Usuario ${form.nombre} creado · Cédula: ${form.cedula}`);
      }}>{saving?"Creando...":"Crear Usuario"}</Btn>
    </div>
  </Modal>
  );
})()}

        </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}