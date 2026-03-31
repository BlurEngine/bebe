import { describe, expect, it } from "vitest";
import { Vec2 } from "../../src/maths/vec2.js";

describe("maths/Vec2", () => {
    it("constructs from numbers, tuples, and objects, and parses strings explicitly", () => {
        expect(new Vec2(1, 2).toObject()).toEqual({ x: 1, y: 2 });
        expect(new Vec2([3, 4]).toObject()).toEqual({ x: 3, y: 4 });
        expect(new Vec2({ x: 5, y: 6 }).toObject()).toEqual({ x: 5, y: 6 });
        expect(Vec2.parse("2|3", "|")?.toObject()).toEqual({ x: 2, y: 3 });
        expect(Vec2.parse("2")).toBeUndefined();
        expect(Vec2.parse("bad input")).toBeUndefined();
    });

    it("supports arithmetic and interpolation helpers", () => {
        const vec = new Vec2(4, 6);

        expect(vec.add([1, 2]).toObject()).toEqual({ x: 5, y: 8 });
        expect(vec.add({ x: 1 }).toObject()).toEqual({ x: 5, y: 6 });
        expect(vec.subtract([2, 3]).toObject()).toEqual({ x: 2, y: 3 });
        expect(vec.multiply(2).toObject()).toEqual({ x: 8, y: 12 });
        expect(vec.multiply([2, 3]).toObject()).toEqual({ x: 8, y: 18 });
        expect(vec.divide(2).toObject()).toEqual({ x: 2, y: 3 });
        expect(vec.dot([2, 1])).toBe(14);
        expect(vec.distance([4, 10])).toBe(4);
        expect(new Vec2(3, 4).normalize().toObject()).toEqual({
            x: 0.6,
            y: 0.8,
        });
        expect(Vec2.zero().normalize().toObject()).toEqual({ x: 0, y: 0 });
        expect(new Vec2(1.9, -1.1).floor().toObject()).toEqual({
            x: 1,
            y: -2,
        });
        expect(
            new Vec2(10, -10)
                .clamp({
                    min: { x: 0, y: -5 },
                    max: { x: 5, y: 5 },
                })
                .toObject(),
        ).toEqual({ x: 5, y: -5 });
        expect(new Vec2(0, 10).lerp([10, 0], 0.25).toObject()).toEqual({
            x: 2.5,
            y: 7.5,
        });
    });

    it("formats and validates tuple input", () => {
        expect(new Vec2(1 / 3, 2 / 3).toString({ decimals: 3 })).toBe(
            "0.333, 0.667",
        );
        expect(new Vec2(1, 2).equals([1, 2])).toBe(true);
        expect(() => new Vec2([1, Number.NaN] as [number, number])).toThrow(
            "Vec2 y component must be a finite number.",
        );
        expect(
            () => new Vec2([1, 2, 3] as unknown as [number, number]),
        ).toThrow("Vec2 tuple input must contain exactly 2 numeric entries.");
        expect(() => new Vec2({ x: 1, y: Number.POSITIVE_INFINITY })).toThrow(
            "Vec2 y component must be a finite number.",
        );
    });
});
