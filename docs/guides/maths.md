# Maths Guide

## Purpose

`@blurengine/bebe/maths` is the explicit maths surface for `bebe`.

It provides:

- vector classes for authored code
- AABB utilities for spatial work
- tween helpers for tick-based interpolation
- scalar helpers for common numeric jobs

## Use It When

- authored gameplay code needs readable vector or AABB operations
- a feature needs tweening over Bedrock ticks
- scalar helper functions are enough and a full class wrapper would be unnecessary
- Bedrock API values need light interop without building a second maths vocabulary around them

## Core Model

The package has one main split:

- `Vec2`, `Vec3`, and `AABB` are the primary authored APIs
- raw utility functions exist for Bedrock interop, scalar queries, and low-allocation edge work

This keeps authored gameplay code readable without forcing everything through class allocation when you only need a single scalar answer.

## Important Behaviours

### `Vec2` and `Vec3`

`Vec2` and `Vec3` are the main vector types.

- parsing is explicit through `Vec2.parse(...)` and `Vec3.parse(...)`
- invalid parse input returns `undefined`
- constructors accept numeric and vector-like input; string parsing lives in `parse(...)`
- normalization uses epsilon-safe zero checks

If you are writing new authored logic, prefer the classes. If you are consuming a Bedrock `{ x, y, z }` shape and only need a small scalar query, the raw helpers have a place.

### `AABB`

`AABB` is a normalised axis-aligned bounding box.

- constructor input order does not matter; min/max are normalised internally
- `toBlockSpan(...)` and `blocks(...)` share the same bounds contract
- block iteration defaults to `"inclusive"` bounds
- `"half-open"` bounds are available when adjacent spans should compose without double-counting shared edges

`"half-open"` means the min edge is included and the max edge is excluded. That is often useful when multiple boxes represent neighboring regions in an integer grid.

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

Prefer raw helpers when:

- you are at a Bedrock API boundary
- you only need one scalar answer such as distance or length
- you want to avoid building a second object just to ask a simple question
