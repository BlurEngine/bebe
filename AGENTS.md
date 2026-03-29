# Bebe Agent Scope

This file applies only to agents working in the `bebe/` repository.

## Repo Contract

- `bebe` is the standalone framework repo for the `@blurengine/bebe` package, its source, tests, docs, and release surface.
- The initial public surface is context-first. Do not widen exports without updating tests, package metadata, and README together.
- This file is for authoring `bebe` itself.

## Maintenance Rules

1. Keep package metadata, exports, published files, and docs aligned when the public package surface changes.
2. If public framework behavior or examples change, update `README.md` and tests together.
3. Keep `npm run check` as the main ownership gate for `bebe`. Do not reintroduce heavyweight wrapper tooling unless it clearly earns its keep over direct npm scripts.
4. If release or open-source repo surfaces change, keep root docs, workflows, package metadata, security information, and Changesets config aligned.
5. Changes affecting code, package shape, release flow, or docs that claim behavior must leave the repo passing `npm run check`.

## Framework Rules

1. Prefer extracting reusable primitives over reimplementing the same pattern inside feature files. If two systems need local events, polling, or composition, extend the shared primitives first.
2. Keep generic framework building blocks separate from Minecraft-specific catalogs. New trigger, monitor, or blueprint behavior should only become Bedrock-specific at the edge.
3. Do not add unconditional console noise in runtime paths. Debug output must be opt-in and routed through an explicit debug/log mechanism.
4. Treat `Context` as lifecycle and resource ownership infrastructure, not a dumping ground for unrelated feature state. New responsibilities should usually become services or standalone primitives before they become `Context` features.
5. If Bedrock is missing an API and `bebe` fills the gap through polling or derived state, design that solution so consumers can reuse the same primitive to build their own higher-level features.
6. When naming similar capabilities, prefer one vocabulary and one implementation path. Avoid sibling APIs that solve the same problem with slightly different names or behavior.
