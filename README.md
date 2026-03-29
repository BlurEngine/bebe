# BlurEngine Bebe

Standalone context and lifecycle utilities for Minecraft Bedrock scripting.

## Package

- `@blurengine/bebe`: context and lifecycle layer for Minecraft Bedrock scripting
- `npm install @blurengine/bebe @minecraft/server`
- exports: `@blurengine/bebe`

## Usage

```ts
import { Context } from "@blurengine/bebe";

const ctx = new Context();

ctx.timeout(20, () => {
  // ...
});

ctx.dispose();
```

## Docs

- [Changelog](./CHANGELOG.md)

## Local Development

- `npm install`
- `npm run check`

## License

Licensed under the Apache License, Version 2.0. See [LICENSE](./LICENSE).

## Open Source

- [Contributing Guide](./CONTRIBUTING.md)
- [Security Policy](./SECURITY.md)
