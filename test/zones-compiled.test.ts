import { describe, expect, it } from "vitest";
import {
    compileZonePack,
    normalizeZoneCompiledPack,
} from "@blurengine/bebe/tooling/node";
import { createZoneCompiledIndex } from "../src/zones/compiled-index.js";

describe("compiled zone packs", () => {
    it("bakes point lookup cells while keeping oversized and infinite zones scanned", () => {
        const pack = compileZonePack(
            {
                zones: [
                    {
                        id: "spawn",
                        dimension: "minecraft:overworld",
                        extent: { kind: "block", block: [32, 64, -16] },
                    },
                    {
                        id: "all-overworld",
                        dimension: "minecraft:overworld",
                        extent: { kind: "infinite" },
                    },
                    {
                        id: "large",
                        dimension: "minecraft:overworld",
                        extent: {
                            kind: "box",
                            min: [0, 0, 0],
                            max: [128, 128, 128],
                        },
                    },
                ],
            },
            { cellSize: 16, maxCellsPerZone: 1 },
        );

        expect(pack.compiled).toEqual({
            version: 1,
            cellSize: 16,
            maxCellsPerZone: 1,
            dimensions: {
                "minecraft:overworld": {
                    cells: {
                        "2,4,-1": ["spawn"],
                    },
                    scanned: ["all-overworld", "large"],
                },
            },
        });
    });

    it("normalises compiled packs from JSON without needing runtime ids", () => {
        expect(
            normalizeZoneCompiledPack({
                version: 1,
                cellSize: 16,
                maxCellsPerZone: 4096,
                dimensions: {
                    " minecraft:overworld ": {
                        cells: {
                            "0,4,0": [" spawn "],
                        },
                        scanned: [" world "],
                    },
                },
            }),
        ).toEqual({
            version: 1,
            cellSize: 16,
            maxCellsPerZone: 4096,
            dimensions: {
                "minecraft:overworld": {
                    cells: {
                        "0,4,0": ["spawn"],
                    },
                    scanned: ["world"],
                },
            },
        });

        expect(() =>
            normalizeZoneCompiledPack({
                version: 1,
                cellSize: 16,
                maxCellsPerZone: 4096,
                dimensions: {
                    "minecraft:overworld": {
                        cells: {
                            "0,0,0": ["missing"],
                        },
                        scanned: [],
                    },
                },
            }),
        ).not.toThrow();
    });

    it("plans empty-cell point lookups for watcher short-circuits", () => {
        const pack = compileZonePack({
            zones: [
                {
                    id: "spawn",
                    dimension: "minecraft:overworld",
                    extent: { kind: "block", block: [32, 64, -16] },
                },
            ],
        });
        const index = createZoneCompiledIndex(
            pack.compiled,
            new Map([["minecraft:overworld", new Set(["spawn"])]]),
        );

        expect(
            index?.lookupPoint("minecraft:overworld", {
                x: 1,
                y: 64,
                z: 1,
            }),
        ).toEqual({
            candidateIds: [],
            cellKey: "0,4,0",
            emptyCell: true,
        });
        expect(
            index?.lookupPoint("minecraft:overworld", {
                x: 32.5,
                y: 64.5,
                z: -15.5,
            }),
        ).toEqual({
            candidateIds: ["spawn"],
            cellKey: "2,4,-1",
            emptyCell: false,
        });
    });
});
