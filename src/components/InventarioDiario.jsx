// InventarioDiario.jsx
import { useState, useEffect, useCallback } from 'react';
import {
  TB, TK, TRIM_VALS, M3_TO_GAL, TANQUES_BARCAZA, TANQUES_TKT,
  interp, interpolarBarcaza, interpolarTKT, calcVCF, calcF13, pfn, fmtN
} from '../utils/calibracion.js';

const TH = {
  navy:"#003B73", orange:"#0077CC", success:"#00B894",
  danger:"#D63031", bg:"#f0f4f8", text:"#121212", card:"#ffffff",
  border:"#d1d9e0", muted:"#6E7781", warn:"#f59e0b",
};

const TANQUES_P2 = ["TK-111","TK-112","TK-113","TK-114","TK-115","TK-116","TK-117"];
const TOLERANCIA_PCT = 0.5; // 0.5% diferencia se considera normal

function Btn({children, onClick, color, sm, disabled}){
  const bg = color || TH.orange;
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

// ─── calc P1 barcaza ────────────────────────────────────────────────────────
function calcBarcaza(tanqueKey, sonda, temp, api, trim){
  const tabla = TB[tanqueKey];
  if(!tabla) return null;
  const sv = pfn(sonda), tv = pfn(temp), av = pfn(api);
  if(isNaN(sv)) return null;
  const m3 = interpolarBarcaza(tabla, sv, trim.val, trim.dir);
  if(m3 === null) return null;
  const glsB = m3 * M3_TO_GAL;
  const vcf = (!isNaN(tv)&&!isNaN(av)) ? calcVCF(av, tv) : null;
  const glsN = vcf ? glsB * vcf : glsB;
  return { glsB: Math.round(glsB), glsN: Math.round(glsN) };
}

// ─── calc P1 TKT ─────────────────────────────────────────────────────────────
function calcTKT(tanqueKey, sonda, temp, api){
  const tabla = TK[tanqueKey];
  if(!tabla) return null;
  const sv = pfn(sonda), tv = pfn(temp), av = pfn(api);
  if(isNaN(sv)) return null;
  const glsB = interpolarTKT(tabla, sv) * M3_TO_GAL;
  const vcf = (!isNaN(tv)&&!isNaN(av)) ? calcVCF(av, tv) : null;
  const glsN = vcf ? glsB * vcf : glsB;
  return { glsB: Math.round(glsB), glsN: Math.round(glsN) };
}

function mkTrim(popa, proa){
  const po = pfn(popa)||0, pr = pfn(proa)||0;
  const val = Math.abs(po - pr);
  const dir = po > pr ? "POPA" : pr > po ? "PROA" : "CERO";
  return { val, dir };
}

function initFilasP1(){
  const barcaza = TANQUES_BARCAZA.map(t => ({
    id: `QBS002-${t}`, label: `QBS002-${t}`, tipo:"barcaza", tanqueKey:t,
    sonda:"", temp:"", api:"", activo:true,
  }));
  const tkt = TANQUES_TKT.map(t => ({
    id: t, label: t, tipo:"tkt", tanqueKey:t,
    sonda:"", temp:"", api:"", activo:true,
  }));
  return [...barcaza, ...tkt];
}

function initFilasP2(){
  return TANQUES_P2.map(t => ({
    id: t, label: t, tipo:"tierra",
    galones:"", temp:"", api:"", activo:true,
  }));
}

export default function InventarioDiario({ supabase, session, perfil, showToast, tanques, dbCall }){
  const [planta, setPlanta] = useState("P1");
  const [activeTab, setActiveTab] = useState("nuevo");

  // Formulario P1
  const [filasP1, setFilasP1] = useState(initFilasP1);
  const [calados, setCalados] = useState({proaIni:"", popaIni:""});
  const [turno, setTurno] = useState("DIURNO");
  const [operador, setOperador] = useState(perfil?.nombre||"");
  const [obs, setObs] = useState("");
  const [fechaReg, setFechaReg] = useState(new Date().toISOString().split("T")[0]);

  // Formulario P2
  const [filasP2, setFilasP2] = useState(initFilasP2);

  const [saving, setSaving] = useState(false);
  const [historial, setHistorial] = useState([]);
  const [loadingHist, setLoadingHist] = useState(false);

  const trim = mkTrim(calados.popaIni, calados.proaIni);

  // Carga historial
  const loadHist = useCallback(async () => {
    setLoadingHist(true);
    const { data } = await dbCall({ table:"inventarios_diarios", op:"select", select:"*", filters:[], single:false });
    setHistorial((data||[]).sort((a,b)=>new Date(b.created_at)-new Date(a.created_at)));
    setLoadingHist(false);
  }, [dbCall]);

  useEffect(() => { if(activeTab==="historial") loadHist(); }, [activeTab, loadHist]);

  // ── Helpers de cálculo ──────────────────────────────────────────────────────
  function calcFila(fila){
    if(fila.tipo==="barcaza") return calcBarcaza(fila.tanqueKey, fila.sonda, fila.temp, fila.api, trim);
    if(fila.tipo==="tkt")     return calcTKT(fila.tanqueKey, fila.sonda, fila.temp, fila.api);
    return null;
  }

  function nivelSistema(tanqueId){
    const t = tanques?.find(t=>t.id===tanqueId);
    return t ? Number(t.nivel||0) : null;
  }

  function diferencia(galCalculados, tanqueId){
    const sys = nivelSistema(tanqueId);
    if(sys === null || galCalculados === null) return null;
    return galCalculados - sys;
  }

  // ── Guardar inventario ──────────────────────────────────────────────────────
  async function guardar(){
    setSaving(true);
    try {
      const sede = perfil?.sede || "MALAMBO";

      let filas, plantaLabel;
      if(planta==="P1"){
        filas = filasP1.filter(f=>f.activo);
        plantaLabel = "PLANTA 1";
      } else {
        filas = filasP2.filter(f=>f.activo);
        plantaLabel = "PLANTA 2";
      }

      const tanquesReg = filas.map(f => {
        let glsCalc = null;
        if(planta==="P1"){
          const res = calcFila(f);
          glsCalc = res ? res.glsN : null;
        } else {
          const v = pfn(f.galones);
          glsCalc = isNaN(v) ? null : Math.round(v);
        }
        const sys = nivelSistema(f.id);
        const diff = (glsCalc!==null && sys!==null) ? glsCalc - sys : null;
        const pct  = (diff!==null && sys>0) ? (diff/sys)*100 : null;
        return {
          tanque: f.id,
          sonda: f.sonda||"",
          temperatura: f.temp||"",
          api: f.api||"",
          galones_calculados: glsCalc,
          galones_sistema: sys,
          diferencia: diff,
          pct_diferencia: pct !== null ? +pct.toFixed(2) : null,
        };
      });

      // Número secuencial
      const { data: prevs } = await dbCall({ table:"inventarios_diarios", op:"select", select:"id", filters:[], single:false });
      const prefix = `INV-${planta==="P1"?"P1":"P2"}`;
      const existentes = (prevs||[]).filter(r=>(r.id||"").startsWith(prefix));
      const numero = `${prefix}-${String(existentes.length+1).padStart(4,"0")}`;

      await dbCall({ table:"inventarios_diarios", op:"insert", data:{
        id: numero,
        numero,
        fecha: fechaReg,
        planta: plantaLabel,
        sede,
        turno,
        operador: operador||perfil?.nombre||"",
        tanques: tanquesReg,
        observaciones: obs,
        calados_proa: planta==="P1" ? (calados.proaIni||null) : null,
        calados_popa: planta==="P1" ? (calados.popaIni||null) : null,
        creado_por: session?.user?.id,
      }});

      showToast(`Inventario ${numero} guardado`, true);
      // Reset
      if(planta==="P1") setFilasP1(initFilasP1());
      else setFilasP2(initFilasP2());
      setObs("");
      setActiveTab("historial");
    } catch(e){
      showToast("Error al guardar inventario: " + e.message, false);
    } finally {
      setSaving(false);
    }
  }

  // ── Render tabla P1 ─────────────────────────────────────────────────────────
  function renderTablaP1(){
    return (
      <div style={{overflowX:"auto"}}>
        {/* Calados */}
        <div style={{display:"flex",gap:16,marginBottom:16,flexWrap:"wrap"}}>
          <div style={{minWidth:160}}>
            <div style={{fontSize:10,color:TH.navy,fontWeight:700,textTransform:"uppercase",letterSpacing:1,marginBottom:4}}>Calado Proa (m)</div>
            <NumInput value={calados.proaIni} onChange={e=>setCalados(p=>({...p,proaIni:e.target.value}))} placeholder="0.00"/>
          </div>
          <div style={{minWidth:160}}>
            <div style={{fontSize:10,color:TH.navy,fontWeight:700,textTransform:"uppercase",letterSpacing:1,marginBottom:4}}>Calado Popa (m)</div>
            <NumInput value={calados.popaIni} onChange={e=>setCalados(p=>({...p,popaIni:e.target.value}))} placeholder="0.00"/>
          </div>
          <div style={{minWidth:160,display:"flex",alignItems:"flex-end"}}>
            <div style={{padding:"5px 12px",background:`${TH.navy}15`,borderRadius:6,fontSize:12,fontWeight:700,color:TH.navy}}>
              Trim: {trim.val.toFixed(2)} m {trim.dir}
            </div>
          </div>
        </div>

        <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
          <thead>
            <tr style={{background:TH.navy,color:"#fff"}}>
              <th style={{padding:"8px 10px",textAlign:"left",fontWeight:700}}>Tanque</th>
              <th style={{padding:"8px 10px",textAlign:"right",fontWeight:700}}>Sonda (mm)</th>
              <th style={{padding:"8px 10px",textAlign:"right",fontWeight:700}}>Temp °C</th>
              <th style={{padding:"8px 10px",textAlign:"right",fontWeight:700}}>API</th>
              <th style={{padding:"8px 10px",textAlign:"right",fontWeight:700}}>Gls Calculados</th>
              <th style={{padding:"8px 10px",textAlign:"right",fontWeight:700}}>Gls Sistema</th>
              <th style={{padding:"8px 10px",textAlign:"right",fontWeight:700}}>Diferencia</th>
              <th style={{padding:"8px 10px",textAlign:"center",fontWeight:700}}>Estado</th>
            </tr>
          </thead>
          <tbody>
            {filasP1.map((f, i) => {
              const res = calcFila(f);
              const glsCalc = res ? res.glsN : null;
              const sys = nivelSistema(f.id);
              const diff = diferencia(glsCalc, f.id);
              const pct = (diff!==null && sys>0) ? (diff/sys)*100 : null;
              const isOver = diff !== null && diff > 0;
              const isMissing = diff !== null && diff < 0;
              const isOk = diff !== null && Math.abs(pct||0) <= TOLERANCIA_PCT;
              const rowBg = i%2===0 ? TH.card : "#f8fafc";
              return (
                <tr key={f.id} style={{background:rowBg}}>
                  <td style={{padding:"6px 10px",fontWeight:700,color:TH.navy,borderBottom:`1px solid ${TH.border}`}}>
                    {f.label}
                    {f.tipo==="tkt" && <span style={{fontSize:9,color:TH.muted,marginLeft:6}}>TIERRA</span>}
                  </td>
                  <td style={{padding:"4px 6px",borderBottom:`1px solid ${TH.border}`,width:90}}>
                    <NumInput value={f.sonda} onChange={e=>{const v=e.target.value;setFilasP1(p=>p.map((r,j)=>j===i?{...r,sonda:v}:r));}}/>
                  </td>
                  <td style={{padding:"4px 6px",borderBottom:`1px solid ${TH.border}`,width:80}}>
                    <NumInput value={f.temp} onChange={e=>{const v=e.target.value;setFilasP1(p=>p.map((r,j)=>j===i?{...r,temp:v}:r));}}/>
                  </td>
                  <td style={{padding:"4px 6px",borderBottom:`1px solid ${TH.border}`,width:70}}>
                    <NumInput value={f.api} onChange={e=>{const v=e.target.value;setFilasP1(p=>p.map((r,j)=>j===i?{...r,api:v}:r));}}/>
                  </td>
                  <td style={{padding:"6px 10px",textAlign:"right",fontFamily:"monospace",fontWeight:700,borderBottom:`1px solid ${TH.border}`,color:glsCalc!==null?TH.navy:TH.muted}}>
                    {glsCalc !== null ? fmtN(glsCalc,0) : "—"}
                  </td>
                  <td style={{padding:"6px 10px",textAlign:"right",fontFamily:"monospace",borderBottom:`1px solid ${TH.border}`,color:TH.muted}}>
                    {sys !== null ? fmtN(sys,0) : "—"}
                  </td>
                  <td style={{padding:"6px 10px",textAlign:"right",fontFamily:"monospace",fontWeight:700,borderBottom:`1px solid ${TH.border}`,
                    color: diff===null?TH.muted : isOk?TH.success : isMissing?TH.danger:TH.warn}}>
                    {diff !== null ? (diff>0?"+":"")+fmtN(diff,0) : "—"}
                    {pct !== null && <span style={{fontSize:10,marginLeft:4}}>({(pct>0?"+":"")+pct.toFixed(1)}%)</span>}
                  </td>
                  <td style={{padding:"6px 10px",textAlign:"center",borderBottom:`1px solid ${TH.border}`}}>
                    {diff === null ? <span style={{color:TH.muted,fontSize:10}}>—</span>
                     : isOk ? <span style={{color:TH.success,fontWeight:700,fontSize:11}}>✓ OK</span>
                     : isMissing ? <span style={{color:TH.danger,fontWeight:700,fontSize:11}}>⚠ FALTANTE</span>
                     : <span style={{color:TH.warn,fontWeight:700,fontSize:11}}>↑ SOBRANTE</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  // ── Render tabla P2 ─────────────────────────────────────────────────────────
  function renderTablaP2(){
    return (
      <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
        <thead>
          <tr style={{background:TH.navy,color:"#fff"}}>
            <th style={{padding:"8px 10px",textAlign:"left",fontWeight:700}}>Tanque</th>
            <th style={{padding:"8px 10px",textAlign:"right",fontWeight:700}}>Galones Medidos</th>
            <th style={{padding:"8px 10px",textAlign:"right",fontWeight:700}}>Temp °C</th>
            <th style={{padding:"8px 10px",textAlign:"right",fontWeight:700}}>API</th>
            <th style={{padding:"8px 10px",textAlign:"right",fontWeight:700}}>Gls Sistema</th>
            <th style={{padding:"8px 10px",textAlign:"right",fontWeight:700}}>Diferencia</th>
            <th style={{padding:"8px 10px",textAlign:"center",fontWeight:700}}>Estado</th>
          </tr>
        </thead>
        <tbody>
          {filasP2.map((f, i) => {
            const glsCalc = (() => { const v=pfn(f.galones); return isNaN(v)?null:Math.round(v); })();
            const sys = nivelSistema(f.id);
            const diff = (glsCalc!==null && sys!==null) ? glsCalc - sys : null;
            const pct = (diff!==null && sys>0) ? (diff/sys)*100 : null;
            const isOk = diff !== null && Math.abs(pct||0) <= TOLERANCIA_PCT;
            const isMissing = diff !== null && diff < 0;
            const rowBg = i%2===0 ? TH.card : "#f8fafc";
            return (
              <tr key={f.id} style={{background:rowBg}}>
                <td style={{padding:"6px 10px",fontWeight:700,color:TH.navy,borderBottom:`1px solid ${TH.border}`}}>{f.label}</td>
                <td style={{padding:"4px 6px",borderBottom:`1px solid ${TH.border}`,width:130}}>
                  <NumInput value={f.galones} onChange={e=>{const v=e.target.value;setFilasP2(p=>p.map((r,j)=>j===i?{...r,galones:v}:r));}}/>
                </td>
                <td style={{padding:"4px 6px",borderBottom:`1px solid ${TH.border}`,width:80}}>
                  <NumInput value={f.temp} onChange={e=>{const v=e.target.value;setFilasP2(p=>p.map((r,j)=>j===i?{...r,temp:v}:r));}}/>
                </td>
                <td style={{padding:"4px 6px",borderBottom:`1px solid ${TH.border}`,width:70}}>
                  <NumInput value={f.api} onChange={e=>{const v=e.target.value;setFilasP2(p=>p.map((r,j)=>j===i?{...r,api:v}:r));}}/>
                </td>
                <td style={{padding:"6px 10px",textAlign:"right",fontFamily:"monospace",borderBottom:`1px solid ${TH.border}`,color:TH.muted}}>
                  {sys !== null ? fmtN(sys,0) : "—"}
                </td>
                <td style={{padding:"6px 10px",textAlign:"right",fontFamily:"monospace",fontWeight:700,borderBottom:`1px solid ${TH.border}`,
                  color: diff===null?TH.muted : isOk?TH.success : isMissing?TH.danger:TH.warn}}>
                  {diff !== null ? (diff>0?"+":"")+fmtN(diff,0) : "—"}
                  {pct !== null && <span style={{fontSize:10,marginLeft:4}}>({(pct>0?"+":"")+pct.toFixed(1)}%)</span>}
                </td>
                <td style={{padding:"6px 10px",textAlign:"center",borderBottom:`1px solid ${TH.border}`}}>
                  {diff === null ? <span style={{color:TH.muted,fontSize:10}}>—</span>
                   : isOk ? <span style={{color:TH.success,fontWeight:700,fontSize:11}}>✓ OK</span>
                   : isMissing ? <span style={{color:TH.danger,fontWeight:700,fontSize:11}}>⚠ FALTANTE</span>
                   : <span style={{color:TH.warn,fontWeight:700,fontSize:11}}>↑ SOBRANTE</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    );
  }

  // ── Resumen de novedades ─────────────────────────────────────────────────────
  function renderResumen(){
    const filas = planta==="P1" ? filasP1 : filasP2;
    const rows = filas.map(f => {
      let glsCalc = null;
      if(planta==="P1"){
        const res = calcFila(f);
        glsCalc = res ? res.glsN : null;
      } else {
        const v = pfn(f.galones);
        glsCalc = isNaN(v) ? null : Math.round(v);
      }
      const sys = nivelSistema(f.id);
      const diff = (glsCalc!==null&&sys!==null) ? glsCalc-sys : null;
      const pct = (diff!==null&&sys>0) ? (diff/sys)*100 : null;
      return { id:f.id, diff, pct };
    }).filter(r => r.diff !== null && Math.abs(r.pct||0) > TOLERANCIA_PCT);

    if(rows.length === 0) return (
      <div style={{padding:"10px 16px",background:`${TH.success}18`,borderRadius:8,border:`1px solid ${TH.success}`,color:TH.success,fontWeight:700,fontSize:13,marginBottom:16}}>
        ✓ Todos los tanques dentro del margen de tolerancia (±{TOLERANCIA_PCT}%)
      </div>
    );

    return (
      <div style={{marginBottom:16}}>
        <div style={{fontWeight:800,fontSize:12,color:TH.danger,marginBottom:8,textTransform:"uppercase",letterSpacing:1}}>
          ⚠ Novedades detectadas
        </div>
        <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
          {rows.map(r => (
            <div key={r.id} style={{padding:"6px 14px",borderRadius:6,fontWeight:700,fontSize:12,
              background: r.diff<0 ? `${TH.danger}18` : `${TH.warn}18`,
              border:`1px solid ${r.diff<0?TH.danger:TH.warn}`,
              color: r.diff<0?TH.danger:TH.warn}}>
              {r.id}: {r.diff>0?"+":""}{fmtN(r.diff,0)} gls ({(r.pct>0?"+":"")+r.pct.toFixed(1)}%)
              {r.diff<0?" FALTANTE":" SOBRANTE"}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Historial ───────────────────────────────────────────────────────────────
  function renderHistorial(){
    if(loadingHist) return <div style={{color:TH.muted,padding:24}}>Cargando...</div>;
    if(historial.length===0) return <div style={{color:TH.muted,padding:24}}>Sin registros</div>;
    return (
      <div style={{overflowX:"auto"}}>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
          <thead>
            <tr style={{background:TH.navy,color:"#fff"}}>
              <th style={{padding:"8px 10px",textAlign:"left"}}>N°</th>
              <th style={{padding:"8px 10px",textAlign:"left"}}>Fecha</th>
              <th style={{padding:"8px 10px",textAlign:"left"}}>Planta</th>
              <th style={{padding:"8px 10px",textAlign:"left"}}>Turno</th>
              <th style={{padding:"8px 10px",textAlign:"left"}}>Operador</th>
              <th style={{padding:"8px 10px",textAlign:"center"}}>Tanques</th>
              <th style={{padding:"8px 10px",textAlign:"center"}}>Novedades</th>
            </tr>
          </thead>
          <tbody>
            {historial.map((inv, i) => {
              const novedades = (inv.tanques||[]).filter(t =>
                t.diferencia !== null && t.galones_sistema > 0 &&
                Math.abs((t.pct_diferencia||0)) > TOLERANCIA_PCT
              );
              return (
                <tr key={inv.id} style={{background:i%2===0?TH.card:"#f8fafc"}}>
                  <td style={{padding:"8px 10px",fontFamily:"monospace",fontWeight:700,color:TH.navy,borderBottom:`1px solid ${TH.border}`}}>{inv.numero||inv.id}</td>
                  <td style={{padding:"8px 10px",borderBottom:`1px solid ${TH.border}`}}>
                    {inv.fecha ? new Date(inv.fecha+"T12:00:00").toLocaleDateString("es-CO") : "—"}
                  </td>
                  <td style={{padding:"8px 10px",borderBottom:`1px solid ${TH.border}`}}>{inv.planta}</td>
                  <td style={{padding:"8px 10px",borderBottom:`1px solid ${TH.border}`}}>{inv.turno||"—"}</td>
                  <td style={{padding:"8px 10px",borderBottom:`1px solid ${TH.border}`}}>{inv.operador||"—"}</td>
                  <td style={{padding:"8px 10px",textAlign:"center",borderBottom:`1px solid ${TH.border}`,color:TH.muted}}>{(inv.tanques||[]).length}</td>
                  <td style={{padding:"8px 10px",textAlign:"center",borderBottom:`1px solid ${TH.border}`}}>
                    {novedades.length===0
                      ? <span style={{color:TH.success,fontWeight:700}}>✓ OK</span>
                      : <span style={{color:TH.danger,fontWeight:700}}>⚠ {novedades.length}</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  // ── Main render ─────────────────────────────────────────────────────────────
  return (
    <div style={{padding:"20px 24px",maxWidth:1200,margin:"0 auto"}}>
      {/* Header */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20,flexWrap:"wrap",gap:12}}>
        <div>
          <div style={{fontSize:20,fontWeight:900,color:TH.navy}}>📋 Inventario Diario de Tanques</div>
          <div style={{fontSize:12,color:TH.muted,marginTop:2}}>Registro de medidas físicas al inicio de turno</div>
        </div>
        <div style={{display:"flex",gap:8}}>
          {["nuevo","historial"].map(t => (
            <button key={t} onClick={()=>setActiveTab(t)} style={{
              padding:"7px 18px",borderRadius:6,fontWeight:700,fontSize:12,cursor:"pointer",
              background: activeTab===t ? TH.orange : "transparent",
              color: activeTab===t ? "#fff" : TH.muted,
              border: `2px solid ${activeTab===t ? TH.orange : TH.border}`,
            }}>{t==="nuevo" ? "Nuevo Inventario" : "Historial"}</button>
          ))}
        </div>
      </div>

      {activeTab === "historial" ? renderHistorial() : (
        <>
          {/* Selector planta */}
          <div style={{display:"flex",gap:0,marginBottom:20,borderRadius:8,overflow:"hidden",border:`1px solid ${TH.border}`,width:"fit-content"}}>
            {[{k:"P1",l:"Planta 1 — Barcaza QBS002"},{k:"P2",l:"Planta 2 — TK-111 a TK-117"}].map(({k,l}) => (
              <button key={k} onClick={()=>setPlanta(k)} style={{
                padding:"10px 24px",fontWeight:700,fontSize:13,cursor:"pointer",
                background: planta===k ? TH.navy : TH.card,
                color: planta===k ? "#fff" : TH.muted,
                border:"none",transition:"background 0.15s",
              }}>{l}</button>
            ))}
          </div>

          {/* Campos comunes */}
          <div style={{display:"flex",gap:16,marginBottom:16,flexWrap:"wrap"}}>
            <div style={{minWidth:160}}>
              <div style={{fontSize:10,color:TH.navy,fontWeight:700,textTransform:"uppercase",letterSpacing:1,marginBottom:4}}>Fecha</div>
              <input type="date" value={fechaReg} onChange={e=>setFechaReg(e.target.value)}
                style={{padding:"6px 10px",border:`1px solid ${TH.border}`,borderRadius:6,fontSize:13,color:TH.text,background:TH.card}}/>
            </div>
            <div style={{minWidth:130}}>
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

          {/* Card con la tabla */}
          <div style={{background:TH.card,borderRadius:10,border:`1px solid ${TH.border}`,padding:20,marginBottom:16,boxShadow:"0 2px 8px rgba(0,0,0,0.06)"}}>
            {planta==="P1" ? renderTablaP1() : renderTablaP2()}
          </div>

          {/* Resumen novedades */}
          {renderResumen()}

          {/* Observaciones */}
          <div style={{marginBottom:16}}>
            <div style={{fontSize:10,color:TH.navy,fontWeight:700,textTransform:"uppercase",letterSpacing:1,marginBottom:4}}>Observaciones</div>
            <textarea value={obs} onChange={e=>setObs(e.target.value)} rows={2}
              style={{width:"100%",boxSizing:"border-box",padding:"8px 10px",border:`1px solid ${TH.border}`,borderRadius:6,fontSize:13,color:TH.text,background:TH.card,resize:"vertical"}}/>
          </div>

          <Btn onClick={guardar} disabled={saving}>
            {saving ? "Guardando..." : "💾 Guardar Inventario"}
          </Btn>
        </>
      )}
    </div>
  );
}
