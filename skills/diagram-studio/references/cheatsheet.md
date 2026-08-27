# Diagram Studio Cheatsheet — 5 Mermaid Types

Minimal, GitHub-native examples. Copy verbatim, then replace labels. All use `flowchart TB` / semantic type + `classDef` tokens from `style-guide.md`.

## flowchart

Components + connections. Use `flowchart TB` or `flowchart LR`, never `graph`.

```mermaid
flowchart TB
  A["Client"] --> B["Cordis"]
  B --> C["Agent"]
  C --> D["Tool (bash)"]
  classDef focal fill:#eb6c36,stroke:#2d3142,color:#fff
  classDef muted fill:#f5f5f5,stroke:#8a94a6,color:#2d3142
  class A focal
  class B,C,D muted
```

## sequenceDiagram

Messages over time.

```mermaid
sequenceDiagram
  participant U as User
  participant W as DSH Web
  participant C as Cordis
  participant A as Agent
  U->>W: POST /chat
  W->>C: sessions.create
  C->>A: turn/start
  A-->>W: stream
  W-->>U: response
```

## classDiagram

Classes + operations. Use for domain models, service graphs.

```mermaid
classDiagram
  class Plugin {
    +String id
    +apply(ctx)
  }
  class Context {
    +tools: Tools
    +sessions: Sessions
  }
  Plugin --> Context : uses
  classDef focal fill:#eb6c36,stroke:#2d3142,color:#fff
```

## erDiagram

Entities + fields. Use for data models.

```mermaid
erDiagram
  USER ||--o{ SESSION : creates
  SESSION ||--o{ TURN : contains
  USER {
    string id
    string name
  }
  SESSION {
    string id
    string cwd
  }
```

## stateDiagram

States + guards. Use for lifecycles, state machines.

```mermaid
stateDiagram-v2
  [*] --> Draft
  Draft --> Review : submit
  Review --> Approved : approve
  Review --> Draft : request changes
  Approved --> [*]
```

> Style: see `style-guide.md` for tokens `paper/ink/accent/muted/link` and `classDef` definitions. Density 4/10, >9 nodes → split.

