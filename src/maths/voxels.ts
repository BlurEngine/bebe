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
     * Depth recorded for each visited voxel key.
     */
    depths: Map<VoxelKey, number>;
    /**
     * Visited voxel locations keyed by {@link VoxelKey}.
     */
    locations: Map<VoxelKey, Vec3>;
    /**
     * True when traversal stopped because `maxCount` was reached.
     */
    truncated: boolean;
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
 * Performs a breadth-first voxel flood fill from one or more seeds.
 */
export function floodFillVoxels(
    options: VoxelFloodFillOptions,
): VoxelFloodFillResult {
    const maxCount = Math.max(1, options.maxCount ?? Number.MAX_SAFE_INTEGER);
    const locations = new Map<VoxelKey, Vec3>();
    const depths = new Map<VoxelKey, number>();
    const queue: VoxelFloodFillNode[] = [];

    for (const seed of options.seeds) {
        const depth = seed.depth ?? 0;
        const location = new Vec3(seed.location);
        const key = getVoxelKey(location);
        if (locations.has(key)) {
            continue;
        }

        locations.set(key, location);
        depths.set(key, depth);
        queue.push({
            depth,
            key,
            location,
        });

        if (locations.size >= maxCount) {
            return { depths, locations, truncated: true };
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
            if (locations.has(key)) {
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

            locations.set(key, location);
            depths.set(key, node.depth);
            queue.push(node);

            if (locations.size >= maxCount) {
                return { depths, locations, truncated: true };
            }
        }
    }

    return { depths, locations, truncated: false };
}

function isFaceVoxelOffset(offset: Vec3Like): boolean {
    const { x, y, z } = getVec3Components(offset);
    const axisMagnitude = Math.abs(x) + Math.abs(y) + Math.abs(z);

    return axisMagnitude === 1;
}

function getVec3Components(value: Vec3Like): Vec3Init {
    if (Array.isArray(value)) {
        const [x, y, z] = value as Vec3Tuple;
        return { x, y, z };
    }

    return value as Vec3Init;
}
