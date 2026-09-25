import { FastifyInstance } from 'fastify';
import { SwaggerRawSchema, SwaggerUiSchema } from '../schemas/swagger.schema';
import {
    FastifyReplyTypebox,
    FastifyRequestTypebox,
} from '../utils/typebox.utils';

async function get_raw(
    this: FastifyInstance,
    request: FastifyRequestTypebox<typeof SwaggerRawSchema>,
    reply: FastifyReplyTypebox<typeof SwaggerRawSchema>,
) {
    return reply
        .status(200)
        .type('application/yaml')
        .header(
            'content-disposition',
            'attachment; filename=BartShare-openapi.yaml',
        )
        .send(this.swagger({ yaml: true }));
}

async function get_ui(
    this: FastifyInstance,
    request: FastifyRequestTypebox<typeof SwaggerUiSchema>,
    reply: FastifyReplyTypebox<typeof SwaggerUiSchema>,
) {
    return (
        reply
            .status(200)
            .type('text/html')
            // frame-ancestors is open so the frontend can embed this page: a demo
            // app, not a public deployment, same reason CORS reflects any origin.
            .header(
                'content-security-policy',
                "default-src 'self';base-uri 'self';font-src 'self' https: data:;form-action 'self';frame-ancestors *;img-src 'self' data: https://cdn.redoc.ly/ ;object-src 'none';script-src 'self' https://cdn.redoc.ly/ ;worker-src blob:;script-src-attr 'none';style-src 'self' https: 'unsafe-inline';upgrade-insecure-requests",
            ).send(`
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8" />
<title>BartShare - API documentation</title>
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
    body {
        padding: 0;
        margin: 0;
    }
</style>
</head>
<body>
<redoc spec-url="/api/v1/swagger/raw"></redoc>
<script src="https://cdn.redoc.ly/redoc/latest/bundles/redoc.standalone.js"> </script>
</body>
</html>
`)
    );
}

export default { get_raw, get_ui };
