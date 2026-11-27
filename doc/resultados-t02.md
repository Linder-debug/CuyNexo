# T02 · Rondas, versiones y consentimientos en SQLite

**Ejecución local del 24 de noviembre de 2026:** 10 pruebas T02 aprobadas. Con A01–A03, 20 aprobadas y 0 fallidas. Verificación independiente pendiente.

## Comportamiento implementado

[AgreementStore](../src/agreements.ts) reutiliza el motor de neteo y guarda rondas, versiones y decisiones sintéticas en SQLite. Cada base admite una ronda abierta y conserva las rondas cerradas. `createRound` abre una ronda, `freezeVersion` congela una versión y `getVersion` consulta su estado e historial. Para sustituir la versión o cerrar la ronda, la operación exige la versión vigente, con `null` cuando todavía no existe. SQLite aplica estos cambios en transacciones de escritura.

La versión incluye ID de ronda, número de versión, etiquetas de red y activo, participantes, obligaciones, saldos, pagos, cuenta fuente representada por su alias, tope de comisión, plazos y versión del plan. El hash es SHA-256 hexadecimal del JSON canónico UTF-8. Se aplican las reglas de RFC 8785 para el conjunto de datos utilizado. Los IDs y las obligaciones se ordenan por ID ASCII. Los saldos y pagos mantienen el orden del motor. SQLite impide actualizar el contenido o hash de una versión congelada.

| Condición | Resultado en T02 |
|---|---|
| Todos aceptan la misma ronda, versión y hash antes de `consentBy` | `APPROVED` habilita el indicador local de avance. Si no hay pagos residuales, el estado es `NET_ZERO` y el indicador queda desactivado. |
| Un participante rechaza | `REJECTED`. El avance queda bloqueado. Una repetición idéntica durante el plazo devuelve el registro existente. Una decisión diferente del mismo participante se rechaza. |
| Se congela otra versión | Los votos de la anterior quedan en el historial. La versión nueva empieza con cero decisiones y requiere su propio hash. Una edición con un número de versión previo devuelve `VERSION_CONFLICT`. |
| Falta unanimidad al llegar a `consentBy` | `EXPIRED`. Los votos previos dejan de contar. |
| La versión aprobada llega a `settleBy` | `EXPIRED`. El indicador de avance se desactiva y se mantiene el historial. |

Los plazos usan milisegundos UTC. Para este bloque, `settleBy = consentBy + 10 min`, conforme a los plazos de demostración de la v0.3. Si hay unanimidad a tiempo, la versión puede avanzar desde la perspectiva local hasta `settleBy`. La recepción de nuevas decisiones termina en `consentBy`. El estado vencido se registra al observarlo.

## Reproducción

Con Node.js 22.13.0 o superior y TypeScript 5.9.3 ya instalado:

```sh
npm test
```

Las [pruebas de T02](../test/agreements.test.mjs) usan bases temporales y un reloj controlado. Cubren persistencia tras cerrar y reabrir, hash reproducible al reordenar la entrada, contenido inmutable, los cuatro votos requeridos, reintento idempotente, rechazo, versión y hash incorrectos, vencimiento exacto de ambos plazos, neto cero y cierre de ronda. El vector de SHA-256 del caso base se obtuvo por separado a partir del contenido esperado.

El indicador `canAdvance` expresa únicamente el resultado de esta simulación local. La identidad de un votante se representa con su alias. La autenticación Ed25519 del consentimiento, las dos firmas de pago, la preparación y liquidación en Stellar, la recuperación por hash, la vista local, la comparación y la entrega siguen en el alcance completo de la v0.3. En esta ejecución se usaron exclusivamente datos sintéticos y SQLite local.
