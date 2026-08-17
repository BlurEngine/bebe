import {
    GENERATED_LOCATIONS_FILE,
    PROJECT_LOCATIONS_FILE,
    normalizeLocationPack,
} from "../locations/definitions.js";
import type { BebeAssetCompiler } from "./assets.js";

export function parseMarkerText(input: unknown): readonly string[] | undefined {
    if (typeof input !== "string") {
        return undefined;
    }

    let normalized = input.replace(/\r\n?/g, "\n");
    if (normalized.endsWith("\n")) {
        normalized = normalized.slice(0, -1);
    }
    return Object.freeze(normalized.split("\n"));
}

export function createLocationsAssetCompiler(): BebeAssetCompiler {
    return {
        id: "bebe:locations",
        sourcePaths: [PROJECT_LOCATIONS_FILE],
        outputPath: GENERATED_LOCATIONS_FILE,
        compile(input) {
            return {
                output: normalizeLocationPack(input.sourceJson, {
                    source: PROJECT_LOCATIONS_FILE,
                }),
            };
        },
        renderBootstrap(input) {
            return [
                'import { Locations } from "@blurengine/bebe";',
                `import __bebeLocations from ${JSON.stringify(input.outputImportSpecifier)};`,
                "Locations.load(__bebeLocations);",
            ];
        },
    };
}

export const locationsAssetCompiler = createLocationsAssetCompiler();
