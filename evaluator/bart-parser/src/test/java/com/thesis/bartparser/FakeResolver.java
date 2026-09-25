package com.thesis.bartparser;

import java.util.Map;

import bart.core.Attributes;
import bart.core.NameResolver;
import bart.core.semantics.UndefinedName;

/**
 * Minimal {@link NameResolver} double: unqualified names only, from a fixed map, with
 * {@code requester.} prefixed for the requester form. The typed overloads throw, since the parser
 * resolves names untyped and implements them only to satisfy the engine's interface.
 */
public final class FakeResolver implements NameResolver {

    private final Map<String, Object> values;

    public FakeResolver(Map<String, Object> values) {
        this.values = values;
    }

    private Object get(String name) throws UndefinedName {
        if (!values.containsKey(name)) {
            throw new UndefinedName(name);
        }
        return values.get(name);
    }

    @Override
    public Object name(String name) throws UndefinedName {
        return get(name);
    }

    @Override
    public Object nameFromRequester(String name) throws UndefinedName {
        return get("requester." + name);
    }

    @Override
    public Object nameFromParty(String name, Attributes party) throws UndefinedName {
        return get(name);
    }

    @Override
    public <T> T name(String name, Class<T> type) {
        throw new UnsupportedOperationException("the parser resolves names untyped");
    }

    @Override
    public <T> T nameFromRequester(String name, Class<T> type) {
        throw new UnsupportedOperationException("the parser resolves names untyped");
    }

    @Override
    public <T> T nameFromParty(String name, Attributes party, Class<T> type) {
        throw new UnsupportedOperationException("the parser resolves names untyped");
    }
}
