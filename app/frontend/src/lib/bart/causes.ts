import { parseAttrList, resourceLabel } from './attrs';
import { isErrored, TraceNode } from './trace';

/**
 * The reason one branch of an evaluation failed, in the words of the line that
 * decided it. Every cause maps onto a line the engine already emits: it is a
 * read-only fork, so nothing can be added at the source. Total by construction:
 * an unreadable subtree yields `null` and the row keeps its bare outcome mark.
 */

export type Cause = { text: string; tone: 'deny' | 'warn' };

/**
 * The unprefixed request line an exchange generates: a different arrow with a
 * chip of its own, so reading its evidence upward captions a refusal with some
 * other party's condition. Excludes `policy N: evaluating Request[…]`, which
 * restates the same request and is descended into like any other line.
 */
const SUB_REQUEST_RE = /^evaluating Request\[/;

/**
 * The lines that are evidence for one arrow: each node given, plus descendants
 * down to, but not into, the sub-requests above. Not `flattenTrace`, whose walk
 * is unbounded. Yields nodes so `causeOf` reads the outcome `trace.ts` already
 * decided rather than re-deriving it from the text.
 */
function evidence(nodes: TraceNode[]): TraceNode[] {
    const below = (node: TraceNode): TraceNode[] =>
        SUB_REQUEST_RE.test(node.text)
            ? [node]
            : [node, ...node.children.flatMap(below)];
    // The given nodes are never bounded themselves: a caller may hand us the
    // very `evaluating Request[…]` line whose arrow this is.
    return nodes.flatMap(node => [node, ...node.children.flatMap(below)]);
}

/** A condition's own description for the chip; the outcome comes from the
 *  parsed node, so this supplies only the words. */
const CONDITION_RE = /^rule \d+\.\d+: condition (.*) -> (?:true|false)$/;
const RESOURCE_RE =
    /^rule \d+\.\d+: resource match\(\[(.*)\], \[.*\]\) -> (true|false)$/;
const NO_FROM_RE = /^rule \d+\.\d+: not satisfied: no one from exchange$/;
const NO_TO_RE = /^rule \d+\.\d+: satisfied: no one to exchange$/;

/**
 * `nodes` is a list because `buildDiagram` collapses a policy's per-rule
 * restatements into one arrow. That arrow speaks for the whole policy, so the
 * newest attempt alone would blame the resource for a refusal an earlier
 * attempt had already matched.
 */
export function causeOf(nodes: TraceNode[]): Cause | null {
    const evidenceNodes = evidence(nodes);
    const lines = evidenceNodes.map(node => node.text);

    // Declaration order is the ranking: an errored condition beats a false one,
    // and a false one beats the resource, which never applied at all.
    for (const node of evidenceNodes)
        if (isErrored(node.outcome))
            return {
                text: `condition errored · ${node.outcome.errored}`,
                tone: 'deny',
            };

    for (const node of evidenceNodes) {
        if (node.outcome !== false) continue;
        const match = CONDITION_RE.exec(node.text);
        if (match)
            return { text: `condition false · ${match[1]}`, tone: 'deny' };
    }

    const matches = lines
        .map(text => RESOURCE_RE.exec(text))
        .filter((match): match is RegExpExecArray => match !== null);
    // Only when *every* rule turned the resource away. One `true` means some
    // rule applied and the refusal came from somewhere else.
    if (matches.length > 0 && matches.every(match => match[2] === 'false'))
        return {
            text: `no rule offers ${resourceLabel(parseAttrList(matches[0][1]))}`,
            tone: 'deny',
        };

    if (lines.some(text => NO_FROM_RE.test(text)))
        return { text: 'no party matched', tone: 'deny' };

    // Not a failure: the engine permits when the `to` pattern is empty, and a
    // vacuous grant is otherwise indistinguishable from an earned one.
    if (lines.some(text => NO_TO_RE.test(text)))
        return { text: 'nobody to exchange with', tone: 'warn' };

    return null;
}
