import { ErrorState } from '@/components/states/ErrorState';
import { ApiError } from '@/lib/api/client';
import { render, screen, userEvent } from '@/test/render';
import { describe, expect, it, vi } from 'vitest';

describe('ErrorState', () => {
    it('titles a 503 as the evaluator being unavailable', () => {
        render(<ErrorState error={new ApiError(503, ['upstream timeout'])} />);
        expect(screen.getByText('Evaluator unavailable')).toBeInTheDocument();
        expect(screen.getByText('upstream timeout')).toBeInTheDocument();
    });

    it('titles a 500 as a stored policy being invalid', () => {
        render(<ErrorState error={new ApiError(500, ['rule 2 is invalid'])} />);
        expect(
            screen.getByText('A stored policy is invalid'),
        ).toBeInTheDocument();
    });

    it('falls back to a generic title for an unmapped status', () => {
        render(<ErrorState error={new ApiError(418, ['teapot'])} />);
        expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    });

    it('reads a plain Error through its message', () => {
        render(<ErrorState error={new Error('network down')} />);
        expect(screen.getByText('Something went wrong')).toBeInTheDocument();
        expect(screen.getByText('network down')).toBeInTheDocument();
    });

    it('stringifies a thrown non-Error', () => {
        render(<ErrorState error="just a string" />);
        expect(screen.getByText('just a string')).toBeInTheDocument();
    });

    it('joins several messages into one detail line', () => {
        render(<ErrorState error={new ApiError(400, ['first', 'second'])} />);
        expect(screen.getByText('first second')).toBeInTheDocument();
    });

    it('offers retry only when given a handler', async () => {
        const onRetry = vi.fn();
        const { rerender } = render(<ErrorState error={new Error('x')} />);
        expect(
            screen.queryByRole('button', { name: 'Try again' }),
        ).not.toBeInTheDocument();

        rerender(<ErrorState error={new Error('x')} onRetry={onRetry} />);
        await userEvent.click(
            screen.getByRole('button', { name: 'Try again' }),
        );
        expect(onRetry).toHaveBeenCalledOnce();
    });
});
