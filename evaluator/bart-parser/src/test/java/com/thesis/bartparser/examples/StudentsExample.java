package com.thesis.bartparser.examples;

import static bart.core.Participants.any;
import static bart.core.Participants.index;
import static bart.core.Participants.me;
import static bart.core.Participants.requester;

import java.util.Collection;
import java.util.List;
import java.util.function.BiFunction;
import java.util.stream.Collectors;

import bart.core.AndExchange;
import bart.core.Attributes;
import bart.core.ContextHandler;
import bart.core.ExpressionWithDescription;
import bart.core.OrExchange;
import bart.core.Policies;
import bart.core.Policy;
import bart.core.Request;
import bart.core.Result;
import bart.core.Rule;
import bart.core.Rules;
import bart.core.SingleExchange;
import bart.core.semantics.Semantics;

/**
 * The {@code friends} context values below are assembled directly in Java, bypassing
 * {@code ValueVisitor}, so canonical element ordering never applies to them. Keep the lists
 * sorted, so they stay {@code Objects.equals}-interchangeable with the parsed fixture's
 * canonicalised lists.
 */
public class StudentsExample {

    public static Request ex1_basic(Semantics semantics, Policies policies) {
        semantics.contextHandler(new ContextHandler()
            .add(1, "friends", List.of("ashley", "david"))
            .add(2, "friends", List.of("david", "linda", "steven"))
            .add(3, "friends", List.of()));

        policies
            .add(
                new Policy( // index 1 - John
                    new Attributes()
                        .add("username", "john")
                        .add("studyLevel", "undergraduate")
                        .add("degreeProgram", "cs")
                        .add("university", "unifi")
                        .add("enrollment", "2024"),
                    new Rules()
                        .add(new Rule(
                            new Attributes()
                                .add("type", "lectureNotes")
                                .add("course", "programming")
                                .add("teacher", "smith")
                                .add("year", "24/25")))
                        .add(new Rule(
                            new Attributes()
                                .add("type", "exercises")
                                .add("course", "programming")
                                .add("year", "24/25"),
                            new ExpressionWithDescription(
                                c -> c.name("friends", Collection.class)
                                    .contains(c.nameFromRequester("username")),
                                "requester.username in friends")))))
            .add(
                new Policy( // index 2 - Mary
                    new Attributes()
                        .add("username", "mary")
                        .add("studyLevel", "undergraduate")
                        .add("degreeProgram", "cs")
                        .add("university", "unifi")
                        .add("enrollment", "2023"),
                    new Rules()
                        .add(new Rule(
                            new Attributes()
                                .add("type", "lectureNotes")
                                .add("course", "ads")
                                .add("teacher", "doe")
                                .add("year", "23/24"),
                            new OrExchange(
                                new SingleExchange(
                                    me(),
                                    new Attributes()
                                        .add("type", "exercises"),
                                    requester()),
                                new SingleExchange(
                                    me(),
                                    new Attributes()
                                        .add("type", "lectureNotes"),
                                    requester()))))))
            .add(
                new Policy( // index 3 - David
                    new Attributes()
                        .add("username", "david")
                        .add("studyLevel", "undergraduate")
                        .add("degreeProgram", "cs")
                        .add("university", "unifi")
                        .add("enrollment", "2023"),
                    new Rules()));

        return new Request(
            index(1), // John
            new Attributes()
                .add("type", "lectureNotes")
                .add("course", "ads"),
            any(new Attributes()
                .add("studyLevel", "undergraduate")
                .add("degreeProgram", "cs")
                .add("university", "unifi")));
    }

    public static Request ex2_basic_plus_cycle(Semantics semantics, Policies policies) {
        semantics.contextHandler(new ContextHandler()
            .add(1, "friends", List.of("ashley", "david"))
            .add(2, "friends", List.of("david", "linda", "steven"))
            .add(3, "friends", List.of()));

        policies
            .add(
                new Policy( // index 1 - John
                    new Attributes()
                        .add("username", "john")
                        .add("studyLevel", "undergraduate")
                        .add("degreeProgram", "cs")
                        .add("university", "unifi")
                        .add("enrollment", "2024"),
                    new Rules()
                        .add(new Rule(
                            new Attributes()
                                .add("type", "lectureNotes")
                                .add("course", "programming")
                                .add("teacher", "smith")
                                .add("year", "24/25"),
                            new SingleExchange(
                                me(),
                                new Attributes()
                                    .add("type", "lectureNotes"),
                                requester())))
                        .add(new Rule(
                            new Attributes()
                                .add("type", "exercises")
                                .add("course", "programming")
                                .add("year", "24/25"),
                            new ExpressionWithDescription(
                                c -> c.name("friends", Collection.class)
                                    .contains(c.nameFromRequester("username")),
                                "requester.username in friends")))))
            .add(
                new Policy( // index 2 - Mary
                    new Attributes()
                        .add("username", "mary")
                        .add("studyLevel", "undergraduate")
                        .add("degreeProgram", "cs")
                        .add("university", "unifi")
                        .add("enrollment", "2023"),
                    new Rules()
                        .add(new Rule(
                            new Attributes()
                                .add("type", "lectureNotes")
                                .add("course", "ads")
                                .add("teacher", "doe")
                                .add("year", "23/24"),
                            new OrExchange(
                                new SingleExchange(
                                    me(),
                                    new Attributes()
                                        .add("type", "exercises"),
                                    requester()),
                                new SingleExchange(
                                    me(),
                                    new Attributes()
                                        .add("type", "lectureNotes"),
                                    requester()))))))
            .add(
                new Policy( // index 3 - David
                    new Attributes()
                        .add("username", "david")
                        .add("studyLevel", "undergraduate")
                        .add("degreeProgram", "cs")
                        .add("university", "unifi")
                        .add("enrollment", "2023"),
                    new Rules()));

        return new Request(
            index(1), // John
            new Attributes()
                .add("type", "lectureNotes")
                .add("course", "ads"),
            any(new Attributes()
                .add("studyLevel", "undergraduate")
                .add("degreeProgram", "cs")
                .add("university", "unifi")));
    }

    public static Request ex3_multi_party_exchange(Semantics semantics, Policies policies) {
        semantics.contextHandler(new ContextHandler()
            .add(1, "friends", List.of("ashley", "david"))
            .add(2, "friends", List.of("david", "linda", "steven"))
            .add(3, "friends", List.of()));

        policies
            .add(
                new Policy( // index 1 - John
                    new Attributes()
                        .add("username", "john")
                        .add("studyLevel", "undergraduate")
                        .add("degreeProgram", "cs")
                        .add("university", "unifi")
                        .add("enrollment", "2024"),
                    new Rules()
                        .add(new Rule(
                            new Attributes()
                                .add("type", "lectureNotes")
                                .add("course", "programming")
                                .add("teacher", "smith")
                                .add("year", "24/25"),
                            new SingleExchange(
                                me(),
                                new Attributes()
                                    .add("type", "lectureNotes"),
                                requester())))
                        .add(new Rule(
                            new Attributes()
                                .add("type", "exercises")
                                .add("course", "programming")
                                .add("year", "24/25"),
                            new ExpressionWithDescription(
                                c -> c.name("friends", Collection.class)
                                    .contains(c.nameFromRequester("username")),
                                "requester.username in friends")))))
            .add(
                new Policy( // index 2 - Mary
                    new Attributes()
                        .add("username", "mary")
                        .add("studyLevel", "undergraduate")
                        .add("degreeProgram", "cs")
                        .add("university", "unifi")
                        .add("enrollment", "2023"),
                    new Rules()
                        .add(new Rule(
                            new Attributes()
                                .add("type", "lectureNotes")
                                .add("course", "ads")
                                .add("teacher", "doe")
                                .add("year", "23/24"),
                            new AndExchange(
                                new SingleExchange(
                                    me(),
                                    new Attributes().add("type", "lectureNotes"),
                                    any(
                                        new Attributes()
                                            .add("studyLevel", "undergraduate")
                                            .add("degreeProgram", "cs")
                                            .add("university", "unifi"))),
                                new SingleExchange(
                                    me(),
                                    new Attributes().add("type", "exercises"),
                                    any(
                                        new Attributes()
                                            .add("studyLevel", "undergraduate")
                                            .add("degreeProgram", "cs")
                                            .add("university", "unifi"))))))))
            .add(
                new Policy( // index 3 - David
                    new Attributes()
                        .add("username", "david")
                        .add("studyLevel", "undergraduate")
                        .add("degreeProgram", "cs")
                        .add("university", "unifi")
                        .add("enrollment", "2023"),
                    new Rules()
                        .add(new Rule(
                            new Attributes()
                                .add("type", "exercises")
                                .add("course", "calculus")
                                .add("teacher", "brown")
                                .add("year", "23/24")))));

        return new Request(
            index(1), // John
            new Attributes()
                .add("type", "lectureNotes")
                .add("course", "ads"),
            any(new Attributes()
                .add("studyLevel", "undergraduate")
                .add("degreeProgram", "cs")
                .add("university", "unifi")));
    }

    public static void main(String[] args) {
        runScenario("ex1_basic", StudentsExample::ex1_basic);
        runScenario("ex2_basic_plus_cycle", StudentsExample::ex2_basic_plus_cycle);
        runScenario("ex3_multi_party_exchange", StudentsExample::ex3_multi_party_exchange);
    }

    /** Fresh Policies and Semantics per scenario: Semantics is stateful, Policies accumulate. */
    private static void runScenario(String name,
        BiFunction<Semantics, Policies, Request> scenario) {
        Policies policies = new Policies();
        Semantics semantics = new Semantics(policies);
        Request request = scenario.apply(semantics, policies);

        Result result = semantics.evaluate(request);

        System.out.println("=== " + name + " ===");
        System.out.println("PERMITTED: " + result.isPermitted());
        System.out.println();
        System.out.println("REQUESTS:\n" + result.getRequests()
            .stream()
            .map(Object::toString)
            .collect(Collectors.joining("\n")));
        System.out.println();
        System.out.println("TRACE;\n" + semantics.getTrace().toString());
    }
}
