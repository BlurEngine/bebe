# Maths Guide

## Purpose

`@blurengine/bebe/maths` is the explicit maths surface for `bebe`.

It provides:

- vector classes for authored code
- facing helpers for block-adjacent offsets
- AABB utilities for spatial work
- extent primitives for reusable area and volume definitions
- voxel/grid helpers for location-first collections, stable keys, and breadth-first traversal
- deterministic three-dimensional paths sampled by world distance
- tween helpers for tick-based interpolation
- scalar helpers for common numeric jobs

## Use It When

- authored gameplay code needs readable vector or AABB operations
- code needs a stable vocabulary for block-adjacent offsets
- code needs to express a reusable area, volume, or spatial membership rule
- code needs voxel collections, stable location keys, or breadth-first grid traversal
- motion or placement needs one deterministic 3D polyline or Catmull-Rom path
- a feature needs tweening over Bedrock ticks
- scalar helper functions are enough and a full class wrapper would be unnecessary
- Bedrock API values need light interop without building a second maths vocabulary around them

## Core Model

The package has one main split:

- `Vec2`, `Vec3`, and `AABB` are the primary authored APIs
- `Facing` is the primary authored term for Bedrock's block-adjacent `Direction` enum
- extents describe pure spatial membership and reduction over the existing
  `Vec3`, `AABB`, and voxel vocabulary
- voxel/grid helpers live beside the main maths types because they are spatial
  traversal helpers over the same `Vec3` model
- raw utility functions exist for Bedrock interop, scalar queries, and low-allocation edge work
- arc-length paths compile authored points into immutable distance-based samples and bounds

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

Its type remains Bedrock's `Direction` enum and its values match that enum
exactly. The public maths module defines those string values locally so pure
maths can also load in Node without a Minecraft runtime. Engine vocabulary can
therefore distinguish:

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

### Extents

Extents are pure spatial primitives for authored gameplay space.

They answer questions such as:

- does this point belong to this area?
- what finite bounds does this area have?
- what approximate volume can be reported?
- which integer blocks does this area reduce to?
- can a broad-phase AABB be classified as inside, outside, or intersecting?

The first extent shapes are:

- `BoxExtent`, backed by `AABB`
- `BlockExtent`, one half-open integer block cell
- `CylinderExtent`, a vertical cylinder on the `y` axis
- `SphereExtent`, a Euclidean sphere
- `PolygonExtent`, a simple vertical prism from a 2D XZ polygon and y min/max
- `VoxelExtent`, backed by exact voxel membership
- `UnionExtent`, an OR-composition over child extents
- `TranslatedExtent`, a child extent evaluated at an offset
- `InfiniteExtent`, an unbounded extent that contains all finite points

Extents deliberately do not know about dimensions, worlds, entities, ticks, or
event listeners. Those responsibilities belong to zone registries and monitors
built above the maths layer. The root package `Zones` singleton is the first
such runtime layer for registering, querying, and watching collections of
extents.

`BlockExtent` uses half-open cell membership: the minimum block corner is
included, and the next block boundary is excluded. A block at `{ x: 1, y: 2,
z: 3 }` contains `{ x: 1.5, y: 2.5, z: 3.5 }`, but not `{ x: 2, y: 2, z: 3 }`.
This lets adjacent block cells compose without double-counting shared faces.

`InfiniteExtent` is valid for whole-space definitions, but it has no finite
`bounds()`, `volume()`, `sample()`, or block iteration. Consumers that need a
world or dimension must attach that meaning outside the extent itself.

`PolygonExtent` is deliberately simple: it is a 2D polygon on the XZ plane with
finite y min/max. It is intended for hand-authored JSON and in-game editing
tools that need irregular but understandable regions without introducing full
3D mesh or hole semantics.

For continuous shapes such as boxes, cylinders, spheres, and translated shapes,
`blocks()` yields integer block cells that intersect the extent. It does not use
centre-point containment as the default reduction rule. This keeps block
reduction conservative for future indexing and avoids losing cells that touch an
extent boundary.

`UnionExtent.volume()` only reports a number when child volumes are known and
their bounds cannot overlap. If children may overlap, it returns `undefined`
rather than publishing a misleading sum.

Built-in extents expose conservative broad-phase helpers. In particular,
`classifyAABB(...)` only returns `"inside"` when the shape can prove the whole
box is contained. When that proof is not cheap or not possible, the extent
returns `"intersects"` so callers can fall back to exact checks.

### Arc-Length Paths

`compilePolyline(...)` and `compileCatmullRom(...)` return an `ArcLengthPath`.
The path measures full 3D Euclidean distance, so slopes contribute to length.

- `sample(distance)` returns a `Vec3` position and tangent plus segment details
- open paths return `undefined` outside `[0, length]`
- closed paths wrap positive and negative distances
- `bounds(start, end)` returns an `AABB` for the exact interval
- consecutive zero-length segments and non-finite points are rejected
- non-consecutive repeated points remain valid for crossings and return paths

Catmull-Rom compilation is centripetal (`alpha = 0.5`) with a fixed authored
subdivision count. Open endpoints use reflected phantom controls; closed paths
wrap their controls and require at least three points. A two-point open spline
remains exactly linear.

`PathPack` is the versioned, consumer-neutral JSON contract. It stores plain
`Vec3Init` points and no dimensions, schedules, vehicles, gameplay metadata,
or registry state. Consumers compile the selected definition once with
`compilePathDefinition(...)`.

Offline world processors may import the same path normalisers and compilers
from `@blurengine/bebe/tooling/node`. That entrypoint exposes the pure path
contract without loading Bedrock-facing maths modules into Node.

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

Prefer extents when:

- you want one reusable definition of an area or volume
- multiple systems need to consume the same spatial rule
- code needs a shape to provide containment, bounds, sampling, or block
  reduction
- you are preparing gameplay code for zone registration or monitoring

Prefer raw helpers when:

- you are at a Bedrock API boundary
- you are doing scalar math rather than vector behaviour
- a utility already expresses the behaviour more clearly than stitching
  together multiple method calls
