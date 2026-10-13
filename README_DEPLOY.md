# Control de Inventario de Repuestos — Guía de Despliegue

## Requisitos previos
- Cuenta en [GitHub](https://github.com) (gratis)
- Cuenta en [Vercel](https://vercel.com) (gratis)
- Cuenta en [Neon](https://neon.tech) — base de datos PostgreSQL (gratis)

---

## Paso 1 — Subir este código a GitHub

1. Descarga e instala [GitHub Desktop](https://desktop.github.com/)
2. En GitHub Desktop: `File → Add Local Repository` → selecciona la carpeta `inventario-repuestos`
3. Si dice que no es un repositorio, haz clic en "create a repository"
4. Haz clic en **"Publish repository"** → desmarca "Keep this code private" si quieres (o déjalo privado)
5. Haz clic en **Publish**

---

## Paso 2 — Crear la base de datos en Neon

1. Entra a [neon.tech](https://neon.tech) → "Sign Up" con Google
2. Crea un nuevo proyecto → nombre: `inventario-repuestos`
3. Copia la **Connection string** (DATABASE_URL), la necesitas en el Paso 3

---

## Paso 3 — Desplegar en Vercel

1. Entra a [vercel.com](https://vercel.com) → "Sign Up" con GitHub
2. Haz clic en **"Add New Project"** → selecciona el repositorio `inventario-repuestos`
3. Antes de hacer Deploy, expande **"Environment Variables"** y agrega:

   | Variable | Valor |
   |---|---|
   | `DATABASE_URL` | La URL de Neon del Paso 2 |
   | `NEXTAUTH_SECRET` | Genera en: https://generate-secret.vercel.app/32 |
   | `AUTH_SECRET` | Mismo valor que NEXTAUTH_SECRET |

4. Haz clic en **Deploy** y espera ~3 minutos
5. Vercel te dará la URL de tu app (ej: `https://inventario-repuestos.vercel.app`)

---

## Paso 4 — Restaurar los datos

Usa el archivo `respaldo_inventario_completo.sql` (incluido en el paquete):

```bash
psql "TU_URL_DE_NEON" -f respaldo_inventario_completo.sql
```

Tus datos, usuarios y contraseñas actuales quedan restaurados. No empiezas de cero.

---

## Paso 5 — Actualizar la app móvil

Cambia la URL del servidor en el archivo `src/services/api.ts` de la app móvil:

```typescript
const BASE_URL = 'https://inventario-repuestos.vercel.app'; // ← tu URL de Vercel
```

Luego recompila el APK e instálalo.

---

## Variables de entorno (referencia)

Ver archivo `.env.example` incluido en este proyecto.

---

## Soporte

Si tienes preguntas sobre la configuración, el archivo `.env.example` 
explica cada variable con detalle.
