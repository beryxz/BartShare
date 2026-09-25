import { FastifyInstance } from 'fastify';
import { Sequelize } from 'sequelize';
import apiSetup from '../../src/api';
import config from '../../src/config';
import dbSetup from '../../src/db';
import { randomAlphanumericString } from '../../src/utils/general.utils';

/**
 * A Sequelize instance on a schema of its own, via a plain async function:
 * callers keep their own `t.before`/`t.after`, so fixture creation stays with
 * the bootstrap it depends on. The per-file isolated schema lets the suite
 * run files concurrently against one database, since fixtures from one file
 * are invisible to another.
 */
export async function bootDb(): Promise<Sequelize> {
    return dbSetup(
        config.DB_CONNECTION_STRING,
        `test_${randomAlphanumericString(16).toLowerCase()}`,
        config.DEBUG,
    );
}

/** `bootDb`, plus a ready Fastify instance bound to it. */
export async function bootApi(): Promise<{
    db: Sequelize;
    api: FastifyInstance;
}> {
    const db = await bootDb();
    const api = apiSetup(db);
    await api.ready();
    return { db, api };
}
