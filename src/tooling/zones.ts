import {
    GENERATED_ZONES_FILE,
    PROJECT_ZONES_FILE,
    compileZonePack,
    normalizeZonePack,
    type ZonePack,
} from "../zones/definitions.js";
import type { BebeAssetCompiler, BebeToolingDiagnostic } from "./assets.js";

export type ZoneReference = {
    readonly id: string;
    readonly dimension: string;
    readonly sourcePath?: string;
};

export function validateZoneReferences(
    pack: ZonePack,
    references: readonly ZoneReference[],
): readonly BebeToolingDiagnostic[] {
    const normalized = normalizeZonePack(pack);
    const ids = new Set(normalized.zones.map((zone) => zoneReferenceKey(zone)));

    return references
        .filter((reference) => !ids.has(zoneReferenceKey(reference)))
        .map((reference) => ({
            code: "BEBE_MISSING_ZONE_REFERENCE",
            category: "missingReferences",
            message: `Missing zone reference "${reference.id}" in dimension "${reference.dimension}".`,
            sourcePath: reference.sourcePath,
        }));
}

export function createZonesAssetCompiler(): BebeAssetCompiler {
    return {
        id: "bebe:zones",
        sourcePaths: [PROJECT_ZONES_FILE],
        outputPath: GENERATED_ZONES_FILE,
        compile(input) {
            return {
                output: compileZonePack(input.sourceJson, {
                    source: PROJECT_ZONES_FILE,
                }),
            };
        },
        renderBootstrap(input) {
            return [
                'import { Zones } from "@blurengine/bebe";',
                `import __bebeZones from ${JSON.stringify(input.outputImportSpecifier)};`,
                "Zones.load(__bebeZones);",
            ];
        },
    };
}

export const zonesAssetCompiler = createZonesAssetCompiler();

function zoneReferenceKey(reference: {
    readonly id: string;
    readonly dimension: string;
}): string {
    return `${reference.dimension}\u0000${reference.id}`;
}
