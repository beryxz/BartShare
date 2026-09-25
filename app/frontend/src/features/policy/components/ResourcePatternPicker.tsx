'use client';

import { AttributeList } from '@/components/bart/AttributeList';
import { ListSkeleton } from '@/components/states/ListSkeleton';
import { Button } from '@/components/ui/button';
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from '@/components/ui/command';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { useMyResources } from '@/features/resources/hooks/useResources';
import { resourceName } from '@/lib/bart/naming';
import { BartAttrs } from '@/lib/bart/types';
import { useState } from 'react';

/**
 * Fills a rule's resource pattern from one of the author's own resources.
 * Replaces the pattern rather than merging: a rule must name every attribute
 * the resource carries, so a merge of two resources covers neither.
 */
export function ResourcePatternPicker({
    onPick,
}: {
    onPick: (attrs: BartAttrs) => void;
}) {
    const [open, setOpen] = useState(false);
    // Gated on `open`: SWR's `null` key skips the fetch, so a rule sheet on
    // the Simple tab does not fire this on every mount, only on first open.
    const { data, isLoading, error } = useMyResources(
        open ? { page: 1 } : null,
    );
    const resources = data?.items ?? [];

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="shrink-0">
                    Fill from a resource…
                </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-80 p-0">
                {isLoading && (
                    <div className="p-3">
                        <ListSkeleton rows={3} />
                    </div>
                )}
                {/* Muted, not red: a failed read, not a reason a button is disabled. */}
                {!isLoading && error && (
                    <p className="p-3 text-sm text-muted-foreground">
                        Your resources could not be loaded.
                    </p>
                )}
                {!isLoading && !error && (
                    <Command>
                        <CommandInput placeholder="Search your resources…" />
                        <CommandList>
                            <CommandEmpty>
                                No resource by that name.
                            </CommandEmpty>
                            <CommandGroup>
                                {resources.map(resource => (
                                    <CommandItem
                                        key={resource.id}
                                        value={`${resourceName(resource)} ${resource.id}`}
                                        onSelect={() => {
                                            onPick(resource.attrs);
                                            setOpen(false);
                                        }}
                                        className="flex-col items-start gap-1"
                                    >
                                        <span className="truncate font-medium">
                                            {resourceName(resource)}
                                        </span>
                                        <AttributeList attrs={resource.attrs} />
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                        </CommandList>
                    </Command>
                )}
            </PopoverContent>
        </Popover>
    );
}
