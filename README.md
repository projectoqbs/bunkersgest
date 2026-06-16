# BUNKERSGEST

**Sistema SaaS de Gestión de Combustible Marino**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![React](https://img.shields.io/badge/React-18.2-blue)](https://reactjs.org/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-green)](https://supabase.com/)
[![Vite](https://img.shields.io/badge/Vite-5.0-purple)](https://vitejs.dev/)

---

## 📋 ¿Qué es BUNKERSGEST?

BUNKERSGEST es una **plataforma web integral** que digitaliza la operación completa de **bunkering** (suministro de combustible marino). Reemplaza procesos manuales en papel y Excel con un sistema modular de **9 módulos operativos** conectados y en tiempo real.

Diseñado para **vender como SaaS** a empresas de bunkering en Colombia y Latinoamérica.

---

## ✨ Características Principales

### 🚛 **Logística - Viajes**
- Registro de carros tanque con transportadora, placa, conductor, guía
- Control de estado: En Ruta → En Planta → Descargado
- Vinculación automática con tiquetes de laboratorio

### 🧪 **Laboratorio - Tiquetes MP**
- Emisión de tiquetes de ingreso de materia prima
- Cálculos automáticos: API, pesos, galones, agua por destilación
- Aprobación/rechazo automático según criterios ASTM
- Integración con consecutivos SIIGO

### 🔒 **Operaciones - PBS**
- Permiso de Bombeo Seguro: checklist de 27 puntos
- Registro de responsables, bovedas, tiempos de operación
- Vinculación directa con CMT para trazabilidad

### 📋 **Coordinador - CMT**
- Control de Movimiento de Tanques (antes/después)
- **Cálculo automático de galones** con tabla de aforo real (ASTM Tabla 6B)
- Corrección de volumen con **VCF** (Factor de Corrección de Volumen)
- Registro de carros descargados, PBS y motonaves
- Soporte para trasiego, descargue, entrega a carrotanque

### 🛢 **Tanques**
- Vista en tiempo real de 7 tanques (TK-111 al TK-117)
- Indicador visual de nivel y capacidad
- Códigos de color: Materia Prima (naranja), Mezcla (azul), Terminado (verde)
- Alertas de nivel crítico

### 🚢 **Despacho**
- Registro de entregas a buques via barcaza
- Carga en compartimentos específicos
- Descuento automático de inventario

### 🔍 **Trazabilidad Completa**
- Vista integrada por viaje: Logística → Tiquete → PBS → CMT → Despacho
- Estado en tiempo real de cada operación

### 👥 **Gestión de Usuarios**
- 7 roles con permisos diferenciados
- Control de acceso granular por módulo
- Límite de 8 horas para auto-edición (excepto admin)

### 📊 **Dashboard**
- KPIs en tiempo real: carros en ruta, tiquetes pendientes, PBS pendientes, CMT pendientes
- Inventario de tanques actualizado en vivo
- Últimas operaciones registradas

---

## 🛠 Stack Tecnológico

| Componente | Tecnología |
|---|---|
| **Frontend** | React 18.2 + Vite |
| **Backend** | Supabase (PostgreSQL en la nube) |
| **Autenticación** | Supabase Auth (email/contraseña) |
| **Base de Datos** | PostgreSQL (8 tablas) |
| **Hosting** | Vercel (recomendado) |
| **Control de Versiones** | GitHub |

---

## 🚀 Instalación

### Requisitos
- Node.js 16+ 
- npm o yarn
- Cuenta en Supabase

### Pasos

1. **Clona el repositorio**
```bash
git clone https://github.com/projectoqbs/bunkersgest.git
cd bunkersgest
```

2. **Instala dependencias**
```bash
npm install
```

3. **Configura variables de entorno**
```bash
cp .env.local.example .env.local
```

Edita `.env.local` con tus credenciales de Supabase:
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_KEY=your_publishable_key
```

4. **Inicia el servidor de desarrollo**
```bash
npm run dev
```

5. **Abre en navegador**
```
http://localhost:5173
```

---

## 📚 Documentación

### Base de Datos
- **8 Tablas principales**: perfiles, tanques, viajes, tiquetes, pbs, cmts, despachos, aforo
- **Realtime subscriptions** para actualizaciones en vivo
- **Row-level security (RLS)** por rol de usuario

### Fórmula de Cálculo VCF (ASTM Tabla 6B)
```
RHO = (141.5 × 999.012) / (131.5 + API)
alpha = k0/(RHO²) + k1/RHO
Delta T = Temperatura °F - 60
VCF = exp(-alpha × Delta T × (1 + 0.8 × alpha × Delta T))
Galones Netos = Galones Brutos × VCF
```

### Tablas de Aforo
Los 7 tanques tienen tablas de aforo cargadas en Supabase con medidas en ULLAGE (mm) y galones brutos correspondientes. El sistema interpola exactamente para cada sonda.

---

## 👤 Demostración

### Usuarios de Prueba

| Rol | Usuario | Contraseña | Acceso |
|---|---|---|---|
| Admin | admin@demo.internal | demo123 | Todos los módulos |
| Logística | logistica@demo.internal | demo123 | Viajes, Trazabilidad |
| Laboratorio | lab@demo.internal | demo123 | Tiquetes, Trazabilidad |
| Operaciones | ops@demo.internal | demo123 | PBS, Trazabilidad |
| Coordinador | coord@demo.internal | demo123 | CMT, Tanques, Trazabilidad |
| Despacho | despacho@demo.internal | demo123 | Despacho, Trazabilidad |
| Gerencia | gerencia@demo.internal | demo123 | Dashboard (solo lectura) |

---

## 📈 Roadmap

### ✅ Completo (v1)
- [x] 9 módulos operativos
- [x] Autenticación y roles
- [x] Cálculo VCF ASTM
- [x] Trazabilidad integrada
- [x] Dashboard en tiempo real

### 🔄 En Desarrollo
- [ ] Publicar en Vercel
- [ ] Firmas digitales en PBS (tablet)
- [ ] Reportes PDF exportables

### 📋 Próximos (v2)
- [ ] Integración con SIESA ERP
- [ ] App móvil para conductores
- [ ] Agente de email para flota
- [ ] Módulo de mezclas VLSFO
- [ ] Dashboard analytics avanzado

---

## 🔐 Seguridad

- ✅ Autenticación con email/contraseña
- ✅ Row-level security (RLS) en todas las tablas
- ✅ Variables de entorno para credenciales
- ✅ Límite de edición por tiempo (8 horas para usuarios regulares)
- ✅ Auditoría de cambios por usuario

---

## 💰 Modelo de Negocio (SaaS)

BUNKERSGEST está diseñado para vender como **Software as a Service** a empresas de bunkering:

- **Plan Básico**: 5 usuarios, 100 operaciones/mes
- **Plan Profesional**: 20 usuarios, operaciones ilimitadas
- **Plan Enterprise**: Usuarios ilimitados, integración ERP, soporte 24/7

---

## 📞 Soporte

Para reportar bugs o solicitar features, abre un **Issue** en GitHub:
https://github.com/projectoqbs/bunkersgest/issues

---

## 📄 Licencia

MIT © 2026 Carlos Caro

---

## 🙏 Créditos

- Desarrollado independientemente como proyecto propio
- Inspirado en operaciones reales de Quality Bunkers Supply S.A.S. (QBS)
- Calculadora ASTM Tabla 6B implementada según estándares internacionales
