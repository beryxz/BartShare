package com.thesis.bartwrapper.web;

import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import com.thesis.bartwrapper.engine.EvaluationRequest;
import com.thesis.bartwrapper.engine.EvaluationResponse;
import com.thesis.bartwrapper.engine.EvaluationService;

@RestController
public class EvaluationController {

    private final EvaluationService service;

    public EvaluationController(EvaluationService service) {
        this.service = service;
    }

    /**
     * Evaluates a request against the policies and context sent with it. Nothing is stored:
     * the caller supplies the whole system on every call, so the party count is whatever it
     * sends.
     */
    @PostMapping(value = "/evaluate",
        consumes = MediaType.APPLICATION_JSON_VALUE,
        produces = MediaType.APPLICATION_JSON_VALUE)
    public EvaluationResponse evaluate(@RequestBody EvaluationRequest input) {
        return service.evaluate(input);
    }
}
