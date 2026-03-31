# Context Guide

## Purpose

`Context` is the lifecycle ownership layer in `bebe`.

Use it when a feature creates runtime work that should be cleaned up through one ownership scope.

## Use It When

- a feature owns timers, subscriptions, or tracked entities
- a piece of runtime behaviour needs clear cleanup boundaries
- one feature needs shorter-lived child scopes inside a larger lifetime
- shared runtime helpers should belong to one feature lifetime instead of floating globally

## Core Model

- Create a `Context` for a feature lifetime.
- Register work on that context.
- Create child scopes when part of that feature needs a shorter lifetime.
- Dispose the parent when the feature ends.

The central question is: which context owns this work?

## What Context Owns

A context can own:

- `run`, `timeout`, and `interval` callbacks
- event subscriptions created through `subscribe(...)`
- child scopes created through `createScope(...)`
- services stored through `setService(...)` and `ensureService(...)`
- tracked entities registered through `trackEntity(...)`
- explicit cleanup registered through `use(...)` or `onDispose(...)`

## Important Behaviours

### `new Context()`

Directly constructed contexts join the internal root disposal tree.

### `createScope(...)`

Child scopes inherit service lookup from their parent by default. This is useful for feature-local scopes that need access to long-lived services. If a child should not see parent services, disable inheritance when you create the scope.

### `run(...)`, `timeout(...)`, and `interval(...)`

- `run(fn)` is the next-tick convenience form of `timeout(0, fn)`
- negative tick values are clamped up to `0`
- `interval({ ticks, n }, fn)` can auto-stop after `n` runs

### `subscribe(...)`

`subscribe(...)` returns an unsubscribe function and also registers that teardown with the owning context.

- disposing the context unsubscribes automatically
- `subscribe({ source, n }, handler)` auto-unsubscribes after `n` handler runs
- the returned unsubscribe function is useful when a feature needs to stop earlier than the context lifetime

### `onDispose(...)`

`onDispose(...)` callbacks are scheduled through `system.run(...)` during disposal.

That scheduling matters when teardown order is important.

### Services

Services are lifecycle-owned values stored on a context and looked up by key.

They are a good fit for:

- monitors
- registries
- caches tied to a runtime feature lifetime
- helper objects that expose behaviour and state together

Use services for runtime-owned helpers and shared feature infrastructure. Use ordinary locals for plain local state.

### `trackEntity(...)`

`trackEntity(...)` is useful when a context owns one or more spawned or long-lived entities.

Behaviour to remember:

- `removeOnDispose` defaults to `true`
- `linkRemove` defaults to `false`
- disposing the context attempts to remove every tracked entity owned by that context
- `linkRemove: true` makes the context dispose itself when that tracked entity is removed

## Choosing The Right API

Most authored code should stay inside a small set of patterns:

- feature lifetime -> `Context`
- shorter nested lifetime -> `createScope(...)`
- Bedrock event ownership -> `subscribe(...)`
- shared runtime helper -> service
- custom teardown with no dedicated helper -> `use(...)`

`use(...)` is the lower-level ownership primitive. Reach for it when the more specific helpers do not match the work you need to own.
