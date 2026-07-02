# Chalendar

Aplicación web en React + Vite para organizar tareas estudiantiles manuales y tareas/eventos de Canvas LMS en un dashboard personal.

## Desarrollo

```bash
npm install
npm run dev
```

Para probar tambien la funcion serverless de Canvas en local:

```bash
npm run dev:vercel
```

## Persistencia cloud

Chalendar guarda una copia local en `localStorage` y, si configuras Supabase, sincroniza listas y tareas con la nube usando una función serverless:

```text
/api/sync/state
```

1. Crea un proyecto en Supabase.
2. En el SQL Editor, ejecuta [`docs/supabase-schema.sql`](docs/supabase-schema.sql).
3. Configura estas variables privadas en Vercel:

```bash
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key
CHALENDAR_SYNC_ID=default
CHALENDAR_ALLOWED_ORIGINS=https://task-dashboard-flame-beta.vercel.app,http://localhost:5173,http://127.0.0.1:5173
```

No pongas `SUPABASE_SERVICE_ROLE_KEY` como `VITE_*`. Esa llave solo debe vivir en el servidor.

Para que localhost, el dominio y otro despliegue lean las mismas tareas, todos deben usar el mismo `CHALENDAR_SYNC_ID` y apuntar al mismo API de sincronización. En local puedes poner esta variable con la URL publica de tu despliegue en Vercel:

```bash
VITE_SYNC_API_BASE_URL=https://task-dashboard-flame-beta.vercel.app
```

`VITE_SYNC_API_BASE_URL` no es una llave secreta; solo le dice al navegador dónde está `/api/sync/state`. Si la dejas vacía, la app usa el mismo dominio donde está abierta.

## Canvas LMS

La app usa una función serverless compatible con Vercel:

```text
/api/canvas/calendar-events
```

Configura estas variables como privadas en Vercel:

```bash
CANVAS_BASE_URL=https://experiencia21.tec.mx
CANVAS_ACCESS_TOKEN=tu_token_de_canvas
```

No pongas el token real en el frontend. Las variables `VITE_*` quedan embebidas en el bundle del navegador, por eso la integración incluida evita `VITE_CANVAS_ACCESS_TOKEN` y llama a Canvas desde la función serverless.

La guia especifica para Canvas Tec y el mensaje para pedir el token estan en [`docs/CANVAS_TEC.md`](docs/CANVAS_TEC.md).

## Funciones

- Dashboard con tareas próximas, vencidas, manuales, Canvas y resumen por lista.
- Listas/clases con color configurable guardado en `localStorage`.
- Tareas manuales con fecha, hora, prioridad, etiquetas, edición, borrado y completado.
- Vista calendario mensual, semanal y agenda.
- Filtros por lista, fuente, estado, prioridad, texto, vencidas y completadas.
- Tareas de Canvas mezcladas con las manuales, con opción local para revisar u ocultar.
- Diseño oscuro, responsivo y preparado para Vercel.
