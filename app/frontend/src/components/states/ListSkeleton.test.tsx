import { ListSkeleton } from '@/components/states/ListSkeleton';
import { render } from '@/test/render';
import { describe, expect, it } from 'vitest';

describe('ListSkeleton', () => {
    it('renders the requested number of placeholder rows', () => {
        const { container } = render(<ListSkeleton rows={3} />);
        expect(
            container.querySelectorAll('[data-slot="skeleton"]'),
        ).toHaveLength(3);
    });

    it('defaults to four rows', () => {
        const { container } = render(<ListSkeleton />);
        expect(
            container.querySelectorAll('[data-slot="skeleton"]'),
        ).toHaveLength(4);
    });
});
