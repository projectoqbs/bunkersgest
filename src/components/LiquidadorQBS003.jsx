import { useState } from 'react';
import { TABLAS_QBS003, CAP_QBS003_GAL } from '../data/tablas_qbs003';
import { TRIM_QBS003, TRIM_VALS_QBS003 } from '../data/trim_qbs003';

const M3_TO_GAL = 264.172;
const PRODUCTOS = ['MGO','VLSFO','LSMGO','IFO380','DIESEL'];

const TANKS = [
  { key:'T1BR', label:'T1BR', group:1, side:'BR' },
  { key:'T1ER', label:'T1ER', group:1, side:'ER' },
  { key:'T2BR', label:'T2BR', group:2, side:'BR' },
  { key:'T2ER', label:'T2ER', group:2, side:'ER' },
  { key:'T3BR', label:'T3BR', group:3, side:'BR' },
  { key:'T3ER', label:'T3ER', group:3, side:'ER' },
  { key:'T4BR', label:'T4BR', group:4, side:'BR' },
  { key:'T4ER', label:'T4ER', group:4, side:'ER' },
  { key:'T5BR', label:'T5BR', group:5, side:'BR' },
  { key:'T5ER', label:'T5ER', group:5, side:'ER' },
  { key:'T6BR', label:'T6BR', group:6, side:'BR' },
  { key:'T6ER', label:'T6ER', group:6, side:'ER' },
];

function interp(x, x0, x1, y0, y1) {
  if (x1 === x0) return y0;
  return y0 + (y1 - y0) * (x - x0) / (x1 - x0);
}
function interpolarMM(tabla, sondaMM) {
  if (!tabla || sondaMM === null || isNaN(sondaMM)) return null;
  const n = tabla.length;
  if (sondaMM <= tabla[0][0]) return tabla[0][1];
  if (sondaMM >= tabla[n-1][0]) return tabla[n-1][1];
  let lo = 0, hi = n - 1;
  while (hi - lo > 1) { const mid = Math.floor((lo+hi)/2); if (tabla[mid][0] <= sondaMM) lo=mid; else hi=mid; }
  return interp(sondaMM, tabla[lo][0], tabla[hi][0], tabla[lo][1], tabla[hi][1]);
}
function interpTrim(tabla, innage_m, trim_m) {
  if (!tabla || tabla.length === 0) return 0;
  const tMin = TRIM_VALS_QBS003[0], tMax = TRIM_VALS_QBS003[TRIM_VALS_QBS003.length-1];
  const tc = Math.max(tMin, Math.min(tMax, trim_m));
  let ti0=0, ti1=1;
  for (let i=0; i<TRIM_VALS_QBS003.length-1; i++) { if (tc>=TRIM_VALS_QBS003[i]&&tc<=TRIM_VALS_QBS003[i+1]){ti0=i;ti1=i+1;break;} }
  if (tc<=tMin){ti0=0;ti1=0;} if (tc>=tMax){ti0=TRIM_VALS_QBS003.length-2;ti1=TRIM_VALS_QBS003.length-1;}
  const n=tabla.length; let ri0=0,ri1=1;
  if (innage_m<=tabla[0][0]){ri0=0;ri1=0;}
  else if (innage_m>=tabla[n-1][0]){ri0=n-2;ri1=n-1;}
  else { for(let i=0;i<n-1;i++){if(innage_m>=tabla[i][0]&&innage_m<=tabla[i+1][0]){ri0=i;ri1=i+1;break;}} }
  const c0=ti0+1,c1=ti1+1;
  const corrAt=(ri,ci)=>tabla[ri][ci]||0;
  const interpRow=ri=>{ if(ti0===ti1) return corrAt(ri,c0); return interp(tc,TRIM_VALS_QBS003[ti0],TRIM_VALS_QBS003[ti1],corrAt(ri,c0),corrAt(ri,c1)); };
  if(ri0===ri1) return interpRow(ri0);
  return interp(innage_m,tabla[ri0][0],tabla[ri1][0],interpRow(ri0),interpRow(ri1));
}
function calcVCF(api, tempC) {
  if (isNaN(api)||isNaN(tempC)) return null;
  const rho15=(141.5/(131.5+api))*999.016;
  const alpha=(186.9696+0.486926*rho15)/(rho15*rho15);
  const d=tempC-15.5556;
  return Math.exp(-alpha*d*(1+0.8*alpha*d));
}
function calcF13(api) {
  if (isNaN(api)||api<=0) return null;
  return (141.5/(api+131.5))*1000*0.00378541;
}
function pfn(v) { const r=parseFloat(String(v).replace(',','.')); return isNaN(r)?NaN:r; }
function fmtN(n,dec=2) { if(n===null||n===undefined||isNaN(n)) return '—'; return Number(n).toLocaleString('es-CO',{minimumFractionDigits:dec,maximumFractionDigits:dec}); }
function fmt0(n) { return fmtN(n,0); }

const initFilas = () => TANKS.map(t => ({
  key:t.key, label:t.label, group:t.group, side:t.side,
  activo:true, producto: (t.key==='T3BR'||t.key==='T3ER') ? 'MGO' : 'VLSFO',
  sIni:'', tIni:'', aIni:'',
  sFin:'', tFin:'', aFin:'',
}));

function TInp({value, onChange, disabled, border, bg, text}) {
  return (
    <input type="number" value={value} onChange={onChange} disabled={disabled}
      style={{width:'100%',minWidth:72,background:disabled?bg:bg,border:'1px solid '+border,
        borderRadius:4,padding:'4px 6px',color:text,fontSize:12,outline:'none',
        textAlign:'right',fontFamily:'monospace',opacity:disabled?0.5:1}}/>
  );
}

export default function LiquidadorQBS003({ supabase, session, perfil, showToast, dbCall }) {
  const TH = {
    bg:'var(--bg,#f8f9fa)', card:'var(--card,#ffffff)', border:'var(--border,#e2e8f0)',
    text:'var(--text,#1e293b)', muted:'var(--muted,#64748b)', navy:'var(--navy,#1e3a5f)',
    orange:'var(--orange,#f97316)', success:'var(--success,#22c55e)', danger:'var(--danger,#ef4444)',
  };

  const [filas, setFilas] = useState(initFilas);
  const [calados, setCalados] = useState({proaIni:'',popaIni:'',proaFin:'',popaFin:''});
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0]);
  const [operador, setOperador] = useState(perfil?.nombre||'');
  const [obs, setObs] = useState('');
  const [saving, setSaving] = useState(false);

  const setF = (idx,k,v) => { const n=[...filas]; n[idx]={...n[idx],[k]:v}; setFilas(n); };

  const mkTrim = (popa, proa) => {
    const a=pfn(popa), b=pfn(proa);
    if(isNaN(a)||isNaN(b)||(String(popa).trim()===''&&String(proa).trim()==='')) return {val:0,dir:'—'};
    const diff=a-b;
    return {val:Math.abs(diff), dir:diff>0?'POPA':diff<0?'PROA':'KEEL'};
  };
  const trimI = mkTrim(calados.popaIni, calados.proaIni);
  const trimF = mkTrim(calados.popaFin, calados.proaFin);
  const trimSignedM = (p=>{ const a=pfn(calados.popaIni),b=pfn(calados.proaIni); if(isNaN(a)||isNaN(b)) return 0; return a-b; })();
  const trimSignedFM = (p=>{ const a=pfn(calados.popaFin),b=pfn(calados.proaFin); if(isNaN(a)||isNaN(b)) return 0; return a-b; })();
  const tcDir = d => d==='POPA'?TH.orange:d==='PROA'?'#3b82f6':TH.muted;

  const calcFila = (f, sonda, temp, api, trimSigned) => {
    const sondaMM = pfn(sonda), tempC = pfn(temp), apiV = pfn(api);
    if (isNaN(sondaMM)||String(sonda).trim()==='') return null;
    const innage_m = sondaMM/1000;
    const trimCorr_m = interpTrim(TRIM_QBS003[f.key], innage_m, trimSigned);
    const sondaCorr = sondaMM + trimCorr_m*1000;
    const m3 = interpolarMM(TABLAS_QBS003[f.key], sondaCorr);
    if (m3===null) return null;
    const glsB = m3*M3_TO_GAL;
    const vcf = (!isNaN(tempC)&&!isNaN(apiV)) ? calcVCF(apiV,tempC) : null;
    const glsN = vcf!==null ? glsB*vcf : null;
    const f13 = !isNaN(apiV) ? calcF13(apiV) : null;
    const mt = (f13!==null&&vcf!==null&&glsN!==null) ? (glsN/1000)*f13 : null;
    return {m3, glsB, vcf, glsN, f13, mt};
  };

  const thStyle = {padding:'8px 10px',color:TH.navy,fontWeight:800,fontSize:10,textAlign:'center',whiteSpace:'nowrap',borderBottom:'2px solid '+TH.border,textTransform:'uppercase',letterSpacing:0.5};
  const tdC = {padding:'5px 6px',textAlign:'center'};
  const tdR = {padding:'5px 8px',textAlign:'right',fontSize:12};

  const filaQ = (f, idx) => {
    const ri = calcFila(f, f.sIni, f.tIni, f.aIni, trimSignedM);
    const rf = calcFila(f, f.sFin, f.tFin, f.aFin, trimSignedFM);
    const ent = (ri?.glsN!=null && rf?.glsN!=null) ? ri.glsN - rf.glsN : null;
    const bg = !f.activo ? TH.bg : idx%2===0 ? '#ffffff' : '#eef4fb';
    const color = f.side==='BR' ? TH.navy : TH.orange;
    return (
      <tr key={f.key} style={{background:bg, opacity:f.activo?1:0.5, borderBottom:'1px solid '+TH.border}}>
        <td style={tdC}><input type="checkbox" checked={f.activo} onChange={e=>setF(idx,'activo',e.target.checked)}/></td>
        <td style={{...tdC,fontWeight:800,color,fontSize:13}}>{f.label}</td>
        <td style={{padding:'4px 6px'}}>
          <select value={f.producto} onChange={e=>setF(idx,'producto',e.target.value)} disabled={!f.activo}
            style={{background:TH.card,border:'1px solid '+TH.border,borderRadius:4,color:TH.text,fontSize:11,padding:'4px 6px',width:'100%'}}>
            {PRODUCTOS.map(p=><option key={p}>{p}</option>)}
          </select>
        </td>
        <td style={{padding:'4px 6px',minWidth:80}}><TInp value={f.sIni} disabled={!f.activo} onChange={e=>setF(idx,'sIni',e.target.value)} border={TH.border} bg={f.activo?TH.card:TH.bg} text={TH.text}/></td>
        <td style={{padding:'4px 6px',minWidth:70}}><TInp value={f.tIni} disabled={!f.activo} onChange={e=>setF(idx,'tIni',e.target.value)} border={TH.border} bg={f.activo?TH.card:TH.bg} text={TH.text}/></td>
        <td style={{padding:'4px 6px',minWidth:70}}><TInp value={f.aIni} disabled={!f.activo} onChange={e=>setF(idx,'aIni',e.target.value)} border={TH.border} bg={f.activo?TH.card:TH.bg} text={TH.text}/></td>
        <td style={{...tdR,color:'#2563eb',fontWeight:600}}>{ri?fmt0(ri.glsB):'—'}</td>
        <td style={{...tdR,color:TH.success,fontWeight:700}}>{ri?.glsN!=null?fmt0(ri.glsN):'—'}</td>
        <td style={{...tdR,color:TH.muted,fontWeight:600}}>{ri?.mt!=null?fmtN(ri.mt,3):'—'}</td>
        <td style={{padding:'4px 6px',minWidth:80}}><TInp value={f.sFin} disabled={!f.activo} onChange={e=>setF(idx,'sFin',e.target.value)} border={TH.border} bg={f.activo?TH.card:TH.bg} text={TH.text}/></td>
        <td style={{padding:'4px 6px',minWidth:70}}><TInp value={f.tFin} disabled={!f.activo} onChange={e=>setF(idx,'tFin',e.target.value)} border={TH.border} bg={f.activo?TH.card:TH.bg} text={TH.text}/></td>
        <td style={{padding:'4px 6px',minWidth:70}}><TInp value={f.aFin} disabled={!f.activo} onChange={e=>setF(idx,'aFin',e.target.value)} border={TH.border} bg={f.activo?TH.card:TH.bg} text={TH.text}/></td>
        <td style={{...tdR,color:'#2563eb',fontWeight:600}}>{rf?fmt0(rf.glsB):'—'}</td>
        <td style={{...tdR,color:TH.success,fontWeight:700}}>{rf?.glsN!=null?fmt0(rf.glsN):'—'}</td>
        <td style={{...tdR,color:TH.muted,fontWeight:600}}>{rf?.mt!=null?fmtN(rf.mt,3):'—'}</td>
        <td style={{...tdR,fontWeight:800,fontSize:13,color:ent!=null?(ent>=0?TH.navy:TH.danger):TH.muted}}>{ent!=null?fmt0(ent):'—'}</td>
      </tr>
    );
  };

  const activas = filas.filter(f=>f.activo);
  const totGlsBIni = activas.reduce((s,f)=>{ const r=calcFila(f,f.sIni,f.tIni,f.aIni,trimSignedM); return s+(r?.glsB??0); },0);
  const totGlsBFin = activas.reduce((s,f)=>{ const r=calcFila(f,f.sFin,f.tFin,f.aFin,trimSignedFM); return s+(r?.glsB??0); },0);
  const totGlsNIni = activas.reduce((s,f)=>{ const r=calcFila(f,f.sIni,f.tIni,f.aIni,trimSignedM); return s+(r?.glsN??0); },0);
  const totGlsNFin = activas.reduce((s,f)=>{ const r=calcFila(f,f.sFin,f.tFin,f.aFin,trimSignedFM); return s+(r?.glsN??0); },0);
  const hayMTIni   = activas.some(f=>calcFila(f,f.sIni,f.tIni,f.aIni,trimSignedM)?.mt!=null);
  const hayMTFin   = activas.some(f=>calcFila(f,f.sFin,f.tFin,f.aFin,trimSignedFM)?.mt!=null);
  const totMTIni   = hayMTIni ? activas.reduce((s,f)=>{ const r=calcFila(f,f.sIni,f.tIni,f.aIni,trimSignedM); return s+(r?.mt??0); },0) : null;
  const totMTFin   = hayMTFin ? activas.reduce((s,f)=>{ const r=calcFila(f,f.sFin,f.tFin,f.aFin,trimSignedFM); return s+(r?.mt??0); },0) : null;
  const totEnt = activas.some(f=>{ const ri=calcFila(f,f.sIni,f.tIni,f.aIni,trimSignedM); const rf=calcFila(f,f.sFin,f.tFin,f.aFin,trimSignedFM); return ri?.glsN!=null&&rf?.glsN!=null; })
    ? activas.reduce((s,f)=>{ const ri=calcFila(f,f.sIni,f.tIni,f.aIni,trimSignedM); const rf=calcFila(f,f.sFin,f.tFin,f.aFin,trimSignedFM); return s+((ri?.glsN??0)-(rf?.glsN??0)); }, 0)
    : null;
  const hayResultados = filas.some(f=>{ const r=calcFila(f,f.sIni,f.tIni,f.aIni,trimSignedM); return r!==null; });

  async function guardar() {
    if (!hayResultados) return showToast('Ingresa al menos una sonda', false);
    setSaving(true);
    const registro = {
      fecha, operador:operador.trim()||perfil?.nombre||'',
      observaciones:obs.trim()||null,
      calados, trim_ini:trimI, trim_fin:trimF,
      filas: filas.map(f=>({
        key:f.key, label:f.label, producto:f.producto, activo:f.activo,
        sIni:f.sIni, tIni:f.tIni, aIni:f.aIni,
        sFin:f.sFin, tFin:f.tFin, aFin:f.aFin,
      })),
      gls_netos_ini: Math.round(totGlsNIni),
      gls_netos_fin: Math.round(totGlsNFin),
      gls_entregados: totEnt!=null ? Math.round(totEnt) : null,
      usuario_id: session?.user?.id,
    };
    const {error} = await dbCall({table:'liquidaciones_qbs003', op:'insert', data:registro});
    if (error) { setSaving(false); showToast('Error: '+error.message, false); return; }
    try {
      const prefijo='MAL1';
      const {data:cmtsFrescos} = await supabase.from('cmts').select('numero_cmt').order('created_at',{ascending:false});
      const existentes=(cmtsFrescos||[]).filter(c=>(c.numero_cmt||'').startsWith(`CMT-${prefijo}-`));
      const numeroCmt=`CMT-${prefijo}-${String(existentes.length+1).padStart(5,'0')}`;
      const prod = activas[0]?.producto||'MGO';
      const tanquesAntes = activas.filter(f=>f.sIni).map(f=>{ const r=calcFila(f,f.sIni,f.tIni,f.aIni,trimSignedM); return {tanque:`QBS003-${f.key}`,sonda:f.sIni,temp:f.tIni,api:f.aIni,galones:r?.glsN?Math.round(r.glsN):0,producto:prod}; });
      const tanquesDespues = activas.filter(f=>f.sFin).map(f=>{ const r=calcFila(f,f.sFin,f.tFin,f.aFin,trimSignedFM); return {tanque:`QBS003-${f.key}`,sonda:f.sFin,temp:f.tFin,api:f.aFin,galones:r?.glsN?Math.round(r.glsN):0,producto:prod}; });
      await dbCall({table:'cmts',op:'insert',data:{
        id:numeroCmt,numero_cmt:numeroCmt,
        fecha,sede:perfil?.sede||'MALAMBO',planta:'QBS003',
        tipo_operacion:'ENTREGA A MOTONAVE',producto:prod,
        tanques_antes:tanquesAntes,tanques_despues:tanquesDespues,tanques_recepcion:[],
        total_antes:Math.round(totGlsNIni),total_despues:Math.round(totGlsNFin),
        total_movido:totEnt!=null?Math.round(totEnt):0,
        operador:perfil?.nombre||operador||'',creado_por:session?.user?.id,
      }});
    } catch(e){}
    setSaving(false);
    showToast('Liquidación QBS003 guardada ✔', true);
    setFilas(initFilas()); setCalados({proaIni:'',popaIni:'',proaFin:'',popaFin:''}); setObs('');
  }

  return (
    <div style={{fontFamily:'system-ui,sans-serif',color:TH.text,padding:'10px 16px',maxWidth:1500,margin:'0 auto'}}>
      <style>{'input[type=number]::-webkit-inner-spin-button,input[type=number]::-webkit-outer-spin-button{-webkit-appearance:none;margin:0}'}</style>

      {/* Header */}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
        <div>
          <div style={{fontWeight:800,fontSize:16,color:TH.navy}}>Liquidador — Planta 1</div>
          <div style={{fontSize:10,color:TH.muted}}>Barcaza QBS-003 · 12 Tanques (MM innage)</div>
        </div>
        <div style={{display:'flex',gap:8}}>
          <button onClick={()=>{setFilas(initFilas());setCalados({proaIni:'',popaIni:'',proaFin:'',popaFin:''});setObs('');}}
            style={{background:'transparent',border:'1px solid '+TH.border,borderRadius:6,padding:'6px 14px',color:TH.muted,fontSize:11,cursor:'pointer'}}>
            ↺ Limpiar
          </button>
          <button onClick={guardar} disabled={saving||!hayResultados}
            style={{background:TH.success,border:'none',borderRadius:6,padding:'6px 18px',color:'#fff',fontSize:11,fontWeight:700,cursor:saving||!hayResultados?'not-allowed':'pointer',opacity:saving||!hayResultados?0.6:1}}>
            {saving?'Guardando…':'✔ Guardar'}
          </button>
        </div>
      </div>

      {/* Campos */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 2fr',gap:8,marginBottom:8}}>
        {[{label:'Fecha',type:'date',val:fecha,set:setFecha},{label:'Operador',type:'text',val:operador,set:setOperador},{label:'Observaciones',type:'text',val:obs,set:setObs}].map(({label,type,val,set})=>(
          <div key={label}>
            <div style={{fontSize:9,fontWeight:700,color:TH.muted,textTransform:'uppercase',letterSpacing:1,marginBottom:3}}>{label}</div>
            <input type={type} value={val} onChange={e=>set(e.target.value)}
              style={{width:'100%',boxSizing:'border-box',background:TH.card,border:'1px solid '+TH.border,borderRadius:6,padding:'6px 8px',color:TH.text,fontSize:12,outline:'none'}}/>
          </div>
        ))}
      </div>

      {/* Calados */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:8}}>
        {[{label:'▶ Calados Iniciales',color:TH.orange,proa:'proaIni',popa:'popaIni',trim:trimI},
          {label:'◼ Calados Finales',  color:TH.navy, proa:'proaFin',popa:'popaFin',trim:trimF}].map(({label,color,proa,popa,trim})=>(
          <div key={label} style={{background:TH.card,border:'1px solid '+TH.border,borderLeft:`3px solid ${color}`,borderRadius:6,padding:'8px 12px'}}>
            <div style={{fontSize:10,fontWeight:800,color,textTransform:'uppercase',letterSpacing:1,marginBottom:6}}>{label}</div>
            <div style={{display:'flex',alignItems:'center',gap:12,flexWrap:'wrap'}}>
              {[{lbl:'Proa (m)',key:proa},{lbl:'Popa (m)',key:popa}].map(({lbl,key})=>(
                <div key={key} style={{display:'flex',alignItems:'center',gap:6}}>
                  <span style={{fontSize:10,color:TH.muted,whiteSpace:'nowrap'}}>{lbl}</span>
                  <input type="number" step="0.01" value={calados[key]} onChange={e=>setCalados(c=>({...c,[key]:e.target.value}))}
                    style={{width:72,background:TH.card,border:'1px solid '+TH.border,borderRadius:4,padding:'4px 6px',color:TH.text,fontSize:12,outline:'none',textAlign:'right'}}/>
                </div>
              ))}
              <div style={{display:'flex',alignItems:'center',gap:6,marginLeft:'auto'}}>
                <span style={{fontSize:10,color:TH.muted,fontWeight:700}}>Trim:</span>
                <span style={{fontSize:14,fontWeight:900,color:tcDir(trim.dir)}}>{trim.dir!=='—'?`${trim.val.toFixed(2)}m ${trim.dir}`:'—'}</span>
                {trim.dir==='POPA'&&trim.val>0.7&&<span style={{fontSize:9,color:TH.orange,fontWeight:700}}>⚠ &gt;0.7m</span>}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Tabla */}
      <div style={{background:TH.card,border:'1px solid '+TH.border,borderRadius:6,padding:'8px 12px',marginBottom:8}}>
        <div style={{fontSize:10,fontWeight:800,color:TH.navy,textTransform:'uppercase',letterSpacing:1,marginBottom:6}}>🛢️ Barcaza QBS-003 — Sonda MM (innage)</div>
        <div style={{overflowX:'auto'}}>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
            <thead>
              <tr style={{background:'#f0f4f8'}}>
                {['✓','Tanque','Producto','Sonda Ini','Temp Ini','API Ini','Gls.B Ini','Gls.N Ini','MT Ini','Sonda Fin','Temp Fin','API Fin','Gls.B Fin','Gls.N Fin','MT Fin','Gls.N Entregados'].map(h=>(
                  <th key={h} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>{filas.map((f,i)=>filaQ(f,i))}</tbody>
            {hayResultados && (
              <tfoot>
                <tr style={{background:TH.navy,color:'#fff'}}>
                  <td colSpan={6} style={{padding:'8px 10px',fontWeight:800,fontSize:12}}>TOTAL QBS003</td>
                  <td style={{padding:'8px 10px',textAlign:'right',fontWeight:700,fontFamily:'monospace',color:'#bae6fd'}}>{fmt0(totGlsBIni)}</td>
                  <td style={{padding:'8px 10px',textAlign:'right',fontWeight:700,fontFamily:'monospace',color:'#7dd3fc'}}>{fmt0(totGlsNIni)}</td>
                  <td style={{padding:'8px 10px',textAlign:'right',fontWeight:700,fontFamily:'monospace',color:'#93c5fd'}}>{totMTIni!=null?fmtN(totMTIni,3):'—'}</td>
                  <td colSpan={3}/>
                  <td style={{padding:'8px 10px',textAlign:'right',fontWeight:700,fontFamily:'monospace',color:'#bae6fd'}}>{fmt0(totGlsBFin)}</td>
                  <td style={{padding:'8px 10px',textAlign:'right',fontWeight:700,fontFamily:'monospace',color:'#7dd3fc'}}>{fmt0(totGlsNFin)}</td>
                  <td style={{padding:'8px 10px',textAlign:'right',fontWeight:700,fontFamily:'monospace',color:'#93c5fd'}}>{totMTFin!=null?fmtN(totMTFin,3):'—'}</td>
                  <td style={{padding:'8px 10px',textAlign:'right',fontWeight:800,fontSize:14,fontFamily:'monospace',color:totEnt!=null?(totEnt>=0?'#6ee7b7':TH.danger):TH.muted}}>{totEnt!=null?fmt0(totEnt):'—'}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
