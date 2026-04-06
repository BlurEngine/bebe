# Stagger Guide

## Purpose

This guide explains how to stage owned work across ticks with `bebe` without
falling back to ad hoc `system.runTimeout` bookkeeping.

Use it when one context should own a progressive effect, batch world work, or
cancel scheduled work automatically when that context is disposed.

## Use It When

- one effect should process several items across ticks
- scheduled work should be cancelled automatically with its owning context
- items need batching and ordering without manual timeout bookkeeping
- grouped work should preserve phase boundaries such as collapse waves or spawn
  stages

## Core Model

The stagger model has two pieces:

- `stagger(...)` stages one logical group of items
- `staggerGroups(...)` stages several groups while preserving group boundaries

Both helpers schedule work under a `Context`.

That means the returned cancel function is optional in the normal case. If the
owning context is disposed first, the staged work is cancelled automatically.

## Important Behaviours

### `stagger(...)`

`stagger(...)` batches one list of items over time under a context lifetime.

Use it when:

- one effect should process several items across ticks
- ordering should happen within one logical group
- authored code wants batching without managing several timeout handles

### `staggerGroups(...)`

`staggerGroups(...)` preserves group boundaries while still batching items
within each group.

This is a good fit for staged effects such as:

- structural collapse waves
- grouped spawns
- multi-step visual effects

### Ordering

Both helpers can reorder items within a group through `order`.

Ordering happens before batching begins, so `itemIndex` in `StaggerRunInfo`
reflects the ordered group position, not the original input position.

### Defaults

Important defaults:

- `batchSize` defaults to the full group
- `ticksBetweenBatches` defaults to `1`
- `ticksBetweenGroups` defaults to `1`
- `initialDelayTicks` defaults to `0`, which means the first batch runs on the
  next tick

### Run Info

`StaggerRunInfo` tells the callback where the current item sits inside the
staged plan.

The most important fields are:

- `batchIndex` for the current scheduled batch
- `batchItemIndex` for the item position inside that batch
- `groupIndex` for the source group
- `itemIndex` for the ordered position inside that source group

## Choosing The Right API

- stage one list of owned work -> `stagger(...)`
- stage several ordered groups of owned work -> `staggerGroups(...)`

If work does not need ownership or progressive scheduling, it probably does not
belong in the stagger layer.
