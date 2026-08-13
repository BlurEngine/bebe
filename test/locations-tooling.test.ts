import { describe, expect, it } from "vitest";
import {
    GENERATED_LOCATIONS_FILE,
    PROJECT_LOCATIONS_FILE,
    createLocationsAssetCompiler,
    parseMarkerText,
} from "@blurengine/bebe/tooling/node";

describe("location tooling", () => {
    it.each([
        ["", [""]],
        ["one", ["one"]],
        ["one\n", ["one"]],
        ["one\n\n", ["one", ""]],
        ["one\r\ntwo\rthree\n", ["one", "two", "three"]],
        ["~\n@name\nspawn\n\nextra", ["~", "@name", "spawn", "", "extra"]],
    ])("preserves arbitrary marker rows from %j", (text, expected) => {
        expect(parseMarkerText(text)).toEqual(expected);
        expect(Object.isFrozen(parseMarkerText(text))).toBe(true);
    });

    it("rejects non-text marker input without assigning syntax meanings", () => {
        expect(parseMarkerText(123)).toBeUndefined();
        expect(parseMarkerText(null)).toBeUndefined();
    });

    it("compiles and bootstraps a canonical location pack", () => {
        const compiler = createLocationsAssetCompiler();

        expect(compiler.id).toBe("bebe:locations");
        expect(compiler.sourcePaths).toEqual([PROJECT_LOCATIONS_FILE]);
        expect(compiler.outputPath).toBe(GENERATED_LOCATIONS_FILE);
        expect(
            compiler.compile({
                pipeline: "build",
                projectRoot: "/project",
                sourcePath: "/project/locations.json",
                sourceJson: {
                    version: 1,
                    locations: [
                        {
                            id: "spawn",
                            dimension: "overworld",
                            location: [0.5, 80, 0.5],
                            lines: ["spawn", "@name", "main"],
                        },
                    ],
                },
            }).output,
        ).toEqual({
            version: 1,
            locations: [
                {
                    id: "spawn",
                    dimension: "overworld",
                    location: { x: 0.5, y: 80, z: 0.5 },
                    lines: ["spawn", "@name", "main"],
                },
            ],
        });
        expect(
            compiler.renderBootstrap?.({
                outputImportSpecifier: "./generated/bebe/locations.json",
                outputPath: "generated/bebe/locations.json",
            }),
        ).toEqual([
            'import { Locations } from "@blurengine/bebe";',
            'import __bebeLocations from "./generated/bebe/locations.json";',
            "Locations.load(__bebeLocations);",
        ]);
    });
});
