import { describe, expect, it } from "vitest";
import {
    AABB,
    BlockExtent,
    BoxExtent,
    CylinderExtent,
    InfiniteExtent,
    PolygonExtent,
    SphereExtent,
    TranslatedExtent,
    UnionExtent,
    Vec3,
    VoxelExtent,
    blockExtent,
    boxExtent,
    cylinderExtent,
    infiniteExtent,
    polygonExtent,
    sphereExtent,
    translatedExtent,
    unionExtent,
    voxelExtent,
} from "@blurengine/bebe/maths";

describe("maths extents", () => {
    it("wraps AABB geometry in a box extent", () => {
        const extent = new BoxExtent(new AABB(0, 0, 0, 4, 2, 6));

        expect(extent.containsPoint({ x: 2, y: 1, z: 3 })).toBe(true);
        expect(extent.containsPoint({ x: 5, y: 1, z: 3 })).toBe(false);
        expect(extent.bounds()?.toBlockBoundingBox()).toEqual({
            min: { x: 0, y: 0, z: 0 },
            max: { x: 4, y: 2, z: 6 },
        });
        expect(extent.volume()).toBe(48);
        expect(extent.classifyAABB(new AABB(1, 0.5, 1, 2, 1.5, 2))).toBe(
            "inside",
        );
        expect(extent.classifyAABB(new AABB(5, 0, 0, 6, 1, 1))).toBe("outside");
        expect(extent.classifyAABB(new AABB(3, 1, 3, 5, 3, 7))).toBe(
            "intersects",
        );
        expect(boxExtent(new AABB(0, 0, 0, 1, 1, 1))).toBeInstanceOf(BoxExtent);
    });

    it("represents one half-open block cell", () => {
        const extent = new BlockExtent({ x: 1, y: 2, z: 3 });

        expect(extent.containsPoint({ x: 1, y: 2, z: 3 })).toBe(true);
        expect(extent.containsPoint({ x: 1.999, y: 2.5, z: 3.25 })).toBe(true);
        expect(extent.containsPoint({ x: 2, y: 2, z: 3 })).toBe(false);
        expect(extent.bounds()?.toBlockBoundingBox()).toEqual({
            min: { x: 1, y: 2, z: 3 },
            max: { x: 2, y: 3, z: 4 },
        });
        expect([...extent.blocks()]).toEqual([{ x: 1, y: 2, z: 3 }]);
        expect(extent.volume()).toBe(1);
        expect(blockExtent({ x: 1, y: 2, z: 3 })).toBeInstanceOf(BlockExtent);
    });

    it("rejects non-finite block coordinates at the block extent boundary", () => {
        expect(() => new BlockExtent({ x: Number.NaN, y: 2, z: 3 })).toThrow(
            "Vec3 x component must be a finite number.",
        );
    });

    it("classifies block cells without violating half-open containment", () => {
        const extent = blockExtent({ x: 1, y: 2, z: 3 });

        expect(
            extent.classifyAABB(new AABB(1.1, 2.1, 3.1, 1.9, 2.9, 3.9)),
        ).toBe("inside");
        expect(extent.classifyAABB(new AABB(1, 2, 3, 2, 3, 4))).toBe(
            "intersects",
        );
        expect(extent.classifyAABB(new AABB(2, 2, 3, 3, 3, 4))).toBe("outside");
    });

    it("represents a vertical cylinder", () => {
        const extent = new CylinderExtent({
            center: { x: 10, y: 5, z: 10 },
            height: 6,
            radius: 3,
        });

        expect(extent.containsPoint({ x: 12, y: 5, z: 10 })).toBe(true);
        expect(extent.containsPoint({ x: 14, y: 5, z: 10 })).toBe(false);
        expect(extent.containsPoint({ x: 10, y: 9, z: 10 })).toBe(false);
        expect(extent.bounds()?.toBlockBoundingBox()).toEqual({
            min: { x: 7, y: 2, z: 7 },
            max: { x: 13, y: 8, z: 13 },
        });
        expect(extent.classifyAABB(new AABB(9, 4, 9, 11, 6, 11))).toBe(
            "inside",
        );
        expect(extent.classifyAABB(new AABB(14, 4, 10, 15, 5, 11))).toBe(
            "outside",
        );
        expect(
            cylinderExtent({ center: [0, 0, 0], radius: 2, height: 4 }),
        ).toBeInstanceOf(CylinderExtent);
    });

    it("reduces cylinders to intersecting blocks rather than centre-contained blocks", () => {
        const extent = cylinderExtent({
            center: [0, 0, 0],
            radius: 1,
            height: 2,
        });

        expect([...extent.blocks()]).toContainEqual({ x: 1, y: 0, z: 0 });
        expect([...extent.blocks()]).not.toContainEqual({ x: 2, y: 0, z: 0 });
    });

    it("represents a sphere", () => {
        const extent = new SphereExtent({
            center: { x: 0, y: 0, z: 0 },
            radius: 2,
        });

        expect(extent.containsPoint({ x: 1, y: 1, z: 1 })).toBe(true);
        expect(extent.containsPoint({ x: 3, y: 0, z: 0 })).toBe(false);
        expect(extent.bounds()?.toBlockBoundingBox()).toEqual({
            min: { x: -2, y: -2, z: -2 },
            max: { x: 2, y: 2, z: 2 },
        });
        expect(
            extent.classifyAABB(new AABB(-0.5, -0.5, -0.5, 0.5, 0.5, 0.5)),
        ).toBe("inside");
        expect(extent.classifyAABB(new AABB(3, 0, 0, 4, 1, 1))).toBe("outside");
        expect(sphereExtent({ center: [0, 0, 0], radius: 1 })).toBeInstanceOf(
            SphereExtent,
        );
    });

    it("reduces spheres to intersecting blocks rather than centre-contained blocks", () => {
        const extent = sphereExtent({ center: [0, 0, 0], radius: 1 });

        expect([...extent.blocks()]).toContainEqual({ x: 1, y: 0, z: 0 });
        expect([...extent.blocks()]).not.toContainEqual({ x: 1, y: 1, z: 1 });
    });

    it("contains floored points in a voxel extent", () => {
        const extent = new VoxelExtent([
            { x: 1, y: 2, z: 3 },
            { x: 4, y: 5, z: 6 },
        ]);

        expect(extent.containsPoint({ x: 1.9, y: 2.1, z: 3.5 })).toBe(true);
        expect(extent.containsPoint({ x: 2, y: 2, z: 3 })).toBe(false);
        expect([...extent.blocks()]).toEqual([
            { x: 1, y: 2, z: 3 },
            { x: 4, y: 5, z: 6 },
        ]);
        expect(extent.volume()).toBe(2);
        expect(voxelExtent([{ x: 0, y: 0, z: 0 }])).toBeInstanceOf(VoxelExtent);
    });

    it("represents a simple vertical polygon column", () => {
        const extent = new PolygonExtent({
            points: [
                [0, 0],
                [4, 0],
                [4, 4],
                [0, 4],
            ],
            y: { min: 60, max: 70 },
        });

        expect(extent.containsPoint({ x: 2, y: 65, z: 2 })).toBe(true);
        expect(extent.containsPoint({ x: 5, y: 65, z: 2 })).toBe(false);
        expect(extent.containsPoint({ x: 2, y: 71, z: 2 })).toBe(false);
        expect(extent.bounds()?.toBlockBoundingBox()).toEqual({
            min: { x: 0, y: 60, z: 0 },
            max: { x: 4, y: 70, z: 4 },
        });
        expect(extent.volume()).toBe(160);
        expect([...extent.blocks({ bounds: "half-open" })]).toContainEqual({
            x: 1,
            y: 60,
            z: 1,
        });
        expect([...extent.blocks({ bounds: "half-open" })]).not.toContainEqual({
            x: 5,
            y: 60,
            z: 1,
        });
        expect(
            polygonExtent({
                points: [
                    [0, 0],
                    [1, 0],
                    [0, 1],
                ],
                y: { min: 0, max: 1 },
            }),
        ).toBeInstanceOf(PolygonExtent);
    });

    it("rejects invalid polygon extent definitions", () => {
        expect(
            () =>
                new PolygonExtent({
                    points: [
                        [0, 0],
                        [1, 0],
                    ],
                    y: { min: 0, max: 1 },
                }),
        ).toThrow("PolygonExtent requires at least 3 points.");
        expect(
            () =>
                new PolygonExtent({
                    points: [
                        [0, 0],
                        [1, 0],
                        [0, 1],
                    ],
                    y: { min: 4, max: 4 },
                }),
        ).toThrow("PolygonExtent y.max must be greater than y.min.");
    });

    it("caches immutable voxel bounds instead of rebuilding them", () => {
        const extent = voxelExtent([{ x: 1, y: 2, z: 3 }]);

        expect(extent.bounds()).toBe(extent.bounds());
    });

    it("combines extents with union containment", () => {
        const extent = new UnionExtent([
            blockExtent({ x: 0, y: 0, z: 0 }),
            blockExtent({ x: 5, y: 0, z: 0 }),
        ]);

        expect(extent.containsPoint({ x: 0.5, y: 0.5, z: 0.5 })).toBe(true);
        expect(extent.containsPoint({ x: 5.5, y: 0.5, z: 0.5 })).toBe(true);
        expect(extent.containsPoint({ x: 2, y: 0, z: 0 })).toBe(false);
        expect(unionExtent([blockExtent([0, 0, 0])])).toBeInstanceOf(
            UnionExtent,
        );
    });

    it("only reports exact union volume when child bounds cannot overlap", () => {
        expect(
            unionExtent([
                blockExtent({ x: 0, y: 0, z: 0 }),
                blockExtent({ x: 1, y: 0, z: 0 }),
            ]).volume(),
        ).toBe(2);
        expect(
            unionExtent([
                blockExtent({ x: 0, y: 0, z: 0 }),
                blockExtent({ x: 0, y: 0, z: 0 }),
            ]).volume(),
        ).toBeUndefined();
    });

    it("samples a union child without probing sample twice", () => {
        const calls = [0, 0];
        const left = {
            containsPoint: () => false,
            bounds: () => undefined,
            volume: () => undefined,
            sample: () => {
                calls[0] += 1;
                return undefined;
            },
            blocks: function* () {},
        };
        const right = {
            containsPoint: () => false,
            bounds: () => undefined,
            volume: () => undefined,
            sample: () => {
                calls[1] += 1;
                return new Vec3(1, 2, 3);
            },
            blocks: function* () {},
        };

        expect(
            unionExtent([left, right])
                .sample(() => 0)
                ?.toObject(),
        ).toEqual({
            x: 1,
            y: 2,
            z: 3,
        });
        expect(calls).toEqual([1, 1]);
    });

    it("translates a child extent without changing the child", () => {
        const extent = new TranslatedExtent(blockExtent({ x: 0, y: 0, z: 0 }), {
            x: 10,
            y: 0,
            z: -2,
        });

        expect(extent.containsPoint({ x: 10.5, y: 0.5, z: -1.5 })).toBe(true);
        expect(extent.containsPoint({ x: 0.5, y: 0.5, z: 0.5 })).toBe(false);
        expect(extent.bounds()?.toBlockBoundingBox()).toEqual({
            min: { x: 10, y: 0, z: -2 },
            max: { x: 11, y: 1, z: -1 },
        });
        expect(
            translatedExtent(blockExtent([0, 0, 0]), [1, 2, 3]),
        ).toBeInstanceOf(TranslatedExtent);
    });

    it("reduces translated extents to integer blocks after fractional offsets", () => {
        const extent = translatedExtent(blockExtent([0, 0, 0]), [0.5, 0, 0]);

        expect([...extent.blocks()]).toEqual([
            { x: 0, y: 0, z: 0 },
            { x: 1, y: 0, z: 0 },
        ]);
    });

    it("represents an unbounded infinite extent", () => {
        const extent = new InfiniteExtent();

        expect(
            extent.containsPoint({ x: 1_000_000, y: 64, z: -1_000_000 }),
        ).toBe(true);
        expect(extent.bounds()).toBeUndefined();
        expect(extent.volume()).toBeUndefined();
        expect(extent.sample()).toBeUndefined();
        expect([...extent.blocks()]).toEqual([]);
        expect(infiniteExtent()).toBeInstanceOf(InfiniteExtent);
    });

    it("reports conservative clearance for simple bounded extents", () => {
        const box = boxExtent(new AABB(0, 0, 0, 4, 2, 6));
        const block = blockExtent({ x: 1, y: 2, z: 3 });
        const voxels = voxelExtent([{ x: 4, y: 5, z: 6 }]);

        expect(box.clearanceAt({ x: 2, y: 1, z: 3 })).toBe(1);
        expect(box.clearanceAt({ x: 5, y: 1, z: 3 })).toBe(0);
        expect(block.clearanceAt({ x: 1.5, y: 2.5, z: 3.5 })).toBe(0.5);
        expect(block.clearanceAt({ x: 2, y: 2.5, z: 3.5 })).toBe(0);
        expect(voxels.clearanceAt({ x: 4.5, y: 5.5, z: 6.5 })).toBe(0.5);
    });

    it("samples with the existing function-shaped random source", () => {
        const random = () => 0.25;

        expect(
            boxExtent(new AABB(0, 0, 0, 4, 2, 6))
                .sample(random)
                .toObject(),
        ).toEqual({ x: 1, y: 0.5, z: 1.5 });
        expect(
            blockExtent({ x: 1, y: 2, z: 3 }).sample(random).toObject(),
        ).toEqual({
            x: 1.5,
            y: 2.5,
            z: 3.5,
        });
    });
});
