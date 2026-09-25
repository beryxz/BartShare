/**
 * How tall a trace panel may grow: capped inline, taking what is left of the
 * dialog expanded.
 *
 * `min-h-0` is required alongside `flex-1`: a flex child defaults to
 * `min-height: auto` and would refuse to shrink below its content, overflowing
 * the dialog instead of scrolling.
 */
export function panelHeight(expanded: boolean): string {
    return expanded ? 'min-h-0 flex-1' : 'max-h-[65vh]';
}
