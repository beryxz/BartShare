package com.thesis.bartwrapper.web;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
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
import com.thesis.bartwrapper.BartInputException;
import com.thesis.bartwrapper.BartSyntaxInputException;
import com.thesis.bartwrapper.ContextArityException;
import com.thesis.bartwrapper.InvalidRequesterException;
import com.thesis.bartwrapper.MissingInputException;
import com.thesis.bartwrapper.engine.EvaluationRequest;
import com.thesis.bartwrapper.engine.EvaluationResponse;
import com.thesis.bartwrapper.engine.EvaluationService;

@WebMvcTest(EvaluationController.class)
class EvaluationControllerTest {

    private static final String BODY = """
        {"policies": ["(party:(username:\\"p1\\"), rules:())"],
         "context": "(())",
         "request": "1 : (resource:(type:\\"x\\"), from:(any:))"}""";

    @Autowired
    private MockMvc mvc;

    @MockitoBean
    private EvaluationService service;

    @Test
    void evaluatesAndReturnsTheDecisionChainTraceAndScenario() throws Exception {
        when(service.evaluate(any(EvaluationRequest.class))).thenReturn(new EvaluationResponse(
            true,
            List.of(new EvaluationResponse.SatisfiedRequest(1, 2, Map.of("type", "lectureNotes"))),
            "evaluating ...",
            "SCENARIO"));

        mvc.perform(post("/evaluate").contentType(MediaType.APPLICATION_JSON).content(BODY))
            .andExpect(status().isOk())
            .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
            .andExpect(jsonPath("$.permitted").value(true))
            .andExpect(jsonPath("$.requests.length()").value(1))
            .andExpect(jsonPath("$.requests[0].requester").value(1))
            .andExpect(jsonPath("$.requests[0].from").value(2))
            .andExpect(jsonPath("$.requests[0].resource.type").value("lectureNotes"))
            .andExpect(jsonPath("$.trace").value("evaluating ..."))
            .andExpect(jsonPath("$.scenario").value("SCENARIO"));
    }

    @Test
    void aSyntaxErrorCarriesTheSlugTheLocationAndThePosition() throws Exception {
        doThrow(new BartSyntaxInputException("policy 2",
            new BartSyntaxException(3, 11, "mismatched input ')'")))
            .when(service)
            .evaluate(any(EvaluationRequest.class));

        mvc.perform(post("/evaluate").contentType(MediaType.APPLICATION_JSON).content(BODY))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.error").value("bart-syntax"))
            .andExpect(jsonPath("$.location").value("policy 2"))
            .andExpect(jsonPath("$.syntax.line").value(3))
            .andExpect(jsonPath("$.syntax.column").value(11))
            .andExpect(jsonPath("$.syntax.message").value("mismatched input ')'"));
    }

    @Test
    void aModelErrorIsReportedWithoutAPositionBlock() throws Exception {
        doThrow(new BartInputException("policy 1",
            new IllegalArgumentException("'username' is already present as 'x'")))
            .when(service)
            .evaluate(any(EvaluationRequest.class));

        mvc.perform(post("/evaluate").contentType(MediaType.APPLICATION_JSON).content(BODY))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.error").value("bart-model"))
            .andExpect(jsonPath("$.location").value("policy 1"))
            .andExpect(jsonPath("$.syntax").doesNotExist());
    }

    @Test
    void aContextArityMismatchIsABadRequestLocatedAtTheContext() throws Exception {
        doThrow(new ContextArityException(2, 3))
            .when(service)
            .evaluate(any(EvaluationRequest.class));

        mvc.perform(post("/evaluate").contentType(MediaType.APPLICATION_JSON).content(BODY))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.error").value("context-arity"))
            .andExpect(jsonPath("$.location").value("context"));
    }

    @Test
    void aMissingInputReportsItsOwnSlug() throws Exception {
        doThrow(new MissingInputException("empty-policies", "at least one policy is required"))
            .when(service)
            .evaluate(any(EvaluationRequest.class));

        mvc.perform(post("/evaluate").contentType(MediaType.APPLICATION_JSON).content(BODY))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.error").value("empty-policies"))
            .andExpect(jsonPath("$.location").doesNotExist());
    }

    @Test
    void anOutOfRangeRequesterIsABadRequest() throws Exception {
        doThrow(new InvalidRequesterException(7, 3))
            .when(service)
            .evaluate(any(EvaluationRequest.class));

        mvc.perform(post("/evaluate").contentType(MediaType.APPLICATION_JSON).content(BODY))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.error").value("invalid-requester"))
            .andExpect(jsonPath("$.location").value("request"));
    }

    @Test
    void anUnreadableBodyIsABadRequestInTheSameErrorShape() throws Exception {
        mvc.perform(post("/evaluate").contentType(MediaType.APPLICATION_JSON).content("{ nope"))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.error").value("malformed-body"));
    }
}
