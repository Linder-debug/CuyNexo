# T06 · Guion de demo e inventario de capturas

Duración objetivo **2:54** y máximo **3:00**. Tiempos estimados, pendientes de ensayo. La demo usa la vista local y los cinco resultados históricos de T04, con el caso B05 separado como simulación. Preparar las pestañas y el material antes de grabar. Los enlaces de explorador identifican los registros históricos. Linder reportó que ya se generaron capturas de las vistas locales y del explorador público. Siguen fuera del repositorio. El video queda pendiente.

| Tiempo | Acción en pantalla | Locución |
|---|---|---|
| 0:00–0:19 | Portada con el logo y pasar a Obligaciones. | Cuatro empresas se deben entre sí. Antes de ordenar pagos, CuyNexo calcula cuánto tendría que transferir cada una si todas acuerdan compensar sus obligaciones. |
| 0:19–0:42 | Mostrar Obligaciones y Acuerdo. Señalar 320, 60 y el saldo de C. | En este caso sintético pasamos de 320 a 60 XLM de volumen. C tiene 20 por recibir. El neteo reduce cuánto se transfiere. Stellar aporta que los tres pagos residuales se liquiden juntos. |
| 0:42–1:05 | Abrir Autorizaciones y seleccionar «Falta la firma de B». | Las cuatro empresas deben consentir la misma versión. Después A y B, que son las cuentas pagadoras, firman el mismo sobre. Aquí falta la firma de B y el envío queda bloqueado. |
| 1:05–1:42 | Pasar por B01 y B02 en Resultado. Mostrar los hashes y los ledgers archivados. | Estos son dos resultados registrados en testnet. En B01 se aplicaron tres pagos. En B02 falló el último, por fondos insuficientes de B. Ninguno de los tres pagos se aplicó. La comisión de A quedó registrada por separado. |
| 1:42–2:15 | Abrir B04 verificando y pasar a recuperado. Señalar el mismo hash. | En B04 descartamos la respuesta del lado cliente después de un envío real en testnet. En la vista, «Verificando» significa que todavía no sabemos el resultado. Tras reiniciar, el coordinador recuperó el mismo hash. Dos solicitudes generaron un solo envío. |
| 2:15–2:43 | Ver como C. Mostrar la comparación B05 y el rótulo de simulación. | Con pagos independientes simulados, C ya puede ver su abono de 20 aunque el pago de B siga pendiente. En la liquidación conjunta, si falla B, C recibe cero. A cambio de coordinar el consentimiento y las firmas, evitamos que la ronda quede a medias. |
| 2:43–2:54 | Cierre en Resultado y puntero al expediente. | El expediente permite reproducir el caso y revisar cada resultado. La comprensión con personas y los tiempos de confirmación siguen pendientes de medir. |

## Inventario

| Elemento | Estado | Fuente o toma exacta |
|---|---|---|
| Logo, infografía y presentación | **Disponibles como material gráfico.** | [Logo](../../assets/logo/4-cuynexo-logo.png) · [Infografía](../3-CuyNexo_Infografia_v2.jpg) · [Presentación](../2-CuyNexo_Presentacion_v0.3.pdf). |
| Registros B01–B04 y datos B05 | **Disponibles como evidencia en JSON.** | [Índice de testnet T04](../evidencia-t04/registro-ejecuciones.md) y [resultado B05](../evidencia-t05/B05.json). |
| Capturas de las vistas locales | **Generadas según Linder. Pendientes de incorporar al repositorio.** | Al incorporar el lote, identificar qué tomas cubren Obligaciones, Acuerdo, Autorizaciones, Resultado y B05. Asociar cada captura al caso concreto. |
| Capturas públicas del explorador | **Generadas según Linder. Pendientes de incorporar al repositorio.** | Identificar los hashes y ledgers que aparecen en cada captura y cotejarlos con el [registro T04](../evidencia-t04/registro-ejecuciones.md). Para B03 usar el rechazo archivado y su alcance de sondeo. |
| Video final | **Pendiente.** | Grabar, revisar rótulos y cronometrar hasta 3:00 después de seleccionar y revisar las capturas generadas. |

Las tomas previstas muestran direcciones públicas, estados y hashes. Antes de incorporarlas, revisar que no aparezcan terminales con material de firma, bases locales, credenciales o datos privados.
