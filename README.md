# CuyNexo

Prototipo de compensación multilateral de deudas entre pequeñas empresas, preparado para Stellar Codember Perú 2026.

> Estado de esta rama: **neteo, rondas en SQLite, pagos Stellar clásicos y recuperación por hash validados localmente**. B01 y B02 cuentan con evidencia histórica. La verificación de B04 en testnet sigue pendiente.

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

TypeScript, SQLite, una ronda activa por instalación local con datos sintéticos y liquidación clásica mediante Horizon testnet. El [registro de decisiones](decisions.md) detalla el estado de cada etapa y cómo se revisa este bloque.

## Documentación

- [Plan, presentación e infografía de referencia](doc/README.md). Materiales del 22 de noviembre de 2026, con notas de estado y copia del plan sin enlaces privados.

- [Especificación inicial](spec.md)
- [Decisiones y límites](decisions.md)
- El backlog se mantiene en los issues del repositorio, sin asignaciones iniciales.

- [Arquitectura](doc/arquitectura.md) y [diagrama Mermaid](doc/diagrama-arquitectura.md).

## Ejecución y evidencia

Con Node.js 22.13.0 o superior y el compilador del archivo de bloqueo ya instalado:

```sh
npm test
npm run demo:neteo
```

Las pruebas y la demo se ejecutan localmente con datos sintéticos. Para preparar dependencias en un entorno sin red, `npm ci --offline --ignore-scripts --no-audit --no-fund` requiere que las dependencias fijadas en `package-lock.json` estén en la caché de npm. La demo imprime saldos, pagos y totales en unidades mínimas. Consulta los [resultados A01–A03](doc/resultados-neteo-a01-a03.md), los [resultados T02](doc/resultados-t02.md) la [validación T03](doc/resultados-t03.md) y los [resultados T04](doc/resultados-t04.md).

## Seguridad y publicación

Solo documentación revisada y datos sintéticos. No subir semillas o claves, incluso de testnet, tokens, archivos `.env`, bases de datos locales, datos empresariales reales, capturas privadas ni transacciones firmadas que aún puedan ejecutarse. La copia revisada del plan en `doc` excluye enlaces privados. Los originales de Drive se conservan sin cambios; las conversaciones de trabajo y los materiales privados relacionados no se publican aquí.

## Autoría, IA y licencia

La documentación inicial se preparó con asistencia de IA a partir del plan de CuyNexo y de una revisión técnica. No se ha incorporado código previo ni de terceros en esta inicialización. Cualquier reutilización futura deberá declararse con su origen y licencia.

La licencia está pendiente de acuerdo del equipo; no se concede una licencia abierta por el solo hecho de que el repositorio sea visible. Los integrantes y sus aportes se documentarán tras confirmar el reparto.

## Hitos del evento

Según las [bases de Codember](https://stellar.mintedinpe.com/codember/bases), el registro del repositorio en el Hub vence el 25 de noviembre de 2026 a las 23:59 y la entrega final el 4 de diciembre de 2026 a las 23:59, hora de Lima. Crear este repositorio **no equivale a registrarlo en el Hub**. No se afirma que el checkpoint ya esté completado.
