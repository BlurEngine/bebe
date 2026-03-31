import { afterEach, describe, expect, it, vi } from "vitest";
import {
    EPSILON,
    approxEqual,
    approxZero,
    binarySearch,
    blockCenter,
    chooseWeighted,
    clamp,
    directionToYawPitch,
    distance3,
    distanceSquared3,
    formatFixedTrim,
    forwardRightUp,
    frac,
    invLerp,
    isMovingVelocity,
    length3,
    lengthSquared3,
    lerp,
    normalizeSafe3,
    quantize,
    radiansToDegrees,
    randomFloat,
    randomInt,
    remap,
    roundTo,
    roundVec3,
    signedTernary,
    smoothstep,
    smootherstep,
    snapToGrid3,
    toBlockPos,
    toRadians,
    wrapAngle180,
    wrapAngle360,
    yawPitchToDirection,
} from "../../src/maths/util.js";

afterEach(() => {
    vi.restoreAllMocks();
});

describe("maths/util", () => {
    it("covers basic scalar helpers", () => {
        expect(clamp(10, 0, 5)).toBe(5);
        expect(clamp(0, 2, 1)).toBe(1);
        expect(signedTernary(-4)).toBe(-1);
        expect(signedTernary(0)).toBe(0);
        expect(signedTernary(4)).toBe(1);
        expect(frac(3.75)).toBeCloseTo(0.75);
        expect(frac(-1.25)).toBeCloseTo(0.75);
        expect(formatFixedTrim(4.5, 3)).toBe("4.5");
        expect(formatFixedTrim(4.5, 500)).toBe("4.5");
        expect(quantize(5.26, 0.25)).toBeCloseTo(5.25);
        expect(roundTo(1.2345, 2)).toBe(1.23);
        expect(roundTo(1.2345, 500)).toBeCloseTo(1.2345);
    });

    it("converts between angles and directions consistently", () => {
        const dir = yawPitchToDirection(90, 30);
        const angles = directionToYawPitch(dir);

        expect(dir.x).toBeCloseTo(-Math.cos(Math.PI / 6));
        expect(dir.y).toBeCloseTo(0.5);
        expect(dir.z).toBeCloseTo(0);
        expect(wrapAngle180(angles.yaw)).toBeCloseTo(90);
        expect(angles.pitch).toBeCloseTo(30);
        expect(toRadians(180)).toBeCloseTo(Math.PI);
        expect(radiansToDegrees(Math.PI / 2)).toBeCloseTo(90);
        expect(wrapAngle180(190)).toBe(-170);
        expect(wrapAngle360(-10)).toBe(350);
    });

    it("covers interpolation and comparison helpers", () => {
        expect(lerp(10, 20, 0.25)).toBe(12.5);
        expect(invLerp(10, 20, 12.5)).toBeCloseTo(0.25);
        expect(remap(0, 10, 0, 100, 15)).toBe(100);
        expect(smoothstep(0, 10, 5)).toBeCloseTo(0.5);
        expect(smootherstep(0, 10, 5)).toBeCloseTo(0.5);
        expect(approxEqual(1, 1 + EPSILON / 2)).toBe(true);
        expect(approxZero(EPSILON / 2)).toBe(true);
    });

    it("covers vector-shaped helpers", () => {
        const normalized = normalizeSafe3({ x: 3, y: 0, z: 4 });
        const basis = forwardRightUp(45, 0);

        expect(lengthSquared3({ x: 3, y: 4, z: 12 })).toBe(169);
        expect(length3({ x: 3, y: 4, z: 12 })).toBe(13);
        expect(
            distanceSquared3({ x: 0, y: 0, z: 0 }, { x: 1, y: 2, z: 2 }),
        ).toBe(9);
        expect(distance3({ x: 0, y: 0, z: 0 }, { x: 1, y: 2, z: 2 })).toBe(3);
        expect(normalized.x).toBeCloseTo(0.6);
        expect(normalized.y).toBeCloseTo(0);
        expect(normalized.z).toBeCloseTo(0.8);
        expect(
            normalizeSafe3({ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }),
        ).toEqual({ x: 1, y: 0, z: 0 });
        expect(snapToGrid3({ x: 1.2, y: 1.6, z: -1.2 }, 0.5)).toEqual({
            x: 1,
            y: 1.5,
            z: -1,
        });
        expect(roundVec3({ x: 1.234, y: 5.678, z: 9.876 }, 2)).toEqual({
            x: 1.23,
            y: 5.68,
            z: 9.88,
        });
        expect(toBlockPos({ x: 1.9, y: 2.1, z: -0.1 })).toEqual({
            x: 1,
            y: 2,
            z: -1,
        });
        expect(blockCenter({ x: 1, y: 2, z: 3 })).toEqual({
            x: 1.5,
            y: 2.5,
            z: 3.5,
        });
        expect(
            basis.forward.x * basis.right.x +
                basis.forward.y * basis.right.y +
                basis.forward.z * basis.right.z,
        ).toBeCloseTo(0);
        expect(
            basis.forward.x * basis.up.x +
                basis.forward.y * basis.up.y +
                basis.forward.z * basis.up.z,
        ).toBeCloseTo(0);
        expect(isMovingVelocity({ x: 0.02, y: 0, z: 0 })).toBe(true);
        expect(isMovingVelocity({ x: 0.001, y: 0, z: 0 })).toBe(false);
    });

    it("uses random helpers and binary search predictably", () => {
        vi.spyOn(Math, "random")
            .mockReturnValueOnce(0)
            .mockReturnValueOnce(0.5)
            .mockReturnValueOnce(0.9)
            .mockReturnValueOnce(0.25);

        expect(randomInt(1, 3)).toBe(1);
        expect(randomFloat(10, 20)).toBe(15);
        expect(randomInt(3, 1, () => 0)).toBe(1);
        expect(randomInt(1.2, 1.8, () => 0.5)).toBeUndefined();
        expect(randomFloat(20, 10, () => 0.25)).toBe(12.5);
        expect(
            chooseWeighted([
                { value: "a", weight: 1 },
                { value: "b", weight: 3 },
            ]),
        ).toBe("b");
        expect(
            chooseWeighted(
                [
                    { value: "a", weight: Number.NaN },
                    { value: "b", weight: 1 },
                ],
                () => 0,
            ),
        ).toBe("b");
        expect(chooseWeighted([{ value: "a", weight: 0 }])).toBeUndefined();
        expect(binarySearch([1, 3, 5, 7], 5)).toBe(2);
        expect(
            binarySearch(
                [{ id: 1 }, { id: 2 }, { id: 3 }],
                { id: 2 },
                (a, b) => a.id - b.id,
            ),
        ).toBe(1);
        expect(binarySearch([1, 3, 5, 7], 4)).toBe(-1);
    });
});
