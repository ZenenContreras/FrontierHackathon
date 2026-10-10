# Especificación inicial del servicio original

Los identificadores citados son líneas de `experimentos.jsonl`, salvo que se indique `ejemplos.jsonl`. Esos ejemplos son de la versión de la mañana y no se modificaron. Los experimentos propios se hicieron el 2026-10-10 UTC, 98 solicitudes, ninguna con `X-Frontier-Infra`.

El método y la ruta no forman parte del esquema oficial del log. Quedan en `hipotesis`. `request` es el cuerpo enviado; `null` significa que no había cuerpo. `x_req` null significa que la respuesta no trajo `X-Req`.

Una observación repetida no se generaliza a entradas no probadas.

## 1. Entrada

### Confirmado

| ID | Comportamiento | Evidencia | Confianza |
| --- | --- | --- | --- |
| ENT-01 | `GET /health` con `Authorization: Bearer` válido responde 200 y `{"ok":true}`. No trae `X-Req`. | 1, 3, 9 | confirmado |
| ENT-02 | `GET /health?x=1` con Bearer válido respondió igual: 200 y `{"ok":true}`. | 57 | confirmado |
| ENT-03 | `POST /__reset` sin cuerpo y con Bearer válido responde 200 y `{"ok":true}`. No trae `X-Req`. | 2, 6, 60, 66, 68, 79, 80, 88, 89, 95 | confirmado |
| ENT-04 | `POST /__reset` con cuerpo `{"extra":true}` respondió 200 y `{"ok":true}`. En ese momento no había cuentas que comprobar. | 56 | confirmado |
| ENT-05 | Sin `Authorization`, `GET /health`, `POST /__reset` y `POST /msg` responden 401 y `{"error":"E001","mensaje":"no autorizado"}`. | 11, 12, 13 | confirmado |
| ENT-06 | `Authorization: Bearer invalid-token` produce el mismo 401 y `E001` en `/health`, `/msg` y `/__reset`. | 16, 17, 18 | confirmado |
| ENT-07 | `GET /no-existe` responde 404 y `{"error":"E404","mensaje":"ruta desconocida"}` sin token, con Bearer válido y con Bearer inválido. | 15, 20, 31 | confirmado |
| ENT-08 | Estas combinaciones también responden 404 y `E404`: `POST /no-existe`, `GET /msg`, `PUT /health`, `GET /__reset`, `POST /health`, `DELETE /msg`, `GET /Health`, `POST /MSG`, `POST /msg/`. | 22, 23, 24, 25, 26, 27, 28, 29, 30 | confirmado |
| ENT-09 | `POST /msg` con Bearer válido y `{"m":"PING;64"}` responde 200 y `{"pong":true}`. También con `Content-Type: application/json; charset=utf-8`. | 4, 37, 96 | confirmado |
| ENT-10 | En las rutas probadas, un 404 de ruta desconocida se evalúa antes que la autenticación. En `POST /msg`, la autenticación se evalúa antes que el JSON. | 14, 15, 31, 39 | confirmado |

### Hipótesis

`GET /health` y `POST /__reset` ignoran el cuerpo y la query. Solo hay una query y un cuerpo observados. No se probó un cuerpo no JSON en el reset ni otra query.

El 404 único cubre ruta distinta, método distinto, mayúsculas y barra final. No se probó si alguna ruta no documentada responde otra cosa.

### Desconocido

Esquema distinto de `Bearer`, `Bearer` vacío, espacios alrededor del token y un segundo token válido. Aislamiento entre dos tokens válidos: el enunciado lo afirma; no hay experimento con dos tokens válidos. `POST /__reset` con cuerpo mientras existen cuentas. Otras queries y otros `Content-Type`.

## 2. Integridad

### Confirmado

| ID | Comportamiento | Evidencia | Confianza |
| --- | --- | --- | --- |
| INT-01 | `POST /msg` sin cuerpo, con texto no JSON o con `{` responde 400 y `{"error":"E100","mensaje":"json inválido"}`. | 32, 38, 39 | confirmado |
| INT-02 | `{}`, `{"x":"PING;64"}`, `{"m":null}`, `{"m":64}`, `{"m":true}` y un array JSON responden 400 y `{"error":"E102","mensaje":"falta m"}`. | 33, 34, 36, 40, 97, 98 | confirmado |
| INT-03 | `{"m":""}` y `{"m":"PING"}` responden 400 y `{"error":"E103","mensaje":"falta control"}`. | 35, 41 | confirmado |
| INT-04 | `{"m":"PING;"}` y `{"m":"PING;;64"}` responden 400 y `{"error":"E104","mensaje":"segmento vacío"}`. | 42, 51 | confirmado |
| INT-05 | `{"m":"PING;64","extra":1}` responde 200 y `{"pong":true}`. Ese campo extra no impidió el comando. | 37 | confirmado |
| INT-06 | `NOPE;5X` y `ALTA;Lucia;Gomez;5X` y `ALTA;5X` responden 400 y `{"error":"E201","mensaje":"control mal formado"}`. | 45, 54, 55 | confirmado |
| INT-07 | `NOPE;1` y `ALTA;Lucia;83` responden 400 y `{"error":"E202","mensaje":"control inválido"}`. | 44, 82 | confirmado |
| INT-08 | `PING;64;1` y `ALTA;Lucia;Gomez;11` responden 400 y `{"error":"E302","mensaje":"aridad inválida"}`. | 49, 83 | confirmado |
| INT-09 | En `POST /msg`, el control mal formado se evalúa antes que el comando desconocido y antes que la aridad. El control numérico inválido se evalúa antes que el comando desconocido. | 44, 45, 54 | confirmado |
| INT-10 | `m` cadena vacía responde `E103`, no `E104`. Un segmento vacío después de un `;` responde `E104`, también en `ALTA;;82`. | 35, 42, 51, 112 | confirmado |
| INT-11 | `CONSULTA;AC-` más cuatro dígitos usa control `(17 - 3n) mod 97`, donde `n` es el entero de esos dígitos. Vale para 1, 2, 3, 9 y 10. El vecino numérico es `E202`. | 61, 99, 100, 104, 107 | confirmado |
| INT-12 | `SALDOS;AC-` de cuatro dígitos usa `(41 - 3n) mod 97`. `ANULA;OP-` de cuatro dígitos usa `(75 - 3k) mod 97`. | 53, 101, 76, 103, 125 | confirmado |
| INT-13 | `AC-00010` y `AC-10` no usan el control del entero 10. `ALTA;Ana;66` y `ALTA;Ana;16` no son el control válido. `DEPOSITO;AC-0009;1;15` tampoco. | 102, 105, 106, 110, 111 | confirmado |

### Hipótesis

`m` solo se acepta si es un string. Los no strings probados usan el mismo texto `falta m`. No se probó `m` objeto ni `m` array.

Un segmento vacío se detecta antes de interpretar el control. Solo se vio en mensajes que empiezan por `PING`.

El campo extra se ignora. Solo se vio `extra: 1` junto a un `PING` que no valida el contenido del control.

### Desconocido

Fórmula del control. Espacios, ceros a la izquierda y controles de más de dos dígitos en comandos que sí validan el control. Si todo comando desconocido con control válido usa `E301`. `m` con otros tipos. JSON con comentarios, BOM o cuerpo comprimido.

## 3. Comandos

Los ejemplos de la mañana muestran `PING`, `ALTA`, `CONSULTA`, `DEPOSITO`, `TRANSFER`, `ANULA` y un `SALDOS` rechazado. Los experimentos posteriores repitieron esos mensajes, no demuestran que la lista esté cerrada.

### Confirmado

| ID | Comportamiento | Evidencia | Confianza |
| --- | --- | --- | --- |
| CMD-01 | `PING;64`, `PING;1`, `PING;0`, `PING;5X`, `PING;XX`, `PING;64 ` y `ping;64` responden 200 y `{"pong":true}`. | 4, 43, 46, 47, 48, 50, 52 | confirmado |
| CMD-02 | `PING` sin control responde `E103`. `PING;64;1` responde `E302`. `PING` exige un segmento de control, pero los valores probados no se validan. | 41, 49, 46, 47 | confirmado |
| CMD-03 | `ALTA;Lucia;82` tras `POST /__reset` responde 201 y `{"cuentaId":"AC-0001"}`. `ALTA;Mateo;3` responde 201 y `{"cuentaId":"AC-0002"}`. | 62, 69, 70, 85, 86 | confirmado |
| CMD-04 | Repetir `ALTA;Lucia;82` creó `AC-0002`. El nombre duplicado no se rechazó. | 65 | confirmado |
| CMD-05 | `ALTA;Lucia;83` responde 400 y `E202`. No creó cuenta: el alta siguiente siguió en `AC-0001`. | 82, 85 | confirmado |
| CMD-06 | `CONSULTA;AC-0001;14` y `consulta;AC-0001;14` responden 200 y `{"cuenta_id":"AC-0001","saldo":0}` justo después del alta. | 63, 64 | confirmado |
| CMD-07 | `DEPOSITO;AC-0001;250000;86` responde 200 y `{"status":"recieved","operacionId":"OP-0001"}`. El texto es `recieved`. | 71 | confirmado |
| CMD-08 | `TRANSFER;AC-0001;AC-0002;40000;86` responde 200, `recieved` y `OP-0002`. La consulta de `AC-0002` queda en saldo 40000. | 72, 73 | confirmado |
| CMD-09 | `TRANSFER;AC-0001;AC-0002;120000;55` responde 422 y `{"error":"E506","mensaje":"límite excedido"}`. No ocupó `OP-0003`: la transferencia siguiente de 100000 recibió ese id. | 74, 75 | confirmado |
| CMD-10 | `TRANSFER;AC-0001;AC-0002;100000;12` responde 200, `recieved` y `OP-0003`. | 75 | confirmado |
| CMD-11 | `ANULA;OP-0003;66` responde 200 y `{"ok":true,"anulada":"OP-0003"}`. Repetida, responde 200 y `{"ok":false,"motivo":"ya anulada"}`. | 76, 77 | confirmado |
| CMD-12 | Tras anular esa transferencia de 100000, `CONSULTA;AC-0001;14` devolvió saldo 210000. La anulación revirtió esa transferencia. | 78 | confirmado |
| CMD-13 | `ANULA;OP-0003;66` sin operaciones responde 404 y `{"error":"E402","mensaje":"operación inexistente"}`. | 81 | confirmado |
| CMD-14 | `SALDOS;AC-0001;38`, `saldos;AC-0001;38` y `SaldoS;AC-0001;38` responden 400 y `{"error":"E301","mensaje":"comando desconocido "}`. El espacio final forma parte del texto. | 53, 58, 59 | confirmado |
| CMD-15 | `DEPOSITO;AC-0001;250000;86` sin cuenta responde 404 y `E401`. El alta siguiente sigue en `AC-0001`. | 84, 85 | confirmado |
| CMD-16 | `TRANSFER;AC-0002;AC-0001;50000;23` con ambas cuentas en saldo 0 responde 422 y `{"error":"E507","mensaje":"saldo insuficiente"}`. Las dos consultas posteriores siguen en saldo 0. | 87, 92, 93, 94 | confirmado |
| CMD-17 | `alta`, `deposito`, `transfer` y `anula` en minúsculas se aceptan con el mismo control que la forma en mayúsculas. | 113, 118, 119, 125 | confirmado |
| CMD-18 | `anula;OP-0001;72` sobre un depósito de 250000 responde `ok true` y la consulta posterior queda en saldo 0. Anular un depósito revierte ese importe. | 124, 125, 126 | confirmado |

### Hipótesis

`PING` no valida el contenido del control y los demás comandos sí. No se probó otro comando con control `5X` que además tuviera aridad correcta y control numérico válido.

Los seis comandos observados ignoran mayúsculas en el nombre del comando. No se probó un nombre de persona en otra grafía: `Lucia` y `lucia` pueden tener controles distintos.

`SALDOS` no está reconocido en ese mensaje. Eso no demuestra que no exista con otra aridad o que el servicio no lo añada después.

El límite de transferencia está por encima de 100000 y no admite 120000 en el caso probado. El umbral exacto no se midió.

La anulación revierte la transferencia probada y el depósito probado. No se anuló una transferencia y un depósito encadenados de forma que el saldo quedara negativo.

### Desconocido

Fórmula del control. Importes 0, negativos, con ceros a la izquierda o mayores que los probados. Transferencia a la misma cuenta, cuenta origen inexistente y destino inexistente. Anulación de un depósito. Identificadores después de `AC-0002` y `OP-0003` sin reset. Si un nombre distinto de `Lucia` también puede duplicarse: solo se repitió ese nombre.

## 4. Memoria entre requests

### Confirmado

| ID | Comportamiento | Evidencia | Confianza |
| --- | --- | --- | --- |
| MEM-01 | `POST /__reset` con Bearer válido borra las cuentas de ese token. `CONSULTA;AC-0001;14` pasa de saldo 0 a 404 `E401` después del reset. | 62, 63, 66, 67 | confirmado |
| MEM-02 | Tras reset, la siguiente alta vuelve a `AC-0001` y la siguiente a `AC-0002`. Los depósitos y transferencias aceptados vuelven a `OP-0001`, `OP-0002` y `OP-0003`. | 62, 65, 69, 70, 71, 72, 75 | confirmado |
| MEM-03 | El saldo sobrevive entre requests del mismo token hasta el reset: el depósito y la transferencia de 40000 se ven en la consulta posterior. | 71, 72, 73 | confirmado |
| MEM-04 | `X-Req` de `POST /msg` aumentó de uno en uno en esta sesión, también en errores de `/msg`. `POST /__reset`, `GET /health` y `GET /no-existe` no lo devolvieron ni lo incrementaron. El reset no lo reinició. | 4, 5, 7, 8, 10, 19, 21, 32 | confirmado |
| MEM-05 | El primer `POST /msg` de la sesión devolvió `X-Req` 2. El valor previo a esta sesión no se observó. | 4 | confirmado |

### Hipótesis

`X-Req` cuenta solo `POST /msg` aceptados por la ruta, no el resultado funcional. Encaja con los saltos observados, pero no se probaron todas las rutas.

El estado está aislado por token. El token inválido no llega a leer cuentas porque falla antes con `E001`.

### Desconocido

Estado compartido entre dos tokens válidos. Si `X-Req` se reinicia en algún momento del día. Persistencia después de reiniciar el proceso del original. Efecto de un reset con cuerpo cuando hay cuentas.

## 5. Errores

### Confirmado

| ID | Comportamiento | Evidencia | Confianza |
| --- | --- | --- | --- |
| ERR-01 | 401 `E001` `no autorizado`: falta el header o el Bearer no es válido, en `/health`, `/msg` y `/__reset`. | 11, 12, 13, 16, 17, 18 | confirmado |
| ERR-02 | 404 `E404` `ruta desconocida`: ruta o método no registrado, antes de la autenticación. | 15, 20, 22, 23, 28, 29, 31 | confirmado |
| ERR-03 | 400 `E100` `json inválido`. | 32, 38, 39 | confirmado |
| ERR-04 | 400 `E102` `falta m`. | 33, 34, 36, 40, 97, 98 | confirmado |
| ERR-05 | 400 `E103` `falta control`. | 35, 41 | confirmado |
| ERR-06 | 400 `E104` `segmento vacío`. | 42, 51 | confirmado |
| ERR-07 | 400 `E201` `control mal formado`. | 45, 54, 55 | confirmado |
| ERR-08 | 400 `E202` `control inválido`. | 44, 82 | confirmado |
| ERR-09 | 400 `E301` `comando desconocido `, con espacio final, para las tres grafías probadas de `SALDOS;AC-0001;38`. | 53, 58, 59 | confirmado |
| ERR-10 | 400 `E302` `aridad inválida`. | 49, 83 | confirmado |
| ERR-11 | 404 `E401` `cuenta inexistente`. | 61, 67, 84 | confirmado |
| ERR-12 | 404 `E402` `operación inexistente`. | 81 | confirmado |
| ERR-13 | 422 `E506` `límite excedido`. | 74 | confirmado |
| ERR-14 | 422 `E507` `saldo insuficiente`. No cambió los saldos en el caso con saldo 0. | 87, 92, 93, 94 | confirmado |
| ERR-15 | Orden observado en `POST /msg` con Bearer válido: JSON, presencia de `m` string, control presente, segmento vacío, forma del control, valor del control, comando o aridad, después existencia de cuenta u operación. `PING` no aplica el valor ni la forma del control. | 14, 39, 34, 35, 42, 45, 44, 54, 84, 81 | confirmado |

### Hipótesis

`E301` siempre lleva espacio final. Se vio en `SALDOS;AC-0001;38` y `SALDOS;AC-0002;35`, no en otro nombre de comando.

`E506` no crea operación. Se infiere porque el id siguiente fue `OP-0003`, no porque se consultara una lista de operaciones.

### Desconocido

Otros códigos. Si `E507` con saldo parcial usa el mismo cuerpo: el ejemplo de la mañana tenía saldo 40000 y estos experimentos usaron saldo 0. El texto coincidió; el estado previo no. Precedencia entre cuenta inexistente y saldo insuficiente. Precedencia entre operación inexistente y ya anulada cuando el control es válido y la operación no existe: solo se vio `E402`.

## 6. Cambios durante el día

### Confirmado

No hay evidencia de un cambio entre `ejemplos.jsonl` y los experimentos del 2026-10-10 para los mensajes repetidos. Coincidieron status y cuerpo en `PING;64`, `ALTA;Lucia;82`, `ALTA;Lucia;83`, `ALTA;Mateo;3`, `CONSULTA;AC-0001;14` tras el alta, `DEPOSITO;AC-0001;250000;86`, `TRANSFER` de 40000, 120000 y 100000, `SALDOS;AC-0001;38`, `ANULA;OP-0003;66` y su repetición, y `ALTA;Lucia;Gomez;11`.

`ejemplos.jsonl` no trae hora. No se atribuye una causa a esa coincidencia.

### Hipótesis

Ninguna diferencia temporal queda pendiente de explicación, porque no se observó una diferencia en los mensajes repetidos.

### Desconocido

`CONSULTA;AC-0009;87`, `DEPOSITO;AC-0002;700;5X` y `DEPOSITO;AC-0002;700;35` no se repitieron. `TRANSFER;AC-0002;AC-0001;50000;23` se repitió con saldo 0, no con saldo 40000. El ejemplo de la mañana `CONSULTa;AC-0001;14` no se repitió en esa grafía; sí se probó `consulta;AC-0001;14`.

## 7. Riesgos

### Confirmado

| ID | Comportamiento | Evidencia | Confianza |
| --- | --- | --- | --- |
| RIE-01 | `PING` acepta controles no numéricos y con espacio. Un cliente no debería copiar esa laxitud. | 43, 47, 52 | confirmado |
| RIE-02 | El error de comando desconocido observado incluye un espacio final. Hay que reproducirlo, no corregirlo. | 53, 58, 59 | confirmado |
| RIE-03 | El depósito aceptado dice `recieved`, no `received`. `ALTA` devuelve `cuentaId` y `CONSULTA` devuelve `cuenta_id`. | 62, 63, 71 | confirmado |
| RIE-04 | Se puede repetir el mismo nombre de alta. | 65 | confirmado |
| RIE-05 | No hay fórmula general confirmada para el control de `ALTA`, `DEPOSITO` y `TRANSFER`. Los experimentos 102, 110 y 111 descartaron dos predicciones. | 102, 110, 111 | confirmado |

### Hipótesis

El límite de 100000 aceptado y 120000 rechazado puede no ser el umbral real. El reemplazo rechaza importes mayores que 100000 como supuesto, no como hecho medido.

Un control numérico de `ALTA`, `DEPOSITO` o `TRANSFER` que el reemplazo no sabe calcular se acepta, salvo los mensajes ya observados como inválidos. Eso no es una regla del original.

### Desconocido

Fórmula del control. Aislamiento entre tokens válidos. Comandos no vistos. Umbral exacto de transferencia. Efectos de anular un depósito. Comportamiento si el original cambia después del 2026-10-10.
