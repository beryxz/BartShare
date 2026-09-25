'use client';

import dynamic from 'next/dynamic';

export type { BartCompletion } from '@/lib/bart/monaco/providers';

/** Monaco touches `self` and the DOM at import time, so it can never be part
 *  of a server render. Lazy loading also keeps the editor bundle off every
 *  route that never opens the rule sheet. */
export const BartEditor = dynamic(
    () => import('./BartEditorImpl').then(m => m.BartEditorImpl),
    {
        ssr: false,
        loading: () => (
            <div className="h-80 animate-pulse rounded-md border bg-muted/40" />
        ),
    },
);

/** The one-line variant's own lazy wrapper, so the loading skeleton matches
 *  the field it becomes: `next/dynamic`'s `loading` cannot read props. */
export const BartExpressionEditor = dynamic(
    () => import('./BartEditorImpl').then(m => m.BartEditorImpl),
    {
        ssr: false,
        loading: () => (
            <div className="h-9 animate-pulse rounded-md border bg-muted/40" />
        ),
    },
);
