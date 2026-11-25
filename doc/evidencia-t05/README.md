# T05 · Vista local y comparación B05

La vista abre el caso sintético de cuatro empresas. Muestra Obligaciones, Acuerdo, Autorizaciones y Resultado. Los consentimientos y las firmas se gestionan mediante el coordinador existente. La vista permite revisar cada perspectiva y leer el diario sin modificarlo.

```sh
npm --offline run demo:web
```

Abrir [http://127.0.0.1:4173](http://127.0.0.1:4173). Los escenarios de práctica muestran falta de firma de B y rechazo de C. Los estados archivados muestran B01, B02 y las dos etapas de B04. Al abrir la etapa pendiente de B04, la vista muestra el hash y `RECONCILING`. La etapa recuperada del mismo expediente muestra ese hash con `SETTLED`, ledger y comisión. La pérdida de respuesta se inyectó del lado cliente durante la corrida histórica. La vista reproduce el registro y no hace peticiones a Horizon.

También se puede inspeccionar una versión existente del diario. El proceso web abre SQLite en modo de solo lectura y muestra el estado al recargar. Los estados de conciliación provienen del coordinador. El código específico de una operación fallida se muestra cuando lo conserva la evidencia archivada.

```sh
npm --offline run demo:web -- --journal /ruta/settlement.sqlite --round b04 --version 1
```

En los escenarios archivados los consentimientos y los roles de firma ilustran el guion. Los resultados de red provienen de los JSON de testnet. El modo de diario muestra consentimientos registrados y firmas del intento reservado. Antes de reservar, el diario no permite inferir si A o B ya firmaron en una sesión separada.

## B05 · Mismas tres instrucciones

Guion común en orden A→C 20, A→D 30, B→D 10. El caso de fallo da a B 2 XLM iniciales, insuficientes para cubrir 10 XLM incluso antes de considerar reserva. La simulación aplica cada instrucción por separado si el pagador tiene saldo. Los deltas de la tabla excluyen comisiones.

| Canal y resultado | Pagos aplicados | Deltas A / B / C / D (XLM) | Comisión | Envío → confirmación |
|---|---:|---|---|---|
| **Testnet archivado · B01** | 3/3 | −50 / −10 / +20 / +40 | 300 stroops de A en esta corrida | Sin medición |
| **Simulación · Independientes, éxito** | 3/3 | −50 / −10 / +20 / +40 | No modelada | Sin medición |
| **Testnet archivado · B02** | 0/3 | 0 / 0 / 0 / 0 | 300 stroops de A en esta corrida | Sin medición |
| **Simulación · Independientes, falla B** | 2/3 | −50 / 0 / +20 / +30 | No modelada | Sin medición |

B01 y B02 corresponden a los ledgers **5922890** y **5922896**. B04 registró **300 stroops** en el ledger **5922902**. Los archivos fuente carecen de marcas de envío y confirmación que permitan calcular latencia comparable. Tampoco hay comisiones observadas para el canal independiente. La reducción **320 → 60** (81,25 %) viene del neteo, que se mantiene en ambos lados de B05. Ejecutar las cinco obligaciones brutas es otro punto de referencia y queda fuera del ensayo controlado de las tres instrucciones.

### Perspectiva de C

Con transferencias independientes, C puede ver 20 XLM abonados si A ya pagó. La ronda sigue parcial si falta el pago de B a D. Con Stellar, durante `RECONCILING` C ve su importe previsto y el hash pendiente. En un fallo como B02 recibe cero. En un éxito como B01, la evidencia confirma que los tres pagos se aplicaron juntos.

### Recuperación, dependencias y coordinación

| Factor | Stellar clásico en CuyNexo | Transferencias independientes del modelo |
|---|---|---|
| Acciones del caso | 4 consentimientos, 2 firmas del mismo sobre, 1 envío y 1 resultado por hash | 0 consentimientos de ronda modelados, 3 autorizaciones individuales, 3 envíos y hasta 3 resultados a conciliar |
| Responsabilidad ante fallo o respuesta perdida | B04 archivado muestra 2 solicitudes, 1 envío y recuperación del mismo hash tras reinicio. Si aún hay incertidumbre, se conserva `RECONCILING`. B02 permite preparar otra versión según el plan después de conciliar el fallo. | Si falló solo B, recuperar su propia referencia y verificar que nunca se aplicó antes de reintentar únicamente B→D. A→C y A→D ya están aplicadas. La protección ante duplicados depende del canal y de la conciliación por instrucción. |
| Dependencias | Cuentas y firmas de Stellar, sincronización del acuerdo, coordinador con SQLite y acceso de consulta a Horizon. | Cada pagador necesita acceso a su canal. Se requiere intercambio de comprobantes y alguien que pueda reconstruir el estado común. La simulación no supone un proveedor ni mide sus capacidades. |
| Acceso y costo de coordinación | Añade una ronda de aprobación unánime, ventanas y coordinación de firmas. Reduce las referencias de resultado y evita saldos parciales en el caso de fallo. | Permite avanzar por separado, con menor necesidad de sincronización inicial. Tras un fallo, deja múltiples comprobantes y requiere acordar el tratamiento del estado parcial. Los acuerdos fuera del simulador y el trabajo humano quedan sin medir. |

Un operador central podría hacer un asiento interno atómico en un libro mayor propio con fondos prefijados y confirmación conjunta. Eso desplaza el control y la conciliación al operador. Si la liquidación termina en sistemas externos independientes, la atomicidad final exigiría una capacidad adicional de ese canal. Las opciones requieren contrastar acceso, reglas, custodia o prefondos y costos del operador.

**Evaluación.** En este caso, si el requisito es que C y D solo cobren cuando los tres pagos puedan aplicarse juntos, la liquidación conjunta justifica evaluar la coordinación extra. Si el grupo acepta que C cobre mientras B se recupera por separado, las transferencias independientes preservan ese avance y pueden encajar mejor. No hay mediciones para decidir por costo total, latencia o adopción comercial.

### Reproducción y estado

```sh
npm --offline run --silent demo:b05
npm --offline test
```

El simulador y la lectura de archivos son reproducibles sin red. [Salida B05](B05.json) · [Fuentes B01, B02 y B04](../evidencia-t04/registro-ejecuciones.md) · [Guion de comprensión](comprension.md).

La revisión técnica local pasó **54 pruebas**, incluidas las 49 anteriores. El contraste B04 se probó tanto contra el archivo histórico como contra un diario local controlado cuyo estado pasó de `RECONCILING` a `SETTLED`. Se comprobó la respuesta HTTP de la vista y sus recursos locales. La inspección visual en navegador y la prueba de comprensión con personas quedan pendientes.
