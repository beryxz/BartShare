package com.thesis.bartwrapper.web;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import com.thesis.bartwrapper.validate.ArtifactKind;
import com.thesis.bartwrapper.validate.SyntaxError;
import com.thesis.bartwrapper.validate.ValidationResult;
import com.thesis.bartwrapper.validate.ValidationService;

@WebMvcTest(ValidationController.class)
class ValidationControllerTest {

    private static final String POLICY = """
        (party:(username:"john"),
         rules:())
        """;

    @Autowired
    private MockMvc mvc;

    @MockitoBean
    private ValidationService service;

    @Test
    void aValidArtifactIsTrueWithNoErrorBlock() throws Exception {
        when(service.validate(eq(ArtifactKind.POLICY), any())).thenReturn(ValidationResult.ok());

        mvc.perform(post("/validate/policy").contentType(MediaType.TEXT_PLAIN).content(POLICY))
            .andExpect(status().isOk())
            .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
            .andExpect(jsonPath("$.valid").value(true))
            .andExpect(jsonPath("$.error").doesNotExist());
    }

    @Test
    void anInvalidArtifactIsStillTwoHundredWithThePositionInTheBody() throws Exception {
        when(service.validate(eq(ArtifactKind.CONTEXT), any())).thenReturn(
            ValidationResult.invalid(new SyntaxError(1, 17, "extraneous input '<EOF>'")));

        mvc.perform(post("/validate/context").contentType(MediaType.TEXT_PLAIN).content("((),("))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.valid").value(false))
            .andExpect(jsonPath("$.error.line").value(1))
            .andExpect(jsonPath("$.error.column").value(17))
            .andExpect(jsonPath("$.error.message").value("extraneous input '<EOF>'"));
    }

    @Test
    void aPositionlessErrorOmitsLineAndColumn() throws Exception {
        when(service.validate(eq(ArtifactKind.POLICY), any())).thenReturn(
            ValidationResult.invalid(SyntaxError.withoutPosition("'username' is already present")));

        mvc.perform(post("/validate/policy").contentType(MediaType.TEXT_PLAIN).content(POLICY))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.valid").value(false))
            .andExpect(jsonPath("$.error.line").doesNotExist())
            .andExpect(jsonPath("$.error.column").doesNotExist())
            .andExpect(jsonPath("$.error.message").value("'username' is already present"));
    }

    @ParameterizedTest(name = "{0}")
    @ValueSource(strings = {"policy-system", "policy", "context", "request"})
    void aKnownSlugRoutesToItsKind(String slug) throws Exception {
        when(service.validate(any(), any())).thenReturn(ValidationResult.ok());

        mvc.perform(post("/validate/" + slug)
            .contentType(MediaType.TEXT_PLAIN)
            .content(POLICY))
            .andExpect(status().isOk());
    }

    @Test
    void anUnknownKindIsNotFound() throws Exception {
        mvc.perform(post("/validate/scenario").contentType(MediaType.TEXT_PLAIN).content(POLICY))
            .andExpect(status().isNotFound())
            .andExpect(jsonPath("$.error").value("unknown-kind"));
    }

    @Test
    void anEmptyBodyIsValidatedRatherThanRefused() throws Exception {
        when(service.validate(eq(ArtifactKind.POLICY), eq(""))).thenReturn(
            ValidationResult.invalid(new SyntaxError(1, 0, "mismatched input '<EOF>'")));

        mvc.perform(post("/validate/policy").contentType(MediaType.TEXT_PLAIN).content(""))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.valid").value(false));
    }
}
