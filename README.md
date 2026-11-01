# Casa al día

Web app personal para gestionar productos del hogar, comparar precios entre tus tiendas y no pasar por alto renovaciones de seguros y suscripciones. Está en español, pensada primero para móvil y no usa IA.

## Cómo abrirla

- **iPhone y Mac (recomendado):** abre en Safari la página privada de claude.ai https://claude.ai/artifact/RhRADjNsfwwsEduc5UWWmW con tu sesión de Claude iniciada. En el iPhone puedes añadirla a la pantalla de inicio desde el botón Compartir → «Añadir a pantalla de inicio».
- **Mac, sin claude.ai:** abre `dist/casa-al-dia.html` con doble clic. Es el mismo programa en un único archivo. Sus datos son **distintos** de los de la página de claude.ai, porque cada navegador y cada dirección guardan sus propios datos. Desde aquí sí se puede descargar el archivo de calendario `.ics`.

## Dónde están tus datos

- Se guardan en el almacenamiento del navegador (IndexedDB) de cada dispositivo. **No se sincronizan** entre el Mac y el iPhone.
- Se pierden si borras los datos del sitio en el navegador o si el sistema los elimina. **Haz respaldos:** Ajustes → «Exportar respaldo» genera un `.json` con los datos y las fotos. Para recuperarlos, Ajustes → «Importar respaldo»: la app comprueba el archivo y te pide confirmación antes de sustituir nada.
- Puedes usar un respaldo para pasar los datos de un dispositivo a otro, pero no es una sincronización: se sustituye todo.
- Ningún dato real ni ninguna foto se suben a GitHub. Los datos de demostración están escritos en el código, marcados como DEMO, y se borran desde el aviso morado o desde Ajustes sin tocar tus registros.

## Qué incluye (versión A)

- **Hoy:** urgencias (vencido, hoy o mañana), los próximos 7 días, lo que aparece más adelante dentro de tus márgenes de aviso, la lista de compra, las cancelaciones pendientes de confirmar y los datos por completar.
- **Productos:** foto opcional (comprimida a JPEG de 1024 px como máximo), marca, categoría, envase y enlace. También permite archivar y eliminar.
- **Existencias, separadas del producto y de los precios:**
  - Previsión por «cantidad y consumo diario» (con conversión g↔kg y ml↔l) o por «me dura X días desde…». También puede no tener estimación.
  - «Registrar compra» suma envases de reserva cerrados y **no** reinicia el envase abierto.
  - «Empezar envase» reinicia la previsión del abierto y, si quieres, gasta una reserva.
  - «Corregir existencias» cambia los datos sin registrar ninguna compra.
- **Precios:** historial por tienda y formato con fecha, precio por kg, l o unidad, y modo «Guardar y añadir otro», que mantiene la tienda. Las promociones se guardan como nota y no se calculan.
- **Compra:**
  - Lista sin duplicados: si repites un artículo, te ofrece sustituir o sumar la cantidad.
  - Para cada artículo calcula la «mejor opción entre tus precios registrados», es decir, el menor desembolso en envases completos.
  - Agrupa por tienda con subtotales y marca el total como **parcial** si a algún artículo le faltan datos.
  - Al marcar un artículo como comprado puedes registrar la compra, y solo se suma una vez.
- **Renovaciones:**
  - Fecha de cobro y de renovación por separado, renovación automática (sí, no o desconocida) y fecha límite para cancelar. Si no la indicas, aparece «Pendiente de comprobar».
  - Avisos configurables antes del límite y antes del cobro.
  - Cinco estados que solo cambias tú.
  - Botón manual «Ya se cobró: pasar al siguiente cobro», que maneja bien los meses cortos y los años bisiestos.
  - Coste anual estimado.

## Limitaciones conocidas

- Los avisos solo se ven **al abrir la app**. No hay notificaciones con la app cerrada.
- Calendario `.ics`: funciona en la versión en archivo del Mac. **Dentro de claude.ai no se puede descargar**, porque la plataforma no permite archivos `.ics`.
  - Para pasarlo al iPhone, envíatelo por AirDrop o por correo y ábrelo: el iPhone te ofrecerá añadir los eventos.
  - Exportar no sincroniza. Si editas una renovación, el evento importado no cambia.
  - Volver a importar puede duplicar eventos. Te recomiendo importarlos en un calendario propio, «Casa al día», y borrarlo entero antes de reimportar.
  - Que suene el aviso depende de los ajustes de tu calendario.
- La comparación de precios usa un solo formato por artículo: no mezcla, por ejemplo, un saco grande con uno pequeño.

## Pendiente: versión B

1. Alternativas similares aceptadas expresamente (por ejemplo, detergentes sí, pienso de Ginger no) y comparación por lavado o dosis.
2. Optimización de la cesta: una tienda frente a dos como máximo, incluir o excluir tiendas, umbral mínimo de ahorro y sin declarar ganadora una cesta incompleta.
3. Promociones calculadas: precio rebajado, ofertas por cantidad, tarjeta de socio, compra mínima y vigencia.
4. Precios antiguos: umbral configurable y opción de excluirlos.
5. Renovaciones avanzadas: preaviso confirmado → fecha límite calculada, varios avisos, justificantes y seguimiento de la cancelación.
6. Ajustes temporales de consumo (invitados, vacaciones).

## Visión futura (no implementada)

- Cuenta compartida con Mónica y sincronización: necesita un servidor con usuarios y base de datos (por ejemplo, Supabase o Firebase) y un alojamiento propio.
- Tareas domésticas recurrentes con responsables.
- Resumen semanal y avisos urgentes por email o push: necesitan un servidor que envíe los mensajes aunque la app esté cerrada.
- Devoluciones, garantías y justificantes; importación de tickets, facturas y correos.
- Reconocimiento de fotos y códigos de barras; comparación de precios online.
- Preferencias y alternativas de productos; IA integrada si demuestra ser útil.

## Para desarrolladores

Sin dependencias. Estructura:

- `src/logic.js`: cálculos puros.
- `src/app.js`: interfaz.
- `src/styles.css` y `src/index.html`.

Comandos:

```bash
node build.js                     # genera dist/casa-al-dia.html
node --test test/*.test.js        # pruebas de cálculo
python3 -m http.server 8765 --directory dist &
node test/e2e.js                  # recorrido completo en Chromium (tamaño iPhone 13), requiere Playwright
```

El dinero se guarda en céntimos enteros. Las fechas son cadenas `AAAA-MM-DD` y «hoy» se calcula en Europe/Madrid.
