package com.thesis.bartwrapper.web;

import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Liveness probe. Stateless with no downstream dependencies, so
 * "healthy" only means the Spring context started and MVC answers.
 */
@RestController
public class HealthController {

    @GetMapping(value = "/health", produces = MediaType.APPLICATION_JSON_VALUE)
    public HealthStatus health() {
        return HealthStatus.up();
    }
}
