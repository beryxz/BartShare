import { Scenario } from './types';

/** The class group. Quoted verbatim by the teacher's conditions, so it is fixed, not generated. */
const CLASS_GROUP = '7c1f3a52-9b4e-4d61-8f0a-2b6c5d9e4a13';

/**
 * Not paper-derived, unlike ex1 to ex3: this one exercises groups, which the
 * printed examples never use.
 *
 * A teacher hands the test paper to the class, and the solutions only once
 * every student has granted their own submission back. The group gates who may
 * ask, in the condition; the exchange quantifies over party attributes, since
 * `all:` cannot reach context.
 *
 * Seeded so every student already grants, hence the permit. Removing one
 * student's rule denies the whole class, and so does adding a party carrying
 * the same attributes and granting nothing.
 */
export const ex4: Scenario = {
    id: 'ex4',
    title: 'Group-gated exchange',
    summary:
        'A teacher and three students in one class group. The test paper goes to anyone in the group; the solutions only once every student in the class has granted their own submission in exchange.',

    users: [
        {
            key: 'prof',
            attrs: {
                username: 'prof.rossi',
                role: 'teacher',
                course: 'systemDesign',
                year: '25/26',
            },
            rules: [
                `(resource:(type:"testPaper")(course:"systemDesign")(term:"1")(year:"25/26"),
 condition:("${CLASS_GROUP}" in requester.groups))`,
                `(resource:(type:"solutions")(course:"systemDesign")(term:"1")(year:"25/26"),
 condition:("${CLASS_GROUP}" in requester.groups),
 exchange:(to:me,
           resource:(type:"submission")(course:"systemDesign")(term:"1")(year:"25/26"),
           from:(all:(role:"student")(course:"systemDesign")(year:"25/26"))))`,
            ],
        },
        {
            key: 'alice',
            attrs: {
                username: 'alice',
                role: 'student',
                course: 'systemDesign',
                year: '25/26',
            },
            rules: [
                `(resource:(type:"submission")(course:"systemDesign")(term:"1")(year:"25/26"),
 condition:(requester.role = "teacher"))`,
            ],
        },
        {
            key: 'bruno',
            attrs: {
                username: 'bruno',
                role: 'student',
                course: 'systemDesign',
                year: '25/26',
            },
            rules: [
                `(resource:(type:"submission")(course:"systemDesign")(term:"1")(year:"25/26"),
 condition:(requester.role = "teacher"))`,
            ],
        },
        {
            key: 'chiara',
            attrs: {
                username: 'chiara',
                role: 'student',
                course: 'systemDesign',
                year: '25/26',
            },
            rules: [
                `(resource:(type:"submission")(course:"systemDesign")(term:"1")(year:"25/26"),
 condition:(requester.role = "teacher"))`,
            ],
        },
    ],

    resources: [
        {
            key: 'paper',
            ownerKey: 'prof',
            attrs: {
                type: 'testPaper',
                course: 'systemDesign',
                term: '1',
                year: '25/26',
            },
            metadata: {
                name: 'Midterm test paper',
                description: 'System Design 25/26, first semester',
            },
            content: {
                text: 'placeholder placeholder placeholder\n',
                filename: 'midterm-test-paper.txt',
            },
        },
        {
            key: 'solutions',
            ownerKey: 'prof',
            attrs: {
                type: 'solutions',
                course: 'systemDesign',
                term: '1',
                year: '25/26',
            },
            metadata: {
                name: 'Midterm solutions',
                description: 'Released once the whole class has submitted',
            },
            content: {
                text: 'placeholder placeholder placeholder\n',
                filename: 'midterm-solutions.txt',
            },
        },
        {
            key: 'alice-submission',
            ownerKey: 'alice',
            attrs: {
                type: 'submission',
                course: 'systemDesign',
                term: '1',
                year: '25/26',
            },
            metadata: { name: "Alice's midterm submission" },
            content: {
                text: 'placeholder placeholder placeholder\n',
                filename: 'alice-midterm.txt',
            },
        },
        {
            key: 'bruno-submission',
            ownerKey: 'bruno',
            attrs: {
                type: 'submission',
                course: 'systemDesign',
                term: '1',
                year: '25/26',
            },
            metadata: { name: "Bruno's midterm submission" },
            content: {
                text: 'placeholder placeholder placeholder\n',
                filename: 'bruno-midterm.txt',
            },
        },
        {
            key: 'chiara-submission',
            ownerKey: 'chiara',
            attrs: {
                type: 'submission',
                course: 'systemDesign',
                term: '1',
                year: '25/26',
            },
            metadata: { name: "Chiara's midterm submission" },
            content: {
                text: 'placeholder placeholder placeholder\n',
                filename: 'chiara-midterm.txt',
            },
        },
    ],

    connections: [],

    groups: [
        {
            id: CLASS_GROUP,
            name: 'System Design 25/26',
            description: 'The class taking System Design in 25/26',
            memberKeys: ['prof', 'alice', 'bruno', 'chiara'],
        },
    ],
};
