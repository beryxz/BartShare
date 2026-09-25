'use client';

import { Button } from '@/components/ui/button';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';

/**
 * Light/dark for the app chrome, light on first load and with no "system"
 * option. next-themes resolves the theme from localStorage only after
 * hydration, so the `mounted` gate stops the server committing to the wrong
 * icon; the placeholder holds the height so the sidebar footer does not reflow.
 */
export function ThemeToggle() {
    const { resolvedTheme, setTheme } = useTheme();
    const [mounted, setMounted] = useState(false);
    // A plain mount gate, reading nothing external, which the rule cannot tell
    // from the external-store case it lets through.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    useEffect(() => setMounted(true), []);

    if (!mounted) return <div className="h-8" />;

    const dark = resolvedTheme === 'dark';
    return (
        <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start"
            onClick={() => setTheme(dark ? 'light' : 'dark')}
        >
            {dark ? <Sun /> : <Moon />}
            <span>{dark ? 'Light mode' : 'Dark mode'}</span>
        </Button>
    );
}
