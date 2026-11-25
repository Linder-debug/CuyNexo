# T06 · Expediente A/B e informe de pruebas SDD

Base reproducida: `b84f9eaf` en `dev/a01-a03-motor-neteo`. Referencia de alcance: [plan v0.3](../1-CuyNexo_Plan_y_Especificacion_v0.3.pdf). La corrida T06 usa la suite sin cambios. Los resultados de Stellar proceden de los expedientes archivados de T04.

| Origen | Qué se comprobó en T06 |
|---|---|
| **Local** | Compilación TypeScript, 54 pruebas, salida del neteo y recorrido HTTP de B04. Se usó Node.js 24.22.3, npm 11.19.1, TypeScript 5.9.3 y Stellar SDK 16.4.1. |
| **Testnet archivada** | Lectura de los cinco JSON de T04 y trazabilidad a sus hashes y resultados reportados. T06 no volvió a consultar la red ni envió transacciones. Los expedientes anteriores de [T03](../evidencia-t03/registro-ejecuciones.md) quedan como historial de otras corridas. |
| **Simulación** | La salida B05 se regeneró localmente y coincide con [B05.json](../evidencia-t05/B05.json). B04 también tiene una [corrida separada con ledger simulado](../evidencia-b04/B04-simulado.json). En el B04 de testnet, el descarte de la respuesta se inyectó en el cliente y la liquidación sí ocurrió en testnet. |

Se reprodujo desde un árbol limpio de la base con las dependencias ya instaladas. La instalación desde cero con `npm ci --offline` quedó bloqueada porque la caché de este entorno carecía del paquete `undici-types@6.21.0`. El [README](../../README.md#reproducción-local) indica cómo preparar las dependencias fijadas por el lockfile.

## Trazabilidad de requisitos

| Requisito y tarea | Prueba y resultado | Evidencia y límite |
|---|---|---|
| **R01 · T01**. Importes exactos y conservación de saldos | **A01–A03**. Diez tests locales aprobados. Cubren ejemplos, neto cero, 729 grafos exhaustivos y 1 000 grafos con semilla fija. | [Tests de neteo](../../test/netting.test.mjs) · [Resultados A](../resultados-neteo-a01-a03.md). Datos sintéticos. El 81,25 % mide volumen del caso 320→60. |
| **R02 · T02**. Misma versión, congelada y unánime | **B03 local**. SQLite conserva estado e historial al reabrir. Rechazo, cambio o vencimiento bloquean la versión o el uso de consentimientos previos. T03 verifica consentimientos Ed25519 de la versión. | [Acuerdos](../../test/agreements.test.mjs) · [Adapter clásico](../../test/stellar-classic.test.mjs). La aplicación verifica a A–D. El ledger verifica la autorización de las cuentas fuente. |
| **R03 · T03**. Solo operaciones autorizadas, en conjunto | **B01–B03**. Localmente se verifica el cuerpo y se rechazan firmas ausentes o alteraciones. En testnet archivada, B01 aplica 3/3, B02 aplica 0/3 y B03 registra los rechazos esperados. | [Casos B](#expediente-b). Pruebas con XLM de testnet, cuentas efímeras y un fixture. La no inclusión de B03 es una observación acotada al sondeo. |
| **R04 · T04**. Recuperar por hash sin duplicar la liquidación | **B04**. Concurrencia, reinicio, ausencia de confirmación y evidencia discordante cubiertos en local. La corrida testnet archivada registró un único envío en dos solicitudes y recuperación del mismo hash. | [Coordinador](../../test/settlement-coordinator.test.mjs) · [B04 local](../../test/stellar-b04.test.mjs) · [B04 testnet](../evidencia-t04/B04.json). Alcance de unicidad: misma base SQLite e intento, con el historial de la cuenta fuente efímera en la prueba de red. |
| **R05 · T05**. Revisar y explicar el resultado | **B05 y revisión interna**. La vista y B05 se reprodujeron. Linder reportó revisión visual de los cuatro apartados y los estados de resultado antes de incorporar T05. | [Tests de la vista y B05](../../test/t05.test.mjs) · [B05](../evidencia-t05/README.md) · [Guion de comprensión](../evidencia-t05/comprension.md). Quedan pendientes la prueba con personas y las mediciones ausentes. |
| **R06 · T06**. Reproducir y presentar | **G4**. README, expediente, guion de hasta 3:00 y lista de capturas preparados. La suite íntegra pasó 54/54. | [README](../../README.md) · [Demo y capturas](demo.md). Las capturas locales y públicas del explorador ya se generaron. Quedan pendientes su incorporación al repositorio, el video y la revisión independiente. G4 queda abierto. |

## Expediente A

| Caso | Prueba y resultado local | Evidencia y límite |
|---|---|---|
| **A01 · Ejemplos** | 230→50, 320→60 y ciclo con neto cero y lista residual vacía. En 320→60, saldos A −50, B −10, C +20, D +40. El caso de neto cero en SQLite exige unanimidad y bloquea la preparación de un envío. | [Fixtures](../../fixtures/) · [Tests del motor](../../test/netting.test.mjs) · [Tests de acuerdos](../../test/agreements.test.mjs). Importes del ejercicio sintético. |
| **A02 · Exhaustiva** | 729 grafos de tres empresas, seis aristas con valores 0, 1, 2. Se comprobaron conservación por empresa, suma cero, pagos positivos y determinismo ante reordenamiento. | [Tests del motor](../../test/netting.test.mjs). Universo acotado a esa enumeración. |
| **A03 · Aleatoria y límites** | 1 000 grafos de 3 a 8 empresas, semilla `0xc0de2026`. Cobertura de entrada vacía, desconexión, participantes aislados, duplicados, entradas inválidas y frontera de importe residual. | [Resultados A](../resultados-neteo-a01-a03.md) · [Tests del motor](../../test/netting.test.mjs). Casuística generada y regresiones de frontera. |

## Expediente B

| Caso | Prueba y resultado | Evidencia y límites |
|---|---|---|
| **B01 · Éxito** | **Testnet archivada.** Un hash aplicó A→C 20, A→D 30, B→D 10 XLM. A pagó además 300 stroops en el ledger 5922890. **Local:** validación Ed25519, cuerpo, consulta por hash y serialización de evidencia. | [B01.json](../evidencia-t04/B01.json) · [Validación clásica](../../test/stellar-classic.test.mjs) · [Consulta Horizon interceptada](../../test/horizon-settlement.test.mjs). La comprobación de una persona revisora independiente queda pendiente. |
| **B02 · Última operación fallida** | **Testnet archivada.** `tx_failed` con `op_underfunded` en el pago de B. Ledger 5922896, 0/3 pagos aplicados. A avanzó una secuencia y pagó 300 stroops. **Local:** el escritor conserva códigos y estado de las operaciones. | [B02.json](../evidencia-t04/B02.json) · [Tests de evidencia](../../test/testnet-evidence.test.mjs). Los `op_success` previos del resultado no representan pagos efectivos. La comisión corresponde a esa corrida. |
| **B03 · Autorización y versión** | **Local:** rechazo de C, firma faltante, cambios de destino, monto o vigencia, invalidación de versión y vencimiento. **Testnet archivada:** firma faltante de B dio `tx_failed` y `op_bad_auth` en la tercera operación. El sobre vencido dio `tx_too_late`. | [Firma faltante](../evidencia-t04/B03-firma-faltante.json) · [Sobre vencido](../evidencia-t04/B03-sobre-vencido.json) · [Tests del rechazo](../../test/stellar-b03.test.mjs) · [Dictamen B03](../evidencia-b03/README.md). El hash no se observó durante el sondeo. En ese intervalo, los balances y secuencias registrados no cambiaron. Una afirmación definitiva necesitaría cobertura histórica más allá de la vigencia. |
| **B04 · Recuperación** | **Testnet archivada:** 2 solicitudes concurrentes, 1 envío y descarte de la respuesta exitosa del lado cliente. Tras el reinicio, otro proceso recuperó `SETTLED` por el mismo hash, con un único hash en el historial comprobado de A. **Local:** el simulador y la vista distinguen `RECONCILING` de `SETTLED`. | [B04.json](../evidencia-t04/B04.json) · [B04 simulado](../evidencia-b04/B04-simulado.json) · [Test de la vista](../../test/t05.test.mjs). La UI reproduce el estado archivado o lee SQLite. La vista no consulta testnet. La pérdida se inyectó en el cliente. |
| **B05 · Comparación** | **Testnet archivada y simulación separada.** Éxito: ambos aplican 3/3. Si falla B: B02 aplica 0/3 y las transferencias independientes simuladas 2/3, con +20 XLM para C. Se contrastan 4 consentimientos de ronda, 2 firmas y 1 envío con 3 autorizaciones individuales y 3 envíos en el modelo. | [B05.json](../evidencia-t05/B05.json) · [Decisión comparativa y dependencias](../evidencia-t05/README.md#recuperación-dependencias-y-coordinación) · [Test B05](../../test/t05.test.mjs). Tiempos envío→confirmación sin medir. Comisiones del canal independiente sin modelar. Coordinación humana y adopción sin medir. |

## Puertas y pendientes de entrega

- **G0:** autorización de implementación de Linder del 24 de noviembre de 2026 para el plan v0.3 sin recortes. Revisión formal G0 sin cierre acreditado en la documentación disponible.
- **G1:** evidencia A reproducida en local. **G2:** expediente B01–B04 archivado, incluidas la reversión de los pagos B02 y la recuperación B04. El contraste técnico de la UI se reprodujo en T05 y T06.
- **G3:** el expediente muestra una ventaja acotada a la necesidad de liquidar en conjunto. La decisión de valor de producto sigue abierta. Los tiempos envío→confirmación carecen de medición y las comisiones del canal independiente no se modelaron.
- **G4:** quedan pendientes incorporar las capturas ya generadas, preparar el video de hasta tres minutos y completar la revisión independiente del expediente sin depender de Gonza. La comprensión con personas sigue pendiente. La licencia sigue pendiente de acuerdo. Linder conserva la decisión de entrega. [Controles y revisión](gobernanza.md)
