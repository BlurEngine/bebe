import type { Direction } from "@minecraft/server";
import { Vec3 } from "./vec3.js";

/**
 * Engine vocabulary for Bedrock's block-adjacent direction enum.
 *
 * In `bebe`, a facing means one of the six unit block offsets around an origin
 * block. This is intentionally narrower than arbitrary direction vectors.
 */
export type Facing = Direction;

/**
 * Runtime-safe values for Bedrock's string-valued {@link Direction} enum.
 *
 * Keeping the value locally avoids loading `@minecraft/server` when pure maths
 * is consumed by build tooling or tests. The exported type remains Bedrock's
 * own `Direction`, so script consumers keep the same API contract.
 */
export const Facing = Object.freeze({
    Down: "Down" as Direction.Down,
    East: "East" as Direction.East,
    North: "North" as Direction.North,
    South: "South" as Direction.South,
    Up: "Up" as Direction.Up,
    West: "West" as Direction.West,
}) satisfies Readonly<Record<keyof typeof Direction, Direction>>;

const FACING_ORDER: readonly Facing[] = [
    Facing.Down,
    Facing.East,
    Facing.North,
    Facing.South,
    Facing.Up,
    Facing.West,
];

const FACING_OFFSET_BY_DIRECTION: Readonly<Record<Facing, Vec3>> = {
    [Facing.Down]: Vec3.down(),
    [Facing.East]: Vec3.right(),
    [Facing.North]: Vec3.forward(),
    [Facing.South]: Vec3.back(),
    [Facing.Up]: Vec3.up(),
    [Facing.West]: Vec3.left(),
};

/**
 * Block-adjacent offsets in {@link Facing} order.
 *
 * Bedrock's `Direction` enum defines `North` as `z + 1` and `South` as
 * `z - 1`. This array follows that contract exactly.
 */
export const FACING_OFFSETS: readonly Vec3[] = FACING_ORDER.map(
    (facing) => FACING_OFFSET_BY_DIRECTION[facing],
);

/**
 * Horizontal block-adjacent offsets in `East`, `North`, `South`, `West`
 * order.
 */
export const HORIZONTAL_FACING_OFFSETS: readonly Vec3[] = [
    FACING_OFFSET_BY_DIRECTION[Facing.East],
    FACING_OFFSET_BY_DIRECTION[Facing.North],
    FACING_OFFSET_BY_DIRECTION[Facing.South],
    FACING_OFFSET_BY_DIRECTION[Facing.West],
];

/**
 * Vertical block-adjacent offsets in `Down`, `Up` order.
 */
export const VERTICAL_FACING_OFFSETS: readonly Vec3[] = [
    FACING_OFFSET_BY_DIRECTION[Facing.Down],
    FACING_OFFSET_BY_DIRECTION[Facing.Up],
];

/**
 * Options for {@link createSurroundingOffsets}.
 */
export type CreateSurroundingOffsetsOptions = {
    /**
     * Include the origin offset `{ x: 0, y: 0, z: 0 }` in the result.
     *
     * Default: `false`.
     */
    includeOrigin?: boolean;
    /**
     * Step distance applied to each surrounding offset.
     *
     * A size of `1` produces the normal surrounding block offsets. A size of
     * `2` produces the same surrounding pattern, but two blocks away.
     *
     * Default: `1`.
     */
    size?: number;
};

/**
 * All neighbouring block offsets around one origin block, excluding the
 * origin.
 */
export const SURROUNDING_OFFSETS: readonly Vec3[] = createSurroundingOffsets();

/**
 * Creates the surrounding offset pattern around one origin block.
 *
 * The default result matches {@link SURROUNDING_OFFSETS}. Use `size` to scale
 * the step distance, and `includeOrigin` when the centre offset should be
 * included too.
 */
export function createSurroundingOffsets(
    options: CreateSurroundingOffsetsOptions = {},
): Vec3[] {
    const includeOrigin = options.includeOrigin ?? false;
    const size = options.size ?? 1;

    if (!Number.isInteger(size) || size < 1) {
        throw new RangeError(
            "createSurroundingOffsets requires size to be a positive integer.",
        );
    }

    const offsets: Vec3[] = [];

    for (let x = -1; x <= 1; x += 1) {
        for (let y = -1; y <= 1; y += 1) {
            for (let z = -1; z <= 1; z += 1) {
                if (!includeOrigin && x === 0 && y === 0 && z === 0) {
                    continue;
                }

                offsets.push(new Vec3(x * size, y * size, z * size));
            }
        }
    }

    return offsets;
}
