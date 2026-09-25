import { DiagramFrame } from '@/features/access/components/diagram/DiagramFrame';
import type { PartyRef } from '@/lib/bart/diagram';
import { render, screen } from '@/test/render';
import { describe, expect, it } from 'vitest';

const ALICE: PartyRef = { index: 1, id: 'u-1', label: 'Alice', lane: 1 };
const BOB: PartyRef = { index: 2, id: 'u-2', label: 'Bob', lane: 2 };

describe('DiagramFrame caption', () => {
    it('names the rule demanding the exchange', () => {
        render(
            <ul>
                <DiagramFrame
                    frame={{
                        kind: 'frame',
                        policy: 2,
                        operator: 'single',
                        outcome: false,
                        rule: '2.1',
                        children: [],
                    }}
                    parties={[ALICE, BOB]}
                    depth={0}
                />
            </ul>,
        );

        expect(
            screen.getByText('rule 2.1 · Bob grants only in exchange'),
        ).toBeInTheDocument();
    });
});
