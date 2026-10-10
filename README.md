# Reto 2 · La caja negra

Un servicio lleva 10 años en producción y nadie sabe qué hace. Recibe mensajes por HTTP y responde.
Tu equipo tiene que entenderlo y construir un reemplazo que responda exactamente igual, errores
incluidos.

No uses herramientas que hagan el trabajo por ti.

## Lo que recibes

- **La URL del servicio**: `https://caja-negra-production-c64f.up.railway.app`.
- **Un token por persona**, en `/evento`, en la tarjeta de tu reto. Cada request lleva
  `Authorization: Bearer <tu token>`. Cada token tiene su propio estado: lo que hagas con el tuyo no
  lo ve tu compañero.
- **`pruebas/ejemplos.jsonl`**: 20 requests con su respuesta, en el orden en que se mandaron después
  de empezar de cero. Se grabaron con la versión del servicio de la mañana.

Los mensajes van por `POST /msg`, con un cuerpo JSON como `{"m": "PING;64"}`. El servicio también
tiene `POST /__reset`, que vuelve tu token al estado inicial, y `GET /health`. Tu reemplazo también
las necesita (ver el contrato abajo).

## Las pruebas

Cada línea de `pruebas/ejemplos.jsonl` es un JSON con estos campos:

| Campo      | Qué es                                   |
| ---------- | ---------------------------------------- |
| `n`        | Posición en la secuencia                 |
| `id`       | Igual a `n`                              |
| `seq`      | La secuencia a la que pertenece          |
| `request`  | El cuerpo que se mandó a `POST /msg`     |
| `status`   | El status HTTP que respondió el original |
| `response` | El cuerpo que respondió el original      |

Los 20 ejemplos son una sola secuencia. Para reproducirlos, llama a `POST /__reset` y manda cada
`request` en orden.

## Qué entregas a las 20:00

1. **El reemplazo**, desplegado y accesible por internet, con este contrato:
   - `Authorization: Bearer <token>` en todas las llamadas. Es el token del equipo que ves en
     `/evento`, en la tarjeta de tu reto. Con otro token o sin token, responde como el original.
   - `GET /health` responde 200 cuando está listo.
   - `POST /__reset` vuelve el reemplazo a su estado inicial. Lo llamamos antes de cada test.
   - Cualquier otra ruta responde exactamente lo mismo que el original, incluidas las rutas que no
     existen.
2. **La especificación**: un documento que permita a otro ingeniero reimplementar el servicio sin
   tocar el original. Estructura abajo.
3. **El log de experimentos** (`experimentos.jsonl`): una línea por cada request que le mandaste al
   original, con la hipótesis que estabas probando. Formato abajo.

### El log de experimentos

Una línea JSON por request al original:

```json
{
  "id": 1,
  "seq": "s1",
  "x_req": 1,
  "hipotesis": "PING responde sin estado",
  "request": { "m": "PING;XX" },
  "status": 200,
  "response": { "pong": true },
  "conclusion": "responde pong aunque el último campo no sea un número"
}
```

| Campo        | Qué es                                                            |
| ------------ | ----------------------------------------------------------------- |
| `id`         | Número de línea, único. La especificación cita estos números      |
| `seq`        | La secuencia. Todas las líneas de una secuencia van tras un reset |
| `x_req`      | El valor del header `X-Req` de la respuesta                       |
| `hipotesis`  | Qué estabas probando con este request                             |
| `request`    | El cuerpo que mandaste                                            |
| `status`     | El status que respondió el original                               |
| `response`   | El cuerpo que respondió el original                               |
| `conclusion` | Qué aprendiste. Opcional                                          |

### La especificación

Cada comportamiento lleva un ID, su descripción, la evidencia (los `id` del log que lo prueban) y tu
confianza:

- **confirmado**: lo probaste y se repite.
- **probable**: lo viste una vez o lo infieres.
- **supuesto**: no lo probaste y es lo que hace tu reemplazo por defecto.

Organízala en estas secciones, con una tabla `ID | Comportamiento | Evidencia | Confianza` en cada
una:

1. **Entrada**: rutas, métodos, autenticación, forma del cuerpo y límites.
2. **Integridad**: cómo valida el servicio que un mensaje está bien formado.
3. **Comandos**: un bloque por comando, con sus argumentos, su efecto y su respuesta.
4. **Memoria entre requests**: qué recuerda el servicio y qué cambia una respuesta según los
   requests anteriores.
5. **Errores**: cada error con su status, su cuerpo exacto y en qué orden se evalúa frente a los
   otros errores.
6. **Cambios durante el día**: qué cambió, desde cuándo y cómo lo detectaste.
7. **Riesgos**: comportamientos que un cliente nuevo no debería heredar y cómo los cerrarías.

## Cómo se evalúa

**Set de evaluación.** Son 100 tests. Corren contra tu reemplazo cada vez que validas el entrypoint
en `/evento`, y en `/evento/resultados` ves cuántos pasan. Después de las 20:00 los corremos una vez
más sobre el último entrypoint que entregaste a tiempo, y ese resultado es el que cuenta. Cada test
empieza con `POST /__reset`. Hay 40 de un request, 45 secuencias de 2
a 5 requests y 15 secuencias de 6 a 12. Ningún test repite la secuencia de `pruebas/ejemplos.jsonl`.

Un test pasa si cada respuesta que comparamos tiene:

- el mismo status HTTP, y
- el mismo cuerpo. Si los dos cuerpos son JSON, las claves de un objeto pueden venir en cualquier
  orden, los arrays van en el mismo orden y los strings y números tienen que ser idénticos. Si alguno
  de los dos no es JSON, se compara el texto exacto, carácter por carácter.

Los headers no se comparan. Cada paso tiene 5 segundos para responder.

**Especificación.** Un juez la lee contra la lista completa de comportamientos del servicio.
Cada comportamiento cuenta si está bien descrito y cita una línea de tu log que lo prueba. Una
afirmación falsa resta.

## Reglas

- El reemplazo no puede llamar al original ni a otro reemplazo. Si lo hace, el set vale 0.
- Puedes usar un LLM dentro del reemplazo, siempre que responda en 5 segundos por paso.
- Scripts y fuzzers propios están permitidos.
- Nada de lo que hagas con tu token es irreversible: `POST /__reset` lo repara.
- Los tokens de tu equipo exploran en paralelo con estados separados. Es una estrategia válida.
- Cada token admite 10 requests por segundo y 8.000 por día. Si te pasas, la respuesta trae el
  header `X-Frontier-Infra: rate-limit`. Esa respuesta es de la infraestructura y no del servicio.
- El servicio puede cambiar durante el día. Tu reemplazo se evalúa contra la versión vigente a las
  20:00.
- A las 20:00 los tokens de participante dejan de funcionar contra el original.
- El set le habla a un solo proceso. Si tu plataforma levanta varias instancias del reemplazo, cada
  una tendrá su propio estado.
- Si tu reemplazo no sabe qué responder ante algo, decide qué hace por defecto y anótalo en la
  especificación como **supuesto**.

## Ejecución local del reemplazo

El servidor base está en `src/` y se arranca con `src/server.ts`. No llama al servicio original.
El estado vive en memoria, aislado por token, y se pierde al reiniciar el proceso. Hay que
desplegar una sola instancia.

Las respuestas actuales no reproducen el contrato confirmado del original. `GET /health` devuelve
200 con cuerpo vacío para cumplir el requisito de “listo”; el cuerpo real no se ha medido.
`POST /__reset` reinicia el estado del token y responde 200 con cuerpo vacío: ese status y ese
cuerpo son un supuesto. `POST /msg` responde 501 con `{"provisional":true,"route":"POST /msg"}`
porque los comandos todavía no están caracterizados. Las rutas o métodos no registrados responden
404 con un JSON provisional, no con el HTML por defecto de Express.

```bash
npm install
npm test
npm run build
npm start
```

En desarrollo, `npm run dev` recompila al guardar. El puerto sale de `PORT` y, si no existe, es
`3000`. El proceso escucha en `0.0.0.0`.

No hace falta un archivo `.env` para arrancar. `.env.example` documenta `PORT` y las variables que
solo podrán usar las herramientas de laboratorio. Esas herramientas no forman parte de este proceso.

## Laboratorio

El laboratorio vive en `tools/` y se ejecuta aparte del servidor. `npm start` no lo carga y `src/`
no lo importa. Solo esta herramienta puede llamar al servicio original.

```bash
cp .env.example .env
# Edita .env y pon PARTICIPANT_TOKEN. No lo pases como argumento ni lo subas.
npm run lab --silent -- --help
npm run lab --silent -- probe --dry-run --seq s0 --hipotesis "GET /health responde 200" --method GET --path /health
npm run lab --silent -- probe --seq s1 --hipotesis "GET /health responde 200" --method GET --path /health
npm run lab --silent -- sequence --file secuencia.json
```

Usa `--silent`. Sin esa opción, npm imprime los argumentos antes de que el laboratorio pueda
redactarlos. El token no debe ir en la hipótesis, en la ruta ni en ningún otro argumento.

Una secuencia es un JSON con `seq` y `steps`. Cada paso necesita `method`, `path` e `hipotesis`.
El laboratorio no inserta `POST /__reset`: si la secuencia debe empezar de cero, el reset va como
paso explícito. No lances una secuencia sin una hipótesis por paso.

Cada invocación nueva envía solicitudes reales, salvo `--dry-run`. No hay reintentos automáticos.
Si el proceso se interrumpe, conserva el `attempt-prefix` impreso y repite con `--attempt-prefix`:
el mismo intento no se reenvía ni se duplica en el log. Una invocación sin ese prefijo es un
intento nuevo y vuelve a consumir cuota.

El ritmo local mínimo es 120 ms entre solicitudes y no puede bajar de 100 ms. El contador local
se detiene en 8000 solicitudes por día UTC. Una respuesta con `X-Frontier-Infra` se registra, se
marca en `conclusion` y no debe usarse como evidencia del servicio. Un fallo de conexión o un
tiempo de espera también se registra, con `status`, `response` y `x_req` en `null`: eso significa
ausencia, no un código observado. Esas líneas no son evidencia funcional.

`request` es el cuerpo enviado. Si no había cuerpo, queda `null`. El método y la ruta no forman
parte del esquema oficial, así que no se añaden como campos; deben quedar en `hipotesis` y en la
salida del comando. `x_req` se guarda como número solo cuando el header es un entero completo;
en otro caso se conserva el texto. Un cuerpo no JSON se guarda como texto exacto.

Las pruebas de `tests/lab-*.test.ts` son simuladas. No escriben el `experimentos.jsonl` del
repositorio ni contactan el original.

La especificación inicial del original está en `docs/service-spec.md`. Cita los identificadores de
`experimentos.jsonl`. El servidor de `src/` todavía no la implementa.
