// LiquidadorPlanta2.jsx — tanques estacionarios TK-111 a TK-117, ullage en MM
import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const M3_TO_GAL = 264.172;
const TANQUES_P2 = ["TK-111","TK-112","TK-113","TK-114","TK-115","TK-116","TK-117"];
const PRODUCTOS = ["VLSFO","HSFO","MGO","DIESEL","IFO380","IFO180","PENDARE","CARRIZALES","FRONTERA","OMI","KIMBO"];

const TABLA13 = {1:4.0346,2:4.0043,3:3.9745,4:3.9451,5:3.9162,6:3.8877,7:3.8596,8:3.8319,9:3.8046,10:3.7777,11:3.7511,12:3.7249,13:3.6991,14:3.6737,15:3.6486,16:3.6238,17:3.5994,18:3.5753,19:3.5515,20:3.528,21:3.5048,22:3.482,23:3.4594,24:3.4371,25:3.4151,26:3.3934,27:3.372,28:3.3508,29:3.3299,30:3.3093,31:3.2888,32:3.2687,33:3.2489,34:3.2292,35:3.2097,36:3.1906,37:3.1716,38:3.1529,39:3.1343,40:3.116,41:3.0979,42:3.0801,43:3.0624,44:3.0449,45:3.0276,46:3.0105,47:2.9937,48:2.9769,49:2.9604,50:2.9441};

const TH = {
  bg:"#f0f2f5", card:"#ffffff", border:"#d1d9e0",
  text:"#1a2332", navy:"#1e3a5f", orange:"#e85d04",
  success:"#16a34a", danger:"#dc2626", muted:"#64748b",
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

export default function LiquidadorPlanta2({supabase,session,perfil,showToast}){
  const [tab,setTab]=useState("nuevo");
  const [historial,setHistorial]=useState([]);
  const [loadingHist,setLoadingHist]=useState(false);
  const [motonave,setMotonave]=useState("");
  const [fecha,setFecha]=useState(new Date().toISOString().split("T")[0]);
  const [operador,setOperador]=useState("");
  const [obs,setObs]=useState("");
  const [saving,setSaving]=useState(false);
  const [loadingTablas,setLoadingTablas]=useState(true);
  const [tablas,setTablas]=useState({});

  const initFilas=()=>TANQUES_P2.map(t=>({tanque:t,producto:"VLSFO",activo:true,sIni:"",sFin:"",tIni:"",tFin:"",aIni:"",aFin:""}));
  const [filas,setFilas]=useState(initFilas);

  // Cargar tablas de aforo desde Supabase
  useEffect(()=>{
    async function fetchTanque(tk){
      const PAGE=1000;
      let rows=[], from=0;
      while(true){
        const {data,error}=await supabase.from("aforo")
          .select("ullage_mm,galones_brutos")
          .eq("tanque",tk).order("ullage_mm")
          .range(from,from+PAGE-1);
        if(error||!data||data.length===0)break;
        rows=rows.concat(data);
        if(data.length<PAGE)break;
        from+=PAGE;
      }
      return {tk, rows};
    }
    async function cargarTablas(){
      setLoadingTablas(true);
      try{
        const results=await Promise.all(TANQUES_P2.map(tk=>fetchTanque(tk)));
        const tbl={};
        for(const {tk,rows} of results){
          tbl[tk]=rows.map(r=>[r.ullage_mm,r.galones_brutos]);
        }
        setTablas(tbl);
      }catch(e){console.error("Error cargando aforo:",e);}
      setLoadingTablas(false);
    }
    cargarTablas();
  },[supabase]);

  useEffect(()=>{
    if(perfil?.nombre&&!operador)setOperador(perfil.nombre);
  },[perfil]);

  function calcFila(f,ullage,temp,api){
    const u=pfn(ullage),t=pfn(temp),a=pfn(api);
    const tabla=tablas[f.tanque];
    if(!tabla||isNaN(u))return null;
    const glsB=interpolarAforo(tabla,u);
    if(glsB===null)return null;
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
      const ri=calcFila(f,f.sIni,f.tIni,f.aIni);
      const rf=calcFila(f,f.sFin,f.tFin,f.aFin);
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

  const FilaP2=({f,idx})=>{
    const ri=calcFila(f,f.sIni,f.tIni,f.aIni);
    const rf=calcFila(f,f.sFin,f.tFin,f.aFin);
    const entB=(ri&&rf)?ri.glsB-rf.glsB:null;
    const ent=(ri?.glsN!=null&&rf?.glsN!=null)?ri.glsN-rf.glsN:null;
    const bg=f.activo?"#ffffff":"#f8f9fa";
    return(
      <tr key={f.tanque} style={{background:bg,opacity:f.activo?1:0.55,borderBottom:"1px solid "+TH.border}}>
        <td style={tdC}><input type="checkbox" checked={f.activo} onChange={e=>setF(idx,"activo",e.target.checked)}/></td>
        <td style={{...tdC,fontWeight:800,color:TH.navy,fontSize:13}}>{f.tanque}</td>
        <td style={{padding:"4px 6px"}}>
          <select value={f.producto} onChange={e=>setF(idx,"producto",e.target.value)} disabled={!f.activo}
            style={{background:TH.card,border:"1px solid "+TH.border,borderRadius:4,color:TH.text,fontSize:11,padding:"4px 6px",width:"100%"}}>
            {PRODUCTOS.map(p=><option key={p}>{p}</option>)}
          </select>
        </td>
        {/* INI */}
        <td style={{padding:"4px 6px",minWidth:90}}><TInp value={f.sIni} disabled={!f.activo} onChange={e=>setF(idx,"sIni",e.target.value)} navRow={idx} navCol={0}/></td>
        <td style={{padding:"4px 6px",minWidth:70}}><TInp value={f.tIni} disabled={!f.activo} onChange={e=>setF(idx,"tIni",e.target.value)} navRow={idx} navCol={1}/></td>
        <td style={{padding:"4px 6px",minWidth:70}}><TInp value={f.aIni} disabled={!f.activo} onChange={e=>setF(idx,"aIni",e.target.value)} navRow={idx} navCol={2}/></td>
        <td style={tdR}>{ri?fmtN(ri.glsB,0):"—"}</td>
        <td style={tdR}>{ri?.vcf!=null?fmtN(ri.vcf,4):"—"}</td>
        <td style={tdR}>{ri?.glsN!=null?fmtN(ri.glsN,0):"—"}</td>
        <td style={tdR}>{ri?.mt!=null?fmtN(ri.mt,3):"—"}</td>
        {/* FIN */}
        <td style={{padding:"4px 6px",minWidth:90}}><TInp value={f.sFin} disabled={!f.activo} onChange={e=>setF(idx,"sFin",e.target.value)} navRow={idx} navCol={3}/></td>
        <td style={{padding:"4px 6px",minWidth:70}}><TInp value={f.tFin} disabled={!f.activo} onChange={e=>setF(idx,"tFin",e.target.value)} navRow={idx} navCol={4}/></td>
        <td style={{padding:"4px 6px",minWidth:70}}><TInp value={f.aFin} disabled={!f.activo} onChange={e=>setF(idx,"aFin",e.target.value)} navRow={idx} navCol={5}/></td>
        <td style={tdR}>{rf?fmtN(rf.glsB,0):"—"}</td>
        <td style={tdR}>{rf?.vcf!=null?fmtN(rf.vcf,4):"—"}</td>
        <td style={tdR}>{rf?.glsN!=null?fmtN(rf.glsN,0):"—"}</td>
        <td style={tdR}>{rf?.mt!=null?fmtN(rf.mt,3):"—"}</td>
        {/* ENTREGADO */}
        <td style={{...tdR,fontWeight:700,color:ent!=null?(ent>=0?TH.success:TH.danger):TH.muted}}>
          {ent!=null?fmtN(ent,0):"—"}
        </td>
      </tr>
    );
  };

  const t=tots();

  if(loadingTablas){
    return(
      <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:200,color:TH.muted,fontSize:14}}>
        Cargando tablas de aforo...
      </div>
    );
  }

  return(
    <div style={{fontFamily:"system-ui,sans-serif",background:TH.bg,minHeight:"100vh",padding:"24px 16px"}}>
      {/* Header */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20,flexWrap:"wrap",gap:8}}>
        <div>
          <div style={{fontSize:20,fontWeight:800,color:TH.navy}}>Liquidador Planta 2</div>
          <div style={{fontSize:12,color:TH.muted}}>Tanques TK-111 a TK-117 — Ullage en MM</div>
        </div>
        <div style={{display:"flex",gap:8}}>
          <AppBtn sm color={tab==="nuevo"?TH.navy:"#94a3b8"} onClick={()=>setTab("nuevo")}>Nueva Liquidación</AppBtn>
          <AppBtn sm color={tab==="historial"?TH.navy:"#94a3b8"} onClick={()=>{setTab("historial");cargarHistorial();}}>Historial</AppBtn>
        </div>
      </div>

      {tab==="historial" && (
        <div style={{background:TH.card,borderRadius:10,padding:20,border:"1px solid "+TH.border}}>
          <div style={{fontWeight:700,color:TH.navy,marginBottom:12,fontSize:14}}>Historial de Liquidaciones</div>
          {!loadingHist&&historial.length>0&&(
            <div style={{marginBottom:20}}>
              <div style={{fontSize:11,color:TH.muted,marginBottom:8,fontWeight:600,textTransform:"uppercase",letterSpacing:0.8}}>Galones Entregados por Operación</div>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={[...historial].reverse().map(l=>({name:(l.motonave||"").substring(0,10)+(l.fecha?(" "+l.fecha.slice(5)):""),gls:l.gls_entregados||0}))} margin={{top:4,right:8,left:0,bottom:36}}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0"/>
                  <XAxis dataKey="name" tick={{fontSize:9,fill:TH.muted}} tickLine={false} axisLine={false} interval={0} angle={-35} textAnchor="end"/>
                  <YAxis tick={{fontSize:9,fill:TH.muted}} tickLine={false} axisLine={false} tickFormatter={v=>v>=1000?(v/1000).toFixed(0)+"k":v} width={38}/>
                  <Tooltip formatter={(v)=>[Number(v).toLocaleString("es-CO"),"Gls Netos"]} labelStyle={{fontSize:11,fontWeight:700}} contentStyle={{fontSize:11,borderRadius:6,border:"1px solid #d1d9e0"}}/>
                  <Bar dataKey="gls" radius={[4,4,0,0]}>
                    {[...historial].reverse().map((_,i)=><Cell key={i} fill={i===historial.length-1?"#e85d04":"#16a34a"}/>)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
          {loadingHist?(
            <div style={{color:TH.muted,fontSize:13}}>Cargando...</div>
          ):historial.length===0?(
            <div style={{color:TH.muted,fontSize:13}}>No hay liquidaciones guardadas.</div>
          ):(
            <div style={{overflowX:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                <thead>
                  <tr style={{background:"#f8fafc"}}>
                    {["Fecha","Motonave","Operador","Gls Ini","Gls Fin","Gls Entregados","MT Entregadas","Obs"].map(h=>(
                      <th key={h} style={thStyle}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {historial.map(h=>(
                    <tr key={h.id} style={{borderBottom:"1px solid "+TH.border}}>
                      <td style={tdC}>{h.fecha}</td>
                      <td style={{...tdC,fontWeight:700}}>{h.motonave}</td>
                      <td style={tdC}>{h.operador||"—"}</td>
                      <td style={tdR}>{h.gls_netos_ini!=null?fmtN(h.gls_netos_ini,0):"—"}</td>
                      <td style={tdR}>{h.gls_netos_fin!=null?fmtN(h.gls_netos_fin,0):"—"}</td>
                      <td style={{...tdR,fontWeight:700,color:TH.success}}>{h.gls_entregados!=null?fmtN(h.gls_entregados,0):"—"}</td>
                      <td style={tdR}>{h.mt_entregadas!=null?fmtN(h.mt_entregadas,3):"—"}</td>
                      <td style={{...tdC,color:TH.muted,fontSize:11,maxWidth:160,overflow:"hidden",textOverflow:"ellipsis"}}>{h.observaciones||"—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div style={{marginTop:16}}>
            <AppBtn sm onClick={nuevaLiquidacion}>+ Nueva Liquidación</AppBtn>
          </div>
        </div>
      )}

      {tab==="nuevo" && (
        <>
          {/* Datos generales */}
          <div style={{background:TH.card,borderRadius:10,padding:20,border:"1px solid "+TH.border,marginBottom:16}}>
            <div style={{fontWeight:700,color:TH.navy,marginBottom:14,fontSize:14}}>Datos de la Operación</div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:12}}>
              <AppInp label="Motonave" value={motonave} onChange={e=>setMotonave(e.target.value)} placeholder="Nombre motonave"/>
              <AppInp label="Fecha" type="date" value={fecha} onChange={e=>setFecha(e.target.value)}/>
              <AppInp label="Operador" value={operador} onChange={e=>setOperador(e.target.value)} placeholder="Nombre operador"/>
              <AppInp label="Observaciones" value={obs} onChange={e=>setObs(e.target.value)} placeholder="Opcional"/>
            </div>
          </div>

          {/* Tabla de tanques */}
          <div style={{background:TH.card,borderRadius:10,border:"1px solid "+TH.border,marginBottom:16,overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",minWidth:1000}}>
              <thead>
                <tr style={{background:"#f0f4f8"}}>
                  <th style={thStyle} colSpan={3}></th>
                  <th style={{...thStyle,background:"#e8f0fe",color:"#1a56db"}} colSpan={7}>INICIO</th>
                  <th style={{...thStyle,background:"#fef3e2",color:"#c05621"}} colSpan={7}>FINAL</th>
                  <th style={{...thStyle,background:"#f0fdf4",color:TH.success}}>ENTREGADO</th>
                </tr>
                <tr style={{background:"#f8fafc"}}>
                  <th style={thStyle}></th>
                  <th style={thStyle}>Tanque</th>
                  <th style={thStyle}>Producto</th>
                  {/* INI cols */}
                  <th style={thStyle}>Ullage<br/><span style={{fontSize:9,fontWeight:400}}>mm</span></th>
                  <th style={thStyle}>Temp<br/><span style={{fontSize:9,fontWeight:400}}>°C</span></th>
                  <th style={thStyle}>API<br/><span style={{fontSize:9,fontWeight:400}}>°</span></th>
                  <th style={thStyle}>Gls Brutos</th>
                  <th style={thStyle}>VCF</th>
                  <th style={thStyle}>Gls Netos</th>
                  <th style={thStyle}>MT</th>
                  {/* FIN cols */}
                  <th style={thStyle}>Ullage<br/><span style={{fontSize:9,fontWeight:400}}>mm</span></th>
                  <th style={thStyle}>Temp<br/><span style={{fontSize:9,fontWeight:400}}>°C</span></th>
                  <th style={thStyle}>API<br/><span style={{fontSize:9,fontWeight:400}}>°</span></th>
                  <th style={thStyle}>Gls Brutos</th>
                  <th style={thStyle}>VCF</th>
                  <th style={thStyle}>Gls Netos</th>
                  <th style={thStyle}>MT</th>
                  <th style={thStyle}>Gls Netos</th>
                </tr>
              </thead>
              <tbody>
                {filas.map((f,idx)=>FilaP2({f,idx}))}
              </tbody>
              <tfoot>
                <tr style={{background:"#f0f4f8",fontWeight:800}}>
                  <td colSpan={3} style={{...tdC,fontSize:11,color:TH.navy,textAlign:"right",paddingRight:12}}>TOTALES</td>
                  <td colSpan={3}></td>
                  <td style={{...tdR,color:"#1a56db"}}>{fmtN(t.gBI,0)}</td>
                  <td></td>
                  <td style={{...tdR,color:"#1a56db"}}>{t.gNI!=null?fmtN(t.gNI,0):"—"}</td>
                  <td style={{...tdR,color:"#1a56db"}}>{t.hasMI?fmtN(t.mI,3):"—"}</td>
                  <td colSpan={3}></td>
                  <td style={{...tdR,color:TH.orange}}>{fmtN(t.gBF,0)}</td>
                  <td></td>
                  <td style={{...tdR,color:TH.orange}}>{t.gNF!=null?fmtN(t.gNF,0):"—"}</td>
                  <td style={{...tdR,color:TH.orange}}>{t.hasMF?fmtN(t.mF,3):"—"}</td>
                  <td style={{...tdR,color:TH.success,fontSize:14}}>{t.gEnt!=null?fmtN(t.gEnt,0):"—"}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Resumen */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:12,marginBottom:16}}>
            {[
              {label:"Gls Brutos Ini",val:fmtN(t.gBI,0),color:"#1a56db"},
              {label:"Gls Netos Ini",val:t.gNI!=null?fmtN(t.gNI,0):"—",color:"#1a56db"},
              {label:"MT Ini",val:t.hasMI?fmtN(t.mI,3):"—",color:"#1a56db"},
              {label:"Gls Brutos Fin",val:fmtN(t.gBF,0),color:TH.orange},
              {label:"Gls Netos Fin",val:t.gNF!=null?fmtN(t.gNF,0):"—",color:TH.orange},
              {label:"MT Fin",val:t.hasMF?fmtN(t.mF,3):"—",color:TH.orange},
              {label:"Gls Entregados",val:t.gEnt!=null?fmtN(t.gEnt,0):"—",color:TH.success,big:true},
              {label:"MT Entregadas",val:t.mEnt!=null?fmtN(t.mEnt,3):"—",color:TH.success,big:true},
            ].map(c=>(
              <div key={c.label} style={{background:TH.card,borderRadius:8,padding:"12px 16px",border:"1px solid "+TH.border,borderTop:"3px solid "+c.color}}>
                <div style={{fontSize:9,color:TH.muted,textTransform:"uppercase",letterSpacing:1,marginBottom:4}}>{c.label}</div>
                <div style={{fontSize:c.big?22:16,fontWeight:800,color:c.color}}>{c.val}</div>
              </div>
            ))}
          </div>

          {/* Guardar */}
          <div style={{display:"flex",gap:12,justifyContent:"flex-end"}}>
            <AppBtn onClick={guardar} disabled={saving} color={TH.success}>
              {saving?"Guardando...":"Guardar Liquidación"}
            </AppBtn>
          </div>
        </>
      )}
    </div>
  );
}
