import { describe, expect, it } from 'vitest';
import {
    completionsAt,
    resolvedSpans,
    type BartCompletion,
    type BartEditorData,
} from './providers';

function editorData(
    names: readonly (readonly [string, string])[] = [],
    groupNames: readonly (readonly [string, string])[] = [],
): BartEditorData {
    return {
        completions: [],
        names: new Map(names),
        groupNames: new Map(groupNames),
    };
}

describe('resolvedSpans', () => {
    it('reports a party id once, even when both scanners independently claim the same span', () => {
        // Malformed mid-edit text: `partyIdSpans` reads the `:` on the left,
        // `partyEqualitySpans` the `=` and bare `userId` on the right.
        const source = 'userId:"u-1" = userId';
        const spans = resolvedSpans(source, editorData([['u-1', 'david']]));
        expect(spans).toHaveLength(1);
        expect(spans[0]).toMatchObject({
            name: 'david',
            kind: 'userId',
            span: { id: 'u-1' },
        });
    });

    it('still resolves a party id found by only one scanner', () => {
        const source = '(any:(userId:"u-1"))';
        const spans = resolvedSpans(source, editorData([['u-1', 'david']]));
        expect(spans).toHaveLength(1);
        expect(spans[0]).toMatchObject({ name: 'david', kind: 'userId' });
    });

    it('resolves a group id alongside a party id', () => {
        const source = '"g-1" in requester.groups';
        const spans = resolvedSpans(
            source,
            editorData([], [['g-1', 'csbook-club']]),
        );
        expect(spans).toHaveLength(1);
        expect(spans[0]).toMatchObject({
            name: 'csbook-club',
            kind: 'groupId',
        });
    });

    it('drops an id with no matching name', () => {
        const source = '(any:(userId:"nobody-here"))';
        expect(resolvedSpans(source, editorData())).toEqual([]);
    });
});

const all: BartCompletion[] = [
    { label: 'and', insertText: 'and' },
    { label: 'connections', insertText: 'connections' },
    { label: 'john', insertText: '"john-id"' },
];

describe('completionsAt', () => {
    it('offers the full list in ordinary position', () => {
        expect(completionsAt('requester', all)).toEqual(all);
        expect(completionsAt('', all)).toEqual(all);
        expect(completionsAt('"x" in ', all)).toEqual(all);
    });

    it('offers only members straight after a dot', () => {
        expect(completionsAt('requester.', all).map(c => c.label)).toEqual([
            'userId',
            'groups',
        ]);
    });

    it('keeps offering members while a member name is typed', () => {
        expect(completionsAt('requester.u', all).map(c => c.label)).toEqual([
            'userId',
            'groups',
        ]);
    });

    it('treats any qualified name as member position', () => {
        expect(completionsAt('party.', all).map(c => c.label)).toEqual([
            'userId',
            'groups',
        ]);
    });

    it('does not read a decimal point as member position', () => {
        expect(completionsAt('300.', all)).toEqual(all);
    });

    /**
     * `attribute+ '.' NAME` is the third `qname` form, so the dot can follow a
     * pattern's closing paren. Offering the full list there suggests operators
     * and quoted ids, none of which can end a qname.
     */
    it('reads an attribute pattern qualifier as member position', () => {
        expect(
            completionsAt('(role:"auditor").', all).map(c => c.label),
        ).toEqual(['userId', 'groups']);
        expect(
            completionsAt('"x" in (role:"auditor")(dept:"eng").g', all).map(
                c => c.label,
            ),
        ).toEqual(['userId', 'groups']);
    });
});
