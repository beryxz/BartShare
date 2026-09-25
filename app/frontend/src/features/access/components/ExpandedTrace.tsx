'use client';

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';

/**
 * The trace at full viewport size.
 *
 * Built on the app's `Dialog`, not a hand-rolled `fixed inset-0` overlay:
 * `DialogContent` is transformed, and a transformed ancestor makes a
 * descendant's `position: fixed` resolve against it, not the viewport, while
 * portalling to `document.body` to escape that lands outside Radix's focus
 * trap. Nesting stacks two backdrops, hidden by this panel's opaque one.
 */
export function ExpandedTrace({
    open,
    onOpenChange,
    title,
    children,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title?: string;
    children: React.ReactNode;
}) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="flex h-screen max-h-screen w-screen max-w-none flex-col gap-3 rounded-none border-0 sm:max-w-none">
                <DialogHeader>
                    <DialogTitle className="text-base">
                        {title
                            ? `Evaluation trace: ${title}`
                            : 'Evaluation trace'}
                    </DialogTitle>
                </DialogHeader>
                <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3">
                    {children}
                </div>
            </DialogContent>
        </Dialog>
    );
}
