import Link from 'next/link';

/**
 * These writes feed the backend's context providers, so changing them changes
 * what the evaluator sees. The causal link is otherwise invisible on screen.
 */
export function ContextHint({ attribute }: { attribute: string }) {
    return (
        <p className="mb-4 rounded-md border border-dashed p-3 text-xs text-muted-foreground">
            This list becomes your{' '}
            <code className="font-mono text-bart-key mr-0.5">{attribute}</code>{' '}
            context attribute at evaluation time. It is public and any user can
            read it.{' '}
            <Link href="/policy" className="underline">
                See it on your policy
            </Link>
            .
        </p>
    );
}
