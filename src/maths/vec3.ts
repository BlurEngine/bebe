import { approxZero, clamp, EPSILON } from "./util.js";
/**
 * A minimal structural type accepted by Vec3 constructors.
 * This intentionally mirrors the shape used by the Minecraft Scripting API.
 */
export type Vec3Init = {
    readonly x: number;
    readonly y: number;
    readonly z: number;
};

/**
 * Tuple input accepted by {@link Vec3}.
 */
export type Vec3Tuple = readonly [number, number, number];

/**
 * Any structure that can be coerced into a {@link Vec3}.
 */
export type Vec3Like = Vec3Init | Vec3Tuple;

/**
 * 3D vector with utility operations. Instances are immutable; methods return new vectors.
 * Designed to interoperate with APIs that accept objects of shape `{ x, y, z }` as well as tuple inputs like `[x, y, z]`.
 */
export class Vec3 {
    private readonly _x: number;
    private readonly _y: number;
    private readonly _z: number;

    get x(): number {
        return this._x;
    }
    get y(): number {
        return this._y;
    }
    get z(): number {
        return this._z;
    }

    constructor(vec: Vec3Like);
    constructor(x: number, y: number, z: number);
    constructor(first: number | Vec3Like, second?: number, third?: number) {
        if (typeof first === "number") {
            this._x = first;
            this._y = second ?? 0;
            this._z = third ?? 0;
            return;
        }
        const components = Vec3.componentsFrom(first);
        this._x = components.x;
        this._y = components.y;
        this._z = components.z;
    }

    static zero(): Vec3 {
        return new Vec3(0, 0, 0);
    }

    static one(): Vec3 {
        return new Vec3(1, 1, 1);
    }

    static up(): Vec3 {
        return new Vec3(0, 1, 0);
    }

    static down(): Vec3 {
        return new Vec3(0, -1, 0);
    }

    static left(): Vec3 {
        return new Vec3(-1, 0, 0);
    }

    static right(): Vec3 {
        return new Vec3(1, 0, 0);
    }

    static forward(): Vec3 {
        return new Vec3(0, 0, 1);
    }

    static back(): Vec3 {
        return new Vec3(0, 0, -1);
    }

    equals(v: Vec3Like, epsilon = EPSILON): boolean {
        const components = Vec3.componentsFrom(v);
        return (
            Math.abs(this._x - components.x) <= epsilon &&
            Math.abs(this._y - components.y) <= epsilon &&
            Math.abs(this._z - components.z) <= epsilon
        );
    }

    add(v: Vec3Like | Partial<Vec3Init>): Vec3 {
        if (Vec3.isTuple(v)) {
            const components = Vec3.componentsFrom(v);
            return new Vec3(
                this._x + components.x,
                this._y + components.y,
                this._z + components.z,
            );
        }
        const parts = v as Partial<Vec3Init>;
        return new Vec3(
            this._x + (parts.x ?? 0),
            this._y + (parts.y ?? 0),
            this._z + (parts.z ?? 0),
        );
    }

    subtract(v: Vec3Like | Partial<Vec3Init>): Vec3 {
        if (Vec3.isTuple(v)) {
            const components = Vec3.componentsFrom(v);
            return new Vec3(
                this._x - components.x,
                this._y - components.y,
                this._z - components.z,
            );
        }
        const parts = v as Partial<Vec3Init>;
        return new Vec3(
            this._x - (parts.x ?? 0),
            this._y - (parts.y ?? 0),
            this._z - (parts.z ?? 0),
        );
    }

    /** Multiply by scalar or component-wise by vector. */
    multiply(n: number): Vec3;
    multiply(v: Vec3Like): Vec3;
    multiply(arg: number | Vec3Like): Vec3 {
        if (typeof arg === "number")
            return new Vec3(this._x * arg, this._y * arg, this._z * arg);
        const components = Vec3.componentsFrom(arg);
        return new Vec3(
            this._x * components.x,
            this._y * components.y,
            this._z * components.z,
        );
    }

    /** Divide by scalar or component-wise by vector. */
    divide(n: number): Vec3;
    divide(v: Vec3Like): Vec3;
    divide(arg: number | Vec3Like): Vec3 {
        if (typeof arg === "number")
            return new Vec3(this._x / arg, this._y / arg, this._z / arg);
        const components = Vec3.componentsFrom(arg);
        return new Vec3(
            this._x / components.x,
            this._y / components.y,
            this._z / components.z,
        );
    }

    dot(v: Vec3Like): number {
        const components = Vec3.componentsFrom(v);
        return (
            this._x * components.x +
            this._y * components.y +
            this._z * components.z
        );
    }

    cross(v: Vec3Like): Vec3 {
        const components = Vec3.componentsFrom(v);
        return new Vec3(
            this._y * components.z - this._z * components.y,
            this._z * components.x - this._x * components.z,
            this._x * components.y - this._y * components.x,
        );
    }

    magnitude(): number {
        return Math.sqrt(
            this._x * this._x + this._y * this._y + this._z * this._z,
        );
    }

    distance(v: Vec3Like): number {
        return this.subtract(v).magnitude();
    }

    normalize(): Vec3 {
        const m = this.magnitude();
        if (approxZero(m, EPSILON)) return Vec3.zero();
        return new Vec3(this._x / m, this._y / m, this._z / m);
    }

    floor(): Vec3 {
        return new Vec3(
            Math.floor(this._x),
            Math.floor(this._y),
            Math.floor(this._z),
        );
    }

    clamp(limits?: { min?: Partial<Vec3Init>; max?: Partial<Vec3Init> }): Vec3 {
        const minX = limits?.min?.x ?? Number.NEGATIVE_INFINITY;
        const minY = limits?.min?.y ?? Number.NEGATIVE_INFINITY;
        const minZ = limits?.min?.z ?? Number.NEGATIVE_INFINITY;
        const maxX = limits?.max?.x ?? Number.POSITIVE_INFINITY;
        const maxY = limits?.max?.y ?? Number.POSITIVE_INFINITY;
        const maxZ = limits?.max?.z ?? Number.POSITIVE_INFINITY;
        return new Vec3(
            clamp(this._x, minX, maxX),
            clamp(this._y, minY, maxY),
            clamp(this._z, minZ, maxZ),
        );
    }

    lerp(v: Vec3Like, t: number): Vec3 {
        const components = Vec3.componentsFrom(v);
        return new Vec3(
            this._x + (components.x - this._x) * t,
            this._y + (components.y - this._y) * t,
            this._z + (components.z - this._z) * t,
        );
    }

    slerp(v: Vec3Like, t: number): Vec3 {
        const dot = this.dot(v);
        const theta = Math.acos(Math.max(-1, Math.min(1, dot)));
        const sinTheta = Math.sin(theta);
        if (sinTheta === 0) return this;
        const ta = Math.sin((1 - t) * theta) / sinTheta;
        const tb = Math.sin(t * theta) / sinTheta;
        return this.multiply(ta).add(new Vec3(v).multiply(tb));
    }

    rotateX(a: number): Vec3 {
        const cos = Math.cos(a);
        const sin = Math.sin(a);
        return new Vec3(
            this.x,
            this.y * cos - this.z * sin,
            this.z * cos + this.y * sin,
        );
    }

    rotateY(a: number): Vec3 {
        const cos = Math.cos(a);
        const sin = Math.sin(a);
        return new Vec3(
            this.x * cos + this.z * sin,
            this.y,
            this.z * cos - this.x * sin,
        );
    }

    rotateZ(a: number): Vec3 {
        const cos = Math.cos(a);
        const sin = Math.sin(a);
        return new Vec3(
            this.x * cos - this.y * sin,
            this.y * cos + this.x * sin,
            this.z,
        );
    }

    toObject(): Vec3Init {
        return { x: this._x, y: this._y, z: this._z };
    }

    toXZ(): { x: number; z: number } {
        return { x: this._x, z: this._z };
    }

    toString(options?: { decimals?: number; delimiter?: string }): string {
        const decimals = options?.decimals ?? 2;
        const delimiter = options?.delimiter ?? ", ";
        return [
            this._x.toFixed(decimals),
            this._y.toFixed(decimals),
            this._z.toFixed(decimals),
        ].join(delimiter);
    }

    static parse(str: string, delimiter: string = ","): Vec3 | undefined {
        const parts = str.split(delimiter);
        if (parts.length !== 3) return undefined;
        const [xs, ys, zs] = parts.map((p) => parseFloat(p));
        if (
            !Number.isFinite(xs) ||
            !Number.isFinite(ys) ||
            !Number.isFinite(zs)
        )
            return undefined;
        return new Vec3(xs, ys, zs);
    }

    private static componentsFrom(value: Vec3Like): Vec3Init {
        if (Vec3.isTuple(value)) {
            if (value.length !== 3) {
                throw new RangeError(
                    "Vec3 tuple input must contain exactly 3 numeric entries.",
                );
            }
            const [x, y, z] = value;
            Vec3.assertFiniteNumber(x, "x");
            Vec3.assertFiniteNumber(y, "y");
            Vec3.assertFiniteNumber(z, "z");
            return { x, y, z };
        }
        Vec3.assertFiniteNumber(value.x, "x");
        Vec3.assertFiniteNumber(value.y, "y");
        Vec3.assertFiniteNumber(value.z, "z");
        return value;
    }

    private static assertFiniteNumber(
        value: number,
        axis: "x" | "y" | "z",
    ): void {
        if (!Number.isFinite(value)) {
            throw new TypeError(
                `Vec3 ${axis} component must be a finite number.`,
            );
        }
    }

    private static isTuple(value: unknown): value is Vec3Tuple {
        return Array.isArray(value);
    }
}

export function isVec3Like(v: unknown): v is Vec3Like {
    if (v instanceof Vec3) return true;
    if (Array.isArray(v)) {
        return (
            v.length === 3 &&
            Number.isFinite(v[0]) &&
            Number.isFinite(v[1]) &&
            Number.isFinite(v[2])
        );
    }
    if (!v || typeof v !== "object") return false;
    const o = v as Record<string, unknown>;
    return Number.isFinite(o.x) && Number.isFinite(o.y) && Number.isFinite(o.z);
}
