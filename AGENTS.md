# Agents.md — Frontier Hackathon: La Caja Negra

## 1. Contexto del proyecto

Este repositorio contiene el trabajo para el **Reto 2: La caja negra** 

El objetivo es realizar ingeniería inversa de un servicio HTTP cuyo comportamiento no está completamente documentado y construir un reemplazo que reproduzca fielmente las respuestas del original.

El reemplazo debe coincidir con el servicio original en los aspectos que evalúa el reto, incluidos:

- Códigos de estado HTTP.
- Cuerpos de respuesta JSON y no JSON.
- Parsing y validación de mensajes.
- Comportamiento de comandos.
- Errores y orden de validación.
- Estado persistente entre requests.
- Comportamiento de rutas y métodos HTTP desconocidos.
- Efectos de `POST /__reset`.

La prioridad principal es la **compatibilidad observable con el servicio original**, no la implementación de funcionalidades nuevas ni la adopción de patrones arquitectónicos innecesarios.

## 2. Servicio original y contrato conocido

URL del servicio original:

`https://caja-negra-production-c64f.up.railway.app`

El servicio utiliza un token de participante enviado mediante:

`Authorization: Bearer <TOKEN>`

Cada token tiene su propio estado independiente.

### Endpoints documentados

| Método | Ruta | Comportamiento conocido |
|---|---|---|
| POST | `/msg` | Recibe mensajes mediante un cuerpo JSON, por ejemplo `{"m":"PING;64"}`. |
| POST | `/__reset` | Reinicia el estado asociado al token. |
| GET | `/health` | Endpoint de salud. |

Estas son las rutas documentadas, pero no se debe asumir que son las únicas combinaciones de rutas y métodos que importa reproducir.

El contrato del reto exige que el reemplazo responda como el original ante otras rutas, incluidas las inexistentes.

### Restricciones fundamentales

1. El reemplazo no puede realizar llamadas al servicio original ni a otro reemplazo durante su ejecución. Incumplir esta regla invalida la evaluación.
2. El evaluador utiliza un único proceso para ejecutar los tests.
3. Las instancias independientes no comparten automáticamente el estado en memoria.
4. Cada paso tiene un límite de cinco segundos.
5. Cada test comienza llamando a `POST /__reset`.
6. Los tokens del equipo tienen un límite de 10 requests por segundo y 8.000 requests por día.
7. Una respuesta con el header `X-Frontier-Infra: rate-limit` corresponde a la infraestructura y no debe interpretarse como comportamiento del servicio original.
8. El servicio puede cambiar durante el día. La evaluación final utiliza la versión vigente a las 20:00.
9. Los tokens de participantes dejan de funcionar contra el original a las 20:00.

No se deben codificar como hechos comportamientos que todavía no hayan sido observados.

## 3. Estrategia de ingeniería

El proyecto sigue un enfoque de ingeniería inversa experimental.

El ciclo de trabajo es:

1. Formular una hipótesis concreta sobre el comportamiento del servicio.
2. Diseñar una petición que permita comprobarla.
3. Enviar la petición al original mediante las herramientas de experimentación.
4. Registrar la petición, el status y la respuesta.
5. Analizar el resultado y determinar qué hipótesis quedan respaldadas.
6. Actualizar la especificación y la implementación.
7. Añadir o actualizar pruebas de regresión.
8. Comparar el comportamiento del reemplazo con las evidencias disponibles.

Se debe variar una condición a la vez siempre que sea posible, especialmente al investigar argumentos, validaciones y transiciones de estado.

Los experimentos deben ser reproducibles y respetar los límites de la infraestructura.

## 4. Arquitectura objetivo

La implementación utilizará **Node.js, Express y TypeScript**.

La arquitectura propuesta es un monolito modular con responsabilidades separadas:

- **HTTP:** rutas, métodos, autenticación, parsing del cuerpo HTTP y construcción de respuestas.
- **Core:** parsing de mensajes, validación, despacho de comandos y reglas compartidas.
- **Commands:** implementación de los comandos identificados experimentalmente.
- **State:** representación del estado, operaciones de modificación y reinicio.
- **Tests:** pruebas unitarias, de integración, secuenciales y diferenciales.
- **Tools:** experimentos contra el original, reproducción de secuencias y comparación de respuestas.
- **Docs:** diseño del sistema y diagrama de arquitectura.

La arquitectura es una propuesta de implementación, no una afirmación de que el servicio original utilice los mismos componentes internos.

La organización del código debe ser sencilla y permitir añadir comportamientos descubiertos sin reescribir módulos que ya funcionan.

No se deben introducir microservicios, bases de datos, colas, sistemas distribuidos ni dependencias externas sin una necesidad demostrada.

El estado en memoria es la opción inicial preferida, siempre que las observaciones y el contrato de evaluación no requieran otra cosa.

## 5. Estructura actual del repositorio

La estructura inicial del repositorio es:

```text
.
├── .agents/
│   └── skills/
│       └── backend-node-express-clean-architecture/
│           └── SKILL.md
├── .pi/
│   └── settings.json
├── docs/
│   ├── design.md
│   ├── diagramadearquitectura.md
│   └── service-spec.md
├── pruebas/
│   └── ejemplos.jsonl
├── src/
│   ├── app.ts
│   ├── server.ts
│   ├── config/env.ts
│   ├── core/
│   ├── http/
│   └── state/store.ts
├── tools/
│   ├── cli.ts
│   ├── client.ts
│   ├── record.ts
│   └── transport.ts
├── tests/
├── Agents.md
├── experimentos.jsonl
├── package.json
├── tsconfig.json
├── tsconfig.tools.json
└── README.md
```

Esta estructura es la del repositorio tras el laboratorio. Los agentes deben inspeccionar los archivos reales antes de asumir que contienen una implementación completa, y en caso de modificar algo documentarlo en este archivo en el text de arriba.

El diagrama de arquitectura está en `docs/diagramadearquitectura.md`. `docs/design.md` todavía enlaza `docs/architecture.md`, que no existe en disco. No se ha renombrado ese archivo.

`src/` implementa el transporte, la autenticación observada, el parser y los comandos con evidencia. No llama al original. La fórmula general del control de `ALTA`, `DEPOSITO` y `TRANSFER` sigue abierta. `tools/` es el laboratorio y no lo importa el proceso desplegable. `experimentos.jsonl` contiene experimentos reales. `docs/service-spec.md` describe el original, no el diseño del reemplazo.

### Responsabilidades de los archivos existentes

- `Agents.md`: contexto global, reglas y coordinación entre agentes.
- `docs/design.md`: documento de diseño del sistema, sus decisiones, restricciones y estrategia de validación.
- `docs/diagramadearquitectura.md`: diagramas de arquitectura y flujos de ejecución. El nombre previsto en estas reglas era `docs/architecture.md`; el archivo real tiene otro nombre.
- `docs/service-spec.md`: especificación del comportamiento observado del original. No sustituye a `docs/design.md`.
- `pruebas/ejemplos.jsonl`: ejemplos proporcionados por la organización.
- `experimentos.jsonl`: registro de las peticiones realizadas al original y sus resultados. Sigue el esquema oficial y no debe recibir resultados simulados.
- `tools/`: laboratorio de experimentación. Es el único lugar que puede llamar al original.
- `src/`: implementación del reemplazo. No importa `tools/` ni lee `PARTICIPANT_TOKEN`.
- `tests/`: pruebas automatizadas.
- `README.md`: introducción, configuración y comandos del proyecto.
- `.agents/skills/backend-node-express-clean-architecture/SKILL.md`: recurso de referencia para patrones de arquitectura backend. Debe utilizarse cuando sea pertinente, sin anteponer sus recomendaciones a los requisitos del reto.

No se debe asumir que las carpetas `src/` y `tests/` tienen ya todos sus archivos. Inspeccionarlas antes de crear o modificar componentes.

## 6. Reglas de documentación

El repositorio tiene dos documentos principales de diseño:

### `docs/design.md`

Debe describir:

1. Objetivo y alcance.
2. Requisitos funcionales y no funcionales.
3. Restricciones técnicas y de evaluación.
4. Decisiones arquitectónicas.
5. Responsabilidades de los módulos.
6. Modelo de estado.
7. Estrategia de pruebas.
8. Despliegue y operación.
9. Supuestos, riesgos e incertidumbres.

### `docs/architecture.md`

Debe incluir:

1. Diagrama de componentes.
2. Flujo de una petición HTTP.
3. Responsabilidades y límites de los módulos.
4. Interacción entre comandos y estado.
5. Flujo de errores cuando sea relevante.
6. Relación entre experimentación, evidencias y pruebas.

Los diagramas deben escribirse en Mermaid para que GitHub pueda renderizarlos.

Los diagramas y el documento de diseño deben mantenerse consistentes con la implementación real. Si la arquitectura cambia, se actualiza la documentación correspondiente.

No crear otros documentos de diseño salvo que exista una necesidad clara o el responsable del proyecto lo solicite.

## 7. Reglas de evidencia y especificación

Deben distinguirse tres niveles de conocimiento:

- **Confirmado:** comportamiento comprobado mediante experimentos repetibles.
- **Probable:** comportamiento observado una vez o respaldado por evidencia limitada.
- **Supuesto:** comportamiento todavía no verificado que la implementación adopta provisionalmente.

Nunca presentar un supuesto como comportamiento confirmado.

Cuando se documente el comportamiento del original, cada afirmación debe poder rastrearse hasta los identificadores de los experimentos que la respaldan.

El formato de `experimentos.jsonl` debe respetar el contrato del reto:

```json
{
  "id": 1,
  "seq": "s1",
  "x_req": 1,
  "hipotesis": "Descripción de la hipótesis",
  "request": {
    "m": "MENSAJE"
  },
  "status": 200,
  "response": {},
  "conclusion": "Conclusión respaldada por el resultado"
}
```

El ejemplo es ilustrativo. Los valores reales deben proceder de las peticiones y respuestas observadas.

Cada request enviada al original debe registrarse con un identificador único y los campos requeridos. No inventar respuestas, status ni valores de `X-Req`.

## 8. Reglas de fidelidad

La implementación debe reproducir el comportamiento observado, incluso cuando parezca poco convencional.

En particular:

- No normalizar cadenas, números ni argumentos sin evidencia.
- No asumir que los argumentos se validan mediante reglas convencionales.
- No sustituir errores específicos por errores genéricos.
- No convertir automáticamente todos los cuerpos de respuesta a JSON.
- No asumir que una ruta desconocida siempre devuelve el mismo error.
- No asumir un orden de autenticación, parsing y validación sin comprobarlo.
- No reiniciar el estado entre pasos de un mismo test.
- No asumir que dos comandos son independientes.
- No introducir comportamiento nuevo que cambie respuestas ya compatibles.

Los cuerpos JSON deben compararse respetando los tipos, los valores, los arrays y los strings. Cuando las respuestas no sean JSON, debe preservarse el texto exacto.

El comportamiento predeterminado para casos desconocidos debe documentarse como supuesto, no como hecho del original.

## 9. Coordinación entre agentes de Pi

El trabajo puede realizarse en paralelo, pero debe dividirse por responsabilidades y archivos.

### Roles sugeridos

**Agente de arquitectura**
- Trabaja en `docs/design.md` y `docs/architecture.md`.
- Documenta decisiones y flujos.
- No modifica la lógica de producción salvo petición expresa.

**Agente de experimentación**
- Trabaja en las herramientas de investigación y el registro de experimentos.
- Prueba hipótesis concretas contra el original.
- No modifica los resultados históricos para hacerlos coincidir con una implementación.

**Agente de implementación**
- Trabaja en `src/`.
- Implementa únicamente comportamientos respaldados por evidencia o documentados explícitamente como supuestos.
- Añade pruebas de regresión.

**Agente de pruebas**
- Trabaja en `tests/`.
- Diseña casos unitarios, de integración y secuenciales.
- Construye comparaciones de status y cuerpo.
- Reporta discrepancias sin modificar silenciosamente el comportamiento esperado.

Estos roles son una guía. No es necesario mantener cuatro agentes activos si el tiempo o la complejidad no lo justifican.

### Reglas de coordinación

1. Antes de empezar, cada agente debe inspeccionar el estado actual del repositorio.
2. Cada tarea debe declarar su objetivo, los archivos que puede modificar y el resultado esperado.
3. No asignar dos agentes a modificar simultáneamente el mismo archivo.
4. Si una tarea requiere modificar un archivo compartido, coordinarlo explícitamente.
5. No sobrescribir cambios existentes para imponer una preferencia arquitectónica.
6. No reemplazar archivos completos cuando baste con una modificación localizada.
7. Mantener las interfaces entre módulos estables y comunicar los cambios que las afecten.
8. Ejecutar las pruebas pertinentes antes de considerar terminada una tarea.
9. Comunicar archivos modificados, decisiones, pruebas ejecutadas y asuntos pendientes.
10. No afirmar que una prueba pasó si no se ejecutó.

Antes de integrar cambios, revisar las diferencias de Git y comprobar que no se hayan eliminado accidentalmente modificaciones de otros agentes.

## 10. Seguridad y secretos

- Nunca incluir el token real del equipo en `Agents.md`, `README.md`, documentación o código versionado.
- Utilizar variables de entorno para configurar secretos.
- No registrar tokens en `experimentos.jsonl`.
- No subir archivos `.env` con credenciales reales.
- Mantener las herramientas que consultan el original separadas del servidor desplegado.
- Verificar que la aplicación de producción no realice peticiones al servicio original.

El archivo `.env.example` puede documentar los nombres de las variables necesarias utilizando valores ficticios.

## 11. Calidad del código

- Utilizar TypeScript con tipado estricto.
- Preferir funciones y módulos pequeños con responsabilidades claras.
- Evitar duplicación cuando exista lógica verdaderamente compartida.
- Evitar abstracciones genéricas que no resuelvan una necesidad actual.
- Mantener el comportamiento HTTP separado de las reglas de comandos.
- Representar explícitamente los cambios de estado.
- Evitar dependencias que no sean necesarias para el objetivo.
- Mantener una implementación determinista siempre que el comportamiento observado lo permita.
- No incorporar un LLM al camino de respuesta de producción como sustituto de reglas que pueden implementarse explícitamente.

Las decisiones de diseño deben favorecer la fidelidad, la facilidad de prueba y la velocidad de corrección.

## 12. Definición de terminado

Una tarea se considera terminada cuando:

1. Se ha cumplido el objetivo acordado.
2. Los cambios respetan la arquitectura y las restricciones del reto.
3. Las pruebas relevantes se han ejecutado o se han declarado expresamente las limitaciones para ejecutarlas.
4. No se han introducido llamadas al original en la aplicación desplegada.
5. La documentación está actualizada cuando la tarea cambia una decisión o un comportamiento relevante.
6. Los cambios están delimitados y pueden revisarse mediante Git.
7. Se informa qué se modificó, qué se verificó y qué queda pendiente.

## 13. Prioridad global del proyecto

En caso de conflicto entre preferencias técnicas y objetivos del reto, priorizar en este orden:

1. Cumplimiento de las reglas del hackathon.
2. Fidelidad observable al original.
3. Evidencia reproducible y pruebas de regresión.
4. Corrección del manejo de estado y de las secuencias.
5. Claridad de la arquitectura y documentación.
6. Simplicidad, mantenibilidad y optimización.

**Principio rector:** no se trata de construir la API que creemos que debería existir, sino un reemplazo que reproduzca con precisión la API que existe.
