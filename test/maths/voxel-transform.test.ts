import { describe, expect, it } from "vitest";
import {
    Facing,
    Vec3,
    inverseRotateVoxelOffset,
    rotateVoxelOffset,
} from "@blurengine/bebe/maths";

describe("voxel quarter-turn transforms", () => {
    it.each([
        [Facing.North, { x: 2, y: 3, z: -1 }],
        [Facing.East, { x: -1, y: 3, z: -2 }],
        [Facing.South, { x: -2, y: 3, z: 1 }],
        [Facing.West, { x: 1, y: 3, z: 2 }],
    ])("rotates local integer offsets towards %s", (facing, expected) => {
        expect(rotateVoxelOffset([2, 3, -1], facing)).toEqual(
            new Vec3(expected),
        );
    });

    it("recovers every sparse non-rectangular offset through its inverse", () => {
        const sparse = [
            [0, 0, 0],
            [0, 1, 0],
            [2, 2, -1],
            [-2, 2, -1],
            [1, 2, 2],
        ] as const;

        for (const facing of [
            Facing.North,
            Facing.East,
            Facing.South,
            Facing.West,
        ]) {
            expect(
                sparse.map((offset) =>
                    inverseRotateVoxelOffset(
                        rotateVoxelOffset(offset, facing),
                        facing,
                    ).toObject(),
                ),
            ).toEqual(
                sparse.map(([x, y, z]) => ({
                    x,
                    y,
                    z,
                })),
            );
        }
    });

    it("rejects vertical facings and non-integer voxel offsets", () => {
        expect(() => rotateVoxelOffset([0, 0, 1], Facing.Up)).toThrow(
            "rotateVoxelOffset requires a horizontal Facing.",
        );
        expect(() => rotateVoxelOffset([0.5, 0, 1], Facing.North)).toThrow(
            "rotateVoxelOffset requires integer voxel coordinates.",
        );
        expect(() =>
            inverseRotateVoxelOffset([0, Number.NaN, 1], Facing.North),
        ).toThrow(
            "inverseRotateVoxelOffset requires integer voxel coordinates.",
        );
    });
});
