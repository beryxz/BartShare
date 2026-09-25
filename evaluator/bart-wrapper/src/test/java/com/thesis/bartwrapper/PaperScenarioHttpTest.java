package com.thesis.bartwrapper;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

import com.thesis.bartwrapper.engine.EvaluationRequest;
import tools.jackson.databind.ObjectMapper;

/**
 * Drives the paper's Students scenario (bart-parser's `ex1_basic.bart`) through the real HTTP
 * API: real controllers, real parser, real engine, no mocks and no database. The 2- and
 * 5-party cases are the end-to-end proof that the party count is whatever the caller sends.
 */
@SpringBootTest
@AutoConfigureMockMvc
class PaperScenarioHttpTest {

    private static final String JOHN =
        """
            (party:(username:"john")(studyLevel:"undergraduate")(degreeProgram:"cs")(university:"unifi")(enrollment:"2024"),
             rules:(resource:(type:"lectureNotes")(course:"programming")(teacher:"smith")(year:"24/25"))
                   (resource:(type:"exercises")(course:"programming")(year:"24/25"),
                    condition:(requester.username in friends)))
            """;

    private static final String MARY =
        """
            (party:(username:"mary")(studyLevel:"undergraduate")(degreeProgram:"cs")(university:"unifi")(enrollment:"2023"),
             rules:(resource:(type:"lectureNotes")(course:"ads")(teacher:"doe")(year:"23/24"),
                    exchange:(to:me, resource:(type:"exercises"), from:requester)
                               or (to:me, resource:(type:"lectureNotes"), from:requester)))
            """;

    private static final String DAVID =
        """
            (party:(username:"david")(studyLevel:"undergraduate")(degreeProgram:"cs")(university:"unifi")(enrollment:"2023"),
             rules:())
            """;

    private static final String CONTEXT = """
        (
          (friends:"ashley","david"),
          (friends:"david","linda","steven"),
          ()
        )
        """;

    private static final String REQUEST = """
        1 : (resource:(type:"lectureNotes")(course:"ads"),
             from:(any:(studyLevel:"undergraduate")(degreeProgram:"cs")(university:"unifi")))
        """;

    @Autowired
    private MockMvc mvc;

    @Autowired
    private ObjectMapper json;

    private ResultActions evaluate(List<String> policies, String context, String request)
        throws Exception {
        String body = json.writeValueAsString(new EvaluationRequest(policies, context, request));
        return mvc.perform(post("/evaluate")
            .contentType(MediaType.APPLICATION_JSON)
            .content(body));
    }

    private ResultActions validate(String kind, String source) throws Exception {
        return mvc.perform(post("/validate/" + kind)
            .contentType(MediaType.TEXT_PLAIN)
            .content(source));
    }

    // --- the paper's scenario, three parties ---------------------------------------------

    @Test
    void permitsThePaperScenarioWithBothHalvesOfTheExchange() throws Exception {
        evaluate(List.of(JOHN, MARY, DAVID), CONTEXT, REQUEST)
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.permitted").value(true))
            .andExpect(jsonPath("$.requests.length()").value(2))
            // John obtains Mary's ADS lecture notes ...
            .andExpect(jsonPath("$.requests[0].requester").value(1))
            .andExpect(jsonPath("$.requests[0].from").value(2))
            .andExpect(jsonPath("$.requests[0].resource.type").value("lectureNotes"))
            .andExpect(jsonPath("$.requests[0].resource.course").value("ads"))
            // ... and Mary obtains John's lecture notes in exchange.
            .andExpect(jsonPath("$.requests[1].requester").value(2))
            .andExpect(jsonPath("$.requests[1].from").value(1))
            .andExpect(jsonPath("$.requests[1].resource.type").value("lectureNotes"));
    }

    @Test
    void theScenarioFieldReproducesExactlyWhatWasSent() throws Exception {
        evaluate(List.of(JOHN, MARY, DAVID), CONTEXT, REQUEST)
            .andExpect(jsonPath("$.scenario").value(
                JOHN + "\n" + MARY + "\n" + DAVID + "\n" + CONTEXT + "\n" + REQUEST + "\n"));
    }

    // --- the party count is whatever the caller sends -------------------------------------

    @Test
    void evaluatesATwoPartySystem() throws Exception {
        var context = """
            (
              (friends:"ashley","david"),
              ()
            )
            """;

        evaluate(List.of(JOHN, MARY), context, REQUEST)
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.permitted").value(true));
    }

    @Test
    void evaluatesAFivePartySystemAndAcceptsTheFifthAsRequester() throws Exception {
        var policies = new ArrayList<>(List.of(JOHN, MARY, DAVID));
        policies.add("""
            (party:(username:"p4")(university:"unifi"),
             rules:())
            """);
        policies.add(
            """
                (party:(username:"p5")(studyLevel:"undergraduate")(degreeProgram:"cs")(university:"unifi"),
                 rules:())
                """);
        String context = "(" + String.join(",", Collections.nCopies(5, "()")) + ")";
        var request =
            """
                5 : (resource:(type:"lectureNotes")(course:"programming")(teacher:"smith")(year:"24/25"),
                     from:(any:(username:"john")))
                """;

        evaluate(policies, context, request)
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.permitted").value(true))
            .andExpect(jsonPath("$.requests[0].requester").value(5))
            .andExpect(jsonPath("$.requests[0].from").value(1));
    }

    // --- set literals, exercised end to end -----------------------------------------------

    /**
     * A one-element set in context, written {@code {"mary"}} rather than the bare
     * {@code "mary"} a scalar would need: a String there would fail {@code in} with a
     * ClassCastException the engine swallows as a silent deny.
     */
    @Test
    void permitsWhenTheGrantingPartysFriendListIsASingletonSet() throws Exception {
        var context = """
            (
              (friends:{"mary"}),
              ()
            )
            """;
        var request = """
            2 : (resource:(type:"exercises")(course:"programming")(year:"24/25"),
                 from:(any:(username:"john")))
            """;

        evaluate(List.of(JOHN, MARY), context, request)
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.permitted").value(true))
            .andExpect(jsonPath("$.requests.length()").value(1))
            .andExpect(jsonPath("$.requests[0].requester").value(2))
            .andExpect(jsonPath("$.requests[0].from").value(1));
    }

    /**
     * Multiset equality over the wire. The rule pattern and the request write the same set in
     * opposite orders; canonicalisation happens during parsing, so the engine sees identical
     * values and the match succeeds.
     */
    @Test
    void aSetWrittenInAnotherOrderStillMatchesOverHttp() throws Exception {
        var tagged = """
            (party:(username:"john")(university:"unifi"),
             rules:(resource:(type:"notes")(tags:{"a","b"})))
            """;
        var request = """
            2 : (resource:(type:"notes")(tags:{"b","a"}),
                 from:(any:(username:"john")))
            """;

        evaluate(List.of(tagged, MARY), "((),())", request)
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.permitted").value(true));
    }

    // --- the error surface, end to end ----------------------------------------------------

    @Test
    void reportsWhichPolicyFailedToParse() throws Exception {
        var brokenPolicy = """
            (party:(username:"broken"), rules:)
            """;

        evaluate(List.of(JOHN, brokenPolicy), "((),())", REQUEST)
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.error").value("bart-syntax"))
            .andExpect(jsonPath("$.location").value("policy 2"))
            .andExpect(jsonPath("$.syntax.line").value(1));
    }

    @Test
    void rejectsAContextThatDoesNotHaveOneListPerParty() throws Exception {
        evaluate(List.of(JOHN, MARY, DAVID), "((),())", REQUEST)
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.error").value("context-arity"))
            .andExpect(jsonPath("$.location").value("context"));
    }

    @Test
    void rejectsARequesterBeyondThePolicyCount() throws Exception {
        // The empty `any` set is `(any:)`, never `(any:())`. It parses fine, so it
        // is the requester-bound check that rejects it.
        var request = """
            3 : (resource:(type:"x"), from:(any:))
            """;

        evaluate(List.of(JOHN, MARY), "((),())", request)
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.error").value("invalid-requester"));
    }

    // --- /validate, end to end -------------------------------------------------------------

    @Test
    void validatesEachArtifactOfThePaperScenario() throws Exception {
        validate("policy", JOHN).andExpect(status().isOk())
            .andExpect(jsonPath("$.valid").value(true));
        validate("policy-system", JOHN + "\n" + MARY + "\n" + DAVID).andExpect(status().isOk())
            .andExpect(jsonPath("$.valid").value(true));
        validate("context", CONTEXT).andExpect(status().isOk())
            .andExpect(jsonPath("$.valid").value(true));
        validate("request", REQUEST).andExpect(status().isOk())
            .andExpect(jsonPath("$.valid").value(true));
    }

    /** Single-line on purpose: the assertion pins a column, which a line break would move. */
    @Test
    void reportsAPositionForTextTheGrammarRejects() throws Exception {
        validate("context", "((friends:\"a\"),()")
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.valid").value(false))
            .andExpect(jsonPath("$.error.line").value(1))
            .andExpect(jsonPath("$.error.column").value(17));
    }

    @Test
    void anUnknownValidationKindIsNotFound() throws Exception {
        validate("scenario", JOHN)
            .andExpect(status().isNotFound())
            .andExpect(jsonPath("$.error").value("unknown-kind"));
    }
}
