import { ClearFilterButton } from '@/components/states/ClearFilterButton';
import { render, screen, userEvent } from '@/test/render';
import { describe, expect, it, vi } from 'vitest';

describe('ClearFilterButton', () => {
    it('calls onClear when pressed', async () => {
        const onClear = vi.fn();
        render(<ClearFilterButton onClear={onClear} />);
        await userEvent.click(
            screen.getByRole('button', { name: 'Clear filter' }),
        );
        expect(onClear).toHaveBeenCalledOnce();
    });
});
