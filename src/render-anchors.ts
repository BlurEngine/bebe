import { world } from "@minecraft/server";
import { Context } from "./context.js";
import { Vec3, type Vec3Init, type Vec3Like } from "./maths/vec3.js";
import {
    normalizeRenderAnchorPack,
    type RenderAnchorCompiledDefinition,
    type RenderAnchorCompiledPack,
    type RenderAnchorPack,
    type RenderAnchorPropertyDefinition,
    type RenderAnchorPropertyValue,
} from "./render-anchors/definitions.js";

export type {
    NormalizeRenderAnchorPackOptions,
    RenderAnchorCompiledDefinition,
    RenderAnchorCompiledPack,
    RenderAnchorDefinition,
    RenderAnchorMovementDriver,
    RenderAnchorNormalizedPlacement,
    RenderAnchorPack,
    RenderAnchorPlacementDefinition,
    RenderAnchorPlacementStrategy,
    RenderAnchorPropertiesDefinition,
    RenderAnchorPropertyDefinition,
    RenderAnchorPropertyType,
    RenderAnchorPropertyValue,
} from "./render-anchors/definitions.js";

export type RenderAnchorState = Record<string, RenderAnchorPropertyValue>;
export type RenderAnchorStatePatch = Record<string, RenderAnchorPropertyValue>;

export type RenderAnchorDimensionLike = {
    readonly id: string;
    getBlock?(location: Vec3Init): RenderAnchorBlockLike | undefined;
    /**
     * Optional dimension query used for best-effort stale carrier cleanup before
     * replacement carriers spawn.
     */
    getEntities?(
        query: RenderAnchorEntityQuery,
    ): Iterable<RenderAnchorEntityLike>;
    spawnEntity?(
        identifier: string,
        location: Vec3Init,
    ): RenderAnchorEntityLike;
};

/**
 * Minimal entity query shape Bebe needs when finding generated carrier entities.
 */
export type RenderAnchorEntityQuery = {
    readonly type?: string;
};

export type RenderAnchorBlockLike = {
    readonly isAir?: boolean | (() => boolean);
};

export type RenderAnchorObserver = {
    readonly id: string;
    readonly dimension: string | RenderAnchorDimensionLike;
    readonly location: Vec3Like;
    readonly isValid?: boolean | (() => boolean);
};

export type RenderAnchorEntityLike = {
    readonly id?: string;
    isValid?: boolean | (() => boolean);
    location?: Vec3Init;
    remove?(): void;
    setProperty(identifier: string, value: RenderAnchorPropertyValue): void;
    teleport?(
        location: Vec3Init,
        options?: { readonly keepVelocity?: boolean },
    ): void;
};

export type RenderAnchorInstance = {
    readonly anchor: RenderAnchorCompiledDefinition;
    readonly anchorId: string;
    readonly entity: RenderAnchorEntityLike;
    readonly observerId?: string;
};

export type RenderAnchorTrackInstanceInput = {
    readonly entity: RenderAnchorEntityLike;
    readonly observerId?: string;
};

export type RenderAnchorSpawnInput = {
    readonly anchor: RenderAnchorCompiledDefinition;
    readonly observer: RenderAnchorObserver;
    readonly location: Vec3Init;
};

export type RenderAnchorMoveInput = RenderAnchorSpawnInput & {
    readonly entity: RenderAnchorEntityLike;
};

/**
 * Input passed to custom carrier discovery during render-anchor reload cleanup.
 */
export type RenderAnchorExistingCarriersInput = {
    readonly anchor: RenderAnchorCompiledDefinition;
    readonly dimension: string | RenderAnchorDimensionLike;
};

export type RenderAnchorStartOptions = {
    /**
     * Remove generated carrier entities that may have been left behind by a
     * previous script runtime before replacement carriers are spawned. Defaults to true.
     */
    readonly cleanupExistingCarriers?: boolean;
    readonly context?: Context;
    getExistingCarriers?(
        input: RenderAnchorExistingCarriersInput,
    ): Iterable<RenderAnchorEntityLike>;
    getObservers?(): Iterable<RenderAnchorObserver>;
    moveEntity?(input: RenderAnchorMoveInput): void;
    removeEntity?(input: RenderAnchorInstance): void;
    spawnEntity?(
        input: RenderAnchorSpawnInput,
    ): RenderAnchorEntityLike | undefined;
};

export interface RenderAnchorsService {
    readonly size: number;
    anchors(): readonly RenderAnchorCompiledDefinition[];
    clear(): void;
    delete(id: string): boolean;
    eachInstance(
        anchorId: string,
        handler: (instance: RenderAnchorInstance) => void,
    ): void;
    get(id: string): RenderAnchorCompiledDefinition | undefined;
    getState(id: string): RenderAnchorState;
    load(pack: RenderAnchorPack | RenderAnchorCompiledPack): void;
    setState(id: string, patch: RenderAnchorStatePatch): void;
    start(options?: RenderAnchorStartOptions): () => boolean;
    trackInstance(
        anchorId: string,
        input: RenderAnchorTrackInstanceInput,
    ): () => boolean;
}

type RenderAnchorInstanceRecord = RenderAnchorInstance & {
    readonly key: string;
    readonly owned: boolean;
    lastObserverLocation?: Vec3Init;
};

class RenderAnchorsRuntime implements RenderAnchorsService {
    readonly #anchors = new Map<string, RenderAnchorCompiledDefinition>();
    readonly #states = new Map<string, RenderAnchorState>();
    readonly #instances = new Map<string, RenderAnchorInstanceRecord>();
    readonly #cleanedExistingCarrierKeys = new Set<string>();
    #nextInstanceId = 0;
    #runtimeContext: Context | undefined;

    get size(): number {
        return this.#anchors.size;
    }

    anchors(): readonly RenderAnchorCompiledDefinition[] {
        return Object.freeze([...this.#anchors.values()]);
    }

    clear(): void {
        this.#stopRuntime();
        this.#removeInstances();
        this.#anchors.clear();
        this.#states.clear();
        this.#cleanedExistingCarrierKeys.clear();
    }

    delete(id: string): boolean {
        if (!this.#anchors.delete(id)) {
            return false;
        }
        this.#states.delete(id);
        for (const record of Array.from(this.#instances.values())) {
            if (record.anchorId === id) {
                this.#removeInstance(record, { removeEntity: record.owned });
            }
        }
        return true;
    }

    eachInstance(
        anchorId: string,
        handler: (instance: RenderAnchorInstance) => void,
    ): void {
        this.#requireAnchor(anchorId);
        for (const record of Array.from(this.#instances.values())) {
            if (record.anchorId !== anchorId) {
                continue;
            }
            if (!isValid(record.entity)) {
                this.#removeInstance(record, { removeEntity: false });
                continue;
            }
            handler(toPublicInstance(record));
        }
    }

    get(id: string): RenderAnchorCompiledDefinition | undefined {
        return this.#anchors.get(id);
    }

    getState(id: string): RenderAnchorState {
        this.#requireAnchor(id);
        return { ...(this.#states.get(id) ?? {}) };
    }

    load(pack: RenderAnchorPack | RenderAnchorCompiledPack): void {
        const normalized = normalizeRenderAnchorPack(pack);
        this.#removeInstances();
        this.#anchors.clear();
        this.#states.clear();
        this.#cleanedExistingCarrierKeys.clear();
        for (const anchor of normalized.anchors) {
            this.#anchors.set(anchor.id, anchor);
            this.#states.set(anchor.id, defaultState(anchor));
        }
    }

    setState(id: string, patch: RenderAnchorStatePatch): void {
        const anchor = this.#requireAnchor(id);
        const next = {
            ...(this.#states.get(id) ?? {}),
            ...validateStatePatch(anchor, patch),
        };
        this.#states.set(id, next);
        for (const record of Array.from(this.#instances.values())) {
            if (record.anchorId !== id) {
                continue;
            }
            if (!isValid(record.entity)) {
                this.#removeInstance(record, { removeEntity: false });
                continue;
            }
            applyState(record.entity, patch);
        }
    }

    start(options: RenderAnchorStartOptions = {}): () => boolean {
        if (this.#runtimeContext) {
            this.#stopRuntime();
        }

        const context = options.context ?? new Context();
        this.#runtimeContext = context;
        this.#cleanedExistingCarrierKeys.clear();
        context.interval(1, () => {
            this.#tick(options);
        });
        context.use(() => {
            if (this.#runtimeContext === context) {
                this.#runtimeContext = undefined;
            }
            this.#removeOwnedInstances(options);
        });

        return () => {
            if (this.#runtimeContext !== context) {
                return false;
            }
            this.#runtimeContext = undefined;
            context.dispose();
            return true;
        };
    }

    trackInstance(
        anchorId: string,
        input: RenderAnchorTrackInstanceInput,
    ): () => boolean {
        const anchor = this.#requireAnchor(anchorId);
        const key = this.#instanceKey(
            anchorId,
            input.observerId ?? input.entity.id,
        );
        const existing = this.#instances.get(key);
        if (existing) {
            this.#removeInstance(existing, { removeEntity: existing.owned });
        }

        const record: RenderAnchorInstanceRecord = {
            anchor,
            anchorId,
            entity: input.entity,
            observerId: input.observerId,
            key,
            owned: false,
        };
        this.#instances.set(key, record);
        applyState(record.entity, this.#states.get(anchorId) ?? {});

        return () => this.#removeInstance(record, { removeEntity: false });
    }

    #tick(options: RenderAnchorStartOptions): void {
        const seen = new Set<string>();
        for (const observer of getObservers(options)) {
            if (!isValid(observer)) {
                continue;
            }
            const observerDimension = normalizeDimension(observer.dimension);
            for (const anchor of this.#anchors.values()) {
                if (anchor.dimension !== observerDimension) {
                    continue;
                }
                this.#cleanupExistingCarriersForAnchor(
                    options,
                    anchor,
                    observer.dimension,
                );
                const key = this.#instanceKey(anchor.id, observer.id);
                seen.add(key);
                let record = this.#instances.get(key);
                if (record && !isValid(record.entity)) {
                    this.#removeInstance(record, { removeEntity: false });
                    record = undefined;
                }
                const location = placeNearObserver(anchor, observer);
                if (!record) {
                    const entity = spawnRenderAnchorEntity(
                        options,
                        anchor,
                        observer,
                        location,
                    );
                    if (!entity) {
                        continue;
                    }
                    record = {
                        anchor,
                        anchorId: anchor.id,
                        entity,
                        observerId: observer.id,
                        key,
                        owned: true,
                        lastObserverLocation: new Vec3(
                            observer.location,
                        ).toObject(),
                    };
                    this.#instances.set(key, record);
                    applyState(entity, this.#states.get(anchor.id) ?? {});
                    continue;
                }
                if (
                    shouldMove(
                        record,
                        observer.location,
                        anchor.placement.repositionThreshold,
                    )
                ) {
                    moveRenderAnchorEntity(options, {
                        anchor,
                        observer,
                        entity: record.entity,
                        location,
                    });
                    record.lastObserverLocation = new Vec3(
                        observer.location,
                    ).toObject();
                }
            }
        }

        for (const record of Array.from(this.#instances.values())) {
            if (record.owned && !seen.has(record.key)) {
                this.#removeInstance(record, undefined, options);
            }
        }
    }

    #cleanupExistingCarriersForAnchor(
        options: RenderAnchorStartOptions,
        anchor: RenderAnchorCompiledDefinition,
        dimension: string | RenderAnchorDimensionLike,
    ): void {
        if (options.cleanupExistingCarriers === false) {
            return;
        }

        const key = existingCarrierCleanupKey(anchor, dimension);
        if (this.#cleanedExistingCarrierKeys.has(key)) {
            return;
        }
        this.#cleanedExistingCarrierKeys.add(key);

        for (const entity of getExistingCarriers(options, {
            anchor,
            dimension,
        })) {
            if (!isValid(entity)) {
                continue;
            }
            const instance = {
                anchor,
                anchorId: anchor.id,
                entity,
            };
            if (options.removeEntity) {
                options.removeEntity(instance);
            } else {
                entity.remove?.();
            }
        }
    }

    #requireAnchor(id: string): RenderAnchorCompiledDefinition {
        const anchor = this.#anchors.get(id);
        if (!anchor) {
            throw new Error(`Unknown render anchor "${id}".`);
        }

        return anchor;
    }

    #instanceKey(anchorId: string, observerId: string | undefined): string {
        return `${anchorId}\u0000${observerId ?? `instance-${this.#nextInstanceId++}`}`;
    }

    #stopRuntime(): boolean {
        const context = this.#runtimeContext;
        if (!context) {
            return false;
        }
        this.#runtimeContext = undefined;
        context.dispose();
        return true;
    }

    #removeOwnedInstances(options?: RenderAnchorStartOptions): void {
        for (const record of Array.from(this.#instances.values())) {
            if (record.owned) {
                this.#removeInstance(record, undefined, options);
            }
        }
    }

    #removeInstances(): void {
        for (const record of Array.from(this.#instances.values())) {
            this.#removeInstance(record, { removeEntity: record.owned });
        }
    }

    #removeInstance(
        record: RenderAnchorInstanceRecord,
        removeOptions: { readonly removeEntity?: boolean } = {},
        startOptions?: RenderAnchorStartOptions,
    ): boolean {
        if (this.#instances.get(record.key) !== record) {
            return false;
        }
        this.#instances.delete(record.key);
        if (removeOptions.removeEntity === false) {
            return true;
        }
        const instance = toPublicInstance(record);
        if (startOptions?.removeEntity) {
            startOptions.removeEntity(instance);
        } else {
            record.entity.remove?.();
        }
        return true;
    }
}

const runtime = new RenderAnchorsRuntime();

/**
 * Singleton registry for distant entity-like render anchors.
 */
export const RenderAnchors: RenderAnchorsService = Object.freeze({
    get size(): number {
        return runtime.size;
    },
    anchors(): readonly RenderAnchorCompiledDefinition[] {
        return runtime.anchors();
    },
    clear(): void {
        runtime.clear();
    },
    delete(id: string): boolean {
        return runtime.delete(id);
    },
    eachInstance(
        anchorId: string,
        handler: (instance: RenderAnchorInstance) => void,
    ): void {
        runtime.eachInstance(anchorId, handler);
    },
    get(id: string): RenderAnchorCompiledDefinition | undefined {
        return runtime.get(id);
    },
    getState(id: string): RenderAnchorState {
        return runtime.getState(id);
    },
    load(pack: RenderAnchorPack | RenderAnchorCompiledPack): void {
        runtime.load(pack);
    },
    setState(id: string, patch: RenderAnchorStatePatch): void {
        runtime.setState(id, patch);
    },
    start(options?: RenderAnchorStartOptions): () => boolean {
        return runtime.start(options);
    },
    trackInstance(
        anchorId: string,
        input: RenderAnchorTrackInstanceInput,
    ): () => boolean {
        return runtime.trackInstance(anchorId, input);
    },
});

function defaultState(
    anchor: RenderAnchorCompiledDefinition,
): RenderAnchorState {
    if (anchor.properties === "auto") {
        return {};
    }

    const state: RenderAnchorState = {};
    for (const [propertyId, property] of Object.entries(anchor.properties)) {
        if (property.default !== undefined) {
            state[propertyId] = property.default;
        }
    }
    return state;
}

function validateStatePatch(
    anchor: RenderAnchorCompiledDefinition,
    patch: RenderAnchorStatePatch,
): RenderAnchorStatePatch {
    const output: RenderAnchorStatePatch = {};
    for (const [propertyId, value] of Object.entries(patch)) {
        const property =
            anchor.properties === "auto"
                ? undefined
                : anchor.properties[propertyId];
        if (anchor.properties !== "auto" && !property) {
            throw new Error(
                `Render anchor "${anchor.id}" does not declare property "${propertyId}".`,
            );
        }
        output[propertyId] = property
            ? validatePropertyValue(anchor.id, propertyId, property, value)
            : validateAutoPropertyValue(anchor.id, propertyId, value);
    }
    return output;
}

function validateAutoPropertyValue(
    anchorId: string,
    propertyId: string,
    value: unknown,
): RenderAnchorPropertyValue {
    if (
        typeof value === "boolean" ||
        typeof value === "string" ||
        (typeof value === "number" && Number.isFinite(value))
    ) {
        return value;
    }

    throw new TypeError(
        `Render anchor "${anchorId}" property "${propertyId}" must be a boolean, finite number, or string.`,
    );
}

function validatePropertyValue(
    anchorId: string,
    propertyId: string,
    property: RenderAnchorPropertyDefinition,
    value: unknown,
): RenderAnchorPropertyValue {
    switch (property.type) {
        case "bool":
            if (typeof value !== "boolean") {
                throw new TypeError(
                    `Render anchor "${anchorId}" property "${propertyId}" must be a boolean.`,
                );
            }
            return value;
        case "int":
            if (typeof value !== "number" || !Number.isInteger(value)) {
                throw new TypeError(
                    `Render anchor "${anchorId}" property "${propertyId}" must be an integer.`,
                );
            }
            return value;
        case "float":
            if (typeof value !== "number" || !Number.isFinite(value)) {
                throw new TypeError(
                    `Render anchor "${anchorId}" property "${propertyId}" must be a finite number.`,
                );
            }
            return value;
        case "enum":
            if (typeof value !== "string") {
                throw new TypeError(
                    `Render anchor "${anchorId}" property "${propertyId}" must be a string.`,
                );
            }
            if (property.values && !property.values.includes(value)) {
                throw new TypeError(
                    `Render anchor "${anchorId}" property "${propertyId}" must be one of: ${property.values.join(", ")}.`,
                );
            }
            return value;
    }
}

function applyState(
    entity: RenderAnchorEntityLike,
    state: RenderAnchorStatePatch,
): void {
    for (const [propertyId, value] of Object.entries(state)) {
        entity.setProperty(propertyId, value);
    }
}

function getObservers(
    options: RenderAnchorStartOptions,
): Iterable<RenderAnchorObserver> {
    if (options.getObservers) {
        return options.getObservers();
    }

    return world.getAllPlayers() as Iterable<RenderAnchorObserver>;
}

function getExistingCarriers(
    options: RenderAnchorStartOptions,
    input: RenderAnchorExistingCarriersInput,
): Iterable<RenderAnchorEntityLike> {
    if (options.getExistingCarriers) {
        return options.getExistingCarriers(input);
    }

    const dimension = input.dimension;
    if (typeof dimension === "string" || !dimension.getEntities) {
        return [];
    }

    return dimension.getEntities({ type: input.anchor.outputEntity });
}

function normalizeDimension(
    dimension: string | RenderAnchorDimensionLike,
): string {
    return typeof dimension === "string" ? dimension : dimension.id;
}

function existingCarrierCleanupKey(
    anchor: RenderAnchorCompiledDefinition,
    dimension: string | RenderAnchorDimensionLike,
): string {
    return `${normalizeDimension(dimension)}\u0000${anchor.outputEntity}`;
}

function spawnRenderAnchorEntity(
    options: RenderAnchorStartOptions,
    anchor: RenderAnchorCompiledDefinition,
    observer: RenderAnchorObserver,
    location: Vec3Init,
): RenderAnchorEntityLike | undefined {
    if (options.spawnEntity) {
        return options.spawnEntity({ anchor, observer, location });
    }
    if (anchor.placement.driver === "packet") {
        return undefined;
    }

    const dimension = observer.dimension;
    if (typeof dimension === "string" || !dimension.spawnEntity) {
        return undefined;
    }

    return dimension.spawnEntity(anchor.outputEntity, location);
}

function moveRenderAnchorEntity(
    options: RenderAnchorStartOptions,
    input: RenderAnchorMoveInput,
): void {
    if (options.moveEntity) {
        options.moveEntity(input);
        return;
    }
    if (input.anchor.placement.driver === "packet") {
        return;
    }

    if (input.entity.teleport) {
        input.entity.teleport(input.location, { keepVelocity: false });
    } else {
        input.entity.location = input.location;
    }
}

function placeNearObserver(
    anchor: RenderAnchorCompiledDefinition,
    observer: RenderAnchorObserver,
): Vec3Init {
    if (anchor.placement.strategy === "nearestAir") {
        const dimension =
            typeof observer.dimension === "string"
                ? undefined
                : observer.dimension;
        if (dimension?.getBlock) {
            const airLocation = findNearestAirLocation(
                dimension,
                observer.location,
                anchor.placement.searchRadius,
            );
            if (airLocation) {
                return airLocation;
            }
        }
    }

    return new Vec3(observer.location).toObject();
}

type RenderAnchorBlockOffset = {
    readonly offset: Vec3;
    readonly distanceSquared: number;
};

const airSearchOffsets = new Map<number, readonly RenderAnchorBlockOffset[]>();

function findNearestAirLocation(
    dimension: RenderAnchorDimensionLike,
    location: Vec3Like,
    searchRadius: number,
): Vec3Init | undefined {
    const base = new Vec3(location).floor();
    for (const { offset } of getAirSearchOffsets(searchRadius)) {
        const blockLocation = base.add(offset).toObject();
        const block = getRenderAnchorBlock(dimension, blockLocation);
        if (block && isRenderAnchorAirBlock(block)) {
            return new Vec3(blockLocation).add({ x: 0.5, z: 0.5 }).toObject();
        }
    }

    return undefined;
}

function getAirSearchOffsets(
    searchRadius: number,
): readonly RenderAnchorBlockOffset[] {
    const key = searchRadius;
    const cached = airSearchOffsets.get(key);
    if (cached) {
        return cached;
    }

    const offsets: RenderAnchorBlockOffset[] = [];
    const limit = Math.max(0, Math.floor(searchRadius));
    const searchRadiusSquared = searchRadius * searchRadius;
    for (let x = -limit; x <= limit; x++) {
        for (let y = -limit; y <= limit; y++) {
            for (let z = -limit; z <= limit; z++) {
                const distanceSquared = x * x + y * y + z * z;
                if (distanceSquared <= searchRadiusSquared) {
                    offsets.push({
                        offset: new Vec3(x, y, z),
                        distanceSquared,
                    });
                }
            }
        }
    }
    offsets.sort(compareAirSearchOffsets);
    airSearchOffsets.set(key, offsets);
    return offsets;
}

function compareAirSearchOffsets(
    left: RenderAnchorBlockOffset,
    right: RenderAnchorBlockOffset,
): number {
    const leftOffset = left.offset;
    const rightOffset = right.offset;
    return (
        left.distanceSquared - right.distanceSquared ||
        Math.abs(leftOffset.y) - Math.abs(rightOffset.y) ||
        Math.abs(leftOffset.x) - Math.abs(rightOffset.x) ||
        leftOffset.x - rightOffset.x ||
        Math.abs(leftOffset.z) - Math.abs(rightOffset.z) ||
        leftOffset.z - rightOffset.z
    );
}

function getRenderAnchorBlock(
    dimension: RenderAnchorDimensionLike,
    location: Vec3Init,
): RenderAnchorBlockLike | undefined {
    try {
        return dimension.getBlock?.(location);
    } catch {
        return undefined;
    }
}

function isRenderAnchorAirBlock(block: RenderAnchorBlockLike): boolean {
    try {
        const isAir = block.isAir;
        return typeof isAir === "function"
            ? isAir.call(block) === true
            : isAir === true;
    } catch {
        return false;
    }
}

function shouldMove(
    record: RenderAnchorInstanceRecord,
    location: Vec3Like,
    threshold: number,
): boolean {
    const current = new Vec3(location);
    const previous = record.lastObserverLocation;
    if (!previous) {
        record.lastObserverLocation = current.toObject();
        return false;
    }
    return current.distanceSquared(previous) >= threshold * threshold;
}

function isValid(target: {
    readonly isValid?: boolean | (() => boolean);
}): boolean {
    const isValidValue = target.isValid;
    if (typeof isValidValue === "function") {
        return isValidValue.call(target) !== false;
    }
    return isValidValue !== false;
}

function toPublicInstance(
    record: RenderAnchorInstanceRecord,
): RenderAnchorInstance {
    return {
        anchor: record.anchor,
        anchorId: record.anchorId,
        entity: record.entity,
        observerId: record.observerId,
    };
}
