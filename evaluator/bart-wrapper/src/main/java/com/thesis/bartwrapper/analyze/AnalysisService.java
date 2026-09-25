package com.thesis.bartwrapper.analyze;

import java.util.List;
import java.util.stream.IntStream;

import org.springframework.stereotype.Service;

import com.thesis.bartwrapper.BartInputException;
import com.thesis.bartwrapper.PolicyInputs;

/**
 * Analyses a batch of policies in one call: the caller runs a fixpoint over the party set,
 * and one round trip per round beats one per policy.
 */
@Service
public class AnalysisService {

    private final PolicyAnalyzer analyzer;

    public AnalysisService(PolicyAnalyzer analyzer) {
        this.analyzer = analyzer;
    }

    public AnalysisResponse analyze(AnalysisRequest input) {
        List<String> sources = PolicyInputs.require(input.policies());

        return new AnalysisResponse(IntStream.range(0, sources.size())
            .mapToObj(i -> {
                String source = sources.get(i);
                return BartInputException.tagging("policy " + (i + 1),
                    () -> analyzer.analyze(source));
            })
            .toList());
    }
}
