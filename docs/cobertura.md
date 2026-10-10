# Matriz de cobertura

Comparación local del reemplazo contra registros ya guardados. No es una observación nueva del original y no llama al servicio original.

La evaluación compara status HTTP y cuerpo. Si ambos cuerpos son JSON, el orden de las claves no importa; los arrays, strings y números sí. Los headers no se comparan. `tests/differential.test.ts` usa esa misma comparación.

Emparejamiento: el esquema oficial de `experimentos.jsonl` guarda `request`, `status` y `response`. No guarda método, ruta ni `Authorization`. El ledger `tools/state/append-ledger.json` solo une la clave de intento con el `id`; tampoco guarda la petición. Una coincidencia de status y cuerpo no demuestra que la petición HTTP completa estuviera capturada.

Ninguna de las 127 líneas tiene `status` nulo ni `X-Frontier-Infra`. Método, ruta y `Authorization` no fueron capturados. Si solo aparecen en una hipótesis, no se consideran una petición registrada.

## Respuestas reales registradas y comparadas localmente

126 líneas tienen un vínculo comprobable: el ledger `seq:n` apunta a un `id`, la hipótesis del archivo de secuencia es idéntica a la del log y el cuerpo que se va a enviar es igual a `request`. De esas líneas se comparan el `status` y el `response` registrados. La última ejecución local no encontró diferencias de status ni de cuerpo en esas 126.

Eso no captura el método ni la ruta. Esos datos están en el archivo de secuencia, no en el log.

Los 20 ejemplos también tienen `request`, `status` y `response` registrados. Su comparación local coincide. El archivo no dice el método ni incluye el reset.

## Solicitudes reconstruidas desde hipótesis

`s6b`, id 31, no tiene archivo de secuencia. El ledger solo guarda `s6b-1` → 31. La hipótesis menciona `GET /no-existe` y `Bearer invalid-token`. Esa petición no se reenvía y no se cuenta como captura. Queda como no verificable.

El `Authorization` de las pruebas no está en el log. `s4` y `s5` lo declaran en la hipótesis; el header enviado no se guardó. En las demás líneas el test usa un Bearer ficticio de su lista local, o lo omite. No es el token del participante y no es una captura.

Los ejemplos se reenvían como `POST /msg` después de un `POST /__reset` inyectado. Ese sobre no está en `pruebas/ejemplos.jsonl`.

## Pruebas que solo verifican el reemplazo

El aislamiento entre dos tokens de prueba y la pérdida de memoria al crear otro proceso están en `tests/sequences.test.ts`. No hay línea del log que los observe. El reemplazo no emite `X-Req`; el original lo envió en 87 líneas. La evaluación no compara headers, y el test no exige ese valor.

Resultado local, no porcentaje de fidelidad: 126 comparaciones de status y cuerpo con vínculo de ledger, 0 diferencias; 1 caso no verificable (`s6b`); 20 ejemplos comparados con un sobre reconstruido.

## Auditoría de la comparación diferencial

| Clase | Cantidad | Qué está registrado | Qué no lo está |
| --- | --- | --- | --- |
| Solicitud HTTP completa en el esquema oficial | 0 | — | Método, ruta y `Authorization` no tienen campo. |
| Líneas del log con status y cuerpo comparados en local | 126 | `status`, `response`, `request` | Método y ruta no están en el log. El vínculo es el ledger `seq:n`. |
| De ellas, con archivo de secuencia e hipótesis idéntica | 126 | El texto de `hipotesis` coincide con `tools/sequences` | El archivo no es una captura de red. |
| De esas 126, hipótesis sin método y ruta a la vez | 23 | El mensaje está en la hipótesis; el cuerpo, en `request` | `POST /msg` sale solo del archivo. Ids 99–108, 110–113, 116–120 y 123–126. |
| No verificable; no se reenvía | 1 | Id 31, `s6b`: status 404 y `E404`; `request` null | Sin archivo. No se reconstruye la petición desde la hipótesis. |
| Auth declarada en la hipótesis | 14 | s4 sin header (11–15); s5 `invalid-token` (16–18); s6b (31); Bearer válido nombrado en 1, 2, 20, 22 y 39 | El header enviado no se guardó. |
| Auth no declarada; el test asume `bearer` | 113 | Cuerpo y respuesta | El modo real no es verificable. |
| Ejemplos de la mañana | 20 | `request`, `status`, `response` | No hay método, ruta, auth ni reset en el archivo. El test inyecta `POST /__reset` y `POST /msg`. |
| Coincidencias locales de status y cuerpo | 146 | 126 con vínculo de ledger + 20 ejemplos | No son captura completa ni porcentaje de fidelidad. |
| Diferencias de status o cuerpo en ese replay | 0 | — | No cubre `X-Req`. |
| `X-Req` registrado y no reproducido | 87 | Valor en el log | El test no exige ese header. |
| Pruebas solo del reemplazo | aislamiento y reinicio de proceso | Ninguna línea del log | `tests/sequences.test.ts`. No son observaciones del original. |

`s4`: las cinco hipótesis y conclusiones dicen que no había `Authorization`. El cuerpo de 13 es `{"m":"PING;64"}`. El de 14 es el texto `{`. El `Content-Type: application/json` de 14 está en el archivo de secuencia y no en el log. `s5`: las tres hipótesis dicen `Bearer invalid-token`; no guardan el header. `s6b`: la respuesta registrada es 404 y `E404`. La petición no está capturada. No se reenvía.

Cada secuencia corre en un proceso nuevo y, dentro de ella, los pasos comparten estado. Las altas aceptadas están en s10–s13 y s17–s19, acotadas por `POST /__reset`. s14–s16 no crean cuentas. No hay contaminación de saldos entre secuencias en los casos registrados. `X-Req` sí continuaba entre secuencias en el original; el test no lo compara. Los ejemplos usan otro proceso y un reset que el archivo no contiene.

El comparador de `tests/differential.test.ts` exige el status numérico y, para JSON, igualdad estructural: claves, tipos, arrays y strings exactos, incluido el espacio final de `E301`. El orden de claves no se exige, igual que la evaluación. No normaliza textos. No compara headers. `tests/replay.test.ts` usa `JSON.stringify`, más estricto con el orden. Exige el vínculo de ledger y la igualdad con `request`. No reenvía `s6b`.

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
| Ruta o método desconocido, con o sin token | 15, 20, 22–30 | 404 `E404` | `differential.test.ts` s4, s6 | confirmado el status y el cuerpo | El método y la ruta salen del archivo de secuencia, no del log. `s6b` no se reenvía. |
| `GET /no-existe` antes que la autenticación | 15 | 404 sin `Authorization` | `differential.test.ts` s4 | confirmado el status y el cuerpo | El id 31 no se reenvía: su petición no está capturada. |

## Cuerpo, parser y errores

| Escenario | Evidencia | Esperado | Prueba | Estado | Limitación |
| --- | --- | --- | --- | --- | --- |
| Sin cuerpo, texto no JSON o `{` | 32, 38, 39 | 400 `E100` | `differential.test.ts` s7 | confirmado | |
| Falta `m` o `m` no es string | 33, 34, 36, 40, 97, 98 | 400 `E102` | `differential.test.ts` s7, s14 | confirmado | No se probó `m` objeto. |
| Falta control | 35, 41 | 400 `E103` | `differential.test.ts` | confirmado | |
| Segmento vacío | 42, 51, 112 | 400 `E104` | `differential.test.ts` | confirmado | |
| Control mal formado | 45, 54, 55 | 400 `E201` | `differential.test.ts` | confirmado | |
| Control inválido | 44, 82, 100, 105–108, 110, 111 | 400 `E202` | `differential.test.ts`, `parse.test.ts` | confirmado en esos mensajes | La fórmula `(1-3R) mod 97` los reproduce y no se sondó en un mensaje nuevo. |
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
| Umbral exacto de transferencia | V2 rechaza 100000 y 120000; acepta 40000 | El reemplazo usa `>= 100000` | `commands.test.ts`, `v2-captures.test.ts` | el umbral intermedio no está medido | No se afirma que 99999 sea válido. |
| Transferencia con cuenta inexistente | No hay caso | El reemplazo responde `E401` antes de mover saldo | no hay prueba de equivalencia | pendiente | |
| Anular depósito tras transferencia dependiente | No hay caso | El reemplazo resta el importe | no hay prueba de equivalencia | pendiente | Puede dejar saldo negativo; no está observado. |

## Separación del laboratorio

| Escenario | Evidencia | Esperado | Prueba | Estado |
| --- | --- | --- | --- | --- |
| `src/` no llama al original ni importa `tools/` | revisión de código | sin esas referencias | `boundaries.test.ts`, `lab-boundary.test.ts` | probado solo localmente |
| La suite no ejecuta `npm run lab` | `package.json` script `test` | solo `tests/*.test.ts` | esta matriz y la ejecución del paso 6 | probado solo localmente |
