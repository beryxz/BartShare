import { highlight } from '@/lib/bart/highlight';
import { cn } from '@/lib/utils';

/** Read-only `.bart` with syntax colour. Highlighting only; the
 *  evaluator decides validity.
 *
 *  `names` and `groupNames` map ids to display names, shown beside
 *  the id, not instead of it.
 */
export function BartCode({
    source,
    names,
    groupNames,
    className,
}: {
    source: string;
    names?: ReadonlyMap<string, string>;
    /** Group id to display name, for a `"<id>" in requester.groups` condition. */
    groupNames?: ReadonlyMap<string, string>;
    className?: string;
}) {
    return (
        <pre
            className={cn(
                // Always renders dark, in both themes.
                'dark',
                'overflow-x-auto rounded-md border bg-muted p-3 text-foreground',
                'font-mono text-xs leading-relaxed whitespace-pre-wrap',
                className,
            )}
        >
            {highlight(source, names, groupNames).map((piece, i) => (
                <span key={i} className={piece.className}>
                    {piece.text}
                    {piece.annotation && (
                        <span className="text-muted-foreground">
                            {' '}
                            {piece.annotation}
                        </span>
                    )}
                </span>
            ))}
        </pre>
    );
}
