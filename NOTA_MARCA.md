# Nota de marca: nombre interno vs. nombre público

**Fecha:** 3 de octubre de 2026

## Situación

El asesor de marcas indicó que "PlanIA Digital" probablemente no es registrable ("Digital" es descriptivo). Lo más probable es que la marca pública cambie a **AULIKA**. La decisión final depende de su investigación.

## Regla

**PlanIA es el nombre interno del código y se queda así.** Si la marca cambia, se modifica solo lo que ve el público.

Así trabajan muchas empresas: el nombre interno del proyecto (codename) no tiene que coincidir con la marca comercial.

### NO se renombra (interno)

- La carpeta del proyecto `plania-digital` y el repositorio de GitHub.
- El proyecto de Vercel y el proyecto de Supabase.
- Las tablas, vistas, funciones y buckets de la base de datos.
- Las variables de entorno, los nombres de archivos y componentes, y los nombres de variables y funciones.
- Los comentarios del código que dicen "PlanIA Digital".

Renombrar esto no aporta nada a la educadora y sí puede romper conexiones (despliegue, base de datos, almacenamiento).

### SÍ se cambia (público)

- Los textos visibles en pantallas: menú (Sidebar), encabezados, landing, correos y mensajes.
- El logo, el favicon, el título de la pestaña del navegador y las imágenes para compartir en redes.
- El pie y el encabezado de los Word que se descargan.
- El dominio (plania.digital → el nuevo), con redirección del anterior.
- Los documentos legales: Aviso de Privacidad, Términos y Condiciones y Política de Cookies.
- El perfil de WhatsApp Business, YouTube y redes.
- Los mensajes prellenados de WhatsApp ("…mi membresía de PlanIA Digital…").

### Se queda igual

- **MÍA**, el nombre de la asistente. Es independiente de la marca.

## Cuando llegue el cambio

1. Buscar todos los textos públicos: `grep -rn "PlanIA" app components lib --include=*.tsx --include=*.ts`. Solo se cambian los que aparecen en pantalla, en documentos o en mensajes, no los comentarios.
2. Antes del cambio conviene concentrar el nombre público en un solo archivo (por ejemplo `lib/marca.ts`, con `NOMBRE_MARCA`, `LEMA` y `DOMINIO`). Así el cambio se hace en un solo lugar.
3. Revisar los legales con el asesor antes de publicarlos con el nuevo nombre.
