import { Pager } from '@/components/states/Pager';
import { render, screen, userEvent } from '@/test/render';
import { describe, expect, it, vi } from 'vitest';

describe('Pager', () => {
    it('hides itself entirely at a single page', () => {
        const { container } = render(
            <Pager page={1} total={3} totalPages={1} onPage={vi.fn()} />,
        );
        expect(container).toBeEmptyDOMElement();
    });

    it('disables Prev on the first page and Next on the last', () => {
        const { rerender } = render(
            <Pager page={1} total={30} totalPages={3} onPage={vi.fn()} />,
        );
        expect(screen.getByRole('button', { name: /prev/i })).toBeDisabled();
        expect(screen.getByRole('button', { name: /next/i })).toBeEnabled();

        rerender(<Pager page={3} total={30} totalPages={3} onPage={vi.fn()} />);
        expect(screen.getByRole('button', { name: /prev/i })).toBeEnabled();
        expect(screen.getByRole('button', { name: /next/i })).toBeDisabled();
    });

    it('steps one page in each direction', async () => {
        const onPage = vi.fn();
        render(<Pager page={2} total={30} totalPages={3} onPage={onPage} />);

        await userEvent.click(screen.getByRole('button', { name: /next/i }));
        expect(onPage).toHaveBeenCalledWith(3);

        await userEvent.click(screen.getByRole('button', { name: /prev/i }));
        expect(onPage).toHaveBeenCalledWith(1);
    });

    it('reports the server total, which tracks the active filter', () => {
        render(<Pager page={2} total={42} totalPages={5} onPage={vi.fn()} />);
        expect(screen.getByText(/Page 2 of 5/)).toBeInTheDocument();
        expect(screen.getByText(/42 results/)).toBeInTheDocument();
    });
});
