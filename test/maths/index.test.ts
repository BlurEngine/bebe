import { describe, expect, it } from "vitest";
import * as maths from "@blurengine/bebe/maths";
import {
    AABB,
    FACE_VOXEL_OFFSETS,
    Easings,
    Facing,
    FACING_OFFSETS,
    HORIZONTAL_FACING_OFFSETS,
    SURROUNDING_OFFSETS,
    SURROUNDING_VOXEL_OFFSETS,
    VERTICAL_FACING_OFFSETS,
    createFacingVoxelOffsets,
    createSurroundingOffsets,
    floodFillVoxelSet,
    floodFillVoxels,
    getVoxelKey,
    parseVoxelKey,
    tweenNumber,
    clamp,
    Vec2,
    Vec3,
} from "@blurengine/bebe/maths";

describe("maths barrel exports", () => {
    it("re-exports the public maths surface", () => {
        expect(maths.AABB).toBe(AABB);
        expect(maths.Easings).toBe(Easings);
        expect(maths.Facing).toBe(Facing);
        expect(maths.FACING_OFFSETS).toBe(FACING_OFFSETS);
        expect(maths.HORIZONTAL_FACING_OFFSETS).toBe(HORIZONTAL_FACING_OFFSETS);
        expect(maths.SURROUNDING_OFFSETS).toBe(SURROUNDING_OFFSETS);
        expect(maths.FACE_VOXEL_OFFSETS).toBe(FACE_VOXEL_OFFSETS);
        expect(maths.SURROUNDING_VOXEL_OFFSETS).toBe(SURROUNDING_VOXEL_OFFSETS);
        expect(maths.VERTICAL_FACING_OFFSETS).toBe(VERTICAL_FACING_OFFSETS);
        expect(maths.createFacingVoxelOffsets).toBe(createFacingVoxelOffsets);
        expect(maths.createSurroundingOffsets).toBe(createSurroundingOffsets);
        expect(maths.floodFillVoxelSet).toBe(floodFillVoxelSet);
        expect(maths.floodFillVoxels).toBe(floodFillVoxels);
        expect(maths.getVoxelKey).toBe(getVoxelKey);
        expect(maths.parseVoxelKey).toBe(parseVoxelKey);
        expect(maths.Vec2).toBe(Vec2);
        expect(maths.Vec3).toBe(Vec3);
        expect(maths.clamp).toBe(clamp);
        expect(maths.tweenNumber).toBe(tweenNumber);
    });
});
