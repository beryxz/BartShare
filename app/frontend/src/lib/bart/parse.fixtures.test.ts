import { describe, expect, it } from 'vitest';
import { parseRule } from './parse';
import { printRule } from './rule';

/**
 * Every rule in the Java parser's own scenario corpus, transcribed verbatim,
 * spacing and all. Copied rather than read from disk, so the frontend's test
 * run stays uncoupled from a sibling Maven project's layout.
 *
 * Every one of these parsing and round-tripping into the flat exchange model
 * is the empirical case that the paper's own scenarios need no nesting the
 * block editor cannot show.
 */
const CORPUS: [string, string][] = [
    [
        'ex1 john rule 1',
        `(resource:(type:"lectureNotes")(course:"programming")(teacher:"smith")(year:"24/25"))`,
    ],
    [
        'ex1 john rule 2 (condition)',
        `(resource:(type:"exercises")(course:"programming")(year:"24/25"),
        condition:(requester.username in friends))`,
    ],
    [
        'ex1 mary rule 1 (or of two terms)',
        `(resource:(type:"lectureNotes")(course:"ads")(teacher:"doe")(year:"23/24"),
        exchange:(to:me, resource:(type:"exercises"), from:requester)
                   or (to:me, resource:(type:"lectureNotes"), from:requester))`,
    ],
    [
        'ex3 john rule 1 (single term)',
        `(resource:(type:"lectureNotes")(course:"programming")(teacher:"smith")(year:"24/25"),
        exchange:(to:me, resource:(type:"lectureNotes"),
                  from:requester))`,
    ],
    [
        'ex3 mary rule 1 (and of two quantified terms)',
        `(resource:(type:"lectureNotes")(course:"ads")(teacher:"doe")(year:"23/24"),
        exchange:(to:me,resource:(type:"lectureNotes"),from:(any:(studyLevel:"undergraduate")(degreeProgram:"cs")
                                                                 (university:"unifi")))
                  and (to:me,resource:(type:"exercises"),from:(any:(studyLevel:"undergraduate")(degreeProgram:"cs")
                                                                 (university:"unifi")))   )`,
    ],
    [
        'ex3 david rule (spaces around every colon)',
        `(resource: (type : "exercises")(course : "calculus")(teacher : "brown")(year : "23/24"))`,
    ],
    [
        'courier R1 rule 1 (bare condition, no parentheses)',
        `(resource : (type : "addrInfo")(city : "Lucca"),
          condition : requester.company = "RabbitService")`,
    ],
    [
        'courier R1 rule 2 (not(...) condition plus a term)',
        `(resource : (type : "addrInfo")(city : "Lucca"),
          condition : not(requester.company = "RabbitService"),
          exchange : (to : me,
                      resource : (type : "addrInfo")(city : "Prato"),
                      from : requester)
        )`,
    ],
    [
        'courier F-prime rule (and of two quantified terms)',
        `(resource : (type : "addrInfo")(city : "Prato"),
          exchange : (
                        to : me,
                        resource : (type : "addrInfo")(city : "Lucca"),
                        from : ( any : (service : "delivery")(company : "RabbitService"))
                     )
                     and
                     (
                        to : me,
                        resource :(type : "addrInfo")(city : "Grosseto"),
                        from : (any : (service : "delivery")(company : "RabbitService"))
                     )
         )`,
    ],
    [
        'courier R2 rule (resource only, heavily wrapped)',
        `(
                resource : (type : "addrInfo")(city : "Grosseto")
            )`,
    ],
];

describe('the paper corpus', () => {
    it.each(CORPUS)('parses %s', (_label, source) => {
        const result = parseRule(source);
        if (!result.ok) throw new Error(result.reason);
        expect(result.ast.resource).not.toEqual({});
    });

    it.each(CORPUS)('round-trips %s', (_label, source) => {
        const first = parseRule(source);
        if (!first.ok) throw new Error(first.reason);
        const second = parseRule(printRule(first.ast));
        if (!second.ok) throw new Error(second.reason);
        expect(second.ast).toEqual(first.ast);
    });

    it('reads every corpus exchange as a flat group, never as unrepresentable', () => {
        for (const [label, source] of CORPUS) {
            const result = parseRule(source);
            if (!result.ok) throw new Error(`${label}: ${result.reason}`);
            if (result.ast.exchange)
                expect(result.ast.exchange.terms.length).toBeGreaterThan(0);
        }
    });

    it('recovers the two conditions the corpus writes differently', () => {
        const bare = parseRule(CORPUS[6][1]);
        const wrapped = parseRule(CORPUS[1][1]);
        if (!bare.ok || !wrapped.ok) throw new Error('expected both to parse');
        expect(bare.ast.condition).toBe('requester.company = "RabbitService"');
        expect(wrapped.ast.condition).toBe('requester.username in friends');
    });
});
