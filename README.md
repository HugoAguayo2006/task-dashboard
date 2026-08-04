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

## Gmail y Outlook

La app puede leer tus calendarios externos desde enlaces privados `.ics`. Asi, cuando Gmail u Outlook agregan a su calendario una reunion que te llego por correo, Chalendar la muestra en su vista de calendario.

Configura esta variable privada en Vercel o en `.env.local` si usas `npm run dev:vercel`:

```bash
CHALENDAR_EXTERNAL_CALENDAR_FEEDS='[{"name":"Gmail","url":"https://calendar.google.com/calendar/ical/.../basic.ics","color":"#38bdf8"},{"name":"Outlook","url":"https://outlook.office365.com/owa/calendar/.../calendar.ics","color":"#f97316"}]'
```

Tambien puedes usar una lista simple por lineas:

```text
Gmail|https://calendar.google.com/calendar/ical/.../basic.ics
Outlook|https://outlook.office365.com/owa/calendar/.../calendar.ics
```

Esos links son secretos porque dan lectura a tu calendario. No los pongas como `VITE_*` ni los subas a Git.

## Zoom

Chalendar puede leer las reuniones programadas que hospedas en Zoom mediante una app privada **Server-to-Server OAuth**. En Zoom App Marketplace crea la app, agrega el scope granular `meeting:read:list_meetings:admin`, actívala y configura estas variables privadas en Vercel o en `.env.local`:

```bash
ZOOM_ACCOUNT_ID=tu_account_id
ZOOM_CLIENT_ID=tu_client_id
ZOOM_CLIENT_SECRET=tu_client_secret
ZOOM_USER_ID=tu_correo_de_zoom
```

Las reuniones aparecen en la lista azul **Zoom**, con fecha, hora y enlace para entrar. Las credenciales se usan únicamente en la función serverless y nunca deben llevar el prefijo `VITE_*`.

## Calendario de iPhone

Chalendar tambien puede publicar tus tareas manuales como un calendario `.ics` para suscribirlo en la app Calendario de iPhone:

```text
https://task-dashboard-flame-beta.vercel.app/api/calendar/tasks.ics
```

Si configuras `CHALENDAR_ICS_TOKEN` en Vercel, usa la URL con token:

```text
https://task-dashboard-flame-beta.vercel.app/api/calendar/tasks.ics?token=tu_token
```

En iPhone: Ajustes > Apps > Calendario > Cuentas > Agregar cuenta > Otra > Agregar calendario suscrito. Pega la URL y guarda. El calendario es de solo lectura: los cambios hechos en Chalendar aparecen en iPhone cuando la app Calendario actualiza la suscripción.

## Notificaciones en iPhone

Chalendar funciona como PWA en iPhone/iPad y envía estos recordatorios para tareas manuales pendientes:

- Prioridad alta: a las 8:00 a. m. de su fecha.
- Tareas con hora: 1 día antes, 1 hora antes y a la hora indicada.

Ejecuta de nuevo [`docs/supabase-schema.sql`](docs/supabase-schema.sql) y genera un par de llaves:

```bash
npx web-push generate-vapid-keys
```

Configura `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` y `CRON_SECRET` en Vercel.
El workflow `.github/workflows/send-reminders.yml` ejecuta el evaluador cada cinco minutos en
GitHub Actions. Guarda el mismo `CRON_SECRET` como secreto del repositorio en GitHub.

En iPhone abre el sitio en Safari, elige **Compartir → Añadir a pantalla de inicio**, abre
Chalendar desde el nuevo icono y toca **Activar notificaciones**.

## Funciones

- Dashboard con tareas próximas, vencidas, manuales, Canvas y resumen por lista.
- Listas/clases con color configurable guardado en `localStorage`.
- Tareas manuales con fecha, hora, prioridad, etiquetas, edición, borrado y completado.
- Vista calendario mensual, semanal y agenda.
- Filtros por lista, fuente, estado, prioridad, texto, vencidas y completadas.
- Tareas de Canvas mezcladas con las manuales, con opción local para revisar u ocultar.
- Reuniones de Gmail, Outlook e iPhone mezcladas con el calendario, con opcion local para revisar u ocultar.
- Diseño oscuro, responsivo y preparado para Vercel.
