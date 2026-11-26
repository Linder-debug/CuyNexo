# Recorrido web con Varial real y envío en Stellar testnet

Fecha: 26 de noviembre de 2026, 12:27–12:29 (hora de Lima). Rama `dev/varial-horizon-testnet`, commit `9d0968ac2c1e355b68cfbe34536348c978f9fe59`, 69 de 69 pruebas locales. Estado: **borrador privado**, no incorporado al repositorio.

## Qué se probó

Extensión Varial Wallet 5.53.1 del release oficial (SHA-256 `fd6567de...` verificado antes del ensayo, ver doc/varial-horizon.md), Chrome 157, cuatro cuentas desechables en Testnet sin relación con wallets personales. La web corrió con la función `application(...)` del módulo `scripts/operative-web.mjs` en modo `testnet`, llamada desde un guion de prueba. No se ejecutó el comando `npm run p0:web`; por lectura del código, `CUYNEXO_TRANSPORT=testnet npm run p0:web` activa ese modo y exige terminal interactiva, pero esa vía no se ensayó. La página mostró el rótulo «Stellar TESTNET · activos de prueba».

| Paso | Resultado | Evidencia |
|---|---|---|
| Conexión de A, B, C y D a la web (ventana «Connection Request», red Test Net) | 4 de 4 | capturas/01-conectar-B.png |
| Coordinador carga el ejemplo, calcula 320 → 60 XLM, asigna las cuatro direcciones y congela la versión | Correcto | capturas/08-antes-de-enviar.png |
| Identificación por empresa con SEP-53 (`cuynexo-session-v1`) | 4 de 4 | capturas/03-login-A.png |
| Consentimiento ACCEPT con SEP-53 (`codember-consent-v1`) | 4 de 4 | capturas/05-consent-A.png |
| Firma de la transacción por A y por B (ventana «Confirm Transaction», comisión 0.00003 XLM, memo = hash del acuerdo) | 2 de 2 | capturas/07-tx-A.png |
| Envío por el coordinador, una sola vez, tras verificar totales y firmas | SETTLED | capturas/09-coordinador-resultado.png, capturas/10-C-resultado.png |

## Transacción en Horizon testnet

Hash `6ab275cabda0b3d9c5154dfba56d3c485c03f75b115548d3582dfc12343e9c6e`. Leída en la fuente: https://horizon-testnet.stellar.org/transactions/6ab275cabda0b3d9c5154dfba56d3c485c03f75b115548d3582dfc12343e9c6e

- `successful: true`, ledger 5938099, creada 2026-11-26T17:28:58Z.
- 3 operaciones `payment`: A→C 20, A→D 30, B→D 10 XLM de prueba. Cuenta fuente A.
- `fee_charged` 300 stroops (0.00003 XLM), `max_fee` 300. Tope del acuerdo: 10 000 stroops.
- Memo de tipo hash igual al hash del acuerdo `636994ff0c6677040d678c4693e5e8b092ad7dd2babf2df4984d84cbdcb1e5ae`.

Cuentas (públicas, activadas con Friendbot, una llamada cada una; A reutilizó una wallet vacía creada antes):

| Empresa | Dirección |
|---|---|
| A | `GARTIYLYIFRSSYINPGIXOBOHOCER6UQJJFO6WDDWBX4SND2D4YJQJSMD` |
| B | `GD76BYW527K76HLJRLKIH53GPOYHBOWUNAJZAZRJPKCGT2O4M2Z73YME` |
| C | `GCJAE2T6O6ONVBB7UN3HMU572MQV7N5DBRFYTO5G43SPXQIOY5CC42QL` |
| D | `GC2NR6TZT4CJB6GKF2W422Q4VDLB5SYM7NGGSXHPDEF63YQNENHACSMH` |

Activación (hashes de Friendbot): A `3ca47420664ea2716b1ce2ea32d9f530b089226bd7f5b1321a6b9c9ae2e06e64`, B `d6d2e83049237abd66896d8378098c5bf1d4a80fd70b18d0ae1857a548461b57`, C `7c554f64b15967954d6f55bb35b4e36c9f9641ab1408a2e11d4954a2967edf4a`, D `f32bb0a881da95128d63cb3ed91c4aef476c8ea860991db638cd65bb9c655096`.

Tiempo medido en este caso: envío a las 12:28:53, transacción creada en el ledger a las 12:28:58 (alrededor de 5 s). Es una sola observación.

## Límites

- Estas capturas son un recorrido registrado de una ejecución, no una grabación continua ni una demostración nueva.
- La consulta final de la transacción la hizo el operador leyendo Horizon. El botón «Consultar estado por hash» de la app no se usó contra testnet en este ensayo.
- No se probó contra testnet real, con wallet real, la recuperación tras respuesta perdida ni el rechazo de C. Siguen cubiertos por B03/B04 (archivados) y por pruebas simuladas.
- Una ronda, cuatro cuentas, datos sintéticos. No acredita demanda ni comprensión por personas.
- Las cuentas y la transacción son públicas en Testnet y desaparecen cuando la red se reinicia.
- Las capturas se revisaron: sin frases de recuperación, claves, contraseñas ni el código de coordinador.
