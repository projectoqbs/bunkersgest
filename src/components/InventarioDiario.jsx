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

  // Detalle historial
  const [selectedInv, setSelectedInv] = useState(null);

  // Análisis
  const [analisisPlanta, setAnalisisPlanta] = useState("P1");
  const [tanqueSeleccionado, setTanqueSeleccionado] = useState("");

  // Balance diario
  const [balancePlanta, setBalancePlanta]     = useState("P1");
  const [balanceDesde,  setBalanceDesde]      = useState(()=>{ const d=new Date(); d.setDate(1); return d.toISOString().split("T")[0]; });
  const [balanceHasta,  setBalanceHasta]      = useState(()=>new Date().toISOString().split("T")[0]);
  const [balanceInvsRango, setBalanceInvsRango] = useState([]); // inventarios físicos (todo el historial)
  const [balanceCmtsRango, setBalanceCmtsRango] = useState([]); // CMTs del rango seleccionado
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
    // Carga inventarios físicos completos (todo el historial, para poder establecer el nivel inicial)
    // y CMTs del rango para calcular inventario teórico
    const [invRes, cmtRes] = await Promise.all([
      dbCall({ table:"inventarios_diarios", op:"select", select:"*", filters:[], single:false }),
      dbCall({ table:"cmts", op:"select",
        select:"numero_cmt,fecha,tipo_operacion,planta,total_movido,tanques_antes,tanques_despues,tanques_recepcion,porteo_carga_tanques,porteo_descarga_tanques",
        filters:[
          {col:"fecha",op:"gte",val:(()=>{ const d=new Date(desde+"T12:00:00"); d.setDate(d.getDate()-90); return d.toISOString().split("T")[0]; })()},
          {col:"fecha",op:"lte",val:hasta}
        ], single:false }),
    ]);
    setBalanceInvsRango(invRes.data||[]);
    setBalanceCmtsRango(cmtRes.data||[]);
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

    // ── Inventario teórico: reconstruir nivel por tanque día a día desde CMTs ──
    // 1. Todos los inventarios físicos históricos de esta planta
    const todosInvsPlanta = balanceInvsRango.filter(i => i.planta === plantaLabel)
      .sort((a,b)=>a.fecha.localeCompare(b.fecha));

    // 2. Generar todos los días del rango seleccionado
    const allFechasRango = [];
    { let d = new Date(balanceDesde+"T12:00:00"), fin = new Date(balanceHasta+"T12:00:00");
      while(d<=fin){ allFechasRango.push(d.toISOString().split("T")[0]); d=new Date(d); d.setDate(d.getDate()+1); } }

    // 3. CMTs del rango agrupados por fecha, extraer snapshots de nivel final por tanque
    const snapPorFecha = {}; // fecha → { tankId → nivel_final }
    for(const c of balanceCmtsRango){
      if(!c.fecha) continue;
      if(!snapPorFecha[c.fecha]) snapPorFecha[c.fecha]={};
      const snap = snapPorFecha[c.fecha];
      const setSnap=(tq,v)=>{ if(tq&&v!=null&&v!=="") snap[tq]=Number(v); };
      for(const td of (c.tanques_despues||[]))        setSnap(td.tanque, td.galones);
      for(const tr of (c.tanques_recepcion||[]))      setSnap(tr.tanque, tr.galonesFinal);
      for(const tp of (c.porteo_descarga_tanques||[])) setSnap(tp.tanque, tp.galonesFinal);
      for(const tc of (c.porteo_carga_tanques||[]))   setSnap(tc.tanque, tc.galonesFinal);
    }

    // 4. Reconstruir nivel teórico día a día
    // Nivel inicial = último inventario físico + últimos CMTs ANTES del rango
    const invAnteRango = [...todosInvsPlanta].reverse().find(i=>i.fecha<balanceDesde);
    const nivelActual = {};
    if(invAnteRango){
      for(const t of (invAnteRango.tanques||[])) if(t.tanque) nivelActual[t.tanque]=Number(t.galones_calculados||0);
    }
    // Aplicar CMTs antes del rango (cronológico) para tanques sin inventario físico previo
    const setSnapN=(tq,v)=>{ if(tq&&v!=null&&v!=="") nivelActual[tq]=Number(v); };
    for(const c of [...balanceCmtsRango].filter(c=>c.fecha&&c.fecha<balanceDesde).sort((a,b)=>a.fecha.localeCompare(b.fecha))){
      for(const td of (c.tanques_despues||[]))         setSnapN(td.tanque, td.galones);
      for(const tr of (c.tanques_recepcion||[]))       setSnapN(tr.tanque, tr.galonesFinal);
      for(const tp of (c.porteo_descarga_tanques||[])) setSnapN(tp.tanque, tp.galonesFinal);
      for(const tc of (c.porteo_carga_tanques||[]))    setSnapN(tc.tanque, tc.galonesFinal);
    }

    // matrix[tanque][fecha] = { gls, fuente: "fisico" | "teorico" }
    const matrix = {};
    const setMatriz=(tq,f,gls,fuente)=>{
      if(!matrix[tq]) matrix[tq]={};
      matrix[tq][f]={gls,fuente};
    };

    for(const fecha of allFechasRango){
      const snap = snapPorFecha[fecha]||{};

      // ¿Hay inventario físico registrado este día?
      const invFisico = todosInvsPlanta.find(i=>i.fecha===fecha);
      if(invFisico){
        // Primero aplicar CMTs del día (pueden ser anteriores al físico)
        Object.assign(nivelActual, snap);
        // Luego el físico sobreescribe nivelActual (para la celda de la matrix)
        for(const t of (invFisico.tanques||[])){
          if(!t.tanque) continue;
          nivelActual[t.tanque]=Number(t.galones_calculados||0);
          setMatriz(t.tanque, fecha, Number(t.galones_calculados||0), "fisico");
        }
        // Re-aplicar CMTs encima del físico: si hubo CMTs DESPUÉS del inventario físico
        // (ej. porteo recibido tras la medición), el carry-forward debe reflejarlos
        Object.assign(nivelActual, snap);
      } else {
        // Sin físico: aplicar CMTs y guardar nivel teórico
        Object.assign(nivelActual, snap);
        for(const tq of tanquesPlanta){
          if(nivelActual[tq]!=null) setMatriz(tq, fecha, nivelActual[tq], "teorico");
        }
      }
    }

    // Usar TODAS las fechas del rango que tengan datos en la matrix
    const fechas = allFechasRango.filter(f=>tanquesPlanta.some(tq=>matrix[tq]?.[f]!=null));
    const maxPorTanque = {};
    for(const tq of tanquesPlanta){
      maxPorTanque[tq] = Math.max(...fechas.map(f=>matrix[tq]?.[f]?.gls||0), 1);
    }

    const invsOrdenados = [...todosInvsPlanta].sort((a,b)=>a.fecha.localeCompare(b.fecha));

    const fmtFecha = f => new Date(f+"T12:00:00").toLocaleDateString("es-CO",{day:"2-digit",month:"short"});

    // ── Panel detalle del día seleccionado ──────────────────────────────────
    const fmtFechaDia = f => new Date(f+"T12:00:00").toLocaleDateString("es-CO",{weekday:"long",day:"2-digit",month:"long"});
    const detalleDia = (()=>{
      if(!balanceFechaDia) return null;
      // Movimientos por tanque solo para ese día, calculados desde los CMTs cargados
      const movsDia = {};
      const addD = (tq,gls,esE)=>{
        if(!tq||gls<=0) return;
        if(!movsDia[tq]) movsDia[tq]={entradas:0,salidas:0,cmts:new Set()};
        if(esE) movsDia[tq].entradas+=gls; else movsDia[tq].salidas+=gls;
      };
      for(const c of (balanceCmtsDia||[])){
        const num = c.numero_cmt||c.id||"";
        // tanques_antes/despues por nombre
        (c.tanques_antes||[]).forEach(ta=>{
          const td=(c.tanques_despues||[]).find(x=>x.tanque===ta.tanque);
          if(!td||!ta.tanque) return;
          const delta=Number(ta.galones||0)-Number(td.galones||0);
          if(delta>0){ addD(ta.tanque,delta,false); movsDia[ta.tanque].cmts.add(num); }
          else if(delta<0){ addD(ta.tanque,-delta,true); movsDia[ta.tanque].cmts.add(num); }
        });
        (c.tanques_recepcion||[]).forEach(tr=>{
          if(!tr.tanque) return;
          const delta=Number(tr.galonesFinal||0)-Number(tr.galonesInicial||0);
          if(delta>0){ addD(tr.tanque,delta,true); movsDia[tr.tanque].cmts.add(num); }
        });
        (c.porteo_carga_tanques||[]).forEach(tc=>{
          if(!tc.tanque) return;
          const delta=Number(tc.galonesInicial||0)-Number(tc.galonesFinal||0);
          if(delta>0){ addD(tc.tanque,delta,false); movsDia[tc.tanque].cmts.add(num); }
        });
        (c.porteo_descarga_tanques||[]).forEach(td=>{
          if(!td.tanque) return;
          const delta=Number(td.galonesFinal||0)-Number(td.galonesInicial||0);
          if(delta>0){ addD(td.tanque,delta,true); movsDia[td.tanque].cmts.add(num); }
        });
      }
      const filasDia = Object.entries(movsDia)
        .filter(([tq])=>tanquesPlanta.includes(tq))
        .sort(([a],[b])=>a.localeCompare(b));
      return { filasDia, cmtsTotal: balanceCmtsDia||[] };
    })();

    return (
      <div>
        {/* ── Controles + Panel día ── */}
        <div style={{display:"flex",gap:16,marginBottom:18,flexWrap:"wrap",alignItems:"flex-start"}}>
          {/* Controles izquierda */}
          <div style={{display:"flex",gap:12,flexWrap:"wrap",alignItems:"flex-end"}}>
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

          {/* Panel detalle del día — aparece al hacer click en una columna */}
          {balanceFechaDia && (
            <div style={{flex:"1 1 280px",minWidth:260,maxWidth:460,background:TH.card,border:`1px solid ${TH.border}`,
              borderRadius:10,padding:"12px 16px",boxShadow:"0 2px 8px rgba(0,56,115,0.07)"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                <div>
                  <div style={{fontSize:9,fontWeight:700,textTransform:"uppercase",letterSpacing:1,color:TH.muted}}>Detalle del día</div>
                  <div style={{fontSize:13,fontWeight:800,color:TH.navy,textTransform:"capitalize"}}>{fmtFechaDia(balanceFechaDia)}</div>
                </div>
                <div style={{fontSize:10,color:TH.muted,textAlign:"right"}}>
                  {loadingDia ? "Cargando..." : `${(balanceCmtsDia||[]).length} CMT(s)`}
                </div>
              </div>
              {loadingDia ? (
                <div style={{color:TH.muted,fontSize:12,padding:"8px 0"}}>Cargando movimientos...</div>
              ) : detalleDia?.filasDia?.length === 0 ? (
                <div style={{color:TH.muted,fontSize:12,padding:"4px 0"}}>Sin movimientos en {plantaLabel} este día</div>
              ) : (
                <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
                  <thead>
                    <tr style={{borderBottom:`1px solid ${TH.border}`}}>
                      <th style={{padding:"4px 6px",textAlign:"left",fontWeight:700,color:TH.muted,fontSize:9,textTransform:"uppercase",letterSpacing:0.8}}>Tanque</th>
                      <th style={{padding:"4px 6px",textAlign:"right",fontWeight:700,color:"#00B894",fontSize:9,textTransform:"uppercase",letterSpacing:0.8}}>+ Entradas</th>
                      <th style={{padding:"4px 6px",textAlign:"right",fontWeight:700,color:TH.danger,fontSize:9,textTransform:"uppercase",letterSpacing:0.8}}>− Salidas</th>
                      <th style={{padding:"4px 6px",textAlign:"left",fontWeight:700,color:TH.muted,fontSize:9,textTransform:"uppercase",letterSpacing:0.8}}>CMT(s)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detalleDia.filasDia.map(([tq,mov])=>(
                      <tr key={tq} style={{borderBottom:`1px solid ${TH.border}44`}}>
                        <td style={{padding:"5px 6px",fontWeight:700,color:TH.navy,fontSize:11}}>{tq}</td>
                        <td style={{padding:"5px 6px",textAlign:"right",fontFamily:"monospace",color:mov.entradas>0?"#00B894":TH.muted,fontWeight:mov.entradas>0?700:400}}>
                          {mov.entradas>0?`+${fmtN(mov.entradas,0)}`:"—"}
                        </td>
                        <td style={{padding:"5px 6px",textAlign:"right",fontFamily:"monospace",color:mov.salidas>0?TH.danger:TH.muted,fontWeight:mov.salidas>0?700:400}}>
                          {mov.salidas>0?`−${fmtN(mov.salidas,0)}`:"—"}
                        </td>
                        <td style={{padding:"5px 6px",fontSize:9,color:TH.muted,maxWidth:100,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                          {[...mov.cmts].join(", ")||"—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>

        {/* ── Matriz inventario físico ── */}
        {loadingBalance ? (
          <div style={{color:TH.muted,padding:24,textAlign:"center"}}>Cargando inventarios...</div>
        ) : fechas.length === 0 ? (
          <div style={{padding:"24px 0",textAlign:"center",color:TH.muted,fontSize:14}}>
            Sin inventarios ni CMTs registrados para {plantaLabel} en el período seleccionado
          </div>
        ) : (
          <>
          {/* Leyenda */}
          <div style={{display:"flex",gap:14,marginBottom:8,fontSize:11,alignItems:"center"}}>
            <span style={{display:"flex",alignItems:"center",gap:5,fontWeight:700,color:TH.navy}}>
              <span style={{width:12,height:12,borderRadius:2,background:TH.navy,display:"inline-block"}}/>
              Físico registrado
            </span>
            <span style={{display:"flex",alignItems:"center",gap:5,fontWeight:700,color:"#6C5CE7"}}>
              <span style={{width:12,height:12,borderRadius:2,background:"#6C5CE7",display:"inline-block",opacity:0.7}}/>
              Teórico (calculado desde CMTs)
            </span>
          </div>
          <div data-scroll-key="inventario-matriz" style={{overflowX:"auto",borderRadius:10,border:`1px solid ${TH.border}`,marginBottom:20}}>
            <table style={{borderCollapse:"collapse",tableLayout:"auto"}}>
              <thead>
                <tr style={{background:TH.navy}}>
                  <th style={{padding:"10px 16px",textAlign:"left",color:"#fff",fontSize:12,fontWeight:700,
                    position:"sticky",left:0,background:TH.navy,zIndex:2,whiteSpace:"nowrap"}}>
                    Tanque
                  </th>
                  {fechas.map(f=>{
                    const tieneFisico = tanquesPlanta.some(tq=>matrix[tq]?.[f]?.fuente==="fisico");
                    return(
                    <th key={f} onClick={()=>{ setBalanceFechaDia(f); loadCmtsDia(f); }}
                      style={{padding:"10px 14px",
                        color:f===balanceFechaDia?"#FFD700":tieneFisico?"#b8d4ee":"#c4b5fd",
                        fontSize:11,fontWeight:700,cursor:"pointer",minWidth:110,textAlign:"center",whiteSpace:"nowrap",
                        background:f===balanceFechaDia?"#005299":TH.navy,
                        borderLeft:`1px solid #ffffff22`,transition:"background 0.15s"}}>
                      {fmtFecha(f)}
                      {!tieneFisico&&<div style={{fontSize:8,fontWeight:400,opacity:0.7,letterSpacing:0.5}}>teórico</div>}
                    </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {tanquesPlanta.map((tq,ri)=>{
                  const hasAnyData = fechas.some(f=>matrix[tq]?.[f]!=null);
                  return(
                    <tr key={tq} style={{background:ri%2===0?TH.card:"#f4f7fb"}}>
                      <td style={{padding:"10px 16px",fontWeight:700,color:TH.navy,fontSize:12,
                        whiteSpace:"nowrap",position:"sticky",left:0,
                        background:ri%2===0?TH.card:"#f4f7fb",zIndex:1,
                        borderRight:`2px solid ${TH.border}`}}>
                        {tq}
                      </td>
                      {fechas.map(f=>{
                        const entry = matrix[tq]?.[f];
                        const gls = entry?.gls;
                        const fuente = entry?.fuente;
                        const isSelected = f===balanceFechaDia;
                        const esTeorico = fuente==="teorico";
                        return(
                          <td key={f} onClick={()=>{ setBalanceFechaDia(f); loadCmtsDia(f); }}
                            style={{padding:"8px 14px",textAlign:"right",cursor:"pointer",
                              borderLeft:`1px solid ${TH.border}`,
                              background:isSelected?(esTeorico?"#f0ebff":"#e8f4fd"):undefined,
                              transition:"background 0.15s"}}>
                            {gls != null ? (
                              <span style={{fontFamily:"monospace",
                                fontWeight:esTeorico?500:700,
                                color:esTeorico?"#6C5CE7":TH.navy,
                                fontSize:12,
                                fontStyle:esTeorico?"italic":"normal"}}>
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
                    const total = tanquesPlanta.reduce((s,tq)=>s+(matrix[tq]?.[f]?.gls||0),0);
                    const esTeorico = tanquesPlanta.some(tq=>matrix[tq]?.[f]?.fuente==="teorico");
                    const isSelected = f===balanceFechaDia;
                    return(
                      <td key={f} style={{padding:"10px 14px",textAlign:"right",
                        borderLeft:`1px solid ${TH.border}`,
                        background:isSelected?(esTeorico?"#ede9fe":"#d4eaf8"):"#eaf0f8"}}>
                        <span style={{fontFamily:"monospace",fontWeight:900,fontSize:13,
                          color:esTeorico?"#6C5CE7":TH.navy,
                          fontStyle:esTeorico?"italic":"normal"}}>
                          {total > 0 ? fmtN(total,0) : "—"}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </div>
          </>
        )}

        {/* ── Balance por tanque (rango desde→hasta) ── */}
        {(()=>{
          // Inv. inicial por tanque — prioridad:
          // 1. Físico registrado en "desde" (fuente=fisico en matrix)
          // 2. tanques_antes del primer CMT del rango: medición física al inicio de la
          //    operación → ES la lectura real más confiable para tanques sin físico diario
          // 3. Teórico de la matrix (carry-forward de CMTs previos)
          // 4. Inventario físico antes del rango
          const cmtsOrdenados = [...balanceCmtsRango]
            .filter(c=>c.fecha>=balanceDesde && c.fecha<balanceHasta)
            .sort((a,b)=>(a.fecha||"").localeCompare(b.fecha||""));

          // Construir mapa: primer tanques_antes por tanque dentro del rango
          const primerAntesRango = {};
          for(const c of cmtsOrdenados){
            for(const ta of (c.tanques_antes||[])){
              if(!ta.tanque || primerAntesRango[ta.tanque]!=null) continue;
              if(ta.galones!=null && ta.galones!=="") primerAntesRango[ta.tanque]=Number(ta.galones);
            }
          }

          const invInicialPorTanque = {};
          for(const tq of tanquesPlanta){
            // 1. Físico en "desde"
            const exacto = matrix[tq]?.[balanceDesde];
            if(exacto?.fuente==="fisico"){ invInicialPorTanque[tq]=exacto.gls; continue; }
            // 2. tanques_antes del primer CMT en el rango (lectura real)
            if(primerAntesRango[tq]!=null){ invInicialPorTanque[tq]=primerAntesRango[tq]; continue; }
            // 3. Teórico en "desde" o primer teórico del rango
            if(exacto?.gls!=null){ invInicialPorTanque[tq]=exacto.gls; continue; }
            for(const f of allFechasRango){
              const e = matrix[tq]?.[f];
              if(e?.gls!=null){ invInicialPorTanque[tq]=e.gls; break; }
            }
          }
          // 4. Fallback: físico antes del rango
          const invAntes = [...invsOrdenados].reverse().find(i=>i.fecha<balanceDesde)||null;
          for(const t of (invAntes?.tanques||[])){
            if(t.tanque && invInicialPorTanque[t.tanque]==null)
              invInicialPorTanque[t.tanque]=Number(t.galones_calculados||0);
          }

          // Inv. final = solo inventario FÍSICO registrado en la fecha "hasta"
          // (no teórico — la columna "Registrado" muestra solo mediciones reales)
          const invFinalPorTanque = {};
          const invFisicoHasta = todosInvsPlanta.find(i=>i.fecha===balanceHasta);
          for(const t of (invFisicoHasta?.tanques||[])){
            if(t.tanque) invFinalPorTanque[t.tanque]=Number(t.galones_calculados||0);
          }

          // Movimientos ACUMULADOS desde "desde" hasta el día ANTERIOR a "hasta".
          // Los CMTs del día "hasta" se excluyen porque el físico se tomó al INICIO
          // de ese día, antes de cualquier operación — así teórico y registrado
          // comparan el mismo momento (inicio del día "hasta").
          const movsPorTanque = {};
          const addMov = (tq,gls,esEntrada)=>{
            if(!tq||gls<=0) return;
            if(!movsPorTanque[tq]) movsPorTanque[tq]={entradas:0,salidas:0};
            if(esEntrada) movsPorTanque[tq].entradas+=gls;
            else          movsPorTanque[tq].salidas+=gls;
          };
          for(const c of balanceCmtsRango.filter(c=>c.fecha>=balanceDesde && c.fecha<balanceHasta)){
            // tanques_antes / tanques_despues: emparejamiento por nombre de tanque.
            // Si el tanque no aparece en despues, se omite (el movimiento lo capturan
            // porteo_* o tanques_recepcion, y así evitamos falsos movimientos por índice).
            (c.tanques_antes||[]).forEach(ta=>{
              if(!ta.tanque) return;
              const td=(c.tanques_despues||[]).find(x=>x.tanque===ta.tanque);
              if(!td) return;
              const delta=Number(ta.galones||0)-Number(td.galones||0);
              if(delta>0) addMov(ta.tanque,delta,false);    // salida
              else if(delta<0) addMov(ta.tanque,-delta,true); // entrada
            });
            // tanques_recepcion: tanque destino (entrada)
            (c.tanques_recepcion||[]).forEach(tr=>{
              if(!tr.tanque) return;
              const delta=Number(tr.galonesFinal||0)-Number(tr.galonesInicial||0);
              if(delta>0) addMov(tr.tanque,delta,true);
            });
            // porteo: carga=salida, descarga=entrada
            (c.porteo_carga_tanques||[]).forEach(tc=>{
              if(!tc.tanque) return;
              const delta=Number(tc.galonesInicial||0)-Number(tc.galonesFinal||0);
              if(delta>0) addMov(tc.tanque,delta,false);
            });
            (c.porteo_descarga_tanques||[]).forEach(td=>{
              if(!td.tanque) return;
              const delta=Number(td.galonesFinal||0)-Number(td.galonesInicial||0);
              if(delta>0) addMov(td.tanque,delta,true);
            });
          }

          // Tanques a mostrar: TODOS los de la planta, siempre (con 0 si no hay datos)
          const todosLosIds = [...tanquesPlanta].sort();

          if(todosLosIds.length===0) return (
            <div style={{padding:"24px 0",textAlign:"center",color:TH.muted,fontSize:13}}>
              Sin datos de inventario ni CMTs para el período en {plantaLabel}
            </div>
          );

          const filas = todosLosIds.map(tq=>{
            const inv0=invInicialPorTanque[tq]??null;
            const invF=invFinalPorTanque[tq]??null;
            const {entradas=0,salidas=0}=movsPorTanque[tq]||{};
            const teorico=inv0!==null ? inv0+entradas-salidas : null;
            const variacion=(teorico!==null&&invF!==null) ? invF-teorico : null;
            return {tq,inv0,entradas,salidas,teorico,invF,variacion};
          });

          const totInv0=filas.reduce((s,r)=>s+(r.inv0??0),0);
          const totE=filas.reduce((s,r)=>s+r.entradas,0);
          const totS=filas.reduce((s,r)=>s+r.salidas,0);
          const hasTeorico=filas.some(r=>r.teorico!==null);
          const totTeo=hasTeorico?filas.reduce((s,r)=>s+(r.teorico??0),0):null;
          const hasInvF=filas.some(r=>r.invF!==null);
          const totInvF=hasInvF?filas.reduce((s,r)=>s+(r.invF??0),0):null;
          const totVar=(totTeo!==null&&totInvF!==null)?totInvF-totTeo:null;

          const colH={padding:"9px 12px",fontSize:9,fontWeight:700,letterSpacing:1.2,textTransform:"uppercase",color:"#aac8e8",whiteSpace:"nowrap",textAlign:"right",borderLeft:"1px solid #ffffff18"};
          const colHl={...colH,textAlign:"left",borderLeft:"none"};
          const cell={padding:"9px 12px",fontSize:12,fontFamily:"monospace",textAlign:"right",borderBottom:`1px solid ${TH.border}`,borderLeft:`1px solid ${TH.border}`,whiteSpace:"nowrap"};
          const cellL={...cell,textAlign:"left",fontWeight:700,color:TH.navy,borderLeft:"none",fontFamily:"system-ui,sans-serif"};

          const fmtVar=(v)=>{
            if(v===null) return <span style={{color:TH.muted}}>—</span>;
            const pct=Math.abs(v)>0&&totTeo?((Math.abs(v)/totTeo)*100).toFixed(2):"0.00";
            const col=v<0?TH.danger:v>0?TH.success:TH.muted;
            return <span style={{color:col,fontWeight:700}}>{v>0?"+":""}{fmtN(v,0)} <span style={{fontSize:10,fontWeight:400}}>({pct}%)</span></span>;
          };

          return (
            <div>
              <div style={{fontWeight:800,fontSize:13,color:TH.navy,marginBottom:12,letterSpacing:0.3}}>
                BALANCE POR TANQUE · {fmtFecha(balanceDesde)} → {fmtFecha(balanceHasta)} · {plantaLabel}
              </div>
              {(
              <div data-scroll-key="inventario-balance-tabla" style={{overflowX:"auto",borderRadius:10,border:`1px solid ${TH.border}`}}>
                <table style={{borderCollapse:"collapse",width:"100%",fontSize:12}}>
                  <thead>
                    <tr style={{background:TH.navy}}>
                      <th style={{...colHl,minWidth:110}}>Tanque</th>
                      <th style={colH}>Inv. Inicial</th>
                      <th style={{...colH,color:"#7fffd4"}}>+ Entradas</th>
                      <th style={{...colH,color:"#ffaaaa"}}>− Salidas</th>
                      <th style={colH}>Teórico</th>
                      <th style={{...colH,color:"#ffe082"}}>Registrado</th>
                      <th style={{...colH,minWidth:120}}>Variación</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filas.map((r,i)=>{
                      const varCol=r.variacion===null?TH.muted:r.variacion<0?TH.danger:r.variacion>0?TH.success:TH.muted;
                      const pct=r.variacion!==null&&r.teorico?((Math.abs(r.variacion)/r.teorico)*100).toFixed(2):"0.00";
                      return(
                        <tr key={r.tq} style={{background:i%2===0?TH.card:"#f4f7fb"}}>
                          <td style={{...cellL,background:i%2===0?TH.card:"#f4f7fb"}}>{r.tq}</td>
                          <td style={cell}>{r.inv0!==null?fmtN(r.inv0,0):<span style={{color:TH.muted}}>—</span>}</td>
                          <td style={{...cell,color:r.entradas>0?TH.success:TH.muted,fontWeight:r.entradas>0?700:400}}>
                            {r.entradas>0?`+${fmtN(r.entradas,0)}`:"—"}
                          </td>
                          <td style={{...cell,color:r.salidas>0?TH.danger:TH.muted,fontWeight:r.salidas>0?700:400}}>
                            {r.salidas>0?`−${fmtN(r.salidas,0)}`:"—"}
                          </td>
                          <td style={{...cell,fontWeight:700,color:TH.navy}}>{r.teorico!==null?fmtN(r.teorico,0):<span style={{color:TH.muted}}>—</span>}</td>
                          <td style={{...cell,color:r.invF!==null?TH.navy:TH.muted}}>{r.invF!==null?fmtN(r.invF,0):"—"}</td>
                          <td style={{...cell,color:varCol,fontWeight:r.variacion!==null?700:400}}>
                            {r.variacion!==null
                              ?<span>{r.variacion>0?"+":""}{fmtN(r.variacion,0)} <span style={{fontSize:10,fontWeight:400}}>({pct}%)</span></span>
                              :<span style={{color:TH.muted}}>—</span>}
                          </td>
                        </tr>
                      );
                    })}
                    {/* Fila total */}
                    <tr style={{background:"#e8f0f8",borderTop:`2px solid ${TH.navy}`}}>
                      <td style={{...cellL,background:"#e8f0f8",fontWeight:900,fontSize:12,color:TH.navy,borderTop:`2px solid ${TH.navy}`}}>TOTAL</td>
                      <td style={{...cell,fontWeight:900,color:TH.navy,background:"#e8f0f8",borderTop:`2px solid ${TH.navy}`}}>{fmtN(totInv0,0)}</td>
                      <td style={{...cell,fontWeight:900,color:totE>0?TH.success:TH.muted,background:"#e8f0f8",borderTop:`2px solid ${TH.navy}`}}>{totE>0?`+${fmtN(totE,0)}`:"—"}</td>
                      <td style={{...cell,fontWeight:900,color:totS>0?TH.danger:TH.muted,background:"#e8f0f8",borderTop:`2px solid ${TH.navy}`}}>{totS>0?`−${fmtN(totS,0)}`:"—"}</td>
                      <td style={{...cell,fontWeight:900,color:TH.navy,background:"#e8f0f8",borderTop:`2px solid ${TH.navy}`}}>{totTeo!==null?fmtN(totTeo,0):"—"}</td>
                      <td style={{...cell,fontWeight:900,color:TH.navy,background:"#e8f0f8",borderTop:`2px solid ${TH.navy}`}}>{totInvF!==null?fmtN(totInvF,0):"—"}</td>
                      <td style={{...cell,fontWeight:900,background:"#e8f0f8",borderTop:`2px solid ${TH.navy}`,
                        color:totVar===null?TH.muted:totVar<0?TH.danger:totVar>0?TH.success:TH.muted}}>
                        {totVar!==null
                          ?<span>{totVar>0?"+":""}{fmtN(totVar,0)} {totTeo?<span style={{fontSize:10,fontWeight:400}}>({((Math.abs(totVar)/totTeo)*100).toFixed(2)}%)</span>:null}</span>
                          :"—"}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              )}
              {Object.keys(invFinalPorTanque).length===0 && (
                <div style={{marginTop:10,fontSize:11,color:TH.muted,textAlign:"center"}}>
                  Sin inventario registrado al final del período — registra un inventario para ver la variación real
                </div>
              )}
            </div>
          );
        })()}
      </div>
    );
  }

  // ── Tabla P1 ─────────────────────────────────────────────────────────────────
  function renderTablaP1(){
    return(
      <div data-scroll-key="inventario-p1-tabla" style={{overflowX:"auto"}}>
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

  // ── Modal detalle inventario ──────────────────────────────────────────────────
  function renderModalInv(){
    const inv = selectedInv;
    if(!inv) return null;
    const esP1 = (inv.planta||"").includes("1");
    const nov = (inv.tanques||[]).filter(t=>t.diferencia!==null&&t.galones_sistema>0&&Math.abs(t.pct_diferencia||0)>TOLERANCIA_PCT);
    const trim = (inv.calados_popa!=null&&inv.calados_proa!=null)
      ? mkTrim(inv.calados_popa, inv.calados_proa)
      : null;

    return(
      <div onClick={()=>setSelectedInv(null)} style={{
        position:"fixed",inset:0,background:"rgba(0,0,0,0.55)",zIndex:9000,
        display:"flex",alignItems:"flex-start",justifyContent:"center",padding:"32px 16px",overflowY:"auto"
      }}>
        <div onClick={e=>e.stopPropagation()} style={{
          background:TH.card,borderRadius:12,boxShadow:"0 8px 40px rgba(0,0,0,0.2)",
          width:"100%",maxWidth:820,padding:0,overflow:"hidden"
        }}>
          {/* Header */}
          <div style={{background:TH.navy,padding:"18px 24px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
            <div>
              <div style={{fontSize:18,fontWeight:900,color:"#fff"}}>{inv.numero||inv.id}</div>
              <div style={{fontSize:12,color:"#b8d4ee",marginTop:2}}>
                {inv.planta} · {inv.fecha?new Date(inv.fecha+"T12:00:00").toLocaleDateString("es-CO",{weekday:"long",day:"2-digit",month:"long",year:"numeric"}):"—"} · {inv.turno||"—"} · {inv.operador||"—"}
              </div>
            </div>
            <button onClick={()=>setSelectedInv(null)} style={{
              background:"transparent",border:"1px solid #ffffff44",borderRadius:6,
              color:"#fff",fontWeight:700,fontSize:14,cursor:"pointer",padding:"6px 14px"
            }}>✕ Cerrar</button>
          </div>

          <div style={{padding:"20px 24px",display:"flex",flexDirection:"column",gap:16}}>

            {/* Calados (P1) */}
            {esP1 && (inv.calados_proa||inv.calados_popa) && (
              <div style={{display:"flex",gap:16,flexWrap:"wrap"}}>
                {inv.calados_proa!=null&&<div style={{padding:"8px 16px",background:`${TH.navy}10`,borderRadius:8,fontSize:12,fontWeight:700,color:TH.navy}}>
                  Calado Proa: <span style={{fontFamily:"monospace"}}>{inv.calados_proa} m</span>
                </div>}
                {inv.calados_popa!=null&&<div style={{padding:"8px 16px",background:`${TH.navy}10`,borderRadius:8,fontSize:12,fontWeight:700,color:TH.navy}}>
                  Calado Popa: <span style={{fontFamily:"monospace"}}>{inv.calados_popa} m</span>
                </div>}
                {trim&&<div style={{padding:"8px 16px",background:`${TH.navy}10`,borderRadius:8,fontSize:12,fontWeight:700,color:TH.navy}}>
                  Trim: <span style={{fontFamily:"monospace"}}>{trim.val.toFixed(2)} m {trim.dir}</span>
                </div>}
              </div>
            )}

            {/* Novedades banner */}
            {nov.length===0
              ? <div style={{padding:"8px 16px",background:`${TH.success}15`,border:`1px solid ${TH.success}`,borderRadius:8,color:TH.success,fontWeight:700,fontSize:12}}>
                  ✓ Todos los tanques dentro del margen de tolerancia (±{TOLERANCIA_PCT}%)
                </div>
              : <div style={{padding:"8px 16px",background:`${TH.danger}10`,border:`1px solid ${TH.danger}`,borderRadius:8}}>
                  <div style={{fontWeight:800,fontSize:12,color:TH.danger,marginBottom:6}}>⚠ {nov.length} novedad(es) detectada(s)</div>
                  <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
                    {nov.map(t=>(
                      <span key={t.tanque} style={{padding:"3px 10px",borderRadius:5,fontSize:11,fontWeight:700,
                        background:t.diferencia<0?`${TH.danger}20`:`${TH.warn}20`,
                        border:`1px solid ${t.diferencia<0?TH.danger:TH.warn}`,
                        color:t.diferencia<0?TH.danger:TH.warn}}>
                        {t.tanque}: {t.diferencia>0?"+":""}{fmtN(t.diferencia,0)} gls ({(t.pct_diferencia||0)>0?"+":""}{(t.pct_diferencia||0).toFixed(1)}%)
                      </span>
                    ))}
                  </div>
                </div>
            }

            {/* Tabla de tanques */}
            <div style={{overflowX:"auto",borderRadius:8,border:`1px solid ${TH.border}`}}>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                <thead>
                  <tr style={{background:TH.navy,color:"#fff"}}>
                    <th style={{padding:"8px 12px",textAlign:"left",fontWeight:700}}>Tanque</th>
                    {esP1&&<th style={{padding:"8px 12px",textAlign:"right",fontWeight:700}}>Sonda (mm)</th>}
                    <th style={{padding:"8px 12px",textAlign:"right",fontWeight:700}}>Temp °C</th>
                    <th style={{padding:"8px 12px",textAlign:"right",fontWeight:700}}>API</th>
                    <th style={{padding:"8px 12px",textAlign:"right",fontWeight:700}}>Gls Calculados</th>
                    <th style={{padding:"8px 12px",textAlign:"right",fontWeight:700}}>Gls Sistema</th>
                    <th style={{padding:"8px 12px",textAlign:"right",fontWeight:700}}>Diferencia</th>
                    <th style={{padding:"8px 12px",textAlign:"center",fontWeight:700}}>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {(inv.tanques||[]).map((t,i)=>{
                    const isOk = t.diferencia===null||t.galones_sistema===0||Math.abs(t.pct_diferencia||0)<=TOLERANCIA_PCT;
                    const rowBg = i%2===0?TH.card:"#f8fafc";
                    const difColor = !t.diferencia||isOk?TH.success:t.diferencia<0?TH.danger:TH.warn;
                    return(
                      <tr key={t.tanque} style={{background:rowBg}}>
                        <td style={{padding:"8px 12px",fontWeight:700,color:TH.navy,borderBottom:`1px solid ${TH.border}`}}>{t.tanque}</td>
                        {esP1&&<td style={{padding:"8px 12px",textAlign:"right",fontFamily:"monospace",borderBottom:`1px solid ${TH.border}`,color:TH.muted}}>{t.sonda||"—"}</td>}
                        <td style={{padding:"8px 12px",textAlign:"right",fontFamily:"monospace",borderBottom:`1px solid ${TH.border}`,color:TH.muted}}>{t.temperatura||"—"}</td>
                        <td style={{padding:"8px 12px",textAlign:"right",fontFamily:"monospace",borderBottom:`1px solid ${TH.border}`,color:TH.muted}}>{t.api||"—"}</td>
                        <td style={{padding:"8px 12px",textAlign:"right",fontFamily:"monospace",fontWeight:700,borderBottom:`1px solid ${TH.border}`,color:TH.navy}}>
                          {t.galones_calculados!==null?fmtN(t.galones_calculados,0):"—"}
                        </td>
                        <td style={{padding:"8px 12px",textAlign:"right",fontFamily:"monospace",borderBottom:`1px solid ${TH.border}`,color:TH.muted}}>
                          {t.galones_sistema!==null?fmtN(t.galones_sistema,0):"—"}
                        </td>
                        <td style={{padding:"8px 12px",textAlign:"right",fontFamily:"monospace",fontWeight:700,borderBottom:`1px solid ${TH.border}`,color:difColor}}>
                          {t.diferencia!==null
                            ?<>{(t.diferencia>0?"+":"")+fmtN(t.diferencia,0)} <span style={{fontSize:10,fontWeight:400}}>({(t.pct_diferencia||0)>0?"+":""}{(t.pct_diferencia||0).toFixed(1)}%)</span></>
                            :"—"}
                        </td>
                        <td style={{padding:"8px 12px",textAlign:"center",borderBottom:`1px solid ${TH.border}`}}>
                          {t.diferencia===null||t.galones_sistema===0
                            ? <span style={{color:TH.muted,fontSize:10}}>—</span>
                            : isOk
                            ? <span style={{color:TH.success,fontWeight:700,fontSize:11}}>✓ OK</span>
                            : t.diferencia<0
                            ? <span style={{color:TH.danger,fontWeight:700,fontSize:11}}>⚠ FALTANTE</span>
                            : <span style={{color:TH.warn,fontWeight:700,fontSize:11}}>↑ SOBRANTE</span>
                          }
                        </td>
                      </tr>
                    );
                  })}
                  {/* Fila total */}
                  {(inv.tanques||[]).length>1&&(()=>{
                    const totCalc = (inv.tanques||[]).reduce((s,t)=>s+(t.galones_calculados||0),0);
                    const totSys  = (inv.tanques||[]).reduce((s,t)=>s+(t.galones_sistema||0),0);
                    const totDif  = totCalc-totSys;
                    return(
                      <tr style={{background:"#eaf0f8",borderTop:`2px solid ${TH.navy}`}}>
                        <td colSpan={esP1?4:3} style={{padding:"9px 12px",fontWeight:900,color:TH.navy,fontSize:12,borderTop:`2px solid ${TH.navy}`}}>TOTAL</td>
                        <td style={{padding:"9px 12px",textAlign:"right",fontFamily:"monospace",fontWeight:900,color:TH.navy,borderTop:`2px solid ${TH.navy}`}}>{fmtN(totCalc,0)}</td>
                        <td style={{padding:"9px 12px",textAlign:"right",fontFamily:"monospace",fontWeight:700,color:TH.muted,borderTop:`2px solid ${TH.navy}`}}>{fmtN(totSys,0)}</td>
                        <td style={{padding:"9px 12px",textAlign:"right",fontFamily:"monospace",fontWeight:900,borderTop:`2px solid ${TH.navy}`,
                          color:totDif<0?TH.danger:totDif>0?TH.warn:TH.success}}>
                          {(totDif>0?"+":"")+fmtN(totDif,0)}
                        </td>
                        <td style={{borderTop:`2px solid ${TH.navy}`}}/>
                      </tr>
                    );
                  })()}
                </tbody>
              </table>
            </div>

            {/* Observaciones */}
            {inv.observaciones&&(
              <div style={{padding:"10px 14px",background:`${TH.navy}08`,border:`1px solid ${TH.border}`,borderRadius:8}}>
                <div style={{fontSize:10,fontWeight:700,color:TH.muted,textTransform:"uppercase",letterSpacing:1,marginBottom:4}}>Observaciones</div>
                <div style={{fontSize:13,color:TH.text}}>{inv.observaciones}</div>
              </div>
            )}
          </div>
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
      <div data-scroll-key="inventario-historial" style={{overflowX:"auto"}}>
        <div style={{fontSize:11,color:TH.muted,marginBottom:8}}>Haz clic en un registro para ver las medidas y cálculos del día</div>
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
                <tr key={inv.id} onClick={()=>setSelectedInv(inv)}
                  style={{background:i%2===0?TH.card:"#f8fafc",cursor:"pointer",transition:"background 0.12s"}}
                  onMouseEnter={e=>e.currentTarget.style.background="#dbeafe"}
                  onMouseLeave={e=>e.currentTarget.style.background=i%2===0?TH.card:"#f8fafc"}>
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
        {selectedInv && renderModalInv()}
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
