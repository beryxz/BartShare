import {
    DataTypes,
    InitOptions,
    ModelAttributeColumnOptions,
    Sequelize,
} from 'sequelize';
import { ModelHooks } from 'sequelize/types/hooks';

function defaultModelOptions(sequelize: Sequelize): InitOptions {
    // timestamps are left at Sequelize's default: every model gets `createdAt`
    // and `updatedAt` DATE columns, managed by Sequelize.
    return {
        sequelize: sequelize,
    };
}

function defaultModelHooks(): Partial<ModelHooks> {
    return {};
}

function defaultModelOptionsWithHooks(sequelize: Sequelize): InitOptions {
    return {
        ...defaultModelOptions(sequelize),
        hooks: defaultModelHooks(),
    };
}

function defaultIdColumnAttributes(): ModelAttributeColumnOptions {
    return {
        type: DataTypes.UUID,
        primaryKey: true,
        allowNull: false,
        defaultValue: DataTypes.UUIDV4,
        validate: {
            isUUID: 4,
        },
    } as const;
}

/**
 * For explicit domain timestamps (e.g. `LogEvent.occurred_at`), stored as
 * ISO strings; not for `createdAt`/`updatedAt`, which Sequelize manages itself.
 */
function timestampColumnAttributes(): ModelAttributeColumnOptions {
    return {
        type: DataTypes.TEXT,
        validate: {
            len: [0, 64],
        },
    } as const;
}

export {
    defaultIdColumnAttributes,
    defaultModelHooks,
    defaultModelOptions,
    defaultModelOptionsWithHooks,
    timestampColumnAttributes,
};
