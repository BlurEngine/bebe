import { describe, expect, it } from "vitest";
import {
    PROJECT_ZONES_FILE,
    createBebeTooling,
    validateZoneReferences,
} from "@blurengine/bebe/tooling/node";

describe("Bebe tooling", () => {
    it("exposes the zone asset compiler through the node tooling subpath", () => {
        const tooling = createBebeTooling();

        expect(tooling.assetCompilers.map((compiler) => compiler.id)).toEqual([
            "bebe:zones",
            "bebe:render-anchors",
            "bebe:audio",
        ]);

        const compiler = tooling.assetCompilers.find(
            (candidate) => candidate.id === "bebe:zones",
        );

        expect(compiler).toBeDefined();
        expect(compiler?.sourcePaths).toEqual([PROJECT_ZONES_FILE]);
        expect(compiler?.outputPath).toBe("generated/bebe/zones.json");

        const result = compiler?.compile({
            pipeline: "build",
            projectRoot: "/project",
            sourceJson: {
                zones: [
                    {
                        id: "spawn",
                        dimension: "minecraft:overworld",
                        extent: { kind: "block", block: [0, 64, 0] },
                    },
                ],
            },
            sourcePath: "/project/zones.json",
        });
        expect(result?.output).toEqual({
            compiled: {
                version: 1,
                cellSize: 16,
                maxCellsPerZone: 4096,
                dimensions: {
                    "minecraft:overworld": {
                        cells: {
                            "0,4,0": ["spawn"],
                        },
                        scanned: [],
                    },
                },
            },
            zones: [
                {
                    id: "spawn",
                    dimension: "minecraft:overworld",
                    extent: {
                        kind: "block",
                        block: { x: 0, y: 64, z: 0 },
                    },
                },
            ],
        });
        expect(
            compiler?.renderBootstrap?.({
                outputImportSpecifier: "./dist/generated/bebe/zones.json",
                outputPath: "generated/bebe/zones.json",
            }),
        ).toEqual([
            'import { Zones } from "@blurengine/bebe";',
            'import __bebeZones from "./dist/generated/bebe/zones.json";',
            "Zones.load(__bebeZones);",
        ]);
    });

    it("validates soft zone references with the shared diagnostic category", () => {
        expect(
            validateZoneReferences(
                {
                    zones: [
                        {
                            id: "spawn",
                            dimension: "minecraft:overworld",
                            extent: { kind: "block", block: [0, 64, 0] },
                        },
                    ],
                },
                [
                    {
                        id: "spawn",
                        dimension: "minecraft:overworld",
                    },
                    {
                        id: "quest-start",
                        dimension: "minecraft:overworld",
                        sourcePath: "dialogue/intro.json",
                    },
                ],
            ),
        ).toEqual([
            {
                code: "BEBE_MISSING_ZONE_REFERENCE",
                category: "missingReferences",
                message:
                    'Missing zone reference "quest-start" in dimension "minecraft:overworld".',
                sourcePath: "dialogue/intro.json",
            },
        ]);
    });
});
