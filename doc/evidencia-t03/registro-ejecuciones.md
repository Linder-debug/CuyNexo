# Registro de ejecuciones testnet T03

Todas con cuentas nuevas efímeras (Friendbot, XLM de prueba). No se guardan claves privadas.

| # | Escenario | Hash | Ledger | Resultado | Valida como evidencia |
|---|---|---|---|---|---|
| 1 | B01 éxito | f796e3c84d82af65be8b280d57394e685db8810883f6e82d2cad81f0cac94fea | 5908677 | Transacción exitosa en la red (comisión 300 stroops) | No. El script falló después del envío por un error de API y no registró balances ni evidencia. |
| 2 | B01 éxito | 496e5c6ce2279618c7b1c6edcf1617d813a34f5899c8c2dd4b0885f534c8f2 | 5908687 | Exitosa, estado `verified` | Sí. Ver B01.json |
| 3 | B02 fallo | baf9d6aa89f056cfb06c0b8070371d97fa944442074f4a94b861278c51e9c85a | 5908693 | `tx_failed` con `op_success`, `op_success`, `op_underfunded`, estado `verified` | Sí. Ver B02.json |

Fuente de la ejecución 1: salida de la primera ejecución de `npm run testnet:success -- --execute-testnet` por Instinct (hash impreso antes del envío), contrastada después con Horizon testnet (`successful: true`, ledger 5908677, `fee_charged` 300).

## Corrección posterior al envío

Causa de la ejecución 1: con `@stellar/stellar-sdk` 16.4.1 `transactions().transaction(hash)` ya no tiene `.includeFailed()`. La línea en `scripts/stellar-testnet.mjs` fue corregida quitando esa llamada. Ninguna aserción cambió.

Autoría: esta corrección la hizo Instinct directamente, no ChatGPT, y queda pendiente de revisión por ChatGPT.

## Revisión local de la corrección

Se validó la corrección con el SDK instalado 16.4.1 y el cliente HTTP interceptado. El objeto que devuelve `transactions().transaction(hash)` carece de `includeFailed()`. La prueba de regresión comprueba la consulta exacta por hash para respuestas con `successful: true` y `successful: false`. La prueba usa el mismo helper que invocan los scripts y no contacta testnet. El registro anterior conserva la evidencia histórica reportada por Instinct.
