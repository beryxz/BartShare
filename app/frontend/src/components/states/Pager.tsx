'use client';

import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/** The list footer: position, total, and one step in each direction. Hidden
 *  entirely at a single page. `total` is the server's filtered count, so it
 *  tracks the active filter, not the corpus. */
export function Pager({
    page,
    total,
    totalPages,
    onPage,
}: {
    page: number;
    total: number;
    totalPages: number;
    onPage: (page: number) => void;
}) {
    if (totalPages <= 1) return null;

    return (
        <div className="mt-4 flex items-center justify-center gap-3">
            <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => onPage(page - 1)}
            >
                <ChevronLeft />
                Prev
            </Button>
            <span className="text-xs text-muted-foreground">
                Page {page} of {totalPages} · {total} results
            </span>
            <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => onPage(page + 1)}
            >
                Next
                <ChevronRight />
            </Button>
        </div>
    );
}
