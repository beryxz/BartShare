import { EmptyState } from '@/components/states/EmptyState';
import {
    DiagramStep,
    lanedParties,
    PartyRef,
    searchedForParties,
} from '@/lib/bart/diagram';
import { nest } from '@/lib/bart/frames';
import { TraceNode } from '@/lib/bart/trace';
import { cn } from '@/lib/utils';
import { DiagramNodes } from './diagram/DiagramFrame';
import { panelHeight } from './panelHeight';

/** Enough room for a username and an arrow label without crushing. */
const LANE_WIDTH = 11;

/**
 * Reproduces Fig. 2 of the paper: party lanes with one arrow per request, from
 * live evaluator output. All interpretation lives in `@/lib/bart/diagram`.
 *
 * Every arrow is drawn, failed branches included: the endpoint's
 * satisfied-chain view (`evaluation.requests`) is empty on exactly the denials
 * that need explaining. No rail gutter either, so the lane track spans the
 * row's full width and `centre()` is a percentage of that.
 */
export function TraceDiagram({
    roots,
    steps,
    parties,
    expanded = false,
}: {
    roots: TraceNode[];
    steps: DiagramStep[];
    parties: PartyRef[];
    expanded?: boolean;
}) {
    const nodes = nest(steps);
    // Only these get a column. Everyone else is in the policy system without
    // the evaluation ever reaching them, and `PartyRoster` accounts for them.
    const lanes = lanedParties(parties);

    if (steps.length === 0 || parties.length === 0) {
        if (steps.length === 0 && searchedForParties(roots))
            return (
                <EmptyState
                    title="No party matched"
                    description="The request named a party pattern rather than a specific party, and nobody on the platform matched it, so the engine had no one to ask and listed no candidates. The Raw trace tab carries its own account."
                />
            );
        return (
            <EmptyState
                title="Nothing to draw"
                description="No point-to-point request could be read from this trace. The Raw trace tab always carries the evaluator's own text."
            />
        );
    }

    return (
        <div
            className={cn(
                'min-w-0 overflow-auto rounded-md border',
                panelHeight(expanded),
            )}
        >
            <div style={{ minWidth: `${5 + lanes.length * LANE_WIDTH}rem` }}>
                {/* z-10: the rows' positioned arrows and chrome come later in
                    DOM order, so without it they paint over the sticky header
                    once the list scrolls. */}
                <div className="sticky top-0 z-10 flex border-b bg-background pt-2 pb-1">
                    {lanes.map(party => (
                        <div key={party.index} className="flex-1 text-center">
                            <p className="truncate text-sm font-medium">
                                {party.label}
                            </p>
                            <p className="font-mono text-[10px] tracking-wide text-muted-foreground uppercase">
                                party {party.index}
                            </p>
                        </div>
                    ))}
                </div>
                {/* `<ul>` takes only `<li>` children, so the lifeline overlay
                    is a sibling; this `div` is the positioning context. */}
                <div className="relative">
                    {/* Lifelines, drawn once behind every row. */}
                    <span
                        aria-hidden
                        className="pointer-events-none absolute inset-0 flex"
                    >
                        {lanes.map(party => (
                            <span key={party.index} className="relative flex-1">
                                <span className="absolute inset-y-0 left-1/2 border-l border-dashed border-muted-foreground/40" />
                            </span>
                        ))}
                    </span>
                    <ul>
                        <DiagramNodes nodes={nodes} parties={parties} />
                    </ul>
                </div>
            </div>
        </div>
    );
}
