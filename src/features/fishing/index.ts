import {
    Player,
    system,
    world,
    type Entity,
    type EntityItemPickupAfterEvent,
    type EntityRemoveAfterEvent,
    type EntitySpawnAfterEvent,
    type ItemStack,
    type ItemReleaseUseAfterEvent,
    type ItemUseAfterEvent,
} from "@minecraft/server";
import type { Context, EventSignalSource } from "@blurengine/bebe";
import { Vec3, type Vec3Like } from "@blurengine/bebe/maths";
import {
    attemptBedrock,
    getEntityItemStack,
    getSelectedSlot,
    getSlotItem,
} from "../../bedrock/index.js";
import { EventSignal } from "../../event-signal.js";

const FISHING_HOOK_TYPE_ID = "minecraft:fishing_hook";
const FISHING_ROD_TYPE_ID = "minecraft:fishing_rod";
const ITEM_ENTITY_TYPE_ID = "minecraft:item";

/**
 * Tuning values used by {@link installFishingEvents}.
 */
export type FishingEventConfig = {
    readonly biteCooldownTicks: number;
    readonly biteVelocityY: number;
    readonly biteVerticalDelta: number;
    readonly catchItemSpawnRadius: number;
    readonly catchWindowTicks: number;
    readonly hookMatchRadius: number;
    readonly maxSessionTicks: number;
    readonly minBiteTicks: number;
    readonly pendingUseTicks: number;
    readonly pollTicks: number;
    readonly reelIgnoreTicksAfterCast: number;
};

/**
 * Default fishing monitor tuning for vanilla Bedrock fishing behaviour.
 */
export const DEFAULT_FISHING_EVENT_CONFIG: FishingEventConfig = {
    biteCooldownTicks: 60,
    biteVelocityY: -0.08,
    biteVerticalDelta: -0.18,
    catchItemSpawnRadius: 6,
    catchWindowTicks: 20,
    hookMatchRadius: 8,
    maxSessionTicks: 20 * 60 * 3,
    minBiteTicks: 20,
    pendingUseTicks: 8,
    pollTicks: 1,
    reelIgnoreTicksAfterCast: 1,
};

/**
 * Fired after a player casts a fishing rod and the spawned hook is matched.
 */
export type FishingCastAfterEvent = {
    readonly player: Player;
    readonly hook: Entity;
    readonly itemStack?: ItemStack;
};

/**
 * Fired once when a tracked fishing hook first enters water.
 */
export type FishingHookWaterAfterEvent = {
    readonly player: Player;
    readonly hook: Entity;
};

/**
 * Fired when a tracked fishing hook behaves like a vanilla bite.
 */
export type FishingHookBiteAfterEvent = {
    readonly player: Player;
    readonly hook: Entity;
};

/**
 * Fired after a tracked fishing hook is reeled in.
 */
export type FishingReelAfterEvent = {
    readonly player: Player;
    readonly hook: Entity;
    readonly itemStack?: ItemStack;
};

/**
 * Fired after a tracked fishing reel produces an item stack.
 */
export type FishingCatchAfterEvent = {
    readonly player: Player;
    readonly hook: Entity;
    readonly itemStack: ItemStack;
    readonly location: Vec3;
    readonly itemEntity?: Entity;
};

/**
 * Opt-in event set derived from vanilla fishing behaviour.
 */
export type FishingEvents = {
    readonly afterEvents: {
        readonly cast: EventSignalSource<FishingCastAfterEvent>;
        readonly hookWater: EventSignalSource<FishingHookWaterAfterEvent>;
        readonly hookBite: EventSignalSource<FishingHookBiteAfterEvent>;
        readonly reel: EventSignalSource<FishingReelAfterEvent>;
        readonly catch: EventSignalSource<FishingCatchAfterEvent>;
    };
};

type PendingRodUse = {
    readonly player: Player;
    readonly playerId: string;
    readonly dimensionId: string;
    readonly itemStack?: ItemStack;
    readonly tick: number;
    readonly location: Vec3;
};

type FishingHookSnapshot = {
    readonly isInWater: boolean;
    readonly location: Vec3Like;
    readonly velocity: Vec3Like;
};

type FishingHookSession = {
    readonly id: string;
    readonly player: Player;
    readonly playerId: string;
    readonly hook: Entity;
    readonly hookId: string;
    readonly dimensionId: string;
    readonly castTick: number;
    readonly castLocation: Vec3;
    lastLocation: Vec3;
    lastVelocity: Vec3;
    enteredWater: boolean;
    waterEntryTick?: number;
    lastBiteTick?: number;
    reelTick?: number;
};

type FishingRodUseAfterEvent = ItemUseAfterEvent | ItemReleaseUseAfterEvent;

class FishingEventMonitor implements FishingEvents {
    readonly afterEvents = {
        cast: new EventSignal<FishingCastAfterEvent>(),
        hookWater: new EventSignal<FishingHookWaterAfterEvent>(),
        hookBite: new EventSignal<FishingHookBiteAfterEvent>(),
        reel: new EventSignal<FishingReelAfterEvent>(),
        catch: new EventSignal<FishingCatchAfterEvent>(),
    };

    readonly #config: FishingEventConfig;
    readonly #pendingRodUses = new Map<string, PendingRodUse>();
    readonly #sessionsByHookId = new Map<string, FishingHookSession>();
    readonly #sessionsByPlayerId = new Map<string, FishingHookSession>();

    constructor(ctx: Context, config: FishingEventConfig) {
        this.#config = config;
        ctx.subscribe(world.afterEvents.itemUse, (event) => {
            this.#handleRodUse(event);
        });
        ctx.subscribe(world.afterEvents.itemReleaseUse, (event) => {
            this.#handleRodUse(event);
        });
        ctx.subscribe(world.afterEvents.entitySpawn, (event) => {
            this.#handleEntitySpawn(event);
        });
        ctx.subscribe(world.afterEvents.entityRemove, (event) => {
            this.#handleEntityRemove(event);
        });
        ctx.subscribe(world.afterEvents.entityItemPickup, (event) => {
            this.#handleEntityItemPickup(event);
        });
        ctx.interval(this.#config.pollTicks, () => {
            this.#pollSessions();
        });
    }

    #handleRodUse(event: FishingRodUseAfterEvent): void {
        if (
            !event.itemStack ||
            event.itemStack.typeId !== FISHING_ROD_TYPE_ID
        ) {
            return;
        }

        const player = event.source;
        const session = this.#sessionsByPlayerId.get(player.id);
        if (session) {
            if (
                shouldTreatRodUseAsReel(
                    session,
                    system.currentTick,
                    this.#config,
                )
            ) {
                this.#emitReel(session, event.itemStack);
            }
            return;
        }

        this.#pendingRodUses.set(player.id, {
            player,
            playerId: player.id,
            dimensionId: player.dimension.id,
            itemStack: cloneItemStack(event.itemStack),
            tick: system.currentTick,
            location: new Vec3(player.location),
        });
        this.#prunePendingRodUses(system.currentTick);
    }

    #handleEntitySpawn(event: EntitySpawnAfterEvent): void {
        const entity = event.entity;
        if (entity.typeId === ITEM_ENTITY_TYPE_ID) {
            this.#handleItemSpawn(entity);
            return;
        }

        if (entity.typeId !== FISHING_HOOK_TYPE_ID) {
            return;
        }

        const hookLocation = readEntityLocation(entity);
        if (!hookLocation) {
            return;
        }

        const pendingUse = this.#findPendingRodUse(entity, hookLocation);
        if (!pendingUse) {
            return;
        }

        const previousSession = this.#sessionsByPlayerId.get(
            pendingUse.playerId,
        );
        if (previousSession) {
            this.#removeSession(previousSession);
        }

        const session = createFishingHookSession({
            castLocation: hookLocation,
            castTick: system.currentTick,
            dimensionId: pendingUse.dimensionId,
            hook: entity,
            player: pendingUse.player,
        });

        this.#sessionsByHookId.set(session.hookId, session);
        this.#sessionsByPlayerId.set(session.playerId, session);
        this.#pendingRodUses.delete(pendingUse.playerId);
        this.afterEvents.cast.emit({
            player: session.player,
            hook: session.hook,
            itemStack: pendingUse.itemStack,
        });
    }

    #handleItemSpawn(itemEntity: Entity): void {
        const location = readEntityLocation(itemEntity);
        const dimensionId = readEntityDimensionId(itemEntity);
        const itemStack = getEntityItemStack(itemEntity);
        if (!location || !dimensionId || !itemStack) {
            return;
        }

        for (const session of Array.from(this.#sessionsByPlayerId.values())) {
            if (
                session.dimensionId !== dimensionId ||
                !shouldTreatItemSpawnAsCatch(
                    session,
                    location,
                    system.currentTick,
                    this.#config,
                )
            ) {
                continue;
            }

            this.afterEvents.catch.emit({
                player: session.player,
                hook: session.hook,
                itemStack,
                itemEntity,
                location,
            });
            this.#removeSession(session);
            return;
        }
    }

    #handleEntityRemove(event: EntityRemoveAfterEvent): void {
        if (event.typeId !== FISHING_HOOK_TYPE_ID) {
            return;
        }

        const session = this.#sessionsByHookId.get(event.removedEntityId);
        if (!session) {
            return;
        }

        if (
            shouldTreatHookRemoveAsReel(
                session,
                system.currentTick,
                this.#config,
            )
        ) {
            this.#emitReel(session);
            return;
        }

        this.#removeSession(session);
    }

    #handleEntityItemPickup(event: EntityItemPickupAfterEvent): void {
        if (!(event.entity instanceof Player)) {
            return;
        }

        const player = event.entity;
        const session = this.#sessionsByPlayerId.get(player.id);
        if (!session || session.reelTick === undefined) {
            return;
        }

        if (
            system.currentTick - session.reelTick >
            this.#config.catchWindowTicks
        ) {
            this.#removeSession(session);
            return;
        }

        for (const itemStack of event.items) {
            const location = readEntityLocation(player);
            if (!location) {
                continue;
            }

            this.afterEvents.catch.emit({
                player,
                hook: session.hook,
                itemStack,
                location,
            });
        }
        this.#removeSession(session);
    }

    #pollSessions(): void {
        const tick = system.currentTick;

        for (const session of Array.from(this.#sessionsByHookId.values())) {
            if (!session.player.isValid) {
                this.#removeSession(session);
                continue;
            }

            if (
                shouldExpireHookSession(
                    session,
                    tick,
                    this.#config.maxSessionTicks,
                )
            ) {
                this.#removeSession(session);
                continue;
            }

            if (session.reelTick !== undefined) {
                if (tick - session.reelTick > this.#config.catchWindowTicks) {
                    this.#removeSession(session);
                }
                continue;
            }

            const snapshot = readHookSnapshot(session.hook);
            if (!snapshot) {
                if (shouldTreatHookLossAsReel(session, tick, this.#config)) {
                    this.#emitReel(session);
                    continue;
                }

                this.#removeSession(session);
                continue;
            }

            if (!session.enteredWater && snapshot.isInWater) {
                session.enteredWater = true;
                session.waterEntryTick = tick;
                this.afterEvents.hookWater.emit({
                    player: session.player,
                    hook: session.hook,
                });
            }

            if (shouldEmitHookBite(session, snapshot, this.#config, tick)) {
                recordFishingHookBite(session, tick);
                this.afterEvents.hookBite.emit({
                    player: session.player,
                    hook: session.hook,
                });
            }

            updateFishingHookSessionSnapshot(session, snapshot);
        }
    }

    #findPendingRodUse(
        hook: Entity,
        hookLocation: Vec3,
    ): PendingRodUse | undefined {
        const tick = system.currentTick;
        const hookDimensionId = readEntityDimensionId(hook);
        let best: PendingRodUse | undefined;
        let bestDistance = Number.POSITIVE_INFINITY;

        for (const pendingUse of this.#pendingRodUses.values()) {
            if (
                tick - pendingUse.tick > this.#config.pendingUseTicks ||
                hookDimensionId !== pendingUse.dimensionId
            ) {
                continue;
            }

            const distance = hookLocation.distanceSquared(pendingUse.location);
            if (
                distance <= this.#config.hookMatchRadius ** 2 &&
                distance < bestDistance
            ) {
                best = pendingUse;
                bestDistance = distance;
            }
        }

        return (
            best ?? this.#findNearestRodPlayer(hookDimensionId, hookLocation)
        );
    }

    #findNearestRodPlayer(
        dimensionId: string | undefined,
        hookLocation: Vec3,
    ): PendingRodUse | undefined {
        if (!dimensionId) {
            return undefined;
        }

        let bestPlayer: Player | undefined;
        let bestDistance = Number.POSITIVE_INFINITY;

        for (const player of world.getAllPlayers()) {
            if (
                !player.isValid ||
                player.dimension.id !== dimensionId ||
                getSelectedItemStack(player)?.typeId !== FISHING_ROD_TYPE_ID
            ) {
                continue;
            }

            const distance = hookLocation.distanceSquared(player.location);
            if (
                distance <= this.#config.hookMatchRadius ** 2 &&
                distance < bestDistance
            ) {
                bestPlayer = player;
                bestDistance = distance;
            }
        }

        if (!bestPlayer) {
            return undefined;
        }

        return {
            player: bestPlayer,
            playerId: bestPlayer.id,
            dimensionId,
            itemStack: cloneItemStack(getSelectedItemStack(bestPlayer)),
            tick: system.currentTick,
            location: new Vec3(bestPlayer.location),
        };
    }

    #emitReel(session: FishingHookSession, itemStack?: ItemStack): void {
        session.reelTick = system.currentTick;
        this.afterEvents.reel.emit({
            player: session.player,
            hook: session.hook,
            itemStack: cloneItemStack(itemStack),
        });
    }

    #removeSession(session: FishingHookSession): void {
        if (this.#sessionsByHookId.get(session.hookId) === session) {
            this.#sessionsByHookId.delete(session.hookId);
        }
        if (this.#sessionsByPlayerId.get(session.playerId) === session) {
            this.#sessionsByPlayerId.delete(session.playerId);
        }
    }

    #prunePendingRodUses(tick: number): void {
        for (const [playerId, pendingUse] of this.#pendingRodUses) {
            if (tick - pendingUse.tick > this.#config.pendingUseTicks) {
                this.#pendingRodUses.delete(playerId);
            }
        }
    }
}

/**
 * Installs derived fishing events owned by the provided context.
 */
export function installFishingEvents(
    ctx: Context,
    config: Partial<FishingEventConfig> = {},
): FishingEvents {
    return new FishingEventMonitor(ctx, {
        ...DEFAULT_FISHING_EVENT_CONFIG,
        ...config,
    });
}

function createFishingHookSession(options: {
    readonly castLocation: Vec3Like;
    readonly castTick: number;
    readonly dimensionId: string;
    readonly hook: Entity;
    readonly player: Player;
}): FishingHookSession {
    return {
        id: `${options.player.id}:${options.hook.id}:${options.castTick}`,
        player: options.player,
        playerId: options.player.id,
        hook: options.hook,
        hookId: options.hook.id,
        dimensionId: options.dimensionId,
        castTick: options.castTick,
        castLocation: new Vec3(options.castLocation),
        lastLocation: new Vec3(options.castLocation),
        lastVelocity: Vec3.zero(),
        enteredWater: false,
    };
}

function shouldEmitHookBite(
    session: FishingHookSession,
    snapshot: FishingHookSnapshot,
    config: FishingEventConfig,
    currentTick: number,
): boolean {
    if (
        !session.enteredWater ||
        session.waterEntryTick === undefined ||
        !snapshot.isInWater ||
        getHookWaterAge(session, currentTick) < config.minBiteTicks ||
        getHookBiteAge(session, currentTick) < config.biteCooldownTicks
    ) {
        return false;
    }

    const location = new Vec3(snapshot.location);
    const velocity = new Vec3(snapshot.velocity);
    const verticalDelta = location.y - session.lastLocation.y;
    return (
        verticalDelta <= config.biteVerticalDelta ||
        velocity.y <= config.biteVelocityY
    );
}

function updateFishingHookSessionSnapshot(
    session: FishingHookSession,
    snapshot: FishingHookSnapshot,
): void {
    session.lastLocation = new Vec3(snapshot.location);
    session.lastVelocity = new Vec3(snapshot.velocity);
    if (snapshot.isInWater) {
        session.enteredWater = true;
    }
}

function recordFishingHookBite(
    session: FishingHookSession,
    currentTick: number,
): void {
    session.lastBiteTick = currentTick;
}

function shouldExpireHookSession(
    session: FishingHookSession,
    currentTick: number,
    maxSessionTicks: number,
): boolean {
    return getHookSessionAge(session, currentTick) > maxSessionTicks;
}

function shouldTreatRodUseAsReel(
    session: FishingHookSession,
    currentTick: number,
    config: FishingEventConfig,
): boolean {
    return (
        session.reelTick === undefined &&
        getHookSessionAge(session, currentTick) >
            config.reelIgnoreTicksAfterCast
    );
}

function shouldTreatHookRemoveAsReel(
    session: FishingHookSession,
    currentTick: number,
    config: FishingEventConfig,
): boolean {
    return shouldTreatRodUseAsReel(session, currentTick, config);
}

function shouldTreatHookLossAsReel(
    session: FishingHookSession,
    currentTick: number,
    config: FishingEventConfig,
): boolean {
    return shouldTreatRodUseAsReel(session, currentTick, config);
}

function shouldTreatItemSpawnAsCatch(
    session: FishingHookSession,
    itemLocation: Vec3Like,
    currentTick: number,
    config: FishingEventConfig,
): boolean {
    if (session.reelTick === undefined) {
        return false;
    }

    return (
        currentTick - session.reelTick <= config.catchWindowTicks &&
        session.lastLocation.distanceSquared(itemLocation) <=
            config.catchItemSpawnRadius ** 2
    );
}

function getHookSessionAge(
    session: FishingHookSession,
    currentTick: number,
): number {
    return Math.max(0, currentTick - session.castTick);
}

function getHookWaterAge(
    session: FishingHookSession,
    currentTick: number,
): number {
    return Math.max(0, currentTick - (session.waterEntryTick ?? currentTick));
}

function getHookBiteAge(
    session: FishingHookSession,
    currentTick: number,
): number {
    if (session.lastBiteTick === undefined) {
        return Number.POSITIVE_INFINITY;
    }

    return Math.max(0, currentTick - session.lastBiteTick);
}

function readHookSnapshot(hook: Entity): FishingHookSnapshot | undefined {
    if (!hook.isValid) {
        return undefined;
    }

    return attemptBedrock(() => ({
        isInWater: hook.isInWater,
        location: new Vec3(hook.location),
        velocity: new Vec3(hook.getVelocity()),
    }));
}

function readEntityDimensionId(entity: Entity): string | undefined {
    if (!entity.isValid) {
        return undefined;
    }

    return attemptBedrock(() => entity.dimension.id);
}

function readEntityLocation(entity: Entity): Vec3 | undefined {
    if (!entity.isValid) {
        return undefined;
    }

    return attemptBedrock(() => new Vec3(entity.location));
}

function getSelectedItemStack(player: Player): ItemStack | undefined {
    const slot = getSelectedSlot(player);
    return slot ? getSlotItem(slot) : undefined;
}

function cloneItemStack(
    itemStack: ItemStack | undefined,
): ItemStack | undefined {
    return itemStack?.clone();
}
