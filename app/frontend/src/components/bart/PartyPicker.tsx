'use client';

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
import { userName } from '@/lib/bart/naming';
import { useSession } from '@/lib/session/SessionProvider';
import { useState } from 'react';

/**
 * Picks a party by name and yields its id: `userId` is what a policy compares,
 * and a username is not a policy identifier.
 *
 * A group cannot be picked here. `AttributeMatcher` compares collections by bag
 * equality, so `(any:(groups:{"<gid>"}))` demands that group and no other; a
 * group reference belongs in a condition, `"<gid>" in requester.groups`. The
 * list is page 1 of `/users`, not the only way to name a party.
 */
export function PartyPicker({ onPick }: { onPick: (userId: string) => void }) {
    const { users } = useSession();
    const [open, setOpen] = useState(false);

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="shrink-0">
                    Name a party…
                </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-64 p-0">
                <Command>
                    <CommandInput placeholder="Search people…" />
                    <CommandList>
                        <CommandEmpty>No one by that name.</CommandEmpty>
                        <CommandGroup>
                            {users.map(user => (
                                <CommandItem
                                    key={user.id}
                                    value={`${userName(user)} ${user.id}`}
                                    onSelect={() => {
                                        onPick(user.id);
                                        setOpen(false);
                                    }}
                                >
                                    <span className="truncate">
                                        {userName(user)}
                                    </span>
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}
