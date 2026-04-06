import {
    EntityComponentTypes,
    ItemComponentTypes,
    type Block,
    type BlockType,
    type ContainerSlot,
    type Dimension,
    type ItemStack,
    type Player,
    type Vector3,
} from "@minecraft/server";

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
        }) === true
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
        }) === true;
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
