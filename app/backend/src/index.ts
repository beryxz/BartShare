import apiSetup from './api';
import config from './config';
import dbSetup from './db';
import { log } from './utils/general.utils';

async function main() {
    const dbInstance = await dbSetup(
        config.DB_CONNECTION_STRING,
        undefined,
        config.DEBUG,
    );

    const apiServer = apiSetup(dbInstance);
    apiServer.listen(
        { host: config.API_HOST, port: config.API_PORT },
        (err, address) => {
            if (err) {
                console.error(err);
                process.exit(1);
            }
            log(`[app] API server listening at ${address}`);
        },
    );

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
    async function shutdown() {
        log('[app] Shutting down gracefully...');
        try {
            await apiServer.close();
            await dbInstance.close();
            process.exit(0);
        } catch (error) {
            console.error(error);
            process.exit(1);
        }
    }
}

(async () => await main())();
