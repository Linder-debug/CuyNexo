# Neteo local de CuyNexo · A01–A03

**Ejecución del 24 de noviembre de 2026:** 10 pruebas aprobadas, 0 fallidas.

**Estado:** verificación independiente de Instinct pendiente. Este registro cubre R01/T01 del plan v0.3.

## Caso de cuatro empresas

| Obligaciones de entrada | Saldos netos | Pagos residuales |
|---|---|---|
| A→B 100, B→C 80, C→D 60, D→A 50, B→D 30 | A −50, B −10, C +20, D +40 | A→C 20, A→D 30, B→D 10 |

El volumen bruto es **320** y el residual **60**, una reducción de volumen del **81,25 %**. Las cifras son sintéticas. En el [fixture](../fixtures/cuatro-empresas.json) y la salida JSON, una unidad se representa como 10 000 000 unidades mínimas. El signo del saldo se calcula como cobros menos pagos.

## Reproducción

Con Node.js 22 o superior:

```sh
npm ci
npm test
npm run demo:neteo
```

Resultado obtenido con Node.js 24.22.3 y TypeScript 5.9.3. El compilador está fijado en el archivo de bloqueo. Tras instalarlo, la compilación, las pruebas y la demo se ejecutan sin acceso a la red y sin credenciales.

| Prueba | Resultado y cobertura |
|---|---|
| **A01** | Tres pruebas aprobadas. Caso 320→60, caso 230→50 y ciclo de neto cero con lista de pagos vacía. El [fixture 230→50](../fixtures/tres-empresas-230.json) usa el ciclo sintético A→B 100, B→C 80, C→A 50, que reproduce los totales y los dos pagos esperados A→B 20 y A→C 30. |
| **A02** | 729 grafos exhaustivos aprobados. Tres participantes y seis aristas dirigidas con valores 0, 1 o 2. Cero representa ausencia de obligación. |
| **A03** | 1 000 grafos aprobados con semilla fija `0xc0de2026` y de 3 a 8 participantes. También se probaron conjuntos vacíos, participantes aislados, componentes desconectados, IDs duplicados, obligaciones distintas entre las mismas partes, entradas inválidas y límites de importe. |

Los [tests](../test/netting.test.mjs) calculan por separado el saldo de cada empresa a partir de las obligaciones y vuelven a calcularlo con los pagos devueltos. Contrastan los saldos de ambos conjuntos, la suma global, los totales, importes positivos y la salida al reordenar la entrada.

## Contrato del cálculo local

- Entrada: de 3 a 8 IDs ASCII únicos, sin espacios, y un conjunto de obligaciones con ID único y partes distintas que existan en la ronda. Los importes de entrada son cadenas decimales canónicas de enteros positivos.
- Salida del [motor](../src/netting.ts): saldos, pagos, total bruto y total residual. Los importes se devuelven como cadenas para conservar exactitud en JSON. El motor suma con enteros `bigint` y empareja deudores y acreedores por ID ASCII ascendente.
- El cálculo abarca toda la ronda, incluidos sus componentes desconectados. El motor genera una propuesta. La autorización de ese resultado queda para el bloque de consentimientos.
- Una entrada inválida devuelve `INVALID_INPUT`. El cálculo conserva exactitud en obligaciones y totales por encima de 64 bits. Si un pago residual supera el máximo de un entero de 64 bits con signo, el motor devuelve `PAYMENT_AMOUNT_OUT_OF_RANGE` antes de entregar un plan de pagos.

El alcance final sigue siendo el del plan v0.3. Este bloque produce evidencia del neteo. Los bloques posteriores cubren consentimientos, firmas, SQLite, liquidación y reconciliación en Stellar testnet, vista de revisión, comparación y entrega.
