import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

// Tablas que NO se auditan (internas o de solo lectura)
const TABLAS_SIN_AUDITORIA = new Set(["audit_log", "tanques"]);

async function registrarAuditoria({ user_id, tabla, op, filters, data, resultado }) {
  if (TABLAS_SIN_AUDITORIA.has(tabla)) return;
  try {
    const { data: perfil } = await supabaseAdmin
      .from("perfiles").select("nombre").eq("id", user_id).maybeSingle();
    const registro_id = (() => {
      if (resultado?.id) return String(resultado.id);
      if (filters?.length) return filters.map(f => f.val).join(",");
      if (data?.id) return String(data.id);
      return null;
    })();
    const accion = op === "insert" ? "crear" : op === "update" ? "editar" : op === "delete" ? "eliminar" : op;
    const datos_resumen = (() => {
      if (!data) return null;
      // Omitir campos grandes o irrelevantes para la vista de auditoría
      const omitir = new Set(["tanques_antes","tanques_despues","tanques_recepcion",
        "porteo_carga_tanques","porteo_descarga_tanques","porteo_carros","carros",
        "descargues","trasiegos","mps","permisos"]);
      return Object.fromEntries(Object.entries(data).filter(([k]) => !omitir.has(k)));
    })();
    await supabaseAdmin.from("audit_log").insert({
      tabla,
      registro_id,
      accion,
      usuario_id: user_id,
      usuario_nombre: perfil?.nombre || user_id,
      datos_despues: datos_resumen,
      created_at: new Date().toISOString(),
    });
  } catch (_) {}
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const token = (req.headers.authorization || "").replace("Bearer ", "").trim();
  if (!token) return res.status(401).json({ error: "No token" });

  const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token);
  if (authErr || !user) return res.status(401).json({ error: "Token inválido" });

  const { table, op, data, filters = [], select = "*", single = false } = req.body;
  if (!table || !op) return res.status(400).json({ error: "Faltan table u op" });

  try {
    let q = supabaseAdmin.from(table);
    let result;

    if (op === "insert") {
      result = await q.insert(Array.isArray(data) ? data : [data]).select("id").single();
    } else if (op === "upsert") {
      result = await q.upsert(Array.isArray(data) ? data : [data]);
    } else if (op === "update") {
      let qUp = q.update(data);
      for (const { col, val } of filters) qUp = qUp.eq(col, val);
      result = await qUp;
    } else if (op === "delete") {
      let qDel = q.delete();
      for (const { col, val } of filters) qDel = qDel.eq(col, val);
      result = await qDel;
    } else if (op === "select") {
      let qSel = q.select(select);
      for (const { col, op: fop = "eq", val } of filters) {
        if      (fop === "gte") qSel = qSel.gte(col, val);
        else if (fop === "lte") qSel = qSel.lte(col, val);
        else if (fop === "gt")  qSel = qSel.gt(col, val);
        else if (fop === "lt")  qSel = qSel.lt(col, val);
        else                    qSel = qSel.eq(col, val);
      }
      if (single) qSel = qSel.maybeSingle();
      result = await qSel;
    } else {
      return res.status(400).json({ error: "Op no soportada: " + op });
    }

    if (result.error) return res.status(400).json({ error: result.error.message });

    // Registrar auditoría para escrituras exitosas
    if (["insert","update","delete"].includes(op)) {
      registrarAuditoria({
        user_id: user.id,
        tabla: table,
        op,
        filters,
        data,
        resultado: result.data,
      });
    }

    return res.status(200).json({ data: result.data });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
