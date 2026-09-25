import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { act, renderHook } from '@/test/render';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('useDebouncedValue', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it('reports the first value immediately, without waiting for the delay', () => {
        const { result } = renderHook(() => useDebouncedValue('first', 300));
        expect(result.current).toBe('first');
    });

    it('holds the previous value until the delay elapses', () => {
        const { result, rerender } = renderHook(
            ({ value }) => useDebouncedValue(value, 300),
            { initialProps: { value: 'a' } },
        );

        rerender({ value: 'b' });
        expect(result.current).toBe('a');

        act(() => void vi.advanceTimersByTime(299));
        expect(result.current).toBe('a');

        act(() => void vi.advanceTimersByTime(1));
        expect(result.current).toBe('b');
    });

    it('reports only the last value of a burst', () => {
        const { result, rerender } = renderHook(
            ({ value }) => useDebouncedValue(value, 300),
            { initialProps: { value: 'a' } },
        );

        rerender({ value: 'b' });
        act(() => void vi.advanceTimersByTime(100));
        rerender({ value: 'c' });
        act(() => void vi.advanceTimersByTime(100));
        rerender({ value: 'd' });
        act(() => void vi.advanceTimersByTime(300));

        expect(result.current).toBe('d');
    });
});
