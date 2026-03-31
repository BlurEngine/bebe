# Context Patterns

## Purpose

This guide shows the main ways to structure feature lifetimes with `Context`.

Use it when you already understand what `Context` is, but you want a clearer sense of how many scopes to create, where services belong, and when `use(...)` is the right tool.

## Use It When

- a feature owns several timers, subscriptions, or tracked entities together
- a feature needs shorter-lived nested work inside a larger lifetime
- you are deciding between direct ownership, a child scope, a service, or explicit teardown
- you want authored code to follow the same ownership shape across the repo

## Core Model

- one feature lifetime -> one `Context`
- one shorter nested lifetime -> one child scope
- one shared runtime helper -> one service on the scope that should own it
- one custom teardown with no dedicated helper -> `use(...)`

The goal is not to create more scopes for their own sake. The goal is to make ownership obvious.

## Important Patterns

### Feature Scope

Use one `Context` for one feature lifetime.

This is the default pattern for:

- a temporary gameplay system
- a feature session
- one controller object that owns several runtime behaviours together

Keep related work on that one context:

- `subscribe(...)`
- `timeout(...)`
- `interval(...)`
- `run(...)`
- `trackEntity(...)`

Dispose the context when the feature ends.

### Child Scope

Use `createScope(...)` when one part of a feature has a shorter lifetime than the parent feature.

Good fits:

- a temporary effect inside a longer-running system
- one spawned entity inside a broader feature
- one branch of logic that should stop without tearing down the whole parent

The child scope should represent a real lifetime boundary. If it does not, keep the work on the parent context.

### Subscription Ownership

Use `subscribe(...)` when the work is event-driven and the subscription should end with the context.

This is the normal pattern for Bedrock events:

- register through `ctx.subscribe(...)`
- keep the returned unsubscribe only when the feature may stop earlier than the context lifetime

If the handler should only run a fixed number of times, use `subscribe({ source, n }, handler)`.

### Service On A Parent Scope

Use a service when several parts of the same feature tree need one shared runtime-owned helper.

Good fits:

- monitors
- registries
- caches tied to one feature lifetime
- helper objects that own both state and behaviour

Put the service on the scope that should own its lifetime.

That usually means:

- feature-wide helper -> parent scope service
- local one-off helper -> local scope value, not a service

### Entity Ownership

Use `trackEntity(...)` when a context owns one or more entities.

This is a good pattern when:

- one feature scope owns several spawned entities that should be removed together
- one scope exists because one specific entity exists
- entities should be removed when the owning context is disposed
- one tracked entity should also be able to end the context lifetime when it disappears

Important defaults:

- `removeOnDispose` defaults to `true`
- `linkRemove` defaults to `false`

The important distinction is:

- `removeOnDispose` makes the context own entity cleanup
- `linkRemove` lets a tracked entity act as a lifetime signal for the context

One entity per scope is a useful pattern, but it is not the only intended use. A single context can own many related entities.

### Explicit Teardown

Use `use(...)` when the feature needs teardown that does not already map to a more specific helper.

This is the lowest-level ownership primitive, so it should stay the exception, not the first thing every feature reaches for.

Reach for it when:

- you have custom teardown logic
- the work is not a service, subscription, timer, or tracked entity
- the more specific helpers would only wrap the same teardown less clearly

## Choosing The Right Pattern

- one feature lifetime -> `new Context()`
- shorter nested lifetime -> `createScope(...)`
- Bedrock event ownership -> `subscribe(...)`
- shared runtime helper -> service
- one or more owned entities -> `trackEntity(...)`
- custom teardown -> `use(...)`

If more than one pattern seems possible, prefer the one that makes lifetime ownership easiest to explain in one sentence.
