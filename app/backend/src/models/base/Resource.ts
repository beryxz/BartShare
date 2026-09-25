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
import { APP_LIMITS } from '../../config';
import {
    defaultIdColumnAttributes,
    defaultModelOptionsWithHooks,
} from '../../utils/models.utils';
import { User } from '../models';

class Resource extends Model<
    InferAttributes<Resource>,
    InferCreationAttributes<Resource>
> {
    declare id: CreationOptional<string>;
    declare attrs: Record<string, unknown>;
    declare metadata: CreationOptional<Record<string, unknown>>;
    declare content: CreationOptional<Buffer | null>;
    declare contentType: CreationOptional<string | null>;
    declare contentSize: CreationOptional<number | null>;
    declare contentFilename: CreationOptional<string | null>;
    declare UserId: ForeignKey<User['id']>;

    // eager-loading attributes
    declare User?: NonAttribute<User>;

    static initModel(sequelize: Sequelize): void {
        Resource.init(
            {
                id: defaultIdColumnAttributes(),
                // JSONB, not JSON, for `@>` containment support.
                attrs: {
                    type: DataTypes.JSONB,
                    allowNull: false,
                    validate: {
                        maxSize(value: Record<string, unknown>) {
                            const size = Buffer.byteLength(
                                JSON.stringify(value),
                                'utf8',
                            );
                            if (size > APP_LIMITS.resources.maxMetadataBytes) {
                                throw new Error('attrs exceeds 64KB limit');
                            }
                        },
                        minSize(value: Record<string, unknown>) {
                            if (Object.keys(value).length < 1) {
                                throw new Error(
                                    'Resource must have at least one attribute',
                                );
                            }
                        },
                    },
                },
                metadata: {
                    type: DataTypes.JSONB,
                    allowNull: false,
                    // Lets `sync({alter:true})` add this NOT NULL column to a
                    // populated DB; old rows read as `{}` and fail on re-save.
                    defaultValue: {},
                    validate: {
                        isPlainObject(value: unknown) {
                            if (
                                value === null ||
                                typeof value !== 'object' ||
                                Array.isArray(value)
                            )
                                throw new Error(
                                    'metadata must be a JSON object',
                                );
                        },
                        hasName(value: Record<string, unknown>) {
                            const name = value?.name;
                            if (
                                typeof name !== 'string' ||
                                name.trim().length === 0
                            )
                                throw new Error(
                                    "metadata: 'name' is required and must be " +
                                        'a non-empty string',
                                );
                            if (name.trim().length > 256)
                                throw new Error(
                                    "metadata: 'name' must be at most 256 " +
                                        'characters',
                                );
                        },
                        descriptionIsText(value: Record<string, unknown>) {
                            const description = value?.description;
                            if (description === undefined) return;
                            if (typeof description !== 'string')
                                throw new Error(
                                    "metadata: 'description' must be a string",
                                );
                            if (description.length > 2048)
                                throw new Error(
                                    "metadata: 'description' must be at most " +
                                        '2048 characters',
                                );
                        },
                        maxSize(value: Record<string, unknown>) {
                            const size = Buffer.byteLength(
                                JSON.stringify(value),
                                'utf8',
                            );
                            if (size > APP_LIMITS.resources.maxMetadataBytes)
                                throw new Error('metadata exceeds 64KB limit');
                        },
                    },
                },
                // Never select this column outside its own routes: every
                // other read goes through RESOURCE_VIEW_ATTRIBUTES.
                content: {
                    type: DataTypes.BLOB,
                    allowNull: true,
                },
                contentType: {
                    type: DataTypes.TEXT,
                    allowNull: true,
                    validate: { len: [1, 255] },
                },
                contentSize: {
                    type: DataTypes.INTEGER,
                    allowNull: true,
                },
                contentFilename: {
                    type: DataTypes.TEXT,
                    allowNull: true,
                    validate: { len: [1, 255] },
                },
            },
            defaultModelOptionsWithHooks(sequelize),
        );
    }
}

export { Resource as _Resource };
