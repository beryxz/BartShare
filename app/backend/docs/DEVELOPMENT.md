# Development

## Tech Stack

- **Language**: TypeScript (strict mode)
- **Runtime**: Node v26
- **Framework**: Fastify v5 with TypeBox v1 for schema validation
- **ORM**: Sequelize v6 with `pg` driver
- **Database**: PostgreSQL
- **Testing**: TAP v21, Docker PostgreSQL
- **Linting**: ESLint v10 (flat config) + `@typescript-eslint`
- **Formatting**: Prettier v3

---

## Commands

```bash
# Development
npm run dev              # Hot-reload dev server (node --watch-path + ts-node)
npm run debug            # Same, with --inspect for the debugger

# Build & Run
npm run build            # Compile TypeScript → build/
npm run start            # Run compiled build/index.js
npm run build-start      # Build then start

# Testing (requires Docker for PostgreSQL)
npm test                 # One project-wide typecheck, then the suite
npm run test:unit        # Run tests (auto-starts/stops Docker PG container)
npm run test:unit -- test/controllers/me.ts        # Run a single test file
npx tap --disable-coverage test/controllers/me.ts  # Same, without the container dance

# Debug a specific test with inspector
node --env-file=.env.test --inspect-brk -r ts-node/register test/controllers/me.ts

# Linting & Formatting
npm run lint             # ESLint; the CI gate
npm run prettier         # Prettier on src/, test/, docs/ and README.md
npm run prettier:check   # Same paths, check only; the CI gate
```

### Seeding a development database

`POST /dev/seed` populates an empty database with one of the canned scenarios in `src/dev/scenarios/`
(`GET /dev/scenarios` lists them; `ex3` is john, mary, david, their resources and a connection,
mirroring the paper's three-party exchange scenario). It needs a running backend and a running
`bart-wrapper` (seeding validates rules against it, exactly as `POST /users` does), and only
works on an empty database.

Through the default stack's proxy:

```bash
curl -X POST localhost:8000/api/v1/dev/seed -H 'content-type: application/json' -d '{"scenario":"ex3"}'
```

Or straight at a standalone backend, published on `8081` by `docker-compose.dev.yml`:

```bash
curl -X POST localhost:8081/api/v1/dev/seed -H 'content-type: application/json' -d '{"scenario":"ex3"}'
```

`POST /dev/reset` wipes it again (idempotent, safe to call on an already empty database). The
frontend offers the same seed/reset pair from its first-run screen, so either curl invocation is
only needed when driving the backend on its own.

There is no migration runner; `db.ts` syncs the models on boot instead.

## Environment Variables

Copy `.env.example` to `.env` (or `.env.test` for tests) and fill in the values.

The env file is loaded by node itself (`--env-file`), not by a library: `dev`/`debug` load
`.env`, tap hands `--env-file=.env.test` to every test child process through the `node-arg`
list in `.taprc`, and `start` uses `--env-file-if-exists` so the compiled build also runs
where the variables come from the environment and no `.env` file is present.

| Variable               | Description                                                                                               |
| ---------------------- | --------------------------------------------------------------------------------------------------------- |
| `DEBUG`                | `true`/`false`: controls logging level, error detail in responses and OpenAPI visibility of hidden routes |
| `LOGGING`              | `true`/`false`: enable log output                                                                         |
| `DB_CONNECTION_STRING` | PostgreSQL connection string (`postgres://user:pass@host:port/db`)                                        |
| `API_HOST`             | IPv4 address for the API listener (e.g. `127.0.0.1`)                                                      |
| `API_PORT`             | Port for the API listener (`8081` by convention, see the port map below)                                  |
| `EVALUATOR_URL`        | Base URL of the `bart-wrapper` service (e.g. `http://127.0.0.1:8080`)                                     |
| `EVALUATOR_TIMEOUT_MS` | Request timeout, in milliseconds, for calls to the evaluator                                              |

### Port map

The services use fixed default ports across local runs, Compose, and docs. Keep them
aligned: this service's `EVALUATOR_URL` is written against them.

| Service                                 | Port                    | Where it comes from                                                               |
| --------------------------------------- | ----------------------- | --------------------------------------------------------------------------------- |
| Reverse proxy (nginx)                   | `8000`                  | `docker-compose.yml` at the repo root; the only port the default stack publishes  |
| Frontend (Next.js)                      | `3000`                  | `next dev`/`next start` default; `PORT` in its Dockerfile for the Compose image   |
| Evaluator (`bart-wrapper`, Spring Boot) | `8080`                  | `server.port` in its `application.properties`; pointed at by `EVALUATOR_URL` here |
| This backend                            | `8081`                  | `API_PORT`                                                                        |
| PostgreSQL (Compose)                    | `55433` (host) → `5432` | `docker-compose.dev.yml` at the repo root                                         |

Only the proxy is published by default. To reach this service, the database or the evaluator
from the host, layer the development file on:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build
```

`--build` is required when layering the development file: it hands `app-frontend` a non-empty
`NEXT_PUBLIC_API_HOST` build argument, and a build argument only takes effect when the image
is rebuilt.

`.env.test` deliberately sits outside the map (`API_PORT=10001`, its PostgreSQL on `15400`), so a
test run never collides with a backend you left running.

## Response headers

An `onSend` hook in `src/api.ts` sets `X-Content-Type-Options: nosniff` on every response,
including the not-found and error paths. It is global rather than per route because
resource content is user-uploaded bytes, where a sniffed type is the case that matters.
The swagger UI sets its own `content-security-policy` and is unaffected.

The frontend sets its own headers; this service does not set them on its behalf.

## Project Structure

```
├── docs/                # Project documentation
├── src/
│   ├── index.ts         # Entry point: connect DB → build API → listen
│   ├── api.ts           # Fastify setup, plugins, route registration
│   ├── config.ts        # Env var loading, validation, app limits
│   ├── db.ts            # Sequelize connection + schema sync
│   ├── error.ts         # Error types
│   ├── bart/            # .bart emission, evaluator client, access/coverage services
│   ├── controllers/     # Request handlers (business logic)
│   ├── dev/             # Seed scenarios and the /dev endpoints behind them
│   ├── models/          # Sequelize model definitions
│   │   ├── base/        # Individual model classes
│   │   └── models.ts    # Lazy model initialization after DB connect
│   ├── routes/          # Fastify route plugins with TypeBox schemas
│   ├── schemas/         # TypeBox request/response schemas
│   ├── types/           # TypeScript type declarations
│   └── utils/           # Shared utilities (auth, config, schema helpers)
└── test/                # test/<area> per src/ area; routes and schemas are covered through the controller tests
    └── support/         # Shared harness, fakes and node preloads, excluded from tap's test set
```

## Coding Standards

- **Linting**: ESLint v10 flat config (`eslint.config.mjs`) extending `eslint:recommended` and `@typescript-eslint/recommended`. `@typescript-eslint/no-unused-vars` is disabled.
- **Formatting**: Prettier v3 applied to `src/`, `test/`, `docs/` and `README.md`, enforced in CI by `npm run prettier:check`.
- **Typing**: TypeScript strict mode with `noImplicitAny`. TypeBox schemas provide runtime validation and type inference.
