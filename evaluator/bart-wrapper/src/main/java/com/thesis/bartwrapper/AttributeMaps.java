package com.thesis.bartwrapper;

import java.util.LinkedHashMap;
import java.util.Map;

import bart.core.Attributes;

/**
 * Attributes as a JSON object. {@code Attributes} keeps its map private, but {@code names()}
 * plus {@code name(k)} rebuilds it without touching the read-only engine.
 */
public final class AttributeMaps {

    private AttributeMaps() {
    }

    /** Insertion-ordered, so a response lists attributes the way the source wrote them. */
    public static Map<String, Object> of(Attributes attributes) {
        var map = new LinkedHashMap<String, Object>();
        attributes.names().forEach(name -> map.put(name, attributes.name(name)));
        return map;
    }
}
