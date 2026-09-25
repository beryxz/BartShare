import { Scenario } from './types';

/**
 * Adapted from
 * `evaluator/bart-parser/src/test/resources/scenarios/ex3_multi_party_exchange.bart`.
 * Same three deviations as `ex1.ts`, same reasons.
 *
 * The reference the other two scenarios were derived from. Mary's rule is an
 * `and` over two `any`-quantified exchanges, so one request pulls in both
 * john (lecture notes) and david (exercises): the multi-party case the file
 * is named for.
 */
export const ex3: Scenario = {
    id: 'ex3',
    title: 'Multi-party exchange',
    summary:
        'Mary now wants both lecture notes and exercises in exchange for her ADS notes, from any Unifi CS undergraduate, so one request pulls in both John and David.',

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
            resource:(type:"lectureNotes"),
            from:(any:(studyLevel:"undergraduate")(degreeProgram:"cs")(university:"unifi")))
           and
           (to:me,
            resource:(type:"exercises"),
            from:(any:(studyLevel:"undergraduate")(degreeProgram:"cs")(university:"unifi")))))`,
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
            rules: [
                '(resource:(type:"exercises")(course:"calculus")(teacher:"brown")(year:"23/24"))',
            ],
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
        {
            key: 'calc',
            ownerKey: 'david',
            attrs: {
                type: 'exercises',
                course: 'calculus',
                teacher: 'brown',
                year: '23/24',
            },
            metadata: { name: 'Calculus exercises' },
            content: {
                text: 'placeholder placeholder placeholder\n',
                filename: 'calculus-exercises.txt',
            },
        },
    ],

    connections: [['john', 'david']],
};
