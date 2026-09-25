import swaggerController from '../controllers/swagger.controller';
import { SwaggerRawSchema, SwaggerUiSchema } from '../schemas/swagger.schema';
import { wrapSchema } from '../utils/schemas.utils';
import { FastifyTypebox } from '../utils/typebox.utils';

//prettier-ignore
async function routeCallback(fastify: FastifyTypebox) {
    fastify.get('/raw', wrapSchema(SwaggerRawSchema), swaggerController.get_raw);
    fastify.get('/ui', wrapSchema(SwaggerUiSchema), swaggerController.get_ui);
}

export default routeCallback;
