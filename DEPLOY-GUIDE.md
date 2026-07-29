# 🚀 FLOWSTOCK PRO v3 — Guía de Deploy Paso a Paso
## La guía más simple posible. No necesitas saber programar.

---

## 📋 Lo que necesitas (TODO gratis):
- ✅ Un correo de email
- ✅ Un navegador web (Chrome recomendado)
- ✅ Cuenta de GitHub (gratis, la creas en el paso 5)

---

## ⏱️ Tiempo total estimado: 20-30 minutos

---

## PARTE 1: Crear la Base de Datos en Supabase

### Paso 1: Ir a Supabase
1. Abre tu navegador y ve a 👉 **https://supabase.com**
2. Haz clic en el botón verde **"Start your project"**
3. Haz clic en **"Sign in with GitHub"** (botón negro)
4. Si no tienes GitHub, haz clic en "Sign up" y crea una cuenta gratis
5. Autoriza los permisos

### Paso 2: Crear un nuevo proyecto
1. Haz clic en **"New Project"** (botón verde)
2. Llena los campos así:
   - **Organization**: déjalo como está
   - **Project name**: escribe `flowstock`
   - **Database Password**: escribe una contraseña (¡ANÓTALA! podría servirte)
   - **Region**: elige `US East (N. Virginia)` o la más cercana
   - **Pricing Plan**: déjalo en Free
3. Haz clic en **"Create new project"**
4. ⏳ Espera 2-3 minutos mientras se crea

### Paso 3: Ejecutar el SQL (crear las tablas)
1. En el menú izquierdo de Supabase, busca y haz clic en **"SQL Editor"** (icono de código `</>`)
2. Haz clic en **"+ New Query"**
3. Abre el archivo `supabase-schema.sql` que viene con este proyecto
4. **Selecciona TODO el contenido** (Ctrl+A) y **cópialo** (Ctrl+C)
5. **Pégalo** en el editor de Supabase (Ctrl+V)
6. Haz clic en el botón **"Run"** (esquina inferior derecha)
7. Deberías ver: **"Success. No rows returned"** ✅

### Paso 4: Desactivar confirmación de email
1. En el menú izquierdo, haz clic en **"Authentication"** (icono de candado 🔒)
2. Haz clic en **"Providers"**
3. Busca **"Email"** y haz clic en él
4. **DESACTIVA** la opción que dice "Confirm email"
5. Haz clic en **"Save"**

### Paso 5: Copiar tus llaves
1. En el menú izquierdo, haz clic en **"Settings"** (engranaje ⚙️)
2. Haz clic en **"API"**
3. Verás dos cosas IMPORTANTES:
   - **Project URL**: algo como `https://abcdefgh.supabase.co`
   - **anon public key**: una cadena larga que empieza con `eyJ...`
4. **COPIA AMBOS** (los necesitas en el Paso 10)

---

## PARTE 2: Subir tu código a GitHub

### Paso 6: Crear cuenta en GitHub (si no tienes)
1. Ve a 👉 **https://github.com**
2. Haz clic en **"Sign up"**
3. Pon tu email, crea contraseña, elige un nombre de usuario
4. Completa el registro

### Paso 7: Crear un repositorio nuevo
1. Estando en GitHub, haz clic en el **"+"** de arriba a la derecha
2. Haz clic en **"New repository"**
3. Llena así:
   - **Repository name**: `flowstock`
   - Déjalo como **Public** (o Private, tu elección)
   - **NO marques** "Add a README" (déjalo vacío)
4. Haz clic en **"Create repository"**

### Paso 8: Subir los archivos
1. Dentro de tu repo nuevo, haz clic en el link **"uploading an existing file"**
2. Ahora abre la carpeta `flowstock` en tu computadora
3. **Selecciona TODOS los archivos y carpetas** de adentro (NO la carpeta flowstock en sí, sino lo que hay DENTRO de ella)
4. **Arrástralos** a la ventana de GitHub
5. Baja hasta abajo y haz clic en **"Commit changes"**

---

## PARTE 3: Publicar tu app en Vercel

### Paso 9: Ir a Vercel
1. Ve a 👉 **https://vercel.com**
2. Haz clic en **"Sign Up"**
3. Elige **"Continue with GitHub"** (lo más fácil)
4. Autoriza el acceso

### Paso 10: Importar tu proyecto
1. Verás tus repositorios de GitHub
2. Busca **"flowstock"** y haz clic en **"Import"**
3. En la página de configuración, NO cambies nada (detecta Next.js automáticamente)
4. **ANTES de hacer clic en Deploy**, busca la sección **"Environment Variables"**
5. Haz clic en **"Environment Variables"**

### Paso 11: Agregar las variables de entorno
Agrega estas 2 variables (una por una):

**Variable 1:**
- En "Name" escribe: `NEXT_PUBLIC_SUPABASE_URL`
- En "Value" pega: la **Project URL** que copiaste en el Paso 5
- Haz clic en **"Add"**

**Variable 2:**
- En "Name" escribe: `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- En "Value" pega: la **anon public key** que copiaste en el Paso 5
- Haz clic en **"Add"**

### Paso 12: ¡Deploy!
1. Ahora sí, haz clic en **"Deploy"**
2. Espera 2-3 minutos ⏳
3. Cuando termine verás: **"Congratulations! Your project has been deployed."**
4. Tu app estará en una URL como: **`https://flowstock-xxxx.vercel.app`**
5. **¡HAZ CLIC EN ESA URL!** 🎉

---

## PARTE 4: Usar tu app

### Paso 13: Registrarte
1. Abre tu URL de Vercel
2. Verás la pantalla de login
3. Haz clic en **"Regístrate gratis"**
4. Llena:
   - **Nombre del negocio**: el que quieras (ej: "Mi Tiendita")
   - **Email**: tu correo
   - **Contraseña**: mínimo 6 caracteres
5. ¡Listo! Ya estás dentro de tu FlowStock Pro

### Paso 14: Configurar tu negocio
1. Ve a **"Configuración"** en el menú lateral
2. Cambia el nombre del negocio
3. Elige tu moneda ($, €, RD$, etc.)
4. Define el porcentaje de IVA
5. Haz clic en **"💾 Guardar"**

### Paso 15: ¡Empieza a usarlo!
- **📦 Productos**: Agrega tus productos (o impórtalos desde Excel)
- **🍽️ Recetas**: Si tienes restaurante, crea recetas con ingredientes
- **🛒 Punto de Venta**: ¡Empieza a vender!
- **🏷️ Inventario**: Controla entradas y salidas
- **📈 Reportes**: Ve cuánto vendes y tu ganancia
- **🚚 Proveedores**: Registra tus proveedores
- **👥 Clientes**: Agrega clientes y dales puntos de lealtad
- **💸 Gastos**: Registra tus gastos para ver tu ganancia real

---

## 🔄 ¿Cómo actualizar si hay cambios?

Si algún día actualizas el código:
1. Ve a tu repo en GitHub
2. Sube los archivos nuevos (reemplazando los viejos)
3. **Vercel detecta los cambios automáticamente** y hace deploy solo
4. Espera 2 minutos y tu app estará actualizada ✅

---

## ❓ Problemas comunes

| Problema | Solución |
|----------|----------|
| No carga la página | Verifica que las variables de entorno no tengan espacios extra |
| No puedo iniciar sesión | Verifica que desactivaste "Confirm email" (Paso 4) |
| Los datos no se guardan | Verifica que ejecutaste el SQL (Paso 3) |
| Error de "table not found" | El SQL no se ejecutó bien. Ve al SQL Editor y vuelve a ejecutarlo |
| Quiero mi propio dominio | En Vercel ve a Settings → Domains → Agrega tu dominio |

---

## 📞 URLs importantes

| Servicio | URL | Para qué |
|----------|-----|----------|
| **Supabase** | https://supabase.com | Tu base de datos |
| **Vercel** | https://vercel.com | Tu app en internet |
| **GitHub** | https://github.com | Guardar tu código |

---

## 🎉 ¡Felicidades!

Tu FlowStock Pro está funcionando en internet. Puedes acceder desde cualquier dispositivo: computadora, tablet o celular.

**Lo que incluye tu app:**
- ✅ Punto de venta con escáner de códigos de barras
- ✅ Sistema de recetas para restaurantes
- ✅ Control de inventario automático
- ✅ Importar productos desde Excel
- ✅ Reportes con gráficos
- ✅ Gestión de proveedores y órdenes de compra
- ✅ Clientes con programa de lealtad
- ✅ Control de gastos y ganancia real
- ✅ Impresión de tickets
- ✅ Múltiples sucursales
- ✅ Sistema de roles (propietario/gerente/vendedor)
- ✅ Diseño responsive (funciona en celular)
- ✅ Todo en la nube (no necesitas instalar nada)

---

*Creado con ❤️ por FlowStock Pro*
