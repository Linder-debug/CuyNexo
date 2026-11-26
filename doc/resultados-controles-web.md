# Controles web P0 · entrega para revisión

Base 141bd3b en dev/varial-horizon-testnet. W01, archivado en doc/evidencia-web-wallet, acredita un recorrido previo con Varial real. Este bloque se verificó con cuentas efímeras locales y respuestas controladas. Ningún resultado nuevo se atribuye a testnet.

| Punto | Plan e issues | Implementación y comprobación |
|---|---|---|
| Impacto por empresa | R01/R03/R05 · #2, #3, #5 | Desde Acuerdo se ven los pagos, cobros y comisión prevista por empresa. Resultado distingue efectos confirmados, comisión cobrada y datos pendientes. En el fixture A paga 50 más comisión, B paga 10, C recibe 20 y D recibe 40. Node comprueba el pagador y los balances; Chromium ejercita la vista de C. |
| Descargar evidencia | R02/R03/R06 · #3, #5 | Botón autenticado para participantes y coordinador. El informe incluye acuerdo congelado, decisiones con fecha, firmantes de pago registrados, hash y resultado. Puede exportarse una versión incompleta o cancelada. El navegador descarga un JSON y la prueba compara el archivo con la respuesta saneada. |
| Verificación por hash | R03/R04/R05 · #3, #4 | Antes de la primera llamada de envío se leen saldos nativos. El recibo por hash se contrasta con el intento y su cuerpo clásico; el detalle de las operaciones proviene del cuerpo verificado y su aplicación del resultado atómico. Se conserva el importe de comisión del recibo y su pagador. Las observaciones y el tiempo sobreviven a reinicios. El test local usa Horizon sustituido, un saldo ausente y 4500 ms de reloj controlado. |
| Cancelar y distinguir orígenes | R02/R04/R05 · #3, #4, #5 | Solo el coordinador puede cancelar la versión pendiente o aprobada, dentro de una transacción de SQLite y sin reserva previa. Se conserva el historial. Prueba con parcial, reinicio, voto, preparación y envío bloqueados. Chromium cancela por pantalla y continúa con una versión nueva. Cada sección identifica el modo; los enlaces históricos indican su origen. |
| Arrancar la web | R06 · #1, #5 | Se probó CUYNEXO_TRANSPORT=testnet npm run p0:web en una pseudoterminal privada con diario temporal y lectura únicamente de la portada en loopback. El arranque mostró el modo correcto. El test de inicio pasivo sigue comprobando cero inicializaciones de Horizon. |

## Interpretación

- Los importes del JSON se expresan en unidades mínimas salvo amountXlm, indicado explícitamente. Los impactos de pago se presentan por separado de la comisión. Las operaciones de un intento fallido confirmado se marcan sin aplicar; una comisión verificada puede existir aun si se aplicaron cero pagos.
- Un saldo es una observación por cuenta con su fecha. Puede incluir otras operaciones. El simulador no modela saldos absolutos. Un saldo anterior ausente no se reconstruye restando pagos al actual.
- El intervalo mide desde la llamada inicial al transporte hasta la primera confirmación observada por el coordinador. Incluye demoras en consultar y puede incluir un reinicio. No equivale al tiempo de inclusión en un ledger. Un diario anterior puede carecer de la hora de envío o del saldo previo. Un valor desconocido se muestra como «sin dato» y se exporta como null.
- Pendiente: verificar estos controles añadidos con datos de una ejecución testnet futura autorizada. El video y la evaluación final quedan para otro bloque.
