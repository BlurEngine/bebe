import { AABB, type AABBInput, type BlockBoundsOptions } from "./aabb.js";
import { clamp, type RandomSource } from "./util.js";
import { Vec3, type Vec3Init, type Vec3Like } from "./vec3.js";
import { getVoxelKey, VoxelSet } from "./voxels.js";

/**
 * How an extent relates to an AABB used for broad-phase spatial checks.
 */
export type ExtentAABBClassification = "inside" | "outside" | "intersects";

/**
 * Options for reducing an extent to integer block locations.
 */
export type ExtentBlockOptions = BlockBoundsOptions;

/**
 * Pure spatial capability for authored gameplay space.
 *
 * Extents do not know about dimensions, worlds, entities, ticking, or event
 * listeners. Those concerns belong to zone registries and monitors built above
 * this maths surface.
 */
export interface Extent {
    containsPoint(point: Vec3Like): boolean;
    bounds(): AABB | undefined;
    volume(): number | undefined;
    sample(random?: RandomSource): Vec3 | undefined;
    blocks(options?: ExtentBlockOptions): Iterable<Vec3Init>;
}

/**
 * Extent with optional acceleration information for spatial indexes.
 */
export interface OptimizableExtent extends Extent {
    classifyAABB(box: AABB): ExtentAABBClassification;
    clearanceAt(point: Vec3Like): number | undefined;
}

/**
 * Options for a vertical cylinder extent.
 */
export type CylinderExtentOptions = {
    center: Vec3Like;
    radius: number;
    height: number;
};

/**
 * Options for a sphere extent.
 */
export type SphereExtentOptions = {
    center: Vec3Like;
    radius: number;
};

/**
 * 2D XZ point accepted by vertical polygon extents.
 */
export type PolygonExtentPoint =
    | readonly [number, number]
    | {
          readonly x: number;
          readonly z: number;
      };

/**
 * Options for a simple vertical polygon prism.
 */
export type PolygonExtentOptions = {
    points: readonly PolygonExtentPoint[];
    y: {
        min: number;
        max: number;
    };
};

/**
 * Extent backed by an axis-aligned bounding box.
 */
export class BoxExtent implements OptimizableExtent {
    private readonly box: AABB;

    constructor(box: AABBInput) {
        this.box = AABB.from(box);
    }

    containsPoint(point: Vec3Like): boolean {
        return this.box.containsPoint(point);
    }

    bounds(): AABB {
        return this.box;
    }

    volume(): number {
        return this.box.volume();
    }

    sample(random?: RandomSource): Vec3 {
        const min = this.box.min;
        const max = this.box.max;

        return new Vec3(
            min.x + (max.x - min.x) * randomUnit(random),
            min.y + (max.y - min.y) * randomUnit(random),
            min.z + (max.z - min.z) * randomUnit(random),
        );
    }

    blocks(options?: ExtentBlockOptions): Iterable<Vec3Init> {
        return this.box.blocks(options);
    }

    classifyAABB(box: AABB): ExtentAABBClassification {
        if (!this.box.intersects(box, true)) {
            return "outside";
        }

        if (this.box.containsBox(box, true)) {
            return "inside";
        }

        return "intersects";
    }

    clearanceAt(point: Vec3Like): number {
        const location = new Vec3(point);
        const min = this.box.min;
        const max = this.box.max;

        if (
            location.x < min.x ||
            location.x > max.x ||
            location.y < min.y ||
            location.y > max.y ||
            location.z < min.z ||
            location.z > max.z
        ) {
            return 0;
        }

        return clearanceWithinBounds(location, min, max);
    }
}

/**
 * Extent representing one half-open integer block cell.
 */
export class BlockExtent implements OptimizableExtent {
    private readonly block: Vec3;

    constructor(block: Vec3Like) {
        this.block = new Vec3(block).floor();
    }

    containsPoint(point: Vec3Like): boolean {
        const { x, y, z } = getVec3Components(point);
        const block = this.block;

        return (
            x >= block.x &&
            x < block.x + 1 &&
            y >= block.y &&
            y < block.y + 1 &&
            z >= block.z &&
            z < block.z + 1
        );
    }

    bounds(): AABB {
        const block = this.block;

        return new AABB(
            block.x,
            block.y,
            block.z,
            block.x + 1,
            block.y + 1,
            block.z + 1,
        );
    }

    volume(): number {
        return 1;
    }

    sample(_random?: RandomSource): Vec3 {
        const block = this.block;

        return new Vec3(block.x + 0.5, block.y + 0.5, block.z + 0.5);
    }

    *blocks(_options?: ExtentBlockOptions): Iterable<Vec3Init> {
        yield this.block.toObject();
    }

    classifyAABB(box: AABB): ExtentAABBClassification {
        const min = box.min;
        const max = box.max;
        const block = this.block;

        if (
            max.x <= block.x ||
            min.x >= block.x + 1 ||
            max.y <= block.y ||
            min.y >= block.y + 1 ||
            max.z <= block.z ||
            min.z >= block.z + 1
        ) {
            return "outside";
        }

        if (
            min.x >= block.x &&
            max.x < block.x + 1 &&
            min.y >= block.y &&
            max.y < block.y + 1 &&
            min.z >= block.z &&
            max.z < block.z + 1
        ) {
            return "inside";
        }

        return "intersects";
    }

    clearanceAt(point: Vec3Like): number {
        if (!this.containsPoint(point)) {
            return 0;
        }

        const block = this.block;

        return clearanceWithinCell(point, block.x, block.y, block.z);
    }
}

/**
 * Vertical cylinder extent using the y-axis as height.
 */
export class CylinderExtent implements OptimizableExtent {
    private readonly center: Vec3;
    private readonly radius: number;
    private readonly radiusSquared: number;
    private readonly height: number;
    private readonly halfHeight: number;
    private readonly minY: number;
    private readonly maxY: number;
    private readonly box: AABB;

    constructor(options: CylinderExtentOptions) {
        this.center = new Vec3(options.center);
        this.radius = assertNonNegativeFinite(options.radius, "radius");
        this.radiusSquared = this.radius * this.radius;
        this.height = assertNonNegativeFinite(options.height, "height");
        this.halfHeight = this.height * 0.5;
        this.minY = this.center.y - this.halfHeight;
        this.maxY = this.center.y + this.halfHeight;

        this.box = new AABB(
            this.center.x - this.radius,
            this.minY,
            this.center.z - this.radius,
            this.center.x + this.radius,
            this.maxY,
            this.center.z + this.radius,
        );
    }

    containsPoint(point: Vec3Like): boolean {
        const { x, y, z } = new Vec3(point);
        const dx = x - this.center.x;
        const dz = z - this.center.z;

        return (
            y >= this.minY &&
            y <= this.maxY &&
            dx * dx + dz * dz <= this.radiusSquared
        );
    }

    bounds(): AABB {
        return this.box;
    }

    volume(): number {
        return Math.PI * this.radius * this.radius * this.height;
    }

    sample(random?: RandomSource): Vec3 {
        const angle = randomUnit(random) * Math.PI * 2;
        const distance = Math.sqrt(randomUnit(random)) * this.radius;
        const y = this.minY + randomUnit(random) * this.height;

        return new Vec3(
            this.center.x + Math.cos(angle) * distance,
            y,
            this.center.z + Math.sin(angle) * distance,
        );
    }

    *blocks(options?: ExtentBlockOptions): Iterable<Vec3Init> {
        for (const block of this.box.blocks(options)) {
            if (
                blockIntersectsVerticalCylinder(
                    block,
                    this.center,
                    this.radiusSquared,
                    this.minY,
                    this.maxY,
                )
            ) {
                yield block;
            }
        }
    }

    classifyAABB(box: AABB): ExtentAABBClassification {
        if (
            !this.box.intersects(box, true) ||
            this.isAABBOutsideCylinder(box)
        ) {
            return "outside";
        }

        if (box.corners().every((corner) => this.containsPoint(corner))) {
            return "inside";
        }

        return "intersects";
    }

    clearanceAt(point: Vec3Like): number {
        const { x, y, z } = new Vec3(point);
        const dx = x - this.center.x;
        const dz = z - this.center.z;
        const horizontalDistanceSquared = dx * dx + dz * dz;

        if (
            y < this.minY ||
            y > this.maxY ||
            horizontalDistanceSquared > this.radiusSquared
        ) {
            return 0;
        }

        const horizontalDistance = Math.sqrt(horizontalDistanceSquared);
        const horizontalClearance = this.radius - horizontalDistance;
        const verticalClearance = this.halfHeight - Math.abs(y - this.center.y);

        return Math.max(0, Math.min(horizontalClearance, verticalClearance));
    }

    private isAABBOutsideCylinder(box: AABB): boolean {
        const min = box.min;
        const max = box.max;

        if (max.y < this.minY || min.y > this.maxY) {
            return true;
        }

        const closestX = clamp(this.center.x, min.x, max.x);
        const closestZ = clamp(this.center.z, min.z, max.z);
        const dx = closestX - this.center.x;
        const dz = closestZ - this.center.z;

        return dx * dx + dz * dz > this.radiusSquared;
    }
}

/**
 * Spherical extent using Euclidean distance from a center point.
 */
export class SphereExtent implements OptimizableExtent {
    private readonly center: Vec3;
    private readonly radius: number;
    private readonly radiusSquared: number;
    private readonly box: AABB;

    constructor(options: SphereExtentOptions) {
        this.center = new Vec3(options.center);
        this.radius = assertNonNegativeFinite(options.radius, "radius");
        this.radiusSquared = this.radius * this.radius;
        this.box = AABB.fromCenterRadius(this.center, this.radius);
    }

    containsPoint(point: Vec3Like): boolean {
        return this.center.distanceSquared(point) <= this.radiusSquared;
    }

    bounds(): AABB {
        return this.box;
    }

    volume(): number {
        return (4 / 3) * Math.PI * this.radius * this.radius * this.radius;
    }

    sample(random?: RandomSource): Vec3 {
        const theta = randomUnit(random) * Math.PI * 2;
        const z = randomUnit(random) * 2 - 1;
        const planar = Math.sqrt(1 - z * z);
        const distance = Math.cbrt(randomUnit(random)) * this.radius;

        return new Vec3(
            this.center.x + Math.cos(theta) * planar * distance,
            this.center.y + z * distance,
            this.center.z + Math.sin(theta) * planar * distance,
        );
    }

    *blocks(options?: ExtentBlockOptions): Iterable<Vec3Init> {
        for (const block of this.box.blocks(options)) {
            if (blockIntersectsSphere(block, this.center, this.radiusSquared)) {
                yield block;
            }
        }
    }

    classifyAABB(box: AABB): ExtentAABBClassification {
        if (!this.box.intersects(box, true) || this.isAABBOutsideSphere(box)) {
            return "outside";
        }

        if (box.corners().every((corner) => this.containsPoint(corner))) {
            return "inside";
        }

        return "intersects";
    }

    clearanceAt(point: Vec3Like): number {
        const location = new Vec3(point);
        const dx = location.x - this.center.x;
        const dy = location.y - this.center.y;
        const dz = location.z - this.center.z;
        const distanceSquared = dx * dx + dy * dy + dz * dz;

        if (distanceSquared > this.radiusSquared) {
            return 0;
        }

        return Math.max(0, this.radius - Math.sqrt(distanceSquared));
    }

    private isAABBOutsideSphere(box: AABB): boolean {
        const closest = box.clampPoint(this.center);

        return this.center.distanceSquared(closest) > this.radiusSquared;
    }
}

/**
 * Simple vertical prism from a 2D XZ polygon and y min/max.
 */
export class PolygonExtent implements Extent {
    private readonly points: readonly Vec2XZ[];
    private readonly minY: number;
    private readonly maxY: number;
    private readonly box: AABB;
    private readonly area: number;

    constructor(options: PolygonExtentOptions) {
        if (options.points.length < 3) {
            throw new TypeError("PolygonExtent requires at least 3 points.");
        }

        const minY = assertFinite(options.y.min, "PolygonExtent y.min");
        const maxY = assertFinite(options.y.max, "PolygonExtent y.max");
        if (maxY <= minY) {
            throw new TypeError(
                "PolygonExtent y.max must be greater than y.min.",
            );
        }

        this.points = options.points.map(toPolygonPoint);
        this.minY = minY;
        this.maxY = maxY;
        this.area = Math.abs(polygonSignedArea(this.points));
        if (this.area === 0) {
            throw new TypeError("PolygonExtent requires a non-zero area.");
        }

        const bounds = getPolygonBounds(this.points);
        this.box = new AABB(
            bounds.minX,
            this.minY,
            bounds.minZ,
            bounds.maxX,
            this.maxY,
            bounds.maxZ,
        );
    }

    containsPoint(point: Vec3Like): boolean {
        const { x, y, z } = getVec3Components(point);

        return (
            y >= this.minY &&
            y <= this.maxY &&
            containsPolygonPoint(this.points, x, z)
        );
    }

    bounds(): AABB {
        return this.box;
    }

    volume(): number {
        return this.area * (this.maxY - this.minY);
    }

    sample(random?: RandomSource): Vec3 | undefined {
        const min = this.box.min;
        const max = this.box.max;

        for (let attempt = 0; attempt < 256; attempt += 1) {
            const x = min.x + (max.x - min.x) * randomUnit(random);
            const z = min.z + (max.z - min.z) * randomUnit(random);

            if (containsPolygonPoint(this.points, x, z)) {
                return new Vec3(
                    x,
                    this.minY + (this.maxY - this.minY) * randomUnit(random),
                    z,
                );
            }
        }

        return undefined;
    }

    *blocks(options?: ExtentBlockOptions): Iterable<Vec3Init> {
        for (const block of this.box.blocks(options)) {
            if (
                blockIntersectsPolygonColumn(
                    block,
                    this.points,
                    this.minY,
                    this.maxY,
                )
            ) {
                yield block;
            }
        }
    }
}

/**
 * Extent backed by exact integer voxel membership.
 */
export class VoxelExtent implements OptimizableExtent {
    private readonly voxels: VoxelSet;
    private readonly locations: readonly Vec3[];
    private readonly cachedBounds: AABB | undefined;

    constructor(voxels: Iterable<Vec3Like>) {
        this.voxels = new VoxelSet(voxels);
        this.locations = this.voxels.toArray();
        this.cachedBounds = getVoxelBounds(this.locations);
    }

    containsPoint(point: Vec3Like): boolean {
        return this.voxels.has(new Vec3(point).floor());
    }

    bounds(): AABB | undefined {
        return this.cachedBounds;
    }

    volume(): number {
        return this.voxels.size;
    }

    sample(random?: RandomSource): Vec3 | undefined {
        if (this.locations.length === 0) {
            return undefined;
        }

        const index = Math.min(
            this.locations.length - 1,
            Math.floor(randomUnit(random) * this.locations.length),
        );

        return this.locations[index].add({ x: 0.5, y: 0.5, z: 0.5 });
    }

    *blocks(_options?: ExtentBlockOptions): Iterable<Vec3Init> {
        for (const voxel of this.locations) {
            yield voxel.toObject();
        }
    }

    classifyAABB(box: AABB): ExtentAABBClassification {
        const bounds = this.bounds();

        if (!bounds || !bounds.intersects(box, true)) {
            return "outside";
        }

        let sawBlock = false;
        for (const block of box.blocks({ bounds: "half-open" })) {
            sawBlock = true;
            if (!this.voxels.has(block)) {
                return this.intersectsAnyVoxel(box) ? "intersects" : "outside";
            }
        }

        return sawBlock ? "inside" : "intersects";
    }

    clearanceAt(point: Vec3Like): number {
        const block = new Vec3(point).floor();

        if (!this.voxels.has(block)) {
            return 0;
        }

        return clearanceWithinCell(point, block.x, block.y, block.z);
    }

    private intersectsAnyVoxel(box: AABB): boolean {
        const min = box.min;
        const max = box.max;

        for (const voxel of this.locations) {
            if (
                voxel.x < max.x &&
                voxel.x + 1 > min.x &&
                voxel.y < max.y &&
                voxel.y + 1 > min.y &&
                voxel.z < max.z &&
                voxel.z + 1 > min.z
            ) {
                return true;
            }
        }

        return false;
    }
}

/**
 * Extent that contains points accepted by any child extent.
 */
export class UnionExtent implements OptimizableExtent {
    private readonly extents: readonly Extent[];

    constructor(extents: Iterable<Extent>) {
        this.extents = [...extents];
    }

    containsPoint(point: Vec3Like): boolean {
        return this.extents.some((extent) => extent.containsPoint(point));
    }

    bounds(): AABB | undefined {
        let bounds: AABB | undefined;

        for (const extent of this.extents) {
            const childBounds = extent.bounds();
            if (!childBounds) {
                return undefined;
            }

            bounds = bounds ? bounds.union(childBounds) : childBounds;
        }

        return bounds;
    }

    volume(): number | undefined {
        let volume = 0;
        const bounds: AABB[] = [];

        for (const extent of this.extents) {
            const childVolume = extent.volume();
            if (childVolume === undefined) {
                return undefined;
            }

            const childBounds = extent.bounds();
            if (!childBounds) {
                return undefined;
            }

            for (const previousBounds of bounds) {
                if (previousBounds.intersects(childBounds, false)) {
                    return undefined;
                }
            }

            bounds.push(childBounds);
            volume += childVolume;
        }

        return volume;
    }

    sample(random?: RandomSource): Vec3 | undefined {
        if (this.extents.length === 0) {
            return undefined;
        }

        const startIndex = Math.min(
            this.extents.length - 1,
            Math.floor(randomUnit(random) * this.extents.length),
        );

        for (let offset = 0; offset < this.extents.length; offset += 1) {
            const index = (startIndex + offset) % this.extents.length;
            const sample = this.extents[index].sample(random);
            if (sample) {
                return sample;
            }
        }

        return undefined;
    }

    *blocks(options?: ExtentBlockOptions): Iterable<Vec3Init> {
        const seen = new Set<string>();

        for (const extent of this.extents) {
            for (const block of extent.blocks(options)) {
                const key = getVoxelKey(block);
                if (seen.has(key)) {
                    continue;
                }

                seen.add(key);
                yield { x: block.x, y: block.y, z: block.z };
            }
        }
    }

    classifyAABB(box: AABB): ExtentAABBClassification {
        if (this.extents.length === 0) {
            return "outside";
        }

        let intersects = false;

        for (const extent of this.extents) {
            const classification = classifyExtentAABB(extent, box);
            if (classification === "inside") {
                return "inside";
            }

            if (classification === "intersects") {
                intersects = true;
            }
        }

        return intersects ? "intersects" : "outside";
    }

    clearanceAt(point: Vec3Like): number {
        let clearance = 0;

        for (const extent of this.extents) {
            if (!extent.containsPoint(point)) {
                continue;
            }

            clearance = Math.max(clearance, getExtentClearance(extent, point));
        }

        return clearance;
    }
}

/**
 * Extent that evaluates a child extent at an offset location.
 */
export class TranslatedExtent implements OptimizableExtent {
    private readonly extent: Extent;
    private readonly offset: Vec3;

    constructor(extent: Extent, offset: Vec3Like) {
        this.extent = extent;
        this.offset = new Vec3(offset);
    }

    containsPoint(point: Vec3Like): boolean {
        return this.extent.containsPoint(new Vec3(point).subtract(this.offset));
    }

    bounds(): AABB | undefined {
        return this.extent.bounds()?.translate(this.offset);
    }

    volume(): number | undefined {
        return this.extent.volume();
    }

    sample(random?: RandomSource): Vec3 | undefined {
        return this.extent.sample(random)?.add(this.offset);
    }

    *blocks(options?: ExtentBlockOptions): Iterable<Vec3Init> {
        const bounds = this.bounds();
        if (!bounds) {
            return;
        }

        for (const block of bounds.blocks(options)) {
            if (this.classifyAABB(blockAABB(block)) !== "outside") {
                yield block;
            }
        }
    }

    classifyAABB(box: AABB): ExtentAABBClassification {
        return classifyExtentAABB(
            this.extent,
            box.translate(this.offset.multiply(-1)),
        );
    }

    clearanceAt(point: Vec3Like): number {
        return getExtentClearance(
            this.extent,
            new Vec3(point).subtract(this.offset),
        );
    }
}

/**
 * Unbounded extent that contains all finite points.
 */
export class InfiniteExtent implements OptimizableExtent {
    containsPoint(point: Vec3Like): boolean {
        new Vec3(point);

        return true;
    }

    bounds(): undefined {
        return undefined;
    }

    volume(): undefined {
        return undefined;
    }

    sample(_random?: RandomSource): undefined {
        return undefined;
    }

    *blocks(_options?: ExtentBlockOptions): Iterable<Vec3Init> {}

    classifyAABB(): ExtentAABBClassification {
        return "inside";
    }

    clearanceAt(): number {
        return Number.POSITIVE_INFINITY;
    }
}

export function boxExtent(box: AABBInput): BoxExtent {
    return new BoxExtent(box);
}

export function blockExtent(block: Vec3Like): BlockExtent {
    return new BlockExtent(block);
}

export function cylinderExtent(options: CylinderExtentOptions): CylinderExtent {
    return new CylinderExtent(options);
}

export function sphereExtent(options: SphereExtentOptions): SphereExtent {
    return new SphereExtent(options);
}

export function polygonExtent(options: PolygonExtentOptions): PolygonExtent {
    return new PolygonExtent(options);
}

export function voxelExtent(voxels: Iterable<Vec3Like>): VoxelExtent {
    return new VoxelExtent(voxels);
}

export function unionExtent(extents: Iterable<Extent>): UnionExtent {
    return new UnionExtent(extents);
}

export function translatedExtent(
    extent: Extent,
    offset: Vec3Like,
): TranslatedExtent {
    return new TranslatedExtent(extent, offset);
}

export function infiniteExtent(): InfiniteExtent {
    return new InfiniteExtent();
}

function randomUnit(random?: RandomSource): number {
    return random?.() ?? Math.random();
}

function assertNonNegativeFinite(value: number, name: string): number {
    if (!Number.isFinite(value) || value < 0) {
        throw new TypeError(`${name} must be a non-negative finite number.`);
    }

    return value;
}

function assertFinite(value: number, name: string): number {
    if (!Number.isFinite(value)) {
        throw new TypeError(`${name} must be a finite number.`);
    }

    return value;
}

function getVec3Components(value: Vec3Like): Vec3Init {
    if (isVec3Tuple(value)) {
        const [x, y, z] = value;
        return { x, y, z };
    }

    return { x: value.x, y: value.y, z: value.z };
}

function isVec3Tuple(
    value: Vec3Like,
): value is readonly [number, number, number] {
    return Array.isArray(value);
}

type Vec2XZ = {
    readonly x: number;
    readonly z: number;
};

function toPolygonPoint(point: PolygonExtentPoint): Vec2XZ {
    let x: number;
    let z: number;
    if (Array.isArray(point)) {
        [x, z] = point;
    } else {
        const objectPoint = point as { readonly x: number; readonly z: number };
        x = objectPoint.x;
        z = objectPoint.z;
    }

    return {
        x: assertFinite(x, "PolygonExtent point x"),
        z: assertFinite(z, "PolygonExtent point z"),
    };
}

function polygonSignedArea(points: readonly Vec2XZ[]): number {
    let area = 0;

    for (let i = 0; i < points.length; i += 1) {
        const a = points[i];
        const b = points[(i + 1) % points.length];
        area += a.x * b.z - b.x * a.z;
    }

    return area / 2;
}

function getPolygonBounds(points: readonly Vec2XZ[]): {
    readonly minX: number;
    readonly minZ: number;
    readonly maxX: number;
    readonly maxZ: number;
} {
    let minX = points[0].x;
    let minZ = points[0].z;
    let maxX = points[0].x;
    let maxZ = points[0].z;

    for (let i = 1; i < points.length; i += 1) {
        const point = points[i];
        minX = Math.min(minX, point.x);
        minZ = Math.min(minZ, point.z);
        maxX = Math.max(maxX, point.x);
        maxZ = Math.max(maxZ, point.z);
    }

    return { minX, minZ, maxX, maxZ };
}

function containsPolygonPoint(
    points: readonly Vec2XZ[],
    x: number,
    z: number,
): boolean {
    let inside = false;

    for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
        const a = points[i];
        const b = points[j];

        if (pointOnSegment2D({ x, z }, a, b)) {
            return true;
        }

        const crosses =
            a.z > z !== b.z > z &&
            x < ((b.x - a.x) * (z - a.z)) / (b.z - a.z) + a.x;
        if (crosses) {
            inside = !inside;
        }
    }

    return inside;
}

function blockIntersectsPolygonColumn(
    block: Vec3Like,
    points: readonly Vec2XZ[],
    minY: number,
    maxY: number,
): boolean {
    const { x, y, z } = getVec3Components(block);
    if (y > maxY || y + 1 < minY) {
        return false;
    }

    const minX = x;
    const minZ = z;
    const maxX = x + 1;
    const maxZ = z + 1;
    const corners: Vec2XZ[] = [
        { x: minX, z: minZ },
        { x: maxX, z: minZ },
        { x: maxX, z: maxZ },
        { x: minX, z: maxZ },
    ];

    if (
        corners.some((corner) =>
            containsPolygonPoint(points, corner.x, corner.z),
        )
    ) {
        return true;
    }

    if (
        points.some(
            (point) =>
                point.x >= minX &&
                point.x <= maxX &&
                point.z >= minZ &&
                point.z <= maxZ,
        )
    ) {
        return true;
    }

    for (let i = 0; i < points.length; i += 1) {
        const a = points[i];
        const b = points[(i + 1) % points.length];
        for (let j = 0; j < corners.length; j += 1) {
            const c = corners[j];
            const d = corners[(j + 1) % corners.length];
            if (segmentsIntersect2D(a, b, c, d)) {
                return true;
            }
        }
    }

    return containsPolygonPoint(points, x + 0.5, z + 0.5);
}

function pointOnSegment2D(point: Vec2XZ, a: Vec2XZ, b: Vec2XZ): boolean {
    const cross = (point.z - a.z) * (b.x - a.x) - (point.x - a.x) * (b.z - a.z);
    if (Math.abs(cross) > 1e-9) {
        return false;
    }

    return (
        point.x >= Math.min(a.x, b.x) &&
        point.x <= Math.max(a.x, b.x) &&
        point.z >= Math.min(a.z, b.z) &&
        point.z <= Math.max(a.z, b.z)
    );
}

function segmentsIntersect2D(
    a: Vec2XZ,
    b: Vec2XZ,
    c: Vec2XZ,
    d: Vec2XZ,
): boolean {
    const o1 = orientation2D(a, b, c);
    const o2 = orientation2D(a, b, d);
    const o3 = orientation2D(c, d, a);
    const o4 = orientation2D(c, d, b);

    if (o1 !== o2 && o3 !== o4) {
        return true;
    }

    return (
        (o1 === 0 && pointOnSegment2D(c, a, b)) ||
        (o2 === 0 && pointOnSegment2D(d, a, b)) ||
        (o3 === 0 && pointOnSegment2D(a, c, d)) ||
        (o4 === 0 && pointOnSegment2D(b, c, d))
    );
}

function orientation2D(a: Vec2XZ, b: Vec2XZ, c: Vec2XZ): -1 | 0 | 1 {
    const value = (b.z - a.z) * (c.x - b.x) - (b.x - a.x) * (c.z - b.z);
    if (Math.abs(value) <= 1e-9) {
        return 0;
    }

    return value > 0 ? 1 : -1;
}

function getVoxelBounds(voxels: readonly Vec3[]): AABB | undefined {
    if (voxels.length === 0) {
        return undefined;
    }

    let minX = voxels[0].x;
    let minY = voxels[0].y;
    let minZ = voxels[0].z;
    let maxX = voxels[0].x + 1;
    let maxY = voxels[0].y + 1;
    let maxZ = voxels[0].z + 1;

    for (let i = 1; i < voxels.length; i += 1) {
        const voxel = voxels[i];
        minX = Math.min(minX, voxel.x);
        minY = Math.min(minY, voxel.y);
        minZ = Math.min(minZ, voxel.z);
        maxX = Math.max(maxX, voxel.x + 1);
        maxY = Math.max(maxY, voxel.y + 1);
        maxZ = Math.max(maxZ, voxel.z + 1);
    }

    return new AABB(minX, minY, minZ, maxX, maxY, maxZ);
}

function blockAABB(block: Vec3Like): AABB {
    const { x, y, z } = getVec3Components(block);

    return new AABB(x, y, z, x + 1, y + 1, z + 1);
}

function blockIntersectsVerticalCylinder(
    block: Vec3Like,
    center: Vec3,
    radiusSquared: number,
    minY: number,
    maxY: number,
): boolean {
    const { x, y, z } = getVec3Components(block);

    if (y > maxY || y + 1 < minY) {
        return false;
    }

    const closestX = clamp(center.x, x, x + 1);
    const closestZ = clamp(center.z, z, z + 1);
    const dx = closestX - center.x;
    const dz = closestZ - center.z;

    return dx * dx + dz * dz <= radiusSquared;
}

function blockIntersectsSphere(
    block: Vec3Like,
    center: Vec3,
    radiusSquared: number,
): boolean {
    const { x, y, z } = getVec3Components(block);
    const closestX = clamp(center.x, x, x + 1);
    const closestY = clamp(center.y, y, y + 1);
    const closestZ = clamp(center.z, z, z + 1);
    const dx = closestX - center.x;
    const dy = closestY - center.y;
    const dz = closestZ - center.z;

    return dx * dx + dy * dy + dz * dz <= radiusSquared;
}

function clearanceWithinCell(
    point: Vec3Like,
    x: number,
    y: number,
    z: number,
): number {
    const location = getVec3Components(point);

    return Math.max(
        0,
        Math.min(
            location.x - x,
            x + 1 - location.x,
            location.y - y,
            y + 1 - location.y,
            location.z - z,
            z + 1 - location.z,
        ),
    );
}

function clearanceWithinBounds(
    location: Vec3Init,
    min: Vec3Init,
    max: Vec3Init,
): number {
    return Math.max(
        0,
        Math.min(
            location.x - min.x,
            max.x - location.x,
            location.y - min.y,
            max.y - location.y,
            location.z - min.z,
            max.z - location.z,
        ),
    );
}

function classifyExtentAABB(
    extent: Extent,
    box: AABB,
): ExtentAABBClassification {
    if (isOptimizableExtent(extent)) {
        return extent.classifyAABB(box);
    }

    const bounds = extent.bounds();
    if (!bounds) {
        return "intersects";
    }

    return bounds.intersects(box, true) ? "intersects" : "outside";
}

function getExtentClearance(extent: Extent, point: Vec3Like): number {
    if (!isOptimizableExtent(extent)) {
        return 0;
    }

    return extent.clearanceAt(point) ?? 0;
}

function isOptimizableExtent(extent: Extent): extent is OptimizableExtent {
    return (
        typeof (extent as OptimizableExtent).classifyAABB === "function" &&
        typeof (extent as OptimizableExtent).clearanceAt === "function"
    );
}
