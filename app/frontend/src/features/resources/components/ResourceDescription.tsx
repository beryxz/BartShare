'use client';

import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { useLayoutEffect, useState } from 'react';

/**
 * A resource's description, clamped to two lines, with the full text on
 * hover only when there is more text than the clamp shows. Measured via a
 * callback ref: flipping `clamped` remounts the `<p>`, which `useRef` can't
 * track.
 *
 * `break-words` is load-bearing: without it, one unbreakable token (a pasted
 * URL) clips instead of wrapping, so `clamped` never flips true and the text
 * truncates mid-word with no tooltip to reveal it.
 */
export function ResourceDescription({ text }: { text: string }) {
    const [node, setNode] = useState<HTMLParagraphElement | null>(null);
    const [clamped, setClamped] = useState(false);

    useLayoutEffect(() => {
        if (node === null) return;

        const measure = () => setClamped(node.scrollHeight > node.clientHeight);
        measure();

        // The grid goes one column to two at `sm`: width changes without the
        // text changing, which a dependency array can't catch.
        const observer = new ResizeObserver(measure);
        observer.observe(node);
        return () => observer.disconnect();
    }, [node, text]);

    const paragraph = (
        <p
            ref={setNode}
            className="line-clamp-2 break-words text-sm text-muted-foreground"
        >
            {text}
        </p>
    );

    if (!clamped) return paragraph;

    return (
        // Set here, not inherited: the nearest provider is the sidebar's,
        // at delay 0.
        <Tooltip delayDuration={300}>
            <TooltipTrigger asChild>{paragraph}</TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-xs">
                {text}
            </TooltipContent>
        </Tooltip>
    );
}
