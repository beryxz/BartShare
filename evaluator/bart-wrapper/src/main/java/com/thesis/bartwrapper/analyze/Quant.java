package com.thesis.bartwrapper.analyze;

import com.fasterxml.jackson.annotation.JsonValue;

/** The participant quantifier, as the JSON spells it. Named for its wire field. */
public enum Quant {

    ANY("any"),
    ALL("all");

    private final String wireName;

    Quant(String wireName) {
        this.wireName = wireName;
    }

    @JsonValue
    public String wireName() {
        return wireName;
    }
}
