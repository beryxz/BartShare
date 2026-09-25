/**
 * Parses the evaluator's `Trace` output into a tree: two spaces of indentation
 * per level, one line per decision, an optional `-> true|false` suffix.
 * Renderers consume this model, never the raw string. Total by construction:
 * an unclassifiable line becomes an `other` node with its text preserved.
 */
export type TraceLineKind =
    | 'request'
    | 'policy'
    | 'rule'
    | 'exchange'
    | 'connector'
    | 'compliance'
    | 'result'
    | 'other';

/**
 * What a line stated in its outcome position. `{errored}` is the engine's
 * silent deny: an exception thrown inside a condition, logged where a boolean
 * would go. The exception's type never leaves the engine, so a message is all
 * a consumer can have. A union, not a sibling field, so the compiler visits
 * every site that must tell "not a boolean" from "no outcome stated".
 */
export type TraceOutcome = boolean | { errored: string } | null;

export type TraceNode = {
    id: string;
    text: string;
    depth: number;
    kind: TraceLineKind;
    outcome: TraceOutcome;
    children: TraceNode[];
};

/** Whether a line's outcome position held a swallowed exception. */
export function isErrored(
    outcome: TraceOutcome,
): outcome is { errored: string } {
    return outcome !== null && typeof outcome === 'object';
}

/**
 * The boolean a line stated, or null. Lossless only for lines that can state
 * nothing else (`result:`, `END Exchange`). Never on a condition line, where
 * it discards the errored state and paints a denied arrow green.
 */
export function booleanOutcome(outcome: TraceOutcome): boolean | null {
    return typeof outcome === 'boolean' ? outcome : null;
}

const INDENT_WIDTH = 2;

function classify(text: string): TraceLineKind {
    if (/^result:/.test(text)) return 'result';
    // Before the general rule case, and anchored at end-of-line, since
    // `evaluating AND(...)` is not a connector.
    if (/^rule \d+\.\d+: (OR|AND)$/.test(text)) return 'connector';
    // The vicious-circle break: an already-pending request complies, so the
    // engine permits without recursing. Its own kind so the UI can say so.
    if (/compliant request found/.test(text)) return 'compliance';
    if (/^rule \d+\.\d+:/.test(text)) {
        return /evaluating (OR|AND|Exchange)|END Exchange/.test(text)
            ? 'exchange'
            : 'rule';
    }
    if (/^policy \d+:/.test(text)) return 'policy';
    if (/^evaluating Request\[/.test(text)) return 'request';
    return 'other';
}

/**
 * Anchored on the line's grammatical position, not its content, so a condition
 * comparing against a string holding `Exception` is not read as a failure.
 * `->\s*`, not `-> `: the line is already trimmed, so an empty message leaves
 * nothing after the arrow, and a required space would miss and drop the line to
 * `null`, indistinguishable from one nothing recognised.
 */
const CONDITION_OUTCOME_RE = /^rule \d+\.\d+: condition .* ->\s*(.*)$/;

/**
 * For an unusable engine message: Java `null` (printed as the string "null")
 * or an empty one, which arrives as a bare trailing `->`.
 */
const NO_ERROR_MESSAGE = 'the exception carried no message';

function readOutcome(text: string): TraceOutcome {
    const arrow = /-> (true|false)$/.exec(text);
    if (arrow) return arrow[1] === 'true';
    const result = /^result: (true|false)$/.exec(text);
    if (result) return result[1] === 'true';
    // Last, so an ordinary `condition x -> true` never reaches it. A line
    // ending in a bare `->` is still a failure, message or no message.
    const errored = CONDITION_OUTCOME_RE.exec(text);
    if (errored) {
        const message = errored[1].trim();
        return {
            errored:
                message === '' || message === 'null'
                    ? NO_ERROR_MESSAGE
                    : message,
        };
    }
    return null;
}

/**
 * Nearest already-seen node shallower than `depth`. A `stack[depth - 1]` lookup
 * is not enough: a line can jump more than one level deeper than anything seen,
 * leaving that slot empty, and it must not fall out as a spurious root.
 */
function findAncestor(
    stack: TraceNode[],
    depth: number,
): TraceNode | undefined {
    for (let d = depth - 1; d >= 0; d--) if (stack[d]) return stack[d];
    return undefined;
}

export function parseTrace(raw: string): TraceNode[] {
    const roots: TraceNode[] = [];
    // stack[d] is the most recent node at depth d. Indexed by depth rather than
    // pushed and popped, so a multi-level dedent cannot desynchronise it.
    const stack: TraceNode[] = [];
    let counter = 0;

    for (const line of raw.split('\n')) {
        if (line.trim() === '') continue;

        const leading = line.length - line.trimStart().length;
        const depth = Math.floor(leading / INDENT_WIDTH);
        const text = line.trim();

        const node: TraceNode = {
            id: `t${counter++}`,
            text,
            depth,
            kind: classify(text),
            outcome: readOutcome(text),
            children: [],
        };

        const parent = depth > 0 ? findAncestor(stack, depth) : undefined;
        if (parent) parent.children.push(node);
        else roots.push(node);

        stack[depth] = node;
        stack.length = depth + 1;
    }

    return roots;
}

/** The verdict of the whole evaluation: the last top-level `result:` line. */
export function traceVerdict(raw: string): boolean | null {
    const roots = parseTrace(raw);
    for (let i = roots.length - 1; i >= 0; i--)
        if (roots[i].kind === 'result') return booleanOutcome(roots[i].outcome);
    return null;
}

/**
 * The tree in the order the evaluator printed it. Every node carries its own
 * `depth`, so sibling reasoning (the `result:` closing a request, a run of
 * candidates) is just "the next entry at the same depth".
 */
export function flattenTrace(roots: TraceNode[]): TraceNode[] {
    return roots.flatMap(node => [node, ...flattenTrace(node.children)]);
}
