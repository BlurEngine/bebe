import { describe, expect, it } from "vitest";
import { SpatialIndex } from "../src/internal/spatial-index.js";
import {
    AABB,
    blockExtent,
    boxExtent,
    infiniteExtent,
} from "@blurengine/bebe/maths";

describe("SpatialIndex", () => {
    it("registers extents and queries exact point containment", () => {
        const index = new SpatialIndex<{ label: string }>();
        const unregister = index.register({
            id: "spawn",
            extent: blockExtent([0, 0, 0]),
            value: { label: "Spawn" },
        });

        expect(index.size).toBe(1);
        expect(index.get("spawn")?.value).toEqual({ label: "Spawn" });
        expect(index.queryPoint({ x: 0.5, y: 0.5, z: 0.5 })).toEqual([
            expect.objectContaining({ id: "spawn", value: { label: "Spawn" } }),
        ]);
        expect(index.queryPoint({ x: 1, y: 0.5, z: 0.5 })).toEqual([]);

        unregister();

        expect(index.size).toBe(0);
        expect(index.queryPoint({ x: 0.5, y: 0.5, z: 0.5 })).toEqual([]);
    });

    it("filters coarse AABB bucket candidates through the extent", () => {
        const index = new SpatialIndex({ cellSize: 16 });

        index.register({ id: "near", extent: blockExtent([0, 0, 0]) });
        index.register({
            id: "same-cell-far",
            extent: blockExtent([10, 0, 0]),
        });
        index.register({ id: "other-cell", extent: blockExtent([32, 0, 0]) });

        expect(
            index.queryAABB(new AABB(0, 0, 0, 1, 1, 1)).map((hit) => hit.id),
        ).toEqual(["near"]);
    });

    it("keeps replacement registrations safe from stale unregister functions", () => {
        const index = new SpatialIndex();
        const unregisterFirst = index.register({
            id: "moving-zone",
            extent: blockExtent([0, 0, 0]),
        });
        const unregisterSecond = index.register({
            id: "moving-zone",
            extent: blockExtent([5, 0, 0]),
        });

        unregisterFirst();

        expect(
            index.queryPoint({ x: 5.5, y: 0.5, z: 0.5 }).map((hit) => hit.id),
        ).toEqual(["moving-zone"]);

        unregisterSecond();

        expect(index.has("moving-zone")).toBe(false);
    });

    it("keeps oversized finite extents queryable without indexing every cell", () => {
        const index = new SpatialIndex({ cellSize: 16, maxCellsPerExtent: 1 });

        index.register({
            id: "large",
            extent: boxExtent(new AABB(0, 0, 0, 64, 64, 64)),
        });
        index.register({ id: "world", extent: infiniteExtent() });

        expect(index.stats()).toEqual({
            entries: 2,
            cells: 0,
            indexedEntries: 0,
            scannedEntries: 1,
            unboundedEntries: 1,
            references: 0,
        });
        expect(
            index.queryPoint({ x: 32, y: 32, z: 32 }).map((hit) => hit.id),
        ).toEqual(["large", "world"]);
    });

    it("falls back to all entries when an AABB query spans too many cells", () => {
        const index = new SpatialIndex({ cellSize: 16, maxCellsPerExtent: 1 });

        index.register({ id: "small", extent: blockExtent([32, 0, 0]) });

        expect(
            index.queryAABB(new AABB(0, 0, 0, 64, 1, 1)).map((hit) => hit.id),
        ).toEqual(["small"]);
    });

    it("rejects invalid index sizing options", () => {
        expect(() => new SpatialIndex({ cellSize: 0 })).toThrow(
            "cellSize must be a positive finite number.",
        );
        expect(() => new SpatialIndex({ maxCellsPerExtent: 0 })).toThrow(
            "maxCellsPerExtent must be a positive finite integer.",
        );
    });
});
