# P0 web operativo · simulación local
Base documental 00d76ad. Se conservan la vista histórica y sus instrucciones. La aplicación operativa escucha en loopback y utiliza un diario SQLite exclusivo de simulación.

## Reproducción
Desde la raíz, con Node 24 y npm:

    npm ci
    npm test
    npm run p0:web

Abrir http://127.0.0.1:8765 en el perfil del coordinador. Usar el código de un solo uso impreso en su terminal. En Obligaciones cargar el ejemplo o introducir los datos de 3–8 empresas, calcular, asignar direcciones públicas distintas de prueba y congelar. En cuatro perfiles separados con Varial 5.53.1 en Testnet, identificarse y decidir. El coordinador prepara el cuerpo tras la unanimidad. Los pagadores actualizan su vista y firman. El coordinador actualiza y envía al simulador. C puede actualizar y consultar el resultado por hash. Usar cuentas desechables sin fondos. Mantener las semillas, códigos y sobres fuera de la evidencia.

CUYNEXO_DB selecciona el archivo SQLite. Reiniciar con el mismo archivo conserva la ronda, parciales e intento y requiere identificarse de nuevo. CUYNEXO_SIM admite success (predeterminado), failure, before-send y lost-response. Para ejercicios separados, usar diarios distintos. En before-send consultar y luego retransmitir desde el coordinador; en lost-response basta consultar. El simulador registra recibos por hash y llamadas de transporte por separado. El resultado describe el ejercicio sintético y no acredita balances de una red.

## Verificación
Suite Node: 71/71 en la rama dev/varial-horizon-testnet (66 de la base web más las pruebas de la interfaz y de Varial/testnet). La corrida adicional de Chromium utilizó cinco contextos, claves efímeras y un proveedor de wallet de prueba. Desde las cuatro pantallas se verificaron cuatro consentimientos, dos firmas, respuesta perdida y recuperación por C de 20 XLM.

| Incremento | Criterios cubiertos | Límite |
|---|---|---|
| Motor y adaptador (3e51cc6) | R01–R03: conservación de pruebas del motor, versión ligada al esquema SEP-53, doble verificación y validación de parciales | Los casos históricos conservan su esquema original. |
| Servicio y pantallas (4a8796c) | R01–R05: congelación, identidad, roles, estados, preparación con pagadores variables, persistencia, consulta y retransmisión. La suite cubre casos de 3, 4 y 8 empresas, neto cero, firma ajena, reemplazo y caducidad, concurrencia, ambos puntos de interrupción y discrepancia de recibos | Las ventanas y fallos se inyectan localmente. La unicidad se verifica para la misma base e intento. |
| Regresión y recorrido de navegador | R05–R06: HTTP con sesiones aisladas, acceso directo sujeto a controles, prueba desde las cuatro pantallas e instrucciones reproducibles | La corrida de Chromium sustituye únicamente la wallet por firmantes efímeros. El laboratorio anterior con extensión real es evidencia separada. |

Para repetir la prueba opcional de navegador desde la raíz en Linux compatible:

    npm install --prefix /tmp/cuy-browser --no-save puppeteer-core@25.19.0 @sparticuz/chromium@158.0.0
    CUYNEXO_BROWSER_TOOLS=/tmp/cuy-browser node scripts/verify-operative-browser.mjs

Pendientes: recorrido integrado con Varial real, comprensión con personas, revisión independiente, evidencia visual saneada del recorrido, incorporación de las capturas anteriores, video, licencia y decisión de entrega. Tiempos sin medir y comisiones independientes sin modelar. Los permisos y la fricción de la wallet requieren observación real. En el caso base con sesiones nuevas el diseño comprende cuatro firmas de identificación, cuatro decisiones y dos firmas de pago.

## Interfaz operativa del 27 de noviembre de 2026

La rama de trabajo incorpora la continuación de la integración Varial hasta fdf1e67. La evidencia W01 de la interfaz anterior registra cuatro identificaciones, cuatro aceptaciones, dos firmas de pago y un envío confirmado en testnet. El detalle está en [el registro W01](evidencia-web-wallet/README.md).

El coordinador entra con el código de su terminal privada. Cada ingreso válido genera allí otro código de un uso para el siguiente ingreso. La empresa elige su acceso y se identifica con la cuenta de prueba vinculada. El borrador previo a congelar vive en la pestaña del coordinador. Las decisiones, firmas e intentos de la ronda congelada se recuperan de SQLite. La navegación usa las mismas cuatro etapas en ambos tamaños y consulta el estado al cambiar de etapa, al actualizar y cada diez segundos en la pestaña activa.

En Obligaciones, cargar el ejemplo o indicar de tres a ocho empresas y agregar filas en XLM. Calcular abre Acuerdo. Revisar los importes, vincular las direcciones públicas, elegir la fuente y congelar. Cada empresa decide desde su sesión. Tras la unanimidad el coordinador prepara los pagos en Autorizaciones y cada firmante requerido revisa y firma. En Resultado el coordinador envía y las empresas consultan. El identificador mostrado es el hash del intento persistido. El archivo W01/B05 se consulta dentro de la etapa.

**Reproducción local.** Ejecutar `npm ci`, `npm test` y, para la app, `npm run p0:web`. El modo predeterminado usa el simulador. Para repetir la prueba automatizada de pantalla con las dependencias de navegador descritas arriba:

    CUYNEXO_WIDTH=1440 CUYNEXO_BROWSER_TOOLS=/tmp/cuy-browser node scripts/verify-operative-browser.mjs
    CUYNEXO_WIDTH=390 CUYNEXO_BROWSER_TOOLS=/tmp/cuy-browser node scripts/verify-operative-browser.mjs

La suite Node cubre los controles y las ventanas con datos locales. El arnés Chromium recorre cinco sesiones con claves efímeras, ejercita el error de importe, cancelación, rechazo y sustitución, cuatro aceptaciones, firma de B antes de A y la espera que ve C. Tras la pérdida de respuesta el coordinador sale y vuelve a ver el mismo intento. C consulta, comprueba su efecto simulado de 20 XLM, descarga el expediente y vuelve del archivo. El ancho móvil se prueba en Chromium de escritorio. Los casos de residual cero, vencimientos, fallo conjunto y retransmisión tienen pruebas de lógica separadas. La aprobación visual, la comprensión con personas y la revisión independiente requieren su propia evidencia.
