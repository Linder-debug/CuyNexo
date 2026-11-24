# Decisiones y límites

## Inicialización documental, 23 de noviembre de 2026

Se prepara un repositorio público de CuyNexo con documentación inicial e issues sin asignar. Esto no aprueba implementación, no asigna trabajo a otras personas, no invita colaboradores y no completa el registro del Hub.

## G0: decisiones técnicas aprobadas, 24 de noviembre de 2026

Linder aprobó la base técnica del [plan v0.3](doc/1-CuyNexo_Plan_y_Especificacion_v0.3.pdf):

- Una ronda activa por instalación local, con datos sintéticos de 3 a 8 participantes.
- TypeScript para la implementación, SQLite para la persistencia del P0 y Horizon para la integración con Stellar testnet.
- Stellar clásico para liquidar. En el caso base, cuatro participantes consienten la misma versión y los dos pagadores firman el mismo cuerpo de una transacción con tres pagos.
- El primer bloque autorizado es el neteo local, con el caso de cuatro empresas y las pruebas A01–A03. ChatGPT implementa, Instinct verifica de forma independiente y Linder decide sobre la revisión y el avance.

La aprobación conserva el alcance completo del plan. Los bloques de consentimiento, persistencia, firma, liquidación en testnet, recuperación por hash, vista local, comparación y entrega siguen en la secuencia v0.3. La librería concreta de Stellar se usará en la etapa de integración.

El cálculo de este bloque agrupa las obligaciones de la ronda completa conforme a la regla propuesta en la v0.3, incluso si su grafo tiene componentes desconectados. Una liquidación futura del resultado exige el consentimiento de todos los integrantes de la ronda. El cálculo por sí solo no autoriza pagos.

## T02: versiones y consentimientos locales, 24 de noviembre de 2026

Linder autorizó guardar rondas y versiones en SQLite, congelar los datos con SHA-256 y comprobar el consentimiento unánime con datos sintéticos. Se usa `node:sqlite` sin nuevas dependencias. El estado se conserva al reabrir la base.

La prueba local representa a cada participante con su alias. Los votos de este bloque carecen de autenticación criptográfica y la comprobación Ed25519 del plan se añadió en T03 para las versiones con cuentas públicas congeladas. El bloqueo por rechazo, cambio y vencimiento ya se comprueba localmente en las pruebas de T02. La evidencia de atomicidad, autorización criptográfica y recuperación corresponde a los siguientes bloques.

Consulta la [arquitectura](doc/arquitectura.md) y los [resultados T02](doc/resultados-t02.md). El registro histórico de aprobaciones permanece disponible tras invalidarlas.

## T03: Stellar clásico y firmas, 24 de noviembre de 2026

Se fijó `@stellar/stellar-sdk` 14.4.3 para el adaptador clásico, con Horizon para los escenarios de testnet. Las rondas de T02 se conservan. Una versión apta para el adaptador congela las cuentas públicas y exige los consentimientos Ed25519 antes de preparar el XDR. La prueba local usa claves efímeras en memoria. Ver [resultados T03](doc/resultados-t03.md).

La ejecución de B01 y B02 en testnet queda a la espera de autorización. T04 conserva la tarea de persistir intentos, reconciliar resultados por hash y evitar reenvíos duplicados. La vista local, la comparación y la entrega siguen en la secuencia completa de la v0.3.

## Publicación y seguridad

Publicar solo documentación saneada y datos sintéticos. No incluir claves, semillas, tokens, bases locales, información empresarial real, capturas privadas, conversaciones ni materiales privados relacionados. La copia revisada del plan en `doc` excluye enlaces privados y conserva su estado de propuesta histórica. Revisar cualquier evidencia futura antes de publicarla.

## Checkpoint y entrega

La creación del repositorio y su registro en el Hub son pasos distintos. Las bases específicas de Codember exigen registrar el repositorio hasta el 25 de noviembre a las 23:59 de Lima; no expresan un mínimo de código para ese checkpoint. No se ha verificado el formulario interno ni se afirma que el registro esté hecho. La entrega final requiere funcionalidad y evidencia conforme a las bases, no solo esta documentación.
