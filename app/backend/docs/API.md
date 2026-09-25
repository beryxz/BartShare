# API

All API endpoints are under `/api/v1`, the liveness probe included.

OpenAPI/Swagger docs are available at `/api/v1/swagger/ui`, and the raw document at `/api/v1/swagger/raw`. Both are public, like `/api/v1/healthz`: they carry `security: []` and no `401`. The UI response sets its own `content-security-policy` with an open `frame-ancestors`, so it can be embedded from any origin.

The document's `servers` entry is the relative URL `/`, so it resolves against whichever
origin served the document: the reverse proxy in the default stack, or `8081` directly
under the development Compose file, with no per-environment configuration. Redoc renders
that entry as the API's base URL, and a generated client or an imported collection reads it
the same way, so it must never be derived from `API_HOST`: that is a bind address (`0.0.0.0`
under Compose), reachable from nowhere.

CORS is enabled for every origin, with credentials: this is a test application meant to be driven from whatever frontend origin is at hand.

## Authentication

`user` cookie that specifies the UUID of the user to impersonify.

Authentication is wired per route group, not globally: each group that needs it calls `requireUserCookie()` inside its own `register()` call, which installs the cookie check on the routes registered alongside it. Unknown paths are _not_ hidden behind an auth error; they answer a plain empty `404` everywhere, whether or not the prefix contains authenticated routes and whether or not a cookie is presented. Concealing which paths exist bought nothing for this application, so it was deliberately removed.

| Case                                            | Status | Body                                             |
| ----------------------------------------------- | ------ | ------------------------------------------------ |
| No `user` cookie on an authenticated route      | 401    | `{ "errors": ["Missing authorization cookie"] }` |
| `user` cookie not matching a user               | 401    | `{ "errors": ["Invalid User ID in cookie"] }`    |
| Authenticated, but not the owner / not a member | 403    | `{ "errors": ["Not authorized"] }`               |
| Unknown path, anywhere                          | 404    | empty                                            |

## Response Formats

### Errors

An error response either carries no body at all (the empty-bodied `404`s and the `409`s that
only report a clash) or follows:

```json
{ "errors": ["Error message 1", "Error message 2"] }
```

Under `DEBUG`, an error that reaches the application error handler appends a second element
holding the serialized error, so the bodies quoted for those below are the `DEBUG=false` shape.
Only a thrown error gets there: the `401`s, a request the route schema rejects, the `413`
body-limit rejection, and the `400`s a controller throws rather than sends, such as the
provider collision under `GET /me/context` and the emit failure under `GET /me/shared`. A body
a handler sends itself (the bodied `409`, `500` and `503`) is untouched, and so is a model
validation failure, which returns before that branch.
`.env.example` and the test environment set `DEBUG` false; the shipped `.env` and the Compose
service set it true.

### Pagination

Paginated list responses follow:

```json
{
    "data": [],
    "page": {
        "size": 50,
        "totalElements": 150,
        "totalPages": 3,
        "number": 1
    }
}
```

Page numbers are 1-indexed: `?page=1` returns the first page, and `page.number` echoes the
requested page. Page sizes are defined in `config.ts` under `APP_LIMITS`.

Every list endpoint orders deterministically, ending in `id ASC`: a leading column (or
expression) with `id ASC` as the tiebreaker, so ordering holds even when that column repeats
across rows (e.g. two groups with the same `name`). `GET /me/connections` orders by `id ASC`
alone, having no leading column. Without the tiebreaker, offset paging across identical repeated
requests could repeat one row on a later page and skip another.

## Endpoints

Legend:

- `{param}` denotes a path parameter (UUID). A malformed UUID is rejected with `400`.
- Endpoints marked 🔒 require the `user` cookie.

### Users (`/users`)

| Method | Path        | Description                                                                                                              |
| ------ | ----------- | ------------------------------------------------------------------------------------------------------------------------ |
| GET    | `/`         | List all users, paginated. Accepts `?username=` (substring match against `attrs.username`). Returns `{id, attrs, rules}` |
| GET    | `/facets`   | Get the distinct attribute vocabulary across all parties. Accepts `?username=` (substring match)                         |
| GET    | `/{userId}` | Get a single user                                                                                                        |
| POST   | `/`         | Create a user from `{attrs, rules?}`; `rules` defaults to `[]`                                                           |

#### Username constraints

`attrs.username` is enforced by the mechanisms below, both shared by `POST /users` and
`PATCH /me`:

- The `User` model validator requires it, and requires it be a string of at least 2 and at most
  128 characters, measured after trimming.
- Both controllers separately trim the value before writing it, and separately call
  `isUsernameTaken` to reject a duplicate (`attrs: 'username' is already taken`); there is no
  database constraint, since the column is JSON.

A violation is a `400 { errors: [...] }`, one message per problem. The length rules are measured
on the trimmed value, so `" x "` is one character, not three.

#### `GET /users/facets`

The distinct attribute vocabulary across all parties, in the same shape as `GET /facets` under
Resources:

```json
{
    "facets": [
        { "key": "role", "values": ["auditor", "student"] },
        { "key": "username", "values": ["david", "mary"] }
    ]
}
```

- Same `RESERVED_ATTR_NAMES` exclusion as the resource facets, so `userId` never appears. That
  holds even though `userId` **is** legal in a `from:` party pattern: a list of uuids is not a
  useful suggestion, and a party is named through the picker, not by typing an id.
- `?username=` is a substring match against `attrs.username`, mirroring `GET /users`.
- Registered before `GET /{userId}` so `/facets` cannot be mistaken for a user id.

### Me (`/me`) 🔒

| Method | Path                    | Description                                                                                             |
| ------ | ----------------------- | ------------------------------------------------------------------------------------------------------- |
| GET    | `/`                     | Get the authenticated user                                                                              |
| PATCH  | `/`                     | Update `attrs` and/or `rules`                                                                           |
| DELETE | `/`                     | Delete the user, its resources, connections and memberships                                             |
| GET    | `/context`              | Get the derived context the evaluator will see for the caller right now                                 |
| GET    | `/resources`            | List the user's resources, paginated                                                                    |
| GET    | `/resources/facets`     | Get the distinct attribute vocabulary across the user's resources                                       |
| GET    | `/shared`               | List resources the engine permits the user to access, paginated                                         |
| POST   | `/rules/coverage`       | Count how many of the user's resources each rule pattern covers                                         |
| GET    | `/connections`          | List the user's connections, paginated. Accepts `?username=` (substring match against `attrs.username`) |
| POST   | `/connections/{userId}` | Connect to a user (both directions) → `204`                                                             |
| DELETE | `/connections/{userId}` | Disconnect from a user (both directions) → `204`                                                        |
| GET    | `/groups`               | List the user's groups, paginated. Accepts `?name=` (substring match)                                   |
| POST   | `/groups/{groupId}`     | Join a group → `204`                                                                                    |
| DELETE | `/groups/{groupId}`     | Leave a group → `204`                                                                                   |

Connections are mutual: connecting writes both directions, disconnecting removes both.
`POST /connections/{userId}` answers `400 { errors: ["Cannot connect a user to itself"] }` when
the path id is the caller's own.

#### `GET /context`

What the evaluator will see for the caller right now: the values the context providers
(`src/bart/context/`) emit for this one party, the same ids resolved for display, and the
vocabulary a rule can reference. This is the data source for the "what will actually be
evaluated" panel: the first thing to check when a request denies unexpectedly.

```json
{
    "values": {
        "date_year": 2026,
        "date_month": 7,
        "date_day": 30,
        "connections": ["<uuid>"],
        "groups": ["<uuid>"]
    },
    "display": {
        "connections": [{ "id": "<uuid>", "username": "david" }],
        "groups": [{ "id": "<uuid>", "name": "csbook-club" }]
    },
    "names": [
        {
            "key": "connections",
            "providedBy": "connections",
            "description": "The ids of everyone you are connected to. Connections are mutual.",
            "example": "requester.userId in connections"
        }
    ]
}
```

- **`values` holds exactly what the providers emit: ids, never usernames.** That is what a
  condition actually matches on (`condition: requester.userId in connections`), so this is the
  one field that must never be "helpfully" resolved to something friendlier.
- **`display` is presentation only.** It resolves the same ids to `{id, username}` /
  `{id, name}` pairs for the UI and carries no evaluation meaning; a rule cannot reference it.
- **`names` is one entry per context _key_, not per provider**, and is derived from the
  provider registry rather than handwritten. A provider emitting several keys documents each
  one separately (`ContextKeyDoc` in `src/bart/context/provider.ts`), so `date_month`'s
  `example` is about `date_month` rather than about the provider that emits it. Adding a
  provider extends this reference with no edit here, and a key cannot be added without
  documenting it.
- `400 { errors: [...] }` if two providers emit the same key. That is a bug in the provider
  registry rather than anything the caller can cause, and it fails the whole read rather than
  letting one provider silently win.

#### `GET /resources`

Accepts the same `?name=` and `?attr=` filters as `GET /resources` on the public listing (see
that section for the exact matching rules), implicitly scoped to the caller's own rows via the
`user` cookie, so there is no `excludeUserId`: the route already knows who "mine" is.

#### `GET /resources/facets`

The distinct attribute vocabulary across the caller's resources, honouring the same `?name=`
and `?attr=` filters as `GET /resources` above. See `GET /resources/facets` under Resources for
the response shape and the reserved-key exclusion; this is the same query, scoped to the
caller's own rows via the `user` cookie instead of an `excludeUserId` param.

#### `GET /shared`

Every resource the caller does not own that the engine permits right now.
**The application stores no grants at all** (that is the property the whole case study exists
to demonstrate), so this cannot be a table lookup: it is a live evaluation, one `/evaluate`
call per candidate
resource, fanned out `APP_LIMITS.resources.sharedConcurrency` at a time and memoised per owner
(the closure, policy texts and context tuple depend only on the (caller, owner) pair, so they
are assembled once per owner and reused for every one of that owner's rows).

Response, same envelope as every other paginated list plus one extra key:

```json
{
    "data": [
        {
            "id": "...",
            "attrs": {},
            "metadata": {},
            "content": null,
            "user": { "id": "..." }
        }
    ],
    "page": { "size": 50, "totalElements": 1, "totalPages": 1, "number": 1 },
    "scan": { "considered": 1, "total": 1, "truncated": false }
}
```

- **Candidates are every resource the caller does not own, deliberately not scoped to connections or groups.**
  Bart grants by attribute; a rule can permit any CS undergraduate with no connection to the
  owner required, so filtering the candidate set by relationship would hide resources the
  engine genuinely permits: a false negative on the one screen whose entire job is "what
  can I actually reach." Connections and groups already shape the _verdict_, through
  the context providers a policy's own condition can consult; they do not also shape which
  resources are considered.
- **`?name=` and `?attr=` accept the same filters as `GET /resources`** (see that section for
  the exact matching rules), but here they narrow the _candidate_ query (applied to both the
  `count` and the candidate fetch, before any engine call is made) rather than filtering the
  survivors after the fact. This is a strict improvement, not a compromise: fewer candidates
  means fewer live `/evaluate` calls and less truncation against `maxSharedCandidates`, never
  more. Omitting both reproduces exactly the unfiltered scan.
- `scan` reports how much of the corpus **matching the filter** was looked at, not how many
  evaluations succeeded: `considered` is the number of candidate rows fetched (bounded by
  `APP_LIMITS.resources.maxSharedCandidates`), `total` is the true count of resources the caller
  does not own that also match `?name=`/`?attr=` (the full corpus when neither is given), and
  `truncated` is `total > considered`. It is deliberately not called `evaluation`, since that name
  already means "the assembled policy system and its trace" everywhere else in this API.
- `page` paginates the _survivors_ (the permitted resources), not the candidates: "permitted"
  cannot be pushed into a SQL `LIMIT`, so the whole (bounded) candidate set is evaluated first
  and the page is sliced from the result.
- The two evaluator failure modes are handled differently, because one bad row must not blank
  the whole page but a downed service must not misreport an empty page as "nothing is shared":
  a rejection (`EvaluatorRejectedError`) is logged and the _one candidate it happened for_ is
  treated as not-shared, while the scan continues over the rest. This covers a rejection at
  either point a candidate hits the evaluator: assembling the policy system for its owner
  (the party closure) or evaluating the request itself. Because the per-owner assembly is
  memoised, a rejected assembly is cached too, so every other candidate under that same owner
  independently sees the same rejection and resolves to "not shared" as well, with no repeated
  assembly attempts, but candidates under _other_ owners are never affected. An evaluator that
  is unreachable, times out, or answers `5xx` (`EvaluatorUnavailableError`) is different: every
  remaining assembly and evaluation would fail too, so it propagates and the whole request
  answers `503 { errors: [...] }` rather than a partial, misleadingly-empty list. The status is
  what separates the two: a `5xx` is the service failing, so reading it as a rejection would
  drop the row and still answer 200.
- `500 { errors: [...] }` stays declared in the response schema for the general "the evaluator
  rejected something" case that every other evaluator-backed endpoint can produce, but is not
  reachable through the row-level rejection path described above: every call into the evaluator
  this endpoint makes (assembling a candidate's owner's policy system, and evaluating the
  request) catches `EvaluatorRejectedError` and scores that candidate as not-shared
  instead of letting it escape.
- Emitting a candidate's request line sits between those two calls and is _not_ guarded, so
  unlike the rejections above it does blank the page: a row whose `attrs` cannot be emitted as
  `.bart` raises `BartEmitError`, which is neither a rejection nor an outage, escapes the scan,
  and answers `400 { errors: [...] }` with the emitter's own message for the whole request.
  Write-time validation is what keeps such a row out of the database in the first place.
  Everything else the endpoint does (counting/loading candidate resources, loading party
  attributes for the closure) is a plain database read with no evaluator involved.

#### `POST /rules/coverage`

Counts, for each of a set of already-parsed rule patterns, how many of the caller's resources
it covers. The client parses `.bart` rules for its own purposes (deciding which editor a rule
opens in), so the pattern objects arrive pre-parsed in the request body rather than being
parsed here, since the backend has no `.bart` parser, and adding one would mean a second parser to
keep in sync with the client's. What the server contributes is the part the client cannot have
on its own: the caller's _complete_ resource set, so the denominator is exact rather than
whatever page happens to be loaded in the UI.

Request body:

```json
{
    "patterns": [
        { "kind": "notes" },
        { "kind": "exercises" },
        { "kind": "slides" }
    ]
}
```

Response:

```json
{
    "total": 3,
    "coverage": [
        { "count": 2, "sample": ["notes one", "notes two"], "nearest": null },
        { "count": 1, "sample": ["exercise one"], "nearest": null },
        {
            "count": 0,
            "sample": [],
            "nearest": {
                "name": "notes one",
                "missing": [],
                "conflicting": ["kind"]
            }
        }
    ]
}
```

- `total` is the caller's whole resource count, not a page of it: this endpoint exists
  specifically to fix a UI bug where the denominator was one page's worth of rows.
- `coverage[i]` corresponds to `patterns[i]` by index; `patterns` accepts at most 200 entries.
- `sample` lists up to 20 covered resource names (`metadata.name`), for a UI popover; `count`
  is the true total, uncapped.
- Coverage is `matches(resource.attrs, pattern)`, the same "every key of `a` appears in `b`
  with an equal value" predicate as elsewhere in this API, but
  called in the **resource direction**: a resource is covered when every attribute it carries
  is restated by the rule's pattern, not the other way around. An empty pattern `{}` is
  therefore _not_ a wildcard here: it only covers a resource that itself carries no attributes,
  the reverse of how an empty pattern behaves when matching a party.
- `nearest` is `null` whenever `count` is greater than 0, since a covering pattern owes no diagnosis.
  When a pattern covers nothing, it names the resource the pattern came closest to (ranked by
  overlap, the keys the pattern named that the resource also carries, then by most agreed on,
  then fewest blocking, then id ascending), the attributes the pattern never mentioned
  (`missing`), and the attributes it named with a disagreeing value (`conflicting`). Overlap
  outranks agreement because with nothing agreeing every candidate ties at zero, and agreement
  alone would then pick the least descriptive resource in the corpus.
- `400 { errors: [...] }` on a schema validation failure (e.g. more than 200 patterns).

### Resources (`/resources`)

| Method | Path                       | Description                                                                         |
| ------ | -------------------------- | ----------------------------------------------------------------------------------- |
| GET    | `/`                        | List all resources, paginated. Returns `{id, attrs, metadata, content, user: {id}}` |
| GET    | `/facets`                  | Get the distinct attribute vocabulary across all resources                          |
| GET    | `/{resourceId}`            | Get a single resource                                                               |
| POST   | `/` 🔒                     | Create a resource from `{attrs, metadata}`, owned by the caller                     |
| PATCH  | `/{resourceId}` 🔒         | Replace `attrs` and/or `metadata`. Owner only                                       |
| DELETE | `/{resourceId}` 🔒         | Delete the resource. Owner only                                                     |
| GET    | `/{resourceId}/access` 🔒  | Evaluate whether the caller may access the resource                                 |
| POST   | `/access` 🔒               | Evaluate a caller-composed request against the whole policy system                  |
| PUT    | `/{resourceId}/content` 🔒 | Upload/replace the resource's content. Owner only                                   |
| GET    | `/{resourceId}/content` 🔒 | Download the resource's content. Owner or evaluator-permitted                       |
| DELETE | `/{resourceId}/content` 🔒 | Clear the resource's content, keeping the resource                                  |

Every resource is returned as `{id, attrs, metadata, content, user}`.

- `attrs` is the Bart request. Every key here is a demand the
  granting rule must restate, so UI fields must not go in it.
- `metadata` is free-form JSON for the UI. It requires a `name` (non-empty string, ≤256
  chars); `description` is optional (≤2048). Never validated as Bart, never evaluated.
- `content` is `{type, size, filename}` or `null`: metadata about the uploaded bytes, never
  the bytes themselves.

`POST /resources` takes `{attrs, metadata}`, both required. `PATCH /resources/{id}` takes
`{attrs?, metadata?}` with at least one present; each replaces its field wholesale.

#### `GET /`: filters

`GET /resources` accepts the optional, independent query params below; omitting all of them
reproduces exactly the unfiltered list.

- `?name=`: case-insensitive substring match against `metadata.name` (an interior substring,
  not just a prefix).
- `?attr=key:value`: matches a resource whose `attrs[key]` holds `value`, whether stored as a
  scalar or as a member of an array. Split on the _first_ colon only, so `attr=topic:sci:fi`
  looks up key `topic` with value `sci:fi`. A value that looks numeric or boolean (e.g.
  `year:2023`) also probes for the typed form, so it matches a numeric/boolean attribute too,
  not just a string one. A malformed value is one with no colon at all, or with a leading one:
  it matches zero rows, a truthful empty page rather than a 500 or a silent fallback to the
  unfiltered list. `attr=topic:` is not malformed but well-formed, a probe for the empty-string
  value, which matches only a row that stores `topic` as `""`.
- `?excludeUserId=<uuid>`: drops every resource owned by that user. `GET /resources` is public
  (`security: []`), so the server has no acting user to resolve a `mine` flag against; the
  caller passes its own id explicitly to drop its own rows server-side (client-side dropping
  would punch holes in a paginated page once paging is real).

`GET /me/resources` (above) accepts the same `?name=` and `?attr=`, minus `excludeUserId`,
since that route is already scoped to the caller via the `user` cookie.

#### `GET /facets`

The distinct attribute vocabulary across all resources, honouring the same `?name=`, `?attr=`
and `?excludeUserId=` filters as `GET /` above, so the chips describe the whole filtered
corpus, not just the page in hand. Response:

```json
{
    "facets": [
        { "key": "kind", "values": ["exercises", "notes"] },
        { "key": "topic", "values": ["algebra", "calculus"] }
    ]
}
```

- One entry per `attrs` key found on any matching resource, `values` sorted and deduplicated.
  A value stored as an array member is expanded into its own entry rather than kept as a raw
  JSON array, so a chip is always a bare value (`algebra`), never `"algebra"` or `["algebra"]`.
- Reserved keys, the ones the system injects itself, are always excluded, derived from the same
  context-provider registry rather than a hardcoded list.
- Registered before `GET /{resourceId}` so `/facets` cannot be mistaken for a resource id.

`GET /me/resources/facets` (above) is the same query accepting `?name=` and `?attr=`, scoped to
the caller's own resources via the `user` cookie instead of `?excludeUserId=`.

#### `GET /{resourceId}/access`

Assembles a Bart policy system from the caller, the resource owner, and everyone the party
closure pulls in (see `src/bart/`), then asks the evaluator service whether the caller may
access the resource. Response:

```json
{
    "resourceId": "...",
    "permitted": true,
    "evaluation": {
        "parties": ["<uuid>", "..."],
        "requests": [
            { "requester": "<uuid>", "from": "<uuid>", "resource": {} }
        ],
        "trace": "...",
        "scenario": "..."
    }
}
```

- **A denial is `200` with `permitted: false`, not `403`.** The endpoint answers a question;
  "no" is a successful answer. `403` stays reserved for auth failures (not the owner/not a
  member of something being mutated), which this endpoint has none of.
- **The owner short-circuits.** `Semantics.policiesToEvaluate` filters the requester out of
  its own candidate policies, so a self-request would otherwise fall through to `DENIED`. If
  the caller owns the resource, the response is `{permitted: true, evaluation: null}` and the
  evaluator is never called.
- `503 { errors: [...] }` if the evaluator service is unreachable, times out, or answers `5xx`.
- `500 { errors: [...] }` if the evaluator rejects the assembled system: this means a stored
  policy or attribute set was invalid despite write-time validation; the message names the
  offending user where the rejection can be traced back to one.
- `500 { errors: ["Invalid stored policy"] }` if a stored row cannot be emitted as `.bart` at
  all (`BartEmitError`). Same class of defect as the bullet above, caught a stage earlier: the
  failure is in this service's own emitter, so there is no evaluator `location` to blame a user
  with, and the body names none. The emitter's message goes to the log, not the response.

#### `POST /access`

Evaluates a caller-composed request against the whole policy system, rather than a stored
resource row. This is the only way to reproduce the paper's own request shape: a coarse
resource pattern, and an `any`/`all` party pattern by attribute in the `from` slot; the row
path (`GET /{resourceId}/access`) always sends a resource's _full_ `attrs` against
`from:(any:(userId:<owner>))`.

Request body:

```json
{
    "resource": { "type": "lectureNotes", "course": "ads" },
    "from": {
        "quantifier": "any",
        "attrs": { "studyLevel": "undergraduate", "degreeProgram": "cs" }
    }
}
```

- `resource` follows the same attribute constraints as elsewhere
  and must be non-empty, since an empty pattern is a Bart wildcard (`match({}, rule)` is always
  true), so this is rejected as `400` rather than silently permitting everything.
- `from.attrs` follows the same constraints **except `userId` is allowed**: naming one party
  by id is exactly what the key is for, and it is the one attribute guaranteed to be unique. An
  empty `from.attrs` is valid and means "any/all party at all" (the grammar allows zero
  attributes in `others`).

Response:

```json
{
    "permitted": true,
    "evaluation": {
        "parties": ["<uuid>", "..."],
        "requests": [
            { "requester": "<uuid>", "from": "<uuid>", "resource": {} }
        ],
        "trace": "...",
        "scenario": "..."
    }
}
```

- There is no stored resource, so there is no owner short-circuit and no `resourceId` in the
  response: `evaluation` is never `null`. A permit is a claim about a resource _description_,
  so there is nothing to download as a result.
- `400 { errors: [...] }` if `resource` is empty, or if `resource`/`from.attrs` contain a
  reserved or malformed key.
- `503` / `500` for the same evaluator failure modes as `GET /{resourceId}/access`.

#### `PUT /{resourceId}/content`

Replaces the resource's content with the raw request body. Owner only. The body is sent as
`application/octet-stream` (no JSON envelope, no multipart), up to
`APP_LIMITS.resources.maxContentBytes` (32MB). `?filename=` (optional, 1-255 characters, no
`"`, `\`, or newlines) becomes the stored filename, and `?contentType=` (optional, defaults to
`application/octet-stream`, max 255 characters, must look like a media type:
`^[A-Za-z0-9!#$&^_.+-]+/[A-Za-z0-9!#$&^_.+-]+$`) becomes the stored MIME type. It is a query
parameter rather than the request's own `Content-Type` header because the route only ever
accepts a body sent as `application/octet-stream`: that header could never carry any other
value, so the declared type has to travel separately. Storing a caller-declared type this way
is safe: see `GET /{resourceId}/content` below for why it is never rendered by a browser.

- `400 { errors: [...] }` if the body is empty, if `filename` contains a quote, a backslash or
  a newline (it is interpolated into a `Content-Disposition` header on download, so any of them
  would break it), or if `contentType` does not match the media-type shape above.
- `403 { errors: ["Not authorized"] }` if the caller does not own the resource.
- `413 { errors: [...] }` if the body exceeds the limit (Fastify's own
  `FST_ERR_CTP_BODY_TOO_LARGE`), forwarded by the application error handler.

#### `GET /{resourceId}/content`

Streams the resource bytes if the caller owns the resource, or if the evaluator permits
access (the same check as `GET /{resourceId}/access`, run silently).
**A denial here is `403`, not `200 { permitted: false }`**: unlike `/access`, which answers a
question, a download performs an action, so refusal is an error.

The response has no JSON body; on success it is the raw bytes, with the headers below:

| Header                   | Value                                                                                                           |
| ------------------------ | --------------------------------------------------------------------------------------------------------------- |
| `Content-Type`           | the MIME type stored at upload time (or `application/octet-stream`)                                             |
| `Content-Length`         | the byte length of the content actually sent                                                                    |
| `Content-Disposition`    | `attachment` with both a `filename` and a `filename*` parameter (see below); always an attachment, never inline |
| `X-Content-Type-Options` | `nosniff`                                                                                                       |

`Content-Disposition` is listed in the CORS `exposedHeaders`, because a browser only exposes
CORS-safelisted response headers to cross-origin `fetch` callers, and `Content-Disposition`
is not on that safelist. Without it, a same-origin curl sees the header fine but a browser
client on another origin gets `null` from `res.headers.get('content-disposition')` and cannot
recover the filename; the download still succeeds, only its name degrades.

`Content-Disposition` is built per RFC 6266, carrying both forms at once, e.g.
`attachment; filename="notes.txt"; filename*=UTF-8''notes.txt` for an ASCII name, or
`attachment; filename="download"; filename*=UTF-8''%E6%96%87%E4%BB%B6` for a name that is
entirely outside ASCII. `filename` is an ASCII-only fallback (anything else is stripped,
falling back to `"download"` if that empties it out); `filename*` is the real name,
percent-encoded UTF-8 per RFC 5987. This is what lets a non-Latin-1 filename (stored fine at
upload; the upload guard only rejects `"`, `\`, and newlines) download at all: writing it
into a plain `filename="..."` parameter would hit Node's header-value validator, which rejects
any code point above `0xFF`.

`Content-Disposition` plus `X-Content-Type-Options: nosniff` together are what stop an
echoed, caller-supplied MIME type from becoming stored XSS in a browser that would otherwise
sniff and render the bytes inline.

- `404`, empty body, if the resource does not exist or has no content uploaded.
- `403 { errors: ["Access denied by policy"] }` if the caller is not the owner and the
  evaluator denies the request.
- `503` / `500` for the same evaluator failure modes as `/access`.

The handler runs two separate queries on purpose: it decides access first (a small row,
excluding the content column) and only loads the up-to-32MB `content` column after the
decision is a permit. A request that is about to be denied never touches the bytes.
`Content-Length` is derived from that second query's buffer, not the first query's stored
`contentSize`, since an owner re-uploading between the two would otherwise make the header lie
about the length of the bytes that follow.

#### `DELETE /{resourceId}/content`

Clears a resource's content (`content`, `contentType`, `contentSize` and `contentFilename`
all reset to `null`) while the resource row itself is left in place. Owner only.

**Idempotent by design**: calling this on a resource that already has no content returns
`200`, the same as clearing content that exists, never `404`: after the call the resource has
no content either way, so there is no prior-state distinction worth exposing as a different
status code.

- `200`, the resource (with `content: null`).
- `403 { errors: ["Not authorized"] }` if the caller does not own the resource.
- `404`, empty body, if the resource itself does not exist.

### Groups (`/groups`)

| Method | Path            | Description                                                    |
| ------ | --------------- | -------------------------------------------------------------- |
| GET    | `/`             | List all groups, paginated. Accepts `?name=` (substring match) |
| GET    | `/{groupId}`    | Get a single group                                             |
| POST   | `/` 🔒          | Create a group from `{name, description}`; the caller joins it |
| PATCH  | `/{groupId}` 🔒 | Update `name` and/or `description`. Members only               |
| DELETE | `/{groupId}` 🔒 | Delete the group. Members only                                 |

Group membership is open: any authenticated user may join any group via `POST /me/groups/{groupId}`, no invitation or approval needed. So the `403` on `PATCH`/`DELETE /groups/{id}` means "caller is not currently a member", not "caller is not the owner", since there is no group ownership concept in the current design.

### Dev (`/dev`)

| Method | Path         | Description                                                 |
| ------ | ------------ | ----------------------------------------------------------- |
| GET    | `/events`    | List recorded log events, paginated, newest first           |
| GET    | `/status`    | Probe whether the database and the evaluator are reachable  |
| GET    | `/scenarios` | List the canned scenarios `POST /seed` can load             |
| POST   | `/seed`      | Load a canned scenario into an empty database               |
| POST   | `/reset`     | Wipe every party, resource, group, connection and log event |

Demo/developer tooling, not product API: seeding and resetting a database with no data model of
its own to bootstrap through. Registered public, with no `user` cookie required, on purpose:
seeding must work when there are zero users, so there is no cookie to require and no identity to
attach the call to.

**"Empty" means no users and no groups.** Resources, connections, group memberships and log
events all hang off a user, so the user count alone almost covers it; `Group` is the one table
that can hold rows with no users at all, and seeding on top of leftover groups would silently
produce a policy system nobody described.

#### `GET /events`

Every recorded log event, newest first, in the standard `{data, page}` envelope (page size 50):

```json
{
    "data": [
        {
            "id": "...",
            "type": "dev.seed",
            "data": { "scenario": "ex3" },
            "occurred_at": "2026-08-03T12:00:00.000Z",
            "userId": null,
            "username": null
        }
    ],
    "page": { "size": 50, "totalElements": 1, "totalPages": 1, "number": 1 }
}
```

- Accepts `?page=` (integer, minimum 1, defaults to 1). Ordered by `occurred_at DESC`, then
  `id ASC` as the tiebreaker, so paging stays deterministic across rows logged at the same
  instant.
- Deliberately unfiltered: this is a raw inspection view, not a product list.
- **`userId` and `username` are independent nullables, and not every combination is stored.**
  Both `null` is a system row, and that covers more ground than "logged with no user":
  `user.delete`, `dev.seed` and `dev.reset` all pass no user id,
  **and** `LogEvents_UserId_fkey` is `ON DELETE SET NULL`, so every row a since-deleted party left
  behind is anonymised rather than removed, and reads as a system row from then on. Both set is an
  ordinary event, attributed to the party that caused it. `userId` set with `username: null` is
  never _written_ (Postgres rejects a `UserId` naming no party) but is _reachable_ in a response:
  this endpoint fetches rows and then looks up their usernames in a second query, and a party
  deleted in the gap between the two comes back with an id nothing could resolve.
- `POST /dev/reset` truncates `LogEvents`, so this is a session log, not durable history: an
  empty response after a reset is expected, not a broken endpoint.

#### `GET /status`

Whether the backend's own dependencies are reachable right now:

```json
{
    "services": [
        { "name": "database", "status": "up", "latencyMs": 3, "detail": null },
        {
            "name": "evaluator",
            "status": "down",
            "latencyMs": null,
            "detail": "The evaluator service is unreachable"
        }
    ]
}
```

- **Always answers `200`.** A down dependency is a finding in the body (`status: "down"`), never
  an error status: a report that fails during an outage is exactly the useless case, and this is
  the endpoint reached for during one. `database` and `evaluator` are probed in parallel and
  caught separately, so one being down never hides the state of the other.
- `latencyMs` is the probe's own round trip in milliseconds when it succeeds, `null` when it threw.
- **`detail` is `null` for an up service and a fixed sentence for a down one, never the caught error's own message.**
  The evaluator probe's underlying failure (`EvaluatorUnavailableError`) embeds
  `EVALUATOR_URL`, and this route is public and unauthenticated, so echoing it would leak
  internal topology to a caller with no credentials to
  ask for it. The real message still reaches the operator through the server log.

#### `GET /scenarios`

```json
{
    "scenarios": [
        {
            "id": "ex3",
            "title": "...",
            "summary": "...",
            "counts": {
                "users": 3,
                "resources": 3,
                "connections": 1,
                "groups": 0
            }
        }
    ]
}
```

`counts` is derived from the fixture itself, not a database query, so the picker can show the
size of what a scenario would create before anyone loads it. Every key is always present, so a
fixture declaring no groups reports `0` rather than omitting the field.

#### `POST /seed`

Request body:

```json
{ "scenario": "ex3" }
```

- `200`, with `created` carrying the same shape `GET /scenarios` reports under `counts`.
- `400 { errors: [...] }` on a schema validation failure (missing/empty `scenario`).
- `404`, empty body, if `scenario` names no known fixture.
- **`409 { errors: [...] }`**, unlike the empty-bodied `409`s on `POST /me/connections/{userId}`
  and `POST /me/groups/{groupId}`: the database already holds data, so the caller is told to
  call `POST /reset` first instead of guessing why nothing happened.
- `500 { errors: [...] }`, from the distinct causes below, both bugs in this repository rather
  than something the caller could have sent differently: either a fixture's own `attrs`/`rules` fail
  the same checks `POST /users` runs (`FixtureInvalidError`), or the evaluator rejects an
  otherwise well-formed fixture's assembled policy (`Invalid stored policy (...)`, the same
  `EvaluatorRejectedError` mapping `PATCH /me` and `POST /users` use).
  Every fixture is validated exactly as `POST /users` validates a user the frontend sends, and
  that validation is what makes a reachable evaluator a runtime dependency here too.
- `503 { errors: ["Evaluator service unavailable"] }` if the evaluator cannot be reached or
  fails inside itself; the database is left untouched, since validation runs before anything is
  written.

Only works on an empty database: wiping is always an explicit `POST /reset`, never a side effect
of seeding.

#### `POST /reset`

```json
{ "deleted": { "users": 3, "resources": 3, "groups": 0, "logEvents": 0 } }
```

Deletes every party, resource, group, connection and log event, reporting how many of each
existed at the moment of the call. **Idempotent, and never an error**: `200` every time, empty
database included. The counts are not always all-zero on an empty database, though: this
endpoint logs its own `dev.reset` audit event _after_ truncating, deliberately, so the record of
a reset survives the reset it describes. That one row is therefore data the _next_ `POST /reset`
finds and counts: calling it twice in a row reports `logEvents: 1`, not `0`, the second time,
with every other count genuinely zero.

### Authorization outcomes

| Case                                              | Status                             |
| ------------------------------------------------- | ---------------------------------- |
| Resource/group exists, caller is not owner/member | 403 `{errors: ["Not authorized"]}` |
| Resource/group does not exist                     | 404, empty body                    |

`attrs` and `rules` are opaque: a `PATCH` supplying one **replaces it wholesale**, with no
deep merge. Omitting a field leaves it untouched.

### Attribute constraints

`attrs` on both `User` and `Resource` is validated at write time (create and patch) against
what the `.bart` evaluator can express:

- Keys must match `[a-zA-Z_][a-zA-Z_0-9]*` and must not be a Bart grammar keyword (`to`,
  `and`, `exchange`, `false`, ...).
- Values must be a finite number, a boolean, a string free of `"`, `\` and control
  characters, or a flat array of those. A number must also render as a plain decimal:
  `String()` switches to exponent notation at `|v| >= 1e21` and `|v| < 1e-6`, which the
  grammar cannot lex, so `1e21` is finite and still a 400.
  A whole number stops at `±(2^53 - 1)`: past that JSON has already rounded what the caller sent,
  and the digits can outgrow the 64-bit integer the evaluator's parser reads them into, which
  would fail the parse instead of the rule. So `1e20` renders lexably and is still a 400.
- The names `userId`, `connections`, `groups`, `date_year`, `date_month`, `date_day` are
  reserved: the evaluator injects them itself, so user-supplied `attrs` may not set them.
- A `Resource` needs at least one attribute, and `attrs` is capped at 64KB (as is `metadata`).

Any violation is rejected with `400 { errors: [...] }`, one message per offending key, before
anything is written.

### Rule validation

`rules` on `User` (create and `PATCH /me`) is validated at write time too, but against the
Bart grammar itself rather than the `attrs` shape rules above: the rules are assembled into
the policy the party will actually be evaluated with (`attrs` + `rules`, with `userId`
injected), and that whole policy is sent to the evaluator service's `/validate/policy`
endpoint.

**The whole assembled policy is what is checked, so `attrs` alone can fail it.** A party with
no rules is validated too: `(party:(userId:"…")(k:…), rules:())` can be unparseable on its
attributes alone, so an empty `rules` array is _not_ a free pass and does reach the evaluator.

`PATCH /me` validates the _post-patch_ state:

| Request carries                   | Validated policy                                                                                                                                     |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `rules` (with or without `attrs`) | the new rules against the new `attrs` (or the stored `attrs`, if omitted)                                                                            |
| `attrs` only                      | the **stored** rules against the **new** `attrs`; an attrs-only patch revalidates, because the new attributes can break a policy the old ones parsed |
| neither                           | nothing; no evaluator call                                                                                                                           |

A syntax error is rejected with `400 { errors: ["rules: line L:C <message>"] }` (position
omitted when the evaluator does not report one).

This makes the evaluator service a **runtime dependency** of `POST /users` and of any
`PATCH /me` that carries `attrs`, `rules`, or both, including the unauthenticated
`POST /users` of a user with no rules at all. When it is unreachable or fails with a `5xx` both
answer `503 { errors: ["Evaluator service unavailable"] }`, never a 400.

### Health (`/api/v1/healthz`)

| Method | Path              | Description                               |
| ------ | ----------------- | ----------------------------------------- |
| GET    | `/api/v1/healthz` | Liveness probe. Returns `{"status":"UP"}` |

It is unauthenticated (`requireUserCookie` is applied per route-plugin, not globally) and
excluded from the OpenAPI document: its schema carries no `tags` and `SWAGGER_OPTIONS` sets
`hideUntagged: true`. Sitting inside `/api/v1` is not what hides it, and does not expose it.

The check is deliberately **shallow**: it does not probe Postgres. `dbSetup` ends with
`sync({ alter: true })`, which rejects if the database is unreachable, so the process never
reaches `listen()`, so a callable probe therefore already implies a working database.

Consumed by the `app-backend` healthcheck in the root `docker-compose.yml`. It sits under
`/api/v1` rather than at the top level because the reverse proxy routes `/api/` here and
everything else to the frontend, so a top-level path would be unreachable from outside.
