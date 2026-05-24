import { beforeEach, describe, expect, it, vi } from "vitest";
import { Zones } from "@blurengine/bebe";
import { AABB, blockExtent, boxExtent } from "@blurengine/bebe/maths";
import { Dimension, Entity, minecraftMockControl } from "@minecraft/server";

describe("Zones", () => {
    beforeEach(() => {
        minecraftMockControl.reset();
        Zones.clear();
    });

    it("registers zones through one singleton surface", () => {
        const unregister = Zones.register({
            id: "spawn",
            dimension: "overworld",
            extent: blockExtent([0, 64, 0]),
        });

        expect(Zones.size).toBe(1);
        expect(
            Zones.queryPoint({
                dimension: "overworld",
                point: { x: 0.5, y: 64.5, z: 0.5 },
            }),
        ).toEqual([
            expect.objectContaining({
                id: "spawn",
                dimension: "overworld",
            }),
        ]);

        unregister();

        expect(Zones.size).toBe(0);
    });

    it("keeps dimensions partitioned in the singleton registry", () => {
        Zones.register({
            id: "spawn",
            dimension: "overworld",
            extent: blockExtent([0, 64, 0]),
        });
        Zones.register({
            id: "spawn",
            dimension: "nether",
            extent: blockExtent([0, 64, 0]),
        });

        expect(
            Zones.queryPoint({
                dimension: "overworld",
                point: { x: 0.5, y: 64.5, z: 0.5 },
            }).map((hit) => hit.dimension),
        ).toEqual(["overworld"]);
        expect(
            Zones.queryAABB({
                dimension: "nether",
                box: new AABB(0, 64, 0, 1, 65, 1),
            }).map((hit) => hit.dimension),
        ).toEqual(["nether"]);
    });

    it("reports point membership as a stable snapshot", () => {
        Zones.register({
            id: "spawn",
            dimension: "overworld",
            extent: blockExtent([0, 64, 0]),
        });
        Zones.register({
            id: "market",
            dimension: "overworld",
            extent: boxExtent(new AABB(0, 64, 0, 10, 70, 10)),
        });

        const membership = Zones.membership({
            dimension: "overworld",
            point: { x: 0.5, y: 64.5, z: 0.5 },
        });

        expect(membership.dimension).toBe("overworld");
        expect(membership.ids).toEqual(["spawn", "market"]);
        expect(membership.zones.map((zone) => zone.id)).toEqual([
            "spawn",
            "market",
        ]);
        expect(membership.has("spawn")).toBe(true);
        expect(membership.has("arena")).toBe(false);
    });

    it("checks whether one zone contains a point", () => {
        Zones.register({
            id: "spawn",
            dimension: "overworld",
            extent: blockExtent([0, 64, 0]),
        });

        expect(
            Zones.contains({
                id: "spawn",
                dimension: "overworld",
                point: { x: 0.5, y: 64.5, z: 0.5 },
            }),
        ).toBe(true);
        expect(
            Zones.contains({
                id: "spawn",
                dimension: "overworld",
                point: { x: 1, y: 64.5, z: 0.5 },
            }),
        ).toBe(false);
        expect(
            Zones.contains({
                id: "spawn",
                dimension: "nether",
                point: { x: 0.5, y: 64.5, z: 0.5 },
            }),
        ).toBe(false);
    });

    it("keeps replacement unregister functions from removing newer zones", () => {
        const unregisterFirst = Zones.register({
            id: "moving",
            dimension: "overworld",
            extent: blockExtent([0, 64, 0]),
        });
        const unregisterSecond = Zones.register({
            id: "moving",
            dimension: "overworld",
            extent: blockExtent([5, 64, 0]),
        });

        unregisterFirst();

        expect(
            Zones.queryPoint({
                dimension: "overworld",
                point: { x: 5.5, y: 64.5, z: 0.5 },
            }).map((hit) => hit.id),
        ).toEqual(["moving"]);

        unregisterSecond();

        expect(
            Zones.queryPoint({
                dimension: "overworld",
                point: { x: 5.5, y: 64.5, z: 0.5 },
            }),
        ).toEqual([]);
    });

    it("does not expose mutable context ownership", () => {
        const surface = Zones as unknown as Record<string, unknown>;

        expect(surface.configure).toBeUndefined();
        expect(surface.context).toBeUndefined();
    });

    it("does not expose dimension facades", () => {
        const surface = Zones as unknown as Record<string, unknown>;

        expect(surface.dimension).toBeUndefined();
    });

    it("uses the same point query shape for coordinates and entities", () => {
        const dimension = new Dimension("minecraft:overworld");
        const entity = new Entity({
            dimension,
            id: "entity-1",
            location: { x: 0.5, y: 64.5, z: 0.5 },
            typeId: "minecraft:zombie",
        });
        const removeSpawn = Zones.register({
            id: "spawn",
            dimension,
            extent: blockExtent([0, 64, 0]),
        });

        expect(
            Zones.contains({
                id: "spawn",
                point: entity,
            }),
        ).toBe(true);
        expect(Zones.queryPoint(entity).map((zone) => zone.id)).toEqual([
            "spawn",
        ]);
        expect(
            Zones.membership({
                point: entity,
            }),
        ).toEqual(
            expect.objectContaining({
                dimension: "minecraft:overworld",
                ids: ["spawn"],
                zones: [
                    expect.objectContaining({
                        id: "spawn",
                    }),
                ],
            }),
        );

        removeSpawn();

        expect(Zones.get({ id: "spawn", dimension })).toBeUndefined();
    });

    it("returns a source-style zone pack for the current registry", () => {
        Zones.register({
            id: "spawn",
            dimension: "overworld",
            extent: {
                kind: "block",
                block: [1, 2, 3],
            },
        });

        expect(Zones.toPack()).toEqual({
            zones: [
                {
                    id: "spawn",
                    dimension: "overworld",
                    extent: {
                        kind: "block",
                        block: { x: 1, y: 2, z: 3 },
                    },
                },
            ],
        });
    });

    it("does not include compiled metadata in runtime snapshots", () => {
        Zones.load({
            zones: [
                {
                    id: "market",
                    dimension: "overworld",
                    extent: {
                        kind: "box",
                        min: [0, 60, 0],
                        max: [4, 65, 4],
                    },
                },
            ],
            compiled: {
                version: 1,
                cellSize: 16,
                maxCellsPerZone: 4096,
                dimensions: {
                    overworld: {
                        cells: {
                            "0,3,0": ["market"],
                        },
                        scanned: [],
                    },
                },
            },
        });

        expect(Zones.toPack()).toEqual({
            zones: [
                {
                    id: "market",
                    dimension: "overworld",
                    extent: {
                        kind: "box",
                        min: { x: 0, y: 60, z: 0 },
                        max: { x: 4, y: 65, z: 4 },
                    },
                },
            ],
        });
    });

    it("preserves pack scope in runtime snapshots", () => {
        Zones.load({
            scope: {
                world: "creative-world",
            },
            zones: [
                {
                    id: "spawn",
                    dimension: "overworld",
                    extent: {
                        kind: "block",
                        block: [0, 64, 0],
                    },
                },
            ],
        });

        expect(Zones.toPack()).toEqual({
            scope: {
                world: "creative-world",
            },
            zones: [
                {
                    id: "spawn",
                    dimension: "overworld",
                    extent: {
                        kind: "block",
                        block: { x: 0, y: 64, z: 0 },
                    },
                },
            ],
        });
    });

    it("accepts dimension-like objects in the root registration shape", () => {
        const dimension = new Dimension("minecraft:nether");

        Zones.register({
            id: "fortress",
            dimension,
            extent: blockExtent([0, 64, 0]),
        });

        expect(
            Zones.queryPoint({
                dimension: "minecraft:nether",
                point: { x: 0.5, y: 64.5, z: 0.5 },
            }).map((zone) => zone.id),
        ).toEqual(["fortress"]);
    });

    it("registers JSON-shaped polygon extent definitions", () => {
        Zones.register({
            id: "yard",
            dimension: "minecraft:overworld",
            extent: {
                kind: "polygon",
                points: [
                    [0, 0],
                    [4, 0],
                    [4, 4],
                    [0, 4],
                ],
                y: { min: 60, max: 70 },
            },
        });

        expect(
            Zones.contains({
                id: "yard",
                dimension: "minecraft:overworld",
                point: { x: 2, y: 65, z: 2 },
            }),
        ).toBe(true);
        expect(
            Zones.contains({
                id: "yard",
                dimension: "minecraft:overworld",
                point: { x: 6, y: 65, z: 2 },
            }),
        ).toBe(false);
    });

    it("loads JSON-shaped infinite extents for whole-dimension zones", () => {
        Zones.load({
            zones: [
                {
                    id: "world",
                    dimension: "minecraft:overworld",
                    extent: { kind: "infinite" },
                },
            ],
        });

        expect(
            Zones.contains({
                id: "world",
                dimension: "minecraft:overworld",
                point: { x: 1_000_000, y: -64, z: -1_000_000 },
            }),
        ).toBe(true);
    });

    it("falls back safely when baked compiled metadata is stale", () => {
        Zones.load({
            zones: [
                {
                    id: "spawn",
                    dimension: "minecraft:overworld",
                    extent: { kind: "block", block: [0, 64, 0] },
                },
            ],
            compiled: {
                version: 1,
                cellSize: 16,
                maxCellsPerZone: 4096,
                dimensions: {
                    "minecraft:overworld": {
                        cells: {},
                        scanned: [],
                    },
                },
            },
        });

        expect(
            Zones.queryPoint({
                dimension: "minecraft:overworld",
                point: { x: 0.5, y: 64.5, z: 0.5 },
            }).map((zone) => zone.id),
        ).toEqual(["spawn"]);
    });

    it("invalidates baked lookup metadata when zones change dynamically", () => {
        Zones.load({
            zones: [
                {
                    id: "spawn",
                    dimension: "minecraft:overworld",
                    extent: { kind: "block", block: [0, 64, 0] },
                },
            ],
            compiled: {
                version: 1,
                cellSize: 16,
                maxCellsPerZone: 4096,
                dimensions: {
                    "minecraft:overworld": {
                        cells: {
                            "0,4,0": ["spawn"],
                        },
                        scanned: [],
                    },
                },
            },
        });

        Zones.register({
            id: "dynamic",
            dimension: "minecraft:overworld",
            extent: blockExtent([10, 64, 0]),
        });

        expect(
            Zones.queryPoint({
                dimension: "minecraft:overworld",
                point: { x: 10.5, y: 64.5, z: 0.5 },
            }).map((zone) => zone.id),
        ).toEqual(["dynamic"]);
    });

    it("loads zone packs by replacing active zone definitions only", () => {
        const enter = vi.fn();
        const entity = new Entity({
            dimension: new Dimension("minecraft:overworld"),
            id: "entity-1",
            location: { x: 10.5, y: 64.5, z: 0.5 },
            typeId: "minecraft:zombie",
        });

        Zones.register({
            id: "dynamic",
            dimension: "minecraft:overworld",
            extent: blockExtent([99, 64, 0]),
        });
        Zones.onEnter({ id: "spawn", dimension: "minecraft:overworld" }, enter);
        Zones.load({
            zones: [
                {
                    id: "spawn",
                    dimension: "minecraft:overworld",
                    extent: { kind: "block", block: [0, 64, 0] },
                },
            ],
        });

        expect(
            Zones.get({ id: "dynamic", dimension: "minecraft:overworld" }),
        ).toBeUndefined();
        expect(
            Zones.contains({
                id: "spawn",
                dimension: "minecraft:overworld",
                point: [0.5, 64.5, 0.5],
            }),
        ).toBe(true);

        Zones.watch(entity);
        Zones.load({
            zones: [
                {
                    id: "spawn",
                    dimension: "minecraft:overworld",
                    extent: { kind: "block", block: [10, 64, 0] },
                },
            ],
        });
        minecraftMockControl.advance();

        expect(enter).toHaveBeenCalledWith(
            expect.objectContaining({
                entity,
                id: "spawn",
                reason: "zone-change",
            }),
        );
    });

    it("watches entities globally while listeners stay dimension scoped", () => {
        const enterOverworld = vi.fn();
        const leaveOverworld = vi.fn();
        const enterNether = vi.fn();
        const entity = new Entity({
            dimension: new Dimension("minecraft:overworld"),
            id: "entity-1",
            location: { x: 0.5, y: 64.5, z: 0.5 },
            typeId: "minecraft:zombie",
        });

        Zones.register({
            id: "spawn",
            dimension: "minecraft:overworld",
            extent: boxExtent(new AABB(0, 64, 0, 2, 66, 2)),
        });
        Zones.register({
            id: "spawn",
            dimension: "minecraft:nether",
            extent: boxExtent(new AABB(0, 64, 0, 2, 66, 2)),
        });
        Zones.onEnter(
            { id: "spawn", dimension: "minecraft:overworld" },
            enterOverworld,
        );
        Zones.onLeave(
            { id: "spawn", dimension: "minecraft:overworld" },
            leaveOverworld,
        );
        Zones.onEnter(
            { id: "spawn", dimension: "minecraft:nether" },
            enterNether,
        );

        Zones.watch(entity);

        expect(enterOverworld).toHaveBeenCalledWith(
            expect.objectContaining({
                entity,
                id: "spawn",
                dimension: "minecraft:overworld",
            }),
        );
        expect(enterNether).not.toHaveBeenCalled();

        entity.dimension = new Dimension("minecraft:nether");
        minecraftMockControl.advance();

        expect(leaveOverworld).toHaveBeenCalledWith(
            expect.objectContaining({
                entity,
                id: "spawn",
                dimension: "minecraft:overworld",
            }),
        );
        expect(enterNether).toHaveBeenCalledWith(
            expect.objectContaining({
                entity,
                id: "spawn",
                dimension: "minecraft:nether",
            }),
        );
    });

    it("skips unchanged watched entities and cleans up invalid ones", () => {
        const enter = vi.fn();
        const stay = vi.fn();
        const leave = vi.fn();
        const entity = new Entity({
            dimension: new Dimension("minecraft:overworld"),
            id: "entity-1",
            location: { x: 0.5, y: 64.5, z: 0.5 },
            typeId: "minecraft:zombie",
        });

        Zones.register({
            id: "spawn",
            dimension: "minecraft:overworld",
            extent: boxExtent(new AABB(0, 64, 0, 2, 66, 2)),
        });
        Zones.onEnter({ id: "spawn", dimension: "minecraft:overworld" }, enter);
        Zones.onStay({ id: "spawn", dimension: "minecraft:overworld" }, stay);
        Zones.onLeave({ id: "spawn", dimension: "minecraft:overworld" }, leave);

        Zones.watch(entity);
        minecraftMockControl.advance();

        expect(enter).toHaveBeenCalledTimes(1);
        expect(stay).not.toHaveBeenCalled();

        entity.location = { x: 1.5, y: 64.5, z: 0.5 };
        minecraftMockControl.advance();

        expect(stay).toHaveBeenCalledWith(
            expect.objectContaining({
                entity,
                id: "spawn",
                dimension: "minecraft:overworld",
            }),
        );

        entity.isValid = false;
        minecraftMockControl.advance();
        minecraftMockControl.advance();

        expect(leave).toHaveBeenCalledTimes(1);
        expect(Zones.unwatch(entity)).toBe(false);
    });
});
