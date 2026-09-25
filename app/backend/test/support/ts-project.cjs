'use strict';

// Test-only. Loaded through `node-arg` in .taprc, never by the app itself.
// Sets TS_NODE_PROJECT directly, since `.taprc`'s own `tsconfig:` field
// doesn't reach ts-node here. Do not convert this file to ESM: the fix
// depends on `--require` preload order. Overwrites any TS_NODE_PROJECT
// already set, so the suite always compiles against one known config.

const { resolve } = require('path');

process.env.TS_NODE_PROJECT = resolve(
    __dirname,
    '..',
    '..',
    'tsconfig.tap.json',
);
