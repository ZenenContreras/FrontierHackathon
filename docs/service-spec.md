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

### Hipótesis

El control numérico de cualquier comando distinto de `PING` es `(1 - 3R) mod 97`. `R` es el entero del mensaje sin el segmento de control: cada letra, sin distinguir mayúsculas, vale su posición `A=1` … `Z=26`; los dígitos se conservan; el resto de caracteres, incluidos `;` y `-`, se omite. Reproduce los controles válidos de `ALTA`, `DEPOSITO`, `TRANSFER`, `CONSULTA`, `SALDOS` y `ANULA`, y rechaza los inválidos de los ids 44, 82, 100, 102, 105, 106, 107, 108, 110 y 111. En `AC-` y `OP-` de cuatro dígitos coincide con `(17 - 3n)`, `(41 - 3n)` y `(75 - 3k) mod 97`. No se envió un mensaje nuevo al original para contrastarla fuera de esos registros.

### Desconocido

Espacios, ceros a la izquierda y controles de más de dos dígitos en comandos que sí validan el control. Si todo comando desconocido con control válido usa `E301`: `SALDOS` con control válido sí; `NOPE;2` no se midió. `m` con otros tipos. JSON con comentarios, BOM o cuerpo comprimido.

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

Fórmula del control. Importes 0, negativos, con ceros a la izquierda o mayores que los probados. Importe de transferencia igual al saldo. Transferencia a la misma cuenta, cuenta origen inexistente y destino inexistente. Anulación de un depósito después de una transferencia que ya gastó parte de ese saldo. Identificadores después de `AC-0002` y `OP-0004` sin reset: `OP-0004` solo aparece en `ejemplos.jsonl` n=18. Si un nombre distinto de `Lucia` también puede duplicarse: solo se repitió ese nombre.

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

El enunciado del reto afirma que cada token tiene estado independiente. No hay experimento con dos Bearer válidos, así que el aislamiento entre tokens válidos no está medido en el original. El token inválido no llega a leer cuentas porque falla antes con `E001`.

### Desconocido

Estado compartido o aislado entre dos tokens válidos. Si `X-Req` se reinicia en algún momento del día. Persistencia después de reiniciar el proceso del original. Efecto de un reset con cuerpo cuando hay cuentas. Si `E507` consume un identificador de operación.

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

`ejemplos.jsonl` no trae hora. No se atribuye una causa a esa coincidencia. Ese párrafo no cubre la versión 2.

### Confirmado en la versión 2

| ID | Comportamiento | Evidencia | Confianza |
| --- | --- | --- | --- |
| V2-01 | `CONSULTA` devuelve `saldo` string con dos decimales, igual al entero de V1 dividido por 100, en los estados medidos: `"0.00"`, `"400.00"` y `"2100.00"`. | 149, 157, 162, 168, 175, 176 | confirmado en esos estados |
| V2-02 | `TRANSFER;AC-0001;AC-0002;100000;12` responde 422 `E506` donde el id 75 respondió 200. `40000` sigue aceptándose y `120000` sigue en `E506`. | 148, 150, 167, 169, 170 | confirmado |
| V2-03 | `E507` con saldo 0 y la anulación de un depósito coinciden con V1 en las secuencias medidas, salvo el formato de saldo ya citado. | 161, 162, 174, 175, 176 | confirmado en esas secuencias |

No hay una tercera diferencia funcional en las capturas 128–176. No se midió si un `E506` consume id, ni el umbral entre 40000 y 100000, ni otros importes de `CONSULTA`.

### Hipótesis

Ninguna diferencia temporal queda pendiente de explicación entre los ejemplos de la mañana y los experimentos 1–127, porque no se observó una diferencia en los mensajes repetidos. La versión 2 sí tiene las dos diferencias de la tabla anterior. El tercer cambio anunciado sigue sin evidencia.

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
| RIE-05 | Los experimentos 102, 110 y 111 descartaron dos predicciones lineales. La fórmula de la sección 2 encaja con todos los controles registrados; no hubo una sonda nueva. | 102, 110, 111 | confirmado el descarte; la fórmula general no se volvió a medir |

### Hipótesis

En V1, 100000 se aceptó y 120000 se rechazó. En V2, los ids 170 y 150/169 rechazan 100000 y 120000 con E506, y el id 148 acepta 40000. El umbral entre 40000 y 100000 no se midió. El reemplazo rechaza `importe >= 100000`. Eso reproduce lo observado; no demuestra que todo importe menor sea válido.

### Desconocido

Aislamiento entre dos tokens válidos. Comandos no vistos. Umbral exacto de transferencia. Anulación cuando la operación dependiente ya movió parte del saldo. Comportamiento si el original cambia después del 2026-10-10.

## 8. Estado y secuencias

Esta sección no añade solicitudes al original. El reloj local ya pasaba de las 20:00 UTC del 2026-10-10, cuando los tokens de participante dejan de valer contra el original. No se gastó cuota en el paso 5.

### Qué se probó con evidencia ya registrada

| ID | Qué se probó | Qué se observó | Evidencia | Confianza |
| --- | --- | --- | --- | --- |
| SEQ-01 | Alta y consulta en el mismo token. | `ALTA;Lucia;82` crea `AC-0001`. La consulta inmediata devuelve `cuenta_id` y saldo 0. | 62, 63 | confirmado |
| SEQ-02 | Varias altas. | La segunda `ALTA;Lucia;82` crea `AC-0002`. `ALTA;Mateo;3` también crea `AC-0002` si es la segunda alta. El nombre repetido no se rechaza. | 65, 69, 70 | confirmado |
| SEQ-03 | Reset y contadores de cuentas y operaciones. | Tras `POST /__reset`, `AC-0001` ya no existe. La siguiente alta vuelve a `AC-0001`. Las operaciones aceptadas vuelven a `OP-0001`. | 66, 67, 69, 71 | confirmado |
| SEQ-04 | Depósito, transferencia y consulta. | El depósito de 250000 es `OP-0001`. La transferencia de 40000 es `OP-0002` y `AC-0002` queda en 40000. | 71, 72, 73 | confirmado |
| SEQ-05 | Segundo depósito en otra cuenta, solo en la secuencia de la mañana. | Tras la transferencia de 40000 y un depósito de 700 en `AC-0002`, la consulta devuelve 40700 y `OP-0004`. No se repitió en `experimentos.jsonl`. | `ejemplos.jsonl` n=18, n=19 | probable |
| SEQ-06 | Depósito en cuenta inexistente. | 404 `E401`. La alta siguiente sigue en `AC-0001`. | 84, 85 | confirmado |
| SEQ-07 | Transferencia mayor que el saldo 0. | 422 `E507`. Las dos consultas posteriores siguen en 0. | 92, 93, 94 | confirmado |
| SEQ-08 | Transferencia de 120000 y después una de 100000. | 422 `E506` y la aceptada recibe `OP-0003`, no un id posterior. El rechazo no ocupó ese id. | 74, 75 | confirmado |
| SEQ-09 | Importe superior al saldo de 40000 en la secuencia de la mañana. | `TRANSFER;AC-0002;AC-0001;50000;23` respondió `E507`. El estado previo de esa línea no se volvió a medir. | `ejemplos.jsonl` n=16; experimentos 87, 92 | confirmado el texto con saldo 0; probable el mismo texto con saldo 40000 |
| SEQ-10 | Anular una transferencia y repetir la anulación. | La primera devuelve `ok true`. La segunda, `ok false` y `ya anulada`. `AC-0001` queda en 210000. | 76, 77, 78 | confirmado |
| SEQ-11 | Anular un depósito sin operaciones posteriores. | `anula;OP-0001;72` devuelve `ok true` y la consulta queda en 0. | 124, 125, 126 | confirmado |
| SEQ-12 | Anular una operación inexistente. | 404 `E402`. No impide el alta siguiente. | 81, 85 | confirmado |
| SEQ-13 | Error intercalado. | `E202`, `E401`, `E506` y `E507` no impiden la operación válida siguiente en las secuencias citadas. | 82, 85, 74, 75, 92, 93 | confirmado |
| SEQ-14 | Secuencia mixta de 20 mensajes. | `pruebas/ejemplos.jsonl` es una sola secuencia de la mañana. Los mensajes repetidos el 2026-10-10 coincidieron. | sección 6; `ejemplos.jsonl` | confirmado en los mensajes repetidos |
| SEQ-15 | `X-Req` frente al reset. | El reset no reinicia `X-Req`. `/health` y `/__reset` no lo devuelven. | 4, 6, 7 | confirmado en el original |

### Qué se implementó

El reemplazo guarda cuentas, operaciones y los dos contadores en memoria, separados por el Bearer aceptado. `POST /__reset` sustituye solo ese estado por el estado inicial. Una operación rechazada por cuenta inexistente, límite o saldo no mueve saldos ni consume el id en los casos ya observados. Anular una transferencia o un depósito observados revierte ese importe y una segunda anulación no lo vuelve a aplicar.

Eso está cubierto por `tests/sequences.test.ts`, `tests/commands.test.ts`, `tests/store.test.ts` y la regresión de `tools/sequences`.

El paso 6 no llamó al original. Se compararon en local status y cuerpo de 126 líneas con vínculo de ledger y cuerpo igual a `request`. `s6b` no tiene archivo de secuencia y no se reenvía. Las 20 líneas de `pruebas/ejemplos.jsonl` coincidieron tras un sobre que el archivo no contiene. El log no guarda método, ruta ni `Authorization`. La limitación está en `docs/cobertura.md`. No hubo líneas con `status` nulo ni `X-Frontier-Infra`. El reemplazo no emite `X-Req`. La evaluación no compara headers, y el valor absoluto de ese contador no se puede exigir en un proceso nuevo porque la primera observación ya era 2.

### Qué sigue siendo hipótesis o desconocido

| Tema | Estado |
| --- | --- |
| Aislamiento entre dos tokens válidos del original | No verificado. Solo hay un token de participante y no se usaron credenciales ajenas. El enunciado lo exige. El reemplazo aísla por Bearer con tokens de prueba locales. |
| `/__reset` de un token sobre el estado de otro en el original | No verificado por la misma razón. En el reemplazo, el reset de un token no borra el otro. |
| Reinicio del proceso del original | Desconocido. En el reemplazo, un proceso nuevo no conserva el `Map` en memoria. Eso no es lo mismo que `POST /__reset`: el reset es una petición al proceso vivo y solo afecta al token autenticado. |
| Importe de transferencia igual al saldo | Desconocido. No hay un mensaje con control ya observado para ese importe. El reemplazo trata `importe > saldo` como insuficiente. El límite `importe >= 100000` reproduce V2 ids 148, 150, 169 y 170; no está medido el intervalo (40000, 100000). |
| Transferencia con origen o destino inexistente | Desconocido. El reemplazo responde `E401` antes de mover saldos. No es una observación. |
| Anular un depósito después de una transferencia que ya usó parte de ese saldo | Desconocido. No se midió si el original lo rechaza o deja un saldo negativo. El reemplazo resta el importe anulado; eso es un supuesto para ese caso. |
| Saldo exacto de la cuenta destino después de anular `OP-0003` | No consultado. Sí se consultó el origen, que quedó en 210000. `ejemplos.jsonl` n=16 es compatible con que el destino no conservara los 100000, pero no demuestra el saldo exacto. |
| `E507` y el contador de operaciones | Desconocido. Sí se sabe que no cambió los saldos en 0. |
| `POST /__reset` con cuerpo mientras hay cuentas | Desconocido. Con cuerpo y sin cuentas respondió `{"ok":true}`. |
| `X-Req` en el reemplazo | El original lo envió en 87 líneas y no lo reinició con el reset. El reemplazo no lo emite. No es una diferencia de status ni de cuerpo, que son lo que compara la evaluación. El valor inicial observado fue 2. |
| `AC-0003` y ids posteriores no vistos | El reemplazo continúa la numeración de cuatro dígitos. Solo están observados `AC-0001`, `AC-0002`, `OP-0001` a `OP-0003` en experimentos, y `OP-0004` en los ejemplos de la mañana. |

