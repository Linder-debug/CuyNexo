# Recorridos web con Varial real y envío en Stellar testnet

W01 (26 nov) es un registro histórico de la interfaz anterior. W02 (27 nov) está al final y corresponde a la interfaz actual.

Fecha: 26 de noviembre de 2026, 12:27–12:29 (hora de Lima). Rama `dev/varial-horizon-testnet`, commit `9d0968ac2c1e355b68cfbe34536348c978f9fe59`, 69 de 69 pruebas locales. Estado: registro histórico de la ejecución del 26 de noviembre con la interfaz anterior, incorporado a la rama `dev/varial-horizon-testnet`. La ejecución con la interfaz actual está en W02, al final.

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
- No se probó contra testnet real, con wallet real, la recuperación tras respuesta perdida ni el rechazo de una empresa. Cobertura existente, sin equipararla a una prueba con wallet real: la recuperación tras respuesta perdida tiene el archivo B04 (testnet, cuentas efímeras y script, sin la web ni la extensión) y pruebas automáticas; el rechazo del ledger ante firma faltante o sobre vencido tiene los registros B03 (hashes `4981416e...` y `c4d88872...`, script); el rechazo de una empresa solo tiene pruebas automáticas y el recorrido Chromium con firmantes efímeros.
- Una ronda, cuatro cuentas, datos sintéticos. No acredita demanda ni comprensión por personas.
- Las cuentas y la transacción son públicas en Testnet y desaparecen cuando la red se reinicia.
- Las capturas se revisaron: sin frases de recuperación, claves, contraseñas ni el código de coordinador.

## W02: recorrido con la interfaz actual (27 de noviembre de 2026)

Rama `dev/varial-horizon-testnet`, commit `52728d2`, 71 de 71 pruebas locales. Extensión Varial Wallet 5.53.1 del release oficial (`build-5.53.1.zip`, SHA-256 `fd6567de460e438989f5ea780cba8a37317347a47cacb930727015d797cef68f`), cargada en cuatro perfiles de Chrome 157 desechables, uno por empresa, más una sesión de coordinador sin wallet. La web corrió con `application(...)` de `scripts/operative-web.mjs` en modo `testnet`, rótulo «Stellar TESTNET · activos de prueba». Cada empresa conectó su cuenta (ventana «Connection Request», Test Net), se identificó con una firma de mensaje (`cuynexo-session-v1`) y aceptó con otra (`codember-consent-v1`). A y B firmaron la transacción en la ventana «Confirm Transaction» de la extensión (comisión 0.00003 XLM, memo igual al hash del acuerdo). El coordinador envió una sola vez y C pulsó «Verificar resultado».

| Paso | Resultado |
|---|---|
| Conexiones | 4 de 4 |
| Firmas de mensaje (identificación y aceptación) | 8 de 8 |
| Firmas de transacción | 2 de 2 (A y B) |
| Envío por el coordinador | una vez; «Resultado confirmado» |
| «Verificar resultado» desde C | «Pagado 0, recibido 20 XLM», comisión total 0.00003 XLM |

Hash `83667c2f095812522f00876bb0f752f15ee2164dbefaa847dd9e54e2b2a29fee`. Leído en Horizon: https://horizon-testnet.stellar.org/transactions/83667c2f095812522f00876bb0f752f15ee2164dbefaa847dd9e54e2b2a29fee . `successful: true`, ledger 5958983, creada 2026-11-27T22:29:19Z, 2 firmas, memo de tipo hash, `fee_charged` 300 stroops, 3 pagos nativos: A→C 20, A→D 30, B→D 10 XLM.

| Empresa | Dirección pública |
|---|---|
| A | `GBF5QMC24TNA6A4BQL3JVLJFYBVXJG2A6DR2R6534THSQBXL3GJ73O7K` |
| B | `GBKWO4R7XZN7NUCAVTOGLKN4H7335VYNSCC3CHE7UBKJYN233INTTJAB` |
| C | `GAJKVCFDNKBHNMAKMCM6XPNWAPMG7TBTWFIKQFS6BUHPAF2FCLPDVDFX` |
| D | `GAXXIV3CHBDVJGJDFSIIT2PAD6CLU4LPWNMDFGFPB2FIZGBMAZMC4IL3` |

Activación con Friendbot, una llamada por cuenta: A `100550ffcb42dbbb0539e13b04b1199f6b6ceecf767a3b2dd638f244513e00e4`, B `a3ecb86abcd1f86fab268ca66f35c8ad79f9fa142f3b6bcba356cb22ef7b2390`, C `bec3517f82a16a6cf06db540986e013e5a52cff4aa109a72aec9b2904a22e740`, D `aec5bbfc94cfe1712107d2615f21739787ab865730f913e078ca06f00ed45b9d`.

Capturas saneadas en `w02/`: conexión, firma de mensaje de identificación, firma de mensaje de aceptación, firma de transacción de A y de B, coordinador antes de enviar, resultado del coordinador y resultado verificado por C.

Condiciones para reproducir: la extensión necesita un Chrome con pantalla (por ejemplo bajo Xvfb) y carga mediante `enableExtensions` de Puppeteer. Al aceptar la versión la página abre un cuadro de confirmación del navegador que el guion debe aceptar. Las cuentas se activan con Friendbot después de los cuatro consentimientos y antes de preparar el cuerpo. El plazo de decisión del ejemplo es corto (unos 15 minutos).

Límites de W02:
- Solo el camino exitoso, en escritorio (1440 px), con una sola ronda y datos sintéticos. No se probaron con la extensión real el rechazo, la pérdida de respuesta, la recuperación ni «Consultar estado» contra testnet.
- La vista de C ya mostraba el resultado confirmado antes de pulsar «Verificar resultado» (se actualiza al abrir Resultado), de modo que la confirmación no se atribuye solo al botón.
- En modo testnet la franja superior sigue con el texto «Prototipo de diseño · No constituye evidencia de ejecución», y el plazo no usa el formato de hora de Lima en 24 horas sin segundos. Son dos ajustes menores pendientes.
- Las cuentas y la transacción son públicas en Testnet y desaparecen cuando la red se reinicia. Las capturas no contienen frases de recuperación, claves ni contraseñas. Las ventanas de firma de mensaje muestran un desafío de sesión ya consumido.
