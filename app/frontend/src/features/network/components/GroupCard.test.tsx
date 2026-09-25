import { GroupCard } from '@/features/network/components/GroupCard';
import type { ApiGroup } from '@/lib/api/types';
import { render, screen, userEvent } from '@/test/render';
import { describe, expect, it, vi } from 'vitest';

const readers: ApiGroup = {
    id: 'g-1',
    name: 'readers',
    description: 'People who read',
};

function renderCard(overrides: Partial<Parameters<typeof GroupCard>[0]> = {}) {
    const props = {
        group: readers,
        joined: true,
        busy: false,
        onToggle: vi.fn(),
        onUpdate: vi.fn().mockResolvedValue(undefined),
        onDelete: vi.fn(),
        ...overrides,
    };
    return { props, ...render(<GroupCard {...props} />) };
}

describe('GroupCard', () => {
    it('offers the manage menu only to a member', () => {
        renderCard({ joined: false });
        expect(
            screen.queryByRole('button', { name: 'Manage readers' }),
        ).not.toBeInTheDocument();
        expect(
            screen.getByRole('button', { name: 'Join' }),
        ).toBeInTheDocument();
    });

    it('keeps the delete confirmation mounted after the menu closes', async () => {
        const { props } = renderCard();

        await userEvent.click(
            screen.getByRole('button', { name: 'Manage readers' }),
        );
        await userEvent.click(
            await screen.findByRole('menuitem', { name: 'Delete' }),
        );

        const dialog = await screen.findByRole('alertdialog');
        expect(dialog).toBeInTheDocument();
        expect(props.onDelete).not.toHaveBeenCalled();

        await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
        expect(props.onDelete).toHaveBeenCalledOnce();
    });

    it('keeps the edit dialog mounted after the menu closes', async () => {
        renderCard();

        await userEvent.click(
            screen.getByRole('button', { name: 'Manage readers' }),
        );
        await userEvent.click(
            await screen.findByRole('menuitem', { name: 'Edit' }),
        );

        expect(await screen.findByRole('dialog')).toBeInTheDocument();
    });

    it('does not delete when the confirmation is cancelled', async () => {
        const { props } = renderCard();

        await userEvent.click(
            screen.getByRole('button', { name: 'Manage readers' }),
        );
        await userEvent.click(
            await screen.findByRole('menuitem', { name: 'Delete' }),
        );
        await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

        expect(props.onDelete).not.toHaveBeenCalled();
    });
});
