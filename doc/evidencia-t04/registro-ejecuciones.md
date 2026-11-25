# Registro de ejecuciones testnet T04 (cierre de G2)

Cinco envíos a Stellar testnet ejecutados el 25-nov-2026 con el código vigente post-T04 (rama `dev/a01-a03-motor-neteo`), tras la aprobación puntual del usuario. Todas con cuentas efímeras nuevas (Friendbot, XLM de prueba, sin costo real). No se guardan claves privadas. Los SQLite y sobres firmados quedan fuera de Git.

| # | Escenario | Hash | Ledger | Resultado | Evidencia |
|---|---|---|---|---|---|
| 1 | B01 éxito | 6052425d894e9d0f5b8708b4982594ee2daeb378b76967796d33a5eae914a803 | 5922890 | Exitosa, estado `verified`, comisión 300 stroops, deltas A -50, B -10, C +20, D +40 XLM | B01.json |
| 2 | B02 fondos | a17b79d73a4ad0420ba1b3d9963cca4f88f510356b85a57b065a586ecb2b0886 | 5922896 | `tx_failed` incluida con `op_success`, `op_success`, `op_underfunded`; estado `verified`; solo la comisión de A se movió | B02.json |
| 3 | B03 firma faltante | 4981416e2b63971057b37f25aef51ad88f90a7aa334b1a4d0d9ab81cdaa615c2 | (no incluida) | Rechazada en el envío: `tx_failed` con `op_success`, `op_success`, `op_bad_auth`; hash ausente del ledger, sin comisión ni secuencia consumida ni movimiento | B03-firma-faltante.json |
| 4 | B03 sobre vencido | c4d888727d1c7facaea6a275b98dfa38303e2e1ac4c064926bec15f63bca0bb1 | (no incluida) | Rechazada en el envío: `tx_too_late`; hash ausente del ledger, sin comisión ni secuencia consumida ni movimiento | B03-sobre-vencido.json |
| 5 | B04 respuesta perdida | f9f35fa7281040f4678ed781ddcb71e56493b665ef82c97e4760649c66b0b8c8 | 5922902 | `testnet-verified`: 2 solicitudes concurrentes, 1 solo envío al ledger, respuesta exitosa descartada en el cliente, ambas en `RECONCILING`; proceso distinto recuperó por hash y cerró `SETTLED`; un solo pago, historial de A con único hash | B04.json |

Enlaces de explorador: [B01](https://stellar.expert/explorer/testnet/tx/6052425d894e9d0f5b8708b4982594ee2daeb378b76967796d33a5eae914a803), [B02](https://stellar.expert/explorer/testnet/tx/a17b79d73a4ad0420ba1b3d9963cca4f88f510356b85a57b065a586ecb2b0886), [B04](https://stellar.expert/explorer/testnet/tx/f9f35fa7281040f4678ed781ddcb71e56493b665ef82c97e4760649c66b0b8c8). Las dos de B03 no existen en el ledger por diseño: esa ausencia es parte de la evidencia y se comprobó consultando el hash y las cuentas después del rechazo.

## Corrección respecto a lo previsto

Se esperaba `tx_bad_auth` para el sobre sin la firma de B. Lo observado y verificado: la firma faltante de un origen de pago es un fallo de autorización a nivel operación, por lo que Horizon respondió `tx_failed` con `op_bad_auth` en la tercera operación y **no incluyó** la transacción (sin comisión ni secuencia, comprobado contra la cuenta). Contraste útil: el fallo por fondos (B02, `op_underfunded`) sí queda incluido como transacción fallida con comisión cobrada. La propuesta previa describía ambos rechazos B03 como "rechazo del ledger"; el detalle fino es: rechazo en el envío, sin inclusión.

## Autoría y revisión

`scripts/stellar-b03.mjs` lo escribió Instinct directamente para ejecutar los envíos B03 aprobados (no existía arnés), con la misma disciplina de evidencia pública de B01/B02. Queda pendiente de revisión por ChatGPT, igual que la corrección del script B01/B02 registrada en T03. Los scripts B01, B02 y B04 no se modificaron; ninguna aserción de las pruebas existentes cambió (44/44 siguen pasando).

## Alcance

La "respuesta perdida" de B04 se simula del lado cliente: la red no pierde nada. El contraste de estados en la vista (T05) sigue pendiente y fuera de este alcance.
