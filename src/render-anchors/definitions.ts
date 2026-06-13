import {
    Vec3,
    isVec3Like,
    type Vec3Init,
    type Vec3Like,
} from "../maths/vec3.js";

export const PROJECT_RENDER_ANCHORS_FILE = "render-anchors.json";
export const GENERATED_RENDER_ANCHORS_FILE =
    "generated/bebe/render-anchors.json";
export const DEFAULT_RENDER_ANCHOR_DIMENSION = "minecraft:overworld";
export const DEFAULT_RENDER_ANCHOR_SEARCH_RADIUS = 16;
export const DEFAULT_RENDER_ANCHOR_REPOSITION_THRESHOLD = 16;

export type RenderAnchorPlacementStrategy = "nearestAir";
export type RenderAnchorMovementDriver = "auto" | "packet";

export type RenderAnchorPlacementDefinition = {
    readonly strategy?: RenderAnchorPlacementStrategy;
    readonly searchRadius?: number;
    readonly repositionThreshold?: number;
    readonly driver?: RenderAnchorMovementDriver;
};

export type RenderAnchorNormalizedPlacement = {
    readonly strategy: RenderAnchorPlacementStrategy;
    readonly searchRadius: number;
    readonly repositionThreshold: number;
    readonly driver: RenderAnchorMovementDriver;
};

export type RenderAnchorPropertyValue = boolean | number | string;
export type RenderAnchorPropertyType = "bool" | "int" | "float" | "enum";

export type RenderAnchorPropertyDefinition = {
    readonly type: RenderAnchorPropertyType;
    readonly default?: RenderAnchorPropertyValue;
    readonly values?: readonly string[];
};

export type RenderAnchorPropertiesDefinition =
    | "auto"
    | Record<string, RenderAnchorPropertyDefinition>;

export type RenderAnchorDefinition = {
    readonly id: string;
    readonly entity: string;
    readonly outputEntity?: string;
    readonly dimension?: string;
    readonly location: Vec3Like;
    readonly placement?: RenderAnchorPlacementDefinition;
    readonly properties?: RenderAnchorPropertiesDefinition;
};

export type RenderAnchorCompiledDefinition = {
    readonly id: string;
    readonly entity: string;
    readonly outputEntity: string;
    readonly dimension: string;
    readonly location: Vec3Init;
    readonly placement: RenderAnchorNormalizedPlacement;
    readonly properties: RenderAnchorPropertiesDefinition;
};

export type RenderAnchorPack = {
    readonly anchors: readonly RenderAnchorDefinition[];
};

export type RenderAnchorCompiledPack = {
    readonly anchors: readonly RenderAnchorCompiledDefinition[];
};

export type NormalizeRenderAnchorPackOptions = {
    readonly source?: string;
};

export function normalizeRenderAnchorPack(
    input: unknown,
    options: NormalizeRenderAnchorPackOptions = {},
): RenderAnchorCompiledPack {
    const source = options.source ?? PROJECT_RENDER_ANCHORS_FILE;
    const record = expectRecord(input, source);
    const anchorsInput = record.anchors;
    if (!Array.isArray(anchorsInput)) {
        throw new Error(`${source}.anchors must be an array.`);
    }

    const seenIds = new Set<string>();
    const seenOutputEntities = new Set<string>();
    const anchors = anchorsInput.map((anchor, index) => {
        const normalized = normalizeRenderAnchorDefinition(
            anchor,
            `${source}.anchors[${index}]`,
        );
        if (seenIds.has(normalized.id)) {
            throw new Error(`Duplicate render anchor id "${normalized.id}".`);
        }
        if (seenOutputEntities.has(normalized.outputEntity)) {
            throw new Error(
                `Duplicate render anchor outputEntity "${normalized.outputEntity}".`,
            );
        }
        seenIds.add(normalized.id);
        seenOutputEntities.add(normalized.outputEntity);
        return normalized;
    });

    return { anchors };
}

export function compileRenderAnchorPack(
    input: unknown,
    options: NormalizeRenderAnchorPackOptions = {},
): RenderAnchorCompiledPack {
    return normalizeRenderAnchorPack(input, options);
}

export function normalizeRenderAnchorDefinition(
    input: unknown,
    source = "render anchor",
): RenderAnchorCompiledDefinition {
    const record = expectRecord(input, source);
    const id = expectNonEmptyString(record.id, `${source}.id`);
    const entity = expectEntityIdentifier(record.entity, `${source}.entity`);
    const outputEntity =
        "outputEntity" in record && record.outputEntity !== undefined
            ? expectEntityIdentifier(
                  record.outputEntity,
                  `${source}.outputEntity`,
              )
            : createDefaultRenderAnchorOutputEntity(entity, id);

    return {
        id,
        entity,
        outputEntity,
        dimension:
            "dimension" in record && record.dimension !== undefined
                ? expectNonEmptyString(record.dimension, `${source}.dimension`)
                : DEFAULT_RENDER_ANCHOR_DIMENSION,
        location: expectVec3(record.location, `${source}.location`),
        placement: normalizeRenderAnchorPlacement(
            record.placement,
            `${source}.placement`,
        ),
        properties: normalizeRenderAnchorProperties(
            record.properties,
            `${source}.properties`,
        ),
    };
}

export function createDefaultRenderAnchorOutputEntity(
    entity: string,
    anchorId: string,
): string {
    const namespace = entity.slice(0, entity.indexOf(":"));
    return `${namespace}:bebe_render_anchor_${sanitizeRenderAnchorName(anchorId)}`;
}

export function sanitizeRenderAnchorName(input: string): string {
    const sanitized = input
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_]+/gu, "_")
        .replace(/^_+|_+$/gu, "");

    return sanitized.length > 0 ? sanitized : "anchor";
}

function normalizeRenderAnchorPlacement(
    input: unknown,
    source: string,
): RenderAnchorNormalizedPlacement {
    const record = input === undefined ? {} : expectRecord(input, `${source}`);
    const strategy =
        "strategy" in record && record.strategy !== undefined
            ? expectOneOf(record.strategy, ["nearestAir"], `${source}.strategy`)
            : "nearestAir";
    const driver =
        "driver" in record && record.driver !== undefined
            ? expectOneOf(record.driver, ["auto", "packet"], `${source}.driver`)
            : "auto";

    return {
        strategy,
        searchRadius:
            "searchRadius" in record && record.searchRadius !== undefined
                ? expectPositiveFiniteNumber(
                      record.searchRadius,
                      `${source}.searchRadius`,
                  )
                : DEFAULT_RENDER_ANCHOR_SEARCH_RADIUS,
        repositionThreshold:
            "repositionThreshold" in record &&
            record.repositionThreshold !== undefined
                ? expectNonNegativeFiniteNumber(
                      record.repositionThreshold,
                      `${source}.repositionThreshold`,
                  )
                : DEFAULT_RENDER_ANCHOR_REPOSITION_THRESHOLD,
        driver,
    };
}

function normalizeRenderAnchorProperties(
    input: unknown,
    source: string,
): RenderAnchorPropertiesDefinition {
    if (input === undefined || input === "auto") {
        return "auto";
    }

    const record = expectRecord(input, source);
    const properties: Record<string, RenderAnchorPropertyDefinition> = {};
    for (const [propertyId, propertyInput] of Object.entries(record)) {
        expectNonEmptyString(propertyId, `${source} key`);
        properties[propertyId] = normalizeRenderAnchorPropertyDefinition(
            propertyInput,
            `${source}[${JSON.stringify(propertyId)}]`,
        );
    }

    return properties;
}

function normalizeRenderAnchorPropertyDefinition(
    input: unknown,
    source: string,
): RenderAnchorPropertyDefinition {
    const record = expectRecord(input, source);
    const type = expectOneOf(
        record.type,
        ["bool", "int", "float", "enum"],
        `${source}.type`,
    );
    const values =
        "values" in record && record.values !== undefined
            ? expectStringArray(record.values, `${source}.values`)
            : undefined;
    if (type === "enum" && values?.length === 0) {
        throw new Error(`${source}.values must contain at least one value.`);
    }

    const output: RenderAnchorPropertyDefinition = values
        ? { type, values }
        : { type };
    if ("default" in record && record.default !== undefined) {
        return {
            ...output,
            default: normalizePropertyDefault(
                record.default,
                type,
                values,
                `${source}.default`,
            ),
        };
    }

    return output;
}

function normalizePropertyDefault(
    input: unknown,
    type: RenderAnchorPropertyType,
    values: readonly string[] | undefined,
    source: string,
): RenderAnchorPropertyValue {
    switch (type) {
        case "bool":
            if (typeof input !== "boolean") {
                throw new Error(`${source} must be a boolean.`);
            }
            return input;
        case "int":
            return expectInteger(input, source);
        case "float":
            return expectFiniteNumber(input, source);
        case "enum": {
            const value = expectNonEmptyString(input, source);
            if (values && !values.includes(value)) {
                throw new Error(
                    `${source} must be one of: ${values.join(", ")}.`,
                );
            }
            return value;
        }
    }
}

function expectRecord(input: unknown, source: string): Record<string, unknown> {
    if (!input || typeof input !== "object" || Array.isArray(input)) {
        throw new Error(`${source} must be an object.`);
    }

    return input as Record<string, unknown>;
}

function expectEntityIdentifier(input: unknown, source: string): string {
    const value = expectNonEmptyString(input, source);
    const parts = value.split(":");
    if (parts.length !== 2 || parts[0].length === 0 || parts[1].length === 0) {
        throw new Error(`${source} must be a namespaced entity identifier.`);
    }

    return value;
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

function expectInteger(input: unknown, source: string): number {
    const value = expectFiniteNumber(input, source);
    if (!Number.isInteger(value)) {
        throw new Error(`${source} must be an integer.`);
    }

    return value;
}

function expectPositiveFiniteNumber(input: unknown, source: string): number {
    const value = expectFiniteNumber(input, source);
    if (value <= 0) {
        throw new Error(`${source} must be a positive finite number.`);
    }

    return value;
}

function expectNonNegativeFiniteNumber(input: unknown, source: string): number {
    const value = expectFiniteNumber(input, source);
    if (value < 0) {
        throw new Error(`${source} must be a non-negative finite number.`);
    }

    return value;
}

function expectVec3(input: unknown, source: string): Vec3Init {
    if (!isVec3Like(input)) {
        throw new Error(`${source} must be a finite Vec3-like value.`);
    }

    return new Vec3(input).toObject();
}

function expectStringArray(input: unknown, source: string): readonly string[] {
    if (!Array.isArray(input)) {
        throw new Error(`${source} must be an array of strings.`);
    }

    return input.map((value, index) =>
        expectNonEmptyString(value, `${source}[${index}]`),
    );
}

function expectOneOf<const TValue extends string>(
    input: unknown,
    values: readonly TValue[],
    source: string,
): TValue {
    if (typeof input !== "string" || !values.includes(input as TValue)) {
        throw new Error(`${source} must be one of: ${values.join(", ")}.`);
    }

    return input as TValue;
}
