'use client';

import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { AttrKind, parseAttrValue } from '@/lib/bart/attrValue';
import { cn } from '@/lib/utils';
import { useEffect, useRef, useState } from 'react';

/**
 * Value input for one attribute. A valid idle list renders as pills, one per
 * element; focus or click swaps to the plain comma-separated text, blur swaps
 * back. Scalar kinds, invalid text and empty lists render the plain input, so
 * broken text stays visible and the placeholder can show.
 */
export function AttrValueInput({
    text,
    kind,
    placeholder,
    listId,
    className,
    ariaLabel,
    onChange,
}: {
    text: string;
    kind: AttrKind;
    placeholder: string;
    listId?: string;
    className?: string;
    ariaLabel?: string;
    onChange: (text: string) => void;
}) {
    const [editing, setEditing] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const handoff = useRef(false);

    // Only the pills box arms this, so the plain input's own onFocus
    // (reached directly, no handoff) never has its caret placement overridden.
    useEffect(() => {
        if (!editing || !handoff.current) return;
        handoff.current = false;
        const input = inputRef.current;
        input?.focus();
        input?.setSelectionRange(input.value.length, input.value.length);
    }, [editing]);

    const parsed = parseAttrValue(text, kind);
    const elements =
        kind.endsWith('[]') && parsed.ok && Array.isArray(parsed.value)
            ? parsed.value
            : null;

    if (editing || elements === null || elements.length === 0) {
        return (
            <Input
                ref={inputRef}
                value={text}
                list={listId}
                placeholder={placeholder}
                className={cn('placeholder:italic', className)}
                aria-label={ariaLabel}
                onChange={e => onChange(e.target.value)}
                // Focus marks editing here too, or valid text mid-keystroke
                // would swap the input out under the caret.
                onFocus={() => setEditing(true)}
                onBlur={() => setEditing(false)}
            />
        );
    }

    return (
        <button
            type="button"
            className={cn(
                // The Input's box classes minus input-only concerns, so the
                // swap never shifts the row.
                'flex h-9 w-full min-w-0 cursor-text items-center gap-1 overflow-hidden rounded-md border border-input bg-transparent px-3 py-1 shadow-xs dark:bg-input/30',
                className,
            )}
            aria-label={ariaLabel}
            onFocus={() => {
                handoff.current = true;
                setEditing(true);
            }}
            onClick={() => {
                handoff.current = true;
                setEditing(true);
            }}
        >
            {elements.map((element, index) => (
                <Badge
                    // Index keys: elements can repeat, and any change
                    // re-renders the whole list anyway.
                    key={index}
                    variant="secondary"
                    // border-border: --secondary matches background, so only the border reads as a pill.
                    className="max-w-full rounded-sm border-border font-normal"
                >
                    <span className="truncate">{String(element)}</span>
                </Badge>
            ))}
        </button>
    );
}
