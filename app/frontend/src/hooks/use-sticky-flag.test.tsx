import { useStickyFlag } from '@/hooks/use-sticky-flag';
import { act, renderHook } from '@/test/render';
import { beforeEach, describe, expect, it } from 'vitest';

describe('useStickyFlag', () => {
    beforeEach(() => window.localStorage.clear());

    it('falls back when nothing is stored', () => {
        const { result } = renderHook(() => useStickyFlag('bart.wide', true));
        expect(result.current[0]).toBe(true);
    });

    it('adopts the stored value over the fallback', () => {
        window.localStorage.setItem('bart.wide', 'true');
        const { result } = renderHook(() => useStickyFlag('bart.wide', false));
        expect(result.current[0]).toBe(true);
    });

    it('reads a stored "false" as false rather than as absent', () => {
        window.localStorage.setItem('bart.wide', 'false');
        const { result } = renderHook(() => useStickyFlag('bart.wide', true));
        expect(result.current[0]).toBe(false);
    });

    it('writes through to storage on update', () => {
        const { result } = renderHook(() => useStickyFlag('bart.wide', false));
        act(() => result.current[1](true));
        expect(result.current[0]).toBe(true);
        expect(window.localStorage.getItem('bart.wide')).toBe('true');
    });

    it('re-reads when the key changes', () => {
        window.localStorage.setItem('a', 'true');
        window.localStorage.setItem('b', 'false');
        const { result, rerender } = renderHook(
            ({ key }) => useStickyFlag(key, false),
            { initialProps: { key: 'a' } },
        );
        expect(result.current[0]).toBe(true);

        rerender({ key: 'b' });
        expect(result.current[0]).toBe(false);
    });
});
