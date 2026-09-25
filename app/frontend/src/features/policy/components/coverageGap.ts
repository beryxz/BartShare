import { CoverageGap } from '@/lib/api/types';

/** Quotes each name, so a multi-word attribute key reads as one thing. */
function quoteAll(keys: string[]): string {
    return keys.map(key => `"${key}"`).join(', ');
}

/**
 * Reads a coverage gap as a sentence.
 *
 * Two lists, because they are different mistakes with different fixes: a key
 * the pattern never mentioned versus one it mentioned with the wrong value.
 * Both can be non-empty at once, and both are said.
 */
export function gapSentence(gap: CoverageGap): string {
    const parts: string[] = [];
    if (gap.missing.length > 0)
        parts.push(`also carries ${quoteAll(gap.missing)}`);
    if (gap.conflicting.length > 0)
        parts.push(`disagrees on ${quoteAll(gap.conflicting)}`);
    // `metadata.name` is optional on a resource, so the server can legitimately
    // send an empty string; the stand-in is not a name and takes no quotes.
    const subject = gap.name ? `"${gap.name}"` : 'One of your resources';
    return `${subject} ${parts.join(' and ')}.`;
}
