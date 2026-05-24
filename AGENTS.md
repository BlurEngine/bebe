# Bebe Agent Scope

This file applies only to agents working in the `bebe/` repository.

## Repo Contract

- `bebe` is the standalone game engine library repo for the `@blurengine/bebe` package, its source, tests, docs, and release surface.
- The package root stays context-first. Additional public subpaths must be introduced intentionally and updated together with tests, package metadata, and README.
- Use [docs/guides/engine-philosophy.md](d:/Users/supah/Documents/programming/go/src/gitlab.com/Blockception/personal/bebe/docs/guides/engine-philosophy.md) as the north-star design guide when evaluating new features, API shape, and architectural tradeoffs.
- This file is for authoring `bebe` itself.

## Non-Negotiables

- Keep package metadata, exports, published files, and docs aligned when the public package surface changes.
- If public framework behavior or examples change, update `README.md` and tests together.
- Keep `npm run check` as the main ownership gate for `bebe`. Do not reintroduce heavyweight wrapper tooling unless it clearly earns its keep over direct npm scripts.
- If release or open-source repo surfaces change, keep root docs, workflows, package metadata, security information, and Changesets config aligned.
- Changes affecting code, package shape, release flow, or docs that claim behavior must leave the repo passing `npm run check`.
- Do not add unconditional console noise in runtime paths. Debug output must be opt-in and routed through an explicit debug or log mechanism.
- Treat `Context` as lifecycle and resource ownership infrastructure, not a dumping ground for unrelated feature state. New responsibilities should usually become services or standalone primitives before they become `Context` features.

## Git Safety Rules

- Do not stage, commit, amend, rebase, reset, force-push, or push unless the user explicitly asks for that exact Git action in the current task. Do not infer permission from broad instructions such as "proceed".
- Before any requested Git action, inspect the working tree and separate user or unrelated changes from the requested change. Preserve unrelated changes in the working tree unless the user explicitly asks to include them.

## Framework Design Rules

- Prefer extracting reusable primitives over reimplementing the same pattern inside feature files. If two systems need local events, polling, or composition, extend the shared primitives first.
- Keep generic framework building blocks separate from Minecraft-specific catalogs. New trigger, monitor, or blueprint behavior should only become Bedrock-specific at the edge.
- If Bedrock is missing an API and `bebe` fills the gap through polling or derived state, design that solution so consumers can reuse the same primitive to build their own higher-level features.
- When naming similar capabilities, prefer one vocabulary and one implementation path. Avoid sibling APIs that solve the same problem with slightly different names or behavior.
- When an edge helper delegates to a shared primitive, prefer keeping the shared primitive's result shape unless the edge helper truly changes the output semantics. Bedrock-specific behavior should usually live in inputs, callback context, or helper side effects rather than in a second mirrored result vocabulary.
- Do not add a new exported type name when an existing exported type already expresses the same contract. A renamed alias is still duplicate vocabulary unless it gives users a real semantic boundary that improves understanding.
- When one exported structure contains another collection that already fully determines it, collapse the design to one source of truth. Do not publish paired fields such as a map plus a set of the same keys unless they represent genuinely different concepts.
- Query-backed collection types should have one clear identity. If a type primarily represents selected ids, locations, or entries, keep its main API centred on that collection meaning and treat projections such as grouped tags or derived entries as secondary views.
- Preserve multiplicity in API design. If a concept is inherently plural, such as tags on a block, keep the first-class API plural and avoid singular convenience helpers unless the model has a real uniqueness invariant.
- Prefer explicit names when the value domain is ambiguous. If ids, tags, and other inputs share the same primitive type such as `string`, avoid generic verbs like `has(...)` when a more specific name such as `hasId(...)` removes real confusion.
- Do not force array-style methods onto non-array views by default. For lazy selections, set-like views, or query-backed collections, expose the collection operations that match the type's primary identity, then return plain arrays from explicit projection methods and let users use normal JavaScript from there.
- When a helper is justified, generalise the underlying concept rather than today's narrow use case. Prefer a small common-case API plus one generic escape hatch, such as `prefix` plus `test(tag)`, over adding many one-off helpers that each hard-code a single naming pattern.
- Use brief code comments to mark durable, non-obvious intent or relationships that would otherwise cost real time to re-derive. Do not narrate straightforward control flow or restate what the code already says clearly.
- Use `Facing` as the engine term for the six block-adjacent offsets derived from Bedrock's `Direction` enum. Reserve `direction` for arbitrary vectors, look directions, or orientation math unless Bedrock interop requires the original name.
- In maths APIs, prefer the class types (`Vec2`, `Vec3`, `AABB`) as the primary authored surface. Keep raw structural helpers only for Bedrock interop, scalar queries, and low-allocation edge work; do not mirror the full class algebra in util helpers.
- Use named exported types instead of repeating anonymous structural shapes in public maths APIs when those shapes appear more than once.
- Plain utility names should be safe transforms for normal finite inputs. Use `parse...` for fallible conversion that returns `undefined`, and `assert...` for explicit validation that throws.

## Bedrock Edge Rules

- Match defensive wrappers to the documented API contract. Do not wrap Bedrock calls in `attemptBedrock` unless the docs or observed runtime behavior show that the call can throw in normal use.
- Prefer Bedrock's mapped return types when they are already precise. Do not add redundant casts such as `as SomeComponent | undefined` for known `getComponent(...)` ids when the API already returns that type.
- Do not add speculative defensiveness or semantic no-op code. Avoid redundant normalization such as `?? undefined`, identity wrappers, or extra helper layers unless they change real runtime behavior, remove repeated complexity, or establish a proven semantic boundary.
- Reuse the shared maths vocabulary at the Bedrock edge when the accepted shape is the same. Do not introduce Bedrock-only location or collection types when `Vec3Like`, `VoxelFloodFillNode`, `VoxelSet`, or `VoxelMap` already describe the contract accurately.

## Public API And Docs Rules

- Document exported types the same way you document exported functions. A public type should not force users to reverse-engineer intent from its shape alone.
- Public docs must describe important edge-case behavior and defensive fallbacks, not just the happy path. If a helper returns `undefined`, ignores invalid data, normalizes inputs, or falls back to a last-resort value, say so explicitly in the doc comment.
- Keep public documentation scan-first and behavior-first. `README.md` should stay concise and point readers at `docs/`, while longer guides should explain defaults, ownership, and non-obvious behavior instead of trying to mirror the source file symbol-for-symbol.
- Prefer human-readable notes over code-shaped prose in docs. When documenting a feature, explain what it owns, when it cleans up, what defaults matter, and which edge cases surprise users most.
- Document the code as it exists today. Avoid historical framing such as "used to", "no longer", or other changelog-style wording in feature guides unless the document is explicitly a migration or changelog document.
- Describe behavior directly. Do not explain a current contract by contrasting it with an internal implementation history or an alternative contract the user was never promised.
- Keep guide structure familiar across the repo. Prefer a shared flow such as `Purpose`, `Use It When`, `Core Model`, `Important Behaviours`, and `Choosing The Right API` unless a guide has a strong reason to differ.
- Keep `docs/README.md` reader-facing. Maintainer guidance, authoring rules, and agent instructions belong in `AGENTS.md` or contributor docs, not in the public docs index.
- Keep philosophy guides durable. They should express stable principles, tradeoffs, and anti-goals rather than current package layout, feature catalogs, or temporary implementation details.

## Language Rules

- Use British English in reader-facing guides by default. Keep code identifiers, API names, and quoted external names unchanged unless there is a specific reason to adapt them.
- Use simple American English for code-facing writing by default. Prefer it for identifiers, API names, source comments, and code-adjacent doc comments so authored code stays predictable and easy to scan.

## Before Finishing

- Did I add only proven API surface, or did I publish speculation that no real caller uses yet?
- Did I justify each Bedrock wrapper and cast against the documented API contract?
- Did I introduce any duplicated exported vocabulary for an existing shared primitive or shape?
- Does any helper that delegates to a shared primitive return a genuinely different result, or did I just mirror the primitive's output under a new name?
- Does any exported object carry fields that are fully derivable from another field already present?
- Does each query-backed or collection-like type still have one clear identity, or did I blur it by adding methods that belong to a different abstraction?
- Did I add a singular helper for a concept that is still fundamentally plural, without a real uniqueness invariant to justify it?
- Did I add a narrow helper for one current naming pattern when a small generic matcher or filter would have produced a cleaner long-term API?
- Did I keep public types, docs, tests, exports, and package metadata aligned?
- Does `npm run check` need to pass for this change?
