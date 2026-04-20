# Voxels Guide

## Purpose

This guide explains how to work with voxel collections, stable location keys,
standard neighbourhoods, and breadth-first voxel flood fills in `bebe`.

Use it when gameplay code needs connected block traversal, location-first voxel
sets or maps, or wave-style graph expansion without rebuilding the same queue
and map logic in every feature.

## Use It When

- a feature needs stable keys for voxel locations
- code needs face or surrounding voxel neighbourhoods
- one or more seed blocks should expand through a connected region
- traversal should keep per-voxel depth information
- code needs a reusable breadth-first fill instead of a local bespoke queue

## Core Model

The voxel surface has three main jobs:

- represent voxel collections through location-first APIs
- convert between voxel locations and stable string keys
- perform breadth-first flood fills from one or more seeds

These helpers now live on the maths surface rather than a dedicated voxel
subpath:

- voxel inputs accept `Vec3Like`
- collection iteration yields `Vec3`
- read-only collection contracts expose structural `VoxelLocation` shapes
- import path: `@blurengine/bebe/maths`

That keeps the API Bedrock-compatible at the edge, while still using the
engine's own maths model as the primary authored surface.

The most important helpers are:

- `Facing`
- `FACING_OFFSETS`
- `HORIZONTAL_FACING_OFFSETS`
- `VERTICAL_FACING_OFFSETS`
- `VoxelSet`
- `VoxelMap`
- `createSurroundingOffsets(...)`
- `SURROUNDING_OFFSETS`
- `getVoxelKey(...)`
- `parseVoxelKey(...)`
- `createFacingVoxelOffsets(...)`
- `floodFillVoxels(...)`
- `floodFillVoxelSet(...)`

## Important Behaviours

### Keys

`getVoxelKey(...)` returns a stable `x,y,z` string for one voxel location.

It accepts any `Vec3Like`, including Bedrock `{ x, y, z }` objects.

`parseVoxelKey(...)` reverses that format and returns `undefined` for malformed
or non-finite input.

Successful parses return a `Vec3`.

### Voxel Collections

`VoxelSet` gives callers value-based voxel membership while still letting the
engine handle stable key identity internally.

Use it when code wants to:

- check whether one voxel location is present without carrying raw string keys
- combine or subtract voxel membership collections through set-style operations
- iterate stored locations as `Vec3`
- ask whether any stored voxel is adjacent to one location

`VoxelSet` accepts `Vec3Like` inputs and yields `Vec3` instances when iterated.

The read-only public collection contracts use structural `VoxelLocation`
entries so values stay assignable across `bebe` subpaths without leaking class
identity into consumer code.

`VoxelSet.fromKeys(...)` also exists when code already has persisted or
precomputed voxel keys and wants to rehydrate them into a location-first set.

`VoxelMap<T>` applies that same model to values associated with voxel
locations.

Use it when code wants to:

- store one value per voxel location without carrying raw string keys
- read values using any `Vec3Like` with value-based membership
- iterate `[location, value]` pairs as `Vec3`
- derive a `VoxelSet` from the map's keys through `keySet()`

`VoxelMap.fromKeys(...)` also exists when code already has keyed voxel data and
wants to rehydrate it into a location-first map.

Both collection types also expose a small set of array-style helpers so feature
code can stay close to normal JavaScript when it is projecting or selecting
locations:

- `toArray()`
- `map(...)`
- `filter(...)`
- `find(...)`
- `some(...)`
- `every(...)`
- `slice(...)`
- `sort(...)`

`VoxelSet` methods operate on locations because iterating a set yields
locations.

`VoxelMap<T>` methods operate on iterated entry tuples such as
`([location, value]) => ...` because iterating a map yields entries.

`filter(...)`, `slice(...)`, and `sort(...)` return new voxel collections so the
result can keep participating in location-first workflows such as `keySet()`.
On read-only collection contracts, those helpers stay read-only in the type
surface even though the concrete implementation still returns `VoxelSet` or
`VoxelMap<T>` instances at runtime.

When `sort(...)` does not receive a comparator, voxel collections sort by their
stable voxel keys.

`VoxelSet` also exposes pure set-style operations:

- `union(...)`
- `difference(...)`

### Seeds

`floodFillVoxels(...)` always includes its seeds in the result.

If a seed should only be included conditionally, filter it before passing it
into the flood fill.

`floodFillVoxelSet(...)` applies one extra rule: seeds outside its `within`
membership set are ignored.

### Depths

Each visited voxel stores one depth in the result `voxels`, which is exposed as
a read-only voxel depth map.

Seed depths default to `0`, but callers can provide a different starting depth
per seed when that better matches the surrounding algorithm.

Visited locations come from `voxels.keySet()`.

### Truncation

`maxCount` limits the number of included voxels.

When the traversal reaches that limit, the result is marked as `truncated` and
no more neighbours are explored.

### Constrained Flood Fills

`floodFillVoxelSet(...)` is the convenience layer for connected-component work
inside a known voxel membership set.

Use it when code already owns a `VoxelSet`, map key set, or other stable voxel
collection and only wants the connected region inside that set.

That keeps feature code out of repeated `shouldEnter(node) {
return set.has(node.location);
}` boilerplate while still returning the same `VoxelFloodFillResult` shape as
`floodFillVoxels(...)`.

### Neighbourhoods

`Facing` is the preferred engine term for the six block-adjacent offsets.

`FACING_OFFSETS` covers those six block-adjacent offsets.

`HORIZONTAL_FACING_OFFSETS` narrows that set to the four horizontal side
offsets.

`VERTICAL_FACING_OFFSETS` narrows it to the two vertical offsets.

`SURROUNDING_OFFSETS` covers all surrounding neighbours, including edges and
corners.

`createSurroundingOffsets(...)` generates that same surrounding pattern when a
feature needs to include the origin or scale the step distance.

`createFacingVoxelOffsets(...)` builds the `3x3` plane one block away in one
face direction. For example, passing `{ x: 0, y: 1, z: 0 }` returns the nine
offsets in the layer above.

`FACE_VOXEL_OFFSETS` and `SURROUNDING_VOXEL_OFFSETS` still exist as
compatibility aliases, but new code should prefer the maths-facing names.

## Choosing The Right API

- block-adjacent facings, voxel helpers, and surrounding offsets -> `@blurengine/bebe/maths`
- stable voxel key -> `getVoxelKey(...)`
- parse a stored voxel key -> `parseVoxelKey(...)`
- value-based voxel membership and set difference -> `VoxelSet`
- value-based voxel-keyed values -> `VoxelMap<T>`
- offset one voxel location -> `new Vec3(location).add(offset)`
- face-connected traversal -> `FACING_OFFSETS`
- surrounding traversal -> `SURROUNDING_OFFSETS`
- scaled or origin-inclusive surrounding traversal -> `createSurroundingOffsets(...)`
- one `3x3` face plane such as `up` or `south` -> `createFacingVoxelOffsets(...)`
- reusable breadth-first voxel capture -> `floodFillVoxels(...)`
- reusable breadth-first voxel capture inside an existing voxel set -> `floodFillVoxelSet(...)`

If code only needs one or two scalar coordinate checks, it probably does not
need the voxel layer.
