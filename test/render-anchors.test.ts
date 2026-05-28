import { beforeEach, describe, expect, it } from "vitest";
import { Context } from "@blurengine/bebe";
import { RenderAnchors } from "@blurengine/bebe";
import { Dimension, minecraftMockControl } from "@minecraft/server";

class TestRenderAnchorEntity {
    readonly properties = new Map<string, boolean | number | string>();
    readonly teleports: Array<{
        readonly location: {
            readonly x: number;
            readonly y: number;
            readonly z: number;
        };
        readonly options?: { readonly keepVelocity?: boolean };
    }> = [];
    isValid = true;
    location = { x: 0, y: 0, z: 0 };

    constructor(readonly typeId = "demo:bebe_render_anchor_harbour_crane") {}

    remove(): void {
        this.isValid = false;
    }

    setProperty(identifier: string, value: boolean | number | string): void {
        this.properties.set(identifier, value);
    }

    teleport(
        location: {
            readonly x: number;
            readonly y: number;
            readonly z: number;
        },
        options?: { readonly keepVelocity?: boolean },
    ): void {
        this.location = location;
        this.teleports.push({ location, options });
    }
}

type TestRenderAnchorBlock = {
    readonly isAir: boolean;
};

class TestRenderAnchorDimension {
    readonly id: string;
    readonly blocks = new Map<string, TestRenderAnchorBlock>();
    readonly entities: TestRenderAnchorEntity[] = [];

    constructor(id = "minecraft:overworld") {
        this.id = id;
    }

    getBlock(location: {
        x: number;
        y: number;
        z: number;
    }): TestRenderAnchorBlock | undefined {
        return this.blocks.get(
            `${Math.floor(location.x)},${Math.floor(location.y)},${Math.floor(location.z)}`,
        );
    }

    setBlock(
        location: { x: number; y: number; z: number },
        block: TestRenderAnchorBlock,
    ): void {
        this.blocks.set(
            `${Math.floor(location.x)},${Math.floor(location.y)},${Math.floor(location.z)}`,
            block,
        );
    }

    getEntities(query: {
        readonly type?: string;
    }): Iterable<TestRenderAnchorEntity> {
        return this.entities.filter(
            (entity) => !query.type || entity.typeId === query.type,
        );
    }

    spawnEntity(
        identifier: string,
        location: { x: number; y: number; z: number },
    ): TestRenderAnchorEntity {
        const entity = new TestRenderAnchorEntity(identifier);
        entity.location = location;
        this.entities.push(entity);
        return entity;
    }
}

describe("RenderAnchors", () => {
    beforeEach(() => {
        RenderAnchors.clear();
        minecraftMockControl.reset();
    });

    it("broadcasts state patches to every tracked instance for an anchor", () => {
        RenderAnchors.load({
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
        const first = new TestRenderAnchorEntity();
        const second = new TestRenderAnchorEntity();

        const untrackFirst = RenderAnchors.trackInstance("harbour.crane", {
            entity: first,
            observerId: "player-1",
        });
        RenderAnchors.trackInstance("harbour.crane", {
            entity: second,
            observerId: "player-2",
        });

        RenderAnchors.setState("harbour.crane", {
            "demo:arm_angle": 32,
            "demo:cargo_visible": true,
        });

        expect(first.properties.get("demo:arm_angle")).toBe(32);
        expect(second.properties.get("demo:arm_angle")).toBe(32);
        expect(RenderAnchors.getState("harbour.crane")).toEqual({
            "demo:arm_angle": 32,
            "demo:cargo_visible": true,
        });

        expect(untrackFirst()).toBe(true);
        RenderAnchors.setState("harbour.crane", {
            "demo:arm_angle": 45,
        });

        expect(first.properties.get("demo:arm_angle")).toBe(32);
        expect(second.properties.get("demo:arm_angle")).toBe(45);
    });

    it("applies the latest state snapshot to instances tracked after a patch", () => {
        RenderAnchors.load({
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

        RenderAnchors.setState("harbour.crane", {
            "demo:arm_angle": 32,
        });
        const entity = new TestRenderAnchorEntity();
        RenderAnchors.trackInstance("harbour.crane", {
            entity,
            observerId: "player-1",
        });

        expect(entity.properties.get("demo:arm_angle")).toBe(32);
    });

    it("owns a shared observer loop when started with a runtime driver", () => {
        const ctx = new Context();
        const dimension = new Dimension("minecraft:overworld");
        const spawned: TestRenderAnchorEntity[] = [];
        const moved: Array<{ x: number; y: number; z: number }> = [];
        let observerLocation = { x: 0, y: 64, z: 0 };

        RenderAnchors.load({
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

        RenderAnchors.start({
            context: ctx,
            getObservers: () => [
                {
                    id: "player-1",
                    dimension,
                    location: observerLocation,
                },
            ],
            spawnEntity: () => {
                const entity = new TestRenderAnchorEntity();
                spawned.push(entity);
                return entity;
            },
            moveEntity({ entity, location }) {
                entity.location = location;
                moved.push(location);
            },
        });
        minecraftMockControl.advance();

        expect(spawned).toHaveLength(1);
        RenderAnchors.setState("harbour.crane", {
            "demo:arm_angle": 32,
        });
        expect(spawned[0]?.properties.get("demo:arm_angle")).toBe(32);

        observerLocation = { x: 20, y: 64, z: 0 };
        minecraftMockControl.advance();

        expect(spawned).toHaveLength(1);
        expect(moved.at(-1)).toEqual(observerLocation);

        ctx.dispose();
        expect(spawned[0]?.isValid).toBe(false);
    });

    it("removes stale generated carriers before spawning replacements", () => {
        const ctx = new Context();
        const dimension = new TestRenderAnchorDimension();
        const staleCarrier = new TestRenderAnchorEntity(
            "demo:bebe_render_anchor_harbour_crane",
        );
        const unrelatedEntity = new TestRenderAnchorEntity("demo:other");
        dimension.entities.push(staleCarrier, unrelatedEntity);

        RenderAnchors.load({
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

        RenderAnchors.start({
            context: ctx,
            getObservers: () => [
                {
                    id: "player-1",
                    dimension,
                    location: { x: 0, y: 64, z: 0 },
                },
            ],
        });

        minecraftMockControl.advance();

        expect(staleCarrier.isValid).toBe(false);
        expect(unrelatedEntity.isValid).toBe(true);
        expect(
            dimension.entities.filter(
                (entity) =>
                    entity.typeId === "demo:bebe_render_anchor_harbour_crane" &&
                    entity.isValid,
            ),
        ).toHaveLength(1);
    });

    it("lets custom drivers provide stale carriers for startup cleanup", () => {
        const ctx = new Context();
        const staleCarrier = new TestRenderAnchorEntity(
            "demo:bebe_render_anchor_harbour_crane",
        );

        RenderAnchors.load({
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

        RenderAnchors.start({
            context: ctx,
            getObservers: () => [
                {
                    id: "player-1",
                    dimension: "minecraft:overworld",
                    location: { x: 0, y: 64, z: 0 },
                },
            ],
            getExistingCarriers: ({ anchor }) =>
                anchor.id === "harbour.crane" ? [staleCarrier] : [],
        });
        minecraftMockControl.advance();

        expect(staleCarrier.isValid).toBe(false);
    });

    it("can leave existing carriers untouched when startup cleanup is disabled", () => {
        const ctx = new Context();
        const dimension = new TestRenderAnchorDimension();
        const existingCarrier = new TestRenderAnchorEntity(
            "demo:bebe_render_anchor_harbour_crane",
        );
        dimension.entities.push(existingCarrier);

        RenderAnchors.load({
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

        RenderAnchors.start({
            context: ctx,
            cleanupExistingCarriers: false,
            getObservers: () => [
                {
                    id: "player-1",
                    dimension,
                    location: { x: 0, y: 64, z: 0 },
                },
            ],
        });
        minecraftMockControl.advance();

        expect(existingCarrier.isValid).toBe(true);
    });

    it("places runtime-owned carriers in nearby air when the dimension can be read", () => {
        const ctx = new Context();
        const dimension = new TestRenderAnchorDimension();
        const spawnedAt: Array<{ x: number; y: number; z: number }> = [];
        dimension.setBlock({ x: 0, y: 64, z: 0 }, { isAir: false });
        dimension.setBlock({ x: 1, y: 64, z: 0 }, { isAir: true });

        RenderAnchors.load({
            anchors: [
                {
                    id: "harbour.crane",
                    entity: "demo:crane",
                    outputEntity: "demo:bebe_render_anchor_harbour_crane",
                    dimension: "minecraft:overworld",
                    location: { x: 320, y: 80, z: -48 },
                    placement: {
                        strategy: "nearestAir",
                        searchRadius: 2,
                        repositionThreshold: 1,
                        driver: "auto",
                    },
                    properties: "auto",
                },
            ],
        });

        RenderAnchors.start({
            context: ctx,
            getObservers: () => [
                {
                    id: "player-1",
                    dimension,
                    location: { x: 0.2, y: 64, z: 0.2 },
                },
            ],
            spawnEntity: ({ location }) => {
                spawnedAt.push(location);
                return new TestRenderAnchorEntity();
            },
        });
        minecraftMockControl.advance();

        expect(spawnedAt).toEqual([{ x: 1.5, y: 64, z: 0.5 }]);
    });

    it("clears carrier velocity when teleporting runtime-owned carriers", () => {
        const ctx = new Context();
        const dimension = new TestRenderAnchorDimension();
        let observerLocation = { x: 0, y: 64, z: 0 };

        RenderAnchors.load({
            anchors: [
                {
                    id: "harbour.crane",
                    entity: "demo:crane",
                    outputEntity: "demo:bebe_render_anchor_harbour_crane",
                    dimension: "minecraft:overworld",
                    location: { x: 320, y: 80, z: -48 },
                    placement: {
                        strategy: "nearestAir",
                        searchRadius: 0.1,
                        repositionThreshold: 1,
                        driver: "auto",
                    },
                    properties: "auto",
                },
            ],
        });

        RenderAnchors.start({
            context: ctx,
            getObservers: () => [
                {
                    id: "player-1",
                    dimension,
                    location: observerLocation,
                },
            ],
        });
        minecraftMockControl.advance();

        observerLocation = { x: 2, y: 64, z: 0 };
        minecraftMockControl.advance();

        expect(dimension.entities[0]?.teleports).toEqual([
            {
                location: { x: 2, y: 64, z: 0 },
                options: { keepVelocity: false },
            },
        ]);
    });

    it("keeps fractional nearest-air search distances independent", () => {
        const dimension = new TestRenderAnchorDimension();
        dimension.setBlock({ x: 0, y: 64, z: 0 }, { isAir: false });
        dimension.setBlock({ x: 1, y: 64, z: 1 }, { isAir: true });

        function startWithSearchRadius(searchRadius: number) {
            const ctx = new Context();
            const spawnedAt: Array<{ x: number; y: number; z: number }> = [];
            RenderAnchors.load({
                anchors: [
                    {
                        id: "harbour.crane",
                        entity: "demo:crane",
                        outputEntity: "demo:bebe_render_anchor_harbour_crane",
                        dimension: "minecraft:overworld",
                        location: { x: 320, y: 80, z: -48 },
                        placement: {
                            strategy: "nearestAir",
                            searchRadius,
                            repositionThreshold: 1,
                            driver: "auto",
                        },
                        properties: "auto",
                    },
                ],
            });
            RenderAnchors.start({
                context: ctx,
                getObservers: () => [
                    {
                        id: "player-1",
                        dimension,
                        location: { x: 0.2, y: 64, z: 0.2 },
                    },
                ],
                spawnEntity: ({ location }) => {
                    spawnedAt.push(location);
                    return new TestRenderAnchorEntity();
                },
            });
            minecraftMockControl.advance();
            ctx.dispose();
            return spawnedAt;
        }

        expect(startWithSearchRadius(1.1)).toEqual([{ x: 0.2, y: 64, z: 0.2 }]);
        expect(startWithSearchRadius(1.5)).toEqual([{ x: 1.5, y: 64, z: 1.5 }]);
    });

    it("lets a later start replace the default runtime driver", () => {
        const firstContext = new Context();
        const secondContext = new Context();
        const dimension = new Dimension("minecraft:overworld");
        const defaultEntity = new TestRenderAnchorEntity();
        const customEntity = new TestRenderAnchorEntity();
        const spawned: string[] = [];

        RenderAnchors.load({
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

        RenderAnchors.start({
            context: firstContext,
            getObservers: () => [
                {
                    id: "player-1",
                    dimension,
                    location: { x: 0, y: 64, z: 0 },
                },
            ],
            spawnEntity: () => {
                spawned.push("default");
                return defaultEntity;
            },
        });
        minecraftMockControl.advance();

        RenderAnchors.start({
            context: secondContext,
            getObservers: () => [
                {
                    id: "player-1",
                    dimension,
                    location: { x: 0, y: 64, z: 0 },
                },
            ],
            spawnEntity: () => {
                spawned.push("custom");
                return customEntity;
            },
        });
        minecraftMockControl.advance();

        expect(spawned).toEqual(["default", "custom"]);
        expect(defaultEntity.isValid).toBe(false);
        expect(customEntity.isValid).toBe(true);
    });

    it("does not remove externally tracked entities when the registry is cleared", () => {
        RenderAnchors.load({
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
        const entity = new TestRenderAnchorEntity();

        RenderAnchors.trackInstance("harbour.crane", {
            entity,
            observerId: "player-1",
        });
        RenderAnchors.clear();

        expect(entity.isValid).toBe(true);
    });

    it("throws when setting state for an unknown anchor", () => {
        expect(() =>
            RenderAnchors.setState("missing.anchor", {
                "demo:arm_angle": 32,
            }),
        ).toThrow('Unknown render anchor "missing.anchor".');
    });
});
