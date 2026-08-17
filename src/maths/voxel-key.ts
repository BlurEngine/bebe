import { Vec3, type Vec3Like } from "./vec3.js";

/** Canonical string key for one voxel location. */
export type VoxelKey = string;

/** Returns a stable key for a voxel location. */
export function getVoxelKey(location: Vec3Like): VoxelKey {
    const components = Array.isArray(location)
        ? { x: location[0], y: location[1], z: location[2] }
        : (location as {
              readonly x: number;
              readonly y: number;
              readonly z: number;
          });
    return `${components.x},${components.y},${components.z}`;
}

/**
 * Parses a voxel key produced by {@link getVoxelKey}.
 *
 * Returns `undefined` when the key does not contain three finite coordinates.
 */
export function parseVoxelKey(key: VoxelKey): Vec3 | undefined {
    const parts = key.split(",");
    if (parts.length !== 3) return undefined;
    const [x, y, z] = parts.map(Number);
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
        return undefined;
    }
    return new Vec3(x, y, z);
}
