// Copies Monaco's AMD build into `public/` so the editor is served from this
// origin, never jsdelivr, which would break an offline demo and the standalone
// image. Runs from `predev` and `prebuild`; the output is gitignored.
import { cpSync, existsSync, rmSync } from 'node:fs';

const from = 'node_modules/monaco-editor/min/vs';
const to = 'public/monaco/vs';

if (!existsSync(from)) {
    console.error(`sync-monaco: ${from} is missing, run npm install first`);
    process.exit(1);
}

rmSync('public/monaco', { recursive: true, force: true });
cpSync(from, to, { recursive: true });
console.log(`sync-monaco: copied ${from} -> ${to}`);
