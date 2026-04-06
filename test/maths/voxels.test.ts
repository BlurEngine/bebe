import { describe, expect, it } from "vitest";
import {
    FACE_VOXEL_OFFSETS,
    FACING_OFFSETS,
    SURROUNDING_OFFSETS,
    SURROUNDING_VOXEL_OFFSETS,
    Vec3,
    createFacingVoxelOffsets,
    floodFillVoxels,
    getVoxelKey,
    parseVoxelKey,
} from "@blurengine/bebe/maths";

describe("@blurengine/bebe/maths voxel helpers", () => {
    it("round-trips voxel keys for offset Vec3 locations", () => {
        const location = new Vec3({ x: 1, y: 2, z: 3 }).add({
            x: -2,
            y: 1,
            z: 4,
        });

        expect(location).toBeInstanceOf(Vec3);
        expect(location.toObject()).toEqual({ x: -1, y: 3, z: 7 });
        expect(getVoxelKey(location)).toBe("-1,3,7");
        expect(parseVoxelKey("-1,3,7")).toEqual(location);
        expect(parseVoxelKey("-1,3,7")).toBeInstanceOf(Vec3);
        expect(parseVoxelKey("bad-key")).toBeUndefined();
    });

    it("exposes standard face and surrounding neighbourhoods", () => {
        expect(FACE_VOXEL_OFFSETS).toBe(FACING_OFFSETS);
        expect(SURROUNDING_VOXEL_OFFSETS).toBe(SURROUNDING_OFFSETS);
        expect(FACE_VOXEL_OFFSETS).toHaveLength(6);
        expect(SURROUNDING_VOXEL_OFFSETS).toHaveLength(26);
        expect(FACE_VOXEL_OFFSETS[0]).toBeInstanceOf(Vec3);
        expect(SURROUNDING_VOXEL_OFFSETS[0]).toBeInstanceOf(Vec3);
        expect(
            new Set(
                SURROUNDING_VOXEL_OFFSETS.map((offset) => getVoxelKey(offset)),
            ).size,
        ).toBe(26);
    });

    it("creates one 3x3 face plane from a face direction", () => {
        const upward = createFacingVoxelOffsets({ x: 0, y: 1, z: 0 });
        const south = createFacingVoxelOffsets({ x: 0, y: 0, z: 1 });

        expect(upward).toHaveLength(9);
        expect(south).toHaveLength(9);
        expect(upward[0]).toBeInstanceOf(Vec3);
        expect(south[0]).toBeInstanceOf(Vec3);
        expect(new Set(upward.map((offset) => getVoxelKey(offset))).size).toBe(
            9,
        );
        expect(new Set(south.map((offset) => getVoxelKey(offset))).size).toBe(
            9,
        );
        expect(
            upward.some((offset) => offset.equals({ x: 0, y: 1, z: 0 })),
        ).toBe(true);
        expect(
            upward.some((offset) => offset.equals({ x: -1, y: 1, z: -1 })),
        ).toBe(true);
        expect(
            upward.some((offset) => offset.equals({ x: 1, y: 1, z: 1 })),
        ).toBe(true);
        expect(
            south.some((offset) => offset.equals({ x: 0, y: 0, z: 1 })),
        ).toBe(true);
        expect(
            south.some((offset) => offset.equals({ x: -1, y: 1, z: 1 })),
        ).toBe(true);
        expect(
            south.some((offset) => offset.equals({ x: 1, y: -1, z: 1 })),
        ).toBe(true);
    });

    it("throws when a facing neighbourhood is requested from a non-face offset", () => {
        expect(() => createFacingVoxelOffsets({ x: 1, y: 1, z: 0 })).toThrow(
            "createFacingVoxelOffsets requires one face-adjacent voxel offset.",
        );
    });

    it("flood-fills voxels breadth-first from one seed", () => {
        const result = floodFillVoxels({
            neighbours: FACE_VOXEL_OFFSETS,
            seeds: [{ location: { x: 0, y: 0, z: 0 } }],
            shouldEnter(node) {
                return (
                    Math.abs(node.location.x) <= 1 &&
                    node.location.y === 0 &&
                    node.location.z === 0
                );
            },
        });

        expect([...result.locations.keys()].sort()).toEqual([
            "-1,0,0",
            "0,0,0",
            "1,0,0",
        ]);
        expect(result.depths.get("0,0,0")).toBe(0);
        expect(result.depths.get("-1,0,0")).toBe(1);
        expect(result.depths.get("1,0,0")).toBe(1);
        expect(result.truncated).toBe(false);
    });

    it("supports multi-seed traversals and max-count truncation", () => {
        const result = floodFillVoxels({
            maxCount: 3,
            neighbours: FACE_VOXEL_OFFSETS,
            seeds: [
                { location: { x: 0, y: 0, z: 0 } },
                { location: { x: 10, y: 0, z: 0 }, depth: 5 },
            ],
            shouldEnter(node) {
                return node.location.y === 0 && node.location.z === 0;
            },
        });

        expect(result.locations.size).toBe(3);
        expect(result.depths.get("10,0,0")).toBe(5);
        expect(result.truncated).toBe(true);
    });
});
