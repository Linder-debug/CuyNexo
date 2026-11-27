# T06 · Gobernanza y controles existentes

## Decisiones y revisión

| Control | Aplicación documentada |
|---|---|
| Alcance y aprobación | La v0.3 conserva los requisitos R01–R06. El 24 de noviembre de 2026, Linder autorizó implementar el plan v0.3 sin recortes. La revisión formal G0 queda sin cierre acreditado en la documentación disponible. Los cambios a invariantes, cuenta fuente, consentimiento o reintento se registran como decisión, actualizan las pruebas afectadas y pasan a revisión. [Decisiones](../../decisions.md) · [Plan](../1-CuyNexo_Plan_y_Especificacion_v0.3.pdf) |
| Implementación, verificación y decisión | El registro distingue la implementación, la verificación de Instinct y la decisión de Linder. Los envíos archivados de T04 tuvieron aprobación puntual. La revisión técnica previa de una etapa cuenta como antecedente de esa etapa. [Registro T04](../evidencia-t04/registro-ejecuciones.md) |
| Publicación | El proyecto contempla documentación revisada y evidencia sintética saneada. El registro del Hub, la integración de la rama y la entrega son hitos separados. T06 entrega un paquete local para revisión. [Decisiones](../../decisions.md#publicación-y-seguridad) |
| Autoría y licencia | El README registra asistencia de IA y la licencia sigue pendiente de acuerdo. El árbol revisado carece de un archivo de licencia del proyecto. Los aportes y el reparto se documentarán cuando se confirmen. [README](../../README.md#autoría-ia-y-licencia) |

La autorización de implementación consta como decisión del proyecto. Las protecciones y permisos efectivos del repositorio remoto no se verificaron en T06.

## Controles en el prototipo

| Control | Implementación o comprobación |
|---|---|
| Acuerdo congelado y trazable | Una ronda activa por instalación SQLite. Versión congelada con hash SHA-256. Los consentimientos Ed25519 se vinculan a la versión y al participante. Rechazo, cambio o vencimiento bloquean la preparación correspondiente. [SQLite](../../src/agreements.ts) · [Consentimientos](../../src/consents.ts) |
| Autorización de la transacción | La aplicación verifica cuatro consentimientos en el caso base. Las cuentas A y B firman el mismo cuerpo clásico. El adaptador compara el cuerpo, exige firmas válidas y revisa la vigencia. Usa el hash del acuerdo en el memo. [Adaptador](../../src/stellar-classic.ts) · [Pruebas](../../test/stellar-classic.test.mjs) |
| Recuperación | SQLite reserva el intento con su hash antes de enviar. El coordinador recupera ese hash y conserva `RECONCILING` si el resultado no se conoce o discrepa de lo esperado. Los casos locales cubren concurrencia, reinicio y un 404 sin confirmación. [Coordinador](../../src/settlement-coordinator.ts) · [Pruebas](../../test/settlement-coordinator.test.mjs) |
| Aislamiento de la demo | Los scripts de envío de red exigen `--execute-testnet` y usan cuentas efímeras de testnet. La vista escucha en `127.0.0.1`, sirve lecturas y puede abrir un diario en solo lectura. [Guion B04](../evidencia-b04/README.md) · [Servidor local](../../scripts/t05-web.mjs) |
| Evidencia pública y archivos locales | Los exportadores conservan direcciones públicas, hashes y observaciones. En la evidencia histórica B03 se conserva la precisión del sondeo. Las reglas Git existentes excluyen SQLite y los directorios de corridas locales. Mantener fuera de publicación semillas, claves, tokens, archivos `.env`, sobres utilizables y datos privados es un control de revisión documental. [Exportador](../../scripts/testnet-evidence.mjs) · [Reglas Git](../../.gitignore) · [Dictamen B03](../evidencia-b03/README.md) |

## Revisión independiente pendiente

La revisión final del paquete queda pendiente y se planifica **sin depender de Gonza**. La v0.3 prevé revisión de Instinct y decisión de Linder. Registrar qué persona o instancia revisó de forma independiente la entrega, su alcance, fecha, commit y hallazgos. El expediente queda listo para que el revisor:

1. Importe el bundle sobre la base indicada y reproduzca las 54 pruebas y B05.
2. Contraste los resultados mostrados con los JSON B01–B04 y compruebe la precisión del sondeo B03.
3. Compruebe que el guion, las capturas y el video final distinguen testnet archivada, simulación y pasos sin medir.
4. Registre hallazgos y posibles retests para que Linder decida la entrega.

La ejecución local de T06 y la revisión visual previa de T05 tienen sus propios registros. La prueba de comprensión con personas sigue un [guion separado](../evidencia-t05/comprension.md).
