import { parseAttrList } from './attrs';
import { Cause, causeOf } from './causes';
import {
    booleanOutcome,
    flattenTrace,
    isErrored,
    TraceNode,
    TraceOutcome,
} from './trace';
import { BartAttrs } from './types';

/**
 * Turns the evaluator's trace lines into the requests a sequence diagram draws.
 * Patterns are matched against captured evaluator output, never the paper's
 * grammar: the trace is a debug log, so its shape is whatever `Trace` prints.
 * An unread line yields `null` and is skipped, degrading the view but not the
 * raw tab. `parseAttrList` skips nothing, it shrinks the attribute set, and a
 * list that loses every pair reads as Bart's wildcard.
 */

export type Quantifier = 'any' | 'all';

export type RequestFrom =
    { kind: 'index'; index: number } | { kind: Quantifier; pattern: BartAttrs };

export type RequestLine = {
    /** The `policy N:` prefix, or null when the line has none. */
    policy: number | null;
    requester: number;
    resource: BartAttrs;
    from: RequestFrom;
};

export type CandidateLine = {
    index: number;
    pattern: BartAttrs;
    outcome: boolean;
};

/**
 * Greedy `(.*)`: an attribute value containing `], from=` splits at the wrong
 * place, and the last occurrence is the better guess when it does.
 */
const REQUEST_RE =
    /^(?:policy (\d+): )?(?:evaluating )?Request\[requester=(\d+), resource=\[(.*)\], from=(.*)\]$/;
const QUANTIFIED_RE = /^(any|all): \[(.*)\]$/;

function parseFrom(text: string): RequestFrom | null {
    const quantified = QUANTIFIED_RE.exec(text);
    if (quantified)
        return {
            kind: quantified[1] as Quantifier,
            pattern: parseAttrList(quantified[2]),
        };
    // `ME` / `REQUESTER` appear only in Exchange lines, never in a Request.
    if (/^\d+$/.test(text)) return { kind: 'index', index: Number(text) };
    return null;
}

function readRequest(text: string): RequestLine | null {
    const match = REQUEST_RE.exec(text);
    if (!match) return null;
    const from = parseFrom(match[4]);
    if (!from) return null;
    return {
        policy: match[1] === undefined ? null : Number(match[1]),
        requester: Number(match[2]),
        resource: parseAttrList(match[3]),
        from,
    };
}

/**
 * `evaluating Request[…]`, with or without a `policy N:` prefix. The prefixed
 * form is the `(Pol)` clause restating the request it is about to try rules
 * against, so a caller has to pick which of the two it draws.
 */
export function parseRequestLine(text: string): RequestLine | null {
    if (!/(?:^|: )evaluating Request\[/.test(text)) return null;
    return readRequest(text);
}

const CANDIDATE_RE =
    /^policy (\d+): from match\(\[(.*)\], \[.*\]\) -> (true|false)$/;

/**
 * `policy N: from match(pattern, partyAttrs) -> outcome`: one party weighed
 * against a quantified `from`. Anchored on `from match`, since `resource match`
 * is the same shape and a different question.
 */
export function parseCandidateLine(text: string): CandidateLine | null {
    const match = CANDIDATE_RE.exec(text);
    if (!match) return null;
    return {
        index: Number(match[1]),
        pattern: parseAttrList(match[2]),
        outcome: match[3] === 'true',
    };
}

const CYCLE_RE = /^rule \d+\.\d+: compliant request found (Request\[.*\])$/;

/**
 * The vicious-circle break: an already-pending request complies, so the engine
 * permits without recursing. Not an ordinary request, since nothing was
 * evaluated.
 */
export function parseCycleLine(text: string): RequestLine | null {
    const match = CYCLE_RE.exec(text);
    return match ? readRequest(match[1]) : null;
}

export type FrameOperator = 'and' | 'or' | 'single';

const FRAME_OPEN_RE = /^rule (\d+)\.(\d+): evaluating (AND|OR)\(/;
const FRAME_SINGLE_RE = /^rule (\d+)\.(\d+): evaluating Exchange\[/;
const FRAME_CLOSE_RE = /^rule (\d+)\.(\d+): END Exchange -> (true|false)$/;
const FRAME_SEPARATOR_RE = /^rule (\d+)\.(\d+): (AND|OR)$/;

/**
 * The composite-exchange opener. The `evaluating AND(…)`/`END Exchange` pair is
 * emitted only for a `CompositeExchange`, so this and `parseFrameClose` always
 * match up at the same depth.
 */
export function parseFrameOpen(
    text: string,
): { policy: number; rule: string; operator: FrameOperator } | null {
    const match = FRAME_OPEN_RE.exec(text);
    if (!match) return null;
    return {
        policy: Number(match[1]),
        rule: `${match[1]}.${match[2]}`,
        operator: match[3] === 'AND' ? 'and' : 'or',
    };
}

/**
 * A single exchange. Whether it opens a frame is the caller's call: inside a
 * frame for the same rule it is a composite's operand marker, and framing it
 * would draw a price the rule never stated.
 */
export function parseSingleExchange(
    text: string,
): { policy: number; rule: string } | null {
    const match = FRAME_SINGLE_RE.exec(text);
    if (!match) return null;
    return { policy: Number(match[1]), rule: `${match[1]}.${match[2]}` };
}

export function parseFrameClose(
    text: string,
): { rule: string; outcome: boolean } | null {
    const match = FRAME_CLOSE_RE.exec(text);
    if (!match) return null;
    return { rule: `${match[1]}.${match[2]}`, outcome: match[3] === 'true' };
}

/** `rule N.M: AND` / `: OR`: the divider between two operands. */
export function parseFrameSeparator(text: string): { rule: string } | null {
    const match = FRAME_SEPARATOR_RE.exec(text);
    return match ? { rule: `${match[1]}.${match[2]}` } : null;
}

/**
 * One party of the policy system. `index` is identity: the 1-based Bart party
 * number the trace text prints. `label` falls back to `Party N` when the id is
 * not in the loaded user list.
 */
export type PartyRef = {
    index: number;
    id: string;
    label: string;
    /** 1-based position in the drawn track, or `null` when no step refers to
     *  this party. Equals `index` only when nothing is hidden: the party
     *  closure loads parties the request never reaches. */
    lane: number | null;
};

/** A party before lanes are assigned: identity and display, no position. */
export type PartyLabel = Omit<PartyRef, 'lane'>;

/**
 * `level` is how many arrows a step sits inside, not a layout hint. No renderer
 * reads it: frames carry nesting visually. It survives as the only observable
 * the tests have for `buildDiagram`'s `open`/`fan` nesting invariants.
 */
export type DiagramStep =
    | {
          kind: 'request';
          level: number;
          from: number;
          to: number;
          resource: BartAttrs;
          outcome: boolean | null;
          // Set for a refusal, and for the `warn` tone (a vacuous permit).
          // See `causeFor`.
          cause?: Cause;
          // The rule id that granted, when the trace states one; only a
          // permitted arrow carries it.
          grantedBy?: string;
      }
    | {
          kind: 'candidates';
          level: number;
          from: number;
          quantifier: Quantifier;
          pattern: BartAttrs;
          matched: number[];
      }
    | {
          kind: 'cycle';
          level: number;
          from: number;
          to: number;
          resource: BartAttrs;
      }
    // No `level`: nesting is carried by marker order, which `nest()` reads.
    | {
          kind: 'frame-open';
          policy: number;
          operator: FrameOperator;
          rule: string;
      }
    | { kind: 'frame-separator' }
    | { kind: 'frame-close'; outcome: boolean | null };

/**
 * The outcome of an unprefixed request: the next sibling `result:` line.
 * `result:` closes the request it follows rather than nesting inside it.
 */
function siblingResult(flat: TraceNode[], index: number): boolean | null {
    const { depth } = flat[index];
    for (let i = index + 1; i < flat.length; i++) {
        if (flat[i].depth > depth) continue;
        if (flat[i].depth < depth) return null;
        return flat[i].kind === 'result'
            ? booleanOutcome(flat[i].outcome)
            : null;
    }
    return null;
}

/**
 * The outcome of a `policy N:` arrow: the last outcome-bearing line inside its
 * own subtree. Inheriting the enclosing request's outcome instead paints every
 * failed candidate green the moment `any` succeeds on a later one.
 *
 * An errored condition counts as outcome-bearing, since it is the engine's
 * silent deny; skipping it lets an earlier `resource match -> true` stand as
 * the last word and draws a denied policy green.
 */
function subtreeOutcome(flat: TraceNode[], index: number): boolean | null {
    const { depth } = flat[index];
    let outcome: TraceOutcome = null;
    for (let i = index + 1; i < flat.length && flat[i].depth > depth; i++)
        if (flat[i].outcome !== null) outcome = flat[i].outcome;
    return isErrored(outcome) ? false : outcome;
}

/**
 * The cause chip for a step: refusals get one, and so does the `warn` tone, a
 * vacuous permit granted because the exchange's `to` pattern matched nobody,
 * which would otherwise look earned.
 *
 * `outcome: null` stays chipless whatever the cause says: the trace stated no
 * outcome there. `nodes` is a list because a merged `(Pol)` arrow is stated by
 * several restatement lines.
 */
function causeFor(
    nodes: TraceNode[],
    outcome: boolean | null,
): Cause | undefined {
    if (outcome === null) return undefined;
    const cause = causeOf(nodes);
    if (!cause) return undefined;
    return outcome === false || cause.tone === 'warn' ? cause : undefined;
}

/**
 * The requester of the next request line at or below `depth`: how a quantified
 * exchange, which names no requester itself, learns which party is issuing.
 * The scan stops at the first shallower line, or an exchange that matched no
 * candidates would take its fan from an unrelated later branch.
 */
function requesterAhead(
    flat: TraceNode[],
    index: number,
    depth: number,
): number | null {
    for (let i = index; i < flat.length; i++) {
        if (flat[i].depth < depth) return null;
        const request = parseRequestLine(flat[i].text);
        if (request) return request.requester;
    }
    return null;
}

/**
 * Whether a quantifier opening at `depth` invalidates the fan. Only one
 * outside the fan's own scope does; clearing on a quantified exchange inside
 * it draws the `(Pol)` clause's next rule attempt as a second arrow.
 */
function outsideFan(fan: { depth: number } | null, depth: number): boolean {
    return fan === null || fan.depth >= depth;
}

const RULE_LINE_RE = /^rule (\d+\.\d+):/;

/**
 * The rule id a `policy N:` restatement attempted: the first `rule N.M:` line
 * among its direct children. Nested sub-requests sit deeper, so their rule
 * lines cannot leak in.
 */
function attemptedRule(flat: TraceNode[], index: number): string | undefined {
    const depth = flat[index].depth + 1;
    for (let i = index + 1; i < flat.length && flat[i].depth >= depth; i++) {
        if (flat[i].depth !== depth) continue;
        const match = RULE_LINE_RE.exec(flat[i].text);
        if (match) return match[1];
    }
    return undefined;
}

/**
 * The rule that granted an unprefixed request: rules are first-match-wins, so
 * evaluation stops at the granting attempt and the last `policy N:`
 * restatement beneath the request is the one that granted.
 */
function grantedRuleOf(flat: TraceNode[], index: number): string | undefined {
    const depth = flat[index].depth + 1;
    let last: number | null = null;
    for (let i = index + 1; i < flat.length && flat[i].depth >= depth; i++) {
        if (flat[i].depth !== depth) continue;
        const request = parseRequestLine(flat[i].text);
        if (request && request.policy !== null) last = i;
    }
    return last === null ? undefined : attemptedRule(flat, last);
}

/** The nearest enclosing node, at a strictly smaller depth. */
function parentOf(flat: TraceNode[], index: number): TraceNode | null {
    for (let i = index - 1; i >= 0; i--)
        if (flat[i].depth < flat[index].depth) return flat[i];
    return null;
}

/**
 * Whether the engine looked for parties matching a quantified `from` at all.
 * Only meaningful when `buildDiagram` produced no steps: true there means the
 * engine searched and no party matched, an ordinary denial rather than a trace
 * nothing could be read from.
 */
export function searchedForParties(roots: TraceNode[]): boolean {
    return flattenTrace(roots).some(
        node => node.text === 'finding matching policies',
    );
}

/**
 * The party indexes any drawn arrow touches. `candidates.from` counts (the
 * filled origin dot lands on its lane) and so does `frame-open.policy` (a frame
 * captions itself with that party's name). A party a fan merely matched does
 * not: under `any` the engine may never ask it, and a column nothing points at
 * reads as participation that never happened.
 */
export function involvedParties(steps: DiagramStep[]): Set<number> {
    const involved = new Set<number>();
    for (const step of steps) {
        switch (step.kind) {
            case 'request':
            case 'cycle':
                involved.add(step.from);
                involved.add(step.to);
                break;
            case 'candidates':
                involved.add(step.from);
                break;
            case 'frame-open':
                involved.add(step.policy);
                break;
            default:
                // `frame-separator` and `frame-close` name no party.
                break;
        }
    }
    return involved;
}

/**
 * The party indexes a candidate fan matched, asked or not. Kept apart from
 * `involvedParties` so the roster can tell a party the engine weighed from one
 * it never reached.
 */
export function matchedParties(steps: DiagramStep[]): Set<number> {
    const matched = new Set<number>();
    for (const step of steps)
        if (step.kind === 'candidates')
            for (const index of step.matched) matched.add(index);
    return matched;
}

/**
 * Gives each involved party the next lane position and everyone else `null`.
 * Party order is preserved, so hiding a lane closes the gap without reordering
 * the rest.
 */
export function assignLanes(
    parties: PartyLabel[],
    involved: Set<number>,
): PartyRef[] {
    let assigned = 0;
    return parties.map(party => {
        if (!involved.has(party.index)) return { ...party, lane: null };
        assigned += 1;
        return { ...party, lane: assigned };
    });
}

/** Only the parties that get a lane. Already in lane order, since
 *  `assignLanes` preserves party order. */
export function lanedParties(parties: PartyRef[]): PartyRef[] {
    return parties.filter(party => party.lane !== null);
}

/**
 * A party's lane position. The `?? index` fallback covers two cases, each
 * unreachable for its own reason: an `index` naming no party at all, since
 * `parties` and the trace come from one evaluation; and an `index` naming an
 * unlaned party, since `parties` is laned from the same `steps` it is drawn
 * with, which nothing in the types enforces. Under a mismatched pair the raw
 * index leaves an endpoint with no lifeline behind it, rather than a crash.
 */
export function laneOf(parties: PartyRef[], index: number): number {
    return parties.find(party => party.index === index)?.lane ?? index;
}

/**
 * Whether a party index holds a lane. `laneOf` cannot answer this: it echoes
 * the raw index back for a party that has none.
 */
export function isLaned(parties: PartyRef[], index: number): boolean {
    return parties.some(party => party.index === index && party.lane !== null);
}

export function buildDiagram(roots: TraceNode[]): DiagramStep[] {
    const flat = flattenTrace(roots);
    const steps: DiagramStep[] = [];

    // Depths of the arrows we are inside; its length is each step's `level`.
    const open: number[] = [];
    // The quantifier a candidate run belongs to. Set by any `from=any:`/`all:`
    // line (request or exchange) and read by the next run.
    let quantified: {
        kind: Quantifier;
        pattern: BartAttrs;
        from: number;
    } | null = null;
    // The fan arrow accepting duplicate `policy N:` restatements. `nodes` holds
    // every restatement merged in: the arrow speaks for the whole policy.
    let fan: {
        policy: number;
        depth: number;
        step: number;
        nodes: TraceNode[];
    } | null = null;
    // Frames open, innermost last. `lastResult` is the only outcome a single
    // exchange states: it emits no `END Exchange` line of its own.
    const frames: {
        rule: string;
        depth: number;
        composite: boolean;
        lastResult: boolean | null;
    }[] = [];

    for (let i = 0; i < flat.length; i++) {
        const node = flat[i];
        while (open.length > 0 && open[open.length - 1] >= node.depth)
            open.pop();
        const level = open.length;

        // A single frame has no closing line, so the dedent out of its policy
        // scope closes it. A composite waits for its `END Exchange`.
        while (frames.length > 0) {
            const top = frames[frames.length - 1];
            if (top.composite || node.depth >= top.depth) break;
            steps.push({
                kind: 'frame-close',
                outcome:
                    top.lastResult ??
                    (node.kind === 'result'
                        ? booleanOutcome(node.outcome)
                        : null),
            });
            frames.pop();
        }

        if (node.kind === 'result' && frames.length > 0) {
            const top = frames[frames.length - 1];
            if (!top.composite && node.depth >= top.depth)
                top.lastResult = booleanOutcome(node.outcome);
        }

        const frameClose = parseFrameClose(node.text);
        if (frameClose) {
            steps.push({
                kind: 'frame-close',
                outcome: frameClose.outcome,
            });
            frames.pop();
            continue;
        }

        const frameSeparator = parseFrameSeparator(node.text);
        if (frameSeparator && frames.length > 0) {
            steps.push({ kind: 'frame-separator' });
            continue;
        }

        const frameOpen = parseFrameOpen(node.text);
        if (frameOpen) {
            frames.push({
                rule: frameOpen.rule,
                depth: node.depth,
                composite: true,
                lastResult: null,
            });
            steps.push({
                kind: 'frame-open',
                policy: frameOpen.policy,
                operator: frameOpen.operator,
                rule: frameOpen.rule,
            });
            continue;
        }

        // No `continue` below: this line can also carry a quantified
        // `from=any:` that the candidate-fan logic still has to read.
        const single = parseSingleExchange(node.text);
        // Innermost frame only. Testing every open frame would swallow a
        // re-entry into the same rule deeper down, Bart's reciprocal cycle.
        if (single && frames[frames.length - 1]?.rule !== single.rule) {
            frames.push({
                rule: single.rule,
                depth: node.depth,
                composite: false,
                lastResult: null,
            });
            steps.push({
                kind: 'frame-open',
                policy: single.policy,
                operator: 'single',
                rule: single.rule,
            });
        }

        const candidate = parseCandidateLine(node.text);
        if (candidate) {
            const matched: number[] = [];
            let end = i;
            while (end < flat.length && flat[end].depth === node.depth) {
                const line = parseCandidateLine(flat[end].text);
                if (!line) break;
                if (line.outcome) matched.push(line.index);
                end++;
            }
            if (quantified)
                steps.push({
                    kind: 'candidates',
                    level,
                    from: quantified.from,
                    quantifier: quantified.kind,
                    pattern: quantified.pattern,
                    matched,
                });
            // Consumed: one quantifier explains one run, so an unattributable
            // run emits nothing rather than a fan with a stale quantifier.
            quantified = null;
            i = end - 1;
            continue;
        }

        const cycle = parseCycleLine(node.text);
        if (cycle && cycle.from.kind === 'index') {
            steps.push({
                kind: 'cycle',
                level,
                from: cycle.requester,
                to: cycle.from.index,
                resource: cycle.resource,
            });
            continue;
        }

        const request = parseRequestLine(node.text);

        // A quantified exchange names no requester and its candidate run sits
        // as bare siblings, so the issuing party comes from the next request.
        if (!request) {
            const exchange = /from=(any|all): \[(.*)\]\]$/.exec(node.text);
            if (exchange) {
                const from = requesterAhead(flat, i + 1, node.depth);
                // A pattern matching nobody generates no request, so there is
                // no party to attribute the fan to (party 0 does not exist).
                quantified =
                    from === null
                        ? null
                        : {
                              kind: exchange[1] as Quantifier,
                              pattern: parseAttrList(exchange[2]),
                              from,
                          };
                if (outsideFan(fan, node.depth)) fan = null;
            }
            continue;
        }

        if (request.from.kind !== 'index') {
            // A quantified request draws nothing itself; its `policy N:`
            // children do, once the candidate fan is shown.
            quantified = {
                kind: request.from.kind,
                pattern: request.from.pattern,
                from: request.requester,
            };
            if (outsideFan(fan, node.depth)) fan = null;
            continue;
        }

        const parent = parentOf(flat, i);
        const parentRequest = parent ? parseRequestLine(parent.text) : null;
        const underQuantified =
            parentRequest !== null && parentRequest.from.kind !== 'index';

        if (request.policy !== null && !underQuantified) continue;

        if (request.policy !== null) {
            if (
                fan &&
                fan.policy === request.policy &&
                fan.depth === node.depth
            ) {
                // A repeat is `(Pol)` trying the next rule, not a second
                // request: `outcome` takes the newest, `cause` every attempt.
                fan.nodes.push(node);
                const step = steps[fan.step];
                if (step.kind === 'request') {
                    step.outcome = subtreeOutcome(flat, i);
                    step.cause = causeFor(fan.nodes, step.outcome);
                    step.grantedBy =
                        step.outcome === true
                            ? attemptedRule(flat, i)
                            : undefined;
                }
                // The pop loop closed this arrow's entry, but the node still
                // is that arrow; unreopened, its sub-requests drop a level.
                open.push(node.depth);
                continue;
            }
            fan = {
                policy: request.policy,
                depth: node.depth,
                step: steps.length,
                nodes: [node],
            };
            const outcome = subtreeOutcome(flat, i);
            steps.push({
                kind: 'request',
                level,
                from: request.requester,
                to: request.from.index,
                resource: request.resource,
                outcome,
                cause: causeFor([node], outcome),
                grantedBy:
                    outcome === true ? attemptedRule(flat, i) : undefined,
            });
            open.push(node.depth);
            continue;
        }

        // Does NOT clear `fan`: a rule attempt is interrupted by the very
        // sub-requests its exchange demands, so clearing draws a phantom arrow.
        const outcome = siblingResult(flat, i);
        steps.push({
            kind: 'request',
            level,
            from: request.requester,
            to: request.from.index,
            resource: request.resource,
            outcome,
            cause: causeFor([node], outcome),
            grantedBy: outcome === true ? grantedRuleOf(flat, i) : undefined,
        });
        open.push(node.depth);
    }

    return steps;
}
