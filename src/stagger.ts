import type { Context, RunHandler } from "./context.js";

/**
 * Reorders items within a group before batching begins.
 *
 * Return a new array when order changes. Returning the original array is also
 * supported.
 */
export type StaggerOrder<T> = (items: readonly T[]) => readonly T[];

/**
 * Describes the current item position inside the staggered work plan.
 */
export type StaggerRunInfo = {
    /**
     * Zero-based index of the scheduled batch currently running.
     */
    batchIndex: number;
    /**
     * Zero-based index of the item within the current batch.
     */
    batchItemIndex: number;
    /**
     * Zero-based index of the source group that produced this item.
     *
     * `stagger(...)` always reports `0` because it wraps one implicit group.
     */
    groupIndex: number;
    /**
     * Zero-based index of the item within its source group after ordering has
     * been applied.
     */
    itemIndex: number;
};

/**
 * Handler invoked for each scheduled item in a staggered plan.
 */
export type StaggerRun<T> = (
    item: T,
    info: StaggerRunInfo,
) => void | Promise<void>;

/**
 * Common scheduling controls shared by stagger helpers.
 */
export type StaggerCommonOptions<T> = {
    /**
     * Maximum number of items to run per batch. Values less than 1 are clamped
     * up to 1.
     */
    batchSize?: number;
    /**
     * Ticks to wait before the first batch runs. Default: 0.
     */
    initialDelayTicks?: number;
    /**
     * Optional callback invoked once after the final scheduled batch runs.
     */
    onComplete?: RunHandler;
    /**
     * Optional per-group reorder step applied before batching begins.
     */
    order?: StaggerOrder<T>;
    /**
     * Handler invoked for every scheduled item.
     */
    run: StaggerRun<T>;
    /**
     * Ticks to wait between batches within the same group. Default: 1.
     */
    ticksBetweenBatches?: number;
};

/**
 * Staggers one list of items over one or more ticks.
 */
export type StaggerOptions<T> = StaggerCommonOptions<T> & {
    /**
     * Items to schedule as one logical group.
     */
    items: readonly T[];
};

/**
 * Stable key used to derive stagger groups from one flat item list.
 */
export type StaggerGroupKey = number | string;

/**
 * Staggers multiple groups of items while preserving group boundaries.
 */
export type StaggerGroupsOptions<T> = StaggerCommonOptions<T> & {
    /**
     * Item groups to schedule in order.
     *
     * Each group is ordered and batched independently.
     */
    groups: readonly (readonly T[])[];
    /**
     * Ticks to wait between the start of one group and the start of the next
     * group after the previous group's final batch. Default: 1.
     */
    ticksBetweenGroups?: number;
};

/**
 * Staggers one list of items while deriving group boundaries from a key.
 */
export type StaggerByGroupOptions<
    T,
    TKey extends StaggerGroupKey = StaggerGroupKey,
> = StaggerCommonOptions<T> & {
    /**
     * Comparator used to sort derived group keys before scheduling begins.
     *
     * Default: numeric ascending for number keys and locale order for string
     * keys.
     */
    compareGroups?: (left: TKey, right: TKey) => number;
    /**
     * Returns the group key for one item.
     */
    groupBy: (item: T) => TKey;
    /**
     * Items to schedule after grouping.
     */
    items: readonly T[];
    /**
     * Ticks to wait between the start of one derived group and the start of the
     * next derived group after the previous group's final batch. Default: 1.
     */
    ticksBetweenGroups?: number;
};

type StaggerPlanItem<T> = {
    groupIndex: number;
    itemIndex: number;
    value: T;
};

type StaggerBatch<T> = {
    items: readonly T[];
    tick: number;
};

/**
 * Staggers one list of items under the lifetime of a context.
 *
 * All scheduled work is owned by the provided context and will be cancelled if
 * that context is disposed.
 */
export function stagger<T>(
    ctx: Context,
    options: StaggerOptions<T>,
): () => void {
    return staggerGroups(ctx, {
        ...options,
        groups: [options.items],
    });
}

/**
 * Staggers one list of items while deriving group boundaries from a group key.
 *
 * Use this when authored code already has one flat list, but the schedule still
 * needs stable group spacing such as wave depth, stage number, or priority
 * phase.
 */
export function staggerByGroup<
    T,
    TKey extends StaggerGroupKey = StaggerGroupKey,
>(ctx: Context, options: StaggerByGroupOptions<T, TKey>): () => void {
    const {
        compareGroups,
        groupBy,
        items,
        ticksBetweenGroups,
        ...staggerOptions
    } = options;

    return staggerGroups(ctx, {
        ...staggerOptions,
        groups: createDerivedGroups(items, groupBy, compareGroups),
        ticksBetweenGroups,
    });
}

/**
 * Staggers grouped work under the lifetime of a context.
 *
 * Each group is batched independently. Group order is preserved.
 */
export function staggerGroups<T>(
    ctx: Context,
    options: StaggerGroupsOptions<T>,
): () => void {
    const plan = createStaggerPlan(options);
    if (plan.length === 0) {
        options.onComplete?.();
        return () => {};
    }

    let cancelled = false;
    let completedBatches = 0;
    const cancels: Array<() => void> = [];

    for (const [batchIndex, batch] of plan.entries()) {
        const cancel = ctx.timeout(toContextDelay(batch.tick), () => {
            if (cancelled) {
                return;
            }

            for (
                let batchItemIndex = 0;
                batchItemIndex < batch.items.length;
                batchItemIndex += 1
            ) {
                const item = batch.items[batchItemIndex];
                options.run(item.value, {
                    batchIndex,
                    batchItemIndex,
                    groupIndex: item.groupIndex,
                    itemIndex: item.itemIndex,
                });
            }

            completedBatches += 1;
            if (completedBatches === plan.length) {
                options.onComplete?.();
            }
        });
        cancels.push(cancel);
    }

    return () => {
        if (cancelled) {
            return;
        }

        cancelled = true;
        for (const cancel of cancels) {
            cancel();
        }
    };
}

function toContextDelay(logicalTick: number): number {
    return logicalTick <= 0 ? 0 : logicalTick + 1;
}

function createStaggerPlan<T>(
    options: StaggerGroupsOptions<T>,
): StaggerBatch<StaggerPlanItem<T>>[] {
    const plan: StaggerBatch<StaggerPlanItem<T>>[] = [];
    const batchSize = Math.max(1, options.batchSize ?? Number.MAX_SAFE_INTEGER);
    const ticksBetweenBatches = Math.max(1, options.ticksBetweenBatches ?? 1);
    const ticksBetweenGroups = Math.max(1, options.ticksBetweenGroups ?? 1);
    let nextTick = Math.max(0, options.initialDelayTicks ?? 0);

    for (
        let groupIndex = 0;
        groupIndex < options.groups.length;
        groupIndex += 1
    ) {
        const group = options.groups[groupIndex];
        if (!group || group.length === 0) {
            continue;
        }

        const orderedGroup = applyOrder(group, options.order).map(
            (value, itemIndex) => ({
                groupIndex,
                itemIndex,
                value,
            }),
        );
        const batches = chunkItems(orderedGroup, batchSize);

        for (let batchIndex = 0; batchIndex < batches.length; batchIndex += 1) {
            plan.push({
                items: batches[batchIndex],
                tick: nextTick + batchIndex * ticksBetweenBatches,
            });
        }

        nextTick += Math.max(0, batches.length - 1) * ticksBetweenBatches;
        nextTick += ticksBetweenGroups;
    }

    return plan;
}

function createDerivedGroups<T, TKey extends StaggerGroupKey>(
    items: readonly T[],
    groupBy: (item: T) => TKey,
    compareGroups: ((left: TKey, right: TKey) => number) | undefined,
): readonly (readonly T[])[] {
    const itemsByKey = new Map<TKey, T[]>();

    for (const item of items) {
        const key = groupBy(item);
        const existing = itemsByKey.get(key);
        if (existing) {
            existing.push(item);
            continue;
        }

        itemsByKey.set(key, [item]);
    }

    const sortedKeys = [...itemsByKey.keys()].sort(
        compareGroups ?? compareGroupKeys,
    );
    const groups: T[][] = [];

    for (const key of sortedKeys) {
        const group = itemsByKey.get(key);
        if (!group) {
            continue;
        }

        groups.push(group);
    }

    return groups;
}

function applyOrder<T>(
    items: readonly T[],
    order: StaggerOrder<T> | undefined,
): readonly T[] {
    if (!order) {
        return items;
    }

    return order(items);
}

function chunkItems<T>(items: readonly T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];

    for (let index = 0; index < items.length; index += chunkSize) {
        chunks.push(items.slice(index, index + chunkSize));
    }

    return chunks;
}

function compareGroupKeys(
    left: StaggerGroupKey,
    right: StaggerGroupKey,
): number {
    if (typeof left === "number" && typeof right === "number") {
        return left - right;
    }

    return String(left).localeCompare(String(right));
}
