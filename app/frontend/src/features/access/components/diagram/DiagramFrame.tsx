import { FrameOperator, PartyRef } from '@/lib/bart/diagram';
import { DiagramNode, FrameNode, terms } from '@/lib/bart/frames';
import { cn } from '@/lib/utils';
import { Fragment } from 'react';
import { DiagramRow } from './DiagramRow';

/**
 * Chrome inset per nesting level. Capped so pathological depth overlaps
 * borders instead of pushing the frame's rows into an unreadable sliver.
 */
const INSET_BASE = 6;
const INSET_STEP = 10;
const INSET_CAP = 5;

function frameInset(depth: number): number {
    return INSET_BASE + Math.min(depth, INSET_CAP) * INSET_STEP;
}

/** The boundary between two exchange terms, chipped with the operator it
 *  joins. A `single` stamp only arrives from a malformed stream, so it
 *  draws the plain line. `inset` must match the enclosing frame's, or the
 *  rule bleeds into the frame around it. */
function TermDivider({
    operator,
    inset,
}: {
    operator: FrameOperator;
    inset: number;
}) {
    return (
        <li
            aria-hidden
            className="relative my-4 border-t border-dashed border-muted-foreground/40"
            style={{ marginLeft: inset, marginRight: inset }}
        >
            {operator !== 'single' && (
                <span className="absolute -top-2 left-1/2 -translate-x-1/2 rounded-sm border border-muted-foreground/40 bg-background px-1.5 font-mono text-[9px] font-semibold tracking-widest text-muted-foreground uppercase">
                    {operator}
                </span>
            )}
        </li>
    );
}

/**
 * One exchange drawn as a captioned box: the price a rule demands, wrapped
 * around every row that paying it cost. UML's combined fragment.
 *
 * The chrome is absolutely positioned, takes no layout width, and insets per
 * nesting level; the rows stay full width. A frame must never inset its
 * children: lane centres are percentages of one shared track and the
 * lifelines are drawn once behind every row, so an indent pulls the arrows
 * off them once per nesting level.
 */
export function DiagramFrame({
    frame,
    parties,
    depth,
}: {
    frame: FrameNode;
    parties: PartyRef[];
    depth: number;
}) {
    const granter = parties.find(lane => lane.index === frame.policy);
    const who = granter ? granter.label : `party ${frame.policy}`;
    // A per-operator template, not one "grants only if: X" filled in: "single"
    // reads as a demand in its own right, not a condition.
    const demand = {
        and: `${who} grants only if: all terms hold`,
        or: `${who} grants only if: any term suffices`,
        single: `${who} grants only in exchange`,
    }[frame.operator];
    const caption = `rule ${frame.rule} · ${demand}`;

    const tone =
        frame.outcome === null
            ? 'border-muted-foreground/40'
            : frame.outcome
              ? 'border-verdict-permit-border'
              : 'border-verdict-deny-border';

    const inset = frameInset(depth);
    const blocks = frame.operator === 'single' ? null : terms(frame.children);

    return (
        <li className="relative pt-5 pb-1">
            <span
                aria-hidden
                className={cn(
                    'pointer-events-none absolute inset-y-0 rounded-sm border border-l-[3px] bg-muted/20',
                    tone,
                )}
                style={{ left: inset, right: inset }}
            />
            <span
                className={cn(
                    'absolute top-0 rounded-br-md border-r border-b bg-background px-2 font-mono text-[10px] tracking-wide whitespace-nowrap uppercase',
                    tone,
                )}
                style={{ left: inset + 3 }}
            >
                {caption}
            </span>
            {/* `relative` for paint order: a static `<ul>` paints before
                the `<li>`'s tint, which then washes out every row. */}
            {blocks === null ? (
                <ul className="relative">
                    <DiagramNodes
                        nodes={frame.children}
                        parties={parties}
                        depth={depth + 1}
                    />
                </ul>
            ) : (
                <ul className="relative">
                    {blocks.map((block, index) => (
                        <Fragment key={index}>
                            {index > 0 && (
                                <TermDivider
                                    operator={frame.operator}
                                    inset={inset}
                                />
                            )}
                            <li className="relative">
                                <span
                                    className="absolute top-0.5 bg-background px-1 font-mono text-[9px] tracking-wide text-muted-foreground uppercase"
                                    style={{ left: inset + 3 }}
                                >
                                    term {index + 1}
                                </span>
                                <ul className="relative">
                                    <DiagramNodes
                                        nodes={block}
                                        parties={parties}
                                        depth={depth + 1}
                                    />
                                </ul>
                            </li>
                        </Fragment>
                    ))}
                </ul>
            )}
        </li>
    );
}

/**
 * The shared walk over a node list. Exported because `TraceDiagram` renders the
 * roots with it and `DiagramFrame` its children: one recursion, so a new node
 * kind cannot be handled in one place and forgotten in the other.
 */
export function DiagramNodes({
    nodes,
    parties,
    depth = 0,
}: {
    nodes: DiagramNode[];
    parties: PartyRef[];
    /** How many frames enclose this list; a frame insets its chrome by it. */
    depth?: number;
}) {
    return nodes.map((node, index) => {
        if (node.kind === 'frame')
            return (
                <DiagramFrame
                    key={index}
                    frame={node}
                    parties={parties}
                    depth={depth}
                />
            );
        if (node.kind === 'separator')
            return (
                <TermDivider
                    key={index}
                    operator={node.operator}
                    inset={frameInset(depth - 1)}
                />
            );
        return <DiagramRow key={index} step={node} parties={parties} />;
    });
}
