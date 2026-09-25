import {
    CreationOptional,
    DataTypes,
    InferAttributes,
    InferCreationAttributes,
    Model,
    Sequelize,
} from 'sequelize';
import {
    defaultIdColumnAttributes,
    defaultModelOptionsWithHooks,
} from '../../utils/models.utils';

class Group extends Model<
    InferAttributes<Group>,
    InferCreationAttributes<Group>
> {
    declare id: CreationOptional<string>;
    declare name: string;
    declare description: string;

    static initModel(sequelize: Sequelize): void {
        Group.init(
            {
                id: defaultIdColumnAttributes(),
                name: {
                    type: DataTypes.TEXT,
                    allowNull: false,
                    validate: {
                        len: [1, 128],
                    },
                },
                description: {
                    type: DataTypes.TEXT,
                    allowNull: false,
                    validate: {
                        len: [1, 256],
                    },
                },
            },
            defaultModelOptionsWithHooks(sequelize),
        );
    }
}

export { Group as _Group };
