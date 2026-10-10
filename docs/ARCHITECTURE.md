# Arquitectura — Reto 2: La caja negra

Este documento muestra el recorrido de una petición desde que entra por HTTP hasta que se devuelve la respuesta, además de los componentes internos y el laboratorio de investigación. Los diagramas usan sintaxis Mermaid básica para facilitar la previsualización.

## 1. Flujo completo de una petición

```mermaid
flowchart TD
    A[Cliente evaluador] --> B[Peticion HTTP]
    B --> C{Ruta y metodo}
    C -->|GET /health| H[Control de salud]
    H --> R1[Respuesta HTTP]
    C -->|POST /__reset| X[Leer token]
    X --> Y[Reiniciar estado de ese token]
    Y --> R2[Respuesta HTTP]
    C -->|POST /msg| D[Leer cuerpo JSON]
    D --> E[Obtener token y campo m]
    E --> F[Parsear comando y argumentos]
    F --> G[Validar formato y datos]
    G --> I{Entrada valida}
    I -->|No| J[Construir error compatible]
    J --> R3[Respuesta HTTP]
    I -->|Si| K[Despachar comando]
    K --> L[Ejecutar handler]
    L <--> M[Estado en memoria por token]
    L --> N[Construir cuerpo de respuesta]
    N --> R4[Respuesta HTTP]
    C -->|Ruta o metodo no reconocido| O[Respuesta de ruta o metodo no valido]
    O --> R5[Respuesta HTTP]
```

### Lectura del flujo

1. El cliente envía una petición HTTP al servicio.
2. Express identifica la ruta y el método. `/health`, `/__reset` y `/msg` siguen caminos distintos.
3. En `/msg`, el servicio obtiene el token y el campo `m`, analiza el mensaje y valida su estructura.
4. Si la entrada es válida, el dispatcher dirige el comando al handler correspondiente.
5. El handler consulta o modifica el estado asociado a ese token y produce el resultado.
6. El adaptador HTTP devuelve el status y el cuerpo. Los errores también deben reproducir el comportamiento observable del servicio original.

El orden exacto de validaciones y los formatos de error no se deben dar por confirmados hasta medirlos contra el original. El diagrama representa la arquitectura propuesta, no afirma que todas las reglas ya estén implementadas.

## 2. Componentes del servicio desplegado

```mermaid
flowchart LR
    Client[Cliente HTTP] --> Routes[Rutas Express]
    Routes --> Context[Contexto de peticion y token]
    Context --> Parser[Parser del mensaje]
    Parser --> Validator[Validacion]
    Validator --> Dispatcher[Dispatcher de comandos]
    Dispatcher --> Handlers[Handlers de comandos]
    Handlers <--> Store[(Estado en memoria por token)]
    Handlers --> Result[Resultado del comando]
    Result --> Routes
    Routes --> Client
```

| Componente | Responsabilidad |
|---|---|
| Rutas Express | Recibir HTTP, seleccionar la ruta y devolver status y cuerpo. |
| Contexto de petición y token | Identificar el token que delimita el estado de la sesión. |
| Parser | Separar el mensaje en comando y argumentos sin inventar reglas de formato. |
| Validación | Comprobar condiciones observadas y mantener el orden de validación compatible. |
| Dispatcher | Enviar el comando reconocido a su handler. |
| Handlers | Ejecutar la operación y construir el resultado del comando. |
| Estado en memoria | Guardar los datos necesarios entre peticiones para cada token. |

`POST /__reset` debe limpiar solo el estado del token correspondiente. El estado en memoria no persiste tras reiniciar el proceso; por ello, el despliegue debe respetar la limitación de una instancia si no existe un mecanismo compartido.

## 3. Secuencia interna de `POST /msg`

```mermaid
sequenceDiagram
    participant C as Cliente
    participant E as Express
    participant P as Parser y validacion
    participant D as Dispatcher
    participant H as Handler
    participant S as Estado por token

    C->>E: POST /msg con token y cuerpo
    E->>P: Entregar mensaje
    P->>P: Parsear y validar
    alt Entrada invalida
        P-->>E: Error compatible
        E-->>C: Status y cuerpo de error
    else Entrada valida
        P->>D: Comando y argumentos
        D->>H: Ejecutar comando
        H->>S: Consultar o modificar estado
        S-->>H: Datos del token
        H-->>D: Resultado
        D-->>E: Respuesta del comando
        E-->>C: Status y cuerpo
    end
```

## 4. Laboratorio de desarrollo — fuera del despliegue

```mermaid
flowchart TD
    Probe[Herramienta de experimentacion] --> Original[Servicio original]
    Probe --> Log[experimentos.jsonl]
    Original --> Compare[Comparador diferencial]
    Compare --> Fixtures[Casos de regresion]
    Fixtures --> Tests[Pruebas locales]
    Tests --> Replacement[Implementacion local]
```

El laboratorio se utiliza durante la investigación para formular hipótesis, enviar solicitudes controladas, registrar resultados y crear pruebas de regresión. No forma parte del proceso desplegado.

**Restricción importante:** el servicio desplegado no debe llamar, importar ni depender del servicio original ni de otra implementación de reemplazo. La comunicación con el original se limita a las herramientas de experimentación ejecutadas por separado.

## 5. Límites y aspectos por confirmar

- El diagrama describe el flujo previsto; no demuestra que el comportamiento ya esté implementado.
- Los códigos HTTP, mensajes de error, orden de validación y reglas de cada comando deben confirmarse con experimentos.
- Los errores automáticos de Express y del parseo JSON deben revisarse para evitar respuestas distintas de las del original.
- El estado en memoria se pierde al reiniciar el proceso y no se comparte entre instancias.
