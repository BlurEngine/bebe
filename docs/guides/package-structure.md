# Package Structure

## Purpose

This guide explains how `bebe` is structured today, both as a public package and as a repository.

Use it when you are choosing imports, navigating the codebase, or deciding where a new piece of code should live.

## Use It When

- you are deciding which public import path to use
- you are contributing to the repo and need to know where authored code belongs
- you want to understand the split between runtime primitives, zones, and the maths surface
- you want to navigate the repo without reverse-engineering it from the file tree

## Core Model

`bebe` has six authored package surfaces today:

- `@blurengine/bebe`
- `@blurengine/bebe/bedrock`
- `@blurengine/bebe/catalog`
- `@blurengine/bebe/features/fishing`
- `@blurengine/bebe/maths`
- `@blurengine/bebe/tooling/node`

It also has internal subpaths used by `blr` for injected runtime wiring:

- `@blurengine/bebe/internal/link/bds`
- `@blurengine/bebe/internal/audio/player`
- `@blurengine/bebe/internal/zones/editor`

The root package stays focused on lifecycle, runtime ownership, and reusable
runtime primitives such as `Zones`.

The Bedrock subpath holds:

- safe block reads
- block mutation helpers
- slot and item helpers
- durability helpers

The catalog subpath holds:

- immutable block catalogs
- structured tag queries
- overlay helpers
- the built-in vanilla block preset

The fishing feature subpath holds:

- derived vanilla fishing events
- hook session tracking
- catch item helpers

The maths subpath holds:

- vectors
- facings
- AABBs
- extents
- voxel/grid helpers
- tweens
- numeric helpers

The tooling subpath holds Node-only build/compiler surfaces for tools such as
`blr`. Gameplay code should not import it; runtime authors should use the root
`Zones` API instead.

The internal subpaths are not authored gameplay APIs. They exist so `blr` can
inject BDS Link transport and development/editor runtime code without asking
project authors to wire those concerns by hand.

That split is intentional. It keeps the root package small while still letting the engine expose a broader maths and tooling surface.

## Important Areas

### Public Package Surface

The public authored entrypoints are:

- [src/index.ts](../../src/index.ts)
- [src/context.ts](../../src/context.ts)
- [src/zones.ts](../../src/zones.ts)
- [src/catalog/index.ts](../../src/catalog/index.ts)
- [src/maths/index.ts](../../src/maths/index.ts)
- [src/tooling/node.ts](../../src/tooling/node.ts)
- [src/internal/link/bds.ts](../../src/internal/link/bds.ts)
- [src/internal/audio/player.ts](../../src/internal/audio/player.ts)
- [src/internal/zones/editor.ts](../../src/internal/zones/editor.ts)

As a consumer, the important import paths are:

- `@blurengine/bebe`
- `@blurengine/bebe/bedrock`
- `@blurengine/bebe/catalog`
- `@blurengine/bebe/features/fishing`
- `@blurengine/bebe/maths`
- `@blurengine/bebe/tooling/node` for Node build tooling only
- `@blurengine/bebe/internal/link/bds` for `blr` runtime injection only
- `@blurengine/bebe/internal/audio/player` for `blr` dev audio command injection only
- `@blurengine/bebe/internal/zones/editor` for `blr` editor injection only

### `src/`

This is the authored source tree.

Current top-level authored areas:

- [src/context.ts](../../src/context.ts) for lifecycle ownership
- [src/stagger.ts](../../src/stagger.ts) for staged owned work
- [src/zones.ts](../../src/zones.ts) for the singleton zone registry and watcher surface
- [`src/zones/`](../../src/zones) for shared serialisable zone definitions, compiled lookup metadata, and draft editing primitives
- [`src/bedrock/`](../../src/bedrock) for Bedrock API edge helpers
- [`src/catalog/`](../../src/catalog) for block catalogs and vanilla block categories
- [`src/maths/`](../../src/maths) for the maths surface, including voxel/grid helpers
- [`src/tooling/`](../../src/tooling) for Node-only compiler/tooling entrypoints
- [`src/internal/`](../../src/internal) for package subpaths injected by `blr`, not gameplay imports
- [`src/test-support/`](../../src/test-support) for test-only helpers

### `test/`

This is the package test tree.

It covers:

- public package surface checks
- root package behaviour
- maths behaviour

Tests live here rather than beside source files because the organisation standard for released repos is a dedicated `test/` directory.

### `docs/`

This is the reader-facing guides tree.

It is for:

- users learning the current package surface
- contributors orienting themselves quickly

It is not the place for maintainer-only instructions or agent-only guidance.

### `scripts/`

This is for repo scripts used by build, cleanup, typing, or developer workflow.

### `lib/`

This is generated output.

It is the package build result, not the authored source of truth.

## Choosing The Right Import Path

- lifecycle, runtime ownership, and zones -> `@blurengine/bebe`
- Bedrock API edge helpers -> `@blurengine/bebe/bedrock`
- immutable block catalogs and the vanilla block preset -> `@blurengine/bebe/catalog`
- derived vanilla fishing events -> `@blurengine/bebe/features/fishing`
- vectors, facings, AABBs, extents, voxel/grid helpers, tweens, and numeric helpers -> `@blurengine/bebe/maths`
- Node-only build/compiler integration -> `@blurengine/bebe/tooling/node`
- `blr`-owned runtime wiring -> `@blurengine/bebe/internal/*`

Consumers should import from the public package entrypoints, not from `src/` or `lib/`.
Runtime gameplay code should not import `@blurengine/bebe/tooling/*`; that surface is for build tools.
Runtime gameplay code should not import `@blurengine/bebe/internal/*`; those surfaces are reserved for `blr` bootstrap and editor injection.

## Choosing The Right Repo Location

- new lifecycle, runtime ownership, or zone primitive -> root package surface
- new Bedrock edge helper -> `src/bedrock/`
- new block catalog or generated vanilla block category data -> `src/catalog/`
- new optional gameplay feature module -> `src/features/<name>/`
- new maths primitive, voxel/grid helper, or traversal helper -> `src/maths/`
- new Node-only compiler or asset-tooling primitive -> `src/tooling/`
- new `blr`-injected runtime primitive -> `src/internal/`
- tests -> `test/`
- reader-facing usage and behaviour docs -> `docs/guides/`
- repo automation -> `scripts/`

If a new file does not clearly fit one of those areas, it is usually a sign that the feature boundary needs to be clarified first.
