import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // shadcn CLI-generated code (never hand-edited, see .prettierignore):
    "src/components/ui/**",
    "src/hooks/use-mobile.ts",
    // Monaco's AMD build, copied by scripts/sync-monaco.mjs (see .gitignore):
    "public/monaco/**",
    // v8 coverage output, written by npm run coverage (see .gitignore):
    "coverage/**",
  ]),
]);

export default eslintConfig;
