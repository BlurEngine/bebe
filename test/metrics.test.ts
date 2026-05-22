import { afterEach, describe, expect, it } from "vitest";
import { clearMetrics, Metrics } from "../src/metrics.js";

describe("Metrics", () => {
    afterEach(() => {
        clearMetrics();
    });

    it("records counters by metric name and labels", () => {
        const queued = Metrics.counter("bebe_link_events_queued_total", {
            help: "Total Link events queued for transport.",
            labelNames: ["transport"],
        });

        queued.count({ transport: "bds_http" });
        queued.add(2, { transport: "bds_http" });

        expect(queued.get({ transport: "bds_http" })).toBe(3);
        expect(() => queued.add(-1, { transport: "bds_http" })).toThrow(
            /counter/i,
        );
        expect(() =>
            Metrics.counter("bebe_link_events_queued", {
                help: "Counter names should be explicit.",
            }),
        ).toThrow(/_total/);
    });

    it("records gauges that can move up and down", () => {
        const queueSize = Metrics.gauge("bebe_link_queue_size", {
            help: "Current Link event queue size.",
            labelNames: ["transport"],
        });

        queueSize.set(3, { transport: "bds_http" });
        queueSize.inc({ transport: "bds_http" });
        queueSize.dec({ transport: "bds_http" });
        queueSize.add(-2, { transport: "bds_http" });

        expect(queueSize.get({ transport: "bds_http" })).toBe(1);
    });

    it("validates declared label names without constraining label values", () => {
        const failures = Metrics.counter("bebe_link_poll_failures_total", {
            help: "Total Link polling failures.",
            labelNames: ["transport", "reason"],
        });

        failures.count({ transport: "bds_http", reason: "network" });
        failures.count({ transport: "bds_http", reason: "timeout" });

        expect(failures.get({ transport: "bds_http", reason: "network" })).toBe(
            1,
        );
        expect(failures.get({ transport: "bds_http", reason: "timeout" })).toBe(
            1,
        );
        expect(() => failures.count({ transport: "bds_http" })).toThrow(
            /missing label reason/i,
        );
        expect(() =>
            failures.count({
                transport: "bds_http",
                reason: "network",
                url: "http://localhost",
            }),
        ).toThrow(/unexpected label url/i);
    });

    it("shares samples across handles for the same metric regardless of definition order", () => {
        const first = Metrics.counter("example_ordered_events_total", {
            help: "Total ordered events.",
            labelNames: ["source"],
        });

        first.count({ source: "startup" });

        const second = Metrics.counter("example_ordered_events_total", {
            help: "Total ordered events.",
            labelNames: ["source"],
        });

        second.add(2, { source: "startup" });

        expect(first.get({ source: "startup" })).toBe(3);
        expect(second.get({ source: "startup" })).toBe(3);
        expect(Metrics.toPrometheusText()).toContain(
            'example_ordered_events_total{source="startup"} 3',
        );
    });

    it("keeps existing metric handles connected after samples are cleared", () => {
        const ready = Metrics.gauge("example_runtime_ready", {
            help: "Whether the runtime is ready.",
        });

        ready.set(1);
        clearMetrics();
        ready.set(2);

        expect(ready.get()).toBe(2);
        expect(Metrics.toPrometheusText()).toContain("example_runtime_ready 2");
    });

    it("records histogram observations as buckets, sum, and count", () => {
        const duration = Metrics.histogram("bebe_link_flush_duration_seconds", {
            help: "Time spent flushing Link events.",
            labelNames: ["transport"],
            buckets: [0.1, 0.5],
        });

        duration.observe(0.2, { transport: "bds_http" });
        duration.observe(1, { transport: "bds_http" });

        expect(duration.get({ transport: "bds_http" })).toEqual({
            count: 2,
            sum: 1.2,
            buckets: [
                { le: 0.1, count: 0 },
                { le: 0.5, count: 1 },
                { le: "+Inf", count: 2 },
            ],
        });
    });

    it("exports the registry as Prometheus plaintext", () => {
        const failures = Metrics.counter("example_link_flush_failures_total", {
            help: "Total example Link flush failures.",
            labelNames: ["transport", "reason"],
        });
        const queueSize = Metrics.gauge("example_link_queue_size", {
            help: "Current example Link event queue size.",
            labelNames: ["transport"],
        });
        const duration = Metrics.histogram(
            "example_link_poll_duration_seconds",
            {
                help: "Time spent polling example Link events.",
                labelNames: ["transport"],
                buckets: [0.1],
            },
        );

        failures.count({ transport: "bds_http", reason: "network" });
        queueSize.set(2, { transport: "bds_http" });
        duration.observe(0.2, { transport: "bds_http" });

        expect(Metrics.toPrometheusText()).toBe(
            [
                "# HELP example_link_flush_failures_total Total example Link flush failures.",
                "# TYPE example_link_flush_failures_total counter",
                'example_link_flush_failures_total{transport="bds_http",reason="network"} 1',
                "# HELP example_link_queue_size Current example Link event queue size.",
                "# TYPE example_link_queue_size gauge",
                'example_link_queue_size{transport="bds_http"} 2',
                "# HELP example_link_poll_duration_seconds Time spent polling example Link events.",
                "# TYPE example_link_poll_duration_seconds histogram",
                'example_link_poll_duration_seconds_bucket{transport="bds_http",le="0.1"} 0',
                'example_link_poll_duration_seconds_bucket{transport="bds_http",le="+Inf"} 1',
                'example_link_poll_duration_seconds_sum{transport="bds_http"} 0.2',
                'example_link_poll_duration_seconds_count{transport="bds_http"} 1',
                "",
            ].join("\n"),
        );
    });
});
