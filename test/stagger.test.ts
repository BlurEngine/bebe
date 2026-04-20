import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
    Context,
    stagger,
    staggerByGroup,
    staggerGroups,
} from "@blurengine/bebe";
import {
    minecraftMockControl,
    system,
} from "./support/minecraft-server.mock.js";

beforeEach(() => {
    minecraftMockControl.reset();
});

afterEach(() => {
    minecraftMockControl.reset();
});

describe("stagger", () => {
    it("batches ordered items over time", () => {
        const ctx = new Context();
        const calls: Array<{
            item: number;
            tick: number;
        }> = [];

        stagger(ctx, {
            batchSize: 2,
            items: [3, 1, 2],
            order(items) {
                return [...items].sort((left, right) => left - right);
            },
            run(item) {
                calls.push({ item, tick: system.currentTick });
            },
            ticksBetweenBatches: 1,
        });

        minecraftMockControl.advance(1);
        expect(calls).toEqual([
            { item: 1, tick: 1 },
            { item: 2, tick: 1 },
        ]);

        minecraftMockControl.advance(1);
        expect(calls).toEqual([
            { item: 1, tick: 1 },
            { item: 2, tick: 1 },
            { item: 3, tick: 2 },
        ]);

        ctx.dispose();
    });

    it("preserves group spacing and calls onComplete once", () => {
        const ctx = new Context();
        const calls: Array<{ item: string; tick: number }> = [];
        const completed = vi.fn();

        staggerGroups(ctx, {
            batchSize: 1,
            groups: [["a", "b"], ["c"]],
            onComplete: completed,
            run(item) {
                calls.push({ item, tick: system.currentTick });
            },
            ticksBetweenBatches: 1,
            ticksBetweenGroups: 2,
        });

        minecraftMockControl.advance(1);
        minecraftMockControl.advance(1);
        minecraftMockControl.advance(1);
        minecraftMockControl.advance(1);

        expect(calls).toEqual([
            { item: "a", tick: 1 },
            { item: "b", tick: 2 },
            { item: "c", tick: 4 },
        ]);
        expect(completed).toHaveBeenCalledTimes(1);

        ctx.dispose();
    });

    it("derives stable groups from a flat item list", () => {
        const ctx = new Context();
        const calls: Array<{ item: string; tick: number }> = [];

        staggerByGroup(ctx, {
            batchSize: 1,
            groupBy(item) {
                return item.length;
            },
            items: ["bbb", "a", "cc"],
            order(items) {
                return [...items].sort();
            },
            run(item) {
                calls.push({ item, tick: system.currentTick });
            },
            ticksBetweenBatches: 1,
            ticksBetweenGroups: 2,
        });

        minecraftMockControl.advance(1);
        minecraftMockControl.advance(1);
        minecraftMockControl.advance(1);
        minecraftMockControl.advance(1);
        minecraftMockControl.advance(1);

        expect(calls).toEqual([
            { item: "a", tick: 1 },
            { item: "cc", tick: 3 },
            { item: "bbb", tick: 5 },
        ]);

        ctx.dispose();
    });

    it("cancels future batches", () => {
        const ctx = new Context();
        const calls: number[] = [];

        const cancel = stagger(ctx, {
            batchSize: 1,
            items: [1, 2, 3],
            run(item) {
                calls.push(item);
            },
            ticksBetweenBatches: 1,
        });

        minecraftMockControl.advance(1);
        cancel();
        minecraftMockControl.advance(3);

        expect(calls).toEqual([1]);

        ctx.dispose();
    });
});
