# BlurEngine Bebe

Game engine library for Minecraft Bedrock scripting.

> Warning: `bebe` is still in an early stage of development. Backward compatibility is not guaranteed yet, and breaking changes may happen while the public engine surface is still being shaped.

## Packages

- `@blurengine/bebe`: engine lifecycle, ownership, and runtime primitives
- `@blurengine/bebe/maths`: vectors, AABBs, tweens, and numeric helpers
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

- Provide a game engine layer for Bedrock scripting that can own runtime work, compose features, and grow into higher-level engine systems over time.
- Keep timers, subscriptions, spawned feature scopes, and other runtime work owned by one `Context`.
- Provide a separate maths surface for vector, AABB, tween, and scalar helpers without making the root package feel overloaded.

## Documentation

- [Docs Index](./docs/README.md)
- [Context Guide](./docs/guides/context.md)
- [Maths Guide](./docs/guides/maths.md)
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
