import { beforeEach, describe, expect, it } from "vitest";
import { Locations } from "@blurengine/bebe";

describe("Locations", () => {
    beforeEach(() => {
        Locations.clear();
    });

    it("loads one immutable dimension-qualified lookup surface", () => {
        Locations.load({
            version: 1,
            locations: [
                {
                    id: "spawn",
                    dimension: "overworld",
                    location: { x: 1.5, y: 80, z: -3.5 },
                    orientation: { yaw: 22.5, pitch: 0 },
                    lines: ["spawn", "@name", "main"],
                },
                {
                    id: "spawn",
                    dimension: "nether",
                    location: { x: 2.5, y: 64, z: 2.5 },
                },
            ],
        });

        expect(Locations.size).toBe(2);
        expect(Locations.get({ dimension: "overworld", id: "spawn" })).toEqual({
            id: "spawn",
            dimension: "overworld",
            location: { x: 1.5, y: 80, z: -3.5 },
            orientation: { yaw: 22.5, pitch: 0 },
            lines: ["spawn", "@name", "main"],
        });
        expect(Locations.forDimension("nether")).toEqual([
            {
                id: "spawn",
                dimension: "nether",
                location: { x: 2.5, y: 64, z: 2.5 },
            },
        ]);
        expect(Object.isFrozen(Locations.locations())).toBe(true);
    });

    it("does not replace valid locations when a later load is invalid", () => {
        Locations.load({
            version: 1,
            locations: [
                {
                    id: "safe",
                    dimension: "overworld",
                    location: [0.5, 80, 0.5],
                },
            ],
        });

        expect(() =>
            Locations.load({
                version: 1,
                locations: [
                    {
                        id: "broken",
                        dimension: "overworld",
                        location: [Number.NaN, 0, 0],
                    },
                ],
            }),
        ).toThrow();

        expect(
            Locations.get({ dimension: "overworld", id: "safe" }),
        ).toBeDefined();
        expect(
            Locations.get({ dimension: "overworld", id: "broken" }),
        ).toBeUndefined();
    });

    it("serialises the canonical pack without exposing a mutable registry", () => {
        Locations.load({
            version: 1,
            locations: [
                {
                    id: "b",
                    dimension: "overworld",
                    location: [2, 3, 4],
                },
                {
                    id: "a",
                    dimension: "overworld",
                    location: [1, 2, 3],
                },
            ],
        });

        expect(
            Locations.toPack().locations.map((location) => location.id),
        ).toEqual(["a", "b"]);
        const surface = Locations as unknown as Record<string, unknown>;
        expect(surface.start).toBeUndefined();
        expect(surface.register).toBeUndefined();
        expect(surface.context).toBeUndefined();
    });
});
