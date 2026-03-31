import { describe, expect, it } from "vitest";
import { Vec3, isVec3Like } from "../../src/maths/vec3.js";

describe("maths/Vec3", () => {
    it("constructs from supported input shapes, parses strings explicitly, and exposes direction helpers", () => {
        expect(new Vec3(1, 2, 3).toObject()).toEqual({ x: 1, y: 2, z: 3 });
        expect(new Vec3([4, 5, 6]).toObject()).toEqual({ x: 4, y: 5, z: 6 });
        expect(new Vec3({ x: 7, y: 8, z: 9 }).toObject()).toEqual({
            x: 7,
            y: 8,
            z: 9,
        });
        expect(Vec3.parse("1|2|3", "|")?.toObject()).toEqual({
            x: 1,
            y: 2,
            z: 3,
        });
        expect(Vec3.parse("bad input")).toBeUndefined();
        expect(Vec3.up().toObject()).toEqual({ x: 0, y: 1, z: 0 });
        expect(Vec3.forward().toObject()).toEqual({ x: 0, y: 0, z: 1 });
    });

    it("supports arithmetic, geometry, and rotations", () => {
        const vec = new Vec3(1, 2, 3);

        expect(vec.add([1, 1, 1]).toObject()).toEqual({ x: 2, y: 3, z: 4 });
        expect(vec.subtract({ z: 2 }).toObject()).toEqual({ x: 1, y: 2, z: 1 });
        expect(vec.multiply(2).toObject()).toEqual({ x: 2, y: 4, z: 6 });
        expect(vec.multiply([2, 3, 4]).toObject()).toEqual({
            x: 2,
            y: 6,
            z: 12,
        });
        expect(vec.divide(2).toObject()).toEqual({ x: 0.5, y: 1, z: 1.5 });
        expect(vec.dot([4, 5, 6])).toBe(32);
        expect(new Vec3(1, 0, 0).cross([0, 1, 0]).toObject()).toEqual({
            x: 0,
            y: 0,
            z: 1,
        });
        expect(new Vec3(3, 4, 0).magnitude()).toBe(5);
        expect(new Vec3(3, 4, 0).normalize().toObject()).toEqual({
            x: 0.6,
            y: 0.8,
            z: 0,
        });
        expect(Vec3.zero().normalize().toObject()).toEqual({
            x: 0,
            y: 0,
            z: 0,
        });
        const rotateY = new Vec3(0, 0, 1).rotateY(Math.PI / 2);
        const rotateX = new Vec3(0, 1, 0).rotateX(Math.PI / 2);
        const rotateZ = new Vec3(1, 0, 0).rotateZ(Math.PI / 2);

        expect(rotateY.x).toBeCloseTo(1);
        expect(rotateY.y).toBeCloseTo(0);
        expect(rotateY.z).toBeCloseTo(0);
        expect(rotateX.x).toBeCloseTo(0);
        expect(rotateX.y).toBeCloseTo(0);
        expect(rotateX.z).toBeCloseTo(1);
        expect(rotateZ.x).toBeCloseTo(0);
        expect(rotateZ.y).toBeCloseTo(1);
        expect(rotateZ.z).toBeCloseTo(0);
    });

    it("supports slerp and guards tuple input", () => {
        const halfway = new Vec3(1, 0, 0).slerp([0, 0, 1], 0.5);

        expect(halfway.x).toBeCloseTo(Math.SQRT1_2);
        expect(halfway.y).toBeCloseTo(0);
        expect(halfway.z).toBeCloseTo(Math.SQRT1_2);
        expect(isVec3Like([1, 2, 3])).toBe(true);
        expect(isVec3Like({ x: 1, y: 2, z: 3 })).toBe(true);
        expect(isVec3Like([1, 2])).toBe(false);
        expect(
            () =>
                new Vec3([1, 2, Number.POSITIVE_INFINITY] as [
                    number,
                    number,
                    number,
                ]),
        ).toThrow("Vec3 z component must be a finite number.");
        expect(
            () => new Vec3([1, 2] as unknown as [number, number, number]),
        ).toThrow("Vec3 tuple input must contain exactly 3 numeric entries.");
        expect(() => new Vec3({ x: 1, y: 2, z: Number.NaN })).toThrow(
            "Vec3 z component must be a finite number.",
        );
    });
});
