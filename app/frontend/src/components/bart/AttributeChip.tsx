import { formatValue } from '@/lib/bart/format';
import { BartValue } from '@/lib/bart/types';
import { cn } from '@/lib/utils';

/** One `key:value` pair. `(k:"v")` and `(k:{"v"})` are different values in the
 *  grammar, so a chip never flattens a one-element set into a scalar. */
export function AttributeChip({
    attrKey,
    value,
    className,
}: {
    attrKey: string;
    value: BartValue;
    className?: string;
}) {
    return (
        <span
            className={cn(
                'inline-flex max-w-full items-center gap-1 rounded-sm border',
                'border-border bg-muted/50 px-1.5 py-0.5 font-mono text-xs',
                className,
            )}
            title={`${attrKey}:${formatValue(value)}`}
        >
            <span className="text-bart-key">{attrKey}</span>
            <span className="text-muted-foreground">:</span>
            <span className="truncate text-bart-string">
                {formatValue(value)}
            </span>
        </span>
    );
}
