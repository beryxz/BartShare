import { describe, expect, it } from 'vitest';
import {
    groupIdSpans,
    highlight,
    partyEqualitySpans,
    partyIdSpans,
} from './highlight';

/** The rendered text, which must always reconstruct the input exactly. */
function rendered(source: string): string {
    return highlight(source)
        .map(p => p.text)
        .join('');
}

function classOf(source: string, text: string): string | undefined {
    return highlight(source).find(p => p.text === text)?.className;
}

describe('highlight', () => {
    it('reconstructs the source exactly, whitespace included', () => {
        const source = '(resource : (type : "notes"))\n  # a comment';
        expect(rendered(source)).toBe(source);
    });

    it('colours clause keywords', () => {
        expect(classOf('(resource:(t:"x"))', 'resource')).toBe('text-bart-key');
        expect(classOf('(to:me, from:requester)', 'to')).toBe('text-bart-key');
    });

    it('colours participants', () => {
        expect(classOf('(to:me)', 'me')).toBe('text-bart-participant');
        expect(classOf('(from:requester)', 'requester')).toBe(
            'text-bart-participant',
        );
        expect(classOf('(any:)', 'any')).toBe('text-bart-participant');
    });

    it('colours operators, strings, numbers and booleans', () => {
        expect(classOf('a and b', 'and')).toBe('text-bart-operator');
        expect(classOf('(k:"v")', '"v"')).toBe('text-bart-string');
        expect(classOf('(k:42)', '42')).toBe('text-bart-number');
        expect(classOf('(k:true)', 'true')).toBe('text-bart-bool');
    });

    it('never colours a keyword that is inside a string', () => {
        // The old regex scanner needed an overlap check for this; a lexer
        // makes it structural, because the whole literal is one token.
        const pieces = highlight('(k:"resource and me")');
        expect(
            pieces.find(p => p.text === '"resource and me"')?.className,
        ).toBe('text-bart-string');
        expect(pieces.some(p => p.text === 'and')).toBe(false);
    });

    it('leaves an ordinary attribute key unstyled', () => {
        expect(classOf('(course:"ads")', 'course')).toBeUndefined();
    });

    it('is total: unlexable source renders as one plain piece', () => {
        const broken = '(k:"unterminated';
        expect(highlight(broken)).toEqual([{ text: broken }]);
    });

    it('handles empty source', () => {
        expect(highlight('')).toEqual([]);
    });
});

describe('highlight: uuid resolution', () => {
    const names = new Map([['7f3a9c2e-0000-4000-8000-000000000001', 'david']]);

    it('annotates a userId value with the name behind it', () => {
        const source = '(any:(userId:"7f3a9c2e-0000-4000-8000-000000000001"))';
        const piece = highlight(source, names).find(p => p.annotation);
        expect(piece?.annotation).toBe('david');
        expect(piece?.text).toContain('7f3a9c2e');
    });

    it('leaves an unknown id alone', () => {
        const source = '(any:(userId:"nobody-here"))';
        expect(highlight(source, names).some(p => p.annotation)).toBe(false);
    });

    it('only annotates the value of a userId key, not any matching string', () => {
        const source = '(note:"7f3a9c2e-0000-4000-8000-000000000001")';
        expect(highlight(source, names).some(p => p.annotation)).toBe(false);
    });

    it('annotates nothing when no name map is supplied', () => {
        const source = '(any:(userId:"7f3a9c2e-0000-4000-8000-000000000001"))';
        expect(highlight(source).some(p => p.annotation)).toBe(false);
    });

    it('annotates a party id written as an equality in a condition', () => {
        const source =
            '(resource:(type:"notes"), condition:(requester.userId = "u-1"))';
        const pieces = highlight(source, new Map([['u-1', 'mary']]), new Map());
        const annotated = pieces.find(p => p.annotation !== undefined);
        expect(annotated?.annotation).toBe('mary');
    });

    it('still annotates a party id written as an attribute', () => {
        const source =
            '(exchange:(to:me, resource:(type:"notes"), from:(any:(userId:"u-1"))))';
        const pieces = highlight(source, new Map([['u-1', 'mary']]), new Map());
        const annotated = pieces.find(p => p.annotation !== undefined);
        expect(annotated?.annotation).toBe('mary');
    });
});

describe('partyIdSpans', () => {
    it('finds a userId value with offsets that slice back to it', () => {
        const source = '(any:(userId:"abc-123"))';
        const [span] = partyIdSpans(source);
        expect(span.id).toBe('abc-123');
        expect(source.slice(span.start, span.end)).toBe('"abc-123"');
    });

    it('finds several', () => {
        const source = '(any:(userId:"a"))(all:(userId:"b"))';
        expect(partyIdSpans(source).map(s => s.id)).toEqual(['a', 'b']);
    });

    it('ignores a uuid-shaped string under any other key', () => {
        expect(partyIdSpans('(note:"abc-123")')).toEqual([]);
    });

    it('ignores a bare string with no key before it', () => {
        expect(partyIdSpans('"abc-123"')).toEqual([]);
    });

    it('is total on unlexable source', () => {
        expect(partyIdSpans('(userId:"unterminated')).toEqual([]);
    });
});

describe('groupIdSpans', () => {
    it('finds the id in a qualified membership test', () => {
        const source = '"g-1" in requester.groups';
        expect(groupIdSpans(source).map(s => s.id)).toEqual(['g-1']);
    });

    it('finds the id in an unqualified membership test', () => {
        // Unqualified `groups` asks whether the POLICY OWNER is in the group,
        // a different question but the same id space.
        expect(groupIdSpans('"g-1" in groups').map(s => s.id)).toEqual(['g-1']);
    });

    it('finds the id behind an attribute-pattern qualifier', () => {
        const source = '"g-1" in (role:"auditor").groups';
        expect(groupIdSpans(source).map(s => s.id)).toEqual(['g-1']);
    });

    it('reports the span of the string literal, quotes included', () => {
        const source = '"g-1" in groups';
        expect(groupIdSpans(source)[0]).toEqual({
            start: 0,
            end: 5,
            id: 'g-1',
        });
    });

    it('ignores a string that is not tested against groups', () => {
        // The collection decides. `connections` is a different id space, and
        // annotating it with a group name would be a false claim.
        expect(groupIdSpans('"g-1" in requester.connections')).toEqual([]);
    });

    it('ignores a string in a plain value position', () => {
        // Same rule `partyIdSpans` follows: a free-text attribute may hold a
        // uuid legitimately, and it is not a group.
        expect(groupIdSpans('(note:"g-1")')).toEqual([]);
    });

    it('ignores a string followed by something other than in', () => {
        expect(groupIdSpans('"g-1" = requester.groups')).toEqual([]);
    });

    it('returns nothing for source the lexer cannot read', () => {
        expect(groupIdSpans('"unterminated in groups')).toEqual([]);
    });

    // The grammar's `qname` allows only `NAME`, `requester '.' NAME`, or
    // `attribute+ '.' NAME` as the right-hand side of `in`; these cases pin
    // that production's boundary.
    it('rejects a qualifier keyword other than requester', () => {
        // Only the literal `requester` gets the dotted form; `me` does not
        // appear in the `qname` production at all.
        expect(groupIdSpans('"g-1" in me.groups')).toEqual([]);
    });

    it('rejects a dotted chain longer than the grammar allows', () => {
        // `qname` has no NAME '.' NAME '.' NAME alternative: a bare `NAME`
        // never takes a dot.
        expect(groupIdSpans('"g-1" in a.b.groups')).toEqual([]);
    });

    it('rejects a name trailing the attribute-pattern qualifier', () => {
        // `attribute+ '.' NAME` ends at the first NAME after the attribute
        // group(s); a further `.groups` has nothing left in the production
        // to attach to.
        expect(groupIdSpans('"g-1" in (role:"auditor").foo.groups')).toEqual(
            [],
        );
    });

    it('finds the id behind more than one attribute-pattern group', () => {
        // `attribute+` is one or MORE groups, not exactly one.
        const source = '"g-1" in (role:"x")(level:2).groups';
        expect(groupIdSpans(source).map(s => s.id)).toEqual(['g-1']);
    });
});

describe('partyEqualitySpans', () => {
    it('finds the id on the right of a qualified equality', () => {
        const source = 'requester.userId = "u-1"';
        const [span] = partyEqualitySpans(source);
        expect(span.id).toBe('u-1');
        expect(source.slice(span.start, span.end)).toBe('"u-1"');
    });

    it('finds the id in an unqualified equality', () => {
        // Bare `userId` asks about the policy owner: a different question,
        // the same id space.
        expect(partyEqualitySpans('userId = "u-1"').map(s => s.id)).toEqual([
            'u-1',
        ]);
    });

    it('finds the id behind an attribute-pattern qualifier', () => {
        const source = '(role:"auditor").userId = "u-1"';
        expect(partyEqualitySpans(source).map(s => s.id)).toEqual(['u-1']);
    });

    it('finds the id when the literal is on the left', () => {
        expect(
            partyEqualitySpans('"u-1" = requester.userId').map(s => s.id),
        ).toEqual(['u-1']);
    });

    it('finds several', () => {
        const source = 'requester.userId = "a" or requester.userId = "b"';
        expect(partyEqualitySpans(source).map(s => s.id)).toEqual(['a', 'b']);
    });

    it('ignores an equality against any other name', () => {
        expect(partyEqualitySpans('requester.username = "mary"')).toEqual([]);
    });

    it('ignores a membership test, which groupIdSpans owns', () => {
        expect(partyEqualitySpans('"g-1" in requester.groups')).toEqual([]);
    });

    it('ignores a chain longer than the grammar allows', () => {
        expect(partyEqualitySpans('a.b.userId = "u-1"')).toEqual([]);
    });

    it('finds the id behind more than one attribute-pattern group', () => {
        const source = '(role:"x")(level:2).userId = "u-1"';
        expect(partyEqualitySpans(source).map(s => s.id)).toEqual(['u-1']);
    });

    it('ignores every comparison but equality', () => {
        // Of the six comparison operators the grammar allows, only `=` names
        // a party.
        expect(partyEqualitySpans('requester.userId != "u-1"')).toEqual([]);
    });

    it('rejects a qualifier keyword other than requester', () => {
        expect(partyEqualitySpans('me.userId = "u-1"')).toEqual([]);
    });

    it('rejects a dangling closing paren with no matching opener', () => {
        // What a deleted opening paren leaves behind mid-edit.
        expect(partyEqualitySpans('role:"x").userId = "u-1"')).toEqual([]);
    });

    it('rejects a chain that extends past requester', () => {
        expect(partyEqualitySpans('a.requester.userId = "u-1"')).toEqual([]);
    });

    it('returns nothing for text that does not lex', () => {
        expect(partyEqualitySpans('requester.userId = "unclosed')).toEqual([]);
    });
});

describe('highlight with group names', () => {
    const groupNames = new Map([['g-1', 'csbook-club']]);

    it('annotates a group id with its name', () => {
        const pieces = highlight(
            '"g-1" in requester.groups',
            undefined,
            groupNames,
        );
        expect(pieces.find(p => p.text === '"g-1"')?.annotation).toBe(
            'csbook-club',
        );
    });

    it('leaves an unresolved group id unannotated', () => {
        const pieces = highlight(
            '"g-2" in requester.groups',
            undefined,
            groupNames,
        );
        expect(
            pieces.find(p => p.text === '"g-2"')?.annotation,
        ).toBeUndefined();
    });

    it('does not annotate the same id outside a groups test', () => {
        const pieces = highlight('(note:"g-1")', undefined, groupNames);
        expect(
            pieces.find(p => p.text === '"g-1"')?.annotation,
        ).toBeUndefined();
    });

    it('still reconstructs the source exactly', () => {
        const source = '(condition:("g-1" in requester.groups))';
        expect(
            highlight(source, undefined, groupNames)
                .map(p => p.text)
                .join(''),
        ).toBe(source);
    });
});
