import type {
    AABB as MinecraftAABB,
    BlockBoundingBox,
} from "@minecraft/server";
import { clamp, EPSILON } from "./util.js";
import { isVec3Like, Vec3, type Vec3Init, type Vec3Like } from "./vec3.js";

/**
 * Box input accepted by AABB conversion helpers.
 */
export type AABBInput = AABB | MinecraftAABB | BlockBoundingBox;

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
 *
 * The class uses Bedrock's `center` and `extent` vocabulary, but remains
 * immutable. Use {@link toObject} when a plain mutable
 * {@link @minecraft/server!AABB}-shaped object is needed. `extent` is always
 * normalized to positive values. Derived `min` and `max` getters remain
 * available for box-corner work.
 */
export class AABB {
    private readonly _center: Vec3;
    private readonly _extent: Vec3;

    get center(): Vec3 {
        return this._center;
    }
    get extent(): Vec3 {
        return this._extent;
    }
    get min(): Vec3 {
        return this._center.subtract(this._extent);
    }
    get max(): Vec3 {
        return this._center.add(this._extent);
    }

    /**
     * Construct from `{ center, extent }`, `{ min, max }`, `(min, max)`, or 6
     * numbers. Any ordering of corners is accepted; the box is normalized.
     */
    constructor(box: MinecraftAABB);
    constructor(box: BlockBoundingBox);
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
        a: MinecraftAABB | BlockBoundingBox | Vec3Like | number,
        b?: Vec3Like | number,
        c?: number,
        d?: number,
        e?: number,
        f?: number,
    ) {
        let center: Vec3;
        let extent: Vec3;

        if (typeof a === "number") {
            ({ center, extent } = AABB.toCenterExtentFromMinMax(
                new Vec3(a, b as number, c as number),
                new Vec3(d as number, e as number, f as number),
            ));
        } else if (isAABBShapeLike(a)) {
            center = new Vec3(a.center);
            extent = AABB.normalizeExtent(a.extent);
        } else if (isBlockBoundingBoxLike(a)) {
            ({ center, extent } = AABB.toCenterExtentFromMinMax(
                new Vec3(a.min),
                new Vec3(a.max),
            ));
        } else {
            ({ center, extent } = AABB.toCenterExtentFromMinMax(
                new Vec3(a),
                new Vec3(b as Vec3Like),
            ));
        }

        this._center = center;
        this._extent = extent;
    }

    /** Return the 8 corners of the box (min-inclusive, max-inclusive). */
    corners(): [Vec3, Vec3, Vec3, Vec3, Vec3, Vec3, Vec3, Vec3] {
        const min = this.min;
        const max = this.max;

        return [
            new Vec3(min.x, min.y, min.z),
            new Vec3(max.x, min.y, min.z),
            new Vec3(min.x, max.y, min.z),
            new Vec3(max.x, max.y, min.z),
            new Vec3(min.x, min.y, max.z),
            new Vec3(max.x, min.y, max.z),
            new Vec3(min.x, max.y, max.z),
            new Vec3(max.x, max.y, max.z),
        ];
    }

    /** Half extents (size / 2). */
    halfExtents(): Vec3 {
        return this.extent;
    }

    /** Expand box to include a point, returning a new box. */
    expandToIncludePoint(p: Vec3Like): AABB {
        const point = new Vec3(p);
        const min = this.min;
        const max = this.max;

        return new AABB(
            Math.min(min.x, point.x),
            Math.min(min.y, point.y),
            Math.min(min.z, point.z),
            Math.max(max.x, point.x),
            Math.max(max.y, point.y),
            Math.max(max.z, point.z),
        );
    }

    /**
     * Convert to integral block spans for iteration.
     * Inclusive bounds include the max block; half-open bounds exclude it.
     */
    toBlockSpan(options?: BlockBoundsOptions): BlockSpan {
        const bounds = options?.bounds ?? "inclusive";
        const minPoint = this.min;
        const maxPoint = this.max;
        const min = {
            x: Math.floor(minPoint.x),
            y: Math.floor(minPoint.y),
            z: Math.floor(minPoint.z),
        };
        const max =
            bounds === "inclusive"
                ? {
                      x: Math.floor(maxPoint.x),
                      y: Math.floor(maxPoint.y),
                      z: Math.floor(maxPoint.z),
                  }
                : {
                      x: Math.ceil(maxPoint.x),
                      y: Math.ceil(maxPoint.y),
                      z: Math.ceil(maxPoint.z),
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

    /** Create a box from a Bedrock-style center and extent. */
    static fromCenterExtent(center: Vec3Like, extent: Vec3Like): AABB {
        const centerPoint = new Vec3(center);
        const extentPoint = AABB.normalizeExtent(extent);
        return new AABB(
            centerPoint.subtract(extentPoint),
            centerPoint.add(extentPoint),
        );
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
        return this._extent.multiply(2);
    }

    /** Volume (can be zero). */
    volume(): number {
        return this.width() * this.height() * this.depth();
    }

    /** Width (x-extent). */
    width(): number {
        return this._extent.x * 2;
    }

    /** Height (y-extent). */
    height(): number {
        return this._extent.y * 2;
    }

    /** Depth (z-extent). */
    depth(): number {
        return this._extent.z * 2;
    }

    /** True if the box dimensions are effectively zero (within epsilon). */
    isEmpty(epsilon = EPSILON): boolean {
        return (
            Math.abs(this._extent.x) * 2 <= epsilon &&
            Math.abs(this._extent.y) * 2 <= epsilon &&
            Math.abs(this._extent.z) * 2 <= epsilon
        );
    }

    /** Translate by an offset. */
    translate(offset: Vec3Like): AABB {
        return new AABB(this.min.add(offset), this.max.add(offset));
    }

    /** Expand (inflate) by a scalar or vector on all sides. */
    expandBy(amount: number | Vec3Like): AABB {
        const v =
            typeof amount === "number"
                ? new Vec3(amount, amount, amount)
                : new Vec3(amount);
        return new AABB(this.min.subtract(v), this.max.add(v));
    }

    /** Union with another box (smallest box containing both). */
    union(other: BlockBoundingBox): AABB {
        const o = AABB.from(other);
        const min = this.min;
        const max = this.max;
        return new AABB(
            Math.min(min.x, o.min.x),
            Math.min(min.y, o.min.y),
            Math.min(min.z, o.min.z),
            Math.max(max.x, o.max.x),
            Math.max(max.y, o.max.y),
            Math.max(max.z, o.max.z),
        );
    }

    /** Intersection with another box, or `undefined` if disjoint. */
    intersection(other: BlockBoundingBox): AABB | undefined {
        const o = AABB.from(other);
        const min = this.min;
        const max = this.max;
        const minX = Math.max(min.x, o.min.x);
        const minY = Math.max(min.y, o.min.y);
        const minZ = Math.max(min.z, o.min.z);
        const maxX = Math.min(max.x, o.max.x);
        const maxY = Math.min(max.y, o.max.y);
        const maxZ = Math.min(max.z, o.max.z);
        if (minX > maxX || minY > maxY || minZ > maxZ) return undefined;
        return new AABB(minX, minY, minZ, maxX, maxY, maxZ);
    }

    /** True if boxes overlap. `inclusive=true` counts touching faces as intersecting. */
    intersects(other: BlockBoundingBox, inclusive = true): boolean {
        const o = AABB.from(other);
        const min = this.min;
        const max = this.max;
        if (inclusive) {
            return (
                min.x <= o.max.x &&
                max.x >= o.min.x &&
                min.y <= o.max.y &&
                max.y >= o.min.y &&
                min.z <= o.max.z &&
                max.z >= o.min.z
            );
        }
        return (
            min.x < o.max.x &&
            max.x > o.min.x &&
            min.y < o.max.y &&
            max.y > o.min.y &&
            min.z < o.max.z &&
            max.z > o.min.z
        );
    }

    /** True if point is inside (within) the box. */
    containsPoint(p: Vec3Like, inclusive = true): boolean {
        const point = new Vec3(p);
        const min = this.min;
        const max = this.max;
        const px = point.x;
        const py = point.y;
        const pz = point.z;
        if (inclusive) {
            return (
                px >= min.x &&
                px <= max.x &&
                py >= min.y &&
                py <= max.y &&
                pz >= min.z &&
                pz <= max.z
            );
        }
        return (
            px > min.x &&
            px < max.x &&
            py > min.y &&
            py < max.y &&
            pz > min.z &&
            pz < max.z
        );
    }

    /** True if `other` is wholly contained within this box. */
    containsBox(other: BlockBoundingBox, inclusive = true): boolean {
        const o = AABB.from(other);
        return (
            this.containsPoint(o.min, inclusive) &&
            this.containsPoint(o.max, inclusive)
        );
    }

    /** Smallest vector to move point into the box (zero if already inside). */
    clampPoint(p: Vec3Like): Vec3 {
        const point = new Vec3(p);
        const min = this.min;
        const max = this.max;
        return new Vec3(
            clamp(point.x, min.x, max.x),
            clamp(point.y, min.y, max.y),
            clamp(point.z, min.z, max.z),
        );
    }

    /** Compare with epsilon tolerance on all coordinates. */
    equals(other: BlockBoundingBox, epsilon = EPSILON): boolean {
        const o = AABB.from(other);
        const min = this.min;
        const max = this.max;
        return (
            Math.abs(min.x - o.min.x) <= epsilon &&
            Math.abs(min.y - o.min.y) <= epsilon &&
            Math.abs(min.z - o.min.z) <= epsilon &&
            Math.abs(max.x - o.max.x) <= epsilon &&
            Math.abs(max.y - o.max.y) <= epsilon &&
            Math.abs(max.z - o.max.z) <= epsilon
        );
    }

    /**
     * Return a plain mutable object with Bedrock-compatible
     * `{ center, extent }`.
     */
    toObject(): MinecraftAABB {
        return {
            center: this._center.toObject(),
            extent: this._extent.toObject(),
        };
    }

    /**
     * Return a plain object with `{ min, max }` where min/max are plain
     * `{x,y,z}`.
     */
    toBlockBoundingBox(): BlockBoundingBox {
        return { min: this.min.toObject(), max: this.max.toObject() };
    }

    toString(): string {
        return `AABB(center=${this._center.toString({ decimals: 3 })}, extent=${this._extent.toString({ decimals: 3 })})`;
    }

    /** Structural conversion. Accepts AABB, `{ center, extent }`, or `{ min, max }`. */
    static from(box: AABBInput): AABB {
        if (box instanceof AABB) return box;
        if (isAABBShapeLike(box)) return new AABB(box);
        return new AABB(box);
    }

    private static normalizeExtent(extent: Vec3Like): Vec3 {
        const value = new Vec3(extent);
        return new Vec3(
            Math.abs(value.x),
            Math.abs(value.y),
            Math.abs(value.z),
        );
    }

    private static toCenterExtentFromMinMax(
        a: Vec3,
        b: Vec3,
    ): { center: Vec3; extent: Vec3 } {
        const normalized = AABB.normalizeMinMax(a, b);
        return {
            center: new Vec3(
                (normalized.min.x + normalized.max.x) * 0.5,
                (normalized.min.y + normalized.max.y) * 0.5,
                (normalized.min.z + normalized.max.z) * 0.5,
            ),
            extent: new Vec3(
                (normalized.max.x - normalized.min.x) * 0.5,
                (normalized.max.y - normalized.min.y) * 0.5,
                (normalized.max.z - normalized.min.z) * 0.5,
            ),
        };
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

function isBlockBoundingBoxLike(v: unknown): v is BlockBoundingBox {
    if (!v || typeof v !== "object") return false;
    const b = v as Record<string, unknown>;
    return isVec3Like(b.min) && isVec3Like(b.max);
}

function isAABBShapeLike(v: unknown): v is MinecraftAABB {
    if (!v || typeof v !== "object") return false;
    const box = v as Record<string, unknown>;
    return isVec3Like(box.center) && isVec3Like(box.extent);
}

/**
 * Returns true when a value is an AABB instance or a structural
 * `{ center, extent }` box.
 */
export function isAABBLike(v: unknown): v is AABB | MinecraftAABB {
    if (v instanceof AABB) return true;
    return isAABBShapeLike(v);
}

/**
 * Convert a Bedrock-style `{ center, extent }` or `{ min, max }` box into an
 * AABB instance. Returns the same instance when already an AABB.
 */
export function toAABB(box: AABBInput): AABB {
    return AABB.from(box);
}
