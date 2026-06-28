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
# chalendar
