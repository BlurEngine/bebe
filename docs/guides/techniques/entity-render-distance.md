# Minecraft Bedrock Entity Render Distance

## Purpose

Minecraft Bedrock stops rendering normal entities once they are far enough from the player. `RenderAnchors` keeps distant entity-like visuals visible by maintaining per-observer carrier records near each player while generated resource-pack animation renders the authored entity at its configured world location.

This technique is for scenery and feature visuals that already fit Minecraft's entity model: geometry, textures, render controllers, animations, Molang, and entity properties. It extends what players see; it does not extend server simulation, chunk ticking, pathing, collisions, or real interaction reach.

## Use It When

- an authored entity visual needs to stay visible beyond normal entity render range
- a fixed animated model needs to stay visible, such as a crane, windmill, clock, watermill, sign, portal, or large decorative machine
- the visual can be separated from the server-side gameplay object that owns collision, interaction, rewards, persistence, or inventory
- the project wants Bebe and the CLI to own the render-distance workaround instead of putting tick loops, proxy entities, generated animations, or packet details in gameplay source files

## Core Model

An anchor is a named render target for an existing Minecraft entity. The authored entity remains normal Minecraft JSON, and `render-anchors.json` says where that entity should appear from far away.

```json
{
  "anchors": [
    {
      "id": "harbour.crane",
      "entity": "demo:crane",
      "location": [320, 80, -48]
    }
  ]
}
```

`dimension` defaults to `minecraft:overworld`. `placement` defaults to a nearest-air strategy, a 16 block search radius, a 16 block reposition threshold, and the `auto` driver. `properties` defaults to `auto`, which keeps property support aligned with the source Minecraft entity.

At build time, the CLI asks `@blurengine/bebe/tooling/node` to compile the anchor. Bebe reads the existing client entity and geometry, generates a render-anchor variant, wraps the authored geometry in a Bebe-owned root bone, widens the generated visible bounds, injects Bebe-owned position animations before authored animations, generates the behaviour-pack carrier, writes `generated/bebe/render-anchors.json`, and injects bootstrap code that loads and starts `RenderAnchors`.

At runtime, one anchor can have one carrier record per observer. The default `auto` driver uses normal spawned carrier entities when Bedrock spawning is available. A custom packet or proxy driver can replace the generated bootstrap loop by calling `RenderAnchors.start(...)` with explicit `spawnEntity`, `moveEntity`, and `removeEntity` handlers. Gameplay code talks to the anchor id, and Bebe applies state to every live carrier instance.

```ts
import { RenderAnchors } from "@blurengine/bebe";

RenderAnchors.setState("harbour.crane", {
  "demo:arm_angle": 32,
  "demo:cargo_visible": true,
});
```

## Declaration Fields

Use `id` for the Bebe runtime id. This is the string passed to `RenderAnchors.setState(...)`, `RenderAnchors.getState(...)`, and `RenderAnchors.eachInstance(...)`.

Use `entity` for the existing Minecraft entity identifier that supplies the visual source. The CLI resolves the matching resource-pack client entity and behaviour-pack properties from authored project packs.

Use `location` for the world position where the visual appears. The generated client animations move Bebe's wrapper bone by combining current carrier-position compensation with the configured world offset, with Bedrock's model-space Z direction accounted for, so the carrier can stay near the viewer while the rendered model appears at the authored world position.

Use `dimension` when the anchor is not in the overworld.

Use `outputEntity` only when the generated carrier identifier must be stable for pack integration. Without it, Bebe derives an identifier from the source entity namespace and anchor id.

Use `placement` when the defaults are not right for a project. `nearestAir` searches readable blocks near the observer and falls back to the observer location when the dimension cannot be read or no air block is found within `searchRadius`. `repositionThreshold` controls how far the observer moves before Bebe repositions the carrier. `driver` controls whether Bebe should use the default spawned-carrier runtime: `auto` uses Bebe-managed spawned entities, while `packet` expects explicit runtime callbacks.

```json
{
  "anchors": [
    {
      "id": "harbour.crane",
      "entity": "demo:crane",
      "outputEntity": "demo:crane_far_view",
      "dimension": "minecraft:overworld",
      "location": [320, 80, -48],
      "placement": {
        "strategy": "nearestAir",
        "searchRadius": 16,
        "repositionThreshold": 16,
        "driver": "auto"
      }
    }
  ]
}
```

Use `properties` when the generated carrier should declare a focused Minecraft entity property set instead of copying the source entity property declaration.

```json
{
  "anchors": [
    {
      "id": "harbour.crane",
      "entity": "demo:crane",
      "location": [320, 80, -48],
      "properties": {
        "demo:arm_angle": {
          "type": "float",
          "default": 0
        },
        "demo:cargo_visible": {
          "type": "bool",
          "default": false
        }
      }
    }
  ]
}
```

## Ownership

Bebe owns the runtime work:

- one shared `RenderAnchors` registry for the whole runtime, similar in spirit to `Zones`
- one shared observer loop rather than one tick loop per anchor
- per-observer carrier records, movement throttling, state sync, and cleanup
- startup cleanup for stale generated carriers left behind by script reloads, using loaded observer dimensions or a custom driver hook
- state broadcasts from `RenderAnchors.setState(...)` to every live carrier instance
- imperative instance access through `RenderAnchors.eachInstance(...)` for power users that need direct control without a lifecycle event system

The CLI owns the generated asset work:

- reads `render-anchors.json`
- resolves the authored Minecraft entity JSON from project packs
- generates behaviour-pack carrier entities
- generates resource-pack client entity variants, wrapper geometry, widened visible bounds, carrier-position compensation animations, and fixed world-offset animations
- writes generated JSON into staged behaviour/resource packs without mutating authored source files
- injects runtime bootstrap before the authored entry file

Gameplay projects own intent:

- the source Minecraft entity, models, textures, render controllers, and authored animations
- the anchor declaration
- gameplay state updates such as crane angle, watermill speed, or cargo visibility
- real gameplay entities, blocks, collision, interaction, persistence, rewards, and inventory

## Important Behaviours

`RenderAnchors` extends visuals only. Use normal server systems for gameplay authority, collision, hit tests, triggers, persistence, and rewards.

The generated carrier entity has no gameplay meaning by default. It exists to carry client rendering and entity property state. With the default driver it is still a real spawned entity, so Bebe generates it as hidden, non-interactive, collision-free, non-pushable, persistent, and biased towards visual stability when it is repositioned.

The source entity stays authored Minecraft JSON. Bebe's generated JSON lives in build output, so creators can keep reading and editing normal Bedrock files. Generated geometry points at a Bebe wrapper root and parents the source root bones under it; authored child bones and animations keep their original names.

An entity can already be multi-part. If a source entity renders a clock, windmill, watermill, or crane through bones, render controllers, and Molang, the anchor declaration does not need a separate `kind` or `parts` model.

State keys are Minecraft property identifiers. With `properties: "auto"`, `RenderAnchors.setState(...)` accepts boolean, finite number, and string values. With declared `properties`, Bebe validates each patch against the declared Minecraft-shaped property type before applying it to all live carrier instances for the anchor.

Movement is thresholded. Bebe only moves a carrier after the viewer has moved far enough to justify another update.

Cleanup follows Bebe ownership. When the registry is cleared, a runtime context is disposed, or a runtime-owned instance becomes invalid, Bebe removes the tracked carrier and state link. Externally tracked instances are untracked without removing the entity that external code owns.

Reload cleanup is best-effort and bounded. During the first runtime pass for each loaded observer dimension, `RenderAnchors` removes existing generated carriers for configured anchor output entities before it spawns replacement carriers. Custom drivers can provide `getExistingCarriers(...)` when their carrier source is not discoverable through the dimension, and can set `cleanupExistingCarriers` to `false` when another owner handles reload cleanup.

## Cost

Render anchors trade simplicity in gameplay code for generated asset complexity and runtime maintenance. Each visible anchor still has carrier instances, movement updates, state channels, widened client visible bounds, and generated pack files that must stay in sync with the declaration.

Generated carriers favour visual stability over movement bandwidth savings. Their behaviour-pack entity disables dropped spatial updates and enables motion-prediction hints so carrier teleports are less likely to produce visible artefacts.

This technique also creates a deliberate split between what players see and what the server simulates. The visible crane, windmill, watermill, or clock is a render surface; the gameplay system that makes it matter lives elsewhere.

## Choosing The Right API

Use `render-anchors.json` for static distant visuals that can be compiled from authored entity JSON.

Use `RenderAnchors.setState(...)` when gameplay needs to drive generated visual properties.

Use `RenderAnchors.eachInstance(...)` when advanced code needs direct access to the live carrier entities for one anchor.

Use `RenderAnchors.start(...)` with explicit driver callbacks when a project needs packet-backed or proxy-backed carriers instead of default spawned entities.

Use normal Bebe systems such as `Context`, `Zones`, maths helpers, and Bedrock edge helpers for the real gameplay around the visual.
