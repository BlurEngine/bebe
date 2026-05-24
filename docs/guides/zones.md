# Zones Guide

## Purpose

`Zones` is the friendly runtime surface for authored gameplay areas.

It registers pure extents by id, keeps them partitioned by dimension, and lets
gameplay code query which zones contain a point, intersect a box, or receive
enter, leave, and stay events for watched entities.

## Use It When

- gameplay needs named areas such as spawn, arenas, regions, or protected land
- several systems need to query the same static or semi-static areas
- code needs dimension-aware area lookup without managing its own indexes
- watched entities should trigger focused zone events without a noisy global event stream

## Core Model

`Zones` is a singleton. Import it from the root package and import extent
definitions from the maths package:

```ts
import { Zones } from "@blurengine/bebe";
import { blockExtent } from "@blurengine/bebe/maths";

const removeSpawn = Zones.register({
  id: "spawn",
  dimension: "minecraft:overworld",
  extent: blockExtent({ x: 0, y: 64, z: 0 }),
});

const hits = Zones.queryPoint({
  dimension: "minecraft:overworld",
  point: { x: 0.5, y: 64.5, z: 0.5 },
});
```

Static zone assets use JSON-shaped zone definitions. `Zones.load(...)` replaces
the active zone definitions without removing listeners or watched entities:

```ts
Zones.load({
  zones: [
    {
      id: "spawn",
      dimension: "minecraft:overworld",
      extent: {
        kind: "polygon",
        points: [
          [0, 0],
          [40, 0],
          [40, 40],
          [0, 40],
        ],
        y: { min: 60, max: 90 },
      },
    },
  ],
});
```

Use `extent.kind: "infinite"` when a zone should cover every finite point in a
dimension:

```ts
Zones.load({
  zones: [
    {
      id: "overworld",
      dimension: "minecraft:overworld",
      extent: { kind: "infinite" },
    },
  ],
});
```

`register(...)` returns an unregister function. If the same id is registered
again in the same dimension, the old unregister function will not remove the
replacement zone.

Zone methods use the same names for the same ideas:

- `id` is the zone id
- `dimension` is the dimension id or a dimension-like object
- `point` is either a vector or a live entity/player with `location` and
  `dimension`
- `extent` is the registered shape

Zone definitions are deliberately small. They carry only `id`, `dimension`,
and `extent`; systems such as quests, dialogue, labels, or permissions should
own their own data keyed by dimension and zone id.

For normal gameplay code, pass the entity or player as the point source so
`Zones` can read its current dimension and location:

```ts
const membership = Zones.membership({ point: player });

if (membership.has("spawn")) {
  // player is inside the spawn zone
}
```

Use `contains(...)` when code only needs to check one zone id:

```ts
const inSpawn = Zones.contains({
  id: "spawn",
  point: player,
});
```

Use `Zones.watch(...)` once an entity should be tracked by zone events:

```ts
Zones.onEnter(
  { id: "spawn", dimension: "minecraft:overworld" },
  ({ entity }) => {
    // entity entered overworld spawn
  },
);

Zones.onLeave(
  { id: "spawn", dimension: "minecraft:overworld" },
  ({ entity }) => {
    // entity left overworld spawn
  },
);

Zones.watch(player);
```

## Important Behaviours

`Zones` owns one shared registry for the runtime. It also owns the small
internal scheduling scope needed for watched entities. Callers should treat
returned cleanup functions as their own resources:

```ts
const stopWatching = Zones.watch(player);
ctx.use(stopWatching);
```

`Zones.clear()` resets registered zones, event listeners, and watched entity
state.

`Zones.load(...)` is intended for baked or draft zone packs. It updates the
active zone definitions but preserves listeners and watched entities so editor
tools can preview changes live. Use `Zones.clear()` when the whole runtime zone
system should be reset.

Dimensions are caller-supplied string ids or objects with an `id` field. This
keeps Bedrock-specific dimension objects at the edge while still preventing
overworld, nether, and custom dimension zones from sharing one lookup space.

Event listeners belong to one `{ id, dimension }` zone lookup. `Zones.watch(...)`
belongs to the singleton, so the same watched entity can move between dimensions
and trigger the matching dimension-scoped listeners. If a watched entity becomes
invalid or its location/dimension can no longer be read, `Zones` emits leave
events for its cached zones and removes the watcher state.

Watched entities are cached by id. If an entity has not moved and the zone
registry has not changed, `Zones` skips the membership query for that tick.
`onStay(...)` only fires when a watched entity is evaluated and remains in the
target zone; stationary entities do not generate repeated stay events.

`Zones.toPack()` returns the currently loaded source-style zone definitions
without compiled lookup data. It is intended for editor and tooling flows that
need to start from the active registry. If the registry contains runtime-only
custom extents that cannot be represented as JSON zone definitions,
`Zones.toPack()` throws instead of silently dropping them.

Internally, finite extents are indexed for broad-phase queries, and very large
or unbounded extents are handled through conservative fallback scans. That
implementation detail is owned by `Zones`; normal gameplay code should not need
to manage spatial indexes directly.

Baked zone packs can include compiled broad-phase lookup data. `Zones` uses
that data when it still matches the loaded definitions, and falls back to the
runtime index when the baked data is absent or stale. Dynamic `register(...)`
and `delete(...)` calls invalidate the baked lookup for safety, so temporary
runtime zones cannot be hidden by old asset metadata.

When baked lookup data proves that a watched entity is moving inside the same
empty index cell, `Zones` skips the exact membership query for that tick. This
is deliberately conservative: entering a populated cell, crossing dimensions,
or changing zone definitions still forces a normal evaluation.

`membership(...)` returns a snapshot for the query point. It includes the
matching zone ids, the matching zone records, and a `has(...)` helper for
readable checks. It does not start monitoring or subscribe to future movement.
Use `Zones.watch(...)` for entity movement monitoring.

`queryPoint(...)` returns the raw matching zone records. It is useful for
systems that need the full lookup result. `membership(...)` is the friendlier
gameplay snapshot for common "is this thing inside this named area?" checks.

## Choosing The Right API

Use extents when you need to define a shape.

Use `Zones` when you need to name, store, and query those shapes by dimension.

Use `membership(...)` and `contains(...)` for most authored gameplay.

Use `queryPoint(...)` and `queryAABB(...)` when the caller is building a more
specialised system on top of the same registry.

Use `Zones.load(...)` for JSON-backed zone packs from CLI or editor tooling.
Bebe owns the zone definition contract, and the Node tooling subpath
`@blurengine/bebe/tooling/node` exposes the asset compiler that `blr` resolves
from the project installation. Runtime gameplay code should keep using the root
`Zones` API instead of importing tooling.

## Editing Zones In Dev

`blr dev` injects Bebe's internal zone editor by default. The editor starts
from the active `Zones` registry, previews changes in memory with
`Zones.load(...)`, and asks `blr` to write `zones.json` only when the creator
runs `save`.

When `blr` injects the editor, the command uses the project's configured
namespace. In a project with `"namespace": "demo_pack"`, use `/demo_pack:zone`.

Common commands:

```text
/demo_pack:zone status
/demo_pack:zone list
/demo_pack:zone block town.spawn
/demo_pack:zone box-start town.market
/demo_pack:zone box-end town.market
/demo_pack:zone polygon-start town.route 60 90
/demo_pack:zone polygon-add
/demo_pack:zone polygon-finish
/demo_pack:zone delete town.market
/demo_pack:zone discard
/demo_pack:zone save
```

Each command uses the executing player's current dimension. This keeps zone ids
unambiguous when the same id exists in another dimension.

The editor also supports block-interaction tools once a player selects a mode:

```text
/demo_pack:zone tool box-start town.market
/demo_pack:zone tool box-end town.market
/demo_pack:zone tool polygon-add
/demo_pack:zone tool clear
```

During `blr dev --local-server`, `save` sends a Bebe Link event to the local
`blr` process, which normalises the pack through
`@blurengine/bebe/tooling/node` and writes `zones.json` only when the source
content changes. If Link is not available, the request is ignored like any
other `Link.event(...)` call.

The editor is a development tool. BLR includes it for `dev` unless
`bebe.zoneEditor.dev` is false, and excludes it from packaged builds unless
`bebe.zoneEditor.package` is true.

Use `Zones.register(...)` for dynamic runtime zones such as temporary auras,
claims, or generated encounters.
