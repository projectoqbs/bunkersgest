// LiquidadorQBS003.jsx — Liquidador barcaza QBS003 (12 tanques: T1-T6 Port/Starboard)
import { useState, useCallback } from 'react';
import { TABLAS_QBS003, CAP_QBS003_GAL } from '../data/tablas_qbs003';
import { TRIM_QBS003, TRIM_VALS_QBS003 } from '../data/trim_qbs003';

const M3_TO_GAL = 264.172;

// ─── Utilidades ─────────────────────────────────────────────────────────────
function interp(x, x0, x1, y0, y1) {
  if (x1 === x0) return y0;
  return y0 + (y1 - y0) * (x - x0) / (x1 - x0);
}

function interpolarMM(tabla, sondaMM) {
  if (!tabla || sondaMM === null || isNaN(sondaMM)) return null;
  const n = tabla.length;
  if (sondaMM <= tabla[0][0]) return tabla[0][1];
  if (sondaMM >= tabla[n - 1][0]) return tabla[n - 1][1];
  let lo = 0, hi = n - 1;
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2);
    if (tabla[mid][0] <= sondaMM) lo = mid; else hi = mid;
  }
  return interp(sondaMM, tabla[lo][0], tabla[hi][0], tabla[lo][1], tabla[hi][1]);
}

// Corrección de trim: interpola en tabla 2D (innage_m, trim_m) → corrección en metros
function interpTrim(tabla, innage_m, trim_m) {
  if (!tabla || tabla.length === 0) return 0;
  // Clamp trim to table range
  const tMin = TRIM_VALS_QBS003[0], tMax = TRIM_VALS_QBS003[TRIM_VALS_QBS003.length - 1];
  const tc = Math.max(tMin, Math.min(tMax, trim_m));
  // Find trim column indices
  let ti0 = 0, ti1 = 1;
  for (let i = 0; i < TRIM_VALS_QBS003.length - 1; i++) {
    if (tc >= TRIM_VALS_QBS003[i] && tc <= TRIM_VALS_QBS003[i + 1]) { ti0 = i; ti1 = i + 1; break; }
  }
  if (tc <= tMin) { ti0 = 0; ti1 = 0; }
  if (tc >= tMax) { ti0 = TRIM_VALS_QBS003.length - 2; ti1 = TRIM_VALS_QBS003.length - 1; }
  // Find innage row indices
  const n = tabla.length;
  let ri0 = 0, ri1 = 1;
  if (innage_m <= tabla[0][0]) { ri0 = 0; ri1 = 0; }
  else if (innage_m >= tabla[n - 1][0]) { ri0 = n - 2; ri1 = n - 1; }
  else { for (let i = 0; i < n - 1; i++) { if (innage_m >= tabla[i][0] && innage_m <= tabla[i + 1][0]) { ri0 = i; ri1 = i + 1; break; } } }
  // Bilinear interpolation: column index is ti + 1 (col 0 = innage, col 1 = trim[0])
  const c0 = ti0 + 1, c1 = ti1 + 1;
  const corrAt = (ri, ci) => tabla[ri][ci] || 0;
  const interpRow = (ri) => {
    if (ti0 === ti1) return corrAt(ri, c0);
    const t0 = TRIM_VALS_QBS003[ti0], t1 = TRIM_VALS_QBS003[ti1];
    return interp(tc, t0, t1, corrAt(ri, c0), corrAt(ri, c1));
  };
  if (ri0 === ri1) return interpRow(ri0);
  const i0m = tabla[ri0][0], i1m = tabla[ri1][0];
  return interp(innage_m, i0m, i1m, interpRow(ri0), interpRow(ri1));
}

// VCF: ASTM D1250 (productos del petróleo, densidad 15°C a partir de API)
function calcVCF(api, tempC) {
  if (isNaN(api) || isNaN(tempC)) return null;
  const rho15 = (141.5 / (131.5 + api)) * 999.016;
  const alpha = (186.9696 + 0.486926 * rho15) / (rho15 * rho15);
  const d = tempC - 15.5556;
  return Math.exp(-alpha * d * (1 + 0.8 * alpha * d));
}

function calcF13(api) {
  if (isNaN(api) || api <= 0) return null;
  const sg = 141.5 / (api + 131.5);
  return sg * 1000 * 0.00378541;
}

function pf(v) { return parseFloat(String(v).replace(',', '.')) || 0; }
function pfn(v) { const r = parseFloat(String(v).replace(',', '.')); return isNaN(r) ? NaN : r; }
function fmtN(n, dec = 2) {
  if (n === null || n === undefined || isNaN(n)) return '—';
  return Number(n).toLocaleString('es-CO', { minimumFractionDigits: dec, maximumFractionDigits: dec });
}
function fmt0(n) { return fmtN(n, 0); }

// ─── Tanques QBS003 ──────────────────────────────────────────────────────────
const TANKS = [
  { key: 'T1BR', label: 'Tank 1 Babor',      group: 1, side: 'BR' },
  { key: 'T1ER', label: 'Tank 1 Estribor',   group: 1, side: 'ER' },
  { key: 'T2BR', label: 'Tank 2 Babor',      group: 2, side: 'BR' },
  { key: 'T2ER', label: 'Tank 2 Estribor',   group: 2, side: 'ER' },
  { key: 'T3BR', label: 'Tank 3 Babor',      group: 3, side: 'BR' },
  { key: 'T3ER', label: 'Tank 3 Estribor',   group: 3, side: 'ER' },
  { key: 'T4BR', label: 'Tank 4 Babor',      group: 4, side: 'BR' },
  { key: 'T4ER', label: 'Tank 4 Estribor',   group: 4, side: 'ER' },
  { key: 'T5BR', label: 'Tank 5 Babor',      group: 5, side: 'BR' },
  { key: 'T5ER', label: 'Tank 5 Estribor',   group: 5, side: 'ER' },
  { key: 'T6BR', label: 'Tank 6 Babor',      group: 6, side: 'BR' },
  { key: 'T6ER', label: 'Tank 6 Estribor',   group: 6, side: 'ER' },
];

const initFilas = () => TANKS.map(t => ({
  key: t.key,
  label: t.label,
  group: t.group,
  side: t.side,
  sonda: '',
  temperatura: '',
  api: '',
}));

// ─── Componente ──────────────────────────────────────────────────────────────
export default function LiquidadorQBS003({ supabase, session, perfil, showToast, dbCall, onResult }) {
  const T = {
    bg: 'var(--bg, #f8f9fa)', card: 'var(--card, #ffffff)', border: 'var(--border, #e2e8f0)',
    text: 'var(--text, #1e293b)', muted: 'var(--muted, #64748b)', navy: 'var(--navy, #1e3a5f)',
    orange: 'var(--orange, #f97316)', success: 'var(--success, #22c55e)', danger: 'var(--danger, #ef4444)',
  };

  const [filas, setFilas] = useState(initFilas());
  const [calados, setCalados] = useState({ proaIni: '', popaIni: '', proaFin: '', popaFin: '' });

  const mkTrim = (popa, proa) => {
    const a = pfn(popa), b = pfn(proa);
    if (isNaN(a) || isNaN(b) || (String(popa).trim() === '' && String(proa).trim() === '')) return { val: 0, dir: '—' };
    const diff = a - b;
    return { val: Math.abs(diff), dir: diff > 0 ? 'POPA' : diff < 0 ? 'PROA' : 'KEEL' };
  };
  const trimI = mkTrim(calados.popaIni, calados.proaIni);
  const trimF = mkTrim(calados.popaFin, calados.proaFin);
  const tcDir = d => d === 'POPA' ? T.orange : d === 'PROA' ? '#3b82f6' : T.muted;

  const updateFila = (key, campo, valor) => {
    setFilas(prev => prev.map(f => f.key === key ? { ...f, [campo]: valor } : f));
  };

  const limpiar = () => { setFilas(initFilas()); };

  // Calcular resultado para una fila (trim en metros con signo: pos=popa, neg=proa)
  const calcFila = (f, trimSignedM = 0) => {
    const sondaMM = pfn(f.sonda);
    const tempC   = pfn(f.temperatura);
    const api     = pfn(f.api);
    if (isNaN(sondaMM) || sondaMM === '') return null;
    // Aplicar corrección de trim: la tabla da corrección en metros → convertir a mm
    const innage_m = sondaMM / 1000;
    const trimCorr_m = interpTrim(TRIM_QBS003[f.key], innage_m, trimSignedM);
    const sondaCorr = sondaMM + trimCorr_m * 1000;
    const tabla = TABLAS_QBS003[f.key];
    const m3 = interpolarMM(tabla, sondaCorr);
    if (m3 === null) return null;
    const glsB = m3 * M3_TO_GAL;
    const vcf  = (!isNaN(tempC) && !isNaN(api)) ? calcVCF(api, tempC) : null;
    const glsN = vcf !== null ? glsB * vcf : null;
    const f13  = !isNaN(api) ? calcF13(api) : null;
    const mt   = (f13 !== null && vcf !== null && glsN !== null) ? (glsN / 1000) * f13 : null;
    const capGal = CAP_QBS003_GAL[f.key];
    const pct  = (capGal && glsN) ? (glsN / capGal) * 100 : null;
    return { m3, glsB, vcf, glsN, f13, mt, pct };
  };

  // Trim con signo para corrección: positivo = popa, negativo = proa
  const trimSignedM = (() => {
    const p = pfn(calados.popaIni), r = pfn(calados.proaIni);
    if (isNaN(p) || isNaN(r) || (String(calados.popaIni).trim() === '' && String(calados.proaIni).trim() === '')) return 0;
    return p - r; // positivo=popa, negativo=proa
  })();

  const resultados = filas.map(f => ({ ...f, res: calcFila(f, trimSignedM) }));

  const totM3   = resultados.reduce((s, r) => s + (r.res?.m3   ?? 0), 0);
  const totGlsB = resultados.reduce((s, r) => s + (r.res?.glsB ?? 0), 0);
  const hayGlsN  = resultados.some(r => r.res?.glsN != null);
  const totGlsN = hayGlsN ? resultados.reduce((s, r) => s + (r.res?.glsN ?? 0), 0) : null;
  const totMT   = resultados.every(r => r.res?.mt != null) ? resultados.reduce((s, r) => s + (r.res?.mt ?? 0), 0) : null;
  const totCapGal = Object.values(CAP_QBS003_GAL).reduce((s, v) => s + v, 0);
  const totPct  = (totCapGal && totGlsN) ? (totGlsN / totCapGal) * 100 : null;
  const hayResultados = resultados.some(r => r.res !== null);

  // ─── Colores por % llenado ────────────────────────────────────────────────
  const colorPct = (pct) => {
    if (pct === null) return T.muted;
    if (pct >= 85) return T.danger;
    if (pct >= 60) return T.orange;
    return T.success;
  };

  const inputSt = {
    width: '100%', background: T.bg, border: `1px solid ${T.border}`,
    borderRadius: 6, padding: '6px 8px', color: T.text, fontSize: 12,
    outline: 'none', fontFamily: 'monospace', textAlign: 'right',
  };
  const thSt = {
    padding: '8px 10px', fontSize: 9, color: T.navy, textTransform: 'uppercase',
    letterSpacing: 1, fontWeight: 700, borderBottom: `2px solid ${T.border}`,
    whiteSpace: 'nowrap', background: T.bg, textAlign: 'right',
  };
  const tdSt = (extra = {}) => ({
    padding: '7px 10px', fontSize: 11, whiteSpace: 'nowrap',
    borderBottom: `1px solid ${T.border}`, ...extra,
  });

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', color: T.text }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
        <div>
          <div style={{ fontWeight: 900, fontSize: 18, color: T.navy }}>🛢 Liquidador QBS003</div>
          <div style={{ fontSize: 11, color: T.muted }}>Barcaza QBS003 — 12 tanques (Innage mm → m³ → gal)</div>
        </div>
        <button onClick={limpiar}
          style={{ background: 'transparent', border: `1px solid ${T.border}`, borderRadius: 8, padding: '6px 14px', color: T.muted, fontSize: 11, cursor: 'pointer' }}>
          ↺ Limpiar
        </button>
      </div>

      {/* Calados */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
        {[
          { label: 'Calados Iniciales', proa: 'proaIni', popa: 'popaIni', trim: trimI },
          { label: 'Calados Finales',   proa: 'proaFin', popa: 'popaFin', trim: trimF },
        ].map(({ label, proa, popa, trim }) => (
          <div key={label} style={{ background: T.card, border: `1px solid ${T.border}`, borderLeft: `3px solid ${T.orange}`, borderRadius: 6, padding: '8px 12px' }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: T.orange, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>
              {label === 'Calados Iniciales' ? '▶' : '■'} {label}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              {[{ lbl: 'Proa (m)', key: proa }, { lbl: 'Popa (m)', key: popa }].map(({ lbl, key }) => (
                <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 10, color: T.muted, whiteSpace: 'nowrap' }}>{lbl}</span>
                  <input type="number" step="0.01" value={calados[key]}
                    onChange={e => setCalados(c => ({ ...c, [key]: e.target.value }))}
                    style={{ width: 72, background: T.card, border: `1px solid ${T.border}`, borderRadius: 4, padding: '4px 6px', color: T.text, fontSize: 12, outline: 'none', textAlign: 'right' }} />
                </div>
              ))}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto' }}>
                <span style={{ fontSize: 10, color: T.muted, fontWeight: 700 }}>Trim:</span>
                <span style={{ fontSize: 14, fontWeight: 900, color: tcDir(trim.dir) }}>{trim.dir !== '—' ? `${trim.val.toFixed(2)}m ${trim.dir}` : '—'}</span>
                {trim.dir === 'POPA' && trim.val > 0.7 && <span style={{ fontSize: 9, color: T.orange, fontWeight: 700 }}>⚠ &gt;0.7m</span>}
              </div>
            </div>
          </div>
        ))}
      </div>


      {/* Tabla de entrada / resultados */}
      <div style={{ overflowX: 'auto', borderRadius: 10, border: `1px solid ${T.border}` }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 780 }}>
          <thead>
            <tr>
              <th style={{ ...thSt, textAlign: 'left' }}>Tanque</th>
              <th style={{ ...thSt }}>Sonda (mm)</th>
              <th style={{ ...thSt }}>Temp (°C)</th>
              <th style={{ ...thSt }}>API°</th>
              <th style={{ ...thSt, color: T.orange }}>m³</th>
              <th style={{ ...thSt }}>Gls Brutos</th>
              <th style={{ ...thSt }}>VCF</th>
              <th style={{ ...thSt, color: T.success }}>Gls Netos</th>
              <th style={{ ...thSt }}>MT</th>
              <th style={{ ...thSt }}>% Llenado</th>
            </tr>
          </thead>
          <tbody>
            {resultados.map((f, i) => {
              const r = f.res;
              const isNewGroup = i === 0 || f.group !== resultados[i - 1].group;
              return (
                <tr key={f.key} style={{ background: i % 2 === 0 ? T.card : T.bg }}>
                  {/* Tanque label */}
                  <td style={tdSt({ fontWeight: 700, color: f.side === 'BR' ? T.navy : T.orange, fontSize: 11 })}>
                    {f.label}
                    <div style={{ fontSize: 9, color: T.muted, fontWeight: 400 }}>
                      Cap: {fmt0(CAP_QBS003_GAL[f.key])} gal
                    </div>
                  </td>
                  {/* Sonda */}
                  <td style={tdSt()}>
                    <input type="number" step="1" min="0" max="2400"
                      value={f.sonda} onChange={e => updateFila(f.key, 'sonda', e.target.value)}
                      placeholder="0" style={inputSt} />
                  </td>
                  {/* Temperatura */}
                  <td style={tdSt()}>
                    <input type="number" step="0.1"
                      value={f.temperatura} onChange={e => updateFila(f.key, 'temperatura', e.target.value)}
                      placeholder="—" style={inputSt} />
                  </td>
                  {/* API */}
                  <td style={tdSt()}>
                    <input type="number" step="0.1"
                      value={f.api} onChange={e => updateFila(f.key, 'api', e.target.value)}
                      placeholder="—" style={inputSt} />
                  </td>
                  {/* m3 */}
                  <td style={tdSt({ textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: r ? T.orange : T.muted })}>
                    {r ? fmtN(r.m3, 3) : '—'}
                  </td>
                  {/* Gls Brutos */}
                  <td style={tdSt({ textAlign: 'right', fontFamily: 'monospace', color: T.muted })}>
                    {r ? fmt0(r.glsB) : '—'}
                  </td>
                  {/* VCF */}
                  <td style={tdSt({ textAlign: 'right', fontFamily: 'monospace', fontSize: 10, color: T.muted })}>
                    {r?.vcf ? r.vcf.toFixed(4) : '—'}
                  </td>
                  {/* Gls Netos */}
                  <td style={tdSt({ textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: r ? T.success : T.muted })}>
                    {r ? fmt0(r.glsN) : '—'}
                  </td>
                  {/* MT */}
                  <td style={tdSt({ textAlign: 'right', fontFamily: 'monospace', color: T.muted })}>
                    {r?.mt ? fmtN(r.mt, 3) : '—'}
                  </td>
                  {/* % Llenado */}
                  <td style={tdSt({ textAlign: 'right' })}>
                    {r?.pct != null ? (
                      <span style={{ fontWeight: 700, color: colorPct(r.pct), fontFamily: 'monospace' }}>
                        {fmtN(r.pct, 1)}%
                      </span>
                    ) : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
          {hayResultados && (
            <tfoot>
              <tr style={{ background: T.navy }}>
                <td colSpan={4} style={{ ...tdSt({ color: '#fff', fontWeight: 700, fontSize: 12 }), textAlign: 'left' }}>
                  TOTAL QBS003
                </td>
                <td style={tdSt({ textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: T.orange })}>
                  {fmtN(totM3, 3)}
                </td>
                <td style={tdSt({ textAlign: 'right', fontFamily: 'monospace', color: '#ccc' })}>
                  {fmt0(totGlsB)}
                </td>
                <td style={tdSt({ color: '#ccc' })}>—</td>
                <td style={tdSt({ textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: T.success })}>
                  {fmt0(totGlsN)}
                </td>
                <td style={tdSt({ textAlign: 'right', fontFamily: 'monospace', color: '#ccc' })}>
                  {totMT ? fmtN(totMT, 3) : '—'}
                </td>
                <td style={tdSt({ textAlign: 'right', fontWeight: 700, color: totPct != null ? colorPct(totPct) : '#ccc' })}>
                  {totPct != null ? `${fmtN(totPct, 1)}%` : '—'}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* Resumen visual por grupo de tanques */}
      {hayResultados && (
        <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 10 }}>
          {[1, 2, 3, 4, 5, 6].map(g => {
            const port = resultados.find(r => r.group === g && r.side === 'BR');
            const stbd = resultados.find(r => r.group === g && r.side === 'ER');
            const totalGls = (port?.res?.glsN ?? 0) + (stbd?.res?.glsN ?? 0);
            const totalCap = (CAP_QBS003_GAL[port?.key] ?? 0) + (CAP_QBS003_GAL[stbd?.key] ?? 0);
            const pct = totalCap ? (totalGls / totalCap) * 100 : 0;
            return (
              <div key={g} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, padding: 12, textAlign: 'center' }}>
                <div style={{ fontSize: 10, color: T.muted, fontWeight: 700, marginBottom: 6 }}>TANK {g}</div>
                {/* Barra de llenado */}
                <div style={{ height: 60, background: T.bg, borderRadius: 6, overflow: 'hidden', position: 'relative', marginBottom: 6, border: `1px solid ${T.border}` }}>
                  <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: `${Math.min(pct, 100)}%`, background: colorPct(pct), opacity: 0.7, transition: 'height 0.3s' }} />
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: T.text }}>
                    {totalGls > 0 ? `${fmtN(pct, 0)}%` : '—'}
                  </div>
                </div>
                <div style={{ fontSize: 10, fontWeight: 700, color: T.navy }}>{fmt0(totalGls)} gal</div>
                <div style={{ fontSize: 9, color: T.muted }}>{fmtN(totalGls / M3_TO_GAL * 264.172 / 264.172 * (port?.res?.m3 ? port.res.m3 + (stbd?.res?.m3 ?? 0) : 0), 2)} m³</div>
                <div style={{ fontSize: 9, color: T.muted, marginTop: 4 }}>
                  BR: {fmt0(port?.res?.glsN ?? 0)} | ER: {fmt0(stbd?.res?.glsN ?? 0)}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
