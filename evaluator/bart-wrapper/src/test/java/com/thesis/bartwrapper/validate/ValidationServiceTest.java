package com.thesis.bartwrapper.validate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;

import com.thesis.bartwrapper.UnknownKindException;

class ValidationServiceTest {

    private static final String POLICY = """
        (party:(username:"john"),
         rules:())
        """;

    private final ValidationService service = new ValidationService();

    // --- each kind accepts its own artifact ---------------------------------------------

    @Test
    void acceptsAWellFormedPolicy() {
        assertThat(service.validate(ArtifactKind.POLICY, POLICY).valid())
            .isTrue();
    }

    @Test
    void acceptsAWellFormedPolicySystem() {
        assertThat(service.validate(ArtifactKind.POLICY_SYSTEM, POLICY + "\n" + POLICY).valid())
            .isTrue();
    }

    @Test
    void acceptsAWellFormedContext() {
        var context = """
            (
              (),
              (friends:{"a"})
            )
            """;

        assertThat(service.validate(ArtifactKind.CONTEXT, context).valid())
            .isTrue();
    }

    @Test
    void acceptsAWellFormedEnrichedRequest() {
        var request = """
            1 : (resource:(type:"notes"), from:(any:))
            """;
        var result = service.validate(ArtifactKind.REQUEST, request);

        assertThat(result.valid())
            .isTrue();
    }

    // --- rejections come back as data, never as an exception ----------------------------

    /** Single-line on purpose: the column below moves the moment the input gains a line break. */
    @Test
    void reportsAParseErrorWithItsPosition() {
        var result = service.validate(ArtifactKind.CONTEXT, "((friends:\"a\"),()");

        assertThat(result.valid())
            .isFalse();
        assertThat(result.error().line())
            .isEqualTo(1);
        assertThat(result.error().column())
            .isEqualTo(17);
        assertThat(result.error().message())
            .contains("extraneous input");
    }

    @Test
    void reportsAPolicyThatIsNotAPolicySystem() {
        var result = service.validate(ArtifactKind.POLICY, "rules:()");

        assertThat(result.valid())
            .isFalse();
        assertThat(result.error().message())
            .isNotBlank();
    }

    /**
     * A model-build error, not a parse error: the text is grammatical, but Attributes
     * rejects the duplicate key. It has a message and no token to point at.
     */
    @Test
    void reportsADuplicateAttributeKeyWithoutAPosition() {
        var duplicateUsername = """
            (party:(username:"x")(username:"y"),
             rules:())
            """;
        var result = service.validate(ArtifactKind.POLICY, duplicateUsername);

        assertThat(result.valid())
            .isFalse();
        assertThat(result.error().line())
            .isNull();
        assertThat(result.error().column())
            .isNull();
        assertThat(result.error().message())
            .contains("already present");
    }

    /**
     * A number wider than its type is a finding like any other. Single-line on purpose: the
     * column moves the moment the input gains a line break.
     */
    @Test
    void reportsANumberTooWideForItsTypeWithItsPosition() {
        var result = service.validate(
            ArtifactKind.POLICY, "(party:(quota:9223372036854775808), rules:())");

        assertThat(result.valid())
            .isFalse();
        assertThat(result.error().line())
            .isEqualTo(1);
        assertThat(result.error().column())
            .isEqualTo(14);
        assertThat(result.error().message())
            .contains("number out of range");
    }

    /** Every entry rule is EOF-terminated with required content, so this needs no special case. */
    @Test
    void rejectsEmptyTextWithoutSpecialCasing() {
        assertThat(service.validate(ArtifactKind.POLICY, "").valid())
            .isFalse();
    }

    // --- factory methods ------------------------------------------------------------------

    @Test
    void okCreatesAValidResult() {
        var result = ValidationResult.ok();
        assertThat(result.valid())
            .isTrue();
        assertThat(result.error())
            .isNull();
    }

    @Test
    void invalidCreatesAnInvalidResult() {
        var error = SyntaxError.withoutPosition("test error");
        var result = ValidationResult.invalid(error);
        assertThat(result.valid())
            .isFalse();
        assertThat(result.error())
            .isEqualTo(error);
    }

    // --- slugs ---------------------------------------------------------------------------

    @Test
    void resolvesEverySlug() {
        assertThat(ArtifactKind.fromSlug("policy-system"))
            .isEqualTo(ArtifactKind.POLICY_SYSTEM);
        assertThat(ArtifactKind.fromSlug("policy"))
            .isEqualTo(ArtifactKind.POLICY);
        assertThat(ArtifactKind.fromSlug("context"))
            .isEqualTo(ArtifactKind.CONTEXT);
        assertThat(ArtifactKind.fromSlug("request"))
            .isEqualTo(ArtifactKind.REQUEST);
    }

    @Test
    void rejectsAnUnknownSlug() {
        assertThatThrownBy(() -> ArtifactKind.fromSlug("scenario"))
            .isInstanceOf(UnknownKindException.class)
            .hasMessageContaining("scenario");
    }
}
