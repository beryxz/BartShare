'use client';

import { Fragment } from 'react';
import { Badge } from '@/components/ui/badge';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { ApiLogEvent } from '../api';
import { eventDataPreview, eventUserLabel } from '../eventRow';

/**
 * The log, as stored. No per-type formatting on purpose: this is a developer
 * inspection view, so a row shows what is in the column rather than a sentence
 * about it.
 *
 * Expansion is owned by the caller so the page can reset it when the page
 * number changes: a row id from page 1 means nothing on page 2.
 */
export function EventLogTable({
    events,
    expanded,
    onToggle,
}: {
    events: ApiLogEvent[];
    expanded: ReadonlySet<string>;
    onToggle: (id: string) => void;
}) {
    return (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead className="w-56">Time</TableHead>
                    <TableHead className="w-48">Type</TableHead>
                    <TableHead className="w-44">User</TableHead>
                    <TableHead>Data</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {events.map(event => {
                    const user = eventUserLabel(event.userId, event.username);
                    const isOpen = expanded.has(event.id);

                    return (
                        <Fragment key={event.id}>
                            <TableRow
                                className="cursor-pointer"
                                tabIndex={0}
                                aria-expanded={isOpen}
                                onClick={() => onToggle(event.id)}
                                onKeyDown={e => {
                                    if (e.key === 'Enter') {
                                        onToggle(event.id);
                                    } else if (e.key === ' ') {
                                        e.preventDefault();
                                        onToggle(event.id);
                                    }
                                }}
                            >
                                <TableCell className="font-mono text-xs whitespace-nowrap">
                                    {event.occurred_at}
                                </TableCell>
                                <TableCell>
                                    <Badge variant="outline">
                                        {event.type}
                                    </Badge>
                                </TableCell>
                                <TableCell
                                    className={
                                        user.kind === 'user'
                                            ? 'text-sm'
                                            : 'text-sm text-muted-foreground'
                                    }
                                >
                                    {user.label}
                                </TableCell>
                                <TableCell className="max-w-0 truncate font-mono text-xs text-muted-foreground">
                                    {eventDataPreview(event.data)}
                                </TableCell>
                            </TableRow>

                            {isOpen && (
                                <TableRow className="hover:bg-transparent">
                                    <TableCell
                                        colSpan={4}
                                        className="bg-muted/40"
                                    >
                                        <pre className="overflow-x-auto font-mono text-xs whitespace-pre-wrap break-all">
                                            {JSON.stringify(
                                                {
                                                    id: event.id,
                                                    userId: event.userId,
                                                    data: event.data,
                                                },
                                                null,
                                                2,
                                            )}
                                        </pre>
                                    </TableCell>
                                </TableRow>
                            )}
                        </Fragment>
                    );
                })}
            </TableBody>
        </Table>
    );
}
