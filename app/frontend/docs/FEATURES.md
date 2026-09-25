# Features

This is the frontend's feature reference: the routes a user can visit and what each screen
actually does, checked against the code in `src/app/` and `src/features/`.

Every screen in this app is client-rendered and reads the backend live, on every load. Nothing
is mocked and nothing is cached across a reload. In particular there are no stored access
grants: `/shared`, the access dialog and the request builder all call into the evaluation path
on every load or click, never a cache of past decisions.

## Routes

`src/app/page.tsx` redirects `/` to `/resources`. The routes below make up the rest of the app, one
route group (`(app)`) per screen, each wrapped in the shared `AppShell` (sidebar + content region):

| Route           | Page component       | `page.tsx`                            |
| --------------- | -------------------- | ------------------------------------- |
| `/resources`    | `MyResourcesPage`    | `src/app/(app)/resources/page.tsx`    |
| `/shared`       | `SharedWithMePage`   | `src/app/(app)/shared/page.tsx`       |
| `/explore`      | `ExplorePage`        | `src/app/(app)/explore/page.tsx`      |
| `/policy`       | `MyPolicyPage`       | `src/app/(app)/policy/page.tsx`       |
| `/request`      | `RequestBuilderPage` | `src/app/(app)/request/page.tsx`      |
| `/connections`  | `ConnectionsPage`    | `src/app/(app)/connections/page.tsx`  |
| `/groups`       | `GroupsPage`         | `src/app/(app)/groups/page.tsx`       |
| `/debug`        | `DevPage`            | `src/app/(app)/debug/page.tsx`        |
| `/debug/log`    | `EventLogPage`       | `src/app/(app)/debug/log/page.tsx`    |
| `/debug/status` | `ServiceStatusPage`  | `src/app/(app)/debug/status/page.tsx` |
| `/debug/api`    | `ApiDocsPage`        | `src/app/(app)/debug/api/page.tsx`    |

Every one of these `page.tsx` files is a server component with no `'use client'` directive and
no logic of its own: an import of the feature's `*Page` component and a single-expression
render, nothing else. All the actual behaviour described below lives in `src/features/`. The
route group `(app)` contributes no path segment, so the `page.tsx` files above are the whole
route set for pages; a build adds `/`, `/healthz` (the route handler the Compose healthcheck
probes for liveness) and the framework's `/_not-found` to them and nothing more.

The content region of `AppShell` sits behind `SessionGate`, which resolves the acting user
before any screen mounts. There is no login: identity is a cookie naming a row in `/users`, so
against an empty database every authenticated screen would answer `401`. The gate renders the
first-run screen in that case (`FirstRunLanding`, see First run and reset below) rather than
letting every gated screen render its own error. Its error branch comes before the first-run
branch deliberately: with the backend unreachable, a first-run landing would be a confident
lie, and it would be the first thing anyone sees on a fresh clone. The ungated routes
(`/debug/log`, `/debug/status`, `/debug/api`) escape even the error branch too: `/debug/log`
and `/debug/status` handle an unreachable backend themselves (see The Developer screens below),
and `/debug/api` needs no acting user in the first place. The gate wraps the content region
only, never the sidebar, because the sidebar hosts the switcher whose "New user…" action has to
stay reachable in exactly the state that needs it. Switching identity toasts who you now are
("You are now `<username>`."), except when the selection is a no-op: re-picking the acting user
stays quiet.

## Resources

The routes `/resources`, `/explore` and `/shared` read different endpoints but are not separate
implementations: `MyResourcesPage`, `ExplorePage`, and `SharedWithMePage` all
render `ResourceListView` (`src/features/resources/components/ResourceListView.tsx`), passing it
a different data source and a different row action. Treat them as one substrate with a call site
each. They page and filter server-side through `useListQuery()` (`src/lib/api/query.ts`)
and render a `<Pager>` footer.

Each row is one `ResourceCard` (`src/features/resources/components/ResourceCard.tsx`): a header
with the resource's name and a `ResourceFileBadge` (its file type and size, or a muted `No file`),
the resource's `metadata.description` clamped to two lines with a tooltip for the overflow,
`AttributeList`, then a footer bar holding the owner line and `meta` on the left and the row
`action` on the right. Every screen gets the description and the file-state badge, because the
card is shared.

- **`MyResourcesPage`** (`/resources`) shows the acting user's own resources, from
  `useMyResources(query.params)` over `GET /me/resources`. It is the one page with create, edit
  and delete, all real writes: `ResourceFormDialog` drives `POST /resources` /
  `PATCH /resources/:id`, and `ResourceRowActions` drives `DELETE /resources/:id` behind an
  `AlertDialog` that names the resource being deleted, since the misclick that dialog guards
  against is hitting the wrong card's icon. Deletion confirms and says so ("Deleted “<name>”.").
  Each write revalidates `/me/resources`. Busy state
  lives per row, in `ResourceRowActions` itself, not on the page, so working one row's
  Edit/Download/Delete never disables another row's. Rows with content also get a Download
  button, omitted rather than disabled when there is none, since the file badge already says so;
  the owner short-circuits the access check, so a download here always succeeds. This is a
  deliberate contrast with `/shared`'s Open button (below), which stays disabled with a constant
  label rather than omitted: it is that row's only download affordance, where a `/resources`
  row still has Edit and Delete, plus a badge that already says so. No `title` accompanies the
  disabled state; a disabled button cannot receive the hover that would show one, and the row's
  `No file` pill already carries the fact.
- **`ExplorePage`** (`/explore`) shows everyone else's resources. `GET /resources` needs no
  cookie, since attributes are public and only _access_ is bartered, but the caller's own rows must
  still be excluded, and that now happens server-side: `ExplorePage` sends
  `excludeUserId: actingUser.id` as a query param to both `useAllResources()` and
  `useResourceFacets()`, so the rows on screen and the filter chips offered describe the same
  excluded set. A client-side exclusion over one page would leave a per-page hole once paging
  was real: a row dropped after the page was already sized to 50 undercounts what the grid
  shows, the exact failure this design avoids. The row action is "Check access", opening
  `RequestAccessDialog` (see Access, below).
- **`SharedWithMePage`** (`/shared`) shows what the engine permits the acting user right now,
  from `listSharedWith()` over `GET /me/shared`. Its response carries a third key alongside
  `data`/`page`, `scan: {considered, total, truncated}`, because the answer is a live
  evaluation per candidate and the candidate set is capped **before** evaluation: filters narrow
  the candidate query first, so `scan.total` counts candidates matching the active filter, not
  the whole corpus, and a narrower filter makes the scan cheaper rather than more incomplete. The
  screen renders an inline note when `scan.truncated`; the page itself is never truncated, since the
  pager can always reach the rest, so this is the one remaining truncation disclosure on
  `/resources`-adjacent screens, and it is about the scan, not the list.

`/shared`'s row action is an **Open** button that downloads the bytes, disabled for a row with
`content === null` while keeping a constant label; the row's `No file` pill already discloses the
reason. The status asymmetry matters here: a denial from `GET /resources/:id/content` is a `403`,
not the `200 {permitted: false}` that `/access` answers, because a download performs an action
rather than asking a question. A `403` on this screen also means the engine changed its mind
since the list was built (the no-stored-grants property in action), so it is worth explaining
rather than merely reporting: the toast offers "See why", which opens `RequestAccessDialog` in
controlled mode on that row and re-evaluates for a trace.

Each row also carries a secondary **Why?** button opening the same `RequestAccessDialog` in
controlled mode that the 403 path opens, so a permitted row can be interrogated without first
provoking a refusal. Both paths share one state variable, since they ask the identical question.

`ResourceFormDialog` saves in two phases, because content has its own endpoint and cannot ride
in the JSON body: the row first (`POST` or `PATCH`), then `PUT /resources/:id/content` if a file
was picked, or `DELETE .../content` if the existing one was marked for removal. The dialog, not
the page, owns that sequence, because the state that makes a partial failure recoverable is
dialog state: `createdId` remembers the row phase 1 created, so saving again after a failed
upload targets that row instead of creating a second one, and the error list says as much
before the backend's own messages. `PATCH` replaces `metadata` wholesale, so the dialog spreads
the original back in around its two fields; dropping a key it has no input for would be silent
data loss. Save is also gated on `AttributeEditor`'s `onValidityChange`, disabled with a red
"Fix the highlighted attribute first" line right after `FormErrors`, above the footer, while any
row fails to parse under its chosen kind, the same gate `PartyAttributesCard` uses (see Policy,
below). The editor remounts on
every open via an `editorToken` key, so an abandoned draft from editing one resource never shows
up when the dialog reopens on another.

`ResourceListView` itself owns the free-text name filter and the attribute-facet filter
(`ResourceFilterBar`), plus the empty/loading/error states and the `<Pager>` footer. Facets are
never hard-coded: they come from a dedicated facets endpoint (`GET /resources/facets`,
`GET /me/resources/facets`, over `useResourceFacets()`), which computes `{key, values}` pairs
over the matching CORPUS under the screen's active filters, not over whatever page happens to be
loaded. A chip list derived from one page could offer a vocabulary that contradicts what
filtering against it actually finds on another page; the endpoint exists specifically so that
never happens.

`MyResourcesPage` is where `ResourceListView` gets a `meta`: the card's footer bar
renders it in the left slot, left of the row action, rather than as trailing content under the
card body. Each card gets a `ResourceCoverage` line: how many of the acting user's own rules
cover that resource, over `coveredBy()` (`src/lib/bart/match.ts`), the frontend's port of the
engine's own `AttributeMatcher.match`. `/explore` and `/shared` deliberately pass no `meta`; the
predicate is about the acting user's own rules, and neither screen is showing the acting user's
own resources.
Only a rule the parser could not read at all has no pattern to test; it is excluded from the
numerator _and_ disclosed separately (`N unreadable, not counted`) rather than silently making
the count look smaller than the rules that could actually be checked. A rule the block editor
cannot show still counts, since its pattern comes from stage one and survives a stage-two
failure.

When at least one rule covers, the count is a popover trigger listing each covering rule as a
link to `/policy?rule=N` (1-based, matching `RuleCard`'s own numbering). `MyPolicyPage` reads that
param, scrolls the matching card into view, rings it (`ring-2 ring-ring`) for about 2 seconds, and
clears the param via `router.replace('/policy')` once it has, so the deep link fires exactly once:
a later save changes `rules`' identity on revalidation, and without the clear that would re-fire
the scroll against a since-renumbered row. When no rule covers, the card states that plainly, but
only once every rule was actually checked: with an unreadable rule in the mix, "0 of your rules
cover this" is already an unknown rather than a zero, so the plain-language sentence stays silent
instead of asserting past what was examined.

Both coverage counters are exact, for different reasons. `RuleCoverage`'s denominator, "covers
N of your M resources" on `/policy`, reads `POST /me/rules/coverage` via `useRuleCoverage()`
(`src/features/policy/hooks/useRuleCoverage.ts`), computed server-side over the caller's COMPLETE
resource set, so `M` is a true total regardless of corpus size.
`ResourceCoverage`'s "N of your rules cover this" never had that gap to begin with: `GET /me`'s
`rules` is the complete array, never paginated, so its only incompleteness is the unreadable-rule
exclusion above, not a page cut. That is also why it still computes locally with `coveredBy()`
rather than calling the coverage endpoint: the endpoint answers "for each rule pattern, how many
resources match", the opposite direction from what a single resource card needs ("for this one
resource, which of my rules match"), and it already has everything required (one resource's
`attrs` and the complete `rules` array), with no round trip to save.

## Access

`RequestAccessDialog` (`src/features/access/RequestAccessDialog.tsx`) is the row-derived half
of this feature: a request always starts from a specific resource card. Explore and `/shared`
both open it, and they open it differently. Explore passes it as `ResourceListView`'s row action and lets it own
its own trigger and `open` state. `/shared` renders it **controlled** (`open` supplied, no
trigger rendered, `onOpenChange` clearing the caller's state), reached two ways: after a download
was refused, to show why, or from the row's own **Why?** button, so a permitted row can be
interrogated without waiting for a refusal first. A controlled caller that forgets `onOpenChange`
gives the user no way to close it.

Opening the dialog shows the resource's attributes (`ResourceRef`) and evaluates immediately:
`requestAccess(resource.id)`, `GET /resources/:id/access`, a one-shot, non-SWR-cached call,
fires once per open, so the trace appears without a second click from either entry screen.
Every open re-evaluates, deliberately, since caching a verdict would contradict the "no stored
grants" premise the whole app demonstrates; closing the dialog
discards the result for the same reason. While the call runs the body shows an "Evaluating…"
placeholder; a failed call keeps the error toast and leaves a Retry button in its place. The
result renders as
`TraceViewer`: a `VerdictBadge` plus three tabs over the same parsed trace: Diagram, Tree, and
Raw. A denial is a `200 {permitted: false}`, not an error, and reaches the same viewer. Once a
result exists, the dialog's own header grows an **Expand** button beside its Close, following
the pattern `RuleEditorSheet` uses for its own widen toggle: `RequestAccessDialog` drives
`TraceViewer`'s `expanded` state itself and passes the resource's name as `title`, so the trace
stays reachable at full size from a header the trace body never owned.

**A permit here offers the bytes.** When the verdict is `permitted` the dialog shows a Download
button, right-aligned below the trace, disabled and relabelled `No file to download` when the row
has no content: it is the permit's only affordance that pays out those bytes, so omitting it
instead would be indistinguishable from a permit that pays out nothing, the same reason `/shared`'s
Open button (above) stays disabled rather than omitted; that row's button keeps a constant label
and leans on its `No file` pill for the reason instead, since Why? sits right beside it and a gap
where Open used to be would read as ragged. This button carries no `title` for the disabled state:
it cannot receive the hover that would show one, and the label already states the fact. That
deliberately diverges from `/resources`'s own Download button (above), which is omitted rather
than disabled there, because the row still carries Edit and
Delete and the file badge already states there is nothing to fetch.

Every tab is live. **Diagram** draws the evaluation as a UML-style sequence diagram: one
lane per party an arrow touches, which is a request or cycle-break endpoint, the party searching in
a candidate fan, or a party a frame caption names, labelled with the real username where that
party's user was loaded (`Party N` otherwise, since the users list is page 1 only, so a large
deployment can evaluate against someone never fetched), and one arrow per point-to-point request in
trace order: green for a satisfied request, red for a refused one, and muted with no tick where the
trace never stated an outcome, which is not the same as a permit and must not look like one. The
remaining parties of `evaluation.parties` were loaded by the backend's party closure without the
request ever reaching them; the `PartyRoster` below the tabs accounts for them, naming every party
of the policy system with its index and one of `requester`, `involved`,
`matched, never asked`, or `loaded, never asked`. A
quantified `any:`/`all:` **request or exchange** first draws a dashed candidate fan across every
matched party that holds a lane, starting at a filled dot on the lane of whichever party is doing
the searching (the requester for a quantified _request_, the granting rule's own party for a
quantified _exchange_), because that is the one thing the Tree and Raw views bury: most of the
fans in `STUDENTS_AND_TRACE` come from exchanges, not from the root request. A fan whose pattern
matches the searching party too (the common case for an `any:` clause over shared attributes like
`studyLevel`/`degreeProgram`/`university`) says so:
`"N matched · <party> excluded (cannot trade with itself)"`, since the engine drops self-pairs
before asking. A party that matched and was never asked holds no lane, so the fan states the
shortfall as `"N matched, M shown"` and the roster names it; the clause is omitted when nothing
was hidden. When no match holds a lane at all, or the pattern matched only the searcher, the row
drops the arrow entirely, since a single-lane arrow is zero-width and swallows its own label, and
falls back to the same centred text the no-match case uses, where `M` reads `none` rather than a
numeral, since that row draws nothing at all. The vicious-circle break is drawn amber and dashed
rather than green: nothing was evaluated there.

Each exchange a rule demands draws as a captioned frame (`DiagramFrame`, UML's combined-fragment
notation) wrapped around the rows paying for it: `"<party> grants only if: all terms hold"` for
an `and` composite, `"<party> grants only if: any term suffices"` for an `or` one,
`"<party> grants only in exchange"` for a single exchange. (`suffices` is the load-bearing word
on the `or`: one term satisfying it is enough, so wording that demands every term would invert
the rule.) A composite's
operands are separated by a dashed rule carrying a chip that names the operator, and each
operand's rows are tagged `term N` at the frame's left edge, marking where that operand begins.
An `or` whose first term held never evaluates a second, so a
frame showing `term 1` and no divider is the engine short-circuiting, not a truncation. All of
the interpretation lives in `src/lib/bart/diagram.ts` and `src/lib/bart/frames.ts`; the
components only position what those return.

**Nesting depth is legible from the frame chrome, never from indenting the rows.** Each frame's
border box is inset a step further per nesting level (capped, so pathological depth falls back
to overlapping borders) and carries a thicker left edge in its outcome tone, while the rows
inside stay full width: lane centres are a percentage of one shared track, so a frame that
inset its children would pull their arrows off the lifelines, and lifeline alignment is the
whole basis on which a sequence diagram is read. The chrome moves; the rows never do.

A refused arrow that the trace can explain carries a small cause chip above the arrow: reasons
like `"no rule offers <resource>"`, `"condition false · <expr>"`, or `"no party matched"`, read
out of the same trace text a user could open in Raw trace, via `src/lib/bart/causes.ts`. A
satisfied arrow carries one in exactly one case: `"nobody to exchange with"`, drawn warning-toned
on a green arrow, where the rule's exchange demanded nothing of anybody because its `to` pattern
matched no party. That vacuous permit is surfaced on purpose: a grant given for free is otherwise
indistinguishable from one that was earned. Every other satisfied arrow stays bare, and an arrow
whose outcome the trace never stated stays bare whatever the cause says. The chip is best-effort,
matching the `bart.core` gotcha that a condition's thrown exception is swallowed and logged to the
trace rather than propagated.

Every tab has an **Expand** control that reopens the viewer at full viewport size, and the
selected tab, the party roster's open state, and the verdict itself all survive the transition:
the verdict row renders inside the body both views share, not beside it, so a badge the inline
view shows is never lost once the dialog takes over. `RequestBuilderPage` (below) wraps the trace
in its own Result card, and that card's header belongs to the page, not to `TraceViewer`, so there
Expand stays in the trace's own plain top-right row instead; only `RequestAccessDialog` moves it
into a header.

`toAccessResult()` (`src/features/access/verdict.ts`) maps a `null` `evaluation` from the
endpoint to `{ verdict: 'permitted', trace: null }`: owning the resource short-circuits the
evaluator entirely, so there is a permit but no trace to show, and `TraceViewer` renders the
verdict row as usual but swaps the tabs and roster for an explanatory `EmptyState` ("You own
this resource") in that case. Neither caller can currently reach it: `/explore` excludes the
acting user's own rows (`excludeUserId`), and `/shared` only lists resources somebody else owns.
The mapping exists and is exercised by tests, but nothing in the UI drives a request against a
resource the acting user owns.

## Request builder

`/request` (`RequestBuilderPage`) is the one screen that **composes** a request instead of
deriving one from a row. The row path always sends a resource's full `attrs` against
`from:(any:(userId:<owner>))`; here both halves are open, which is what lets the paper's own
request line (a coarse resource pattern against a party pattern by attribute) be replayed
against live data. It posts to `/resources/access` and renders the answer through the same
`TraceViewer`.

Two guards on the form are worth knowing, because both encode a rule from the language rather
than a UI preference:

- **An empty resource pattern disables the submit button.** An empty attribute bag is Bart's
  wildcard, so `match({}, rule)` is always true and the request would permit essentially
  anything; the backend rejects it with a `400`, and the screen says why in place rather than
  making the user discover that. The `from` pattern has the opposite default: empty there is
  legal and means "any/all party at all", which the grammar allows.
- **`userId` is accepted in the party pattern and nowhere else.** It is a reserved key
  everywhere in the app (`AttributeEditor` normally refuses it), but it is the one attribute
  guaranteed unique, so it is how a single party gets named. The page opts in explicitly via
  `allowReserved={['userId']}`, which relaxes reservation only: a grammar keyword stays
  unusable, because the lexer claims it before any endpoint gets a say. Typing a uuid is not the
  only way in: a `PartyPicker` sits on the Party pattern label row and fills `userId` in by
  display name, the same component and the same job it has inside a quantified exchange
  participant. It offers every party, the acting user included, since requesting from yourself
  is a denial the trace explains rather than an input to prevent.

Two more reasons can now disable the same Submit button, and they are kept deliberately distinct
from the wildcard guard above rather than folded into it.
**The wildcard guard is a language rule that never goes away**: it fires whenever the resource
pattern is empty, and it is reported inline under that editor, not beside the button.
**The two validity gates are transient input errors**: the resource pattern's and the party
pattern's own `AttributeEditor` each report their `onValidityChange` into
`resourceValid`/`fromValid`, and Submit is also disabled while either is
false, with a red "Fix the highlighted attribute first" line right after `FormErrors`, above the
button, the same treatment `PartyAttributesCard` and the rule sheet use for their own copies of
this gate. Before
this gate, an unparseable value under a chosen kind left the last value that DID parse in
`resource`/`from` while the row on screen still showed the rejected one, and the request would
silently evaluate that stale value. Both editors' `onChange` also clear `errors`, the server's
most recent rejection, on every edit, the same rule the other editors follow: the server
judged the attributes as they were sent, and any edit makes that judgement describe something no
longer on screen.

A permit here is a claim about a resource _description_, not about a row, so there is
deliberately nothing to download and no Open action; the card's own copy says so.

## Policy

`MyPolicyPage` (`/policy`) lays out the acting user's policy as two named sections plus a danger zone: **Who you are**
(`PartyAttributesCard`, `DerivedContextCard`) and **What you grant** (`PolicyPrimer`,
`RulesList`), each introduced by a `SectionHeading` (`src/components/shell/SectionHeading.tsx`), followed by `DangerZoneCard` after a plain `Separator`. The
two labels are not decoration: they restate the page's own description above them, "an attribute
list and a list of rules," so the layout finally reads as the sentence it always claimed to be.

- **`PartyAttributesCard`**: editable, via `AttributeEditor`, over `attrs` from
  `useMyPolicy()` (`src/features/policy/hooks/usePolicy.ts`). Each row's remove control is an
  icon button, not text: the action track is `auto`-sized in every layout of the row grid, so
  a text "Remove" label would widen it at every container width, stealing room from the
  flexible key and value tracks.
- **`DerivedContextCard`**: read-only, over `GET /me/context`. It sits with the attributes
  rather than after the rules because it reports the context the evaluator computes for this one
  party, not anything derived from the rules
- **`PolicyPrimer`**: static, collapsible (state in `localStorage` under `bart.policyPrimer.open`),
  a short list of points on how the evaluator reads a rule: what an unqualified name refers to, the
  `resource → context → party` lookup order, that a resource pattern must name every attribute the
  resource carries, and that the first fully-succeeding rule wins. Each point is there because it
  produced a real misreading during testing, not to complete a tour of the language; the
  resource-pattern point has an interactive half in `RuleCoverage`.
- **`RulesList`**: one `RuleCard` per rule, each badged `simple` or `advanced` depending on
  whether `rule.ast` is `null`, with Edit and Delete actions. A card shows `rule.advancedReason`
  inline in red when it is a syntax error (`isSyntaxReason`), and muted when it is the stage-one
  unrepresentable reason, which reads fine out of context; the stage-two reason (a shape the
  block editor cannot hold) is not a mistake, so it stays out of the card and shows only in the
  sheet, which offers "Edit it here in Advanced". An "Add rule" button and each card's "Edit"
  button open `RuleEditorSheet`.

The policy and the context are **two independent SWR reads** (`/me` and `/me/context`), because
they fail independently: losing the diagnostic panel must not stop someone editing their policy.
`MyPolicyPage` renders `ErrorState` for the context in place of the card, and keeps the editors.

`DangerZoneCard` sits below the rules after a plain `Separator` rather than a `SectionHeading`: a
heading would give a destructive action the same weight as either half of the policy itself, and
it is the only thing below the rules. Its "Delete user" button opens `DeleteUserDialog`, rendered
as a sibling of the trigger and mounted only while confirming, `STYLE.md`'s reopen-reset pattern
again: there is no stale count or error to resync on reopen, because a closed instance does not
exist. The confirmation names what will be destroyed from the list totals for resources,
connections and groups, fetched only when the dialog opens via `useAccountSummary()`
(`src/features/policy/hooks/useAccountSummary.ts`), so nothing pays for those requests on
an ordinary `/policy` load. A count that fails to load, or is still loading, never blocks the
delete: the dialog says the counts could not be determined rather than reading a failed
fetch as "nothing will be lost." Confirming calls `deleteAccount()` (`useMyPolicy()`), which sends
`DELETE /me`. There is no redirect afterwards: `SessionProvider`'s effect already clears a cookie
pointing at a user no longer in `/users` and re-picks the first remaining one, so the app lands on
another party on the same route, the same behaviour switching users has. Deleting the last user
resolves the acting user to `null`, which `SessionGate` renders as the first-run screen (see
First run and reset, below).

`PartyAttributesCard` **holds a draft and saves on a button**, rather than writing through.
`AttributeEditor` fires `onChange` on every keystroke, and `PATCH /me` re-validates the entire
policy against the evaluator, so a request per character would be waste, and it would make a `400`
impossible to attribute to anything on screen. `draft === null` means "follow the server", which
is what a successful save restores; a failed save keeps the draft, since it is the only copy of
what the user typed, and renders the backend's per-key messages beneath the editor. Save is also
disabled while any row's value fails to parse under its chosen kind, reported through
`AttributeEditor`'s `onValidityChange`: without that gate the card would silently save whatever
`attrs` last held, the last value that DID parse, and `PATCH /me` would answer a plain `200` to a
coercion nobody asked for. The disabled button carries no `title`, since a `disabled` button's
`pointer-events: none` (`buttonVariants`, `src/components/ui/button.tsx`) means it never receives
a `mouseover` and the tooltip could never show; `CardContent` instead renders a red "Fix the
highlighted attribute first" line right after `FormErrors`, the same treatment
`ResourceFormDialog` and `NewUserDialog` use for their own copy of this gate. `dirty` gets its
own indicator, an amber (`text-warn-fg`) "Unsaved changes" span in the footer with the Save and
Revert buttons, so the disabled-reason and the dirty-state read as two different colors rather
than one.

`saveAttrs` also revalidates the session's user list once `PATCH /me` succeeds, since `attrs`
carries `username`, which is what the sidebar switcher renders, and that list lives on a
different SWR key (`useSession`'s unscoped `USERS_KEY`) than `/me`. That revalidation is
best-effort (`.catch(() => {})`): a failed one must not be mistaken for a failed save.
`deleteAccount`'s own revalidation instead recovers a failed refresh with a full page reload
rather than let it reject: the delete already committed by that point, so reporting the failed
refresh back to `DeleteUserDialog` would read as a failed delete, in a dialog still headed after
the now-deleted party, with its Delete button re-enabled to send a second, doomed `DELETE /me`.

A warm SWR cache resolves `isLoading` to false the moment you switch back to a
previously-visited user, with no skeleton remount in between, which is exactly the hazard that
would let a dirty draft survive across the identity boundary and have Save `PATCH` one user's
edits onto another. Neither this card nor `DangerZoneCard` below carries its own identity key to
guard against it: `SessionGate` (`components/shell/SessionGate.tsx`) is the single identity
remount boundary for every screen, keying the whole page's content on the acting user id, so a
per-card key here would only ever fire after `SessionGate` had already remounted the page and
torn the draft down with it. `RulesList`'s own `openToken` guards a different, narrower case: a
draft outliving the _open event_ of its sheet within the same identity, not an identity switch.

**Any rule write locks the whole card, not just the row being written.** Rule ids are positional:
`toPolicyRules()` derives them from array index on every `/me` refetch, because `User.rules` is a
bare `string[]` and position is the only identity the server offers. A delete renumbers every row
after it, so a second write started before the first's refetch lands could target a row that has
already shifted. A per-row `busy` flag cannot express "some _other_ row is mid-write", which is
the actual hazard; only a card-level lock makes the interleaving unreachable.

The two write paths report differently, and deliberately. A save from `RuleEditorSheet` throws
back into the sheet, which stays open with the draft intact and renders the `400` inline, with
the server's `line L:C` stripped by `stripRulePosition()`: those coordinates are relative to the
whole emitted policy document, so they point at the wrong place in a sheet editing one rule, and
the client's own parse banner already carries a rule-relative position. A delete has nowhere
inline to report, since the row is gone from the DOM by the time an error could render beside it, so
it toasts.

`SimpleRuleEditor` builds every clause: resource pattern, condition, and exchange.
The four parts (resource pattern, condition, exchange, preview) are separated by
hairline rules rather than bordered cards, which keeps `ExchangeBuilder`'s term card
the only bordered box in the sheet: one level of visual nesting, so the innermost
unit is not also the most prominent one. Preview's label is deliberately demoted to
muted small caps, because it is the one section the author reads rather than fills.
The condition field is `ConditionEditor`, a one-line self-hosted Monaco field over
`BartExpressionEditor` (`BartEditor`'s `singleLine` mode) rather than a plain `Input`: it carries
its own condition-scoped completion list, deliberately different from the rule editor's. Clause
syntax (`resource:(`, `condition:(`, `exchange:(`, `to:`, `from:`) is illegal inside a bare
expression, so `ConditionEditor` never offers it, which would teach the wrong thing in the one
field where people are least sure of the grammar; what it does offer is `requester`/`me`, the
`and`/`or`/`not`/`in` operators, every context vocabulary key, and every known party and group,
both completing to a bare quoted id (`requester.userId = "<id>"`, `"<id>" in requester.groups`)
rather than the rule body's `userId:"<id>"` form, since inside an expression both are compared as
plain values. It carries no squiggles, and that omission is a property of the model, not an
afterthought: `markersFor` runs `parseSyntax()`, which reads a whole rule, and a bare expression
would underline as a syntax error on every keystroke with nothing gained, since the evaluator was
always the authority on validity and its `400` still renders in the sheet
a few centimetres below. The example, `requester.userId in connections`, stays as muted helper
text below the field, never a placeholder: a mono-styled example sitting inside an empty field
reads as though a condition is already set, which a placeholder cannot avoid but text underneath
can. The exchange half is `ExchangeBuilder`, over the flat `ExchangeGroup` model: one connector,
`and` or `or`, shown only once there are two or more terms, over a
list of terms added and removed freely. A term's two ends are asymmetric because the
grammar makes them so: `to` offers `me` or a quantified party, `from` offers `requester` or a quantified party,
and `ParticipantPicker` only ever offers the pair legal for its `side`. Naming one specific party
inside a quantified pattern is `PartyPicker`'s job: it resolves a display name to the `userId` a
pattern actually needs, since a username is not something a rule can match on.

The resource pattern itself carries `ResourcePatternPicker`, a "Fill from a resource…" popover
listing the author's own resources by name and attribute chips. Picking one replaces the pattern
wholesale rather than merging it: the engine matches a request against a rule's pattern by
subset, so a rule must name every attribute a resource carries, and a merge of two resources'
attributes would cover neither. The `RuleCoverage` line already sitting under the pattern editor
is the confirmation a pick worked; the picker adds no feedback of its own.

**Save is now gated on the block editors' validity.** `RuleEditorSheet` disables Save while
`blocksValid` is false, with the same red "Fix the highlighted attribute first" line
`PartyAttributesCard` renders. Unlike that card's single `AttributeEditor`, the Simple tab holds
a **dynamic** set of them: the resource pattern, plus a `to` picker, a resource pattern and a
`from` picker per exchange term, with terms added and removed freely, so a plain boolean per
editor cannot say "some editor, possibly one that has since been removed, is invalid."
`SimpleRuleEditor` aggregates them instead, in a ref of invalid ids keyed by the same synthetic
term id `ExchangeBuilder` uses for its React keys, and reports the aggregate up as one boolean.
`ExchangeBuilder` retracts a term's three ids when the term is removed, and `ParticipantPicker`
retracts its own id when a party is switched away from `any`/`all`, since both cases unmount an
editor that was reporting; without the retraction, deleting an invalid term, or switching a
picker back to `me`/`requester`, would leave Save latched shut with nothing left on screen to
fix. **The gate resets to valid on a tab change**: Radix unmounts the inactive tab (no
`forceMount` here), so leaving Simple destroys every attribute editor in it, and nothing
re-reports on the way back until the next real edit. Keeping the stale value would strand Save
disabled twice over, on Advanced, which has no attribute rows at all, and then on a Simple tab
that has just repainted itself clean. **This makes the gate walkable, a known trade-off**: type
`10x` into a `number` row on Simple, switch to Advanced, and Save is enabled again, writing the
last value that parsed (`10`), with the row repainted as `10` on return to Simple. Nothing is
silent, since the Advanced tab always shows the exact text that will be saved, but the rejected
keystrokes themselves are discarded without notice.

Every `RuleCard` also carries `RuleCoverage`: how many of the acting user's own resources the
rule's resource pattern covers. `RulesList` computes this once for the whole list via
`useRuleCoverage(rules)` (`src/features/policy/hooks/useRuleCoverage.ts`), which sends every
rule's parsed pattern to `POST /me/rules/coverage` in one request and hands each `RuleCard` its
own `{count, sample}` entry by rule id, plus the shared `total`: the caller's exact resource
count, computed server-side over the complete set rather than whatever page a resource list
happened to have loaded. "Covers" is deliberately not "shares" or "grants": a pattern match is
necessary, not sufficient, since the rule's condition and exchange still decide, and the popover
listing the covered resources repeats that in words; it also adds an "…and N more" line when
`count` exceeds the server's 20-name `sample` cap. A rule with no pattern (the parser could not
read it at all) contributes nothing, so it shows a dash character rather than `0`: zero would be
a claim, the dash is the truth.

The same component runs live in the block editor's Resource pattern section, over the
in-progress pattern, through `usePatternCoverage()`
(`src/features/policy/hooks/usePatternCoverage.ts`), one debounced request per settled pattern,
to the same endpoint, so the denominator stays the caller's complete resource set rather than a
page. It renders nothing until the pattern has a key: an empty pattern formally covers only an
attribute-less resource, and reporting "covers 0" before anything has been typed accuses the
author of a mistake they have not made. When a pattern covers nothing the server also returns
`nearest`: the resource it came closest to, the attributes it never mentioned, and the ones
whose values disagree, which is what makes the count actionable rather than merely discouraging.

The Advanced tab's `AdvancedRuleEditor` runs on the same self-hosted Monaco integration
(`BartEditor`; the self-hosting mechanism is in `DEVELOPMENT.md`) that `ConditionEditor` runs its
one-line field on. Radix's `Tabs.Content` unmounts whichever tab is inactive (no `forceMount` is
used anywhere in the sheet), so only one of the two is ever actually mounted at a time. The
full-rule editor contributes syntax highlighting from a Monarch grammar mirroring `lex.ts`, a
Format action that reprints the current text through `printTree()` whenever `parseSyntax()`
succeeds, completions for
every clause keyword, every context vocabulary key, and every known party's `userId`, inlay hints
that show a resolved username beside a `userId` value, and squiggles from `parseSyntax()`'s
syntax-error position. Every one of those is an affordance, never an authority:
`POST /validate/policy`, reached through `PATCH /me`, is still the only thing that decides whether
a rule is valid, and a clean, squiggle-free editor is not a promise that a save will succeed.

`SheetHeader` is a bordered zone (`border-b`) rather than merely the first thing in a scrolling
column, and both the title's sizing and the Simple/Advanced toggle live inside it now. The title
reads at `text-lg font-semibold tracking-tight` against the sections' plain `Label`s, and
`TabsList` sits under the title row, above the rule, having moved up from flush against
`Resource pattern` so its scope reads as the whole sheet rather than the section beneath it;
`Tabs` itself was lifted to wrap `SheetHeader` and the body together, with `className="contents"`
so the root generates no box and `SheetContent`'s existing `flex flex-col gap-4` keeps laying out
its children unchanged. `blockedReason`, the sentence explaining why the Simple tab is disabled,
moved with it and now renders directly under `TabsList`, next to the tab it explains, instead of
below the editor at the sheet's far end. It is red when `parsed.at` is set and amber otherwise:
a rule that merely cannot be drawn as blocks is valid Bart, and red would claim it is not.

The two corner controls are a matched pair the sheet renders itself, both
`Button variant="ghost" size="icon-sm"` inside one `ml-auto flex items-center gap-1` cluster,
rather than one of ours squeezed beside Radix's own. `SheetContent` sets `showCloseButton={false}`
because the built-in close is an absolutely positioned bare icon and `src/components/ui/` is
generated, so it cannot be restyled to match a `Button`; owning both controls outright is what
makes them one family, rather than nudging the widen button around Radix's close with a margin as
before. The replacement close button is a `SheetClose asChild`, not a plain `onClick`,
specifically so it still calls `onOpenChange(false)` on the `Sheet` root, i.e. `requestClose`, and
the dirty-draft confirmation described below guards it exactly as it guarded the built-in button.
The widen toggle (`Maximize2`/`Minimize2`) now carries a `Tooltip` ("Widen editor" / "Narrow
editor"), widening the sheet from `sm:max-w-xl` to `sm:max-w-5xl` for a roomier Monaco, backed by
`useStickyFlag('bart.ruleSheet.wide', false)` so the choice survives closing the sheet and
reloading the page. It swaps a className on the existing `SheetContent` **in place** rather than
re-parenting the editor into a dialog the way `TraceViewer`'s `ExpandedTrace` does: Monaco's
`automaticLayout: true` already handles the resize, and re-parenting would remount it, losing the
undo stack and cursor position on every expand or collapse.

The sheet also tracks **unsaved changes**: `dirty` compares the live `source` against the text
the sheet opened with (`rule?.source ?? ''`), and an "Unsaved changes" `Badge`, `text-warn-fg`
for an indicator rather than a disabled-reason, appears in the header the moment they differ. This
is deliberately keyed on `source`, not `ast`: a Simple-tab edit of a rule whose stored text is
non-canonical counts as dirty even though the edit "looks"
like a no-op, because `printRule` canonicalises and the rule genuinely would be saved
differently; merely switching tabs does not mark it dirty, since only `changeAst` fires on a
real edit. The baseline is trustworthy for the sheet's whole lifetime because `RulesList`
remounts it on every open via `openToken`.

Every close path (Escape, the sheet's own ✕, and an outside click) funnels through one seam,
`requestClose`, passed as `Sheet`'s `onOpenChange` instead of the raw prop. When the rule is
dirty it opens an `AlertDialog` ("Discard changes?") instead of closing; "Keep editing" returns
to the sheet with the edit intact, "Discard" closes it. A clean sheet closes immediately, no
prompt. `save()` still calls `onOpenChange(false)` directly rather than going through
`requestClose`, since a successful save is not a discard, so it must never prompt.

Escape itself is layered, because Monaco's popups have to get first refusal before the sheet
does. Radix's `DismissableLayer` listens for Escape on `document` in the capture phase, which
runs before the event ever reaches Monaco's textarea, so Monaco can never intercept it on its
own, no matter what its own keybinding does. `RuleEditorSheet` instead hooks `onEscapeKeyDown`
on `SheetContent`: Radix calls it before deciding whether to dismiss, and honours
`event.preventDefault()` by not closing, while the event still propagates on down to Monaco,
which then closes whichever of its own widgets (suggest, parameter hints, hover) is open. The
probe behind this, `monacoOwnsEscape`, is a DOM query for those widgets' own `visible` classes,
run over a `contentRef` attached to `SheetContent` itself rather than over one editor's own DOM
node: with `ConditionEditor` adding a second Monaco instance to the Simple tab, either it or
`AdvancedRuleEditor`'s editor may own the open widget, and searching the whole sheet answers for
both without needing to know which editor is mounted or focused. (`editorRef`, the mounted
Advanced-tab editor instance, stays a separate ref: `onCloseAutoFocus` on the discard `AlertDialog`
still uses it to return focus after a "Keep editing".) The probe is best-effort by construction:
if a future Monaco version renames the widgets' `visible` classes, the probe simply finds nothing
and Escape falls through to closing the sheet, through `requestClose`, so a dirty draft still
gets the discard confirmation rather than vanishing. The degradation is an extra keypress, never
a lost edit; it must never be "hardened" into something that can block the sheet from closing at
all.

Two cases behave in a way worth knowing. **Two rules pasted into one editor** is
a client parse error, since `parseRule` is EOF-anchored like the grammar's own `*File`
entry rules, but the server accepts it, because `emitPolicy` joins `rules`
verbatim and two rule blocks in one array slot is valid policy text. So it
squiggles, stays advanced-only, and saves. That is the affordance/authority split
working, not a bug. **Formatting is unavailable only on a syntax error**: a
mixed `and`/`or` exchange still reflows, since `parseSyntax` reads it fine even
though the block editor cannot show it; the Format button greys out on
`parseSyntax` failure, not on `toBlocks` failure.

`DerivedContextCard` renders what the evaluator will see for this party **right now**: each
connection and group as a display name with its id beneath it, the remaining `values` keys
(`date_*` today) as attribute chips, and a vocabulary section listing every context key a rule
can reference with an example condition. Showing name and id together is the point: the id is
what a condition matches on, the name is what a human can read, and `../backend/docs/API.md`
calls this panel the first thing to check when a request denies unexpectedly. An empty
`connections` or `groups` renders "none", never "any (wildcard)": that reading belongs to
attribute _patterns_, and a computed collection that is empty is genuinely empty.

## Network

`/connections` (`ConnectionsPage`) and `/groups` (`GroupsPage`) are the screens that write
the inputs to the backend's context providers, and both render a `ContextHint` banner saying so
and linking to `/policy` to see the resulting attribute. That causal link is the whole reason
these pages exist in the case study.

- **`ConnectionsPage`** pages and filters `GET /users` by `username`, joins each row against the
  caller's COMPLETE `GET /me/connections` list (`useConnections()`, walked in full), and toggles with `POST` / `DELETE /me/connections/:id`.
  Connections are mutual, so one call writes both directions and there is no reverse call to make.
  `/users` has no self-exclusion param, so the acting user's own row is dropped client-side after
  the join, over the page received rather than by the query. Rows carry a `PartyRef` with
  **no party index**: a party number is per-evaluation and comes from `evaluation.parties`,
  so a position in a page of `/users` is not one; nothing in the app claims a party number
  today.
- **`GroupsPage`** pages and filters `GET /groups` by `name`, joins each row against the caller's
  COMPLETE `GET /me/groups` list (`useGroups()`, same walked-in-full reasoning), and toggles with
  `POST` / `DELETE /me/groups/:id`. Membership is open by design, matching the backend: any user
  may join any group, and any current member (not an "owner," since the model has none) may
  edit or delete it. The row reflects that split: one primary
  Join/Leave button, and on joined rows a `⋯` menu holding Edit and Delete, so the action that
  changes the group for everyone is not adjacent to the one that changes only your membership.
  Deletion confirms and says so. Creating (`New group`, in the header) joins the caller
  server-side and confirms by toast; the list is name-ordered, so a new group usually sorts onto
  another page, and moving the user's filter to reveal it was rejected as a surprising
  side-effect.

Both screens page the public list with `<Pager>` and disclose the one incompleteness that
survives: `membershipsComplete` / `connectionsComplete` turns `false` only if the caller's own
membership list was long enough to hit `fetchAllPages`'s walk cap, in which case the screen says
some rows may under-report as not joined/connected rather than silently getting it wrong.

Neither screen updates optimistically. In an app whose premise is "ask the engine every time",
rendering a state the server has not confirmed is the wrong instinct, and these lists are a few
rows long, so the round trip costs nothing worth buying back. Failures toast when the action has
no form of its own to report into; group create and edit do have one, so their validation errors
render inline in the dialog instead. The exception is a
`403`/`404` (`isStaleWriteError`): that is not the user's to fix, so it toasts and revalidates
whichever surface it came from.

A successful toggle toasts the consequence rather than the action ("Connected to john. Your
connections context now includes them."), because the write's real effect is on an attribute the
evaluator reads, not on the row. That the toast is truthful depends on the no-optimistic-update
rule above: it fires only after the server has confirmed.

## First run and reset

`SessionGate` renders `FirstRunLanding` (`src/features/dev/FirstRunLanding.tsx`) whenever
`/users` comes back empty: no parties exist, so there is no policy for any other screen to
evaluate against. Two ways out, both first class: load a canned scenario from the live
`ScenarioPicker` it renders, or create a party by hand through the same `NewUserDialog` the
sidebar switcher uses.

`ScenarioPicker` (`src/features/dev/components/ScenarioPicker.tsx`) reads the catalogue from
`GET /dev/scenarios`, one card per scenario naming what it creates
(`describeCounts(scenario.counts, CREATED_KINDS)`, `src/features/dev/counts.ts`), with its id as a
mono badge beside the title, in both modes: the id is what the card copy and the event log data
refer to, and a reader on `/debug` needs it just as much as one on the first-run screen. It posts
the chosen id to `POST /dev/seed` through `useDevActions().seed()`. It runs in two modes: live on
`FirstRunLanding`, where a Load button is the point, and `readOnly` on `/debug`, a plain
catalogue with no button at all. The `readOnly` mode is not cosmetic: `/debug` renders inside
`SessionGate`, so it is only ever reachable once a party already exists, meaning the database is
never actually empty while that page is on screen, and a Load button there would be permanently
disabled, a dead control worse than an absent one.

A successful load toasts who it just made you (`Loaded <title>, you are now <username>.`, or the
scenario-only wording if `settle` could not name anyone) and sends the browser to `/explore`,
rather than leaving the first-run screen behind for `SessionGate` to swap out from under it. The
acting user comes back from `seed` itself: `chooseActingUser` (`src/lib/session/choose.ts`) is the
pure pick `SessionProvider`'s hydration effect makes on the user list, and `refresh` now returns
its choice instead of only settling the SWR cache, so `useDevActions().seed()` can report
`{ created, actingUser }` the moment the write settles rather than a tick later.

`/debug` (`DevPage`) is the other half of the loop. `ResetCard` posts to `POST /dev/reset`
through `useDevActions().reset()`, behind an `AlertDialog` that names what is destroyed (every
party, resource, group, connection and log event) without a pre-flight count: there is no
endpoint that counts those globally, and adding one purely to populate a confirmation is not
worth it. A successful reset empties `/users`, which drops `SessionGate` back to
`FirstRunLanding` and unmounts `/debug` along with the dialog, so there is no success state to
render here, only the handoff. Below the reset card, `/debug` renders the same `ScenarioPicker`,
`readOnly`, as a catalogue of what becomes loadable again once the reset lands.

`useDevActions()` (`src/features/dev/hooks/useDevActions.ts`) is what `seed` and `reset` share
after the request settles: clear every database-scoped SWR key
(`mutate(isDatabaseScopedKey, undefined, {revalidate: false})`) and refresh the session's user
list. Clearing broadly rather than one key at a time is deliberate: after a reset every cached
key names rows that no longer exist, and after a seed several keys still hold the "empty"
answers fetched moments earlier; naming every affected key by hand would mean enumerating every
screen in the app.

`SCENARIOS_KEY` is held back from that wipe (`isDatabaseScopedKey`,
`src/features/dev/cache.ts`), and not as an optimisation. The catalogue is hard-coded fixture
metadata, identical before and after any write, and dropping it broke the very screen a reset
hands off to: the wipe does not revalidate, and the first-run screen reads the catalogue
immediately, within SWR's 2s deduplication window of the copy `/debug` had just fetched, so SWR
issued no request and then discarded the deduplicated result as older than the wipe. With
`revalidateOnFocus` and `shouldRetryOnError` both off and `SessionGate` keeping the first-run
screen mounted across route changes, nothing retried, and the picker rendered no scenarios at
all until a full reload.

`STATUS_KEY` is held back from the same wipe, for a parallel reason rather than the same one:
whether the database or the evaluator is reachable is not something a seed or a reset can ever
change, so dropping it could only blank `/debug/status` until a reload, never correct it.

`/debug/log` (`EventLogPage`), `/debug/status` (`ServiceStatusPage`) and `/debug/api`
(`ApiDocsPage`) are the other Developer screens, and none depends on the reset/seed loop above.
`/debug/log` lists
`GET /dev/events` newest first, one page of 50 at a time through the usual `<Pager>`
(`EventLogTable`, `src/features/dev/components/EventLogTable.tsx`): each row shows when it
happened, its `type`, who it is attributed to, and a truncated one-line preview of `data`;
clicking a row (or Enter/Space, since the row carries `tabIndex={0}` and its own key handler)
expands a second row holding
the full `{id, userId, data}` as pretty-printed JSON. The user column reads `system` for a row
with no `userId` (which also covers a since-deleted party's past rows: the foreign key is
`ON DELETE SET NULL`, so a deletion anonymises rather than removes them), the resolved
`username` for an ordinary event, or the bare id truncated to eight characters in the one race
where the row's own `userId` resolved but its `username` did not (the endpoint reads rows and
usernames in two separate queries; see `../backend/docs/API.md`). `/debug/status`
(`ServiceStatusCard`) shows one card per service, backend first: a name, a
status badge (`up` in the verdict-permit green, `down` destructive, `unknown` a muted outline),
a latency in milliseconds, and a detail sentence when down. The backend's latency is the
browser's own timing of the status round trip (`getServiceStatus`), which contains both
server-side probes, so it always reads as the largest of the three; the other two are the
backend's probe measurements. The backend's own card is derived client-side by `statusRows`
(`src/features/dev/statusRows.ts`),
not fetched, since `GET /dev/status` cannot report its own unreachability: a resolved request
renders it `up`, and a fetch error renders it `down` with the error's message as the detail
and no latency (the duration of a failed fetch is not one),
with the database and evaluator cards `unknown` because the backend is what probes them and it
could not be asked. That error branch is deliberately not a full-page `ErrorState`: on the one
screen whose job is to say what is down, an unreachable backend is the answer, not a failure to
answer.

`/debug/api` frames the backend's own Redoc page (`GET /api/v1/swagger/ui`) inside the shell,
so the API reference is reachable without leaving the app. The backend serves that page with
an open `frame-ancestors`, which is what makes the frame possible across the two origins, and
the header keeps an "Open in new tab" link for the case where something blocks the frame
anyway. The frame is a viewport onto the backend's document, not a styled surface: it renders
in Redoc's own light theme regardless of the app's.

The log and status screens refresh only on a button click, deliberately, with no polling: a page left open in
a background tab would otherwise refetch forever during a demo, and neither reads anything that
needs to be live to the second. Neither offers a filter either: the log is a raw, unfiltered
inspection view, and the status screen shows one row per service.

The ungated routes above render outside `SessionGate`, matched by exact path, not a `/debug`
prefix: `/debug` itself still falls through to `FirstRunLanding` on an empty database, the
handoff described above. `/debug/log` and `/debug/status` are ungated because each handles an
unreachable backend itself and reports the outage: right after a reset, before anything has
been seeded, "is the evaluator up" is the question blocking the next step, and seeding is
exactly what needs the evaluator, so gating either screen would hide exactly the screen that
answers it. `/debug/api` is ungated for a different reason: it is static documentation that
needs no acting user, and gating it would blank the screen on a first run, before any user
exists.
