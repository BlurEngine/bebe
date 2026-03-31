import type { Vec3Init } from "./vec3.js";

/**
 * A small value used to compare floating point numbers.
 */
export const EPSILON = 1e-7;

/**
 * Source of pseudo-random values in the half-open range [0, 1).
 */
export type RandomSource = () => number;

/**
 * Comparison function used to order values for searching or sorting.
 */
export type CompareFn<T> = (a: T, b: T) => number;

/**
 * Primitive values that support the default binary-search comparator.
 */
export type OrderedValue = number | string | bigint | Date;

/**
 * Weighted value entry used by weighted random selection helpers.
 */
export type WeightedEntry<T> = {
    value: T;
    weight: number;
};

/**
 * Angular orientation expressed in degrees.
 */
export type YawPitch = {
    yaw: number;
    pitch: number;
};

/**
 * Local orthogonal basis vectors derived from an orientation.
 */
export type DirectionBasis = {
    forward: Vec3Init;
    right: Vec3Init;
    up: Vec3Init;
};

type NumericRange = {
    min: number;
    max: number;
};

function normalizeRange(min: number, max: number): NumericRange {
    return min <= max ? { min, max } : { min: max, max: min };
}

function normalizeDecimalPlaces(decimals: number): number {
    return clamp(Math.trunc(decimals), 0, 100);
}

function defaultCompare(a: OrderedValue, b: OrderedValue): number {
    if (a < b) return -1;
    if (a > b) return 1;
    return 0;
}

/**
 * Clamp a number between two bounds. Bound order is ignored.
 */
export function clamp(value: number, min: number, max: number): number {
    const bounds = normalizeRange(min, max);
    return Math.max(bounds.min, Math.min(bounds.max, value));
}

/**
 * Returns the sign of a number as -1, 0, or 1 (signed ternary).
 * Equivalent to Math.sign, but always returns an integer.
 */
export function signedTernary(n: number): -1 | 0 | 1 {
    if (n > 0) return 1;
    if (n < 0) return -1;
    return 0;
}

/**
 * Returns the fractional part of a number (the part after the decimal point).
 * Always returns a value in [0, 1).
 */
export function frac(n: number): number {
    return n - Math.floor(n);
}

/**
 * Convert degrees to radians.
 */
export function toRadians(degrees: number): number {
    return (degrees * Math.PI) / 180;
}

/**
 * Convert yaw (Y) and pitch (X) in degrees to a unit direction vector.
 * Matches Bedrock's convention: yaw around Y, pitch around X.
 */
export function yawPitchToDirection(
    yawDeg: number,
    pitchDeg: number,
): Vec3Init {
    const yaw = toRadians(yawDeg);
    const pitch = toRadians(pitchDeg);
    const cosPitch = Math.cos(pitch);
    return {
        x: -Math.sin(yaw) * cosPitch,
        y: Math.sin(pitch),
        z: Math.cos(yaw) * cosPitch,
    };
}

/**
 * Like Number.toFixed, but trims trailing zeros and a dangling decimal point.
 */
export function formatFixedTrim(n: number, decimals: number = 2): string {
    let s = n.toFixed(normalizeDecimalPlaces(decimals));
    if (s.includes(".")) {
        s = s.replace(/0+$/, "");
        if (s.endsWith(".")) s = s.slice(0, -1);
    }
    return s;
}

/**
 * Determine if a velocity vector is moving beyond a small threshold.
 */
export function isMovingVelocity(
    v: Vec3Init | undefined | null,
    threshold: number = 0.01,
): boolean {
    if (!v) return false;
    const limit = Math.abs(threshold);
    return (
        Math.abs(v.x) > limit || Math.abs(v.y) > limit || Math.abs(v.z) > limit
    );
}

/**
 * Convert radians to degrees.
 */
export function radiansToDegrees(radians: number): number {
    return (radians * 180) / Math.PI;
}

/**
 * Wrap an angle in degrees to the range [-180, 180).
 */
export function wrapAngle180(angleDeg: number): number {
    const a = (((angleDeg + 180) % 360) + 360) % 360;
    return a - 180;
}

/**
 * Wrap an angle in degrees to the range [0, 360).
 */
export function wrapAngle360(angleDeg: number): number {
    return ((angleDeg % 360) + 360) % 360;
}

/**
 * Linear interpolation between a and b by t in [0,1].
 */
export function lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
}

/**
 * Inverse lerp: returns t in [0,1] such that lerp(a,b,t) = v.
 */
export function invLerp(a: number, b: number, v: number): number {
    if (a === b) return 0;
    return (v - a) / (b - a);
}

/**
 * Remap a value from one range to another.
 */
export function remap(
    inMin: number,
    inMax: number,
    outMin: number,
    outMax: number,
    v: number,
): number {
    return lerp(outMin, outMax, clamp(invLerp(inMin, inMax, v), 0, 1));
}

/**
 * Smooth Hermite interpolation between 0 and 1 when x is in [edge0, edge1].
 */
export function smoothstep(edge0: number, edge1: number, x: number): number {
    const t = clamp(invLerp(edge0, edge1, x), 0, 1);
    return t * t * (3 - 2 * t);
}

/**
 * Smootherstep: a smoother variant of smoothstep.
 */
export function smootherstep(edge0: number, edge1: number, x: number): number {
    const t = clamp(invLerp(edge0, edge1, x), 0, 1);
    return t * t * t * (t * (t * 6 - 15) + 10);
}

/**
 * Returns true if a and b are approximately equal within epsilon.
 */
export function approxEqual(
    a: number,
    b: number,
    epsilon: number = EPSILON,
): boolean {
    return Math.abs(a - b) <= epsilon;
}

/**
 * Returns true if |n| <= epsilon.
 */
export function approxZero(n: number, epsilon: number = EPSILON): boolean {
    return Math.abs(n) <= epsilon;
}

/**
 * Quantize n to the nearest multiple of step.
 */
export function quantize(n: number, step: number): number {
    if (step === 0) return n;
    return Math.round(n / step) * step;
}

/**
 * Round n to a fixed decimal count.
 */
export function roundTo(n: number, decimals: number): number {
    return parseFloat(n.toFixed(normalizeDecimalPlaces(decimals)));
}

/**
 * Squared length of a 3D vector.
 */
export function lengthSquared3(v: Vec3Init): number {
    return v.x * v.x + v.y * v.y + v.z * v.z;
}

/**
 * Length of a 3D vector.
 */
export function length3(v: Vec3Init): number {
    return Math.sqrt(lengthSquared3(v));
}

/**
 * Squared distance between two 3D points.
 */
export function distanceSquared3(a: Vec3Init, b: Vec3Init): number {
    return lengthSquared3({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
}

/**
 * Distance between two 3D points.
 */
export function distance3(a: Vec3Init, b: Vec3Init): number {
    return length3({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
}

/**
 * Normalize a 3D vector safely; returns fallback if length is ~0.
 */
export function normalizeSafe3(
    v: Vec3Init,
    fallback: Vec3Init = { x: 0, y: 0, z: 0 },
): Vec3Init {
    const m2 = lengthSquared3(v);
    if (approxZero(m2, EPSILON * EPSILON)) return fallback;
    const inv = 1 / Math.sqrt(m2);
    return { x: v.x * inv, y: v.y * inv, z: v.z * inv };
}

/**
 * Snap a vector to a uniform grid size.
 */
export function snapToGrid3(v: Vec3Init, step: number = 1): Vec3Init {
    if (step === 0) return { x: v.x, y: v.y, z: v.z };
    return {
        x: Math.round(v.x / step) * step,
        y: Math.round(v.y / step) * step,
        z: Math.round(v.z / step) * step,
    };
}

/**
 * Round vector components to N decimals.
 */
export function roundVec3(v: Vec3Init, decimals: number): Vec3Init {
    return {
        x: roundTo(v.x, decimals),
        y: roundTo(v.y, decimals),
        z: roundTo(v.z, decimals),
    };
}

/**
 * Convert a floating vector to integer block position by flooring.
 */
export function toBlockPos(v: Vec3Init): Vec3Init {
    return { x: Math.floor(v.x), y: Math.floor(v.y), z: Math.floor(v.z) };
}

/**
 * Center of a block cell at integer position.
 */
export function blockCenter(pos: Vec3Init): Vec3Init {
    return { x: pos.x + 0.5, y: pos.y + 0.5, z: pos.z + 0.5 };
}

/**
 * Convert a direction vector to yaw/pitch in degrees (matching yawPitchToDirection inverse).
 */
export function directionToYawPitch(dir: Vec3Init): YawPitch {
    const n = normalizeSafe3(dir, { x: 0, y: 0, z: 1 });
    const yaw = radiansToDegrees(Math.atan2(-n.x, n.z));
    const pitch = radiansToDegrees(Math.asin(n.y));
    return { yaw, pitch };
}

/**
 * Return local basis vectors (forward, right, up) for a yaw/pitch orientation.
 */
export function forwardRightUp(
    yawDeg: number,
    pitchDeg: number,
): DirectionBasis {
    const f = yawPitchToDirection(yawDeg, pitchDeg);
    const right = normalizeSafe3(
        { x: f.z, y: 0, z: -f.x },
        { x: 1, y: 0, z: 0 },
    );
    const up = {
        x: right.y * f.z - right.z * f.y,
        y: right.z * f.x - right.x * f.z,
        z: right.x * f.y - right.y * f.x,
    };
    return { forward: f, right, up };
}

/**
 * Random integer in [min, max] inclusive.
 * Returns undefined when the normalized range contains no integers.
 */
export function randomInt(
    min: number,
    max: number,
    rng: RandomSource = Math.random,
): number | undefined {
    const bounds = normalizeRange(min, max);
    const lo = Math.ceil(bounds.min);
    const hi = Math.floor(bounds.max);
    if (lo > hi) return undefined;
    return Math.floor(rng() * (hi - lo + 1)) + lo;
}

/**
 * Random float in [min, max).
 */
export function randomFloat(
    min: number,
    max: number,
    rng: RandomSource = Math.random,
): number {
    const bounds = normalizeRange(min, max);
    return rng() * (bounds.max - bounds.min) + bounds.min;
}

/**
 * Choose a value based on weights.
 * Returns undefined if the list is empty or every usable weight is <= 0.
 * Non-finite weights are ignored.
 * In the unlikely event that floating-point subtraction misses every interval,
 * the final entry is returned as a defensive fallback.
 */
export function chooseWeighted<T>(
    entries: readonly WeightedEntry<T>[],
    rng: RandomSource = Math.random,
): T | undefined {
    let total = 0;
    for (const entry of entries) {
        total += Number.isFinite(entry.weight) ? Math.max(0, entry.weight) : 0;
    }
    if (total <= 0) return undefined;
    let r = rng() * total;
    for (const entry of entries) {
        const w = Number.isFinite(entry.weight) ? Math.max(0, entry.weight) : 0;
        if (r < w) return entry.value;
        r -= w;
    }
    return entries[entries.length - 1]?.value;
}

/**
 * Performs a binary search on a sorted array.
 * @param arr - The sorted array to search.
 * @param target - The value to search for.
 * @param compare - Optional comparison function. Required when searching values outside {@link OrderedValue}.
 * @returns The index of the target if found, otherwise -1.
 */
export function binarySearch<T extends OrderedValue>(
    arr: readonly T[],
    target: T,
): number;
export function binarySearch<T>(
    arr: readonly T[],
    target: T,
    compare: CompareFn<T>,
): number;
export function binarySearch<T>(
    arr: readonly T[],
    target: T,
    compare?: CompareFn<T>,
): number {
    const compareItems = compare ?? (defaultCompare as unknown as CompareFn<T>);
    let low = 0;
    let high = arr.length - 1;
    while (low <= high) {
        const mid = (low + high) >> 1;
        const cmp = compareItems(arr[mid], target);
        if (cmp === 0) return mid;
        if (cmp < 0) {
            low = mid + 1;
        } else {
            high = mid - 1;
        }
    }
    return -1;
}
