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

  const { op, userId, data } = req.body;

  try {
    let result;
    if (op === "createUser") {
      result = await supabaseAdmin.auth.admin.createUser(data);
    } else if (op === "updateUser") {
      result = await supabaseAdmin.auth.admin.updateUserById(userId, data);
    } else if (op === "deleteUser") {
      result = await supabaseAdmin.auth.admin.deleteUser(userId);
    } else if (op === "listUsers") {
      result = await supabaseAdmin.auth.admin.listUsers(data || { perPage: 1000 });
    } else {
      return res.status(400).json({ error: "Op no soportada: " + op });
    }

    if (result.error) return res.status(400).json({ error: result.error.message });
    return res.status(200).json({ data: result.data });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
