import { RuleEditorSheet } from '@/features/policy/components/RuleEditorSheet';
import type { PolicyRule } from '@/lib/bart/rule';
import { screen, userEvent } from '@/test/render';
import { renderWithSession } from '@/test/session';
import { setSuggestWidgetOpen } from '@/test/monaco';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// A dynamic import inside the factory, not a static top-level one.
vi.mock('@/components/bart/BartEditor', async () => {
    const { BartEditorMock } = await import('@/test/monaco');
    return { BartEditor: BartEditorMock, BartExpressionEditor: BartEditorMock };
});

const rule: PolicyRule = {
    id: 'rule-1',
    source: 'rule (kind:"book") {}',
    ast: { resource: { kind: 'book' } },
    pattern: { kind: 'book' },
    advancedReason: null,
};

// No acting user: every hook the sheet's tree reads through keys its SWR
// fetch off `actingUser?.id`, so an unresolved user means none of them fetch.
function renderSheet() {
    const onOpenChange = vi.fn();
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderWithSession(
        <RuleEditorSheet
            rule={rule}
            open
            onOpenChange={onOpenChange}
            onSave={onSave}
        />,
    );
    return { onOpenChange, onSave };
}

describe('RuleEditorSheet and Escape', () => {
    beforeEach(() => {
        setSuggestWidgetOpen(false);
        window.localStorage.clear();
    });

    it('lets Escape close the sheet when no editor widget is open', async () => {
        const { onOpenChange } = renderSheet();
        await screen.findByRole('heading', { name: 'Edit rule' });
        await userEvent.keyboard('{Escape}');
        expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it('leaves Escape to the editor while a suggest widget is open', async () => {
        setSuggestWidgetOpen(true);
        const { onOpenChange } = renderSheet();
        await screen.findByRole('heading', { name: 'Edit rule' });
        await userEvent.keyboard('{Escape}');
        expect(onOpenChange).not.toHaveBeenCalled();
    });
});
