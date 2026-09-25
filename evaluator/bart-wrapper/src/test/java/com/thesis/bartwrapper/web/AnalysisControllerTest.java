package com.thesis.bartwrapper.web;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import com.thesis.bartparser.BartSyntaxException;
import com.thesis.bartwrapper.BartSyntaxInputException;
import com.thesis.bartwrapper.analyze.AnalysisResponse;
import com.thesis.bartwrapper.analyze.AnalysisService;
import com.thesis.bartwrapper.analyze.ConditionParty;
import com.thesis.bartwrapper.analyze.ExchangeRole;
import com.thesis.bartwrapper.analyze.Quant;
import com.thesis.bartwrapper.analyze.QuantifiedPattern;

@WebMvcTest(AnalysisController.class)
class AnalysisControllerTest {

    @Autowired
    private MockMvc mvc;

    @MockitoBean
    private AnalysisService service;

    @Test
    void patternsComeBackPositionallyAligned() throws Exception {
        when(service.analyze(any())).thenReturn(new AnalysisResponse(List.of(
            new AnalysisResponse.PolicyAnalysis(List.of(), List.of()),
            new AnalysisResponse.PolicyAnalysis(List.of(
                new QuantifiedPattern(ExchangeRole.FROM, Quant.ANY, Map.of("university", "unifi")),
                new QuantifiedPattern(ExchangeRole.TO, Quant.ALL, Map.of("role", "tutor"))),
                List.of(new ConditionParty(Map.of("role", "auditor")))))));

        mvc.perform(post("/analyze/policies")
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"policies\":[\"(party:(a:\\\"b\\\"), rules:())\",\"x\"]}"))
            .andExpect(status().isOk())
            .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
            .andExpect(jsonPath("$.policies[0].quantified").isEmpty())
            .andExpect(jsonPath("$.policies[0].conditionParties").isEmpty())
            .andExpect(jsonPath("$.policies[1].quantified[0].role").value("from"))
            .andExpect(jsonPath("$.policies[1].quantified[0].quant").value("any"))
            .andExpect(jsonPath("$.policies[1].quantified[0].attrs.university").value("unifi"))
            // the other half of each wire enum, so a typo in TO or ALL cannot ship green
            .andExpect(jsonPath("$.policies[1].quantified[1].role").value("to"))
            .andExpect(jsonPath("$.policies[1].quantified[1].quant").value("all"))
            .andExpect(jsonPath("$.policies[1].conditionParties[0].attrs.role").value("auditor"));
    }

    @Test
    void aSyntaxErrorIsFourHundredWithItsLocation() throws Exception {
        when(service.analyze(any())).thenThrow(new BartSyntaxInputException(
            "policy 2", new BartSyntaxException(1, 5, "boom")));

        mvc.perform(post("/analyze/policies")
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"policies\":[\"a\",\"b\"]}"))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.error").value("bart-syntax"))
            .andExpect(jsonPath("$.location").value("policy 2"));
    }

    @Test
    void aMalformedBodyIsFourHundred() throws Exception {
        mvc.perform(post("/analyze/policies")
            .contentType(MediaType.APPLICATION_JSON)
            .content("not json"))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.error").value("malformed-body"));
    }
}
