# Locations Guide

## Purpose

`Locations` is the static, dimension-qualified registry for exact authored
world locations. It gives generated content and runtime features one shared
coordinate and orientation vocabulary without turning a point into a zone or
giving Bebe ownership of what the point means.

Use it when a build pipeline has already compiled named locations and several
runtime consumers need to look them up consistently.

The pack is data, not authored runtime source. Bebe does not require generated
location packs to live under a project's `src/` directory. A creative project
may keep them beside the world-derived inputs that produced them, then load or
bundle the pack through its normal build pipeline.

Import from `@blurengine/bebe/locations` when a build tool, test, or focused
runtime module needs only authored locations. The root package continues to
re-export `Locations` for normal gameplay code.

## Definition

```ts
import { Locations } from "@blurengine/bebe";

Locations.load({
  version: 1,
  locations: [
    {
      id: "main-spawn",
      dimension: "minecraft:overworld",
      location: { x: 0.5, y: 80, z: 0.5 },
      orientation: { yaw: 90, pitch: 0 },
      lines: ["main-spawn", "@name", "spawn"],
    },
  ],
});

const spawn = Locations.get({
  dimension: "minecraft:overworld",
  id: "main-spawn",
});
```

Identity is the pair `(dimension, id)`. The same id can exist in different
dimensions, but duplicates inside one dimension are rejected.

Coordinates remain exact finite numbers. The normaliser does not round block
centres, remove fractional offsets, or convert orientation to a Bedrock
rotation shape. `orientation` uses the shared degree-valued `YawPitch`
convention.

## Opaque Lines

`lines` is an optional ordered string list. Every string, empty row, and row
beyond the fourth is preserved. Bebe deliberately assigns no meaning to any
row: it does not recognise directives, anonymous ids, objects, zones,
furniture, trains, or project assets.

Node tooling exposes `parseMarkerText(...)` for newline normalisation only. It
normalises CRLF and CR to LF, removes at most one terminal delimiter, and
returns every remaining row. A world reader or project compiler remains
responsible for deciding which signs are valid, how ids are allocated, and
what their rows mean.

## Static Ownership

`Locations` has no `start`, timer, entity, or `Context` lifecycle. Loading a
pack validates the whole replacement before changing the registry. Invalid
loads leave the previous valid pack available.

Use `Zones` instead when code needs spatial membership or enter/leave events.
Use a project feature or reusable content package when a location should place
blocks, spawn entities, or run gameplay behaviour.
