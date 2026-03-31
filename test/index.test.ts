import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import * as bebe from "../src/index.js";
import {
    Context,
    ROOT_CONTEXT,
    RootContext,
    createServiceKey,
    isRootContext,
} from "../src/context.js";

const packageJsonPath = path.resolve(import.meta.dirname, "..", "package.json");
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8")) as {
    exports: Record<string, { import: string; types: string }>;
};

describe("package root exports", () => {
    it("re-exports the context surface only", () => {
        expect(Object.keys(bebe).sort()).toEqual(
            [
                "Context",
                "ROOT_CONTEXT",
                "RootContext",
                "createServiceKey",
                "isRootContext",
                "isValidContext",
                "mustContext",
            ].sort(),
        );
    });

    it("matches the direct context exports", () => {
        expect(bebe.Context).toBe(Context);
        expect(bebe.ROOT_CONTEXT).toBe(ROOT_CONTEXT);
        expect(bebe.RootContext).toBe(RootContext);
        expect(bebe.createServiceKey).toBe(createServiceKey);
        expect(bebe.isRootContext).toBe(isRootContext);
    });

    it("declares the context root and maths subpath exports", () => {
        expect(packageJson.exports).toEqual({
            ".": {
                import: "./lib/index.js",
                types: "./lib/types/bebe-public.d.ts",
            },
            "./maths": {
                import: "./lib/maths/index.js",
                types: "./lib/types/bebe-public.d.ts",
            },
        });
    });
});
