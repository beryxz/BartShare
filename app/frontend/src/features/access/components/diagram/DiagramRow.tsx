import { resourceLabel, resourceTitle } from '@/lib/bart/attrs';
import { isLaned, laneOf, lanedParties, PartyRef } from '@/lib/bart/diagram';
import { DiagramNode } from '@/lib/bart/frames';
import { BartAttrs } from '@/lib/bart/types';
import { cn } from '@/lib/utils';

/** The border color per arrow tone; `DiagramLegend` draws samples from the same map. */
export const STROKE = {
    permit: 'border-verdict-permit-border',
    deny: 'border-verdict-deny-border',
    cycle: 'border-verdict-error-border',
    muted: 'border-muted-foreground/50',
};
/** Left-side arrowhead border color per tone; `DiagramLegend` draws samples from the same map. */
export const ARROWHEAD_LEFT = {
    permit: 'border-l-verdict-permit-border',
    deny: 'border-l-verdict-deny-border',
    cycle: 'border-l-verdict-error-border',
    muted: 'border-l-muted-foreground/50',
};
/** Right-side arrowhead border color per tone, mirroring `ARROWHEAD_LEFT`. */
export const ARROWHEAD_RIGHT = {
    permit: 'border-r-verdict-permit-border',
    deny: 'border-r-verdict-deny-border',
    cycle: 'border-r-verdict-error-border',
    muted: 'border-r-muted-foreground/50',
};
/** The text color per arrow tone; `DiagramLegend` draws samples from the same map. */
export const TEXT = {
    permit: 'text-verdict-permit-fg',
    deny: 'text-verdict-deny-fg',
    cycle: 'text-verdict-error-fg',
    muted: 'text-muted-foreground',
};

/**
 * Lane centres are evenly spaced, so party N sits at (N - 0.5) / count.
 *
 * Must agree with `LANE_WIDTH` and the equal-width lane track in
 * `TraceDiagram.tsx`: arrows are positioned as percentages of that track, the
 * lifelines by a separate flex overlay.
 */
function centre(index: number, count: number): number {
    return ((index - 0.5) / count) * 100;
}

/**
 * The arrow rule sits at `top: RULE_TOP` and is 2px thick, so its visual centre
 * is one pixel lower. Anything meant to sit *on* the line derives from
 * `RULE_CENTRE`.
 */
const RULE_TOP = 36;
const RULE_CENTRE = RULE_TOP + 1;
const DOT_SIZE = 8;
const DOT_TOP = RULE_CENTRE - DOT_SIZE / 2;
/**
 * The filled dot marking who issued a candidate search, larger than the hollow
 * candidate dots, hence its own size/offset pair rather than
 * `DOT_SIZE`/`DOT_TOP`.
 */
const ORIGIN_DOT_SIZE = 10;
const ORIGIN_DOT_TOP = RULE_CENTRE - ORIGIN_DOT_SIZE / 2;
/**
 * The cause chip does not fit between `RULE_TOP` and the row's top edge:
 * `Arrow`'s own label sits just above `RULE_TOP` and leaves a couple of px at
 * best. Padding buys nothing, since an absolute `top` is measured from the
 * containing block's padding box. A cause-bearing row moves the arrow down
 * inside a taller row instead, and label, mark and arrowhead, all positioned
 * relative to the arrow's box, move down with it.
 */
const CAUSE_ARROW_TOP = RULE_TOP + 24;
/** The chip's margin off the row's top edge; the arrow moved down for it. */
const CAUSE_TOP = 8;

/**
 * One horizontal arrow between two lanes. Direction decides which end carries
 * the head, so `from` and `to` are ordered here rather than by the caller.
 *
 * Both are **lane positions**, not party indexes: callers resolve through
 * `laneOf` first.
 */
function Arrow({
    from,
    to,
    count,
    tone,
    label,
    title,
    mark,
    dashed,
    badge,
    headless,
    top = RULE_TOP,
}: {
    /** Lane positions, not party indexes. */
    from: number;
    to: number;
    count: number;
    tone: 'permit' | 'deny' | 'cycle' | 'muted';
    label: string;
    title: string;
    mark?: string;
    dashed?: boolean;
    badge?: string;
    headless?: boolean;
    /**
     * Where the rule sits, for a caller needing the arrow and everything
     * relative to it to move within a taller row. Defaults to the shared
     * `RULE_TOP`.
     */
    top?: number;
}) {
    const start = centre(Math.min(from, to), count);
    const end = centre(Math.max(from, to), count);
    const rightwards = to > from;
    const stroke = STROKE[tone];
    const text = TEXT[tone];

    return (
        <span
            className={cn(
                'absolute border-t-2',
                stroke,
                dashed && 'border-dashed',
            )}
            style={{
                left: `${start}%`,
                width: `${end - start}%`,
                top,
            }}
        >
            {/* `w-max` (not `auto`) because with only `left` set, the browser's
                shrink-to-fit sizes the box from `left` to the containing
                block's edge, half the arrow, silently truncating long labels. */}
            <span
                title={title}
                className="absolute bottom-1 left-1/2 w-max max-w-full -translate-x-1/2 line-clamp-2 bg-background px-1.5 text-center font-mono text-[11px]"
            >
                {label}
            </span>
            {badge && (
                <span
                    className={cn(
                        'absolute top-3 left-1/2 -translate-x-1/2 rounded-sm border px-1.5 font-mono text-[9px] tracking-wide whitespace-nowrap uppercase',
                        stroke,
                        text,
                    )}
                >
                    {badge}
                </span>
            )}
            {!headless && (
                <span
                    aria-hidden
                    className={cn(
                        'absolute -top-[7px] h-0 w-0 border-y-6 border-y-transparent',
                        rightwards ? 'right-0 border-l-8' : 'left-0 border-r-8',
                        ARROWHEAD_LEFT[tone],
                        ARROWHEAD_RIGHT[tone],
                    )}
                />
            )}
            {mark && (
                <span
                    className={cn(
                        'absolute -top-3 font-mono text-xs font-bold',
                        text,
                        rightwards ? '-right-5' : '-left-5',
                    )}
                >
                    {mark}
                </span>
            )}
        </span>
    );
}

/**
 * A candidate run with no reach to draw. A single-lane arrow would be
 * zero-width and collapse its own label, so the row says it in words.
 */
function CandidateNote({ text, title }: { text: string; title: string }) {
    return (
        <li className="flex">
            <span className="flex h-14 flex-1 items-center justify-center">
                <span
                    title={title}
                    className="line-clamp-2 bg-background px-2 text-center font-mono text-[11px] text-muted-foreground"
                >
                    {text}
                </span>
            </span>
        </li>
    );
}

/**
 * The row path always asks `from:(any:(userId:<owner>))`, so the root fan's
 * pattern is a bare id and unreadable. Resolve that one to the lane's label;
 * any other reads fine by value.
 */
function patternLabel(pattern: BartAttrs, parties: PartyRef[]): string {
    const keys = Object.keys(pattern);
    if (keys.length === 1 && keys[0] === 'userId') {
        const party = parties.find(lane => lane.id === pattern.userId);
        if (party) return party.label;
    }
    return resourceLabel(pattern);
}

/**
 * `nest()` consumes the frame-marker kinds into `FrameNode`/`SeparatorNode`
 * before a node list reaches this component, so this excludes them rather than
 * switching on them.
 */
type DiagramRowStep = Exclude<DiagramNode, { kind: 'frame' | 'separator' }>;

export function DiagramRow({
    step,
    parties,
}: {
    step: DiagramRowStep;
    parties: PartyRef[];
}) {
    const count = lanedParties(parties).length;

    if (step.kind === 'candidates') {
        const opener = `${step.quantifier}: ${patternLabel(step.pattern, parties)}`;
        const title = resourceTitle(step.pattern);

        // Nothing matched at all: an ordinary denial, and the fan has no
        // endpoints of any kind.
        if (step.matched.length === 0)
            return (
                <CandidateNote
                    title={title}
                    text={`${opener}; no party matched`}
                />
            );

        // A match with no lane was weighed and never asked, so it has no
        // column to carry a dot; the label reports the shortfall instead.
        const shown = step.matched.filter(index => isLaned(parties, index));
        // The engine drops pairs where `from == to` (`differentIndexes`), so a
        // party can match the pattern and still never be asked.
        const excluded = step.matched.includes(step.from);
        const asked = shown.filter(index => index !== step.from);
        const who = parties.find(lane => lane.index === step.from);
        // `CandidateNote` draws nothing at all, so its row's count is 0
        // regardless of how many matches hold a lane.
        const drawn = asked.length === 0 ? 0 : shown.length;
        const hidden =
            drawn === step.matched.length
                ? ''
                : `, ${drawn === 0 ? 'none' : drawn} shown`;
        const label =
            `${opener}; ${step.matched.length} matched${hidden}` +
            (excluded
                ? ` · ${who ? who.label : `party ${step.from}`} excluded (cannot trade with itself)`
                : '');

        if (asked.length === 0)
            return <CandidateNote title={title} text={label} />;

        const reach = [step.from, ...asked];
        return (
            <li className="flex">
                <span className="relative h-20 flex-1">
                    {/* No head: a candidate search is not a message, and a head
                        would point at the right-most lane. */}
                    <Arrow
                        from={Math.min(...reach.map(i => laneOf(parties, i)))}
                        to={Math.max(...reach.map(i => laneOf(parties, i)))}
                        count={count}
                        tone="muted"
                        dashed
                        headless
                        label={label}
                        title={title}
                    />
                    {asked.map(index => (
                        <span
                            key={index}
                            className="absolute -translate-x-1/2 rounded-full border-2 border-muted-foreground/50 bg-background"
                            style={{
                                left: `${centre(laneOf(parties, index), count)}%`,
                                top: DOT_TOP,
                                width: DOT_SIZE,
                                height: DOT_SIZE,
                            }}
                        />
                    ))}
                    {/* The excluded party gets no dot: it is the searching
                        party, so its dot sits under the origin dot below. */}
                    <span
                        aria-hidden
                        className="absolute -translate-x-1/2 rounded-full bg-primary"
                        style={{
                            left: `${centre(laneOf(parties, step.from), count)}%`,
                            top: ORIGIN_DOT_TOP,
                            width: ORIGIN_DOT_SIZE,
                            height: ORIGIN_DOT_SIZE,
                        }}
                    />
                </span>
            </li>
        );
    }

    if (step.kind === 'cycle')
        return (
            <li className="flex">
                <span className="relative h-20 flex-1">
                    <Arrow
                        from={laneOf(parties, step.from)}
                        to={laneOf(parties, step.to)}
                        count={count}
                        tone="cycle"
                        dashed
                        mark="✓"
                        badge="⟲ cycle break · already pending, complies"
                        label={resourceLabel(step.resource)}
                        title={resourceTitle(step.resource)}
                    />
                </span>
            </li>
        );

    return (
        <li className="flex">
            {/* A rule badge hangs below the arrow, so its row needs the extra
                height the cause rows already have. */}
            <span
                className={cn(
                    'relative flex-1',
                    step.cause ? 'h-28' : step.grantedBy ? 'h-20' : 'h-14',
                )}
            >
                <Arrow
                    from={laneOf(parties, step.from)}
                    to={laneOf(parties, step.to)}
                    count={count}
                    tone={
                        step.outcome === null
                            ? 'muted'
                            : step.outcome
                              ? 'permit'
                              : 'deny'
                    }
                    mark={
                        step.outcome === null
                            ? undefined
                            : step.outcome
                              ? '✓'
                              : '✗'
                    }
                    badge={
                        step.grantedBy
                            ? `granted by rule ${step.grantedBy}`
                            : undefined
                    }
                    label={resourceLabel(step.resource)}
                    title={resourceTitle(step.resource)}
                    top={step.cause ? CAUSE_ARROW_TOP : undefined}
                />
                {/* A green arrow gets a chip only for `warn`, a vacuous grant.
                    `left` is the arrow's midpoint, not the row's. */}
                {step.cause && (
                    <span
                        title={step.cause.text}
                        className={cn(
                            'absolute -translate-x-1/2 rounded-sm border px-1.5 font-mono text-[9px] tracking-wide whitespace-nowrap',
                            step.cause.tone === 'warn'
                                ? 'border-verdict-error-border bg-verdict-error-bg text-verdict-error-fg'
                                : 'border-verdict-deny-border bg-verdict-deny-bg text-verdict-deny-fg',
                        )}
                        style={{
                            left: `${(centre(laneOf(parties, step.from), count) + centre(laneOf(parties, step.to), count)) / 2}%`,
                            top: CAUSE_TOP,
                        }}
                    >
                        {step.cause.text}
                    </span>
                )}
            </span>
        </li>
    );
}
