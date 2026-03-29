import type { Entity } from "@minecraft/server";
import { system, world } from "@minecraft/server";

/**
 */
export type OnDisposeOptions = {
    /**
     * Controls relative ordering among finalizers registered on the same `Context`.
     * - `"first"`: finalizer runs before others (unshift)
     * - `"last"` or undefined: finalizer runs after existing ones (push)
     */
    priority?: "first" | "last";
};

/**
 */
export type TrackEntityOptions = {
    /**
     * If true, auto-disposes this scope when the tracked entity
     * is removed (observed via `world.beforeEvents.entityRemove`). Default: false.
     */
    linkRemove?: boolean;
    /**
     * If true, call `entity.remove()` when this scope is disposed (after timers and
     * subscriptions are torn down). Default: true.
     */
    removeOnDispose?: boolean;
};

/**
 */
export type IntervalOptions = {
    /**
     * Period in ticks between runs (minimum 0). Values less than 0 are clamped to 0.
     */
    ticks: number;
    /**
     * Maximum number of runs before auto-clearing. `0` or `undefined` means unlimited.
     * Example: `n = 3` runs at most three times, then clears. Default: undefined.
     */
    n?: number;
};

/**
 */
export type TimeoutOptions = {
    /**
     * Ticks to wait before firing (minimum 0). Values less than 0 are clamped to 0.
     */
    ticks: number;
};

/**
 * Scheduler callback used by interval/timeout helpers. Handlers may be async.
 */
export type RunHandler = () => void | Promise<void>;

/**
 * Teardown function registered against a Context lifecycle.
 */
export type Teardown = () => void;

/**
 * Minimal disposable shape that can be owned by a Context.
 */
export interface DisposableLike {
    dispose(): void;
}

/**
 * Callback shape exposed by subscribable sources handled by {@link Context.subscribe}.
 */
export type SubscribableCallback<TArgs extends unknown[] = unknown[]> = (
    ...args: TArgs
) => unknown;

/**
 * Handler shape exposed by {@link Context.subscribe}.
 */
export type SubscribeRunHandler<TArgs extends unknown[] = unknown[]> = (
    ...args: TArgs
) => void;

/**
 * Simple event source with subscribe / unsubscribe callbacks.
 */
export interface SubscribableSource<TArgs extends unknown[] = unknown[]> {
    subscribe(cb: SubscribableCallback<TArgs>): unknown;
    unsubscribe(cb: SubscribableCallback<TArgs>): void;
}

/**
 * Event source that optionally accepts a filter argument at subscribe-time.
 */
export interface FilterableSubscribableSource<
    TArgs extends unknown[] = unknown[],
    TFilter = unknown,
> {
    subscribe(cb: SubscribableCallback<TArgs>, filter?: TFilter): unknown;
    unsubscribe(cb: SubscribableCallback<TArgs>): void;
}

/**
 */
export type SubscribeOptions<TSource, TFilter = unknown> = {
    /** Event source providing subscribe/unsubscribe methods */
    source: TSource;
    /** Optional filter argument for sources that accept one */
    filter?: TFilter;
    /** Max number of handler runs before auto-unsubscribe; undefined/0 means unlimited */
    n?: number;
};

/**
 * Unique typed key used to store and retrieve services on a Context.
 * Use {@link createServiceKey} to create keys with strong typing.
 */
export type ServiceKey<T> = symbol & { readonly __t?: T };

/**
 * Public key shape accepted by the service registry.
 */
export type ServiceLookupKey<T = unknown> = ServiceKey<T>;

/**
 * Controls whether a child scope may read services through the parent chain.
 */
export type ServiceInheritancePolicy = boolean | ((key: unknown) => boolean);

/**
 * Options for storing a service on a Context.
 */
export type ServiceOptions = {
    /**
     * When true (default), the service will be disposed automatically when the Context is disposed.
     */
    autoDispose?: boolean;
    /**
     * Optional callback invoked during Context.dispose() for this service (after dispose() if present).
     */
    onDispose?: () => void;
    /**
     * If false, setting a service for an existing key will be ignored. Default: true (overwrite).
     */
    overwrite?: boolean;
};

/**
 * Create a typed service key for storing/retrieving values on a Context.
 */
export function createServiceKey<T>(description?: string): ServiceKey<T> {
    return Symbol(description) as ServiceKey<T>;
}

/**
 * Internal representation of a stored service value.
 */
export type ServiceEntry<T = unknown> = {
    value: T;
    autoDispose: boolean;
    onDispose?: () => void;
};

/**
 * Stage-scoped context/subscription manager.
 * - Managing entities, event listeners, and scheduled system callbacks
 * - run/runInterval/runTimeout handles and auto-clear on dispose
 * - Tracking spawned entities for cleanup removal on dispose, and auto-disposing context
 * - Handling disposal signal; onDispose returns a remover
 * - Creating child scopes to group resources, with propogating behaviour
 * - Storing custom services for sharing state and runtime helpers across scopes
 * - All features automatically run in the game loop only!
 * - Recursive!
 */
export class Context {
    /** Custom service registry */
    #services: Map<unknown, ServiceEntry>;
    /** Stores all system handles tracked by this scope. */
    #handles: Set<number>;
    /** Stores all finalizers registered against this scope. */
    #finalizers: Array<() => void>;
    /** Fast lookup of tracked entities by id and their options. */
    #entityIdToOptions: Map<string, TrackEntityOptions>;
    /** Stores whether this context has already been disposed. */
    #isDisposed: boolean;
    /** Stores all direct child scopes. */
    #childScopes: Set<Context>;
    #parent: Context | null;
    /** Lazily installed entity remove subscription for tracked entity cleanup/links. */
    #linkRemoveUnsub?: () => void;
    /** Controls whether this context reads services from its parent chain. */
    #inheritServices: ServiceInheritancePolicy;
    protected assertAllowed(_method: string): void {}
    /** Idempotent ensure method to install the entity remove subscription once. */
    #ensureEntityRemoveSubscription(): void {
        this.assertAllowed("trackEntity");
        if (this.#linkRemoveUnsub) return;
        this.#linkRemoveUnsub = this.subscribe(
            world.beforeEvents.entityRemove,
            (ev) => {
                const removedId = ev.removedEntity.id;
                if (!removedId) return;
                const opts = this.#entityIdToOptions.get(removedId);
                if (!opts) return;
                // always remove the id mapping to avoid leaks
                this.#entityIdToOptions.delete(removedId);
                if (opts.linkRemove) this.dispose();
            },
        );
    }

    constructor(parent?: Context | null) {
        const resolvedParent = parent === undefined ? ROOT_CONTEXT : parent;
        this.#handles = new Set();
        this.#finalizers = [];
        this.#entityIdToOptions = new Map();
        this.#services = new Map();
        this.#isDisposed = false;
        this.#childScopes = new Set();
        this.#parent = resolvedParent ?? null;
        this.#inheritServices = true;
        if (this.#parent) {
            this.#parent.#childScopes.add(this);
            if (!isRootContext(this.#parent)) {
                this.#parent.onDispose(
                    () => {
                        this.dispose();
                    },
                    { priority: "first" },
                );
            }
        }
    }

    get isDisposed(): boolean {
        return this.#isDisposed;
    }

    get parent(): Context | null {
        return this.#parent;
    }

    #registerFinalizer(
        cleanup: Teardown,
        options?: OnDisposeOptions,
    ): () => void {
        if (typeof cleanup !== "function") return () => {};
        if (this.#isDisposed) {
            cleanup();
            return () => {};
        }
        let removed = false;
        const wrapped = () => {
            if (removed) return;
            removed = true;
            cleanup();
        };
        if (options?.priority === "first") {
            this.#finalizers.unshift(wrapped);
        } else {
            this.#finalizers.push(wrapped);
        }
        return () => {
            if (removed) return;
            removed = true;
            const idx = this.#finalizers.indexOf(wrapped);
            if (idx >= 0) this.#finalizers.splice(idx, 1);
        };
    }

    /**
     * Register ownership against this Context.
     *
     * Overloads:
     * - `use(cleanup, options?)` registers a teardown callback and returns a remover.
     * - `use(valueWithDispose, options?)` owns a disposable value and returns it unchanged.
     * - `use(value, dispose, options?)` owns any value with an explicit disposer.
     *
     * This is the lowest-level ownership primitive in Context. Higher-level helpers like
     * subscribe/onDispose/service factories build on the same lifecycle model.
     */
    use(cleanup: Teardown, options?: OnDisposeOptions): () => void;
    use<T extends DisposableLike>(value: T, options?: OnDisposeOptions): T;
    use<T>(
        value: T,
        dispose: (value: T) => void,
        options?: OnDisposeOptions,
    ): T;
    use<T>(
        valueOrCleanup: T | Teardown,
        disposeOrOptions?: ((value: T) => void) | OnDisposeOptions,
        maybeOptions?: OnDisposeOptions,
    ): T | (() => void) {
        this.assertAllowed("use");
        if (
            typeof valueOrCleanup === "function" &&
            typeof disposeOrOptions !== "function"
        ) {
            return this.#registerFinalizer(
                valueOrCleanup as Teardown,
                disposeOrOptions,
            );
        }

        const value = valueOrCleanup as T;
        const dispose =
            typeof disposeOrOptions === "function"
                ? disposeOrOptions
                : (candidate: T) => {
                      const disposable = candidate as
                          | DisposableLike
                          | null
                          | undefined;
                      disposable?.dispose?.();
                  };
        const options =
            typeof disposeOrOptions === "function"
                ? maybeOptions
                : disposeOrOptions;

        this.#registerFinalizer(() => dispose(value), options);
        return value;
    }

    /**
     * Schedule an interval and auto-clear on dispose.
     * Returns a cancel function to stop the interval and untrack it.
     *
     * Overloads:
     * - `interval(ticks, fn)`
     * - `interval({ ticks, n? }, fn)`
     *
     * Semantics:
     * - `n`: maximum number of times to run; interval auto-clears after reaching `n`
     */
    interval(ticks: number, fn: RunHandler): () => void;
    interval(options: IntervalOptions, fn: RunHandler): () => void;
    interval(a: number | IntervalOptions, fn: RunHandler): () => void {
        this.assertAllowed("interval");
        const opts: IntervalOptions =
            typeof a === "number"
                ? { ticks: a }
                : {
                      ticks: a?.ticks as number,
                      n: a?.n,
                  };
        return this.#makeRunController(fn, opts);
    }

    /**
     * Schedule a one-shot timeout and auto-clear on dispose.
     * Returns a cancel function to clear the timeout and untrack it.
     * Automatically untracks after firing to avoid handle leaks.
     *
     * Overloads:
     * - `timeout(ticks, fn)`
     * - `timeout({ ticks }, fn)`
     */
    timeout(ticks: number, fn: RunHandler): () => void;
    timeout(options: TimeoutOptions, fn: RunHandler): () => void;
    timeout(a: number | TimeoutOptions, fn: RunHandler): () => void {
        this.assertAllowed("timeout");
        const to: TimeoutOptions =
            typeof a === "number"
                ? { ticks: a }
                : { ticks: a?.ticks as number };
        const opts: IntervalOptions = {
            ticks: to.ticks,
            n: 1,
        };
        return this.#makeRunController(fn, opts);
    }

    /**
     * Schedule a one-shot callback to run on the next tick (system.run), equivalent to timeout(0).
     * Returns a cancel function.
     */
    run(fn: RunHandler): () => void {
        this.assertAllowed("run");
        return this.timeout(0, fn);
    }

    /**
     * Creates a small controller that encapsulates at-least-once semantics, cancel idempotence,
     * and cleanup/clear behavior for intervals and timeouts.
     */
    #makeRunController(fn: RunHandler, options: IntervalOptions): () => void {
        if (this.#isDisposed) {
            return () => {};
        }
        const ticks = Math.max(0, options.ticks | 0);
        const maxRuns =
            options.n !== undefined
                ? Math.max(0, (options.n as number) | 0)
                : 0;
        let cancelled = false;
        let runs = 0;
        // clearing the underlying handle is orthogonal to cancellation; we ensure it only happens once
        let cleared = false;
        // for integrity's sake, never leak handle outside this function explicitly
        let handle = -1 as number;
        const clearIfNeeded = () => {
            if (cleared) return;
            this.clear(handle);
            cleared = true;
        };
        const onRun = () => {
            if (cancelled || this.#isDisposed) return;
            try {
                fn();
            } finally {
                runs += 1;
                if (maxRuns > 0 && runs >= maxRuns) clearIfNeeded();
            }
        };
        // Schedule based on n/maxRuns
        if (maxRuns === 1) {
            handle =
                ticks === 0
                    ? system.run(onRun)
                    : system.runTimeout(onRun, ticks);
        } else {
            handle = system.runInterval(onRun, ticks === 0 ? 1 : ticks);
        }
        this.#handles.add(handle);
        return () => {
            if (cancelled) return;
            cancelled = true;
            clearIfNeeded();
        };
    }

    /**
     * Track an existing run handle (interval or timeout) for later clearing.
     * Returns a cancel function to clear and untrack it.
     */
    trackHandle(handle: number): () => void {
        this.assertAllowed("trackHandle");
        if (this.#isDisposed) {
            console.warn(
                "[Context] trackHandle called after dispose; ignored.",
            );
            return () => {};
        }
        if (typeof handle === "number") this.#handles.add(handle);
        let didCancel = false;
        return () => {
            if (didCancel) return;
            didCancel = true;
            this.clear(handle);
        };
    }

    /**
     * Clear a specific handle and untrack it.
     */
    clear(handle: number): void {
        this.assertAllowed("clear");
        if (!this.#handles.has(handle)) return;
        system.clearRun(handle);
        this.#handles.delete(handle);
    }

    /**
     * Create a child scope that groups timers/subscriptions/resources.
     * Disposing the scope tears down its resources; stage disposal also disposes the scope.
     */
    createScope(options?: {
        inheritServices?: ServiceInheritancePolicy;
    }): Context {
        const child = new Context(this);
        if (options && typeof options.inheritServices !== "undefined") {
            child.#inheritServices = options.inheritServices;
        } else {
            child.#inheritServices = true;
        }
        return child;
    }

    #shouldInheritService(key: unknown): boolean {
        const ic = this.#inheritServices;
        if (typeof ic === "function") {
            try {
                return !!ic(key);
            } catch {}
            // Treat policy failures as "do not inherit" so service lookup stays safe.
            return false;
        }
        return ic === true;
    }

    #getServiceEntry(
        key: unknown,
    ): { ctx: Context; entry: ServiceEntry } | undefined {
        let owner: Context | null = this;
        while (owner) {
            const entry = owner.#services.get(key);
            if (entry) return { ctx: owner, entry };
            if (!this.#shouldInheritService(key)) break;
            owner = owner.#parent;
        }
        return undefined;
    }

    /**
     * Store a service value associated with a key.
     */
    setService<T>(
        key: ServiceLookupKey<T>,
        value: T,
        options?: ServiceOptions,
    ): void {
        this.assertAllowed("setService");
        if (this.#isDisposed) return;
        const overwrite = options?.overwrite !== false;
        if (!overwrite && this.#services.has(key)) return;
        this.#services.set(key, {
            value,
            autoDispose: options?.autoDispose !== false,
            onDispose: options?.onDispose,
        });
    }

    /**
     * Get a service value by key.
     */
    getService<T>(key: ServiceLookupKey<T>): T | undefined {
        this.assertAllowed("getService");
        const found = this.#getServiceEntry(key);
        return found ? (found.entry.value as T) : undefined;
    }

    /**
     * Ensure a service exists; if missing, create via factory and store it, then return it.
     */
    ensureService<T>(
        key: ServiceLookupKey<T>,
        factory: () => T,
        options?: ServiceOptions,
    ): T {
        this.assertAllowed("ensureService");
        const existing = this.getService<T>(key);
        if (existing !== undefined) return existing;
        const created = factory();
        this.setService(key, created, options);
        return created;
    }

    /**
     * Returns true if a service with key is present.
     */
    hasService(key: ServiceLookupKey): boolean {
        this.assertAllowed("hasService");
        if (this.#services.has(key)) return true;
        return !!this.#getServiceEntry(key);
    }

    /**
     * Remove a service; if it was auto-managed, dispose it first.
     */
    deleteService(
        key: ServiceLookupKey,
        options?: { dispose?: boolean },
    ): void {
        this.assertAllowed("deleteService");
        const entry = this.#services.get(key);
        if (!entry) return;
        this.#services.delete(key);
        const shouldDispose = options?.dispose !== false && entry.autoDispose;
        if (!shouldDispose) return;
        // Service teardown is best-effort; one bad service should not block cleanup.
        try {
            const val = entry.value as any;
            if (val && typeof val.dispose === "function") {
                val.dispose();
            }
        } catch {}
        try {
            entry.onDispose?.();
        } catch {}
    }

    /**
     * Register a callback to be invoked on dispose.
     * Returns a remover to deregister before dispose. Idempotent.
     */
    onDispose(cb: () => void, options?: OnDisposeOptions): () => void {
        this.assertAllowed("onDispose");
        if (typeof cb !== "function") return () => {};
        return this.use(() => system.run(() => cb()), options);
    }

    /**
     * Track an entity with optional linkage/removal behavior.
     *
     * Options:
     * - linkRemove (default: false): If true, the scope auto-disposes when the tracked entity
     *   is removed (via world.beforeEvents.entityRemove).
     * - removeOnDispose (default: true): If true, attempts to ent.remove() during scope disposal
     *   (after timers/subscriptions have been torn down). This is useful to ensure entities spawned
     *   for this scope are also removed when the scope ends.
     *
     * @example creating & tracking a scope for an entity
     * ```ts
     * const scope = ctx.createScope();
     * const ent = scope.trackEntity(spawn(...), { linkRemove: true, removeOnDispose: true });
     * ```
     */
    trackEntity(ent: Entity, options?: TrackEntityOptions): Entity {
        this.assertAllowed("trackEntity");
        if (this.#isDisposed) {
            console.warn(
                "[Context] trackEntity called after dispose; ignored.",
            );
            return ent;
        }
        if (!ent) return ent;
        // Track by id with options (apply defaults)
        const opts: TrackEntityOptions = {
            linkRemove: options?.linkRemove === true,
            removeOnDispose: options?.removeOnDispose !== false,
        };
        if (ent?.id) this.#entityIdToOptions.set(ent.id, opts);
        // Always ensure a single lazy subscription exists for tracked cleanup/link semantics
        this.#ensureEntityRemoveSubscription();
        // Remove the entity when this scope is disposed (default: true)
        if (opts.removeOnDispose) {
            this.use(() => {
                if (ent?.isValid) ent.remove();
            });
        }
        return ent;
    }

    /**
     * Subscribe to an event source and auto-unsubscribe on dispose.
     * Supports max-run semantics via `n`: when provided, the handler will auto-unsubscribe
     * after being invoked `n` times.
     *
     * Overloads:
     * - subscribe(source, handler)
     * - subscribe({ source, n?, filter? }, handler)
     */
    subscribe<TArgs extends unknown[]>(
        sourceOrOptions:
            | SubscribableSource<TArgs>
            | SubscribeOptions<SubscribableSource<TArgs>>,
        handler: SubscribeRunHandler<TArgs>,
    ): () => void;
    subscribe<TArgs extends unknown[], TFilter>(
        sourceOrOptions:
            | FilterableSubscribableSource<TArgs, TFilter>
            | SubscribeOptions<
                  FilterableSubscribableSource<TArgs, TFilter>,
                  TFilter
              >,
        handler: SubscribeRunHandler<TArgs>,
    ): () => void;
    subscribe<TArgs extends unknown[], TFilter = unknown>(
        sourceOrOptions:
            | SubscribableSource<TArgs>
            | FilterableSubscribableSource<TArgs, TFilter>
            | SubscribeOptions<
                  | SubscribableSource<TArgs>
                  | FilterableSubscribableSource<TArgs, TFilter>,
                  TFilter
              >,
        handler: SubscribeRunHandler<TArgs>,
    ): () => void {
        this.assertAllowed("subscribe");
        if (this.#isDisposed) {
            console.warn("[Context] subscribe called after dispose; ignored.");
            return () => {};
        }
        if (typeof handler !== "function")
            throw new Error("handler must be a function");
        // Normalize args
        const isOptions = (
            v: unknown,
        ): v is SubscribeOptions<
            | SubscribableSource<TArgs>
            | FilterableSubscribableSource<TArgs, TFilter>,
            TFilter
        > => !!v && typeof v === "object" && "source" in v;
        const source:
            | SubscribableSource<TArgs>
            | FilterableSubscribableSource<TArgs, TFilter> = (
            isOptions(sourceOrOptions)
                ? sourceOrOptions.source
                : sourceOrOptions
        ) as
            | SubscribableSource<TArgs>
            | FilterableSubscribableSource<TArgs, TFilter>;
        const n: number | undefined = isOptions(sourceOrOptions)
            ? sourceOrOptions.n
            : undefined;
        const filter: TFilter | undefined = isOptions(sourceOrOptions)
            ? sourceOrOptions.filter
            : undefined;

        let removed = false;
        let runs = 0;
        type OriginalCb = SubscribableCallback<TArgs>;
        const wrappedListener = ((...args: unknown[]) => {
            try {
                (handler as SubscribeRunHandler<unknown[]>)(...args);
            } finally {
                runs += 1;
                if (typeof n === "number" && n > 0 && runs >= n) unsubscribe();
            }
        }) as OriginalCb;

        // Do the subscription
        let unsubscribe: () => void;
        if (filter === undefined) {
            const s = source as SubscribableSource<TArgs>;
            s.subscribe(wrappedListener);
            unsubscribe = () => {
                if (removed) return;
                removed = true;
                s.unsubscribe(wrappedListener);
            };
        } else {
            const s = source as FilterableSubscribableSource<TArgs, TFilter>;
            s.subscribe(wrappedListener, filter);
            unsubscribe = () => {
                if (removed) return;
                removed = true;
                s.unsubscribe(wrappedListener);
            };
        }
        const removeFinalizer = this.use(unsubscribe, {
            priority: "first",
        });
        return () => {
            try {
                unsubscribe();
            } finally {
                removeFinalizer();
            }
        };
    }

    /**
     * Dispose all resources tracked by this context.
     */
    dispose(): void {
        this.assertAllowed("dispose");
        if (this.#isDisposed) return;
        this.#isDisposed = true;
        // Dispose child scopes first
        const children = Array.from(this.#childScopes);
        this.#childScopes.clear();
        children.forEach((s) => {
            s.dispose();
        });
        // Clear intervals/timeouts
        this.#handles.forEach((h) => system.clearRun(h));
        this.#handles.clear();
        // Run finalizers best-effort so later cleanup still happens if one fails.
        const fns = this.#finalizers.slice();
        this.#finalizers.length = 0;
        fns.forEach((u) => {
            try {
                u();
            } catch {}
        });
        // Dispose services (auto-managed)
        if (this.#services.size > 0) {
            const entries = Array.from(this.#services.values());
            this.#services.clear();
            entries.forEach((entry) => {
                if (!entry.autoDispose) return;
                // Service disposal is also best-effort during scope teardown.
                try {
                    const val = entry.value as any;
                    if (val && typeof val.dispose === "function") val.dispose();
                } catch {}
                try {
                    entry.onDispose?.();
                } catch {}
            });
        }
        // Per-entity removal is handled via onDispose finalizers registered in trackEntity
        this.#entityIdToOptions.clear();
    }
}

/**
 * Root context: a non-disposable top-level context.
 * - Cannot be disposed
 * - Throws on lifecycle/resource APIs that only make sense on child scopes
 * - Intended as a safe parent to create child scopes on demand
 */
export class RootContext extends Context {
    constructor() {
        super(null);
    }

    protected override assertAllowed(method: string): void {
        throw new Error(`[Context] ${method}() not allowed on ROOT_CONTEXT`);
    }
}

export const ROOT_CONTEXT = new RootContext();

/**
 * Returns true when the given context is the singleton root context.
 */
export function isRootContext(
    ctx: Context | null | undefined,
): ctx is RootContext {
    return ctx === ROOT_CONTEXT;
}

/**
 * Returns true if the given value is an active Context instance.
 * A disposed context returns false.
 */
export function isValidContext(ctx: unknown): boolean {
    return ctx instanceof Context && ctx.isDisposed === false;
}

/**
 * Returns a valid input Context or throws a consistent error.
 */
export function mustContext(ctx: unknown): Context {
    if (!isValidContext(ctx)) {
        throw new Error("[Context] Missing or invalid active Context");
    }
    return ctx as Context;
}
