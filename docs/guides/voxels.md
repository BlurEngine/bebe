# Voxels Guide

## Purpose

This guide explains how to work with keyed voxel locations, standard
neighbourhoods, and breadth-first voxel flood fills in `bebe`.

Use it when gameplay code needs connected block traversal, keyed location sets,
or wave-style graph expansion without rebuilding the same queue and map logic in
every feature.

## Use It When

- a feature needs stable keys for voxel locations
- code needs face or surrounding voxel neighbourhoods
- one or more seed blocks should expand through a connected region
- traversal should keep per-voxel depth information
- code needs a reusable breadth-first fill instead of a local bespoke queue

## Core Model

The voxel surface has three main jobs:

- convert between voxel locations and stable string keys
- perform breadth-first flood fills from one or more seeds

These helpers now live on the maths surface rather than a dedicated voxel
subpath:

- voxel inputs accept `Vec3Like`
- returned voxel locations are `Vec3`
- import path: `@blurengine/bebe/maths`

That keeps the API Bedrock-compatible at the edge, while still using the
engine's own maths model as the primary authored surface.

The most important helpers are:

- `Facing`
- `FACING_OFFSETS`
- `HORIZONTAL_FACING_OFFSETS`
- `VERTICAL_FACING_OFFSETS`
- `createSurroundingOffsets(...)`
- `SURROUNDING_OFFSETS`
- `getVoxelKey(...)`
- `parseVoxelKey(...)`
- `createFacingVoxelOffsets(...)`
- `floodFillVoxels(...)`

## Important Behaviours

### Keys

`getVoxelKey(...)` returns a stable `x,y,z` string for one voxel location.

It accepts any `Vec3Like`, including Bedrock `{ x, y, z }` objects.

`parseVoxelKey(...)` reverses that format and returns `undefined` for malformed
or non-finite input.

Successful parses return a `Vec3`.

### Seeds

`floodFillVoxels(...)` always includes its seeds in the result.

If a seed should only be included conditionally, filter it before passing it
into the flood fill.

### Depths

Each visited voxel stores one depth in the result map.

Seed depths default to `0`, but callers can provide a different starting depth
per seed when that better matches the surrounding algorithm.

### Truncation

`maxCount` limits the number of included voxels.

When the traversal reaches that limit, the result is marked as `truncated` and
no more neighbours are explored.

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
- offset one voxel location -> `new Vec3(location).add(offset)`
- face-connected traversal -> `FACING_OFFSETS`
- surrounding traversal -> `SURROUNDING_OFFSETS`
- scaled or origin-inclusive surrounding traversal -> `createSurroundingOffsets(...)`
- one `3x3` face plane such as `up` or `south` -> `createFacingVoxelOffsets(...)`
- reusable breadth-first voxel capture -> `floodFillVoxels(...)`

If code only needs one or two scalar coordinate checks, it probably does not
need the voxel layer.
