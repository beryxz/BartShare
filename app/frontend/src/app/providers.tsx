'use client';

import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { SessionProvider } from '@/lib/session/SessionProvider';
import { ThemeProvider } from 'next-themes';
import { SWRConfig } from 'swr';

export function Providers({ children }: { children: React.ReactNode }) {
    return (
        // `enableSystem` off: a dark OS would otherwise contradict the light
        // default. Chrome only; the `.bart` surfaces are pinned dark in both.
        <ThemeProvider
            attribute="class"
            defaultTheme="light"
            enableSystem={false}
            disableTransitionOnChange
        >
            <SWRConfig
                value={{ revalidateOnFocus: false, shouldRetryOnError: false }}
            >
                {/* `Tooltip` needs a provider above it. `AppShell` mounts a
                    nearer one, so this `delayDuration` governs only `/`. */}
                <TooltipProvider delayDuration={300}>
                    <SessionProvider>{children}</SessionProvider>
                    <Toaster duration={8000} visibleToasts={5} />
                </TooltipProvider>
            </SWRConfig>
        </ThemeProvider>
    );
}
