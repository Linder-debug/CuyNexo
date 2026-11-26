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
Suite Node: 66/66, incluidas 54 pruebas anteriores y 12 nuevas en test/operative.test.mjs. La corrida adicional de Chromium utilizó cinco contextos, claves efímeras y un proveedor de wallet de prueba. Desde las cuatro pantallas se verificaron cuatro consentimientos, dos firmas, respuesta perdida y recuperación por C de 20 XLM.

| Incremento | Criterios cubiertos | Límite |
|---|---|---|
| Motor y adaptador (3e51cc6) | R01–R03: conservación de pruebas del motor, versión ligada al esquema SEP-53, doble verificación y validación de parciales | Los casos históricos conservan su esquema original. |
| Servicio y pantallas (4a8796c) | R01–R05: congelación, identidad, roles, estados, preparación con pagadores variables, persistencia, consulta y retransmisión. La suite cubre casos de 3, 4 y 8 empresas, neto cero, firma ajena, reemplazo y caducidad, concurrencia, ambos puntos de interrupción y discrepancia de recibos | Las ventanas y fallos se inyectan localmente. La unicidad se verifica para la misma base e intento. |
| Regresión y recorrido de navegador | R05–R06: HTTP con sesiones aisladas, acceso directo sujeto a controles, prueba desde las cuatro pantallas e instrucciones reproducibles | La corrida de Chromium sustituye únicamente la wallet por firmantes efímeros. El laboratorio anterior con extensión real es evidencia separada. |

Para repetir la prueba opcional de navegador desde la raíz en Linux compatible:

    npm install --prefix /tmp/cuy-browser --no-save puppeteer-core@25.19.0 @sparticuz/chromium@158.0.0
    CUYNEXO_BROWSER_TOOLS=/tmp/cuy-browser node scripts/verify-operative-browser.mjs

Pendientes: recorrido integrado con Varial real, comprensión con personas, revisión independiente, evidencia visual saneada del recorrido, incorporación de las capturas anteriores, video, licencia y decisión de entrega. Tiempos sin medir y comisiones independientes sin modelar. Los permisos y la fricción de la wallet requieren observación real. En el caso base con sesiones nuevas el diseño comprende cuatro firmas de identificación, cuatro decisiones y dos firmas de pago.
