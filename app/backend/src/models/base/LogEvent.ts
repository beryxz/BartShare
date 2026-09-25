import {
    CreationOptional,
    DataTypes,
    ForeignKey,
    InferAttributes,
    InferCreationAttributes,
    Model,
    NonAttribute,
    Sequelize,
} from 'sequelize';
import {
    defaultIdColumnAttributes,
    defaultModelOptionsWithHooks,
    timestampColumnAttributes,
} from '../../utils/models.utils';
import { User } from '../models';

class LogEvent extends Model<
    InferAttributes<LogEvent>,
    InferCreationAttributes<LogEvent>
> {
    declare id: CreationOptional<string>;
    declare UserId: ForeignKey<User['id']>;
    declare type: string;
    declare data: Record<string, unknown> | null;
    declare occurred_at: string;

    // eager-loading attributes
    declare User?: NonAttribute<User>;

    static initModel(sequelize: Sequelize) {
        LogEvent.init(
            {
                id: defaultIdColumnAttributes(),
                type: {
                    type: DataTypes.TEXT,
                    allowNull: false,
                    validate: {
                        notNull: true,
                        len: [1, 256],
                    },
                },
                data: {
                    type: DataTypes.JSON,
                    allowNull: true,
                    validate: {
                        maxSize(value: Record<string, unknown> | null) {
                            if (value === null) return;
                            const size = Buffer.byteLength(
                                JSON.stringify(value),
                                'utf8',
                            );
                            if (size > 64 * 1024) {
                                throw new Error('data exceeds 64KB limit');
                            }
                        },
                    },
                },
                occurred_at: timestampColumnAttributes(),
            },
            defaultModelOptionsWithHooks(sequelize),
        );
    }
}

export { LogEvent as _LogEvent };
