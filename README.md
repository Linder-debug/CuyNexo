# CuyNexo

Prototipo de compensación multilateral de deudas entre pequeñas empresas, preparado para Stellar Codember Perú 2026. [Repositorio en GitHub](https://github.com/Linder-debug/CuyNexo).

> **Estado para revisión.** La web operativa usa transporte simulado por defecto. Se preparó un transporte optativo hacia Horizon testnet. La integración con el servicio externo y el recorrido completo desde CuyNexo con Varial real quedan pendientes de ejecución. G4 continúa abierto.

## Web operativa y alcance de las evidencias

Desde una terminal privada, con las dependencias fijadas instaladas, ejecuta `npm run p0:web` y abre http://127.0.0.1:8765. El coordinador calcula, prepara y envía; cada empresa usa su propia sesión y wallet. El proveedor Varial se sirve desde el paquete local. El inicio del servidor no consulta Horizon.

| Origen | Qué acredita |
|---|---|
| Simulación local | Cuatro pantallas, consentimientos, firmas separadas, envío simulado, pérdida de respuesta y recuperación por hash. El recorrido automatizado de Chromium usa firmantes de prueba. |
| Wallet real | El operador técnico verificó en laboratorio aislado dos capacidades de Varial 5.53.1: SEP-53 y firmas de A y B sobre el mismo cuerpo. El laboratorio no ejecutó esta web ni envió transacciones. |
| Testnet archivada | B01, B02, B03 y B04 proceden de las corridas históricas documentadas. Los enlaces inferiores identifican transacciones anteriores a esta integración web. |

[Procedimiento por rol, selección de transporte y matriz R01–R06](doc/varial-horizon.md).

## Problema y propuesta

Cuando varias empresas mantienen deudas cruzadas, liquidar cada obligación por separado puede requerir más transferencias y mayor volumen de pagos. CuyNexo propone calcular los saldos netos y preparar una liquidación de ese resultado en Stellar testnet.

El prototipo usará **datos sintéticos declarados**. No se afirma que exista demanda validada ni se usarán fondos reales. La reducción del volumen proviene del neteo, no de blockchain. El aporte de Stellar que se busca demostrar es una liquidación atómica con varios pagadores.

## Alcance completo del P0

- Entre 3 y 8 participantes, con importes exactos y neteo determinista.
- Revisión de una misma versión de la propuesta y cuatro consentimientos en el caso base.
- Construcción de una transacción clásica con tres pagos y dos pagadores en el caso base.
- Reunión de firmas sobre el mismo cuerpo de transacción.
- Envío a Horizon testnet y verificación por hash.
- Persistencia local en SQLite, recuperación por hash sin generar un segundo pago y vista local de revisión.
- Evidencia reproducible, comparación con el flujo convencional, revisión y entrega.

El ejemplo sintético del plan reduce el volumen bruto de 320 a 60 unidades, una reducción del 81,25 %. Es una propiedad de ese ejemplo, **no ahorro monetario validado ni resultado de una prueba on-chain**.

## Decisiones aprobadas

TypeScript, SQLite, una ronda activa por instalación local con datos sintéticos y liquidación clásica mediante Horizon testnet. Linder autorizó implementar el plan v0.3 sin recortes el 24 de noviembre de 2026. La revisión formal G0 queda sin cierre acreditado. El [registro de decisiones](decisions.md) detalla el estado de cada etapa y cómo se revisa este bloque.

## Arquitectura

El motor de neteo en TypeScript calcula los pagos residuales. SQLite guarda el acuerdo, los consentimientos y el intento de liquidación. El coordinador prepara una transacción de Stellar clásico, que firman los pagadores, y consulta su resultado por hash mediante Horizon testnet. La web operativa persiste en un diario específico del transporte. La vista histórica de T05 permite consultar escenarios y diarios en solo lectura. [Arquitectura](doc/arquitectura.md) y [diagrama Mermaid](doc/diagrama-arquitectura.md).

## Documentación

- [Plan, presentación e infografía de referencia](doc/README.md). Materiales del 22 de noviembre de 2026, con notas de estado y copia del plan sin enlaces privados.

- [Especificación inicial](spec.md)
- [Decisiones y límites](decisions.md)
- El backlog se mantiene en los issues del repositorio, sin asignaciones iniciales.

## Reproducción local

Desde la raíz del repositorio, con Node.js **22.13.0 o superior**. La corrida T06 usó Node.js 24.22.3 y npm 11.19.1. Instala las versiones de `package-lock.json` por una de estas dos rutas:

```sh
# Si el registro de npm está disponible
npm ci --ignore-scripts --no-audit --no-fund

# En una máquina sin red, si la caché de npm está completa
npm ci --offline --ignore-scripts --no-audit --no-fund
```

La instalación puede omitirse si el árbol de dependencias fijado ya está instalado. A continuación, la compilación, las pruebas y las demos funcionan localmente:

```sh
npm --offline test
npm --offline run --silent demo:neteo
npm --offline run --silent demo:b05
npm --offline run demo:web
```

- Toda la suite pasó **54 de 54** en T06. El neteo imprime unidades mínimas y en el caso base devuelve `3200000000` brutas y `600000000` residuales.
- B05 imprime JSON comparable con [B05.json](doc/evidencia-t05/B05.json). Los datos de testnet se leen del archivo local y las transferencias independientes se simulan.
- Abre [http://127.0.0.1:4173](http://127.0.0.1:4173). Desde Resultado, alterna [B04 verificando](http://127.0.0.1:4173/?caso=b04-pendiente&empresa=C#resultado) y [B04 recuperado](http://127.0.0.1:4173/?caso=b04-recuperado&empresa=C#resultado) para seguir el mismo hash. Si el puerto está ocupado, inicia con `npm --offline run demo:web -- --port 4174`. Usa Ctrl+C para detenerlo.

## Stellar testnet

CuyNexo usa transacciones de Stellar clásico a través de Horizon. La integración se identifica por las direcciones públicas de las cuentas de prueba y los hashes archivados. Cada caso usó su propio conjunto de cuentas efímeras con XLM de prueba.

| Caso | Ledger | Resultado archivado | Explorador y fuente |
|---|---:|---|---|
| B01 | 5922890 | Éxito. Tres pagos aplicados. | [Transacción en Stellar Expert](https://stellar.expert/explorer/testnet/tx/6052425d894e9d0f5b8708b4982594ee2daeb378b76967796d33a5eae914a803) · [Evidencia JSON](doc/evidencia-t04/B01.json) |
| B02 | 5922896 | Fallo en la última operación. Cero pagos aplicados. La cuenta A pagó la comisión. | [Transacción en Stellar Expert](https://stellar.expert/explorer/testnet/tx/a17b79d73a4ad0420ba1b3d9963cca4f88f510356b85a57b065a586ecb2b0886) · [Evidencia JSON](doc/evidencia-t04/B02.json) |
| B04 | 5922902 | Recuperación tras descartar la respuesta del cliente. Un envío y verificación por el mismo hash. | [Transacción en Stellar Expert](https://stellar.expert/explorer/testnet/tx/f9f35fa7281040f4678ed781ddcb71e56493b665ef82c97e4760649c66b0b8c8) · [Evidencia JSON](doc/evidencia-t04/B04.json) |

| Caso | Cuenta del escenario | Dirección pública en Stellar testnet |
|---|---|---|
| B01 | A | `GDR7FPZGWO53VYT35B3PB7IY2W3HCOZQULL4EC34YVL5N6T36LTCFGLI` |
| B01 | B | `GAZZHMM3FRQ3BG2R7JJMABU7EGO6HK3E56ELBL42UM4ZAOF7FIC4BZIC` |
| B01 | C | `GBUTX4BJTWLIDHJLLGF2CWGP57GJ54RNFOWLZC5ZTTXBTZFGHHPCPRGW` |
| B01 | D | `GATIRPRS2ACSVQ6QY6SIOMGTKQXES2JW55OBNISOEUL6CTM6D4CU3BYU` |
| B02 | A | `GDUUDTWHIZJHX3ACCRNY4HSX5Y3BGC5J2JO2MHE5JCUBRHEAHVX77GF6` |
| B02 | B | `GC5D3QEVLB64RAYPDU62LTZKSYE5MMB5N6LIDT57JUZYL7HZXSD3LKT2` |
| B02 | C | `GC7FPJGAUK66HUXF5G3I77VMRZRE7QRLFFT5A3KTH3HG4NL2XA3LW4EA` |
| B02 | D | `GDRZMYUB3PQAOP6GYVQKM7NWH32GFNJKIPQ7URE6BHOURL5KRXZ6AVFU` |
| B04 | A | `GD2OZL34EACFSLLBDLEM36IFDSQSF57U2VGSLFZ7DCQOUJBVCGPPBLSR` |
| B04 | B | `GC2UERISR34SE44UYQ7JCO74L7UBFFXMSD3HVKVXQCC754KFGX7ILN6L` |
| B04 | C | `GDO3CWTWQ5CMDLKVWNVJDJNGMLUVCIITKVJIKTATWAEV5OBU7YZQ6LJR` |
| B04 | D | `GC5KHBGPPDOW2NUFMTQL4SSOIFZGJ7DGFT4VXFDGUBRTV6PC6XGZDBXF` |

B03 documenta un rechazo por firma faltante y otro por vencimiento. No se observó inclusión durante el sondeo posterior. En B04, la pérdida de la respuesta se indujo del lado cliente tras un envío real en testnet. La vista histórica lee el resultado archivado y B05 simula las transferencias independientes. [Registro de ejecuciones](doc/evidencia-t04/registro-ejecuciones.md) · [Revisión B03](doc/evidencia-b03/README.md).

## Expediente de entrega

- [Expediente A/B e informe de pruebas SDD](doc/evidencia-t06/expediente-sdd.md). Trazabilidad R01–R06, resultados y límites.
- [Guion de demo e inventario de capturas](doc/evidencia-t06/demo.md) y [guion de comprensión](doc/evidencia-t05/comprension.md).
- [Controles de gobernanza y seguridad](doc/evidencia-t06/gobernanza.md).
- [Evidencia testnet archivada B01–B04](doc/evidencia-t04/registro-ejecuciones.md) y [comparación B05](doc/evidencia-t05/README.md).

Quedan pendientes la prueba de comprensión con personas, la revisión independiente sin depender de Gonza, la incorporación de las capturas, el video y el acuerdo de licencia. Los tiempos envío→confirmación carecen de mediciones y las comisiones de las transferencias independientes no se modelaron.

## Seguridad y publicación

Solo documentación revisada y datos sintéticos. No subir semillas o claves, incluso de testnet, tokens, archivos `.env`, bases de datos locales, datos empresariales reales, capturas privadas ni transacciones firmadas que aún puedan ejecutarse. La copia revisada del plan en `doc` excluye enlaces privados. Los originales de Drive se conservan sin cambios; las conversaciones de trabajo y los materiales privados relacionados no se publican aquí.

## Autoría, IA y licencia

- **Único integrante actual:** Linder López Rivera.
- **Aporte histórico:** Gonzalo López (Gonza) propuso evaluar Rust con Python durante la discusión inicial del stack. La contribución corresponde a esa etapa de evaluación.

Se usó IA para apoyar la preparación del plan, la documentación, la implementación y la revisión técnica, según el [registro de decisiones](decisions.md). La inicialización se hizo sin incorporar código propio previo. El proyecto usa dependencias de terceros declaradas en [package.json](package.json), incluido el SDK de Stellar.

**Licencia del proyecto pendiente de definir.** La publicación del repositorio por sí sola no concede una licencia abierta.

## Hitos del evento

El video de demo de hasta tres minutos queda pendiente. La interfaz de revisión se ejecuta en local.

Según la [sección 7 de las bases de Codember](https://stellar.mintedinpe.com/codember/bases#entregables), el registro del repositorio en el Hub vence el 25 de noviembre de 2026 a las 23:59 y la entrega final el 4 de diciembre de 2026 a las 23:59, hora de Lima. Linder confirmó el registro del repositorio para el checkpoint.
