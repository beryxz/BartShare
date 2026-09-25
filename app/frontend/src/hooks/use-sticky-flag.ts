'use client';

import { useEffect, useState } from 'react';

/**
 * A boolean that survives a reload. The stored value is read in an effect, not
 * seeded into `useState`: `localStorage` does not exist during the server
 * render, so seeding it would mismatch. The first paint shows `fallback`.
 */
export function useStickyFlag(key: string, fallback: boolean) {
    const [value, setValue] = useState(fallback);

    useEffect(() => {
        const stored = window.localStorage.getItem(key);
        // Hydrating from an external system once per key identity, the case
        // the lint rule exists to let through.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        if (stored !== null) setValue(stored === 'true');
    }, [key]);

    function update(next: boolean) {
        setValue(next);
        window.localStorage.setItem(key, String(next));
    }

    return [value, update] as const;
}
