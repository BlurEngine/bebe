import { afterEach, describe, expect, it, vi } from "vitest";
import { Context } from "../src/context.js";
import {
    Link,
    clearLinkTransport,
    installLinkTransport,
    type LinkEvent,
    type LinkEventTransport,
    type LinkInboundHandler,
} from "../src/link.js";
import { clearMetrics, Metrics } from "../src/metrics.js";

class FakeLinkTransport implements LinkEventTransport {
    readonly sent: LinkEvent[] = [];
    readonly handlers = new Map<string, Set<LinkInboundHandler>>();
    capabilityList = ["events", "inbound"] as readonly string[];
    available = true;

    capabilities(): readonly string[] {
        return this.capabilityList;
    }

    isAvailable(capability?: string): boolean {
        if (!this.available) {
            return false;
        }
        return capability ? this.capabilities().includes(capability) : true;
    }

    status() {
        return {
            available: this.available,
            capabilities: this.capabilities(),
            reason: this.available ? undefined : "transport disabled",
        };
    }

    event(event: LinkEvent): boolean {
        this.sent.push(event);
        return true;
    }

    on(kind: string, handler: LinkInboundHandler): () => void {
        const handlers =
            this.handlers.get(kind) ?? new Set<LinkInboundHandler>();
        handlers.add(handler);
        this.handlers.set(kind, handlers);
        return () => {
            handlers.delete(handler);
        };
    }

    emit(event: LinkEvent): void {
        for (const handler of this.handlers.get(event.kind) ?? []) {
            handler(event);
        }
    }
}

describe("Link", () => {
    afterEach(() => {
        clearLinkTransport();
        clearMetrics();
    });

    it("is unavailable and no-ops without an installed transport", () => {
        clearLinkTransport();

        expect(Link.event("quest.started", { id: "intro" })).toBeUndefined();
        expect(Link.isAvailable()).toBe(false);
        expect(Link.isAvailable("events")).toBe(false);
        expect(Link.capabilities()).toEqual([]);
        expect(Link.status()).toEqual({
            available: false,
            capabilities: [],
            reason: "no transport installed",
        });
    });

    it("fire-and-forgets events through the installed transport", () => {
        const transport = new FakeLinkTransport();
        clearLinkTransport();
        installLinkTransport(transport);

        expect(Link.event("quest.started", { id: "intro" })).toBeUndefined();
        expect(transport.sent).toEqual([
            {
                kind: "quest.started",
                data: { id: "intro" },
            },
        ]);
        expect(Link.isAvailable()).toBe(true);
        expect(Link.isAvailable("events")).toBe(true);
        expect(Link.capabilities()).toEqual(["events", "inbound"]);
    });

    it("fire-and-forgets latest snapshots through the installed transport", () => {
        const transport = new FakeLinkTransport();
        clearLinkTransport();
        installLinkTransport(transport);

        expect(
            Link.snapshot("world.debug", { players: 2 }, { key: "overworld" }),
        ).toBeUndefined();
        expect(transport.sent).toEqual([
            {
                kind: "world.debug",
                data: { players: 2 },
                meta: {
                    retention: "latest",
                    retentionKey: "overworld",
                },
            },
        ]);
    });

    it("uninstalls the active transport through the returned disposer", () => {
        const transport = new FakeLinkTransport();
        clearLinkTransport();

        const uninstall = installLinkTransport(transport);
        expect(Link.isAvailable()).toBe(true);

        uninstall();

        expect(Link.isAvailable()).toBe(false);
        expect(Link.status()).toEqual({
            available: false,
            capabilities: [],
            reason: "no transport installed",
        });
    });

    it("can bind the active transport to a Context lifecycle", () => {
        const ctx = new Context();
        const transport = new FakeLinkTransport();
        clearLinkTransport();

        installLinkTransport(transport, { context: ctx });
        expect(Link.isAvailable()).toBe(true);

        ctx.dispose();

        expect(Link.isAvailable()).toBe(false);
    });

    it("contains transport send failures", async () => {
        const transport = new FakeLinkTransport();
        const sendFailures = Metrics.counter("bebe_link_send_failures_total", {
            help: "Total Link send failures.",
            labelNames: ["kind"],
        });
        transport.event = () => Promise.reject(new Error("bridge down"));
        clearLinkTransport();
        installLinkTransport(transport);

        expect(() => Link.event("quest.started")).not.toThrow();
        await Promise.resolve();

        expect(sendFailures.get({ kind: "quest.started" })).toBe(1);
    });

    it("subscribes to inbound events through the installed transport", () => {
        const transport = new FakeLinkTransport();
        const handler = vi.fn();
        clearLinkTransport();
        installLinkTransport(transport);

        const unsubscribe = Link.on("project.message", handler);
        transport.emit({
            kind: "project.message",
            meta: {
                id: "event-1",
                source: "dashboard",
                t: 123,
                transport: "test",
            },
            data: { text: "hello" },
        });
        unsubscribe();
        transport.emit({
            kind: "project.message",
            meta: {
                id: "event-2",
                source: "dashboard",
                t: 124,
            },
            data: { text: "ignored" },
        });

        expect(handler).toHaveBeenCalledTimes(1);
        expect(handler.mock.calls[0]?.[0]).not.toHaveProperty("id");
        expect(handler.mock.calls[0]?.[0]).not.toHaveProperty("source");
        expect(handler.mock.calls[0]?.[0]).not.toHaveProperty("t");
        expect(handler).toHaveBeenCalledWith({
            kind: "project.message",
            data: { text: "hello" },
            meta: {
                id: "event-1",
                source: "dashboard",
                t: 123,
                transport: "test",
            },
        });
    });

    it("retains inbound registrations until inbound Link is available", () => {
        const unavailableTransport = new FakeLinkTransport();
        const availableTransport = new FakeLinkTransport();
        const handler = vi.fn();
        unavailableTransport.capabilityList = ["events"];
        clearLinkTransport();
        installLinkTransport(unavailableTransport);

        const unsubscribe = Link.on("project.message", handler);
        unavailableTransport.emit({
            kind: "project.message",
            data: { text: "ignored" },
        });
        installLinkTransport(availableTransport);
        availableTransport.emit({
            kind: "project.message",
            data: { text: "hello" },
        });

        expect(unsubscribe).toBeTypeOf("function");
        expect(unavailableTransport.handlers.size).toBe(0);
        expect(handler).toHaveBeenCalledOnce();
        expect(handler).toHaveBeenCalledWith({
            kind: "project.message",
            data: { text: "hello" },
        });

        unsubscribe();
        availableTransport.emit({
            kind: "project.message",
            data: { text: "ignored after unsubscribe" },
        });
        expect(handler).toHaveBeenCalledOnce();
    });

    it("keeps inbound registrations across transport uninstall and reinstall", () => {
        const firstTransport = new FakeLinkTransport();
        const secondTransport = new FakeLinkTransport();
        const handler = vi.fn();
        clearLinkTransport();
        const uninstall = installLinkTransport(firstTransport);

        const unsubscribe = Link.on("project.message", handler);
        firstTransport.emit({
            kind: "project.message",
            data: { text: "first" },
        });
        uninstall();
        firstTransport.emit({
            kind: "project.message",
            data: { text: "detached" },
        });
        installLinkTransport(secondTransport);
        secondTransport.emit({
            kind: "project.message",
            data: { text: "second" },
        });

        expect(handler).toHaveBeenCalledTimes(2);
        expect(handler.mock.calls[0]?.[0]).toEqual({
            kind: "project.message",
            data: { text: "first" },
        });
        expect(handler.mock.calls[1]?.[0]).toEqual({
            kind: "project.message",
            data: { text: "second" },
        });

        unsubscribe();
    });
});
