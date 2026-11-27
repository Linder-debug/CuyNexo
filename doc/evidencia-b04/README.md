# B04 · Recuperación tras perder la respuesta del envío

Estado de G2 en esta revisión: B04 está preparado y reproducido con un ledger simulado. Falta una ejecución autorizada en Stellar testnet y el contraste del estado en la vista de T05. También se conserva el criterio de B03 del [plan v0.3](../1-CuyNexo_Plan_y_Especificacion_v0.3.pdf), que exige comprobar el rechazo del ledger ante un sobre sin la firma requerida.

## Qué verifica el escenario

Se usan cuatro cuentas efímeras, cuatro consentimientos y las dos firmas del caso base. El primer proceso solicita dos envíos concurrentes mediante dos conexiones al mismo SQLite. Tras obtener una respuesta exitosa de su transporte, el adaptador de prueba la descarta e impide las consultas iniciales para preservar la ventana de incertidumbre. Ambas solicitudes conservan el mismo hash en `RECONCILING`. Un segundo proceso reabre SQLite y consulta. Ese proceso carece de una función de envío y usa las cuentas públicas guardadas.

| Evidencia | Criterio de aceptación |
|---|---|
| Registro del cliente | Dos solicitudes concurrentes, una sola llamada al transporte de envío, pérdida inyectada después de que respondió y dos estados `RECONCILING`. |
| Reinicio | Proceso distinto, mismo hash en SQLite y cero envíos desde el proceso de recuperación. Sin confirmación, la salida mantiene `RECONCILING` y devuelve código 3. |
| Liquidación | El hash recuperado contiene exactamente A→C 20, A→D 30 y B→D 10 XLM. |
| Ausencia de repetición | El historial de la cuenta fuente A desde la secuencia inicial contiene únicamente el hash recuperado. La secuencia avanza en uno y los deltas de las cuatro cuentas coinciden con una sola liquidación. Se separa la comisión de A. |
| Expediente | Se registran hash, direcciones, operaciones, balances, secuencia, ledger, comisión y, para testnet, enlace al explorador. Solo se comparte `evidence.json` revisado. |

El alcance de la comprobación de ausencia de duplicados son las cuentas efímeras de la ronda. Si el historial de la cuenta fuente no cabe en la primera página de 200 registros, el escenario queda incompleto.

## Evidencia local obtenida

[B04-simulado.json](B04-simulado.json) contiene una corrida real del programa **en modo offline**. El proceso de envío y el de recuperación fueron distintos. El ledger, los balances y la confirmación de ese hash son simulados. El hash identifica un sobre sintético y el campo del explorador es nulo. La suite conservó las 41 pruebas previas y pasó **44 pruebas** en total, incluidas la recuperación entre procesos, la ausencia temporal de confirmación, el rechazo de un historial duplicado y las guardas de ejecución.

```sh
mkdir -p evidence/b04
npm --offline run testnet:b04 -- start evidence/b04/local-01 --offline
npm --offline run testnet:b04 -- recover evidence/b04/local-01 --offline
npm --offline test
```

El directorio final debe ser nuevo para la fase `start`. Para recuperar un intento, se usa siempre el mismo directorio. Los archivos SQLite y el registro interno del ledger simulado pueden contener el sobre firmado y se mantienen locales, fuera de Git. Las claves se generan en memoria.

## Corrida en testnet preparada

Comandos para una ejecución futura autorizada. Cada fase inicia un proceso distinto. Una respuesta exitosa del SDK se descartará deliberadamente en el cliente y el proceso de recuperación comprobará el hash directamente con Horizon. Si el SDK devuelve un error antes de recibir una respuesta exitosa, se puede conciliar el hash guardado, pero el expediente queda incompleto para el criterio de pérdida inyectada. Ante un error o un resultado pendiente, usar `recover` con el directorio original. Ejecutar `start` en otro directorio crearía otro caso con cuentas nuevas.

```sh
mkdir -p evidence/b04
npm run testnet:b04 -- start evidence/b04/testnet-01 --execute-testnet
npm run testnet:b04 -- recover evidence/b04/testnet-01 --execute-testnet
```

El expediente solo se etiqueta `testnet-verified` si se observan la pérdida inyectada, el reinicio y todas las verificaciones de ledger, balances y unicidad. Esta revisión no ejecutó los comandos de testnet. La etiqueta cubre la parte del escenario comprobable por el script, mientras el contraste en la interfaz sigue pendiente.
