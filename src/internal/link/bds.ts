import {
    HttpHeader,
    HttpRequest,
    HttpRequestMethod,
    http,
} from "@minecraft/server-net";
import { Context } from "../../context.js";
import {
    installLinkTransport,
    type LinkEvent,
    type LinkEventResult,
    type LinkEventTransport,
    type LinkInboundHandler,
    type LinkStatus,
} from "../../link.js";
import { Metrics } from "../../metrics.js";

export type BdsLinkHttpRequest = {
    url: string;
    method: "GET" | "POST";
    headers?: Record<string, string>;
    body?: string;
    timeout?: number;
};

export type BdsLinkHttpResponse = {
    status: number;
    body?: string;
};

export interface BdsLinkHttpClient {
    request(input: BdsLinkHttpRequest): Promise<BdsLinkHttpResponse>;
}

export interface BdsLinkLogger {
    log(message: string): void;
}

export type BdsLinkStreamTarget = {
    ns: string;
    key: string;
};

export type BdsLinkTransportOptions = {
    autoStart?: boolean;
    baseUrl: string;
    context?: Context;
    flushTicks?: number;
    httpClient?: BdsLinkHttpClient;
    inbound?: BdsLinkStreamTarget;
    logger?: BdsLinkLogger;
    metricsTicks?: number;
    outbound?: BdsLinkStreamTarget;
    pollTicks?: number;
    timeout?: number;
    token?: string;
};

const DEFAULT_INBOUND: BdsLinkStreamTarget = {
    ns: "bridge",
    key: "default",
};
const DEFAULT_OUTBOUND: BdsLinkStreamTarget = {
    ns: "bds",
    key: "default",
};
const BDS_LINK_TRANSPORT_LABELS = Object.freeze({
    transport: "bds_http",
});
const METRICS_SNAPSHOT_KIND = "bebe.metrics.snapshot";
const METRICS_SNAPSHOT_CONTENT_TYPE =
    "text/plain; version=0.0.4; charset=utf-8";
const UUID_BASE64_ALPHABET =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const BDS_LINK_BRIDGE_UP = Metrics.gauge("bebe_link_bridge_up", {
    help: "Whether the last Link bridge HTTP request succeeded.",
    labelNames: ["transport"],
});
const BDS_LINK_TRANSPORT_ENABLED = Metrics.gauge(
    "bebe_link_transport_enabled",
    {
        help: "Whether the BDS Link transport is enabled locally.",
        labelNames: ["transport"],
    },
);
const BDS_LINK_EVENTS_FLUSHED = Metrics.counter(
    "bebe_link_events_flushed_total",
    {
        help: "Total Link events flushed to the bridge.",
        labelNames: ["transport"],
    },
);
const BDS_LINK_EVENTS_QUEUED = Metrics.counter(
    "bebe_link_events_queued_total",
    {
        help: "Total Link events queued for transport.",
        labelNames: ["transport"],
    },
);
const BDS_LINK_FLUSH_DURATION = Metrics.histogram(
    "bebe_link_flush_duration_seconds",
    {
        help: "Time spent flushing Link events.",
        labelNames: ["transport", "result"],
    },
);
const BDS_LINK_FLUSH_FAILURES = Metrics.counter(
    "bebe_link_flush_failures_total",
    {
        help: "Total Link flush failures.",
        labelNames: ["transport", "reason"],
    },
);
const BDS_LINK_HANDLER_FAILURES = Metrics.counter(
    "bebe_link_handler_failures_total",
    {
        help: "Total Link inbound handler failures.",
        labelNames: ["transport", "kind"],
    },
);
const BDS_LINK_INBOUND_EVENTS = Metrics.counter(
    "bebe_link_inbound_events_total",
    {
        help: "Total inbound Link events received by the BDS transport.",
        labelNames: ["transport", "kind"],
    },
);
const BDS_LINK_POLL_FAILURES = Metrics.counter(
    "bebe_link_poll_failures_total",
    {
        help: "Total Link polling failures.",
        labelNames: ["transport", "reason"],
    },
);
const BDS_LINK_QUEUE_SIZE = Metrics.gauge("bebe_link_queue_size", {
    help: "Current Link event queue size.",
    labelNames: ["transport"],
});

function trimBaseUrl(baseUrl: string): string {
    return baseUrl.replace(/\/+$/, "");
}

function streamEventsUrl(baseUrl: string, target: BdsLinkStreamTarget): string {
    return [
        baseUrl,
        "api/link/streams",
        encodeURIComponent(target.ns),
        encodeURIComponent(target.key),
        "events",
    ].join("/");
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function randomByte(): number {
    return Math.floor(Math.random() * 256) & 0xff;
}

function writeUuid7Timestamp(bytes: Uint8Array, timestamp: number): void {
    let value = Math.max(0, Math.min(Math.floor(timestamp), 0xffffffffffff));
    for (let index = 5; index >= 0; index -= 1) {
        bytes[index] = value & 0xff;
        value = Math.floor(value / 256);
    }
}

function encodeBase64(bytes: Uint8Array): string {
    let output = "";
    for (let index = 0; index < bytes.length; index += 3) {
        const first = bytes[index];
        const hasSecond = index + 1 < bytes.length;
        const hasThird = index + 2 < bytes.length;
        const second = hasSecond ? bytes[index + 1] : 0;
        const third = hasThird ? bytes[index + 2] : 0;
        output += UUID_BASE64_ALPHABET[first >> 2];
        output += UUID_BASE64_ALPHABET[((first & 0x03) << 4) | (second >> 4)];
        output += !hasSecond
            ? "="
            : UUID_BASE64_ALPHABET[((second & 0x0f) << 2) | (third >> 6)];
        output += !hasThird ? "=" : UUID_BASE64_ALPHABET[third & 0x3f];
    }
    return output;
}

function createUuid7Base64(timestamp: number): string {
    const bytes = new Uint8Array(16);
    writeUuid7Timestamp(bytes, timestamp);
    for (let index = 6; index < bytes.length; index += 1) {
        bytes[index] = randomByte();
    }
    bytes[6] = 0x70 | (bytes[6] & 0x0f);
    bytes[8] = 0x80 | (bytes[8] & 0x3f);
    return encodeBase64(bytes);
}

function normalizeLinkEventMeta(value: unknown): LinkEvent["meta"] {
    const meta = isRecord(value) ? value : {};
    return {
        ...meta,
        id: typeof meta.id === "string" ? meta.id : undefined,
        source: typeof meta.source === "string" ? meta.source : undefined,
        t:
            typeof meta.t === "number" && Number.isFinite(meta.t)
                ? meta.t
                : undefined,
    };
}

function parseEventsResponse(body: string | undefined): LinkEvent[] {
    if (!body) {
        return [];
    }

    try {
        const parsed = JSON.parse(body) as { events?: unknown };
        if (!Array.isArray(parsed.events)) {
            return [];
        }

        return parsed.events
            .map((event): LinkEvent | undefined => {
                if (!event || typeof event !== "object") {
                    return undefined;
                }
                const record = event as Record<string, unknown>;
                const kind = record.kind;
                if (typeof kind !== "string" || kind.length === 0) {
                    return undefined;
                }

                return {
                    kind,
                    data: record.data,
                    meta: normalizeLinkEventMeta(record.meta),
                };
            })
            .filter((event): event is LinkEvent => Boolean(event));
    } catch {
        return [];
    }
}

function dispatchHandlers(
    handlersByKind: Map<string, Set<LinkInboundHandler>>,
    event: LinkEvent,
    onError: (error: unknown) => void,
): void {
    const handlers = [
        ...(handlersByKind.get(event.kind) ?? []),
        ...(handlersByKind.get("*") ?? []),
    ];
    for (const handler of handlers) {
        try {
            void Promise.resolve(handler(event)).catch(onError);
        } catch (error) {
            onError(error);
        }
    }
}

function removeHandler(
    handlersByKind: Map<string, Set<LinkInboundHandler>>,
    kind: string,
    handler: LinkInboundHandler,
): void {
    const handlers = handlersByKind.get(kind);
    if (!handlers) {
        return;
    }

    handlers.delete(handler);
    if (handlers.size === 0) {
        handlersByKind.delete(kind);
    }
}

function buildHeaders(
    token: string | undefined,
    contentType?: string,
): Record<string, string> {
    const headers: Record<string, string> = {
        "x-bebe-client": "bds",
    };
    if (token && token.length > 0) {
        headers.authorization = `Bearer ${token}`;
    }
    if (contentType) {
        headers["content-type"] = contentType;
    }
    return headers;
}

function resolveHttpRequestMethod(
    method: BdsLinkHttpRequest["method"],
): HttpRequestMethod {
    const expected = method.toUpperCase();
    const methods = HttpRequestMethod as unknown as Record<
        string,
        HttpRequestMethod | string | number | undefined
    >;

    for (const [key, value] of Object.entries(methods)) {
        if (key.toUpperCase() === expected && value !== undefined) {
            return value as HttpRequestMethod;
        }
    }
    for (const value of Object.values(methods)) {
        if (typeof value === "string" && value.toUpperCase() === expected) {
            return value as HttpRequestMethod;
        }
    }

    throw new Error(`Unsupported server-net HTTP method: ${method}`);
}

export function createNativeBdsLinkHttpClient(): BdsLinkHttpClient {
    return {
        async request(input) {
            const request = new HttpRequest(input.url);
            request.setMethod(resolveHttpRequestMethod(input.method));
            if (input.timeout !== undefined) {
                request.setTimeout(input.timeout);
            }
            if (input.body !== undefined) {
                request.setBody(input.body);
            }
            const headers = Object.entries(input.headers ?? {}).map(
                ([key, value]) => new HttpHeader(key, value),
            );
            if (headers.length > 0) {
                request.setHeaders(headers);
            }

            const response = await http.request(request);
            return {
                status: response.status,
                body: response.body,
            };
        },
    };
}

export class BdsLinkTransport implements LinkEventTransport {
    readonly #baseUrl: string;
    readonly #flushTicks: number;
    readonly #handlers = new Map<string, Set<LinkInboundHandler>>();
    readonly #httpClient: BdsLinkHttpClient;
    readonly #inbound: BdsLinkStreamTarget;
    readonly #logger?: BdsLinkLogger;
    readonly #metricsTicks: number;
    readonly #outbound: BdsLinkStreamTarget;
    readonly #ownerContext?: Context;
    readonly #pollTicks: number;
    readonly #queue: LinkEvent[] = [];
    readonly #timeout: number;
    readonly #token?: string;
    #context: Context | undefined;
    #disposed = false;
    #flushInFlight = false;
    #pollInFlight = false;
    #since = 0;

    constructor(options: BdsLinkTransportOptions) {
        this.#baseUrl = trimBaseUrl(options.baseUrl);
        this.#flushTicks = options.flushTicks ?? 20;
        this.#httpClient =
            options.httpClient ?? createNativeBdsLinkHttpClient();
        this.#inbound = options.inbound ?? DEFAULT_INBOUND;
        this.#logger = options.logger;
        this.#metricsTicks = options.metricsTicks ?? 100;
        this.#outbound = options.outbound ?? DEFAULT_OUTBOUND;
        this.#ownerContext = options.context;
        this.#pollTicks = options.pollTicks ?? 20;
        this.#timeout = options.timeout ?? 5;
        this.#token = options.token;
        this.#setTransportEnabledMetric();
        this.#setBridgeUpMetric(false);
        this.#setQueueSizeMetric();

        if (options.autoStart !== false) {
            this.start();
        }
    }

    capabilities(): readonly string[] {
        return ["events", "inbound"];
    }

    dispose(): void {
        this.#disposed = true;
        this.#context?.dispose();
        this.#context = undefined;
        this.#handlers.clear();
        this.#queue.length = 0;
        this.#setTransportEnabledMetric();
        this.#setBridgeUpMetric(false);
        this.#setQueueSizeMetric();
    }

    event(event: LinkEvent): LinkEventResult {
        if (!this.isAvailable("events")) {
            return {
                ok: false,
                reason: "transport unavailable",
            };
        }

        this.#queueSubmittedEvent(event);
        return { ok: true };
    }

    #queueSubmittedEvent(event: LinkEvent): void {
        const timestamp = Date.now();
        this.#queue.push({
            ...event,
            meta: {
                ...event.meta,
                id: createUuid7Base64(timestamp),
                source: "bds",
                t: timestamp,
            },
        });
        BDS_LINK_EVENTS_QUEUED.count(BDS_LINK_TRANSPORT_LABELS);
        this.#setQueueSizeMetric();
    }

    #queueReadyEvent(capabilities: readonly string[]): void {
        this.#queueSubmittedEvent({
            kind: "bebe.link.ready",
            data: {
                capabilities,
            },
            meta: {
                transport: "bds-http",
            },
        });
    }

    #setBridgeUpMetric(up: boolean): void {
        BDS_LINK_BRIDGE_UP.set(up ? 1 : 0, BDS_LINK_TRANSPORT_LABELS);
    }

    #setTransportEnabledMetric(): void {
        BDS_LINK_TRANSPORT_ENABLED.set(
            this.isAvailable() ? 1 : 0,
            BDS_LINK_TRANSPORT_LABELS,
        );
    }

    #setQueueSizeMetric(): void {
        BDS_LINK_QUEUE_SIZE.set(this.#queue.length, BDS_LINK_TRANSPORT_LABELS);
    }

    queueMetricsSnapshot(): void {
        const text = Metrics.toPrometheusText();
        if (text.length === 0) {
            return;
        }

        const existingIndex = this.#queue.findIndex(
            (event) => event.kind === METRICS_SNAPSHOT_KIND,
        );
        if (existingIndex >= 0) {
            this.#queue.splice(existingIndex, 1);
            this.#setQueueSizeMetric();
        }
        this.#queueSubmittedEvent({
            kind: METRICS_SNAPSHOT_KIND,
            data: {
                contentType: METRICS_SNAPSHOT_CONTENT_TYPE,
                text,
            },
            meta: {
                format: "prometheus-text",
                retention: "latest",
                retentionKey: "bebe.metrics",
            },
        });
    }

    async flush(): Promise<void> {
        if (this.#disposed || this.#flushInFlight || this.#queue.length === 0) {
            return;
        }

        this.#flushInFlight = true;
        const sendCount = this.#queue.length;
        const payload = this.#queue.slice(0, sendCount);
        const url = streamEventsUrl(this.#baseUrl, this.#outbound);
        const startedAt = Date.now();
        try {
            const response = await this.#httpClient.request({
                url,
                method: "POST",
                headers: buildHeaders(this.#token, "application/json"),
                body: JSON.stringify(payload),
                timeout: this.#timeout,
            });
            if (response.status >= 200 && response.status < 300) {
                this.#queue.splice(0, sendCount);
                this.#setBridgeUpMetric(true);
                BDS_LINK_EVENTS_FLUSHED.add(
                    sendCount,
                    BDS_LINK_TRANSPORT_LABELS,
                );
                BDS_LINK_FLUSH_DURATION.observe(
                    (Date.now() - startedAt) / 1000,
                    {
                        ...BDS_LINK_TRANSPORT_LABELS,
                        result: "ok",
                    },
                );
            } else {
                this.#setBridgeUpMetric(false);
                BDS_LINK_FLUSH_FAILURES.count({
                    ...BDS_LINK_TRANSPORT_LABELS,
                    reason: "http_status",
                });
                BDS_LINK_FLUSH_DURATION.observe(
                    (Date.now() - startedAt) / 1000,
                    {
                        ...BDS_LINK_TRANSPORT_LABELS,
                        result: "failed",
                    },
                );
            }
        } catch (error) {
            this.#setBridgeUpMetric(false);
            BDS_LINK_FLUSH_FAILURES.count({
                ...BDS_LINK_TRANSPORT_LABELS,
                reason: "network",
            });
            BDS_LINK_FLUSH_DURATION.observe((Date.now() - startedAt) / 1000, {
                ...BDS_LINK_TRANSPORT_LABELS,
                result: "failed",
            });
        } finally {
            this.#flushInFlight = false;
            this.#setQueueSizeMetric();
        }
    }

    isAvailable(capability?: string): boolean {
        if (this.#disposed || this.#baseUrl.length === 0) {
            return false;
        }

        return capability ? this.capabilities().includes(capability) : true;
    }

    on(kind: string, handler: LinkInboundHandler): () => void {
        if (!this.isAvailable("inbound")) {
            return () => {};
        }

        const handlers =
            this.#handlers.get(kind) ?? new Set<LinkInboundHandler>();
        handlers.add(handler);
        this.#handlers.set(kind, handlers);
        return () => {
            removeHandler(this.#handlers, kind, handler);
        };
    }

    async poll(): Promise<void> {
        if (this.#disposed || this.#pollInFlight) {
            return;
        }

        this.#pollInFlight = true;
        const url = `${streamEventsUrl(this.#baseUrl, this.#inbound)}?since=${encodeURIComponent(String(this.#since))}`;
        try {
            const response = await this.#httpClient.request({
                url,
                method: "GET",
                headers: buildHeaders(this.#token),
                timeout: this.#timeout,
            });
            if (response.status < 200 || response.status >= 300) {
                this.#setBridgeUpMetric(false);
                BDS_LINK_POLL_FAILURES.count({
                    ...BDS_LINK_TRANSPORT_LABELS,
                    reason: "http_status",
                });
                return;
            }

            this.#setBridgeUpMetric(true);
            const events = parseEventsResponse(response.body);
            for (const event of events) {
                BDS_LINK_INBOUND_EVENTS.count({
                    ...BDS_LINK_TRANSPORT_LABELS,
                    kind: event.kind,
                });
                if (typeof event.meta?.t === "number") {
                    this.#since = Math.max(this.#since, event.meta.t);
                }
                dispatchHandlers(this.#handlers, event, (error) => {
                    BDS_LINK_HANDLER_FAILURES.count({
                        ...BDS_LINK_TRANSPORT_LABELS,
                        kind: event.kind,
                    });
                });
            }
        } catch (error) {
            this.#setBridgeUpMetric(false);
            BDS_LINK_POLL_FAILURES.count({
                ...BDS_LINK_TRANSPORT_LABELS,
                reason: "network",
            });
        } finally {
            this.#pollInFlight = false;
        }
    }

    start(): void {
        if (this.#context || this.#disposed) {
            return;
        }

        const context = this.#ownerContext?.createScope() ?? new Context();
        context.interval(this.#flushTicks, () => {
            void this.flush();
        });
        context.interval(this.#pollTicks, () => {
            void this.poll();
        });
        context.interval(this.#metricsTicks, () => {
            this.queueMetricsSnapshot();
        });
        context.run(() => {
            void this.flush();
            void this.poll();
        });
        this.#context = context;
        this.#setTransportEnabledMetric();
        this.#logger?.log("[Bebe Link] BDS transport ready.");
        this.#queueReadyEvent(this.capabilities());
    }

    status(): LinkStatus {
        if (this.isAvailable()) {
            return {
                available: true,
                capabilities: this.capabilities(),
            };
        }

        return {
            available: false,
            capabilities: [],
            reason: this.#disposed ? "transport disposed" : "missing base URL",
        };
    }
}

export function createBdsLinkTransport(
    options: BdsLinkTransportOptions,
): BdsLinkTransport {
    return new BdsLinkTransport(options);
}

/**
 * Installs the BDS Link HTTP transport.
 *
 * This is for `blr` bootstrap/runtime wiring. Gameplay projects should import
 * `Link` from `@blurengine/bebe` instead of installing this transport directly.
 */
export function installBdsLinkTransport(
    options: BdsLinkTransportOptions,
): BdsLinkTransport {
    const transport = createBdsLinkTransport(options);
    const uninstall = installLinkTransport(transport);
    options.context?.use(
        () => {
            uninstall();
            transport.dispose();
        },
        { priority: "first" },
    );
    return transport;
}
