package com.thesis.bartparser;

import bart.core.ContextHandler;
import bart.core.Policies;
import bart.core.Request;

/** A fully parsed `.bart` scenario: policy system + context + enriched request. */
public record Scenario(Policies policies, ContextHandler context, Request request) {}
