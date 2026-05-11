# BlurEngine Bebe Docs

These are the canonical guides for `@blurengine/bebe` and its public subpaths.

## Guides

- [Context Guide](./guides/context.md)
- [Context Patterns](./guides/context-patterns.md)
- [Stagger Guide](./guides/stagger.md)
- [Bedrock Guide](./guides/bedrock.md)
- [Catalog Guide](./guides/catalog.md)
- [Maths Guide](./guides/maths.md)
- [Voxels Guide](./guides/voxels.md)
- [Engine Philosophy](./guides/engine-philosophy.md)
- [Package Structure](./guides/package-structure.md)

## Start Here

- Start with the Context Guide if you are trying to understand ownership, cleanup, and runtime lifetimes.
- Read Context Patterns next if you want concrete ways to structure feature scopes and services.
- Read Stagger Guide when you want to stage owned work across ticks.
- Read Bedrock Guide when you want the engine to absorb API friction at the Bedrock edge.
- Read Catalog Guide when you want immutable block categories, vanilla block tags, or overlay-driven catalog customization.
- Start with the Maths Guide if you are working with vectors, facings, AABBs, voxel/grid helpers, tweens, or numeric helpers.
- Read Voxels Guide when you need voxel collections, neighbourhoods, stable keys, or flood-fill traversal.
- Read Engine Philosophy if you are deciding whether a new feature fits the current direction of `bebe`.
- Read Package Structure if you are choosing imports or navigating the repo.

## Scope

These docs cover:

- lifecycle ownership through `Context`
- derived local events through `EventSignal`
- root-level staggered runtime work
- the Bedrock edge helpers under `@blurengine/bebe/bedrock`
- the block catalog helpers and vanilla preset under `@blurengine/bebe/catalog`
- timers, subscriptions, child scopes, services, and tracked entities
- the public maths surface under `@blurengine/bebe/maths`
- the voxel/grid helpers that now live under `@blurengine/bebe/maths`
- defaults, edge cases, and behavior notes that matter when using `bebe` in Bedrock runtime code
