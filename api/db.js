import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  // Verificar JWT
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
      result = await q.insert(Array.isArray(data) ? data : [data]);
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
      for (const { col, val } of filters) qSel = qSel.eq(col, val);
      if (single) qSel = qSel.maybeSingle();
      result = await qSel;
    } else {
      return res.status(400).json({ error: "Op no soportada: " + op });
    }

    if (result.error) return res.status(400).json({ error: result.error.message });
    return res.status(200).json({ data: result.data });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
