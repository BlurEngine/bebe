import { Context } from "./context.js";
import { SpatialIndex } from "./internal/spatial-index.js";
import { AABB, type AABBInput } from "./maths/aabb.js";
import {
    blockExtent,
    boxExtent,
    infiniteExtent,
    polygonExtent,
    type Extent,
} from "./maths/extents.js";
import type { Vec3Like } from "./maths/vec3.js";
import {
    createZoneCompiledIndex,
    type ZoneCompiledIndex,
    type ZoneCompiledLookup,
} from "./zones/compiled-index.js";
import {
    normalizeZoneDefinition,
    normalizeZoneExtentDefinition,
    normalizeZonePack,
    type ZoneBlockExtentDefinition,
    type ZoneBoxExtentDefinition,
    type ZoneCompiledDimensionIndex,
    type ZoneCompiledPack,
    type ZoneDefinition,
    type ZoneExtentDefinition,
    type ZoneInfiniteExtentDefinition,
    type ZonePack,
    type ZonePackScope,
    type ZonePolygonExtentDefinition,
} from "./zones/definitions.js";

export type {
    CompileZonePackOptions,
    NormalizeZonePackOptions,
    ZoneBlockExtentDefinition,
    ZoneBoxExtentDefinition,
    ZoneCompiledDimensionIndex,
    ZoneCompiledPack,
    ZoneDefinition,
    ZoneExtentDefinition,
    ZoneInfiniteExtentDefinition,
    ZonePack,
    ZonePackScope,
    ZonePolygonExtentDefinition,
    ZoneVec2Definition,
    ZoneVec3Definition,
} from "./zones/definitions.js";

export type ZoneId = string | number | symbol;
export type ZoneDimensionId = string;
export type ZoneDimensionLike = {
    readonly id: ZoneDimensionId;
};
export type ZoneDimensionInput = ZoneDimensionId | ZoneDimensionLike;

export type ZoneRegistration = {
    id: ZoneId;
    dimension: ZoneDimensionInput;
    extent: Extent | ZoneExtentDefinition;
};

export type ZoneLookup = {
    id: ZoneId;
    dimension: ZoneDimensionInput;
};

export type ZoneLocationSource = {
    readonly dimension: ZoneDimensionInput;
    readonly location: Vec3Like;
    readonly isValid?: boolean | (() => boolean);
};

export type ZonePointInput = Vec3Like | ZoneLocationSource;

export type ZoneContainsQuery = {
    id: ZoneId;
    dimension?: ZoneDimensionInput;
    point: ZonePointInput;
};

export type ZonePointQuery = {
    dimension?: ZoneDimensionInput;
    point: ZonePointInput;
};

export type ZoneAABBQuery = {
    dimension: ZoneDimensionInput;
    box: AABBInput;
};

export type ZoneHit = {
    id: ZoneId;
    dimension: ZoneDimensionId;
    extent: Extent;
};

export type ZoneMembership = {
    dimension: ZoneDimensionId;
    ids: readonly ZoneId[];
    zones: readonly ZoneHit[];
    has(id: ZoneId): boolean;
};

export type ZoneWatchTarget = ZoneLocationSource & {
    readonly id: string;
};

export type ZoneEventKind = "enter" | "leave" | "stay";
export type ZoneEventReason =
    | "watch"
    | "move"
    | "zone-change"
    | "invalid"
    | "unwatch";

export type ZoneEvent<TEntity extends ZoneWatchTarget = ZoneWatchTarget> = {
    kind: ZoneEventKind;
    reason: ZoneEventReason;
    id: ZoneId;
    dimension: ZoneDimensionId;
    zone: ZoneHit;
    entity: TEntity;
};

export type ZoneEventHandler<
    TEntity extends ZoneWatchTarget = ZoneWatchTarget,
> = (event: ZoneEvent<TEntity>) => void;

export interface ZonesService {
    readonly size: number;
    clear(): void;
    contains(query: ZoneContainsQuery): boolean;
    delete(zone: ZoneLookup): boolean;
    dimensions(): readonly ZoneDimensionId[];
    get(zone: ZoneLookup): ZoneHit | undefined;
    load(pack: ZonePack): void;
    membership(query: ZonePointQuery | ZoneLocationSource): ZoneMembership;
    onEnter(zone: ZoneLookup, handler: ZoneEventHandler): () => void;
    onLeave(zone: ZoneLookup, handler: ZoneEventHandler): () => void;
    onStay(zone: ZoneLookup, handler: ZoneEventHandler): () => void;
    queryAABB(query: ZoneAABBQuery): ZoneHit[];
    queryPoint(query: ZonePointQuery | ZoneLocationSource): ZoneHit[];
    register(zone: ZoneRegistration): () => void;
    toPack(): ZonePack;
    unwatch(target: ZoneWatchTarget | string): boolean;
    watch<TEntity extends ZoneWatchTarget>(target: TEntity): () => boolean;
}

type StoredZone = {
    readonly dimension: ZoneDimensionId;
};

type NormalizedZoneRegistration = {
    readonly id: ZoneId;
    readonly dimension: ZoneDimensionId;
    readonly extent: Extent;
    readonly definition: ZoneDefinition | undefined;
};

type ZoneEventListeners = {
    enter: Set<ZoneEventHandler>;
    leave: Set<ZoneEventHandler>;
    stay: Set<ZoneEventHandler>;
};

type WatchSnapshot = {
    readonly dimension: ZoneDimensionId;
    readonly point: Vec3Like;
    readonly x: number;
    readonly y: number;
    readonly z: number;
};

type WatchedEntityRecord<TEntity extends ZoneWatchTarget = ZoneWatchTarget> = {
    readonly entity: TEntity;
    readonly id: string;
    dimension: ZoneDimensionId | undefined;
    emptyCompiledCellKey: string | undefined;
    x: number | undefined;
    y: number | undefined;
    z: number | undefined;
    version: number;
    zones: Map<ZoneId, ZoneHit>;
};

type ZonePointResult = {
    readonly lookup: ZoneCompiledLookup | undefined;
    readonly zones: ZoneHit[];
};

class ZonesRuntime implements ZonesService {
    readonly #indexesByDimension = new Map<
        ZoneDimensionId,
        SpatialIndex<StoredZone>
    >();
    readonly #listenersByDimension = new Map<
        ZoneDimensionId,
        Map<ZoneId, ZoneEventListeners>
    >();
    readonly #watchedEntities = new Map<string, WatchedEntityRecord>();
    readonly #definitionsByKey = new Map<string, ZoneDefinition | undefined>();
    #compiledIndex: ZoneCompiledIndex | undefined;
    #scope: ZonePackScope | undefined;
    #version = 0;
    #watchContext: Context | undefined;

    get size(): number {
        let size = 0;
        for (const index of this.#indexesByDimension.values()) {
            size += index.size;
        }
        return size;
    }

    clear(): void {
        for (const index of this.#indexesByDimension.values()) {
            index.clear();
        }
        this.#indexesByDimension.clear();
        this.#listenersByDimension.clear();
        this.#watchedEntities.clear();
        this.#definitionsByKey.clear();
        this.#compiledIndex = undefined;
        this.#scope = undefined;
        this.#stopWatchLoop();
        this.#version++;
    }

    contains(query: ZoneContainsQuery): boolean {
        const { dimension, point } = resolveZonePointQuery(query);
        const hit = this.#indexesByDimension.get(dimension)?.get(query.id);
        return hit?.extent.containsPoint(point) ?? false;
    }

    delete(zone: ZoneLookup): boolean {
        const dimension = normalizeDimension(zone.dimension);
        const index = this.#indexesByDimension.get(dimension);
        if (!index) {
            return false;
        }

        const deleted = index.delete(zone.id);
        if (deleted) {
            this.#definitionsByKey.delete(zoneDefinitionKey(zone));
            this.#compiledIndex = undefined;
            this.#version++;
        }
        this.#deleteEmptyIndex(dimension, index);
        return deleted;
    }

    dimensions(): readonly ZoneDimensionId[] {
        return Object.freeze([...this.#indexesByDimension.keys()]);
    }

    get(zone: ZoneLookup): ZoneHit | undefined {
        const dimension = normalizeDimension(zone.dimension);
        const hit = this.#indexesByDimension.get(dimension)?.get(zone.id);
        return hit ? toZoneHit(dimension, hit) : undefined;
    }

    load(pack: ZonePack): void {
        const normalizedPack = normalizeZonePack(pack);
        const zones = normalizedPack.zones.map((zone) =>
            normalizeZoneRegistration(zone),
        );

        this.#clearZoneDefinitions();
        for (const zone of zones) {
            this.#registerNormalized(zone, { preserveCompiledIndex: true });
        }
        this.#scope = normalizedPack.scope;
        this.#compiledIndex = createZoneCompiledIndex(
            normalizedPack.compiled,
            idsByDimension(normalizedPack.zones),
        );
    }

    membership(query: ZonePointQuery | ZoneLocationSource): ZoneMembership {
        const { dimension, point } = resolveZonePointQuery(query);
        const zones = this.queryPoint({
            dimension,
            point,
        });
        const ids = zones.map((zone) => zone.id);

        return {
            dimension,
            ids,
            zones,
            has(id: ZoneId): boolean {
                return ids.includes(id);
            },
        };
    }

    queryAABB(query: ZoneAABBQuery): ZoneHit[] {
        const dimension = normalizeDimension(query.dimension);
        const index = this.#indexesByDimension.get(dimension);
        if (!index) {
            return [];
        }

        return index
            .queryAABB(query.box)
            .map((hit) => toZoneHit(dimension, hit));
    }

    queryPoint(query: ZonePointQuery | ZoneLocationSource): ZoneHit[] {
        const { dimension, point } = resolveZonePointQuery(query);
        const index = this.#indexesByDimension.get(dimension);
        if (!index) {
            return [];
        }

        return this.#queryPointSnapshot({ dimension, point }).zones;
    }

    register(zone: ZoneRegistration): () => void {
        return this.#registerNormalized(normalizeZoneRegistration(zone));
    }

    #registerNormalized(
        zone: NormalizedZoneRegistration,
        options: { readonly preserveCompiledIndex?: boolean } = {},
    ): () => void {
        const dimension = zone.dimension;
        const index = this.#getOrCreateIndex(dimension);
        const definitionKey = normalizedZoneKey(zone);
        if (!options.preserveCompiledIndex) {
            this.#compiledIndex = undefined;
        }
        this.#version++;
        this.#definitionsByKey.set(definitionKey, zone.definition);
        const unregister = index.register({
            id: zone.id,
            extent: zone.extent,
            value: {
                dimension,
            },
        });

        return () => {
            const active = index.get(zone.id);
            if (active?.extent !== zone.extent) {
                return;
            }

            unregister();
            this.#definitionsByKey.delete(definitionKey);
            if (!options.preserveCompiledIndex) {
                this.#compiledIndex = undefined;
            }
            this.#version++;
            this.#deleteEmptyIndex(dimension, index);
        };
    }

    toPack(): ZonePack {
        const zones: ZoneDefinition[] = [];
        for (const [key, definition] of this.#definitionsByKey) {
            if (!definition) {
                const zone = parseZoneDefinitionKey(key);
                throw new Error(
                    `Cannot serialise zone "${zone.id}" in dimension "${zone.dimension}" because its extent is not a built-in JSON zone extent.`,
                );
            }
            zones.push(definition);
        }

        return normalizeZonePack(
            this.#scope
                ? {
                      scope: this.#scope,
                      zones,
                  }
                : { zones },
        );
    }

    unwatch(target: ZoneWatchTarget | string): boolean {
        const id = normalizeWatchTargetId(target);
        const record = this.#watchedEntities.get(id);
        if (!record) {
            return false;
        }

        this.#removeWatchedEntity(record, "unwatch");
        this.#stopWatchLoopIfIdle();
        return true;
    }

    watch<TEntity extends ZoneWatchTarget>(target: TEntity): () => boolean {
        const id = normalizeWatchTargetId(target);
        const existing = this.#watchedEntities.get(id);
        if (existing && existing.entity !== target) {
            this.#removeWatchedEntity(existing, "unwatch");
        }

        let record = this.#watchedEntities.get(id) as
            | WatchedEntityRecord<TEntity>
            | undefined;
        if (!record) {
            record = {
                entity: target,
                id,
                dimension: undefined,
                emptyCompiledCellKey: undefined,
                x: undefined,
                y: undefined,
                z: undefined,
                version: -1,
                zones: new Map(),
            };
            this.#watchedEntities.set(id, record);
        }

        this.#ensureWatchLoop();
        this.#evaluateWatchedEntity(record, "watch");
        return () => this.unwatch(id);
    }

    on(
        kind: ZoneEventKind,
        zone: ZoneLookup,
        handler: ZoneEventHandler,
    ): () => void {
        if (typeof handler !== "function") {
            throw new TypeError("Zone event handler must be a function.");
        }

        const dimension = normalizeDimension(zone.dimension);
        let byZone = this.#listenersByDimension.get(dimension);
        if (!byZone) {
            byZone = new Map();
            this.#listenersByDimension.set(dimension, byZone);
        }

        let listeners = byZone.get(zone.id);
        if (!listeners) {
            listeners = {
                enter: new Set(),
                leave: new Set(),
                stay: new Set(),
            };
            byZone.set(zone.id, listeners);
        }

        listeners[kind].add(handler as ZoneEventHandler);
        return () => {
            listeners[kind].delete(handler as ZoneEventHandler);
            if (
                listeners.enter.size === 0 &&
                listeners.leave.size === 0 &&
                listeners.stay.size === 0
            ) {
                byZone.delete(zone.id);
                if (byZone.size === 0) {
                    this.#listenersByDimension.delete(dimension);
                }
            }
        };
    }

    onEnter(zone: ZoneLookup, handler: ZoneEventHandler): () => void {
        return this.on("enter", zone, handler);
    }

    onLeave(zone: ZoneLookup, handler: ZoneEventHandler): () => void {
        return this.on("leave", zone, handler);
    }

    onStay(zone: ZoneLookup, handler: ZoneEventHandler): () => void {
        return this.on("stay", zone, handler);
    }

    #getOrCreateIndex(dimension: ZoneDimensionId): SpatialIndex<StoredZone> {
        const existing = this.#indexesByDimension.get(dimension);
        if (existing) {
            return existing;
        }

        const index = new SpatialIndex<StoredZone>();
        this.#indexesByDimension.set(dimension, index);
        return index;
    }

    #clearZoneDefinitions(): void {
        for (const index of this.#indexesByDimension.values()) {
            index.clear();
        }
        this.#indexesByDimension.clear();
        this.#definitionsByKey.clear();
        this.#scope = undefined;
        this.#compiledIndex = undefined;
        this.#version++;
    }

    #deleteEmptyIndex(
        dimension: ZoneDimensionId,
        index: SpatialIndex<StoredZone>,
    ): void {
        if (
            index.size === 0 &&
            this.#indexesByDimension.get(dimension) === index
        ) {
            this.#indexesByDimension.delete(dimension);
        }
    }

    #ensureWatchLoop(): void {
        if (this.#watchContext || this.#watchedEntities.size === 0) {
            return;
        }

        const context = new Context();
        this.#watchContext = context;
        context.interval(1, () => {
            this.#tickWatchedEntities();
        });
        context.use(() => {
            if (this.#watchContext === context) {
                this.#watchContext = undefined;
            }
        });
    }

    #stopWatchLoop(): void {
        const context = this.#watchContext;
        this.#watchContext = undefined;
        context?.dispose();
    }

    #stopWatchLoopIfIdle(): void {
        if (this.#watchedEntities.size === 0) {
            this.#stopWatchLoop();
        }
    }

    #tickWatchedEntities(): void {
        for (const record of Array.from(this.#watchedEntities.values())) {
            this.#evaluateWatchedEntity(record, "move");
        }
        this.#stopWatchLoopIfIdle();
    }

    #evaluateWatchedEntity(
        record: WatchedEntityRecord,
        defaultReason: ZoneEventReason,
    ): void {
        const snapshot = readWatchSnapshot(record.entity);
        if (!snapshot) {
            this.#removeWatchedEntity(record, "invalid");
            return;
        }

        const unchanged =
            record.dimension === snapshot.dimension &&
            record.x === snapshot.x &&
            record.y === snapshot.y &&
            record.z === snapshot.z &&
            record.version === this.#version;
        if (unchanged) {
            return;
        }

        const sameDimension = record.dimension === snapshot.dimension;
        if (
            sameDimension &&
            record.version === this.#version &&
            record.zones.size === 0 &&
            record.emptyCompiledCellKey !== undefined
        ) {
            const lookup = this.#compiledIndex?.lookupPoint(
                snapshot.dimension,
                snapshot.point,
            );
            if (
                lookup?.emptyCell &&
                lookup.cellKey === record.emptyCompiledCellKey
            ) {
                record.x = snapshot.x;
                record.y = snapshot.y;
                record.z = snapshot.z;
                return;
            }
        }

        const reason =
            defaultReason === "watch" || record.version === this.#version
                ? defaultReason
                : "zone-change";
        const result = this.#queryPointSnapshot(snapshot);
        const currentZones = result.zones;
        const current = new Map<ZoneId, ZoneHit>();
        for (const zone of currentZones) {
            current.set(zone.id, zone);
        }

        if (!sameDimension) {
            for (const zone of record.zones.values()) {
                this.#emit("leave", reason, record.entity, zone);
            }
            for (const zone of current.values()) {
                this.#emit("enter", reason, record.entity, zone);
            }
        } else {
            for (const [id, zone] of record.zones) {
                if (!current.has(id)) {
                    this.#emit("leave", reason, record.entity, zone);
                }
            }
            for (const [id, zone] of current) {
                if (record.zones.has(id)) {
                    this.#emit("stay", reason, record.entity, zone);
                } else {
                    this.#emit("enter", reason, record.entity, zone);
                }
            }
        }

        record.dimension = snapshot.dimension;
        record.x = snapshot.x;
        record.y = snapshot.y;
        record.z = snapshot.z;
        record.version = this.#version;
        record.zones = current;
        record.emptyCompiledCellKey =
            result.lookup?.emptyCell && current.size === 0
                ? result.lookup.cellKey
                : undefined;
    }

    #queryPointSnapshot(
        snapshot: Pick<WatchSnapshot, "dimension" | "point">,
    ): ZonePointResult {
        const index = this.#indexesByDimension.get(snapshot.dimension);
        if (!index) {
            return {
                lookup: undefined,
                zones: [],
            };
        }

        const lookup = this.#compiledIndex?.lookupPoint(
            snapshot.dimension,
            snapshot.point,
        );
        if (!lookup) {
            return {
                lookup,
                zones: index
                    .queryPoint(snapshot.point)
                    .map((hit) => toZoneHit(snapshot.dimension, hit)),
            };
        }

        const zones: ZoneHit[] = [];
        for (const id of lookup.candidateIds) {
            const hit = index.get(id);
            if (!hit?.extent.containsPoint(snapshot.point)) {
                continue;
            }

            zones.push(toZoneHit(snapshot.dimension, hit));
        }

        return {
            lookup,
            zones,
        };
    }

    #removeWatchedEntity(
        record: WatchedEntityRecord,
        reason: ZoneEventReason,
    ): void {
        if (this.#watchedEntities.get(record.id) !== record) {
            return;
        }

        this.#watchedEntities.delete(record.id);
        for (const zone of record.zones.values()) {
            this.#emit("leave", reason, record.entity, zone);
        }
        record.zones.clear();
    }

    #emit<TEntity extends ZoneWatchTarget>(
        kind: ZoneEventKind,
        reason: ZoneEventReason,
        entity: TEntity,
        zone: ZoneHit,
    ): void {
        const listeners = this.#listenersByDimension
            .get(zone.dimension)
            ?.get(zone.id)?.[kind];
        if (!listeners || listeners.size === 0) {
            return;
        }

        const event: ZoneEvent<TEntity> = {
            kind,
            reason,
            id: zone.id,
            dimension: zone.dimension,
            zone,
            entity,
        };
        for (const listener of Array.from(listeners)) {
            listener(event);
        }
    }
}

const runtime = new ZonesRuntime();

/**
 * Singleton zone registry for authored gameplay areas.
 */
export const Zones: ZonesService = Object.freeze({
    get size(): number {
        return runtime.size;
    },
    clear(): void {
        runtime.clear();
    },
    contains(query: ZoneContainsQuery): boolean {
        return runtime.contains(query);
    },
    delete(zone: ZoneLookup): boolean {
        return runtime.delete(zone);
    },
    dimensions(): readonly ZoneDimensionId[] {
        return runtime.dimensions();
    },
    get(zone: ZoneLookup): ZoneHit | undefined {
        return runtime.get(zone);
    },
    load(pack: ZonePack): void {
        runtime.load(pack);
    },
    membership(query: ZonePointQuery | ZoneLocationSource): ZoneMembership {
        return runtime.membership(query);
    },
    onEnter(zone: ZoneLookup, handler: ZoneEventHandler): () => void {
        return runtime.onEnter(zone, handler);
    },
    onLeave(zone: ZoneLookup, handler: ZoneEventHandler): () => void {
        return runtime.onLeave(zone, handler);
    },
    onStay(zone: ZoneLookup, handler: ZoneEventHandler): () => void {
        return runtime.onStay(zone, handler);
    },
    queryAABB(query: ZoneAABBQuery): ZoneHit[] {
        return runtime.queryAABB(query);
    },
    queryPoint(query: ZonePointQuery | ZoneLocationSource): ZoneHit[] {
        return runtime.queryPoint(query);
    },
    register(zone: ZoneRegistration): () => void {
        return runtime.register(zone);
    },
    toPack(): ZonePack {
        return runtime.toPack();
    },
    unwatch(target: ZoneWatchTarget | string): boolean {
        return runtime.unwatch(target);
    },
    watch<TEntity extends ZoneWatchTarget>(target: TEntity): () => boolean {
        return runtime.watch(target);
    },
});

function normalizeZoneRegistration(
    zone: ZoneRegistration | ZoneDefinition,
): NormalizedZoneRegistration {
    const dimension = normalizeDimension(zone.dimension);
    const definition = isExtent(zone.extent)
        ? undefined
        : normalizeZoneDefinition({
              id: String(zone.id),
              dimension,
              extent: zone.extent,
          });

    return {
        id: zone.id,
        dimension,
        extent: normalizeZoneExtent(zone.extent),
        definition,
    };
}

function zoneDefinitionKey(zone: ZoneLookup): string {
    return `${normalizeDimension(zone.dimension)}\u0000${String(zone.id)}`;
}

function normalizedZoneKey(zone: NormalizedZoneRegistration): string {
    return `${zone.dimension}\u0000${String(zone.id)}`;
}

function parseZoneDefinitionKey(key: string): {
    readonly dimension: string;
    readonly id: string;
} {
    const separator = key.indexOf("\u0000");
    return {
        dimension: key.slice(0, separator),
        id: key.slice(separator + 1),
    };
}

function normalizeZoneExtent(extent: Extent | ZoneExtentDefinition): Extent {
    if (isExtent(extent)) {
        return extent;
    }

    const normalized = normalizeZoneExtentDefinition(extent);
    switch (normalized.kind) {
        case "block":
            return blockExtent(normalized.block);
        case "box":
            return boxExtent(new AABB(normalized.min, normalized.max));
        case "polygon":
            return polygonExtent({
                points: normalized.points,
                y: normalized.y,
            });
        case "infinite":
            return infiniteExtent();
    }
}

function isExtent(value: unknown): value is Extent {
    const candidate = value as Partial<Extent>;

    return (
        !!candidate &&
        typeof candidate === "object" &&
        typeof candidate.containsPoint === "function" &&
        typeof candidate.bounds === "function" &&
        typeof candidate.volume === "function" &&
        typeof candidate.sample === "function" &&
        typeof candidate.blocks === "function"
    );
}

function idsByDimension(
    zones: readonly ZoneDefinition[],
): Map<ZoneDimensionId, ReadonlySet<string>> {
    const ids = new Map<ZoneDimensionId, Set<string>>();

    for (const zone of zones) {
        const dimensionIds = ids.get(zone.dimension) ?? new Set<string>();
        dimensionIds.add(zone.id);
        ids.set(zone.dimension, dimensionIds);
    }

    return ids;
}

function resolveZonePointQuery(
    query: ZonePointQuery | ZoneLocationSource,
): WatchSnapshot {
    let dimension = query.dimension;
    let pointInput: ZonePointInput = isZoneLocationSource(query)
        ? query.location
        : query.point;

    if (dimension === undefined && isZoneLocationSource(pointInput)) {
        dimension = pointInput.dimension;
        pointInput = pointInput.location;
    }

    const point = isZoneLocationSource(pointInput)
        ? pointInput.location
        : pointInput;
    const components = readPointComponents(point);

    return {
        dimension: normalizeDimension(dimension),
        point,
        x: components.x,
        y: components.y,
        z: components.z,
    };
}

function isZoneLocationSource(value: unknown): value is ZoneLocationSource {
    return (
        !!value &&
        typeof value === "object" &&
        "dimension" in value &&
        "location" in value
    );
}

function normalizeDimension(
    dimension: ZoneDimensionInput | undefined,
): ZoneDimensionId {
    const id = typeof dimension === "string" ? dimension : dimension?.id;
    if (typeof id !== "string" || id.length === 0) {
        throw new TypeError("Zone dimension must be a non-empty string.");
    }

    return id;
}

function readPointComponents(point: Vec3Like): {
    readonly x: number;
    readonly y: number;
    readonly z: number;
} {
    if (!point || typeof point !== "object") {
        throw new TypeError("Zone point must be a finite Vec3-like value.");
    }

    let x: number;
    let y: number;
    let z: number;
    if (Array.isArray(point)) {
        [x, y, z] = point;
    } else {
        const objectPoint = point as {
            readonly x: number;
            readonly y: number;
            readonly z: number;
        };
        x = objectPoint.x;
        y = objectPoint.y;
        z = objectPoint.z;
    }

    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
        throw new TypeError("Zone point must be a finite Vec3-like value.");
    }

    return { x, y, z };
}

function normalizeWatchTargetId(target: ZoneWatchTarget | string): string {
    const id = typeof target === "string" ? target : target?.id;
    if (typeof id !== "string" || id.length === 0) {
        throw new TypeError("Zone watch target must have a non-empty id.");
    }

    return id;
}

function readWatchSnapshot(target: ZoneWatchTarget): WatchSnapshot | undefined {
    try {
        if (!isWatchTargetValid(target)) {
            return undefined;
        }

        const point = target.location;
        const components = readPointComponents(point);

        return {
            dimension: normalizeDimension(target.dimension),
            point,
            x: components.x,
            y: components.y,
            z: components.z,
        };
    } catch {
        return undefined;
    }
}

function isWatchTargetValid(target: ZoneWatchTarget): boolean {
    const isValid = target.isValid;
    if (typeof isValid === "function") {
        return isValid.call(target) !== false;
    }
    if (isValid === false) {
        return false;
    }
    return true;
}

function toZoneHit(
    dimension: ZoneDimensionId,
    hit: {
        readonly id: ZoneId;
        readonly extent: Extent;
        readonly value: StoredZone | undefined;
    },
): ZoneHit {
    return {
        id: hit.id,
        dimension,
        extent: hit.extent,
    };
}
