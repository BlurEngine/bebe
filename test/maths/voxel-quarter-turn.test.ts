import { describe, expect, it } from "vitest";
import {
    compilePathDefinition,
    getVoxelKey,
    inverseRotateVoxelOffsetByQuarterTurns,
    normalizePathPack,
    parseVoxelKey,
    rotateVoxelOffsetByQuarterTurns,
} from "@blurengine/bebe/tooling/node";

describe("Node-safe voxel quarter-turn transforms", () => {
    it("normalizes and compiles generic paths without importing Bedrock", () => {
        const pack = normalizePathPack({
            version: 1,
            paths: [
                {
                    id: "build-route",
                    kind: "polyline",
                    points: [
                        [0, 0, 0],
                        [3, 4, 0],
                    ],
                },
            ],
        });

        expect(compilePathDefinition(pack.paths[0]).length).toBe(5);
    });

    it("encodes and parses voxel keys without importing the Bedrock runtime", () => {
        expect(getVoxelKey([-1, 3, 7])).toBe("-1,3,7");
        expect(parseVoxelKey("-1,3,7")?.toObject()).toEqual({
            x: -1,
            y: 3,
            z: 7,
        });
        expect(parseVoxelKey("invalid")).toBeUndefined();
    });

    it.each([
        [0, { x: 2, y: 3, z: -1 }],
        [1, { x: -1, y: 3, z: -2 }],
        [2, { x: -2, y: 3, z: 1 }],
        [3, { x: 1, y: 3, z: 2 }],
    ] as const)("rotates an integer offset by %i turns", (turns, expected) => {
        expect(
            rotateVoxelOffsetByQuarterTurns([2, 3, -1], turns).toObject(),
        ).toEqual(expected);
    });

    it("recovers sparse offsets without a Minecraft runtime import", () => {
        const offsets = [
            [0, 0, 0],
            [0, 1, 0],
            [2, 2, -1],
            [-2, 2, -1],
            [1, 2, 2],
        ] as const;

        for (const turns of [0, 1, 2, 3] as const) {
            expect(
                offsets.map((offset) =>
                    inverseRotateVoxelOffsetByQuarterTurns(
                        rotateVoxelOffsetByQuarterTurns(offset, turns),
                        turns,
                    ).toObject(),
                ),
            ).toEqual(offsets.map(([x, y, z]) => ({ x, y, z })));
        }
    });

    it("rejects invalid turn counts and non-integer offsets", () => {
        expect(() =>
            rotateVoxelOffsetByQuarterTurns([0, 0, 1], 4 as 0),
        ).toThrow("quarterTurns must be 0, 1, 2, or 3");
        expect(() => rotateVoxelOffsetByQuarterTurns([0.5, 0, 1], 0)).toThrow(
            "requires integer voxel coordinates",
        );
    });
});
