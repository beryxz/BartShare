import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ApiUser } from '@/lib/api/types';
import { userName } from '@/lib/bart/naming';
import { cn } from '@/lib/utils';

/** A user rendered as a party: who they are, and which index they occupy in
 *  the policy system. */
export function PartyRef({
    user,
    index,
    className,
}: {
    user: ApiUser;
    index?: number;
    className?: string;
}) {
    const name = userName(user);
    return (
        <span className={cn('inline-flex items-center gap-2', className)}>
            <Avatar className="size-6">
                <AvatarFallback className="text-[10px] uppercase">
                    {name.slice(0, 2)}
                </AvatarFallback>
            </Avatar>
            <span className="truncate">{name}</span>
            {index !== undefined && (
                <span className="font-mono text-xs text-party">
                    party #{index}
                </span>
            )}
        </span>
    );
}
