import { lex, Token } from './lex';

export type HighlightPiece = {
    text: string;
    className?: string;
    /** A resolved display name to show beside this token, e.g. a username. */
    annotation?: string;
};

const PARTICIPANTS = new Set(['me', 'requester', 'any', 'all']);
const OPERATORS = new Set(['and', 'or', 'not', 'in']);
const CLAUSE_KEYS = new Set([
    'party',
    'rules',
    'resource',
    'condition',
    'exchange',
    'to',
    'from',
]);

/** A string literal carrying an id, with its offsets. One shape for both id
 *  spaces, party and group: only the finder differs. */
export type IdSpan = { start: number; end: number; id: string };

/**
 * Every `userId : "<uuid>"` value in the source, with its offsets. Only that
 * position: a uuid in a free-text attribute is not a party. Shared by
 * `highlight` and the Monaco inlay-hint provider so the two cannot disagree.
 */
export function partyIdSpans(source: string): IdSpan[] {
    const result = lex(source);
    if (!result.ok) return [];

    const spans: IdSpan[] = [];
    result.tokens.forEach((token, i) => {
        const colon = result.tokens[i - 1];
        const key = result.tokens[i - 2];
        if (
            token.kind === 'string' &&
            colon?.text === ':' &&
            key?.kind === 'name' &&
            key.text === 'userId'
        )
            spans.push({
                start: token.start,
                end: token.end,
                id: token.text.slice(1, -1),
            });
    });
    return spans;
}

/**
 * The tail `NAME` of a `qname`, starting at `start`, or null. `Bart.g4` gives
 * `qname` three alternatives and this accepts exactly those: `groups`,
 * `requester.groups`, and `attribute+ '.' NAME` such as `(role:"x").groups`.
 * Each `(...)` is skipped as a balanced group, since only the tail matters.
 * A longer chain (`a.b.groups`) or any other name before the dot returns null.
 */
function qualifierTail(tokens: Token[], start: number): string | null {
    let j = start;

    const terminalName = (at: number): string | null => {
        const name = tokens[at];
        if (name?.kind !== 'name') return null;
        const dot = tokens[at + 1];
        if (dot?.kind === 'punct' && dot.text === '.') return null;
        return name.text;
    };

    // 'requester' '.' NAME
    if (tokens[j]?.kind === 'name' && tokens[j].text === 'requester') {
        j += 1;
        if (tokens[j]?.kind !== 'punct' || tokens[j].text !== '.') return null;
        return terminalName(j + 1);
    }

    // attribute+ '.' NAME
    if (tokens[j]?.kind === 'punct' && tokens[j].text === '(') {
        do {
            let depth = 0;
            for (;;) {
                const token = tokens[j];
                if (!token || token.kind === 'eof') return null;
                if (token.kind === 'punct' && token.text === '(') depth += 1;
                else if (token.kind === 'punct' && token.text === ')') {
                    depth -= 1;
                    if (depth === 0) {
                        j += 1;
                        break;
                    }
                }
                j += 1;
            }
        } while (tokens[j]?.kind === 'punct' && tokens[j].text === '(');
        if (tokens[j]?.kind !== 'punct' || tokens[j].text !== '.') return null;
        return terminalName(j + 1);
    }

    // NAME, with nothing else
    return terminalName(j);
}

/**
 * The tail `NAME` of a `qname` ending at `end`, or null. The mirror of
 * `qualifierTail`, needed because in `requester.userId = "<id>"` the id sits to
 * the right of the qualifier, so only the qname's end is known.
 *
 * Reading backwards, a lone `requester` or `)` proves the qname ends correctly,
 * not that it starts there, so both branches also check what precedes it.
 */
function qualifierTailEndingAt(tokens: Token[], end: number): string | null {
    const name = tokens[end];
    if (name?.kind !== 'name') return null;

    const dot = tokens[end - 1];
    // NAME, with nothing else: a bare `userId`.
    if (dot?.kind !== 'punct' || dot.text !== '.') return name.text;

    const before = tokens[end - 2];

    // 'requester' '.' NAME: `requester` must be the first token of the
    // qname, so nothing may connect to it through a further dot.
    if (before?.kind === 'name' && before.text === 'requester') {
        const beforeRequester = tokens[end - 3];
        if (beforeRequester?.kind === 'punct' && beforeRequester.text === '.')
            return null;
        return name.text;
    }

    // attribute+ '.' NAME: walk back through every balanced `(...)` group,
    // tracking depth so a closing paren with no opener is rejected, then
    // check nothing precedes the leftmost '(' through a dot.
    if (before?.kind === 'punct' && before.text === ')') {
        let j = end - 2;
        do {
            let depth = 0;
            for (;;) {
                const token = tokens[j];
                if (!token) return null;
                if (token.kind === 'punct' && token.text === ')') depth += 1;
                else if (token.kind === 'punct' && token.text === '(') {
                    depth -= 1;
                    if (depth === 0) {
                        j -= 1;
                        break;
                    }
                }
                j -= 1;
            }
        } while (tokens[j]?.kind === 'punct' && tokens[j].text === ')');
        const beforeGroups = tokens[j];
        if (beforeGroups?.kind === 'punct' && beforeGroups.text === '.')
            return null;
        return name.text;
    }

    // Anything else (`me.userId`, `a.b.userId`) is not a qname.
    return null;
}

/**
 * Every party id compared with `=` in an expression, with its offsets. The
 * companion to `partyIdSpans`, which finds the attribute form; that form is
 * illegal in a condition, so without this the id `ConditionEditor` inserts gets
 * no inlay hint. Both operand orders count: `=` is symmetric.
 */
export function partyEqualitySpans(source: string): IdSpan[] {
    const result = lex(source);
    if (!result.ok) return [];

    const spans: IdSpan[] = [];
    result.tokens.forEach((token, i) => {
        if (token.kind !== 'string') return;

        const before = result.tokens[i - 1];
        const after = result.tokens[i + 1];
        const isEquality = (t: Token | undefined) =>
            t?.kind === 'punct' && t.text === '=';

        const matches =
            (isEquality(before) &&
                qualifierTailEndingAt(result.tokens, i - 2) === 'userId') ||
            (isEquality(after) &&
                qualifierTail(result.tokens, i + 2) === 'userId');

        if (matches)
            spans.push({
                start: token.start,
                end: token.end,
                id: token.text.slice(1, -1),
            });
    });
    return spans;
}

/**
 * Every group id in the source, with its offsets. One position only: the left
 * operand of an `in` whose qualifier chain ends in `groups`, so a uuid in a
 * `connections` test is not annotated with a group name. Both
 * `"<id>" in requester.groups` and `"<id>" in groups` count.
 */
export function groupIdSpans(source: string): IdSpan[] {
    const result = lex(source);
    if (!result.ok) return [];

    const spans: IdSpan[] = [];
    result.tokens.forEach((token, i) => {
        if (token.kind !== 'string') return;
        const operator = result.tokens[i + 1];
        if (operator?.kind !== 'name' || operator.text !== 'in') return;
        if (qualifierTail(result.tokens, i + 2) !== 'groups') return;
        spans.push({
            start: token.start,
            end: token.end,
            id: token.text.slice(1, -1),
        });
    });
    return spans;
}

function classOf(token: Token): string | undefined {
    switch (token.kind) {
        case 'string':
            return 'text-bart-string';
        case 'number':
            return 'text-bart-number';
        case 'bool':
            return 'text-bart-bool';
        case 'name':
            if (PARTICIPANTS.has(token.text)) return 'text-bart-participant';
            if (OPERATORS.has(token.text)) return 'text-bart-operator';
            if (CLAUSE_KEYS.has(token.text)) return 'text-bart-key';
            return undefined;
        default:
            return undefined;
    }
}

/**
 * `.bart` source split into styled pieces. Highlighting only: `POST /validate/*`
 * decides validity. Total, so source the lexer cannot read renders as one
 * unstyled piece and the pieces always reconstruct the input exactly.
 *
 * `names` annotates a party id in both positions it may legally appear, the
 * `userId:"<id>"` attribute and a `requester.userId = "<id>"` equality;
 * `groupNames` does the same for a group id. Two maps, not one: a merged map
 * renders one id space's name on the other.
 */
export function highlight(
    source: string,
    names?: ReadonlyMap<string, string>,
    groupNames?: ReadonlyMap<string, string>,
): HighlightPiece[] {
    if (source === '') return [];

    const result = lex(source);
    if (!result.ok) return [{ text: source }];

    const pieces: HighlightPiece[] = [];
    let cursor = 0;

    // Both party scanners, so a saved rule shows the name either way. Keyed
    // by span start, so mid-edit text matching both collapses to one entry
    // rather than a duplicate; `resolvedSpans` must dedup by hand.
    const partyIds = new Map(
        [...partyIdSpans(source), ...partyEqualitySpans(source)].map(span => [
            span.start,
            span.id,
        ]),
    );
    const groupIds = new Map(
        groupIdSpans(source).map(span => [span.start, span.id]),
    );

    result.tokens.forEach(token => {
        if (token.kind === 'eof') return;

        // Whitespace, comments and anything else between tokens.
        if (token.start > cursor)
            pieces.push({ text: source.slice(cursor, token.start) });

        const partyId = partyIds.get(token.start);
        const groupId = groupIds.get(token.start);
        const annotation = partyId
            ? names?.get(partyId)
            : groupId
              ? groupNames?.get(groupId)
              : undefined;

        pieces.push({
            text: token.text,
            className: classOf(token),
            ...(annotation ? { annotation } : {}),
        });
        cursor = token.end;
    });

    if (cursor < source.length) pieces.push({ text: source.slice(cursor) });
    return pieces;
}
