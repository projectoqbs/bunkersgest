import React, { useState, useEffect } from "react";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as XLSX from "xlsx";

// CSS global: todos los inputs de texto en mayúsculas
const _style = document.createElement("style");
_style.textContent = `input[type="text"], input:not([type]) { text-transform: uppercase !important; }`;
document.head.appendChild(_style);

// ─── SUPABASE ─────────────────────────────────────────────────────────────────
const SUPABASE_URL = "https://pahulcaneuzfiknrzlbc.supabase.co";
const SUPABASE_KEY = "sb_publishable_6A3JvUT-O5UpP5FAYUIKaA_6-Xihr7N";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

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
  administrador: { label:"Administrador", color:"#ff7eb3", icon:"👑" },
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
  logistica:   ["dashboard","viajes","trazabilidad"],
  laboratorio: ["dashboard","tiquetes","trazabilidad"],
  operaciones: ["dashboard","pbs","trazabilidad"],
  coordinador: ["dashboard","cmt","tanques","trazabilidad"],
  despacho:    ["dashboard","despacho","trazabilidad"],
  administrador:    ["dashboard","viajes","tiquetes","pbs","cmt","tanques","despacho","trazabilidad","usuarios"],
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
  "Hora exacta del inicio y fin de las operaciones",
  "Una vez estabilizado el sistema, registre RPM y presión del manómetro.",
];

const TIPO_COLOR = { materia_prima:"#f59e0b", mezcla:"#00b4ff", terminado:"#00e5a0" };
const TIPO_LABEL = { materia_prima:"Mat. Prima", mezcla:"Mezcla/Prod.", terminado:"Terminado" };
const fmt = n => Number(n||0).toLocaleString("es-CO");
const today = () => new Date().toISOString().slice(0,10);
const genId = (prefix, list) => `${prefix}-${String((list?.length||0)+1).padStart(3,"0")}`;

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
function Badge({ label, color }) {
  return <span style={{ fontSize:10, fontWeight:700, color, background:color+"22", padding:"2px 10px", borderRadius:20, whiteSpace:"nowrap" }}>{label}</span>;
}
function Card({ children, style }) {
  return <div style={{ background:"#0f1e2e", border:"1px solid #ffffff0d", borderRadius:16, padding:20, ...style }}>{children}</div>;
}
function Lbl({ children }) {
  return <div style={{ fontSize:10, color:"#6b8fa8", textTransform:"uppercase", letterSpacing:1.2, marginBottom:5, fontFamily:"monospace" }}>{children}</div>;
}
function Inp({ label, type="text", onChange, ...p }) {
  const isText = !["date","time","number","email","password"].includes(type);
  const handleChange = onChange ? e => {
    if (isText) { e.target.value = e.target.value.toUpperCase(); }
    onChange(e);
  } : undefined;
  return (
    <div style={{ marginBottom:12 }}>
      {label && <Lbl>{label}</Lbl>}
      <input type={type} onChange={handleChange} {...p} style={{ width:"100%", background:"#162535", border:"1px solid #ffffff14", borderRadius:8, padding:"8px 12px", color:"#dff0f8", fontSize:13, fontFamily:"monospace", outline:"none", boxSizing:"border-box", textTransform: isText?"uppercase":"none" }} />
    </div>
  );
}
function Sel({ label, children, ...p }) {
  return (
    <div style={{ marginBottom:12 }}>
      {label && <Lbl>{label}</Lbl>}
      <select {...p} style={{ width:"100%", background:"#162535", border:"1px solid #ffffff14", borderRadius:8, padding:"8px 12px", color:"#dff0f8", fontSize:13, fontFamily:"monospace", outline:"none", boxSizing:"border-box" }}>
        {children}
      </select>
    </div>
  );
}
function Btn({ children, color="#00e5a0", outline, sm, onClick, disabled, type="button" }) {
  return (
    <button type={type} disabled={disabled} onClick={onClick} style={{ background:outline?"transparent":color, color:outline?color:"#071422", border:`1.5px solid ${color}`, borderRadius:8, padding:sm?"6px 14px":"10px 20px", fontFamily:"monospace", fontWeight:700, fontSize:sm?11:13, cursor:disabled?"not-allowed":"pointer", opacity:disabled?0.5:1, whiteSpace:"nowrap" }}>
      {children}
    </button>
  );
}
function Modal({ title, onClose, children, wide }) {
  return (
    <div style={{ position:"fixed", inset:0, background:"#000000e0", zIndex:1000, display:"flex", alignItems:"flex-start", justifyContent:"center", padding:20, overflowY:"auto" }}>
      <div style={{ background:"#0c1a28", border:"1px solid #ffffff18", borderRadius:20, padding:28, width:"100%", maxWidth:wide?780:520, margin:"auto" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:22 }}>
          <span style={{ fontSize:16, fontWeight:800, color:"#dff0f8", fontFamily:"'Syne',sans-serif" }}>{title}</span>
          <button onClick={onClose} style={{ background:"none", border:"none", color:"#6b8fa8", fontSize:20, cursor:"pointer" }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}
function Grid({ cols=2, children }) {
  return <div style={{ display:"grid", gridTemplateColumns:`repeat(${cols},1fr)`, gap:12 }}>{children}</div>;
}
function Section({ title, color="#6b8fa8", children }) {
  return (
    <div style={{ marginBottom:18 }}>
      <div style={{ fontSize:11, fontWeight:700, color, letterSpacing:1, textTransform:"uppercase", marginBottom:10, paddingBottom:6, borderBottom:`1px solid ${color}33` }}>{title}</div>
      {children}
    </div>
  );
}
function Stat({ label, value, color, sub }) {
  return (
    <Card style={{ borderLeft:`3px solid ${color}` }}>
      <Lbl>{label}</Lbl>
      <div style={{ fontSize:22, fontWeight:800, color, fontFamily:"'Syne',sans-serif" }}>{value}</div>
      {sub && <div style={{ fontSize:10, color:"#6b8fa8", marginTop:2 }}>{sub}</div>}
    </Card>
  );
}
function Table({ cols, rows, emptyMsg }) {
  return (
    <div style={{ background:"#0f1e2e", borderRadius:12, border:"1px solid #ffffff0d" }}>
      <table style={{ width:"100%", borderCollapse:"collapse", minWidth:500 }}>
        <thead><tr style={{ background:"#162535" }}>{cols.map(c=><th key={c} style={{ padding:"10px 14px", textAlign:"left", fontSize:10, color:"#6b8fa8", letterSpacing:1, textTransform:"uppercase", fontFamily:"monospace", whiteSpace:"nowrap" }}>{c}</th>)}</tr></thead>
        <tbody>
          {rows.length===0
            ? <tr><td colSpan={cols.length} style={{ padding:20, textAlign:"center", color:"#6b8fa8", fontSize:12 }}>{emptyMsg||"Sin registros"}</td></tr>
            : rows.map((r,i)=><tr key={i} style={{ borderTop:"1px solid #ffffff07" }}>{r.map((cell,j)=><td key={j} style={{ padding:"9px 14px", fontSize:12, color:"#cde4f0", fontFamily:"monospace", whiteSpace:"nowrap" }}>{cell}</td>)}</tr>)
          }
        </tbody>
      </table>
    </div>
  );
}
function Spinner() {
  return <div style={{ width:28, height:28, border:"3px solid #ffffff18", borderTop:"3px solid #00e5a0", borderRadius:"50%", animation:"spin 0.8s linear infinite" }} />;
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const [session, setSession] = useState(null);
  const [perfil, setPerfil] = useState(null);
  const [loading, setLoading] = useState(true);
  const [nav, setNav] = useState("dashboard");
  const [labOpen, setLabOpen] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [navHovered, setNavHovered] = useState(null);

  // Data
  const [tanques, setTanques] = useState([]);
  const [viajes, setViajes] = useState([]);
  const [tiquetes, setTiquetes] = useState([]);
  const [pbsList, setPbsList] = useState([]);
  const [cmts, setCmts] = useState([]);
  const [despachos, setDespachos] = useState([]);
    const [perfiles, setPerfiles] = useState([]);
    const [permisosRoles, setPermisosRoles] = useState([]);

  // UI
  const [modal, setModal] = useState(null);
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
  const [viajesFiltroEstado, setViajesFiltroEstado] = useState("");
  const [viajesFiltroProducto, setViajesFiltroProducto] = useState("");
  const [viajesFiltroFechaD, setViajesFiltroFechaD] = useState("");
  const [viajesFiltroFechaH, setViajesFiltroFechaH] = useState("");
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

  const cedulaToEmail = (cedula) => cedula.includes("@") ? cedula : `${cedula}@qbs.internal`;

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
    setNav("dashboard");
  }

  // ── GUARDAR DATOS ──
  async function guardarViaje(e) {
    e.preventDefault(); setSaving(true);
    if (form.id) {
      const {error} = await supabase.from("viajes").update({
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
      const {error} = await supabase.from("viajes").insert([{
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
    const aprueba = Number(form.agua_destilacion)<=1.0 && Number(form.flash_point)>=60;
    const pesoNetoQBS = Number(form.peso_ingreso||0)-Number(form.peso_salida||0);
    if (form.id) {
      const {error} = await supabase.from("tiquetes").update({
        ...form,
        peso_neto_qbs:pesoNetoQBS,
        api_reportado:Number(form.api_reportado), api_observado:Number(form.api_observado),
        api_corregido:Number(form.api_corregido), factor_conversion:Number(form.factor_conversion), factor_tabla13:Number(form.factor_tabla13||0), azufre:Number(form.azufre||0), tsa:Number(form.tsa||0), temp_observada_f:Number(form.temp_observada_f||0),
        temp_observada:Number(form.temp_observada||0),
        peso_ingreso:Number(form.peso_ingreso), peso_salida:Number(form.peso_salida),
        galones_reportados:Number(form.galones_reportados), galones_recibidos:Number(form.galones_recibidos),
        agua_destilacion:Number(form.agua_destilacion), flash_point:Number(form.flash_point),
        viscosidad:Number(form.viscosidad), autoriza:aprueba,
        autoriza_nombre:perfil.nombre, resultado:aprueba?"APROBADO":"RECHAZADO",
      }).eq("id", form.id);
      if (!error && form.viaje_id) {
        await supabase.from("viajes").update({estado:aprueba?"En Planta":"Rechazado"}).eq("id",form.viaje_id);
      }
      setSaving(false);
      if (error) return showToast("Error: "+error.message,false);
      await loadData(); setModal(null); setForm({});
      showToast(`Tiquete ${form.id} actualizado — ${aprueba?"APROBADO":"RECHAZADO"}`);
    } else {
      const id = `TQ-${String(tiquetes.length+1+19571).padStart(5,"0")}`;
      const {error} = await supabase.from("tiquetes").insert([{
        id, viaje_id:form.viaje_id, fecha:today(), ...form,
        peso_neto_qbs:pesoNetoQBS,
        api_reportado:Number(form.api_reportado), api_observado:Number(form.api_observado),
        api_corregido:Number(form.api_corregido), factor_conversion:Number(form.factor_conversion), factor_tabla13:Number(form.factor_tabla13||0), azufre:Number(form.azufre||0), tsa:Number(form.tsa||0), temp_observada_f:Number(form.temp_observada_f||0),
        temp_observada:Number(form.temp_observada||0),
        peso_ingreso:Number(form.peso_ingreso), peso_salida:Number(form.peso_salida),
        galones_reportados:Number(form.galones_reportados), galones_recibidos:Number(form.galones_recibidos),
        agua_destilacion:Number(form.agua_destilacion), flash_point:Number(form.flash_point),
        viscosidad:Number(form.viscosidad), autoriza:aprueba,
        autoriza_nombre:perfil.nombre, resultado:aprueba?"APROBADO":"RECHAZADO",
        sede: viajes.find(v=>v.id===form.viaje_id)?.sede || perfil.sede || "MALAMBO",
        creado_por:session.user.id
      }]);
      if (!error && form.viaje_id) {
        await supabase.from("viajes").update({estado:aprueba?"En Planta":"Rechazado", tiquete_id:id}).eq("id",form.viaje_id);
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
      const {error} = await supabase.from("pbs").update({
        ...form, checklist:pbsChecklist,
      }).eq("id", form.id);
      setSaving(false);
      if (error) return showToast("Error: "+error.message,false);
      await loadData(); setModal(null); setForm({}); setPbsChecklist(Array(27).fill(""));
      showToast(`PBS ${form.id} actualizado`);
    } else {
      const id = `PBS-${String(pbsList.length+1+19454).padStart(5,"0")}`;
      const {error} = await supabase.from("pbs").insert([{
        id, ...form, checklist:pbsChecklist, fecha:today(),
        firma_auxiliar:perfil.nombre, creado_por:session.user.id
      }]);
      setSaving(false);
      if (error) return showToast("Error: "+error.message,false);
      await loadData(); setPbsChecklist(Array(27).fill(""));
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
        setModal("cmt");
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
    const totalAntes = cmtAntes.reduce((a,t)=>a+Number(t.galones||0),0);
    const totalDespues = cmtDespues.reduce((a,t)=>a+Number(t.galones||0),0);
    const totalMovido = totalDespues - totalAntes;
    if (!form.id && (form.tipo_operacion||"")!=="TRASIEGO DE PRODUCTO" && totalMovido<=0) { setSaving(false); return showToast("El total después debe ser mayor que antes",false); }

    if (form.id) {
      // EDICIÓN: revertir impacto original y aplicar nuevo
      const original = cmts.find(c=>c.id===form.id);
      const {error} = await supabase.from("cmts").update({
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
            if (tq) await supabase.from("tanques").update({nivel:Math.max(0, tq.nivel+ajuste)}).eq("id",tanqueId);
          }
        }
        if (form.placa) await supabase.from("viajes").update({estado:"Descargado"}).eq("placa",form.placa);
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
      const {error} = await supabase.from("cmts").insert([{
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
            if (tanque) await supabase.from("tanques").update({nivel:Math.max(0,tanque.nivel+diff)}).eq("id",td.tanque);
          }
        }
        if (form.placa) await supabase.from("viajes").update({estado:"Descargado"}).eq("placa",form.placa);
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
      const {error} = await supabase.from("despachos").update({...form, volumen:vol}).eq("id",form.id);
      if (!error) {
        if (mismoTanque && tqOrig) {
          await supabase.from("tanques").update({nivel: tqOrig.nivel + volOrig - vol}).eq("id",form.tanque);
        } else {
          if (tqOrig) await supabase.from("tanques").update({nivel: tqOrig.nivel + volOrig}).eq("id",original.tanque);
          if (tqNuevo) await supabase.from("tanques").update({nivel: tqNuevo.nivel - vol}).eq("id",form.tanque);
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
      const {error} = await supabase.from("despachos").insert([{
        id, ...form, volumen:vol, operador:perfil.nombre,
        sede: form.sede || perfil.sede || "MALAMBO",
        fecha:today(), creado_por:session.user.id
      }]);
      if (!error) await supabase.from("tanques").update({nivel:tanque.nivel-vol}).eq("id",form.tanque);
      setSaving(false);
      if (error) return showToast("Error: "+error.message,false);
      await loadData(); setModal(null); setForm({});
      showToast(`Despacho ${id} — ${fmt(vol)} Gls a ${form.buque}`);
    }
  }

  // ── LOADING ──
  if (loading) return (
    <div style={{ minHeight:"100vh", background:"#071422", display:"flex", alignItems:"center", justifyContent:"center" }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{ textAlign:"center" }}>
        <Spinner />
        <div style={{ color:"#6b8fa8", fontSize:12, marginTop:12, fontFamily:"monospace" }}>Cargando...</div>
      </div>
    </div>
  );

  // ── LOGIN / REGISTRO ──
  if (!session) return (
    <div style={{ minHeight:"100vh", background:"#071422", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"monospace" }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <link href="https://fonts.googleapis.com/css2?family=Syne:wght@700;800&display=swap" rel="stylesheet" />
      <div style={{ width:400, background:"#0c1a28", borderRadius:24, padding:40, border:"1px solid #ffffff12" }}>
        <div style={{ textAlign:"center", marginBottom:28 }}>
          <div style={{ width:52, height:52, background:"#071422", border:"1px solid #ffffff14", borderRadius:14, display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 12px", overflow:"hidden" }}>
            <svg width="46" height="46" viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg">
              <text x="8" y="44" fontFamily="Arial,sans-serif" fontSize="40" fontWeight="900" fill="#00e5a0">B</text>
              <text x="29" y="44" fontFamily="Arial,sans-serif" fontSize="40" fontWeight="900" fill="none" stroke="#00b4ff" strokeWidth="2">G</text>
            </svg>
          </div>
          <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:20, color:"#dff0f8" }}>BUNKERSGEST</div>
          <div style={{ fontSize:9, color:"#6b8fa8", marginTop:3, letterSpacing:2 }}>COMBUSTIBLE MARINO</div>
        </div>

        {authError && <div style={{ background:authError.includes("creada")?"#00e5a018":"#ff4d4d18", border:`1px solid ${authError.includes("creada")?"#00e5a0":"#ff4d4d"}`, borderRadius:8, padding:"10px 14px", fontSize:12, color:authError.includes("creada")?"#00e5a0":"#ff4d4d", marginBottom:16 }}>{authError}</div>}

        {authMode==="login" ? (
          <>
            <Inp label="Cédula o Usuario" type="text" placeholder="Ej: 1234567890" value={authForm.cedula||""} onChange={af("cedula")} />
            <Inp label="Contraseña" type="password" placeholder="••••••••" value={authForm.password||""} onChange={af("password")} />
            <Btn color="#00e5a0" onClick={handleLogin} style={{ width:"100%" }}>Iniciar Sesión</Btn>
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
            <Btn color="#00b4ff" onClick={handleRegister}>Crear Cuenta</Btn>
            <div style={{ textAlign:"center", marginTop:14, fontSize:12, color:"#6b8fa8" }}>
              ¿Ya tienes cuenta?{" "}
              <span onClick={()=>{setAuthMode("login");setAuthError("");}} style={{ color:"#00e5a0", cursor:"pointer" }}>Inicia sesión</span>
            </div>
          </>
        )}
      </div>
    </div>
  );

  if (!perfil) return (
    <div style={{ minHeight:"100vh", background:"#071422", display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div style={{ color:"#6b8fa8", fontSize:13, fontFamily:"monospace" }}>Cargando perfil...</div>
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
  const navItems = NAV_ROL[perfil.rol] || [];

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
    <div style={{ fontFamily:"monospace", background:"#071422", minHeight:"100vh", color:"#dff0f8" }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}} @keyframes fadeSlideIn{from{opacity:0;transform:translateX(-8px)}to{opacity:1;transform:translateX(0)}}`}</style>
      <link href="https://fonts.googleapis.com/css2?family=Syne:wght@700;800&display=swap" rel="stylesheet" />

      {toast && <div style={{ position:"fixed", top:18, right:18, zIndex:9999, background:toast.ok?"#00e5a018":"#ff4d4d18", border:`1px solid ${toast.ok?"#00e5a0":"#ff4d4d"}`, borderRadius:12, padding:"12px 18px", color:toast.ok?"#00e5a0":"#ff4d4d", fontSize:13, fontWeight:700, backdropFilter:"blur(12px)", maxWidth:360 }}>{toast.msg}</div>}

      {/* Header */}
      <div style={{ background:"#0c1a28", borderBottom:"1px solid #ffffff0a", padding:"0 22px", height:58, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ width:30, height:30, background:"#071422", border:"1px solid #ffffff14", borderRadius:8, display:"flex", alignItems:"center", justifyContent:"center", overflow:"hidden" }}>
            <svg width="28" height="28" viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg">
              <text x="8" y="44" fontFamily="Arial,sans-serif" fontSize="40" fontWeight="900" fill="#00e5a0">B</text>
              <text x="29" y="44" fontFamily="Arial,sans-serif" fontSize="40" fontWeight="900" fill="none" stroke="#00b4ff" strokeWidth="2">G</text>
            </svg>
          </div>
          <div>
            <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:14, letterSpacing:1 }}>BUNKERSGEST</div>
            <div style={{ fontSize:9, color:"#6b8fa8", letterSpacing:1 }}>Combustible Marino</div>
          </div>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <div style={{ textAlign:"right" }}>
            <div style={{ fontSize:12, fontWeight:700 }}>{perfil.nombre}</div>
            <div style={{ fontSize:10, color:rol.color }}>{rol.icon} {rol.label}</div>
          </div>
          <Btn sm outline color="#ff4d4d" onClick={handleLogout}>Salir</Btn>
        </div>
      </div>

      <div style={{ display:"flex", minHeight:"calc(100vh - 58px)" }}>
        {/* Sidebar */}
        <div style={{ width:56, background:"#0a1826", borderRight:"1px solid #ffffff08", padding:"10px 0", flexShrink:0, display:"flex", flexDirection:"column", alignItems:"center", gap:2, zIndex:100 }}>
          {(()=>{
            const GRUPOS = {
              viajes:   { icon:"🚛", label:"LOGÍSTICA",  subs:[{id:"viajes",label:"Listado Tránsito"},{id:"listado_planta",label:"Listado Planta"}] },
              tiquetes: { icon:"🧪", label:"LABORATORIO", subs:[{id:"tiquetes",label:"Tiquetes MP",badge:pendTiquetes},{id:"resultados",label:"Resultados"}] },
            };
            const badges = { pbs:pendPBS, cmt:pendCMT };

            const btnStyle = (active, isHov, color) => ({
              width:40, height:40, border:"none", borderRadius:10, cursor:"pointer",
              display:"flex", alignItems:"center", justifyContent:"center", fontSize:18,
              transition:"background 0.2s, transform 0.2s, color 0.2s",
              background: active ? color+"44" : isHov ? color+"22" : "transparent",
              transform: isHov ? "scale(1.12)" : "scale(1)",
              color: active||isHov ? color : "#4a6a82",
              position:"relative", outline:"none",
            });

            /* El flyout ocupa left:100% sin gap — así el mouse pasa directo del ícono al panel.
               Un padding-left invisible de 8px al inicio del panel crea el espacio visual. */
            const flyoutBase = {
              position:"absolute", left:"100%", top:"-4px",
              paddingLeft:8, zIndex:9999, pointerEvents:"auto",
            };
            const flyoutInner = {
              background:"#0d1f30",
              border:"1px solid #ffffff18",
              borderLeft:"2px solid",
              borderRadius:"0 10px 10px 0",
              padding:"6px 0", minWidth:190,
              boxShadow:"8px 8px 32px #000d",
              animation:"fadeSlideIn 0.15s ease",
            };

            const tooltipBase = {
              position:"absolute", left:"100%", top:"50%",
              paddingLeft:8, zIndex:9999, pointerEvents:"none",
            };
            const tooltipInner = {
              background:"#0d1f30", border:"1px solid #ffffff18", borderRadius:7,
              padding:"5px 11px", fontSize:11, color:"#dff0f8",
              whiteSpace:"nowrap", boxShadow:"4px 4px 16px #000a",
              fontFamily:"monospace", transform:"translateY(-50%)",
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
                          <div style={{padding:"7px 14px 8px",fontSize:10,color:"#6b8fa8",fontWeight:700,letterSpacing:1.5,textTransform:"uppercase",borderBottom:"1px solid #ffffff0a",marginBottom:4}}>{grupo.label}</div>
                          {grupo.subs.map(sub=>{
                            const subActive = nav===sub.id;
                            return (
                              <button key={sub.id} onClick={()=>{setNav(sub.id);setNavHovered(null);}}
                                style={{width:"100%",textAlign:"left",background:subActive?rol.color+"22":"transparent",border:"none",borderLeft:`3px solid ${subActive?rol.color:"transparent"}`,padding:"9px 16px",color:subActive?rol.color:"#b8ccd8",fontSize:12,fontFamily:"monospace",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"space-between",transition:"background 0.12s, color 0.12s, border-color 0.12s",boxSizing:"border-box"}}
                                onMouseEnter={e=>{ if(!subActive){e.currentTarget.style.background=rol.color+"14"; e.currentTarget.style.color="#fff"; e.currentTarget.style.borderLeftColor=rol.color+"66";} }}
                                onMouseLeave={e=>{ if(!subActive){e.currentTarget.style.background="transparent"; e.currentTarget.style.color="#b8ccd8"; e.currentTarget.style.borderLeftColor="transparent";} }}>
                                <span>{sub.label}</span>
                                {sub.badge>0&&<span style={{background:"#ff4d4d",color:"#fff",fontSize:9,fontWeight:700,borderRadius:10,padding:"1px 6px"}}>{sub.badge}</span>}
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
        <div style={{ flex:1, padding:24, overflowY:"auto" }}>

          {/* DASHBOARD */}
          {nav==="dashboard" && (
            <div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:4,flexWrap:"wrap",gap:8}}>
                <div style={{ fontFamily:"'Syne',sans-serif", fontSize:22, fontWeight:800 }}>Panel Operativo</div>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  {(sedeFiltro==="TODAS"||["administrador","gerencia"].includes(perfil.rol)) && (
                    <select value={sedeFiltro} onChange={e=>setSedeFiltro(e.target.value)}
                      style={{background:"#0f1e2e",border:"1px solid #ffffff22",borderRadius:8,padding:"6px 12px",color:"#dff0f8",fontSize:12,fontFamily:"monospace",outline:"none",cursor:"pointer"}}>
                      <option value="TODAS">Todas las sedes</option>
                      {SEDES.map(s=><option key={s}>{s}</option>)}
                    </select>
                  )}
                  {!["administrador","gerencia"].includes(perfil.rol) && (
                    <div style={{background:"#0f1e2e",border:"1px solid #ffffff22",borderRadius:8,padding:"6px 12px",color:"#00e5a0",fontSize:12,fontFamily:"monospace"}}>
                      📍 {sedeFiltro}
                    </div>
                  )}
                </div>
              </div>
              <div style={{ fontSize:11, color:"#6b8fa8", marginBottom:22 }}>QBS · {new Date().toLocaleDateString("es-CO",{weekday:"long",day:"numeric",month:"long",year:"numeric"})}</div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))", gap:12, marginBottom:22 }}>
                <Stat label="Carros en Ruta" value={enRuta} color="#f59e0b" sub="hacia planta" />
                <Stat label="Tiquetes Pend." value={pendTiquetes} color="#00b4ff" sub="esperan laboratorio" />
                <Stat label="PBS Pendientes" value={pendPBS} color="#fb923c" sub="esperan operaciones" />
                <Stat label="CMT Pendientes" value={pendCMT} color="#00e5a0" sub="esperan coordinador" />
                <Stat label="Stock VLSFO" value={`${fmt(tanques.filter(t=>t.producto==="VLSFO").reduce((a,t)=>a+t.nivel,0))} Gls`} color="#00e5a0" />
                <Stat label="Stock MGO" value={`${fmt(tanques.filter(t=>t.producto==="MGO").reduce((a,t)=>a+t.nivel,0))} Gls`} color="#c084fc" />
              </div>
              <div style={{ fontFamily:"'Syne',sans-serif", fontSize:14, fontWeight:800, marginBottom:12 }}>Tanques TK-111 al TK-117</div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))", gap:10 }}>
                {tanques.map(t=>(
                  <Card key={t.id} style={{ padding:"14px 16px" }}>
                    <div style={{ display:"flex", justifyContent:"space-between", marginBottom:8 }}>
                      <div>
                        <div style={{ fontWeight:800, fontSize:13, fontFamily:"'Syne',sans-serif" }}>{t.id}</div>
                        <div style={{ fontSize:10, color:"#6b8fa8" }}>{t.producto}</div>
                      </div>
                      <Badge label={TIPO_LABEL[t.tipo]} color={TIPO_COLOR[t.tipo]} />
                    </div>
                    <div style={{ background:"#162535", borderRadius:5, height:7, overflow:"hidden", marginBottom:6 }}>
                      <div style={{ height:"100%", width:`${Math.round((t.nivel/t.capacidad)*100)}%`, background:TIPO_COLOR[t.tipo], borderRadius:5 }} />
                    </div>
                    <div style={{ display:"flex", justifyContent:"space-between", fontSize:10 }}>
                      <span style={{ color:"#6b8fa8" }}>{fmt(t.nivel)} / {fmt(t.capacidad)} Gls</span>
                      <span style={{ fontWeight:700, color:TIPO_COLOR[t.tipo] }}>{Math.round((t.nivel/t.capacidad)*100)}%</span>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* VIAJES */}
          {nav==="viajes" && (()=>{
            const selStyle = {background:"#0f1e2e",border:"1px solid #ffffff22",borderRadius:8,padding:"6px 10px",color:"#dff0f8",fontSize:11,fontFamily:"monospace",outline:"none"};
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
                    <div style={{ fontFamily:"'Syne',sans-serif", fontSize:20, fontWeight:800 }}>Listado Tránsito</div>
                    <div style={{ fontSize:11, color:"#6b8fa8" }}>Carros en ruta · <b style={{color:"#f59e0b"}}>{viajesFinal.length}</b> resultado(s)</div>
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
                    v.fecha_llegada||<span style={{color:"#6b8fa8",fontSize:10}}>—</span>,
                    v.producto, v.transportadora, v.placa, v.guia,
                    fmt(v.gls_netos_guia||v.volumen_guia||0),
                    v.gls_recibidos>0?<span style={{color:"#00e5a0",fontWeight:700}}>{fmt(v.gls_recibidos)}</span>:<span style={{color:"#6b8fa8",fontSize:10}}>—</span>,
                    faltantes>0?<span style={{color:"#ff4d4d",fontWeight:700}}>{fmt(faltantes)}</span>:<span style={{color:"#00e5a0"}}>OK</span>,
                    sbLabel !== null
                      ? <span style={{display:"inline-flex",alignItems:"center",gap:4}}>
                          <Badge label={sbLabel} color={sbColor}/>
                          {!sbFinalizado && horasStandby>=24 && <span style={{fontSize:9,color:"#ff4d4d",fontWeight:700}}>COBRO</span>}
                          {!sbFinalizado && horasStandby<24 && <span style={{fontSize:9,color:"#6b8fa8",fontStyle:"italic"}}>en curso</span>}
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
            // Carros en ruta con fecha_llegada registrada, o cualquier carro en planta
            const enPlanta = viajesFiltrados
              .filter(v => v.fecha_llegada)
              .filter(v => v.estado !== "Descargado" && v.estado !== "Rechazado")
              .sort((a,b) => {
                // Si ambos tienen turno_planta, usarlo; si no, por updated_at
                if (a.turno_planta && b.turno_planta) return a.turno_planta - b.turno_planta;
                if (a.turno_planta) return -1;
                if (b.turno_planta) return 1;
                return new Date(a.updated_at||0) - new Date(b.updated_at||0);
              });
            const COLOR = "#00b4ff";
            return (
            <div style={{display:"flex",flexDirection:"column",height:"calc(100vh - 100px)"}}>
              {/* Header */}
              <div style={{flexShrink:0,marginBottom:18,display:"flex",justifyContent:"space-between",alignItems:"flex-end"}}>
                <div>
                  <div style={{fontFamily:"'Syne',sans-serif",fontSize:22,fontWeight:800,letterSpacing:0.5}}>Listado Planta</div>
                  <div style={{fontSize:11,color:"#6b8fa8",marginTop:2}}>
                    Enturne de carros para descargue ·{" "}
                    <b style={{color:COLOR}}>{enPlanta.length}</b> carro(s) en planta
                  </div>
                </div>
                <Btn onClick={()=>{setForm({fecha_llegada:today()});setModal("turno_carro");}}>+ TURNO CARRO</Btn>
              </div>

              {/* Tabla */}
              <div style={{flex:1,overflow:"auto",borderRadius:14,border:"1px solid #ffffff0a",background:"#0a1826"}}>
                <table style={{width:"100%",borderCollapse:"collapse",fontSize:12,fontFamily:"monospace"}}>
                  <thead>
                    <tr style={{background:"#0d1f30",position:"sticky",top:0,zIndex:2}}>
                      {["#","FECHA LLEGADA","FECHA CARGUE","PLACA","PRODUCTO","OBSERVACIONES",""].map((h,i)=>(
                        <th key={i} style={{padding:"11px 14px",textAlign:"left",fontSize:10,color:"#6b8fa8",fontWeight:700,letterSpacing:1.2,textTransform:"uppercase",borderBottom:"1px solid #ffffff0a",whiteSpace:"nowrap"}}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {enPlanta.length===0 && (
                      <tr><td colSpan={7} style={{padding:40,textAlign:"center",color:"#6b8fa8",fontSize:13}}>No hay carros en planta</td></tr>
                    )}
                    {enPlanta.map((v)=>{
                      const llegó = !!v.fecha_llegada;
                      const turno = v.turno_planta||null;
                      return (
                        <tr key={v.id} style={{borderBottom:"1px solid #ffffff06",transition:"background 0.12s"}}
                          onMouseEnter={e=>e.currentTarget.style.background="#ffffff05"}
                          onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                          {/* Número de turno */}
                          <td style={{padding:"12px 14px"}}>
                            {turno
                              ? <div style={{width:28,height:28,borderRadius:"50%",background:turno===1?"#00e5a044":COLOR+"22",border:`2px solid ${turno===1?"#00e5a0":COLOR}`,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,fontSize:12,color:turno===1?"#00e5a0":COLOR}}>{turno}</div>
                              : <div style={{width:28,height:28,borderRadius:"50%",background:"#f59e0b22",border:"2px solid #f59e0b66",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,color:"#f59e0b"}}>—</div>
                            }
                          </td>
                          {/* Fecha llegada */}
                          <td style={{padding:"12px 14px"}}>
                            {llegó
                              ? <span style={{color:"#00e5a0",fontWeight:700}}>{v.fecha_llegada}</span>
                              : <span style={{color:"#f59e0b",fontSize:11}}>Pendiente</span>
                            }
                          </td>
                          {/* Fecha cargue */}
                          <td style={{padding:"12px 14px",color:"#8aacbf"}}>{v.fecha||"—"}</td>
                          {/* Placa */}
                          <td style={{padding:"12px 14px"}}>
                            <span style={{background:"#f59e0b18",border:"1px solid #f59e0b44",borderRadius:6,padding:"3px 9px",color:"#f59e0b",fontWeight:700,letterSpacing:1}}>{v.placa||"—"}</span>
                          </td>
                          {/* Producto */}
                          <td style={{padding:"12px 14px",color:"#c8dce8",maxWidth:160}}>
                            <div style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{v.producto||"—"}</div>
                          </td>
                          {/* Observaciones */}
                          <td style={{padding:"12px 14px",color:"#6b8fa8",maxWidth:200}}>
                            <div style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{v.observacion||<span style={{color:"#ffffff22",fontStyle:"italic"}}>Sin observaciones</span>}</div>
                          </td>
                          {/* Acción */}
                          <td style={{padding:"12px 14px"}}>
                            <button onClick={()=>{setForm({...v});setModal("viaje");}}
                              style={{background:COLOR+"18",border:`1px solid ${COLOR}44`,borderRadius:7,color:COLOR,padding:"5px 12px",fontSize:11,cursor:"pointer",fontFamily:"monospace",transition:"background 0.12s",whiteSpace:"nowrap"}}
                              onMouseEnter={e=>e.currentTarget.style.background=COLOR+"30"}
                              onMouseLeave={e=>e.currentTarget.style.background=COLOR+"18"}>
                              {llegó ? "✏ Editar" : "📍 Registrar llegada"}
                            </button>
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

          {/* TIQUETES */}
          {nav==="tiquetes" && (
            <div>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:22 }}>
                <div>
                  <div style={{ fontFamily:"'Syne',sans-serif", fontSize:20, fontWeight:800 }}>Tiquete de Ingreso MP</div>
                  <div style={{ fontSize:11, color:"#6b8fa8" }}>Emitido por laboratorio · Aval para descargue</div>
                </div>
                <div style={{display:"flex",gap:8,alignItems:"center"}}>
                  {["administrador","gerencia"].includes(perfil.rol) && (
                    <select value={sedeFiltro} onChange={e=>setSedeFiltro(e.target.value)}
                      style={{background:"#0f1e2e",border:"1px solid #ffffff22",borderRadius:8,padding:"6px 12px",color:"#dff0f8",fontSize:12,fontFamily:"monospace",outline:"none"}}>
                      <option value="TODAS">Todas</option>
                      {SEDES.map(s=><option key={s}>{s}</option>)}
                    </select>
                  )}
                  {puedeCrear("tiquetes") && <Btn color="#00b4ff" onClick={()=>{setForm({});setModal("tiquete");}}>+ Nuevo Tiquete</Btn>}
                </div>
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
                rows={tiquetesFiltrados.map(t=>[
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
          )}

          {/* RESULTADOS LABORATORIO */}
          {nav==="resultados" && (
            <div>
              <div style={{ fontFamily:"'Syne',sans-serif", fontSize:20, fontWeight:800, marginBottom:4 }}>Resultados de Laboratorio</div>
              <div style={{ fontSize:11, color:"#6b8fa8", marginBottom:22 }}>Consolidado de análisis por tiquete</div>
              <Table
                cols={["No. Tiquete","Fecha","Producto","Placa","API Corr.","Flash °C","Agua %","Viscosidad","Gls Recibidos","Resultado"]}
                rows={tiquetesFiltrados.map(t=>[
                  <span style={{color:"#00b4ff",fontFamily:"monospace"}}>{t.id}</span>,
                  t.fecha_llegada||"—",
                  t.producto,
                  t.placa,
                  <span style={{color:"#f59e0b",fontWeight:700}}>{t.api_corregido}°</span>,
                  <span style={{color:Number(t.flash_point)>=60?"#00e5a0":"#ff4d4d",fontWeight:700}}>{t.flash_point}°C</span>,
                  <span style={{color:Number(t.agua_destilacion)<=1?"#00e5a0":"#ff4d4d",fontWeight:700}}>{t.agua_destilacion}%</span>,
                  t.viscosidad||"—",
                  <span style={{color:"#00e5a0",fontWeight:700}}>{fmt(t.galones_recibidos)}</span>,
                  <Badge label={t.resultado} color={t.resultado==="APROBADO"?"#00e5a0":"#ff4d4d"}/>,
                ])}
              />
            </div>
          )}

          {/* PBS */}
          {nav==="pbs" && (
            <div>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:22 }}>
                <div>
                  <div style={{ fontFamily:"'Syne',sans-serif", fontSize:20, fontWeight:800 }}>Permiso de Bombeo Seguro</div>
                  <div style={{ fontSize:11, color:"#6b8fa8" }}>Checklist de 27 puntos por cada descargue</div>
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
                  <div style={{ fontFamily:"'Syne',sans-serif", fontSize:20, fontWeight:800 }}>CMT — Control de Movimiento de Tanques</div>
                  <div style={{ fontSize:11, color:"#6b8fa8" }}>Registro oficial de movimientos en tanques</div>
                </div>
                <div style={{display:"flex",gap:12,alignItems:"flex-end"}}>
                  {["administrador","gerencia"].includes(perfil.rol) && (<>
                    <div style={{display:"flex",flexDirection:"column",gap:3}}>
                      <div style={{fontSize:10,color:"#6b8fa8",textTransform:"uppercase",letterSpacing:1,fontFamily:"monospace"}}>Sede</div>
                      <select value={sedeFiltro||"TODAS"} onChange={e=>{setSedeFiltro(e.target.value);setPlantaFiltro(null);}}
                        style={{background:(!sedeFiltro||sedeFiltro==="TODAS")?"#2a1a0e":"#0f1e2e",border:(!sedeFiltro||sedeFiltro==="TODAS")?"1px solid #f59e0b88":"1px solid #ffffff22",borderRadius:8,padding:"6px 12px",color:(!sedeFiltro||sedeFiltro==="TODAS")?"#f59e0b":"#dff0f8",fontSize:12,fontFamily:"monospace",outline:"none",cursor:"pointer"}}>
                        <option value="TODAS">— Seleccionar sede —</option>
                        {SEDES.map(s=><option key={s}>{s}</option>)}
                      </select>
                    </div>
                    {sedeFiltro==="MALAMBO" && (
                      <div style={{display:"flex",flexDirection:"column",gap:3}}>
                        <div style={{fontSize:10,color:"#6b8fa8",textTransform:"uppercase",letterSpacing:1,fontFamily:"monospace"}}>Planta</div>
                        <select value={plantaFiltro||""} onChange={e=>setPlantaFiltro(e.target.value)}
                          style={{background:!plantaFiltro?"#2a1a0e":"#0f1e2e",border:!plantaFiltro?"1px solid #f59e0b88":"1px solid #ffffff22",borderRadius:8,padding:"6px 12px",color:!plantaFiltro?"#f59e0b":"#dff0f8",fontSize:12,fontFamily:"monospace",outline:"none",cursor:"pointer"}}>
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
                      <div style={{fontWeight:800,fontSize:15,color:"#f59e0b",marginBottom:6,fontFamily:"'Syne',sans-serif"}}>Paso 1 — Seleccione la sede donde va a trabajar</div>
                      <div style={{fontSize:13,color:"#c9a84c",lineHeight:1.6}}>
                        Use el selector <b style={{color:"#f59e0b"}}>"Sede"</b> arriba a la derecha para elegir entre {SEDES.join(", ")}.<br/>
                        <span style={{fontSize:11,color:"#8a7040",marginTop:4,display:"block"}}>Cada CMT queda registrado en la sede donde se realizó el movimiento. Esto no se puede cambiar después.</span>
                      </div>
                    </>) : (<>
                      <div style={{fontWeight:800,fontSize:15,color:"#f59e0b",marginBottom:6,fontFamily:"'Syne',sans-serif"}}>Paso 2 — Seleccione la planta dentro de MALAMBO</div>
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
                const thStyle = {padding:"10px 12px",fontSize:10,color:"#6b8fa8",textTransform:"uppercase",letterSpacing:1,fontFamily:"monospace",borderBottom:"1px solid #ffffff0f",whiteSpace:"nowrap",textAlign:"left"};
                const tdStyle = {padding:"10px 12px",fontSize:12,fontFamily:"monospace",borderBottom:"1px solid #ffffff08",verticalAlign:"middle"};
                return (<>
                  <div style={{display:"flex",gap:10,marginBottom:14,flexWrap:"wrap",alignItems:"flex-end"}}>
                    <div style={{flex:1,minWidth:180}}>
                      <div style={{fontSize:10,color:"#6b8fa8",marginBottom:3,textTransform:"uppercase",letterSpacing:1}}>Buscar</div>
                      <input value={cmtBusqueda} onChange={e=>setCmtBusqueda(e.target.value)} placeholder="N° CMT, operador, producto, placa..." style={{width:"100%",background:"#0f1e2e",border:"1px solid #ffffff14",borderRadius:8,padding:"7px 12px",color:"#dff0f8",fontSize:12,fontFamily:"monospace",outline:"none",boxSizing:"border-box"}}/>
                    </div>
                    <div>
                      <div style={{fontSize:10,color:"#6b8fa8",marginBottom:3,textTransform:"uppercase",letterSpacing:1}}>Tipo operación</div>
                      <select value={cmtFiltroTipo} onChange={e=>setCmtFiltroTipo(e.target.value)} style={{background:"#0f1e2e",border:"1px solid #ffffff14",borderRadius:8,padding:"7px 12px",color:"#dff0f8",fontSize:12,fontFamily:"monospace",outline:"none"}}>
                        <option value="">Todos</option>
                        {tiposUnicos.map(t=><option key={t}>{t}</option>)}
                      </select>
                    </div>
                    <div>
                      <div style={{fontSize:10,color:"#6b8fa8",marginBottom:3,textTransform:"uppercase",letterSpacing:1}}>Desde</div>
                      <input type="date" value={cmtFiltroFechaD} onChange={e=>setCmtFiltroFechaD(e.target.value)} style={{background:"#0f1e2e",border:"1px solid #ffffff14",borderRadius:8,padding:"7px 10px",color:"#dff0f8",fontSize:12,fontFamily:"monospace",outline:"none"}}/>
                    </div>
                    <div>
                      <div style={{fontSize:10,color:"#6b8fa8",marginBottom:3,textTransform:"uppercase",letterSpacing:1}}>Hasta</div>
                      <input type="date" value={cmtFiltroFechaH} onChange={e=>setCmtFiltroFechaH(e.target.value)} style={{background:"#0f1e2e",border:"1px solid #ffffff14",borderRadius:8,padding:"7px 10px",color:"#dff0f8",fontSize:12,fontFamily:"monospace",outline:"none"}}/>
                    </div>
                    <div style={{display:"flex",alignItems:"center",gap:10,paddingBottom:6}}>
                      <span style={{fontSize:11,color:"#6b8fa8"}}>{cmtsFinal.length} registro(s)</span>
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
                    <table style={{width:"100%",borderCollapse:"collapse",background:"#0f1e2e",borderRadius:10,overflow:"hidden"}}>
                      <thead>
                        <tr style={{background:"#162535"}}>
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
                          <tr><td colSpan={10} style={{...tdStyle,textAlign:"center",color:"#6b8fa8",padding:28}}>Sin registros</td></tr>
                        )}
                        {cmtsFinal.map(c=>{
                          const tanquesNombres = [...new Set([...(c.tanques_antes||[]).map(t=>t.tanque), ...(c.tanques_despues||[]).map(t=>t.tanque)].filter(Boolean))].join(", ");
                          const movido = Number(c.total_movido||0);
                          const expandido = cmtExpandido===c.id;
                          return (
                          <React.Fragment key={c.id}>
                          <tr onClick={()=>setCmtExpandido(expandido?null:c.id)} style={{cursor:"pointer",background:expandido?"#162535":"transparent",transition:"background 0.15s"}} onMouseEnter={e=>{if(!expandido)e.currentTarget.style.background="#162535"}} onMouseLeave={e=>{if(!expandido)e.currentTarget.style.background="transparent"}}>
                            <td style={tdStyle}><span style={{color:"#00e5a0",fontWeight:700,letterSpacing:0.5}}>{c.numero_cmt||c.id}</span></td>
                            <td style={tdStyle}><span style={{color:"#6b8fa8"}}>{c.fecha}</span></td>
                            <td style={tdStyle}><Badge label={c.tipo_operacion||"—"} color="#00e5a0"/></td>
                            <td style={tdStyle}><span style={{color:"#f59e0b"}}>{c.producto||"—"}</span></td>
                            <td style={tdStyle}><span style={{color:"#dff0f8",fontSize:11}}>{tanquesNombres||"—"}</span></td>
                            <td style={tdStyle}><span style={{color:"#dff0f8"}}>{fmt(c.total_antes)}</span></td>
                            <td style={tdStyle}><span style={{color:"#dff0f8"}}>{fmt(c.total_despues)}</span></td>
                            <td style={tdStyle}><span style={{color:"#00e5a0",fontWeight:700}}>{fmt(Math.abs(movido))}</span></td>
                            <td style={tdStyle}><span style={{color:"#6b8fa8",fontSize:11}}>{c.operador||"—"}</span></td>
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
                              <td colSpan={10} style={{padding:"0 0 2px 0",background:"#0a1829",borderBottom:"2px solid #00e5a033"}}>
                                <div style={{padding:"16px 20px",display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
                                  <div style={{background:"#0f1e2e",borderRadius:10,padding:"12px 14px",borderLeft:"3px solid #00b4ff"}}>
                                    <div style={{fontSize:10,color:"#00b4ff",fontWeight:700,textTransform:"uppercase",letterSpacing:1,marginBottom:8}}>Medida Inicial</div>
                                    {(c.tanques_antes||[]).map((t,i)=>(
                                      <div key={i} style={{display:"flex",justifyContent:"space-between",fontSize:11,marginBottom:4,paddingBottom:4,borderBottom:"1px solid #ffffff08"}}>
                                        <span style={{color:"#dff0f8",fontWeight:700}}>{t.tanque||"—"}</span>
                                        <span style={{color:"#6b8fa8"}}>Sonda: {t.sonda||"—"}</span>
                                        <span style={{color:"#f59e0b",fontWeight:700}}>{fmt(t.galones)} Gls</span>
                                      </div>
                                    ))}
                                    <div style={{fontSize:11,color:"#6b8fa8",marginTop:4}}>Total: <b style={{color:"#dff0f8"}}>{fmt(c.total_antes)} Gls</b></div>
                                  </div>
                                  <div style={{background:"#0f1e2e",borderRadius:10,padding:"12px 14px",borderLeft:"3px solid #c084fc"}}>
                                    <div style={{fontSize:10,color:"#c084fc",fontWeight:700,textTransform:"uppercase",letterSpacing:1,marginBottom:8}}>Medida Final</div>
                                    {(c.tanques_despues||[]).map((t,i)=>(
                                      <div key={i} style={{display:"flex",justifyContent:"space-between",fontSize:11,marginBottom:4,paddingBottom:4,borderBottom:"1px solid #ffffff08"}}>
                                        <span style={{color:"#dff0f8",fontWeight:700}}>{t.tanque||"—"}</span>
                                        <span style={{color:"#6b8fa8"}}>Sonda: {t.sonda||"—"}</span>
                                        <span style={{color:"#f59e0b",fontWeight:700}}>{fmt(t.galones)} Gls</span>
                                      </div>
                                    ))}
                                    <div style={{fontSize:11,color:"#6b8fa8",marginTop:4}}>Total: <b style={{color:"#dff0f8"}}>{fmt(c.total_despues)} Gls</b></div>
                                  </div>
                                  {(c.carros||[]).length>0 && (c.tipo_operacion||"")==="DESCARGUE DE CARROTANQUE" && (
                                    <div style={{background:"#0f1e2e",borderRadius:10,padding:"12px 14px",borderLeft:"3px solid #6b8fa8",gridColumn:"1/-1"}}>
                                      <div style={{fontSize:10,color:"#6b8fa8",fontWeight:700,textTransform:"uppercase",letterSpacing:1,marginBottom:8}}>Carros Descargados</div>
                                      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:8}}>
                                        {(c.carros||[]).map((cr,i)=>(
                                          <div key={i} style={{background:"#162535",borderRadius:8,padding:"8px 10px",fontSize:11}}>
                                            <div style={{color:"#dff0f8",fontWeight:700,marginBottom:3}}>{cr.placa||"Sin placa"}</div>
                                            {cr.tiquete&&<div style={{color:"#00b4ff"}}>Tiquete: {cr.tiquete}</div>}
                                            {cr.guia&&<div style={{color:"#6b8fa8"}}>Guía: {cr.guia}</div>}
                                            {cr.pbs_id&&<div style={{color:"#fb923c"}}>PBS: {cr.pbs_id}</div>}
                                            {cr.hora_inicio&&<div style={{color:"#6b8fa8"}}>Inicio: {cr.hora_inicio} — Fin: {cr.hora_final||"—"}</div>}
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                  {(c.tipo_operacion||"")==="TRASIEGO DE PRODUCTO" && (c.tanques_recepcion||[]).length>0 && (
                                    <div style={{background:"#0f1e2e",borderRadius:10,padding:"12px 14px",borderLeft:"3px solid #00e5a0",gridColumn:"1/-1"}}>
                                      <div style={{fontSize:10,color:"#00e5a0",fontWeight:700,textTransform:"uppercase",letterSpacing:1,marginBottom:8}}>Tanque de Recepción</div>
                                      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))",gap:8}}>
                                        {(c.tanques_recepcion||[]).map((r,i)=>(
                                          <div key={i} style={{background:"#162535",borderRadius:8,padding:"8px 12px",fontSize:11}}>
                                            <div style={{color:"#00e5a0",fontWeight:700,marginBottom:6,fontSize:12}}>{r.tanque||"—"}</div>
                                            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:4}}>
                                              <div style={{color:"#00b4ff",fontSize:10,fontWeight:700,marginBottom:2}}>INICIAL</div>
                                              <div style={{color:"#c084fc",fontSize:10,fontWeight:700,marginBottom:2}}>FINAL</div>
                                              <div style={{color:"#6b8fa8"}}>Sonda: <b style={{color:"#dff0f8"}}>{r.sondaInicial||"—"}</b></div>
                                              <div style={{color:"#6b8fa8"}}>Sonda: <b style={{color:"#dff0f8"}}>{r.sondaFinal||"—"}</b></div>
                                              <div style={{color:"#6b8fa8"}}>Temp: <b style={{color:"#dff0f8"}}>{r.tempInicial||"—"}</b></div>
                                              <div style={{color:"#6b8fa8"}}>Temp: <b style={{color:"#dff0f8"}}>{r.tempFinal||"—"}</b></div>
                                              <div style={{color:"#f59e0b",fontWeight:700}}>{fmt(r.galonesInicial||0)} Gls</div>
                                              <div style={{color:"#f59e0b",fontWeight:700}}>{fmt(r.galonesFinal||0)} Gls</div>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                  <div style={{gridColumn:"1/-1",display:"flex",gap:20,fontSize:11,color:"#6b8fa8",flexWrap:"wrap",paddingTop:4}}>
                                    {c.sede&&<span>Sede: <b style={{color:"#dff0f8"}}>{c.sede}{c.planta?` · ${c.planta}`:""}</b></span>}
                                    {c.operador&&<span>Operador: <b style={{color:"#dff0f8"}}>{c.operador}</b></span>}
                                    {c.placa&&<span>Placa: <b style={{color:"#dff0f8"}}>{c.placa}</b></span>}
                                    {c.guia&&<span>Guía: <b style={{color:"#dff0f8"}}>{c.guia}</b></span>}
                                    {c.tiquete_entrada&&<span>Tiquete: <b style={{color:"#00b4ff"}}>{c.tiquete_entrada}</b></span>}
                                    {(c.tipo_operacion||"")==="TRASIEGO DE PRODUCTO"&&c.pbs_id&&<span>PBS: <b style={{color:"#fb923c"}}>{c.pbs_id}</b></span>}
                                    <span style={{marginLeft:"auto",color: movido>=0?"#00e5a0":"#ff4d4d",fontWeight:700,fontSize:13}}>
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
          {nav==="tanques" && (
            <div>
              <div style={{ fontFamily:"'Syne',sans-serif", fontSize:20, fontWeight:800, marginBottom:4 }}>Tanques TK-111 al TK-117</div>
              <div style={{ fontSize:11, color:"#6b8fa8", marginBottom:18 }}>Niveles en tiempo real · Planta QBS</div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(240px,1fr))", gap:14 }}>
                {tanques.map(t=>(
                  <Card key={t.id}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:12 }}>
                      <div>
                        <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:16 }}>{t.id}</div>
                        <div style={{ fontSize:11, color:"#6b8fa8" }}>{t.producto} · {t.planta}</div>
                      </div>
                      <Badge label={TIPO_LABEL[t.tipo]} color={TIPO_COLOR[t.tipo]}/>
                    </div>
                    <div style={{ background:"#162535", borderRadius:6, height:10, overflow:"hidden", marginBottom:10 }}>
                      <div style={{ height:"100%", width:`${Math.round((t.nivel/t.capacidad)*100)}%`, background:TIPO_COLOR[t.tipo], borderRadius:6 }}/>
                    </div>
                    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8 }}>
                      {[["Capacidad",fmt(t.capacidad)],["Actual",fmt(t.nivel)],["Libre",fmt(t.capacidad-t.nivel)]].map(([l,v])=>(
                        <div key={l} style={{ background:"#162535", borderRadius:8, padding:"8px 10px" }}>
                          <div style={{ fontSize:9, color:"#6b8fa8", textTransform:"uppercase" }}>{l}</div>
                          <div style={{ fontSize:12, fontWeight:700, marginTop:3 }}>{v} Gls</div>
                        </div>
                      ))}
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* DESPACHO */}
          {nav==="despacho" && (
            <div>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:22 }}>
                <div>
                  <div style={{ fontFamily:"'Syne',sans-serif", fontSize:20, fontWeight:800 }}>Despacho a Buques</div>
                  <div style={{ fontSize:11, color:"#6b8fa8" }}>Carga en barcaza → manguera al buque</div>
                </div>
                <div style={{display:"flex",gap:8,alignItems:"center"}}>
                  {["administrador","gerencia"].includes(perfil.rol) && (
                    <select value={sedeFiltro} onChange={e=>setSedeFiltro(e.target.value)}
                      style={{background:"#0f1e2e",border:"1px solid #ffffff22",borderRadius:8,padding:"6px 12px",color:"#dff0f8",fontSize:12,fontFamily:"monospace",outline:"none"}}>
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
              <div style={{ fontFamily:"'Syne',sans-serif", fontSize:20, fontWeight:800, marginBottom:4 }}>Trazabilidad Completa</div>
              <div style={{ fontSize:11, color:"#6b8fa8", marginBottom:22 }}>Cargue → Tiquete → PBS → CMT → Despacho</div>
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
                          <span style={{ color:"#6b8fa8", fontSize:11 }}>{v.placa} · {v.fecha}</span>
                        </div>
                        <Badge label={v.estado} color={v.estado==="Descargado"?"#00e5a0":v.estado==="Rechazado"?"#ff4d4d":"#f59e0b"}/>
                      </div>
                      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))", gap:10 }}>
                        <div style={{ background:"#162535", borderRadius:10, padding:"10px 12px", borderLeft:"3px solid #f59e0b" }}>
                          <div style={{ fontSize:10, color:"#f59e0b", marginBottom:6 }}>🚛 LOGÍSTICA</div>
                          <div style={{ fontSize:11 }}>{v.transportadora}</div>
                          <div style={{ fontSize:11, color:"#6b8fa8" }}>Guía: {v.guia}</div>
                          <div style={{ fontSize:11, color:"#6b8fa8" }}>{fmt(v.volumen_guia)} Gls</div>
                        </div>
                        <div style={{ background:"#162535", borderRadius:10, padding:"10px 12px", borderLeft:`3px solid ${tq?(tq.resultado==="APROBADO"?"#00e5a0":"#ff4d4d"):"#6b8fa8"}` }}>
                          <div style={{ fontSize:10, color:"#00b4ff", marginBottom:6 }}>🧪 TIQUETE</div>
                          {tq?<><Badge label={tq.resultado} color={tq.resultado==="APROBADO"?"#00e5a0":"#ff4d4d"}/><div style={{ fontSize:11, color:"#6b8fa8", marginTop:4 }}>API: {tq.api_corregido}° · {fmt(tq.galones_recibidos)} Gls</div></>:<div style={{ fontSize:11, color:"#f59e0b" }}>Pendiente</div>}
                        </div>
                        <div style={{ background:"#162535", borderRadius:10, padding:"10px 12px", borderLeft:`3px solid ${pb?"#fb923c":"#6b8fa8"}` }}>
                          <div style={{ fontSize:10, color:"#fb923c", marginBottom:6 }}>🔒 PBS</div>
                          {pb?<><div style={{ fontSize:11 }}>{pb.id}</div><div style={{ fontSize:11, color:"#6b8fa8" }}>{pb.bodega_recibe}</div></>:<div style={{ fontSize:11, color:"#f59e0b" }}>Pendiente</div>}
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
        <div style={{ fontFamily:"'Syne',sans-serif", fontSize:20, fontWeight:800 }}>Gestión de Usuarios</div>
        <div style={{ fontSize:11, color:"#6b8fa8" }}>Roles, permisos y accesos · {perfiles.length} usuarios</div>
      </div>
      <Btn color="#ff7eb3" onClick={()=>{setForm({planta:"PLANTA 1",rol:"logistica"});setModal("usuario");}}>+ Nuevo Usuario</Btn>
    </div>
    <div style={{ display:"grid", gap:12 }}>
      {perfiles.map(p=>(
        <Card key={p.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"14px 20px" }}>
          <div style={{ display:"flex", alignItems:"center", gap:16 }}>
            <div style={{ width:40, height:40, background:ROLES[p.rol]?.color+"22", border:`1px solid ${ROLES[p.rol]?.color}44`, borderRadius:10, display:"flex", alignItems:"center", justifyContent:"center", fontSize:18 }}>{ROLES[p.rol]?.icon}</div>
            <div>
              <div style={{ fontWeight:700, fontSize:14 }}>{p.nombre}</div>
              <div style={{ fontSize:11, color:"#6b8fa8" }}>
                Cédula: {p.cedula || (p.email||"").replace("@qbs.internal","") || "—"} · {p.planta}
              </div>
            </div>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <Badge label={ROLES[p.rol]?.label||p.rol} color={ROLES[p.rol]?.color||"#6b8fa8"}/>
            <Btn sm color="#ff7eb3" outline onClick={()=>{
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

        </div>
      </div>

      {/* ═══ MODALS ═══ */}

      {modal==="viaje" && (
        <Modal title={form.id ? `Editar Viaje ${form.id}` : "Registrar Nuevo Viaje"} onClose={()=>setModal(null)} wide>
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

      {modal==="tiquete" && (
        <Modal title={form.id ? `Editar Tiquete ${form.id}` : "Tiquete de Ingreso de Materia Prima"} onClose={()=>setModal(null)} wide>
          <Section title="Identificación" color="#00b4ff">
            <Grid cols={2}>
              <Inp label="Proveedor / Campo Origen" type="text" value={form.proveedor||""} onChange={f("proveedor")}/>
              <Inp label="Producto" type="text" value={form.producto||""} onChange={f("producto")}/>
              <Inp label="Placa" type="text" value={form.placa||""} onChange={f("placa")}/>
              <Inp label="Cédula Conductor" type="text" value={form.cedula||""} onChange={f("cedula")}/>
              <Inp label="Fecha Cargue" type="date" value={form.fecha_cargue||""} onChange={f("fecha_cargue")}/>
              <Inp label="Fecha Llegada" type="date" value={form.fecha_llegada||today()} onChange={f("fecha_llegada")}/>
            </Grid>
          </Section>
          <Section title="Análisis" color="#00b4ff">
            <Grid cols={9}>
              <Inp label="API Reportado" type="number" step="0.1" value={form.api_reportado||""} onChange={f("api_reportado")}/>
              <Inp label="API Observado" type="number" step="0.1" value={form.api_observado||""} onChange={f("api_observado")}/>
              <Inp label="API Corregido 60°F" type="number" step="0.1" value={form.api_corregido||""} onChange={e=>{
                const api = Number(e.target.value||0);
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
              <Inp label="Factor VCF" type="number" step="0.0001" value={form.factor_conversion||""} onChange={f("factor_conversion")}/>
              <Inp label="Factor Tabla 13" type="number" step="0.0001" value={form.factor_tabla13||""} onChange={f("factor_tabla13")}/>
              <Inp label="Azufre (%)" type="number" step="0.001" value={form.azufre||""} onChange={f("azufre")}/>
              <Inp label="TSA" type="number" step="0.01" value={form.tsa||""} onChange={f("tsa")}/>
            </Grid>
          </Section>
          <Section title="Pesos y Galones" color="#00b4ff">
            <Grid cols={4}>
              <Inp label="Peso Ingreso (Kg)" type="number" value={form.peso_ingreso||""} onChange={f("peso_ingreso")}/>
              <Inp label="Peso Salida (Kg)" type="number" value={form.peso_salida||""} onChange={f("peso_salida")}/>
              <Inp label="Galones Reportados" type="number" value={form.galones_reportados||""} onChange={f("galones_reportados")}/>
              <Inp label="Galones Recibidos" type="number" value={form.galones_recibidos||""} onChange={f("galones_recibidos")}/>
            </Grid>
          </Section>
          <Section title="Calidad" color="#00b4ff">
            <Grid cols={3}>
              <Inp label="Agua Destilación (%)" type="number" step="0.01" value={form.agua_destilacion||""} onChange={f("agua_destilacion")}/>
              <Inp label="Flash Point (°C)" type="number" value={form.flash_point||""} onChange={f("flash_point")}/>
              <Inp label="Viscosidad 50°C (cSt)" type="number" step="0.1" value={form.viscosidad||""} onChange={f("viscosidad")}/>
            </Grid>
          </Section>
          <Section title="Descargue" color="#00b4ff">
            <Grid cols={2}>
              <Sel label="Bodega / Tanque" value={form.bodega||""} onChange={f("bodega")}>
                <option value="">Seleccionar...</option>
                {tanques.map(t=><option key={t.id} value={t.id}>{t.id} · Libre: {fmt(t.capacidad-t.nivel)} Gls</option>)}
              </Sel>
              <Inp label="Factura / Consecutivo SIIGO" type="text" value={form.factura||""} onChange={f("factura")}/>
            </Grid>
            <Inp label="Observaciones" type="text" value={form.observaciones||""} onChange={f("observaciones")}/>
          </Section>
          <div style={{ display:"flex", justifyContent:"flex-end", gap:10 }}>
            <Btn outline onClick={()=>setModal(null)}>Cancelar</Btn>
            <Btn color="#00b4ff" onClick={guardarTiquete} disabled={saving}>{saving?"Guardando...":form.id?"Actualizar Tiquete":"Emitir Tiquete"}</Btn>
          </div>
        </Modal>
      )}

      {modal==="pbs" && (
        <Modal title={form.id ? `Editar PBS ${form.id}` : "Permiso de Bombeo Seguro"} onClose={()=>{ pbsParaCarro!==null ? setModal("cmt") : setModal(null); }} wide>
          <Section title="Encabezado" color="#fb923c">
            <Grid cols={2}>
              <Inp label="Fecha" type="date" value={form.fecha||today()} onChange={f("fecha")}/>
              <Inp label="Responsable Parada Emergencia" type="text" value={form.responsable_emergencia||""} onChange={f("responsable_emergencia")}/>
              <Inp label="Responsable Tanque / Carro que Despacha" type="text" value={form.responsable_despacha||""} onChange={f("responsable_despacha")}/>
              <Inp label="Responsable Tanque / Carro que Recibe" type="text" value={form.responsable_recibe||""} onChange={f("responsable_recibe")}/>
              <Inp label="Nombre Conductor" type="text" value={form.conductor_nombre||""} onChange={f("conductor_nombre")}/>
              <Inp label="RPM / Presión Manómetro" type="text" value={form.rpm_manometro||""} onChange={f("rpm_manometro")}/>
            </Grid>
            <div style={{marginTop:12,display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}>
              <div>
                <Lbl>Tipo de Operación</Lbl>
                <div style={{background:"#162535",borderRadius:8,padding:"8px 12px",fontSize:13,fontFamily:"monospace",color:"#fb923c",fontWeight:700,border:"1px solid #fb923c33"}}>{form.tipo_operacion||"—"}</div>
              </div>
              <div>
                <Lbl>Bodega / Tanque que Recibe</Lbl>
                <div style={{background:"#162535",borderRadius:8,padding:"8px 12px",fontSize:13,fontFamily:"monospace",color:"#dff0f8",border:"1px solid #ffffff14"}}>{form.bodega_recibe||"—"}</div>
              </div>
              <div>
                <Lbl>Bodega / Carrotanque que Despacha</Lbl>
                <div style={{background:"#162535",borderRadius:8,padding:"8px 12px",fontSize:13,fontFamily:"monospace",color:"#dff0f8",border:"1px solid #ffffff14"}}>{form.bodega_despacha||"—"}</div>
              </div>
            </div>
          </Section>
          <Section title="Lista de Chequeo — 27 Puntos" color="#fb923c">
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
                    <div key={i} style={{ background:"#162535", borderRadius:8, padding:"10px 12px", display:"flex", alignItems:"center", justifyContent:"space-between", gap:12 }}>
                      <span style={{ fontSize:11, flex:1 }}><b style={{color:"#fb923c"}}>{i+1}.</b> {p}</span>
                      <div style={{background:"#0f1e2e",borderRadius:6,padding:"6px 14px",fontSize:13,fontFamily:"monospace",fontWeight:700,color:"#00e5a0",border:"1px solid #00e5a033",whiteSpace:"nowrap"}}>
                        {fmt(espacioVacio)} Gls
                      </div>
                    </div>
                  );
                }
                if (i===17) {
                  const totalInicial = cmtAntes.reduce((acc,t)=>acc+Number(t.galones||0),0);
                  return (
                    <div key={i} style={{ background:"#162535", borderRadius:8, padding:"10px 12px", display:"flex", alignItems:"center", justifyContent:"space-between", gap:12 }}>
                      <span style={{ fontSize:11, flex:1 }}><b style={{color:"#fb923c"}}>{i+1}.</b> {p}</span>
                      <div style={{background:"#0f1e2e",borderRadius:6,padding:"6px 14px",fontSize:13,fontFamily:"monospace",fontWeight:700,color:"#f59e0b",border:"1px solid #f59e0b33",whiteSpace:"nowrap"}}>
                        {fmt(totalInicial)} Gls
                      </div>
                    </div>
                  );
                }
                if (i===18) {
                  return (
                    <div key={i} style={{ background:"#162535", borderRadius:8, padding:"10px 12px", display:"flex", alignItems:"center", justifyContent:"space-between", gap:12 }}>
                      <span style={{ fontSize:11, flex:1 }}><b style={{color:"#fb923c"}}>{i+1}.</b> {p}</span>
                      <div style={{display:"flex",alignItems:"center",gap:6}}>
                        <input type="number" min="0" value={pbsChecklist[i]} onChange={e=>{const n=[...pbsChecklist];n[i]=e.target.value;setPbsChecklist(n);}} placeholder="0" style={{ width:110, background:"#0f1e2e", border:"1px solid #ffffff20", borderRadius:6, padding:"5px 10px", color:"#dff0f8", fontSize:13, fontFamily:"monospace", outline:"none", textAlign:"right" }} />
                        <span style={{fontSize:11,color:"#6b8fa8"}}>Gls</span>
                      </div>
                    </div>
                  );
                }
                return (
                  <div key={i} style={{ background:"#162535", borderRadius:8, padding:"10px 12px", display:"flex", alignItems:"center", justifyContent:"space-between", gap:12 }}>
                    <span style={{ fontSize:11, flex:1 }}><b style={{color:"#fb923c"}}>{i+1}.</b> {p}</span>
                    <select value={pbsChecklist[i]} onChange={e=>{const n=[...pbsChecklist];n[i]=e.target.value;setPbsChecklist(n);}} style={{ background:"#0f1e2e", border:"1px solid #ffffff14", borderRadius:6, padding:"4px 8px", color:"#dff0f8", fontSize:12, fontFamily:"monospace", outline:"none", minWidth:70 }}>
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
            <Btn color="#fb923c" onClick={guardarPBS} disabled={saving}>{saving?"Guardando...":form.id?"Actualizar PBS":"Registrar PBS"}</Btn>
          </div>
        </Modal>
      )}

      {modal==="cmt" && (
        <Modal title={form.id ? `Corregir CMT — ${form.numero_cmt}` : "Control de Movimiento de Tanques"} onClose={()=>setModal(null)} wide>
          <div style={{background:"#162535",borderRadius:10,padding:"12px 16px",marginBottom:16,display:"flex",alignItems:"center",gap:24,flexWrap:"wrap"}}>
            <div>
              <div style={{fontSize:10,color:"#6b8fa8",textTransform:"uppercase",letterSpacing:1,marginBottom:2}}>No. CMT</div>
              <div style={{fontFamily:"'Syne',sans-serif",fontSize:20,fontWeight:900,color:"#00e5a0",letterSpacing:2}}>{form.numero_cmt||"—"}</div>
            </div>
            <div>
              <div style={{fontSize:10,color:"#6b8fa8",textTransform:"uppercase",letterSpacing:1,marginBottom:2}}>Sede</div>
              <div style={{fontSize:13,fontWeight:700,color:"#dff0f8"}}>{form.sede||perfil.sede||"MALAMBO"}</div>
            </div>
            {(form.sede||perfil.sede||"MALAMBO")==="MALAMBO" && (
              <div>
                <div style={{fontSize:10,color:"#6b8fa8",textTransform:"uppercase",letterSpacing:1,marginBottom:2}}>Planta</div>
                <div style={{fontSize:13,fontWeight:700,color:"#dff0f8"}}>{form.planta||perfil.planta||"PLANTA 1"}</div>
              </div>
            )}
            <div style={{marginLeft:"auto",fontSize:11,color:"#6b8fa8"}}>Generado automáticamente</div>
          </div>
          <Grid cols={2}>
            <Inp label="Fecha" type="date" value={form.fecha||today()} onChange={f("fecha")}/>
            <Sel label="Tipo de Operación" value={form.tipo_operacion||""} onChange={f("tipo_operacion")}>
              <option value="">Seleccionar...</option>
              <option>DESCARGUE DE CARROTANQUE</option>
              <option>ENTREGA A MOTONAVE</option>
              <option>ENTREGA A CARROTANQUE</option>
              <option>TRASIEGO DE PRODUCTO</option>
              <option>PORTEO</option>
            </Sel>
          </Grid>
          <div style={{marginBottom:18}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10,paddingBottom:6,borderBottom:"1px solid #f59e0b33"}}>
              <span style={{fontSize:11,fontWeight:700,color:"#f59e0b",letterSpacing:1,textTransform:"uppercase"}}>{(form.tipo_operacion||"")==="TRASIEGO DE PRODUCTO"?"Tanque de Despacho":"Medida Inicial"}</span>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <span style={{fontSize:11,color:"#6b8fa8",fontFamily:"monospace"}}>Producto del CMT:</span>
                <input value={cmtProducto} onChange={e=>{
                  const val=e.target.value.toUpperCase();
                  setCmtProducto(val);
                  setCmtDespues(prev=>prev.map(r=>({...r,producto:val})));
                  setCmtAntes(prev=>prev.map(r=>({...r,producto:val})));
                }} placeholder="Ej: VLSFO, MGO..." style={{background:"#162535",border:"1px solid #f59e0b55",borderRadius:8,padding:"6px 12px",color:"#f59e0b",fontSize:12,fontFamily:"monospace",outline:"none",width:180,fontWeight:700,textTransform:"uppercase"}}/>
              </div>
            </div>
            {(()=>{
              const cmtSede = form.sede || (sedeFiltro!=="TODAS"?sedeFiltro:"MALAMBO");
              const cmtPlanta = form.planta || perfil?.planta || "PLANTA 1";
              const tanquesDisponibles = (cmtSede==="MALAMBO" && cmtPlanta==="PLANTA 2") ? tanques : [];
              const esTrasiego = (form.tipo_operacion||"")==="TRASIEGO DE PRODUCTO";
              const inputStyle = { width:"100%", background:"#162535", border:"1px solid #ffffff14", borderRadius:8, padding:"8px 10px", color:"#dff0f8", fontSize:12, fontFamily:"monospace", outline:"none", boxSizing:"border-box" };
              return cmtAntes.map((row,i)=>{
                const rowD = cmtDespues[i]||{};
                return esTrasiego ? (
                <div key={i} style={{background:"#0d1a28",borderRadius:10,padding:"12px 14px",marginBottom:10,border:"1px solid #f59e0b22"}}>
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                      <span style={{fontSize:10,color:"#6b8fa8",textTransform:"uppercase",letterSpacing:1}}>Tanque:</span>
                      <select value={row.tanque} onChange={e=>{
                        const val=e.target.value;
                        const na=[...cmtAntes]; na[i].tanque=val; setCmtAntes(na);
                        setCmtDespues(prev=>{const nd=[...prev]; if(nd[i]) nd[i]={...nd[i],tanque:val}; return nd;});
                        calcularGalones(val,na[i].sonda,na[i].temp,na[i].api,false,i);
                      }} style={{background:"#162535",border:"1px solid #f59e0b44",borderRadius:8,padding:"6px 10px",color:"#f59e0b",fontSize:12,fontFamily:"monospace",outline:"none",fontWeight:700}}>
                        <option value="">—</option>{tanquesDisponibles.map(t=><option key={t.id}>{t.id}</option>)}
                      </select>
                    </div>
                    <button onClick={()=>{setCmtAntes(cmtAntes.filter((_,j)=>j!==i));setCmtDespues(cmtDespues.filter((_,j)=>j!==i));}} style={{background:"#ff4d4d22",border:"1px solid #ff4d4d44",borderRadius:8,color:"#ff4d4d",padding:"4px 10px",cursor:"pointer",fontSize:11}}>✕</button>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"80px 1fr 1fr 1fr 1fr",gap:8,alignItems:"end",marginBottom:6}}>
                    <div style={{fontSize:10,color:"#00b4ff",fontWeight:700,textTransform:"uppercase",paddingBottom:4}}>Medida Inicial</div>
                    <div><Lbl>Sonda</Lbl><input type="number" value={row.sonda||""} onChange={e=>{const n=[...cmtAntes];n[i].sonda=e.target.value;setCmtAntes(n);}} onBlur={e=>calcularGalones(row.tanque,e.target.value,row.temp,row.api,false,i)} style={inputStyle}/></div>
                    <div><Lbl>Temp °C</Lbl><input type="number" step="0.1" placeholder="25" value={row.temp||""} onChange={e=>{const n=[...cmtAntes];n[i].temp=e.target.value;setCmtAntes(n);calcularGalones(n[i].tanque,n[i].sonda,e.target.value,n[i].api,false,i);}} style={inputStyle}/></div>
                    <div><Lbl>API</Lbl><input type="number" step="0.1" placeholder="14" value={row.api||""} onChange={e=>{const n=[...cmtAntes];n[i].api=e.target.value;setCmtAntes(n);calcularGalones(n[i].tanque,n[i].sonda,n[i].temp,e.target.value,false,i);}} style={inputStyle}/></div>
                    <div><Lbl>{row.temp&&row.api?"Galones Netos":"Galones Brutos"}</Lbl><input type="number" value={row.galones||""} onChange={e=>{const n=[...cmtAntes];n[i].galones=e.target.value;setCmtAntes(n);}} style={inputStyle}/></div>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"80px 1fr 1fr 1fr 1fr",gap:8,alignItems:"end"}}>
                    <div style={{fontSize:10,color:"#c084fc",fontWeight:700,textTransform:"uppercase",paddingBottom:4}}>Medida Final</div>
                    <div><Lbl>Sonda</Lbl><input type="number" value={rowD.sonda||""} onChange={e=>{const n=[...cmtDespues];n[i]={...n[i],sonda:e.target.value};setCmtDespues(n);}} onBlur={e=>calcularGalones(row.tanque,e.target.value,rowD.temp,rowD.api,true,i)} style={inputStyle}/></div>
                    <div><Lbl>Temp °C</Lbl><input type="number" step="0.1" placeholder="25" value={rowD.temp||""} onChange={e=>{const n=[...cmtDespues];n[i]={...n[i],temp:e.target.value};setCmtDespues(n);calcularGalones(row.tanque,rowD.sonda,e.target.value,rowD.api,true,i);}} style={inputStyle}/></div>
                    <div><Lbl>API</Lbl><input type="number" step="0.1" placeholder="14" value={rowD.api||""} onChange={e=>{const n=[...cmtDespues];n[i]={...n[i],api:e.target.value};setCmtDespues(n);calcularGalones(row.tanque,rowD.sonda,rowD.temp,e.target.value,true,i);}} style={inputStyle}/></div>
                    <div><Lbl>{rowD.temp&&rowD.api?"Galones Netos":"Galones Brutos"}</Lbl><input type="number" value={rowD.galones||""} onChange={e=>{const n=[...cmtDespues];n[i]={...n[i],galones:e.target.value};setCmtDespues(n);}} style={inputStyle}/></div>
                  </div>
                </div>
                ) : (
                <div key={i} style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr 1fr auto", gap:8, marginBottom:8, alignItems:"end" }}>
                  <div><Lbl>Tanque</Lbl>
                  <select value={row.tanque} onChange={e=>{
                    const val=e.target.value;
                    const na=[...cmtAntes]; na[i].tanque=val; setCmtAntes(na);
                    setCmtDespues(prev=>{const nd=[...prev]; if(nd[i]) nd[i]={...nd[i],tanque:val}; return nd;});
                    calcularGalones(val,na[i].sonda,na[i].temp,na[i].api,false,i);
                  }} style={{ width:"100%", background:"#162535", border:"1px solid #ffffff14", borderRadius:8, padding:"8px 10px", color:"#dff0f8", fontSize:12, fontFamily:"monospace", outline:"none" }}><option value="">—</option>{tanquesDisponibles.map(t=><option key={t.id}>{t.id}</option>)}</select>
                  </div>
                  <div><Lbl>Sonda</Lbl><input type="number" value={row.sonda} onChange={e=>{const n=[...cmtAntes];n[i].sonda=e.target.value;setCmtAntes(n);}} onBlur={e=>{const idx=i;calcularGalones(row.tanque,e.target.value,row.temp,row.api,false,idx);}} style={inputStyle}/></div>
                  <div><Lbl>Temp °C</Lbl><input type="number" step="0.1" placeholder="25" value={row.temp||""} onChange={e=>{const n=[...cmtAntes];n[i].temp=e.target.value;setCmtAntes(n);calcularGalones(n[i].tanque,n[i].sonda,e.target.value,n[i].api,false,i);}} style={inputStyle}/></div>
                  <div><Lbl>API</Lbl><input type="number" step="0.1" placeholder="14" value={row.api||""} onChange={e=>{const n=[...cmtAntes];n[i].api=e.target.value;setCmtAntes(n);calcularGalones(n[i].tanque,n[i].sonda,n[i].temp,e.target.value,false,i);}} style={inputStyle}/></div>
                  <div><Lbl>{row.temp&&row.api?"Galones Netos":"Galones Brutos"}</Lbl><input type="number" value={row.galones} onChange={e=>{const n=[...cmtAntes];n[i].galones=e.target.value;setCmtAntes(n);}} style={inputStyle}/></div>
                  <button onClick={()=>{setCmtAntes(cmtAntes.filter((_,j)=>j!==i));setCmtDespues(cmtDespues.filter((_,j)=>j!==i));}} style={{ background:"#ff4d4d22", border:"1px solid #ff4d4d44", borderRadius:8, color:"#ff4d4d", padding:"8px 10px", cursor:"pointer", fontSize:12 }}>✕</button>
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
              const inputStyle = { width:"100%", background:"#162535", border:"1px solid #ffffff14", borderRadius:8, padding:"8px 10px", color:"#dff0f8", fontSize:12, fontFamily:"monospace", outline:"none", boxSizing:"border-box" };
              return cmtRecepcion.map((rec,i)=>(
                <div key={i} style={{background:"#0d1a28",borderRadius:10,padding:"12px 14px",marginBottom:10,border:"1px solid #00e5a022"}}>
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                      <span style={{fontSize:10,color:"#6b8fa8",textTransform:"uppercase",letterSpacing:1}}>Tanque:</span>
                      <select value={rec.tanque} onChange={e=>{const n=[...cmtRecepcion];n[i]={...n[i],tanque:e.target.value};setCmtRecepcion(n);}} style={{background:"#162535",border:"1px solid #00e5a044",borderRadius:8,padding:"6px 10px",color:"#00e5a0",fontSize:12,fontFamily:"monospace",outline:"none",fontWeight:700}}>
                        <option value="">—</option>{tanquesDisponibles.map(t=><option key={t.id}>{t.id}</option>)}
                      </select>
                    </div>
                    <button onClick={()=>setCmtRecepcion(cmtRecepcion.filter((_,j)=>j!==i))} style={{background:"#ff4d4d22",border:"1px solid #ff4d4d44",borderRadius:8,color:"#ff4d4d",padding:"4px 10px",cursor:"pointer",fontSize:11}}>✕</button>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"80px 1fr 1fr 1fr 1fr",gap:8,alignItems:"end",marginBottom:6}}>
                    <div style={{fontSize:10,color:"#00b4ff",fontWeight:700,textTransform:"uppercase",paddingBottom:4}}>Medida Inicial</div>
                    <div><Lbl>Sonda</Lbl><input type="number" value={rec.sondaInicial||""} onChange={e=>{const n=[...cmtRecepcion];n[i]={...n[i],sondaInicial:e.target.value};setCmtRecepcion(n);}} onBlur={e=>calcularGalonesConSetter(rec.tanque,e.target.value,rec.tempInicial,rec.apiInicial,i,setCmtRecepcion,"galonesInicial")} style={inputStyle}/></div>
                    <div><Lbl>Temp °C</Lbl><input type="number" step="0.1" placeholder="25" value={rec.tempInicial||""} onChange={e=>{const n=[...cmtRecepcion];n[i]={...n[i],tempInicial:e.target.value};setCmtRecepcion(n);}} onBlur={e=>calcularGalonesConSetter(rec.tanque,rec.sondaInicial,e.target.value,rec.apiInicial,i,setCmtRecepcion,"galonesInicial")} style={inputStyle}/></div>
                    <div><Lbl>API</Lbl><input type="number" step="0.1" placeholder="14" value={rec.apiInicial||""} onChange={e=>{const n=[...cmtRecepcion];n[i]={...n[i],apiInicial:e.target.value};setCmtRecepcion(n);}} onBlur={e=>calcularGalonesConSetter(rec.tanque,rec.sondaInicial,rec.tempInicial,e.target.value,i,setCmtRecepcion,"galonesInicial")} style={inputStyle}/></div>
                    <div><Lbl>{rec.tempInicial&&rec.apiInicial?"Galones Netos":"Galones Brutos"}</Lbl><input type="number" value={rec.galonesInicial||""} onChange={e=>{const n=[...cmtRecepcion];n[i]={...n[i],galonesInicial:e.target.value};setCmtRecepcion(n);}} style={inputStyle}/></div>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"80px 1fr 1fr 1fr 1fr",gap:8,alignItems:"end"}}>
                    <div style={{fontSize:10,color:"#c084fc",fontWeight:700,textTransform:"uppercase",paddingBottom:4}}>Medida Final</div>
                    <div><Lbl>Sonda</Lbl><input type="number" value={rec.sondaFinal||""} onChange={e=>{const n=[...cmtRecepcion];n[i]={...n[i],sondaFinal:e.target.value};setCmtRecepcion(n);}} onBlur={e=>calcularGalonesConSetter(rec.tanque,e.target.value,rec.tempFinal,rec.apiFinal,i,setCmtRecepcion,"galonesFinal")} style={inputStyle}/></div>
                    <div><Lbl>Temp °C</Lbl><input type="number" step="0.1" placeholder="25" value={rec.tempFinal||""} onChange={e=>{const n=[...cmtRecepcion];n[i]={...n[i],tempFinal:e.target.value};setCmtRecepcion(n);}} onBlur={e=>calcularGalonesConSetter(rec.tanque,rec.sondaFinal,e.target.value,rec.apiFinal,i,setCmtRecepcion,"galonesFinal")} style={inputStyle}/></div>
                    <div><Lbl>API</Lbl><input type="number" step="0.1" placeholder="14" value={rec.apiFinal||""} onChange={e=>{const n=[...cmtRecepcion];n[i]={...n[i],apiFinal:e.target.value};setCmtRecepcion(n);}} onBlur={e=>calcularGalonesConSetter(rec.tanque,rec.sondaFinal,rec.tempFinal,e.target.value,i,setCmtRecepcion,"galonesFinal")} style={inputStyle}/></div>
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
                <span style={{fontSize:11,color:"#6b8fa8",fontFamily:"monospace"}}>Producto:</span>
                <div style={{background:"#0d1a28",border:"1px solid #00e5a033",borderRadius:8,padding:"6px 14px",fontSize:12,fontFamily:"monospace",color:"#00e5a0",fontWeight:700,minWidth:180}}>{cmtProducto||"—"}</div>
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
              <div key={i} style={{marginBottom:12}}>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr 1fr", gap:8, alignItems:"end" }}>
                  <div>
                    <Lbl>Tanque</Lbl>
                    <div style={{background:"#0d1a28",border:"1px solid #00e5a033",borderRadius:8,padding:"8px 10px",fontSize:12,fontFamily:"monospace",color:"#00e5a0",fontWeight:700}}>{row.tanque||"—"}</div>
                  </div>
                  <div><Lbl>Sonda</Lbl><input type="number" value={row.sonda} onChange={e=>{const n=[...cmtDespues];n[i].sonda=e.target.value;setCmtDespues(n);}} onBlur={e=>{calcularGalones(row.tanque,e.target.value,row.temp,row.api,true,i);}} style={{ width:"100%", background:"#162535", border:"1px solid #ffffff14", borderRadius:8, padding:"8px 10px", color:"#dff0f8", fontSize:12, fontFamily:"monospace", outline:"none", boxSizing:"border-box" }}/></div>
                  <div><Lbl>Temp °C</Lbl><input type="number" step="0.1" placeholder="25" value={row.temp||""} onChange={e=>{const n=[...cmtDespues];n[i].temp=e.target.value;setCmtDespues(n);calcularGalones(n[i].tanque,n[i].sonda,e.target.value,n[i].api,true,i);}} style={{width:"100%",background:"#162535",border:"1px solid #ffffff14",borderRadius:8,padding:"8px 10px",color:"#dff0f8",fontSize:12,fontFamily:"monospace",outline:"none",boxSizing:"border-box"}}/></div>
                  <div><Lbl>API</Lbl><input type="number" step="0.1" placeholder="14" value={row.api||""} onChange={e=>{const n=[...cmtDespues];n[i].api=e.target.value;setCmtDespues(n);calcularGalones(n[i].tanque,n[i].sonda,n[i].temp,e.target.value,true,i);}} style={{width:"100%",background:"#162535",border:"1px solid #ffffff14",borderRadius:8,padding:"8px 10px",color:"#dff0f8",fontSize:12,fontFamily:"monospace",outline:"none",boxSizing:"border-box"}}/></div>
                  <div><Lbl>{row.temp&&row.api?"Galones Netos":"Galones Brutos"}</Lbl><input type="number" value={row.galones} onChange={e=>{const n=[...cmtDespues];n[i].galones=e.target.value;setCmtDespues(n);}} style={{ width:"100%", background:"#162535", border:`1px solid ${excede?"#ff4d4d44":"#ffffff14"}`, borderRadius:8, padding:"8px 10px", color: excede?"#ff4d4d":"#dff0f8", fontSize:12, fontFamily:"monospace", outline:"none", boxSizing:"border-box" }}/></div>
                </div>
                {espacioDisponible !== null && row.tanque && (()=>{
                  const capTotal = capMaxOp / 0.9;
                  const pctActual = capTotal > 0 ? Math.round((galonesIniciales / capTotal) * 100) : 0;
                  const enAlerta = galonesIniciales >= capMaxOp;
                  return (
                    <div style={{marginTop:5,padding:"6px 10px",background:"#061520",borderRadius:6,display:"flex",alignItems:"center",gap:16,flexWrap:"wrap"}}>
                      <span style={{fontSize:11,color:"#6b8fa8"}}>Espacio disponible: <b style={{color: enAlerta?"#ff4d4d":"#00e5a0"}}>{fmt(Math.max(0,espacioDisponible))} Gls</b></span>
                      {enAlerta && (
                        <span style={{fontSize:11,fontWeight:800,color:"#ff4d4d",background:"#2a0a0a",border:"1px solid #ff4d4d55",borderRadius:6,padding:"2px 10px",letterSpacing:0.5}}>
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
          {(form.tipo_operacion||"")==="DESCARGUE DE CARROTANQUE" && <Section title="Carros Descargados" color="#6b8fa8">
            <div style={{fontSize:11,color:"#6b8fa8",marginBottom:10}}>Un registro por cada carro descargado en este CMT</div>
            {cmtCarros.map((carro,i)=>(
              <div key={i} style={{background:"#0d1a28",borderRadius:10,padding:"12px 14px",marginBottom:12,border:"1px solid #ffffff0a"}}>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:8}}>
                  <div><Lbl>Placa</Lbl><input type="text" placeholder="Ej: ABC123" maxLength={6} value={carro.placa} onChange={e=>{const n=[...cmtCarros];n[i].placa=e.target.value.toUpperCase().replace(/\s/g,"");setCmtCarros(n);}} style={{width:"100%",background:"#162535",border:"1px solid #ffffff14",borderRadius:8,padding:"8px 10px",color:"#dff0f8",fontSize:12,fontFamily:"monospace",outline:"none",boxSizing:"border-box",textTransform:"uppercase"}}/></div>
                  <div><Lbl>Guía</Lbl><input type="text" value={carro.guia} onChange={e=>{const n=[...cmtCarros];n[i].guia=e.target.value.toUpperCase();setCmtCarros(n);}} style={{width:"100%",background:"#162535",border:"1px solid #ffffff14",borderRadius:8,padding:"8px 10px",color:"#dff0f8",fontSize:12,fontFamily:"monospace",outline:"none",boxSizing:"border-box",textTransform:"uppercase"}}/></div>
                  <div><Lbl>Tiquete</Lbl><input type="text" value={carro.tiquete} onChange={e=>{const n=[...cmtCarros];n[i].tiquete=e.target.value.toUpperCase();setCmtCarros(n);}} style={{width:"100%",background:"#162535",border:"1px solid #ffffff14",borderRadius:8,padding:"8px 10px",color:"#dff0f8",fontSize:12,fontFamily:"monospace",outline:"none",boxSizing:"border-box",textTransform:"uppercase"}}/></div>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:8,alignItems:"end"}}>
                  <div><Lbl>Hora Inicio</Lbl><input type="time" value={carro.hora_inicio||""} onChange={e=>{const n=[...cmtCarros];n[i].hora_inicio=e.target.value;setCmtCarros(n);}} style={{width:"100%",background:"#162535",border:"1px solid #ffffff14",borderRadius:8,padding:"8px 10px",color:"#dff0f8",fontSize:12,fontFamily:"monospace",outline:"none",boxSizing:"border-box"}}/></div>
                  <div><Lbl>Hora Final</Lbl><input type="time" value={carro.hora_final||""} onChange={e=>{const n=[...cmtCarros];n[i].hora_final=e.target.value;setCmtCarros(n);}} style={{width:"100%",background:"#162535",border:"1px solid #ffffff14",borderRadius:8,padding:"8px 10px",color:"#dff0f8",fontSize:12,fontFamily:"monospace",outline:"none",boxSizing:"border-box"}}/></div>
                  <div><Lbl>Peso Neto</Lbl><input type="text" placeholder="Kg" value={carro.peso_neto||""} onChange={e=>{const n=[...cmtCarros];n[i].peso_neto=e.target.value.toUpperCase();setCmtCarros(n);}} style={{width:"100%",background:"#162535",border:"1px solid #ffffff14",borderRadius:8,padding:"8px 10px",color:"#dff0f8",fontSize:12,fontFamily:"monospace",outline:"none",boxSizing:"border-box",textTransform:"uppercase"}}/></div>
                  <div><Lbl>PBS</Lbl><div style={{background:"#162535",border:`1px solid ${carro.pbs_id?"#fb923c44":"#ffffff14"}`,borderRadius:8,padding:"8px 10px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:6}}>{carro.pbs_id?<span style={{fontSize:11,color:"#fb923c",fontFamily:"monospace"}}>{carro.pbs_id}</span>:<span style={{fontSize:11,color:"#6b8fa8"}}>Sin PBS</span>}<button onClick={()=>{
                    const tanquesRecibe = cmtDespues.filter(t=>t.tanque).map(t=>t.tanque).join(", ");
                    setCmtSnapshot({form:{...form}, cmtAntes:[...cmtAntes], cmtDespues:[...cmtDespues], cmtCarros:[...cmtCarros], cmtProducto, cmtRecepcion:[...cmtRecepcion]});
                    setPbsParaCarro(i);
                    setForm({
                      tipo_operacion: form.tipo_operacion||"",
                      bodega_recibe: tanquesRecibe,
                      bodega_despacha: carro.placa||"",
                      conductor_nombre: carro.conductor||"",
                    });
                    setPbsChecklist(Array(27).fill(""));
                    setModal("pbs");
                  }} style={{background:"#fb923c",border:"none",borderRadius:6,color:"#071422",padding:"4px 8px",cursor:"pointer",fontSize:10,fontWeight:700,whiteSpace:"nowrap"}}>+ PBS</button></div></div>
                </div>
                <div style={{display:"flex",justifyContent:"flex-end",marginTop:8}}>
                  <button onClick={()=>setCmtCarros(cmtCarros.filter((_,j)=>j!==i))} style={{background:"#ff4d4d22",border:"1px solid #ff4d4d44",borderRadius:8,color:"#ff4d4d",padding:"5px 14px",cursor:"pointer",fontSize:11,fontFamily:"monospace"}}>✕ Eliminar carro</button>
                </div>
              </div>
            ))}
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:4}}>
              <Btn sm outline color="#6b8fa8" onClick={()=>setCmtCarros([...cmtCarros,{placa:"",guia:"",tiquete:"",pbs_id:"",hora_inicio:"",hora_final:"",peso_neto:""}])}>+ Agregar Carro</Btn>
              <span style={{fontSize:11,color:"#6b8fa8"}}>{cmtCarros.length} carro(s)</span>
            </div>
            {form.tipo_operacion==="Entrega a motonave" && (
              <div style={{marginTop:14}}>
                <Inp label="Nombre Motonave" type="text" value={form.nombre_motonave||""} onChange={f("nombre_motonave")}/>
              </div>
            )}
          </Section>}
          {(form.tipo_operacion||"")==="TRASIEGO DE PRODUCTO" && (
            <Section title="Permiso de Bombeo Seguro" color="#fb923c">
              <div style={{display:"flex",alignItems:"center",gap:12}}>
                <div style={{flex:1,background:"#162535",border:`1px solid ${form.pbs_id?"#fb923c44":"#ffffff14"}`,borderRadius:8,padding:"10px 14px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                  {form.pbs_id
                    ? <span style={{fontSize:12,color:"#fb923c",fontFamily:"monospace",fontWeight:700}}>{form.pbs_id}</span>
                    : <span style={{fontSize:12,color:"#6b8fa8"}}>Sin PBS vinculado</span>}
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
                  }} style={{background:"#fb923c",border:"none",borderRadius:6,color:"#071422",padding:"5px 12px",cursor:"pointer",fontSize:11,fontWeight:700}}>
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
                <div style={{ fontSize:11, color:"#6b8fa8", marginTop:4 }}>
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
        <Modal title={form.id ? `Editar Despacho ${form.id}` : "Registrar Despacho a Buque"} onClose={()=>setModal(null)} wide>
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
    <Modal title="Registrar Llegada a Planta" onClose={()=>{setModal(null);setForm({});}}>
      <div style={{marginBottom:14,position:"relative"}}>
        <Lbl>Buscar Carro por Placa, Guía o Producto</Lbl>
        <input
          autoFocus
          value={form._busqueda !== undefined ? form._busqueda : (selViaje ? `${selViaje.placa} · ${selViaje.producto}` : "")}
          onChange={e=>setForm(p=>({...p,_busqueda:e.target.value,viaje_id:""}))}
          placeholder="Ej: WOM853, FRONTERA, guía 123..."
          style={{width:"100%",background:"#0f1e2e",border:"1px solid #ffffff22",borderRadius:8,padding:"10px 12px",color:"#dff0f8",fontSize:13,fontFamily:"monospace",outline:"none",boxSizing:"border-box"}}
        />
        {form._busqueda && !form.viaje_id && (()=>{
          const q = form._busqueda.toLowerCase();
          const matches = enRuta.filter(v=>
            (v.placa||"").toLowerCase().includes(q) ||
            (v.producto||"").toLowerCase().includes(q) ||
            (v.guia||"").toLowerCase().includes(q) ||
            (v.conductor||"").toLowerCase().includes(q)
          ).slice(0,8);
          if(!matches.length) return <div style={{position:"absolute",top:"100%",left:0,right:0,background:"#0d1f30",border:"1px solid #ffffff14",borderRadius:"0 0 10px 10px",padding:"10px 14px",fontSize:12,color:"#6b8fa8",zIndex:50}}>Sin resultados</div>;
          return (
            <div style={{position:"absolute",top:"100%",left:0,right:0,background:"#0d1f30",border:"1px solid #ffffff14",borderTop:"none",borderRadius:"0 0 10px 10px",zIndex:50,overflow:"hidden",boxShadow:"0 8px 24px #000c"}}>
              {matches.map(v=>(
                <div key={v.id} onClick={()=>setForm(p=>({...p,viaje_id:v.id,_busqueda:undefined}))}
                  style={{padding:"10px 14px",cursor:"pointer",display:"grid",gridTemplateColumns:"auto 1fr auto",gap:"0 12px",alignItems:"center",borderBottom:"1px solid #ffffff08",transition:"background 0.1s"}}
                  onMouseEnter={e=>e.currentTarget.style.background="#ffffff0d"}
                  onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                  <span style={{background:"#f59e0b18",border:"1px solid #f59e0b44",borderRadius:6,padding:"3px 9px",color:"#f59e0b",fontWeight:700,fontSize:12,letterSpacing:1}}>{v.placa}</span>
                  <span style={{color:"#c8dce8",fontSize:12}}>{v.producto}</span>
                  <span style={{color:"#6b8fa8",fontSize:11}}>{v.fecha}</span>
                </div>
              ))}
            </div>
          );
        })()}
      </div>
      {selViaje && (
        <div style={{background:"#0d1f30",borderRadius:10,padding:"12px 16px",marginBottom:14,fontSize:12,display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
          <div><span style={{color:"#6b8fa8"}}>Placa: </span><b style={{color:"#f59e0b"}}>{selViaje.placa}</b></div>
          <div><span style={{color:"#6b8fa8"}}>Producto: </span>{selViaje.producto}</div>
          <div><span style={{color:"#6b8fa8"}}>Transportadora: </span>{selViaje.transportadora}</div>
          <div><span style={{color:"#6b8fa8"}}>F. Cargue: </span>{selViaje.fecha}</div>
          <div><span style={{color:"#6b8fa8"}}>Guía: </span>{selViaje.guia||"—"}</div>
          <div><span style={{color:"#6b8fa8"}}>Conductor: </span>{selViaje.conductor||"—"}</div>
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
          style={{width:"100%",background:"#0f1e2e",border:"1px solid #ffffff22",borderRadius:8,padding:"10px 12px",color:"#dff0f8",fontSize:12,fontFamily:"monospace",outline:"none",resize:"vertical",boxSizing:"border-box"}}/>
      </div>
      <Btn disabled={!form.viaje_id||!form.fecha_llegada||saving} onClick={async()=>{
        if(!form.viaje_id){showToast("Selecciona un carro primero",false);return;}
        setSaving(true);
        const viajeTarget = enRuta.find(v=>v.id===form.viaje_id);
        // Calcular siguiente turno: máximo turno_planta actual + 1
        const {data:turnos} = await supabase.from("viajes").select("turno_planta").not("turno_planta","is",null);
        const maxTurno = turnos&&turnos.length>0 ? Math.max(...turnos.map(t=>t.turno_planta||0)) : 0;
        const {error, data} = await supabase.from("viajes").update({
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
  const cedula = editUsuario.cedula || (editUsuario.email||"").replace("@qbs.internal","");
  return (
    <Modal title={`Gestionar Usuario — ${editUsuario.nombre}`} onClose={()=>setEditUsuario(null)} wide>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12,marginBottom:18}}>
        <div>
          <Lbl>Cédula</Lbl>
          <div style={{background:"#162535",borderRadius:8,padding:"8px 12px",fontSize:13,fontFamily:"monospace",color:"#dff0f8"}}>{cedula||"—"}</div>
        </div>
        <div>
          <Lbl>Rol</Lbl>
          <select value={editUsuario.rol} onChange={e=>setEditUsuario(u=>({...u,rol:e.target.value}))}
            style={{width:"100%",background:"#162535",border:"1px solid #ffffff14",borderRadius:8,padding:"8px 12px",color:"#dff0f8",fontSize:13,fontFamily:"monospace",outline:"none"}}>
            {Object.entries(ROLES).map(([k,v])=><option key={k} value={k}>{v.icon} {v.label}</option>)}
          </select>
        </div>
        <div>
          <Lbl>Sede</Lbl>
          <select value={editUsuario.sede||"MALAMBO"} onChange={e=>setEditUsuario(u=>({...u,sede:e.target.value}))}
            style={{width:"100%",background:"#162535",border:"1px solid #ffffff14",borderRadius:8,padding:"8px 12px",color:"#dff0f8",fontSize:13,fontFamily:"monospace",outline:"none"}}>
            {SEDES.map(s=><option key={s}>{s}</option>)}
          </select>
        </div>
      </div>
      {(editUsuario.sede||"MALAMBO")==="MALAMBO" && (
        <div style={{marginBottom:18}}>
          <Lbl>Planta</Lbl>
          <select value={editUsuario.planta||"PLANTA 1"} onChange={e=>setEditUsuario(u=>({...u,planta:e.target.value}))}
            style={{width:"100%",background:"#162535",border:"1px solid #ffffff14",borderRadius:8,padding:"8px 12px",color:"#dff0f8",fontSize:13,fontFamily:"monospace",outline:"none"}}>
            {PLANTAS.map(pl=><option key={pl}>{pl}</option>)}
          </select>
        </div>
      )}

      <div style={{fontSize:11,fontWeight:700,color:"#6b8fa8",letterSpacing:1,textTransform:"uppercase",marginBottom:10,paddingBottom:6,borderBottom:"1px solid #ffffff14"}}>Permisos por Módulo</div>
      <div style={{overflowX:"auto",marginBottom:18}}>
        <table style={{width:"100%",borderCollapse:"collapse",fontFamily:"monospace",fontSize:12}}>
          <thead>
            <tr style={{background:"#162535"}}>
              <th style={{padding:"10px 14px",textAlign:"left",color:"#6b8fa8",fontSize:10,textTransform:"uppercase",width:140}}>Módulo</th>
              {ACCIONES.map(a=><th key={a} style={{padding:"10px 14px",textAlign:"center",color:COLOR_ACCION[a],fontSize:10,textTransform:"uppercase"}}>{a}</th>)}
            </tr>
          </thead>
          <tbody>
            {MODS.map(mod=>(
              <tr key={mod} style={{borderTop:"1px solid #ffffff07"}}>
                <td style={{padding:"10px 14px",color:"#dff0f8",textTransform:"capitalize",fontWeight:600}}>{mod}</td>
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
        <Btn outline color="#ff4d4d" sm onClick={async()=>{
          if (!confirm(`¿Eliminar a ${editUsuario.nombre}? Esta acción no se puede deshacer.`)) return;
          const {error} = await supabase.from("perfiles").delete().eq("id",editUsuario.id);
          if (error) return showToast("Error: "+error.message, false);
          await loadData(); setEditUsuario(null);
          showToast(`Usuario ${editUsuario.nombre} eliminado`);
        }}>🗑 Eliminar Usuario</Btn>
        <div style={{display:"flex",gap:10}}>
          <Btn outline onClick={()=>setEditUsuario(null)}>Cancelar</Btn>
          <Btn color="#ff7eb3" disabled={saving} onClick={async()=>{
            setSaving(true);
            const {error} = await supabase.from("perfiles").update({
              rol:editUsuario.rol, sede:editUsuario.sede||"MALAMBO", planta:editUsuario.planta||"PLANTA 1", permisos:permsEdit
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

{modal==="usuario" && (
  <Modal title="Crear Nuevo Usuario" onClose={()=>setModal(null)} wide>
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
    {(form.sede||"MALAMBO")==="MALAMBO" && (
      <Sel label="Planta" value={form.planta||"PLANTA 1"} onChange={f("planta")}>
        {PLANTAS.map(p=><option key={p}>{p}</option>)}
      </Sel>
    )}
    {form.cedula && form.password && (
      <div style={{background:"#00e5a018",border:"1px solid #00e5a033",borderRadius:8,padding:"10px 14px",fontSize:12,marginBottom:8}}>
        <b style={{color:"#00e5a0"}}>Datos de acceso a entregar:</b>&nbsp; Usuario: <b>{form.cedula}</b> &nbsp;·&nbsp; Clave: <b>{form.password}</b>
      </div>
    )}
    <div style={{ display:"flex", justifyContent:"flex-end", gap:10, marginTop:12 }}>
      <Btn outline onClick={()=>setModal(null)}>Cancelar</Btn>
      <Btn color="#ff7eb3" disabled={saving} onClick={async()=>{
        if (!form.cedula||!form.password||!form.nombre) return showToast("Completa nombre, cédula y contraseña", false);
        setSaving(true);
        const emailFinal = cedulaToEmail(form.cedula);
        const {error} = await supabase.auth.signUp({
          email:emailFinal, password:form.password,
          options:{data:{nombre:form.nombre, rol:form.rol, planta:form.planta, sede:form.sede||"MALAMBO", cedula:form.cedula}}
        });
        setSaving(false);
        if (error) return showToast("Error: "+error.message, false);
        await loadData(); setModal(null); setForm({});
        showToast(`Usuario ${form.nombre} creado · Cédula: ${form.cedula}`);
      }}>{saving?"Creando...":"Crear Usuario"}</Btn>
    </div>
  </Modal>
)}

    </div>
  );
}