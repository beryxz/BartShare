import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterAll, afterEach, beforeAll } from 'vitest';
import { server } from './server';

/**
 * jsdom implements none of these, and Radix reads every one of them while
 * opening a layer: a missing method throws rather than degrading, so a Select
 * or Popover test fails on the stub rather than on its own assertion.
 */
function installDomStubs() {
    window.matchMedia = (query: string) =>
        ({
            matches: false,
            media: query,
            onchange: null,
            addEventListener: () => {},
            removeEventListener: () => {},
            addListener: () => {},
            removeListener: () => {},
            dispatchEvent: () => false,
        }) as unknown as MediaQueryList;

    window.ResizeObserver = class {
        observe() {}
        unobserve() {}
        disconnect() {}
    } as unknown as typeof ResizeObserver;

    Element.prototype.scrollIntoView = () => {};
    Element.prototype.hasPointerCapture = () => false;
    Element.prototype.setPointerCapture = () => {};
    Element.prototype.releasePointerCapture = () => {};

    if (!window.localStorage) {
        /*
         * This Vitest jsdom environment exposes no `localStorage`, so any
         * component that reads a persisted flag needs this stub.
         */
        const store: { [key: string]: string } = {};
        window.localStorage = {
            getItem: (key: string) => store[key] ?? null,
            setItem: (key: string, value: string) => {
                store[key] = value;
            },
            removeItem: (key: string) => {
                delete store[key];
            },
            clear: () => {
                for (const key in store) delete store[key];
            },
            key: (index: number) => {
                const keys = Object.keys(store);
                return keys[index] ?? null;
            },
            get length() {
                return Object.keys(store).length;
            },
        } as Storage;
    }
}

beforeAll(installDomStubs);
afterEach(cleanup);

// Clears the acting-user cookie a test may have set, so the next test starts
// with no session rather than inheriting one.
afterEach(() => {
    document.cookie = 'user=; Max-Age=0; path=/';
});

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
