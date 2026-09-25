'use client';

import {
    flattenTrace,
    isErrored,
    parseTrace,
    TraceNode,
    TraceOutcome,
} from '@/lib/bart/trace';
import { cn } from '@/lib/utils';
import { panelHeight } from './panelHeight';

const KIND_LABELS: Record<TraceNode['kind'], string> = {
    request: 'request',
    policy: 'policy',
    rule: 'rule',
    exchange: 'exchange',
    connector: 'branch',
    compliance: 'cycle break',
    result: 'result',
    other: '',
};

/** Shared by every chip, so only the tone varies between them. */
const CHIP =
    'shrink-0 self-start rounded-sm border px-1.5 font-mono text-[10px]';

function Outcome({ outcome }: { outcome: TraceOutcome }) {
    if (outcome === null) return null;
    // The engine's silent deny. `error` tone rather than `deny`: the rule did
    // not refuse, it failed, the same distinction the verdict badge draws.
    if (isErrored(outcome))
        return (
            <span
                title={outcome.errored}
                className={cn(
                    CHIP,
                    'bg-verdict-error-bg text-verdict-error-fg border-verdict-error-border',
                )}
            >
                errored
            </span>
        );
    return (
        <span
            className={cn(
                CHIP,
                outcome
                    ? 'bg-verdict-permit-bg text-verdict-permit-fg border-verdict-permit-border'
                    : 'bg-verdict-deny-bg text-verdict-deny-fg border-verdict-deny-border',
            )}
        >
            {outcome ? 'true' : 'false'}
        </span>
    );
}

/**
 * The whole-row wash; the chip stays on top of it. A cycle break washes
 * amber whatever its outcome, matching the diagram's cycle arrow.
 */
function rowWash(node: TraceNode): string | null {
    if (node.kind === 'compliance') return 'bg-verdict-error-bg';
    if (node.outcome === null) return null;
    if (isErrored(node.outcome)) return 'bg-verdict-error-bg';
    return node.outcome ? 'bg-verdict-permit-bg' : 'bg-verdict-deny-bg';
}

/**
 * One row. The kind label lives in a fixed-width column at the far left,
 * *outside* the indentation: inline, its width varies with the label and pushes
 * two siblings at the same depth to different offsets.
 */
function Row({
    node,
    wrap,
    tint,
}: {
    node: TraceNode;
    wrap: boolean;
    tint: boolean;
}) {
    const wash = tint ? rowWash(node) : null;
    return (
        <li
            className={cn(
                'flex w-full items-stretch gap-2 rounded-sm py-0.5',
                wash ?? 'hover:bg-muted/60',
            )}
        >
            <span className="w-20 shrink-0 border-r pt-0.5 pr-2 text-right font-mono text-[10px] text-muted-foreground uppercase">
                {KIND_LABELS[node.kind]}
            </span>
            {/* One span per level, each drawing its own guide line. Siblings
                rather than nested, so the label column stays flush left. */}
            {Array.from({ length: node.depth }, (_, level) => (
                <span
                    key={level}
                    className="w-3 shrink-0 self-stretch border-l"
                />
            ))}
            <span
                className={cn(
                    'min-w-0 flex-1 font-mono text-xs',
                    wrap ? 'break-words' : 'whitespace-nowrap',
                )}
            >
                {node.text}
            </span>
            <Outcome outcome={node.outcome} />
        </li>
    );
}

/**
 * The recursive descent as a tree: one row per semantic clause, mirroring how
 * `Semantics` evaluates. Renders from the parsed model, so any depth or party
 * count works. `wrap`/`tint` come from `TraceViewer`, which owns the toggles.
 */
export function TraceTree({
    trace,
    expanded = false,
    wrap = true,
    tint = false,
}: {
    trace: string;
    expanded?: boolean;
    wrap?: boolean;
    tint?: boolean;
}) {
    const rows = flattenTrace(parseTrace(trace));
    return (
        <div className={cn('min-w-0 overflow-auto', panelHeight(expanded))}>
            {/* `w-max` here, not per row, lets the list outgrow the
                container and scroll; `min-w-full` then keeps a short row's
                wash spanning the full scrolled width instead of just the
                viewport. */}
            <ul className={cn(!wrap && 'w-max min-w-full')}>
                {rows.map(node => (
                    <Row key={node.id} node={node} wrap={wrap} tint={tint} />
                ))}
            </ul>
        </div>
    );
}
