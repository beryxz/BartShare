import { cn } from '@/lib/utils';
import { panelHeight } from './panelHeight';

/**
 * The evaluator's trace, verbatim. Mandatory: a mistyped value in a policy
 * still returns `permitted:false`, and the actual reason exists only here.
 * Never truncate or reformat it.
 *
 * `min-w-0` is load-bearing: a grid item defaults to `min-width: auto`, so
 * without it this `<pre>` refuses to shrink below its longest line and
 * `overflow-auto` never engages.
 */
export function TraceRaw({
    trace,
    expanded = false,
}: {
    trace: string;
    expanded?: boolean;
}) {
    return (
        <pre
            className={cn(
                'min-w-0 overflow-auto rounded-md bg-muted/40 p-3 font-mono text-xs leading-relaxed',
                panelHeight(expanded),
            )}
        >
            {trace}
        </pre>
    );
}
