# Metrics Guide

`Metrics` is a small Prometheus-style in-memory registry for runtime visibility. It stores numeric samples by metric name and labels. Users define a metric once, then record values through the returned handle.

## Counters

Counters only increase and should end in `_total`:

```ts
import { Metrics } from "@blurengine/bebe";

const catches = Metrics.counter("example_fish_caught_total", {
  help: "Total fish caught by players.",
  labelNames: ["rarity"],
});

catches.count({ rarity: "common" });
catches.add(3, { rarity: "rare" });
```

## Gauges

Gauges represent current values and can move up or down:

```ts
const activeSessions = Metrics.gauge("example_active_sessions", {
  help: "Current active session count.",
});

activeSessions.set(12);
activeSessions.inc();
activeSessions.dec();
```

## Histograms

Histograms record observations as buckets, sum, and count. Durations should normally use seconds:

```ts
const tickWork = Metrics.histogram("example_tick_work_seconds", {
  help: "Time spent running project tick work.",
});

tickWork.observe(0.012);
```

## Labels

Labels are declared as `labelNames`, matching common Prometheus client libraries. Bebe validates that recorded samples include exactly those label keys, but it does not restrict label values.

Prefer stable, low-cardinality labels such as `transport`, `reason`, `kind`, or `rarity`. Avoid labels that can grow without bound, such as player names, URLs, event ids, or raw error messages.

## Plaintext Output

`Metrics.toPrometheusText()` returns Prometheus exposition text:

```ts
const text = Metrics.toPrometheusText();
```

`blr` can forward Bebe metrics snapshots through Link and render `text/plain` event payloads directly in the local dashboard.
