import { describe, expect, it } from "vitest";
import {
    AABB,
    Vec3,
    compileCatmullRom,
    compilePolyline,
} from "@blurengine/bebe/maths";

describe("arc-length paths", () => {
    it("samples unequal three-dimensional segments by world distance", () => {
        const path = compilePolyline([
            [0, 0, 0],
            [3, 0, 0],
            [3, 4, 0],
            [3, 4, 12],
        ]);

        expect(path.length).toBe(19);
        expect(path.sample(5)).toEqual({
            distance: 5,
            position: new Vec3(3, 2, 0),
            tangent: new Vec3(0, 1, 0),
            segmentIndex: 1,
            segmentT: 0.5,
        });
        expect(path.sample(13)).toEqual({
            distance: 13,
            position: new Vec3(3, 4, 6),
            tangent: new Vec3(0, 0, 1),
            segmentIndex: 2,
            segmentT: 0.5,
        });
        expect(path.sample(3)?.segmentIndex).toBe(1);
        expect(path.sample(path.length)?.segmentT).toBe(1);
    });

    it("returns undefined outside an open route", () => {
        const path = compilePolyline([
            [0, 0, 0],
            [10, 0, 0],
        ]);

        expect(path.sample(-Number.EPSILON)).toBeUndefined();
        expect(path.sample(10.000001)).toBeUndefined();
        expect(path.sample(Number.NaN)).toBeUndefined();
        expect(path.bounds(-1, 2)).toBeUndefined();
        expect(path.bounds(2, 11)).toBeUndefined();
        expect(path.bounds(4, 3)).toBeUndefined();
    });

    it("bounds only the requested open interval including crossed vertices", () => {
        const path = compilePolyline([
            [0, 0, 0],
            [10, 0, 0],
            [10, 0, 10],
        ]);

        expect(path.bounds(5, 15)).toEqual(
            AABB.fromMinMax([5, 0, 0], [10, 0, 5]),
        );
        expect(path.bounds(10, 10)).toEqual(
            AABB.fromMinMax([10, 0, 0], [10, 0, 0]),
        );
    });

    it("wraps closed samples and interval bounds in both directions", () => {
        const path = compilePolyline(
            [
                [0, 0, 0],
                [10, 0, 0],
                [10, 0, 10],
                [0, 0, 10],
            ],
            true,
        );

        expect(path.length).toBe(40);
        expect(path.sample(45)?.position).toEqual(new Vec3(5, 0, 0));
        expect(path.sample(-5)).toEqual(
            expect.objectContaining({
                distance: 35,
                position: new Vec3(0, 0, 5),
            }),
        );
        expect(path.bounds(35, 45)).toEqual(
            AABB.fromMinMax([0, 0, 0], [5, 0, 5]),
        );
        expect(path.bounds(-5, 5)).toEqual(
            AABB.fromMinMax([0, 0, 0], [5, 0, 5]),
        );
        expect(path.bounds(5, 45)).toEqual(
            AABB.fromMinMax([0, 0, 0], [10, 0, 10]),
        );
    });

    it("rejects invalid points and only consecutive duplicate segments", () => {
        expect(() => compilePolyline([[0, 0, 0]])).toThrow(RangeError);
        expect(() =>
            compilePolyline([
                [0, 0, 0],
                [0, 0, 0],
            ]),
        ).toThrow(RangeError);
        expect(() =>
            compilePolyline(
                [
                    [0, 0, 0],
                    [1, 0, 0],
                ],
                true,
            ),
        ).toThrow(RangeError);
        expect(() =>
            compilePolyline([
                [0, 0, 0],
                [Number.POSITIVE_INFINITY, 0, 0],
            ]),
        ).toThrow(RangeError);

        expect(
            compilePolyline([
                [0, 0, 0],
                [1, 0, 0],
                [0, 0, 0],
                [0, 0, 1],
            ]).length,
        ).toBe(3);
    });
});

describe("centripetal Catmull-Rom paths", () => {
    it("keeps two-point open splines linear and preserves open endpoints", () => {
        const line = compileCatmullRom([
            [0, 0, 0],
            [0, 0, 10],
        ]);
        expect(line.length).toBe(10);
        expect(line.sample(5)?.position).toEqual(new Vec3(0, 0, 5));

        const path = compileCatmullRom(
            [
                [0, 0, 0],
                [5, 0, 0],
                [10, 0, 5],
            ],
            { subdivisionsPerSegment: 8 },
        );
        expect(path.sample(0)?.position).toEqual(new Vec3(0, 0, 0));
        expect(path.sample(path.length)?.position).toEqual(new Vec3(10, 0, 5));
    });

    it("is deterministic and continuous across a closed seam", () => {
        const controls = [
            [0, 2, 0],
            [8, 4, 0],
            [8, 3, 8],
            [0, 2, 8],
        ] as const;
        const first = compileCatmullRom(controls, {
            closed: true,
            subdivisionsPerSegment: 16,
        });
        const second = compileCatmullRom(controls, {
            closed: true,
            subdivisionsPerSegment: 16,
        });

        expect(first.length).toBe(second.length);
        for (const ratio of [0, 0.1, 0.5, 0.9, 1]) {
            expect(first.sample(first.length * ratio)).toEqual(
                second.sample(second.length * ratio),
            );
        }
        expect(
            first
                .sample(-0.01)
                ?.position.distance(
                    first.sample(0.01)?.position ?? Vec3.zero(),
                ),
        ).toBeLessThan(0.03);
    });

    it("rejects invalid subdivision and closed-control contracts", () => {
        expect(() => compileCatmullRom([[0, 0, 0]])).toThrow(RangeError);
        expect(() =>
            compileCatmullRom(
                [
                    [0, 0, 0],
                    [1, 0, 0],
                ],
                { subdivisionsPerSegment: 1.5 },
            ),
        ).toThrow(RangeError);
        expect(() =>
            compileCatmullRom(
                [
                    [0, 0, 0],
                    [1, 0, 0],
                ],
                { closed: true },
            ),
        ).toThrow(RangeError);
    });
});
