import { BartAttrs } from '@/lib/bart/types';

/** The backend's paginated envelope. Page numbers are 1-indexed. */
export type PageInfo = {
    size: number;
    totalElements: number;
    totalPages: number;
    number: number;
};

export type Paginated<T> = { data: T[]; page: PageInfo };

export type ApiUser = { id: string; attrs: BartAttrs; rules: string[] };

/**
 * `attrs` is the Bart request and holds policy vocabulary only: the engine
 * matches request ⊆ rule, so every key here is a demand the granting rule must
 * restate, and moving a display field in breaks every generic rule.
 */
export type ApiResource = {
    id: string;
    attrs: BartAttrs;
    metadata: ResourceMetadata;
    content: ResourceContent | null;
    user: { id: string };
};

export type ApiGroup = { id: string; name: string; description: string };

/**
 * `denied-exception` is a deny whose real cause was an exception the engine
 * swallowed, visible only in the trace text. Recovering it is best-effort, so
 * a plain `denied` is always an acceptable answer.
 */
export type AccessVerdict = 'permitted' | 'denied' | 'denied-exception';

/**
 * The evaluator's answer, inside both `GET /resources/:id/access` and
 * `POST /resources/access`. `parties` is the assembled policy system in
 * evaluation order, so index + 1 is the Bart party number a trace line names.
 */
export type AccessEvaluation = {
    parties: string[];
    requests: { requester: string; from: string; resource: BartAttrs }[];
    trace: string;
    scenario: string;
};

/**
 * `GET /resources/:id/access`. A denial is a `200` with `permitted: false`,
 * never an `ApiError`. `evaluation` is `null` when the caller owns the
 * resource, since the backend short-circuits and skips the evaluator.
 */
export type AccessResponse = {
    resourceId: string;
    permitted: boolean;
    evaluation: AccessEvaluation | null;
};

/**
 * What the UI renders. `trace` is null only on the owner short-circuit.
 * `parties` is in evaluation order, so index + 1 is the Bart party number a
 * trace line names; it is `[]` when there is no evaluation to describe.
 */
export type AccessResult = {
    verdict: AccessVerdict;
    trace: string | null;
    parties: string[];
    message?: string;
};

/**
 * Display data: never validated as Bart, never emitted into a request or rule.
 * `name` is required and non-empty at write time; everything else is free-form,
 * so extra keys must survive an edit.
 */
export type ResourceMetadata = { name: string; description?: string } & Record<
    string,
    unknown
>;

/** Metadata *about* an upload, never the bytes themselves. */
export type ResourceContent = {
    type: string;
    size: number;
    filename: string | null;
};

/**
 * `GET /me/shared`'s third key. How much of the corpus was looked at, not how
 * many evaluations succeeded, because the answer is a live evaluation per
 * candidate and the scan is capped. `truncated` means the list is incomplete.
 */
export type ScanInfo = {
    considered: number;
    total: number;
    truncated: boolean;
};

/** One attribute key and every value the corpus holds for it. */
export type Facet = { key: string; values: string[] };

/** Why a pattern covers nothing, told through the resource it came closest to. */
export type CoverageGap = {
    name: string;
    missing: string[];
    conflicting: string[];
};

export type RuleCoverageEntry = {
    count: number;
    sample: string[];
    /** Null whenever `count > 0`: a pattern that covers something owes no account. */
    nearest: CoverageGap | null;
};

/**
 * `coverage[i]` pairs with the request's `patterns[i]` BY INDEX: the server
 * never filters or reorders, so a missing entry misaligns every rule after it.
 */
export type RuleCoverageResponse = {
    total: number;
    coverage: RuleCoverageEntry[];
};

/**
 * `GET /me/context`: what the evaluator sees for the caller right now.
 *
 * `values` holds ids, never usernames, since that is what a condition matches
 * on (`requester.userId in connections`); resolving them would break it.
 * `display` is presentation only and no rule can reference it.
 */
export type ApiContext = {
    values: BartAttrs;
    display: {
        connections: { id: string; username: string }[];
        groups: { id: string; name: string }[];
    };
    names: {
        key: string;
        providedBy: string;
        description: string;
        example: string;
    }[];
};
