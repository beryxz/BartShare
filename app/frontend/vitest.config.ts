import { defineConfig } from 'vitest/config';

export default defineConfig({
    // Vite >= 8 natively resolves the tsconfig mapping: `@/*` -> `./src/*`
    resolve: { tsconfigPaths: true },
    test: {
        // Root-level, not per-project: coverage spans both projects at once.
        coverage: {
            provider: 'v8',
            include: ['src/**'],
            // `src/test/` is the harness and `src/components/ui/` is generated
            exclude: [
                'src/**/*.test.*',
                'src/test/**',
                'src/components/ui/**',
            ],
        },
        projects: [
            {
                extends: true,
                test: {
                    name: 'logic',
                    environment: 'node',
                    include: ['src/**/*.test.ts'],
                },
            },
            {
                extends: true,
                test: {
                    name: 'dom',
                    environment: 'jsdom',
                    include: ['src/**/*.test.tsx'],
                    setupFiles: ['./src/test/setup.ts'],
                },
            },
        ],
    },
});
