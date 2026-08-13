import type { YawPitch } from "../maths/util.js";
import type { Vec3Init, Vec3Like } from "../maths/vec3.js";

export const PROJECT_LOCATIONS_FILE = "locations.json";
export const GENERATED_LOCATIONS_FILE = "generated/bebe/locations.json";
export const LOCATION_PACK_FORMAT_VERSION = 1;

export type LocationDefinition = {
    readonly id: string;
    readonly dimension: string;
    readonly location: Vec3Like;
    readonly orientation?: YawPitch;
    readonly lines?: readonly string[];
};

export type CompiledLocationDefinition = {
    readonly id: string;
    readonly dimension: string;
    readonly location: Vec3Init;
    readonly orientation?: YawPitch;
    readonly lines?: readonly string[];
};

export type LocationPack = {
    readonly version: typeof LOCATION_PACK_FORMAT_VERSION;
    readonly locations: readonly LocationDefinition[];
};

export type CompiledLocationPack = {
    readonly version: typeof LOCATION_PACK_FORMAT_VERSION;
    readonly locations: readonly CompiledLocationDefinition[];
};

export type NormalizeLocationPackOptions = {
    readonly source?: string;
};

const LOCATION_FIELDS = new Set([
    "id",
    "dimension",
    "location",
    "orientation",
    "lines",
]);

export function normalizeLocationPack(
    input: unknown,
    options: NormalizeLocationPackOptions = {},
): CompiledLocationPack {
    const source = options.source ?? PROJECT_LOCATIONS_FILE;
    const record = expectRecord(input, source);
    if (record.version !== LOCATION_PACK_FORMAT_VERSION) {
        throw new Error(
            `${source}.version must be ${LOCATION_PACK_FORMAT_VERSION}.`,
        );
    }
    if (!Array.isArray(record.locations)) {
        throw new Error(`${source}.locations must be an array.`);
    }

    const seen = new Set<string>();
    const locations = record.locations.map((value, index) => {
        const location = normalizeLocationDefinition(
            value,
            `${source}.locations[${index}]`,
        );
        const key = locationKey(location.dimension, location.id);
        if (seen.has(key)) {
            throw new Error(
                `Duplicate location id "${location.id}" in dimension "${location.dimension}".`,
            );
        }
        seen.add(key);
        return location;
    });

    locations.sort(compareLocations);
    return Object.freeze({
        version: LOCATION_PACK_FORMAT_VERSION,
        locations: Object.freeze(locations),
    });
}

export function normalizeLocationDefinition(
    input: unknown,
    source = "location",
): CompiledLocationDefinition {
    const record = expectRecord(input, source);
    for (const field of Object.keys(record)) {
        if (!LOCATION_FIELDS.has(field)) {
            throw new Error(
                `${source} contains unsupported field ${JSON.stringify(field)}.`,
            );
        }
    }

    const output: CompiledLocationDefinition = {
        id: expectNonEmptyString(record.id, `${source}.id`),
        dimension: expectNonEmptyString(
            record.dimension,
            `${source}.dimension`,
        ),
        location: freezeVec3(expectVec3(record.location, `${source}.location`)),
        ...(record.orientation === undefined
            ? {}
            : {
                  orientation: normalizeOrientation(
                      record.orientation,
                      `${source}.orientation`,
                  ),
              }),
        ...(record.lines === undefined
            ? {}
            : { lines: normalizeLines(record.lines, `${source}.lines`) }),
    };

    return Object.freeze(output);
}

function normalizeOrientation(input: unknown, source: string): YawPitch {
    const record = expectRecord(input, source);
    for (const field of Object.keys(record)) {
        if (field !== "yaw" && field !== "pitch") {
            throw new Error(
                `${source} contains unsupported field ${JSON.stringify(field)}.`,
            );
        }
    }

    return Object.freeze({
        yaw: expectFiniteNumber(record.yaw, `${source}.yaw`),
        pitch: expectFiniteNumber(record.pitch, `${source}.pitch`),
    });
}

function normalizeLines(input: unknown, source: string): readonly string[] {
    if (!Array.isArray(input)) {
        throw new Error(`${source} must be an array of strings.`);
    }

    return Object.freeze(
        input.map((line, index) => {
            if (typeof line !== "string") {
                throw new Error(`${source}[${index}] must be a string.`);
            }
            return line;
        }),
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

function expectVec3(input: unknown, source: string): Vec3Init {
    if (Array.isArray(input)) {
        if (input.length !== 3) {
            throw new Error(`${source} must have exactly 3 components.`);
        }
        return {
            x: expectFiniteNumber(input[0], `${source}[0]`),
            y: expectFiniteNumber(input[1], `${source}[1]`),
            z: expectFiniteNumber(input[2], `${source}[2]`),
        };
    }

    const record = expectRecord(input, source);
    return {
        x: expectFiniteNumber(record.x, `${source}.x`),
        y: expectFiniteNumber(record.y, `${source}.y`),
        z: expectFiniteNumber(record.z, `${source}.z`),
    };
}

function freezeVec3(value: Vec3Init): Vec3Init {
    return Object.freeze(value);
}

function locationKey(dimension: string, id: string): string {
    return `${dimension}\u0000${id}`;
}

function compareLocations(
    left: CompiledLocationDefinition,
    right: CompiledLocationDefinition,
): number {
    if (left.dimension !== right.dimension) {
        return left.dimension < right.dimension ? -1 : 1;
    }
    if (left.id === right.id) {
        return 0;
    }
    return left.id < right.id ? -1 : 1;
}
