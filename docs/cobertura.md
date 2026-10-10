# Matriz de cobertura

Comparación local del reemplazo contra registros ya guardados. No es una observación nueva del original y no llama al servicio original.

La evaluación compara status HTTP y cuerpo. Si ambos cuerpos son JSON, el orden de las claves no importa; los arrays, strings y números sí. Los headers no se comparan. `tests/differential.test.ts` usa esa misma comparación.

Emparejamiento: `experimentos.jsonl` no guarda método ni ruta. Esos datos salen de `tools/sequences`, y el cuerpo de cada paso coincidió con el campo `request` del log. `s4` se reprodujo sin `Authorization` y `s5` con `Bearer invalid-token`, porque así lo dicen sus hipótesis y sus respuestas. `s6b` no tiene archivo de secuencia: la hipótesis dice `GET /no-existe` con `Bearer invalid-token` y `request` es `null`. Si esa hipótesis dejara de decirlo, el caso quedaría como no comparable.

Ninguna de las 127 líneas tiene `status` nulo ni `X-Frontier-Infra`. No se trató un fallo de laboratorio como evidencia.

Resultado de la última comparación local: 127/127 experimentos coinciden en status y cuerpo; 0 difieren; 0 no comparables. Los 20 ejemplos de `pruebas/ejemplos.jsonl`, tras `POST /__reset`, también coinciden. El reemplazo no envió `X-Req` en ninguna de esas respuestas. El original sí lo envió en 87 líneas. Ese header queda fuera del contrato evaluado. El valor absoluto no se puede exigir en un proceso nuevo: la primera observación ya era 2 y el contador era de sesión.

## Rutas, métodos y autenticación

| Escenario | Evidencia | Esperado | Prueba | Estado | Limitación |
| --- | --- | --- | --- | --- | --- |
| `GET /health` con Bearer válido | 1, 3, 9 | 200 `{"ok":true}` | `differential.test.ts`, `http.test.ts` | confirmado | El reemplazo no emite `X-Req`. El original tampoco en esta ruta. |
| `GET /health?x=1` | 57 | 200 `{"ok":true}` | `differential.test.ts` s9 | confirmado | Solo una query. |
| `POST /__reset` sin cuerpo | 2, 6, 60 y otras | 200 `{"ok":true}` | `differential.test.ts`, `http.test.ts` | confirmado | No reinicia `X-Req` en el original. |
| `POST /__reset` con `{"extra":true}` y sin cuentas | 56 | 200 `{"ok":true}` | `differential.test.ts` s9 | confirmado | No se probó con cuentas ya creadas. |
| Sin `Authorization` en `/health`, `/__reset`, `/msg` | 11, 12, 13 | 401 `E001` | `differential.test.ts` s4, `http.test.ts` | confirmado | El modo de auth no está en el esquema oficial; se infiere de la secuencia. |
| JSON inválido sin token | 14 | 401 `E001`, no `E100` | `differential.test.ts` s4 | confirmado | La autenticación gana al parseo en `/msg`. |
| `Bearer invalid-token` | 16, 17, 18 | 401 `E001` | `differential.test.ts` s5 | confirmado | Solo se probó ese token inválido, no otro formato. |
| Ruta o método desconocido, con o sin token | 15, 20, 22–31 | 404 `E404` | `differential.test.ts` s4, s6, s6b | confirmado | `s6b` se reconstruye desde la hipótesis. |
| `GET /no-existe` antes que la autenticación | 15, 31 | 404 aunque el Bearer sea inválido o falte | `differential.test.ts` | confirmado | No se generaliza a rutas no probadas. |

## Cuerpo, parser y errores

| Escenario | Evidencia | Esperado | Prueba | Estado | Limitación |
| --- | --- | --- | --- | --- | --- |
| Sin cuerpo, texto no JSON o `{` | 32, 38, 39 | 400 `E100` | `differential.test.ts` s7 | confirmado | |
| Falta `m` o `m` no es string | 33, 34, 36, 40, 97, 98 | 400 `E102` | `differential.test.ts` s7, s14 | confirmado | No se probó `m` objeto. |
| Falta control | 35, 41 | 400 `E103` | `differential.test.ts` | confirmado | |
| Segmento vacío | 42, 51, 112 | 400 `E104` | `differential.test.ts` | confirmado | |
| Control mal formado | 45, 54, 55 | 400 `E201` | `differential.test.ts` | confirmado | |
| Control inválido | 44, 82, 100, 105–108, 110, 111 | 400 `E202` | `differential.test.ts` | confirmado | La fórmula general de `ALTA`, `DEPOSITO` y `TRANSFER` no está confirmada. |
| `SALDOS` | 53, 58, 59, 101 | 400 `E301` con espacio final | `differential.test.ts`, `commands.test.ts` | confirmado | No se incorporó como comando válido. |
| Aridad inválida | 49, 83 | 400 `E302` | `differential.test.ts` | confirmado | |
| Orden JSON, control, comando, existencia | 14, 39, 44, 45, 81, 84 | El error observado en cada paso | `differential.test.ts` | confirmado | No cubre precedencias no medidas. |

## Comandos, ids, saldo y secuencias

| Escenario | Evidencia | Esperado | Prueba | Estado | Limitación |
| --- | --- | --- | --- | --- | --- |
| `PING` y grafías laxas | 4, 43, 46–48, 50, 52 | 200 `{"pong":true}` | `differential.test.ts`, `commands.test.ts` | confirmado | |
| `ALTA` y nombre repetido | 62, 65, 69, 70, 113 | 201 `AC-0001` y luego `AC-0002` | `differential.test.ts`, `sequences.test.ts` | confirmado | `AC-0003` no está observado. |
| `CONSULTA` saldo 0 y `E401` | 61, 63, 64, 99, 104 | `cuenta_id` y saldo, o 404 `E401` | `differential.test.ts` | confirmado | La fórmula vale para `AC-` y cuatro dígitos. |
| `DEPOSITO` aceptado | 71, 118, 124 | 200 `recieved` y `OP-0001` | `differential.test.ts` | confirmado | El texto es `recieved`. |
| Depósito sin cuenta | 84, 85 | 404 `E401`; el alta siguiente sigue en `AC-0001` | `differential.test.ts` s12 | confirmado | No se consultó el contador de operaciones. |
| Transferencia de 40000 | 72, 73, 119, 120 | `OP-0002` y destino en 40000 | `differential.test.ts` | confirmado | |
| 120000 y después 100000 | 74, 75 | `E506` y la aceptada es `OP-0003` | `differential.test.ts` s11 | confirmado | El umbral exacto entre ambos importes no se midió. |
| `E507` con saldo 0 | 87, 92–94 | 422 `E507`; consultas siguen en 0 | `differential.test.ts` s13 | confirmado | No se sabe si consume un id de operación. |
| `E507` con saldo 40000 | `ejemplos.jsonl` n=16 | 422 `E507` | `differential.test.ts` ejemplos | probable | No se repitió con ese saldo en el log propio. |
| Anular transferencia y repetir | 76–78 | `ok true`, luego `ya anulada`; origen 210000 | `differential.test.ts` s11 | confirmado | El saldo exacto del destino no se consultó. |
| Anular depósito aislado | 125, 126 | saldo 0 | `differential.test.ts` s19 | confirmado | No hay anulación de depósito después de una transferencia dependiente. |
| Operación inexistente | 81, 103 | 404 `E402` | `differential.test.ts` | confirmado | |
| Segundo depósito de 700 | `ejemplos.jsonl` n=18, n=19 | `OP-0004` y saldo 40700 | `differential.test.ts` ejemplos | probable | No está en `experimentos.jsonl`. |
| Secuencia de la mañana | `pruebas/ejemplos.jsonl` | status y cuerpo de las 20 líneas | `differential.test.ts`, `sequences.test.ts` | confirmado en los mensajes repetidos | El evaluador no repite esa secuencia. |
| Errores intercalados | 74, 75, 82, 84, 85, 92 | La operación válida siguiente conserva el id observado | `differential.test.ts` | confirmado | Solo en esos casos. |

## Estado del reemplazo que no está medido en el original

| Escenario | Evidencia | Esperado en el reemplazo | Prueba | Estado | Limitación |
| --- | --- | --- | --- | --- | --- |
| Aislamiento por Bearer | Enunciado del reto; no hay dos tokens válidos en el log | Un token no ve ni borra las cuentas del otro | `sequences.test.ts`, `store.test.ts`, `http.test.ts` | probado solo localmente | No es equivalencia con el original. |
| Reinicio del proceso | El original no se reinició | Un `createApp` nuevo no conserva el `Map` | `sequences.test.ts` | probado solo localmente | Distinto de `POST /__reset`. |
| `X-Req` | 4, 7, 10 y las 87 líneas con valor | El original lo incrementa en `POST /msg` aceptado por la ruta | `differential.test.ts` comprueba que el reemplazo no lo envía | pendiente en el reemplazo | Fuera del contrato de status y cuerpo. El valor inicial observado fue 2. |
| Importe igual al saldo | No hay mensaje con control conocido | No hay expectativa | ninguna | pendiente | |
| Umbral exacto de transferencia | 100000 aceptado, 120000 rechazado | El reemplazo usa `> 100000` como supuesto | no se afirma en la matriz como hecho | pendiente | |
| Transferencia con cuenta inexistente | No hay caso | El reemplazo responde `E401` antes de mover saldo | no hay prueba de equivalencia | pendiente | |
| Anular depósito tras transferencia dependiente | No hay caso | El reemplazo resta el importe | no hay prueba de equivalencia | pendiente | Puede dejar saldo negativo; no está observado. |

## Separación del laboratorio

| Escenario | Evidencia | Esperado | Prueba | Estado |
| --- | --- | --- | --- | --- |
| `src/` no llama al original ni importa `tools/` | revisión de código | sin esas referencias | `boundaries.test.ts`, `lab-boundary.test.ts` | probado solo localmente |
| La suite no ejecuta `npm run lab` | `package.json` script `test` | solo `tests/*.test.ts` | esta matriz y la ejecución del paso 6 | probado solo localmente |
