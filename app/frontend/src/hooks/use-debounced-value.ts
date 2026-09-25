'use client';

import { useEffect, useState } from 'react';

/**
 * A value that lags behind its source by `delay`, reporting only the last of a
 * burst, so a per-keystroke input drives one network read rather than one per
 * character. The first value is reported immediately, not delayed.
 */
export function useDebouncedValue<T>(value: T, delay: number): T {
    const [settled, setSettled] = useState(value);

    useEffect(() => {
        const timer = setTimeout(() => setSettled(value), delay);
        return () => clearTimeout(timer);
    }, [value, delay]);

    return settled;
}
