import { describe, expect, it } from "vitest";
import {
    LOCATION_PACK_FORMAT_VERSION,
    normalizeLocationPack,
} from "@blurengine/bebe/tooling/node";

describe("location definitions", () => {
    it("normalises exact fractional locations and preserves every opaque line", () => {
        const pack = normalizeLocationPack({
            version: 1,
            locations: [
                {
                    id: " lamp2 ",
                    dimension: " minecraft:overworld ",
                    location: [-2.5, 81, 1.25],
                    orientation: { yaw: -90, pitch: 0 },
                    lines: ["~", "@object", "lamppost", "", "future=value"],
                },
                {
                    id: "lamp1",
                    dimension: "minecraft:overworld",
                    location: { x: 0.5, y: 80, z: 4.5 },
                    lines: [],
                },
            ],
        });

        expect(pack).toEqual({
            version: LOCATION_PACK_FORMAT_VERSION,
            locations: [
                {
                    id: "lamp1",
                    dimension: "minecraft:overworld",
                    location: { x: 0.5, y: 80, z: 4.5 },
                    lines: [],
                },
                {
                    id: "lamp2",
                    dimension: "minecraft:overworld",
                    location: { x: -2.5, y: 81, z: 1.25 },
                    orientation: { yaw: -90, pitch: 0 },
                    lines: ["~", "@object", "lamppost", "", "future=value"],
                },
            ],
        });
        expect(Object.isFrozen(pack)).toBe(true);
        expect(Object.isFrozen(pack.locations)).toBe(true);
        expect(Object.isFrozen(pack.locations[1].lines)).toBe(true);
    });

    it("partitions identity by dimension and rejects a duplicate within one dimension", () => {
        expect(
            normalizeLocationPack({
                version: 1,
                locations: [
                    {
                        id: "spawn",
                        dimension: "overworld",
                        location: [0, 64, 0],
                    },
                    {
                        id: "spawn",
                        dimension: "nether",
                        location: [0, 64, 0],
                    },
                ],
            }).locations,
        ).toHaveLength(2);

        expect(() =>
            normalizeLocationPack({
                version: 1,
                locations: [
                    {
                        id: "spawn",
                        dimension: "overworld",
                        location: [0, 64, 0],
                    },
                    {
                        id: "spawn",
                        dimension: "overworld",
                        location: [1, 64, 0],
                    },
                ],
            }),
        ).toThrow('Duplicate location id "spawn" in dimension "overworld".');
    });

    it.each([
        {
            name: "wrong schema version",
            value: { version: 2, locations: [] },
            message: "locations.json.version must be 1.",
        },
        {
            name: "non-finite coordinate",
            value: {
                version: 1,
                locations: [
                    {
                        id: "bad",
                        dimension: "overworld",
                        location: [Number.NaN, 0, 0],
                    },
                ],
            },
            message:
                "locations.json.locations[0].location[0] must be a finite number.",
        },
        {
            name: "non-string line",
            value: {
                version: 1,
                locations: [
                    {
                        id: "bad",
                        dimension: "overworld",
                        location: [0, 0, 0],
                        lines: ["ok", 1],
                    },
                ],
            },
            message: "locations.json.locations[0].lines[1] must be a string.",
        },
        {
            name: "non-finite orientation",
            value: {
                version: 1,
                locations: [
                    {
                        id: "bad",
                        dimension: "overworld",
                        location: [0, 0, 0],
                        orientation: { yaw: Infinity, pitch: 0 },
                    },
                ],
            },
            message:
                "locations.json.locations[0].orientation.yaw must be a finite number.",
        },
        {
            name: "consumer metadata",
            value: {
                version: 1,
                locations: [
                    {
                        id: "bad",
                        dimension: "overworld",
                        location: [0, 0, 0],
                        data: { entity: "example:thing" },
                    },
                ],
            },
            message:
                'locations.json.locations[0] contains unsupported field "data".',
        },
    ])("rejects $name", ({ value, message }) => {
        expect(() => normalizeLocationPack(value)).toThrow(message);
    });
});
