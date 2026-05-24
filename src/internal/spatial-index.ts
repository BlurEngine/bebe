import { AABB, type AABBInput } from "../maths/aabb.js";
import {
    type Extent,
    type ExtentAABBClassification,
    type OptimizableExtent,
} from "../maths/extents.js";
import { Vec3, type Vec3Like } from "../maths/vec3.js";

export type SpatialIndexId = string | number | symbol;

export type SpatialIndexOptions = {
    /**
     * Size of each square index cell, in world units. Defaults to 16.
     */
    cellSize?: number;
    /**
     * Maximum cells a single finite extent may occupy before it is kept in the
     * scanned fallback set. Defaults to 4096.
     */
    maxCellsPerExtent?: number;
};

export type SpatialIndexEntry<TValue = unknown> = {
    id: SpatialIndexId;
    extent: Extent;
    value?: TValue;
};

export type SpatialIndexHit<TValue = unknown> = {
    id: SpatialIndexId;
    extent: Extent;
    value: TValue | undefined;
};

export type SpatialIndexStats = {
    entries: number;
    cells: number;
    indexedEntries: number;
    scannedEntries: number;
    unboundedEntries: number;
    references: number;
};

type IndexedRecord<TValue> = SpatialIndexHit<TValue> & {
    bounds: AABB | undefined;
    cellKeys: readonly string[];
    order: number;
    storage: "indexed" | "scanned" | "unbounded";
};

const DEFAULT_CELL_SIZE = 16;
const DEFAULT_MAX_CELLS_PER_EXTENT = 4096;

/**
 * Runtime broad-phase index for pure extents.
 *
 * The index is intentionally unaware of worlds, dimensions, entities, or
 * events. Higher-level registries can keep one index per dimension or owner
 * while this class focuses on fast spatial candidate reduction.
 */
export class SpatialIndex<TValue = unknown> {
    readonly cellSize: number;
    readonly maxCellsPerExtent: number;

    readonly #records = new Map<SpatialIndexId, IndexedRecord<TValue>>();
    readonly #cells = new Map<string, Set<SpatialIndexId>>();
    readonly #scannedIds = new Set<SpatialIndexId>();
    readonly #unboundedIds = new Set<SpatialIndexId>();
    #nextOrder = 0;

    constructor(options: SpatialIndexOptions = {}) {
        this.cellSize = assertPositiveFinite(
            options.cellSize ?? DEFAULT_CELL_SIZE,
            "cellSize",
        );
        this.maxCellsPerExtent = assertPositiveFiniteInteger(
            options.maxCellsPerExtent ?? DEFAULT_MAX_CELLS_PER_EXTENT,
            "maxCellsPerExtent",
        );
    }

    get size(): number {
        return this.#records.size;
    }

    register(entry: SpatialIndexEntry<TValue>): () => void {
        const record = this.#createRecord(entry);
        this.delete(entry.id);
        this.#records.set(entry.id, record);
        this.#attachRecord(record);

        return () => {
            if (this.#records.get(entry.id) !== record) {
                return;
            }

            this.#detachRecord(record);
            this.#records.delete(entry.id);
        };
    }

    delete(id: SpatialIndexId): boolean {
        const record = this.#records.get(id);
        if (!record) {
            return false;
        }

        this.#detachRecord(record);
        return this.#records.delete(id);
    }

    clear(): void {
        this.#records.clear();
        this.#cells.clear();
        this.#scannedIds.clear();
        this.#unboundedIds.clear();
    }

    has(id: SpatialIndexId): boolean {
        return this.#records.has(id);
    }

    get(id: SpatialIndexId): SpatialIndexHit<TValue> | undefined {
        const record = this.#records.get(id);
        return record ? toHit(record) : undefined;
    }

    entries(): IterableIterator<SpatialIndexHit<TValue>> {
        return Array.from(this.#records.values(), toHit)[Symbol.iterator]();
    }

    queryPoint(point: Vec3Like): SpatialIndexHit<TValue>[] {
        const location = new Vec3(point);
        const candidates = this.#candidatesForCell(
            cellKeyForPoint(location, this.cellSize),
        );

        return this.#filterCandidates(candidates, (record) =>
            record.extent.containsPoint(location),
        );
    }

    queryAABB(box: AABBInput): SpatialIndexHit<TValue>[] {
        const bounds = AABB.from(box);
        const cellKeys = cellKeysForAABB(
            bounds,
            this.cellSize,
            this.maxCellsPerExtent,
        );
        const candidates = cellKeys
            ? this.#candidatesForCells(cellKeys)
            : this.#allRecords();

        return this.#filterCandidates(
            candidates,
            (record) => classifyExtentAABB(record.extent, bounds) !== "outside",
        );
    }

    stats(): SpatialIndexStats {
        let references = 0;
        for (const ids of this.#cells.values()) {
            references += ids.size;
        }

        return {
            entries: this.#records.size,
            cells: this.#cells.size,
            indexedEntries:
                this.#records.size -
                this.#scannedIds.size -
                this.#unboundedIds.size,
            scannedEntries: this.#scannedIds.size,
            unboundedEntries: this.#unboundedIds.size,
            references,
        };
    }

    #createRecord(entry: SpatialIndexEntry<TValue>): IndexedRecord<TValue> {
        const bounds = entry.extent.bounds();

        if (!bounds) {
            return {
                id: entry.id,
                extent: entry.extent,
                value: entry.value,
                bounds,
                cellKeys: [],
                order: this.#nextOrder++,
                storage: "unbounded",
            };
        }

        const cellKeys = cellKeysForAABB(
            bounds,
            this.cellSize,
            this.maxCellsPerExtent,
        );

        if (!cellKeys) {
            return {
                id: entry.id,
                extent: entry.extent,
                value: entry.value,
                bounds,
                cellKeys: [],
                order: this.#nextOrder++,
                storage: "scanned",
            };
        }

        return {
            id: entry.id,
            extent: entry.extent,
            value: entry.value,
            bounds,
            cellKeys,
            order: this.#nextOrder++,
            storage: "indexed",
        };
    }

    #attachRecord(record: IndexedRecord<TValue>): void {
        if (record.storage === "unbounded") {
            this.#unboundedIds.add(record.id);
            return;
        }

        if (record.storage === "scanned") {
            this.#scannedIds.add(record.id);
            return;
        }

        for (const cellKey of record.cellKeys) {
            const ids = this.#cells.get(cellKey) ?? new Set<SpatialIndexId>();
            ids.add(record.id);
            this.#cells.set(cellKey, ids);
        }
    }

    #detachRecord(record: IndexedRecord<TValue>): void {
        if (record.storage === "unbounded") {
            this.#unboundedIds.delete(record.id);
            return;
        }

        if (record.storage === "scanned") {
            this.#scannedIds.delete(record.id);
            return;
        }

        for (const cellKey of record.cellKeys) {
            const ids = this.#cells.get(cellKey);
            if (!ids) {
                continue;
            }

            ids.delete(record.id);
            if (ids.size === 0) {
                this.#cells.delete(cellKey);
            }
        }
    }

    #candidatesForCell(cellKey: string): IndexedRecord<TValue>[] {
        return this.#recordsForIds([
            ...(this.#cells.get(cellKey) ?? []),
            ...this.#scannedIds,
            ...this.#unboundedIds,
        ]);
    }

    #candidatesForCells(cellKeys: readonly string[]): IndexedRecord<TValue>[] {
        const ids = new Set<SpatialIndexId>();

        for (const cellKey of cellKeys) {
            for (const id of this.#cells.get(cellKey) ?? []) {
                ids.add(id);
            }
        }

        for (const id of this.#scannedIds) {
            ids.add(id);
        }

        for (const id of this.#unboundedIds) {
            ids.add(id);
        }

        return this.#recordsForIds(ids);
    }

    #recordsForIds(ids: Iterable<SpatialIndexId>): IndexedRecord<TValue>[] {
        const records: IndexedRecord<TValue>[] = [];

        for (const id of ids) {
            const record = this.#records.get(id);
            if (record) {
                records.push(record);
            }
        }

        records.sort((a, b) => a.order - b.order);
        return records;
    }

    #allRecords(): IndexedRecord<TValue>[] {
        return Array.from(this.#records.values()).sort(
            (a, b) => a.order - b.order,
        );
    }

    #filterCandidates(
        candidates: readonly IndexedRecord<TValue>[],
        predicate: (record: IndexedRecord<TValue>) => boolean,
    ): SpatialIndexHit<TValue>[] {
        const hits: SpatialIndexHit<TValue>[] = [];

        for (const record of candidates) {
            if (predicate(record)) {
                hits.push(toHit(record));
            }
        }

        return hits;
    }
}

function toHit<TValue>(record: IndexedRecord<TValue>): SpatialIndexHit<TValue> {
    return {
        id: record.id,
        extent: record.extent,
        value: record.value,
    };
}

function cellKeyForPoint(point: Vec3, cellSize: number): string {
    return cellKey(
        Math.floor(point.x / cellSize),
        Math.floor(point.y / cellSize),
        Math.floor(point.z / cellSize),
    );
}

function cellKeysForAABB(
    box: AABB,
    cellSize: number,
    maxCells: number,
): string[] | undefined {
    const min = box.min;
    const max = box.max;
    const minX = Math.floor(min.x / cellSize);
    const minY = Math.floor(min.y / cellSize);
    const minZ = Math.floor(min.z / cellSize);
    const maxX = Math.floor(max.x / cellSize);
    const maxY = Math.floor(max.y / cellSize);
    const maxZ = Math.floor(max.z / cellSize);
    const count = (maxX - minX + 1) * (maxY - minY + 1) * (maxZ - minZ + 1);

    if (count > maxCells) {
        return undefined;
    }

    const keys: string[] = [];
    for (let y = minY; y <= maxY; y += 1) {
        for (let z = minZ; z <= maxZ; z += 1) {
            for (let x = minX; x <= maxX; x += 1) {
                keys.push(cellKey(x, y, z));
            }
        }
    }

    return keys;
}

function cellKey(x: number, y: number, z: number): string {
    return `${x},${y},${z}`;
}

function classifyExtentAABB(
    extent: Extent,
    box: AABB,
): ExtentAABBClassification {
    if (isOptimizableExtent(extent)) {
        return extent.classifyAABB(box);
    }

    const bounds = extent.bounds();
    if (!bounds) {
        return "intersects";
    }

    return bounds.intersects(box, true) ? "intersects" : "outside";
}

function isOptimizableExtent(extent: Extent): extent is OptimizableExtent {
    return (
        typeof (extent as OptimizableExtent).classifyAABB === "function" &&
        typeof (extent as OptimizableExtent).clearanceAt === "function"
    );
}

function assertPositiveFinite(value: number, name: string): number {
    if (!Number.isFinite(value) || value <= 0) {
        throw new TypeError(`${name} must be a positive finite number.`);
    }

    return value;
}

function assertPositiveFiniteInteger(value: number, name: string): number {
    if (!Number.isInteger(value) || value <= 0) {
        throw new TypeError(`${name} must be a positive finite integer.`);
    }

    return value;
}
