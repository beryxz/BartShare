'use client';

import { VerdictBadge } from '@/components/bart/VerdictBadge';
import { EmptyState } from '@/components/states/EmptyState';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Toggle } from '@/components/ui/toggle';
import { AccessResult } from '@/lib/api/types';
import {
    assignLanes,
    buildDiagram,
    involvedParties,
    matchedParties,
    PartyRef,
} from '@/lib/bart/diagram';
import { userName } from '@/lib/bart/naming';
import { parseTrace } from '@/lib/bart/trace';
import { useSession } from '@/lib/session/SessionProvider';
import { Highlighter, Maximize2, WrapText } from 'lucide-react';
import { useMemo, useState } from 'react';
import { DiagramLegend } from './components/diagram/DiagramLegend';
import { ExpandedTrace } from './components/ExpandedTrace';
import { PartyRoster } from './components/PartyRoster';
import { TraceDiagram } from './components/TraceDiagram';
import { TraceRaw } from './components/TraceRaw';
import { TraceTree } from './components/TraceTree';
import { showsException } from './verdict';

/**
 * `expanded` and `onExpandedChange` come as a pair or not at all: the caller
 * either owns Expand entirely or leaves `TraceViewer` to render its own.
 */
type TraceViewerProps = {
    result: AccessResult;
    title?: string;
} & (
    | { expanded?: undefined; onExpandedChange?: undefined }
    | { expanded: boolean; onExpandedChange: (expanded: boolean) => void }
);

/**
 * One shell, three renderers over one parsed model; no renderer parses the
 * trace itself. `tab`, the Tree tab's `wrap`/`tint`, `rosterOpen`, and
 * `expanded` are lifted here with the `Tabs` kept controlled, because
 * expanding re-parents and remounts the whole body: uncontrolled state would
 * snap back every time Expand is pressed. Passing `onExpandedChange` hands
 * `expanded` to the caller instead.
 */
export function TraceViewer({
    result,
    title,
    expanded: expandedProp,
    onExpandedChange,
}: TraceViewerProps) {
    const trace = result.trace;
    const { users } = useSession();
    const [tab, setTab] = useState('diagram');
    const [wrap, setWrap] = useState(false);
    const [tint, setTint] = useState(true);
    const [internalExpanded, setInternalExpanded] = useState(false);
    const [rosterOpen, setRosterOpen] = useState(false);

    const controlsExpand = onExpandedChange === undefined;
    const expanded = controlsExpand
        ? internalExpanded
        : (expandedProp ?? false);
    const setExpanded = controlsExpand ? setInternalExpanded : onExpandedChange;

    // The diagram path parses once, here, so the roster and the lanes agree
    // on one model. `TraceTree` and `TraceRaw` still parse for themselves.
    const roots = useMemo(
        () => (trace === null ? [] : parseTrace(trace)),
        [trace],
    );
    const steps = useMemo(() => buildDiagram(roots), [roots]);
    const matched = useMemo(() => matchedParties(steps), [steps]);

    // Party N is `parties[N - 1]`. A party missing from the users list is a
    // real path, not padding: the session's list is page 1 only.
    const parties = useMemo<PartyRef[]>(() => {
        const labelled = result.parties.map((id, offset) => {
            const user = users.find(candidate => candidate.id === id);
            return {
                index: offset + 1,
                id,
                label: user ? userName(user) : `Party ${offset + 1}`,
            };
        });
        return assignLanes(labelled, involvedParties(steps));
    }, [result.parties, users, steps]);

    // A function, not an element, so the inline and dialog call sites can size
    // their panels. The verdict row renders regardless of `trace`, keeping the
    // own-resource case's badge out of the `EmptyState` branch below.
    const renderBody = (expandedView: boolean) => (
        <>
            <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                    Access verdict
                </span>
                <VerdictBadge verdict={result.verdict} />
                {/* Gated on the verdict, not the message: an exception from
                    an abandoned branch beside a `permitted` badge misreads. */}
                {showsException(result) && (
                    <span className="text-xs text-verdict-error-fg">
                        {result.message}
                    </span>
                )}
            </div>
            {trace === null ? (
                <EmptyState
                    title="You own this resource"
                    description="Access to your own resources is never evaluated: the engine is not called at all, so there is no trace to show."
                />
            ) : (
                <>
                    <Tabs
                        value={tab}
                        onValueChange={setTab}
                        className="min-h-0 min-w-0 flex-1"
                    >
                        <div className="flex items-center justify-between gap-2">
                            <TabsList>
                                <TabsTrigger value="diagram">
                                    Diagram
                                </TabsTrigger>
                                <TabsTrigger value="tree">Tree</TabsTrigger>
                                <TabsTrigger value="raw">Raw trace</TabsTrigger>
                            </TabsList>
                            {tab === 'tree' && (
                                <div className="flex items-center gap-1">
                                    <Toggle
                                        variant="outline"
                                        size="sm"
                                        pressed={wrap}
                                        onPressedChange={setWrap}
                                        title="Wrap long lines"
                                    >
                                        <WrapText />
                                        Wrap
                                    </Toggle>
                                    <Toggle
                                        variant="outline"
                                        size="sm"
                                        pressed={tint}
                                        onPressedChange={setTint}
                                        title="Color rows by outcome"
                                    >
                                        <Highlighter />
                                        Highlight
                                    </Toggle>
                                </div>
                            )}
                            {tab === 'diagram' && <DiagramLegend />}
                        </div>
                        <TabsContent
                            value="diagram"
                            className="flex min-h-0 min-w-0 flex-col"
                        >
                            <TraceDiagram
                                roots={roots}
                                steps={steps}
                                parties={parties}
                                expanded={expandedView}
                            />
                        </TabsContent>
                        <TabsContent
                            value="tree"
                            className="flex min-h-0 min-w-0 flex-col"
                        >
                            <TraceTree
                                trace={trace}
                                expanded={expandedView}
                                wrap={wrap}
                                tint={tint}
                            />
                        </TabsContent>
                        <TabsContent
                            value="raw"
                            className="flex min-h-0 min-w-0 flex-col"
                        >
                            <TraceRaw trace={trace} expanded={expandedView} />
                        </TabsContent>
                    </Tabs>
                    <PartyRoster
                        parties={parties}
                        users={users}
                        matched={matched}
                        open={rosterOpen}
                        onOpenChange={setRosterOpen}
                    />
                </>
            )}
        </>
    );

    return (
        <div className="min-w-0 space-y-3">
            {controlsExpand && trace !== null && (
                <div className="flex justify-end">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setInternalExpanded(true)}
                    >
                        <Maximize2 />
                        Expand
                    </Button>
                </div>
            )}

            {renderBody(false)}

            <ExpandedTrace
                open={expanded}
                onOpenChange={setExpanded}
                title={title}
            >
                {expanded && renderBody(true)}
            </ExpandedTrace>
        </div>
    );
}
