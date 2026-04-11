import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import * as bebe from "@blurengine/bebe";
import * as bedrock from "@blurengine/bebe/bedrock";
import * as catalog from "@blurengine/bebe/catalog";
import {
    Context,
    ROOT_CONTEXT,
    RootContext,
    createServiceKey,
    isRootContext,
    stagger,
    staggerGroups,
} from "@blurengine/bebe";

const packageJsonPath = path.resolve(import.meta.dirname, "..", "package.json");
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8")) as {
    exports: Record<string, { import: string; types: string }>;
};

describe("package root exports", () => {
    it("re-exports the runtime ownership surface", () => {
        expect(Object.keys(bebe).sort()).toEqual(
            [
                "Context",
                "ROOT_CONTEXT",
                "RootContext",
                "createServiceKey",
                "isRootContext",
                "isValidContext",
                "mustContext",
                "stagger",
                "staggerGroups",
            ].sort(),
        );
    });

    it("matches the direct root exports", () => {
        expect(bebe.Context).toBe(Context);
        expect(bebe.ROOT_CONTEXT).toBe(ROOT_CONTEXT);
        expect(bebe.RootContext).toBe(RootContext);
        expect(bebe.createServiceKey).toBe(createServiceKey);
        expect(bebe.isRootContext).toBe(isRootContext);
        expect(bebe.stagger).toBe(stagger);
        expect(bebe.staggerGroups).toBe(staggerGroups);
    });

    it("exposes the bedrock subpath", () => {
        expect(Object.keys(bedrock).sort()).toEqual(
            [
                "applyDurabilityToItem",
                "applyDurabilityToSelectedSlot",
                "applyDurabilityToSlot",
                "attemptBedrock",
                "destroyBlockAt",
                "getBlockAt",
                "getBlockTypeId",
                "getRemainingItemUses",
                "getSelectedSlot",
                "getSlotItem",
                "isAirBlock",
                "isLiquidBlock",
                "setBlockTypeAt",
            ].sort(),
        );
    });

    it("exposes the catalog subpath", () => {
        expect(Object.keys(catalog).sort()).toEqual(
            [
                "BlockCatalog",
                "createBlockCatalog",
                "extendBlockCatalog",
                "getCatalogFamilyTag",
                "getCatalogFamilyTags",
                "getFamilyTag",
                "getFamilyTags",
                "getTagWithPrefix",
                "getTagsWithPrefix",
                "queryCatalogFamily",
                "queryFamily",
                "vanillaBlockCatalog",
                "vanillaBlockCatalogEntries",
            ].sort(),
        );
    });

    it("declares the root, bedrock, maths, and catalog exports", () => {
        expect(packageJson.exports).toEqual({
            ".": {
                import: "./lib/index.js",
                types: "./lib/types/bebe-public.d.ts",
            },
            "./bedrock": {
                import: "./lib/bedrock/index.js",
                types: "./lib/types/bebe-public.d.ts",
            },
            "./maths": {
                import: "./lib/maths/index.js",
                types: "./lib/types/bebe-public.d.ts",
            },
            "./catalog": {
                import: "./lib/catalog/index.js",
                types: "./lib/types/bebe-public.d.ts",
            },
        });
    });
});
