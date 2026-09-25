package com.thesis.bartwrapper.analyze;

import com.fasterxml.jackson.annotation.JsonValue;

/** Which side of an exchange a participant appeared on, as the JSON spells it. */
public enum ExchangeRole {

    TO("to"),
    FROM("from");

    private final String wireName;

    ExchangeRole(String wireName) {
        this.wireName = wireName;
    }

    @JsonValue
    public String wireName() {
        return wireName;
    }
}
