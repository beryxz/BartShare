package com.thesis.bartwrapper.web;

import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import com.thesis.bartwrapper.validate.ArtifactKind;
import com.thesis.bartwrapper.validate.ValidationResult;
import com.thesis.bartwrapper.validate.ValidationService;

@RestController
public class ValidationController {

    private final ValidationService service;

    public ValidationController(ValidationService service) {
        this.service = service;
    }

    /**
     * Checks arbitrary `.bart` text against one grammar entry rule. Always 200 when the
     * endpoint did its job, since a rejection is the finding, not a failed call; only an
     * unrecognised {@code kind} is an HTTP error.
     * <p>
     * The body is optional so an empty one is validated (and found invalid, since every entry
     * rule requires content) rather than refused by Spring before the validator ever sees it.
     * </p>
     */
    @PostMapping(value = "/validate/{kind}",
        consumes = MediaType.TEXT_PLAIN_VALUE,
        produces = MediaType.APPLICATION_JSON_VALUE)
    public ValidationResult validate(
        @PathVariable String kind,
        @RequestBody(required = false) String source) {

        return service.validate(ArtifactKind.fromSlug(kind), source == null ? "" : source);
    }
}
