# BartShare Frontend

Next.js frontend for **BartShare**, the case-study application for
[Bart](../../README.md), an attribute-based access-control language for
_bartering_ access to resources. Each user is a **party** with an attribute
list and a policy, and every access decision evaluates that policy live,
including any reciprocal exchange it demands, since there are no stored grants.

## Quick start

```bash
cp .env.example .env.local     # point NEXT_PUBLIC_API_HOST at the stack
npm install
npm run dev                    # http://localhost:3000
```

## Commands

| Command                  | What it does                                    |
| ------------------------ | ----------------------------------------------- |
| `npm run dev`            | dev server                                      |
| `npm run build`          | production build                                |
| `npm run start`          | run the production build                        |
| `npm test`               | Vitest suite                                    |
| `npm run typecheck`      | `tsc --noEmit`                                  |
| `npm run lint`           | ESLint                                          |
| `npm run prettier`       | format `src/`, `docs/`, this file               |
| `npm run prettier:check` | check those paths without writing; what CI runs |

## Learn more

- [`docs/`](docs/), the full reference: Bart domain rules, components, setup and Docker, features, style.
