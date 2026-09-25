import { DiagramStep, FrameOperator } from './diagram';

/**
 * Turns `buildDiagram`'s flat marker stream into the tree the renderer draws.
 * Separate from `buildDiagram` so its trace edge cases need no restatement in
 * tree terms and this stays testable without a trace at all.
 *
 * Total by construction: an unbalanced stream is a truncated trace, not a
 * caller error, so a stray close is dropped and an open frame closes `null`.
 */

export type FrameNode = {
    kind: 'frame';
    policy: number;
    operator: FrameOperator;
    /** The rule demanding the exchange, e.g. `2.1`; the caption names it. */
    rule: string;
    outcome: boolean | null;
    children: DiagramNode[];
};

/** The divider between two operands of a composite exchange. `operator` is
 *  the enclosing frame's, so the divider can name it. */
export type SeparatorNode = { kind: 'separator'; operator: FrameOperator };

type MarkerKind = 'frame-open' | 'frame-separator' | 'frame-close';

export type DiagramNode =
    Exclude<DiagramStep, { kind: MarkerKind }> | FrameNode | SeparatorNode;

export function nest(steps: DiagramStep[]): DiagramNode[] {
    const roots: DiagramNode[] = [];
    const stack: FrameNode[] = [];

    const target = () =>
        stack.length > 0 ? stack[stack.length - 1].children : roots;

    for (const step of steps) {
        if (step.kind === 'frame-open') {
            const frame: FrameNode = {
                kind: 'frame',
                policy: step.policy,
                operator: step.operator,
                rule: step.rule,
                outcome: null,
                children: [],
            };
            target().push(frame);
            stack.push(frame);
            continue;
        }

        if (step.kind === 'frame-close') {
            const frame = stack.pop();
            if (frame) frame.outcome = step.outcome;
            continue;
        }

        if (step.kind === 'frame-separator') {
            if (stack.length > 0)
                target().push({
                    kind: 'separator',
                    operator: stack[stack.length - 1].operator,
                });
            continue;
        }

        target().push(step);
    }

    return roots;
}

/**
 * Splits a frame's children into its exchange terms, one block per operand.
 * Separators are the boundaries and are consumed; empty blocks are dropped,
 * so term numbering follows what is actually drawn.
 */
export function terms(children: DiagramNode[]): DiagramNode[][] {
    const blocks: DiagramNode[][] = [[]];
    for (const child of children) {
        if (child.kind === 'separator') blocks.push([]);
        else blocks[blocks.length - 1].push(child);
    }
    return blocks.filter(block => block.length > 0);
}
