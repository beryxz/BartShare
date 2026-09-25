import { matches } from './matcher';
import { BartAttrs } from './types';

/** One of the caller's resources, reduced to what a coverage answer needs. */
export type CoverageResource = { id: string; name: string; attrs: BartAttrs };

/**
 * Why a pattern covers nothing, told through the resource it came closest to. `missing` and
 * `conflicting` stay apart because the fix differs: "you never mentioned `type`" versus "you
 * wrote `teacher:doe`, this resource says `brown`".
 */
export type CoverageGap = {
    name: string;
    missing: string[];
    conflicting: string[];
};

/**
 * How one resource fails a pattern. Value comparison goes through `matches` on a single-key
 * pattern, not a local `===`, so collections keep comparing as bags the way the engine does.
 */
function gapAgainst(resource: CoverageResource, pattern: BartAttrs) {
    const missing: string[] = [];
    const conflicting: string[] = [];
    let agreeing = 0;
    for (const [key, value] of Object.entries(resource.attrs)) {
        if (!(key in pattern)) missing.push(key);
        else if (!matches({ [key]: value }, pattern)) conflicting.push(key);
        else agreeing++;
    }
    return { missing, conflicting, agreeing };
}

/**
 * The resource a pattern came closest to covering, and what stood in the way. Covered
 * resources are skipped; null when there is nothing to compare against.
 *
 * Ranked by overlap (keys the pattern named that the resource also carries), then most agreed
 * on, then fewest blocking, then id ascending. Overlap has to outrank agreement: when nothing
 * agrees every candidate ties at 0, and the next tier alone picks the least descriptive
 * resource in the corpus. The id tier is arbitrary but deterministic.
 */
export function nearestGap(
    resources: CoverageResource[],
    pattern: BartAttrs,
): CoverageGap | null {
    let best: {
        gap: CoverageGap;
        overlap: number;
        agreeing: number;
        blocking: number;
        id: string;
    } | null = null;

    for (const resource of resources) {
        const { missing, conflicting, agreeing } = gapAgainst(
            resource,
            pattern,
        );
        const blocking = missing.length + conflicting.length;
        if (blocking === 0) continue;

        const candidate = {
            gap: { name: resource.name, missing, conflicting },
            overlap: agreeing + conflicting.length,
            agreeing,
            blocking,
            id: resource.id,
        };
        const better =
            best === null ||
            (candidate.overlap !== best.overlap
                ? candidate.overlap > best.overlap
                : candidate.agreeing !== best.agreeing
                  ? candidate.agreeing > best.agreeing
                  : candidate.blocking !== best.blocking
                    ? candidate.blocking < best.blocking
                    : candidate.id < best.id);
        if (better) best = candidate;
    }

    return best === null ? null : best.gap;
}
