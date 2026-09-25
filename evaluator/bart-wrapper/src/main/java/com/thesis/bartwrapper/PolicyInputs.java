package com.thesis.bartwrapper;

import java.util.List;
import java.util.OptionalInt;
import java.util.stream.IntStream;

/**
 * The policy-list precondition, shared by the endpoints that take one: one non-blank policy
 * per party.
 */
public final class PolicyInputs {

    private PolicyInputs() {
    }

    /**
     * Returns the list unchanged once it holds at least one policy and none of them is blank.
     *
     * @throws MissingInputException tagged {@code empty-policies}
     */
    public static List<String> require(List<String> policies) {
        if (policies == null || policies.isEmpty()) {
            throw new MissingInputException("empty-policies",
                "at least one policy is required; a party that only makes requests still "
                    + "needs an entry, e.g. (party:(username:\"x\"), rules:())");
        }
        OptionalInt blank = IntStream.range(0, policies.size())
            .filter(i -> isBlank(policies.get(i)))
            .findFirst();
        if (blank.isPresent()) {
            throw new MissingInputException("empty-policies",
                "policy " + (blank.getAsInt() + 1) + " is missing or blank; every party needs "
                    + "a policy, e.g. (party:(username:\"x\"), rules:())");
        }
        return policies;
    }

    private static boolean isBlank(String policy) {
        return policy == null || policy.isBlank();
    }
}
