import { fileURLToPath } from "node:url";
import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
    resolve: {
        alias: [
            {
                find: /^@blurengine\/bebe\/bedrock$/,
                replacement: fileURLToPath(
                    new URL("./src/bedrock/index.ts", import.meta.url),
                ),
            },
            {
                find: /^@blurengine\/bebe\/maths$/,
                replacement: fileURLToPath(
                    new URL("./src/maths/index.ts", import.meta.url),
                ),
            },
            {
                find: /^@blurengine\/bebe\/catalog$/,
                replacement: fileURLToPath(
                    new URL("./src/catalog/index.ts", import.meta.url),
                ),
            },
            {
                find: /^@blurengine\/bebe$/,
                replacement: fileURLToPath(
                    new URL("./src/index.ts", import.meta.url),
                ),
            },
            {
                find: "@minecraft/server",
                replacement: fileURLToPath(
                    new URL(
                        "./test/support/minecraft-server.mock.ts",
                        import.meta.url,
                    ),
                ),
            },
        ],
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
