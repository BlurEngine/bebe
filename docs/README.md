# BlurEngine Bebe Docs

These are the canonical guides for `@blurengine/bebe` and its public subpaths.

## Guides

- [Context Guide](./guides/context.md)
- [Context Patterns](./guides/context-patterns.md)
- [Stagger Guide](./guides/stagger.md)
- [Zones Guide](./guides/zones.md)
- [Bedrock Guide](./guides/bedrock.md)
- [Catalog Guide](./guides/catalog.md)
- [Fishing Guide](./guides/fishing.md)
- [Link Guide](./guides/link.md)
- [Metrics Guide](./guides/metrics.md)
- [Maths Guide](./guides/maths.md)
- [Voxels Guide](./guides/voxels.md)
- [Engine Philosophy](./guides/engine-philosophy.md)
- [Package Structure](./guides/package-structure.md)

## Start Here

- Start with the Context Guide if you are trying to understand ownership, cleanup, and runtime lifetimes.
- Read Context Patterns next if you want concrete ways to structure feature scopes and services.
- Read Stagger Guide when you want to stage owned work across ticks.
- Read Zones Guide when you want to register extents, query named areas, or watch zone membership by dimension.
- Read Bedrock Guide when you want the engine to absorb API friction at the Bedrock edge.
- Read Catalog Guide when you want immutable block categories, vanilla block tags, or overlay-driven catalog customization.
- Read Fishing Guide when you want derived events around vanilla fishing casts, bites, reels, and catches.
- Read Link Guide when you want local tooling messages between BDS runtime code and `blr`.
- Read Metrics Guide when you want Prometheus-style counters, gauges, histograms, labels, or plaintext metric snapshots.
- Start with the Maths Guide if you are working with vectors, facings, AABBs, extents, voxel/grid helpers, tweens, or numeric helpers.
- Read Voxels Guide when you need voxel collections, neighbourhoods, stable keys, or flood-fill traversal.
- Read Engine Philosophy if you are deciding whether a new feature fits the current direction of `bebe`.
- Read Package Structure if you are choosing imports or navigating the repo.

## Scope

These docs cover:

- lifecycle ownership through `Context`
- derived local events through `EventSignal`
- root-level staggered runtime work
- the root-level `Zones` singleton for dimension-partitioned area lookup and entity watching
- the Bedrock edge helpers under `@blurengine/bebe/bedrock`
- the block catalog helpers and vanilla preset under `@blurengine/bebe/catalog`
- the fishing feature helpers under `@blurengine/bebe/features/fishing`
- the local tooling bridge exposed as `Link`
- the Prometheus-style runtime metrics registry exposed as `Metrics`
- timers, subscriptions, child scopes, services, and tracked entities
- the public maths surface under `@blurengine/bebe/maths`
- the Node-only build tooling surface under `@blurengine/bebe/tooling/node`
- the pure extent primitives that live under `@blurengine/bebe/maths`
- the voxel/grid helpers that now live under `@blurengine/bebe/maths`
- defaults, edge cases, and behavior notes that matter when using `bebe` in Bedrock runtime code
