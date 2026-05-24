export const PROJECT_ZONES_FILE = "zones.json";
export const GENERATED_ZONES_FILE = "generated/bebe/zones.json";
export const ZONE_COMPILED_FORMAT_VERSION = 1;
export const DEFAULT_ZONE_COMPILED_CELL_SIZE = 16;
export const DEFAULT_ZONE_COMPILED_MAX_CELLS_PER_ZONE = 4096;

export type ZoneVec3Definition =
    | readonly [number, number, number]
    | {
          readonly x: number;
          readonly y: number;
          readonly z: number;
      };

export type ZoneVec2Definition =
    | readonly [number, number]
    | {
          readonly x: number;
          readonly z: number;
      };

export type ZoneBlockExtentDefinition = {
    readonly kind: "block";
    readonly block: ZoneVec3Definition;
};

export type ZoneBoxExtentDefinition = {
    readonly kind: "box";
    readonly min: ZoneVec3Definition;
    readonly max: ZoneVec3Definition;
};

export type ZonePolygonExtentDefinition = {
    readonly kind: "polygon";
    readonly points: readonly ZoneVec2Definition[];
    readonly y: {
        readonly min: number;
        readonly max: number;
    };
};

export type ZoneInfiniteExtentDefinition = {
    readonly kind: "infinite";
};

export type ZoneExtentDefinition =
    | ZoneBlockExtentDefinition
    | ZoneBoxExtentDefinition
    | ZonePolygonExtentDefinition
    | ZoneInfiniteExtentDefinition;

export type ZoneDefinition = {
    readonly id: string;
    readonly dimension: string;
    readonly extent: ZoneExtentDefinition;
};

export type ZonePackScope = {
    readonly world?: string;
};

export type ZoneCompiledDimensionIndex = {
    readonly cells: Record<string, readonly string[]>;
    readonly scanned: readonly string[];
};

export type ZoneCompiledPack = {
    readonly version: typeof ZONE_COMPILED_FORMAT_VERSION;
    readonly cellSize: number;
    readonly maxCellsPerZone: number;
    readonly dimensions: Record<string, ZoneCompiledDimensionIndex>;
};

export type ZonePack = {
    readonly zones: readonly ZoneDefinition[];
    readonly scope?: ZonePackScope;
    readonly compiled?: ZoneCompiledPack;
};

type Vec3Json = {
    readonly x: number;
    readonly y: number;
    readonly z: number;
};

type Vec2Json = {
    readonly x: number;
    readonly z: number;
};

export type NormalizeZonePackOptions = {
    readonly source?: string;
};

export type CompileZonePackOptions = NormalizeZonePackOptions & {
    readonly cellSize?: number;
    readonly maxCellsPerZone?: number;
};

export function normalizeZonePack(
    input: unknown,
    options: NormalizeZonePackOptions = {},
): ZonePack {
    const source = options.source ?? PROJECT_ZONES_FILE;
    const record = expectRecord(input, source);
    const zonesInput = record.zones;
    if (!Array.isArray(zonesInput)) {
        throw new Error(`${source}.zones must be an array.`);
    }

    const seen = new Set<string>();
    const zones = zonesInput.map((zone, index) => {
        const normalized = normalizeZoneDefinition(
            zone,
            `${source}.zones[${index}]`,
        );
        const key = `${normalized.dimension}\u0000${normalized.id}`;
        if (seen.has(key)) {
            throw new Error(
                `Duplicate zone id "${normalized.id}" in dimension "${normalized.dimension}".`,
            );
        }
        seen.add(key);
        return normalized;
    });

    return {
        zones,
        ...("scope" in record && record.scope !== undefined
            ? {
                  scope: normalizeZonePackScope(
                      record.scope,
                      `${source}.scope`,
                  ),
              }
            : {}),
        ...("compiled" in record && record.compiled !== undefined
            ? {
                  compiled: normalizeZoneCompiledPack(
                      record.compiled,
                      `${source}.compiled`,
                  ),
              }
            : {}),
    };
}

export function compileZonePack(
    input: unknown,
    options: CompileZonePackOptions = {},
): ZonePack {
    const pack = normalizeZonePack(input, options);
    const output: ZonePack = {
        zones: pack.zones,
        compiled: compileZones(pack.zones, options),
    };

    return pack.scope ? { ...output, scope: pack.scope } : output;
}

export function normalizeZoneCompiledPack(
    input: unknown,
    source = "zones.compiled",
): ZoneCompiledPack {
    const record = expectRecord(input, source);
    const version = record.version;
    if (version !== ZONE_COMPILED_FORMAT_VERSION) {
        throw new Error(
            `${source}.version must be ${ZONE_COMPILED_FORMAT_VERSION}.`,
        );
    }

    const cellSize = expectPositiveFiniteNumber(
        record.cellSize,
        `${source}.cellSize`,
    );
    const maxCellsPerZone = expectPositiveInteger(
        record.maxCellsPerZone,
        `${source}.maxCellsPerZone`,
    );
    const dimensions = expectRecord(record.dimensions, `${source}.dimensions`);
    const normalizedDimensions: Record<string, ZoneCompiledDimensionIndex> = {};

    for (const [dimensionInput, indexInput] of Object.entries(dimensions)) {
        const dimension = expectNonEmptyString(
            dimensionInput,
            `${source}.dimensions key`,
        );
        normalizedDimensions[dimension] = normalizeZoneCompiledDimensionIndex(
            indexInput,
            `${source}.dimensions[${JSON.stringify(dimension)}]`,
        );
    }

    return {
        version: ZONE_COMPILED_FORMAT_VERSION,
        cellSize,
        maxCellsPerZone,
        dimensions: normalizedDimensions,
    };
}

export function normalizeZoneDefinition(
    input: unknown,
    source = "zone",
): ZoneDefinition {
    const record = expectRecord(input, source);
    if ("data" in record) {
        throw new Error(
            `${source}.data is not supported. Keep zone metadata in a consumer-owned file keyed by dimension and id.`,
        );
    }

    const id = expectNonEmptyString(record.id, `${source}.id`);
    const dimension = expectNonEmptyString(
        record.dimension,
        `${source}.dimension`,
    );
    return {
        id,
        dimension,
        extent: normalizeZoneExtentDefinition(
            record.extent,
            `${source}.extent`,
        ),
    };
}

export function normalizeZoneExtentDefinition(
    input: unknown,
    source = "zone.extent",
): ZoneExtentDefinition {
    const record = expectRecord(input, source);
    switch (record.kind) {
        case "block":
            return {
                kind: "block",
                block: expectVec3(record.block, `${source}.block`, {
                    integer: true,
                }),
            };
        case "box": {
            const min = expectVec3(record.min, `${source}.min`);
            const max = expectVec3(record.max, `${source}.max`);
            if (max.x <= min.x || max.y <= min.y || max.z <= min.z) {
                throw new Error(
                    `${source}.max must be greater than ${source}.min on every axis.`,
                );
            }

            return {
                kind: "box",
                min,
                max,
            };
        }
        case "polygon": {
            if (!Array.isArray(record.points) || record.points.length < 3) {
                throw new Error(
                    `${source}.points must contain at least 3 points.`,
                );
            }

            const points = record.points.map((point, index) =>
                expectVec2(point, `${source}.points[${index}]`),
            );
            const area = Math.abs(polygonSignedArea(points));
            if (area === 0) {
                throw new Error(`${source}.points must enclose an area.`);
            }

            const y = expectRecord(record.y, `${source}.y`);
            const min = expectFiniteNumber(y.min, `${source}.y.min`);
            const max = expectFiniteNumber(y.max, `${source}.y.max`);
            if (max <= min) {
                throw new Error(
                    `${source}.y.max must be greater than ${source}.y.min.`,
                );
            }

            return {
                kind: "polygon",
                points: points.map((point) => [point.x, point.z]),
                y: {
                    min,
                    max,
                },
            };
        }
        case "infinite":
            return {
                kind: "infinite",
            };
        default:
            throw new Error(
                `${source}.kind must be one of: block, box, polygon, infinite.`,
            );
    }
}

function normalizeZonePackScope(input: unknown, source: string): ZonePackScope {
    const record = expectRecord(input, source);
    const scope: ZonePackScope = {};

    if ("world" in record && record.world !== undefined) {
        return {
            ...scope,
            world: expectNonEmptyString(record.world, `${source}.world`),
        };
    }

    return scope;
}

function compileZones(
    zones: readonly ZoneDefinition[],
    options: CompileZonePackOptions,
): ZoneCompiledPack {
    const cellSize = expectPositiveFiniteNumber(
        options.cellSize ?? DEFAULT_ZONE_COMPILED_CELL_SIZE,
        "cellSize",
    );
    const maxCellsPerZone = expectPositiveInteger(
        options.maxCellsPerZone ?? DEFAULT_ZONE_COMPILED_MAX_CELLS_PER_ZONE,
        "maxCellsPerZone",
    );
    const dimensions: Record<string, MutableCompiledDimensionIndex> = {};

    for (const zone of zones) {
        const index =
            dimensions[zone.dimension] ??
            (dimensions[zone.dimension] = {
                cells: {},
                scanned: [],
            });
        const bounds = getZoneExtentBounds(zone.extent);
        if (!bounds) {
            index.scanned.push(zone.id);
            continue;
        }

        const cellKeys = cellKeysForBounds(bounds, cellSize, maxCellsPerZone);
        if (!cellKeys) {
            index.scanned.push(zone.id);
            continue;
        }

        for (const cellKey of cellKeys) {
            const ids = index.cells[cellKey] ?? (index.cells[cellKey] = []);
            ids.push(zone.id);
        }
    }

    return {
        version: ZONE_COMPILED_FORMAT_VERSION,
        cellSize,
        maxCellsPerZone,
        dimensions,
    };
}

type MutableCompiledDimensionIndex = {
    readonly cells: Record<string, string[]>;
    readonly scanned: string[];
};

type ZoneExtentBounds = {
    readonly min: Vec3Json;
    readonly max: Vec3Json;
};

function getZoneExtentBounds(
    extent: ZoneExtentDefinition,
): ZoneExtentBounds | undefined {
    switch (extent.kind) {
        case "block": {
            const block = toVec3Json(extent.block);
            return {
                min: block,
                max: {
                    x: block.x + 1,
                    y: block.y + 1,
                    z: block.z + 1,
                },
            };
        }
        case "box":
            return {
                min: toVec3Json(extent.min),
                max: toVec3Json(extent.max),
            };
        case "polygon": {
            const points = extent.points.map(toVec2Json);
            let minX = points[0].x;
            let maxX = points[0].x;
            let minZ = points[0].z;
            let maxZ = points[0].z;
            for (let index = 1; index < points.length; index += 1) {
                const point = points[index];
                minX = Math.min(minX, point.x);
                maxX = Math.max(maxX, point.x);
                minZ = Math.min(minZ, point.z);
                maxZ = Math.max(maxZ, point.z);
            }

            return {
                min: {
                    x: minX,
                    y: extent.y.min,
                    z: minZ,
                },
                max: {
                    x: maxX,
                    y: extent.y.max,
                    z: maxZ,
                },
            };
        }
        case "infinite":
            return undefined;
    }
}

function cellKeysForBounds(
    bounds: ZoneExtentBounds,
    cellSize: number,
    maxCells: number,
): string[] | undefined {
    const minX = Math.floor(bounds.min.x / cellSize);
    const minY = Math.floor(bounds.min.y / cellSize);
    const minZ = Math.floor(bounds.min.z / cellSize);
    const maxX = Math.floor(bounds.max.x / cellSize);
    const maxY = Math.floor(bounds.max.y / cellSize);
    const maxZ = Math.floor(bounds.max.z / cellSize);
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

function normalizeZoneCompiledDimensionIndex(
    input: unknown,
    source: string,
): ZoneCompiledDimensionIndex {
    const record = expectRecord(input, source);
    const cells = expectRecord(record.cells, `${source}.cells`);
    const normalizedCells: Record<string, readonly string[]> = {};
    for (const [cellKeyInput, idsInput] of Object.entries(cells)) {
        const key = normalizeCompiledCellKey(
            cellKeyInput,
            `${source}.cells key`,
        );
        normalizedCells[key] = expectStringArray(idsInput, `${source}.cells`);
    }

    return {
        cells: normalizedCells,
        scanned: expectStringArray(record.scanned, `${source}.scanned`),
    };
}

function normalizeCompiledCellKey(input: string, source: string): string {
    const parts = input.split(",");
    if (
        parts.length !== 3 ||
        parts.some((part) => !Number.isInteger(Number(part)))
    ) {
        throw new Error(`${source} must be an x,y,z integer cell key.`);
    }

    return input;
}

function expectStringArray(input: unknown, source: string): readonly string[] {
    if (!Array.isArray(input)) {
        throw new Error(`${source} must be an array of zone ids.`);
    }

    return input.map((value, index) =>
        expectNonEmptyString(value, `${source}[${index}]`),
    );
}

function expectRecord(input: unknown, source: string): Record<string, unknown> {
    if (!input || typeof input !== "object" || Array.isArray(input)) {
        throw new Error(`${source} must be an object.`);
    }

    return input as Record<string, unknown>;
}

function expectNonEmptyString(input: unknown, source: string): string {
    if (typeof input !== "string" || input.trim().length === 0) {
        throw new Error(`${source} must be a non-empty string.`);
    }

    return input.trim();
}

function expectFiniteNumber(input: unknown, source: string): number {
    if (typeof input !== "number" || !Number.isFinite(input)) {
        throw new Error(`${source} must be a finite number.`);
    }

    return input;
}

function expectPositiveFiniteNumber(input: unknown, source: string): number {
    const value = expectFiniteNumber(input, source);
    if (value <= 0) {
        throw new Error(`${source} must be a positive finite number.`);
    }

    return value;
}

function expectPositiveInteger(input: unknown, source: string): number {
    const value = expectFiniteNumber(input, source);
    if (!Number.isInteger(value) || value <= 0) {
        throw new Error(`${source} must be a positive integer.`);
    }

    return value;
}

function expectVec3(
    input: unknown,
    source: string,
    options: { readonly integer?: boolean } = {},
): Vec3Json {
    let x: number;
    let y: number;
    let z: number;
    if (Array.isArray(input)) {
        if (input.length !== 3) {
            throw new Error(`${source} must have exactly 3 components.`);
        }
        [x, y, z] = input.map((value, index) =>
            expectFiniteNumber(value, `${source}[${index}]`),
        );
    } else {
        const record = expectRecord(input, source);
        x = expectFiniteNumber(record.x, `${source}.x`);
        y = expectFiniteNumber(record.y, `${source}.y`);
        z = expectFiniteNumber(record.z, `${source}.z`);
    }

    if (
        options.integer &&
        (!Number.isInteger(x) || !Number.isInteger(y) || !Number.isInteger(z))
    ) {
        throw new Error(`${source} must use integer coordinates.`);
    }

    return { x, y, z };
}

function expectVec2(input: unknown, source: string): Vec2Json {
    let x: number;
    let z: number;
    if (Array.isArray(input)) {
        if (input.length !== 2) {
            throw new Error(`${source} must have exactly 2 components.`);
        }
        [x, z] = input.map((value, index) =>
            expectFiniteNumber(value, `${source}[${index}]`),
        );
    } else {
        const record = expectRecord(input, source);
        x = expectFiniteNumber(record.x, `${source}.x`);
        z = expectFiniteNumber(record.z, `${source}.z`);
    }

    return { x, z };
}

function toVec2Json(input: ZoneVec2Definition): Vec2Json {
    if (Array.isArray(input)) {
        return {
            x: input[0],
            z: input[1],
        };
    }
    const point = input as { readonly x: number; readonly z: number };

    return {
        x: point.x,
        z: point.z,
    };
}

function toVec3Json(input: ZoneVec3Definition): Vec3Json {
    if (Array.isArray(input)) {
        return {
            x: input[0],
            y: input[1],
            z: input[2],
        };
    }
    const point = input as {
        readonly x: number;
        readonly y: number;
        readonly z: number;
    };

    return {
        x: point.x,
        y: point.y,
        z: point.z,
    };
}

function polygonSignedArea(points: readonly Vec2Json[]): number {
    let area = 0;
    for (let index = 0; index < points.length; index += 1) {
        const current = points[index];
        const next = points[(index + 1) % points.length];
        area += current.x * next.z - next.x * current.z;
    }

    return area / 2;
}
