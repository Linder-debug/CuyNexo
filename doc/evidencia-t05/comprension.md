# Guion de prueba de comprensión · CuyNexo

Hasta dos revisiones internas de 10 a 15 minutos. En la primera, comenzar como pagador A o B y cambiar a C. En la segunda, comenzar en C y cambiar a pagador. Pedir a la persona pensar en voz alta, navegar por su cuenta y explicar las decisiones. Evitar anticipar las respuestas esperadas. Usar la vista local y alternar el orden de éxito y fallo entre revisiones.

| Paso | Pregunta o tarea | Resultado esperado para el observador |
|---|---|---|
| Obligaciones y Acuerdo | Identifica el importe de tu empresa y explica de dónde sale. | A paga 50 más la comisión, B paga 10, C recibe 20 o D recibe 40. Puede vincular el importe a su saldo en la versión y distinguirlo del bruto de 320. |
| Autorizaciones · Falta la firma de B | ¿Qué falta para enviar? ¿Qué hace C? | Cuatro consentimientos de la versión. A y B firman el mismo sobre. Falta B. C consiente y revisa su cobro. |
| Autorizaciones · C rechaza | Si C rechaza, ¿pueden enviar A y B? | La ronda queda bloqueada por falta de unanimidad antes de preparar el envío. |
| Resultado · B04 verificando | ¿Ya te pagaron? ¿Qué harías tras perder la respuesta o reiniciar? | El resultado es incierto. Consulta el mismo hash y evita enviar otra vez. |
| Resultado · B04 recuperado o B01 | ¿Qué muestra que terminó la ronda? ¿Qué cambió en B04? | Resultado confirmado, tres pagos aplicados y hash con ledger. En B04 conserva el hash de la etapa previa. |
| Resultado · B02 y contraste B05 | Eres C y A ya pagó. ¿Qué ves si falla B en cada canal? | Independientes deja 20 visibles para C y una ronda parcial. B02 deja cero pagos aplicados y registra la comisión por separado. |

Registrar por revisión fecha, rol inicial, escenario, respuesta textual, acierto sin ayuda, confusión, corrección propuesta y resultado de repetir ese paso. Usar alias R1/R2. Criterio por persona: identifica importe y acción pendiente, distingue confirmado, fallido e incierto, y evita reenviar mientras está incierto. Recorrer de nuevo el paso afectado después de cualquier ajuste y guardar ambos resultados.

| Revisión | Importe y acción pendiente | Tres estados y recuperación | Hallazgos y retest |
|---|---|---|---|
| R1 | Pendiente | Pendiente | Pendiente |
| R2 | Pendiente | Pendiente | Pendiente |

Revisión interna del prototipo. El guion prepara la observación de comprensión y el contraste de B04 en la vista.
