// LiquidadorPlanta2.jsx — tanques estacionarios TK-111 a TK-117, ullage en MM
import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const M3_TO_GAL = 264.172;
const TANQUES_P2 = ["TK-111","TK-112","TK-113","TK-114","TK-115","TK-116","TK-117"];
const PRODUCTOS = ["VLSFO","HSFO","MGO","DIESEL","IFO380","IFO180","PENDARE","CARRIZALES","FRONTERA","OMI","KIMBO"];

const TABLA13 = {1:4.0346,2:4.0043,3:3.9745,4:3.9451,5:3.9162,6:3.8877,7:3.8596,8:3.8319,9:3.8046,10:3.7777,11:3.7511,12:3.7249,13:3.6991,14:3.6737,15:3.6486,16:3.6238,17:3.5994,18:3.5753,19:3.5515,20:3.528,21:3.5048,22:3.482,23:3.4594,24:3.4371,25:3.4151,26:3.3934,27:3.372,28:3.3508,29:3.3299,30:3.3093,31:3.2888,32:3.2687,33:3.2489,34:3.2292,35:3.2097,36:3.1906,37:3.1716,38:3.1529,39:3.1343,40:3.116,41:3.0979,42:3.0801,43:3.0624,44:3.0449,45:3.0276,46:3.0105,47:2.9937,48:2.9769,49:2.9604,50:2.9441};

const TH = {
  bg:"#f0f4f8", card:"#ffffff", border:"#d1d9e0",
  text:"#121212", navy:"#003B73", orange:"#0077CC",
  success:"#00B894", danger:"#D63031", muted:"#6E7781",
};

function interp(x,x0,x1,y0,y1){if(x1===x0)return y0;return y0+(y1-y0)*(x-x0)/(x1-x0);}

function interpolarAforo(tabla,ullage){
  if(!tabla||tabla.length===0||ullage===null||ullage===undefined||isNaN(ullage))return null;
  const n=tabla.length;
  if(ullage<=tabla[0][0])return tabla[0][1];
  if(ullage>=tabla[n-1][0])return tabla[n-1][1];
  let lo=0,hi=n-1;
  while(hi-lo>1){const mid=Math.floor((lo+hi)/2);if(tabla[mid][0]<=ullage)lo=mid;else hi=mid;}
  return Math.max(0,interp(ullage,tabla[lo][0],tabla[hi][0],tabla[lo][1],tabla[hi][1]));
}

function calcVCF(api,tempC){
  if(!api||!tempC||isNaN(api)||isNaN(tempC))return null;
  // ASTM Tabla 6B: convertir API a densidad, usar K0/K1
  const rho15=(141.5/(131.5+api))*999.016;
  const alpha=(186.9696+0.486926*rho15)/(rho15*rho15);
  const d=tempC-15.5556; // referencia 60°F
  return Math.exp(-alpha*d*(1+0.8*alpha*d));
}

function calcF13(api){
  if(!api||api<=0||isNaN(api))return null;
  const lo=Math.floor(api),hi=Math.ceil(api);
  if(lo===hi)return TABLA13[lo]||null;
  if(!TABLA13[lo]||!TABLA13[hi])return TABLA13[lo]||TABLA13[hi]||null;
  return TABLA13[lo]+(api-lo)*(TABLA13[hi]-TABLA13[lo]);
}

function pf(v){return parseFloat(String(v).replace(",","."))||0;}
function pfn(v){const r=parseFloat(String(v).replace(",","."));return isNaN(r)?NaN:r;}
function fmtN(n,dec=2){
  if(n===null||n===undefined||isNaN(n))return "—";
  return Number(n).toLocaleString("es-CO",{minimumFractionDigits:dec,maximumFractionDigits:dec});
}

function Lbl({children}){
  return <div style={{fontSize:10,color:TH.navy,textTransform:"uppercase",letterSpacing:1.2,marginBottom:4,fontWeight:700}}>{children}</div>;
}
function Field({label,children}){
  return <div style={{marginBottom:12}}><Lbl>{label}</Lbl>{children}</div>;
}
function AppInp({label,...p}){
  return (
    <Field label={label}>
      <input {...p} style={{width:"100%",background:p.readOnly?"#e8edf2":TH.card,border:"1px solid "+(p.readOnly?"#c5cfd8":TH.border),borderRadius:6,padding:"9px 12px",color:p.readOnly?"#4a5568":TH.text,fontSize:13,fontFamily:"system-ui,sans-serif",outline:"none",boxSizing:"border-box",MozAppearance:"textfield",appearance:"textfield",...(p.style||{})}}/>
    </Field>
  );
}
function AppBtn({children,color,sm,disabled,onClick}){
  const bg=color||TH.orange;
  return <button onClick={onClick} disabled={disabled} style={{background:bg,color:"#fff",border:"2px solid "+bg,borderRadius:6,padding:sm?"5px 14px":"9px 20px",fontWeight:700,fontSize:sm?11:13,cursor:disabled?"not-allowed":"pointer",opacity:disabled?0.5:1,whiteSpace:"nowrap",fontFamily:"system-ui,sans-serif"}}>{children}</button>;
}

function TInp({value,onChange,disabled,navRow,navCol}){
  const handleKey=(e)=>{
    const nav=["ArrowUp","ArrowDown","ArrowLeft","ArrowRight","Enter","Tab","Backspace","Delete"];
    const isNum=/^[0-9.,-]$/.test(e.key);
    if(!isNum&&!nav.includes(e.key)&&!e.ctrlKey&&!e.metaKey){e.preventDefault();return;}
    if(["ArrowUp","ArrowDown","ArrowLeft","ArrowRight","Enter"].includes(e.key)&&navRow!==undefined){
      e.preventDefault();
      const all=[...document.querySelectorAll("[data-p2r][data-p2c]")].filter(el=>!el.disabled);
      let r=navRow,c=navCol;
      if(e.key==="ArrowDown"||e.key==="Enter")r++;
      else if(e.key==="ArrowUp")r--;
      else if(e.key==="ArrowRight")c++;
      else if(e.key==="ArrowLeft")c--;
      const t=all.find(el=>+el.dataset.p2r===r&&+el.dataset.p2c===c);
      if(t)t.focus();
    }
  };
  return (
    <input type="text" inputMode="decimal" value={value} onChange={onChange} disabled={disabled}
      onKeyDown={handleKey} data-p2r={navRow} data-p2c={navCol}
      style={{width:"100%",background:disabled?"#f5f7fa":TH.card,border:"1px solid "+TH.border,borderRadius:4,padding:"5px 8px",color:TH.text,fontSize:12,outline:"none",boxSizing:"border-box",textAlign:"right"}}/>
  );
}

export default function LiquidadorPlanta2({supabase,session,perfil,showToast,afoCache={},afoCacheLoading=false,tanques=[]}){
  const [tab,setTab]=useState("nuevo");
  const [historial,setHistorial]=useState([]);
  const [loadingHist,setLoadingHist]=useState(false);
  const [motonave,setMotonave]=useState("");
  const [fecha,setFecha]=useState(new Date().toISOString().split("T")[0]);
  const [operador,setOperador]=useState("");
  const [obs,setObs]=useState("");
  const [saving,setSaving]=useState(false);

  // Cache local de lookups ya consultados: { "TK-111:1250": [galB_lo, galB_hi, mm_lo, mm_hi] }
  const lookupCache = useState({})[0];

  const initFilas=()=>TANQUES_P2.map(t=>{const tqConf=tanques.find(x=>x.id===t);return{tanque:t,producto:tqConf?.producto?tqConf.producto.toUpperCase():"VLSFO",activo:true,sIni:"",sFin:"",tIni:"",tFin:"",aIni:"",aFin:""};});
  const [filas,setFilas]=useState(initFilas);
  // Resultados interpolados por tanque+campo: { "TK-111:sIni": galB }
  const [interpResults,setInterpResults]=useState({});
  const debounceRef = useState({})[0];

  useEffect(()=>{
    if(perfil?.nombre&&!operador)setOperador(perfil.nombre);
  },[perfil]);

  // Consulta bajo demanda: 2 filas vecinas para interpolar
  async function lookupAforo(tanque, ullage_mm){
    const key=`${tanque}:${ullage_mm}`;
    if(lookupCache[key]!==undefined) return lookupCache[key];
    // Usar afoCache si está disponible
    if(Object.keys(afoCache).length>0){
      const tabla=afoCache[tanque];
      if(tabla) return lookupCache[key]=interpolarAforo(tabla,ullage_mm);
    }
    // Consulta Supabase: fila inferior y superior
    const [r1,r2]=await Promise.all([
      supabase.from("aforo").select("ullage_mm,galones_brutos").eq("tanque",tanque).lte("ullage_mm",ullage_mm).order("ullage_mm",{ascending:false}).limit(1),
      supabase.from("aforo").select("ullage_mm,galones_brutos").eq("tanque",tanque).gte("ullage_mm",ullage_mm).order("ullage_mm",{ascending:true}).limit(1),
    ]);
    const lo=r1.data?.[0], hi=r2.data?.[0];
    let val=null;
    if(lo&&hi) val=interp(ullage_mm,lo.ullage_mm,hi.ullage_mm,lo.galones_brutos,hi.galones_brutos);
    else if(lo) val=lo.galones_brutos;
    else if(hi) val=hi.galones_brutos;
    lookupCache[key]=val;
    return val;
  }

  // Cuando cambia ullage en una fila, lanzar lookup con debounce
  function triggerLookup(tanque, campo, ullage_mm){
    const u=pfn(ullage_mm);
    if(isNaN(u)||u<=0){
      setInterpResults(p=>({...p,[`${tanque}:${campo}`]:null}));
      return;
    }
    const dkey=`${tanque}:${campo}`;
    if(debounceRef[dkey]) clearTimeout(debounceRef[dkey]);
    debounceRef[dkey]=setTimeout(async()=>{
      const glsB=await lookupAforo(tanque,u);
      setInterpResults(p=>({...p,[dkey]:glsB}));
    },400);
  }

  function getGlsB(tanque, campo){ return interpResults[`${tanque}:${campo}`]??null; }

  function calcFila(f,ullage,temp,api,campo){
    const glsB=getGlsB(f.tanque,campo);
    if(glsB===null||isNaN(pfn(ullage))||pfn(ullage)<=0) return null;
    const t=pfn(temp),a=pfn(api);
    const vcf=(!isNaN(t)&&!isNaN(a))?calcVCF(a,t):null;
    const glsN=vcf?glsB*vcf:null;
    const f13=(!isNaN(a)&&a>0)?calcF13(a):null;
    const mt=(glsN&&f13)?(glsN/1000)*f13:null;
    return {glsB,glsN,vcf,f13,mt};
  }

  const tots=()=>{
    let gBI=0,gBF=0,gNI=0,gNF=0,mI=0,mF=0,hasNI=false,hasNF=false,hasMI=false,hasMF=false;
    for(const f of filas){
      if(!f.activo)continue;
      const ri=calcFila(f,f.sIni,f.tIni,f.aIni,"sIni");
      const rf=calcFila(f,f.sFin,f.tFin,f.aFin,"sFin");
      if(ri){gBI+=ri.glsB;if(ri.glsN){gNI+=ri.glsN;hasNI=true;}if(ri.mt){mI+=ri.mt;hasMI=true;}}
      if(rf){gBF+=rf.glsB;if(rf.glsN){gNF+=rf.glsN;hasNF=true;}if(rf.mt){mF+=rf.mt;hasMF=true;}}
    }
    const gEnt=hasNI&&hasNF?gNI-gNF:null;
    const mEnt=hasMI&&hasMF?mI-mF:null;
    return {gBI,gBF,gNI:hasNI?gNI:null,gNF:hasNF?gNF:null,gEnt,mEnt,hasMI,hasMF,mI:hasMI?mI:null,mF:hasMF?mF:null};
  };

  async function cargarHistorial(){
    setLoadingHist(true);
    const {data}=await supabase.from("liquidaciones_planta2").select("*").order("created_at",{ascending:false}).limit(50);
    setHistorial(data||[]);setLoadingHist(false);
  }

  async function guardar(){
    if(!motonave.trim())return showToast("Ingresa el nombre de la motonave",false);
    setSaving(true);
    const t=tots();
    const {error}=await supabase.from("liquidaciones_planta2").insert({
      motonave:motonave.trim(),fecha,operador,observaciones:obs,
      filas:JSON.stringify(filas),
      gls_netos_ini:t.gNI?Math.round(t.gNI):null,
      gls_netos_fin:t.gNF?Math.round(t.gNF):null,
      gls_entregados:t.gEnt?Math.round(t.gEnt):null,
      mt_entregadas:t.mEnt?Number(t.mEnt.toFixed(3)):null,
      usuario_id:session?.user?.id,
    });
    setSaving(false);
    if(error){showToast("Error: "+error.message,false);return;}
    showToast("Liquidacion guardada",true);
    setTab("historial");
    cargarHistorial();
  }

  function nuevaLiquidacion(){
    setFilas(initFilas());
    setMotonave("");setFecha(new Date().toISOString().split("T")[0]);
    setOperador(perfil?.nombre||"");setObs("");
    setTab("nuevo");
  }

  const setF=(idx,k,v)=>{const n=[...filas];n[idx]={...n[idx],[k]:v};setFilas(n);};

  const thStyle={padding:"8px 10px",color:TH.navy,fontWeight:800,fontSize:10,textAlign:"center",whiteSpace:"nowrap",borderBottom:"2px solid "+TH.border,textTransform:"uppercase",letterSpacing:0.5};
  const tdC={padding:"5px 6px",textAlign:"center"};
  const tdR={padding:"5px 8px",textAlign:"right",fontSize:12};

  const filaP2=(f,idx)=>{
    const ri=calcFila(f,f.sIni,f.tIni,f.aIni,"sIni");
    const rf=calcFila(f,f.sFin,f.tFin,f.aFin,"sFin");
    const ent=(ri?.glsN!=null&&rf?.glsN!=null)?ri.glsN-rf.glsN:null;
    const bg=!f.activo?"#f8f9fa":idx%2===0?"#ffffff":"#eef4fb";
    return(
      <tr key={f.tanque} style={{background:bg,opacity:f.activo?1:0.5,borderBottom:"1px solid "+TH.border}}>
        <td style={tdC}><input type="checkbox" checked={f.activo} onChange={e=>setF(idx,"activo",e.target.checked)}/></td>
        <td style={{...tdC,fontWeight:800,color:TH.navy,fontSize:13}}>{f.tanque}</td>
        <td style={{padding:"4px 6px"}}>
          <select value={f.producto} onChange={e=>setF(idx,"producto",e.target.value)} disabled={!f.activo}
            style={{background:TH.card,border:"1px solid "+TH.border,borderRadius:4,color:TH.text,fontSize:11,padding:"4px 6px",width:"100%"}}>
            {PRODUCTOS.map(p=><option key={p}>{p}</option>)}
          </select>
        </td>
        <td style={{padding:"4px 6px",minWidth:90}}><TInp value={f.sIni} disabled={!f.activo} onChange={e=>{setF(idx,"sIni",e.target.value);triggerLookup(f.tanque,"sIni",e.target.value);}} navRow={idx} navCol={0}/></td>
        <td style={{padding:"4px 6px",minWidth:70}}><TInp value={f.tIni} disabled={!f.activo} onChange={e=>setF(idx,"tIni",e.target.value)} navRow={idx} navCol={1}/></td>
        <td style={{padding:"4px 6px",minWidth:70}}><TInp value={f.aIni} disabled={!f.activo} onChange={e=>setF(idx,"aIni",e.target.value)} navRow={idx} navCol={2}/></td>
        <td style={{...tdR,color:"#2563eb",fontWeight:600}}>{ri?fmtN(ri.glsB,0):"—"}</td>
        <td style={{...tdR,color:TH.success,fontWeight:700}}>{ri?.glsN!=null?fmtN(ri.glsN,0):"—"}</td>
        <td style={{...tdR,color:TH.muted,fontWeight:600}}>{ri?.mt!=null?fmtN(ri.mt,3):"—"}</td>
        <td style={{padding:"4px 6px",minWidth:90}}><TInp value={f.sFin} disabled={!f.activo} onChange={e=>{setF(idx,"sFin",e.target.value);triggerLookup(f.tanque,"sFin",e.target.value);}} navRow={idx} navCol={3}/></td>
        <td style={{padding:"4px 6px",minWidth:70}}><TInp value={f.tFin} disabled={!f.activo} onChange={e=>setF(idx,"tFin",e.target.value)} navRow={idx} navCol={4}/></td>
        <td style={{padding:"4px 6px",minWidth:70}}><TInp value={f.aFin} disabled={!f.activo} onChange={e=>setF(idx,"aFin",e.target.value)} navRow={idx} navCol={5}/></td>
        <td style={{...tdR,color:"#2563eb",fontWeight:600}}>{rf?fmtN(rf.glsB,0):"—"}</td>
        <td style={{...tdR,color:TH.success,fontWeight:700}}>{rf?.glsN!=null?fmtN(rf.glsN,0):"—"}</td>
        <td style={{...tdR,color:TH.muted,fontWeight:600}}>{rf?.mt!=null?fmtN(rf.mt,3):"—"}</td>
        <td style={{...tdR,fontWeight:800,fontSize:13,color:ent!=null?(ent>=0?TH.navy:TH.danger):TH.muted}}>{ent!=null?fmtN(ent,0):"—"}</td>
      </tr>
    );
  };

  const t=tots();

  return(
    <div style={{fontFamily:"system-ui,sans-serif",color:TH.text,padding:"10px 16px",maxWidth:1500,margin:"0 auto"}}>
      <style>{"input[type=number]::-webkit-inner-spin-button,input[type=number]::-webkit-outer-spin-button{-webkit-appearance:none;margin:0}"}</style>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
        <div>
          <div style={{fontWeight:800,fontSize:16,color:TH.navy}}>Liquidador — Planta 2</div>
          <div style={{fontSize:10,color:TH.muted}}>Tanques TK-111 a TK-117 · Ullage MM</div>
        </div>
        <AppBtn color={TH.muted} sm onClick={()=>{setFilas(initFilas());setInterpResults({});}}>Limpiar</AppBtn>
      </div>

      <div style={{background:TH.card,border:"1px solid "+TH.border,borderRadius:6,padding:"8px 12px",marginBottom:8}}>
        <div style={{fontSize:10,fontWeight:800,color:TH.navy,textTransform:"uppercase",letterSpacing:1,marginBottom:6}}>🏗️ Tanques Planta 2 — TK-111 a TK-117 — Ullage MM</div>
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
            <thead>
              <tr style={{background:"#f0f4f8"}}>
                {["✓","Tanque","Producto","Ullage Ini (mm)","Temp Ini","API Ini","Gls.B Ini","Gls.N Ini","MT Ini","Ullage Fin (mm)","Temp Fin","API Fin","Gls.B Fin","Gls.N Fin","MT Fin","Gls.N Entregados"].map(h=>(
                  <th key={h} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>{filas.map((f,idx)=>filaP2(f,idx))}</tbody>
            <tfoot>
              <tr style={{background:TH.navy,color:"#fff"}}>
                <td colSpan={6} style={{padding:"8px 10px",fontWeight:800,fontSize:12}}>TOTAL PLANTA 2</td>
                <td style={{padding:"8px 10px",textAlign:"right",fontWeight:700,fontFamily:"monospace",color:"#bae6fd"}}>{fmtN(t.gBI,0)}</td>
                <td style={{padding:"8px 10px",textAlign:"right",fontWeight:700,fontFamily:"monospace",color:"#7dd3fc"}}>{t.gNI!=null?fmtN(t.gNI,0):"—"}</td>
                <td style={{padding:"8px 10px",textAlign:"right",fontWeight:700,fontFamily:"monospace",color:"#93c5fd"}}>{t.hasMI?fmtN(t.mI,3):"—"}</td>
                <td colSpan={3}/>
                <td style={{padding:"8px 10px",textAlign:"right",fontWeight:700,fontFamily:"monospace",color:"#bae6fd"}}>{fmtN(t.gBF,0)}</td>
                <td style={{padding:"8px 10px",textAlign:"right",fontWeight:700,fontFamily:"monospace",color:"#7dd3fc"}}>{t.gNF!=null?fmtN(t.gNF,0):"—"}</td>
                <td style={{padding:"8px 10px",textAlign:"right",fontWeight:700,fontFamily:"monospace",color:"#93c5fd"}}>{t.hasMF?fmtN(t.mF,3):"—"}</td>
                <td style={{padding:"8px 10px",textAlign:"right",fontWeight:800,fontSize:14,fontFamily:"monospace",color:t.gEnt!=null?(t.gEnt>=0?"#6ee7b7":TH.danger):TH.muted}}>{t.gEnt!=null?fmtN(t.gEnt,0):"—"}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
