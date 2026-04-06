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

## Framework Design Rules

- Prefer extracting reusable primitives over reimplementing the same pattern inside feature files. If two systems need local events, polling, or composition, extend the shared primitives first.
- Keep generic framework building blocks separate from Minecraft-specific catalogs. New trigger, monitor, or blueprint behavior should only become Bedrock-specific at the edge.
- If Bedrock is missing an API and `bebe` fills the gap through polling or derived state, design that solution so consumers can reuse the same primitive to build their own higher-level features.
- When naming similar capabilities, prefer one vocabulary and one implementation path. Avoid sibling APIs that solve the same problem with slightly different names or behavior.
- Use `Facing` as the engine term for the six block-adjacent offsets derived from Bedrock's `Direction` enum. Reserve `direction` for arbitrary vectors, look directions, or orientation math unless Bedrock interop requires the original name.
- In maths APIs, prefer the class types (`Vec2`, `Vec3`, `AABB`) as the primary authored surface. Keep raw structural helpers only for Bedrock interop, scalar queries, and low-allocation edge work; do not mirror the full class algebra in util helpers.
- Use named exported types instead of repeating anonymous structural shapes in public maths APIs when those shapes appear more than once.
- Plain utility names should be safe transforms for normal finite inputs. Use `parse...` for fallible conversion that returns `undefined`, and `assert...` for explicit validation that throws.

## Bedrock Edge Rules

- Match defensive wrappers to the documented API contract. Do not wrap Bedrock calls in `attemptBedrock` unless the docs or observed runtime behavior show that the call can throw in normal use.
- Prefer Bedrock's mapped return types when they are already precise. Do not add redundant casts such as `as SomeComponent | undefined` for known `getComponent(...)` ids when the API already returns that type.
- Do not add speculative defensiveness or semantic no-op code. Avoid redundant normalization such as `?? undefined`, identity wrappers, or extra helper layers unless they change real runtime behavior, remove repeated complexity, or establish a proven semantic boundary.

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
- Did I keep public types, docs, tests, exports, and package metadata aligned?
- Does `npm run check` need to pass for this change?
