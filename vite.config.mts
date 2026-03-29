import { fileURLToPath } from "node:url";
import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
    resolve: {
        alias: {
            "@minecraft/server": fileURLToPath(
                new URL(
                    "./test/support/minecraft-server.mock.ts",
                    import.meta.url,
                ),
            ),
        },
    },
    test: {
        include: ["test/**/*.test.ts"],
        exclude: [
            ...configDefaults.exclude,
            "**/build/**",
            "**/lib/**",
            "**/lib-commonjs/**",
        ],
        watch: false,
    },
});
