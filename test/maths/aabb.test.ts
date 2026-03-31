import { describe, expect, it } from "vitest";
import { AABB, isAABBLike, toAABB } from "../../src/maths/aabb.js";

describe("maths/AABB", () => {
    it("normalizes corners and exposes derived geometry", () => {
        const box = new AABB({ x: 5, y: 4, z: 3 }, { x: 1, y: 2, z: 0 });

        expect(box.min.toObject()).toEqual({ x: 1, y: 2, z: 0 });
        expect(box.max.toObject()).toEqual({ x: 5, y: 4, z: 3 });
        expect(box.size().toObject()).toEqual({ x: 4, y: 2, z: 3 });
        expect(box.center().toObject()).toEqual({ x: 3, y: 3, z: 1.5 });
        expect(box.width()).toBe(4);
        expect(box.height()).toBe(2);
        expect(box.depth()).toBe(3);
        expect(box.volume()).toBe(24);
        expect(box.halfExtents().toObject()).toEqual({ x: 2, y: 1, z: 1.5 });
        expect(box.corners()).toHaveLength(8);
    });

    it("builds from helpers and supports spatial queries", () => {
        const fromPoints = AABB.fromPoints(
            { x: 1, y: 2, z: 3 },
            { x: -1, y: 0, z: 5 },
            { x: 3, y: 4, z: 1 },
        );
        const fromRadius = AABB.fromCenterRadius({ x: 5, y: 5, z: 5 }, 2);
        const fromCenterSize = AABB.fromSize(
            { x: 0, y: 0, z: 0 },
            { x: 4, y: 2, z: 6 },
            { anchor: "center" },
        );

        expect(fromPoints.min.toObject()).toEqual({ x: -1, y: 0, z: 1 });
        expect(fromPoints.max.toObject()).toEqual({ x: 3, y: 4, z: 5 });
        expect(fromRadius.min.toObject()).toEqual({ x: 3, y: 3, z: 3 });
        expect(fromRadius.max.toObject()).toEqual({ x: 7, y: 7, z: 7 });
        expect(fromCenterSize.min.toObject()).toEqual({ x: -2, y: -1, z: -3 });
        expect(fromCenterSize.max.toObject()).toEqual({ x: 2, y: 1, z: 3 });
        expect(fromPoints.containsPoint({ x: 0, y: 1, z: 2 })).toBe(true);
        expect(fromPoints.containsBox(new AABB(0, 1, 2, 1, 2, 3))).toBe(true);
        expect(fromPoints.intersects(new AABB(3, 4, 5, 6, 7, 8))).toBe(true);
        expect(
            fromPoints.intersection(new AABB(0, 0, 0, 2, 2, 2))?.toObject(),
        ).toEqual({
            min: { x: 0, y: 0, z: 1 },
            max: { x: 2, y: 2, z: 2 },
        });
        expect(
            fromPoints.union(new AABB(10, 10, 10, 12, 12, 12)).toObject(),
        ).toEqual({
            min: { x: -1, y: 0, z: 1 },
            max: { x: 12, y: 12, z: 12 },
        });
    });

    it("translates, expands, clamps, and converts structurally", () => {
        const box = new AABB(0, 0, 0, 1, 1, 1);

        expect(box.translate({ x: 1, y: 2, z: 3 }).toObject()).toEqual({
            min: { x: 1, y: 2, z: 3 },
            max: { x: 2, y: 3, z: 4 },
        });
        expect(box.expandBy(1).toObject()).toEqual({
            min: { x: -1, y: -1, z: -1 },
            max: { x: 2, y: 2, z: 2 },
        });
        expect(
            box.expandToIncludePoint({ x: -2, y: 0.5, z: 3 }).toObject(),
        ).toEqual({
            min: { x: -2, y: 0, z: 0 },
            max: { x: 1, y: 1, z: 3 },
        });
        expect(box.clampPoint({ x: 2, y: -1, z: 0.5 }).toObject()).toEqual({
            x: 1,
            y: 0,
            z: 0.5,
        });
        expect(
            box.equals(
                new AABB({
                    min: { x: 0, y: 0, z: 0 },
                    max: { x: 1, y: 1, z: 1 },
                }),
            ),
        ).toBe(true);
        expect(isAABBLike(box)).toBe(true);
        expect(
            isAABBLike({
                min: { x: 0, y: 0, z: 0 },
                max: { x: 1, y: 1, z: 1 },
            }),
        ).toBe(true);
        expect(toAABB(box)).toBe(box);
        expect(
            toAABB({
                min: { x: 0, y: 0, z: 0 },
                max: { x: 1, y: 1, z: 1 },
            }).toObject(),
        ).toEqual({
            min: { x: 0, y: 0, z: 0 },
            max: { x: 1, y: 1, z: 1 },
        });
        expect(AABB.zero().isEmpty()).toBe(true);
    });

    it("reports block spans and iterates inclusive or half-open integer blocks", () => {
        const box = new AABB(0, 0, 0, 1.25, 1.25, 1.25);

        expect(box.toBlockSpan({ bounds: "inclusive" })).toEqual({
            min: { x: 0, y: 0, z: 0 },
            max: { x: 1, y: 1, z: 1 },
        });
        expect(box.toBlockSpan({ bounds: "half-open" })).toEqual({
            min: { x: 0, y: 0, z: 0 },
            max: { x: 2, y: 2, z: 2 },
        });
        expect(Array.from(box.blocks())).toHaveLength(8);
        expect(Array.from(box.blocks({ bounds: "half-open" }))).toHaveLength(8);
        expect(
            Array.from(
                new AABB(0, 0, 0, 1, 1, 1).blocks({
                    bounds: "half-open",
                }),
            ),
        ).toHaveLength(1);
    });
});
