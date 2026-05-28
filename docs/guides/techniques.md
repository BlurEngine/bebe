# Techniques Guide

Concise Minecraft Bedrock problem patterns that benefit from Bebe-owned runtime work.

## Rendering And Visual Range

### [Minecraft Bedrock Entity Render Distance](./techniques/entity-render-distance.md)

- **Goal:** keep entity-like visuals visible beyond the normal entity render range.
- **Bebe fit:** `RenderAnchors` owns one shared observer loop, per-observer carrier records, generated client offsets, state sync, reload cleanup, and normal runtime cleanup.
- **Cost:** extra anchor actors, movement updates, generated resource-pack coupling, state channels, and interaction split between visuals and server logic.
