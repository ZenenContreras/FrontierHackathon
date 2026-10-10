# Incidente FR-0153 — versión 2 del servicio original

Registro de la investigación del ticket **#FR-0153 — El proveedor desplegó la versión 2 del servicio sin avisar.**

La preparación terminó el 2026-10-10T21:35:30Z sin solicitudes. La oleada 1 se ejecutó entre 2026-10-10T21:41:26Z y 2026-10-10T21:42:07Z. La oleada 2 se ejecutó entre 2026-10-10T21:47:15Z y 2026-10-10T21:47:30Z. El seguimiento de `CONSULTA` se ejecutó entre 2026-10-10T21:52:01Z y 2026-10-10T21:52:26Z.

## 1. Resumen del incidente

El ticket afirma que el proveedor cambió el servicio original a la versión 2 sin previo aviso, que cambiaron tres comportamientos y que el resto se mantiene como en la versión 1. También exige registrar los experimentos, explicar los hallazgos en el debrief y tener en cuenta que las pruebas de conformidad corren contra la versión 2.

Tras las oleadas 1 y 2 y el seguimiento 157, el saldo de `CONSULTA` difiere de V1 en los dos casos medidos con dinero: strings `"400.00"` y `"2100.00"` frente a enteros. Los otros dos cambios anunciados siguen sin identificar.

## 2. Contexto y estado de la versión 1

El reemplazo de `src/` se construyó contra la versión 1. La especificación observada está en `docs/service-spec.md` y cita `experimentos.jsonl` y `pruebas/ejemplos.jsonl`. La matriz local está en `docs/cobertura.md`.

Lo que esta inspección comprobó en el repositorio, no en el servicio vivo:

- `experimentos.jsonl` tiene 127 líneas, ids 1 a 127, sin duplicados. Todas tienen `conclusion`. Status observados: 200 (53), 400 (33), 404 (19), 201 (12), 401 (7), 422 (3). Ninguna línea tiene `status` nulo. La especificación dice que ninguna trajo `X-Frontier-Infra`.
- El ledger `tools/state/append-ledger.json` tiene 127 intentos en estado `recorded`, ids 1 a 127.
- El contador local `tools/state/quota.json` registra `date` `2026-10-10`, `sent` 127 y `lastSentAt` equivalente a 2026-10-10T20:00:28.169Z.
- `pruebas/ejemplos.jsonl` tiene 20 mensajes de una sola secuencia de la mañana. No trae método, ruta, hora, reset ni `Authorization`.
- `docs/cobertura.md` dice que la última comparación local no encontró diferencias de status ni de cuerpo en 126 líneas con vínculo de ledger y en los 20 ejemplos. Eso no es una medición de la versión 2.
- La última suite citada por el ticket, 52 pruebas y ambos chequeos de TypeScript, no se ha vuelto a ejecutar en esta preparación. No se afirma que siga en ese estado.

El reemplazo cubre, como implementación local y no como hecho de la versión 2: `GET /health`, `POST /__reset`, `POST /msg`, 401 si el Bearer no es `PARTICIPANT_TOKEN`, 404 `E404` en ruta o método no registrado, el parser observado y los comandos `PING`, `ALTA`, `CONSULTA`, `DEPOSITO`, `TRANSFER` y `ANULA`. `SALDOS` se rechaza con `E301` y espacio final. El límite de transferencia `importe > 100000` y algunas ramas no observadas siguen documentados como supuestos en `docs/service-spec.md`, sección 8. `src/` no importa `tools/` ni contiene la URL del original.

## 3. Alcance y restricciones

Esta ejecución cubre la fase A y la preparación de la fase B. No corrige el reemplazo.

Restricciones aplicadas:

- No se desplegó el reemplazo.
- No se modificó `src/`, el parser, los comandos ni la lógica de negocio.
- No se alteraron `experimentos.jsonl`, `pruebas/ejemplos.jsonl` ni el ledger histórico.
- No se inventaron respuestas de la versión 2.
- No se enviaron solicitudes al original.
- No se imprimió el token. Solo se comprobó si las variables existen y su longitud.
- `docs/service-spec.md` no se actualiza hasta que haya una observación real.

Archivo de coordinación actualizado: `Agents.md`, solo para citar este documento.

## 4. Estado de las credenciales y cuota al inicio

Comprobado el 2026-10-10T21:34:10Z, en local, sin red.

| Dato | Observación | Límite de la observación |
| --- | --- | --- |
| `.env` | Existe. No se versiona en esta inspección como contenido. | No se lee el valor del token en este documento. |
| `PARTICIPANT_TOKEN` | Presente. Longitud 45. Supera `MIN_TOKEN_LENGTH` (8) de `tools/types.ts`. | La longitud no demuestra que el token siga aceptado por el original. |
| `ORIGINAL_BASE_URL` | Presente. Longitud 49, igual a la URL documentada `https://caja-negra-production-c64f.up.railway.app`. | No se imprimió el valor. No se resolvió por DNS ni se llamó. |
| `PORT` | Presente, longitud 4. Solo lo usa el reemplazo. | Irrelevante para el laboratorio. |
| `LAB_MIN_INTERVAL_MS`, `LAB_DAILY_LIMIT`, `LAB_TIMEOUT_MS`, `LAB_AUTH_MODE` | No están definidas en `.env`; las líneas están comentadas. | El laboratorio usa 120 ms, 8000/día UTC, 5000 ms y modo `bearer`. |
| Cuota local | 127 enviadas el 2026-10-10 UTC. Tope configurado 8000. Quedan 7873 en el contador local. | El contador es local. No consulta la cuota del proveedor. |
| Ritmo | Mínimo de código: 100 ms. Efectivo por defecto: 120 ms. El reto documenta 10/s y 8000/día por token. | No se midió el contador remoto. |
| Reloj | 21:34 UTC del 2026-10-10. El README dice que los tokens de participante dejan de funcionar contra el original a las 20:00. | La última escritura de cuota es 20:00:28Z y la línea 127 tiene status 200. Esa línea es anterior a este incidente y no prueba que el token siga válido a las 21:34Z. |
| Validez contra la versión 2 | Verificada en la oleada 1, no en la preparación. | El 2026-10-10T21:41:27Z, `GET /health` con el Bearer configurado respondió 200 y `{"ok":true}` (experimento 128). No hubo `X-Frontier-Infra`. El token seguía aceptado después de las 20:00 UTC. Eso no explica por qué el README fija esa hora. |

El ticket de esta tarea dice que los tokens usados antes ya no eran válidos. El archivo `.env` actual tiene un token de longitud 45. No se puede saber, sin una solicitud, si es un token nuevo, el anterior renovado o uno ya rechazado. No se reutiliza ningún token copiado de logs: el log no contiene el token.

Si la primera solicitud autorizada responde 401, trae `X-Frontier-Infra` o falla el transporte, la investigación se detiene. Esa respuesta no se interpretará como uno de los tres cambios funcionales.

## 5. Línea base y selección de experimentos

La selección de abajo es la que se autorizó como oleada 1 y ya se ejecutó. El resultado está en la sección 9. La oleada 2 no se ha ejecutado.

Criterio: repetir mensajes cuyo cuerpo está en `request` y cuya ruta y método están en un archivo de `tools/sequences/` con hipótesis idéntica a la del log, o en la hipótesis cuando el cuerpo es `null` y la hipótesis nombra el método y la ruta. No se reenvía el id 31 (`s6b`): no tiene archivo de secuencia. No se reenvía `pruebas/ejemplos.jsonl` completo: el sobre HTTP no está en el archivo y varios mensajes ya están en el log propio. No se inventan controles nuevos. No se compara el valor absoluto de `X-Req` con el histórico: en la versión 1 empezó en 2 y no se reiniciaba con `POST /__reset`.

Los ids históricos son referencias de comparación, no líneas que se vayan a editar. Las solicitudes nuevas, si se autorizan, deben usar ids a partir de 128 y secuencias nuevas (`v2a`, `v2b`, `v2c`), no `s1`–`s19`.

### Candidatos históricos

| Categoría | Caso reproducible | Referencia | Respuesta histórica de status y cuerpo | Por qué entra o queda fuera |
| --- | --- | --- | --- | --- |
| Salud | `GET /health` | 1, 3, 9 | 200 `{"ok":true}` | Entra. También sirve como prueba de credencial. |
| Reset | `POST /__reset` sin cuerpo | 2, 68 | 200 `{"ok":true}` | Entra. Hace falta antes de cualquier estado. |
| Éxito sin estado | `POST /msg` `{"m":"PING;64"}` | 4 | 200 `{"pong":true}` | Entra. `X-Req` 2 no es comparable en valor absoluto. |
| Ruta desconocida | `GET /no-existe` | 20 | 404 `E404` | Entra. Cubre 404 con Bearer. |
| Método distinto | `POST /MSG` `{"m":"PING;64"}` | 29 | 404 `E404` | Entra. Una sola variante de mayúsculas, no las doce de `s6`. |
| Auth ausente | `GET /health` con `LAB_AUTH_MODE=omit` | 11 | 401 `E001` | Entra, invocación aparte. El header no está en el log; el modo sí está en la hipótesis de `s4` y en el código. |
| Auth inválida | `GET /health` con `LAB_AUTH_MODE=invalid` | 16 | 401 `E001` | Entra, invocación aparte. El laboratorio envía exactamente `Bearer invalid-token`. |
| JSON ausente | `POST /msg` sin cuerpo | 32 | 400 `E100` | Entra. |
| Falta `m` | `POST /msg` `{}` | 33 | 400 `E102` | Entra. No se repiten `m` nulo, número y booleano en la primera oleada. |
| Falta control | `POST /msg` `{"m":""}` | 35 | 400 `E103` | Entra. |
| Segmento vacío | `POST /msg` `{"m":"PING;"}` | 42 | 400 `E104` | Entra. |
| Control mal formado antes que comando | `POST /msg` `{"m":"NOPE;5X"}` | 45 | 400 `E201` | Entra. |
| Control inválido antes que comando | `POST /msg` `{"m":"NOPE;1"}` | 44 | 400 `E202` | Entra. |
| Comando desconocido | `POST /msg` `{"m":"SALDOS;AC-0001;38"}` | 53 | 400 `E301` con espacio final | Entra. El espacio es parte del cuerpo histórico. |
| Aridad | `POST /msg` `{"m":"PING;64;1"}` | 49 | 400 `E302` | Queda en reserva, no en la primera oleada, para no duplicar la familia de forma de `PING`. |
| Mayúsculas de comando | `POST /msg` `{"m":"ping;64"}` | 50 | 200 `{"pong":true}` | Reserva. Solo si `PING;64` coincide y hace falta aislar la grafía. |
| Alta e id | `ALTA;Lucia;82` tras reset | 62, 69 | 201 `{"cuentaId":"AC-0001"}` | Entra en la secuencia de estado. |
| Segunda cuenta | `ALTA;Mateo;3` como segunda alta | 70 | 201 `{"cuentaId":"AC-0002"}` | Entra. El orden tiene que ser el de `s11`, no el de un alta suelta. |
| Consulta | `CONSULTA;AC-0001;14` tras esa alta | 63 | 200 `cuenta_id` y saldo 0 | Entra después de las dos altas solo si no se necesita el saldo 0 inmediato. En el plan se consulta `AC-0002` tras la transferencia, que es el id 73. La consulta de saldo 0 queda en reserva. |
| Depósito | `DEPOSITO;AC-0001;250000;86` | 71 | 200 `recieved`, `OP-0001` | Entra. El texto `recieved` es observable. |
| Transferencia | `TRANSFER;AC-0001;AC-0002;40000;86` y consulta | 72, 73 | `OP-0002` y saldo 40000 | Entra. |
| Límite | `TRANSFER;AC-0001;AC-0002;120000;55` | 74 | 422 `E506` | Entra. |
| Transferencia aceptada siguiente | `TRANSFER;...;100000;12` | 75 | 200 `OP-0003` | Reserva de la segunda oleada: distingue si `E506` consume id. No hace falta para detectar un cambio de status del 120000. |
| Anulación | `ANULA;OP-0003;66` y repetición | 76, 77 | `ok true`, luego `ya anulada` | Reserva. Depende de que `OP-0003` sea la transferencia de 100000. |
| Saldo tras anular | `CONSULTA;AC-0001;14` | 78 | saldo 210000 | Reserva. |
| Reset efectivo | `CONSULTA;AC-0001;14` tras reset | 61, 67 | 404 `E401` | Entra al final de la secuencia de estado, después de un reset explícito. |
| Cuenta inexistente sin crear id | depósito sin cuenta | 84, 85 | 404 `E401` y el alta siguiente sigue en `AC-0001` | Reserva. Solo si la alta normal coincide. |
| Saldo insuficiente | `TRANSFER;AC-0002;AC-0001;50000;23` con saldo 0 | 92 | 422 `E507` | Reserva. Requiere otra secuencia con dos altas y sin depósito. |
| No reproducible como captura | id 31 `s6b` | 31 | 404 `E404` | Fuera. La petición no está capturada. |
| Ejemplos no repetidos en el log propio | `CONSULTa`, depósito 700, `CONSULTA;AC-0009;87` | `ejemplos.jsonl` n=11, 15, 18, 19 | ver archivo | Fuera de la línea base. El sobre no está registrado y no distinguen un cambio de la versión 1 ya medido. |

## 6. Método de investigación

1. Inspeccionar código, documentación y logs sin red.
2. Comprobar credencial y cuota local sin imprimir secretos.
3. Fijar un plan pequeño, con coste, antes de enviar nada.
4. Cuando se autorice, enviar solo ese plan, una variable nueva cada vez respecto de un caso ya visto.
5. Registrar la respuesta real. No editarla para que coincida con la versión 1.
6. Clasificar cada diferencia como confirmada, probable, no concluyente o descartada solo después de un experimento que separe las alternativas.
7. No declarar tres cambios si la evidencia no los identifica.

Un experimento real se distingue de una prueba local porque solo `npm run lab` sin `--dry-run`, con `allowNetwork` en el entrypoint de `tools/cli.ts`, escribe `experimentos.jsonl` y llama a `ORIGINAL_BASE_URL`. `npm test` ejecuta `tests/*.test.ts` y no llama al original. Los tests `tests/lab-*.test.ts` son simulados.

## 7. Registro cronológico de decisiones

| Hora UTC | Decisión | Motivo |
| --- | --- | --- |
| 2026-10-10T21:34:10Z | No enviar solicitudes en esta ejecución. | La tarea pide detenerse tras la inspección y el plan. |
| 2026-10-10T21:34:10Z | No tratar el token como válido ni como inválido. | Está presente y tiene longitud 45, pero no hay respuesta nueva del original. El reloj ya pasó las 20:00 UTC documentadas. |
| 2026-10-10T21:34:10Z | No usar el id 31 ni reconstruir su petición. | `docs/cobertura.md` ya lo marca como no verificable. |
| 2026-10-10T21:35:30Z | No cambiar el esquema de `experimentos.jsonl`. | El escritor de `tools/record.ts` solo admite los campos oficiales. Añadir campos rompería el contrato del reto y el parser del laboratorio. |
| 2026-10-10T21:35:30Z | No crear todavía el archivo sidecar. | La decisión se documenta aquí antes de aplicarla. No hay capturas que guardar. |
| 2026-10-10T21:35:30Z | No modificar `src/` ni `docs/service-spec.md`. | No hay observación de la versión 2. Cambiar el reemplazo ahora sería adelantar una corrección. |
| 2026-10-10T21:35:30Z | Reservar ids desde 128 y secuencias `v2a`–`v2d`. | Los ids 1–127 y `s1`–`s19` quedan intactos. |
| 2026-10-10T21:41:26Z | Enviar solo `GET /health` antes del resto de la oleada 1. | La autorización exige parar si esa respuesta no es exactamente 200 y `{"ok":true}`. |
| 2026-10-10T21:41:27Z | Continuar la oleada 1. | El experimento 128 coincidió con el 1. No era infraestructura ni error de red. |
| 2026-10-10T21:41:46Z | Enviar los otros 11 pasos de `v2a` en una secuencia. | El reset va dentro de esa secuencia. No se añaden pasos fuera del plan. |
| 2026-10-10T21:41:48Z | Seguir con `v2b`, `v2c` y `v2d`. | `v2a` terminó en HTTP funcional. El reset del id 129 coincidió, así que `v2d` estaba permitido por el plan. |
| 2026-10-10T21:42:07Z | Detenerse sin oleada 2. | Se completaron las 16 solicitudes. Ninguna diferencia de status o cuerpo autoriza, por sí sola, a declarar un cambio. |
| 2026-10-10T21:47:15Z | Enviar solo el reset de `v2e` antes del resto. | La autorización manda parar si hay fallo de autenticación, infraestructura o status nulo. |
| 2026-10-10T21:47:16Z | Enviar los otros siete pasos, sin consultas extra. | El experimento 144 respondió 200 y `{"ok":true}`. |
| 2026-10-10T21:47:29Z | No añadir la transferencia de 100000 ni otra consulta. | El paso de 120000 coincidió. La diferencia apareció en la consulta ya prevista. El plan decía no ampliar la secuencia. |
| 2026-10-10T21:47:30Z | Detenerse. | Ocho solicitudes ejecutadas. Una diferencia de cuerpo, no tres cambios. |
| 2026-10-10T21:52:01Z | Enviar el seguimiento de seis pasos, uno a uno. | Si un paso del prefijo no reproduce `AC-0001`, `AC-0002`, `OP-0001` u `OP-0002`, no se continúa. |
| 2026-10-10T21:52:22Z | Enviar la consulta de `AC-0001`. | Los cinco pasos previos coincidieron con el estado previsto. |
| 2026-10-10T21:52:26Z | No enviar más solicitudes. | El saldo origen ya separa las alternativas previstas. No se consulta otra vez `AC-0002`. |

## 8. Hipótesis formuladas y por qué

Antes de medir solo había una hipótesis operativa:

- **H0, credencial:** el token podía estar rechazado. Quedó descartada para este token a las 21:41Z: el experimento 128 respondió 200 y `{"ok":true}`, sin `X-Frontier-Infra`.

Después de la oleada 1 no hay una diferencia de status o cuerpo de la que sacar una hipótesis de cambio. Quedan hipótesis de búsqueda, no de hallazgo:

- **H1, estado de negocio:** los tres cambios pueden estar en alta, depósito, transferencia, anulación, ids o saldos. La oleada 1 no creó cuentas ni operaciones. La oleada 2 está diseñada para distinguir esto de «el contrato HTTP no cambió».
- **H2, `X-Req` reiniciado:** el primer `POST /msg` de esta sesión devolvió 1 y el histórico medido empezó en 2. No se confirma. La versión 1 no vio el origen del contador y la evaluación no compara headers. No merece una solicitud extra solo para eso.
- **H3, cambios fuera de los mensajes repetidos:** sigue abierta para anulación y para mensajes no repetidos.

La oleada 2 aportó una diferencia real:

- **H4, saldo de `CONSULTA`:** el experimento 149 devolvió el string `"400.00"` donde el 73 tenía el número `40000`. El seguimiento 157, con el mismo prefijo, devolvió en `AC-0001` el string `"2100.00"`. Eso debilita «solo cambió el destino» y «solo cambió el tipo, no la escala»: `210000 / 100` es `2100.00`, no `210000.00` ni el entero `210000`. No hay una línea de V1 que consulte `AC-0001` en ese estado exacto. El `210000` se infiere del depósito de 250000 menos la transferencia de 40000, y coincide con el número medido en el experimento 78 después de anular una transferencia posterior de 100000. No se declara todavía una regla para saldo 0 ni para otros importes.
- **H5, la transferencia de 120000 cambió:** descartada para status y cuerpo. El experimento 150 respondió 422 y `E506`, igual que el 74. El reset previo, las dos altas, el depósito y la transferencia de 40000 habían coincidido en status, ids y texto `recieved`. No queda una explicación por estado inicial, autenticación o mensaje distinto.

## 9. Experimentos ejecutados y resultados

La preparación no envió nada. La oleada 1, ya autorizada, envió 16 solicitudes reales. Ids 128–143. El id 127 sigue siendo `s19` y no se reescribió. La comparación de status y cuerpo se hizo contra el JSON histórico, no contra un resumen. Las 16 coinciden. Ninguna trajo `X-Frontier-Infra`. Ninguna tiene `status` nulo.

Cuota local: 127 a 143 en la oleada 1, 143 a 151 en la oleada 2 y 151 a 157 en el seguimiento. Este seguimiento consumió 6. Quedan 7843 en el contador local, no en el del proveedor.

`X-Req` de `POST /msg` fue 1, 2, 3, 4, 5, 6, 7, 8 y 9 en los ids 130 y 133–139 y 143. `GET /health`, `POST /__reset`, `GET /no-existe` y `POST /MSG` no lo devolvieron. Entre el id 130 (`X-Req` 1) y el 133 (`X-Req` 2) no aumentó, así que las rutas 131 y 132 no lo incrementaron. El valor absoluto no coincide con el histórico porque aquella sesión ya iba por 2 en el primer `POST /msg` medido. No se clasifica como cambio: la versión 1 no observó el origen del contador.

### Tabla de experimentos de esta investigación

| ID | Seq | Referencia | Status y cuerpo | Clasificación |
| --- | --- | --- | --- | --- |
| 128 | v2a | 1 | 200 `{"ok":true}` | coincide |
| 129 | v2a | 2 | 200 `{"ok":true}` | coincide |
| 130 | v2a | 4 | 200 `{"pong":true}` | coincide. `X-Req` 1 frente a 2 histórico: no concluyente y fuera del cuerpo |
| 131 | v2a | 20 | 404 `E404` | coincide |
| 132 | v2a | 29 | 404 `E404` | coincide |
| 133 | v2a | 32 | 400 `E100` | coincide |
| 134 | v2a | 33 | 400 `E102` | coincide |
| 135 | v2a | 35 | 400 `E103` | coincide |
| 136 | v2a | 42 | 400 `E104` | coincide |
| 137 | v2a | 45 | 400 `E201` | coincide |
| 138 | v2a | 44 | 400 `E202` | coincide |
| 139 | v2a | 53 | 400 `E301` con espacio final | coincide |
| 140 | v2b | 11 | 401 `E001` | coincide |
| 141 | v2c | 16 | 401 `E001` | coincide |
| 142 | v2d | 68 | 200 `{"ok":true}` | coincide |
| 143 | v2d | 61 | 404 `E401` | coincide |
| 144 | v2e | 68 | 200 `{"ok":true}` | coincide |
| 145 | v2e | 69 | 201 `{"cuentaId":"AC-0001"}` | coincide |
| 146 | v2e | 70 | 201 `{"cuentaId":"AC-0002"}` | coincide |
| 147 | v2e | 71 | 200 `recieved`, `OP-0001` | coincide. El cuerpo no trae saldo |
| 148 | v2e | 72 | 200 `recieved`, `OP-0002` | coincide. El cuerpo no trae saldo |
| 149 | v2e | 73 | 200 `cuenta_id` `AC-0002`, saldo string `"400.00"` | difiere. V1 tenía el número `40000` |
| 150 | v2e | 74 | 422 `E506` | coincide |
| 151 | v2e | 79 | 200 `{"ok":true}` | coincide. No se consultó después |
| 152 | v2f | 68 | 200 `{"ok":true}` | coincide |
| 153 | v2f | 69 | 201 `AC-0001` | coincide |
| 154 | v2f | 70 | 201 `AC-0002` | coincide |
| 155 | v2f | 71 | 200 `OP-0001` | coincide |
| 156 | v2f | 72 | 200 `OP-0002` | coincide |
| 157 | v2f | ninguna en este estado | 200 `cuenta_id` `AC-0001`, saldo string `"2100.00"` | difiere del entero inferido `210000` y del tipo numérico visto en V1 |

El detalle de método, ruta, headers redactados y hora está en `docs/fr-0153-capturas.jsonl`. No contiene el token.

Identificadores observados en la oleada 2, después del reset 144: `AC-0001`, `AC-0002`, `OP-0001`, `OP-0002`. El único saldo observado es el de `AC-0002` en el experimento 149: string `"400.00"`. No hay observación del saldo de `AC-0001`.

## 10. Los tres cambios

No están identificados los tres. Hay una diferencia observada, no tres.

1. **Saldo de `CONSULTA`.** Destino, experimento 149 frente al 73: string `"400.00"` en vez del número `40000`. Origen, experimento 157: string `"2100.00"`; el entero comparable, inferido y coherente con el experimento 78, es `210000`. Cero, experimento 162 frente al 126: string `"0.00"` en vez del número `0`, después de anular el depósito. Los tres son strings con dos decimales e iguales al entero de V1 dividido por 100. El cero ya no queda fuera de esa representación. Sigue sin medirse en V2 otro importe, por ejemplo 700 o 40700. No es un segundo cambio. El id 170 añade una diferencia funcional distinta: `TRANSFER;AC-0001;AC-0002;100000;12` devolvió `422 E506` donde el id 75 devolvió `200` y `OP-0003`. El id 174 no añade otra: `E507` con saldo 0 coincidió con los ids 87 y 92, y las consultas 175 y 176 siguieron en cero con el formato ya conocido. El tercer cambio anunciado no tiene evidencia. `src/` no se corrige en esta fase.

## 11. Hipótesis descartadas y evidencia contraria

No se habían formulado hipótesis de cambio antes de medir. Con la oleada 1 se puede descartar, para estos mensajes y este token, que el cambio esté en el status o el cuerpo de:

- `GET /health` con Bearer, sin Authorization y con `Bearer invalid-token` (128, 140, 141).
- `POST /__reset` sin cuerpo (129, 142).
- `PING;64`, ruta desconocida, `POST /MSG` y los errores `E100`, `E102`, `E103`, `E104`, `E201`, `E202`, `E301` con espacio final (130–139).
- `CONSULTA;AC-0001;14` justo después de reset (143).

La oleada 2 descarta, para esta secuencia y este token, que el cambio esté en el status o el cuerpo de las dos altas, del depósito de 250000, de la transferencia de 40000 o de la transferencia de 120000. Esos cuerpos coincidieron con los experimentos 69, 70, 71, 72 y 74. La transferencia de 120000 no es un cambio.

El seguimiento descarta, para este prefijo, que el origen conserve el entero `210000` y que el saldo nuevo sea el mismo entero en string (`"210000.00"`). También debilita que el cambio de formato afecte solo a `AC-0002`: el origen también llegó como string escalado. No se volvió a consultar `AC-0002` en la misma secuencia.

El experimento 162 cierra el saldo 0 para el estado de `s19`: es el string `"0.00"`, no un cambio aparte. Siguen abiertos otros importes, la anulación de una transferencia, su repetición y si el depósito guarda otra escala que la consulta solo formatea. La anulación en minúsculas de `OP-0001` coincidió con el experimento 125. Esas respuestas de depósito y transferencia siguen sin traer saldo.

## 12. Incógnitas y limitaciones

- El token de `.env` fue aceptado a las 21:41Z. No se sabe cuántas solicitudes remotas quedan. La cuota local restante es 7857 el 2026-10-10 UTC.
- El log histórico no guarda método, ruta, `Authorization`, `Content-Type` ni headers de respuesta distintos de `X-Req`. Esos datos, cuando existen, están en `tools/sequences/` y en el texto de `hipotesis`. No son una captura HTTP verificada.
- El id 31 no se puede reproducir con fidelidad.
- `X-Req` histórico no es una línea base de valor absoluto.
- El estado del token en el original puede no estar vacío. Toda comparación de ids o saldos exige un `POST /__reset` explícito en la misma secuencia y no puede mezclarse con solicitudes de otro proceso que use el mismo token.
- No hay un segundo token válido en el repositorio. No se usarán credenciales ajenas para probar aislamiento.
- Una diferencia de una sola solicitud ambigua no se marcará como confirmada.
- El esquema oficial no admite fecha, versión, método, ruta ni comparación. Ver la decisión de la sección 7.

## 13. Riesgo para el reemplazo

El reemplazo devuelve `saldo` numérico. Los experimentos 149, 157 y 162 muestran strings `"400.00"`, `"2100.00"` y `"0.00"` donde la versión 1 usaba enteros. Si la evaluación repite esos casos, el reemplazo falla por tipo y valor. No se modifica `src/` en esta fase: no están identificados los otros dos cambios.

## 14. Plan de corrección y regresión

No hay corrección que planificar sobre un cambio concreto. La corrección, cuando exista evidencia, deberá:

1. Añadir una prueba de regresión con el status y el cuerpo exactos observados, sin normalizar strings.
2. Cambiar solo la rama afectada de `src/`.
3. No hacer que `src/` llame al original.
4. Citar los ids nuevos en `docs/service-spec.md`, sección 6, distinguiendo versión 1 y versión 2.
5. No borrar los experimentos históricos.

Eso queda pendiente de las fases C y de corrección. No se escriben los tests ahora porque el resultado esperado sería inventado.

### Oleada 2 ejecutada

Se enviaron las 8 solicitudes previstas, ids 144–151. No se añadió ninguna. La diferencia está en el id 149.

### Seguimiento de `CONSULTA` ejecutado

Se enviaron las 6 solicitudes autorizadas, ids 152–157. El prefijo reprodujo el estado previsto. La consulta de `AC-0001` devolvió el string `"2100.00"`.

Eso encaja con la alternativa de escala `/100` y string de dos decimales. Descarta, en este caso, el entero `210000` y el string `"210000.00"`.

No se autoriza ni se ejecuta otro experimento en esta fase. Preguntas que siguen abiertas: saldo 0, repetición de `AC-0002` en la misma secuencia, anulación y los otros dos cambios del ticket.

Parar en cualquiera de estos casos: `X-Frontier-Infra`, `status` null, 401 en el primer `GET /health` con Bearer, o agotamiento del contador local. Un 401 en ese primer paso no se convierte en hallazgo funcional sin una decisión nueva.

#### Oleada 1 — línea base, 16 solicitudes

Invocación `v2a`, modo `bearer`, 12 solicitudes. Secuencia nueva; el reset va dentro, no lo inserta el laboratorio.

| Paso | Método y ruta | Cuerpo | Referencia | Qué apoyaría «coincide» | Qué apoyaría «difiere» |
| --- | --- | --- | --- | --- | --- |
| 1 | `GET /health` | sin cuerpo | 1 | 200 `{"ok":true}` | Otro status o cuerpo, si no es infra |
| 2 | `POST /__reset` | sin cuerpo | 2 | 200 `{"ok":true}` | Otro status o cuerpo |
| 3 | `POST /msg` | `{"m":"PING;64"}` | 4 | 200 `{"pong":true}` | Otro status o cuerpo. `X-Req` se anota, no decide |
| 4 | `GET /no-existe` | sin cuerpo | 20 | 404 `E404` | Otro status, código o texto |
| 5 | `POST /MSG` | `{"m":"PING;64"}` | 29 | 404 `E404` | 200 `pong` u otro error |
| 6 | `POST /msg` | sin cuerpo | 32 | 400 `E100` | Otro error |
| 7 | `POST /msg` | `{}` | 33 | 400 `E102` | Otro error |
| 8 | `POST /msg` | `{"m":""}` | 35 | 400 `E103` | Otro error |
| 9 | `POST /msg` | `{"m":"PING;"}` | 42 | 400 `E104` | Otro error |
| 10 | `POST /msg` | `{"m":"NOPE;5X"}` | 45 | 400 `E201` | `E301`, `E202` u otro |
| 11 | `POST /msg` | `{"m":"NOPE;1"}` | 44 | 400 `E202` | `E301` u otro |
| 12 | `POST /msg` | `{"m":"SALDOS;AC-0001;38"}` | 53 | 400 `E301` con espacio final | Sin espacio, otro código o aceptación |

Invocación `v2b`, una solicitud, proceso con `LAB_AUTH_MODE=omit`:

| Paso | Método y ruta | Referencia | Coincide | Difiere |
| --- | --- | --- | --- | --- |
| 1 | `GET /health` | 11 | 401 `E001` | 200 u otro cuerpo |

Invocación `v2c`, una solicitud, proceso con `LAB_AUTH_MODE=invalid`:

| Paso | Método y ruta | Referencia | Coincide | Difiere |
| --- | --- | --- | --- | --- |
| 1 | `GET /health` | 16 | 401 `E001` | 200 u otro cuerpo |

Invocación `v2d`, modo `bearer`, 2 solicitudes, solo si `v2a` paso 2 coincidió. Si el reset de `v2a` ya dejó el token vacío y no hubo otra solicitud con ese token, el reset se repite igual: el laboratorio no garantiza que nadie más use el token.

| Paso | Método y ruta | Cuerpo | Referencia | Coincide | Difiere |
| --- | --- | --- | --- | --- | --- |
| 1 | `POST /__reset` | sin cuerpo | 68 | 200 `{"ok":true}` | Otro contrato de reset |
| 2 | `POST /msg` | `{"m":"CONSULTA;AC-0001;14"}` | 61 | 404 `E401` | 200 con saldo, otro id o otro error |

Esa consulta no basta para cubrir altas, depósitos y transferencias. Es el cierre barato de «reset vacía cuentas» si el reset respondió `ok`. La secuencia de negocio va en la oleada 2 para no gastar 9 solicitudes antes de ver el contrato HTTP.

Coste oleada 1: 12 + 1 + 1 + 2 = 16. Tres procesos, porque el modo de autenticación es una variable de entorno del proceso, no un campo de la secuencia.

#### Oleada 2 — estado, 8 solicitudes, no automática

Una sola secuencia `v2e`, después de autorización explícita y solo si la oleada 1 no quedó bloqueada. Empieza con reset. Orden copiado de `s11`, recortado en el punto que ya muestra id de cuenta, id de operación, saldo y límite.

| Paso | Cuerpo | Referencia | Coincide con la versión 1 |
| --- | --- | --- | --- |
| 1 | `POST /__reset` | 68 | 200 `{"ok":true}` |
| 2 | `ALTA;Lucia;82` | 69 | 201 `{"cuentaId":"AC-0001"}` |
| 3 | `ALTA;Mateo;3` | 70 | 201 `{"cuentaId":"AC-0002"}` |
| 4 | `DEPOSITO;AC-0001;250000;86` | 71 | 200 `recieved`, `OP-0001` |
| 5 | `TRANSFER;AC-0001;AC-0002;40000;86` | 72 | 200 `recieved`, `OP-0002` |
| 6 | `CONSULTA;AC-0002;11` | 73 | 200 saldo 40000 |
| 7 | `TRANSFER;AC-0001;AC-0002;120000;55` | 74 | 422 `E506` |
| 8 | `POST /__reset` | 79 | 200 `{"ok":true}` |

Si el paso 7 difiere, no se añade en la misma secuencia una transferencia de 100000: primero se diseña el seguimiento. Si los ocho coinciden, el siguiente candidato de estado, todavía no autorizado aquí, sería repetir `s11` desde el paso de 100000 hasta la consulta de saldo 210000 (ids 75–78), otras 4 solicitudes, o la secuencia corta de `E507` (ids 89–94), 6 solicitudes. No se suman al coste de la oleada 2.

#### Comandos exactos, todavía no ejecutados

El laboratorio se invoca así. `--silent` es obligatorio para que npm no imprima argumentos. El token no va en la hipótesis ni en la ruta.

```bash
npm run lab --silent -- --help
```

Comprobado en `package.json`: el script `lab` es `tsx tools/cli.ts`. El entrypoint llama a `runCli(..., { allowNetwork: true })`. `--dry-run` valida y no escribe el log.

Una sonda:

```bash
npm run lab --silent -- probe --seq v2a --hipotesis "v2 GET /health con Bearer; comparar con experimento 1" --method GET --path /health
```

Una secuencia, cuando exista el archivo y esté autorizado el envío:

```bash
npm run lab --silent -- sequence --file tools/sequences/v2a-baseline.json
```

Auth ausente o inválida, en un proceso distinto, sin poner el token en el comando:

```bash
LAB_AUTH_MODE=omit npm run lab --silent -- probe --seq v2b --hipotesis "v2 GET /health sin Authorization; comparar con experimento 11" --method GET --path /health
LAB_AUTH_MODE=invalid npm run lab --silent -- probe --seq v2c --hipotesis "v2 GET /health con Bearer invalid-token; comparar con experimento 16" --method GET --path /health
```

Esos comandos sí se ejecutaron en la oleada 1, con `--attempt` o `--attempt-prefix` fijos (`fr0153-v2a-1`, `fr0153-v2a`, `fr0153-v2b-1`, `fr0153-v2c-1`, `fr0153-v2d`). Existen `tools/sequences/v2a-baseline.json`, `tools/sequences/v2d-reset-consulta.json` y `tools/sequences/v2e-estado.json`. Este último no incluye el reset inicial: ese paso se envió antes, como experimento 144, para poder parar si la autenticación fallaba.

Configuración, sin valores secretos:

- `ORIGINAL_BASE_URL` en `.env`, o el default de `tools/cli.ts` si falta.
- `PARTICIPANT_TOKEN` en `.env`. `src/server.ts` y `tools/env.ts` no pisan una variable ya definida y no vacía.
- `LAB_AUTH_MODE` solo en el proceso del laboratorio: `bearer`, `omit` o `invalid`.
- No pasar `--token`. El CLI lo rechaza.

### Mecanismo de registro propuesto y no aplicado

`experimentos.jsonl` conservará solo:

`id`, `seq`, `x_req`, `hipotesis`, `request`, `status`, `response`, `conclusion` opcional.

La hipótesis incluirá método, ruta, la marca `v2` y el id histórico comparado. `request` seguirá siendo el cuerpo, o `null` si no hay cuerpo. `conclusion` dirá `coincide`, `difiere` o `no concluyente`, más el motivo, sin token.

El sidecar `docs/fr-0153-capturas.jsonl` tiene una línea por cada id 128–151. No se cambió el esquema de `experimentos.jsonl` ni `tools/record.ts`. Para poder copiar `content-type`, `date`, `x-req` y `x-frontier-infra` sin una segunda solicitud, `tools/client.ts` y `tools/cli.ts` ahora exponen solo esos headers en la salida del laboratorio. No imprimen `Authorization`.

## 15. Lecciones aprendidas

Solo de esta preparación, no del descubrimiento de los tres cambios:

- El log oficial no permite repetir una petición histórica con fidelidad completa. La comparación de la versión 2 tendrá que apoyarse en los archivos de secuencia y decirlo.
- El contador local de cuota no es la cuota del proveedor.
- Una hora posterior a las 20:00 UTC no implica token rechazado. A las 21:41Z el experimento 128 seguía aceptando el Bearer configurado.
- Adelantar la corrección del reemplazo mezclaría la versión 1 con una versión 2 no medida.

## 16. Material para el debrief final

Hay una diferencia que sí se puede explicar con la evidencia, y dos cambios del ticket que siguen sin aparecer.

Oleada 2:

- Señal: el experimento 149 devolvió `saldo` string `"400.00"` donde el 73 tenía el número `40000`.
- Hipótesis: la consulta ya no devuelve el entero histórico; este valor encaja con `40000 / 100` en string de dos decimales.
- Alternativas: solo este saldo, solo el destino, o una escala distinta en el movimiento. El cuerpo de depósito y transferencia no las distingue.
- Por qué esta secuencia: era la de V1, con reset previo y los mismos mensajes. No se añadió una consulta al ver la diferencia.
- Qué se esperaba en el paso 7: 422 `E506`. Ocurrió eso. No es un cambio.
- Decisión de entonces: no modificar `src/` y pedir el seguimiento del origen. Ese seguimiento ya se ejecutó: experimento 157, string `"2100.00"`.
- Limitación que queda: V1 no consultó `AC-0001` en ese paso exacto. El `210000` es inferido. El saldo 0 de V2 no se ha medido.

Oleada 1, para el debrief:

- Señal inicial: el ticket anuncia tres cambios. La primera respuesta real, experimento 128, no se apartó del experimento 1.
- Hipótesis de la primera solicitud: el token podía estar caducado. Se descartó porque el status fue 200 y el cuerpo `{"ok":true}`.
- Alternativa rechazada: declarar un cambio por `X-Req` 1 en vez de 2. No hay línea base del origen del contador y el cuerpo coincidió.
- Qué se eligió: la oleada 1 ya diseñada, 16 solicitudes, parando si `/health` fallaba. No se añadió un caso al ver que todo coincidía.
- Qué se esperaba: status y cuerpo de los experimentos citados. Qué ocurrió: coincidieron los 16. El espacio final de `E301` también.
- Decisión de entonces: no tocar `src/`. La oleada 2 se autorizó después y está registrada arriba.
- Limitación: método y ruta de la versión 1 siguen sin estar en el esquema oficial. Las capturas nuevas sí los guardan en el sidecar.

## Archivos inspeccionados

- `Agents.md`, `README.md`, `package.json`, `.env.example`, presencia y longitudes de `.env` sin valores.
- `docs/service-spec.md`, `docs/cobertura.md`.
- `experimentos.jsonl` (127 líneas), `pruebas/ejemplos.jsonl` (20 líneas).
- `tools/cli.ts`, `tools/client.ts`, `tools/record.ts`, `tools/types.ts`, `tools/quota.ts`, `tools/env.ts`, `tools/interpret.ts`, `tools/sequence.ts`, `tools/sequences/*.json`.
- `tools/state/quota.json`, estructura de `tools/state/append-ledger.json` sin volcar intentos.
- `src/config/env.ts`, `src/core/execute.ts` y la ausencia de la URL del original en `src/`.
- No se desplegó. No se modificó `src/`. Oleada 1: ids 128–143. Oleada 2: ids 144–151. Seguimiento: ids 152–157. Anulación de depósito: ids 158–162.

## 17. Anulación de depósito, ids 158–162

Ejecutada el 2026-10-10 entre 22:18:03Z y 22:18:13Z. Cinco solicitudes. No se envió la sexta: el id 161 no fue `E301`.

| ID | Referencia | Status y cuerpo | Clasificación |
| --- | --- | --- | --- |
| 158 | 122 | `200 {"ok":true}` | coincide. Montaje. |
| 159 | 123 | `201 {"cuentaId":"AC-0001"}` | coincide. Montaje. |
| 160 | 124 | `200` `recieved`, `OP-0001` | coincide. Montaje. El cuerpo no trae saldo. |
| 161 | 125 | `200 {"ok":true,"anulada":"OP-0001"}` | coincide. Caso V1 equivalente. No es un cambio. |
| 162 | 126 | `200` saldo string `"0.00"` | difiere del número `0`. Alcance del formato ya observado, no un cambio independiente. |

La reversión del depósito queda respaldada: el cuerpo de anulación coincidió y el saldo no quedó en 250000 ni en `"2500.00"`. La mayúscula `ANULA;OP-0001;72` sigue sin éxito medido en V1 ni en V2. No se confirma una regla para importes distintos de 0, 40000 y 210000. Los otros dos cambios del ticket siguen sin evidencia. No se propone ni se ejecuta otra oleada en este cierre.

## 18. Prefijo s11 e importe 100000, ids 163–170

Ejecutada el 2026-10-10 entre 22:27:07Z y 22:31:48Z. Ocho solicitudes. Se paró en el id 170. No se enviaron la anulación, su repetición ni la consulta final.

El prefijo coincidió con los ids 68–72 y 74. La consulta del id 168 devolvió `"400.00"` donde el id 73 tenía el número `40000`. Es el formato ya observado; no se contó como otro cambio y el estado siguió siendo comparable.

El id 170, `TRANSFER;AC-0001;AC-0002;100000;12`, respondió `422 {"error":"E506","mensaje":"límite excedido"}`. El id 75, con el mismo mensaje y este mismo prefijo, respondió `200 {"status":"recieved","operacionId":"OP-0003"}`. Es una diferencia funcional de aceptación. No trae saldo, así que no es el formato de `CONSULTA`. No se midió el umbral nuevo. Como no se creó `OP-0003`, tampoco se midió si el `E506` de 120000 consume un id, ni la anulación de una transferencia, ni su repetición, ni la reversión. `src/` no se modifica en este cierre.

## 19. E507 con saldo cero, ids 171–176

Ejecutada el 2026-10-10 entre 22:55:26Z y 22:55:49Z. Seis solicitudes. El paso 4 coincidió, así que se enviaron las dos consultas.

| ID | Referencia | Resultado | Clasificación |
| --- | --- | --- | --- |
| 171 | 89 | `200 {"ok":true}` | coincide |
| 172 | 90 | `201 {"cuentaId":"AC-0001"}` | coincide |
| 173 | 91 | `201 {"cuentaId":"AC-0002"}` | coincide |
| 174 | 87 y 92 | `422 {"error":"E507","mensaje":"saldo insuficiente"}` | coincide |
| 175 | 93 | `200`, saldo `"0.00"` | formato ya conocido. El destino sigue en cero. |
| 176 | 94 | `200`, saldo `"0.00"` | formato ya conocido. El origen sigue en cero. |

El rechazo no movió saldo. No es una tercera diferencia funcional. No se propone otra oleada en este cierre.
