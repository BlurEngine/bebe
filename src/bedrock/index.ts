import {
    EntityComponentTypes,
    ItemComponentTypes,
    type Block,
    type BlockType,
    type ContainerSlot,
    type Dimension,
    type Entity,
    type ItemStack,
    type Player,
    type Vector3,
} from "@minecraft/server";
import { FACING_OFFSETS } from "../maths/facing.js";
import { Vec3, type Vec3Like } from "../maths/vec3.js";
import {
    floodFillVoxels,
    type VoxelLocation,
    type VoxelFloodFillNeighbours,
    type VoxelFloodFillNode,
    type VoxelFloodFillResult,
    type VoxelFloodFillSeed,
} from "../maths/voxels.js";

const AIR_BLOCK_TYPE_ID = "minecraft:air";

/**
 * Controls how {@link destroyBlockAt} performs its replacement write.
 */
export type DestroyBlockAtOptions = {
    /**
     * Replacement block used for the destroy command and direct fallback.
     * Default: `minecraft:air`.
     */
    replacementBlockTypeId?: string;
};

/**
 * Runs a Bedrock API operation and returns `undefined` if it throws.
 *
 * Use this as the low-level escape hatch when Bedrock does not provide a safer
 * way to probe a capability first.
 */
export function attemptBedrock<T>(read: () => T): T | undefined {
    try {
        return read();
    } catch {
        return undefined;
    }
}

/**
 * Reads a block from a dimension, returning `undefined` when the location is
 * out of bounds, unloaded, or otherwise unavailable.
 */
export function getBlockAt(
    dimension: Dimension,
    location: Vector3,
): Block | undefined {
    return attemptBedrock(() => dimension.getBlock(location));
}

/**
 * Reads a block type id without leaking Bedrock property throws into caller
 * code.
 */
export function getBlockTypeId(block: Block): string | undefined {
    return attemptBedrock(() => block.typeId);
}

/**
 * Reads whether a block is air, returning `undefined` if the block reference is
 * no longer readable.
 */
export function isAirBlock(block: Block): boolean | undefined {
    return attemptBedrock(() => block.isAir);
}

/**
 * Reads whether a block is liquid, returning `undefined` if the block reference
 * is no longer readable.
 */
export function isLiquidBlock(block: Block): boolean | undefined {
    return attemptBedrock(() => block.isLiquid);
}

/**
 * Describes one block reached during a flood fill where the candidate block is
 * known to be readable.
 */
export type BlockFloodFillNode = VoxelFloodFillNode & {
    /**
     * Readable block at the candidate location.
     */
    block: Block;
};

/**
 * Controls how {@link floodFillBlocks} expands from its seeds.
 */
export type BlockFloodFillOptions = {
    /**
     * Dimension used for block reads during traversal.
     */
    dimension: Dimension;
    /**
     * Maximum number of included blocks. When the traversal hits this limit, it
     * stops and marks the result as truncated.
     */
    maxCount?: number;
    /**
     * Neighbour offsets used to expand from each visited block.
     */
    neighbours: VoxelFloodFillNeighbours;
    /**
     * Seed locations to include before traversal begins.
     */
    seeds: readonly VoxelFloodFillSeed[];
    /**
     * Optional predicate controlling whether one readable candidate block
     * should be entered.
     *
     * Unreadable, unloaded, or out-of-bounds locations are skipped before this
     * predicate runs.
     */
    shouldEnter?: (node: BlockFloodFillNode) => boolean;
};

/**
 * One readable adjacent block relative to an origin location.
 */
export type AdjacentBlockNode = {
    /**
     * Readable adjacent block.
     */
    block: Block;
    /**
     * Adjacent world location.
     */
    location: VoxelLocation;
    /**
     * Offset from the origin location to this adjacent block.
     */
    offset: VoxelLocation;
};

/**
 * Optional query controls for adjacent block helpers.
 */
export type AdjacentBlockQuery = {
    /**
     * Offsets to inspect around the origin.
     *
     * Default: {@link FACING_OFFSETS}.
     */
    offsets?: Iterable<Vec3Like>;
    /**
     * Optional predicate used to keep only matching readable blocks.
     */
    filter?: (node: AdjacentBlockNode) => boolean;
};

/**
 * Performs a voxel flood fill while resolving each candidate location to a
 * Bedrock block first.
 *
 * Seeds are always included in the result, matching {@link floodFillVoxels}.
 * Neighbour candidates are only entered when the block at that location is
 * readable and the optional predicate accepts it.
 *
 * Returns the same {@link VoxelFloodFillResult} shape as
 * {@link floodFillVoxels}. The Bedrock-specific part stays in the inputs and
 * callback context rather than introducing a second result vocabulary.
 */
export function floodFillBlocks(
    options: BlockFloodFillOptions,
): VoxelFloodFillResult {
    return floodFillVoxels({
        maxCount: options.maxCount,
        neighbours: options.neighbours,
        seeds: options.seeds,
        shouldEnter(node) {
            const block = getBlockAt(options.dimension, node.location);
            if (!block) {
                return false;
            }

            return options.shouldEnter
                ? options.shouldEnter({
                      ...node,
                      block,
                  })
                : true;
        },
    });
}

/**
 * Collects readable adjacent blocks around one origin location.
 *
 * Unreadable, unloaded, or out-of-bounds adjacent locations are skipped before
 * the optional filter runs.
 */
export function collectAdjacentBlocks(
    dimension: Dimension,
    origin: Vec3Like,
    query?: AdjacentBlockQuery,
): readonly AdjacentBlockNode[] {
    const matches: AdjacentBlockNode[] = [];

    for (const node of getAdjacentBlocks(dimension, origin, query?.offsets)) {
        if (query?.filter && !query.filter(node)) {
            continue;
        }

        matches.push(node);
    }

    return Object.freeze(matches);
}

/**
 * Finds the first readable adjacent block that matches the optional filter.
 *
 * Unreadable, unloaded, or out-of-bounds adjacent locations are skipped before
 * the optional filter runs.
 */
export function findAdjacentBlock(
    dimension: Dimension,
    origin: Vec3Like,
    query?: AdjacentBlockQuery,
): AdjacentBlockNode | undefined {
    for (const node of getAdjacentBlocks(dimension, origin, query?.offsets)) {
        if (query?.filter && !query.filter(node)) {
            continue;
        }

        return node;
    }

    return undefined;
}

/**
 * Returns true when any readable adjacent block matches the optional filter.
 *
 * Unreadable, unloaded, or out-of-bounds adjacent locations are skipped before
 * the optional filter runs.
 */
export function someAdjacentBlock(
    dimension: Dimension,
    origin: Vec3Like,
    query?: AdjacentBlockQuery,
): boolean {
    for (const node of getAdjacentBlocks(dimension, origin, query?.offsets)) {
        if (query?.filter && !query.filter(node)) {
            continue;
        }

        return true;
    }

    return false;
}

function* getAdjacentBlocks(
    dimension: Dimension,
    origin: Vec3Like,
    offsets: Iterable<Vec3Like> = FACING_OFFSETS,
): IterableIterator<AdjacentBlockNode> {
    const originPoint = new Vec3(origin);

    for (const rawOffset of offsets) {
        const offset = new Vec3(rawOffset);
        const location = originPoint.add(offset);
        const block = getBlockAt(dimension, location);
        if (!block) {
            continue;
        }

        yield {
            block,
            location,
            offset,
        };
    }
}

/**
 * Sets the block at a location to the provided type.
 *
 * Returns true when the write succeeds.
 */
export function setBlockTypeAt(
    dimension: Dimension,
    location: Vector3,
    blockType: BlockType | string,
): boolean {
    const block = getBlockAt(dimension, location);
    if (!block) {
        return false;
    }

    return (
        attemptBedrock(() => {
            block.setType(blockType);
            return true;
        }) ?? false
    );
}

/**
 * Breaks a block using `setblock ... destroy` and falls back to replacing it
 * with air when commands fail.
 *
 * Returns true when either path succeeds.
 */
export function destroyBlockAt(
    dimension: Dimension,
    location: Vector3,
    options?: DestroyBlockAtOptions,
): boolean {
    const replacementBlockTypeId =
        options?.replacementBlockTypeId ?? AIR_BLOCK_TYPE_ID;
    const destroyedByCommand =
        attemptBedrock(() => {
            dimension.runCommand(
                `setblock ${location.x} ${location.y} ${location.z} ${replacementBlockTypeId} destroy`,
            );
            return true;
        }) ?? false;
    if (destroyedByCommand) {
        return true;
    }

    return setBlockTypeAt(dimension, location, replacementBlockTypeId);
}

/**
 * Returns the selected inventory slot for a player when that slot is readable.
 */
export function getSelectedSlot(player: Player): ContainerSlot | undefined {
    const inventory = attemptBedrock(() =>
        player.getComponent(EntityComponentTypes.Inventory),
    );
    const container = inventory?.container;
    if (!container) {
        return undefined;
    }

    const slot = attemptBedrock(() =>
        container.getSlot(player.selectedSlotIndex),
    );
    if (!slot || !slot.isValid) {
        return undefined;
    }

    return slot;
}

/**
 * Returns a copied item from a slot, or `undefined` when the slot is invalid or
 * empty.
 */
export function getSlotItem(slot: ContainerSlot): ItemStack | undefined {
    if (!slot.isValid) {
        return undefined;
    }

    return attemptBedrock(() => slot.getItem());
}

/**
 * Returns a copied item stack from an item entity, or `undefined` when the
 * entity is invalid, is not an item entity, or the item stack cannot be read.
 */
export function getEntityItemStack(entity: Entity): ItemStack | undefined {
    const item = attemptBedrock(() =>
        entity.getComponent(EntityComponentTypes.Item),
    );
    return attemptBedrock(() => item?.itemStack.clone());
}

/**
 * Describes the durability state of an item after a read or mutation attempt.
 */
export type DurabilityResult = {
    appliedDamage: number;
    broke: boolean;
    damage?: number;
    maxDurability?: number;
    remainingUses?: number;
    supported: boolean;
    unbreakable: boolean;
};

/**
 * Returns the remaining number of uses for an item stack.
 *
 * `undefined` means the item does not expose a durability component. Unbreakable
 * items return `Number.MAX_SAFE_INTEGER`.
 */
export function getRemainingItemUses(itemStack: ItemStack): number | undefined {
    const durability = itemStack.getComponent(ItemComponentTypes.Durability);
    if (!durability) {
        return undefined;
    }

    if (durability.unbreakable) {
        return Number.MAX_SAFE_INTEGER;
    }

    return Math.max(0, durability.maxDurability - durability.damage + 1);
}

/**
 * Applies durability damage directly to an item stack.
 *
 * The item stack is mutated in place. Use {@link applyDurabilityToSlot} when the
 * result also needs to be written back into an inventory slot.
 */
export function applyDurabilityToItem(
    itemStack: ItemStack,
    amount: number,
): DurabilityResult {
    const durability = itemStack.getComponent(ItemComponentTypes.Durability);
    if (!durability) {
        return {
            appliedDamage: 0,
            broke: false,
            supported: false,
            unbreakable: false,
        };
    }

    if (durability.unbreakable) {
        return {
            appliedDamage: 0,
            broke: false,
            damage: durability.damage,
            maxDurability: durability.maxDurability,
            remainingUses: Number.MAX_SAFE_INTEGER,
            supported: true,
            unbreakable: true,
        };
    }

    const requestedDamage = Math.max(0, amount | 0);
    const currentRemainingUses = Math.max(
        0,
        durability.maxDurability - durability.damage + 1,
    );
    const appliedDamage = Math.min(requestedDamage, currentRemainingUses);
    const nextDamage = durability.damage + appliedDamage;
    const broke = nextDamage > durability.maxDurability;

    durability.damage = Math.min(nextDamage, durability.maxDurability);

    return {
        appliedDamage,
        broke,
        damage: durability.damage,
        maxDurability: durability.maxDurability,
        remainingUses: broke
            ? 0
            : Math.max(0, durability.maxDurability - durability.damage + 1),
        supported: true,
        unbreakable: false,
    };
}

/**
 * Applies durability damage to the item currently stored in a container slot.
 *
 * When the item breaks, the slot is cleared.
 */
export function applyDurabilityToSlot(
    slot: ContainerSlot,
    amount: number,
): DurabilityResult {
    const item = getSlotItem(slot);
    if (!item) {
        return {
            appliedDamage: 0,
            broke: false,
            supported: false,
            unbreakable: false,
        };
    }

    const result = applyDurabilityToItem(item, amount);
    if (!result.supported || result.appliedDamage === 0) {
        return result;
    }

    const wrote = attemptBedrock(() => {
        if (result.broke) {
            slot.setItem();
        } else {
            slot.setItem(item);
        }
        return true;
    });
    if (wrote !== true) {
        return {
            ...result,
            appliedDamage: 0,
        };
    }

    return result;
}

/**
 * Applies durability damage to the currently selected slot for a player.
 *
 * This is a convenience wrapper around {@link getSelectedSlot} and
 * {@link applyDurabilityToSlot}.
 */
export function applyDurabilityToSelectedSlot(
    player: Player,
    amount: number,
): DurabilityResult {
    const slot = getSelectedSlot(player);
    if (!slot) {
        return {
            appliedDamage: 0,
            broke: false,
            supported: false,
            unbreakable: false,
        };
    }

    return applyDurabilityToSlot(slot, amount);
}
