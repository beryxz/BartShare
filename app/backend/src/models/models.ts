import { Sequelize } from 'sequelize';
import { _Group as Group } from './base/Group';
import { _LogEvent as LogEvent } from './base/LogEvent';
import { _Resource as Resource } from './base/Resource';
import { _User as User } from './base/User';

/**
 * Single import point for all models, decoupling callers from each model's
 * own file.
 */
export { Group, LogEvent, Resource, User };

function setupModels(sequelize: Sequelize): void {
    [LogEvent, User, Resource, Group].forEach(m => m.initModel(sequelize));
}

function setupAssociations(): void {
    User.belongsToMany(User, { as: 'Connections', through: 'UserConnections' });

    User.hasMany(Resource);
    Resource.belongsTo(User);

    User.belongsToMany(Group, { through: 'UserGroups' });
    Group.belongsToMany(User, { through: 'UserGroups' });

    User.hasMany(LogEvent);
    LogEvent.belongsTo(User);
}

export function initializeModels(sequelize: Sequelize): void {
    setupModels(sequelize);
    setupAssociations();
}
