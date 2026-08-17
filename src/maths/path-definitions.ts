import {
    DEFAULT_CATMULL_ROM_SUBDIVISIONS,
    compileCatmullRom,
    compilePolyline,
    type ArcLengthPath,
} from "./path.js";
import type { Vec3Init, Vec3Like } from "./vec3.js";

export const PATH_PACK_FORMAT_VERSION = 1;

export type PolylinePathDefinition = {
    readonly id: string;
    readonly kind: "polyline";
    readonly points: readonly Vec3Like[];
    readonly closed?: boolean;
};

export type CatmullRomPathDefinition = {
    readonly id: string;
    readonly kind: "catmull-rom";
    readonly points: readonly Vec3Like[];
    readonly closed?: boolean;
    readonly subdivisionsPerSegment?: number;
};

export type PathDefinition = PolylinePathDefinition | CatmullRomPathDefinition;

export type CompiledPolylinePathDefinition = {
    readonly id: string;
    readonly kind: "polyline";
    readonly points: readonly Vec3Init[];
    readonly closed: boolean;
};

export type CompiledCatmullRomPathDefinition = {
    readonly id: string;
    readonly kind: "catmull-rom";
    readonly points: readonly Vec3Init[];
    readonly closed: boolean;
    readonly subdivisionsPerSegment: number;
};

export type CompiledPathDefinition =
    | CompiledPolylinePathDefinition
    | CompiledCatmullRomPathDefinition;

export type PathPack = {
    readonly version: typeof PATH_PACK_FORMAT_VERSION;
    readonly paths: readonly PathDefinition[];
};

export type CompiledPathPack = {
    readonly version: typeof PATH_PACK_FORMAT_VERSION;
    readonly paths: readonly CompiledPathDefinition[];
};

const BASE_FIELDS = new Set(["id", "kind", "points", "closed"]);

export function normalizePathPack(
    input: unknown,
    source = "paths",
): CompiledPathPack {
    const record = expectRecord(input, source);
    if (record.version !== PATH_PACK_FORMAT_VERSION) {
        throw new Error(
            `${source}.version must be ${PATH_PACK_FORMAT_VERSION}.`,
        );
    }
    if (!Array.isArray(record.paths)) {
        throw new Error(`${source}.paths must be an array.`);
    }

    const seen = new Set<string>();
    const paths = record.paths.map((value, index) => {
        const path = normalizePathDefinition(
            value,
            `${source}.paths[${index}]`,
        );
        if (seen.has(path.id)) {
            throw new Error(`Duplicate path id "${path.id}".`);
        }
        seen.add(path.id);
        return path;
    });
    paths.sort((left, right) =>
        left.id === right.id ? 0 : left.id < right.id ? -1 : 1,
    );
    return Object.freeze({
        version: PATH_PACK_FORMAT_VERSION,
        paths: Object.freeze(paths),
    });
}

export function normalizePathDefinition(
    input: unknown,
    source = "path",
): CompiledPathDefinition {
    const record = expectRecord(input, source);
    const kind = record.kind;
    const allowed =
        kind === "catmull-rom"
            ? new Set([...BASE_FIELDS, "subdivisionsPerSegment"])
            : BASE_FIELDS;
    for (const field of Object.keys(record)) {
        if (!allowed.has(field)) {
            throw new Error(
                `${source} contains unsupported field ${JSON.stringify(field)}.`,
            );
        }
    }
    const id = expectNonEmptyString(record.id, `${source}.id`);
    if (kind !== "polyline" && kind !== "catmull-rom") {
        throw new Error(`${source}.kind must be polyline or catmull-rom.`);
    }
    if (!Array.isArray(record.points)) {
        throw new Error(`${source}.points must be an array.`);
    }
    const points = Object.freeze(
        record.points.map((point, index) =>
            Object.freeze(expectVec3(point, `${source}.points[${index}]`)),
        ),
    );
    const closed =
        expectOptionalBoolean(record.closed, `${source}.closed`) ?? false;

    if (kind === "polyline") {
        compilePolyline(points, closed);
        return Object.freeze({ id, kind, points, closed });
    }
    const subdivisionsPerSegment =
        record.subdivisionsPerSegment === undefined
            ? DEFAULT_CATMULL_ROM_SUBDIVISIONS
            : expectPositiveInteger(
                  record.subdivisionsPerSegment,
                  `${source}.subdivisionsPerSegment`,
              );
    compileCatmullRom(points, { closed, subdivisionsPerSegment });
    return Object.freeze({
        id,
        kind,
        points,
        closed,
        subdivisionsPerSegment,
    });
}

export function compilePathDefinition(
    input: PathDefinition | unknown,
): ArcLengthPath {
    const path = normalizePathDefinition(input);
    return path.kind === "polyline"
        ? compilePolyline(path.points, path.closed)
        : compileCatmullRom(path.points, {
              closed: path.closed,
              subdivisionsPerSegment: path.subdivisionsPerSegment,
          });
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

function expectOptionalBoolean(
    input: unknown,
    source: string,
): boolean | undefined {
    if (input === undefined) return undefined;
    if (typeof input !== "boolean") {
        throw new Error(`${source} must be a boolean.`);
    }
    return input;
}

function expectPositiveInteger(input: unknown, source: string): number {
    const value = expectFiniteNumber(input, source);
    if (!Number.isInteger(value) || value < 1) {
        throw new Error(`${source} must be a positive integer.`);
    }
    return value;
}
