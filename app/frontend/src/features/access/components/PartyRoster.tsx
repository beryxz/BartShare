'use client';

import { PartyRef } from '@/components/bart/PartyRef';
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { ApiUser } from '@/lib/api/types';
import { PartyRef as Party } from '@/lib/bart/diagram';
import { partyStatus, rosterSummary, STATUS_LABEL } from '@/lib/bart/roster';
import { ChevronRight } from 'lucide-react';

/**
 * The whole policy system, including the parties the diagram draws no lane for.
 *
 * Below the tabs rather than inside the Diagram tab because it is a legend for
 * every tab: `Tree` and `Raw trace` print bare `policy N` indexes. The summary
 * line always carries the counts, so a hidden lane is never a silent omission.
 */
export function PartyRoster({
    parties,
    users,
    matched,
    open,
    onOpenChange,
}: {
    parties: Party[];
    users: ApiUser[];
    /** `matchedParties`: which parties a candidate fan weighed, lane or not. */
    matched: Set<number>;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}) {
    if (parties.length === 0) return null;

    return (
        <Collapsible
            open={open}
            onOpenChange={onOpenChange}
            className="rounded-md border"
        >
            <CollapsibleTrigger className="group flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-xs text-muted-foreground hover:bg-muted/50">
                <ChevronRight
                    aria-hidden
                    className="size-3.5 transition-transform group-data-[state=open]:rotate-90"
                />
                Policy system · {rosterSummary(parties)}
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-3 border-t px-3 py-2">
                <ul className="space-y-1.5">
                    {parties.map(party => {
                        // Re-resolves `TraceViewer`'s lookup: that call site
                        // needs a string, `PartyRef` the whole `ApiUser`.
                        const user = users.find(
                            candidate => candidate.id === party.id,
                        );
                        return (
                            <li
                                key={party.index}
                                className="flex items-center justify-between gap-3 text-sm"
                            >
                                {/* Page 1 only, so a party may be missing;
                                    fall back to its label. */}
                                {user ? (
                                    <PartyRef
                                        user={user}
                                        index={party.index}
                                        className="min-w-0"
                                    />
                                ) : (
                                    <span className="inline-flex min-w-0 items-center gap-2">
                                        <span className="truncate">
                                            {party.label}
                                        </span>
                                        <span className="font-mono text-xs text-party">
                                            party #{party.index}
                                        </span>
                                    </span>
                                )}
                                <span className="shrink-0 font-mono text-[10px] tracking-wide text-muted-foreground uppercase">
                                    {STATUS_LABEL[partyStatus(party, matched)]}
                                </span>
                            </li>
                        );
                    })}
                </ul>
                <p className="text-xs text-muted-foreground">
                    Every party matching a pattern that any loaded policy
                    quantifies over is loaded into the policy system, whether or
                    not the request reaches them. Leaving one out could turn a
                    denial into a permit.
                </p>
            </CollapsibleContent>
        </Collapsible>
    );
}
