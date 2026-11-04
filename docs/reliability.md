# Correcciones de flujos y programación

- Pedidos, ventas, altas de clientes, inventario y eliminación de pedidos esperan confirmación HTTP. Los datos del formulario se conservan cuando falla la operación; se bloquean envíos repetidos mientras está pendiente.
- Editar un pedido carga una sola instantánea por ID. Los refrescos del listado no sobrescriben el formulario. Se conservan estado, creación, pago y asignaciones existentes.
- La fecha programada se envía y recupera en creación y edición. Las ventas realizadas se registran hoy; los pedidos pendientes del vendedor pueden programarse.
- Cargas de catálogos y pedidos anuncian progreso y errores con reintento. Los listados no muestran un vacío mientras cargan o hay errores. Se renderizan grupos de 40 resultados con identidad estable; esto reduce nodos DOM, no constituye paginación del API.
- Los modales comparten foco inicial, recorrido de Tab, Escape y devolución de foco. Los controles principales tienen foco visible y etiquetas; las tarjetas de ruta muestran dirección y estado escrito.
- La directiva decimal utiliza el documento del elemento para funcionar durante prerenderizado.

## Verificación

- `npm test -- --watch=false --browsers=ChromeHeadless`: pruebas de Angular en navegador.
- `node scripts/test-order-flow.mjs`: pruebas de lógica con respuestas HTTP simuladas (no son pruebas de producción).
- `npm run build`: compilación de producción y prerenderizado.
- Backend: ver `docs/scheduled-deliveries.md` para la migración, compatibilidad y orden de despliegue.

La publicación del frontend/backend y la revisión manual final en dispositivos reales siguen siendo pasos separados.
