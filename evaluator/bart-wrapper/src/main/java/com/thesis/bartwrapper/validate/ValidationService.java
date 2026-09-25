package com.thesis.bartwrapper.validate;

import org.springframework.stereotype.Service;

import com.thesis.bartparser.BartSyntaxException;

/** Backs `POST /validate/{kind}`: a rejection becomes data, not an exception. */
@Service
public class ValidationService {

    /**
     * Parses and builds the model, turning a rejection into data.
     * <p>
     * Only {@link BartSyntaxException} (parse failures) and {@code IllegalArgumentException} /
     * {@code IllegalStateException} (model-build failures, e.g. duplicate attribute key) are
     * caught. Anything else is a bug here and must keep producing a 500, not "your policy is
     * invalid".
     * </p>
     */
    public ValidationResult validate(ArtifactKind kind, String source) {
        try {
            kind.parse(source);
            return ValidationResult.ok();
        } catch (BartSyntaxException e) {
            return ValidationResult.invalid(SyntaxError.of(e));
        } catch (IllegalArgumentException | IllegalStateException e) {
            return ValidationResult.invalid(SyntaxError.withoutPosition(e.getMessage()));
        }
    }
}
