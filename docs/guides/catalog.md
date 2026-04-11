# Catalog Guide

## Purpose

This guide explains the block catalog surface under `@blurengine/bebe/catalog`.

Use it when you want immutable block categories, tag-based queries, or the built-in vanilla block preset without carrying large block tables inside gameplay features.

## Use It When

- you need block ids grouped by tags such as `family:oak` or `kind:log`
- you want tags inferred from vanilla block id patterns such as `acacia_button` or `light_blue_wool`
- you want a maintained vanilla block preset in engine code
- you want to derive project-specific block categories from a stable base
- you want block categorization without inventing a feature-specific query language

## Core Model

The catalog surface has two layers:

- a generic `BlockCatalog` primitive
- the built-in `vanillaBlockCatalog` preset

Each catalog entry has:

- one block id
- a list of namespaced string tags

Example tags:

- `family:oak`
- `color:red`
- `kind:log`
- `kind:button`
- `kind:crop`
- `kind:flower`
- `kind:foliage`
- `kind:gravity`
- `kind:leaf`
- `kind:liquid`
- `kind:storage`
- `kind:redstone`
- `kind:stripped`
- `kind:technical`
- `kind:utility`
- `kind:attachment`
- `feature:education`

Queries are structured object filters rather than a string DSL.

```ts
import { vanillaBlockCatalog } from "@blurengine/bebe/catalog";

const oakLogs = vanillaBlockCatalog.queryIds({
  all: ["family:oak", "kind:log"],
});
```

## Important Behaviors

- `BlockCatalog` is immutable. Overlays derive a new catalog instead of mutating the base one.
- The vanilla preset is opt-in. Importing `@blurengine/bebe/catalog` is the only time the built-in block preset enters your feature code.
- The built-in vanilla preset is generated from `@minecraft/vanilla-data`, using ordered kind rules, color inference, family extraction from the material prefix, and a small exact-override layer for edge cases.
- Feature tags can be sparse and positive-only. For example, Education-only blocks carry `feature:education`, while normal blocks are not given a matching "non-education" tag.
- Some blocks intentionally end up with no tags at all. `air` is a normal example. The preset is allowed to stay sparse when a block id does not match a rule that has earned its keep yet.
- The preset does not add a synthetic "this is vanilla" tag to every block. The block id namespace already carries that information, so the built-in tag set stays focused on categories that are harder to infer cleanly from the id alone.
- The vanilla preset keeps its tag vocabulary intentionally small and extensible. It is meant to help feature code stay declarative, not to model every gameplay concept in the engine on day one.
- Prefer plural family helpers such as `getFamilyTags(...)` and `getCatalogFamilyTags(...)` when a block can intentionally carry more than one `family:*` tag.
- Singular helpers such as `getFamilyTag(...)` and `getCatalogFamilyTag(...)` are first-match convenience helpers. They are fine when one family is expected, but they should not be treated as the authoritative whole family set.
- `queryFamily(...)` and `queryCatalogFamily(...)` are convenience helpers for querying one known `family:*` tag at a time.

## Customizing A Catalog

The intended workflow is:

1. start from `vanillaBlockCatalog`
2. derive a project catalog with an overlay
3. use that derived catalog inside your feature code

```ts
import { vanillaBlockCatalog } from "@blurengine/bebe/catalog";

const projectBlockCatalog = vanillaBlockCatalog.extend({
  addTags: {
    "my:sky_log": ["family:sky", "kind:log"],
    "minecraft:azalea_leaves": ["family:oak"],
  },
  removeTags: {
    "minecraft:azalea_leaves": ["family:azalea"],
  },
});
```

This keeps project customization small and upgrade-friendly.

## Choosing The Right API

- use `BlockCatalog` when you need a generic immutable block tagging and query surface
- use `vanillaBlockCatalog` when you want maintained vanilla block categories
- use overlays when project code needs to extend or tweak the built-in preset
- keep feature-specific rules, such as exact tree-collapse behavior, in project code rather than forcing them into the engine preset

## Generator Reporting

`npm run generate:catalog` also writes a coverage report to:

- `temp/catalog/vanilla-block-catalog.report.json`

The generator prints a short summary after each run:

- total entries
- tagged and untagged counts with percentages
- expected empty ids
- unexpected empty ids
- how many entries received `kind:*`, `family:*`, and `color:*` tags
- a heuristic split of the remaining unexpected-empty ids into likely `family`, likely `kind`, both, or unclear gaps

Use `unexpectedEmptyIds` as the main gap list when evaluating catalog quality. If some empty ids are expected, add them to the generator's expected-empty allowlist instead of burying them in feature code.

To print the full current unexpected-empty list directly in the terminal, run:

- `node ./scripts/generate-block-catalog.mjs --list-unexpected-empty`
