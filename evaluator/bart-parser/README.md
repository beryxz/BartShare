# bart-parser

An **ANTLR 4.13.2** grammar and model builder that turns `.bart` concrete syntax into the
`bart.core` Java model. Coordinates `com.thesis.bartparser:bart-parser:1.0.0-SNAPSHOT`, Java 25.

This is the detailed reference. It opens with the caller's view, what the module offers, how to
call it, and what it deliberately leaves out, and continues with the maintainer's view: the
grammar, the codebase map, how conditions are interpreted, the documented deviations, and the test
strategy.

---

## What it is and why it exists

`bart.core` is a faithful Java transcription of the denotational semantics from the paper
_"Bart: a Specification Language for Bartering Access to Resources"_ (Bettini, Pugliese,
Tiezzi) (Found in `COSE-S-25-08412.pdf`). In `bart.core`, policies are assembled only through
the fluent Java API and conditions are arbitrary Java lambdas; there is no textual syntax.

`bart-parser` adds a **concrete syntax + parser** so the paper's scenarios can be written as
`.bart` files and shown to evaluate to the paper's results, a stronger, executable
faithfulness claim than hand-built Java fixtures. It also gives any consumer the text → model
direction: an artifact can be stored as `.bart` text and parsed on demand.

The parser reads a `String`, indifferent to its source. It covers **text → model** only; the
reverse (model → text unparser) is future work (see the "Future work" section below).

---

## What it offers

A **library**, and more precisely a **compiler front end**: a lexer, a parser and a model builder
targeting one output, the `bart.core` model. It never calls back into your code, has no lifecycle,
no configuration, no threads and no I/O. Hand it a `String`, get an object graph, and the module is
out of the picture.

The language definition itself is part of the offer. No machine-readable Bart grammar exists
elsewhere: the paper gives the syntax only as printed Tables 1-2, and `bart.core` has no textual
form to borrow from, so `Bart.g4` is authored in this module, transcribed from those tables with
the deviations documented in the "Deliberate deviations from the paper" section below. This is
where the concrete language is _defined_, not merely parsed.

The public surface is the static facade **`Bart`**, plus **`Parsers`** for a caller that needs the
parse tree itself. It parses, it diagnoses, and it analyzes; those are the whole offer.

### Parse

`String` → model, one entry point per artifact kind. All are static on `Bart`.

| Call                        | Returns          | The artifact                                                       |
| --------------------------- | ---------------- | ------------------------------------------------------------------ |
| `Bart.parsePolicySystem`    | `Policies`       | every party's policy, ordered; the index is the party identity     |
| `Bart.parsePolicy`          | `Policy`         | one party's policy                                                 |
| `Bart.parseContext`         | `ContextHandler` | per-party dynamic attributes, index-aligned with the policy system |
| `Bart.parseEnrichedRequest` | `Request`        | who asks whom for what                                             |
| `Bart.parseScenario`        | `Scenario`       | policy system, context and request out of one document             |

That set is closed: it matches the grammar's EOF-terminated entry rules one for one, and those
are the whole set (see the "Grammar & entry rules" section below). Each call builds a fresh
parser and a fresh `BartModelBuilder`, so nothing carries between calls.

### Diagnose

The parser is **fail-fast**: ANTLR's console listeners are removed, and any lex or parse error
throws `BartSyntaxException` instead of recovering. The source position is available as fields,
`getLine()` (1-based), `getColumn()` (0-based) and `getRawMessage()`, not only inside the message,
so a caller can put a caret in an editor without re-parsing a string this module formatted.

`BartTypeException` is the evaluation-time counterpart, thrown when a condition applies an operator
to a value outside that operator's domain. It surfaces in the trace rather than as a parse error,
and it denies. See the "Conditions" section below.

### Analyze

A policy never evaluates alone: `Semantics` resolves it against a whole policy system. An
exchange's `any`/`all` participant is matched against the _other_ parties in that list, and a
condition qname such as `(department:"cs").budget` is looked up on whichever loaded party matches
the pattern. An incomplete list is not an error: a quantified exchange simply finds no candidate,
the condition's lookup finds no match, and the request denies as if the policy demanded it.

The entry points below answer that assembly problem. They report which parties one policy's text
refers to, by attribute pattern, so the caller can load into the policy system all the relevant
parties that could be matched by the patterns. All are static on `Bart`:

| Call                          | Returns                      | Answers                                                                         |
| ----------------------------- | ---------------------------- | ------------------------------------------------------------------------------- |
| `Bart.policyParties`          | `PolicyParties`              | both lists below from a single parse, with the same validation as `parsePolicy` |
| `Bart.exchangePartyPatterns`  | `List<ExchangePartyPattern>` | the `any`/`all` participants of the exchanges, source order, `to` before `from` |
| `Bart.conditionPartyPatterns` | `List<Attributes>`           | the parties the rule conditions name by attribute pattern                       |

They read the parse tree, not the built model, which has already lost these references; why is
under the "Codebase map" section.

### The escape hatch

Building the model drops source-level facts the tree still holds: a `ContextHandler`, for one, no
longer says how many attribute lists its context tuple carried, so a caller checking that arity
against an expected party count cannot use the facade. **`Parsers`** exists for that caller: one
static method per entry rule, `String` → the raw ANTLR parse-tree context, fail-fast exactly as
the facade is. Read the fact the model does not keep off the tree, then hand the same tree to
`BartModelBuilder` so the text is parsed once.

---

## Using it

The output is the engine's input: this module parses, `bart.core` evaluates. Two shapes, both in
use.

**Per artifact**, when the pieces arrive separately, say policies stored one per party:

```java
Policies policies = Bart.parsePolicySystem(policyText);
ContextHandler context = Bart.parseContext(contextText);
Request request = Bart.parseEnrichedRequest(requestText);

Result result = new Semantics(policies)
    .contextHandler(context)
    .evaluate(request);
```

**Whole document**, when one `.bart` file holds the entire fixture, which is what the tests do:

```java
Scenario sc = Bart.parseScenario(text);

Result result = new Semantics(sc.policies())
    .contextHandler(sc.context())
    .evaluate(sc.request());
```

---

## What it does not do

- **No evaluation.** `bart.core` owns the semantics; this module builds its input.
- **No I/O.** It takes a `String` and does not know where the text came from.
- **No unparser.** Text → model only. `Expr.render()` emits condition syntax for the trace and is
  not a round-trip (see the "Conditions" section).
- **No error recovery.** The first lex or parse error throws, so this cannot back a language server
  that needs a tree out of broken input.
- **No validation past the model build.** A duplicate attribute key or an out-of-range numeric
  literal is rejected; an incoherent policy system is not. Whether a request is permitted is the
  engine's answer, not the parser's.

---

## Build & test

Easiest path: `cd evaluator && mvn clean install` builds `bart.core` first through the
aggregator reactor. To build this module alone it needs `bart.core` in `~/.m2`.
Run from `evaluator/bart-parser/`:

```bash
mvn -o clean test                     # ANTLR codegen + compile + tests
mvn -o test -Dtest=PaperScenarioTest  # a single test class
```

`-o` (offline) works once the plugin cache is warm; the first build after a clean `~/.m2` must
run online.

Formatting is enforced by Spotless from this module's own `eclipse-format.xml`, and covers
`Bart.g4` for trailing whitespace and a final newline. The block below is deliberately the same
in `bart-wrapper`'s README, matching each module's `.editorconfig` and `eclipse-format.xml`:

```bash
mvn spotless:apply    # reformat this module
mvn spotless:check    # verify only; also runs automatically at the `verify` phase
```

### Grammar exploration with `grun` / `just`

The `justfile` drives ANTLR's TestRig. Needs a system `antlr4` CLI and
`/usr/share/java/antlr-complete.jar`:

```bash
just build   # regenerate + javac into ./dist
just run scenarioFile -gui  src/test/resources/scenarios/ex1_basic.bart
just run scenarioFile -tree src/test/resources/scenarios/ex1_basic.bart
```

`dist/` is a **`just`-only artifact for grun** and is gitignored: the Maven build does its own
codegen into `target/generated-sources/`. Never edit or commit `dist/`.

---

_Everything below is the maintainer's reference._

---

## Grammar & entry rules

`src/main/antlr4/com/thesis/bartparser/Bart.g4` is the grammar. The
**EOF-terminated entry rules** below, which are the whole set, wrap EOF-free core rules so the
core rules can also compose inside `scenarioFile`:

| Entry rule            | Produces                                                     |
| --------------------- | ------------------------------------------------------------ |
| `scenarioFile`        | policy system + context + enriched request (a whole fixture) |
| `policySystemFile`    | `Policies`                                                   |
| `policyFile`          | `Policy`                                                     |
| `contextFile`         | `ContextHandler`                                             |
| `enrichedRequestFile` | `Request`                                                    |

The EOF anchor is load-bearing: a bare core rule (e.g. `attrList`) parses only as much input as
it matches and returns without error on trailing garbage. Only the `*File` wrappers reject a
truncated or over-long parse.

`pointToPointRequest` (paper Table 2) is deliberately **not** parseable: the engine synthesizes
those internally; they are never authored.

---

## Codebase map

`src/main/java/com/thesis/bartparser/`:

- **`Bart`**: the public facade, and what a caller should reach for first:
  `parseScenario` / `parsePolicySystem` / `parsePolicy` / `parseContext` /
  `parseEnrichedRequest`, each `String -> bart.core` model object except `parseScenario`, whose
  `Scenario` record bundles three of them, plus the entry points that
  read the parse tree for what the built model does not answer without a type test:
    - `conditionPartyPatterns` (`String -> List<Attributes>`): which parties the policy's rule
      _conditions_ name by attribute pattern.
    - `exchangePartyPatterns` (`String -> List<ExchangePartyPattern>`): the `any`/`all`
      participants of the policy's _exchanges_, in source order, `to` before `from`, each
      carrying its `ExchangeSide` and `Quantifier`.

    Together they are every party a caller must load for the policy to evaluate as written;
    the "Analyze" section above explains why. `policyParties`
    (`String -> PolicyParties`) is the combined form: one parse, both
    lists (`inExchanges` / `inConditions`), plus the model build `parsePolicy` does, so a duplicate
    attribute key still throws. The single-purpose methods stay for callers wanting one list.

- **`Scenario`**: record bundling `(Policies, ContextHandler, Request)`: everything needed to
  construct a `Semantics` and evaluate. A fixture-test convenience; a caller assembling the model
  per artifact has no use for it.
- **`Parsers`**: text → ANTLR parse-tree contexts, one static method per entry rule. Public
  because a caller needing the parse tree itself has to bypass the facade: the built
  `ContextHandler` does not expose how many attribute lists the context tuple carried, so a
  caller checking that arity reads it off the tree, then hands the same tree to
  `BartModelBuilder`.
- **`ThrowingErrorListener`** + **`BartSyntaxException`** make the parser **fail-fast**: ANTLR's
  default console listeners are removed, and any lex/parse error throws (with line/column)
  rather than recovering. Do not reintroduce error recovery without a deliberate decision.
  **`BartTypeException`** is the evaluation-time counterpart: a condition applied an operator to
  a value outside that operator's domain (`in` over a non-set or with a set as the element, an
  ordering comparison across types, or a non-boolean where a truth value is required). It also
  covers a non-operator case: `BartValue.of` refusing a raw value the domain does not model
  (`name resolved to an unsupported value type`), which a context built through the Java API can
  still carry. It surfaces in the trace, never as a parse error.

    `BartSyntaxException` carries the source position as fields as well as in its message:
    `getLine()` (1-based), `getColumn()` (0-based, ANTLR's `charPositionInLine`), and
    `getRawMessage()` (the message without the `line L:C ` prefix). All of them are
    null/unprefixed for the single-argument constructor, kept for failures that have no position.
    `getMessage()` is unchanged, e.g. `"line 1:17 extraneous input '<EOF>' expecting {',', ')'}"`
    for an unclosed context tuple like `((friends:"a"),()`. `BartSyntaxExceptionTest` pins its
    **format** (`"line " + line + ":" + column + " " + rawMessage`, byte for byte) and, for that
    example, the line/column (`1`/`17`) and that `rawMessage` contains `"extraneous input"`; it
    does not pin ANTLR's exact wording beyond that, which can shift if the grammar changes. The
    fields exist so a caller can hand an editor a caret position without re-parsing a string
    this module formatted.

- **`BartModelBuilder`**: what the facade drives, and **not** itself a visitor. `policySystem`,
  `policy`, `context` and `enrichedRequest` carry no alternatives, so it reads them directly and
  delegates the rest; its nested `AttrListVisitor` is what dispatches `attrList`'s two.
- **The visitors**: the parse tree is dispatched through ANTLR's generated
  `BartBaseVisitor<T>`, **one visitor class per return type**, since the base class has a single
  type parameter and a shared `T = Object` would put the casts back. A visitor is nested inside
  another class only when its
  **sole caller is that class and it exists for that caller's typing**: `ToVisitor` /
  `FromVisitor` in `ExchangeVisitor` (`ExchangeToParticipant` / `ExchangeFromParticipant`,
  so `SingleExchange`'s two ends need no cast), `QNameVisitor` in
  `ExprVisitor` (`Expr.Name`), and `AttrListVisitor` in `BartModelBuilder`, which is not itself a
  visitor and only needs `attrList`'s two alternatives handed back as one
  `List<AttributeContext>`. A visitor covering a grammar rule in its own right stays top-level
  however few callers it has: `RulesVisitor`, `ExchangeVisitor` and `ExprVisitor` all do.

    | Class                    | Rule                                           | Produces                     |
    | ------------------------ | ---------------------------------------------- | ---------------------------- |
    | `RulesVisitor`           | `rules`, plus `policyRule` assembly            | `Rules` / `Rule`             |
    | `ExchangeVisitor`        | `exchange`, with nested `to` / `from` visitors | `Exchange`                   |
    | `ExprVisitor`            | `expr`, with a nested `qname` visitor          | `Expr`                       |
    | `ValueVisitor`           | `value`                                        | `Object` (scalar or `List`)  |
    | `AtomVisitor`            | `atom`                                         | `AtomValue`                  |
    | `ConditionPartyPatterns` | collects `partyName`                           | `List<Attributes>`           |
    | `ExchangePartyPatterns`  | collects `to`/`from` `others`                  | `List<ExchangePartyPattern>` |

    The last two are the exception to one-class-per-return-type: both visit for effect (`T = Void`)
    and hand the collected list back from their static `of` factory.

    `to` and `from` get separate visitors because `SingleExchange` takes two different participant
    types, and one shared `Participant` return would need a cast at the call site.

- **`AttributeBuilder`** and **`ParticipantBuilder`** are plain collaborators, not visitors:
  `attribute` and `others` have no alternatives, so there is nothing to dispatch on.
  `ParticipantBuilder` is shared by an exchange's ends and a request's `from`.
- **`Quantifier`** (`ANY`/`ALL`) and **`ExchangeSide`** (`TO`/`FROM`) are the grammar-level enums
  that replaced comparing token text; `ExchangePartyPattern` is the record pairing them with an
  attribute pattern.
- **`ConditionPartyPatterns`** and **`ExchangePartyPatterns`** read the **parse tree**,
  deliberately, for two different reasons. A condition is compiled into an opaque
  `ExpressionCode` lambda, so the built model has lost the party reference outright. The built
  exchange still holds it, but `me` / `requester` / `any` / `all` are one **unsealed**
  `Participant` hierarchy there, so picking the quantified ones out needs an `instanceof`
  down-cast into the read-only engine; in the tree they are separate grammar alternatives. Both
  walk every `and`/`or` branch, not just the one the engine would take.
- **`value/`**: a sealed `BartValue` domain (`StrValue`, `LongValue`, `DoubleValue`, `BoolValue`,
  `SetValue`, `NullValue`) that types what a condition computes over. `AtomValue` is the
  orderable subset. See "The value domain" section below.
- **`ast/Expr`**: a sealed, interpretable AST for conditions (`And`, `Or`, `Not`, `Cmp`, `In`,
  `Name`, `Lit`) with `eval(NameResolver) -> BartValue` plus `render()`. `Name` is itself sealed
  over the grammar's three qualified forms, `SimpleName` / `RequesterName` / `PartyName`.
  **`ast/CmpOp`** is the comparison operator as an enum (`EQ`, `NEQ`, `LT`, `GT`, `LTE`, `GTE`),
  replacing the operator-as-`String`. See the "Conditions" section below.

`src/test/resources/scenarios/*.bart` are the runnable example inputs.

### Parse node → model

| Parse node                | Model output                                                                                 |
| ------------------------- | -------------------------------------------------------------------------------------------- |
| `policy`                  | `new Policy(Attributes, Rules)`                                                              |
| `attribute`               | `attrs.add(name, value)`: bare 1 atom → scalar; bare N atoms or any `{…}` → immutable `List` |
| `atom` STRING/NUMBER/BOOL | `String` / numeric (`Long`/`Double`) / `Boolean` literal                                     |
| `policyRule`              | `new Rule(resource, [condition], [exchange])`                                                |
| `exchange` tree           | nested `AndExchange` / `OrExchange` / `SingleExchange`                                       |
| `to` / `from`             | `Participants.me()` / `requester()` / `any(attrs)` / `all(attrs)`                            |
| `context`                 | `ContextHandler`, 1-based, index-aligned with the policy system                              |
| `enrichedRequest`         | `new Request(index(i), resource, others)`                                                    |
