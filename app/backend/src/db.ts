import { Client } from 'pg';
import { Sequelize } from 'sequelize';
import { initializeModels } from './models/models';
import { log, now } from './utils/general.utils';

export async function db(
    connectionString: string,
    dbSchema?: string,
    logging: boolean = false,
): Promise<Sequelize> {
    if (!connectionString.startsWith('postgres://')) {
        throw new Error('Database dialect not currently supported');
    }

    if (dbSchema) {
        await ensureSchemaExists(connectionString, dbSchema);
    }
    //@ts-expect-error: Sequelize's types omit `searchPath`, but it does set
    //                  postgres's search_path in every queryInterface call.
    const sequelize = new Sequelize(connectionString, {
        logging: logging ? console.log : false,
        schema: dbSchema,
        dialectOptions: {
            prependSearchPath: true,
        },
        searchPath: dbSchema,
    });

    try {
        await sequelize.authenticate();
        log('[db] Connection to the DB established successfully.');
    } catch (error) {
        console.error(
            `[${now()}]: [db] Unable to connect to the database:`,
            error,
        );
    }
    initializeModels(sequelize);
    return sequelize;
}

async function ensureSchemaExists(
    connectionString: string,
    schemaName: string,
) {
    if (!/^[a-z][a-z0-9_]*$/.test(schemaName))
        throw new Error('Invalid format of schema name');

    const client = new Client({ connectionString });
    try {
        await client.connect();
        // Safe: schemaName is validated above.
        await client.query(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`);
    } finally {
        await client.end();
    }
}

async function setup(
    connectionString: string,
    dbSchema?: string,
    logging: boolean = false,
): Promise<Sequelize> {
    const dbInstance = await db(connectionString, dbSchema, logging);
    await dbInstance.sync({ alter: true });
    return dbInstance;
}

export default setup;
