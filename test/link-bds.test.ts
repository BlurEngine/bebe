import { afterEach, describe, expect, it, vi } from "vitest";
import { http } from "@minecraft/server-net";
import { Context } from "../src/context.js";
import { Link, clearLinkTransport, type LinkEvent } from "../src/link.js";
import { clearMetrics, Metrics } from "../src/metrics.js";
import {
    createNativeBdsLinkHttpClient,
    installBdsLinkTransport,
    type BdsLinkHttpClient,
} from "@blurengine/bebe/internal/link/bds";

class FakeHttpClient implements BdsLinkHttpClient {
    readonly requests: Array<{
        url: string;
        method: string;
        headers: Record<string, string>;
        body?: string;
        timeout?: number;
    }> = [];
    responses: Array<{ status: number; body?: string }> = [];

    async request(input: {
        url: string;
        method: string;
        headers?: Record<string, string>;
        body?: string;
        timeout?: number;
    }): Promise<{ status: number; body?: string }> {
        this.requests.push({
            url: input.url,
            method: input.method,
            headers: input.headers ?? {},
            body: input.body,
            timeout: input.timeout,
        });
        return this.responses.shift() ?? { status: 200, body: '{"ok":true}' };
    }
}

function decodeUuid7Base64Id(id: string): Uint8Array {
    return new Uint8Array(Buffer.from(id, "base64"));
}

function readUuid7Timestamp(bytes: Uint8Array): number {
    let timestamp = 0n;
    for (let index = 0; index < 6; index += 1) {
        timestamp = (timestamp << 8n) | BigInt(bytes[index]);
    }
    return Number(timestamp);
}

function expectUuid7Base64Id(id: unknown, timestamp: number): void {
    expect(typeof id).toBe("string");
    const value = id as string;
    expect(value).toMatch(/^[A-Za-z0-9+/]{22}==$/u);
    const bytes = decodeUuid7Base64Id(value);
    expect(bytes).toHaveLength(16);
    expect(bytes[6] & 0xf0).toBe(0x70);
    expect(bytes[8] & 0xc0).toBe(0x80);
    expect(readUuid7Timestamp(bytes)).toBe(timestamp);
}

describe("BDS Link transport", () => {
    afterEach(() => {
        clearLinkTransport();
        clearMetrics();
    });

    it("resolves native server-net method enum names defensively", async () => {
        const requestSpy = vi.spyOn(http, "request");
        const client = createNativeBdsLinkHttpClient();

        await client.request({
            url: "http://localhost:19150/api/link/streams/bds/default/events",
            method: "POST",
            headers: { "content-type": "application/json" },
            body: "[]",
            timeout: 5,
        });

        const request = requestSpy.mock.calls[0]?.[0];
        expect(request?.method).toBe("POST");
        expect(request?.headers.map((header) => header.key)).toContain(
            "content-type",
        );
        expect(request?.body).toBe("[]");
        expect(request?.timeout).toBe(5);
        requestSpy.mockRestore();
    });

    it("posts queued outbound Link events to the configured bridge stream", async () => {
        const httpClient = new FakeHttpClient();
        const queued = Metrics.counter("bebe_link_events_queued_total", {
            help: "Total Link events queued for transport.",
            labelNames: ["transport"],
        });
        const flushed = Metrics.counter("bebe_link_events_flushed_total", {
            help: "Total Link events flushed to the bridge.",
            labelNames: ["transport"],
        });
        const queueSize = Metrics.gauge("bebe_link_queue_size", {
            help: "Current Link event queue size.",
            labelNames: ["transport"],
        });
        clearLinkTransport();
        const transport = installBdsLinkTransport({
            autoStart: false,
            baseUrl: "http://127.0.0.1:19150",
            httpClient,
            token: "session-token",
        });

        expect(Link.event("quest.started", { id: "intro" })).toBeUndefined();
        await transport.flush();

        expect(httpClient.requests).toHaveLength(1);
        const request = httpClient.requests[0];
        expect(request.url).toBe(
            "http://127.0.0.1:19150/api/link/streams/bds/default/events",
        );
        expect(request.method).toBe("POST");
        expect(request.headers).toEqual({
            authorization: "Bearer session-token",
            "content-type": "application/json",
            "x-bebe-client": "bds",
        });
        expect(request.timeout).toBe(5);
        const [event] = JSON.parse(request.body ?? "[]") as LinkEvent[];
        expect(event).toEqual(
            expect.objectContaining({
                kind: "quest.started",
                data: { id: "intro" },
                meta: expect.objectContaining({
                    id: expect.any(String),
                    source: "bds",
                    t: expect.any(Number),
                }),
            }),
        );
        expectUuid7Base64Id(event?.meta?.id, event?.meta?.t ?? 0);
        expect(queued.get({ transport: "bds_http" })).toBe(1);
        expect(flushed.get({ transport: "bds_http" })).toBe(1);
        expect(queueSize.get({ transport: "bds_http" })).toBe(0);
    });

    it("polls inbound bridge events and dispatches matching Link handlers", async () => {
        const httpClient = new FakeHttpClient();
        httpClient.responses.push({
            status: 200,
            body: JSON.stringify({
                events: [
                    {
                        kind: "project.message",
                        data: { text: "hello" },
                        meta: {
                            id: "bridge-event-1",
                            source: "dashboard",
                            t: 123,
                        },
                    },
                ],
            }),
        });
        const handler = vi.fn();
        const anyHandler = vi.fn();
        clearLinkTransport();
        const transport = installBdsLinkTransport({
            autoStart: false,
            baseUrl: "http://127.0.0.1:19150/",
            httpClient,
            token: "session-token",
        });
        Link.on("project.message", handler);
        Link.on("*", anyHandler);

        await transport.poll();

        expect(httpClient.requests).toEqual([
            {
                url: "http://127.0.0.1:19150/api/link/streams/bridge/default/events?since=0",
                method: "GET",
                headers: {
                    authorization: "Bearer session-token",
                    "x-bebe-client": "bds",
                },
                body: undefined,
                timeout: 5,
            },
        ]);
        const expectedEvent = expect.objectContaining({
            kind: "project.message",
            data: { text: "hello" },
            meta: expect.objectContaining({
                id: "bridge-event-1",
                source: "dashboard",
                t: 123,
            }),
        });
        expect(handler).toHaveBeenCalledWith(expectedEvent);
        expect(anyHandler).toHaveBeenCalledWith(expectedEvent);
        expect(handler.mock.calls[0]?.[0]).not.toHaveProperty("id");
        expect(handler.mock.calls[0]?.[0]).not.toHaveProperty("source");
        expect(handler.mock.calls[0]?.[0]).not.toHaveProperty("t");
    });

    it("continues inbound dispatch when a Link handler fails", async () => {
        const httpClient = new FakeHttpClient();
        httpClient.responses.push({
            status: 200,
            body: JSON.stringify({
                events: [
                    {
                        kind: "project.message",
                        data: { text: "hello" },
                        meta: {
                            id: "bridge-event-2",
                            source: "dashboard",
                            t: 123,
                        },
                    },
                ],
            }),
        });
        const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
        const handlerFailures = Metrics.counter(
            "bebe_link_handler_failures_total",
            {
                help: "Total Link inbound handler failures.",
                labelNames: ["transport", "kind"],
            },
        );
        const syncFailure = vi.fn(() => {
            throw new Error("sync failure");
        });
        const asyncFailure = vi.fn(async () => {
            throw new Error("async failure");
        });
        const handler = vi.fn();
        clearLinkTransport();
        const transport = installBdsLinkTransport({
            autoStart: false,
            baseUrl: "http://127.0.0.1:19150/",
            httpClient,
        });
        Link.on("project.message", syncFailure);
        Link.on("project.message", asyncFailure);
        Link.on("project.message", handler);

        await transport.poll();
        await Promise.resolve();

        expect(syncFailure).toHaveBeenCalledTimes(1);
        expect(asyncFailure).toHaveBeenCalledTimes(1);
        expect(handler).toHaveBeenCalledWith({
            kind: "project.message",
            data: { text: "hello" },
            meta: expect.objectContaining({
                id: "bridge-event-2",
                source: "dashboard",
                t: 123,
            }),
        });
        expect(
            handlerFailures.get({
                transport: "bds_http",
                kind: "project.message",
            }),
        ).toBe(2);
        expect(warn).not.toHaveBeenCalled();
        warn.mockRestore();
    });

    it("announces a ready event when the transport starts", async () => {
        const httpClient = new FakeHttpClient();
        const logger = {
            log: vi.fn(),
        };
        clearLinkTransport();
        const transport = installBdsLinkTransport({
            autoStart: false,
            baseUrl: "http://127.0.0.1:19150",
            flushTicks: 999,
            httpClient,
            logger,
            pollTicks: 999,
        });

        transport.start();
        await transport.flush();
        transport.dispose();

        expect(logger.log).toHaveBeenCalledWith(
            "[Bebe Link] BDS transport ready.",
        );
        expect(httpClient.requests).toHaveLength(1);
        const [event] = JSON.parse(
            httpClient.requests[0].body ?? "[]",
        ) as LinkEvent[];
        expect(event).toEqual(
            expect.objectContaining({
                kind: "bebe.link.ready",
                data: expect.objectContaining({
                    capabilities: ["events", "inbound"],
                }),
                meta: expect.objectContaining({
                    id: expect.any(String),
                    source: "bds",
                    t: expect.any(Number),
                    transport: "bds-http",
                }),
            }),
        );
        expectUuid7Base64Id(event?.meta?.id, event?.meta?.t ?? 0);
    });

    it("treats dashboard message events as ordinary inbound events", async () => {
        const httpClient = new FakeHttpClient();
        httpClient.responses.push({
            status: 200,
            body: JSON.stringify({
                events: [
                    {
                        kind: "project.message",
                        data: { message: "hello from dashboard" },
                        meta: {
                            id: "bridge-event-3",
                            source: "dashboard",
                            t: 123,
                        },
                    },
                ],
            }),
        });
        const handler = vi.fn();
        const log = vi.spyOn(console, "log").mockImplementation(() => {});
        clearLinkTransport();
        const transport = installBdsLinkTransport({
            autoStart: false,
            baseUrl: "http://127.0.0.1:19150",
            httpClient,
        });
        Link.on("project.message", handler);

        await transport.poll();

        expect(handler).toHaveBeenCalledWith(
            expect.objectContaining({
                kind: "project.message",
                data: { message: "hello from dashboard" },
            }),
        );
        expect(log).not.toHaveBeenCalled();
        log.mockRestore();
    });

    it("can be owned by a Context lifecycle", () => {
        const ctx = new Context();
        const httpClient = new FakeHttpClient();
        clearLinkTransport();

        const transport = installBdsLinkTransport({
            autoStart: false,
            baseUrl: "http://127.0.0.1:19150",
            context: ctx,
            httpClient,
        });

        expect(Link.isAvailable()).toBe(true);

        ctx.dispose();

        expect(Link.isAvailable()).toBe(false);
        expect(transport.status()).toEqual({
            available: false,
            capabilities: [],
            reason: "transport disposed",
        });
    });

    it("records metrics when BDS cannot reach the Link server", async () => {
        const httpClient: BdsLinkHttpClient = {
            async request() {
                throw new Error("connection refused");
            },
        };
        const failures = Metrics.counter("bebe_link_flush_failures_total", {
            help: "Total Link flush failures.",
            labelNames: ["transport", "reason"],
        });
        const queueSize = Metrics.gauge("bebe_link_queue_size", {
            help: "Current Link event queue size.",
            labelNames: ["transport"],
        });
        clearLinkTransport();
        const transport = installBdsLinkTransport({
            autoStart: false,
            baseUrl: "http://localhost:19150",
            httpClient,
        });

        expect(Link.event("quest.started")).toBeUndefined();
        await transport.flush();
        await transport.flush();

        expect(failures.get({ transport: "bds_http", reason: "network" })).toBe(
            2,
        );
        expect(queueSize.get({ transport: "bds_http" })).toBe(1);
    });

    it("tracks transport enablement separately from bridge reachability", async () => {
        const httpClient = new FakeHttpClient();
        const transportEnabled = Metrics.gauge("bebe_link_transport_enabled", {
            help: "Whether the BDS Link transport is enabled locally.",
            labelNames: ["transport"],
        });
        const bridgeUp = Metrics.gauge("bebe_link_bridge_up", {
            help: "Whether the last Link bridge HTTP request succeeded.",
            labelNames: ["transport"],
        });
        clearLinkTransport();
        const transport = installBdsLinkTransport({
            autoStart: false,
            baseUrl: "http://localhost:19150",
            httpClient,
        });

        expect(transportEnabled.get({ transport: "bds_http" })).toBe(1);
        expect(bridgeUp.get({ transport: "bds_http" })).toBe(0);

        Link.event("quest.started");
        await transport.flush();

        expect(bridgeUp.get({ transport: "bds_http" })).toBe(1);

        httpClient.responses.push({ status: 500, body: "{}" });
        await transport.poll();

        expect(bridgeUp.get({ transport: "bds_http" })).toBe(0);

        transport.dispose();

        expect(transportEnabled.get({ transport: "bds_http" })).toBe(0);
        expect(bridgeUp.get({ transport: "bds_http" })).toBe(0);
    });

    it("queues a plaintext Metrics snapshot for the dashboard", async () => {
        const httpClient = new FakeHttpClient();
        clearLinkTransport();
        const transport = installBdsLinkTransport({
            autoStart: false,
            baseUrl: "http://localhost:19150",
            httpClient,
        });

        Link.event("quest.started");
        transport.queueMetricsSnapshot();
        await transport.flush();

        const events = JSON.parse(httpClient.requests[0].body ?? "[]") as Array<
            LinkEvent & { data?: { contentType?: string; text?: string } }
        >;
        const snapshot = events.find(
            (event) => event.kind === "bebe.metrics.snapshot",
        );
        expect(snapshot?.data?.contentType).toBe(
            "text/plain; version=0.0.4; charset=utf-8",
        );
        expect(snapshot?.meta?.retention).toBe("latest");
        expect(snapshot?.meta?.retentionKey).toBe("bebe.metrics");
        expect(snapshot?.data?.text).toContain(
            "# TYPE bebe_link_queue_size gauge",
        );
        expect(snapshot?.data?.text).toContain(
            "# TYPE bebe_link_bridge_up gauge",
        );
        expect(snapshot?.data?.text).not.toContain("bebe_link_available");
        expect(snapshot?.data?.text).toContain(
            'bebe_link_events_queued_total{transport="bds_http"}',
        );
    });
});
