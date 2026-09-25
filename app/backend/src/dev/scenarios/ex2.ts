import { Scenario } from './types';

/**
 * Adapted from
 * `evaluator/bart-parser/src/test/resources/scenarios/ex2_basic_plus_cycle.bart`.
 * Same three deviations as `ex1.ts`, same reasons.
 *
 * Identical to ex1 except john's lecture-notes rule now demands lecture
 * notes back: mary asking john, and john asking mary, is the vicious circle
 * the engine breaks with its `cmpl` predicate.
 */
export const ex2: Scenario = {
    id: 'ex2',
    title: 'Exchange with a cycle',
    summary:
        'The same three parties as ex1, except John now wants lecture notes back for his own, so the engine has to break the vicious circle between Mary and John.',

    users: [
        {
            key: 'john',
            attrs: {
                username: 'john',
                studyLevel: 'undergraduate',
                degreeProgram: 'cs',
                university: 'unifi',
                enrollment: '2024',
            },
            rules: [
                `(resource:(type:"lectureNotes")(course:"programming")(teacher:"smith")(year:"24/25"),
 exchange:(to:me,
           resource:(type:"lectureNotes"),
           from:requester))`,
                `(resource:(type:"exercises")(course:"programming")(year:"24/25"),
 condition:(requester.userId in connections))`,
            ],
        },
        {
            key: 'mary',
            attrs: {
                username: 'mary',
                studyLevel: 'undergraduate',
                degreeProgram: 'cs',
                university: 'unifi',
                enrollment: '2023',
            },
            rules: [
                `(resource:(type:"lectureNotes")(course:"ads")(teacher:"doe")(year:"23/24"),
 exchange:((to:me,
            resource:(type:"exercises"),
            from:requester)
           or
           (to:me,
            resource:(type:"lectureNotes"),
            from:requester)))`,
            ],
        },
        {
            key: 'david',
            attrs: {
                username: 'david',
                studyLevel: 'undergraduate',
                degreeProgram: 'cs',
                university: 'unifi',
                enrollment: '2023',
            },
            rules: [],
        },
    ],

    resources: [
        {
            key: 'ads',
            ownerKey: 'mary',
            attrs: {
                type: 'lectureNotes',
                course: 'ads',
                teacher: 'doe',
                year: '23/24',
            },
            metadata: {
                name: 'ADS lecture notes',
                description: 'Algorithms and data structures, 23/24',
            },
            content: {
                text: 'placeholder placeholder placeholder\n',
                filename: 'ads-lecture-notes.txt',
            },
        },
        {
            key: 'prog',
            ownerKey: 'john',
            attrs: {
                type: 'lectureNotes',
                course: 'programming',
                teacher: 'smith',
                year: '24/25',
            },
            metadata: { name: 'Programming lecture notes' },
            content: {
                text: 'placeholder placeholder placeholder\n',
                filename: 'programming-lecture-notes.txt',
            },
        },
    ],

    connections: [['john', 'david']],
};
