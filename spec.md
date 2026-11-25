# Especificación inicial del P0

Estado de esta rama: base técnica aprobada. Neteo, versiones con consentimiento Ed25519 preparación clásica y reconciliación por hash implementados para revisión local. El [plan v0.3](doc/1-CuyNexo_Plan_y_Especificacion_v0.3.pdf) define la secuencia completa.

## Objetivo

Demostrar con datos sintéticos el neteo de deudas cruzadas y evaluar la liquidación atómica del resultado en Stellar testnet. No validar demanda, ofrecer crédito, custodiar fondos reales ni atribuir a blockchain la reducción producida por el neteo.

## Flujo previsto del P0

1. Cargar obligaciones sintéticas de 3 a 8 participantes y validar importes e identidades del caso.
2. Calcular saldos netos de manera determinista y generar una propuesta identificable por versión.
3. Mostrar a cada participante sus obligaciones y el resultado para obtener consentimiento de la misma versión.
4. Preparar el cuerpo de una transacción clásica. En el caso base del plan hay tres pagos y dos pagadores.
5. Reunir las firmas necesarias sobre ese mismo cuerpo y enviar a Horizon testnet.
6. Verificar el resultado mediante el hash, conservar evidencia saneada y mostrar confirmado, fallido o pendiente.
7. Si se pierde la respuesta del envío, consultar el mismo hash antes de decidir cualquier reintento. No generar un pago distinto automáticamente.

El consentimiento de las partes es una validación de la aplicación. Las firmas y la atomicidad de las operaciones son propiedades que deben verificarse en la integración con Stellar. No son equivalentes.

## Caso sintético de referencia

El plan usa cuatro empresas y compara 320 unidades de obligaciones brutas con 60 unidades después del neteo, distribuidas en tres pagos. La reducción del volumen es 81,25 % en ese ejemplo. El [fixture ejecutable](fixtures/cuatro-empresas.json) reproduce las cinco obligaciones de la sección 2.2 de la v0.3. El [resultado A01](doc/resultados-neteo-a01-a03.md) enumera los saldos y los pagos esperados.

## Criterios de aceptación previstos

- El neteo conserva el saldo neto de cada participante y produce el mismo resultado con las mismas entradas.
- La validación rechaza entradas inválidas sin modificar el caso aprobado.
- Las partes consienten la misma versión. Cualquier cambio invalida consentimientos anteriores según la regla de versión del plan v0.3.
- Los dos pagadores del caso base firman el mismo cuerpo de transacción.
- La evidencia testnet demuestra tres pagos aplicados en el caso exitoso y ningún pago aplicado cuando falla el último. El tratamiento de comisiones y cuentas se documentará para no confundirlo con la aplicación de pagos.
- Una respuesta perdida se recupera consultando el mismo hash sin duplicar la liquidación.
- Un revisor puede seguir las instrucciones y reproducir el caso después de que exista implementación.

## Fuera de alcance inicial

Mainnet y fondos reales, datos reales de empresas, demanda validada, crédito o productos financieros, token especulativo y contrato Soroban sin una necesidad aprobada. Las decisiones técnicas aprobadas constan en [decisions.md](decisions.md).

## Evidencia por etapa

A01–A03 corresponden al [neteo local](doc/resultados-neteo-a01-a03.md). [T02](doc/resultados-t02.md) cubre la persistencia local y las reglas de unanimidad, rechazo, reemplazo y vencimiento mediante decisiones sintéticas. [T03](doc/resultados-t03.md) prueba Ed25519, las firmas de pago y el XDR con claves efímeras. El [registro T03](doc/evidencia-t03/registro-ejecuciones.md) documenta B01 y B02 en testnet. [T04](doc/resultados-t04.md) valida la reconciliación por hash localmente. B04 en testnet, la vista y el video siguen pendientes.
