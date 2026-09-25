package com.thesis.bartwrapper.web;

import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import com.thesis.bartwrapper.analyze.AnalysisRequest;
import com.thesis.bartwrapper.analyze.AnalysisResponse;
import com.thesis.bartwrapper.analyze.AnalysisService;

@RestController
public class AnalysisController {

    private final AnalysisService service;

    public AnalysisController(AnalysisService service) {
        this.service = service;
    }

    /**
     * Reports, per submitted policy, the {@code any}/{@code all} participants of its exchanges
     * and the parties its conditions name by attribute pattern, so a caller can compute which
     * parties belong in a policy system without parsing `.bart` itself. Stateless like the rest
     * of this service.
     */
    @PostMapping(value = "/analyze/policies",
        consumes = MediaType.APPLICATION_JSON_VALUE,
        produces = MediaType.APPLICATION_JSON_VALUE)
    public AnalysisResponse analyze(@RequestBody AnalysisRequest input) {
        return service.analyze(input);
    }
}
