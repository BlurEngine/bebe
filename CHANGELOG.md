# Changelog

## 0.10.0

### Minor Changes

- [#65](https://github.com/BlurEngine/bebe/pull/65) [`d722e26`](https://github.com/BlurEngine/bebe/commit/d722e268d7e8c566ce6f7af75dad592452b8f685) Thanks [@SupaHam](https://github.com/SupaHam)! - Add exact authored-location packs, deterministic three-dimensional path maths,
  Node-safe tooling exports, and reusable voxel key and quarter-turn primitives.
  Keep the public maths barrel safe outside Minecraft while preserving the
  Bedrock-compatible `Facing` contract.

## 0.9.0

### Minor Changes

- [`1a3440c`](https://github.com/BlurEngine/bebe/commit/1a3440c9711e1afd89887970a251fe3af6026879) Thanks [@SupaHam](https://github.com/SupaHam)! - Add BAUD audio cue authoring, compact audio pack tooling, the root `Audio` runtime service, a deterministic MIDI-to-BAUD tooling converter with mapped/dropped-part diagnostics, velocity/channel-volume/expression-derived BAUD volumes, sustain-aware note durations, ignored-feature diagnostics, and Minecraft-safe playback profiles that collapse duplicate starts, thin dense low bass, and budget unsafe same-tick stacks by default, plus an internal dev command for auditioning loaded or inline BAUD cues with a picker, per-player command playback clearing/replacement, and an action bar visualizer that keeps richer inline authoring metadata out of shipped audio packs.

## 0.8.0

### Minor Changes

- [`88a02c0`](https://github.com/BlurEngine/bebe/commit/88a02c0906518c2a8a285cd726447581e3810ed7) Thanks [@SupaHam](https://github.com/SupaHam)! - Add BAUD audio cue authoring, compact audio pack tooling, the root `Audio` runtime service, and an internal dev command for auditioning loaded or inline BAUD cues with an action bar visualizer that keeps richer inline authoring metadata out of shipped audio packs.

## 0.7.0

### Minor Changes

- [`c8c321d`](https://github.com/BlurEngine/bebe/commit/c8c321d24122bf0d0e94b473b3b78acb1b8c3a6e) Thanks [@SupaHam](https://github.com/SupaHam)! - Add RenderAnchors runtime and tooling support for Bebe-owned distant entity visuals.

## 0.6.0

### Minor Changes

- [`885e8db`](https://github.com/BlurEngine/bebe/commit/885e8dbae1024c0d00c47ae6813da429de9521c8) Thanks [@SupaHam](https://github.com/SupaHam)! - Add extents, the Zones runtime, zone pack tooling, and internal zone editor hooks for development workflows.

- [`426a173`](https://github.com/BlurEngine/bebe/commit/426a1738399ab7e4cb5a72f8a8a3516afcda7b3b) Thanks [@SupaHam](https://github.com/SupaHam)! - Add Link and Metrics bridge APIs plus the BDS Link transport used by local-server integrations.

## 0.5.1

### Patch Changes

- [`7df0d52`](https://github.com/BlurEngine/bebe/commit/7df0d52bd97b8279054483241665eab663336eb3) Thanks [@SupaHam](https://github.com/SupaHam)! - Add opt-in derived fishing events under `@blurengine/bebe/features/fishing`.

- [`25ed66d`](https://github.com/BlurEngine/bebe/commit/25ed66d219bd6024b14ed8cf4db363cd0d0973fd) Thanks [@SupaHam](https://github.com/SupaHam)! - Add a Bedrock helper for safely reading copied item stacks from item entities.

- [`ba13fbc`](https://github.com/BlurEngine/bebe/commit/ba13fbcb37ed3378b402ea6a28f59a7088466f28) Thanks [@SupaHam](https://github.com/SupaHam)! - Add a root-level `EventSignal` subscribable source for derived framework and project events.
  Add `EventSignalSource` for public APIs that should expose subscription without exposing event emission.

## 0.5.0

### Minor Changes

- [`c0e6521`](https://github.com/BlurEngine/bebe/commit/c0e6521b067b09d26182a217bc5bf376353e6c50) Thanks [@SupaHam](https://github.com/SupaHam)! - Add more support for vector ops, enhance catalog API, more bedrock block util funcs, and staggerByGroup.

## 0.4.0

### Minor Changes

- [`68f09fa`](https://github.com/BlurEngine/bebe/commit/68f09fa53407de05123c34cfe9457ecb4c2bb769) Thanks [@SupaHam](https://github.com/SupaHam)! - Add a new `@blurengine/bebe/catalog` surface with immutable block catalogs, generated vanilla block tags, and overlay-based catalog customization helpers.

## 0.3.0

### Minor Changes

- [`55ed6f9`](https://github.com/BlurEngine/bebe/commit/55ed6f988c5a8bb3601f72e50f4ec64cf79a3983) Thanks [@SupaHam](https://github.com/SupaHam)! - Add context-owned stagger helpers plus new `@blurengine/bebe/bedrock` and voxel maths.

## 0.2.0

### Minor Changes

- [`dbfa2b2`](https://github.com/BlurEngine/bebe/commit/dbfa2b27ff7962398539cf1a867689d52810c5d1) Thanks [@SupaHam](https://github.com/SupaHam)! - add maths and guides

All notable changes to `@blurengine/bebe` will be documented in this file.
