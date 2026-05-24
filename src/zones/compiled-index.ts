import type { Vec3Like } from "../maths/vec3.js";
import type { ZoneCompiledPack } from "./definitions.js";

export type ZoneCompiledLookup = {
    readonly candidateIds: readonly string[];
    readonly cellKey: string;
    readonly emptyCell: boolean;
};

type CompiledDimension = {
    readonly cells: ReadonlyMap<string, readonly string[]>;
    readonly scanned: readonly string[];
};

export class ZoneCompiledIndex {
    readonly #cellSize: number;
    readonly #dimensions: ReadonlyMap<string, CompiledDimension>;

    constructor(pack: ZoneCompiledPack) {
        this.#cellSize = pack.cellSize;
        this.#dimensions = new Map(
            Object.entries(pack.dimensions).map(([dimension, index]) => [
                dimension,
                {
                    cells: new Map(Object.entries(index.cells)),
                    scanned: index.scanned,
                },
            ]),
        );
    }

    lookupPoint(
        dimension: string,
        point: Vec3Like,
    ): ZoneCompiledLookup | undefined {
        const index = this.#dimensions.get(dimension);
        if (!index) {
            return undefined;
        }

        const key = cellKeyForPoint(point, this.#cellSize);
        const candidateIds = dedupeIds([
            ...(index.cells.get(key) ?? []),
            ...index.scanned,
        ]);

        return {
            candidateIds,
            cellKey: key,
            emptyCell: candidateIds.length === 0,
        };
    }
}

export function createZoneCompiledIndex(
    compiled: ZoneCompiledPack | undefined,
    idsByDimension: ReadonlyMap<string, ReadonlySet<string>>,
): ZoneCompiledIndex | undefined {
    if (!compiled) {
        return undefined;
    }

    for (const [dimension, expectedIds] of idsByDimension) {
        const index = compiled.dimensions[dimension];
        if (!index) {
            if (expectedIds.size > 0) {
                return undefined;
            }
            continue;
        }

        const coveredIds = new Set(index.scanned);
        for (const ids of Object.values(index.cells)) {
            for (const id of ids) {
                coveredIds.add(id);
            }
        }

        for (const id of expectedIds) {
            if (!coveredIds.has(id)) {
                return undefined;
            }
        }
    }

    return new ZoneCompiledIndex(compiled);
}

function cellKeyForPoint(point: Vec3Like, cellSize: number): string {
    const { x, y, z } = getPointComponents(point);

    return [
        Math.floor(x / cellSize),
        Math.floor(y / cellSize),
        Math.floor(z / cellSize),
    ].join(",");
}

function getPointComponents(point: Vec3Like): {
    readonly x: number;
    readonly y: number;
    readonly z: number;
} {
    if (Array.isArray(point)) {
        const [x, y, z] = point;
        return { x, y, z };
    }

    const objectPoint = point as {
        readonly x: number;
        readonly y: number;
        readonly z: number;
    };

    return {
        x: objectPoint.x,
        y: objectPoint.y,
        z: objectPoint.z,
    };
}

function dedupeIds(ids: readonly string[]): readonly string[] {
    return [...new Set(ids)];
}
