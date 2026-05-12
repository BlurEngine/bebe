export type EventSignalListener<TEvent> = (event: TEvent) => unknown;

/**
 * Subscribable event source for derived or project-local events.
 */
export interface EventSignalSource<TEvent> {
    subscribe(
        listener: EventSignalListener<TEvent>,
    ): EventSignalListener<TEvent>;
    unsubscribe(listener: EventSignalListener<TEvent>): void;
}

/**
 * Small subscribable event source for derived or project-local events.
 *
 * `EventSignal` matches the source shape accepted by `Context.subscribe(...)`,
 * so callers can let a context own listener cleanup without each feature
 * reimplementing a local emitter.
 */
export class EventSignal<TEvent> implements EventSignalSource<TEvent> {
    readonly #listeners = new Set<EventSignalListener<TEvent>>();

    subscribe(
        listener: EventSignalListener<TEvent>,
    ): EventSignalListener<TEvent> {
        this.#listeners.add(listener);
        return listener;
    }

    unsubscribe(listener: EventSignalListener<TEvent>): void {
        this.#listeners.delete(listener);
    }

    emit(event: TEvent): void {
        for (const listener of Array.from(this.#listeners)) {
            listener(event);
        }
    }
}
