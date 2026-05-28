import type { BebeTooling } from "./assets.js";
import { createRenderAnchorsAssetCompiler } from "./render-anchors.js";
import { createZonesAssetCompiler } from "./zones.js";

export type {
    BebeAssetCompilerArtifact,
    BebeAssetCompilerArtifactTarget,
    BebeAssetBootstrapInput,
    BebeAssetCompiler,
    BebeAssetCompilerInput,
    BebeAssetCompilerResult,
    BebePipelineIntent,
    BebeTooling,
    BebeToolingDiagnostic,
    BebeToolingDiagnosticCategory,
    BebeToolingDiagnosticSeverity,
} from "./assets.js";
export {
    DEFAULT_ZONE_COMPILED_CELL_SIZE,
    DEFAULT_ZONE_COMPILED_MAX_CELLS_PER_ZONE,
    GENERATED_ZONES_FILE,
    PROJECT_ZONES_FILE,
    ZONE_COMPILED_FORMAT_VERSION,
    compileZonePack,
    normalizeZoneCompiledPack,
    normalizeZoneDefinition,
    normalizeZoneExtentDefinition,
    normalizeZonePack,
} from "../zones/definitions.js";
export type {
    CompileZonePackOptions,
    NormalizeZonePackOptions,
    ZoneBlockExtentDefinition,
    ZoneBoxExtentDefinition,
    ZoneCompiledDimensionIndex,
    ZoneCompiledPack,
    ZoneDefinition,
    ZoneExtentDefinition,
    ZoneInfiniteExtentDefinition,
    ZonePack,
    ZonePackScope,
    ZonePolygonExtentDefinition,
    ZoneVec2Definition,
    ZoneVec3Definition,
} from "../zones/definitions.js";
export {
    createZonesAssetCompiler,
    validateZoneReferences,
    zonesAssetCompiler,
} from "./zones.js";
export type { ZoneReference } from "./zones.js";
export { ZONE_DRAFT_SAVE_EVENT } from "../zones/draft.js";
export type { ZoneDraftSavePayload } from "../zones/draft.js";
export {
    DEFAULT_RENDER_ANCHOR_DIMENSION,
    DEFAULT_RENDER_ANCHOR_REPOSITION_THRESHOLD,
    DEFAULT_RENDER_ANCHOR_SEARCH_RADIUS,
    GENERATED_RENDER_ANCHORS_FILE,
    PROJECT_RENDER_ANCHORS_FILE,
    compileRenderAnchorPack,
    createDefaultRenderAnchorOutputEntity,
    normalizeRenderAnchorDefinition,
    normalizeRenderAnchorPack,
    sanitizeRenderAnchorName,
} from "../render-anchors/definitions.js";
export type {
    NormalizeRenderAnchorPackOptions,
    RenderAnchorCompiledDefinition,
    RenderAnchorCompiledPack,
    RenderAnchorDefinition,
    RenderAnchorMovementDriver,
    RenderAnchorNormalizedPlacement,
    RenderAnchorPack,
    RenderAnchorPlacementDefinition,
    RenderAnchorPlacementStrategy,
    RenderAnchorPropertiesDefinition,
    RenderAnchorPropertyDefinition,
    RenderAnchorPropertyType,
    RenderAnchorPropertyValue,
    RenderAnchorVec3Definition,
} from "../render-anchors/definitions.js";
export {
    createRenderAnchorsAssetCompiler,
    renderAnchorsAssetCompiler,
} from "./render-anchors.js";

export function createBebeTooling(): BebeTooling {
    return {
        assetCompilers: [
            createZonesAssetCompiler(),
            createRenderAnchorsAssetCompiler(),
        ],
    };
}
