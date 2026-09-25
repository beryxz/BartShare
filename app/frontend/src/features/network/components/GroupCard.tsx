'use client';

import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ApiGroup } from '@/lib/api/types';
import { useState } from 'react';
import { GroupValues } from '../api';
import { GroupFormDialog } from './GroupFormDialog';

/**
 * One row. The primary button changes whether *I* am in the group; the `⋯`
 * menu changes it for everyone, since membership is open. Delete stays out
 * of the button strip so it never sits beside Leave, the misclick the
 * confirmation guards against. Both dialogs render outside the menu: a Radix
 * dropdown item cannot contain the dialog it opens, since closing the menu
 * unmounts children first.
 */
export function GroupCard({
    group,
    joined,
    busy,
    onToggle,
    onUpdate,
    onDelete,
}: {
    group: ApiGroup;
    joined: boolean;
    busy: boolean;
    onToggle: () => void;
    onUpdate: (values: GroupValues) => Promise<void>;
    onDelete: () => void;
}) {
    const [editing, setEditing] = useState(false);
    const [confirming, setConfirming] = useState(false);

    return (
        <Card>
            <CardContent className="flex items-center gap-3 p-3">
                <div className="min-w-0 flex-1">
                    <p className="font-mono text-sm">{group.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                        {group.description}
                    </p>
                </div>
                <Button
                    variant={joined ? 'outline' : 'default'}
                    size="sm"
                    disabled={busy}
                    onClick={onToggle}
                >
                    {joined ? 'Leave' : 'Join'}
                </Button>
                {/* Gated on `joined`: a capped membership walk reads falsely
                    false, never falsely true; the page discloses the cap. */}
                {joined && (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                variant="ghost"
                                size="sm"
                                disabled={busy}
                                aria-label={`Manage ${group.name}`}
                            >
                                ⋯
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onSelect={() => setEditing(true)}>
                                Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                variant="destructive"
                                onSelect={() => setConfirming(true)}
                            >
                                Delete
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                )}
            </CardContent>

            {editing && (
                <GroupFormDialog
                    group={group}
                    onClose={() => setEditing(false)}
                    onSubmit={onUpdate}
                />
            )}

            <AlertDialog open={confirming} onOpenChange={setConfirming}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            Delete {group.name}?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            This deletes the group for everyone in it, not just
                            you, and it cannot be undone. To remove only
                            yourself, close this and use Leave instead.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => {
                                setConfirming(false);
                                onDelete();
                            }}
                        >
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </Card>
    );
}
