# UI/UX y adaptación de los paneles

## Dirección

Se conserva el azul de Concepción y la tipografía Inter. La guía `design-taste-frontend` seleccionó **Accent ladder**, semilla `741709629`, con paleta y tipografía existentes: color fuerte en acciones, azul suave para selección y superficies de trabajo claras. No se cambió la identidad ni se incorporaron datos de ejemplo al producto.

## Cambios

- Estilos de navegación compartidos entre administración, almacén y vendedor. Encabezados compactos, controles táctiles de 44 px y menú móvil con cierre visible.
- Menús de administración y almacén: foco dentro del menú al abrir, Escape para cerrar, restauración del foco al botón, navegación oculta fuera del recorrido de teclado y bloqueo de desplazamiento del fondo.
- Idioma español, zoom habilitado, áreas seguras, altura dinámica de pantalla y respeto a movimiento reducido.
- Foco visible y estados de navegación anunciados mediante `aria-current`. Se eliminan las animaciones de entrada de pantallas operativas.
- Dashboard: indicadores sobrios, números tabulares, filas accesibles con teclado y acceso a crear pedidos junto al título. Se retira el botón flotante redundante.
- Usuarios: búsqueda por nombre o usuario, filtros de rol y estado, contador de resultados, indicación de activo/inactivo y accesos a las dos secciones.
- Almacén: mensaje cuando no hay productos disponibles. Ruta: retirada de la estimación fija que no se calculaba a partir de las entregas.

## Verificación

Compilación de producción y pruebas de usuarios en ChromeHeadless. Revisión en navegador de dashboard, usuarios, creación de pedidos, inventario de almacén y ruta, a 390, 768 y 1440 px. Datos simulados interceptados únicamente en el navegador de revisión; sin operaciones en producción. Comprobaciones de desbordamiento, búsqueda, filtros, Escape y restauración del foco.

Las pruebas de tamaño son emulación de escritorio; falta validación en teléfonos físicos y con sus teclados virtuales. Los cambios locales que ya existían en formularios y servicios se conservaron.
