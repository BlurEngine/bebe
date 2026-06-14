# Audio Sound Design Guide

## Purpose

BAUD voices can target Minecraft Bedrock sound ids directly. This guide records
which vanilla sound families are good authoring starting points and what
behaviour to expect from them.

This is deliberately not a catalogue of every Minecraft sound. It is a curated
palette for sounds that make sense in hand-written BAUD cues.

## Use It When

- you are choosing a sound id for a BAUD voice
- a BAUD layer plays correctly but feels late, muddy, random, or out of tune
- you want known-good sound ids before testing a cue in-game
- you are deciding whether a custom resource-pack sound should be shaped like a
  musical instrument, a one-shot effect, or ambience

## Core Model

BAUD does not validate sound ids against the vanilla catalogue. That is
intentional: projects can add custom sounds in their own resource packs, and
those ids should compile without Bebe needing to know about them. A missing or
unplayable id is discovered at Bedrock playback time.

Bebe schedules each compiled note by tick and calls Bedrock sound playback with
the voice sound id, resolved volume, and resolved pitch. The sound itself is not
trimmed, stopped, looped, or envelope-shaped by BAUD after playback begins.

Pitch is derived from the authored note name. Internally, BAUD stores a
MIDI-style semitone key so playback can compute a Bedrock pitch multiplier.
MIDI key 66 maps to `pitch: 1`, so `o4 f#` is closest to the source sample's
native pitch. For practical writing, start melodies around `o4` or `o5`, bass
around `o2` or `o3`, and sparkles around `o5` or `o6`.

## Recommended Sound Roles

| Role                   | Good starting sounds                                                                          | Expected behaviour                                                                                              |
| ---------------------- | --------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Lead melody            | `note.harp`, `note.pling`, `note.bell`, `note.chime`, `note.flute`, `note.guitar`, `note.bit` | Short, pitched, and usually readable across several octaves.                                                    |
| Bass                   | `note.bass`, `note.bassattack`, `note.didgeridoo`                                             | Strong low layer, but decay can overlap fast notes. Leave rests or lower volume when it muddies.                |
| Percussion             | `note.bd`, `note.snare`, `note.hat`, `note.cow_bell`, `note.iron_xylophone`                   | Best for rhythmic pulses; pitch can be useful as colour, but not as true melody.                                |
| Cute or reward sparkle | `note.bell`, `note.chime`, `random.orb`, `random.levelup`, `random.pop`                       | Works well for short positive cues. `random.*` sounds are usually better as accents than repeating instruments. |
| Impact                 | `note.bd`, `note.bass`, `random.explode`, `random.anvil_land`, `random.totem`                 | Good for stingers and hits. Long effects can cover later notes.                                                 |
| Mechanical or UI click | `random.click`, `random.lever_click`, `random.wood_click`, `random.stone_click`, `ui.*`       | Good for rhythm and feedback; many are too short or noisy for melody.                                           |
| Atmosphere             | `ambient.*`, `mob.*`, `music.*`, `record.*`                                                   | Use sparingly as one-shots or beds. They are usually poor pitched instruments.                                  |

## Expected Good Behaviours

`note.*` sounds are the safest default for pitched BAUD cues. They come from the
same general design space as note blocks: short samples, clear attacks, and
predictable pitch movement. They are not all equivalent, though. A flute can
carry a melody, a hat is percussion, and a creature-like note sound can become
comedic or harsh when moved too far from its native pitch.

`random.*` sounds are valid BAUD sound ids, but they should usually be treated
as effects. They often have strong transients, built-in pitch, or variant
selection in the Bedrock sound definition. They can be excellent in sparse
places and chaotic when repeated quickly.

`ambient.*`, `music.*`, `record.*`, and many `mob.*` sounds can play through
BAUD, but they are usually not good instruments. They may be long, already
musical, spatially suggestive, randomised, or emotionally specific. Use them
when that character is the point.

Long samples keep playing after BAUD has advanced to the next note. BAUD does
not send a matching stop call for each note because Bedrock sound playback does
not give this feature a reliable per-note envelope surface. If bass or impact
layers leave trailing notes, write more air into the part, lower the volume, or
choose a shorter sample.

Very fast durations are rounded to whole Bedrock ticks. At high tempo or tiny
lengths, the mathematically ideal rhythm and the in-game rhythm can differ by a
tick. Prefer clear sixteenth-note writing over dense decorative runs when the
cue needs to feel locked.

Chords trigger several pitches at the same tick using the same voice sound id.
They are compact and useful, but wide chords on long samples can get loud or
phasey. Keep chord voices lower in volume than single-note voices.

Volume is authored as `v0` through `v100` and maps to Bedrock playback volume
`0` through `1`. Source samples can still feel louder or quieter than each
other, so balance by ear instead of assuming two voices with the same `v` will
sit equally in the mix.

## Choosing A Sound

Start with one `note.*` lead and one simple bass or percussion layer. Add
effects only when the main idea already reads clearly. For hand-written BAUD,
the fastest feedback loop is usually:

```text
/<namespace>:audio text "cue audition t120; @lead note.harp o4 l8 v80; c d e g > c"
```

Then swap only the sound id:

```text
/<namespace>:audio text "cue audition t120; @lead note.flute o4 l8 v80; c d e g > c"
```

For project files, keep BAUD sources under `audio/` and use
[Audio Guide](./audio.md) for syntax, compilation, and playback rules.

## Maintaining The Palette

Keep this guide curated. Add sounds when they have been auditioned in BAUD and
have a clear authoring role, such as lead, bass, percussion, sparkle, impact,
click, or atmosphere.

Do not paste the vanilla Bedrock sound catalogue into Bebe docs. If a project
needs a wider search, inspect its resource-pack sound definitions or Mojang's
sample resource pack outside the engine docs, then promote only the sounds that
earn a practical BAUD role back into this guide.

Custom project sounds should follow the same rule: document the role and
behaviour, not just the id.
