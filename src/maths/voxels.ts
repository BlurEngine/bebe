import { FACING_OFFSETS, SURROUNDING_OFFSETS } from "./facing.js";
import { Vec3, type Vec3Init, type Vec3Like, type Vec3Tuple } from "./vec3.js";

/**
 * Canonical string key for one voxel location.
 */
export type VoxelKey = string;

/**
 * Seed location for a voxel flood fill.
 *
 * Seeds are always included in the result. Filter them before calling
 * {@link floodFillVoxels} when inclusion should be conditional.
 */
export type VoxelFloodFillSeed = {
    /**
     * Starting depth recorded for this seed. Default: `0`.
     */
    depth?: number;
    /**
     * Seed location to include in the traversal result.
     */
    location: Vec3Like;
};

/**
 * Describes one voxel reached during a flood fill.
 */
export type VoxelFloodFillNode = {
    /**
     * Zero-based or seed-provided depth for this voxel.
     */
    depth: number;
    /**
     * Stable string key for this voxel location.
     */
    key: VoxelKey;
    /**
     * Location reached by the traversal.
     */
    location: Vec3;
};

/**
 * Supplies neighbour offsets for the current voxel.
 */
export type VoxelFloodFillNeighbours =
    | readonly Vec3Like[]
    | ((node: VoxelFloodFillNode) => readonly Vec3Like[]);

/**
 * Controls how {@link floodFillVoxels} expands from its seeds.
 */
export type VoxelFloodFillOptions = {
    /**
     * Maximum number of included voxels. When the traversal hits this limit,
     * it stops and marks the result as truncated.
     */
    maxCount?: number;
    /**
     * Neighbour offsets used to expand from each visited voxel.
     */
    neighbours: VoxelFloodFillNeighbours;
    /**
     * Seed voxels to include before traversal begins.
     */
    seeds: readonly VoxelFloodFillSeed[];
    /**
     * Optional predicate controlling whether a candidate neighbour should be
     * entered.
     */
    shouldEnter?: (node: VoxelFloodFillNode) => boolean;
};

/**
 * Result returned by {@link floodFillVoxels}.
 */
export type VoxelFloodFillResult = {
    /**
     * Visited voxel locations keyed to their recorded traversal depth.
     */
    voxels: ReadonlyVoxelMap<number>;
    /**
     * True when traversal stopped because `maxCount` was reached.
     */
    truncated: boolean;
};

/**
 * Controls how {@link floodFillVoxelSet} expands from its seeds while staying
 * inside a known voxel membership set.
 */
export type VoxelSetFloodFillOptions = {
    /**
     * Maximum number of included voxels. When the traversal hits this limit,
     * it stops and marks the result as truncated.
     */
    maxCount?: number;
    /**
     * Neighbour offsets used to expand from each visited voxel.
     */
    neighbours: VoxelFloodFillNeighbours;
    /**
     * Seed voxels to include before traversal begins.
     *
     * Seeds outside {@link within} are ignored.
     */
    seeds: readonly VoxelFloodFillSeed[];
    /**
     * Membership set that constrains the traversal.
     */
    within: Iterable<Vec3Like>;
    /**
     * Optional predicate controlling whether a candidate neighbour inside the
     * set should be entered.
     */
    shouldEnter?: (node: VoxelFloodFillNode) => boolean;
};

/**
 * Structural location shape exposed by voxel collections.
 *
 * This stays value-based across package subpaths, avoiding `Vec3` nominal
 * identity leaks in generated declaration surfaces.
 */
export type VoxelLocation = Readonly<Vec3Init>;

/**
 * One location-value pair yielded by a {@link VoxelMap}.
 */
export type VoxelMapEntry<T> = readonly [VoxelLocation, T];

/**
 * Read-only public surface for value-based voxel sets.
 */
export type ReadonlyVoxelSet = Iterable<VoxelLocation> & {
    readonly size: number;
    toArray(): readonly VoxelLocation[];
    has(location: Vec3Like): boolean;
    union(other: Iterable<Vec3Like>): ReadonlyVoxelSet;
    difference(other: Iterable<Vec3Like>): ReadonlyVoxelSet;
    hasAdjacent(location: Vec3Like, offsets?: Iterable<Vec3Like>): boolean;
    map<TResult>(
        callback: (location: VoxelLocation, index: number) => TResult,
    ): TResult[];
    filter(
        callback: (location: VoxelLocation, index: number) => boolean,
    ): ReadonlyVoxelSet;
    find(
        callback: (location: VoxelLocation, index: number) => boolean,
    ): VoxelLocation | undefined;
    some(
        callback: (location: VoxelLocation, index: number) => boolean,
    ): boolean;
    every(
        callback: (location: VoxelLocation, index: number) => boolean,
    ): boolean;
    slice(start?: number, end?: number): ReadonlyVoxelSet;
    sort(
        compareFn?: (left: VoxelLocation, right: VoxelLocation) => number,
    ): ReadonlyVoxelSet;
    toKeys(): readonly VoxelKey[];
    values(): IterableIterator<VoxelLocation>;
};

/**
 * Read-only public surface for value-based voxel maps.
 */
export type ReadonlyVoxelMap<T> = Iterable<VoxelMapEntry<T>> & {
    readonly size: number;
    toArray(): readonly VoxelMapEntry<T>[];
    has(location: Vec3Like): boolean;
    get(location: Vec3Like): T | undefined;
    keySet(): ReadonlyVoxelSet;
    keys(): IterableIterator<VoxelLocation>;
    values(): IterableIterator<T>;
    entries(): IterableIterator<VoxelMapEntry<T>>;
    map<TResult>(
        callback: (entry: VoxelMapEntry<T>, index: number) => TResult,
    ): TResult[];
    filter(
        callback: (entry: VoxelMapEntry<T>, index: number) => boolean,
    ): ReadonlyVoxelMap<T>;
    find(
        callback: (entry: VoxelMapEntry<T>, index: number) => boolean,
    ): VoxelMapEntry<T> | undefined;
    some(
        callback: (entry: VoxelMapEntry<T>, index: number) => boolean,
    ): boolean;
    every(
        callback: (entry: VoxelMapEntry<T>, index: number) => boolean,
    ): boolean;
    slice(start?: number, end?: number): ReadonlyVoxelMap<T>;
    sort(
        compareFn?: (left: VoxelMapEntry<T>, right: VoxelMapEntry<T>) => number,
    ): ReadonlyVoxelMap<T>;
};

/**
 * Compatibility alias for {@link FACING_OFFSETS}.
 *
 * Prefer `FACING_OFFSETS` in new code.
 */
export const FACE_VOXEL_OFFSETS: readonly Vec3[] = FACING_OFFSETS;

/**
 * Compatibility alias for {@link SURROUNDING_OFFSETS}.
 *
 * Prefer `SURROUNDING_OFFSETS` in new code.
 */
export const SURROUNDING_VOXEL_OFFSETS: readonly Vec3[] = SURROUNDING_OFFSETS;

/**
 * Returns the `3x3` voxel face one block away in the provided face direction.
 *
 * The direction must be one of {@link FACING_OFFSETS}. For example:
 *
 * - `{ x: 0, y: 1, z: 0 }` returns the nine offsets in the layer above
 * - `{ x: 0, y: 0, z: 1 }` returns the nine offsets in the layer to the south
 *
 * Throws when the direction is not face-adjacent.
 */
export function createFacingVoxelOffsets(direction: Vec3Like): Vec3[] {
    const {
        x: directionX,
        y: directionY,
        z: directionZ,
    } = getVec3Components(direction);

    if (!isFaceVoxelOffset(direction)) {
        throw new Error(
            "createFacingVoxelOffsets requires one face-adjacent voxel offset.",
        );
    }

    const offsets: Vec3[] = [];

    for (let x = -1; x <= 1; x += 1) {
        for (let y = -1; y <= 1; y += 1) {
            for (let z = -1; z <= 1; z += 1) {
                if (directionX !== 0 && x !== directionX) {
                    continue;
                }

                if (directionY !== 0 && y !== directionY) {
                    continue;
                }

                if (directionZ !== 0 && z !== directionZ) {
                    continue;
                }

                offsets.push(new Vec3(x, y, z));
            }
        }
    }

    return offsets;
}

/**
 * Returns a stable key for a voxel location.
 */
export function getVoxelKey(location: Vec3Like): VoxelKey {
    const { x, y, z } = getVec3Components(location);

    return `${x},${y},${z}`;
}

/**
 * Parses a voxel key produced by {@link getVoxelKey}.
 *
 * Returns `undefined` when the key does not contain three finite coordinates.
 */
export function parseVoxelKey(key: VoxelKey): Vec3 | undefined {
    const parts = key.split(",");
    if (parts.length !== 3) {
        return undefined;
    }

    const [x, y, z] = parts.map(Number);
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
        return undefined;
    }

    return new Vec3(x, y, z);
}

/**
 * Value-based set for voxel locations.
 *
 * Internally this uses {@link VoxelKey} identity so callers can work with
 * `Vec3Like` inputs without needing to manage string keys directly.
 */
export class VoxelSet implements ReadonlyVoxelSet, Iterable<Vec3> {
    private readonly locationsByKey = new Map<VoxelKey, Vec3>();

    static from(locations: Iterable<Vec3Like>): VoxelSet {
        return new VoxelSet(locations);
    }

    static fromKeys(keys: Iterable<VoxelKey>): VoxelSet {
        const locations: Vec3[] = [];

        for (const key of keys) {
            const location = parseVoxelKey(key);
            if (!location) {
                throw new TypeError(
                    `VoxelSet.fromKeys requires valid voxel keys. Received: ${JSON.stringify(
                        key,
                    )}`,
                );
            }

            locations.push(location);
        }

        return new VoxelSet(locations);
    }

    constructor(locations?: Iterable<Vec3Like>) {
        for (const location of locations ?? []) {
            this.add(location);
        }
    }

    get size(): number {
        return this.locationsByKey.size;
    }

    toArray(): readonly Vec3[] {
        return Object.freeze([...this.locationsByKey.values()]);
    }

    has(location: Vec3Like): boolean {
        return this.locationsByKey.has(getVoxelKey(location));
    }

    add(location: Vec3Like): this {
        const voxel = new Vec3(location);
        const key = getVoxelKey(voxel);

        if (!this.locationsByKey.has(key)) {
            this.locationsByKey.set(key, voxel);
        }

        return this;
    }

    delete(location: Vec3Like): boolean {
        return this.locationsByKey.delete(getVoxelKey(location));
    }

    clear(): void {
        this.locationsByKey.clear();
    }

    clone(): VoxelSet {
        return new VoxelSet(this.locationsByKey.values());
    }

    union(other: Iterable<Vec3Like>): VoxelSet {
        const combined = this.clone();

        for (const location of other) {
            combined.add(location);
        }

        return combined;
    }

    difference(other: Iterable<Vec3Like>): VoxelSet {
        const remaining = this.clone();

        for (const location of other) {
            remaining.delete(location);
        }

        return remaining;
    }

    hasAdjacent(
        location: Vec3Like,
        offsets: Iterable<Vec3Like> = FACING_OFFSETS,
    ): boolean {
        const voxel = new Vec3(location);

        for (const offset of offsets) {
            if (this.has(voxel.add(offset))) {
                return true;
            }
        }

        return false;
    }

    values(): IterableIterator<Vec3> {
        return this.locationsByKey.values();
    }

    map<TResult>(
        callback: (location: VoxelLocation, index: number) => TResult,
    ): TResult[] {
        return [...this].map(callback);
    }

    filter(
        callback: (location: VoxelLocation, index: number) => boolean,
    ): VoxelSet {
        return new VoxelSet([...this].filter(callback));
    }

    find(
        callback: (location: VoxelLocation, index: number) => boolean,
    ): Vec3 | undefined {
        return [...this].find(callback);
    }

    some(
        callback: (location: VoxelLocation, index: number) => boolean,
    ): boolean {
        return [...this].some(callback);
    }

    every(
        callback: (location: VoxelLocation, index: number) => boolean,
    ): boolean {
        return [...this].every(callback);
    }

    slice(start?: number, end?: number): VoxelSet {
        return new VoxelSet([...this].slice(start, end));
    }

    sort(
        compareFn: (
            left: VoxelLocation,
            right: VoxelLocation,
        ) => number = compareVoxelLocations,
    ): VoxelSet {
        return new VoxelSet([...this].sort(compareFn));
    }

    [Symbol.iterator](): IterableIterator<Vec3> {
        return this.values();
    }

    toKeys(): readonly VoxelKey[] {
        return Object.freeze([...this.locationsByKey.keys()]);
    }
}

/**
 * Value-based map keyed by voxel location.
 *
 * Internally this uses {@link VoxelKey} identity so callers can associate
 * values with `Vec3Like` locations without managing string keys directly.
 */
export class VoxelMap<T>
    implements ReadonlyVoxelMap<T>, Iterable<readonly [Vec3, T]>
{
    private readonly entriesByKey = new Map<
        VoxelKey,
        {
            location: Vec3;
            value: T;
        }
    >();

    static from<T>(entries: Iterable<readonly [Vec3Like, T]>): VoxelMap<T> {
        return new VoxelMap(entries);
    }

    static fromKeys<T>(entries: Iterable<readonly [VoxelKey, T]>): VoxelMap<T> {
        const locationsWithValues: Array<readonly [Vec3, T]> = [];

        for (const [key, value] of entries) {
            const location = parseVoxelKey(key);
            if (!location) {
                throw new TypeError(
                    `VoxelMap.fromKeys requires valid voxel keys. Received: ${JSON.stringify(
                        key,
                    )}`,
                );
            }

            locationsWithValues.push([location, value]);
        }

        return new VoxelMap(locationsWithValues);
    }

    constructor(entries?: Iterable<readonly [Vec3Like, T]>) {
        for (const [location, value] of entries ?? []) {
            this.set(location, value);
        }
    }

    get size(): number {
        return this.entriesByKey.size;
    }

    toArray(): readonly VoxelMapEntry<T>[] {
        return Object.freeze([...this.entries()]);
    }

    has(location: Vec3Like): boolean {
        return this.entriesByKey.has(getVoxelKey(location));
    }

    get(location: Vec3Like): T | undefined {
        return this.entriesByKey.get(getVoxelKey(location))?.value;
    }

    set(location: Vec3Like, value: T): this {
        const voxel = new Vec3(location);
        const key = getVoxelKey(voxel);

        this.entriesByKey.set(key, {
            location: voxel,
            value,
        });

        return this;
    }

    delete(location: Vec3Like): boolean {
        return this.entriesByKey.delete(getVoxelKey(location));
    }

    clear(): void {
        this.entriesByKey.clear();
    }

    clone(): VoxelMap<T> {
        return new VoxelMap(this.entries());
    }

    keySet(): VoxelSet {
        return VoxelSet.from(this.keys());
    }

    map<TResult>(
        callback: (entry: VoxelMapEntry<T>, index: number) => TResult,
    ): TResult[] {
        return [...this].map(callback);
    }

    filter(
        callback: (entry: VoxelMapEntry<T>, index: number) => boolean,
    ): VoxelMap<T> {
        return new VoxelMap([...this].filter(callback));
    }

    find(
        callback: (entry: VoxelMapEntry<T>, index: number) => boolean,
    ): VoxelMapEntry<T> | undefined {
        return [...this].find(callback);
    }

    some(
        callback: (entry: VoxelMapEntry<T>, index: number) => boolean,
    ): boolean {
        return [...this].some(callback);
    }

    every(
        callback: (entry: VoxelMapEntry<T>, index: number) => boolean,
    ): boolean {
        return [...this].every(callback);
    }

    slice(start?: number, end?: number): VoxelMap<T> {
        return new VoxelMap([...this].slice(start, end));
    }

    sort(
        compareFn: (
            left: VoxelMapEntry<T>,
            right: VoxelMapEntry<T>,
        ) => number = compareVoxelMapEntries,
    ): VoxelMap<T> {
        return new VoxelMap([...this].sort(compareFn));
    }

    *keys(): IterableIterator<Vec3> {
        for (const entry of this.entriesByKey.values()) {
            yield entry.location;
        }
    }

    *values(): IterableIterator<T> {
        for (const entry of this.entriesByKey.values()) {
            yield entry.value;
        }
    }

    *entries(): IterableIterator<readonly [Vec3, T]> {
        for (const entry of this.entriesByKey.values()) {
            yield [entry.location, entry.value] as const;
        }
    }

    [Symbol.iterator](): IterableIterator<readonly [Vec3, T]> {
        return this.entries();
    }
}

/**
 * Performs a breadth-first voxel flood fill from one or more seeds.
 */
export function floodFillVoxels(
    options: VoxelFloodFillOptions,
): VoxelFloodFillResult {
    const maxCount = Math.max(1, options.maxCount ?? Number.MAX_SAFE_INTEGER);
    const voxels = new VoxelMap<number>();
    const queue: VoxelFloodFillNode[] = [];

    for (const seed of options.seeds) {
        const depth = seed.depth ?? 0;
        const location = new Vec3(seed.location);
        const key = getVoxelKey(location);
        if (voxels.has(location)) {
            continue;
        }

        voxels.set(location, depth);
        queue.push({
            depth,
            key,
            location,
        });

        if (voxels.size >= maxCount) {
            return { voxels, truncated: true };
        }
    }

    for (let queueIndex = 0; queueIndex < queue.length; queueIndex += 1) {
        const current = queue[queueIndex];
        const neighbours =
            typeof options.neighbours === "function"
                ? options.neighbours(current)
                : options.neighbours;

        for (const offset of neighbours) {
            const location = current.location.add(offset);
            const key = getVoxelKey(location);
            if (voxels.has(location)) {
                continue;
            }

            const node: VoxelFloodFillNode = {
                depth: current.depth + 1,
                key,
                location,
            };
            if (options.shouldEnter && !options.shouldEnter(node)) {
                continue;
            }

            voxels.set(location, node.depth);
            queue.push(node);

            if (voxels.size >= maxCount) {
                return { voxels, truncated: true };
            }
        }
    }

    return { voxels, truncated: false };
}

/**
 * Performs a breadth-first voxel flood fill constrained to a known membership
 * set.
 *
 * This is useful when gameplay code already owns a `VoxelSet` or other stable
 * voxel collection and only wants the connected component inside that set.
 *
 * Seeds outside `within` are ignored.
 */
export function floodFillVoxelSet(
    options: VoxelSetFloodFillOptions,
): VoxelFloodFillResult {
    const within = toReadonlyVoxelSet(options.within);

    return floodFillVoxels({
        maxCount: options.maxCount,
        neighbours: options.neighbours,
        seeds: options.seeds.filter((seed) => within.has(seed.location)),
        shouldEnter(node) {
            if (!within.has(node.location)) {
                return false;
            }

            return options.shouldEnter ? options.shouldEnter(node) : true;
        },
    });
}

function compareVoxelLocations(
    left: VoxelLocation,
    right: VoxelLocation,
): number {
    return getVoxelKey(left).localeCompare(getVoxelKey(right));
}

function compareVoxelMapEntries<T>(
    left: VoxelMapEntry<T>,
    right: VoxelMapEntry<T>,
): number {
    return compareVoxelLocations(left[0], right[0]);
}

function isFaceVoxelOffset(offset: Vec3Like): boolean {
    const { x, y, z } = getVec3Components(offset);
    const axisMagnitude = Math.abs(x) + Math.abs(y) + Math.abs(z);

    return axisMagnitude === 1;
}

function toReadonlyVoxelSet(locations: Iterable<Vec3Like>): ReadonlyVoxelSet {
    return isReadonlyVoxelSet(locations) ? locations : new VoxelSet(locations);
}

function isReadonlyVoxelSet(
    value: Iterable<Vec3Like>,
): value is ReadonlyVoxelSet {
    return typeof (value as ReadonlyVoxelSet).has === "function";
}

function getVec3Components(value: Vec3Like): Vec3Init {
    if (Array.isArray(value)) {
        const [x, y, z] = value as Vec3Tuple;
        return { x, y, z };
    }

    return value as Vec3Init;
}
