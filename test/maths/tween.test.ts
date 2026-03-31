import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Context } from "../../src/context.js";
import {
    Easings,
    cubicBezier,
    tweenDelay,
    tweenNumber,
    tweenParallel,
    tweenSequence,
    tweenVec3,
} from "../../src/maths/tween.js";
import { minecraftMockControl } from "../support/minecraft-server.mock.js";

beforeEach(() => {
    minecraftMockControl.reset();
});

afterEach(() => {
    minecraftMockControl.reset();
    vi.restoreAllMocks();
});

describe("maths/tween", () => {
    it("exposes easing helpers and cubic bezier identity", () => {
        const bezier = cubicBezier(0, 0, 1, 1);

        expect(Easings.linear(0.25)).toBe(0.25);
        expect(bezier(0)).toBe(0);
        expect(bezier(0.5)).toBeCloseTo(0.5);
        expect(bezier(1)).toBe(1);
    });

    it("tweens a number once and completes", () => {
        const ctx = new Context();
        const values: Array<{ value: number; t: number }> = [];
        const onComplete = vi.fn();

        tweenNumber(ctx, {
            from: 0,
            to: 10,
            durationTicks: 2,
            onUpdate(value, t) {
                values.push({ value, t });
            },
            onComplete,
        });

        minecraftMockControl.advance(4);

        expect(values).toEqual([
            { value: 0, t: 0 },
            { value: 5, t: 0.5 },
            { value: 10, t: 1 },
        ]);
        expect(onComplete).toHaveBeenCalledTimes(1);

        ctx.dispose();
    });

    it("tweens a Vec3 once and supports delayed callbacks", () => {
        const ctx = new Context();
        const values: Array<{ x: number; y: number; z: number }> = [];
        const delayed = vi.fn();

        tweenVec3(ctx, {
            from: { x: 0, y: 0, z: 0 },
            to: { x: 2, y: 4, z: 6 },
            durationTicks: 2,
            onUpdate(value) {
                values.push(value);
            },
        });
        tweenDelay(ctx, 2, delayed);

        minecraftMockControl.advance(3);

        expect(values).toEqual([
            { x: 0, y: 0, z: 0 },
            { x: 1, y: 2, z: 3 },
            { x: 2, y: 4, z: 6 },
        ]);
        expect(delayed).toHaveBeenCalledTimes(1);

        ctx.dispose();
    });

    it("starts parallel tween factories immediately and cancels them together", () => {
        const first = vi.fn(() => vi.fn());
        const secondCancel = vi.fn();
        const second = vi.fn(() => secondCancel);

        const cancel = tweenParallel([first, second]);
        const firstCancel = first.mock.results[0]?.value;

        expect(first).toHaveBeenCalledTimes(1);
        expect(second).toHaveBeenCalledTimes(1);

        cancel();
        expect(firstCancel).toHaveBeenCalledTimes(1);
        expect(secondCancel).toHaveBeenCalledTimes(1);
    });

    it("sequences tween steps through an explicit completion contract", () => {
        const ctx = new Context();
        const lifecycle: string[] = [];

        tweenSequence([
            (done) =>
                tweenNumber(ctx, {
                    from: 0,
                    to: 2,
                    durationTicks: 2,
                    onUpdate(value) {
                        lifecycle.push(`number:${value}`);
                    },
                    onComplete() {
                        lifecycle.push("number:complete");
                        done();
                    },
                }),
            (done) =>
                tweenDelay(ctx, 1, () => {
                    lifecycle.push("delay:complete");
                    done();
                }),
            (done) => {
                lifecycle.push("sync:complete");
                done();
            },
        ]);

        minecraftMockControl.advance(4);

        expect(lifecycle).toEqual([
            "number:0",
            "number:1",
            "number:2",
            "number:complete",
            "delay:complete",
            "sync:complete",
        ]);

        ctx.dispose();
    });

    it("cancels the active sequence step and prevents later steps from starting", () => {
        const started: string[] = [];
        const firstCancel = vi.fn();

        const cancel = tweenSequence([
            () => {
                started.push("first");
                return firstCancel;
            },
            () => {
                started.push("second");
            },
        ]);

        cancel();

        expect(firstCancel).toHaveBeenCalledTimes(1);
        expect(started).toEqual(["first"]);
    });
});
