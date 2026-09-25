package com.thesis.bartwrapper.web;

/**
 * The liveness answer. A record rather than a map, so the one field this endpoint returns is
 * named in the type.
 *
 * @param status always {@code "UP"}: the probe has no downstream dependency to report on
 */
public record HealthStatus(String status) {

    public static HealthStatus up() {
        return new HealthStatus("UP");
    }
}
