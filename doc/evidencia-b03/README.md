# Revisión B03 · Firma faltante y sobre vencido

**Dictamen.** Los dos expedientes de Instinct son válidos como evidencia histórica de rechazo para B03. No hace falta repetirlos para demostrar los rechazos previstos. La revisión comprobó los archivos y el código adjuntos, con regresiones locales. No volvió a consultar Stellar testnet.

| Caso | Hash reportado | Hallazgo |
|---|---|---|
| Firma de B faltante | `4981416e2b63971057b37f25aef51ad88f90a7aa334b1a4d0d9ab81cdaa615c2` | `tx_failed` con `op_success`, `op_success`, `op_bad_auth`. El script firma con A y deja sin firma la tercera operación, cuya fuente es B. Los primeros dos códigos por operación no demuestran pagos aplicados. |
| Sobre vencido | `c4d888727d1c7facaea6a275b98dfa38303e2e1ac4c064926bec15f63bca0bb1` | `tx_too_late`, sin códigos por operación. El script firma con A y B y fija la vigencia unos cinco minutos en el pasado. El comentario original decía tres minutos. |

En ambos archivos las cuatro direcciones son públicas y distintas, los balances y secuencias antes y después coinciden, y el ledger y el enlace al explorador quedan vacíos. El valor cero de la comisión es coherente con la ausencia de cambios observados. El script original asignó ese cero directamente y no guardó las respuestas ni las marcas temporales del sondeo. Los 404 acotados respaldan «no observado durante el sondeo». Para certificar ausencia definitiva se necesitaría acreditar cobertura de la historia hasta pasada la vigencia del sobre. El hash de la transacción clásica identifica su cuerpo y por sí solo no demuestra qué firmas llevaba el sobre.

El B02 adjunto es un contraste útil. También tiene `tx_failed`, pero reporta `op_underfunded`, inclusión en el ledger 5922896 y una comisión de 300 stroops. La decisión B03 se apoya en los códigos específicos y en lo que observa cada expediente, no en asumir que todo `tx_failed` se comporta igual. Los códigos de resultado corresponden a Stellar Core y Horizon los devuelve con HTTP 400. [Documentación de Horizon](https://developers.stellar.org/docs/data/apis/horizon/api-reference/errors).

Si se exige un expediente con firmas verificadas en el cliente, horario exacto de envío y vencimiento, registro de cada consulta o corroboración independiente de la no inclusión, los dos JSON originales quedan cortos para ese estándar adicional. La nueva versión registra los metadatos de la corrida, pero tampoco declara ausencia definitiva a partir de 404.

## Cambios al script

- Verifica las firmas presentes y los límites de tiempo del sobre. Registra el digest del sobre, los firmantes públicos y el instante de envío. Claves y sobre quedan fuera del expediente.
- Persiste el hash antes del POST y conserva una evidencia incompleta si la corrida se interrumpe. Solo el HTTP 400 con los códigos exactos cuenta como el rechazo esperado. Para dirigir la prueba negativa al POST omite la comprobación de memo del SDK únicamente en las cuentas efímeras de B03.
- Usa el detalle por hash del SDK 16.4.1. Identifica `NotFoundError` por su clase y conserva los tiempos y los estados HTTP observados. Separa un fallo de consulta, una inclusión y la ausencia observada. Los balances y secuencias se conservan como observaciones antes y después.

Las 44 pruebas existentes se mantuvieron. Cinco regresiones nuevas ejecutaron localmente la construcción y las firmas de ambos sobres, el mapeo del HTTP 400 del SDK, los rechazos de otra causa, el timeout, el 404, el hallazgo por hash y el error de consulta. **49 pruebas aprobadas** con `npm --offline test`. El resto de B03, como el rechazo de C y los cambios de destino, monto o vigencia, sigue cubierto por la suite local existente.

Para una eventual nueva corrida autorizada, los comandos son:

```sh
npm run testnet:b03 -- firma --execute-testnet
npm run testnet:b03 -- vencido --execute-testnet
```

Los expedientes históricos conservan su formato original. Estos comandos generarían expedientes nuevos en `evidence/b03/`.
