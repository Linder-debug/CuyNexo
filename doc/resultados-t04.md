# T04 · Intento persistente y reconciliación

Implementación local del [plan v0.3](1-CuyNexo_Plan_y_Especificacion_v0.3.pdf), con el caso sintético de cuatro empresas. El bloque completa la simulación local de B04. El [escenario B04](evidencia-b04/README.md) añade una reproducción local con dos procesos y prepara la comprobación con un envío real. La corrida en testnet y el contraste con la vista de T05 siguen pendientes.

## Persistencia y recuperación

| Situación | Resultado |
|---|---|
| Primera solicitud válida | SQLite confirma `SUBMITTED` con ronda, versión, hash del acuerdo, hash de la transacción, sobre firmado, cantidad de operaciones y vigencia. Solo quien obtiene la reserva inicia el POST. |
| Solicitud repetida o simultánea | El coordinador consulta el hash guardado. Un hash distinto para la misma ronda y versión se rechaza. |
| Pérdida de respuesta, 404, caída o reinicio | El coordinador vuelve a consultar el mismo hash. Mientras falte confirmación mantiene `RECONCILING`. El vencimiento local, por sí solo, conserva ese estado. |
| Evidencia incompatible | Una respuesta con hash, sobre, operaciones o datos de ledger incompatibles conserva `RECONCILING` con `LEDGER_MISMATCH`. |
| Inclusión confirmada | El verificador reconstruye el hash clásico desde el XDR en la red aprobada. Guarda resultado, ledger y comisión. `SETTLED` cierra la ronda y bloquea sus obligaciones para otras rondas en la misma base. El fallo atómico confirmado se registra como `FAILED` y permite preparar una versión nueva con consentimientos nuevos. |

La reserva y la actualización final usan transacciones SQLite. Una ronda con intento activo queda bloqueada frente a cierre o reemplazo y una respuesta tardía no puede revertir un resultado terminal. La garantía cubre el coordinador que comparte el mismo archivo SQLite. Si el proceso se interrumpe después del registro y antes del POST, la recuperación consulta el hash y puede quedar pendiente. Este bloque no automatiza el reenvío del mismo sobre que contempla la v0.3 ni declara `EXPIRED` para intentos sin prueba de cobertura histórica de Horizon.

Los scripts B01 y B02 conservan sus verificaciones de balances y códigos. Cada nueva ejecución crea cuentas efímeras y su propio directorio con `evidence.json` y `settlement.sqlite`. Para recuperar un escenario interrumpido se usa el journal original y el hash impreso. El siguiente comando queda preparado para una ejecución futura autorizada. Solo consulta y guarda el estado de reconciliación.

```sh
npm run testnet:reconcile -- /ruta/al/settlement.sqlite HASH --execute-testnet
```

El comando muestra el estado persistido y devuelve código 3 si sigue en `RECONCILING`. La evidencia pública omite el sobre firmado. SQLite guarda firmas y XDR, sin semillas ni claves privadas, y permanece excluido de Git.

## Resultados locales

`npm --offline test` con Node.js v24.22.3 y SDK 16.4.1, **41 pruebas aprobadas**. Se conservaron las 34 pruebas existentes y se añadieron la regresión del SDK y seis pruebas T04.

| Escenario | Verificación local |
|---|---|
| T03 · consulta por hash | El SDK consulta respuestas exitosas y fallidas en la ruta exacta mediante HTTP interceptado. La prueba falla si se vuelve a invocar `includeFailed()` sobre el detalle. |
| T04 · respuesta perdida y reinicio | Una segunda conexión lee la reserva antes del POST simulado. Tras reabrir SQLite, el 404 mantiene `RECONCILING` incluso después del vencimiento. Una consulta posterior confirma el mismo hash con un solo POST simulado. |
| T04 · concurrencia | Dos coordinadores con conexiones independientes y solicitudes solapadas producen un solo POST. Una respuesta tardía no degrada `SETTLED`. |
| T04 · interrupción antes del POST | La recuperación conserva el hash reservado sin transmitirlo. |
| T04 · discrepancia | Un XDR con otro cuerpo mantiene `LEDGER_MISMATCH`. Un intento alternativo no genera otro envío. |
| T04 · fallo confirmado | Un fallo atómico registra `FAILED` y permite una versión con cero consentimientos previos. |
| T04 · autorización | Una firma faltante impide reservar. Un hash ajeno a SQLite no genera una consulta. |

Se mantuvieron los expedientes previos de [B01 y B02](evidencia-t03/registro-ejecuciones.md). Este bloque no ejecutó testnet. La vista, la comparación, la revisión independiente y la entrega permanecen en el alcance de la v0.3.
