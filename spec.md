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

### Contrato del recorrido web operativo

**R01 · Carga y cálculo reproducible.** Obligaciones permitirá al coordinador cargar las obligaciones sintéticas de 3 a 8 participantes. El servidor validará los identificadores, las referencias entre empresas y los importes exactos según las reglas del plan. La pantalla mostrará el bruto, los saldos por empresa, el residual y los pagos ordenados. Una entrada inválida conservará el último estado válido. El fixture de cuatro empresas seguirá disponible desde pantalla y deberá reproducir 320→60, con saldos A −50, B −10, C +20 y D +40.

**R02 · Identidad, decisión y vigencia.**

- Antes de congelar una ronda web operativa, el coordinador registrará una dirección pública de prueba distinta por empresa. Cada participante podrá comprobar su dirección. Corregir una asignación después de congelar requerirá otra versión y nuevas decisiones.
- El participante demostrará control de la dirección asignada con un desafío firmado, de propósito propio, vinculado al origen y a la ronda, con vencimiento y consumo único. El servidor verificará y consumirá el desafío antes de crear la sesión. Cambiar la cuenta conectada exigirá identificarse de nuevo. El selector de empresa carecerá de valor como autorización.
- Aceptar esta versión y Rechazar esta versión solicitarán una decisión SEP-53 que identifique dominio de consentimiento, acuerdo, versión, hash, participante y decisión. El servidor reconstruirá el mensaje desde la versión congelada, comprobará la firma con la dirección esperada y verificará sesión, versión activa, estado y plazo al registrar el voto en SQLite. El instante de recepción lo determinará el servidor. Una repetición idéntica será idempotente dentro de las condiciones de vigencia. Una decisión contradictoria no sobrescribirá la anterior.
- El esquema de cada prueba quedará identificado de forma inequívoca y persistente. Se verificará tanto al recibir el voto como al exigir la unanimidad que habilita los pagos, incluso después de reabrir SQLite. Se preservará la verificación Ed25519 histórica de los registros anteriores. La vía web operativa rechazará decisiones sintéticas sin firma, acuerdos sin correspondencia completa de direcciones y pruebas de esquema desconocido o distinto al previsto para la versión.
- Un rechazo firmado bloqueará la versión. Cancelar la solicitud en la wallet dejará la decisión pendiente. Tras una sustitución, las decisiones anteriores permanecerán en el historial sin servir para autorizar la nueva versión. Con unanimidad y residual cero, la ronda terminará en NET_ZERO sin preparar ni enviar una transacción.

**R03 · Cuerpo congelado y firmas de pago.**

- La preparación requerirá unanimidad válida de la versión congelada. El cuerpo reproducirá la red, fuente global, fuentes de operación, destinos, importes, activo, secuencia, memo vinculado al acuerdo, comisión y límites temporales aprobados. Se conservarán el cuerpo original y su hash antes de solicitar la primera firma.
- Los firmantes requeridos serán la unión sin duplicados de la fuente global y las fuentes efectivas de las operaciones. Las cuentas del P0 serán de firma simple según el plan. En el fixture se requieren A y B. A es la fuente global y paga la comisión. B es fuente explícita de su operación. C y D consienten el acuerdo y consultan su resultado. Otra ronda podrá requerir un conjunto distinto, que la pantalla derivará de su propio cuerpo.
- Cada wallet recibirá el mismo cuerpo original. El servidor comprobará el cuerpo completo, el hash de esa red, la firma y la cuenta esperada antes de guardar cada parcial. Los parciales verificados quedarán vinculados a ronda, versión, cuerpo y firmante. Tras un reinicio anterior al envío se recuperarán el mismo cuerpo, hash, plazo y parciales. Un duplicado de A nunca cubrirá la firma de B.
- El coordinador reunirá los parciales, volverá a leer el sobre y verificará la coincidencia del cuerpo y el conjunto completo de firmas. Solo entonces podrá solicitarse el envío. El coordinador no aportará firmas de pago ni reemplazará a un pagador.
- Se distinguirán tres límites. consentBy cierra la recepción de decisiones bajo la regla now < consentBy. Una unanimidad alcanzada a tiempo puede continuar después de ese instante. settleBy limita la ventana de liquidación del acuerdo. maxTime limita el cuerpo concreto y se fijará al menor valor entre settleBy y cinco minutos desde la preparación, conforme a v0.3. Si vence antes de completar las firmas o iniciar el envío, ese cuerpo dejará de ser utilizable. Cambiar plazo, secuencia, importe, destino, memo, comisión o red requerirá el ciclo autorizado para un cuerpo nuevo y nuevas firmas de pago. Ningún parcial se trasladará al nuevo cuerpo.

**R04 · Reserva, consulta y recuperación del intento.**

- Antes de cualquier llamada de envío a Horizon se persistirán el intento, su hash y el sobre autorizado. La reserva será única por ronda y versión en la misma base SQLite. Un doble clic, una petición concurrente o un reinicio recuperarán esa reserva.
- Consultar estado será una acción sin envío. Buscará el mismo hash y contrastará el resultado y las operaciones con el intento. Una ausencia temporal, un timeout o una discrepancia mantendrán RECONCILING. El vencimiento posterior a un envío incierto no acreditará por sí solo que hubo cero pagos.
- Se distinguirán dos interrupciones: reserva persistida y caída antes de llamar a Horizon, y envío realizado con respuesta perdida. Tras reiniciar, el coordinador consultará primero el hash en ambos casos. Si comprueba un resultado definitivo, lo registrará. Si la consulta no permite resolverlo, conservará el intento.
- Retransmitir el mismo sobre será una acción controlada, diferenciada de la consulta y reservada al coordinador. Solo estará disponible tras consultar el hash, mientras el cuerpo siga dentro de su ventana, el intento permanezca sin resultado definitivo y el sobre persistido conserve exactamente cuerpo, firmas y hash. Se registrará la retransmisión y se evitarán retransmisiones concurrentes. No se generará otra secuencia ni se reconstruirá el pago.
- La garantía general será una sola liquidación efectiva dentro del alcance del coordinador, su base persistente y el sobre original. Se comprobará una sola llamada de envío para el doble clic y para la reproducción del B04 archivado. Una retransmisión deliberada puede producir otra llamada de transporte sobre el mismo hash.
- Mientras el intento siga incierto se bloqueará una nueva liquidación de las mismas obligaciones, incluso desde otra versión. Para evaluar un nuevo intento tras un fallo definitivo se deberá verificar que se aplicaron cero pagos. Tras éxito se cerrará la ronda y se conservará el bloqueo de las obligaciones liquidadas según v0.3.

**R05 · Estados visibles, comprensión y comparación.** Las cuatro pantallas distinguirán decisión de empresa, firma de pago, envío y confirmación. Cada participante verá su impacto previsto y su resultado verificado. Se identificará el origen de cada vista: intento actual, testnet archivada o simulación. B05 conservará por separado el costo de autenticación y el de autorización. En el recorrido exitoso del fixture con cuatro sesiones nuevas, el diseño prevé cuatro firmas de identificación, cuatro decisiones firmadas y dos firmas de pago. Las diez solicitudes son un recuento derivado del diseño. Los permisos de conexión, interacciones efectivas, tiempos y fricción humana se registrarán como observaciones cuando se midan.

**R06 · Reproducción y evidencia.** La documentación indicará versiones, actores, sesiones, pasos desde pantalla, controles negativos y evidencia saneada. Distinguirá la regresión automática, el laboratorio aislado con wallet real, la integración web con su transporte declarado, la evidencia de red y la comprensión con personas. Una ejecución con transporte simulado acreditará únicamente el recorrido integrado ensayado. Atribuir un pago de testnet a la nueva web requerirá evidencia específica de una ejecución autorizada desde esa web.

### Sesión del coordinador y protección de los artefactos

Para el despliegue local recomendado, se propone una sesión separada de coordinador, iniciada mediante un código aleatorio de un solo uso mostrado al operador al arrancar el servicio. Las sesiones tendrán expiración, revocación, cookies HttpOnly y SameSite=Strict, comprobación de origen y protección CSRF en las escrituras. El servidor exigirá las mismas facultades en las rutas de la API y en las acciones iniciadas desde pantalla. El alojamiento definitivo queda pendiente de Linder.

El registro permitirá identificar actor, versión, momento, intento y resultado. Se excluirán de capturas, exportaciones públicas y registros de diagnóstico las semillas, claves privadas, contraseñas, cookies, códigos de acceso, desafíos reutilizables, firmas en bruto y sobres completos. El sobre necesario para la recuperación y los parciales de firma se conservarán en almacenamiento operativo restringido.

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

> A01–A03 documentan el neteo local. T02 cubre persistencia, unanimidad, rechazo, sustitución y vencimiento. T03 documenta los controles criptográficos y los expedientes de liquidación clásica. T04 y el expediente T06 documentan B04 en testnet con pérdida de respuesta inyectada en el cliente y recuperación por el mismo hash. T05 entregó la vista de consulta y la comparación B05. T06 registra 54/54 pruebas en su corrida histórica. El operador técnico ejecutó y reportó posteriormente un laboratorio aislado con Varial Wallet 5.53.1 que verificó consentimientos SEP-53 de A y B y firmas independientes sobre el mismo cuerpo. 
Linder aprobó el diseño del recorrido web operativo y sus criterios de aceptación. La operación integrada desde pantalla, las nuevas pruebas, la revisión independiente, la comprensión con personas y el video continúan pendientes.
