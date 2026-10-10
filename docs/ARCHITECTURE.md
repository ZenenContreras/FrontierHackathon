# Arquitectura — Reto 2: La caja negra

Este archivo separa los diagramas del documento de diseño para facilitar su previsualización. Se usan diagramas Mermaid sencillos, con direcciones y subgrafos independientes para evitar cruces innecesarios.

## Servicio desplegado

```mermaid
flowchart TB
    Client[Evaluador HTTP]
    Routes[Rutas Express]
    Context[Contexto de petición y token]
    Parser[Parser del mensaje]
    Validator[Validación]
    Dispatcher[Dispatcher de comandos]
    Commands[Handlers de comandos]
    Store[(Estado en memoria por token)]
    Response[Constructor de respuesta]

    Client --> Routes
    Routes --> Context
    Context --> Parser
    Parser --> Validator
    Validator --> Dispatcher
    Dispatcher --> Commands
    Commands <--> Store
    Commands --> Response
    Response --> Routes
    Routes --> Client
```

El estado se separa por token. `POST /__reset` restablece el estado del token correspondiente. El adaptador HTTP debe preservar el status y el cuerpo que produzca el núcleo.

## Laboratorio de desarrollo (no desplegado)

```mermaid
flowchart TB
    Probe[Herramienta de experimentación]
    Original[Servicio original]
    Log[experimentos.jsonl]
    Compare[Comparador diferencial]
    Fixtures[Fixtures de regresión]
    Tests[Pruebas locales]

    Probe --> Original
    Probe --> Log
    Original --> Compare
    Compare --> Fixtures
    Fixtures --> Tests
```

Este laboratorio es independiente del servicio desplegado. La herramienta de experimentación puede consultar el original; el runtime del reemplazo no debe importarlo, invocarlo ni depender de su disponibilidad.
