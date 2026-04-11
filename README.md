# BlurEngine Bebe

Game engine library for Minecraft Bedrock scripting.

> Warning: `bebe` is still in an early stage of development. Backward compatibility is not guaranteed yet, and breaking changes may happen while the public engine surface is still being shaped.

## Packages

- `@blurengine/bebe`: engine lifecycle, ownership, and runtime scheduling primitives
- `@blurengine/bebe/bedrock`: Bedrock edge helpers for block, slot, item, and durability work
- `@blurengine/bebe/catalog`: immutable block catalogs plus the built-in vanilla preset
- `@blurengine/bebe/maths`: vectors, facings, AABBs, voxel/grid helpers, tweens, and numeric helpers
- `npm install @blurengine/bebe @minecraft/server`

## Quick Start

```ts
import { Context } from "@blurengine/bebe";
import { tweenNumber } from "@blurengine/bebe/maths";

const ctx = new Context();

tweenNumber(ctx, {
  from: 0,
  to: 1,
  durationTicks: 20,
  onUpdate(value) {
    console.warn(`progress: ${Math.round(value * 100)}%`);
  },
});
```

## What Bebe Is For

- Provide a game engine layer for Bedrock scripting that can own runtime work, compose runtime systems, and grow into higher-level engine systems over time.
- Keep timers, subscriptions, spawned child scopes, and other runtime work owned by one `Context`.
- Provide small runtime helpers for staging owned work over ticks.
- Keep Bedrock-specific friction at the edge through reusable helpers instead of repeating the same safety and fallback code inside gameplay features.
- Provide an opt-in block catalog surface so Bedrock features can query curated vanilla block categories without carrying giant local tables.
- Provide a separate maths surface for vector, facing, AABB, voxel/grid, tween, and scalar helpers without making the root package feel overloaded.

## Documentation

- [Docs Index](./docs/README.md)
- [Context Guide](./docs/guides/context.md)
- [Stagger Guide](./docs/guides/stagger.md)
- [Bedrock Guide](./docs/guides/bedrock.md)
- [Catalog Guide](./docs/guides/catalog.md)
- [Maths Guide](./docs/guides/maths.md)
- [Voxels Guide](./docs/guides/voxels.md)
- [Changelog](./CHANGELOG.md)

## Development

```bash
npm install
npm run check
```

## License

Licensed under the Apache License, Version 2.0. See [LICENSE](./LICENSE).

## Open Source

- [Contributing Guide](./CONTRIBUTING.md)
- [Security Policy](./SECURITY.md)
