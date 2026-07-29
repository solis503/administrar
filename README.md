# 🚀 FlowStock - Inventario y Punto de Venta

> Sistema de inventario y punto de venta en la nube para cualquier negocio.

## ✨ Características
- ✅ Registro e inicio de sesión con email
- ✅ Multi-tenant (cada usuario ve solo sus datos)
- ✅ Gestión de productos con categorías y unidades
- ✅ Punto de venta con cálculo de vuelto
- ✅ Control de inventario (entradas y salidas)
- ✅ Dashboard con ventas del día y alertas de stock bajo
- ✅ Configuración del negocio (moneda, impuestos)
- ✅ Soporte para recetas (productos que no descuentan stock directo)

## 🛠 Stack Tecnológico
- **Frontend**: Next.js 14 + TypeScript + Tailwind CSS
- **Base de datos**: Supabase (PostgreSQL en la nube)
- **Auth**: Supabase Auth
- **Hosting**: Vercel (gratis)

## 📁 Estructura del Proyecto
```
flowstock/
├── src/
│   ├── app/
│   │   ├── (app)/          ← Páginas con sidebar (protegidas)
│   │   │   ├── layout.tsx   ← Layout con menú lateral
│   │   │   ├── dashboard/   ← Panel principal
│   │   │   ├── products/    ← Gestión de productos
│   │   │   ├── pos/         ← Punto de venta
│   │   │   ├── inventory/   ← Control de inventario
│   │   │   └── settings/    ← Configuración del negocio
│   │   ├── (auth)/          ← Páginas de autenticación
│   │   │   ├── login/       ← Inicio de sesión
│   │   │   └── register/    ← Registro
│   │   ├── layout.tsx       ← Layout raíz
│   │   ├── page.tsx         ← Página de inicio (redirect)
│   │   └── globals.css      ← Estilos globales
│   ├── components/
│   │   └── Sidebar.tsx      ← Menú lateral
│   ├── lib/
│   │   ├── supabase-client.ts  ← Cliente para el navegador
│   │   └── supabase-server.ts  ← Cliente para el servidor
│   └── middleware.ts        ← Protección de rutas
├── supabase-schema.sql      ← SQL para crear tablas en Supabase
├── DEPLOY-GUIDE.md          ← Guía completa de deploy
├── package.json
├── next.config.js
├── tailwind.config.js
├── postcss.config.js
└── tsconfig.json
```

## 🚀 Cómo usar (resumen rápido)

1. Crea proyecto en Supabase
2. Ejecuta `supabase-schema.sql` en el SQL Editor
3. Sube el código a GitHub
4. Importa en Vercel y agrega las variables de entorno
5. ¡Listo!

📖 **Ver `DEPLOY-GUIDE.md` para instrucciones paso a paso**

## 🔐 Variables de Entorno

| Variable | Dónde encontrarla |
|----------|-------------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Settings → API → anon public |

## 📄 Licencia
MIT - Úsalo como quieras
