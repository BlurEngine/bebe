import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import * as bebe from "@blurengine/bebe";
import * as bedrock from "@blurengine/bebe/bedrock";
import * as catalog from "@blurengine/bebe/catalog";
import * as fishing from "@blurengine/bebe/features/fishing";
import * as internalLinkBds from "@blurengine/bebe/internal/link/bds";
import * as internalAudioPlayer from "@blurengine/bebe/internal/audio/player";
import * as internalZonesEditor from "@blurengine/bebe/internal/zones/editor";
import * as maths from "@blurengine/bebe/maths";
import * as toolingNode from "@blurengine/bebe/tooling/node";
import {
    Context,
    EventSignal,
    Link,
    Metrics,
    Audio,
    ROOT_CONTEXT,
    RenderAnchors,
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
const srcRoot = path.resolve(import.meta.dirname, "..", "src");

describe("package root exports", () => {
    it("re-exports the runtime ownership surface", () => {
        expect(Object.keys(bebe).sort()).toEqual(
            [
                "Context",
                "EventSignal",
                "Link",
                "Metrics",
                "Audio",
                "ROOT_CONTEXT",
                "RenderAnchors",
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
        expect(bebe.Audio).toBe(Audio);
        expect(bebe.ROOT_CONTEXT).toBe(ROOT_CONTEXT);
        expect(bebe.RenderAnchors).toBe(RenderAnchors);
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

    it("keeps render-anchor spatial types on the shared maths vocabulary", () => {
        const publicSource = fs.readFileSync(
            path.join(srcRoot, "index.ts"),
            "utf8",
        );
        const toolingSource = fs.readFileSync(
            path.join(srcRoot, "tooling", "node.ts"),
            "utf8",
        );
        const runtimeSource = fs.readFileSync(
            path.join(srcRoot, "render-anchors.ts"),
            "utf8",
        );
        const definitionSource = fs.readFileSync(
            path.join(srcRoot, "render-anchors", "definitions.ts"),
            "utf8",
        );

        expect(
            `${publicSource}\n${toolingSource}\n${runtimeSource}\n${definitionSource}`,
        ).not.toMatch(
            /RenderAnchor(?:Location|BlockLocation|Vec3Definition)\b/,
        );
        expect(runtimeSource).toContain(
            'import { Vec3, type Vec3Init, type Vec3Like } from "./maths/vec3.js";',
        );
        expect(definitionSource).toMatch(/type Vec3Init,\s*type Vec3Like/);
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

    it("exposes the Bebe audio player command through the internal tooling subpath", () => {
        expect(Object.keys(internalAudioPlayer).sort()).toEqual(
            ["installAudioPlayerCommand", "parseAudioPlayerCommand"].sort(),
        );
    });

    it("exposes node-only Bebe tooling through its own subpath", () => {
        expect(Object.keys(toolingNode).sort()).toEqual(
            [
                "BAUD_FILE_EXTENSION",
                "DEFAULT_AUDIO_CENTS",
                "DEFAULT_AUDIO_LENGTH",
                "DEFAULT_AUDIO_OCTAVE",
                "DEFAULT_AUDIO_PAN",
                "DEFAULT_AUDIO_TEMPO",
                "DEFAULT_AUDIO_VOLUME",
                "DEFAULT_RENDER_ANCHOR_DIMENSION",
                "DEFAULT_RENDER_ANCHOR_REPOSITION_THRESHOLD",
                "DEFAULT_RENDER_ANCHOR_SEARCH_RADIUS",
                "DEFAULT_ZONE_COMPILED_CELL_SIZE",
                "DEFAULT_ZONE_COMPILED_MAX_CELLS_PER_ZONE",
                "GENERATED_AUDIO_FILE",
                "GENERATED_AUDIO_VISUALS_FILE",
                "GENERATED_RENDER_ANCHORS_FILE",
                "GENERATED_ZONES_FILE",
                "AUDIO_COMPILED_FORMAT_VERSION",
                "PROJECT_AUDIO_DIRECTORY",
                "PROJECT_RENDER_ANCHORS_FILE",
                "PROJECT_ZONES_FILE",
                "ZONE_COMPILED_FORMAT_VERSION",
                "ZONE_DRAFT_SAVE_EVENT",
                "compileAudioSources",
                "compileAudioSourcesWithVisuals",
                "compileAudioText",
                "compileAudioTextWithVisuals",
                "compileRenderAnchorPack",
                "compileZonePack",
                "createBebeTooling",
                "createDefaultRenderAnchorOutputEntity",
                "createAudioAssetCompiler",
                "createRenderAnchorsAssetCompiler",
                "createZonesAssetCompiler",
                "audioAssetCompiler",
                "normalizeAudioCompiledPack",
                "normalizeRenderAnchorDefinition",
                "normalizeRenderAnchorPack",
                "normalizeZoneCompiledPack",
                "normalizeZoneDefinition",
                "normalizeZoneExtentDefinition",
                "normalizeZonePack",
                "renderAnchorsAssetCompiler",
                "sanitizeRenderAnchorName",
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
            "./internal/audio/player": {
                types: "./lib/types/bebe-public.d.ts",
                default: "./lib/internal/audio/player.js",
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
