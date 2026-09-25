'use strict';

// Test-only. Loaded through `node-arg` in .taprc, never by the app itself.
// Shrinks the pool's idle socket lifetime so tap's implicit root-test end
// (gated on the event loop going empty) isn't stalled behind it.

const sequelize = require('sequelize');

const Sequelize = sequelize.Sequelize;
const TEST_POOL = { idle: 250, evict: 250 };

// src/db.ts constructs every `Sequelize` this project builds, and always
// passes an options object, hence no defensive handling of the arguments.
// Callers keep the last word: an explicit `pool` in the options still wins.
function ShortPoolSequelize(connectionString, options) {
    return Reflect.construct(
        Sequelize,
        [
            connectionString,
            { ...options, pool: { ...TEST_POOL, ...options.pool } },
        ],
        new.target,
    );
}

Object.setPrototypeOf(ShortPoolSequelize, Sequelize);
ShortPoolSequelize.prototype = Sequelize.prototype;

sequelize.Sequelize = ShortPoolSequelize;
