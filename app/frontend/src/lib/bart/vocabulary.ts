import { AttrKind } from './attrValue';
import { BartAttrs } from './types';

/**
 * An observed attribute vocabulary: keys, each with the values seen under it.
 * Structurally identical to `Facet[]` but declared here, so `lib/bart` stays
 * independent of `lib/api`. A `Facet[]` satisfies it as-is.
 */
export type AttrVocabulary = readonly {
    key: string;
    values: readonly string[];
}[];

/** Attribute keys worth offering for `attrs`. Keys already present are dropped:
 *  Bart's `Attributes` rejects duplicates, so offering one offers an error. */
export function keySuggestions(
    vocabulary: AttrVocabulary,
    attrs: BartAttrs,
): string[] {
    return vocabulary.map(entry => entry.key).filter(key => !(key in attrs));
}

/**
 * Values worth offering under one key. Text kind only, for correctness: a
 * vocabulary value is always a string, so under `number` or `boolean` these
 * would be suggestions `parseAttrValue` rejects, and under a list kind
 * accepting one would replace every other element.
 */
export function valueSuggestions(
    vocabulary: AttrVocabulary,
    key: string,
    kind: AttrKind,
): string[] {
    if (kind !== 'text') return [];
    const entry = vocabulary.find(candidate => candidate.key === key);
    return entry ? [...entry.values] : [];
}
