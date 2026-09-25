package com.thesis.bartparser.examples;

import static bart.core.Participants.any;
import static bart.core.Participants.index;
import static bart.core.Participants.me;
import static bart.core.Participants.requester;

import java.util.stream.Collectors;

import bart.core.AndExchange;
import bart.core.Attributes;
import bart.core.ExpressionWithDescription;
import bart.core.Policies;
import bart.core.Policy;
import bart.core.Request;
import bart.core.Result;
import bart.core.Rule;
import bart.core.Rules;
import bart.core.SingleExchange;
import bart.core.semantics.Semantics;

/**
 * Java-model oracle for the multi-courier scenario (Example 3 of the ITASEC'25 Bart
 * paper, updated to the current syntax/semantics). {@code PS = R1 F' R2}: R1's Lucca
 * rule tests {@code requester.company}, not the bare {@code company} (which would
 * resolve to the grantor and always be {@code RabbitService}).
 *
 * @see com.thesis.bartparser.examples.StudentsExample
 */
public class CouriersExample {

    public static Request courier_ex3(Semantics semantics, Policies policies) {
        policies
            .add(
                new Policy( // index 1 - R1 (RabbitService)
                    new Attributes()
                        .add("service", "delivery")
                        .add("company", "RabbitService"),
                    new Rules()
                        .add(new Rule(
                            new Attributes()
                                .add("type", "addrInfo")
                                .add("city", "Lucca"),
                            new ExpressionWithDescription(
                                c -> c.nameFromRequester("company").equals("RabbitService"),
                                "requester.company = \"RabbitService\"")))
                        .add(new Rule(
                            new Attributes()
                                .add("type", "addrInfo")
                                .add("city", "Lucca"),
                            new ExpressionWithDescription(
                                c -> !c.nameFromRequester("company").equals("RabbitService"),
                                "not requester.company = \"RabbitService\""),
                            new SingleExchange(
                                me(),
                                new Attributes()
                                    .add("type", "addrInfo")
                                    .add("city", "Prato"),
                                requester())))))
            .add(
                new Policy( // index 2 - F' (FastAndFurious)
                    new Attributes()
                        .add("service", "delivery")
                        .add("company", "FastAndFurious"),
                    new Rules()
                        .add(new Rule(
                            new Attributes()
                                .add("type", "addrInfo")
                                .add("city", "Prato"),
                            new AndExchange(
                                new SingleExchange(
                                    me(),
                                    new Attributes()
                                        .add("type", "addrInfo")
                                        .add("city", "Lucca"),
                                    any(new Attributes()
                                        .add("service", "delivery")
                                        .add("company", "RabbitService"))),
                                new SingleExchange(
                                    me(),
                                    new Attributes()
                                        .add("type", "addrInfo")
                                        .add("city", "Grosseto"),
                                    any(new Attributes()
                                        .add("service", "delivery")
                                        .add("company", "RabbitService"))))))))
            .add(
                new Policy( // index 3 - R2 (RabbitService)
                    new Attributes()
                        .add("service", "delivery")
                        .add("company", "RabbitService"),
                    new Rules()
                        .add(new Rule(
                            new Attributes()
                                .add("type", "addrInfo")
                                .add("city", "Grosseto")))));

        return new Request(
            index(1), // R1 (RabbitService)
            new Attributes()
                .add("type", "addrInfo")
                .add("city", "Prato"),
            any(new Attributes()
                .add("service", "delivery")
                .add("company", "FastAndFurious")));
    }

    public static void main(String[] args) {
        Policies policies = new Policies();
        Semantics semantics = new Semantics(policies);

        Request request = courier_ex3(semantics, policies);

        Result result = semantics.evaluate(request);

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
