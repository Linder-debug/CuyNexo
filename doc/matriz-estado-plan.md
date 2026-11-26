# Matriz de estado frente al plan v0.3

Borrador privado, 26 de noviembre de 2026. «Hecho» solo cuando hay evidencia enlazada. Un documento redactado no cuenta como cumplido. Las fechas son propuestas, no compromisos.

| Bloque o puerta | Estado | Evidencia | Falta |
|---|---|---|---|
| T01 motor y neteo (A01–A03) | Hecho | doc/resultados-neteo-a01-a03.md | Ninguna |
| T02 versiones y consentimientos | Hecho | doc/resultados-t02.md | Ninguna |
| T03 clásico y firmas (B01, B02) | Hecho en testnet | doc/evidencia-t03, doc/evidencia-t04/registro-ejecuciones.md | Ninguna |
| T04 recuperación (B04) | Hecho en testnet (respuesta descartada del lado cliente) | doc/evidencia-t04 | Recuperación por la app contra testnet real no repetida |
| T05 vista mínima y B05 | Vista y B05 simulado hechos. **Prueba de comprensión con personas: pendiente.** | doc/evidencia-t05 | Sesiones con personas |
| P0 web operativo | Hecho con wallet de prueba (66/66) | doc/resultados-p0-web.md | Ninguna |
| Varial real y transporte testnet | Hecho una vez, 26 nov | doc/evidencia-web-wallet | Incorporar al repositorio |
| T06 expediente, README, guion, capturas | **Parcial.** README con cifras 54/54 y 66/66 por actualizar. Capturas previas de Linder fuera del repositorio. Video sin grabar. | doc/evidencia-t06 | Actualizar, incorporar capturas, revisión independiente |
| G1 evidencia A reproducible | Con respaldo | pruebas locales | Revisión independiente |
| G2 B01–B04 incl. reversión de B02 | Con respaldo en testnet | registro-ejecuciones | Ninguna |
| G3 valor de Stellar frente a la alternativa | **Pendiente.** Sin registrar. | Datos disponibles: B05, comisión 0.00003 XLM, ≈5 s de inclusión en una observación | Medición de costos de transferencias independientes y registro de la decisión |
| G4 expediente, README, video ≤3 min, revisión cruzada | **Pendiente.** | | Gonza ya no participa: definir quién revisa |
| Subida de la rama verificada a GitHub | Subida b8a090a (rama dev/p0-web-operativo) hecha 26 nov 9:17. `dev/varial-horizon-testnet` (9d0968a) **solo local** | | Autorización de subida de este commit |
| PR y main | No iniciados, decisión aparte | | Decisión del usuario, por separado de la subida |
| Entrega en APEX | Pendiente, límite 4 dic 23:59 (Lima) | | Todo lo anterior |

Calendario propuesto (Lima, no comprometido): 26–27 nov documentación; 28 nov–1 dic medición con registros existentes, video; 2 dic G3; 3 dic revisión y ensayo; 4 dic entrega con margen. Cualquier prueba nueva o con personas requiere una decisión propia.
