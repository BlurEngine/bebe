# Engine Philosophy

## Purpose

This guide describes the design principles that should continue to shape `bebe` as it grows.

It is not a changelog, a roadmap, or a package tour. It exists to give the engine a stable centre of gravity so that future features can be judged against something more durable than the current file layout or public surface.

## Use It When

- you are deciding whether a new feature belongs in `bebe`
- you are choosing between a reusable primitive and a one-off convenience helper
- you want to check whether a design fits the long-term character of the engine
- you need a principle to break a tie between multiple reasonable implementations

## Core Commitments

### Explicit Ownership

Runtime work should have a clear owner.

Timers, subscriptions, tracked entities, cached helpers, and any other long-lived behaviour should belong to an explicit lifetime boundary rather than drifting through ambient state or scattered cleanup logic.

If a feature creates work, it should also make it obvious who is responsible for that work ending.

### Convenience Without Ceremony

`bebe` should reduce setup and cleanup boilerplate without forcing users to learn a private framework religion.

The library should feel natural in JavaScript and TypeScript:

- explicit where ownership matters
- concise where the pattern is common
- unsurprising at the call site

Convenience is valuable only when it lowers friction without hiding the contract.

### Reusable Primitives Before Feature Catalogues

When multiple systems need the same capability, the engine should prefer a reusable primitive over several disconnected feature-specific solutions.

That keeps the codebase easier to:

- extend
- reason about
- build on outside the engine itself

The goal is not to expose fewer features. The goal is to expose features that grow from coherent building blocks.

### Bedrock-Specific At The Edge

`bebe` exists for Minecraft Bedrock scripting, but the reusable part of a design should stay as generic as possible until it reaches the Bedrock boundary.

That keeps the engine more composable and makes it easier for users to build their own higher-level systems on top of it.

### Clear Contracts Over Cleverness

Public APIs should be easy to explain without walking through implementation details.

That means:

- one clear vocabulary per capability
- explicit defaults
- explicit edge cases
- strong, readable types
- behaviour that can be learned from docs without source-diving

Cleverness is acceptable in implementation. It is not acceptable as a requirement for understanding the public contract.

### Composability Over Lock-In

The engine should help users build their own systems, not force every problem through a single prescribed pattern.

That means `bebe` should favour:

- primitives that can be combined
- helpers that reduce repetition
- structures that make user-owned abstractions easier to write

The more a feature traps users inside engine-only conventions, the less valuable it becomes as a library.

### Coherent Growth

The engine should grow by coherence, not by accumulation.

A new feature earns its place when it:

- fits the existing vocabulary
- extends the model cleanly
- removes repeated pain
- helps users build something they would otherwise have to reinvent badly

A feature does not earn its place simply because it is possible to add it.

### Documentation Is Part Of The Product

The engine contract does not end at types and tests.

Docs should let a user understand:

- what a feature is for
- what it owns
- what its defaults are
- what behaviour is easy to misunderstand

If a user needs to inspect implementation details to understand the intended contract, the engine is under-documented.

## Anti-Goals

The engine should avoid:

- ambient runtime ownership with unclear cleanup boundaries
- duplicate APIs with overlapping meaning
- convenience helpers that hide important lifetime or cleanup behaviour
- public contracts that only make sense after reading the implementation
- feature growth that expands the surface area without improving coherence

## Questions For New Features

When judging a new feature, start here:

- What owns the runtime work this feature creates?
- Is this introducing a reusable primitive or just another one-off wrapper?
- Does the Bedrock-specific part stay at the edge?
- Does the name fit the existing vocabulary?
- Will a user understand the contract from the docs and types alone?
- Does this make the engine more coherent, or just larger?

If those questions are hard to answer, the feature usually needs more design work before it becomes part of the engine.
