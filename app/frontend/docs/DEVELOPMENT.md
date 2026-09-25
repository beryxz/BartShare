# Development

How to set up, run, and extend BartShare's frontend. This file only covers how to work on the code.

## Tech stack

| Layer           | Choice                 | Version                           | Note                                                                                                                       |
| --------------- | ---------------------- | --------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Framework       | Next.js (App Router)   | 16.x                              | client-side SPA; the browser calls the backend directly at `NEXT_PUBLIC_API_HOST`, which is empty behind the reverse proxy |
| UI              | React                  | 19.x                              |                                                                                                                            |
| Styling         | Tailwind CSS           | 4.x                               | CSS-first config: **no `tailwind.config.js`**; tokens live in `src/app/globals.css`                                        |
| Components      | shadcn/ui              | CLI `3.8.5` (pinned, `init` only) | `new-york` style, `neutral` base                                                                                           |
| Data fetching   | SWR                    | 2.x                               | acting-user id is baked into every cache key but a handful of public ones                                                  |
| Language        | TypeScript             | `^6`, strict                      | pinned below the newest major                                                                                              |
| Package manager | npm                    |                                   | matches the backend                                                                                                        |
| Rule editor     | `monaco-editor`        | `^0.56.0`                         | self-hosted from this origin, never a CDN                                                                                  |
| Rule editor     | `@monaco-editor/react` | `^4.7.0`                          | React wrapper over `monaco-editor`; its default loader is what self-hosting overrides                                      |
| Theming         | `next-themes`          | `^0.4.6`                          | `attribute="class"`, **light** default, `enableSystem={false}`                                                             |

Theming toggles the app chrome only: `providers.tsx` mounts `ThemeProvider` with a light
default and no system detection, and `ThemeToggle` (sidebar footer) is the only way to switch.
The `.bart` code surfaces, `BartCode` and `BartEditorImpl` (Monaco), are pinned dark in both
themes, the way a code block stays dark on a light docs page; see the comments at their `dark` /
`theme="vs-dark"` sites for why.

## Getting started

```bash
cp .env.example .env.local
npm install
npm run dev
```

The dev server listens on <http://localhost:3000>. `.env.local` sets
`NEXT_PUBLIC_API_HOST`, the base URL every API call is rooted at; see the API
client layer below for how it is applied, and Docker for why it still has to
be present when the bundle is built.

Fixed default ports, identical locally and under Compose. They are cross-project
wiring: the backend's `EVALUATOR_URL` is written against them, so changing one
means changing every consumer.

The frontend only ever talks to the backend; the evaluator sits behind it. In the Compose
stack both are reached through the proxy on one origin, which is why an empty
`NEXT_PUBLIC_API_HOST` is the working default there.

### First run against a real stack

Nothing in this app is mocked, so `npm run dev` on its own shows
`SessionGate`'s first-run screen (`FirstRunLanding`) until a backend with data
exists behind it. This flow deliberately runs without the proxy, so set
`NEXT_PUBLIC_API_HOST=http://localhost:8081` in `.env.local`, overriding the
`.env.example` default of `http://localhost:8000`:

```bash
# from the repo root
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build bart-wrapper db app-backend
curl -X POST localhost:8081/api/v1/dev/seed \
  -H 'content-type: application/json' -d '{"scenario":"ex3"}'  # the paper's ex3 scenario
npm run dev
```

The development Compose file is what publishes `8081` and `55433`; the default stack keeps
them on the Compose network, reachable only through the proxy.

Order matters for the middle step: seeding validates every party's rules
against the evaluator, so it fails against a backend whose `bart-wrapper` is
not up yet. It also only works on an empty database: a second run answers
`409` rather than seeding again (`POST /dev/reset` clears it first).

`app-frontend` is deliberately left out of this command: bringing it up separately publishes
the same `127.0.0.1:3000` that `npm run dev` below wants, so the two collide. Its image also
bakes `NEXT_PUBLIC_API_HOST` in at build time (see Docker), so its container is a snapshot of
whatever checkout was built into it, not a live view of any local source, worktree included.
Bring it up separately only to check the built image.

## Commands

| Command                   | Runs                                             | What it does                                                          |
| ------------------------- | ------------------------------------------------ | --------------------------------------------------------------------- |
| `npm run dev`             | `next dev`                                       | Dev server with hot reload, at :3000                                  |
| `npm run build`           | `next build`                                     | Production build; also inlines `NEXT_PUBLIC_API_HOST` into the bundle |
| `npm run start`           | `next start`                                     | Serves the build from `npm run build`                                 |
| `npm test`                | `vitest run`                                     | Runs the whole suite once, across the `logic` and `dom` projects      |
| `npm run test:watch`      | `vitest`                                         | Watch mode                                                            |
| `npm run coverage`        | `vitest run --coverage`                          | Whole suite plus a v8 coverage table, per file and as a summary       |
| `npm run coverage:report` | `vitest run --coverage --coverage.reporter=html` | Same, as a browsable report under `coverage/`                         |
| `npm run typecheck`       | `tsc --noEmit`                                   | Type-checks without emitting                                          |
| `npm run lint`            | `eslint`                                         | Flat-config ESLint over `app/frontend`, not the monorepo              |
| `npm run prettier`        | `prettier src/ docs/ README.md --write`          | Formats those paths in place                                          |
| `npm run prettier:check`  | `prettier src/ docs/ README.md --check`          | Fails on any unformatted file; the CI gate                            |

## Project structure

```
app/frontend/
├── src/
│   ├── app/                       # App Router: route shells ONLY, no logic
│   │   ├── layout.tsx             # html/body, fonts
│   │   ├── providers.tsx          # 'use client': SWRConfig + SessionProvider
│   │   ├── globals.css            # Tailwind v4 tokens
│   │   ├── page.tsx               # redirect to /resources
│   │   ├── healthz/route.ts       # GET handler, not a page: the Compose healthcheck's probe
│   │   └── (app)/
│   │       ├── layout.tsx         # AppShell: sidebar + SessionGate + content region
│   │       ├── resources/page.tsx
│   │       ├── shared/page.tsx
│   │       ├── explore/page.tsx
│   │       ├── groups/page.tsx
│   │       ├── policy/page.tsx
│   │       ├── request/page.tsx
│   │       ├── connections/page.tsx
│   │       └── debug/page.tsx
│   │           ├── log/page.tsx
│   │           ├── status/page.tsx
│   │           └── api/page.tsx
│   ├── features/                  # one folder per feature
│   │   ├── resources/             # my resources · explore · shared with me
│   │   ├── access/                # request access dialog · request builder · TraceViewer
│   │   ├── policy/                # party attrs · rules · both editors · derived context
│   │   ├── network/                # connections · groups
│   │   └── dev/                    # /debug screens: seed/reset, event log, service status, API docs
│   ├── components/
│   │   ├── ui/                    # shadcn primitives: generated, never hand-edited
│   │   ├── shell/                 # AppShell, AppSidebar, SessionGate, UserSwitcher,
│   │   │                          # NewUserDialog, PageHeader, nav.ts
│   │   ├── bart/                  # cross-feature Bart primitives
│   │   └── states/                # EmptyState, ErrorState, ListSkeleton, Pager, FormErrors
│   ├── lib/
│   │   ├── api/                   # typed client, wire types, page/query/error/content helpers
│   │   ├── bart/                  # lexer/parser, rule AST, printRule, trace model
│   │   ├── session/                # acting user context, cookie, POST /users
│   │   ├── format.ts               # shared date/size/label formatting
│   │   ├── toast.ts                # sonner wrapper
│   │   ├── utils.ts                # shadcn's cn() + apiUrl()
│   │   └── securityHeaders.ts      # CSP and header list; imported by next.config.ts, not by a component
│   ├── hooks/                     # shadcn's use-mobile.ts plus the handwritten
│   │                              # cross-feature hooks
│   └── test/                      # the dom project's shared kit
│       ├── setup.ts               # jsdom stubs, MSW server lifecycle
│       ├── render.tsx             # render, wrapped in a fresh SWR cache + TooltipProvider
│       ├── server.ts              # MSW node server and its default handlers
│       ├── session.tsx            # renderWithSession, over a real SessionProvider
│       ├── monaco.tsx             # BartEditorMock, the mock seam for Monaco
│       └── users.ts               # alice/bob, the shared ApiUser fixtures
├── next.config.ts
├── components.json                # shadcn config
├── Dockerfile
├── docs/
└── README.md
```

Every feature folder is close to the shape below, but not identical:

```
features/<name>/
├── <Name>Page.tsx    # the only thing app/**/page.tsx imports
├── components/        # feature-local components
├── hooks/              # SWR wrappers: useResources(), useMyPolicy()
└── api.ts               # this feature's endpoint calls
```

Two rules:

1. **Routes contain no logic.** A `src/app/**/page.tsx` is an import and a
   render, nothing else.
2. **`components/bart/` holds anything two features share.** Attribute
   chips, `.bart` rendering, and verdict badges appear on nearly every
   screen; they are not any one feature's property.

## Coding standards

- **TypeScript strict mode** (`tsconfig.json`'s `"strict": true`); no
  `any` without a reason.
- **Prettier** (`.prettierrc.yaml`): 80-column width, 4-space indent, no
  tabs, trailing commas everywhere, single quotes, semicolons,
  `arrowParens: avoid`, LF line endings.
- **`'use client'` only where a hook or an event handler requires it**:
  everything else stays a server component by default.
- **Version pinning is inherited from the backend**
  (`../backend/docs/DEVELOPMENT.md`): never jump a package to the newest
  major; use the API that matches the version actually pinned in
  `package.json`

## Data fetching

The app is a client-side SPA: every screen reads the backend live, on every
load. Every SWR key is built by `swrKey(actingUserId, path, params?)`
(`src/lib/api/keys.ts`), which returns `[actingUserId, path] | null`: `null`
tells SWR not to fetch at all, which is the state before an acting user has
resolved.

**Keys are user-scoped on purpose.** Switching the acting user produces a
different cache key, not a cache wipe: the previous user's data stays warm
for switching back, and (the property that matters) no screen can ever
render one user's data under another's identity, even transiently while a
request is in flight. Since the list hooks set `keepPreviousData`, that last
clause is now held up by `SessionGate`, which keys its children on the acting
user id: SWR retains the previous data whichever part of the key changed, so
only a remount can tell a filter change apart from an identity change.

**Some keys are unscoped**, and the exception proves the rule: `USERS_KEY`
(`GET /users`), `SCENARIOS_KEY` (`GET /dev/scenarios`), `EVENTS_KEY`
(`GET /dev/events`) and `STATUS_KEY` (`GET /dev/status`). Each is public
and identity-independent, and each is fetched under a plain path
(`src/lib/api/keys.ts`) rather than through `swrKey(...)`. `USERS_KEY` and
`SCENARIOS_KEY` are read by `SessionProvider` and the first-run screen
_before_ an acting user exists: `swrKey(null, …)` would be `null` and never
fetch, so the switcher (and the catalogue) would have nothing to render.
`EVENTS_KEY` and `STATUS_KEY` are read by `/debug/log` and `/debug/status`,
which render outside `SessionGate` for the same reason: a
scoped key would be `null` there too. Nothing is lost in any of those
cases: none of them belongs to any one user, so none can be one user's data
shown under another's identity.

**A user-scoped key protects fetched data, not local drafts.** Warm caches
make this sharp: switching back to a previously-visited user resolves
`isLoading` to false immediately, with no skeleton remount in between, so
without something forcing a remount, React would reconcile a draft-holding
component in place and it would keep the draft it held under the old
identity, with a later `PATCH /me` saving one user's edits onto another.
`SessionGate` (`components/shell/SessionGate.tsx`) is that something: it
keys its content `Fragment` on the acting user id and remounts every screen
on an identity change, so a component that holds an unsaved draft over
user-scoped data, like `PartyAttributesCard`, needs no key of its own to be
safe from this.

**Mutations revalidate the keys their own feature owns.** Every write goes
through the feature hook that owns the read it invalidates
(`useMyResources().create`, `useMyPolicy().saveRules`, `useGroups().join`, …).
The deliberate fan-outs stay inside that ownership: `useMyResources`' mutators
also refresh the acting user's `/me/resources/facets*` keys, two keys over one
corpus, and `useMyPolicy().saveAttrs` also revalidates the session user list,
which renders the attrs it just changed. A policy edit changes what
`/me/shared` would answer, but nothing revalidates it: that screen revalidates
on mount, and paying for a live evaluation per candidate on every
keystroke-adjacent save is not a trade worth making.

`src/app/providers.tsx` sets the global `SWRConfig`:

```ts
{ revalidateOnFocus: false, shouldRetryOnError: false }
```

`shouldRetryOnError: false` matters here specifically: a `403` is a real,
final answer ("you may not see this"), not a transient failure to retry.

**One deliberate exception:** access requests are not SWR-cached at all. Both
`requestAccess()` and `customRequest()` (`src/features/access/api.ts`) run as
one-shot calls into local component state, because caching a verdict would
contradict the no-stored-grants property the app exists to demonstrate. Closing
the dialog discards the result for the same reason: reopening re-evaluates.

## API client layer

`src/lib/api/client.ts` exports the calls below. `apiGet<T>(path)` and
`apiSend<T>(method, path, body?)` are the JSON pair; `apiUpload` and
`apiDownload` handle the two directions of resource content, which are not
JSON. All of them prefix `/api/v1`, then hand the result
to `apiUrl()` (`src/lib/utils.ts`) which roots it at `NEXT_PUBLIC_API_HOST`,
so the browser reaches the backend directly, with no Next rewrite in between.
That makes the call cross-origin whenever the host is set, hence
`credentials: 'include'` rather than `'same-origin'`: the `user` cookie would
otherwise be dropped. The backend registers `@fastify/cors` with
`credentials: true`, so the credentialed preflight is answered. A non-2xx
response throws `ApiError { status, errors }`.

An unset or empty `NEXT_PUBLIC_API_HOST` yields relative, same-origin URLs:
the shape to use when a reverse proxy fronts both services on one origin.

**`apiUpload` and `apiDownload` exist because content is bytes, and `apiSend` only speaks JSON.**
`apiSend` sets a JSON content type and `JSON.stringify`s its body; `apiGet`
ends in `res.json()`. Neither can be bent to a raw `application/octet-stream`
body or to a `Blob` response without turning both into a union of two unrelated
jobs, so the two byte-shaped calls are their own exports:

- `apiUpload<T>(path, file, {filename?, contentType?})` sends the `File`
  straight as the `fetch` body (`PUT /resources/:id/content` is raw, not
  multipart) and puts the declared name and MIME type in the query string,
  because the request's own `Content-Type` is spoken for. A parameter that is
  absent or empty is **omitted rather than sent empty**, so the backend applies
  its own `application/octet-stream` default instead of rejecting `""` as a
  malformed media type.
- `apiDownload(path)` answers `{blob, filename}` instead of parsed JSON, and
  reads the name out of `Content-Disposition` via `filenameFrom()`
  (`src/lib/api/content.ts`). It still routes failures through the same
  `readErrors()` as the JSON calls, so a `403` arrives as an `ApiError`
  carrying the backend's own message rather than as an unreadable blob.

Of these two, only `apiUpload` goes through `send()`, so only it inherits the
fixed `credentials: 'include'` that way; `apiDownload` answers bytes, so it cannot go
through `send()` and restates `credentials: 'include'` on its own `fetch`
call. What keeps both in `client.ts` rather than in the resources feature is
the error plumbing they share with `apiGet`/`apiSend` instead: `BASE`,
`apiUrl()`, and `readErrors()`.

Status taxonomy, from `../backend/docs/API.md`:

| Status | Meaning                                                                                        | Body on the wire               |
| ------ | ---------------------------------------------------------------------------------------------- | ------------------------------ |
| `400`  | Validation failure: bad `attrs`, invalid rule syntax, malformed UUID                           | `{errors: [...]}`              |
| `401`  | Missing or unknown acting user (`user` cookie)                                                 | `{errors: [...]}`              |
| `403`  | Not the resource's owner / not a group member / a denied content download                      | `{errors: ["Not authorized"]}` |
| `404`  | Not found: unknown route, or resource/group id                                                 | empty                          |
| `409`  | Already connected / already a group member (`POST /me/connections/:id`, `POST /me/groups/:id`) | empty                          |
| `413`  | Uploaded content exceeds the backend's limit (32MB)                                            | `{errors: [...]}`              |
| `500`  | A stored policy is invalid (rejected by the evaluator despite write-time validation)           | `{errors: [...]}`              |
| `503`  | Evaluator service unreachable or timed out                                                     | `{errors: [...]}`              |

`404` is genuinely empty-bodied everywhere; `409` is too, but only on the two
`POST` mutations above; `401` and `403` already carry a real
`{errors: [...]}` from the backend's error handler. `client.ts`'s
`readErrors()` still keeps a status-keyed fallback message
(`EMPTY_BODY_MESSAGES`, covering `401`/`403`/`404`/`409`) for whenever a
response _is_ empty or non-JSON, so the UI never shows a blank error
regardless of which case produced it, including the empty `409` a stale
second tab can hit after `revalidateOnFocus: false` lets its view of
`/me/connections` or `/me/groups` go stale.

## Backend wiring

Every screen is live. Nothing is mocked, nothing is stored client-side, and
`src/lib/fixtures/` no longer exists. This table is the caller-to-endpoint map;
`../backend/docs/API.md` remains the authoritative contract and is deliberately
not restated here.

| Caller                                                                                  | Endpoint                                              | Verb              | Answers                                                                                                                                                              |
| --------------------------------------------------------------------------------------- | ----------------------------------------------------- | ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SessionProvider` (`lib/session/SessionProvider.tsx`)                                   | `/users`                                              | GET               | `Paginated<ApiUser>` → `PagedList<ApiUser>` (bare path, no `page`/filter params)                                                                                     |
| `createUser()` (`lib/session/api.ts`)                                                   | `/users`                                              | POST              | `ApiUser`                                                                                                                                                            |
| `useMyPolicy()` → `getMe()` (`features/policy/api.ts`)                                  | `/me` 🔒                                              | GET               | `ApiUser`: `{attrs, rules}` is the whole policy                                                                                                                      |
| `useMyPolicy().saveAttrs` / `.saveRules` → `patchMe()`                                  | `/me` 🔒                                              | PATCH             | `ApiUser`: each field replaces its stored value wholesale                                                                                                            |
| `useMyPolicy()` → `getMyContext()`                                                      | `/me/context` 🔒                                      | GET               | `ApiContext`: `{values, display, names}`                                                                                                                             |
| `useMyResources()` → `listMine()` (`features/resources/api.ts`)                         | `/me/resources` 🔒                                    | GET               | `Paginated<ApiResource>` → `PagedList<ApiResource>`, filtered by `params` (`page`, `name`, `attr`)                                                                   |
| `useAllResources()` → `listAll()`                                                       | `/resources`                                          | GET               | `PagedList<ApiResource>` (public, no cookie required); `params` adds `excludeUserId` on Explore                                                                      |
| `useSharedWithMe()` → `listSharedWith()`                                                | `/me/shared` 🔒                                       | GET               | `PagedList<ApiResource> & {scan: ScanInfo}`: filters narrow the CANDIDATE query, before evaluation                                                                   |
| `useResourceFacets()` → `listResourceFacets()` / `listMyResourceFacets()`               | `/resources/facets` or `/me/resources/facets`         | GET               | `Facet[]` (`{key, values}[]`): the corpus's vocabulary under the same filters, not the loaded page's                                                                 |
| `useAttrVocabulary('parties')` → `listUserFacets()` (`features/resources/api.ts`)       | `/users/facets`                                       | GET               | `Facet[]`: the same shape over user attributes, for party-pattern editors                                                                                            |
| `useMyPolicy().deleteAccount` → `deleteMe()` (`features/policy/api.ts`)                 | `/me` 🔒                                              | DELETE            | `ApiUser`: the deleted record; the cookie is dropped afterwards                                                                                                      |
| `getAccountSummary()` (`features/policy/api.ts`)                                        | `/me/resources` + `/me/connections` + `/me/groups` 🔒 | GET               | Only the envelope totals, for the delete confirmation; the rows are discarded                                                                                        |
| `useMyResources().create` / `.update` / `.remove`                                       | `/resources[/:id]` 🔒                                 | POST/PATCH/DELETE | `ApiResource`                                                                                                                                                        |
| `useMyResources().upload` → `uploadContent()`                                           | `/resources/:id/content` 🔒                           | PUT               | `ApiResource`: raw body, `?filename=` / `?contentType=`                                                                                                              |
| `useMyResources().clear` → `clearContent()`                                             | `/resources/:id/content` 🔒                           | DELETE            | `ApiResource`: idempotent; clearing nothing is still a `200`                                                                                                         |
| `downloadContent()`                                                                     | `/resources/:id/content` 🔒                           | GET               | raw bytes + `Content-Disposition`; a denial is a `403`                                                                                                               |
| `requestAccess()` (`features/access/api.ts`)                                            | `/resources/:id/access` 🔒                            | GET               | `AccessResponse`: a denial is `200 {permitted: false}`                                                                                                               |
| `customRequest()`                                                                       | `/resources/access` 🔒                                | POST              | `{permitted, evaluation}`; `evaluation` is never `null`                                                                                                              |
| `useRuleCoverage()` → `fetchRuleCoverage()` (`features/resources/api.ts`)               | `/me/rules/coverage` 🔒                               | POST              | `RuleCoverageResponse` (`{total, coverage}`): `coverage[i]` pairs with the sent `patterns[i]` by index                                                               |
| `useConnections()` → `listUsers()` + `listConnectionsAll()` (`features/network/api.ts`) | `/users` + `/me/connections` 🔒                       | GET               | `PagedList<ApiUser>` (paged, filtered by `params`) joined against `{items, complete}` (walked in full) → `{...page, rows: {user, connected}[], connectionsComplete}` |
| `useConnections().connectTo` / `.disconnectFrom`                                        | `/me/connections/:id` 🔒                              | POST/DELETE       | `204`, no body: the write is mutual, both directions at once                                                                                                         |
| `useGroups()` → `listAllGroups()` + `listMyGroupsAll()`                                 | `/groups` + `/me/groups` 🔒                           | GET               | `PagedList<ApiGroup>` (paged, filtered by `params`) joined against `{items, complete}` (walked in full) → `{...page, rows: {group, joined}[], membershipsComplete}`  |
| `useGroups().join` / `.leave`                                                           | `/me/groups/:id` 🔒                                   | POST/DELETE       | `204`, no body                                                                                                                                                       |
| `useGroups().create` / `.update` / `.destroy`                                           | `/groups[/:groupId]` 🔒                               | POST/PATCH/DELETE | `ApiGroup`; the delete returns the deleted group, which the client discards. A `403` here means "not a member", since there is no group owner                        |
| `useGroupNames()` → `getGroup()` (`features/network/api.ts`)                            | `/groups/:groupId`                                    | GET               | `ApiGroup`: resolves a single id a list page never loaded                                                                                                            |
| `useScenarios()` / `seedScenario()` / `resetDatabase()` (`features/dev/api.ts`)         | `/dev/scenarios`, `/dev/seed`, `/dev/reset`           | GET/POST          | The catalogue (`{scenarios}`), the seed result, and the deleted counts                                                                                               |
| `listEvents()` / `getServiceStatus()` (`features/dev/api.ts`)                           | `/dev/events`, `/dev/status`                          | GET               | The paged event log, and `{services}` plus a client-measured round trip                                                                                              |

The consequences of that map worth stating outright:

- **A download's filename crosses an origin only because the backend allows it.**
  `Content-Disposition` is not a CORS-safelisted response header, so a
  cross-origin `fetch` cannot read it unless the server lists it in
  `exposedHeaders`, which the backend now does (`../backend/docs/API.md`,
  `GET /{resourceId}/content`). Without that, `filenameFrom()` would see
  `null` on every download and every saved file would be named after the
  resource's display name instead of its real filename.
- **The reads that need no cookie**: `/users`, `/resources` and `/groups`.
  Attributes are public and only _access_ is bartered, which is the whole
  premise: Explore can show the entire corpus and still tell you nothing about
  what you may open. `/resources` and `/groups` are nonetheless fetched under a
  user-scoped key, because the screen filters or joins against the caller's
  identity; `/users` is unscoped, for the reason in Data fetching.
- **`POST /resources/access` returns the same `{permitted, evaluation}` shape**
  as the row path, so `TraceViewer` renders it unchanged, but there is no row,
  hence no owner short-circuit and no downloadable bytes behind a permit.
- **Not everything the backend offers has a caller.** `GET /users/:id` and
  `GET /resources/:id` are unused: every screen either lists or already holds
  the record, so a single-row read never comes up. That is a UI gap, not a
  contract mismatch.

## Pagination

**Every list screen takes `page` plus its filters, and holds that state itself.**
`useListQuery(initial)` (`src/lib/api/query.ts`) owns
`{page, filters}` per screen, exposes them as `params` (via `listParams()`,
which drops empty filters so `?name=` never reaches the backend as a real
constraint), and resets `page` to 1 whenever `setFilters` changes anything:
otherwise narrowing a result set while on page 3 would strand the user on a
page that no longer exists. `pageOf()` (`src/lib/api/page.ts`) flattens the
backend's `{data, page: {size, totalElements, totalPages, number}}` envelope
into `PagedList<T> = {items, total, page, totalPages}`, and `<Pager>`
(`src/components/states/Pager.tsx`) renders those fields as the list
footer (`‹ Prev · Page N of M · T results · Next ›`), hiding itself entirely at
`totalPages <= 1` so a single-page list shows no dead controls.

**Typing is debounced; clicking is not.** `useListQuery` keeps two copies of
the filters: `filters` updates per keystroke and is what the input renders,
and `appliedFilters` commits `FILTER_DEBOUNCE_MS` (250 ms) later and is the
only one that reaches `params`, and therefore the SWR cache key. `setFilters`
takes the wait, `commitFilters` skips it, and facet chips and "Clear filter"
buttons use the second because a click is already a complete instruction. Page
and filters commit together at page 1, so the reset-to-page-1 rule costs no
extra request. `isPending` says a typed change is still waiting.

**List reads set `keepPreviousData`, so a refetch never blanks the screen.**
The previous key's rows stay mounted at full opacity while the new key loads,
with a spinner in the `FilterInput` rather than a `ListSkeleton` underneath;
screens therefore branch their skeleton on `!data`, never on `isLoading`,
which is true and holding data at the same time. Placeholders now mean "there
has never been anything here", which is the only thing they can honestly mean.

**Filters and facets are both server-side, over the corpus, not the page in view.**
`name`/`username` (case-insensitive substring) and `attr`
(`key:value`, split on the first colon) travel as query params, and the
filter bar's chips come from a dedicated facets endpoint
(`GET /resources/facets`, `GET /me/resources/facets`) rather than being derived
from whatever rows happen to be loaded. Deriving chips from one page would
offer a filter vocabulary that contradicts what filtering against it can
actually find on other pages.

**One exception: `/me/groups` and `/me/connections` are fetched in FULL, never paged.**
`GroupsPage` renders "every group, and whether I am in it": a join
of the paged public `/groups` list against the caller's own `/me/groups`
membership, and `ConnectionsPage` is the same join over `/users` ×
`/me/connections`. Paging the membership side of either join would silently
reintroduce a false negative: a membership living past page 1 of `/me/groups`
would render as an unremarkable "not joined," with nothing on screen to say
the list was short. `fetchAllPages()` (`src/lib/api/query.ts`) walks the
caller's own membership list to completion instead, capped at
`MAX_WALKED_PAGES` (10 pages, 500 rows at the backend's page size) so a
pathological corpus still cannot turn a join input into an unbounded fetch;
`listMyGroupsAll()` / `listConnectionsAll()` report `complete: false` if the
cap was hit, which `useGroups()` / `useConnections()` surface as
`membershipsComplete` / `connectionsComplete` for `GroupsPage` /
`ConnectionsPage` to disclose. Only the caller's OWN memberships are walked
this way: the public list on each screen pages normally, like everything
else.

## Monaco

`BartEditor` (`@/components/bart/BartEditor`) runs on Monaco, self-hosted from this origin rather
than fetched from a CDN. `@monaco-editor/react` defaults to loading Monaco from jsdelivr, which
would break the offline demo and the standalone Docker image, and it fails silently, as a blank
editor with no visible error, if that CDN is unreachable.

`scripts/sync-monaco.mjs` copies `node_modules/monaco-editor/min/vs` into `public/monaco/vs`, and
`BartEditorImpl` calls `loader.config({paths: {vs: '/monaco/vs'}})` at module scope, before any
editor mounts, to point `@monaco-editor/react`'s loader there instead. The AMD build resolves its
own web workers relative to that path, so nothing else (no `MonacoEnvironment` wiring) is
needed. The sync script runs from both `predev` and `prebuild`, so a fresh clone and the Docker
builder both get a copy without a separate step; `/public/monaco` itself is generated and
gitignored, never committed.

**The Dockerfile needs no change for this.** It already `COPY`s the whole `builder` stage's
`public/` directory into the `runner` stage; `sync-monaco.mjs` having run during `prebuild` is
enough for the generated files to already be there when that `COPY` executes.

**Rejected alternative: bundling `monaco-editor/esm/...` through Turbopack.** It would tree-shake
better than copying the whole prebuilt AMD `min/vs` tree, but it needs its own web-worker and CSS
wiring that the AMD build gets for free by being a self-contained static tree. Revisit if image
size ever becomes the binding constraint; it is not one today.

## Security headers

`next.config.ts` sets `Referrer-Policy`, `X-Content-Type-Options`, `X-Frame-Options`,
`X-XSS-Protection` and the Content Security Policy on `/(.*)`, and turns off
`poweredByHeader`. The policy string is built by `src/lib/securityHeaders.ts`, which is a
plain function so it can be unit tested; the config imports it with a relative specifier,
because the `@/` alias does not reach the config loader.

Applying at `/(.*)` covers static assets and error responses, which the previous
arrangement did not: the headers used to be `add_header` directives in the reverse proxy's
`/` location, and without `always` those skip error responses.

`process.env.NODE_ENV` selects the development widening: `'unsafe-eval'` for React's server
error reconstruction and `ws:` for hot reload.

`connect-src` follows `NEXT_PUBLIC_API_HOST`, adding it as a source whenever it is set.
`'self'` covers the API only while a reverse proxy puts the two on one origin, which is the
Compose stack and nothing else: a `npm run dev` session calls another port, and so does any
split-origin deployment. The policy therefore reads the same variable the API client is
rooted at, so a call the client is configured to make is a call the policy allows.

## Docker

Multi-stage build on `node:26-alpine`, `output: 'standalone'`
(`next.config.ts`), adapted from Next's `with-docker` example, hence the
`base` → `deps` → `builder` → `runner` chain. The example's package-manager
detection is gone: npm is the pinned manager, so `deps` runs a plain `npm ci`
under a cache mount and `builder` a plain `npm run build`.

**`NEXT_PUBLIC_API_HOST` must be reachable from the browser**: an internal
Compose service name like `http://app-backend:8081` cannot work, because the
request is issued by the user's browser, not by the Next server. That is the
trade for dropping the `rewrites()` proxy, which used to resolve service names
server-side.

**It is still inlined at build time.** Next replaces every
`process.env.NEXT_PUBLIC_*` reference with a literal while `next build` runs
([environment-variables guide](https://nextjs.org/docs/app/guides/environment-variables#bundling-environment-variables-for-the-browser)),
so a `docker run -e NEXT_PUBLIC_API_HOST=...` override does nothing. The
`builder` stage declares `ARG NEXT_PUBLIC_API_HOST=` (empty) before its build
step:

```bash
docker build --build-arg NEXT_PUBLIC_API_HOST=https://api.example.com .
```

The empty default is the useful one: `apiUrl()` then emits same-origin
relative URLs, so a single image works behind any reverse proxy that serves
frontend and backend on one origin: no per-environment rebuild. Passing the
build arg is only needed when the two are on separate origins. Making the host
genuinely per-request would mean reading it in a Server Component and handing
it to the client, which the current client-side SPA shape does not do.

**Under Compose** the service is `app-frontend` in the root
[`docker-compose.yml`](../../../docker-compose.yml), reached through the nginx proxy on
`127.0.0.1:8000` and built with no `NEXT_PUBLIC_API_HOST` at all. The empty default is the
point: frontend and API share an origin behind the proxy, so relative URLs are correct and
no per-environment rebuild is needed. `docker-compose.dev.yml` republishes `127.0.0.1:3000`
for the cases that want the container directly, and
**rebuilds the same service with `NEXT_PUBLIC_API_HOST=http://localhost:8081`**, since a
container reached on `:3000` is not behind the proxy and has to name the backend origin. That
build arg is why layering the development file takes `--build`.

```bash
docker compose up -d --build app-frontend
```

Two runtime details of the `runner` stage, neither inferable from the Next
docs:

- **`HOSTNAME=0.0.0.0` is pinned deliberately.** Docker injects
  `HOSTNAME=<container id>` into every container, and the standalone
  `server.js` starts with `process.env.HOSTNAME || '0.0.0.0'`, so without the
  pin the server binds that one address and `127.0.0.1:3000` inside the
  container is refused, which kills any healthcheck or `docker exec` probe
  (a published port keeps working, so the breakage is easy to miss). The
  listener is IPv4-only regardless: an in-container probe must use
  `127.0.0.1`, never `localhost`, which busybox resolves to `[::1]` first.
- **It runs as `node` (uid 1000), like the backend image.** `.next/` is
  created with `mkdir` and `chown`ed to `node:node` because Next writes its
  runtime caches under `.next/cache`.
