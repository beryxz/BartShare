import { FastifyDynamicSwaggerOptions } from '@fastify/swagger';
import { FastifyRegisterOptions } from 'fastify';
import * as process from 'process';
import { Type } from 'typebox';
import { Value } from 'typebox/value';
import validator from 'validator';
import { isPostgresConnectionString } from './utils/config.utils';

const EnvConfig = Type.Object({
    DEBUG: Type.String(),
    LOGGING: Type.String(),
    DB_CONNECTION_STRING: Type.String(),
    API_HOST: Type.String(),
    API_PORT: Type.String(),
    EVALUATOR_URL: Type.String(),
    EVALUATOR_TIMEOUT_MS: Type.String(),
});

type AppConfig = {
    DEBUG: boolean;
    LOGGING: boolean;
    DB_CONNECTION_STRING: string;
    API_HOST: string;
    API_PORT: number;
    EVALUATOR_URL: string;
    EVALUATOR_TIMEOUT_MS: number;
};

function isSupportedConnectionString(connectionString: string) {
    return isPostgresConnectionString(connectionString);
}

const appConfig: AppConfig = (() => {
    if (!Value.Check(EnvConfig, process.env))
        throw new Error('Invalid configuration file');

    if (!validator.isBoolean(process.env.DEBUG, { loose: false }))
        throw new Error('DEBUG is not a boolean');
    if (!validator.isBoolean(process.env.LOGGING, { loose: false }))
        throw new Error('LOGGING is not a boolean');
    if (!isSupportedConnectionString(process.env.DB_CONNECTION_STRING))
        throw new Error('DB_CONNECTION_STRING is not supported');

    if (!validator.isIP(process.env.API_HOST, 4))
        throw new Error('API_HOST is not an IPv4');
    if (!validator.isPort(process.env.API_PORT))
        throw new Error('API_PORT is not a valid port number');
    if (!validator.isURL(process.env.EVALUATOR_URL, { require_tld: false }))
        throw new Error('EVALUATOR_URL is not a valid URL');
    if (!validator.isInt(process.env.EVALUATOR_TIMEOUT_MS, { min: 1 }))
        throw new Error('EVALUATOR_TIMEOUT_MS is not a positive integer');

    return {
        DEBUG: validator.toBoolean(process.env.DEBUG),
        LOGGING: validator.toBoolean(process.env.LOGGING),
        DB_CONNECTION_STRING: process.env.DB_CONNECTION_STRING,
        API_HOST: process.env.API_HOST,
        API_PORT: parseInt(process.env.API_PORT),
        EVALUATOR_URL: process.env.EVALUATOR_URL,
        EVALUATOR_TIMEOUT_MS: parseInt(process.env.EVALUATOR_TIMEOUT_MS),
    };
})();

const SWAGGER_OPTIONS: FastifyRegisterOptions<FastifyDynamicSwaggerOptions> = {
    openapi: {
        info: {
            title: 'BartShare',
            description: 'BartShare API',
            version: '1.0.0',
        },
        servers: [{ url: '/' }],
        tags: [
            { name: 'users', description: 'Users endpoints' },
            { name: 'me', description: 'Logged user endpoints' },
            { name: 'resources', description: 'Resources endpoints' },
            { name: 'groups', description: 'Groups endpoints' },
            { name: 'dev', description: 'Developer and demo endpoints' },

            { name: 'swagger', description: 'OAS swagger endpoints' },
        ],
        externalDocs: undefined,
        components: {
            securitySchemes: {
                session_cookie: {
                    description: 'Application session cookie',
                    type: 'apiKey',
                    name: 'user',
                    in: 'cookie',
                },
            },
        },
        security: [],
    },
    hideUntagged: true,
    mode: 'dynamic',
    hiddenTag: appConfig.DEBUG ? undefined : 'X-HIDDEN',
    stripBasePath: true,
};

const APP_LIMITS = {
    users: {
        pageSize: 50,
    },
    dev: {
        eventsPageSize: 50,
    },
    resources: {
        pageSize: 50,
        maxContentBytes: 32 * 1024 * 1024,
        maxMetadataBytes: 64 * 1024,
        // High on purpose: a false "nothing is shared with you" is worse than
        // a slow page. Truncation is always reported, never silent.
        maxSharedCandidates: 500,
        sharedConcurrency: 8,
    },
    groups: {
        pageSize: 50,
    },
} as const;

export default appConfig;
export { APP_LIMITS, AppConfig, SWAGGER_OPTIONS };
