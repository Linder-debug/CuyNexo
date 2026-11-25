# Arquitectura de CuyNexo

**Estado:** base técnica aprobada según el plan v0.3. Motor local, persistencia, adaptador clásico con Ed25519 y reconciliación disponibles para revisión. Los siguientes componentes describen el diseño del P0.
**Proyecto:** CuyNexo · Stellar Codember Perú 2026

CuyNexo propone compensar obligaciones entre empresas ficticias y liquidar los pagos residuales como una sola transacción clásica de Stellar. El objetivo del prototipo es demostrar un cálculo reproducible, una liquidación conjunta y una confirmación verificable en testnet. [Ver diagrama de arquitectura](./diagrama-arquitectura.md).

## Confirmado, propuesto y pendiente

| Estado | Alcance |
|---|---|
| **Confirmado** | La base aprobada usa una ronda local con datos sintéticos, TypeScript, SQLite y Horizon testnet. El caso base requiere cuatro consentimientos fuera de cadena y dos firmas de pago en una transacción clásica de Stellar. |
| **Disponible en esta rama** | Motor determinista, SQLite para rondas y versiones, hash del acuerdo y control local de unanimidad. La demo usa cuatro empresas y tres pagos residuales. T03 añade comprobación Ed25519 y XDR clásico con dos firmas. Ver [A01–A03](resultados-neteo-a01-a03.md), [T02](resultados-t02.md) y [T03](resultados-t03.md). T04 añade el intento único persistente y la [reconciliación local por hash](resultados-t04.md). |
| **Pendiente** | Vista local, comparación y B04 en testnet. El registro histórico documenta los resultados de B01 y B02. |

El [registro de decisiones](../decisions.md) identifica lo aprobado. Soroban se reconsideraría si surge una regla persistente en cadena que Stellar clásico no pueda cubrir.

## Componentes y responsabilidades del diseño

| Componente | Responsabilidad |
|---|---|
| **Interfaz local y sesiones de firma** | Mostrar obligaciones, acuerdo, autorizaciones y resultado. Cada firmante conserva su clave y revisa el contenido que va a firmar. La v0.3 propone firma por CLI y una vista web local de revisión. |
| **Motor de neteo** | Validar obligaciones sintéticas, calcular saldo de cada participante y generar pagos residuales en orden determinista. Usa importes enteros en unidades mínimas y verifica que la suma de saldos sea cero. |
| **Coordinador** | Congelar la versión del acuerdo, comprobar consentimientos y firmas y gestionar el envío y la reconciliación. La propuesta vincula el hash del acuerdo al memo de la transacción. |
| **Persistencia local** | Conservar versiones, consentimientos, estados e intentos. Antes de llamar a la red, guardar el sobre firmado y su hash, con un intento único por ronda y versión. |
| **Adaptador Stellar** | Preparar el cuerpo de la transacción clásica y enviar el sobre firmado a Stellar testnet. Horizon es la vía propuesta para envío y consulta. |
| **Verificador** | Desde una ejecución separada y sin claves privadas, consultar el hash y comparar operaciones, importes y resultado contra el acuerdo. En las cuentas aisladas de la demo, contrastar saldos y comisión. |

## Flujo y límites de autorización

1. **Calcular y congelar.** A partir del escenario sintético, el motor obtiene saldos y pagos residuales. El coordinador fija una versión verificable con red, activo, cuentas, pagos y plazos.
2. **Consentir.** Cada participante acepta o rechaza esa versión. En el caso base, la aplicación verifica cuatro consentimientos. Un rechazo bloquea la preparación. Con unanimidad y un neto de cero, se registra el resultado sin envío.
3. **Firmar.** A y B firman el mismo cuerpo de la transacción en sesiones separadas. A es la fuente de la transacción del caso base y aporta secuencia y comisión. Stellar comprueba las firmas de las cuentas fuente. Los consentimientos de C y D los verifica la aplicación.
4. **Persistir y enviar.** El coordinador guarda el intento antes del envío. Si cambia el contenido del acuerdo o se necesita sustituir el sobre, se inicia un nuevo ciclo de autorización cuando el intento previo se haya resuelto.
5. **Reconciliar.** El verificador contrasta la respuesta de red con las operaciones esperadas. Un timeout o una consulta sin resultado deja el intento en revisión. Se consulta primero el mismo hash. El plan permite reutilizar exactamente el mismo sobre dentro de su vigencia. La implementación T04 consulta por hash sin reenvío automático. Una solicitud de cancelación tras reunir todas las firmas queda sujeta a la vigencia y al estado del intento.

La aplicación administra las versiones y los consentimientos. El coordinador opera con claves públicas y firmas, mientras los fondos permanecen en las cuentas pagadoras hasta que Stellar aplica los pagos. El resultado confirmado y su evidencia se obtienen de la red. [Operaciones y transacciones de Stellar](https://developers.stellar.org/docs/learn/fundamentals/transactions/operations-and-transactions).

## Caso de referencia y evidencia

| Obligaciones sintéticas | Saldos netos | Pagos residuales |
|---|---|---|
| A→B 100, B→C 80, C→D 60, D→A 50, B→D 30 | A −50, B −10, C +20, D +40 | A→C 20, A→D 30, B→D 10 |

El caso pasa de **320 unidades brutas a 60 unidades en pagos residuales**. El 81,25 % expresa la reducción de volumen del ejemplo. La comisión de red se registra aparte.

| Prueba prevista | Criterio de aceptación |
|---|---|
| **Neteo** | La ejecución local obtuvo los tres pagos esperados y conservó el saldo de cada participante. Ver [A01–A03](resultados-neteo-a01-a03.md). |
| **Liquidación exitosa** | La red confirma un único hash con las tres operaciones y los importes previstos. |
| **Fallo de la última operación** | B tiene saldo transferible insuficiente, pese a que el sobre reúne ambas firmas. Quedan cero pagos aplicados. Si corresponde, registrar la comisión y el consumo de secuencia por separado. |
| **Autorización** | Un rechazo del acuerdo impide preparar el envío. Una firma requerida de pago ausente impide la liquidación en Stellar. |
| **Respuesta perdida** | Se recupera el estado a partir del hash guardado, sin crear una segunda liquidación. |
| **Comparación** | Se documenta qué aporta el flujo frente a transferencias independientes y qué queda por validar con usuarios. |

Los artefactos públicos de prueba usarán datos sintéticos y evidencia revisada. La exportación excluirá semillas, claves privadas, credenciales y sobres firmados aún utilizables. B01 y B02 en testnet constan en el [registro histórico](evidencia-t03/registro-ejecuciones.md). La validación de B04 en testnet y los beneficios operativos siguen pendientes.
