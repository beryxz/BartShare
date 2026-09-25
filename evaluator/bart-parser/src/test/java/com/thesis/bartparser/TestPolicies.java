package com.thesis.bartparser;

import bart.core.Rule;

/** Fixtures shared by the tests that assert on a policy's built model. */
final class TestPolicies {

    private TestPolicies() {
    }

    /** The first rule of a single-rule policy, through the facade rather than the parse tree. */
    static Rule firstRule(String policy) {
        return Bart.parsePolicy(policy).rules().getRuleData().findFirst().orElseThrow().rule();
    }
}
