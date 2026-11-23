# CuyNexo

Prototipo de compensación multilateral de deudas entre pequeñas empresas, preparado para Stellar Codember Perú 2026.

> Estado: **en diseño, G0 pendiente**. Este repositorio contiene documentación inicial y un backlog de trabajo. No contiene una aplicación implementada ni evidencia de pruebas en Stellar testnet. El stack y los responsables están pendientes de acuerdo del equipo.

## Problema y propuesta

Cuando varias empresas mantienen deudas cruzadas, liquidar cada obligación por separado puede requerir más transferencias y mayor volumen de pagos. CuyNexo propone calcular los saldos netos y preparar una liquidación de ese resultado en Stellar testnet.

El prototipo usará **datos sintéticos declarados**. No se afirma que exista demanda validada ni se usarán fondos reales. La reducción del volumen proviene del neteo, no de blockchain. El aporte de Stellar que se busca demostrar es una liquidación atómica con varios pagadores.

## Alcance propuesto del P0

- Entre 3 y 8 participantes, con importes exactos y neteo determinista.
- Revisión y consentimiento de una misma versión de la propuesta.
- Construcción de una transacción clásica con tres pagos y dos pagadores en el caso base.
- Reunión de firmas sobre el mismo cuerpo de transacción.
- Envío a Horizon testnet y verificación por hash.
- Recuperación de respuestas perdidas sin generar un segundo pago.

El ejemplo sintético del plan reduce el volumen bruto de 320 a 60 unidades, una reducción del 81,25 %. Es una propiedad de ese ejemplo, **no ahorro monetario validado ni resultado de una prueba on-chain**.

## Decisiones pendientes

G0 debe cerrar alcance, lenguaje, SDK de Stellar clásico, interfaz, persistencia y reparto del trabajo. TypeScript, Rust y Python siguen bajo evaluación; este repositorio no fija ninguno. Soroban no forma parte del P0 salvo justificación y aprobación de un cambio de alcance.

Las funciones a cubrir son producto y aceptación, implementación e integración, y revisión cruzada de evidencia y entrega. No hay responsables asignados ni colaboradores invitados por esta preparación.

## Documentación

- [Especificación inicial](spec.md)
- [Decisiones y límites](decisions.md)
- El backlog se mantiene en los issues del repositorio, sin asignaciones iniciales.

## Ejecución y evidencia

Todavía no hay instrucciones de instalación o ejecución, aplicación desplegada, direcciones de testnet, hashes de prueba ni video demo. Se añadirán con evidencia real después de cerrar G0 y aprobar el desarrollo. La documentación no demuestra por sí sola atomicidad, recuperación ni funcionalidad.

## Seguridad y publicación

Solo documentación revisada y datos sintéticos. No subir semillas o claves, incluso de testnet, tokens, archivos `.env`, bases de datos locales, datos empresariales reales, capturas privadas ni transacciones firmadas que aún puedan ejecutarse. El plan privado íntegro y las conversaciones de trabajo no se publican aquí.

## Autoría, IA y licencia

La documentación inicial se preparó con asistencia de IA a partir del plan de CuyNexo y de una revisión técnica. No se ha incorporado código previo ni de terceros en esta inicialización. Cualquier reutilización futura deberá declararse con su origen y licencia.

La licencia está pendiente de acuerdo del equipo; no se concede una licencia abierta por el solo hecho de que el repositorio sea visible. Los integrantes y sus aportes se documentarán tras confirmar el reparto.

## Hitos del evento

Según las [bases de Codember](https://stellar.mintedinpe.com/codember/bases), el registro del repositorio en el Hub vence el 25 de noviembre de 2026 a las 23:59 y la entrega final el 4 de diciembre de 2026 a las 23:59, hora de Lima. Crear este repositorio **no equivale a registrarlo en el Hub**. No se afirma que el checkpoint ya esté completado.
