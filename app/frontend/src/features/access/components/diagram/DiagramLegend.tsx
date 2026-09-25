import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { CircleHelp } from 'lucide-react';
import { ReactNode } from 'react';
import { ARROWHEAD_LEFT, STROKE, TEXT } from './DiagramRow';

function ArrowSample({
    tone,
    mark,
    dashed,
    headless,
}: {
    tone: keyof typeof STROKE;
    mark?: string;
    dashed?: boolean;
    headless?: boolean;
}) {
    return (
        <span className="flex h-4 items-center">
            <span
                className={cn(
                    'min-w-0 flex-1 border-t-2',
                    STROKE[tone],
                    dashed && 'border-dashed',
                )}
            />
            {!headless && (
                <span
                    className={cn(
                        'h-0 w-0 border-y-6 border-y-transparent border-l-8',
                        ARROWHEAD_LEFT[tone],
                    )}
                />
            )}
            {mark && (
                <span
                    className={cn(
                        'pl-1 font-mono text-xs font-bold',
                        TEXT[tone],
                    )}
                >
                    {mark}
                </span>
            )}
        </span>
    );
}

function CandidateSample() {
    return (
        <span className="flex h-4 items-center">
            <span className="size-2.5 shrink-0 rounded-full bg-primary" />
            <span className="min-w-0 flex-1 border-t-2 border-dashed border-muted-foreground/50" />
            <span className="size-2 shrink-0 rounded-full border-2 border-muted-foreground/50 bg-background" />
            <span className="w-3 shrink-0 border-t-2 border-dashed border-muted-foreground/50" />
            <span className="size-2 shrink-0 rounded-full border-2 border-muted-foreground/50 bg-background" />
        </span>
    );
}

function ChipSample() {
    return (
        <span className="inline-block rounded-sm border border-verdict-deny-border bg-verdict-deny-bg px-1.5 font-mono text-[9px] text-verdict-deny-fg">
            condition false
        </span>
    );
}

function FrameSample() {
    return (
        <span className="relative block h-10 rounded-sm border border-l-[3px] border-verdict-permit-border bg-muted/20">
            <span className="absolute top-0 left-0 rounded-br-md border-r border-b border-verdict-permit-border bg-background px-1 font-mono text-[8px] tracking-wide uppercase">
                rule 2.1 · grants only if
            </span>
        </span>
    );
}

function BadgeSample() {
    return (
        <span className="inline-block rounded-sm border border-verdict-permit-border px-1.5 font-mono text-[9px] tracking-wide text-verdict-permit-fg uppercase">
            granted by rule 2.2
        </span>
    );
}

function PartyLaneSample() {
    return (
        <span className="flex h-10 justify-center">
            <span className="border-l border-dashed border-muted-foreground/40" />
        </span>
    );
}

/** One legend row: a fixed-width drawn sample beside its title and reading. */
function Entry({
    sample,
    title,
    children,
}: {
    sample: ReactNode;
    title: string;
    children: ReactNode;
}) {
    return (
        <div className="flex items-center gap-4">
            <span aria-hidden className="w-28 shrink-0">
                {sample}
            </span>
            <div>
                <p className="text-sm font-medium">{title}</p>
                <p className="text-sm text-muted-foreground">{children}</p>
            </div>
        </div>
    );
}

/**
 * How to read the sequence diagram, as drawn samples: the tone maps are
 * `DiagramRow`'s own, so the legend cannot show a color it does not use.
 */
export function DiagramLegend() {
    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                    <CircleHelp />
                    How to read
                </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>How to read this diagram</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                    <Entry
                        title="Request"
                        sample={
                            <span className="block space-y-1.5">
                                <ArrowSample tone="permit" mark="✓" />
                                <ArrowSample tone="deny" mark="✗" />
                                <ArrowSample tone="muted" />
                            </span>
                        }
                    >
                        the start party asks the target for a resource. Green
                        granted, red refused, grey no stated outcome.
                    </Entry>
                    <Entry
                        title="Candidate search"
                        sample={<CandidateSample />}
                    >
                        the filled dot is the searcher, hollow dots the matched
                        parties that have a lane.
                    </Entry>
                    <Entry
                        title="Cycle break"
                        sample={<ArrowSample tone="cycle" dashed mark="✓" />}
                    >
                        the request is already pending and complies, so it
                        counts as satisfied.
                    </Entry>
                    <Entry title="Refusal cause" sample={<ChipSample />}>
                        why the rule did not grant.
                    </Entry>
                    <Entry title="Granting rule" sample={<BadgeSample />}>
                        the rule that granted the request; rules tried before it
                        leave their own frames and refusal causes.
                    </Entry>
                    <Entry title="Exchange" sample={<FrameSample />}>
                        the price a rule demands. AND needs every term, OR needs
                        one.
                    </Entry>
                    <Entry title="Party lane" sample={<PartyLaneSample />}>
                        one column per party the request reached; the roster at
                        the bottom lists every party.
                    </Entry>
                </div>
            </DialogContent>
        </Dialog>
    );
}
