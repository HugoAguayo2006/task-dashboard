# Conexion con Canvas Tec

Tu escuela usa Canvas en:

```env
CANVAS_BASE_URL=https://experiencia21.tec.mx
```

La app ya esta preparada para conectarse de forma segura por medio de:

```text
/api/canvas/calendar-events
```

Esa funcion serverless lee el token desde el servidor y nunca lo manda al navegador.

## Cuando tengas el token

1. Copia `.env.example` a `.env.local`.
2. Deja estos valores:

```env
CANVAS_BASE_URL=https://experiencia21.tec.mx
CANVAS_ACCESS_TOKEN=pega_aqui_el_token_que_te_de_el_tec
```

3. Para probar localmente la API de Canvas, usa Vercel Dev:

```bash
npm run dev:vercel
```

4. En produccion, agrega las mismas variables en Vercel:

```env
CANVAS_BASE_URL=https://experiencia21.tec.mx
CANVAS_ACCESS_TOKEN=pega_aqui_el_token_que_te_de_el_tec
```

No uses `VITE_CANVAS_ACCESS_TOKEN`. Las variables `VITE_*` se publican en el JavaScript del navegador.

## Permisos que necesita el token

Para esta app basta con permisos de lectura para calendario/tareas de Canvas. No necesita permisos para modificar cursos, calificaciones ni informacion administrativa.

La app consulta:

```text
GET /api/v1/calendar_events?type=assignment
GET /api/v1/calendar_events?type=event
```

## Mensaje para mandar al Tec

Asunto: Solicitud de token de acceso de Canvas para integracion personal de calendario

Hola, buen dia.

Estoy desarrollando una app personal de organizacion academica para consultar mis tareas y eventos de Canvas desde el dashboard. En mi cuenta de Canvas, al intentar crear un token de acceso personal, aparece el mensaje de que los administradores limitaron la capacidad de generar tokens y que debo solicitarlo con ustedes.

La integracion solo necesita acceso de lectura para consultar mis eventos y tareas de Canvas, especificamente el endpoint de calendario:

```text
GET /api/v1/calendar_events
```

El dominio de Canvas que usaria es:

```text
https://experiencia21.tec.mx
```

No necesito permisos para modificar tareas, cursos, calificaciones ni datos de otros usuarios. Solo busco sincronizar mis propias actividades y fechas limite en una agenda personal.

Me podrian apoyar generando un token de acceso para mi usuario, o indicarme el proceso correcto para solicitar una integracion OAuth/Developer Key con permisos de solo lectura?

Gracias.

Saludos,
Hugo Aguayo
