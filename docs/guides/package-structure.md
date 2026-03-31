# Package Structure

## Purpose

This guide explains how `bebe` is structured today, both as a public package and as a repository.

Use it when you are choosing imports, navigating the codebase, or deciding where a new piece of code should live.

## Use It When

- you are deciding which public import path to use
- you are contributing to the repo and need to know where authored code belongs
- you want to understand the split between runtime primitives and the maths surface
- you want to navigate the repo without reverse-engineering it from the file tree

## Core Model

`bebe` has two public package surfaces today:

- `@blurengine/bebe`
- `@blurengine/bebe/maths`

The root package stays focused on lifecycle and runtime ownership.

The maths subpath holds:

- vectors
- AABBs
- tweens
- numeric helpers

That split is intentional. It keeps the root package small while still letting the engine expose a broader maths surface.

## Important Areas

### Public Package Surface

The public authored entrypoints are:

- [src/index.ts](d:/Users/supah/Documents/programming/go/src/gitlab.com/Blockception/personal/bebe/src/index.ts)
- [src/context.ts](d:/Users/supah/Documents/programming/go/src/gitlab.com/Blockception/personal/bebe/src/context.ts)
- [src/maths/index.ts](d:/Users/supah/Documents/programming/go/src/gitlab.com/Blockception/personal/bebe/src/maths/index.ts)

As a consumer, the important import paths are:

- `@blurengine/bebe`
- `@blurengine/bebe/maths`

### `src/`

This is the authored source tree.

Current top-level authored areas:

- [src/context.ts](d:/Users/supah/Documents/programming/go/src/gitlab.com/Blockception/personal/bebe/src/context.ts) for lifecycle ownership
- [`src/maths/`](d:/Users/supah/Documents/programming/go/src/gitlab.com/Blockception/personal/bebe/src/maths) for the maths surface
- [`src/test-support/`](d:/Users/supah/Documents/programming/go/src/gitlab.com/Blockception/personal/bebe/src/test-support) for test-only helpers

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

- lifecycle and runtime ownership -> `@blurengine/bebe`
- vectors, AABBs, tweens, and numeric helpers -> `@blurengine/bebe/maths`

Consumers should import from the public package entrypoints, not from `src/` or `lib/`.

## Choosing The Right Repo Location

- new lifecycle or runtime ownership primitive -> root package surface
- new maths primitive or maths helper -> `src/maths/`
- tests -> `test/`
- reader-facing usage and behaviour docs -> `docs/guides/`
- repo automation -> `scripts/`

If a new file does not clearly fit one of those areas, it is usually a sign that the feature boundary needs to be clarified first.
