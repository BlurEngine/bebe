import { clamp, EPSILON } from "./util.js";
import { isVec3Like, Vec3, type Vec3Init, type Vec3Like } from "./vec3.js";

/**
 * Structural alias for the Minecraft Scripting API BlockBoundingBox.
 * This shape is compatible with {@link @minecraft/server!BlockBoundingBox} without adding a type dependency.
 */
export type BlockBoundingBoxLike = { min: Vec3Like; max: Vec3Like };

/**
 * Box input accepted by AABB conversion helpers.
 */
export type AABBInput = AABB | BlockBoundingBoxLike;

/**
 * Block-iteration bounds mode for integer spans derived from an AABB.
 */
export type BlockBoundsMode = "inclusive" | "half-open";

/**
 * Options for deriving integer block spans from an AABB.
 */
export type BlockBoundsOptions = {
    /**
     * Inclusive mode includes the max block. Half-open mode excludes it.
     * Defaults to `"inclusive"`.
     */
    bounds?: BlockBoundsMode;
};

/**
 * Integer block span produced from an AABB for iteration or indexing.
 */
export type BlockSpan = {
    min: Vec3Init;
    max: Vec3Init;
};

/**
 * A lenient axis-aligned bounding box with common utilities.
 * The instance shape `{ min, max }` is intentionally compatible with the
 * Minecraft Scripting API BlockBoundingBox. `min` and `max` are always
 * normalized so that `min <= max` on all axes.
 */
export class AABB implements BlockBoundingBoxLike {
    private readonly _min: Vec3;
    private readonly _max: Vec3;

    get min(): Vec3 {
        return this._min;
    }
    get max(): Vec3 {
        return this._max;
    }

    /**
     * Construct from `{ min, max }` or `(min, max)` or 6 numbers.
     * Any ordering of corners is accepted; the box is normalized.
     */
    constructor(box: BlockBoundingBoxLike);
    constructor(min: Vec3Like, max: Vec3Like);
    constructor(
        minX: number,
        minY: number,
        minZ: number,
        maxX: number,
        maxY: number,
        maxZ: number,
    );
    constructor(
        a: BlockBoundingBoxLike | Vec3Like | number,
        b?: Vec3Like | number,
        c?: number,
        d?: number,
        e?: number,
        f?: number,
    ) {
        let min: Vec3;
        let max: Vec3;

        if (typeof a === "number") {
            min = new Vec3(a, b as number, c as number);
            max = new Vec3(d as number, e as number, f as number);
        } else if (isBlockBoundingBoxLike(a)) {
            min = new Vec3(a.min);
            max = new Vec3(a.max);
        } else {
            min = new Vec3(a);
            max = new Vec3(b as Vec3Like);
        }

        const n = AABB.normalizeMinMax(min, max);
        this._min = n.min;
        this._max = n.max;
    }

    /** Return the 8 corners of the box (min-inclusive, max-inclusive). */
    corners(): [Vec3, Vec3, Vec3, Vec3, Vec3, Vec3, Vec3, Vec3] {
        return [
            new Vec3(this._min.x, this._min.y, this._min.z),
            new Vec3(this._max.x, this._min.y, this._min.z),
            new Vec3(this._min.x, this._max.y, this._min.z),
            new Vec3(this._max.x, this._max.y, this._min.z),
            new Vec3(this._min.x, this._min.y, this._max.z),
            new Vec3(this._max.x, this._min.y, this._max.z),
            new Vec3(this._min.x, this._max.y, this._max.z),
            new Vec3(this._max.x, this._max.y, this._max.z),
        ];
    }

    /** Half extents (size / 2). */
    halfExtents(): Vec3 {
        const s = this.size();
        return new Vec3(s.x * 0.5, s.y * 0.5, s.z * 0.5);
    }

    /** Expand box to include a point, returning a new box. */
    expandToIncludePoint(p: Vec3Like): AABB {
        const point = new Vec3(p);
        return new AABB(
            Math.min(this._min.x, point.x),
            Math.min(this._min.y, point.y),
            Math.min(this._min.z, point.z),
            Math.max(this._max.x, point.x),
            Math.max(this._max.y, point.y),
            Math.max(this._max.z, point.z),
        );
    }

    /**
     * Convert to integral block spans for iteration.
     * Inclusive bounds include the max block; half-open bounds exclude it.
     */
    toBlockSpan(options?: BlockBoundsOptions): BlockSpan {
        const bounds = options?.bounds ?? "inclusive";
        const min = {
            x: Math.floor(this._min.x),
            y: Math.floor(this._min.y),
            z: Math.floor(this._min.z),
        };
        const max =
            bounds === "inclusive"
                ? {
                      x: Math.floor(this._max.x),
                      y: Math.floor(this._max.y),
                      z: Math.floor(this._max.z),
                  }
                : {
                      x: Math.ceil(this._max.x),
                      y: Math.ceil(this._max.y),
                      z: Math.ceil(this._max.z),
                  };
        return { min, max };
    }

    /** Iterate blocks within the box (integer grid). Defaults to inclusive bounds. */
    *blocks(options?: BlockBoundsOptions): Generator<Vec3Init> {
        const bounds = options?.bounds ?? "inclusive";
        const { min, max } = this.toBlockSpan({ bounds });
        const endX = bounds === "inclusive" ? max.x + 1 : max.x;
        const endY = bounds === "inclusive" ? max.y + 1 : max.y;
        const endZ = bounds === "inclusive" ? max.z + 1 : max.z;
        for (let y = min.y; y < endY; y++) {
            for (let z = min.z; z < endZ; z++) {
                for (let x = min.x; x < endX; x++) {
                    yield { x, y, z };
                }
            }
        }
    }

    /** Create an empty zero-sized box at origin. */
    static zero(): AABB {
        return new AABB(Vec3.zero(), Vec3.zero());
    }

    /** Create a box from two points (order agnostic). */
    static fromMinMax(min: Vec3Like, max: Vec3Like): AABB {
        return new AABB(min, max);
    }

    /** Create a box that contains all given points. */
    static fromPoints(...points: Vec3Like[]): AABB {
        if (points.length === 0) return AABB.zero();
        const first = new Vec3(points[0]);
        let minX = first.x;
        let minY = first.y;
        let minZ = first.z;
        let maxX = first.x;
        let maxY = first.y;
        let maxZ = first.z;
        for (let i = 1; i < points.length; i++) {
            const p = new Vec3(points[i]);
            if (p.x < minX) minX = p.x;
            if (p.y < minY) minY = p.y;
            if (p.z < minZ) minZ = p.z;
            if (p.x > maxX) maxX = p.x;
            if (p.y > maxY) maxY = p.y;
            if (p.z > maxZ) maxZ = p.z;
        }
        return new AABB(minX, minY, minZ, maxX, maxY, maxZ);
    }

    /** Create a box from a center and a uniform half-size (radius). */
    static fromCenterRadius(center: Vec3Like, radius: number): AABB {
        const r = new Vec3(radius, radius, radius);
        const c = new Vec3(center);
        return new AABB(c.subtract(r), c.add(r));
    }

    /** Create a box from a point and size with an anchor: 'min' | 'max' | 'center'. */
    static fromSize(
        point: Vec3Like,
        size: number | Vec3Like,
        options?: { anchor?: "min" | "max" | "center" },
    ): AABB {
        const s =
            typeof size === "number"
                ? new Vec3(size, size, size)
                : new Vec3(size);
        const anchor = options?.anchor ?? "min";
        if (anchor === "min") {
            const a = new Vec3(point);
            return new AABB(a, a.add(s));
        }
        if (anchor === "max") {
            const b = new Vec3(point);
            return new AABB(b.subtract(s), b);
        }
        // center
        const half = s.multiply(0.5);
        const c = new Vec3(point);
        return new AABB(c.subtract(half), c.add(half));
    }

    /** Size (width, height, depth). */
    size(): Vec3 {
        return this._max.subtract(this._min);
    }

    /** Center point. */
    center(): Vec3 {
        const s = this.size();
        return new Vec3(
            this._min.x + s.x * 0.5,
            this._min.y + s.y * 0.5,
            this._min.z + s.z * 0.5,
        );
    }

    /** Width (x-extent). */
    width(): number {
        return this._max.x - this._min.x;
    }

    /** Height (y-extent). */
    height(): number {
        return this._max.y - this._min.y;
    }

    /** Depth (z-extent). */
    depth(): number {
        return this._max.z - this._min.z;
    }

    /** Volume (can be zero). */
    volume(): number {
        const s = this.size();
        return s.x * s.y * s.z;
    }

    /** True if the box dimensions are effectively zero (within epsilon). */
    isEmpty(epsilon = EPSILON): boolean {
        const s = this.size();
        return (
            Math.abs(s.x) <= epsilon &&
            Math.abs(s.y) <= epsilon &&
            Math.abs(s.z) <= epsilon
        );
    }

    /** Translate by an offset. */
    translate(offset: Vec3Like): AABB {
        const o = new Vec3(offset);
        return new AABB(this._min.add(o), this._max.add(o));
    }

    /** Expand (inflate) by a scalar or vector on all sides. */
    expandBy(amount: number | Vec3Like): AABB {
        const v =
            typeof amount === "number"
                ? new Vec3(amount, amount, amount)
                : new Vec3(amount);
        return new AABB(this._min.subtract(v), this._max.add(v));
    }

    /** Union with another box (smallest box containing both). */
    union(other: BlockBoundingBoxLike): AABB {
        const o = AABB.from(other);
        return new AABB(
            Math.min(this._min.x, o.min.x),
            Math.min(this._min.y, o.min.y),
            Math.min(this._min.z, o.min.z),
            Math.max(this._max.x, o.max.x),
            Math.max(this._max.y, o.max.y),
            Math.max(this._max.z, o.max.z),
        );
    }

    /** Intersection with another box, or `undefined` if disjoint. */
    intersection(other: BlockBoundingBoxLike): AABB | undefined {
        const o = AABB.from(other);
        const minX = Math.max(this._min.x, o.min.x);
        const minY = Math.max(this._min.y, o.min.y);
        const minZ = Math.max(this._min.z, o.min.z);
        const maxX = Math.min(this._max.x, o.max.x);
        const maxY = Math.min(this._max.y, o.max.y);
        const maxZ = Math.min(this._max.z, o.max.z);
        if (minX > maxX || minY > maxY || minZ > maxZ) return undefined;
        return new AABB(minX, minY, minZ, maxX, maxY, maxZ);
    }

    /** True if boxes overlap. `inclusive=true` counts touching faces as intersecting. */
    intersects(other: BlockBoundingBoxLike, inclusive = true): boolean {
        const o = AABB.from(other);
        if (inclusive) {
            return (
                this._min.x <= o.max.x &&
                this._max.x >= o.min.x &&
                this._min.y <= o.max.y &&
                this._max.y >= o.min.y &&
                this._min.z <= o.max.z &&
                this._max.z >= o.min.z
            );
        }
        return (
            this._min.x < o.max.x &&
            this._max.x > o.min.x &&
            this._min.y < o.max.y &&
            this._max.y > o.min.y &&
            this._min.z < o.max.z &&
            this._max.z > o.min.z
        );
    }

    /** True if point is inside (within) the box. */
    containsPoint(p: Vec3Like, inclusive = true): boolean {
        const point = new Vec3(p);
        const px = point.x;
        const py = point.y;
        const pz = point.z;
        if (inclusive) {
            return (
                px >= this._min.x &&
                px <= this._max.x &&
                py >= this._min.y &&
                py <= this._max.y &&
                pz >= this._min.z &&
                pz <= this._max.z
            );
        }
        return (
            px > this._min.x &&
            px < this._max.x &&
            py > this._min.y &&
            py < this._max.y &&
            pz > this._min.z &&
            pz < this._max.z
        );
    }

    /** True if `other` is wholly contained within this box. */
    containsBox(other: BlockBoundingBoxLike, inclusive = true): boolean {
        const o = AABB.from(other);
        return (
            this.containsPoint(o.min, inclusive) &&
            this.containsPoint(o.max, inclusive)
        );
    }

    /** Smallest vector to move point into the box (zero if already inside). */
    clampPoint(p: Vec3Like): Vec3 {
        const point = new Vec3(p);
        return new Vec3(
            clamp(point.x, this._min.x, this._max.x),
            clamp(point.y, this._min.y, this._max.y),
            clamp(point.z, this._min.z, this._max.z),
        );
    }

    /** Compare with epsilon tolerance on all coordinates. */
    equals(other: BlockBoundingBoxLike, epsilon = EPSILON): boolean {
        const o = AABB.from(other);
        return (
            Math.abs(this._min.x - o.min.x) <= epsilon &&
            Math.abs(this._min.y - o.min.y) <= epsilon &&
            Math.abs(this._min.z - o.min.z) <= epsilon &&
            Math.abs(this._max.x - o.max.x) <= epsilon &&
            Math.abs(this._max.y - o.max.y) <= epsilon &&
            Math.abs(this._max.z - o.max.z) <= epsilon
        );
    }

    /**
     * Return a plain object with `{ min, max }` where min/max are plain `{x,y,z}`.
     * Useful when passing to APIs that read a structural BlockBoundingBox.
     */
    toObject(): BlockBoundingBoxLike {
        return { min: this._min.toObject(), max: this._max.toObject() };
    }

    toString(): string {
        return `AABB(min=${this._min.toString({ decimals: 3 })}, max=${this._max.toString({ decimals: 3 })})`;
    }

    /** Structural conversion. Accepts AABB or `{ min, max }`. */
    static from(box: AABBInput): AABB {
        if (box instanceof AABB) return box;
        return new AABB(box);
    }

    private static normalizeMinMax(a: Vec3, b: Vec3): { min: Vec3; max: Vec3 } {
        const min = new Vec3(
            Math.min(a.x, b.x),
            Math.min(a.y, b.y),
            Math.min(a.z, b.z),
        );
        const max = new Vec3(
            Math.max(a.x, b.x),
            Math.max(a.y, b.y),
            Math.max(a.z, b.z),
        );
        return { min, max };
    }
}

function isBlockBoundingBoxLike(v: unknown): v is BlockBoundingBoxLike {
    if (!v || typeof v !== "object") return false;
    const b = v as Record<string, unknown>;
    return isVec3Like(b.min) && isVec3Like(b.max);
}

/**
 * Returns true when a value is an AABB instance or a structural `{ min, max }` box.
 */
export function isAABBLike(v: unknown): v is AABBInput {
    if (v instanceof AABB) return true;
    return isBlockBoundingBoxLike(v);
}

/**
 * Convert any structural `{ min, max }` box into an AABB instance.
 * Returns the same instance when already an AABB.
 */
export function toAABB(box: AABBInput): AABB {
    return AABB.from(box);
}
