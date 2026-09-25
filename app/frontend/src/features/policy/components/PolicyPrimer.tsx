'use client';

import { BartCode } from '@/components/bart/BartCode';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { useStickyFlag } from '@/hooks/use-sticky-flag';
import { ChevronDown, ChevronUp } from 'lucide-react';

/**
 * The four facts that decide whether a rule does what its author meant: an
 * unqualified name read as the requester's, a resource attribute shadowing a
 * party attribute, a short pattern read as a broad one, and a rule assumed
 * reachable after an earlier one matched.
 *
 * Static and collapsible rather than dismissible: they are properties of the
 * semantics, identical for every user.
 */
const POINTS: { title: string; body: string; code: string }[] = [
    {
        title: 'Who a name refers to',
        body: 'A bare "name" is yours. Qualify it with "requester." to ask about whoever is asking. In an exchange, "me" is you and "requester" is the asker; "any" and "all" quantify over every party matching a pattern.',
        code: '# "I am in group G": same answer for everyone who asks\ncondition:("<groupId>" in groups)\n# "the asker is in group G": almost always what you meant\ncondition:("<groupId>" in requester.groups)',
    },
    {
        title: 'Where a name is looked up',
        body: 'The resource first, then your context, then your party attributes: first hit wins. So a resource attribute shadows a party attribute of the same name. Give them distinct names.',
        code: '# Assuming party has the "city" attribute, interacting\n# with a resource:(city:"Florence") shadows the party attribute,\n# making the following condition compare the resource to itself\ncondition:(city = requester.city)',
    },
    {
        title: 'What a resource pattern matches',
        body: 'A rule must name every attribute the resource carries. Naming more than the resource carries is fine; naming fewer is not, so a shorter pattern is narrower, not broader.',
        code: '# for a resource whose attrs are (type:"exercises")(teacher:"brown")\nresource:(teacher:"brown")                        # covers nothing\nresource:(type:"exercises")(teacher:"brown")      # covers it',
    },
    {
        title: 'Which rule decides',
        body: 'Rules are tried top to bottom. The first whose pattern, condition and exchange all succeed wins, and nothing below it is consulted.',
        code: '# a broad rule placed first makes every rule under it unreachable',
    },
];

export function PolicyPrimer() {
    const [open, setOpen] = useStickyFlag('bart.policyPrimer.open', false);

    return (
        <Card>
            <CardHeader>
                <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1.5">
                        <CardTitle>How rules are read</CardTitle>
                        <CardDescription>
                            QA of things the evaluator does that might not be
                            obvious.
                        </CardDescription>
                    </div>
                    <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setOpen(!open)}
                        aria-expanded={open}
                    >
                        {open ? (
                            <ChevronUp className="size-4" />
                        ) : (
                            <ChevronDown className="size-4" />
                        )}
                        {open ? 'Hide' : 'Show'}
                    </Button>
                </div>
            </CardHeader>
            {open && (
                <CardContent className="space-y-4">
                    {POINTS.map(point => (
                        <div key={point.title} className="space-y-1.5">
                            <p className="text-sm font-medium">{point.title}</p>
                            <p className="text-xs text-muted-foreground">
                                {point.body}
                            </p>
                            <BartCode source={point.code} />
                        </div>
                    ))}
                </CardContent>
            )}
        </Card>
    );
}
