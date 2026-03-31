import { approxZero, clamp, EPSILON } from "./util.js";

/**
 * A minimal structural type accepted by Vec2 constructors.
 * This intentionally mirrors the shape used by the Minecraft Scripting API.
 */
export type Vec2Init = { readonly x: number; readonly y: number };

/**
 * Tuple input accepted by {@link Vec2}.
 */
export type Vec2Tuple = readonly [number, number];

/**
 * Any structure that can be coerced into a {@link Vec2}.
 */
export type Vec2Like = Vec2Init | Vec2Tuple;

/**
 * 2D vector with utility operations. Instances are immutable; methods return new vectors.
 * Designed to interoperate with APIs that accept objects of shape `{ x, y }` as well as tuple inputs like `[x, y]`.
 */
export class Vec2 {
    private readonly _x: number;
    private readonly _y: number;

    get x(): number {
        return this._x;
    }

    get y(): number {
        return this._y;
    }

    constructor(vec: Vec2Like);
    constructor(x: number, y: number);
    constructor(first: number | Vec2Like, second?: number) {
        if (typeof first === "number") {
            this._x = first;
            this._y = second ?? 0;
            return;
        }
        const components = Vec2.componentsFrom(first);
        this._x = components.x;
        this._y = components.y;
    }

    static zero(): Vec2 {
        return new Vec2(0, 0);
    }

    static one(): Vec2 {
        return new Vec2(1, 1);
    }

    equals(v: Vec2Like, epsilon = EPSILON): boolean {
        const components = Vec2.componentsFrom(v);
        return (
            Math.abs(this._x - components.x) <= epsilon &&
            Math.abs(this._y - components.y) <= epsilon
        );
    }

    add(v: Vec2Like | Partial<Vec2Init>): Vec2 {
        if (Vec2.isTuple(v)) {
            const components = Vec2.componentsFrom(v);
            return new Vec2(this._x + components.x, this._y + components.y);
        }
        const parts = v as Partial<Vec2Init>;
        return new Vec2(this._x + (parts.x ?? 0), this._y + (parts.y ?? 0));
    }

    subtract(v: Vec2Like | Partial<Vec2Init>): Vec2 {
        if (Vec2.isTuple(v)) {
            const components = Vec2.componentsFrom(v);
            return new Vec2(this._x - components.x, this._y - components.y);
        }
        const parts = v as Partial<Vec2Init>;
        return new Vec2(this._x - (parts.x ?? 0), this._y - (parts.y ?? 0));
    }

    /** Multiply by scalar or component-wise by vector. */
    multiply(n: number): Vec2;
    multiply(v: Vec2Like): Vec2;
    multiply(arg: number | Vec2Like): Vec2 {
        if (typeof arg === "number")
            return new Vec2(this._x * arg, this._y * arg);
        const components = Vec2.componentsFrom(arg);
        return new Vec2(this._x * components.x, this._y * components.y);
    }

    /** Divide by scalar or component-wise by vector. */
    divide(n: number): Vec2;
    divide(v: Vec2Like): Vec2;
    divide(arg: number | Vec2Like): Vec2 {
        if (typeof arg === "number")
            return new Vec2(this._x / arg, this._y / arg);
        const components = Vec2.componentsFrom(arg);
        return new Vec2(this._x / components.x, this._y / components.y);
    }

    dot(v: Vec2Like): number {
        const components = Vec2.componentsFrom(v);
        return this._x * components.x + this._y * components.y;
    }

    magnitude(): number {
        return Math.sqrt(this._x * this._x + this._y * this._y);
    }

    distance(v: Vec2Like): number {
        return this.subtract(v).magnitude();
    }

    normalize(): Vec2 {
        const m = this.magnitude();
        if (approxZero(m, EPSILON)) return Vec2.zero();
        return new Vec2(this._x / m, this._y / m);
    }

    floor(): Vec2 {
        return new Vec2(Math.floor(this._x), Math.floor(this._y));
    }

    clamp(limits?: { min?: Partial<Vec2Init>; max?: Partial<Vec2Init> }): Vec2 {
        const minX = limits?.min?.x ?? Number.NEGATIVE_INFINITY;
        const minY = limits?.min?.y ?? Number.NEGATIVE_INFINITY;
        const maxX = limits?.max?.x ?? Number.POSITIVE_INFINITY;
        const maxY = limits?.max?.y ?? Number.POSITIVE_INFINITY;
        return new Vec2(clamp(this._x, minX, maxX), clamp(this._y, minY, maxY));
    }

    lerp(v: Vec2Like, t: number): Vec2 {
        const components = Vec2.componentsFrom(v);
        return new Vec2(
            this._x + (components.x - this._x) * t,
            this._y + (components.y - this._y) * t,
        );
    }

    toObject(): Vec2Init {
        return { x: this._x, y: this._y };
    }

    toString(options?: { decimals?: number; delimiter?: string }): string {
        const decimals = options?.decimals ?? 2;
        const delimiter = options?.delimiter ?? ", ";
        return [this._x.toFixed(decimals), this._y.toFixed(decimals)].join(
            delimiter,
        );
    }

    static parse(str: string, delimiter: string = ","): Vec2 | undefined {
        const parts = str.split(delimiter);
        if (parts.length !== 2) return undefined;
        const [xs, ys] = parts.map((p) => parseFloat(p));
        if (!Number.isFinite(xs) || !Number.isFinite(ys)) return undefined;
        return new Vec2(xs, ys);
    }

    private static componentsFrom(value: Vec2Like): Vec2Init {
        if (Vec2.isTuple(value)) {
            if (value.length !== 2) {
                throw new RangeError(
                    "Vec2 tuple input must contain exactly 2 numeric entries.",
                );
            }
            const [x, y] = value;
            Vec2.assertFiniteNumber(x, "x");
            Vec2.assertFiniteNumber(y, "y");
            return { x, y };
        }
        Vec2.assertFiniteNumber(value.x, "x");
        Vec2.assertFiniteNumber(value.y, "y");
        return value;
    }

    private static assertFiniteNumber(value: number, axis: "x" | "y"): void {
        if (!Number.isFinite(value)) {
            throw new TypeError(
                `Vec2 ${axis} component must be a finite number.`,
            );
        }
    }

    private static isTuple(value: unknown): value is Vec2Tuple {
        return Array.isArray(value);
    }
}
