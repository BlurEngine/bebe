# Audio Guide

## Purpose

`Audio` plays compact Bebe audio packs compiled from hand-written BAUD files.

BAUD is a small Bebe-authored plaintext format for quick Minecraft sound cues.
Those cues can be melodies, stingers, UI feedback, ambience beds, or short sound
effect sequences. Authors write BAUD sources under `audio/`, `blr` compiles
them into a compact runtime pack, and gameplay code plays a named cue through
the root `Audio` service.

## Use It When

- you want fast hand-written cues that use Minecraft sound ids directly
- you want checked-in `audio/` sources instead of generated runtime data
- you want `blr` to compile those sources into
  `dist/generated/bebe/audio.json`
- runtime playback should be owned by an explicit `Context`
- nearby players should hear a cue from a world position without requiring a
  specific player target

## Core Model

BAUD project sources live under the `audio/` folder:

```text
audio/
  intro.baud
  rewards.baud
  areas/
    meadow.baud
```

A BAUD file can contain one or more cues. Each cue has one or more voices, and
each voice points at a Minecraft sound id:

```baud
cue reward.success t140

@lead note.harp o5 l8 v80
c e g > c r g e c

@sparkle note.bell o6 l16 v55
r c r e r g r > c

@bass note.bass o3 l4 v65
c r g r c2
```

Use [Audio Sound Design Guide](./audio-sound-design.md) when choosing sound ids
or diagnosing why a valid sound feels muddy, late, random, or out of tune.

When `audio/**/*.baud` exists, `blr` resolves
`@blurengine/bebe/tooling/node` from the project installation and asks Bebe's
audio compiler to bake the files. The compiler writes the compact pack to
`dist/generated/bebe/audio.json`, `blr` copies that JSON into staged scripts,
and the generated bootstrap injects `Audio.load(...)` before the authored
runtime entry runs.

Runtime code imports `Audio` from the root package and plays a cue id through a
`Context`:

```ts
import { Audio, Context } from "@blurengine/bebe";

const ctx = new Context();

Audio.play(ctx, "reward.success", { target: player });
```

To play from a world position, pass a dimension and location instead of a
player target:

```ts
Audio.play(ctx, "machine.start", {
  dimension: player.dimension,
  location: machineBlock.location,
});
```

World-position playback calls Bedrock's dimension sound playback, so Bedrock
handles distance and audibility for nearby players naturally. The cue does not
need a player target, but the scheduled notes still belong to the supplied
`Context`.

## BAUD Syntax

- `cue <id> t<bpm>` starts a cue. The id is the runtime key used by
  `Audio.play(...)`, and `t<bpm>` sets the tempo.
- `@<voice> <sound> o<octave> l<length> v<volume>` starts or updates a voice.
  The voice name is an authoring label, `<sound>` is the Minecraft sound id,
  `o` sets octave, `l` sets the default duration denominator, and `v` is
  `0..100`.
- Notes use `c`, `d`, `e`, `f`, `g`, `a`, and `b`.
- Sharps and flats use `#` and `b`, such as `f#` or `bb`.
- Rests use `r` and advance the voice without playing a sound.
- Octave shifts use `>` to move up and `<` to move down for following tokens in
  that voice.
- Durations use denominator suffixes, such as `c8` or `r2`. A note or rest
  without a suffix uses the voice's current `l<length>` value.
- Dotted notes add a `.` suffix, such as `c4.` or `r8.`.
- Chords use square brackets, such as `[c e g]` or `[e g > c]4.`. Notes inside
  the chord share one start tick, and the chord duration advances the voice
  once.
- Bars use `|` for readability and do not change timing.
- `//` comments run to the end of the line.

## Important Behaviours

BAUD is not MIDI. The compiled pack stores MIDI note numbers internally only as
a pitch identity so playback can calculate Minecraft sound pitch consistently.
BAUD is the authored source format, and runtime code loads compiled Bebe audio
packs rather than public MIDI files.

Durations are converted to Bedrock ticks. Bebe rounds each duration to the
nearest whole tick and clamps it to at least one tick, so very fast tempos or
small durations can shift by a tick compared with ideal musical notation.

Only `audio/**/*.baud` files are project BAUD sources. A root-level
`audio.baud` file is rejected; put BAUD files under the `audio/` folder
instead.

`Audio.load(...)` loads compiled packs. `Audio.play(...)` schedules notes
against the supplied `Context`, and disposing that `Context` cancels any future
notes for the playback. Calling `stop()` on the returned playback controller
also cancels pending notes.

The compiled `generated/bebe/audio.json` pack is playback data only. It uses
compact fields: `v` for format version, `s` for the shared sound table, and `c`
for cue tuples. It does not include authoring metadata such as source voice
labels, rests, bars, or line positions. During `blr dev`, the audio compiler
also writes a development sidecar at `generated/bebe/audio.visuals.json` for the
injected audio command. That sidecar is source-derived visual metadata, not
gameplay playback data, and packaged output does not need it.

During `blr dev`, the CLI can inject Bebe's internal audio player command when
the installed Bebe package exposes it. The command uses the project namespace:

```text
/<namespace>:audio list
/<namespace>:audio play reward.success
/<namespace>:audio reward.success
/<namespace>:audio text "cue preview t120; @lead note.harp o4 l4 v80; c e g > c"
```

The command plays loaded cue ids, not BAUD file names. The `text` action is a
development shortcut for auditioning one inline BAUD cue without writing a file;
use `;` where a BAUD file would normally use a newline. Literal `\n` separators
are also accepted. Inline command text must declare exactly one cue and does not
replace the loaded project audio pack.

Playing a loaded cue id or a compiled inline text cue through the dev command
also shows a compact coloured action bar visualisation for the command player
while the cue plays. In `blr dev`, loaded project cues use the generated
`audio.visuals.json` sidecar when it is available, so the action bar can show
the same source-aware `@voice:` layers as inline text. If that sidecar is not
available, loaded cues fall back to a compact one-line view derived from the
compiled playback data.

In the source-aware view, each voice is shown on a shared time grid. Each
visible grid cell is explicitly coloured: the active cell is white and bold,
future notes use resolved pitch colour, past cells use dark grey, and other
inactive rests, held cells, empty cells, or unknown pitch cells use light grey.
Rests use `r`, held or empty cells use `_`, and chords are shown as a single
compact chord marker so one chord does not create extra time columns. The
progress counter is zero-padded to the total duration width, and the view is
padded with an approximate Minecraft font width so Bedrock's centred action bar
keeps voice layers and note columns lined up. The dev command greys past notes
by default; code that installs the command can pass `greyPastNotes: false` to
keep past notes coloured by pitch. The dev command gets that visualisation data
without adding those fields to `audio.json`.

The command is development tooling for auditioning BAUD cues in-game; gameplay
code should keep calling `Audio.play(...)` directly.
