package com.thesis.bartwrapper.web;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

import com.thesis.bartparser.BartSyntaxException;
import com.thesis.bartwrapper.validate.SyntaxError;

class ApiExceptionHandlerTest {

    private final ApiExceptionHandler handler = new ApiExceptionHandler();

    /** No endpoint reaches this handler; the test is what keeps an untagged parse at 400. */
    @Test
    void anUntaggedSyntaxErrorBecomesA400CarryingItsPositionAndNoLocation() {
        var untagged = new BartSyntaxException(3, 7, "mismatched input");
        var expected = new ApiError("bart-syntax", "line 3:7 mismatched input", null,
            new SyntaxError(3, 7, "mismatched input"));

        var response = handler.handleSyntax(untagged);

        assertThat(response.getStatusCode())
            .isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(response.getBody())
            .isEqualTo(expected);
    }
}
