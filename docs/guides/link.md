# Link Guide

## Purpose

`Link` is Bebe's small runtime bridge for local tooling. It lets Bedrock server code publish events to a local host process and receive events back without asking gameplay authors to manage a transport directly.

Most projects should import `Link` from the root package:

```ts
import { Link } from "@blurengine/bebe";

Link.event("world.snapshot", {
  players: 3,
});

Link.snapshot("world.latest", {
  players: 3,
});
```

When no transport is installed, `Link.event(...)` and `Link.snapshot(...)` are safe no-ops and `Link.on(...)` keeps the registration ready for a compatible transport. This keeps offline and packaged-addon code simple: callers can write one authored entry, while build tooling decides whether the Link transport exists for the current runtime.

## Core Model

Handlers receive a small Link event object:

- `kind`: caller-defined event kind, usually namespaced
- `data`: optional JSON-compatible payload
- `meta`: optional bridge metadata

`Link.event(kind, data)` is fire-and-forget and appends to the bridge event stream. `Link.snapshot(kind, data, { key })` is also fire-and-forget, but marks the event as latest-retained state for tooling that should keep only the newest value. The optional `key` lets callers keep separate latest values for the same kind, such as one value per dimension or player.

Link transports place bridge details such as `id`, `source`, `t`, `retention`, and `retentionKey` inside `event.meta` for users who want them, while keeping those details away from the top-level event shape. Generated event ids are fixed-length base64-encoded UUIDv7 values.

## Receiving Events

Use `Link.on(kind, handler)` to listen for inbound events from the local bridge:

```ts
const stop = Link.on("my-addon.command", (event) => {
  console.warn(String(event.data));
});
```

Use `Link.on("*", handler)` when a service needs to observe every inbound event. The returned function unsubscribes the handler. If inbound Link is unavailable, the registration is retained and attaches when a compatible transport is installed.

## BDS Transport

`@blurengine/bebe/internal/link/bds` provides the Bedrock Dedicated Server HTTP transport used by `blr` when local Link support is enabled.

The BDS transport:

- sends outbound events on the `bds/default` stream by default
- polls inbound events from the `bridge/default` stream by default
- announces `bebe.link.ready` when the transport starts
- can log the BDS transport startup when a logger is provided
- reports `events` and `inbound` capabilities while available

The built-in dashboard can send inbound events, but the transport does not attach gameplay behavior to those events. Projects that want a dashboard command or message can opt in with `Link.on(...)` like any other inbound event.

Gameplay code normally does not import or install the BDS transport directly. `blr` injects it for the BDS behaviour-pack variant, owns it with a `Context`, and strips direct `Link` calls from the offline variant. Advanced runtime wiring can pass a `context` option to `installBdsLinkTransport(...)` so transport cleanup follows that lifecycle.

## Important Behaviours

- `Link.event(...)` returns immediately and is a safe no-op when no transport is available.
- `Link.snapshot(...)` returns immediately and is a safe no-op when no transport is available. It is for state-like data where only the newest value should be retained by tooling.
- `Link.on(...)` registers handler intent even when inbound Link is unavailable, then attaches it when a compatible transport is installed.
- `Link.isAvailable(...)`, `Link.capabilities()`, and `Link.status()` are diagnostics and tooling helpers, not guards that normal caller code needs before using `Link.event(...)` or `Link.on(...)`.
- Request/response style flows should be modeled as separate events and received with `Link.on(...)`.
- The bridge is local tooling infrastructure, not a persistence or multiplayer protocol.
