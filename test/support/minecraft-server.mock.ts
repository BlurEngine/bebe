type ScheduledJob = {
    kind: "once" | "interval";
    dueTick: number;
    intervalTicks: number;
    callback: () => void;
};

type EventHandler<TEvent> = (event: TEvent) => void;
type EntityRemoveBeforeEvent = { removedEntity: { id?: string } };
type EntityRemoveHandler = EventHandler<EntityRemoveBeforeEvent>;
type CustomCommand = {
    readonly name: string;
    readonly description: string;
    readonly permissionLevel: CommandPermissionLevel;
    readonly cheatsRequired?: boolean;
    readonly mandatoryParameters?: readonly {
        readonly name: string;
        readonly type: CustomCommandParamType;
    }[];
    readonly optionalParameters?: readonly {
        readonly name: string;
        readonly type: CustomCommandParamType;
    }[];
};
type CustomCommandCallback = (
    origin: { readonly sourceEntity?: Entity },
    ...args: unknown[]
) => CustomCommandResult | undefined;
type CustomCommandResult = {
    readonly message?: string;
    readonly status: CustomCommandStatus;
};

class MockEventSignal<TEvent> {
    readonly #handlers = new Set<EventHandler<TEvent>>();

    subscribe(handler: EventHandler<TEvent>): EventHandler<TEvent> {
        this.#handlers.add(handler);
        return handler;
    }

    unsubscribe(handler: EventHandler<TEvent>): void {
        this.#handlers.delete(handler);
    }

    emit(event: TEvent): void {
        for (const handler of Array.from(this.#handlers)) {
            handler(event);
        }
    }

    reset(): void {
        this.#handlers.clear();
    }
}

let currentTick = 0;
let nextHandle = 1;
const jobs = new Map<number, ScheduledJob>();
const entityRemoveHandlers = new Set<EntityRemoveHandler>();
const startupEvent = new MockEventSignal<{
    customCommandRegistry: {
        registerEnum(name: string, values: string[]): void;
        registerCommand(
            command: CustomCommand,
            callback: CustomCommandCallback,
        ): void;
    };
}>();
const customCommands = new Map<
    string,
    {
        readonly command: CustomCommand;
        readonly callback: CustomCommandCallback;
    }
>();
const customCommandEnums = new Map<string, readonly string[]>();
const afterEvents = {
    entityItemPickup: new MockEventSignal<{
        entity: Entity;
        items: ItemStack[];
    }>(),
    entityRemove: new MockEventSignal<{
        removedEntityId: string;
        typeId: string;
    }>(),
    entitySpawn: new MockEventSignal<{
        entity: Entity;
    }>(),
    itemReleaseUse: new MockEventSignal<{
        itemStack?: ItemStack;
        source: Player;
    }>(),
    itemUse: new MockEventSignal<{
        itemStack?: ItemStack;
        source: Player;
    }>(),
    playerInteractWithBlock: new MockEventSignal<{
        block: {
            dimension: Dimension;
            location: Vector3;
        };
        player: Player;
    }>(),
};
let allPlayers: Player[] = [];

function schedule(
    kind: ScheduledJob["kind"],
    callback: () => void,
    ticks: number,
): number {
    const handle = nextHandle++;
    jobs.set(handle, {
        kind,
        dueTick: currentTick + Math.max(1, ticks | 0),
        intervalTicks: Math.max(1, ticks | 0),
        callback,
    });
    return handle;
}

function flushCurrentTick(): void {
    let shouldContinue = true;
    while (shouldContinue) {
        shouldContinue = false;
        for (const [handle, job] of Array.from(jobs.entries())) {
            if (job.dueTick > currentTick) continue;
            shouldContinue = true;
            if (job.kind === "once") {
                jobs.delete(handle);
            } else {
                job.dueTick = currentTick + job.intervalTicks;
            }
            job.callback();
        }
    }
}

export const system = {
    get currentTick() {
        return currentTick;
    },
    beforeEvents: {
        startup: startupEvent,
    },
    run(callback: () => void) {
        return schedule("once", callback, 1);
    },
    runTimeout(callback: () => void, ticks: number) {
        return schedule("once", callback, ticks);
    },
    runInterval(callback: () => void, ticks: number) {
        return schedule("interval", callback, ticks);
    },
    clearRun(handle: number) {
        jobs.delete(handle);
    },
};

export const EntityComponentTypes = {
    Item: "minecraft:item",
    Inventory: "minecraft:inventory",
} as const;

export const ItemComponentTypes = {
    Durability: "minecraft:durability",
} as const;

export enum Direction {
    Down = "Down",
    East = "East",
    North = "North",
    South = "South",
    Up = "Up",
    West = "West",
}

export enum CommandPermissionLevel {
    Any = 0,
    GameDirectors = 1,
    Admin = 2,
    Host = 3,
    Owner = 4,
}

export enum CustomCommandParamType {
    Enum = "Enum",
    String = "String",
}

export enum CustomCommandStatus {
    Success = 0,
    Failure = 1,
}

export type Vector3 = {
    readonly x: number;
    readonly y: number;
    readonly z: number;
};

export type PlayedSound = {
    readonly soundId: string;
    readonly options?: {
        readonly pitch?: number;
        readonly volume?: number;
        readonly location?: Vector3;
    };
};

export type ItemStack = {
    readonly typeId: string;
    clone(): ItemStack;
};

export class Dimension {
    readonly id: string;

    constructor(id = "minecraft:overworld") {
        this.id = id;
    }
}

export class Entity {
    readonly id: string;
    readonly typeId: string;
    dimension: Dimension;
    isInWater = false;
    isValid = true;
    location: Vector3;
    #components = new Map<string, unknown>();
    #velocity: Vector3 = { x: 0, y: 0, z: 0 };

    constructor(options: {
        id: string;
        typeId: string;
        dimension?: Dimension;
        location?: Vector3;
        velocity?: Vector3;
    }) {
        this.id = options.id;
        this.typeId = options.typeId;
        this.dimension = options.dimension ?? new Dimension();
        this.location = options.location ?? { x: 0, y: 0, z: 0 };
        this.#velocity = options.velocity ?? this.#velocity;
    }

    getComponent(componentId: string): unknown {
        return this.#components.get(componentId);
    }

    getComponents(): { typeId: string }[] {
        return Array.from(this.#components.keys()).map((typeId) => ({
            typeId,
        }));
    }

    getVelocity(): Vector3 {
        return this.#velocity;
    }

    remove(): void {
        this.isValid = false;
    }

    setComponent(componentId: string, component: unknown): void {
        this.#components.set(componentId, component);
    }

    setVelocity(velocity: Vector3): void {
        this.#velocity = velocity;
    }
}

export class Player extends Entity {
    readonly name: string;
    readonly actionBarMessages: string[] = [];
    readonly playedSounds: PlayedSound[] = [];
    readonly onScreenDisplay = {
        setActionBar: (text: string): void => {
            this.actionBarMessages.push(text);
        },
    };
    selectedSlotIndex = 0;

    constructor(options: {
        id: string;
        name?: string;
        dimension?: Dimension;
        location?: Vector3;
    }) {
        super({
            id: options.id,
            typeId: "minecraft:player",
            dimension: options.dimension,
            location: options.location,
        });
        this.name = options.name ?? options.id;
    }

    playSound(
        soundId: string,
        options?: {
            readonly pitch?: number;
            readonly volume?: number;
            readonly location?: Vector3;
        },
    ): void {
        this.playedSounds.push({ soundId, options });
    }
}

export const world = {
    afterEvents,
    beforeEvents: {
        entityRemove: {
            subscribe(handler: EntityRemoveHandler) {
                entityRemoveHandlers.add(handler);
            },
            unsubscribe(handler: EntityRemoveHandler) {
                entityRemoveHandlers.delete(handler);
            },
        },
    },
    getAllPlayers() {
        return allPlayers;
    },
};

export const minecraftMockControl = {
    advance(ticks = 1) {
        for (let i = 0; i < ticks; i++) {
            currentTick += 1;
            flushCurrentTick();
        }
    },
    emitEntityRemove(entity: { id?: string }) {
        for (const handler of Array.from(entityRemoveHandlers)) {
            handler({ removedEntity: entity });
        }
    },
    emitAfterEvent<TEventName extends keyof typeof afterEvents>(
        eventName: TEventName,
        event: Parameters<(typeof afterEvents)[TEventName]["emit"]>[0],
    ) {
        afterEvents[eventName].emit(event as never);
    },
    emitStartup() {
        startupEvent.emit({
            customCommandRegistry: {
                registerEnum(name, values) {
                    customCommandEnums.set(name, [...values]);
                },
                registerCommand(command, callback) {
                    customCommands.set(command.name, {
                        command,
                        callback,
                    });
                },
            },
        });
    },
    getCustomCommand(name: string) {
        return customCommands.get(name);
    },
    getCustomCommandEnum(name: string) {
        return customCommandEnums.get(name);
    },
    reset() {
        currentTick = 0;
        nextHandle = 1;
        jobs.clear();
        entityRemoveHandlers.clear();
        startupEvent.reset();
        customCommands.clear();
        customCommandEnums.clear();
        allPlayers = [];
        for (const signal of Object.values(afterEvents)) {
            signal.reset();
        }
    },
    setPlayers(players: Player[]) {
        allPlayers = players;
    },
};
