import fs from "node:fs";
import path from "node:path";
import {
    GENERATED_RENDER_ANCHORS_FILE,
    PROJECT_RENDER_ANCHORS_FILE,
    compileRenderAnchorPack,
    sanitizeRenderAnchorName,
    type RenderAnchorCompiledDefinition,
    type RenderAnchorCompiledPack,
} from "../render-anchors/definitions.js";
import type { BebeAssetCompiler, BebeAssetCompilerArtifact } from "./assets.js";

type JsonRecord = Record<string, unknown>;

type EntitySource = {
    readonly absolutePath: string;
    readonly json: JsonRecord;
};

type ClientGeometryReference =
    | {
          readonly kind: "string";
          readonly references: readonly [
              {
                  readonly alias: "default";
                  readonly identifier: string;
              },
          ];
      }
    | {
          readonly kind: "record";
          readonly original: JsonRecord;
          readonly references: readonly {
              readonly alias: string;
              readonly identifier: string;
          }[];
      };

type GeneratedClientGeometry = {
    readonly descriptionGeometry?: string | JsonRecord;
    readonly bonePairs: readonly GeneratedRenderAnchorBonePair[];
    readonly artifacts: readonly BebeAssetCompilerArtifact[];
};

type GeneratedRenderAnchorBonePair = {
    readonly carrierBone: string;
    readonly contentBone: string;
};

const RENDER_ANCHOR_CARRIER_BONE = "bebe_render_anchor_carrier";
const RENDER_ANCHOR_ROOT_BONE = "bebe_render_anchor_root";
const DEFAULT_RENDER_ANCHOR_VISIBLE_BOUNDS = 256;

export function createRenderAnchorsAssetCompiler(): BebeAssetCompiler {
    return {
        id: "bebe:render-anchors",
        sourcePaths: [PROJECT_RENDER_ANCHORS_FILE],
        outputPath: GENERATED_RENDER_ANCHORS_FILE,
        compile(input) {
            const output = compileRenderAnchorPack(input.sourceJson, {
                source: PROJECT_RENDER_ANCHORS_FILE,
            });
            return {
                output,
                artifacts: createRenderAnchorArtifacts(
                    input.projectRoot,
                    output,
                ),
            };
        },
        renderBootstrap(input) {
            return [
                'import { RenderAnchors } from "@blurengine/bebe";',
                `import __bebeRenderAnchors from ${JSON.stringify(input.outputImportSpecifier)};`,
                "RenderAnchors.load(__bebeRenderAnchors);",
                "RenderAnchors.start();",
            ];
        },
    };
}

export const renderAnchorsAssetCompiler = createRenderAnchorsAssetCompiler();

function createRenderAnchorArtifacts(
    projectRoot: string,
    pack: RenderAnchorCompiledPack,
): readonly BebeAssetCompilerArtifact[] {
    if (
        !fs.existsSync(path.join(projectRoot, "behavior_packs")) &&
        !fs.existsSync(path.join(projectRoot, "resource_packs"))
    ) {
        return [];
    }

    const artifacts: BebeAssetCompilerArtifact[] = [];
    for (const anchor of pack.anchors) {
        const behaviorSource = findBehaviorEntitySource(
            projectRoot,
            anchor.entity,
        );
        const clientSource = findClientEntitySource(projectRoot, anchor.entity);
        if (!clientSource) {
            throw new Error(
                `Missing resource-pack client entity for "${anchor.entity}".`,
            );
        }

        const outputName = anchorOutputName(anchor);
        const generatedGeometry = createRenderAnchorGeometry(
            projectRoot,
            anchor,
            clientSource,
            outputName,
        );
        artifacts.push({
            target: "behaviorPack",
            outputPath: `entities/bebe/${outputName}.json`,
            output: createBehaviorAnchorEntity(anchor, behaviorSource),
        });
        artifacts.push({
            target: "resourcePack",
            outputPath: `entity/bebe/${outputName}.entity.json`,
            output: createClientAnchorEntity(
                anchor,
                clientSource,
                generatedGeometry.descriptionGeometry,
            ),
        });
        artifacts.push(...generatedGeometry.artifacts);
        artifacts.push({
            target: "resourcePack",
            outputPath: `animations/bebe/${outputName}.animation.json`,
            output: createRenderAnchorAnimations(
                anchor,
                generatedGeometry.bonePairs,
            ),
        });
    }

    return artifacts;
}

function createBehaviorAnchorEntity(
    anchor: RenderAnchorCompiledDefinition,
    source: EntitySource | undefined,
): JsonRecord {
    const sourceEntity = source?.json["minecraft:entity"];
    const description =
        isRecord(sourceEntity) && isRecord(sourceEntity.description)
            ? sourceEntity.description
            : {};
    const properties =
        anchor.properties === "auto"
            ? isRecord(description.properties)
                ? { properties: description.properties }
                : {}
            : { properties: anchor.properties };

    return {
        format_version:
            typeof source?.json.format_version === "string"
                ? source.json.format_version
                : "1.21.0",
        "minecraft:entity": {
            description: {
                identifier: anchor.outputEntity,
                is_spawnable: false,
                is_summonable: true,
                ...properties,
            },
            components: {
                "minecraft:collision_box": {
                    width: 0,
                    height: 0,
                },
                "minecraft:physics": {
                    has_gravity: false,
                    has_collision: false,
                    push_towards_closest_space: false,
                },
                "minecraft:pushable": {
                    is_pushable: false,
                    is_pushable_by_piston: false,
                },
                "minecraft:persistent": {},
                "minecraft:conditional_bandwidth_optimization": {
                    default_values: {
                        max_dropped_ticks: 0,
                        max_optimized_distance: 80,
                        use_motion_prediction_hints: true,
                    },
                },
            },
        },
    };
}

function createClientAnchorEntity(
    anchor: RenderAnchorCompiledDefinition,
    source: EntitySource,
    descriptionGeometry: string | JsonRecord | undefined,
): JsonRecord {
    const clientEntity = expectRecord(
        source.json["minecraft:client_entity"],
        `${source.absolutePath}.minecraft:client_entity`,
    );
    const description = expectRecord(
        clientEntity.description,
        `${source.absolutePath}.minecraft:client_entity.description`,
    );
    const scripts = isRecord(description.scripts)
        ? { ...description.scripts }
        : {};
    const animations = isRecord(description.animations)
        ? { ...description.animations }
        : {};
    const animate = normalizeAnimateScripts(scripts.animate);
    const preAnimation = normalizeScriptList(scripts.pre_animation);

    return {
        ...source.json,
        "minecraft:client_entity": {
            ...clientEntity,
            description: {
                ...description,
                identifier: anchor.outputEntity,
                ...(descriptionGeometry === undefined
                    ? {}
                    : { geometry: descriptionGeometry }),
                animations: {
                    ...animations,
                    bebe_always: alwaysAnimationName(anchor),
                    bebe_offset: offsetAnimationName(anchor),
                },
                scripts: {
                    ...scripts,
                    animate: prependUnique(animate, [
                        "bebe_always",
                        "bebe_offset",
                    ]),
                    pre_animation: appendUnique(preAnimation, [
                        "v.bebe_anchor_pos_x=q.position(0);",
                        "v.bebe_anchor_pos_y=q.position(1);",
                        "v.bebe_anchor_pos_z=q.position(2);",
                    ]),
                    should_update_bones_and_effects_offscreen: true,
                },
            },
        },
    };
}

function createRenderAnchorAnimations(
    anchor: RenderAnchorCompiledDefinition,
    bonePairs: readonly GeneratedRenderAnchorBonePair[],
): JsonRecord {
    const pairs =
        bonePairs.length > 0
            ? bonePairs
            : [{ carrierBone: "root", contentBone: "root" }];
    return {
        format_version: "1.8.0",
        animations: {
            [alwaysAnimationName(anchor)]: {
                loop: true,
                bones: createPositionBones(
                    pairs.map((pair) => pair.carrierBone),
                    createAlwaysPosition(),
                ),
            },
            [offsetAnimationName(anchor)]: {
                loop: true,
                bones: createPositionBones(
                    pairs.map((pair) => pair.contentBone),
                    createAbsoluteOffsetPosition(anchor),
                ),
            },
        },
    };
}

function createRenderAnchorGeometry(
    projectRoot: string,
    anchor: RenderAnchorCompiledDefinition,
    source: EntitySource,
    outputName: string,
): GeneratedClientGeometry {
    const geometryReferences = clientEntityGeometryReferences(source);
    if (!geometryReferences) {
        return {
            bonePairs: [{ carrierBone: "root", contentBone: "root" }],
            artifacts: [],
        };
    }

    const root = path.join(projectRoot, "resource_packs");
    const usedIdentifiers = new Set<string>();
    const generatedGeometries: JsonRecord[] = [];
    const generatedReferences = new Map<string, string>();
    const bonePairs: GeneratedRenderAnchorBonePair[] = [];

    for (const reference of geometryReferences.references) {
        const geometry = findGeometryDefinition(root, reference.identifier);
        if (!geometry) {
            throw new Error(
                `Missing resource-pack geometry "${reference.identifier}" referenced by "${source.absolutePath}".`,
            );
        }

        const generatedIdentifier = createGeneratedGeometryIdentifier(
            anchor,
            reference.alias,
            usedIdentifiers,
        );
        const wrapperBones = createUniqueWrapperBoneNames(geometry);
        generatedReferences.set(reference.alias, generatedIdentifier);
        addUniqueBonePair(bonePairs, wrapperBones);
        generatedGeometries.push(
            createWrappedRenderAnchorGeometry(
                geometry,
                generatedIdentifier,
                wrapperBones,
            ),
        );
    }

    return {
        descriptionGeometry: createGeneratedGeometryDescription(
            geometryReferences,
            generatedReferences,
        ),
        bonePairs,
        artifacts: [
            {
                target: "resourcePack",
                outputPath: `models/entity/bebe/${outputName}.geo.json`,
                output: {
                    format_version: "1.12.0",
                    "minecraft:geometry": generatedGeometries,
                },
            },
        ],
    };
}

function createWrappedRenderAnchorGeometry(
    geometry: JsonRecord,
    identifier: string,
    wrapperBones: GeneratedRenderAnchorBonePair,
): JsonRecord {
    const output = cloneJsonRecord(geometry);
    const description = isRecord(output.description)
        ? { ...output.description }
        : {};
    output.description = {
        ...description,
        identifier,
        visible_bounds_width: expandVisibleBound(
            description.visible_bounds_width,
        ),
        visible_bounds_height: expandVisibleBound(
            description.visible_bounds_height,
        ),
        visible_bounds_offset: normalizeVisibleBoundsOffset(
            description.visible_bounds_offset,
        ),
    };

    const bones = Array.isArray(output.bones) ? output.bones : [];
    output.bones = [
        {
            name: wrapperBones.carrierBone,
            pivot: [0, 0, 0],
        },
        {
            name: wrapperBones.contentBone,
            parent: wrapperBones.carrierBone,
            pivot: [0, 0, 0],
        },
        ...bones.map((bone) => parentRootBone(bone, wrapperBones.contentBone)),
    ];

    return output;
}

function parentRootBone(input: unknown, rootBone: string): unknown {
    if (!isRecord(input) || typeof input.name !== "string") {
        return input;
    }
    if (typeof input.parent === "string") {
        return input;
    }
    return {
        ...input,
        parent: rootBone,
    };
}

function createGeneratedGeometryDescription(
    geometryReferences: ClientGeometryReference,
    generatedReferences: ReadonlyMap<string, string>,
): string | JsonRecord {
    if (geometryReferences.kind === "string") {
        return generatedReferences.get("default") ?? "";
    }

    const output = { ...geometryReferences.original };
    for (const reference of geometryReferences.references) {
        const generatedIdentifier = generatedReferences.get(reference.alias);
        if (generatedIdentifier) {
            output[reference.alias] = generatedIdentifier;
        }
    }
    return output;
}

function clientEntityGeometryReferences(
    source: EntitySource,
): ClientGeometryReference | undefined {
    const clientEntity = source.json["minecraft:client_entity"];
    if (!isRecord(clientEntity) || !isRecord(clientEntity.description)) {
        return undefined;
    }

    const geometry = clientEntity.description.geometry;
    if (typeof geometry === "string") {
        return {
            kind: "string",
            references: [{ alias: "default", identifier: geometry }],
        };
    }
    if (!isRecord(geometry)) {
        return undefined;
    }

    const references = Object.entries(geometry)
        .filter(
            (entry): entry is [string, string] => typeof entry[1] === "string",
        )
        .map(([alias, identifier]) => ({ alias, identifier }));
    if (references.length === 0) {
        return undefined;
    }

    return {
        kind: "record",
        original: geometry,
        references,
    };
}

function createGeneratedGeometryIdentifier(
    anchor: RenderAnchorCompiledDefinition,
    alias: string,
    used: Set<string>,
): string {
    const base = `geometry.bebe.render_anchor.${sanitizeRenderAnchorName(anchor.id)}.${sanitizeRenderAnchorName(alias)}`;
    let candidate = base;
    for (let index = 2; used.has(candidate); index++) {
        candidate = `${base}_${index}`;
    }
    used.add(candidate);
    return candidate;
}

function createUniqueWrapperBoneNames(
    geometry: JsonRecord,
): GeneratedRenderAnchorBonePair {
    const used = new Set<string>();
    if (Array.isArray(geometry.bones)) {
        for (const bone of geometry.bones) {
            if (isRecord(bone) && typeof bone.name === "string") {
                used.add(bone.name);
            }
        }
    }

    const carrierBone = createUniqueBoneName(RENDER_ANCHOR_CARRIER_BONE, used);
    used.add(carrierBone);
    const contentBone = createUniqueBoneName(RENDER_ANCHOR_ROOT_BONE, used);
    return { carrierBone, contentBone };
}

function createUniqueBoneName(base: string, used: ReadonlySet<string>): string {
    let candidate = base;
    for (let index = 2; used.has(candidate); index++) {
        candidate = `${base}_${index}`;
    }
    return candidate;
}

function createAlwaysPosition(): readonly [string, string, string] {
    return [
        "-16 * v.bebe_anchor_pos_x",
        "-16 * v.bebe_anchor_pos_y",
        "16 * v.bebe_anchor_pos_z",
    ];
}

function createAbsoluteOffsetPosition(
    anchor: RenderAnchorCompiledDefinition,
): readonly [string, string, string] {
    return [
        scaleMolangNumber(anchor.location.x),
        scaleMolangNumber(anchor.location.y),
        scaleInvertedMolangNumber(anchor.location.z),
    ];
}

function scaleMolangNumber(value: number): string {
    const normalized = Object.is(value, -0) ? 0 : value;
    return `16 * ${formatMolangNumber(normalized)}`;
}

function scaleInvertedMolangNumber(value: number): string {
    const normalized = Object.is(value, -0) ? 0 : value;
    return `-16 * ${formatMolangNumber(normalized)}`;
}

function formatMolangNumber(value: number): string {
    return String(Object.is(value, -0) ? 0 : value);
}

function createPositionBones(
    boneNames: readonly string[],
    position: readonly [number | string, number | string, number | string],
): JsonRecord {
    const output: JsonRecord = {};
    for (const boneName of boneNames.length > 0 ? boneNames : ["root"]) {
        output[boneName] = { position };
    }
    return output;
}

function findBehaviorEntitySource(
    projectRoot: string,
    identifier: string,
): EntitySource | undefined {
    return findEntitySource(
        path.join(projectRoot, "behavior_packs"),
        identifier,
        "minecraft:entity",
    );
}

function findClientEntitySource(
    projectRoot: string,
    identifier: string,
): EntitySource | undefined {
    return findEntitySource(
        path.join(projectRoot, "resource_packs"),
        identifier,
        "minecraft:client_entity",
    );
}

function findGeometryDefinition(
    root: string,
    identifier: string,
): JsonRecord | undefined {
    if (!fs.existsSync(root)) {
        return undefined;
    }

    for (const filePath of walkJsonFiles(root)) {
        const json = readJsonRecord(filePath);
        const geometries = json?.["minecraft:geometry"];
        if (!Array.isArray(geometries)) {
            continue;
        }

        for (const geometry of geometries) {
            if (!isRecord(geometry) || !isRecord(geometry.description)) {
                continue;
            }
            if (geometry.description.identifier === identifier) {
                return geometry;
            }
        }
    }

    return undefined;
}

function findEntitySource(
    root: string,
    identifier: string,
    componentId: "minecraft:entity" | "minecraft:client_entity",
): EntitySource | undefined {
    if (!fs.existsSync(root)) {
        return undefined;
    }

    for (const filePath of walkJsonFiles(root)) {
        const json = readJsonRecord(filePath);
        if (!json) {
            continue;
        }
        const component = json[componentId];
        if (!isRecord(component) || !isRecord(component.description)) {
            continue;
        }
        if (component.description.identifier === identifier) {
            return {
                absolutePath: filePath,
                json,
            };
        }
    }

    return undefined;
}

function* walkJsonFiles(root: string): Iterable<string> {
    for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
        const filePath = path.join(root, entry.name);
        if (entry.isDirectory()) {
            yield* walkJsonFiles(filePath);
            continue;
        }
        if (entry.isFile() && entry.name.endsWith(".json")) {
            yield filePath;
        }
    }
}

function readJsonRecord(filePath: string): JsonRecord | undefined {
    try {
        const parsed = JSON.parse(fs.readFileSync(filePath, "utf8")) as unknown;
        return isRecord(parsed) ? parsed : undefined;
    } catch {
        return undefined;
    }
}

function anchorOutputName(anchor: RenderAnchorCompiledDefinition): string {
    return anchor.outputEntity.slice(anchor.outputEntity.indexOf(":") + 1);
}

function offsetAnimationName(anchor: RenderAnchorCompiledDefinition): string {
    return `animation.bebe.render_anchor.${sanitizeRenderAnchorName(anchor.id)}.offset`;
}

function alwaysAnimationName(anchor: RenderAnchorCompiledDefinition): string {
    return `animation.bebe.render_anchor.${sanitizeRenderAnchorName(anchor.id)}.always`;
}

function normalizeAnimateScripts(input: unknown): string[] {
    if (Array.isArray(input)) {
        return input.filter(
            (value): value is string => typeof value === "string",
        );
    }
    if (typeof input === "string") {
        return [input];
    }
    return [];
}

function normalizeScriptList(input: unknown): string[] {
    if (!Array.isArray(input)) {
        return [];
    }
    return input.filter((value): value is string => typeof value === "string");
}

function appendUnique(
    current: readonly string[],
    additions: readonly string[],
): string[] {
    const output = [...current];
    for (const addition of additions) {
        if (!output.includes(addition)) {
            output.push(addition);
        }
    }
    return output;
}

function addUniqueBonePair(
    output: GeneratedRenderAnchorBonePair[],
    value: GeneratedRenderAnchorBonePair,
): void {
    if (
        output.some(
            (pair) =>
                pair.carrierBone === value.carrierBone &&
                pair.contentBone === value.contentBone,
        )
    ) {
        return;
    }
    output.push(value);
}

function expandVisibleBound(input: unknown): number {
    return typeof input === "number" && Number.isFinite(input)
        ? Math.max(input, DEFAULT_RENDER_ANCHOR_VISIBLE_BOUNDS)
        : DEFAULT_RENDER_ANCHOR_VISIBLE_BOUNDS;
}

function normalizeVisibleBoundsOffset(
    input: unknown,
): readonly [number, number, number] {
    if (
        Array.isArray(input) &&
        input.length === 3 &&
        input.every(
            (value) => typeof value === "number" && Number.isFinite(value),
        )
    ) {
        return input as [number, number, number];
    }
    return [0, 0, 0];
}

function cloneJsonRecord(input: JsonRecord): JsonRecord {
    return JSON.parse(JSON.stringify(input)) as JsonRecord;
}

function prependUnique(
    current: readonly string[],
    additions: readonly string[],
): string[] {
    const additionSet = new Set(additions);
    return [
        ...additions,
        ...current.filter((value) => !additionSet.has(value)),
    ];
}

function expectRecord(input: unknown, source: string): JsonRecord {
    if (!isRecord(input)) {
        throw new Error(`${source} must be an object.`);
    }

    return input;
}

function isRecord(input: unknown): input is JsonRecord {
    return Boolean(input) && typeof input === "object" && !Array.isArray(input);
}
