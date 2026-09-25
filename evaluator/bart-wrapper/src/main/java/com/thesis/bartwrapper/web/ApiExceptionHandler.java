package com.thesis.bartwrapper.web;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import com.thesis.bartparser.BartSyntaxException;
import com.thesis.bartwrapper.BartInputException;
import com.thesis.bartwrapper.BartSyntaxInputException;
import com.thesis.bartwrapper.ContextArityException;
import com.thesis.bartwrapper.InvalidRequesterException;
import com.thesis.bartwrapper.MissingInputException;
import com.thesis.bartwrapper.UnknownKindException;
import com.thesis.bartwrapper.validate.SyntaxError;

/** Maps the domain's failure modes onto HTTP status codes. */
@RestControllerAdvice
public class ApiExceptionHandler {

    /** Bad `.bart` inside a request body, with the position the parser reported. */
    @ExceptionHandler(BartSyntaxInputException.class)
    public ResponseEntity<ApiError> handleSyntaxInput(BartSyntaxInputException e) {
        BartSyntaxException syntax = e.getSyntaxError();
        return ResponseEntity.badRequest()
            .body(new ApiError(
                "bart-syntax", syntax.getMessage(), e.getLocation(), SyntaxError.of(syntax)));
    }

    /** Text that parsed but would not build a model, e.g. a duplicate attribute key. */
    @ExceptionHandler(BartInputException.class)
    public ResponseEntity<ApiError> handleInput(BartInputException e) {
        return ResponseEntity.badRequest()
            .body(new ApiError(
                "bart-model", e.getMessage(), e.getLocation(), null));
    }

    /**
     * An untagged syntax error: still a client error, just without a location.
     * <p>
     * Looks dead while every parser call is tagged, but deleting it would leave a future
     * untagged call falling through to a 500 instead of failing safe at 400.
     * </p>
     */
    @ExceptionHandler(BartSyntaxException.class)
    public ResponseEntity<ApiError> handleSyntax(BartSyntaxException e) {
        return ResponseEntity.badRequest()
            .body(new ApiError("bart-syntax", e.getMessage(), null, SyntaxError.of(e)));
    }

    /** Location is always {@code "context"}: never a policy or a request. */
    @ExceptionHandler(ContextArityException.class)
    public ResponseEntity<ApiError> handleArity(ContextArityException e) {
        return ResponseEntity.badRequest()
            .body(new ApiError("context-arity", e.getMessage(), "context", null));
    }

    /** A required body field was absent or blank; the exception carries its own slug. */
    @ExceptionHandler(MissingInputException.class)
    public ResponseEntity<ApiError> handleMissing(MissingInputException e) {
        return ResponseEntity.badRequest().body(ApiError.of(e.getSlug(), e.getMessage()));
    }

    /** An out-of-range requester is malformed input, not a missing resource. */
    @ExceptionHandler(InvalidRequesterException.class)
    public ResponseEntity<ApiError> handleRequester(InvalidRequesterException e) {
        return ResponseEntity.badRequest()
            .body(new ApiError("invalid-requester", e.getMessage(), "request", null));
    }

    /** Body that isn't readable JSON at all; reported in the same shape as everything else. */
    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<ApiError> handleUnreadableBody(HttpMessageNotReadableException e) {
        return ResponseEntity.badRequest()
            .body(ApiError.of("malformed-body", "request body is missing or is not valid JSON"));
    }

    /** The only handler returning 404: the path itself doesn't resolve to a validator. */
    @ExceptionHandler(UnknownKindException.class)
    public ResponseEntity<ApiError> handleUnknownKind(UnknownKindException e) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
            .body(ApiError.of("unknown-kind", e.getMessage()));
    }
}
