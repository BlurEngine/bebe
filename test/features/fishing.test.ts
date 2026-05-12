import { beforeEach, describe, expect, it, vi } from "vitest";
import { Context } from "@blurengine/bebe";
import {
    Dimension,
    Entity,
    EntityComponentTypes,
    Player,
    minecraftMockControl,
} from "@minecraft/server";
import { installFishingEvents } from "@blurengine/bebe/features/fishing";

function createItemStack(typeId: string) {
    return {
        typeId,
        clone: vi.fn(() => createItemStack(typeId)),
    };
}

function createPlayer() {
    const dimension = new Dimension();
    return new Player({
        dimension,
        id: "player-1",
        location: { x: 0, y: 64, z: 0 },
        name: "SupaaaaaaHam",
    });
}

function createHook(player: Player) {
    return new Entity({
        dimension: player.dimension,
        id: "hook-1",
        location: { x: 1, y: 64, z: 0 },
        typeId: "minecraft:fishing_hook",
    });
}

describe("@blurengine/bebe/features/fishing", () => {
    beforeEach(() => {
        minecraftMockControl.reset();
    });

    it("emits cast after a fishing hook spawns near a rod use", () => {
        const ctx = new Context();
        const player = createPlayer();
        const hook = createHook(player);
        const rod = createItemStack("minecraft:fishing_rod");
        const events = installFishingEvents(ctx);
        const onCast = vi.fn();

        minecraftMockControl.setPlayers([player]);
        ctx.subscribe(events.afterEvents.cast, onCast);
        minecraftMockControl.emitAfterEvent("itemUse", {
            itemStack: rod,
            source: player,
        });
        minecraftMockControl.emitAfterEvent("entitySpawn", { entity: hook });

        expect(onCast).toHaveBeenCalledWith({
            hook,
            itemStack: expect.objectContaining({
                typeId: "minecraft:fishing_rod",
            }),
            player,
        });
        ctx.dispose();
    });

    it("emits hookWater and hookBite while polling the active hook", () => {
        const ctx = new Context();
        const player = createPlayer();
        const hook = createHook(player);
        const events = installFishingEvents(ctx, {
            minBiteTicks: 1,
        });
        const onHookWater = vi.fn();
        const onHookBite = vi.fn();

        minecraftMockControl.setPlayers([player]);
        ctx.subscribe(events.afterEvents.hookWater, onHookWater);
        ctx.subscribe(events.afterEvents.hookBite, onHookBite);
        minecraftMockControl.emitAfterEvent("itemUse", {
            itemStack: createItemStack("minecraft:fishing_rod"),
            source: player,
        });
        minecraftMockControl.emitAfterEvent("entitySpawn", { entity: hook });

        hook.isInWater = true;
        minecraftMockControl.advance();
        hook.location = { x: 1, y: 63.7, z: 0 };
        hook.setVelocity({ x: 0, y: -0.2, z: 0 });
        minecraftMockControl.advance();

        expect(onHookWater).toHaveBeenCalledWith({ hook, player });
        expect(onHookBite).toHaveBeenCalledWith({ hook, player });
        ctx.dispose();
    });

    it("emits reel and catch for a caught item entity", () => {
        const ctx = new Context();
        const player = createPlayer();
        const hook = createHook(player);
        const caughtStack = createItemStack("minecraft:cod");
        const itemEntity = new Entity({
            dimension: player.dimension,
            id: "item-1",
            location: { x: 1, y: 64, z: 0 },
            typeId: "minecraft:item",
        });
        const events = installFishingEvents(ctx);
        const onReel = vi.fn();
        const onCatch = vi.fn();

        itemEntity.setComponent(EntityComponentTypes.Item, {
            itemStack: caughtStack,
        });
        minecraftMockControl.setPlayers([player]);
        ctx.subscribe(events.afterEvents.reel, onReel);
        ctx.subscribe(events.afterEvents.catch, onCatch);
        minecraftMockControl.emitAfterEvent("itemUse", {
            itemStack: createItemStack("minecraft:fishing_rod"),
            source: player,
        });
        minecraftMockControl.emitAfterEvent("entitySpawn", { entity: hook });
        minecraftMockControl.advance(2);
        minecraftMockControl.emitAfterEvent("itemUse", {
            itemStack: createItemStack("minecraft:fishing_rod"),
            source: player,
        });
        minecraftMockControl.emitAfterEvent("entitySpawn", {
            entity: itemEntity,
        });

        expect(onReel).toHaveBeenCalledWith({
            hook,
            itemStack: expect.objectContaining({
                typeId: "minecraft:fishing_rod",
            }),
            player,
        });
        expect(onCatch).toHaveBeenCalledWith(
            expect.objectContaining({
                hook,
                itemEntity,
                itemStack: expect.objectContaining({ typeId: "minecraft:cod" }),
                player,
            }),
        );
        expect(Object.keys(onCatch.mock.calls[0]?.[0] ?? {}).sort()).toEqual(
            ["hook", "itemEntity", "itemStack", "location", "player"].sort(),
        );
        expect(itemEntity.isValid).toBe(true);
        ctx.dispose();
    });
});
