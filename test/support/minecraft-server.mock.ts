type ScheduledJob = {
    kind: "once" | "interval";
    dueTick: number;
    intervalTicks: number;
    callback: () => void;
};

type EntityRemoveHandler = (event: { removedEntity: { id?: string } }) => void;

let currentTick = 0;
let nextHandle = 1;
const jobs = new Map<number, ScheduledJob>();
const entityRemoveHandlers = new Set<EntityRemoveHandler>();

function schedule(
    kind: ScheduledJob["kind"],
    callback: () => void,
    ticks: number,
): number {
    const handle = nextHandle++;
    jobs.set(handle, {
        kind,
        dueTick: currentTick + Math.max(1, ticks | 0),
        intervalTicks: Math.max(1, ticks | 0),
        callback,
    });
    return handle;
}

function flushCurrentTick(): void {
    let shouldContinue = true;
    while (shouldContinue) {
        shouldContinue = false;
        for (const [handle, job] of Array.from(jobs.entries())) {
            if (job.dueTick > currentTick) continue;
            shouldContinue = true;
            if (job.kind === "once") {
                jobs.delete(handle);
            } else {
                job.dueTick = currentTick + job.intervalTicks;
            }
            job.callback();
        }
    }
}

export const system = {
    get currentTick() {
        return currentTick;
    },
    run(callback: () => void) {
        return schedule("once", callback, 1);
    },
    runTimeout(callback: () => void, ticks: number) {
        return schedule("once", callback, ticks);
    },
    runInterval(callback: () => void, ticks: number) {
        return schedule("interval", callback, ticks);
    },
    clearRun(handle: number) {
        jobs.delete(handle);
    },
};

export const world = {
    beforeEvents: {
        entityRemove: {
            subscribe(handler: EntityRemoveHandler) {
                entityRemoveHandlers.add(handler);
            },
            unsubscribe(handler: EntityRemoveHandler) {
                entityRemoveHandlers.delete(handler);
            },
        },
    },
};

export const minecraftMockControl = {
    advance(ticks = 1) {
        for (let i = 0; i < ticks; i++) {
            currentTick += 1;
            flushCurrentTick();
        }
    },
    emitEntityRemove(entity: { id?: string }) {
        for (const handler of Array.from(entityRemoveHandlers)) {
            handler({ removedEntity: entity });
        }
    },
    reset() {
        currentTick = 0;
        nextHandle = 1;
        jobs.clear();
        entityRemoveHandlers.clear();
    },
};
