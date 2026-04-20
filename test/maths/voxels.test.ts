import { describe, expect, it } from "vitest";
import {
    FACE_VOXEL_OFFSETS,
    FACING_OFFSETS,
    SURROUNDING_OFFSETS,
    SURROUNDING_VOXEL_OFFSETS,
    Vec3,
    VoxelMap,
    VoxelSet,
    createFacingVoxelOffsets,
    floodFillVoxelSet,
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

        expect([...result.voxels.keySet().toKeys()].sort()).toEqual([
            "-1,0,0",
            "0,0,0",
            "1,0,0",
        ]);
        expect(result.voxels.get({ x: 0, y: 0, z: 0 })).toBe(0);
        expect(result.voxels.get({ x: -1, y: 0, z: 0 })).toBe(1);
        expect(result.voxels.get({ x: 1, y: 0, z: 0 })).toBe(1);
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

        expect(result.voxels.size).toBe(3);
        expect(result.voxels.get({ x: 10, y: 0, z: 0 })).toBe(5);
        expect(result.truncated).toBe(true);
    });

    it("stores voxel membership by value rather than object identity", () => {
        const locations = new VoxelSet([
            { x: 1, y: 2, z: 3 },
            new Vec3(1, 2, 3),
            [4, 5, 6] as const,
        ]);

        expect(locations.size).toBe(2);
        expect(locations.has(new Vec3(1, 2, 3))).toBe(true);
        expect([...locations].map((location) => getVoxelKey(location))).toEqual(
            ["1,2,3", "4,5,6"],
        );
    });

    it("supports set algebra on voxel membership collections", () => {
        const left = new VoxelSet([
            { x: 0, y: 0, z: 0 },
            { x: 1, y: 0, z: 0 },
        ]);
        const right = [
            { x: 1, y: 0, z: 0 },
            { x: 2, y: 0, z: 0 },
        ] as const;

        expect(left.union(right).toKeys()).toEqual(["0,0,0", "1,0,0", "2,0,0"]);
        expect(left.difference(right).toKeys()).toEqual(["0,0,0"]);
    });

    it("creates voxel sets and maps from voxel keys", () => {
        const locations = VoxelSet.fromKeys(["1,2,3", "4,5,6"]);
        const depths = VoxelMap.fromKeys([
            ["1,2,3", 4] as const,
            ["4,5,6", 7] as const,
        ]);

        expect(locations.size).toBe(2);
        expect(locations.has({ x: 1, y: 2, z: 3 })).toBe(true);
        expect(locations.toKeys()).toEqual(["1,2,3", "4,5,6"]);
        expect(depths.get(new Vec3(1, 2, 3))).toBe(4);
        expect(depths.keySet().toKeys()).toEqual(["1,2,3", "4,5,6"]);
    });

    it("rejects malformed voxel keys", () => {
        expect(() => VoxelSet.fromKeys(["bad-key"])).toThrow(
            "VoxelSet.fromKeys requires valid voxel keys.",
        );
        expect(() => VoxelMap.fromKeys([["bad-key", 1] as const])).toThrow(
            "VoxelMap.fromKeys requires valid voxel keys.",
        );
    });

    it("supports selection helpers on voxel collections", () => {
        const locations = new VoxelSet([
            { x: 2, y: 0, z: 0 },
            { x: 0, y: 0, z: 0 },
            { x: 1, y: 0, z: 0 },
        ]);
        const depths = new VoxelMap<number>([
            [{ x: 2, y: 0, z: 0 }, 2],
            [{ x: 0, y: 0, z: 0 }, 0],
            [{ x: 1, y: 0, z: 0 }, 1],
        ]);

        expect(locations.map((location) => location.x)).toEqual([2, 0, 1]);
        expect(locations.filter((location) => location.x > 0).toKeys()).toEqual(
            ["2,0,0", "1,0,0"],
        );
        expect(locations.find((location) => location.x === 0)).toEqual(
            new Vec3(0, 0, 0),
        );
        expect(locations.some((location) => location.x === 1)).toBe(true);
        expect(locations.every((location) => location.y === 0)).toBe(true);
        expect(locations.slice(1).toKeys()).toEqual(["0,0,0", "1,0,0"]);
        expect(
            locations.sort((left, right) => left.x - right.x).toKeys(),
        ).toEqual(["0,0,0", "1,0,0", "2,0,0"]);
        expect(depths.map(([, depth]) => depth)).toEqual([2, 0, 1]);
        expect(
            depths
                .filter(([, depth]) => depth > 0)
                .keySet()
                .toKeys(),
        ).toEqual(["2,0,0", "1,0,0"]);
    });

    it("flood-fills within a known voxel membership set", () => {
        const result = floodFillVoxelSet({
            neighbours: [{ x: 1, y: 0, z: 0 }],
            seeds: [{ location: { x: 0, y: 0, z: 0 } }],
            within: new VoxelSet([
                { x: 0, y: 0, z: 0 },
                { x: 1, y: 0, z: 0 },
            ]),
        });

        expect(result.voxels.keySet().toKeys()).toEqual(["0,0,0", "1,0,0"]);
        expect(result.voxels.get({ x: 1, y: 0, z: 0 })).toBe(1);
        expect(result.voxels.get({ x: 2, y: 0, z: 0 })).toBeUndefined();
    });
});
