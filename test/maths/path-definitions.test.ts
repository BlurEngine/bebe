import { describe, expect, it } from "vitest";
import {
    PATH_PACK_FORMAT_VERSION,
    Vec3,
    compilePathDefinition,
    normalizePathPack,
} from "@blurengine/bebe/maths";

describe("path packs", () => {
    it("normalises a deterministic generic path pack", () => {
        expect(
            normalizePathPack({
                version: 1,
                paths: [
                    {
                        id: " spline ",
                        kind: "catmull-rom",
                        closed: false,
                        subdivisionsPerSegment: 24,
                        points: [[0, 0, 0], { x: 4, y: 1, z: 8 }],
                    },
                    {
                        id: "line",
                        kind: "polyline",
                        closed: true,
                        points: [
                            [0, 0, 0],
                            [1, 0, 0],
                            [0, 0, 1],
                        ],
                    },
                ],
            }),
        ).toEqual({
            version: PATH_PACK_FORMAT_VERSION,
            paths: [
                {
                    id: "line",
                    kind: "polyline",
                    closed: true,
                    points: [
                        { x: 0, y: 0, z: 0 },
                        { x: 1, y: 0, z: 0 },
                        { x: 0, y: 0, z: 1 },
                    ],
                },
                {
                    id: "spline",
                    kind: "catmull-rom",
                    closed: false,
                    subdivisionsPerSegment: 24,
                    points: [
                        { x: 0, y: 0, z: 0 },
                        { x: 4, y: 1, z: 8 },
                    ],
                },
            ],
        });
    });

    it("compiles the same normalised definition used by persisted packs", () => {
        const path = compilePathDefinition({
            id: "route",
            kind: "polyline",
            closed: false,
            points: [
                [0, 0, 0],
                [0, 3, 4],
            ],
        });

        expect(path.length).toBe(5);
        expect(path.sample(2.5)?.position).toEqual(new Vec3(0, 1.5, 2));
    });

    it.each([
        {
            value: { version: 2, paths: [] },
            message: "paths.version must be 1.",
        },
        {
            value: {
                version: 1,
                paths: [
                    {
                        id: "same",
                        kind: "polyline",
                        points: [
                            [0, 0, 0],
                            [1, 0, 0],
                        ],
                    },
                    {
                        id: "same",
                        kind: "polyline",
                        points: [
                            [0, 0, 0],
                            [0, 1, 0],
                        ],
                    },
                ],
            },
            message: 'Duplicate path id "same".',
        },
        {
            value: {
                version: 1,
                paths: [
                    {
                        id: "bad",
                        kind: "polyline",
                        points: [
                            [0, 0, 0],
                            [1, 0, 0],
                        ],
                        data: { train: true },
                    },
                ],
            },
            message: 'paths.paths[0] contains unsupported field "data".',
        },
    ])("rejects malformed packs", ({ value, message }) => {
        expect(() => normalizePathPack(value)).toThrow(message);
    });
});
