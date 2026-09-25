import { TooltipProvider } from '@/components/ui/tooltip';
import {
    render as rtlRender,
    type RenderOptions,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement, ReactNode } from 'react';
import { SWRConfig } from 'swr';

/**
 * SWR's default cache is module-global, so without a fresh `provider` a key
 * written by one test resolves instantly in the next one and the second test
 * never sees a loading state.
 */
function Wrapper({ children }: { children: ReactNode }) {
    return (
        <SWRConfig
            value={{
                provider: () => new Map(),
                dedupingInterval: 0,
                revalidateOnFocus: false,
                shouldRetryOnError: false,
            }}
        >
            <TooltipProvider>{children}</TooltipProvider>
        </SWRConfig>
    );
}

export function render(
    ui: ReactElement,
    options?: Omit<RenderOptions, 'wrapper'>,
) {
    return rtlRender(ui, { wrapper: Wrapper, ...options });
}

// An explicit local export takes precedence over `export *`, so this `render`
// shadows the one re-exported below rather than colliding with it.
export * from '@testing-library/react';
export { userEvent };
