# CuyNexo

Prototipo de compensación multilateral de deudas entre pequeñas empresas, preparado para Stellar Codember Perú 2026.

> Estado de esta rama: **candidato T06 para revisión**. La vista local y B05 son reproducibles. G4 sigue abierto. Las capturas locales y públicas del explorador ya se generaron y quedan por incorporar al repositorio. El video y la revisión independiente siguen pendientes. La prueba de comprensión y la licencia siguen pendientes.

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

## Documentación

- [Plan, presentación e infografía de referencia](doc/README.md). Materiales del 22 de noviembre de 2026, con notas de estado y copia del plan sin enlaces privados.

- [Especificación inicial](spec.md)
- [Decisiones y límites](decisions.md)
- El backlog se mantiene en los issues del repositorio, sin asignaciones iniciales.

- [Arquitectura](doc/arquitectura.md) y [diagrama Mermaid](doc/diagrama-arquitectura.md).

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

## Expediente de entrega

- [Expediente A/B e informe de pruebas SDD](doc/evidencia-t06/expediente-sdd.md). Trazabilidad R01–R06, resultados y límites.
- [Guion de demo e inventario de capturas](doc/evidencia-t06/demo.md) y [guion de comprensión](doc/evidencia-t05/comprension.md).
- [Controles de gobernanza y seguridad](doc/evidencia-t06/gobernanza.md).
- [Evidencia testnet archivada B01–B04](doc/evidencia-t04/registro-ejecuciones.md) y [comparación B05](doc/evidencia-t05/README.md).

Quedan pendientes la prueba de comprensión con personas, la revisión independiente sin depender de Gonza, la incorporación de las capturas, el video y el acuerdo de licencia. Los tiempos envío→confirmación carecen de mediciones y las comisiones de las transferencias independientes no se modelaron.

## Seguridad y publicación

Solo documentación revisada y datos sintéticos. No subir semillas o claves, incluso de testnet, tokens, archivos `.env`, bases de datos locales, datos empresariales reales, capturas privadas ni transacciones firmadas que aún puedan ejecutarse. La copia revisada del plan en `doc` excluye enlaces privados. Los originales de Drive se conservan sin cambios; las conversaciones de trabajo y los materiales privados relacionados no se publican aquí.

## Autoría, IA y licencia

La documentación inicial se preparó con asistencia de IA a partir del plan de CuyNexo y de una revisión técnica. No se ha incorporado código previo ni de terceros en esta inicialización. Cualquier reutilización futura deberá declararse con su origen y licencia.

La licencia está pendiente de acuerdo del equipo; no se concede una licencia abierta por el solo hecho de que el repositorio sea visible. Los integrantes y sus aportes se documentarán tras confirmar el reparto.

## Hitos del evento

Según las [bases de Codember](https://stellar.mintedinpe.com/codember/bases), el registro del repositorio en el Hub vence el 25 de noviembre de 2026 a las 23:59 y la entrega final el 4 de diciembre de 2026 a las 23:59, hora de Lima. Crear este repositorio **no equivale a registrarlo en el Hub**. No se afirma que el checkpoint ya esté completado.
