import { describe, expect, it } from "vitest";
import { normalizeZonePack } from "@blurengine/bebe/tooling/node";

describe("zone definitions", () => {
    it("normalises author-written zone packs into a stable baked shape", () => {
        expect(
            normalizeZonePack({
                zones: [
                    {
                        id: " spawn ",
                        dimension: " minecraft:overworld ",
                        extent: {
                            kind: "polygon",
                            points: [
                                [0, 0],
                                { x: 4, z: 0 },
                                [4, 4],
                                { x: 0, z: 4 },
                            ],
                            y: { min: 60, max: 80 },
                        },
                    },
                    {
                        id: "marker",
                        dimension: "minecraft:overworld",
                        extent: {
                            kind: "block",
                            block: [10, 64, -2],
                        },
                    },
                ],
            }),
        ).toEqual({
            zones: [
                {
                    id: "spawn",
                    dimension: "minecraft:overworld",
                    extent: {
                        kind: "polygon",
                        points: [
                            [0, 0],
                            [4, 0],
                            [4, 4],
                            [0, 4],
                        ],
                        y: { min: 60, max: 80 },
                    },
                },
                {
                    id: "marker",
                    dimension: "minecraft:overworld",
                    extent: {
                        kind: "block",
                        block: { x: 10, y: 64, z: -2 },
                    },
                },
            ],
        });
    });

    it("rejects duplicate zone ids inside the same dimension", () => {
        expect(() =>
            normalizeZonePack({
                zones: [
                    {
                        id: "spawn",
                        dimension: "minecraft:overworld",
                        extent: { kind: "block", block: [0, 64, 0] },
                    },
                    {
                        id: "spawn",
                        dimension: "minecraft:overworld",
                        extent: { kind: "block", block: [1, 64, 0] },
                    },
                ],
            }),
        ).toThrow(
            'Duplicate zone id "spawn" in dimension "minecraft:overworld".',
        );
    });

    it("rejects consumer payloads in zone definitions", () => {
        expect(() =>
            normalizeZonePack({
                zones: [
                    {
                        id: "spawn",
                        dimension: "overworld",
                        extent: { kind: "block", block: [1, 2, 3] },
                        data: {
                            label: "Spawn",
                        },
                    },
                ],
            }),
        ).toThrow(
            "zones.json.zones[0].data is not supported. Keep zone metadata in a consumer-owned file keyed by dimension and id.",
        );
    });
});
