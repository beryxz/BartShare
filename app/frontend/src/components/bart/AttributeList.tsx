'use client';

import { BartAttrs } from '@/lib/bart/types';
import { AttributeChip } from './AttributeChip';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';

/** A bag of attributes. An empty pattern is Bart's wildcard, matching
 *  everything, so it never renders as "no attributes". Past `max` the overflow
 *  marker opens a popover over the whole bag, not the hidden tail. */
export function AttributeList({
    attrs,
    max,
}: {
    attrs: BartAttrs;
    max?: number;
}) {
    const entries = Object.entries(attrs);
    if (entries.length === 0)
        return (
            <span className="font-mono text-xs text-muted-foreground">
                any (wildcard)
            </span>
        );

    const shown = max ? entries.slice(0, max) : entries;
    const hidden = entries.length - shown.length;

    return (
        <div className="flex flex-wrap items-center gap-1">
            {shown.map(([key, value]) => (
                <AttributeChip key={key} attrKey={key} value={value} />
            ))}
            {hidden > 0 && (
                <Popover>
                    <PopoverTrigger
                        aria-label={`Show all ${entries.length} attributes`}
                        className="text-xs text-muted-foreground underline decoration-dotted underline-offset-2 hover:text-foreground"
                    >
                        +{hidden}
                    </PopoverTrigger>
                    <PopoverContent align="start" className="w-72">
                        <p className="mb-2 text-xs font-medium">
                            All attributes
                        </p>
                        <div className="flex flex-wrap items-center gap-1">
                            {entries.map(([key, value]) => (
                                <AttributeChip
                                    key={key}
                                    attrKey={key}
                                    value={value}
                                />
                            ))}
                        </div>
                    </PopoverContent>
                </Popover>
            )}
        </div>
    );
}
