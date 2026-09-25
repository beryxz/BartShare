import validator from 'validator';

function isPostgresConnectionString(value: string): boolean {
    return validator.isURL(value, {
        protocols: ['postgres'],
        require_protocol: true,
        require_valid_protocol: true,
        require_host: true,
        allow_query_components: true,
        require_tld: false,
        require_port: false,
        disallow_auth: false,
        allow_protocol_relative_urls: false,
        allow_underscores: false,
    });
}

export { isPostgresConnectionString };
