'use client';

import { Button } from '@/components/ui/button';
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
    CommandSeparator,
} from '@/components/ui/command';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { userName } from '@/lib/bart/naming';
import { useSession } from '@/lib/session/SessionProvider';
import { cn } from '@/lib/utils';
import { Check, ChevronsUpDown } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { NewUserDialog } from './NewUserDialog';

/** There is no login, so this is the identity mechanism. Switching changes the
 *  cookie and session state only, never the route: you stay on the page and
 *  watch it become another party's view. */
export function UserSwitcher() {
    const { actingUser, users, switchTo, isLoading } = useSession();
    const [open, setOpen] = useState(false);
    const [creating, setCreating] = useState(false);

    if (isLoading)
        return (
            <div
                className="h-12 animate-pulse rounded-md bg-muted"
                aria-hidden
            />
        );

    // Past loading, a null actingUser means an empty user list, which is when
    // "New user…" below must stay reachable: no early return, only a label.
    return (
        <>
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button
                        variant="ghost"
                        className="h-auto w-full justify-start gap-2 px-2 py-2"
                    >
                        <span className="flex min-w-0 flex-col items-start">
                            <span className="truncate text-sm font-medium">
                                {actingUser ? userName(actingUser) : 'No user'}
                            </span>
                            {actingUser && (
                                <span className="font-mono text-xs text-muted-foreground">
                                    {actingUser.id.slice(0, 8)}
                                </span>
                            )}
                        </span>
                        <ChevronsUpDown className="ml-auto size-4 opacity-60" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-64 p-0">
                    <Command>
                        <CommandInput placeholder="Switch user…" />
                        <CommandList>
                            <CommandEmpty>No users.</CommandEmpty>
                            <CommandGroup>
                                {users.map(user => (
                                    <CommandItem
                                        key={user.id}
                                        value={userName(user)}
                                        onSelect={() => {
                                            switchTo(user.id);
                                            setOpen(false);
                                            // Re-selecting yourself is a no-op, not a switch.
                                            if (user.id !== actingUser?.id) {
                                                toast.success(
                                                    `You are now ${userName(user)}.`,
                                                );
                                            }
                                        }}
                                    >
                                        {/* cmdk auto-highlights the first row, so
                                    without this the wrong user looks selected.
                                    Always rendered, invisible when it does not
                                    apply, so the rows stay aligned. */}
                                        <Check
                                            className={cn(
                                                'size-4',
                                                user.id === actingUser?.id
                                                    ? 'opacity-100'
                                                    : 'opacity-0',
                                            )}
                                        />
                                        <span className="flex-1">
                                            {userName(user)}
                                        </span>
                                        <span className="font-mono text-xs text-muted-foreground">
                                            {user.id.slice(0, 8)}
                                        </span>
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                            <CommandSeparator />
                            <div className="p-1">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="w-full justify-start"
                                    onClick={() => {
                                        setOpen(false);
                                        setCreating(true);
                                    }}
                                >
                                    New user…
                                </Button>
                            </div>
                        </CommandList>
                    </Command>
                </PopoverContent>
            </Popover>
            {creating && <NewUserDialog onClose={() => setCreating(false)} />}
        </>
    );
}
