import { DiagramRow } from '@/features/access/components/diagram/DiagramRow';
import type { PartyRef } from '@/lib/bart/diagram';
import { render, screen } from '@/test/render';
import { describe, expect, it } from 'vitest';

const ALICE: PartyRef = { index: 1, id: 'u-1', label: 'Alice', lane: 1 };
const BOB: PartyRef = { index: 2, id: 'u-2', label: 'Bob', lane: 2 };
/** Loaded by the party closure but reached by no step, so it has no column. */
const CAROL: PartyRef = { index: 3, id: 'u-3', label: 'Carol', lane: null };

function candidates(from: number, matched: number[]) {
    return {
        kind: 'candidates' as const,
        level: 0,
        from,
        quantifier: 'any' as const,
        pattern: { type: 'notes' },
        matched,
    };
}

/**
 * The dots are decorative spans with no role, so the class they are drawn with
 * is the only handle. One per asked party, plus the origin marker.
 */
function dots(container: HTMLElement): number {
    return container.querySelectorAll('.rounded-full').length;
}

describe('DiagramRow candidate search', () => {
    it('says so in words when the pattern matched nobody', () => {
        render(
            <ul>
                <DiagramRow step={candidates(1, [])} parties={[ALICE, BOB]} />
            </ul>,
        );

        expect(screen.getByText(/no party matched/)).toBeInTheDocument();
    });

    it('reports no shortfall when every match is drawn', () => {
        const { container } = render(
            <ul>
                <DiagramRow step={candidates(1, [2])} parties={[ALICE, BOB]} />
            </ul>,
        );

        expect(screen.getByText(/1 matched$/)).toBeInTheDocument();
        expect(dots(container)).toBe(2);
    });

    /**
     * The searching party matches its own pattern, and the engine drops a pair
     * whose ends are one party, so the row draws nothing at all: the count has
     * to read "none shown" rather than counting a match it never drew.
     */
    it('counts nothing shown when the only match is the searcher', () => {
        render(
            <ul>
                <DiagramRow step={candidates(1, [1])} parties={[ALICE, BOB]} />
            </ul>,
        );

        expect(
            screen.getByText(
                /1 matched, none shown · Alice excluded \(cannot trade with itself\)/,
            ),
        ).toBeInTheDocument();
    });

    it('counts an unlaned match as matched but not shown', () => {
        const { container } = render(
            <ul>
                <DiagramRow
                    step={candidates(1, [1, 2, 3])}
                    parties={[ALICE, BOB, CAROL]}
                />
            </ul>,
        );

        // Carol matched without a lane, and Alice is the searcher: 3 matched,
        // Alice and Bob drawn, Bob the only one asked.
        expect(screen.getByText(/3 matched, 2 shown/)).toBeInTheDocument();
        expect(dots(container)).toBe(2);
    });
});

describe('DiagramRow granting rule badge', () => {
    it('names the granting rule on a permitted arrow', () => {
        render(
            <ul>
                <DiagramRow
                    step={{
                        kind: 'request',
                        level: 0,
                        from: 1,
                        to: 2,
                        resource: { type: 'notes' },
                        outcome: true,
                        grantedBy: '2.2',
                    }}
                    parties={[ALICE, BOB]}
                />
            </ul>,
        );

        expect(screen.getByText('granted by rule 2.2')).toBeInTheDocument();
    });

    it('draws no rule badge when no rule granted', () => {
        render(
            <ul>
                <DiagramRow
                    step={{
                        kind: 'request',
                        level: 0,
                        from: 1,
                        to: 2,
                        resource: { type: 'notes' },
                        outcome: false,
                    }}
                    parties={[ALICE, BOB]}
                />
            </ul>,
        );

        expect(screen.queryByText(/granted by rule/)).not.toBeInTheDocument();
    });
});
