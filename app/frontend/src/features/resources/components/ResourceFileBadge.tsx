import { Badge } from '@/components/ui/badge';
import { ApiResource } from '@/lib/api/types';
import { fileTypeLabel, formatBytes } from '@/lib/format';

/**
 * What, if anything, is attached to a resource. Always renders something:
 * "no badge" would read as "unknown" rather than "nothing attached".
 *
 * The filename is not in the label (it is often a near-duplicate of the
 * resource name and would make the column ragged), but rides along as the
 * `title`.
 */
export function ResourceFileBadge({
    content,
}: {
    content: ApiResource['content'];
}) {
    if (content === null)
        return (
            <Badge variant="outline" className="text-muted-foreground">
                No file
            </Badge>
        );

    return (
        <Badge variant="outline" title={content.filename ?? undefined}>
            {fileTypeLabel(content.type, content.filename)} ·{' '}
            {formatBytes(content.size)}
        </Badge>
    );
}
