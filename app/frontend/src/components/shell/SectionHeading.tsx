import { Separator } from '@/components/ui/separator';

/** A labelled divider between groups of cards within one page, as against
 *  `PageHeader`, which titles the whole route. */
export function SectionHeading({ title }: { title: string }) {
    return (
        <div className="flex items-center gap-3 pt-2">
            <h2 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                {title}
            </h2>
            <Separator className="flex-1" />
        </div>
    );
}
