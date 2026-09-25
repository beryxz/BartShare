'use client';

import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { RuleCoverageEntry } from '@/lib/api/types';
import { cn } from '@/lib/utils';
import { gapSentence } from './coverageGap';

/**
 * How many of the author's own resources this rule's pattern covers.
 *
 * "Covers", never "shares": a pattern match is necessary, not sufficient, and
 * the condition and exchange still decide. `entry` is undefined for a rule with
 * no `pattern`, meaning the text failed to parse at all, so it shows a dash
 * rather than a 0 it cannot claim. `entry.sample` is capped at 20 names
 * server-side, hence the "…and N more" line.
 */
export function RuleCoverage({
    entry,
    total,
    hideWhenEmpty = false,
    emphasis = false,
}: {
    entry: RuleCoverageEntry | undefined;
    total: number;
    /** The editor draws nothing before a pattern exists; a saved card always
     *  draws its count. See `usePatternCoverage`. */
    hideWhenEmpty?: boolean;
    /**
     * Renders the summary line larger and in the foreground colour. Set by the
     * editor, where the count has to be noticed while a pattern is still being
     * chosen.
     */
    emphasis?: boolean;
}) {
    if (total === 0) return null;
    if (hideWhenEmpty && !entry) return null;

    const summaryClass = emphasis
        ? 'text-sm font-medium text-foreground'
        : 'text-xs text-muted-foreground';

    if (!entry)
        return (
            <p className={summaryClass}>
                covers <span className="font-mono">–</span> of your {total}{' '}
                resources
            </p>
        );

    const summary = (
        <>
            covers {entry.count} of your {total} resources
        </>
    );

    if (entry.count === 0)
        return (
            <div className="space-y-1">
                <p className={summaryClass}>{summary}</p>
                {/* The direction is the trap: a rule must name every attribute
                    the resource carries, so a SHORTER pattern is narrower. */}
                {entry.nearest && (
                    <p className="text-xs text-muted-foreground">
                        {gapSentence(entry.nearest)}
                        {/* A non-sequitur on a conflict-only gap, where
                            the mistake is a value, not a missing key. */}
                        {entry.nearest.missing.length > 0 &&
                            ' A rule must name every attribute a resource carries.'}
                    </p>
                )}
            </div>
        );

    return (
        <Popover>
            <PopoverTrigger
                className={cn(
                    summaryClass,
                    'underline decoration-dotted underline-offset-2 hover:text-foreground',
                )}
            >
                {summary}
            </PopoverTrigger>
            <PopoverContent align="start" className="w-72">
                <p className="mb-2 text-xs font-medium">Covered by this rule</p>
                <ul className="space-y-1">
                    {entry.sample.map(name => (
                        <li key={name} className="truncate text-xs">
                            {name}
                        </li>
                    ))}
                </ul>
                {entry.count > entry.sample.length && (
                    <p className="mt-2 text-xs text-muted-foreground">
                        …and {entry.count - entry.sample.length} more.
                    </p>
                )}
                <p className="mt-2 text-xs text-muted-foreground">
                    Matching the pattern is not the whole answer: the condition
                    and exchange still decide.
                </p>
            </PopoverContent>
        </Popover>
    );
}
