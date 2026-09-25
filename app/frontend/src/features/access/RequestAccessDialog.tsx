'use client';

import { ResourceRef } from '@/components/bart/ResourceRef';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { triggerDownload } from '@/lib/api/content';
import { AccessResult, ApiResource } from '@/lib/api/types';
import { toastWriteError } from '@/lib/toast';
import { resourceName } from '@/lib/bart/naming';
import { downloadContent } from '@/features/resources/api';
import { Maximize2, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { requestAccess } from './api';
import { TraceViewer } from './TraceViewer';

/**
 * Opened from Explore as its own trigger, and, with `open` supplied, controlled
 * from `/shared` to explain a download that was just denied. Controlled, the
 * internal trigger is not rendered, because the caller already has one.
 */
export function RequestAccessDialog({
    resource,
    open: controlledOpen,
    onOpenChange,
}: {
    resource: ApiResource;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
}) {
    const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
    const [result, setResult] = useState<AccessResult | null>(null);
    const [failed, setFailed] = useState(false);
    const [downloading, setDownloading] = useState(false);
    const [expanded, setExpanded] = useState(false);

    const controlled = controlledOpen !== undefined;
    const open = controlled ? controlledOpen : uncontrolledOpen;

    // Bumped on close so a late-resolving `run()` from the previous open
    // can tell it no longer owns the dialog and drop its response.
    const runId = useRef(0);

    function changeOpen(next: boolean) {
        // The verdict is never stored, so it is discarded on close:
        // reopening re-evaluates, which is the point.
        if (!next) {
            runId.current++;
            setResult(null);
            setExpanded(false);
            setFailed(false);
        }
        if (controlled) onOpenChange?.(next);
        else setUncontrolledOpen(next);
    }

    const run = useCallback(async () => {
        setFailed(false);
        const id = runId.current;
        try {
            const next = await requestAccess(resource.id);
            if (runId.current !== id) return;
            setResult(next);
        } catch (error) {
            if (runId.current !== id) return;
            toastWriteError(error);
            setFailed(true);
        }
    }, [resource.id]);

    // Once per open, ref-guarded: `/shared` mounts already open, Explore
    // transitions `open`, and StrictMode doubles the effect. A deps-based
    // guard would also re-fire after a failure and retry forever.
    const ranForOpen = useRef(false);
    useEffect(() => {
        if (!open) {
            ranForOpen.current = false;
            return;
        }
        if (ranForOpen.current) return;
        ranForOpen.current = true;
        void run();
    }, [open, run]);

    async function download() {
        setDownloading(true);
        try {
            const { blob, filename } = await downloadContent(resource.id);
            triggerDownload(blob, filename ?? resourceName(resource));
        } catch (error) {
            toastWriteError(error);
        } finally {
            setDownloading(false);
        }
    }

    return (
        <Dialog open={open} onOpenChange={changeOpen}>
            {!controlled && (
                <DialogTrigger asChild>
                    <Button variant="outline" size="sm">
                        Check access
                    </Button>
                </DialogTrigger>
            )}
            {/* Width prefixed, height bare: tailwind-merge keeps both only when
                the modifiers differ, and there is no base `max-h-*` to lose to. */}
            <DialogContent
                className="max-h-[90vh] overflow-y-auto sm:max-w-4xl"
                showCloseButton={false}
            >
                <DialogHeader>
                    {/* Own close button: Expand sits beside it. */}
                    <div className="flex items-center gap-2">
                        <DialogTitle>{resourceName(resource)}</DialogTitle>
                        <div className="ml-auto flex items-center gap-1">
                            {result !== null && result.trace !== null && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setExpanded(true)}
                                >
                                    <Maximize2 />
                                    Expand
                                </Button>
                            )}
                            <DialogClose asChild>
                                <Button
                                    variant="ghost"
                                    size="icon-sm"
                                    aria-label="Close"
                                >
                                    <X />
                                </Button>
                            </DialogClose>
                        </div>
                    </div>
                </DialogHeader>

                <ResourceRef attrs={resource.attrs} />

                {result ? (
                    // This div, not `TraceViewer`'s root, is the grid item
                    // `DialogContent` sizes, so `min-w-0` starts here.
                    <div className="min-w-0 space-y-3">
                        <TraceViewer
                            result={result}
                            title={resourceName(resource)}
                            expanded={expanded}
                            onExpandedChange={setExpanded}
                        />
                        {/* A row-path permit is for this row's own description,
                            so there are bytes to fetch. Disabled rather than
                            omitted when there is no file, matching `/shared`'s
                            Open button: an absent one reads as a permit that
                            pays out nothing. */}
                        {result.verdict === 'permitted' && (
                            <div className="flex justify-end">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={
                                        downloading || resource.content === null
                                    }
                                    onClick={download}
                                >
                                    {resource.content === null
                                        ? 'No file to download'
                                        : downloading
                                          ? 'Downloading…'
                                          : `Download ${resource.content.filename ?? 'file'}`}
                                </Button>
                            </div>
                        )}
                    </div>
                ) : failed ? (
                    <Button onClick={run}>Retry</Button>
                ) : (
                    <p role="status" className="text-sm text-muted-foreground">
                        Evaluating…
                    </p>
                )}
            </DialogContent>
        </Dialog>
    );
}
