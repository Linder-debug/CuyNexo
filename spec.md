# Especificación inicial del P0

Estado: propuesta de diseño. G0 pendiente. Sin implementación ni pruebas ejecutadas en este repositorio.

## Objetivo

Demostrar con datos sintéticos el neteo de deudas cruzadas y evaluar la liquidación atómica del resultado en Stellar testnet. No validar demanda, ofrecer crédito, custodiar fondos reales ni atribuir a blockchain la reducción producida por el neteo.

## Flujo propuesto

1. Cargar obligaciones sintéticas de 3 a 8 participantes y validar importes e identidades del caso.
2. Calcular saldos netos de manera determinista y generar una propuesta identificable por versión.
3. Mostrar a cada participante sus obligaciones y el resultado para obtener consentimiento de la misma versión.
4. Preparar el cuerpo de una transacción clásica. En el caso base del plan hay tres pagos y dos pagadores.
5. Reunir las firmas necesarias sobre ese mismo cuerpo y enviar a Horizon testnet.
6. Verificar el resultado mediante el hash, conservar evidencia saneada y mostrar confirmado, fallido o pendiente.
7. Si se pierde la respuesta del envío, consultar el mismo hash antes de decidir cualquier reintento. No generar un pago distinto automáticamente.

El consentimiento de las partes es una validación de la aplicación. Las firmas y la atomicidad de las operaciones son propiedades que deben verificarse en la integración con Stellar. No son equivalentes.

## Caso sintético de referencia

El plan usa cuatro empresas y compara 320 unidades de obligaciones brutas con 60 unidades después del neteo, distribuidas en tres pagos. La reducción del volumen es 81,25 % en ese ejemplo. El fixture exacto, sus saldos y los pagos esperados deben revisarse y aprobarse antes de implementarlo. No se inventan aquí obligaciones individuales ni se publica un fixture ejecutable.

## Criterios de aceptación previstos

- El neteo conserva el saldo neto de cada participante y produce el mismo resultado con las mismas entradas.
- La validación rechaza entradas inválidas sin modificar el caso aprobado.
- Las partes consienten la misma versión. Cualquier cambio invalida consentimientos anteriores según la regla acordada en G0.
- Los dos pagadores del caso base firman el mismo cuerpo de transacción.
- La evidencia testnet demuestra tres pagos aplicados en el caso exitoso y ningún pago aplicado cuando falla el último. El tratamiento de comisiones y cuentas se documentará para no confundirlo con la aplicación de pagos.
- Una respuesta perdida se recupera consultando el mismo hash sin duplicar la liquidación.
- Un revisor puede seguir las instrucciones y reproducir el caso después de que exista implementación.

## Fuera de alcance inicial

Mainnet y fondos reales, datos reales de empresas, demanda validada, crédito o productos financieros, token especulativo y contrato Soroban sin una necesidad aprobada. La interfaz, la persistencia y el lenguaje se cierran en G0.

## Evidencia pendiente

No hay todavía pruebas de código, hashes testnet, cuentas de demostración, app desplegada ni video. Los issues describen trabajo futuro, no capacidades terminadas.
