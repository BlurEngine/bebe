import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import * as bebe from "@blurengine/bebe";
import * as bedrock from "@blurengine/bebe/bedrock";
import * as catalog from "@blurengine/bebe/catalog";
import * as fishing from "@blurengine/bebe/features/fishing";
import * as internalLinkBds from "@blurengine/bebe/internal/link/bds";
import * as internalZonesEditor from "@blurengine/bebe/internal/zones/editor";
import * as maths from "@blurengine/bebe/maths";
import * as toolingNode from "@blurengine/bebe/tooling/node";
import {
    Context,
    EventSignal,
    Link,
    Metrics,
    ROOT_CONTEXT,
    RootContext,
    ZONE_DRAFT_SAVE_EVENT,
    ZoneDraft,
    Zones,
    createServiceKey,
    createZoneDraft,
    isRootContext,
    requestZoneDraftSave,
    stagger,
    staggerByGroup,
    staggerGroups,
} from "@blurengine/bebe";

const packageJsonPath = path.resolve(import.meta.dirname, "..", "package.json");
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8")) as {
    exports: Record<string, { default: string; types: string }>;
};

describe("package root exports", () => {
    it("re-exports the runtime ownership surface", () => {
        expect(Object.keys(bebe).sort()).toEqual(
            [
                "Context",
                "EventSignal",
                "Link",
                "Metrics",
                "ROOT_CONTEXT",
                "RootContext",
                "ZONE_DRAFT_SAVE_EVENT",
                "ZoneDraft",
                "Zones",
                "createServiceKey",
                "createZoneDraft",
                "isRootContext",
                "isValidContext",
                "mustContext",
                "requestZoneDraftSave",
                "stagger",
                "staggerByGroup",
                "staggerGroups",
            ].sort(),
        );
    });

    it("matches the direct root exports", () => {
        expect(bebe.Context).toBe(Context);
        expect(bebe.EventSignal).toBe(EventSignal);
        expect(bebe.Link).toBe(Link);
        expect(bebe.Metrics).toBe(Metrics);
        expect(bebe.ROOT_CONTEXT).toBe(ROOT_CONTEXT);
        expect(bebe.RootContext).toBe(RootContext);
        expect(bebe.ZONE_DRAFT_SAVE_EVENT).toBe(ZONE_DRAFT_SAVE_EVENT);
        expect(bebe.ZoneDraft).toBe(ZoneDraft);
        expect(bebe.Zones).toBe(Zones);
        expect(bebe.createServiceKey).toBe(createServiceKey);
        expect(bebe.createZoneDraft).toBe(createZoneDraft);
        expect(bebe.isRootContext).toBe(isRootContext);
        expect(bebe.requestZoneDraftSave).toBe(requestZoneDraftSave);
        expect(bebe.stagger).toBe(stagger);
        expect(bebe.staggerByGroup).toBe(staggerByGroup);
        expect(bebe.staggerGroups).toBe(staggerGroups);
    });

    it("exposes the bedrock subpath", () => {
        expect(Object.keys(bedrock).sort()).toEqual(
            [
                "applyDurabilityToItem",
                "applyDurabilityToSelectedSlot",
                "applyDurabilityToSlot",
                "attemptBedrock",
                "collectAdjacentBlocks",
                "destroyBlockAt",
                "findAdjacentBlock",
                "floodFillBlocks",
                "getBlockAt",
                "getBlockTypeId",
                "getEntityItemStack",
                "getRemainingItemUses",
                "getSelectedSlot",
                "getSlotItem",
                "isAirBlock",
                "isLiquidBlock",
                "setBlockTypeAt",
                "someAdjacentBlock",
            ].sort(),
        );
    });

    it("exposes the catalog subpath", () => {
        expect(Object.keys(catalog).sort()).toEqual(
            [
                "BlockCatalog",
                "createBlockCatalog",
                "extendBlockCatalog",
                "vanillaBlockCatalog",
                "vanillaBlockCatalogEntries",
            ].sort(),
        );
    });

    it("exposes the fishing feature subpath", () => {
        expect(Object.keys(fishing).sort()).toEqual(
            ["DEFAULT_FISHING_EVENT_CONFIG", "installFishingEvents"].sort(),
        );
    });

    it("exposes the BDS Link transport through the internal tooling subpath", () => {
        expect(Object.keys(internalLinkBds).sort()).toEqual(
            [
                "BdsLinkTransport",
                "createBdsLinkTransport",
                "createNativeBdsLinkHttpClient",
                "installBdsLinkTransport",
            ].sort(),
        );
    });

    it("exposes the Bebe zone editor through the internal tooling subpath", () => {
        expect(Object.keys(internalZonesEditor).sort()).toEqual(
            [
                "createZoneEditorInteractionAction",
                "installZoneEditor",
                "parseZoneEditorCommand",
            ].sort(),
        );
    });

    it("exposes node-only Bebe tooling through its own subpath", () => {
        expect(Object.keys(toolingNode).sort()).toEqual(
            [
                "DEFAULT_ZONE_COMPILED_CELL_SIZE",
                "DEFAULT_ZONE_COMPILED_MAX_CELLS_PER_ZONE",
                "GENERATED_ZONES_FILE",
                "PROJECT_ZONES_FILE",
                "ZONE_COMPILED_FORMAT_VERSION",
                "ZONE_DRAFT_SAVE_EVENT",
                "compileZonePack",
                "createBebeTooling",
                "createZonesAssetCompiler",
                "normalizeZoneCompiledPack",
                "normalizeZoneDefinition",
                "normalizeZoneExtentDefinition",
                "normalizeZonePack",
                "validateZoneReferences",
                "zonesAssetCompiler",
            ].sort(),
        );
    });

    it("exposes the maths subpath", () => {
        expect(maths.BoxExtent).toBeDefined();
        expect(maths.CylinderExtent).toBeDefined();
        expect(maths.InfiniteExtent).toBeDefined();
        expect(maths.PolygonExtent).toBeDefined();
        expect(maths.VoxelMap).toBeDefined();
        expect(maths.VoxelSet).toBeDefined();
        expect(maths.boxExtent).toBeDefined();
        expect(maths.floodFillVoxelSet).toBeDefined();
        expect(maths.floodFillVoxels).toBeDefined();
    });

    it("declares the root, bedrock, maths, catalog, fishing, and internal Link transport exports", () => {
        expect(packageJson.exports).toEqual({
            ".": {
                types: "./lib/types/bebe-public.d.ts",
                default: "./lib/index.js",
            },
            "./bedrock": {
                types: "./lib/types/bebe-public.d.ts",
                default: "./lib/bedrock/index.js",
            },
            "./maths": {
                types: "./lib/types/bebe-public.d.ts",
                default: "./lib/maths/index.js",
            },
            "./catalog": {
                types: "./lib/types/bebe-public.d.ts",
                default: "./lib/catalog/index.js",
            },
            "./features/fishing": {
                types: "./lib/types/bebe-public.d.ts",
                default: "./lib/features/fishing/index.js",
            },
            "./internal/link/bds": {
                types: "./lib/types/bebe-public.d.ts",
                default: "./lib/internal/link/bds.js",
            },
            "./internal/zones/editor": {
                types: "./lib/types/bebe-public.d.ts",
                default: "./lib/internal/zones/editor.js",
            },
            "./tooling/node": {
                types: "./lib/types/bebe-public.d.ts",
                default: "./lib/tooling/node.js",
            },
        });
    });
});
