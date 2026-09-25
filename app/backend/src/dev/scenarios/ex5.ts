import { Scenario } from './types';

/**
 * Not paper-derived, unlike ex1 to ex3: this one carries no study vocabulary
 * at all, to show the app's terminology is Bart's rather than one domain's.
 * Its parties are organisations, not people.
 *
 * ItalSat's first two rules share a resource pattern, so a requester that
 * cannot pay the barter still reaches the connection rule below it: rule order
 * as disjunction. The two optical rules gate on `date_year`, one open and one
 * held back far enough to stay a deny. `resolution` is a Bart number, not a
 * string.
 *
 * The barter demands `from:requester`: an `any:` there is satisfied by
 * whichever matching party grants first, which would open the resource to
 * everyone and strand the rule below it.
 */
export const ex5: Scenario = {
    id: 'ex5',
    title: 'Earth-observation imagery',
    summary:
        'Two space agencies and a commercial operator trading imagery access. ItalSat swaps Alpine infrared for coastal optical from any Copernicus agency, keeps a partner channel open for the operator it is connected to, and holds one archive under embargo.',

    users: [
        {
            key: 'italsat',
            attrs: {
                username: 'italsat',
                kind: 'agency',
                country: 'it',
                program: 'copernicus',
            },
            rules: [
                `(resource:(type:"imagery")(region:"alps")(band:"infrared")(resolution:10),
 exchange:(to:me,
           resource:(type:"imagery")(region:"coast")(band:"optical"),
           from:requester))`,
                `(resource:(type:"imagery")(region:"alps")(band:"infrared")(resolution:10),
 condition:(requester.userId in connections))`,
                `(resource:(type:"imagery")(region:"alps")(band:"optical")(resolution:2),
 condition:(date_year >= 2026))`,
                `(resource:(type:"imagery")(region:"alps")(band:"optical")(resolution:1)(classification:"restricted"),
 condition:(date_year >= 2030))`,
            ],
        },
        {
            key: 'helsat',
            attrs: {
                username: 'helsat',
                kind: 'agency',
                country: 'gr',
                program: 'copernicus',
            },
            rules: [
                `(resource:(type:"imagery")(region:"coast")(band:"optical")(resolution:10),
 condition:(requester.program = "copernicus"))`,
            ],
        },
        {
            key: 'alpinesense',
            attrs: {
                username: 'alpinesense',
                kind: 'commercial',
                country: 'ch',
            },
            rules: [
                '(resource:(type:"aerial")(region:"alps")(band:"optical")(resolution:1))',
            ],
        },
    ],

    resources: [
        {
            key: 'alps-infrared',
            ownerKey: 'italsat',
            attrs: {
                type: 'imagery',
                region: 'alps',
                band: 'infrared',
                resolution: 10,
            },
            metadata: {
                name: 'Alpine infrared mosaic, 10m',
                description: 'Thermal coverage of the Italian Alps',
            },
            content: {
                text: 'placeholder placeholder placeholder\n',
                filename: 'alps-infrared-10m.txt',
            },
        },
        {
            key: 'alps-optical',
            ownerKey: 'italsat',
            attrs: {
                type: 'imagery',
                region: 'alps',
                band: 'optical',
                resolution: 2,
            },
            metadata: {
                name: 'Alpine optical mosaic, 2m',
                description: 'Released to everyone from 2026',
            },
            content: {
                text: 'placeholder placeholder placeholder\n',
                filename: 'alps-optical-2m.txt',
            },
        },
        {
            key: 'alps-archive',
            ownerKey: 'italsat',
            attrs: {
                type: 'imagery',
                region: 'alps',
                band: 'optical',
                resolution: 1,
                classification: 'restricted',
            },
            metadata: {
                name: 'Alpine optical archive, 1m',
                description: 'Under embargo until 2030',
            },
            content: {
                text: 'placeholder placeholder placeholder\n',
                filename: 'alps-optical-1m-archive.txt',
            },
        },
        {
            key: 'coast-optical',
            ownerKey: 'helsat',
            attrs: {
                type: 'imagery',
                region: 'coast',
                band: 'optical',
                resolution: 10,
            },
            metadata: {
                name: 'Aegean coastal optical, 10m',
                description: 'Coastline coverage, open to Copernicus partners',
            },
            content: {
                text: 'placeholder placeholder placeholder\n',
                filename: 'coast-optical-10m.txt',
            },
        },
        {
            key: 'alps-aerial',
            ownerKey: 'alpinesense',
            attrs: {
                type: 'aerial',
                region: 'alps',
                band: 'optical',
                resolution: 1,
            },
            metadata: {
                name: 'Alpine aerial survey, 1m',
                description: 'Drone survey, offered to everyone',
            },
            content: {
                text: 'placeholder placeholder placeholder\n',
                filename: 'alps-aerial-1m.txt',
            },
        },
    ],

    connections: [['italsat', 'alpinesense']],
};
