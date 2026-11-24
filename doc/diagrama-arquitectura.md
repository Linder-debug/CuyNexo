# CuyNexo · Diagrama de arquitectura

**Diseño del P0 basado en la v0.3, con base técnica aprobada.** El motor de neteo está disponible en esta rama. La integración y las pruebas de testnet siguen pendientes. [Ver documento de arquitectura](./arquitectura.md).

```mermaid
flowchart TD
    P["Participantes A–D · firmas locales"]
    C["Coordinador local"]
    N["Motor de neteo"]
    D["Persistencia local"]
    S["Adaptador Stellar"]
    H["Stellar clásico · testnet"]
    V["Verificador"]

    P -->|"Consentimientos A–D y firmas de pago A/B"| C
    C -->|"Obligaciones sintéticas"| N
    N -->|"Saldos y pagos residuales"| C
    C <-->|"Acuerdo, estados, intento y hash"| D
    C -->|"Sobre firmado tras persistir el intento"| S
    S -->|"Una transacción con tres pagos"| H
    D -->|"Acuerdo y hash de referencia"| V
    V -->|"Consulta por hash"| H
    H -->|"Resultado y operaciones"| V
    V -->|"Resultado contrastado y evidencia"| C
```

- **Aplicación:** comprueba el consentimiento de los cuatro participantes para la misma versión del acuerdo.
- **Stellar clásico:** comprueba las firmas de las cuentas fuente y aplica las operaciones juntas. El prototipo debe demostrarlo en testnet.
- **Resultado incierto:** el verificador consulta el mismo hash. La interfaz muestra que el resultado sigue en revisión.
