import type { Context } from "./context.js";
import { Metrics } from "./metrics.js";

const LINK_HANDLER_ATTACH_FAILURES = Metrics.counter(
    "bebe_link_handler_attach_failures_total",
    {
        help: "Total Link inbound handler attach failures.",
        labelNames: ["kind"],
    },
);
const LINK_HANDLER_DETACH_FAILURES = Metrics.counter(
    "bebe_link_handler_detach_failures_total",
    {
        help: "Total Link inbound handler detach failures.",
        labelNames: ["kind"],
    },
);
const LINK_SEND_FAILURES = Metrics.counter("bebe_link_send_failures_total", {
    help: "Total Link send failures.",
    labelNames: ["kind"],
});

export type LinkEventMeta = {
    /**
     * Generated event id used by transports for replay and dedupe.
     */
    readonly id?: string;
    /**
     * Retention behavior requested by the sender.
     */
    readonly retention?: LinkEventRetention;
    /**
     * Optional key used to replace one latest-retained event without replacing
     * other events of the same kind.
     */
    readonly retentionKey?: string;
    /**
     * Logical sender for the event, such as `bds`, `dashboard`, or `cli`.
     */
    readonly source?: string;
    /**
     * Event timestamp in epoch milliseconds.
     */
    readonly t?: number;
    readonly [key: string]: unknown;
};

export type LinkEventRetention = "append" | "latest";

export type LinkSnapshotOptions = {
    /**
     * Optional key for retaining multiple latest snapshots of the same kind.
     */
    key?: string;
};

export type LinkEvent = {
    /**
     * Message kind, usually namespaced by the caller.
     */
    kind: string;
    /**
     * Optional JSON-compatible payload.
     */
    data?: unknown;
    /**
     * Optional bridge metadata. Gameplay code can ignore this for simple flows.
     */
    meta?: LinkEventMeta;
};

/**
 * Raw result returned by Link transports.
 */
export type LinkEventResult = {
    /**
     * Whether the event was accepted by an installed transport.
     */
    ok: boolean;
    /**
     * Human-readable reason when the event was not accepted.
     */
    reason?: string;
};

/**
 * Current Link transport status.
 */
export type LinkStatus = {
    /**
     * Whether Link has an active transport available for use.
     */
    available: boolean;
    /**
     * Capabilities currently advertised by the active transport.
     */
    capabilities: readonly string[];
    /**
     * Human-readable reason when Link is unavailable.
     */
    reason?: string;
};

/**
 * Handler for inbound Link messages.
 */
export type LinkInboundHandler = (event: LinkEvent) => void | Promise<void>;

/**
 * Transport contract used by target-specific Link implementations.
 */
export interface LinkEventTransport {
    capabilities(): readonly string[];
    isAvailable(capability?: string): boolean;
    status(): LinkStatus;
    event(
        event: LinkEvent,
    ):
        | void
        | boolean
        | LinkEventResult
        | Promise<void | boolean | LinkEventResult>;
    on(kind: string, handler: LinkInboundHandler): () => void;
}

export type LinkTransportInstallOptions = {
    /**
     * Optional lifecycle owner. When disposed, the installed transport is
     * uninstalled from the static Link facade.
     */
    context?: Context;
};

/**
 * Stable static Link surface for runtime bridge messaging.
 */
export interface LinkService {
    /**
     * Current transport capabilities for diagnostics and tooling UI.
     */
    capabilities(): readonly string[];
    /**
     * Sends a fire-and-forget event when outbound Link is available.
     *
     * This is a safe no-op when no compatible transport is installed.
     */
    event(kind: string, data?: unknown): void;
    /**
     * Reports transport availability for diagnostics.
     *
     * Normal gameplay code should call {@link event} and {@link on} directly;
     * those methods own their own availability checks.
     */
    isAvailable(capability?: string): boolean;
    /**
     * Registers inbound handler intent.
     *
     * The registration is retained when no compatible transport is currently
     * available and attaches when one is installed.
     */
    on(kind: string, handler: LinkInboundHandler): () => void;
    /**
     * Sends a fire-and-forget latest snapshot when outbound Link is available.
     *
     * Latest snapshots are intended for state-like data where only the newest
     * value is useful in tooling.
     */
    snapshot(kind: string, data?: unknown, options?: LinkSnapshotOptions): void;
    /**
     * Current transport status for diagnostics and tooling UI.
     */
    status(): LinkStatus;
}

const UNAVAILABLE_STATUS: LinkStatus = Object.freeze({
    available: false,
    capabilities: Object.freeze([]) as readonly string[],
    reason: "no transport installed",
});

type LinkInboundRegistration = {
    readonly handler: LinkInboundHandler;
    readonly kind: string;
    unsubscribeFromTransport?: () => void;
};

class LinkRuntime {
    #activeTransport: LinkEventTransport | undefined;
    readonly #inboundRegistrations = new Set<LinkInboundRegistration>();
    #installToken = 0;
    #removeContextFinalizer: (() => void) | undefined;

    #attachInboundRegistration(registration: LinkInboundRegistration): void {
        const transport = this.#activeTransport;
        if (
            !transport ||
            !transport.isAvailable("inbound") ||
            registration.unsubscribeFromTransport
        ) {
            return;
        }

        try {
            registration.unsubscribeFromTransport = transport.on(
                registration.kind,
                registration.handler,
            );
        } catch (error) {
            LINK_HANDLER_ATTACH_FAILURES.count({ kind: registration.kind });
        }
    }

    #attachInboundRegistrations(): void {
        for (const registration of this.#inboundRegistrations) {
            this.#attachInboundRegistration(registration);
        }
    }

    #detachInboundRegistrations(): void {
        for (const registration of this.#inboundRegistrations) {
            const unsubscribe = registration.unsubscribeFromTransport;
            if (!unsubscribe) {
                continue;
            }

            registration.unsubscribeFromTransport = undefined;
            try {
                unsubscribe();
            } catch (error) {
                LINK_HANDLER_DETACH_FAILURES.count({
                    kind: registration.kind,
                });
            }
        }
    }

    #disconnectTransport(): void {
        this.#installToken += 1;
        this.#detachInboundRegistrations();
        this.#activeTransport = undefined;
        this.#removeContextFinalizer?.();
        this.#removeContextFinalizer = undefined;
    }

    capabilities(): readonly string[] {
        return this.#activeTransport?.capabilities() ?? [];
    }

    clear(): void {
        this.#disconnectTransport();
        this.#inboundRegistrations.clear();
    }

    event(kind: string, data?: unknown): void {
        const transport = this.#activeTransport;
        if (!transport || !transport.isAvailable("events")) {
            return;
        }

        sendTransportEvent(transport, {
            kind,
            data,
        });
    }

    snapshot(
        kind: string,
        data?: unknown,
        options?: LinkSnapshotOptions,
    ): void {
        const transport = this.#activeTransport;
        if (!transport || !transport.isAvailable("events")) {
            return;
        }

        sendTransportEvent(transport, {
            kind,
            data,
            meta: {
                retention: "latest",
                ...(options?.key ? { retentionKey: options.key } : {}),
            },
        });
    }

    install(
        transport: LinkEventTransport,
        options?: LinkTransportInstallOptions,
    ): () => void {
        this.#disconnectTransport();

        const token = this.#installToken + 1;
        this.#installToken = token;
        this.#activeTransport = transport;
        this.#attachInboundRegistrations();

        let removeContextFinalizer: (() => void) | undefined;
        const uninstall = () => {
            if (this.#installToken !== token) {
                return;
            }

            this.#disconnectTransport();
        };

        if (options?.context) {
            removeContextFinalizer = options.context.use(uninstall, {
                priority: "first",
            });
            this.#removeContextFinalizer = removeContextFinalizer;
        }

        return uninstall;
    }

    isAvailable(capability?: string): boolean {
        return this.#activeTransport?.isAvailable(capability) ?? false;
    }

    on(kind: string, handler: LinkInboundHandler): () => void {
        const registration: LinkInboundRegistration = { handler, kind };
        this.#inboundRegistrations.add(registration);
        this.#attachInboundRegistration(registration);

        return () => {
            if (!this.#inboundRegistrations.delete(registration)) {
                return;
            }

            const unsubscribe = registration.unsubscribeFromTransport;
            registration.unsubscribeFromTransport = undefined;
            try {
                unsubscribe?.();
            } catch (error) {
                LINK_HANDLER_DETACH_FAILURES.count({
                    kind: registration.kind,
                });
            }
        };
    }

    status(): LinkStatus {
        return this.#activeTransport?.status() ?? UNAVAILABLE_STATUS;
    }
}

const runtime = new LinkRuntime();

/**
 * Installs the active Link transport.
 *
 * This is intended for target-specific bootstrap code. Most users should call
 * methods on {@link Link} directly and let their build tooling choose the
 * transport.
 */
export function installLinkTransport(
    transport: LinkEventTransport,
    options?: LinkTransportInstallOptions,
): () => void {
    return runtime.install(transport, options);
}

/**
 * Clears the active Link transport and registered inbound handlers.
 *
 * This is primarily useful for tests and full target lifecycle teardown.
 */
export function clearLinkTransport(): void {
    runtime.clear();
}

function sendTransportEvent(
    transport: LinkEventTransport,
    event: LinkEvent,
): void {
    try {
        void Promise.resolve(transport.event(event)).catch((error) => {
            LINK_SEND_FAILURES.count({ kind: event.kind });
        });
    } catch (error) {
        LINK_SEND_FAILURES.count({ kind: event.kind });
    }
}

/**
 * Static Link bridge service.
 */
export const Link: LinkService = Object.freeze({
    capabilities(): readonly string[] {
        return runtime.capabilities();
    },
    event(kind: string, data?: unknown): void {
        runtime.event(kind, data);
    },
    isAvailable(capability?: string): boolean {
        return runtime.isAvailable(capability);
    },
    on(kind: string, handler: LinkInboundHandler): () => void {
        return runtime.on(kind, handler);
    },
    snapshot(
        kind: string,
        data?: unknown,
        options?: LinkSnapshotOptions,
    ): void {
        runtime.snapshot(kind, data, options);
    },
    status(): LinkStatus {
        return runtime.status();
    },
});
