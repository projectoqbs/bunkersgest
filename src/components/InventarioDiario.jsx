// InventarioDiario.jsx
import { useState, useEffect, useCallback } from 'react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, ReferenceLine, Cell
} from 'recharts';
import {
  TB, TK, M3_TO_GAL, TANQUES_BARCAZA, TANQUES_TKT,
  interpolarBarcaza, interpolarTKT, calcVCF, calcF13, pfn, fmtN
} from '../utils/calibracion.js';

const TH = {
  navy:"#003B73", orange:"#0077CC", success:"#00B894",
  danger:"#D63031", bg:"#f0f4f8", text:"#121212", card:"#ffffff",
  border:"#d1d9e0", muted:"#6E7781", warn:"#f59e0b",
};

const TANQUES_P2 = ["TK-111","TK-112","TK-113","TK-114","TK-115","TK-116","TK-117"];
const TOLERANCIA_PCT = 0.5;

// Paleta de colores para las líneas/barras por tanque
const COLORES_TANQUE = [
  "#0077CC","#00B894","#f59e0b","#D63031","#6C5CE7","#00cec9",
  "#e17055","#a29bfe","#55efc4","#fdcb6e","#74b9ff","#fd79a8",
];

function Btn({children, onClick, color, sm, disabled}){
  const bg = color||TH.orange;
  return <button onClick={onClick} disabled={disabled} style={{background:bg,color:"#fff",border:"2px solid "+bg,borderRadius:6,padding:sm?"5px 14px":"9px 22px",fontWeight:700,fontSize:sm?11:13,cursor:disabled?"not-allowed":"pointer",opacity:disabled?0.5:1,whiteSpace:"nowrap",fontFamily:"system-ui,sans-serif"}}>{children}</button>;
}

function NumInput({value, onChange, placeholder="0", disabled}){
  return (
    <input type="text" inputMode="decimal" value={value} onChange={onChange}
      placeholder={placeholder} disabled={disabled}
      style={{width:"100%",background:disabled?"#f5f7fa":TH.card,border:"1px solid "+TH.border,
        borderRadius:4,padding:"5px 7px",color:TH.text,fontSize:12,outline:"none",
        boxSizing:"border-box",textAlign:"right",fontFamily:"monospace"}}/>
  );
}

function mkTrim(popa, proa){
  const po=pfn(popa)||0, pr=pfn(proa)||0;
  const val=Math.abs(po-pr);
  const dir=po>pr?"POPA":pr>po?"PROA":"CERO";
  return{val,dir};
}

function calcBarcaza(tanqueKey, sonda, temp, api, trim){
  const tabla=TB[tanqueKey]; if(!tabla) return null;
  const sv=pfn(sonda),tv=pfn(temp),av=pfn(api);
  if(isNaN(sv)) return null;
  const m3=interpolarBarcaza(tabla,sv,trim.val,trim.dir);
  if(m3===null) return null;
  const glsB=m3*M3_TO_GAL;
  const vcf=(!isNaN(tv)&&!isNaN(av))?calcVCF(av,tv):null;
  return{glsB:Math.round(glsB),glsN:Math.round(vcf?glsB*vcf:glsB)};
}

function calcTKT(tanqueKey, sonda, temp, api){
  const tabla=TK[tanqueKey]; if(!tabla) return null;
  const sv=pfn(sonda),tv=pfn(temp),av=pfn(api);
  if(isNaN(sv)) return null;
  const glsB=interpolarTKT(tabla,sv)*M3_TO_GAL;
  const vcf=(!isNaN(tv)&&!isNaN(av))?calcVCF(av,tv):null;
  return{glsB:Math.round(glsB),glsN:Math.round(vcf?glsB*vcf:glsB)};
}

function initFilasP1(){
  return [
    ...TANQUES_BARCAZA.map(t=>({id:`QBS002-${t}`,label:`QBS002-${t}`,tipo:"barcaza",tanqueKey:t,sonda:"",temp:"",api:"",activo:true})),
    ...TANQUES_TKT.map(t=>({id:t,label:t,tipo:"tkt",tanqueKey:t,sonda:"",temp:"",api:"",activo:true})),
  ];
}
function initFilasP2(){
  return TANQUES_P2.map(t=>({id:t,label:t,tipo:"tierra",galones:"",temp:"",api:"",activo:true}));
}

// ── Tooltip personalizado ─────────────────────────────────────────────────────
function TooltipGals({ active, payload, label }){
  if(!active||!payload?.length) return null;
  return (
    <div style={{background:TH.card,border:`1px solid ${TH.border}`,borderRadius:8,padding:"10px 14px",boxShadow:"0 4px 16px rgba(0,0,0,0.12)",fontSize:12}}>
      <div style={{fontWeight:700,color:TH.navy,marginBottom:6}}>{label}</div>
      {payload.map((p,i)=>(
        <div key={i} style={{color:p.color,fontWeight:600,marginBottom:2}}>
          {p.name}: {fmtN(p.value,0)} gls
        </div>
      ))}
    </div>
  );
}

export default function InventarioDiario({ supabase, session, perfil, showToast, tanques, dbCall }){
  const [planta, setPlanta] = useState("P1");
  const [activeTab, setActiveTab] = useState("nuevo");

  // Formulario
  const [filasP1, setFilasP1] = useState(initFilasP1);
  const [filasP2, setFilasP2] = useState(initFilasP2);
  const [calados, setCalados] = useState({proaIni:"", popaIni:""});
  const [turno, setTurno] = useState("DIURNO");
  const [operador, setOperador] = useState(perfil?.nombre||"");
  const [obs, setObs] = useState("");
  const [fechaReg, setFechaReg] = useState(new Date().toISOString().split("T")[0]);
  const [saving, setSaving] = useState(false);

  // Datos
  const [historial, setHistorial] = useState([]);
  const [loadingHist, setLoadingHist] = useState(false);

  // Análisis
  const [analisisPlanta, setAnalisisPlanta] = useState("P1");
  const [tanqueSeleccionado, setTanqueSeleccionado] = useState("");

  // Balance diario
  const [balancePlanta, setBalancePlanta]     = useState("P1");
  const [balanceDesde,  setBalanceDesde]      = useState(()=>{ const d=new Date(); d.setDate(d.getDate()-6); return d.toISOString().split("T")[0]; });
  const [balanceHasta,  setBalanceHasta]      = useState(()=>new Date().toISOString().split("T")[0]);
  const [balanceInvsRango, setBalanceInvsRango] = useState([]);
  const [balanceFechaDia,  setBalanceFechaDia]  = useState(()=>new Date().toISOString().split("T")[0]);
  const [balanceCmtsDia,   setBalanceCmtsDia]   = useState([]);
  const [loadingBalance,   setLoadingBalance]   = useState(false);
  const [loadingDia,       setLoadingDia]       = useState(false);
  const [balanceExpandido, setBalanceExpandido] = useState({entradas:true, salidas:true});

  const trim = mkTrim(calados.popaIni, calados.proaIni);

  const loadHist = useCallback(async () => {
    setLoadingHist(true);
    const { data } = await dbCall({ table:"inventarios_diarios", op:"select", select:"*", filters:[], single:false });
    const sorted = (data||[]).sort((a,b)=>new Date(a.fecha)-new Date(b.fecha));
    setHistorial(sorted);
    setLoadingHist(false);
  }, [dbCall]);

  const loadBalance = useCallback(async (desde, hasta) => {
    setLoadingBalance(true);
    const { data } = await dbCall({
      table:"inventarios_diarios", op:"select", select:"*",
      filters:[{col:"fecha",op:"gte",val:desde},{col:"fecha",op:"lte",val:hasta}],
      single:false
    });
    setBalanceInvsRango(data||[]);
    setLoadingBalance(false);
  }, [dbCall]);

  const loadCmtsDia = useCallback(async (fecha) => {
    setLoadingDia(true);
    const { data } = await dbCall({ table:"cmts", op:"select", select:"*", filters:[{col:"fecha",val:fecha}], single:false });
    setBalanceCmtsDia(data||[]);
    setLoadingDia(false);
  }, [dbCall]);

  useEffect(() => {
    if(activeTab==="historial"||activeTab==="analisis") loadHist();
    if(activeTab==="balance"){ loadBalance(balanceDesde, balanceHasta); loadCmtsDia(balanceFechaDia); }
  }, [activeTab, loadHist]);

  // ── Calc helpers ─────────────────────────────────────────────────────────────
  function calcFila(f){
    if(f.tipo==="barcaza") return calcBarcaza(f.tanqueKey,f.sonda,f.temp,f.api,trim);
    if(f.tipo==="tkt")     return calcTKT(f.tanqueKey,f.sonda,f.temp,f.api);
    return null;
  }
  function nivelSistema(id){ const t=tanques?.find(t=>t.id===id); return t?Number(t.nivel||0):null; }
  function difInfo(glsCalc, id){
    const sys=nivelSistema(id);
    if(sys===null||glsCalc===null) return null;
    const diff=glsCalc-sys;
    const pct=sys>0?(diff/sys)*100:null;
    return{diff,pct};
  }

  // ── Guardar ──────────────────────────────────────────────────────────────────
  async function guardar(){
    setSaving(true);
    try{
      const sede=perfil?.sede||"MALAMBO";
      const filas=planta==="P1"?filasP1.filter(f=>f.activo):filasP2.filter(f=>f.activo);
      const plantaLabel=planta==="P1"?"PLANTA 1":"PLANTA 2";

      const tanquesReg=filas.map(f=>{
        let glsCalc=null;
        if(planta==="P1"){ const r=calcFila(f); glsCalc=r?r.glsN:null; }
        else{ const v=pfn(f.galones); glsCalc=isNaN(v)?null:Math.round(v); }
        const sys=nivelSistema(f.id);
        const diff=(glsCalc!==null&&sys!==null)?glsCalc-sys:null;
        const pct=(diff!==null&&sys>0)?(diff/sys)*100:null;
        return{tanque:f.id,sonda:f.sonda||"",temperatura:f.temp||"",api:f.api||"",galones_calculados:glsCalc,galones_sistema:sys,diferencia:diff,pct_diferencia:pct!==null?+pct.toFixed(2):null};
      });

      const{data:prevs}=await dbCall({table:"inventarios_diarios",op:"select",select:"id",filters:[],single:false});
      const prefix=`INV-${planta==="P1"?"P1":"P2"}`;
      const numero=`${prefix}-${String(((prevs||[]).filter(r=>(r.id||"").startsWith(prefix)).length)+1).padStart(4,"0")}`;

      await dbCall({table:"inventarios_diarios",op:"insert",data:{
        id:numero,numero,fecha:fechaReg,planta:plantaLabel,sede,turno,
        operador:operador||perfil?.nombre||"",tanques:tanquesReg,observaciones:obs,
        calados_proa:planta==="P1"?(calados.proaIni||null):null,
        calados_popa:planta==="P1"?(calados.popaIni||null):null,
        creado_por:session?.user?.id,
      }});

      showToast(`Inventario ${numero} guardado`,true);
      if(planta==="P1") setFilasP1(initFilasP1()); else setFilasP2(initFilasP2());
      setObs("");
      setActiveTab("historial");
    }catch(e){ showToast("Error: "+e.message,false); }
    finally{ setSaving(false); }
  }

  // ── Datos para análisis ───────────────────────────────────────────────────────
  function datosPlanta(p){
    const label = p==="P1"?"PLANTA 1":"PLANTA 2";
    const registros = historial.filter(h=>h.planta===label);
    // Agrupar por fecha (un punto por fecha, promedio si hay dos turnos)
    const porFecha = {};
    for(const reg of registros){
      const f = reg.fecha;
      if(!porFecha[f]) porFecha[f]={fecha:f,tanques:{}};
      for(const t of reg.tanques||[]){
        if(t.galones_calculados!==null){
          if(!porFecha[f].tanques[t.tanque]) porFecha[f].tanques[t.tanque]=[];
          porFecha[f].tanques[t.tanque].push(t.galones_calculados);
        }
      }
    }
    return Object.values(porFecha).sort((a,b)=>a.fecha.localeCompare(b.fecha)).map(d=>{
      const row={fecha: new Date(d.fecha+"T12:00:00").toLocaleDateString("es-CO",{day:"2-digit",month:"2-digit"})};
      let total=0;
      for(const[tk,vals] of Object.entries(d.tanques)){
        const avg=Math.round(vals.reduce((s,v)=>s+v,0)/vals.length);
        row[tk]=avg;
        total+=avg;
      }
      row["__total"]=total;
      return row;
    });
  }

  function datosTanque(tanqueId){
    const registros=historial.filter(h=>(h.tanques||[]).some(t=>t.tanque===tanqueId));
    return registros.map(reg=>{
      const t=reg.tanques.find(t=>t.tanque===tanqueId);
      const fDiff=t?.pct_diferencia??null;
      return{
        fecha: new Date(reg.fecha+"T12:00:00").toLocaleDateString("es-CO",{day:"2-digit",month:"2-digit"}),
        fechaFull: reg.fecha,
        turno: reg.turno||"",
        galones: t?.galones_calculados??null,
        sistema: t?.galones_sistema??null,
        diferencia: t?.diferencia??null,
        pct: fDiff,
        novedad: fDiff!==null&&Math.abs(fDiff)>TOLERANCIA_PCT,
      };
    }).sort((a,b)=>a.fechaFull.localeCompare(b.fechaFull));
  }

  function listaTanques(p){
    const label=p==="P1"?"PLANTA 1":"PLANTA 2";
    const set=new Set();
    historial.filter(h=>h.planta===label).forEach(h=>(h.tanques||[]).forEach(t=>set.add(t.tanque)));
    return [...set].sort();
  }

  // ── Vista Análisis ────────────────────────────────────────────────────────────
  function renderAnalisis(){
    if(loadingHist) return <div style={{color:TH.muted,padding:32,textAlign:"center"}}>Cargando datos...</div>;
    const label=analisisPlanta==="P1"?"PLANTA 1":"PLANTA 2";
    const registrosPlanta=historial.filter(h=>h.planta===label);
    if(registrosPlanta.length===0) return(
      <div style={{color:TH.muted,padding:32,textAlign:"center",fontSize:14}}>
        No hay inventarios registrados para {label}
      </div>
    );

    const datos=datosPlanta(analisisPlanta);
    const tanquesLista=listaTanques(analisisPlanta);
    const tqSelec=tanqueSeleccionado||tanquesLista[0]||"";
    const datosTq=tqSelec?datosTanque(tqSelec):[];

    return(
      <div style={{display:"flex",flexDirection:"column",gap:24}}>

        {/* Selector planta */}
        <div style={{display:"flex",alignItems:"center",gap:16,flexWrap:"wrap"}}>
          <div style={{fontWeight:800,fontSize:14,color:TH.navy}}>Planta:</div>
          {["P1","P2"].map(p=>(
            <button key={p} onClick={()=>{ setAnalisisPlanta(p); setTanqueSeleccionado(""); }}
              style={{padding:"6px 18px",borderRadius:6,fontWeight:700,fontSize:12,cursor:"pointer",
                background:analisisPlanta===p?TH.navy:"transparent",
                color:analisisPlanta===p?"#fff":TH.muted,
                border:`2px solid ${analisisPlanta===p?TH.navy:TH.border}`}}>
              {p==="P1"?"Planta 1 — QBS002":"Planta 2 — TK-111/117"}
            </button>
          ))}
        </div>

        {/* ── Gráfica 1: Total planta por día ── */}
        <div style={{background:TH.card,borderRadius:10,border:`1px solid ${TH.border}`,padding:20,boxShadow:"0 2px 8px rgba(0,0,0,0.05)"}}>
          <div style={{fontWeight:800,fontSize:14,color:TH.navy,marginBottom:4}}>📊 Volumen total — {label}</div>
          <div style={{fontSize:11,color:TH.muted,marginBottom:16}}>Suma de galones en todos los tanques por fecha</div>
          {datos.length<2
            ? <div style={{color:TH.muted,fontSize:13,padding:"20px 0"}}>Se necesitan al menos 2 registros para mostrar la gráfica</div>
            : <ResponsiveContainer width="100%" height={220}>
                <LineChart data={datos} margin={{top:5,right:20,left:0,bottom:5}}>
                  <CartesianGrid strokeDasharray="3 3" stroke={TH.border}/>
                  <XAxis dataKey="fecha" tick={{fontSize:11,fill:TH.muted}}/>
                  <YAxis tick={{fontSize:10,fill:TH.muted}} tickFormatter={v=>fmtN(v/1000,0)+"k"} width={50}/>
                  <Tooltip content={<TooltipGals/>}/>
                  <Line type="monotone" dataKey="__total" name="Total" stroke={TH.orange} strokeWidth={2.5} dot={{r:4,fill:TH.orange}} activeDot={{r:6}}/>
                </LineChart>
              </ResponsiveContainer>
          }
        </div>

        {/* ── Gráfica 2: Todos los tanques apilados ── */}
        {datos.length>=2 && (
          <div style={{background:TH.card,borderRadius:10,border:`1px solid ${TH.border}`,padding:20,boxShadow:"0 2px 8px rgba(0,0,0,0.05)"}}>
            <div style={{fontWeight:800,fontSize:14,color:TH.navy,marginBottom:4}}>🛢 Distribución por tanque</div>
            <div style={{fontSize:11,color:TH.muted,marginBottom:16}}>Galones por tanque — barras apiladas</div>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={datos} margin={{top:5,right:20,left:0,bottom:5}}>
                <CartesianGrid strokeDasharray="3 3" stroke={TH.border}/>
                <XAxis dataKey="fecha" tick={{fontSize:11,fill:TH.muted}}/>
                <YAxis tick={{fontSize:10,fill:TH.muted}} tickFormatter={v=>fmtN(v/1000,0)+"k"} width={50}/>
                <Tooltip content={<TooltipGals/>}/>
                <Legend iconSize={10} wrapperStyle={{fontSize:11}}/>
                {tanquesLista.map((tk,i)=>(
                  <Bar key={tk} dataKey={tk} name={tk} stackId="a" fill={COLORES_TANQUE[i%COLORES_TANQUE.length]}/>
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* ── Gráfica 3: Tanque individual ── */}
        <div style={{background:TH.card,borderRadius:10,border:`1px solid ${TH.border}`,padding:20,boxShadow:"0 2px 8px rgba(0,0,0,0.05)"}}>
          <div style={{display:"flex",alignItems:"center",gap:16,marginBottom:16,flexWrap:"wrap"}}>
            <div style={{fontWeight:800,fontSize:14,color:TH.navy}}>📈 Evolución por tanque</div>
            <select value={tqSelec} onChange={e=>{setTanqueSeleccionado(e.target.value);}}
              style={{padding:"6px 12px",borderRadius:6,border:`1px solid ${TH.border}`,fontSize:13,color:TH.text,background:TH.card,fontWeight:600}}>
              {tanquesLista.map(t=><option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          {datosTq.length<2
            ? <div style={{color:TH.muted,fontSize:13,padding:"20px 0"}}>Se necesitan al menos 2 registros de este tanque</div>
            : <>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={datosTq} margin={{top:5,right:20,left:0,bottom:5}}>
                    <CartesianGrid strokeDasharray="3 3" stroke={TH.border}/>
                    <XAxis dataKey="fecha" tick={{fontSize:11,fill:TH.muted}}/>
                    <YAxis tick={{fontSize:10,fill:TH.muted}} tickFormatter={v=>fmtN(v/1000,1)+"k"} width={52}/>
                    <Tooltip content={({active,payload,label})=>{
                      if(!active||!payload?.length) return null;
                      const d=payload[0]?.payload;
                      return(
                        <div style={{background:TH.card,border:`1px solid ${TH.border}`,borderRadius:8,padding:"10px 14px",fontSize:12,boxShadow:"0 4px 16px rgba(0,0,0,0.12)"}}>
                          <div style={{fontWeight:700,color:TH.navy,marginBottom:6}}>{label} {d?.turno}</div>
                          <div style={{color:TH.orange,fontWeight:600}}>Físico: {fmtN(d?.galones,0)} gls</div>
                          <div style={{color:TH.muted}}>Sistema: {fmtN(d?.sistema,0)} gls</div>
                          {d?.diferencia!==null&&<div style={{color:d?.diferencia<0?TH.danger:TH.warn,fontWeight:700}}>
                            Diferencia: {d?.diferencia>0?"+":""}{fmtN(d?.diferencia,0)} gls ({d?.pct>0?"+":""}{(d?.pct||0).toFixed(1)}%)
                          </div>}
                        </div>
                      );
                    }}/>
                    <Line type="monotone" dataKey="galones" name="Físico" stroke={TH.orange} strokeWidth={2.5} dot={(props)=>{
                      const{cx,cy,payload}=props;
                      if(payload.novedad) return <circle key={`dot-${cx}`} cx={cx} cy={cy} r={6} fill={TH.danger} stroke="#fff" strokeWidth={2}/>;
                      return <circle key={`dot-${cx}`} cx={cx} cy={cy} r={4} fill={TH.orange} stroke="#fff" strokeWidth={1.5}/>;
                    }} activeDot={{r:6}}/>
                    <Line type="monotone" dataKey="sistema" name="Sistema" stroke={TH.muted} strokeWidth={1.5} strokeDasharray="4 2" dot={false}/>
                  </LineChart>
                </ResponsiveContainer>

                {/* Tabla de novedades del tanque */}
                {datosTq.some(d=>d.novedad) && (
                  <div style={{marginTop:16}}>
                    <div style={{fontSize:11,fontWeight:800,color:TH.danger,marginBottom:8,textTransform:"uppercase",letterSpacing:1}}>
                      ⚠ Novedades detectadas en {tqSelec}
                    </div>
                    <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
                      {datosTq.filter(d=>d.novedad).map((d,i)=>(
                        <div key={i} style={{padding:"5px 12px",borderRadius:6,fontSize:12,fontWeight:700,
                          background:d.diferencia<0?`${TH.danger}15`:`${TH.warn}15`,
                          border:`1px solid ${d.diferencia<0?TH.danger:TH.warn}`,
                          color:d.diferencia<0?TH.danger:TH.warn}}>
                          {d.fecha} {d.turno}: {d.diferencia>0?"+":""}{fmtN(d.diferencia,0)} gls ({d.diferencia<0?"FALTANTE":"SOBRANTE"})
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
          }
        </div>
      </div>
    );
  }

  // ── Balance Diario ───────────────────────────────────────────────────────────
  function renderBalance(){
    const plantaLabel = balancePlanta==="P1" ? "PLANTA 1" : "PLANTA 2";
    const tanquesPlanta = balancePlanta==="P1"
      ? [...TANQUES_BARCAZA.map(t=>`QBS002-${t}`), ...TANQUES_TKT]
      : TANQUES_P2;

    // ── Matriz inventario físico día a día ──────────────────────────────────
    const invsPlanta = balanceInvsRango.filter(i => i.planta === plantaLabel);
    const fechas = [...new Set(invsPlanta.map(i=>i.fecha))].sort();

    // matrix[tanque][fecha] = galones_calculados
    const matrix = {};
    for(const inv of invsPlanta){
      for(const t of (inv.tanques||[])){
        if(!matrix[t.tanque]) matrix[t.tanque] = {};
        matrix[t.tanque][inv.fecha] = Number(t.galones_calculados)||0;
      }
    }
    // máximo por tanque (para la barra proporcional)
    const maxPorTanque = {};
    for(const tq of tanquesPlanta){
      maxPorTanque[tq] = Math.max(...fechas.map(f=>matrix[tq]?.[f]||0), 1);
    }

    // ── Balance del día seleccionado ────────────────────────────────────────
    // CMTs P1 pueden tener planta="PLANTA 1" o "QBS002" o nombre de barcaza
    const cmtsPlanta = balanceCmtsDia.filter(c =>
      balancePlanta === "P1"
        ? (c.planta === "PLANTA 1" || c.planta === "QBS002" || (c.planta||"").startsWith("QBS"))
        : c.planta === "PLANTA 2"
    );
    // Inventario inicial = el más reciente ANTES del día seleccionado
    const invsOrdenados = [...invsPlanta].sort((a,b)=>a.fecha.localeCompare(b.fecha));
    const invInicial  = [...invsOrdenados].reverse().find(i => i.fecha <= balanceFechaDia)
                        || invsOrdenados[0]
                        || null;
    const totalInicial= invInicial ? (invInicial.tanques||[]).reduce((s,t)=>s+(Number(t.galones_calculados)||0),0) : null;

    const movimientos = cmtsPlanta.map(c => {
      const antes  = Number(c.total_antes||0);
      const despues= Number(c.total_despues||0);
      const movido = Number(c.total_movido||0);
      const tipo   = (c.tipo_operacion||"").toUpperCase();
      let esEntrada;
      if(tipo.includes("DESCARGUE")) esEntrada = true;
      else if(tipo.includes("ENTREGA")||tipo.includes("PORTEO")) esEntrada = false;
      else esEntrada = (despues - antes) >= 0;
      return { id:c.numero_cmt||c.id, tipo:c.tipo_operacion||"—", galones:movido, esEntrada,
               obs:c.nombre_motonave||(c.carros||[]).map(r=>r.placa).join(", ")||"" };
    }).filter(m=>m.galones>0);

    const totalEntradas = movimientos.filter(m=>m.esEntrada).reduce((s,m)=>s+m.galones,0);
    const totalSalidas  = movimientos.filter(m=>!m.esEntrada).reduce((s,m)=>s+m.galones,0);
    const teorico = totalInicial !== null ? totalInicial + totalEntradas - totalSalidas : null;

    const fmtFecha = f => new Date(f+"T12:00:00").toLocaleDateString("es-CO",{day:"2-digit",month:"short"});

    return (
      <div>
        {/* ── Controles ── */}
        <div style={{display:"flex",gap:12,marginBottom:18,flexWrap:"wrap",alignItems:"flex-end"}}>
          <div style={{display:"flex",gap:0,borderRadius:8,overflow:"hidden",border:`1px solid ${TH.border}`}}>
            {[{k:"P1",l:"Planta 1"},{k:"P2",l:"Planta 2"}].map(({k,l})=>(
              <button key={k} onClick={()=>setBalancePlanta(k)}
                style={{padding:"7px 20px",fontWeight:700,fontSize:12,cursor:"pointer",
                  background:balancePlanta===k?TH.navy:TH.card,color:balancePlanta===k?"#fff":TH.muted,border:"none"}}>
                {l}
              </button>
            ))}
          </div>
          {[{lbl:"Desde",val:balanceDesde,set:setBalanceDesde},{lbl:"Hasta",val:balanceHasta,set:setBalanceHasta}].map(({lbl,val,set})=>(
            <div key={lbl}>
              <div style={{fontSize:10,color:TH.navy,fontWeight:700,textTransform:"uppercase",letterSpacing:1,marginBottom:4}}>{lbl}</div>
              <input type="date" value={val}
                onChange={e=>{ set(e.target.value); loadBalance(lbl==="Desde"?e.target.value:balanceDesde, lbl==="Hasta"?e.target.value:balanceHasta); }}
                style={{padding:"7px 10px",border:`1px solid ${TH.border}`,borderRadius:6,fontSize:13,color:TH.text,background:TH.card}}/>
            </div>
          ))}
        </div>

        {/* ── Matriz inventario físico ── */}
        {loadingBalance ? (
          <div style={{color:TH.muted,padding:24,textAlign:"center"}}>Cargando inventarios...</div>
        ) : fechas.length === 0 ? (
          <div style={{padding:"24px 0",textAlign:"center",color:TH.muted,fontSize:14}}>
            Sin inventarios físicos registrados para {plantaLabel} en el período seleccionado
          </div>
        ) : (
          <div style={{overflowX:"auto",borderRadius:10,border:`1px solid ${TH.border}`,marginBottom:20}}>
            <table style={{borderCollapse:"collapse",tableLayout:"auto"}}>
              <thead>
                <tr style={{background:TH.navy}}>
                  <th style={{padding:"10px 16px",textAlign:"left",color:"#fff",fontSize:12,fontWeight:700,
                    position:"sticky",left:0,background:TH.navy,zIndex:2,whiteSpace:"nowrap"}}>
                    Tanque
                  </th>
                  {fechas.map(f=>(
                    <th key={f} onClick={()=>{ setBalanceFechaDia(f); loadCmtsDia(f); }}
                      style={{padding:"10px 14px",color:f===balanceFechaDia?"#FFD700":"#b8d4ee",fontSize:11,fontWeight:700,
                        cursor:"pointer",minWidth:110,textAlign:"center",whiteSpace:"nowrap",
                        background:f===balanceFechaDia?"#005299":TH.navy,
                        borderLeft:`1px solid #ffffff22`,transition:"background 0.15s"}}>
                      {fmtFecha(f)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tanquesPlanta.map((tq,ri)=>{
                  const hasAnyData = fechas.some(f=>matrix[tq]?.[f]!==undefined);
                  return(
                    <tr key={tq} style={{background:ri%2===0?TH.card:"#f4f7fb"}}>
                      <td style={{padding:"10px 16px",fontWeight:700,color:TH.navy,fontSize:12,
                        whiteSpace:"nowrap",position:"sticky",left:0,
                        background:ri%2===0?TH.card:"#f4f7fb",zIndex:1,
                        borderRight:`2px solid ${TH.border}`}}>
                        {tq}
                      </td>
                      {fechas.map(f=>{
                        const gls = matrix[tq]?.[f];
                        const pct = gls ? Math.round((gls/maxPorTanque[tq])*100) : 0;
                        const isSelected = f===balanceFechaDia;
                        return(
                          <td key={f} onClick={()=>{ setBalanceFechaDia(f); loadCmtsDia(f); }}
                            style={{padding:"8px 14px",textAlign:"right",cursor:"pointer",
                              borderLeft:`1px solid ${TH.border}`,
                              background:isSelected?"#e8f4fd":undefined,
                              transition:"background 0.15s"}}>
                            {gls !== undefined ? (
                              <span style={{fontFamily:"monospace",fontWeight:700,color:TH.navy,fontSize:12}}>
                                {fmtN(gls,0)}
                              </span>
                            ) : (
                              <span style={{color:TH.border,fontSize:13,fontWeight:300}}>—</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
                {/* Fila total por fecha */}
                <tr style={{background:"#eaf0f8",borderTop:`2px solid ${TH.navy}`}}>
                  <td style={{padding:"10px 16px",fontWeight:900,color:TH.navy,fontSize:12,
                    position:"sticky",left:0,background:"#eaf0f8",zIndex:1,
                    borderRight:`2px solid ${TH.border}`}}>
                    TOTAL
                  </td>
                  {fechas.map(f=>{
                    const total = tanquesPlanta.reduce((s,tq)=>s+(matrix[tq]?.[f]||0),0);
                    const isSelected = f===balanceFechaDia;
                    return(
                      <td key={f} style={{padding:"10px 14px",textAlign:"right",
                        borderLeft:`1px solid ${TH.border}`,
                        background:isSelected?"#d4eaf8":"#eaf0f8"}}>
                        <span style={{fontFamily:"monospace",fontWeight:900,color:TH.navy,fontSize:13}}>
                          {total > 0 ? fmtN(total,0) : "—"}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* ── Factura de balance ── */}
        <div style={{background:TH.card,borderRadius:10,border:`2px solid ${TH.navy}`,overflow:"hidden",maxWidth:560}}>
          {/* Cabecera */}
          <div style={{background:TH.navy,padding:"12px 20px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div style={{color:"#fff",fontWeight:800,fontSize:13,letterSpacing:0.5}}>
              BALANCE DIARIO
            </div>
            <div style={{color:"#aac8e8",fontSize:12,fontWeight:600}}>
              {fmtFecha(balanceFechaDia)} · {plantaLabel}
            </div>
          </div>

          {loadingDia ? (
            <div style={{color:TH.muted,fontSize:13,padding:"20px",textAlign:"center"}}>Cargando movimientos...</div>
          ) : (
            <div style={{fontFamily:"system-ui,sans-serif"}}>

              {/* Inventario inicial */}
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",
                padding:"12px 20px",borderBottom:`1px solid ${TH.border}`}}>
                <span style={{fontSize:12,color:TH.muted,fontWeight:600,textTransform:"uppercase",letterSpacing:0.5}}>
                  Inventario Inicial
                </span>
                <span style={{fontFamily:"monospace",fontWeight:700,color:TH.navy,fontSize:14}}>
                  {totalInicial !== null ? fmtN(totalInicial,0) : "—"}
                </span>
              </div>

              {/* Entradas */}
              {movimientos.filter(m=>m.esEntrada).length > 0 && (
                <div style={{borderBottom:`1px solid ${TH.border}`}}>
                  <div onClick={()=>setBalanceExpandido(p=>({...p,entradas:!p.entradas}))}
                    style={{display:"flex",justifyContent:"space-between",alignItems:"center",
                      padding:"8px 20px",cursor:"pointer",userSelect:"none",
                      background:`${TH.success}08`}}>
                    <span style={{fontSize:10,fontWeight:800,color:TH.success,textTransform:"uppercase",letterSpacing:1}}>
                      ↓ Entradas
                    </span>
                    <div style={{display:"flex",alignItems:"center",gap:10}}>
                      <span style={{fontFamily:"monospace",fontWeight:900,color:TH.success,fontSize:13}}>
                        +{fmtN(totalEntradas,0)}
                      </span>
                      <span style={{color:TH.success,fontSize:11,fontWeight:700}}>
                        {balanceExpandido.entradas ? "▲" : "▼"}
                      </span>
                    </div>
                  </div>
                  {balanceExpandido.entradas && movimientos.filter(m=>m.esEntrada).map((m,i)=>(
                    <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",
                      padding:"7px 20px 7px 32px",borderTop:`1px solid ${TH.border}55`}}>
                      <span style={{fontFamily:"monospace",fontSize:12,fontWeight:700,color:TH.navy}}>{m.id}</span>
                      <span style={{fontFamily:"monospace",fontWeight:700,color:TH.success,fontSize:13}}>
                        +{fmtN(m.galones,0)}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Salidas */}
              {movimientos.filter(m=>!m.esEntrada).length > 0 && (
                <div style={{borderBottom:`1px solid ${TH.border}`}}>
                  <div onClick={()=>setBalanceExpandido(p=>({...p,salidas:!p.salidas}))}
                    style={{display:"flex",justifyContent:"space-between",alignItems:"center",
                      padding:"8px 20px",cursor:"pointer",userSelect:"none",
                      background:`${TH.danger}08`}}>
                    <span style={{fontSize:10,fontWeight:800,color:TH.danger,textTransform:"uppercase",letterSpacing:1}}>
                      ↑ Salidas
                    </span>
                    <div style={{display:"flex",alignItems:"center",gap:10}}>
                      <span style={{fontFamily:"monospace",fontWeight:900,color:TH.danger,fontSize:13}}>
                        -{fmtN(totalSalidas,0)}
                      </span>
                      <span style={{color:TH.danger,fontSize:11,fontWeight:700}}>
                        {balanceExpandido.salidas ? "▲" : "▼"}
                      </span>
                    </div>
                  </div>
                  {balanceExpandido.salidas && movimientos.filter(m=>!m.esEntrada).map((m,i)=>(
                    <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",
                      padding:"7px 20px 7px 32px",borderTop:`1px solid ${TH.border}55`}}>
                      <span style={{fontFamily:"monospace",fontSize:12,fontWeight:700,color:TH.navy}}>{m.id}</span>
                      <span style={{fontFamily:"monospace",fontWeight:700,color:TH.danger,fontSize:13}}>
                        -{fmtN(m.galones,0)}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {movimientos.length === 0 && (
                <div style={{padding:"12px 20px",color:TH.muted,fontSize:12,textAlign:"center",
                  borderBottom:`1px solid ${TH.border}`}}>
                  Sin CMTs registrados para este día
                </div>
              )}

              {/* Total teórico */}
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",
                padding:"14px 20px",background:`${TH.navy}08`,borderTop:`2px solid ${TH.navy}`}}>
                <span style={{fontSize:13,fontWeight:800,color:TH.navy,textTransform:"uppercase",letterSpacing:0.5}}>
                  Inventario Teórico
                </span>
                <span style={{fontFamily:"monospace",fontWeight:900,color:TH.navy,fontSize:18}}>
                  {teorico !== null ? fmtN(teorico,0) : "—"}
                  <span style={{fontSize:12,fontWeight:400,marginLeft:6,color:TH.muted}}>gls</span>
                </span>
              </div>

            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Tabla P1 ─────────────────────────────────────────────────────────────────
  function renderTablaP1(){
    return(
      <div style={{overflowX:"auto"}}>
        <div style={{display:"flex",gap:16,marginBottom:16,flexWrap:"wrap"}}>
          {[{label:"Calado Proa (m)",key:"proaIni"},{label:"Calado Popa (m)",key:"popaIni"}].map(({label,key})=>(
            <div key={key} style={{minWidth:160}}>
              <div style={{fontSize:10,color:TH.navy,fontWeight:700,textTransform:"uppercase",letterSpacing:1,marginBottom:4}}>{label}</div>
              <NumInput value={calados[key]} onChange={e=>setCalados(p=>({...p,[key]:e.target.value}))} placeholder="0.00"/>
            </div>
          ))}
          <div style={{minWidth:160,display:"flex",alignItems:"flex-end"}}>
            <div style={{padding:"5px 12px",background:`${TH.navy}15`,borderRadius:6,fontSize:12,fontWeight:700,color:TH.navy}}>
              Trim: {trim.val.toFixed(2)} m {trim.dir}
            </div>
          </div>
        </div>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
          <thead>
            <tr style={{background:TH.navy,color:"#fff"}}>
              {["Tanque","Sonda (mm)","Temp °C","API","Gls Calculados","Gls Sistema","Diferencia","Estado"].map(h=>(
                <th key={h} style={{padding:"8px 10px",textAlign:h==="Tanque"?"left":"right",fontWeight:700,whiteSpace:"nowrap"}}>
                  {h==="Estado"?<span style={{textAlign:"center",display:"block"}}>{h}</span>:h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filasP1.map((f,i)=>{
              const res=calcFila(f);
              const glsCalc=res?res.glsN:null;
              const sys=nivelSistema(f.id);
              const di=difInfo(glsCalc,f.id);
              const isOk=di&&Math.abs(di.pct||0)<=TOLERANCIA_PCT;
              const rowBg=i%2===0?TH.card:"#f8fafc";
              return(
                <tr key={f.id} style={{background:rowBg}}>
                  <td style={{padding:"6px 10px",fontWeight:700,color:TH.navy,borderBottom:`1px solid ${TH.border}`}}>
                    {f.label}
                    {f.tipo==="tkt"&&<span style={{fontSize:9,color:TH.muted,marginLeft:6}}>TIERRA</span>}
                  </td>
                  {["sonda","temp","api"].map(k=>(
                    <td key={k} style={{padding:"4px 6px",borderBottom:`1px solid ${TH.border}`,width:80}}>
                      <NumInput value={f[k]} onChange={e=>{const v=e.target.value;setFilasP1(p=>p.map((r,j)=>j===i?{...r,[k]:v}:r));}}/>
                    </td>
                  ))}
                  <td style={{padding:"6px 10px",textAlign:"right",fontFamily:"monospace",fontWeight:700,borderBottom:`1px solid ${TH.border}`,color:glsCalc!==null?TH.navy:TH.muted}}>
                    {glsCalc!==null?fmtN(glsCalc,0):"—"}
                  </td>
                  <td style={{padding:"6px 10px",textAlign:"right",fontFamily:"monospace",borderBottom:`1px solid ${TH.border}`,color:TH.muted}}>
                    {sys!==null?fmtN(sys,0):"—"}
                  </td>
                  <td style={{padding:"6px 10px",textAlign:"right",fontFamily:"monospace",fontWeight:700,borderBottom:`1px solid ${TH.border}`,
                    color:!di?TH.muted:isOk?TH.success:di.diff<0?TH.danger:TH.warn}}>
                    {di?(di.diff>0?"+":"")+fmtN(di.diff,0):"—"}
                    {di!=null&&di.pct!=null&&<span style={{fontSize:10,marginLeft:4}}>({(di.pct>0?"+":"")+di.pct.toFixed(1)}%)</span>}
                  </td>
                  <td style={{padding:"6px 10px",textAlign:"center",borderBottom:`1px solid ${TH.border}`}}>
                    {!di?<span style={{color:TH.muted,fontSize:10}}>—</span>
                     :isOk?<span style={{color:TH.success,fontWeight:700,fontSize:11}}>✓ OK</span>
                     :di.diff<0?<span style={{color:TH.danger,fontWeight:700,fontSize:11}}>⚠ FALTANTE</span>
                     :<span style={{color:TH.warn,fontWeight:700,fontSize:11}}>↑ SOBRANTE</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  // ── Tabla P2 ─────────────────────────────────────────────────────────────────
  function renderTablaP2(){
    return(
      <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
        <thead>
          <tr style={{background:TH.navy,color:"#fff"}}>
            {["Tanque","Galones Medidos","Temp °C","API","Gls Sistema","Diferencia","Estado"].map(h=>(
              <th key={h} style={{padding:"8px 10px",textAlign:h==="Tanque"?"left":"right",fontWeight:700}}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filasP2.map((f,i)=>{
            const v=pfn(f.galones);
            const glsCalc=isNaN(v)?null:Math.round(v);
            const sys=nivelSistema(f.id);
            const di=difInfo(glsCalc,f.id);
            const isOk=di&&Math.abs(di.pct||0)<=TOLERANCIA_PCT;
            const rowBg=i%2===0?TH.card:"#f8fafc";
            return(
              <tr key={f.id} style={{background:rowBg}}>
                <td style={{padding:"6px 10px",fontWeight:700,color:TH.navy,borderBottom:`1px solid ${TH.border}`}}>{f.label}</td>
                <td style={{padding:"4px 6px",borderBottom:`1px solid ${TH.border}`,width:130}}>
                  <NumInput value={f.galones} onChange={e=>{const v=e.target.value;setFilasP2(p=>p.map((r,j)=>j===i?{...r,galones:v}:r));}}/>
                </td>
                {["temp","api"].map(k=>(
                  <td key={k} style={{padding:"4px 6px",borderBottom:`1px solid ${TH.border}`,width:80}}>
                    <NumInput value={f[k]} onChange={e=>{const v=e.target.value;setFilasP2(p=>p.map((r,j)=>j===i?{...r,[k]:v}:r));}}/>
                  </td>
                ))}
                <td style={{padding:"6px 10px",textAlign:"right",fontFamily:"monospace",borderBottom:`1px solid ${TH.border}`,color:TH.muted}}>
                  {sys!==null?fmtN(sys,0):"—"}
                </td>
                <td style={{padding:"6px 10px",textAlign:"right",fontFamily:"monospace",fontWeight:700,borderBottom:`1px solid ${TH.border}`,
                  color:!di?TH.muted:isOk?TH.success:di.diff<0?TH.danger:TH.warn}}>
                  {di?(di.diff>0?"+":"")+fmtN(di.diff,0):"—"}
                  {di!=null&&di.pct!=null&&<span style={{fontSize:10,marginLeft:4}}>({(di.pct>0?"+":"")+di.pct.toFixed(1)}%)</span>}
                </td>
                <td style={{padding:"6px 10px",textAlign:"center",borderBottom:`1px solid ${TH.border}`}}>
                  {!di?<span style={{color:TH.muted,fontSize:10}}>—</span>
                   :isOk?<span style={{color:TH.success,fontWeight:700,fontSize:11}}>✓ OK</span>
                   :di.diff<0?<span style={{color:TH.danger,fontWeight:700,fontSize:11}}>⚠ FALTANTE</span>
                   :<span style={{color:TH.warn,fontWeight:700,fontSize:11}}>↑ SOBRANTE</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    );
  }

  // ── Resumen novedades ─────────────────────────────────────────────────────────
  function renderResumen(){
    const filas=planta==="P1"?filasP1:filasP2;
    const novedades=filas.map(f=>{
      let glsCalc=null;
      if(planta==="P1"){const r=calcFila(f);glsCalc=r?r.glsN:null;}
      else{const v=pfn(f.galones);glsCalc=isNaN(v)?null:Math.round(v);}
      const di=difInfo(glsCalc,f.id);
      return{id:f.id,di};
    }).filter(r=>r.di&&Math.abs(r.di.pct||0)>TOLERANCIA_PCT);

    if(novedades.length===0) return(
      <div style={{padding:"10px 16px",background:`${TH.success}15`,borderRadius:8,border:`1px solid ${TH.success}`,color:TH.success,fontWeight:700,fontSize:13,marginBottom:16}}>
        ✓ Todos los tanques dentro del margen de tolerancia (±{TOLERANCIA_PCT}%)
      </div>
    );
    return(
      <div style={{marginBottom:16}}>
        <div style={{fontWeight:800,fontSize:12,color:TH.danger,marginBottom:8,textTransform:"uppercase",letterSpacing:1}}>⚠ Novedades detectadas</div>
        <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
          {novedades.map(({id,di})=>(
            <div key={id} style={{padding:"6px 14px",borderRadius:6,fontWeight:700,fontSize:12,
              background:di.diff<0?`${TH.danger}15`:`${TH.warn}15`,
              border:`1px solid ${di.diff<0?TH.danger:TH.warn}`,
              color:di.diff<0?TH.danger:TH.warn}}>
              {id}: {di.diff>0?"+":""}{fmtN(di.diff,0)} gls ({(di.pct>0?"+":"")+di.pct.toFixed(1)}%) {di.diff<0?"FALTANTE":"SOBRANTE"}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Historial ─────────────────────────────────────────────────────────────────
  function renderHistorial(){
    const histDesc=[...historial].sort((a,b)=>new Date(b.created_at||b.fecha)-new Date(a.created_at||a.fecha));
    if(loadingHist) return <div style={{color:TH.muted,padding:32,textAlign:"center"}}>Cargando...</div>;
    if(histDesc.length===0) return <div style={{color:TH.muted,padding:32,textAlign:"center"}}>Sin registros</div>;
    return(
      <div style={{overflowX:"auto"}}>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
          <thead>
            <tr style={{background:TH.navy,color:"#fff"}}>
              {["N°","Fecha","Planta","Turno","Operador","Tanques","Novedades"].map(h=>(
                <th key={h} style={{padding:"8px 10px",textAlign:["Tanques","Novedades"].includes(h)?"center":"left",fontWeight:700}}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {histDesc.map((inv,i)=>{
              const nov=(inv.tanques||[]).filter(t=>t.diferencia!==null&&t.galones_sistema>0&&Math.abs(t.pct_diferencia||0)>TOLERANCIA_PCT);
              return(
                <tr key={inv.id} style={{background:i%2===0?TH.card:"#f8fafc"}}>
                  <td style={{padding:"8px 10px",fontFamily:"monospace",fontWeight:700,color:TH.navy,borderBottom:`1px solid ${TH.border}`}}>{inv.numero||inv.id}</td>
                  <td style={{padding:"8px 10px",borderBottom:`1px solid ${TH.border}`}}>{inv.fecha?new Date(inv.fecha+"T12:00:00").toLocaleDateString("es-CO"):"—"}</td>
                  <td style={{padding:"8px 10px",borderBottom:`1px solid ${TH.border}`}}>{inv.planta}</td>
                  <td style={{padding:"8px 10px",borderBottom:`1px solid ${TH.border}`}}>{inv.turno||"—"}</td>
                  <td style={{padding:"8px 10px",borderBottom:`1px solid ${TH.border}`}}>{inv.operador||"—"}</td>
                  <td style={{padding:"8px 10px",textAlign:"center",borderBottom:`1px solid ${TH.border}`,color:TH.muted}}>{(inv.tanques||[]).length}</td>
                  <td style={{padding:"8px 10px",textAlign:"center",borderBottom:`1px solid ${TH.border}`}}>
                    {nov.length===0?<span style={{color:TH.success,fontWeight:700}}>✓ OK</span>:<span style={{color:TH.danger,fontWeight:700}}>⚠ {nov.length}</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  // ── Main ──────────────────────────────────────────────────────────────────────
  const TABS=[{k:"nuevo",l:"Nuevo Inventario"},{k:"balance",l:"⚖ Balance Diario"},{k:"historial",l:"Historial"},{k:"analisis",l:"📊 Análisis"}];

  return(
    <div style={{padding:"20px 24px",maxWidth:1200,margin:"0 auto"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20,flexWrap:"wrap",gap:12}}>
        <div>
          <div style={{fontSize:20,fontWeight:900,color:TH.navy}}>📋 Inventario Diario de Tanques</div>
          <div style={{fontSize:12,color:TH.muted,marginTop:2}}>Registro de medidas físicas al inicio de turno</div>
        </div>
        <div style={{display:"flex",gap:8}}>
          {TABS.map(({k,l})=>(
            <button key={k} onClick={()=>setActiveTab(k)} style={{
              padding:"7px 18px",borderRadius:6,fontWeight:700,fontSize:12,cursor:"pointer",
              background:activeTab===k?TH.orange:"transparent",
              color:activeTab===k?"#fff":TH.muted,
              border:`2px solid ${activeTab===k?TH.orange:TH.border}`,
            }}>{l}</button>
          ))}
        </div>
      </div>

      {activeTab==="historial" && renderHistorial()}
      {activeTab==="analisis"  && renderAnalisis()}
      {activeTab==="balance"   && renderBalance()}
      {activeTab==="nuevo" && (
        <>
          {/* Selector planta */}
          <div style={{display:"flex",gap:0,marginBottom:20,borderRadius:8,overflow:"hidden",border:`1px solid ${TH.border}`,width:"fit-content"}}>
            {[{k:"P1",l:"Planta 1 — Barcaza QBS002"},{k:"P2",l:"Planta 2 — TK-111 a TK-117"}].map(({k,l})=>(
              <button key={k} onClick={()=>setPlanta(k)} style={{
                padding:"10px 24px",fontWeight:700,fontSize:13,cursor:"pointer",
                background:planta===k?TH.navy:TH.card,
                color:planta===k?"#fff":TH.muted,
                border:"none",transition:"background 0.15s",
              }}>{l}</button>
            ))}
          </div>

          {/* Campos comunes */}
          <div style={{display:"flex",gap:16,marginBottom:16,flexWrap:"wrap"}}>
            <div>
              <div style={{fontSize:10,color:TH.navy,fontWeight:700,textTransform:"uppercase",letterSpacing:1,marginBottom:4}}>Fecha</div>
              <input type="date" value={fechaReg} onChange={e=>setFechaReg(e.target.value)}
                style={{padding:"6px 10px",border:`1px solid ${TH.border}`,borderRadius:6,fontSize:13,color:TH.text,background:TH.card}}/>
            </div>
            <div>
              <div style={{fontSize:10,color:TH.navy,fontWeight:700,textTransform:"uppercase",letterSpacing:1,marginBottom:4}}>Turno</div>
              <select value={turno} onChange={e=>setTurno(e.target.value)}
                style={{padding:"6px 10px",border:`1px solid ${TH.border}`,borderRadius:6,fontSize:13,color:TH.text,background:TH.card}}>
                <option>DIURNO</option>
                <option>NOCTURNO</option>
              </select>
            </div>
            <div style={{minWidth:220}}>
              <div style={{fontSize:10,color:TH.navy,fontWeight:700,textTransform:"uppercase",letterSpacing:1,marginBottom:4}}>Operador</div>
              <input value={operador} onChange={e=>setOperador(e.target.value)}
                style={{padding:"6px 10px",border:`1px solid ${TH.border}`,borderRadius:6,fontSize:13,color:TH.text,background:TH.card,width:"100%",boxSizing:"border-box"}}/>
            </div>
          </div>

          <div style={{background:TH.card,borderRadius:10,border:`1px solid ${TH.border}`,padding:20,marginBottom:16,boxShadow:"0 2px 8px rgba(0,0,0,0.06)"}}>
            {planta==="P1"?renderTablaP1():renderTablaP2()}
          </div>

          {renderResumen()}

          <div style={{marginBottom:16}}>
            <div style={{fontSize:10,color:TH.navy,fontWeight:700,textTransform:"uppercase",letterSpacing:1,marginBottom:4}}>Observaciones</div>
            <textarea value={obs} onChange={e=>setObs(e.target.value)} rows={2}
              style={{width:"100%",boxSizing:"border-box",padding:"8px 10px",border:`1px solid ${TH.border}`,borderRadius:6,fontSize:13,color:TH.text,background:TH.card,resize:"vertical"}}/>
          </div>

          <Btn onClick={guardar} disabled={saving}>{saving?"Guardando...":"💾 Guardar Inventario"}</Btn>
        </>
      )}
    </div>
  );
}
