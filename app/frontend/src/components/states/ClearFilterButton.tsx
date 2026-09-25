import { Button } from '@/components/ui/button';

/** The action every "nothing matches your filter" empty state offers. Only the
 *  mechanical half is shared; the copy stays written out at each call site. */
export function ClearFilterButton({ onClear }: { onClear: () => void }) {
    return (
        <Button variant="outline" size="sm" onClick={onClear}>
            Clear filter
        </Button>
    );
}
