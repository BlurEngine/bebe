# BlurEngine Bebe Docs

These are the canonical guides for `@blurengine/bebe` and its public subpaths.

## Guides

- [Context Guide](./guides/context.md)
- [Context Patterns](./guides/context-patterns.md)
- [Maths Guide](./guides/maths.md)
- [Engine Philosophy](./guides/engine-philosophy.md)
- [Package Structure](./guides/package-structure.md)

## Start Here

- Start with the Context Guide if you are trying to understand ownership, cleanup, and feature lifetimes.
- Read Context Patterns next if you want concrete ways to structure feature scopes and services.
- Start with the Maths Guide if you are working with vectors, AABBs, tweens, or numeric helpers.
- Read Engine Philosophy if you are deciding whether a new feature fits the current direction of `bebe`.
- Read Package Structure if you are choosing imports or navigating the repo.

## Scope

These docs cover:

- lifecycle ownership through `Context`
- timers, subscriptions, child scopes, services, and tracked entities
- the public maths surface under `@blurengine/bebe/maths`
- defaults, edge cases, and behavior notes that matter when using `bebe` in Bedrock runtime code
