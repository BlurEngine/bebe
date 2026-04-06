# Bedrock Guide

## Purpose

This guide explains the `@blurengine/bebe/bedrock` subpath.

Use it when Bedrock's scripting API already provides the underlying capability,
but the authored code keeps repeating the same safety checks, try/catch guards,
slot handling, or fallback behaviour.

## Use It When

- block reads can fail because a location is unloaded or out of bounds
- block writes need a consistent fallback path
- slot or item reads can throw when inventory state is invalid
- durability should be applied at the item or slot level instead of being tied
  to one gameplay rule

## Core Model

The Bedrock subpath is a curated edge layer.

It is not meant to mirror the entire `@minecraft/server` API one method at a
time.

Instead, it focuses on a small set of helpers that absorb the most common API
friction:

- safe block reads
- safe slot and item reads
- block mutation helpers with consistent fallback behaviour
- durability helpers centred on item stacks and slots

## Important Behaviours

### `attemptBedrock(...)`

`attemptBedrock(...)` is the low-level escape hatch.

It returns `undefined` when a Bedrock operation throws. Use it for narrow edge
work. Prefer the more specific helpers first when one exists.

### `getBlockAt(...)`

`getBlockAt(...)` returns a block when the location is readable and `undefined`
otherwise.

This keeps authored code out of repetitive try/catch wrappers around
`dimension.getBlock(...)`.

### `setBlockTypeAt(...)` and `destroyBlockAt(...)`

These helpers separate two different world-mutation intents:

- `setBlockTypeAt(...)` performs a direct type replacement
- `destroyBlockAt(...)` tries `setblock ... destroy` first, then falls back to a
  direct replacement write

That split is intentional. The subpath should not hide the difference between
"replace this block" and "break this block naturally".

### `getSelectedSlot(...)` and `getSlotItem(...)`

These helpers move slot handling to the actual Bedrock failure boundary.

That means authored code can work at the slot level first and only reach for a
player helper when the selected-slot convenience is genuinely useful.

### `getRemainingItemUses(...)`

This helper reports remaining uses from an item's durability component.

It returns:

- `undefined` when the item does not expose durability
- `Number.MAX_SAFE_INTEGER` for unbreakable items

### `applyDurabilityToItem(...)` and `applyDurabilityToSlot(...)`

The durability helpers are intentionally objective:

- `applyDurabilityToItem(...)` mutates an item stack
- `applyDurabilityToSlot(...)` writes the result back to a slot and clears the
  slot when the item breaks
- `applyDurabilityToSelectedSlot(...)` is only a thin player convenience on top
  of the slot-level helper

Game rules such as mode checks, trigger conditions, or "extra log break count"
stay outside this subpath.

## Choosing The Right API

- one-off guarded Bedrock call -> `attemptBedrock(...)`
- safe block lookup -> `getBlockAt(...)`
- replace a block directly -> `setBlockTypeAt(...)`
- break a block with natural-destroy intent -> `destroyBlockAt(...)`
- read a player's current slot -> `getSelectedSlot(...)`
- work with the item in a slot -> `getSlotItem(...)`
- compute or apply durability independent of player logic ->
  `getRemainingItemUses(...)`, `applyDurabilityToItem(...)`, or
  `applyDurabilityToSlot(...)`

If a helper starts deciding game rules instead of Bedrock edge behaviour, it
should usually stay in gameplay code rather than move into this subpath.
