'use client';

import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { Loader2Icon } from 'lucide-react';

/**
 * A filter box that can say it is busy. The spinner sits inside the field
 * because the rows stay on screen at full opacity during a refetch, so nothing
 * else is left to carry it. `className` lands on the wrapper, and `pr-8` on the
 * field is the spinner's gutter.
 */
export function FilterInput({
    busy = false,
    className,
    ...props
}: React.ComponentProps<'input'> & { busy?: boolean }) {
    return (
        <div className={cn('relative', className)}>
            <Input {...props} className="pr-8" />
            {busy && (
                <Loader2Icon
                    aria-hidden
                    className="pointer-events-none absolute top-1/2 right-2 size-4 -translate-y-1/2 animate-spin text-muted-foreground"
                />
            )}
        </div>
    );
}
