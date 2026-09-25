import { BartAttrs } from '@/lib/bart/types';
import { AttributeList } from './AttributeList';

/** A resource as it appears inside a request: an attribute pattern, nothing more. */
export function ResourceRef({ attrs }: { attrs: BartAttrs }) {
    return (
        <span className="inline-flex items-center gap-1.5">
            <span className="font-mono text-xs text-muted-foreground">
                resource
            </span>
            <AttributeList attrs={attrs} max={4} />
        </span>
    );
}
