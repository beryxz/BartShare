# Bart - evaluator and case-study application

This repository implements **Bart**, a formal specification language for _bartering_ access to
resources, and builds a working application on top of it.

Bart is an attribute-based access-control (ABAC) language from the paper
_"Bart: a Specification Language for Bartering Access to Resources"_ (Bettini, Pugliese, Tiezzi).
What distinguishes it from ordinary ABAC is reciprocity: each party publishes a policy whose
rules may grant access
_and, in the same breath, demand something in exchange_: another resource, from another party.
Answering a single request can therefore recurse through a chain of reciprocal sub-requests
across several parties' policies before a verdict comes back.

The repository splits into:

- **`evaluator/`**: the language itself, comprising the core engine, a concrete `.bart` syntax
  with a parser, and an HTTP service that exposes evaluation over the network.
- **`app/`**: **BartShare**, a resource-sharing web application used as a case study. Every
  user is a Bart party with an attribute list and a policy; every access decision is evaluated
  live against those policies. There are no stored grants.

## Architecture

```
  browser
     │  HTTP
     ▼
┌──────────────┐
│    proxy     │
│    nginx     │
│    :8000     │
└──┬────────┬──┘
   │ /      └────────────────┐ /api
   ▼                         ▼
┌──────────────┐      ┌──────────────┐       ┌──────────────────┐
│ app-frontend │      │ app-backend  │─────▶│  bart-wrapper    │
│  Next.js     │      │  Fastify     │ HTTP  │  Spring Boot     │
│  :3000       │      │  :8081       │       │  :8080           │
└──────────────┘      └──────┬───────┘       └────────┬─────────┘
                             │                        │
                             ▼                      calls
                      ┌──────────────┐                │
                      │  PostgreSQL  │                ▼
                      │  :5432       │      bart-parser → bart.core
                      └──────────────┘       (.bart text)  (engine)
```

The browser only ever talks to the proxy, which serves the frontend and the API on one
origin. Nothing else is published to the host by default.

The backend owns all persistent state (users, resources, connections, groups) and stores each
user's policy as `.bart` text. When a decision is needed it assembles the relevant policies, the
evaluation context and the request, and posts them to `bart-wrapper`, which is **stateless**: it
remembers nothing between calls and holds no database of its own.

## Components

| Path                                                | What it is                                                                                                                                                                                | Stack                                          |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| [`evaluator/bart/`](evaluator/bart)                 | Core ABAC bartering engine: a pure library, a direct transcription of the paper's denotational semantics. Consumed as a git submodule of an upstream fork and **never modified locally**. | Java 21, Maven                                 |
| [`evaluator/bart-parser/`](evaluator/bart-parser)   | ANTLR grammar and model builder: `.bart` source text → engine model objects.                                                                                                              | Java 25, ANTLR 4.13                            |
| [`evaluator/bart-wrapper/`](evaluator/bart-wrapper) | HTTP service exposing evaluation, validation and policy analysis.                                                                                                                         | Java 25, Spring Boot 4                         |
| [`app/backend/`](app/backend)                       | BartShare REST API: users, resources, connections, groups, and the access-decision path that calls the evaluator.                                                                         | TypeScript, Fastify 5, Sequelize 6, PostgreSQL |
| [`app/frontend/`](app/frontend)                     | BartShare web client: browse and share resources, author policies, build and trace requests.                                                                                              | TypeScript, Next.js 16, React 19, Tailwind     |

## Quick start

The fastest way to get everything running is Docker Compose. The `evaluator/bart` submodule must
be checked out on the host first, because Docker does not fetch submodules.

```bash
git clone --recurse-submodules <repository-url>
cd <repository-directory>
docker compose up --build
```

Or, if you cloned without `--recurse-submodules`:

```bash
git submodule update --init
docker compose up --build
```

Then open <http://localhost:8000>.

A fresh database has no users, and BartShare has no signup screen: identity is a cookie naming
an existing user. Either create one from the sidebar's _New user…_ action, or seed a full
multi-party bartering scenario against the running stack (the frontend offers the same choice on
first run):

```bash
curl -X POST localhost:8000/api/v1/dev/seed -H 'content-type: application/json' -d '{"scenario":"ex3"}'
```

## Ports

Fixed defaults, identical for local runs and Compose. They are cross-project wiring: the
backend's `EVALUATOR_URL` is written against them, so changing one means changing every
consumer.

| Service                  | Port                    | Set by                                                                                                              |
| ------------------------ | ----------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `proxy` (nginx)          | `8000`                  | `docker-compose.yml`; the only port the default stack publishes                                                     |
| `app/frontend`           | `3000`                  | `next dev` / `next start` default; `PORT` in its Dockerfile for the Compose image                                   |
| `evaluator/bart-wrapper` | `8080`                  | `server.port` in its `application.properties`                                                                       |
| `app/backend`            | `8081`                  | `API_PORT` in its `.env`, from the tracked `.env.example`; `API_PORT` in `docker-compose.yml` for the Compose image |
| PostgreSQL               | `55433` (host) → `5432` | `docker-compose.dev.yml`                                                                                            |

Only `8000` is reachable from the host in the default stack: everything else listens on the
Compose network alone, and the browser reaches the frontend and the API through the proxy on
one origin. To publish the rest for local development, add the development file:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

`--build` is required, not a habit: the development file also hands `app-frontend` a non-empty
`NEXT_PUBLIC_API_HOST` build argument, and a build argument only takes effect when the image is
rebuilt.

The backend's test suite sits outside this map (`API_PORT=10001`, PostgreSQL on `15400`) so a
test run never collides with a server left running.

`app-frontend` still bakes `NEXT_PUBLIC_API_HOST` into its image at build time, but the
default stack no longer sets it: behind the proxy the frontend and the API share an origin,
so the empty default gives same-origin relative URLs and no rebuild is needed per
environment. Pass the build argument only when serving the two from separate origins.

## Local development

### Prerequisites

- **JDK 25** and **Maven 3.9+** for the Java projects.
- **Node.js 26** for the backend and frontend.
- **Docker** for PostgreSQL, and for the backend's test suite.

### Evaluator

The Java projects form a dependency chain (`bart` → `bart-parser` → `bart-wrapper`) wired
by an aggregator POM, so one command builds them all in the right order:

```bash
cd evaluator
mvn clean install          # builds and installs the whole chain
mvn -o clean install       # same, offline (after ~/.m2 is warm)
mvn -pl bart-wrapper -am package   # just the service and its dependencies
```

The first build must be online, to fetch external dependencies. Afterwards:

```bash
cd evaluator/bart-wrapper && mvn spring-boot:run     # evaluator service on :8080
```

### Backend

```bash
cd app/backend
cp .env.example .env       # set DB_CONNECTION_STRING and EVALUATOR_URL
npm install
npm run dev                # hot-reload dev server on :8081
```

Needs a running PostgreSQL and a running `bart-wrapper`, both published by the development
Compose file:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d db bart-wrapper
```

### Frontend

```bash
cd app/frontend
cp .env.example .env.local # point NEXT_PUBLIC_API_HOST at the stack
npm install
npm run dev                # http://localhost:3000
```

## Testing

```bash
cd evaluator     && mvn -o clean test   # every Java project, in dependency order
cd app/backend   && npm test            # typecheck + TAP suite (starts a Docker PostgreSQL)
cd app/frontend  && npm test            # Vitest suite
```

GitHub Actions runs the suites on every push, alongside the format, lint and type checks and the
evaluator's mutation gates: a workflow apiece for the evaluator stack, the backend and the
frontend. See [`.github/workflows/`](.github/workflows).

The backend serves OpenAPI documentation at `/api/v1/swagger/ui` when it is running.

## Repository layout

```
.
├── evaluator/              # aggregator POM + Dockerfile for the evaluator service
│   ├── bart/               # git submodule, core engine (read-only)
│   ├── bart-parser/        # .bart grammar and model builder
│   └── bart-wrapper/       # Spring Boot HTTP service
├── app/
│   ├── backend/            # Fastify + Sequelize API
│   └── frontend/           # Next.js client
├── infra/                  # nginx reverse proxy config
├── .github/workflows/      # CI: the evaluator stack, the backend, the frontend
├── docker-compose.yml      # full stack orchestration: proxy, bart-wrapper, db, app-backend, app-frontend
├── docker-compose.dev.yml  # opt-in: republishes the service ports and rebuilds the frontend split-origin
└── README.md
```

This is a monorepo: one repository holds everything above, with a single exception. The core
engine `evaluator/bart` is a **git submodule**, a fork of the paper authors' repository kept so
the code stays available and so upstream changes can still be merged. It is treated as read-only:
any gap or awkwardness in the engine is worked around in `bart-parser`, `bart-wrapper` or the
application layer, never patched at the source. The only operations performed on it are fetching
from upstream and advancing the recorded commit.

## Documentation

| Document                                                               | Covers                                                                                   |
| ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| [`evaluator/bart-parser/README.md`](evaluator/bart-parser/README.md)   | Public API and usage, grammar and entry rules, condition AST, deviations, test strategy  |
| [`evaluator/bart-wrapper/README.md`](evaluator/bart-wrapper/README.md) | Endpoint contract, error taxonomy, architecture, thread-safety notes                     |
| [`app/backend/README.md`](app/backend/README.md)                       | Backend overview, with setup, API reference and style guides under `app/backend/docs/`   |
| [`app/frontend/README.md`](app/frontend/README.md)                     | Frontend overview, with domain rules, components and features under `app/frontend/docs/` |

Where the implementation deviates from the printed grammar or semantics of the paper, the
deviation is documented at the point where it occurs. The clearest example is the header comment
of `Bart.g4`. An undocumented divergence from the paper counts as a defect here, even when it is
convenient.
