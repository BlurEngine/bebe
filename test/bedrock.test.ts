import { describe, expect, it, vi } from "vitest";
import {
    applyDurabilityToItem,
    applyDurabilityToSelectedSlot,
    applyDurabilityToSlot,
    attemptBedrock,
    destroyBlockAt,
    getBlockAt,
    getRemainingItemUses,
    getSelectedSlot,
    getSlotItem,
    isAirBlock,
    isLiquidBlock,
    setBlockTypeAt,
} from "@blurengine/bebe/bedrock";

type TestBlock = {
    isAir: boolean;
    isLiquid: boolean;
    setType: ReturnType<typeof vi.fn>;
    typeId: string;
};

type TestDimension = {
    getBlock: ReturnType<typeof vi.fn>;
    runCommand: ReturnType<typeof vi.fn>;
};

type TestDurability = {
    damage: number;
    maxDurability: number;
    unbreakable: boolean;
};

type TestItemStack = {
    getComponent: ReturnType<typeof vi.fn>;
};

type TestSlot = {
    getItem: ReturnType<typeof vi.fn>;
    isValid: boolean;
    setItem: ReturnType<typeof vi.fn>;
};

function createBlock(overrides?: Partial<TestBlock>): TestBlock {
    return {
        isAir: false,
        isLiquid: false,
        setType: vi.fn(),
        typeId: "minecraft:oak_log",
        ...overrides,
    };
}

function createDimension(block?: TestBlock | undefined): TestDimension {
    return {
        getBlock: vi.fn(() => block),
        runCommand: vi.fn(),
    };
}

function createDurability(overrides?: Partial<TestDurability>): TestDurability {
    return {
        damage: 0,
        maxDurability: 59,
        unbreakable: false,
        ...overrides,
    };
}

function createItemStack(durability?: TestDurability): TestItemStack {
    return {
        getComponent: vi.fn((componentId: string) =>
            componentId === "minecraft:durability" ? durability : undefined,
        ),
    };
}

function createSlot(item?: TestItemStack): TestSlot {
    return {
        getItem: vi.fn(() => item),
        isValid: true,
        setItem: vi.fn(),
    };
}

describe("@blurengine/bebe/bedrock", () => {
    it("wraps throwing Bedrock operations", () => {
        expect(
            attemptBedrock(() => {
                throw new Error("boom");
            }),
        ).toBeUndefined();
    });

    it("reads block state safely", () => {
        const block = createBlock({ isAir: true, isLiquid: false });
        const dimension = createDimension(block);

        expect(getBlockAt(dimension as never, { x: 1, y: 2, z: 3 })).toBe(
            block,
        );
        expect(isAirBlock(block as never)).toBe(true);
        expect(isLiquidBlock(block as never)).toBe(false);
    });

    it("sets and destroys blocks with fallback behavior", () => {
        const block = createBlock();
        const dimension = createDimension(block);

        expect(
            setBlockTypeAt(
                dimension as never,
                { x: 1, y: 2, z: 3 },
                "minecraft:spruce_log",
            ),
        ).toBe(true);
        expect(block.setType).toHaveBeenCalledWith("minecraft:spruce_log");

        dimension.runCommand.mockImplementation(() => {
            throw new Error("command failed");
        });
        expect(destroyBlockAt(dimension as never, { x: 4, y: 5, z: 6 })).toBe(
            true,
        );
        expect(block.setType).toHaveBeenCalledWith("minecraft:air");
    });

    it("reads the selected slot and copied item safely", () => {
        const item = createItemStack();
        const slot = createSlot(item);
        const player = {
            getComponent: vi.fn(() => ({
                container: {
                    getSlot: vi.fn(() => slot),
                },
            })),
            selectedSlotIndex: 2,
        };

        expect(getSelectedSlot(player as never)).toBe(slot);
        expect(getSlotItem(slot as never)).toBe(item);
    });

    it("reads remaining uses from item durability", () => {
        const durability = createDurability({ damage: 1, maxDurability: 59 });
        const item = createItemStack(durability);

        expect(getRemainingItemUses(item as never)).toBe(59);
    });

    it("applies durability directly to an item stack", () => {
        const durability = createDurability({ damage: 1, maxDurability: 59 });
        const item = createItemStack(durability);

        const result = applyDurabilityToItem(item as never, 3);

        expect(result).toMatchObject({
            appliedDamage: 3,
            broke: false,
            remainingUses: 56,
            supported: true,
            unbreakable: false,
        });
        expect(durability.damage).toBe(4);
    });

    it("applies durability to a slot and clears it when the item breaks", () => {
        const durability = createDurability({ damage: 58, maxDurability: 59 });
        const item = createItemStack(durability);
        const slot = createSlot(item);

        const result = applyDurabilityToSlot(slot as never, 2);

        expect(result).toMatchObject({
            appliedDamage: 2,
            broke: true,
            remainingUses: 0,
            supported: true,
        });
        expect(slot.setItem).toHaveBeenCalledWith();
    });

    it("supports selected-slot durability as a thin convenience", () => {
        const durability = createDurability({ damage: 10, maxDurability: 59 });
        const item = createItemStack(durability);
        const slot = createSlot(item);
        const player = {
            getComponent: vi.fn(() => ({
                container: {
                    getSlot: vi.fn(() => slot),
                },
            })),
            selectedSlotIndex: 0,
        };

        const result = applyDurabilityToSelectedSlot(player as never, 5);

        expect(result).toMatchObject({
            appliedDamage: 5,
            broke: false,
            remainingUses: 45,
            supported: true,
        });
        expect(slot.setItem).toHaveBeenCalledTimes(1);
    });
});
