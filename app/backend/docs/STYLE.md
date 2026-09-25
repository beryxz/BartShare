# Style notes

## General

- Leave an empty line at the end of files where the excess line doesn't interfere with the functionality of the file itself.

## Markdown

- Leave empty lines around codeblocks and sections headers

## Conventions

- All API responses under `/api/v1`, the liveness probe (`/api/v1/healthz`) included: the reverse proxy routes only `/api/` to this service
- The error and pagination envelopes are defined in `docs/API.md`
- Utility helpers: `wrapSchema()` wraps TypeBox for Fastify, `paginatedResults()` creates paginated response types
- Identity is a `user` cookie carrying a user UUID, checked per route group by `requireUserCookie()`. There are no credentials, no password hashing and no tokens: impersonation is the point in a demo app
- Prettier is pinned in `.prettierrc.yaml` and gated in CI: `printWidth: 80`, `tabWidth: 4`, `singleQuote: true`, `arrowParens: avoid`, `trailingComma: all`. Run `npm run prettier` before pushing
- Controller handlers are `snake_case` (`get_all`, `put_content`), unlike every other symbol, and each controller default-exports one object of them
- Route files carry `//prettier-ignore` so each registration stays on one line and the route table stays readable as a table
- Register a static path segment before any `:param` one, or the param route swallows it
- A fixed error message lives in a named constant rather than inline, exported from where it is defined when more than one controller sends it (`MSG_NOT_AUTHORIZED` from `auth.utils.ts`, `MSG_USERNAME_TAKEN` from `users.utils.ts`)
