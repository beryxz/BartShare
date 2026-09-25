# bart-wrapper

A **Spring Boot 4.1.0 / Java 25** HTTP service exposing the Bart access-control engine.
Coordinates `com.thesis:bart-wrapper:1.0.0-SNAPSHOT`, root package
`com.thesis.bartwrapper`.

This is the detailed reference. It opens with the caller's view, why the service exists and what it
offers.

---

## Purpose

`bart.core` evaluates and `bart-parser` builds its input from `.bart` text, but both are Java
libraries: reaching them means running on the JVM and holding the model in process.
`bart-wrapper` puts them behind HTTP, so a consumer in any language sends `.bart` text and gets a
decision back.

It is a **stateless evaluator service**: the caller supplies the whole policy system, the context,
and the request on every call, and the party count is whatever it sends. There is no database and
nothing is remembered between calls: two concurrent evaluations for different party sets share
nothing, because there is no shared state to share.

Non-goals: authentication/authorization, persistence, caching of parsed policies, a model → text
unparser, and any modification to `bart/` or `bart-parser/`.

---

## What it offers

A **service**, not a library: the contract is the HTTP bodies below, and there is no client SDK to
depend on. It evaluates, it diagnoses, and it analyzes; those are the whole offer, and none of them
require a database since everything is stateless.

| Endpoint                 | Answers                                                                         |
| ------------------------ | ------------------------------------------------------------------------------- |
| `POST /evaluate`         | is this request permitted, and by which chain of exchanges                      |
| `POST /validate/{kind}`  | would this `.bart` text parse and build a model, and if not, where does it fail |
| `POST /analyze/policies` | which parties does each policy reach, by attribute pattern                      |

Payload shapes, status codes and the error taxonomy are under the "API surface" section below.

### Evaluate

`POST /evaluate` is what the module exists for. The caller sends the policies, the context tuple
and the request as `.bart` text; the service assembles the model, runs a fresh `Semantics` over it,
and answers the "permitted" result plus the satisfied exchange chain. The engine's trace comes back
on every answer, permitted or not, since a buggy condition is indistinguishable from a legitimate
denial anywhere else.

### Diagnose

`POST /validate/{kind}` answers whether one artifact would parse and build a model, one slug per
`.bart` artifact kind a caller writes by hand. A syntax error is the endpoint's _finding_ rather
than a failed call, so it answers `200` with `valid: false` plus a source position an editor can
put a caret on. `/evaluate` treats the same bad text as a `400`: there the caller asked for an
evaluation and got none.

### Analyze

A policy never evaluates alone: an `any`/`all` participant is matched against the _other_ parties
of the policy system, and a condition qname is looked up on whichever loaded party matches the
pattern. A party left out of the system is not an error, it is a silent deny.
`POST /analyze/policies` reports the party patterns each policy reaches, the quantified
participants of its exchanges and the parties its conditions name, so a caller can close the
policy system over them without parsing `.bart` itself, and without always blindly including all
parties in every request. It is a thin wrapper over `bart-parser`'s `Bart.policyParties`, which
reads the parse tree the built model has already lost.

---

## Build & run

Easiest path: `cd evaluator && mvn clean install` builds `bart.core` + `bart-parser` first
through the aggregator reactor. To build this module alone it needs both in `~/.m2`.
Run from `evaluator/bart-wrapper/`:

```bash
mvn spring-boot:run        # dev server on :8080
mvn clean test             # compile + run the test suite
mvn clean package          # + fat jar in target/
java -jar target/bart-wrapper-1.0.0-SNAPSHOT.jar

mvn test-compile org.pitest:pitest-maven:mutationCoverage   # mutation gate, enforced at 95
mvn clean verify -P jacoco                                  # coverage → target/site/jacoco/index.html
```

Formatting is enforced by Spotless from this module's own `eclipse-format.xml`. The block below
is deliberately the same in `bart-parser`'s README, matching each module's `.editorconfig` and
`eclipse-format.xml`:

```bash
mvn spotless:apply    # reformat this module
mvn spotless:check    # verify only; also runs automatically at the `verify` phase
```

Test layout (assertion shape and Bart fixture layout) is documented once, in
[`bart-parser`'s README](../bart-parser/README.md#test-layout), and governs this module's tests too.

There is **no Maven Wrapper**: `mvnw` and `.mvn/` were deliberately removed; use a system
`mvn`. (`.gitignore` still carries a stale `.mvn/wrapper/maven-wrapper.jar` line.)

`8080` is **pinned** via `server.port` in `application.properties`, not inherited from Spring
Boot's default: the backend's `EVALUATOR_URL` and the root `docker-compose.yml` both hard-code it,
so a shifting framework default would break them silently.
No test binds the port: the `@SpringBootTest` classes run in the `MOCK` web
environment and the controller slices under `@WebMvcTest`, so the pin cannot make a test run
collide with a server you left up. Override per-run with `--server.port=...` or `SERVER_PORT`.

---

## API surface

### `POST /evaluate`

Request (`application/json`):

```jsonc
{
    "policies": ["(party:(username:\"p1\"), rules:(…))", "…"], // required, non-empty
    "context": "((),(friends:{\"a\"}),())", // required, arity == policies.length
    "request": "2: (resource:(type:\"notes\"), from:(any:))", // required
}
```

A policy's position in `policies` is its party identity, matching `bart.core`'s convention that
the order policies are added to `Policies` _is_ the party numbering. Parties are 1-based
everywhere the caller sees them: the `request`'s requester index, the `location` field
(`"policy 2"` is `policies[1]`), and `requests[].requester` / `.from` in the response.

Response (`200 application/json`):

```jsonc
{
    "permitted": true,
    "requests": [
        {
            "requester": 1,
            "from": 2,
            "resource": { "type": "lectureNotes" },
        },
    ],
    "trace": "evaluating …",
    "scenario": "(party:…)\n(party:…)\n((),())\n1: (resource:…)\n",
}
```

`scenario` is the inputs concatenated in `.bart` scenario order (each policy, then the context
tuple, then the request, each followed by a newline): the literal strings received, never
re-rendered from the model. Because `scenarioFile : policySystem context enrichedRequest EOF`,
that concatenation is itself a valid `.bart` scenario file (paste it into `bart-parser`'s
`just run scenarioFile`), though this service never parses it as one.

The `trace` field is always included: a buggy condition is indistinguishable from a legitimate
denial _except_ in the trace, which makes it the primary debugging tool.

Validation runs in this fixed order, first failure wins, so a given bad body always produces the
same error:

| #   | Check                                           | Status | `error` slug                 | `location`   |
| --- | ----------------------------------------------- | ------ | ---------------------------- | ------------ |
| 1   | `policies` absent, empty, or with a blank entry | 400    | `empty-policies`             | n/a          |
| 2   | `context` absent or blank                       | 400    | `missing-context`            | n/a          |
| 3   | `request` absent or blank                       | 400    | `missing-request`            | n/a          |
| 4   | each policy parses, in order                    | 400    | `bart-syntax` / `bart-model` | `"policy N"` |
| 5   | context parses                                  | 400    | `bart-syntax` / `bart-model` | `"context"`  |
| 6   | context arity == `policies.size()`              | 400    | `context-arity`              | `"context"`  |
| 7   | request parses                                  | 400    | `bart-syntax` / `bart-model` | `"request"`  |
| 8   | requester index ≤ `policies.size()`             | 400    | `invalid-requester`          | `"request"`  |

`location` is 1-based: `"policy 2"` names `policies[1]`, matching the party-numbering convention
above. Rows 5 and 6 straddle each other for one input: the context's _parse_ precedes the arity
check and its _model build_ follows it, so a tuple that is both mis-sized and carries a duplicate
attribute key reports `context-arity`, not `bart-model`.

Row 8 checks only the upper bound. Parties are 1-based, so the parser rejects a zero or negative
index itself, and such a request fails at row 7 as `bart-syntax` rather than reaching row 8.

### `POST /validate/{kind}`

`kind` ∈ `policy-system` | `policy` | `context` | `request`, one slug per EOF-terminated grammar
entry rule (`scenarioFile` is deliberately not exposed since no caller assembles whole scenario
documents). Body is `text/plain` `.bart` source. Unknown slug → 404 `unknown-kind`.

```
POST /validate/policy
(party:(username:"p1"), rules:())

→ 200 {"valid": true}


POST /validate/context
((friends:"a"),()

→ 200 {"valid": false,
       "error": {"line": 1, "column": 17,
                  "message": "extraneous input '<EOF>' expecting {',', ')'}"}}
```

Validation runs the full parse **and** model build, so it also catches non-positional model
errors such as the duplicate attribute keys `Attributes` rejects. Those come back with `line` and
`column` null and `message` populated.

An empty body needs no special case: every entry rule is EOF-terminated with required content, so
it fails the grammar and returns `valid: false` on its own.

Only `BartSyntaxException` (positional), `IllegalArgumentException`, and `IllegalStateException`
(non-positional model errors) are caught. Anything else is a bug in this service and still
produces a 500, since catching bare `RuntimeException` would report our own NPEs as "your policy is
invalid".

### `POST /analyze/policies`

Request (`application/json`):

```jsonc
{
    // required, non-empty, none blank
    "policies": ["(party:(username:\"p1\"), rules:(…))", "…"],
}
```

Response (`200 application/json`):

```jsonc
{
    "policies": [
        {
            "quantified": [],
            "conditionParties": [],
        },
        {
            "quantified": [
                {
                    "role": "from",
                    "quant": "any",
                    "attrs": { "university": "unifi" },
                },
            ],
            "conditionParties": [
                {
                    "attrs": {
                        "role": "auditor",
                    },
                },
            ],
        },
    ],
}
```

`policies` in the response is **positionally aligned** with `policies` in the request, the same
convention `/evaluate` uses for party identity. The record component behind it is named
`AnalysisResponse.analyses`, because "a list of analyses" is what it holds; `@JsonProperty`
serialises it as `policies` so the wire key mirrors the request's own array.
**Renaming the component does not change the JSON**; `app/backend` reads `body.policies` and is
unaffected.

`role` and `quant` are the enums `ExchangeRole` and `Quant`, not strings.
**The wire format is unchanged**: each carries an explicit `@JsonValue` spelling, so they still
serialise lowercase as `"to"`/`"from"` and `"any"`/`"all"`. The enums exist so an invalid value
cannot be constructed in the first place. Nothing switches over them; the exhaustive switches sit on the other side of
the mapping, in `PolicyAnalyzer`, over the parser's `ExchangeSide` and `Quantifier`, so a new
grammar quantifier fails to compile until it is given a wire spelling here.

Reports the parties each submitted policy can reach, so a caller can work out which parties
belong in a policy system without parsing `.bart` itself. Two lists, both to be closed over:

- `quantified`: the `any`/`all` participants inside the policy's **exchanges**, each with the
  side it appeared on (`to`/`from`) and its quantifier.
- `conditionParties`: the parties its rule **conditions** name by attribute pattern, via the
  `attribute+ '.' NAME` qname form. These carry no quantifier: `nameFromParty` resolves by
  first match in policy order. So for these, unlike the quantified ones, the caller's **order**
  matters as much as the membership, and loading a spare party is not free: an extra match placed
  ahead of the intended one silently governs the condition instead. Send the parties the patterns
  actually select, in a deliberate order

Match each `attrs` pattern against whatever party universe the caller has; any match is a party
the system needs. An empty pattern is Bart's wildcard and matches every party.

Both lists empty means the policy has no rules, or names only `me`/`requester` in every
exchange and uses no party-qualified condition. Omitting a party a condition refers to does not
error: `nameFromParty` finds no match and, unless the request's resource carries an attribute of
the same name, `UndefinedName` is raised and the engine swallows it into a silent deny. A
resource attribute shadows it, because `retrieveName` searches the resource before the party and
context attributes, and the condition then evaluates normally.

Every branch of an `and`/`or` exchange is reported, even though `bart.core`'s engine
short-circuits at evaluation time (`OrExchange` tries left then right; `AndExchange` needs both,
but still evaluates left-to-right and can short-circuit on failure). A caller computing a party
set has the opposite goal from the engine: it must consider every branch that _could_ run, because
a party missing from the policy system degrades into a silent deny rather than an error, so this
endpoint over-approximates on purpose rather than mirroring the engine's laziness. The
over-approximation is in what the endpoint _reports_, though, and is not licence to load spare
parties on top: a superset is harmless for the quantified patterns and not for the condition ones,
per the `conditionParties` note above.

Errors reuse the taxonomy above rather than inventing new slugs: `empty-policies` (absent, empty,
or blank), `bart-syntax` / `bart-model` with `location: "policy N"` (1-based, same convention as
`/evaluate`). There is no analogue of `context-arity` or `invalid-requester` here: this endpoint
never sees a context or a request.

### `GET /health`

Liveness probe for container orchestration. No request body, no parameters. Responds `200` with
`application/json`:

```json
{ "status": "UP" }
```

There is no failure response: either the context is up and this returns `200`, or the service is
not answering at all. The service is stateless with no downstream dependencies, so this reports
exactly one fact: the Spring context started and MVC is answering.

Deliberately hand-rolled rather than `spring-boot-starter-actuator`, which would report the same
single fact while adding a dependency tree to a POM that carries only `webmvc`. Consumed by the
`bart-wrapper` healthcheck in the root `docker-compose.yml`.

### Error taxonomy

One `@RestControllerAdvice` (`ApiExceptionHandler`) maps the domain's failure modes; the JSON
body (`ApiError`) is `{error, detail, location?, syntax?}`, serialised `NON_NULL` so `location`
and `syntax` are omitted when there is none.

Tagged input errors come in **two types, not one type with a nullable field**:

| Exception                  | Cause                                                                            | Slug          | `syntax` |
| -------------------------- | -------------------------------------------------------------------------------- | ------------- | -------- |
| `BartSyntaxInputException` | text that would not **parse**, so it has a source position                       | `bart-syntax` | present  |
| `BartInputException`       | text that parsed but would not **build a model**, e.g. a duplicate attribute key | `bart-model`  | absent   |

`BartSyntaxInputException` extends `BartInputException` and adds the `BartSyntaxException` that
carries the position. `BartInputException.tagging(location, parse)` is what sorts them: it runs a
parse and throws the right subtype, so `ApiExceptionHandler` gets two handlers dispatched by
Spring on the exception type rather than one handler asking what it caught. Anything that is not
a parse or model failure propagates and becomes a 500, since catching bare `RuntimeException`
would report our own bugs as "your policy is invalid".

```json
{
    "error": "bart-syntax",
    "detail": "line 1:17 extraneous input '<EOF>' expecting {',', ')'}",
    "location": "policy 2",
    "syntax": {
        "line": 1,
        "column": 17,
        "message": "extraneous input '<EOF>' expecting {',', ')'}"
    }
}
```

`detail`/`syntax` show a real ANTLR message (an unclosed parenthesis) for illustration; `location`
is composed separately to show the field's shape; this exact message would in practice report
`location: "context"`, not `"policy 2"`, since it comes from the `/validate/context` example
above.

Full slug set: `bart-syntax`, `bart-model`, `context-arity`, `empty-policies`, `missing-context`,
`missing-request`, `invalid-requester`, `malformed-body` (400); `unknown-kind` (404).
The slug set is closed at that list.

`ApiExceptionHandler` only covers the cases above. Anything it does not map (a 415 from the
wrong `Content-Type`, an unmapped path (404), an uncaught 500) falls through to Spring Boot's
default error body instead, which happens to have a field **also called `error`**, but holding a
human phrase rather than a slug:
`{"timestamp":"…","status":415,"error":"Unsupported Media Type","path":"/evaluate"}`. A consumer
that switches on `body.error` without checking which shape it got would misread
`"Unsupported Media Type"` as a slug. The two shapes are easy to tell apart: `ApiError` never has
`status` or `path`; Spring's default body never has `detail`.

`/validate` always returns 200 when the endpoint did its job: a syntax error in submitted text
is the endpoint's _finding_, not a failed call. Only an unrecognised `kind` (404) is an
HTTP-level error there. `/evaluate`, by contrast, treats a malformed input as a 400: the caller
asked for an evaluation and the service could not perform one.

---

## Architecture

The units below. Everything but the web layer is testable without a Spring container.

| Unit                                         | Responsibility                                                                                                                                                                                                                                               | Depends on                 |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------- |
| `engine/EngineAssembler`                     | `List<String>` policies + context tuple → `Policies` + `ContextHandler`; owns the arity check. Pure (no Spring, no persistence)                                                                                                                              | `bart-parser`, `bart.core` |
| `engine/EvaluationService`                   | Run the ordered checks, assemble, run a fresh `Semantics`, map to DTO                                                                                                                                                                                        | `EngineAssembler`          |
| `validate/ValidationService`                 | `(ArtifactKind, String)` → `ValidationResult`; turns exceptions into data                                                                                                                                                                                    | `bart-parser`              |
| `analyze/PolicyAnalyzer`                     | One policy → its `any`/`all` quantified patterns plus its condition party patterns, both off the parse tree via one `Bart.policyParties` call, which validates the model as it goes. `@Service` for wiring only; `PolicyAnalyzerTest` constructs it directly | `bart-parser`              |
| `analyze/AnalysisService`                    | Batches a policy list through `PolicyAnalyzer`; the ordered checks (non-empty, none blank) plus per-position error tagging                                                                                                                                   | `PolicyAnalyzer`           |
| `web/*Controller`, `web/ApiExceptionHandler` | HTTP only                                                                                                                                                                                                                                                    | the services               |

Root-level helpers hold what `/evaluate` and `/analyze/policies` would otherwise each keep a
copy of:

- **`PolicyInputs.require(policies)`** is the shared precondition: at least one policy, none of
  them blank. It returns the list unchanged so it reads as a guard at the top of a service
  method, and throws `MissingInputException` tagged `empty-policies`, with the 1-based position
  of the offending entry in the message.
- **`AttributeMaps.of(attributes)`** turns `Attributes` into the `LinkedHashMap` a JSON object
  needs. `Attributes` keeps its map private, so this rebuilds it from `names()` plus `name(k)`
  without touching the read-only engine, and insertion order means a response lists attributes
  the way the source wrote them. Used for `resource` in `/evaluate` and for both `attrs` fields
  in `/analyze/policies`.

### Model-first, not scenario-first

`bart-parser` offers a `parseScenario` facade that swallows a whole document and returns a
`Scenario`. **This service does not use it, by design.** `Scenario` is a fixture-test
convenience; assembling one big document and parsing it in a single shot is not how a service
whose inputs are already separate strings should work.

Instead each policy is parsed on its own and the _model_ is assembled:

```java
// Condensed from EngineAssembler (policies, context) and EvaluationService (request): the
// real code wraps each parse in BartInputException.tagging, whose 1-based "policy N" tag is
// where the prefix in the error taxonomy above comes from.
var policies = new Policies();
IntStream.range(0, policySources.size())
    .mapToObj(i -> BartInputException.tagging(
        "policy " + (i + 1),
        () -> Bart.parsePolicy(policySources.get(i))))
    .forEach(policies::add);

var parsed = Parsers.contextFile(contextTuple).context();   // arity check needs the parse tree
ContextHandler context = new BartModelBuilder().buildContext(parsed);
Request request = Bart.parseEnrichedRequest(requestText);
```

This is **provably equivalent** to the scenario path: `BartModelBuilder.buildPolicySystem` is
`new Policies()` plus `add(buildPolicy(p))` per policy in source order, so parsing policies
individually and adding them in index order produces the same `Policies` that `parsePolicySystem`
would over their concatenation. `EngineAssemblerTest` pins that equivalence as a differential
oracle over single-policy and multi-policy systems, and `PaperScenarioHttpTest` drives the paper's
Students scenario end-to-end over HTTP to prove the full stack matches, including at party
counts other than the paper's.

### Reaching past the `Bart` facade

The arity check needs the **parse tree**, not the model: `ContextHandler` exposes no party count,
its map is private, and `ofParty` mutates on read. So `EngineAssembler` parses the tuple once via
`Parsers.contextFile(text).context()`, checks `.attrList().size()` against the policy count, and
only then builds the model with `new BartModelBuilder().buildContext(ctx)`: one parse, one
check, no change to `bart-parser`.

---

## `bart.core` thread-safety: why `Semantics` is per request

`Semantics` mutates state during evaluation, so it must be constructed **per request**, never as
a Spring bean. The hazard is the fields below:

| Field            | Mutated during eval?                                     | Hazard if shared           |
| ---------------- | -------------------------------------------------------- | -------------------------- |
| `trace`          | yes: `reset()` + append sites                            | interleaved / wiped traces |
| `contextHandler` | yes: `ofParty` is `computeIfAbsent` on a `LinkedHashMap` | **map corruption**         |

The sharper rule is not just "don't make `Semantics` a bean"; it's
**never construct a `Semantics` without immediately calling `.contextHandler(...)` with a fresh instance**.
`Semantics` declares `private ContextHandler contextHandler = EMPTY_CONTEXT_HANDLER;` where
`EMPTY_CONTEXT_HANDLER` is a `private static final ContextHandler`, i.e. one `LinkedHashMap`
shared by _every_ `Semantics` in the JVM that skips setting the field, not just ones sharing a
bean. `ContextHandler.ofParty` writes on read (`computeIfAbsent`), and the path is routinely hit
because parties with an empty attribute list have no map entry until evaluation creates one. A
per-request `Semantics` that forgot the `.contextHandler(...)` call would still corrupt that
shared default map across every thread in the process; a per-request instance is necessary but
not sufficient. Per call, `EvaluationService.evaluate` builds a fresh `ContextHandler` (through
`EngineAssembler.context`) **and** a fresh `Semantics`, wiring them together immediately, so
every mutated field is confined to one thread. A `ThreadLocal<Trace>` fix would be a _false_
fix: it addresses the trace while leaving the more damaging `contextHandler` race.

This per-request construction is the _only_ thing separating concurrent callers, and the sole
piece of mutable state in the whole service.

`evaluator/bart` is a git submodule of the fork `https://github.com/beryxz/bart`
(tracking `https://github.com/LorenzoBettini/bart` as `upstream`) and is not modified here.

---

## Docker

Resolved by the `evaluator/` restructure: `evaluator/Dockerfile` builds through the aggregator
reactor (`evaluator/pom.xml`), so `bart-parser`'s and `bart.core`'s `-SNAPSHOT` artifacts are
built from source inside the image rather than needing to pre-exist in a `~/.m2` the build image
can't see. From the repo root, `docker compose up --build` (or
`docker build -f evaluator/Dockerfile evaluator`) works end to end. The `bart` submodule must be
checked out on the host first, since Docker does not fetch submodules.

The two-stage `Dockerfile` itself:

- **Build stage** `maven:3.9-amazoncorretto-25`: the whole `evaluator/` tree (the aggregator
  `pom.xml` and its modules, including the checked-out `bart` submodule) is copied in, then
  `mvn -pl bart-wrapper -am -B clean package` builds `bart` → `bart-parser` → `bart-wrapper` in
  reactor order, running the tests inside the image.
- **Runtime stage** `amazoncorretto:25-headless` (smallest variant). The fat jar is split with
  `-Djarmode=tools … extract --layers` into layers ordered least→most volatile, so a code-only
  change rebuilds the application layer alone and leaves the dependency layers cached. Entry
  point `java -cp . org.springframework.boot.loader.launch.JarLauncher`.
- Runs as **bare `USER 1000:1000` with no `/etc/passwd` entry**: Amazon Linux 2023 has no uid
  1000 and ships no `useradd`, and the JVM does not need a passwd entry. Don't "fix" this by
  installing shadow-utils.
- **Uses a BuildKit cache mount** (`--mount=type=cache,target=/root/.m2`) on the reactor build
  step to keep `~/.m2` warm across image builds; requires a BuildKit-enabled builder (the
  Docker default since Docker 23; `DOCKER_BUILDKIT=0` / the legacy builder cannot build this
  image).
