import { AttributeList } from '@/components/bart/AttributeList';
import { PartyRef } from '@/components/bart/PartyRef';
import { Card } from '@/components/ui/card';
import { ApiResource, ApiUser } from '@/lib/api/types';
import { resourceName } from '@/lib/bart/naming';
import { ResourceDescription } from './ResourceDescription';
import { ResourceFileBadge } from './ResourceFileBadge';

/**
 * One resource, on any of the three resource screens: header, description,
 * attributes, then a footer bar, one top-to-bottom column.
 *
 * `Card`'s own `py-6`/`gap-6` are cancelled here because this layout owns its
 * spacing: the footer bar's rule has to meet the card's edges, which the
 * default padding cannot do.
 */
export function ResourceCard({
    resource,
    owner,
    action,
    meta,
}: {
    resource: ApiResource;
    owner?: ApiUser;
    action?: React.ReactNode;
    /**
     * The footer bar's left slot, under the owner line. What the SCREEN knows
     * about this row that the card cannot work out for itself: today only
     * `ResourceCoverage`, from My Resources.
     */
    meta?: React.ReactNode;
}) {
    // `ResourceMetadata` types `description` as `string | undefined`, but the
    // wire response is never validated, so `typeof` is what confirms it.
    const description =
        typeof resource.metadata.description === 'string'
            ? resource.metadata.description.trim()
            : '';

    const hasFooter =
        owner !== undefined || meta !== undefined || action !== undefined;

    return (
        <Card className="gap-0 py-0">
            <div className="space-y-2 p-4">
                <div className="flex items-start gap-2">
                    <p className="min-w-0 flex-1 truncate font-medium">
                        {resourceName(resource)}
                    </p>
                    <ResourceFileBadge content={resource.content} />
                </div>
                {description !== '' && (
                    <ResourceDescription text={description} />
                )}
                <AttributeList attrs={resource.attrs} max={5} />
            </div>
            {hasFooter && (
                <div className="flex items-center gap-3 border-t px-4 py-2.5">
                    {/* Both stack rather than one replacing the other, so a
                        future screen passing both drops neither silently. */}
                    <div className="min-w-0 flex-1 space-y-1">
                        {owner && (
                            <PartyRef
                                user={owner}
                                className="text-xs text-muted-foreground"
                            />
                        )}
                        {meta}
                    </div>
                    {action}
                </div>
            )}
        </Card>
    );
}
