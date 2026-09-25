package com.thesis.bartwrapper.validate;

import java.util.Arrays;
import java.util.function.Function;

import com.thesis.bartparser.Bart;
import com.thesis.bartwrapper.UnknownKindException;

/**
 * The grammar's EOF-terminated entry rules, one per URL slug. {@code scenarioFile} is
 * deliberately absent: no caller assembles whole scenario documents.
 */
public enum ArtifactKind {

    POLICY_SYSTEM("policy-system", Bart::parsePolicySystem),
    POLICY("policy", Bart::parsePolicy),
    CONTEXT("context", Bart::parseContext),
    REQUEST("request", Bart::parseEnrichedRequest);

    private final String slug;
    private final Function<String, Object> parser;

    ArtifactKind(String slug, Function<String, Object> parser) {
        this.slug = slug;
        this.parser = parser;
    }

    /**
     * Parses the text and builds the model. The model is discarded, since only whether this threw
     * matters. Building it is the point: it catches errors the grammar alone does not, such
     * as a duplicate attribute key.
     */
    public void parse(String source) {
        parser.apply(source);
    }

    /** @throws UnknownKindException if no kind carries that slug */
    public static ArtifactKind fromSlug(String slug) {
        return Arrays.stream(values())
            .filter(kind -> kind.slug.equals(slug))
            .findFirst()
            .orElseThrow(() -> new UnknownKindException(slug));
    }
}
