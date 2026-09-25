import { AttributeList } from '@/components/bart/AttributeList';
import { render, screen, userEvent, within } from '@/test/render';
import { describe, expect, it } from 'vitest';

describe('AttributeList', () => {
    it('renders an empty pattern as the wildcard, never as "no attributes"', () => {
        render(<AttributeList attrs={{}} />);
        expect(screen.getByText('any (wildcard)')).toBeInTheDocument();
    });

    it('renders every attribute when under the cap', () => {
        render(<AttributeList attrs={{ kind: 'book', year: 2024 }} max={5} />);
        expect(screen.getByTitle('kind:"book"')).toBeInTheDocument();
        expect(screen.getByTitle('year:2024')).toBeInTheDocument();
        expect(screen.queryByText(/^\+/)).not.toBeInTheDocument();
    });

    it('collapses the tail past the cap into an overflow marker', () => {
        render(
            <AttributeList
                attrs={{ a: '1', b: '2', c: '3', d: '4' }}
                max={2}
            />,
        );
        expect(screen.getByText('+2')).toBeInTheDocument();
    });

    it('opens the whole bag in the popover, not only the hidden tail', async () => {
        render(
            <AttributeList
                attrs={{ a: '1', b: '2', c: '3', d: '4' }}
                max={2}
            />,
        );
        await userEvent.click(
            screen.getByRole('button', { name: 'Show all 4 attributes' }),
        );
        const popover = await screen.findByRole('dialog');
        expect(within(popover).getByText('All attributes')).toBeInTheDocument();
    });
});
