# Diseño del reemplazo — Reto 2: La caja negra

## 1. Objetivo

Construir un servicio HTTP que reproduzca el comportamiento observable del servicio original. La evaluación compara el **status HTTP y el cuerpo** de cada respuesta. Para JSON compara valores (el orden de las claves no importa, pero sí el de los arrays); para respuestas no JSON compara el texto exacto. Cada paso tiene un límite de 5 segundos.

El evaluador ejecuta pruebas de una o varias peticiones contra un solo proceso. Cada prueba empieza con `POST /__reset`. Los 20 casos de `pruebas/ejemplos.jsonl` sirven como referencia inicial, pero no se repiten en el conjunto evaluado.

**Criterio principal:** no basta con implementar comandos que parezcan correctos. Hay que reproducir respuestas, errores y cambios de estado tal como se observen en el original.

## 2. Alcance

### Incluido

- `POST /msg`, con mensajes como `{"m":"PING;64"}`.
- `POST /__reset`, para restablecer el estado asociado al token.
- `GET /health`.
- Aislamiento de estado por token y persistencia del estado entre peticiones del mismo test.
- Reproducción exacta de status y cuerpo, incluidos errores y respuestas no JSON.
- Pruebas unitarias, HTTP y secuenciales; comparación diferencial durante el desarrollo.
- Registro de las consultas al original en `experimentos.jsonl`.

### No incluido

- Rediseñar el protocolo o corregir sus errores y particularidades.
- Llamar al servicio original desde el reemplazo desplegado.
- Microservicios, base de datos o LLM en el camino de respuesta.
- Suponer que los 20 ejemplos describen todos los comandos o todas las reglas.

## 3. Hechos disponibles y límites de la evidencia

`pruebas/ejemplos.jsonl` contiene una secuencia de 20 peticiones de la versión de la mañana. En ella aparecen `PING`, `ALTA`, `CONSULTA`, `DEPOSITO`, `TRANSFER` y `ANULA`. También aparecen errores relacionados con el control, la aridad, una cuenta inexistente, un límite de transferencia y saldo insuficiente.

Los ejemplos muestran detalles que deben conservarse si se confirman en la versión evaluada: `recieved` como valor de respuesta, diferencias entre `cuentaId` y `cuenta_id`, un espacio final en el mensaje de comando desconocido y una segunda anulación con `ok: false`.

Estos ejemplos **no demuestran** por sí solos la fórmula del campo de control, el orden general de validación, el comportamiento de rutas no documentadas, la autenticación inválida ni los límites exactos. `experimentos.jsonl` está vacío en el estado revisado; por tanto, todavía no hay experimentos propios que respalden nuevas conclusiones. No se afirma que las pruebas hayan sido ejecutadas ni que el reemplazo haya pasado la evaluación.

## 4. Arquitectura

Se propone un **monolito modular en un solo proceso Node.js**, implementado con Express y TypeScript. Es suficiente para el contrato conocido: el evaluador usa una instancia, el estado debe mantenerse entre pasos y el reset debe ser explícito.

El diagrama se mantiene en [`docs/architecture.md`](architecture.md) para que pueda previsualizarse por separado y no reducir el espacio del documento de diseño. Incluye dos vistas: el flujo del servicio desplegado y el laboratorio de desarrollo.


El laboratorio y el servicio desplegado son entornos separados. Solo las herramientas de desarrollo pueden consultar el original. El servidor desplegado no debe importar ni invocar un cliente del original.

### Responsabilidades

| Componente | Responsabilidad |
|---|---|
| Rutas y handlers | Recibir método, ruta, headers y cuerpo; devolver el status y cuerpo producidos por el núcleo. |
| Contexto de petición | Identificar el token y seleccionar su estado aislado. |
| Parser | Interpretar el campo `m` sin normalizar datos salvo que la evidencia lo justifique. |
| Validador | Aplicar las validaciones en el orden observado. |
| Dispatcher y comandos | Ejecutar el comando correspondiente y producir su resultado. |
| Estado en memoria | Mantener cuentas, operaciones e identificadores que se confirmen experimentalmente; implementar el reset por token. |
| Constructor de respuesta | Emitir JSON, texto o cuerpo vacío según corresponda, sin cambiar tipos ni contenido. |
| Laboratorio | Consultar el original, guardar cada experimento y comparar resultados. No forma parte del runtime desplegado. |

### Flujo de `POST /msg`

1. Express recibe la petición.
2. Se obtiene el token y el cuerpo de la petición.
3. Se interpreta `m` y se validan sus campos.
4. Se ejecuta el comando usando el estado correspondiente al token.
5. El núcleo devuelve la respuesta y el estado siguiente.
6. El adaptador HTTP escribe el status y el cuerpo sin añadir formatos propios.

El orden real de autenticación, análisis del cuerpo y validación debe medirse. Los errores por defecto de Express no se consideran equivalentes al original sin compararlos.

### Estado y despliegue

El estado inicial se mantiene en memoria y separado por token. Debe persistir entre las peticiones de un test y restablecerse mediante `POST /__reset`. Esta opción es simple y coherente con la evaluación sobre un solo proceso, pero un reinicio del proceso elimina el estado y distintas instancias no lo comparten. El despliegue debe ejecutarse con una sola instancia.

El modelo concreto de cuentas, operaciones, saldos e identificadores se implementará según la evidencia. No se fijan reglas bancarias ni campos adicionales por intuición.

## 5. Decisiones principales

| Decisión | Por qué se escoge | Alternativa descartada y motivo | Coste o límite |
|---|---|---|---|
| Express + TypeScript | Express permite controlar rutas, status y cuerpos HTTP; TypeScript ayuda a mantener explícitos los tipos del protocolo. | Un framework más pesado añade estructura que no mejora la fidelidad observable. Un servidor HTTP sin framework reduce dependencias, pero exige implementar más infraestructura manual. | Hay que controlar el parseo y los errores por defecto de Express. |
| Monolito modular en un proceso | El reto describe una evaluación contra un proceso y requiere estado entre peticiones. Los módulos separan responsabilidades sin distribuir la ejecución. | Microservicios añaden comunicación, despliegue y puntos de fallo sin una necesidad demostrada; también complican el estado compartido. | Un fallo del proceso interrumpe el servicio. |
| Estado en memoria por token | Permite aislar sesiones y aplicar `reset` con poca complejidad; no se exige conservar el estado tras reiniciar. | Una base de datos aportaría persistencia, pero no es necesaria para las secuencias evaluadas y añade configuración y posibles diferencias de consistencia. | El reinicio borra el estado y varias instancias no lo comparten; se debe desplegar una sola instancia. |
| Lógica determinista | La evaluación compara status y cuerpo exactos; para una misma entrada y estado se necesita una salida reproducible. | Un LLM o reglas probabilísticas pueden variar el texto, los campos o la decisión, por lo que no son adecuados para este contrato. | Las reglas desconocidas deben investigarse y programarse explícitamente. |
| Pruebas diferenciales junto con pruebas locales | Comparar la misma petición contra el original ayuda a detectar diferencias de compatibilidad; las pruebas locales permiten repetir casos sin consumir cuota. | Solo pruebas unitarias no revelan si el reemplazo coincide con el original; probar manualmente no escala ni deja una regresión reproducible. | Las consultas al original consumen cuota y cada resultado debe registrarse. |
| Laboratorio separado del runtime | Permite consultar el original durante la investigación sin crear una dependencia desde el servicio evaluado. Cumple la restricción de no invocar el original desde el reemplazo. | Incluir el cliente original en el servidor desplegado arriesga una dependencia prohibida y podría invalidar la entrega. | Las herramientas de experimentación se mantienen fuera del despliegue. |

No se añade una base de datos, microservicios ni un LLM porque, con los requisitos disponibles, sus ventajas no justifican la complejidad adicional. Esta decisión se puede revisar si la evaluación exige persistencia tras reinicios o varias instancias coordinadas.

## 6. Plan de experimentación

Cada consulta al original debe tener una hipótesis concreta y una entrada controlada. Cuando sea posible, se cambia una sola variable por experimento. Las pruebas con estado deben empezar con reset y registrar la secuencia completa.

Prioridades:

1. **Borde HTTP:** token ausente o distinto, cuerpo vacío o malformado, campo `m` ausente o no string, métodos incorrectos y rutas desconocidas.
2. **Formato del mensaje:** separadores, campos ausentes o adicionales, campos vacíos y control no numérico.
3. **Validación:** fórmula del control y precedencia cuando una petición contiene dos errores.
4. **Estado:** alta, consulta, depósito, transferencia, anulación, doble anulación y consulta posterior a una mutación.
5. **Límites:** valores alrededor de los límites observados, sin generalizarlos a otros comandos.
6. **Cambios del servicio:** repetir una sonda corta antes del cierre para detectar diferencias respecto a los ejemplos de la mañana.

No se debe repetir la secuencia de ejemplos en bucle. Si una respuesta contiene `X-Frontier-Infra: rate-limit`, debe excluirse como evidencia del comportamiento del servicio y reducirse el ritmo de las consultas. El límite indicado por el reto es de 10 peticiones por segundo y 8000 por día por token.

Cada línea de `experimentos.jsonl` debe seguir el formato exigido por el reto: `id`, `seq`, `x_req`, `hipotesis`, `request`, `status` y `response`; `conclusion` es opcional. No se deben inventar identificadores de petición ni registrar como experimento una consulta que no se hizo.

## 7. Plan de pruebas y medición

El reto requiere 100 pruebas: 40 de una petición, 45 secuencias de 2–5 peticiones y 15 secuencias de 6–12 peticiones. Cada prueba debe empezar con reset y no debe repetir la secuencia de ejemplos proporcionada.

| Nivel | Qué comprueba | Límite |
|---|---|---|
| Unitario | Reglas de parsing, validación y transiciones de estado con entradas controladas. | No verifica por sí solo la compatibilidad HTTP. |
| Integración HTTP | Status y cuerpo producidos por las rutas del reemplazo. | Necesita resultados esperados fiables. |
| Secuencial | Estado, saldos e identificadores a lo largo de varias peticiones y después de reset. | Solo cubre las secuencias ejecutadas. |
| Diferencial | Compara el original y el reemplazo con la misma petición o secuencia. | Consume cuota del original. |
| Regresión | Repite localmente los casos ya investigados tras cada cambio. | Las fixtures pueden quedar obsoletas si cambia el original. |

### Métricas de aceptación

| Métrica | Cálculo | Objetivo |
|---|---|---|
| Fidelidad por paso | Pasos con status y cuerpo coincidentes / pasos comparados. | 100 % en el conjunto final. |
| Pruebas superadas | Pruebas con todos sus pasos correctos / pruebas ejecutadas. | 100 de 100. |
| Fidelidad de secuencia | Secuencias con todos los pasos correctos / secuencias ejecutadas. | 100 %. |
| Latencia | Tiempo entre enviar y recibir cada petición. | Menos de 5 segundos por paso. |
| Trazabilidad | Comportamientos confirmados con referencia a un experimento real / comportamientos confirmados. | 100 %. |

Estos valores son objetivos de aceptación, no resultados medidos. El estado revisado no contiene experimentos propios ni resultados de una suite ejecutada.

### Criterio de comparación

- El status HTTP debe coincidir exactamente.
- Si ambas respuestas son JSON, se comparan los valores; el orden de las claves no importa y el de los arrays sí.
- Si la respuesta no es JSON, se compara el cuerpo como texto exacto.
- No se corrigen typos, espacios, nombres de campos ni códigos de error si forman parte del comportamiento observado.
- Un test de secuencia se considera fallido si falla cualquier paso.

## 8. Riesgos principales

| Riesgo | Impacto | Mitigación |
|---|---|---|
| Llamar al original desde el runtime desplegado | Incumplimiento crítico del reto; puede invalidar el resultado. | Mantener el cliente original solo en las herramientas de desarrollo y revisar las dependencias del entrypoint. |
| Ajustar la solución solo a los 20 ejemplos | Fallos en comandos, errores o secuencias no vistas. | Ejecutar el conjunto de 100 pruebas y diseñar secuencias nuevas. |
| Dar por confirmada una hipótesis | Implementación de reglas equivocadas. | Separar evidencia, hipótesis y decisiones; citar el experimento correspondiente. |
| Usar respuestas por defecto de Express | Status o cuerpo distintos del original. | Medir casos HTTP de borde y controlar explícitamente las respuestas. |
| Compartir o perder estado | Secuencias incorrectas o resultados intermitentes. | Estado por token, reset reproducible y una sola instancia. |
| Confundir rate limit con respuesta del original | Incorporar datos de infraestructura como regla del protocolo. | Excluir respuestas marcadas con `X-Frontier-Infra: rate-limit`. |
| Cambio del original durante el día | Reglas de la mañana dejan de coincidir a la hora de evaluación. | Repetir sondas antes del cierre y documentar cualquier cambio con evidencia. |

## 9. Orden de implementación

1. Crear el servidor Express/TypeScript y las rutas requeridas.
2. Construir las herramientas separadas para consultar el original y escribir `experimentos.jsonl`.
3. Medir primero autenticación, reset, rutas, cuerpos inválidos y precedencia de errores.
4. Implementar parser, validación y comandos a partir de evidencia.
5. Añadir estado por token y pruebas de secuencia.
6. Ejecutar comparación diferencial y guardar los casos reproducibles como regresión.
7. Desplegar una sola instancia y validar el entrypoint público antes de la hora límite.
