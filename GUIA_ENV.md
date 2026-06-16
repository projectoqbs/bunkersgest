# 🔐 GUÍA: Implementar Variables de Entorno en BUNKERSGEST

## ¿Por qué?
Actualmente las credenciales de Supabase están **hardcodeadas** en App.jsx (líneas 10-11):
```javascript
const SUPABASE_URL = "https://pahulcaneuzfiknrzlbc.supabase.co";
const SUPABASE_KEY = "sb_publishable_6A3JvUT-O5UpP5FAYUIKaA_6-Xihr7N";
```

Esto es un **riesgo de seguridad** porque:
- ❌ Las credenciales se suben a GitHub
- ❌ Cualquiera puede ver las credenciales
- ❌ No es escalable para múltiples ambientes (dev, staging, prod)

**Solución:** Usar variables de entorno (`.env.local`)

---

## Paso 1: Crear archivo `.env.local`

En la raíz del proyecto (donde está `package.json`), crea:

```
bunkersgest/
├── src/
├── public/
├── package.json
├── vite.config.js
├── .env.local          ← CREAR AQUÍ
└── .gitignore
```

**Contenido de `.env.local`:**
```env
VITE_SUPABASE_URL=https://pahulcaneuzfiknrzlbc.supabase.co
VITE_SUPABASE_KEY=sb_publishable_6A3JvUT-O5UpP5FAYUIKaA_6-Xihr7N
```

---

## Paso 2: Actualizar App.jsx (líneas 10-12)

**ANTES:**
```javascript
const SUPABASE_URL = "https://pahulcaneuzfiknrzlbc.supabase.co";
const SUPABASE_KEY = "sb_publishable_6A3JvUT-O5UpP5FAYUIKaA_6-Xihr7N";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
```

**DESPUÉS:**
```javascript
// Get credentials from environment variables - never hardcode in source!
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://pahulcaneuzfiknrzlbc.supabase.co";
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY || "sb_publishable_6A3JvUT-O5UpP5FAYUIKaA_6-Xihr7N";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
```

El `|| "..."` es un fallback por si no está definido en `.env.local` (para desarrollo local).

---

## Paso 3: Actualizar `.gitignore`

Asegúrate de que `.gitignore` incluya:
```
.env
.env.local
.env.*.local
```

Así `.env.local` **nunca se sube a GitHub** 🔒

---

## Paso 4: Crear `.env.local.example`

Para que otros developers sepan qué variables necesitan, crea:

```
.env.local.example
```

**Contenido:**
```env
# Supabase Configuration
# Get these from your Supabase project at https://app.supabase.com

VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_KEY=your_publishable_key

# Note: Copy this file to .env.local and update with your actual Supabase credentials
# Never commit .env.local to version control - it's already in .gitignore
```

Este archivo **SÍ se sube a GitHub** porque no tiene credenciales reales.

---

## Verificar que funciona

1. **Para desarrollo local:**
```bash
npm run dev
```
Debe conectar a Supabase sin problemas usando `.env.local`

2. **Para producción (Vercel):**
En Vercel, agrega las variables en Settings → Environment Variables:
- `VITE_SUPABASE_URL` = tu URL real
- `VITE_SUPABASE_KEY` = tu clave real

---

## Resumen de cambios

| Archivo | Cambio | Sube a GitHub? |
|---|---|---|
| `.env.local` | Crear con credenciales reales | ❌ NO (en .gitignore) |
| `.env.local.example` | Crear sin credenciales | ✅ SÍ (plantilla) |
| `App.jsx` | Cambiar líneas 10-12 a usar `import.meta.env` | ✅ SÍ |
| `.gitignore` | Asegurar que incluya `.env.local` | ✅ SÍ |

---

## Antes de hacer commit a GitHub

```bash
# 1. Verifica que .env.local está en .gitignore
cat .gitignore | grep ".env.local"

# 2. Asegúrate de que .env.local no será commiteado
git status
# NO debe mostrar .env.local en "Changes to be committed"

# 3. Commit y push
git add .
git commit -m "chore: move Supabase credentials to environment variables"
git push origin master
```

---

## 🎯 Resultado Final

✅ Credenciales **NO en GitHub**  
✅ `.env.local` ignorado automáticamente  
✅ `.env.local.example` como plantilla para developers  
✅ Listo para Vercel (variables en UI)  
✅ Escalable a múltiples ambientes (dev, staging, prod)
