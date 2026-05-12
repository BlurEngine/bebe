import { describe, expect, it, vi } from "vitest";
import { Context, EventSignal } from "@blurengine/bebe";
import type { EventSignalSource } from "@blurengine/bebe";

describe("EventSignal", () => {
    it("subscribes, emits, and unsubscribes event listeners", () => {
        const signal = new EventSignal<{ value: number }>();
        const listener = vi.fn();

        signal.subscribe(listener);
        signal.emit({ value: 1 });
        signal.unsubscribe(listener);
        signal.emit({ value: 2 });

        expect(listener).toHaveBeenCalledTimes(1);
        expect(listener).toHaveBeenCalledWith({ value: 1 });
    });

    it("uses a listener snapshot while emitting", () => {
        const signal = new EventSignal<Record<string, never>>();
        const calls: string[] = [];
        const second = () => calls.push("second");
        const first = () => {
            calls.push("first");
            signal.unsubscribe(second);
        };

        signal.subscribe(first);
        signal.subscribe(second);
        signal.emit({});

        expect(calls).toEqual(["first", "second"]);
    });

    it("can be owned by Context.subscribe", () => {
        const ctx = new Context();
        const signal = new EventSignal<{ value: number }>();
        const source: EventSignalSource<{ value: number }> = signal;
        const listener = vi.fn();

        ctx.subscribe(source, listener);
        signal.emit({ value: 1 });
        ctx.dispose();
        signal.emit({ value: 2 });

        expect(listener).toHaveBeenCalledTimes(1);
        expect(listener).toHaveBeenCalledWith({ value: 1 });
    });
});
