import { Scenario } from './types';

/**
 * Adapted from `evaluator/bart-parser/src/test/resources/scenarios/ex1_basic.bart`.
 *
 * Three deviations, all forced by the app's data model:
 *
 * 1. `requester.username in friends` becomes `requester.userId in
 *    connections`: no `friends` context name exists, only `connections`/`groups`.
 * 2. Phantom parties dropped: only david, of the printed friends, is an
 *    actual party; dropping the rest changes no verdict.
 * 3. Connections are mutual, unlike the printed one-way sets: david's
 *    context contains john here, where the paper gives him an empty set.
 *
 * Demonstrates: john asks for mary's ADS notes; her `or` exchange tries
 * exercises first (denied), then lecture notes, which john grants
 * unconditionally. One hop, permitted.
 */
export const ex1: Scenario = {
    id: 'ex1',
    title: 'Basic exchange',
    summary:
        "John, Mary and David. Mary trades her ADS notes for either exercises or lecture notes from whoever asks, and John's notes are free to everyone, so a request settles in one hop.",

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
                '(resource:(type:"lectureNotes")(course:"programming")(teacher:"smith")(year:"24/25"))',
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
