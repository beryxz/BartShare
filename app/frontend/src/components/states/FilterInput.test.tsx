import { FilterInput } from '@/components/states/FilterInput';
import { render, screen, userEvent } from '@/test/render';
import { describe, expect, it, vi } from 'vitest';

describe('FilterInput', () => {
    it('forwards typing to onChange', async () => {
        const onChange = vi.fn();
        render(<FilterInput aria-label="Filter" onChange={onChange} />);
        await userEvent.type(
            screen.getByRole('textbox', { name: 'Filter' }),
            'ab',
        );
        expect(onChange).toHaveBeenCalledTimes(2);
    });

    it('shows the spinner only while busy, and keeps it out of the accessibility tree', () => {
        const { container, rerender } = render(
            <FilterInput aria-label="Filter" readOnly />,
        );
        expect(container.querySelector('.animate-spin')).toBeNull();

        rerender(<FilterInput aria-label="Filter" busy readOnly />);
        const spinner = container.querySelector('.animate-spin');
        expect(spinner).not.toBeNull();
        expect(spinner).toHaveAttribute('aria-hidden');
    });
});
