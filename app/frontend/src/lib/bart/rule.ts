import { emitAttrs } from './format';
import { BartAttrs } from './types';

/** Where a resource goes to, or comes from, in an exchange. */
export type Participant =
    | { kind: 'me' }
    | { kind: 'requester' }
    | { kind: 'any'; attrs: BartAttrs }
    | { kind: 'all'; attrs: BartAttrs };

/**
 * One `(to:…, resource:…, from:…)` term. The grammar constrains the ends
 * asymmetrically (`to` is `me` or quantified, `from` is `requester` or
 * quantified), but one `Participant` union covers both; the parser rejects
 * `to:requester` and `from:me`, and the picker never offers them.
 */
export type ExchangeTerm = {
    to: Participant;
    resource: BartAttrs;
    from: Participant;
};

/**
 * An exchange as the block editor models it: one connector over a flat list,
 * narrower than the grammar's arbitrary `and`/`or` tree. A mixed tree has no
 * representation here, so `parseRule` reports it unrepresentable and the rule
 * stays advanced-only instead of being flattened into a different meaning.
 *
 * `terms` is never empty, and a single term always carries `connector: 'and'`,
 * or it round-trips from `or` and breaks `parseRule`'s fixed-point guard.
 */
export type ExchangeGroup = {
    connector: 'and' | 'or';
    terms: ExchangeTerm[];
};

/**
 * A rule as the block editor models it. `condition` is raw `.bart` expression
 * text rather than a tree: the condition builder is deferred, and keeping the
 * source is both lossless and free: `parseRule` captures the span verbatim.
 */
export type RuleAst = {
    resource: BartAttrs;
    condition?: string;
    exchange?: ExchangeGroup;
};

/**
 * A rule as the policy page holds it. `ast === null` means it cannot open in
 * the block editor and `advancedReason` says why: a positioned syntax error,
 * or a shape the flat exchange model cannot hold. `pattern` is non-null
 * whenever the text parsed at all, so a rule can have a coverage count and no
 * blocks. Only `toPolicyRule` sets them.
 */
export type PolicyRule = {
    id: string;
    source: string;
    ast: RuleAst | null;
    pattern: BartAttrs | null;
    advancedReason: string | null;
};

/** Restores the one-term-implies-`and` invariant after a UI edit. */
export function normalizeExchange(group: ExchangeGroup): ExchangeGroup {
    return group.terms.length === 1 && group.connector !== 'and'
        ? { connector: 'and', terms: group.terms }
        : group;
}

/**
 * An exchange as the grammar allows it, with `and` and `or` nesting freely.
 * A group's children never share its connector, so `(A and B) and C` and
 * `A and (B and C)` build one node and the printer has one form to emit.
 */
export type ExchangeNode =
    | { kind: 'term'; term: ExchangeTerm }
    | { kind: 'group'; connector: 'and' | 'or'; children: ExchangeNode[] };

/** A rule before block projection. `ExchangeGroup` is the depth-one case. */
export type RuleTree = {
    resource: BartAttrs;
    condition: string | null;
    exchange: ExchangeNode | null;
};

/**
 * The only way to build a group. Collapses children already carrying
 * `connector`, and returns a lone child bare: a one-child group would print an
 * extra pair of parentheses and fail the printer's own fixed point.
 */
export function groupNode(
    connector: 'and' | 'or',
    children: ExchangeNode[],
): ExchangeNode {
    const flat: ExchangeNode[] = [];
    for (const child of children) {
        if (child.kind === 'group' && child.connector === connector)
            flat.push(...child.children);
        else flat.push(child);
    }
    return flat.length === 1
        ? flat[0]
        : { kind: 'group', connector, children: flat };
}

function participantToBart(p: Participant): string {
    switch (p.kind) {
        case 'me':
            return 'me';
        case 'requester':
            return 'requester';
        case 'any':
        case 'all':
            return `(${p.kind}:${emitAttrs(p.attrs)})`;
    }
}

/**
 * Every resource pattern must be non-empty. `emitAttrs({})` is the empty
 * string, so without this an exchange term silently emits the malformed
 * `(to:me, resource:, from:requester)`. Does NOT apply to a quantified
 * participant's pattern: `(any:)` is legal and means "any party at all".
 */
function requireResource(attrs: BartAttrs, where: string): string {
    if (Object.keys(attrs).length === 0)
        throw new Error(`${where} needs at least one resource attribute`);
    return emitAttrs(attrs);
}

/** Broken terms and the connector align past `' exchange:('`. */
const TERM_INDENT = ' '.repeat(' exchange:('.length);

function termToBart(term: ExchangeTerm, keySeparator: string): string {
    const to = participantToBart(term.to);
    const from = participantToBart(term.from);
    const resource = requireResource(term.resource, 'an exchange');
    return `(to:${to},${keySeparator}resource:${resource},${keySeparator}from:${from})`;
}

/** `RuleAst` -> `RuleTree`, the widening direction. */
export function toTree(ast: RuleAst): RuleTree {
    if (ast.exchange && ast.exchange.terms.length === 0)
        throw new Error('an exchange needs at least one term');
    return {
        resource: ast.resource,
        condition: ast.condition ?? null,
        exchange: ast.exchange
            ? groupNode(
                  ast.exchange.connector,
                  ast.exchange.terms.map(term => ({
                      kind: 'term' as const,
                      term,
                  })),
              )
            : null,
    };
}

function nodeToBart(
    node: ExchangeNode,
    keySeparator: string,
    between: string,
): string {
    if (node.kind === 'term') return termToBart(node.term, keySeparator);
    if (node.children.length === 0)
        throw new Error('an exchange needs at least one term');
    const parts = node.children.map(child =>
        nodeToBart(child, keySeparator, between),
    );
    return `(${parts.join(`${between}${node.connector}${between}`)})`;
}

/**
 * When `broken`, the extra paren around a group pushes its terms one column
 * right: hence the extra space in `keySeparator` but not in `between`. Nesting
 * deeper than one group is not re-indented; Format's contract is canonical
 * text, and the width heuristic is best effort.
 */
function exchangeToBart(node: ExchangeNode, broken: boolean): string {
    const grouped = node.kind === 'group';
    const keySeparator = broken ? `\n${TERM_INDENT}${grouped ? ' ' : ''}` : ' ';
    return nodeToBart(node, keySeparator, broken ? `\n${TERM_INDENT}` : ' ');
}

/**
 * Serialises a rule to `.bart`. The one canonical printer: the preview, every
 * save, and Monaco's format action all go through it, so the preview shows
 * exactly what gets stored. One line when it fits `width`, otherwise broken at
 * the top-level clauses, which breaks every exchange term too.
 */
export function printTree(tree: RuleTree, width = 80): string {
    const resource = `resource:${requireResource(tree.resource, 'a rule')}`;
    // Truthiness, not a null check: a cleared condition field means "no
    // condition" and must drop the clause rather than emit `condition:()`.
    const condition = tree.condition ? `condition:(${tree.condition})` : null;

    const flat = tree.exchange
        ? `exchange:${exchangeToBart(tree.exchange, false)}`
        : null;
    const oneLine = `(${[resource, condition, flat].filter(Boolean).join(', ')})`;
    if (oneLine.length <= width) return oneLine;

    const broken = tree.exchange
        ? `exchange:${exchangeToBart(tree.exchange, true)}`
        : null;
    return `(${[resource, condition, broken].filter(Boolean).join(',\n ')})`;
}

/** `printTree` over the block model. */
export function printRule(ast: RuleAst, width = 80): string {
    return printTree(toTree(ast), width);
}

export type PrintedRule =
    { ok: true; text: string } | { ok: false; message: string };

/**
 * `printRule`, with the incomplete-draft failure as a value. For an AST the
 * block editor is still assembling, whose half-filled term `requireResource`
 * rejects. An AST from `parseRule` is provably printable and uses `printRule`
 * directly, with no dead `!ok` branch to write.
 */
export function tryPrintRule(ast: RuleAst, width = 80): PrintedRule {
    try {
        return { ok: true, text: printRule(ast, width) };
    } catch (error) {
        return {
            ok: false,
            message: error instanceof Error ? error.message : String(error),
        };
    }
}

/** `printTree`, with the incomplete-draft failure as a value. */
export function tryPrintTree(tree: RuleTree, width = 80): PrintedRule {
    try {
        return { ok: true, text: printTree(tree, width) };
    } catch (error) {
        return {
            ok: false,
            message: error instanceof Error ? error.message : String(error),
        };
    }
}
