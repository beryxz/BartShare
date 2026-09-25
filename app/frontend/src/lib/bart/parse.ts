import { lex, Position, Token } from './lex';
import {
    ExchangeGroup,
    ExchangeNode,
    ExchangeTerm,
    groupNode,
    normalizeExchange,
    Participant,
    PolicyRule,
    RuleAst,
    RuleTree,
    tryPrintRule,
    tryPrintTree,
} from './rule';
import { BartAttrs, BartScalar, BartValue } from './types';

/**
 * `.bart` rule text -> `RuleAst`, via `parseSyntax` then `toBlocks` below,
 * each kept honest by its own fixed-point guard. The third place the frontend
 * encodes this grammar, also checked by a property test and a fixture test
 * against the corpus the Java parser is tested with.
 *
 * The evaluator's `POST /validate/policy` decides validity, so nothing here may
 * block a save the server would accept.
 */
export type ParseRule =
    { ok: true; ast: RuleAst } | { ok: false; reason: string; at?: Position };

export const MIXED_EXCHANGE_REASON =
    'This rule mixes "and" and "or" in its exchange, which the block editor ' +
    'cannot show. Edit it here in Advanced.';

export const NOT_REPRESENTABLE_REASON =
    'This rule uses Bart the block editor cannot represent exactly, so it ' +
    'opens in Advanced only.';

/** A recoverable syntax problem, reported with the position it happened at. */
class SyntaxProblem extends Error {
    constructor(
        readonly detail: string,
        readonly at: Position,
    ) {
        super(detail);
    }
}

/** Valid Bart the flat block model has no shape for. */
class Unrepresentable extends Error {
    constructor(readonly reason: string) {
        super(reason);
    }
}

function positionOf(token: Token): Position {
    return { line: token.line, column: token.column };
}

/** `"a\"b"` -> `a"b`. The inverse of `formatScalar`'s escaping. */
function unquote(text: string): string {
    return text.slice(1, -1).replace(/\\(.)/g, '$1');
}

class Cursor {
    private i = 0;

    constructor(
        private readonly tokens: Token[],
        private readonly source: string,
    ) {}

    peek(offset = 0): Token {
        const index = Math.min(this.i + offset, this.tokens.length - 1);
        return this.tokens[index];
    }

    next(): Token {
        const token = this.peek();
        if (token.kind !== 'eof') this.i += 1;
        return token;
    }

    /** True when the current token is this exact punctuation or name. */
    at(text: string): boolean {
        const token = this.peek();
        return (
            (token.kind === 'punct' || token.kind === 'name') &&
            token.text === text
        );
    }

    accept(text: string): boolean {
        if (!this.at(text)) return false;
        this.next();
        return true;
    }

    expect(text: string): Token {
        if (!this.at(text)) this.fail(`expected '${text}'`);
        return this.next();
    }

    fail(detail: string): never {
        const token = this.peek();
        const found = token.kind === 'eof' ? 'end of input' : `'${token.text}'`;
        throw new SyntaxProblem(`${detail}, found ${found}`, positionOf(token));
    }

    slice(start: number, end: number): string {
        return this.source.slice(start, end);
    }
}

function parseAtom(c: Cursor): BartScalar {
    const token = c.peek();
    switch (token.kind) {
        case 'string':
            c.next();
            return unquote(token.text);
        case 'number': {
            // `300.0` is Double and `300` Long, and the engine calls them
            // unequal. Only text surviving the JS round trip is representable.
            c.next();
            if (String(Number(token.text)) !== token.text)
                throw new Unrepresentable(NOT_REPRESENTABLE_REASON);
            return Number(token.text);
        }
        case 'bool':
            c.next();
            return token.text === 'true';
        default:
            throw c.fail('expected a string, number or boolean');
    }
}

function parseValue(c: Cursor): BartValue {
    if (c.accept('{')) {
        const braced: BartScalar[] = [];
        if (!c.at('}')) {
            braced.push(parseAtom(c));
            while (c.accept(',')) braced.push(parseAtom(c));
        }
        c.expect('}');
        return braced;
    }

    const first = parseAtom(c);
    if (!c.at(',')) return first;

    // `atom (',' atom)+`: a bare comma list is a collection. Unambiguous
    // inside an attribute, whose only other exit is its closing paren.
    const items: BartScalar[] = [first];
    while (c.accept(',')) items.push(parseAtom(c));
    return items;
}

/** `'(' NAME ':' value ')'` */
function parseAttribute(c: Cursor, into: BartAttrs): void {
    c.expect('(');
    const key = c.peek();
    if (key.kind !== 'name') c.fail('expected an attribute name');
    c.next();
    if (key.text in into)
        throw new SyntaxProblem(
            `duplicate attribute key '${key.text}'`,
            positionOf(key),
        );
    c.expect(':');
    const value = parseValue(c);
    c.expect(')');
    into[key.text] = value;
}

/** `attribute+` when `atLeastOne`, `attribute*` otherwise: a resource pattern
 *  must be non-empty, while `(any:)` legitimately means "any party at all". */
function parseAttributes(c: Cursor, atLeastOne: boolean): BartAttrs {
    const attrs: BartAttrs = {};
    if (atLeastOne && !c.at('(')) c.fail('expected at least one attribute');
    while (c.at('(')) parseAttribute(c, attrs);
    return attrs;
}

/** `others : '(' quant=('any'|'all') ':' attribute* ')'` */
function parseOthers(c: Cursor): Participant {
    c.expect('(');
    const quant = c.peek();
    if (!c.at('any') && !c.at('all')) c.fail("expected 'any' or 'all'");
    c.next();
    c.expect(':');
    const attrs = parseAttributes(c, false);
    c.expect(')');
    return quant.text === 'any'
        ? { kind: 'any', attrs }
        : { kind: 'all', attrs };
}

/** `to : 'me' | others`: `to:requester` is not expressible. */
function parseTo(c: Cursor): Participant {
    if (c.accept('me')) return { kind: 'me' };
    if (c.at('(')) return parseOthers(c);
    throw c.fail("expected 'me' or a quantified party for 'to'");
}

/** `from : 'requester' | others`: `from:me` is not expressible. */
function parseFrom(c: Cursor): Participant {
    if (c.accept('requester')) return { kind: 'requester' };
    if (c.at('(')) return parseOthers(c);
    throw c.fail("expected 'requester' or a quantified party for 'from'");
}

function parseTerm(c: Cursor): ExchangeNode {
    c.expect('(');
    c.expect('to');
    c.expect(':');
    const to = parseTo(c);
    c.expect(',');
    c.expect('resource');
    c.expect(':');
    const resource = parseAttributes(c, true);
    c.expect(',');
    c.expect('from');
    c.expect(':');
    const from = parseFrom(c);
    c.expect(')');
    return { kind: 'term', term: { to, resource, from } };
}

function parsePrimary(c: Cursor): ExchangeNode {
    if (!c.at('(')) c.fail('expected an exchange');
    // `'(' inner=exchange ')'` and `'(' 'to' ...` both open with a paren; one
    // token of lookahead is all it takes to tell them apart.
    if (c.peek(1).kind === 'name' && c.peek(1).text === 'to')
        return parseTerm(c);
    c.expect('(');
    const inner = parseOr(c);
    c.expect(')');
    return inner;
}

/** `and` binds tighter than `or`, and both are left-associative. */
function parseAnd(c: Cursor): ExchangeNode {
    const children = [parsePrimary(c)];
    while (c.accept('and')) children.push(parsePrimary(c));
    return groupNode('and', children);
}

function parseOr(c: Cursor): ExchangeNode {
    const children = [parseAnd(c)];
    while (c.accept('or')) children.push(parseAnd(c));
    return groupNode('or', children);
}

/**
 * Projects a tree onto the flat block model. Same-connector children are
 * collapsed at construction, so a group inside a group is always the mixed
 * case and there is nothing left to search for.
 */
function flattenNode(node: ExchangeNode): ExchangeGroup {
    if (node.kind === 'term') return { connector: 'and', terms: [node.term] };

    const terms: ExchangeTerm[] = [];
    for (const child of node.children) {
        if (child.kind !== 'term')
            throw new Unrepresentable(MIXED_EXCHANGE_REASON);
        terms.push(child.term);
    }
    return normalizeExchange({ connector: node.connector, terms });
}

/**
 * Removes one layer of parentheses when they wrap the whole expression, or a
 * rule gains a layer on every save, since `printRule` emits `condition:(X)`.
 * Strip-once is itself a fixed point. `(a) and (b)` keeps its parens: the first
 * closes before the end, so they are not a wrapper.
 */
function stripOuterParens(text: string): string {
    if (!text.startsWith('(') || !text.endsWith(')')) return text;
    const result = lex(text);
    if (!result.ok) return text;

    let depth = 0;
    for (const token of result.tokens) {
        if (token.kind === 'eof') break;
        if (token.kind !== 'punct') continue;
        if (token.text === '(') depth += 1;
        else if (token.text === ')') {
            depth -= 1;
            if (depth === 0 && token.end !== text.length) return text;
        }
    }
    return text.slice(1, -1).trim();
}

/**
 * The condition, captured as verbatim source. The parentheses belong to the
 * expression and are optional, so the span runs to the first `,` or `)` at
 * depth zero, counted over TOKENS: those characters inside a string literal are
 * content, and a character scan would desynchronise on them.
 */
function parseConditionSpan(c: Cursor): string {
    const first = c.peek();
    const start = first.start;
    let end = start;
    let depth = 0;

    for (;;) {
        const token = c.peek();
        if (token.kind === 'eof')
            throw new SyntaxProblem(
                'unterminated condition',
                positionOf(token),
            );
        const isPunct = token.kind === 'punct';
        // Check the exit before adjusting depth, so the rule's own closing
        // paren ends the span instead of driving the depth negative.
        if (
            depth === 0 &&
            isPunct &&
            (token.text === ',' || token.text === ')')
        )
            break;
        if (isPunct && (token.text === '(' || token.text === '{')) depth += 1;
        if (isPunct && (token.text === ')' || token.text === '}')) depth -= 1;
        end = token.end;
        c.next();
    }

    const text = c.slice(start, end).trim();
    if (text === '')
        throw new SyntaxProblem('condition is empty', positionOf(first));
    return stripOuterParens(text);
}

function format(detail: string, at: Position): string {
    return `Line ${at.line}:${at.column}: ${detail}`;
}

/**
 * Whether a failure `reason` is a syntax error rather than valid Bart the flat
 * block model has no shape for. For callers holding only the string; anything
 * holding the whole `ParseRule` reads `at` instead.
 */
export function isSyntaxReason(reason: string): boolean {
    return /^Line \d+:\d+: /.test(reason);
}

/** `.bart` rule text -> `RuleTree`, stage one alone: `printTree`'s reverse. */
export type ParseSyntax =
    { ok: true; tree: RuleTree } | { ok: false; reason: string; at?: Position };

/** `policyRule`, without the fixed-point guard. */
function parseTreeCore(source: string): ParseSyntax {
    const lexed = lex(source);
    if (!lexed.ok)
        return {
            ok: false,
            reason: format(lexed.reason, lexed.at),
            at: lexed.at,
        };

    const c = new Cursor(lexed.tokens, source);
    try {
        c.expect('(');
        c.expect('resource');
        c.expect(':');
        const resource = parseAttributes(c, true);

        let condition: string | undefined;
        let exchange: ExchangeNode | undefined;

        // Each clause is optional, at most once, in this order. A repeat is
        // invisible to the guard and opens in blocks missing the author's text.
        while (c.accept(',')) {
            const clause = c.peek();
            if (c.accept('condition')) {
                if (condition !== undefined)
                    throw new SyntaxProblem(
                        "repeated 'condition' clause",
                        positionOf(clause),
                    );
                if (exchange !== undefined)
                    throw new SyntaxProblem(
                        "'condition' must come before 'exchange'",
                        positionOf(clause),
                    );
                c.expect(':');
                condition = parseConditionSpan(c);
            } else if (c.accept('exchange')) {
                if (exchange !== undefined)
                    throw new SyntaxProblem(
                        "repeated 'exchange' clause",
                        positionOf(clause),
                    );
                c.expect(':');
                exchange = parseOr(c);
            } else {
                c.fail("expected 'condition' or 'exchange'");
            }
        }

        c.expect(')');
        // EOF-anchored, like the grammar's `*File` entry rules: without this a
        // second pasted rule would be silently ignored rather than reported.
        if (c.peek().kind !== 'eof') c.fail('expected end of rule');

        return {
            ok: true,
            tree: {
                resource,
                condition: condition ?? null,
                exchange: exchange ?? null,
            },
        };
    } catch (error) {
        if (error instanceof SyntaxProblem)
            return {
                ok: false,
                reason: format(error.detail, error.at),
                at: error.at,
            };
        if (error instanceof Unrepresentable)
            return { ok: false, reason: error.reason };
        throw error;
    }
}

function sameValue(a: BartValue, b: BartValue): boolean {
    const aArray = Array.isArray(a);
    const bArray = Array.isArray(b);
    if (aArray !== bArray) return false;
    if (aArray && bArray)
        return a.length === b.length && a.every((v, i) => v === b[i]);
    return a === b;
}

function sameAttrs(a: BartAttrs, b: BartAttrs): boolean {
    const keys = Object.keys(a);
    if (keys.length !== Object.keys(b).length) return false;
    return keys.every(k => k in b && sameValue(a[k], b[k]));
}

function sameParticipant(a: Participant, b: Participant): boolean {
    if (a.kind !== b.kind) return false;
    if (a.kind === 'any' || a.kind === 'all')
        return sameAttrs(a.attrs, (b as { attrs: BartAttrs }).attrs);
    return true;
}

function sameExchange(a?: ExchangeGroup, b?: ExchangeGroup): boolean {
    if (!a || !b) return a === b;
    if (a.connector !== b.connector || a.terms.length !== b.terms.length)
        return false;
    return a.terms.every((term, i) => {
        const other = b.terms[i];
        return (
            sameParticipant(term.to, other.to) &&
            sameParticipant(term.from, other.from) &&
            sameAttrs(term.resource, other.resource)
        );
    });
}

function sameRule(a: RuleAst, b: RuleAst): boolean {
    return (
        sameAttrs(a.resource, b.resource) &&
        (a.condition ?? '') === (b.condition ?? '') &&
        sameExchange(a.exchange, b.exchange)
    );
}

function sameNode(a: ExchangeNode, b: ExchangeNode): boolean {
    if (a.kind === 'term' && b.kind === 'term')
        return (
            sameParticipant(a.term.to, b.term.to) &&
            sameParticipant(a.term.from, b.term.from) &&
            sameAttrs(a.term.resource, b.term.resource)
        );
    if (a.kind === 'group' && b.kind === 'group')
        return (
            a.connector === b.connector &&
            a.children.length === b.children.length &&
            a.children.every((child, i) => sameNode(child, b.children[i]))
        );
    return false;
}

function sameTree(a: RuleTree, b: RuleTree): boolean {
    if (!sameAttrs(a.resource, b.resource)) return false;
    if ((a.condition ?? '') !== (b.condition ?? '')) return false;
    if (a.exchange === null || b.exchange === null)
        return a.exchange === b.exchange;
    return sameNode(a.exchange, b.exchange);
}

/**
 * Stage one: text -> tree, over the whole grammar. Succeeds for valid Bart the
 * block editor cannot show, which is what gives Format and coverage something
 * to work with.
 */
export function parseSyntax(source: string): ParseSyntax {
    const parsed = parseTreeCore(source);
    if (!parsed.ok) return parsed;

    // Format reprints this tree over the user's text, so a tree that does not
    // survive its own printer would rewrite the rule's meaning in place.
    const printed = tryPrintTree(parsed.tree);
    if (!printed.ok) return { ok: false, reason: NOT_REPRESENTABLE_REASON };

    const again = parseTreeCore(printed.text);
    if (!again.ok || !sameTree(again.tree, parsed.tree))
        return { ok: false, reason: NOT_REPRESENTABLE_REASON };

    return parsed;
}

/** The projection, without the fixed-point guard. */
function toBlocksCore(tree: RuleTree): ParseRule {
    try {
        const ast: RuleAst = { resource: tree.resource };
        if (tree.condition !== null) ast.condition = tree.condition;
        if (tree.exchange !== null) ast.exchange = flattenNode(tree.exchange);
        return { ok: true, ast };
    } catch (error) {
        if (error instanceof Unrepresentable)
            return { ok: false, reason: error.reason };
        throw error;
    }
}

/**
 * Stage two: tree -> blocks. Blocks enter the editor only if they re-emit to
 * text that projects back to the same blocks. Not a token compare, since the
 * printer canonicalises.
 */
export function toBlocks(tree: RuleTree): ParseRule {
    const projected = toBlocksCore(tree);
    if (!projected.ok) return projected;

    const printed = tryPrintRule(projected.ast);
    if (!printed.ok) return { ok: false, reason: NOT_REPRESENTABLE_REASON };

    const again = parseTreeCore(printed.text);
    if (!again.ok) return { ok: false, reason: NOT_REPRESENTABLE_REASON };

    const reprojected = toBlocksCore(again.tree);
    if (!reprojected.ok || !sameRule(reprojected.ast, projected.ast))
        return { ok: false, reason: NOT_REPRESENTABLE_REASON };

    return projected;
}

export function parseRule(source: string): ParseRule {
    const parsed = parseSyntax(source);
    if (!parsed.ok) return parsed;
    return toBlocks(parsed.tree);
}

/**
 * One rule's text as the policy page holds it. `pattern` outlives `ast`: a
 * mixed exchange has no block form but its resource pattern is still known.
 */
export function toPolicyRule(id: string, source: string): PolicyRule {
    const syntax = parseSyntax(source);
    const blocks = syntax.ok ? toBlocks(syntax.tree) : syntax;
    return {
        id,
        source,
        ast: blocks.ok ? blocks.ast : null,
        pattern: syntax.ok ? syntax.tree.resource : null,
        advancedReason: blocks.ok ? null : blocks.reason,
    };
}
