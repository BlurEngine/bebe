# Maths Guide

## Purpose

`@blurengine/bebe/maths` is the explicit maths surface for `bebe`.

It provides:

- vector classes for authored code
- facing helpers for block-adjacent offsets
- AABB utilities for spatial work
- voxel/grid helpers for location-first collections, stable keys, and breadth-first traversal
- tween helpers for tick-based interpolation
- scalar helpers for common numeric jobs

## Use It When

- authored gameplay code needs readable vector or AABB operations
- code needs a stable vocabulary for block-adjacent offsets
- code needs voxel collections, stable location keys, or breadth-first grid traversal
- a feature needs tweening over Bedrock ticks
- scalar helper functions are enough and a full class wrapper would be unnecessary
- Bedrock API values need light interop without building a second maths vocabulary around them

## Core Model

The package has one main split:

- `Vec2`, `Vec3`, and `AABB` are the primary authored APIs
- `Facing` is the primary authored term for Bedrock's block-adjacent `Direction` enum
- voxel/grid helpers live beside the main maths types because they are spatial
  traversal helpers over the same `Vec3` model
- raw utility functions exist for Bedrock interop, scalar queries, and low-allocation edge work

This keeps authored gameplay code readable, while still leaving raw helpers in
place for Bedrock interop and non-vector numeric work.

## Important Behaviours

### `Vec2` and `Vec3`

`Vec2` and `Vec3` are the main vector types.

- parsing is explicit through `Vec2.parse(...)` and `Vec3.parse(...)`
- invalid parse input returns `undefined`
- constructors accept numeric and vector-like input; string parsing lives in `parse(...)`
- normalization uses epsilon-safe zero checks

If you are writing new authored logic, prefer the classes. If you are consuming
a Bedrock `{ x, y, z }` shape and only need one vector query, wrap it in
`Vec3` and use the class API directly.

### `Facing`

`Facing` is `bebe`'s word for the six unit block offsets around one origin
block.

It builds directly on Bedrock's `Direction` enum, but uses engine vocabulary so
future code can distinguish:

- `Facing` for block-adjacent offsets
- `direction` for arbitrary vectors or look/orientation math

Key helpers are:

- `Facing`
- `FACING_OFFSETS`
- `HORIZONTAL_FACING_OFFSETS`
- `VERTICAL_FACING_OFFSETS`
- `createSurroundingOffsets(...)`
- `SURROUNDING_OFFSETS`

`FACING_OFFSETS` follows Bedrock's enum contract exactly. In particular,
Bedrock's `Direction.North` maps to `z + 1` and `Direction.South` maps to
`z - 1`.

`createSurroundingOffsets(...)` generates the surrounding offset pattern. By
default it matches `SURROUNDING_OFFSETS`, but it can optionally include the
origin and scale the step distance to produce the same pattern farther away.

### `AABB`

`AABB` is a normalised axis-aligned bounding box.

Its public field vocabulary matches Bedrock's `AABB`:

- `center`
- `extent`

Derived `min` and `max` getters are still available when code needs corner
coordinates or BlockBoundingBox-style work.

- constructor input order does not matter; boxes are normalised internally
- Bedrock-style `{ center, extent }` input is supported directly
- `extent` is always treated as positive, matching Bedrock's contract
- the class itself stays immutable; use `toObject()` when a plain mutable
  Bedrock-style `{ center, extent }` object is needed
- `toBlockBoundingBox()` returns `{ min, max }` when a BlockBoundingBox shape is needed
- `toBlockSpan(...)` and `blocks(...)` share the same bounds contract
- block iteration defaults to `"inclusive"` bounds
- `"half-open"` bounds are available when adjacent spans should compose without double-counting shared edges

`"half-open"` means the min edge is included and the max edge is excluded. That is often useful when multiple boxes represent neighboring regions in an integer grid.

### Voxel Helpers

Voxel helpers stay in the maths surface because they operate on the same
spatial model as `Vec3`, `Facing`, and `AABB`.

Key helpers are:

- `VoxelSet`
- `VoxelMap`
- `getVoxelKey(...)`
- `parseVoxelKey(...)`
- `createFacingVoxelOffsets(...)`
- `floodFillVoxels(...)`

These helpers are for integer-grid work, adjacency, stable location identity,
and breadth-first region capture. `VoxelSet` and `VoxelMap<T>` let gameplay
code stay location-first while the engine handles stable keys internally.
The surface still uses `Vec3Like` inputs and `Vec3` runtime outputs so it
composes naturally with the rest of the maths layer. When code needs to offset
one voxel location, prefer `new Vec3(location).add(offset)` directly.

### Tweens

Tween helpers use an explicit scheduler.

- a `Context` can be passed directly because it already exposes `interval(...)` and `timeout(...)`
- tween helpers stay usable with other compatible schedulers too

- `tweenNumber(...)` and `tweenVec3(...)` drive interpolation over ticks
- `tweenDelay(...)` is a small scheduler-backed delay helper
- `tweenSequence(...)` advances when each step calls `done()`
- `tweenParallel(...)` starts its child tweens immediately
- easing accepts either a named key from `Easings` or a custom easing function

If cancellation or composition matters to a feature, prefer documenting that behaviour in the feature itself instead of assuming the reader knows the tween semantics implicitly.

### Numeric Helpers

Utility helpers are written to be safe transforms for normal finite numeric input.

Examples:

- `clamp(...)` accepts either bound order
- `randomFloat(...)` normalises its bound order
- `randomInt(...)` normalises bounds and returns `undefined` when the normalised range contains no integers
- `chooseWeighted(...)` ignores non-finite weights and returns `undefined` when no usable weight remains

That contract is deliberate. Plain numeric helpers describe how they normalise input, return values, and fallbacks directly.

## Choosing The Right API

Prefer class methods when:

- you are writing authored feature logic
- readability matters more than avoiding one wrapper allocation
- you want chained vector operations

Prefer the facing helpers when:

- you mean one of the six block-adjacent offsets
- you want code to read in terms of block facings rather than raw offset lists
- future Bedrock-facing interop may need to line up with `Direction`
- you need either the canonical one-block surround or a scaled surrounding
  pattern

Prefer the voxel helpers when:

- you need value-based voxel collections or stable keys for integer grid locations
- you are walking connected regions in block space
- you want breadth-first depth information during traversal

Prefer raw helpers when:

- you are at a Bedrock API boundary
- you are doing scalar math rather than vector behaviour
- a utility already expresses the behaviour more clearly than stitching
  together multiple method calls
