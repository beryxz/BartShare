'use client';

import Link from 'next/link';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { ApiResource } from '@/lib/api/types';
import { coveredBy } from '@/lib/bart/match';
import { PolicyRule } from '@/lib/bart/rule';

/**
 * Which of the owner's rules cover this resource, via `coveredBy` over the
 * complete rule list (`RuleCoverage` answers the inverse, server-side).
 *
 * An unreadable rule (no `pattern`) is excluded from the numerator and
 * disclosed separately, so "0 of your rules cover this" never means two things.
 */
export function ResourceCoverage({
    resource,
    rules,
}: {
    resource: ApiResource;
    rules: PolicyRule[];
}) {
    if (rules.length === 0) return null;

    const covering = rules
        .map((rule, i) => ({ rule, number: i + 1 }))
        .filter(
            ({ rule }) =>
                rule.pattern !== null &&
                coveredBy(resource.attrs, rule.pattern),
        );
    const unreadable = rules.filter(rule => rule.pattern === null).length;

    const summary = (
        <>
            {covering.length} of your {rules.length} rules cover this
        </>
    );

    if (covering.length === 0)
        return (
            <div className="space-y-1">
                <p className="text-xs text-muted-foreground">
                    {summary}
                    {unreadable > 0 &&
                        ` (${unreadable} unreadable, not counted)`}
                </p>
                {/* Only when every rule was actually checked: an unreadable
                    rule already makes the count above unknown, so a claim
                    about "no one" would assert past what was examined. */}
                {unreadable === 0 && (
                    <p className="text-xs text-muted-foreground">
                        No rule matches this resource, so no one can be granted
                        access.
                    </p>
                )}
            </div>
        );

    return (
        <Popover>
            <PopoverTrigger className="text-xs text-muted-foreground underline decoration-dotted underline-offset-2 hover:text-foreground">
                {summary}
            </PopoverTrigger>
            <PopoverContent align="start" className="w-72">
                <p className="mb-2 text-xs font-medium">
                    Rules covering this resource
                </p>
                <ul className="space-y-1">
                    {covering.map(({ number }) => (
                        <li key={number}>
                            <Link
                                href={`/policy?rule=${number}`}
                                className="font-mono text-xs underline decoration-dotted underline-offset-2 hover:text-foreground"
                            >
                                rule #{number}
                            </Link>
                        </li>
                    ))}
                </ul>
                {unreadable > 0 && (
                    <p className="mt-2 text-xs text-muted-foreground">
                        {unreadable} rule{unreadable === 1 ? '' : 's'} could not
                        be read and {unreadable === 1 ? 'is' : 'are'} not
                        counted.
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
