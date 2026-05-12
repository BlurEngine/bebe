# Fishing Guide

## Purpose

The fishing feature derives a small set of events around vanilla fishing.

Use it when the Bedrock scripting API exposes the rod, hook, item, and entity
events separately, but feature code wants one coherent fishing lifecycle.

## Use It When

- a feature needs to react when a player casts a vanilla fishing rod
- a feature needs to know when a tracked hook first reaches water
- a feature needs a practical hook-bite signal
- a feature needs to observe reel and catch outcomes without rewriting hook
  tracking in each project

## Core Model

Import the feature from `@blurengine/bebe/features/fishing` and install it
against a `Context`.

```ts
import { Context } from "@blurengine/bebe";
import { installFishingEvents } from "@blurengine/bebe/features/fishing";

const ctx = new Context();
const fishing = installFishingEvents(ctx);

ctx.subscribe(fishing.afterEvents.catch, (event) => {
  console.warn(`${event.player.name} caught ${event.itemStack.typeId}`);
});
```

The returned object exposes derived `afterEvents`:

- `cast`
- `hookWater`
- `hookBite`
- `reel`
- `catch`

Each event keeps the shape close to Minecraft scripting API events: entities are
the original Bedrock `Player` and `Entity` objects, item stacks are copied where
the API provides a stack to copy, and locations use `Vec3`.

## Important Behaviours

### Ownership

`installFishingEvents(...)` creates subscriptions and a polling interval owned by
the supplied `Context`.

Disposing that context tears the monitor down.

### Hook Matching

The monitor matches a spawned `minecraft:fishing_hook` to a recent fishing rod
use in the same dimension near the player.

If Bedrock reports the hook spawn without a matching recent rod event, the
monitor falls back to the nearest player holding a fishing rod within the
configured hook match radius.

### Bites

`hookBite` is a derived signal, not a direct vanilla API event.

The monitor watches tracked hook movement in water. A bite is emitted when the
hook is old enough, still in water, outside the bite cooldown, and either drops
vertically enough or has enough downward velocity.

This intentionally avoids treating the initial splash as a bite.

### Catches

`catch` is emitted when a caught item is associated with a tracked reel.

When the caught item still exists as an item entity, the event includes
`itemEntity`. Projects that want to suppress the vanilla item pickup can remove
that entity directly. The monitor does not remove XP orbs.

If the item has already reached the player through `entityItemPickup`, the
event has no `itemEntity` because vanilla has already completed the pickup.

## Choosing The Right API

- project wants lifecycle-owned fishing events -> `installFishingEvents(ctx)`
- project wants to tune matching or bite detection -> pass a partial
  `FishingEventConfig`
- project only needs low-level item entity stack reads -> use
  `getEntityItemStack(...)` from `@blurengine/bebe/bedrock`

Keep project-specific rewards, custom loot, XP handling, and UI feedback outside
the shared fishing monitor. The monitor owns detection and derived events; the
project owns gameplay decisions.
