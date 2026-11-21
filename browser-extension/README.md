# Sincronizar entregas de Canvas con Chalendar

El feed iCal no incluye el estado de entrega. Esta extensión consulta las entregas desde tu sesión abierta en Canvas y marca las tareas correspondientes como completadas en Chalendar, incluida su vista de calendario. No pide contraseña, autenticador ni token.

## Instalación en Chrome

1. Abre `chrome://extensions` y activa **Modo desarrollador**.
2. Pulsa **Cargar descomprimida** y selecciona esta carpeta `browser-extension`.
3. Abre `https://experiencia21.tec.mx` e inicia sesión normalmente.
4. Abre `https://task-dashboard-flame-beta.vercel.app` en el mismo perfil de Chrome.
5. Pulsa el icono de la extensión. Debe mostrar la hora de la última consulta y el número de entregas detectadas.

La extensión consulta Canvas al abrir la página, cada cinco minutos mientras la pestaña de Canvas esté abierta y al volver a ella. Chalendar recibe los cambios automáticamente cuando está abierto o al abrirlo de nuevo. Las tareas entregadas aparecen en **Completadas** y tachadas en el calendario; sus recordatorios pendientes desaparecen.

Si el icono muestra un error HTTP 401 o 403, Canvas Tec no permitió leer las entregas desde la sesión web. En ese caso se necesita que el Tec habilite acceso de lectura mediante un token o una integración OAuth.

Los identificadores de las entregas se guardan en el almacenamiento local de Chrome y en el almacenamiento local de Chalendar. Esta instalación sincroniza ese perfil de Chrome; otros navegadores y dispositivos no reciben los cambios automáticamente.
