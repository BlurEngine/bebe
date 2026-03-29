import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
    Context,
    ROOT_CONTEXT,
    createServiceKey,
    isRootContext,
    isValidContext,
    mustContext,
} from "../src/context.js";
import {
    minecraftMockControl,
    system,
} from "./support/minecraft-server.mock.js";

type TestEntity = {
    id: string;
    isValid: boolean;
    remove: ReturnType<typeof vi.fn>;
};

function createEntity(id = "entity"): TestEntity {
    const entity: TestEntity = {
        id,
        isValid: true,
        remove: vi.fn(() => {
            entity.isValid = false;
        }),
    };
    return entity;
}

function createSource<TArgs extends unknown[]>() {
    const listeners = new Set<(...args: TArgs) => void>();
    return {
        source: {
            subscribe(listener: (...args: TArgs) => void) {
                listeners.add(listener);
            },
            unsubscribe(listener: (...args: TArgs) => void) {
                listeners.delete(listener);
            },
        },
        emit(...args: TArgs) {
            for (const listener of Array.from(listeners)) {
                listener(...args);
            }
        },
        listenerCount() {
            return listeners.size;
        },
    };
}

function createFilterableSource<TArgs extends unknown[], TFilter>() {
    const listeners = new Set<{
        listener: (...args: TArgs) => void;
        filter?: TFilter;
    }>();
    return {
        source: {
            subscribe(listener: (...args: TArgs) => void, filter?: TFilter) {
                listeners.add({ listener, filter });
            },
            unsubscribe(listener: (...args: TArgs) => void) {
                for (const entry of Array.from(listeners)) {
                    if (entry.listener === listener) {
                        listeners.delete(entry);
                    }
                }
            },
        },
        emit(filter: TFilter, ...args: TArgs) {
            for (const entry of Array.from(listeners)) {
                if (entry.filter === filter) {
                    entry.listener(...args);
                }
            }
        },
        listenerCount() {
            return listeners.size;
        },
    };
}

beforeEach(() => {
    minecraftMockControl.reset();
});

afterEach(() => {
    minecraftMockControl.reset();
});

describe("Context", () => {
    it("roots new contexts under ROOT_CONTEXT by default", () => {
        const ctx = new Context();

        expect(ctx.parent).toBe(ROOT_CONTEXT);
        expect(isRootContext(ROOT_CONTEXT)).toBe(true);
        expect(isRootContext(ctx)).toBe(false);

        ctx.dispose();
    });

    it("runs timeout and run callbacks on schedule", () => {
        const ctx = new Context();
        const calls: string[] = [];

        ctx.timeout(2, () => calls.push("timeout"));
        ctx.run(() => calls.push("run"));

        minecraftMockControl.advance(1);
        expect(calls).toEqual(["run"]);

        minecraftMockControl.advance(1);
        expect(calls).toEqual(["run", "timeout"]);

        ctx.dispose();
    });

    it("stops an interval after n runs", () => {
        const ctx = new Context();
        const callback = vi.fn();

        ctx.interval({ ticks: 2, n: 3 }, callback);
        minecraftMockControl.advance(6);
        minecraftMockControl.advance(4);

        expect(callback).toHaveBeenCalledTimes(3);

        ctx.dispose();
    });

    it("registers teardown callbacks through use", () => {
        const ctx = new Context();
        const cleanup = vi.fn();
        const remove = ctx.use(cleanup);

        remove();
        ctx.dispose();

        expect(cleanup).not.toHaveBeenCalled();
    });

    it("can own disposable values and custom disposer values through use", () => {
        const ctx = new Context();
        const disposable = { dispose: vi.fn() };
        const value = { closed: false };
        const sameDisposable = ctx.use(disposable);
        const sameValue = ctx.use(value, (candidate) => {
            candidate.closed = true;
        });

        ctx.dispose();

        expect(sameDisposable).toBe(disposable);
        expect(disposable.dispose).toHaveBeenCalledTimes(1);
        expect(sameValue).toBe(value);
        expect(value.closed).toBe(true);
    });

    it("runs onDispose callbacks on the next tick after dispose", () => {
        const ctx = new Context();
        const cleanup = vi.fn();

        ctx.onDispose(cleanup);
        ctx.dispose();

        expect(cleanup).not.toHaveBeenCalled();
        minecraftMockControl.advance(1);
        expect(cleanup).toHaveBeenCalledTimes(1);
    });

    it("supports plain subscriptions with max-run auto-unsubscribe", () => {
        const ctx = new Context();
        const source = createSource<[number]>();
        const handler = vi.fn();

        source.source.subscribe = vi.fn(source.source.subscribe);
        source.source.unsubscribe = vi.fn(source.source.unsubscribe);

        const unsubscribe = ctx.subscribe(
            { source: source.source, n: 2 },
            handler,
        );

        source.emit(1);
        source.emit(2);
        source.emit(3);

        expect(handler).toHaveBeenCalledTimes(2);
        expect(source.listenerCount()).toBe(0);

        unsubscribe();
        ctx.dispose();
    });

    it("supports filterable subscriptions", () => {
        const ctx = new Context();
        const source = createFilterableSource<[string], string>();
        const handler = vi.fn();

        ctx.subscribe({ source: source.source, filter: "keep" }, handler);
        source.emit("skip", "ignored");
        source.emit("keep", "accepted");

        expect(handler).toHaveBeenCalledTimes(1);
        expect(handler).toHaveBeenCalledWith("accepted");

        ctx.dispose();
    });

    it("inherits services by default and can disable inheritance", () => {
        const key = createServiceKey<{ label: string }>("ExampleService");
        const otherKey = createServiceKey<number>("OtherService");
        const parent = new Context();
        const child = parent.createScope();
        const isolated = parent.createScope({ inheritServices: false });
        const selective = parent.createScope({
            inheritServices: (candidate) => candidate === key,
        });

        parent.setService(key, { label: "parent" });
        parent.setService(otherKey, 99);

        expect(child.getService(key)?.label).toBe("parent");
        expect(isolated.getService(key)).toBeUndefined();
        expect(selective.getService(key)?.label).toBe("parent");
        expect(selective.getService(otherKey)).toBeUndefined();

        selective.dispose();
        isolated.dispose();
        child.dispose();
        parent.dispose();
    });

    it("ensures and deletes auto-disposed services", () => {
        const key = createServiceKey<{ dispose: ReturnType<typeof vi.fn> }>(
            "DisposableService",
        );
        const ctx = new Context();
        const factory = vi.fn(() => ({ dispose: vi.fn() }));

        const first = ctx.ensureService(key, factory);
        const second = ctx.ensureService(key, factory);

        expect(first).toBe(second);
        expect(factory).toHaveBeenCalledTimes(1);

        ctx.deleteService(key);
        expect(first.dispose).toHaveBeenCalledTimes(1);

        ctx.dispose();
    });

    it("tracks externally created handles for disposal", () => {
        const ctx = new Context();
        const callback = vi.fn();
        const handle = system.runTimeout(callback, 2);

        ctx.trackHandle(handle);
        ctx.dispose();
        minecraftMockControl.advance(3);

        expect(callback).not.toHaveBeenCalled();
    });

    it("tracks entities for removal on dispose", () => {
        const ctx = new Context();
        const entity = createEntity();

        ctx.trackEntity(entity as never);
        ctx.dispose();

        expect(entity.remove).toHaveBeenCalledTimes(1);
        expect(entity.isValid).toBe(false);
    });

    it("can link a tracked entity removal back to scope disposal", () => {
        const ctx = new Context();
        const entity = createEntity("linked");

        ctx.trackEntity(entity as never, {
            linkRemove: true,
            removeOnDispose: false,
        });

        expect(ctx.isDisposed).toBe(false);
        minecraftMockControl.emitEntityRemove(entity);
        expect(ctx.isDisposed).toBe(true);
    });

    it("disposes child scopes when the parent is disposed", () => {
        const parent = new Context();
        const child = parent.createScope();

        parent.dispose();

        expect(child.isDisposed).toBe(true);
    });

    it("exposes context validity helpers", () => {
        const ctx = new Context();

        expect(isValidContext(ctx)).toBe(true);
        expect(mustContext(ctx)).toBe(ctx);

        ctx.dispose();

        expect(isValidContext(ctx)).toBe(false);
        expect(() => mustContext(ctx)).toThrow(
            "[Context] Missing or invalid active Context",
        );
    });

    it("rejects lifecycle operations on ROOT_CONTEXT", () => {
        expect(() => ROOT_CONTEXT.run(() => {})).toThrow(
            "[Context] run() not allowed on ROOT_CONTEXT",
        );
        expect(() => ROOT_CONTEXT.dispose()).toThrow(
            "[Context] dispose() not allowed on ROOT_CONTEXT",
        );
    });
});
