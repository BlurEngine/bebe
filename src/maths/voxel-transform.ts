import { Vec3, type Vec3Init, type Vec3Like } from "./vec3.js";

/** Clockwise horizontal quarter turns from local north when viewed from above. */
export type HorizontalQuarterTurn = 0 | 1 | 2 | 3;

/**
 * Rotate one integer local voxel offset clockwise around Y.
 *
 * This variant has no Bedrock runtime dependency and is safe for build tools.
 */
export function rotateVoxelOffsetByQuarterTurns(
    offset: Vec3Like,
    quarterTurns: HorizontalQuarterTurn,
): Vec3 {
    const point = expectIntegerVoxelOffset(
        offset,
        "rotateVoxelOffsetByQuarterTurns",
    );
    expectQuarterTurn(quarterTurns);
    switch (quarterTurns) {
        case 0:
            return point;
        case 1:
            return new Vec3(point.z, point.y, -point.x);
        case 2:
            return new Vec3(-point.x, point.y, -point.z);
        case 3:
            return new Vec3(-point.z, point.y, point.x);
    }
}

/** Reverse {@link rotateVoxelOffsetByQuarterTurns} for the same turn count. */
export function inverseRotateVoxelOffsetByQuarterTurns(
    offset: Vec3Like,
    quarterTurns: HorizontalQuarterTurn,
): Vec3 {
    const point = expectIntegerVoxelOffset(
        offset,
        "inverseRotateVoxelOffsetByQuarterTurns",
    );
    expectQuarterTurn(quarterTurns);
    return rotateVoxelOffsetByQuarterTurns(
        point,
        ((4 - quarterTurns) % 4) as HorizontalQuarterTurn,
    );
}

function expectQuarterTurn(
    input: number,
): asserts input is HorizontalQuarterTurn {
    if (!Number.isInteger(input) || input < 0 || input > 3) {
        throw new RangeError("quarterTurns must be 0, 1, 2, or 3.");
    }
}

function expectIntegerVoxelOffset(offset: Vec3Like, caller: string): Vec3 {
    const point = Array.isArray(offset)
        ? { x: offset[0], y: offset[1], z: offset[2] }
        : (offset as Vec3Init);
    if (
        !Number.isInteger(point.x) ||
        !Number.isInteger(point.y) ||
        !Number.isInteger(point.z)
    ) {
        throw new RangeError(`${caller} requires integer voxel coordinates.`);
    }
    return new Vec3(point);
}
