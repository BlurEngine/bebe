import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
    GENERATED_RENDER_ANCHORS_FILE,
    PROJECT_RENDER_ANCHORS_FILE,
    compileRenderAnchorPack,
    createRenderAnchorsAssetCompiler,
    normalizeRenderAnchorPack,
} from "@blurengine/bebe/tooling/node";

describe("render anchor definitions", () => {
    it("normalizes a minimal existing-entity anchor with convenience defaults", () => {
        expect(
            normalizeRenderAnchorPack({
                anchors: [
                    {
                        id: "harbour.crane",
                        entity: "demo:crane",
                        location: [320, 80, -48],
                    },
                ],
            }),
        ).toEqual({
            anchors: [
                {
                    id: "harbour.crane",
                    entity: "demo:crane",
                    outputEntity: "demo:bebe_render_anchor_harbour_crane",
                    dimension: "minecraft:overworld",
                    location: { x: 320, y: 80, z: -48 },
                    placement: {
                        strategy: "nearestAir",
                        searchRadius: 16,
                        repositionThreshold: 16,
                        driver: "auto",
                    },
                    properties: "auto",
                },
            ],
        });
    });

    it("keeps explicit Minecraft-shaped property definitions", () => {
        expect(
            normalizeRenderAnchorPack({
                anchors: [
                    {
                        id: "harbour.crane",
                        entity: "demo:crane",
                        location: { x: 320, y: 80, z: -48 },
                        properties: {
                            "demo:arm_angle": {
                                type: "float",
                                default: 0,
                            },
                            "demo:cargo_visible": {
                                type: "bool",
                                default: false,
                            },
                        },
                    },
                ],
            }).anchors[0]?.properties,
        ).toEqual({
            "demo:arm_angle": {
                type: "float",
                default: 0,
            },
            "demo:cargo_visible": {
                type: "bool",
                default: false,
            },
        });
    });

    it("rejects duplicate anchor ids", () => {
        expect(() =>
            normalizeRenderAnchorPack({
                anchors: [
                    {
                        id: "harbour.crane",
                        entity: "demo:crane",
                        location: [320, 80, -48],
                    },
                    {
                        id: "harbour.crane",
                        entity: "demo:crane",
                        location: [330, 80, -48],
                    },
                ],
            }),
        ).toThrow('Duplicate render anchor id "harbour.crane".');
    });

    it("rejects duplicate generated output entity identifiers", () => {
        expect(() =>
            normalizeRenderAnchorPack({
                anchors: [
                    {
                        id: "harbour.crane",
                        entity: "demo:crane",
                        outputEntity: "demo:crane_far_view",
                        location: [320, 80, -48],
                    },
                    {
                        id: "harbour.watermill",
                        entity: "demo:watermill",
                        outputEntity: "demo:crane_far_view",
                        location: [330, 80, -48],
                    },
                ],
            }),
        ).toThrow(
            'Duplicate render anchor outputEntity "demo:crane_far_view".',
        );
    });

    it("compiles render anchors for runtime loading", () => {
        expect(
            compileRenderAnchorPack({
                anchors: [
                    {
                        id: "harbour.crane",
                        entity: "demo:crane",
                        location: [320, 80, -48],
                    },
                ],
            }),
        ).toEqual({
            anchors: [
                {
                    id: "harbour.crane",
                    entity: "demo:crane",
                    outputEntity: "demo:bebe_render_anchor_harbour_crane",
                    dimension: "minecraft:overworld",
                    location: { x: 320, y: 80, z: -48 },
                    placement: {
                        strategy: "nearestAir",
                        searchRadius: 16,
                        repositionThreshold: 16,
                        driver: "auto",
                    },
                    properties: "auto",
                },
            ],
        });
    });

    it("exposes a render-anchor asset compiler through tooling", () => {
        const compiler = createRenderAnchorsAssetCompiler();

        expect(compiler.id).toBe("bebe:render-anchors");
        expect(compiler.sourcePaths).toEqual([PROJECT_RENDER_ANCHORS_FILE]);
        expect(compiler.outputPath).toBe(GENERATED_RENDER_ANCHORS_FILE);

        const result = compiler.compile({
            pipeline: "build",
            projectRoot: "/project",
            sourceJson: {
                anchors: [
                    {
                        id: "harbour.crane",
                        entity: "demo:crane",
                        location: [320, 80, -48],
                    },
                ],
            },
            sourcePath: "/project/render-anchors.json",
        });

        expect(result.output).toEqual({
            anchors: [
                expect.objectContaining({
                    id: "harbour.crane",
                    outputEntity: "demo:bebe_render_anchor_harbour_crane",
                }),
            ],
        });
        expect(
            compiler.renderBootstrap?.({
                outputImportSpecifier:
                    "./dist/generated/bebe/render-anchors.json",
                outputPath: GENERATED_RENDER_ANCHORS_FILE,
            }),
        ).toEqual([
            'import { RenderAnchors } from "@blurengine/bebe";',
            'import __bebeRenderAnchors from "./dist/generated/bebe/render-anchors.json";',
            "RenderAnchors.load(__bebeRenderAnchors);",
            "RenderAnchors.start();",
        ]);
    });

    it("generates behavior-pack and resource-pack artifacts from an existing entity", async () => {
        const projectRoot = await mkdtemp(
            path.join(os.tmpdir(), "bebe-render-anchors-"),
        );
        await mkdir(
            path.join(projectRoot, "behavior_packs", "game", "entities"),
            {
                recursive: true,
            },
        );
        await mkdir(
            path.join(projectRoot, "resource_packs", "assets", "entity"),
            {
                recursive: true,
            },
        );
        await mkdir(
            path.join(projectRoot, "resource_packs", "assets", "models"),
            {
                recursive: true,
            },
        );
        await writeFile(
            path.join(
                projectRoot,
                "behavior_packs",
                "game",
                "entities",
                "crane.json",
            ),
            JSON.stringify({
                format_version: "1.21.0",
                "minecraft:entity": {
                    description: {
                        identifier: "demo:crane",
                        properties: {
                            "demo:arm_angle": {
                                type: "float",
                                default: 0,
                            },
                        },
                    },
                    components: {
                        "minecraft:physics": {},
                    },
                },
            }),
            "utf8",
        );
        await writeFile(
            path.join(
                projectRoot,
                "resource_packs",
                "assets",
                "entity",
                "crane.entity.json",
            ),
            JSON.stringify({
                format_version: "1.10.0",
                "minecraft:client_entity": {
                    description: {
                        identifier: "demo:crane",
                        textures: {
                            default: "textures/entity/crane",
                        },
                        geometry: {
                            default: "geometry.demo.crane",
                        },
                        animations: {
                            idle: "animation.demo.crane.idle",
                        },
                        scripts: {
                            animate: ["idle"],
                        },
                        render_controllers: ["controller.render.demo.crane"],
                    },
                },
            }),
            "utf8",
        );
        await writeFile(
            path.join(
                projectRoot,
                "resource_packs",
                "assets",
                "models",
                "crane.geo.json",
            ),
            JSON.stringify({
                format_version: "1.12.0",
                "minecraft:geometry": [
                    {
                        description: {
                            identifier: "geometry.demo.crane",
                        },
                        bones: [
                            {
                                name: "crane_body",
                            },
                            {
                                name: "crane_hook",
                                parent: "crane_body",
                            },
                        ],
                    },
                ],
            }),
            "utf8",
        );

        const result = createRenderAnchorsAssetCompiler().compile({
            pipeline: "build",
            projectRoot,
            sourceJson: {
                anchors: [
                    {
                        id: "harbour.crane",
                        entity: "demo:crane",
                        location: [-320, 80, 48],
                    },
                ],
            },
            sourcePath: path.join(projectRoot, "render-anchors.json"),
        });

        expect(result.artifacts).toEqual([
            {
                target: "behaviorPack",
                outputPath:
                    "entities/bebe/bebe_render_anchor_harbour_crane.json",
                output: expect.objectContaining({
                    "minecraft:entity": expect.objectContaining({
                        description: expect.objectContaining({
                            identifier: "demo:bebe_render_anchor_harbour_crane",
                            is_spawnable: false,
                            is_summonable: true,
                            properties: {
                                "demo:arm_angle": {
                                    type: "float",
                                    default: 0,
                                },
                            },
                        }),
                        components: expect.objectContaining({
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
                        }),
                    }),
                }),
            },
            {
                target: "resourcePack",
                outputPath:
                    "entity/bebe/bebe_render_anchor_harbour_crane.entity.json",
                output: expect.objectContaining({
                    "minecraft:client_entity": {
                        description: expect.objectContaining({
                            identifier: "demo:bebe_render_anchor_harbour_crane",
                            geometry: {
                                default:
                                    "geometry.bebe.render_anchor.harbour_crane.default",
                            },
                            textures: {
                                default: "textures/entity/crane",
                            },
                            animations: expect.objectContaining({
                                idle: "animation.demo.crane.idle",
                                bebe_always:
                                    "animation.bebe.render_anchor.harbour_crane.always",
                                bebe_offset:
                                    "animation.bebe.render_anchor.harbour_crane.offset",
                            }),
                            scripts: expect.objectContaining({
                                animate: ["bebe_always", "bebe_offset", "idle"],
                                should_update_bones_and_effects_offscreen: true,
                            }),
                        }),
                    },
                }),
            },
            {
                target: "resourcePack",
                outputPath:
                    "models/entity/bebe/bebe_render_anchor_harbour_crane.geo.json",
                output: {
                    format_version: "1.12.0",
                    "minecraft:geometry": [
                        {
                            description: {
                                identifier:
                                    "geometry.bebe.render_anchor.harbour_crane.default",
                                visible_bounds_width: 256,
                                visible_bounds_height: 256,
                                visible_bounds_offset: [0, 0, 0],
                            },
                            bones: [
                                {
                                    name: "bebe_render_anchor_carrier",
                                    pivot: [0, 0, 0],
                                },
                                {
                                    name: "bebe_render_anchor_root",
                                    parent: "bebe_render_anchor_carrier",
                                    pivot: [0, 0, 0],
                                },
                                {
                                    name: "crane_body",
                                    parent: "bebe_render_anchor_root",
                                },
                                {
                                    name: "crane_hook",
                                    parent: "crane_body",
                                },
                            ],
                        },
                    ],
                },
            },
            {
                target: "resourcePack",
                outputPath:
                    "animations/bebe/bebe_render_anchor_harbour_crane.animation.json",
                output: {
                    format_version: "1.8.0",
                    animations: {
                        "animation.bebe.render_anchor.harbour_crane.always": {
                            loop: true,
                            bones: {
                                bebe_render_anchor_carrier: {
                                    position: [
                                        "-16 * v.bebe_anchor_pos_x",
                                        "-16 * v.bebe_anchor_pos_y",
                                        "16 * v.bebe_anchor_pos_z",
                                    ],
                                },
                            },
                        },
                        "animation.bebe.render_anchor.harbour_crane.offset": {
                            loop: true,
                            bones: {
                                bebe_render_anchor_root: {
                                    position: [
                                        "16 * -320",
                                        "16 * 80",
                                        "-16 * 48",
                                    ],
                                },
                            },
                        },
                    },
                },
            },
        ]);
    });
});
