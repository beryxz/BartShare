import { EmptyState } from '@/components/states/EmptyState';
import { render, screen } from '@/test/render';
import { describe, expect, it } from 'vitest';

describe('EmptyState', () => {
    it('renders the title alone when given no description or action', () => {
        const { container } = render(<EmptyState title="No resources yet" />);
        expect(screen.getByText('No resources yet')).toBeInTheDocument();
        expect(container.querySelectorAll('p')).toHaveLength(1);
        expect(
            screen.queryByRole('button', { name: 'Clear filter' }),
        ).not.toBeInTheDocument();
    });

    it('renders the description and the action when given them', () => {
        render(
            <EmptyState
                title="Nothing matches"
                description="Try a different filter."
                action={<button>Clear filter</button>}
            />,
        );
        expect(screen.getByText('Try a different filter.')).toBeInTheDocument();
        expect(
            screen.getByRole('button', { name: 'Clear filter' }),
        ).toBeInTheDocument();
    });
});
