# T03 · Consentimiento Ed25519 y pagos Stellar clásicos

**Validación local del 24 de noviembre de 2026:** 10 pruebas de T03 aprobadas. Con A01–A03 y T02, 30 aprobadas y 0 fallidas. Los escenarios B01 y B02 en testnet están preparados y pendientes de ejecución. La revisión independiente de Instinct sigue pendiente.

## Flujo implementado

1. Al congelar una versión para Stellar, vincular cada alias a una cuenta pública Ed25519 distinta. Las cuentas forman parte del contenido que queda ligado al hash del acuerdo.
2. Los cuatro participantes del caso base firman por separado su decisión con Ed25519. El mensaje JSON canónico incluye el dominio `codember-consent-v1`, ID de acuerdo, versión, hash, participante y decisión. SQLite conserva la decisión y la firma, y el adaptador vuelve a verificar la unanimidad antes de usar el acuerdo.
3. El adaptador prepara un XDR clásico de XLM con A como fuente de secuencia y comisión. Las operaciones quedan, en orden, **A → C: 20 XLM**, **A → D: 30 XLM**, **B → D: 10 XLM**. El memo hash vincula la transacción con el acuerdo. El tope de comisión se aplica al total de operaciones.
4. A y B firman el mismo cuerpo y la misma red. El adaptador reconstruye el cuerpo esperado para comparar el XDR y exige las firmas de todas sus fuentes. La ventana local termina al llegar a `maxTime`, calculado como el menor entre `settleBy` y cinco minutos desde la preparación, sin redondear el vencimiento hacia arriba.

Las versiones históricas de T02 sin cuentas vinculadas siguen accesibles. Sus votos sintéticos no habilitan el adaptador. La versión preparada y su referencia aún son datos del coordinador en memoria. T04 cubre persistir el intento, resolver respuestas inciertas por hash y evitar el doble envío.

## Reproducción local

Con Node.js 22.13.0 o superior y las dependencias fijadas instaladas:

```sh
npm --offline test
node --check scripts/stellar-testnet.mjs
```

Los [tests T03](../test/stellar-classic.test.mjs) organizan la verificación con un reloj controlado y claves efímeras generadas en memoria. Cubren los cuatro consentimientos, su persistencia al reabrir SQLite, rechazo firmado, ausencia de A o B, firma extra, duplicada o de otra red, manipulación de destino, monto, memo y vigencia, vencimiento exacto y reemplazo de versión. La prueba positiva inspecciona el XDR y las tres operaciones. Las pruebas locales usan datos sintéticos y no conectan a Horizon. La dependencia vigente y la verificación posterior a la migración constan en [decisions.md](../decisions.md).

## Escenarios de testnet preparados

Ejecutar cada comando solo cuando se autorice la prueba correspondiente. Ambos crean cuentas nuevas en Stellar testnet y mantienen las claves en memoria.

| Caso | Comando y comprobación prevista |
|---|---|
| **B01 · Éxito** | `npm run testnet:success -- --execute-testnet`. Financia las cuatro cuentas con Friendbot. El hash incluye tres operaciones y los deltas de pago son A −50, B −10, C +20 y D +40 XLM. La comisión de A se registra aparte. |
| **B02 · Fallo de la última operación** | `npm run testnet:failure -- --execute-testnet`. La preparación crea B con 2 XLM y sin subentradas. La transacción de prueba reúne ambas firmas. Se espera `tx_failed` con `op_underfunded` en la tercera operación, cero deltas de pago y comisión y secuencia contabilizadas por separado. |

Los scripts imprimen el hash antes del envío y contrastan el registro del ledger y los saldos después. Ante una respuesta incierta, se detienen y dejan disponible el hash para investigación. La evidencia observada en testnet, la reconciliación persistida, la vista local, la comparación y la entrega se mantienen en el alcance completo de la v0.3.
