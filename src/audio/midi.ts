export type MidiToBaudLayerId = "right" | "inner" | "left";

export type MidiToBaudProfile = "compact" | "minecraft" | "raw";

export type MidiToBaudPolicyOptions = {
    readonly lowBassMinimumPitch?: number;
    readonly lowBassMinimumTickGap?: number;
    readonly maxSimultaneousNotes?: number;
    readonly maxWeightedPressure?: number;
};

export type MidiToBaudOptions = {
    readonly cueId: string;
    readonly lineLength?: number;
    readonly policy?: MidiToBaudPolicyOptions;
    readonly profile?: MidiToBaudProfile;
    readonly soundId?: string | Partial<Record<MidiToBaudLayerId, string>>;
    readonly tempo?: number;
    readonly volumes?: Partial<Record<MidiToBaudLayerId, number>>;
};

export type MidiToBaudDiagnostic =
    | {
          readonly kind: "mappedPart";
          readonly midiChannel: number;
          readonly noteCount: number;
          readonly program?: number;
          readonly programName?: string;
          readonly soundId: string;
          readonly voiceId: string;
      }
    | {
          readonly kind: "droppedPart";
          readonly midiChannel: number;
          readonly noteCount: number;
          readonly program?: number;
          readonly programName?: string;
          readonly reason: "unsupportedProgram" | "unsupportedPercussion";
      }
    | {
          readonly kind: "optimizedPlayback";
          readonly noteCount: number;
          readonly profile: MidiToBaudProfile;
          readonly reason:
              | "duplicateNote"
              | "lowBassDensity"
              | "pressureBudget"
              | "simultaneousBudget";
      }
    | {
          readonly kind: "approximatedFeature";
          readonly feature: "dynamics";
          readonly noteCount: number;
          readonly reason: "voiceVolume";
          readonly voiceId: string;
      }
    | {
          readonly kind: "approximatedFeature";
          readonly count: number;
          readonly feature: "tempoMap";
          readonly reason: "bakedTiming";
      }
    | {
          readonly kind: "ignoredFeature";
          readonly count: number;
          readonly feature:
              | "pan"
              | "pitchBend"
              | "timeSignatureChange"
              | "trackName";
          readonly reason:
              | "metadataOnly"
              | "singleGrid"
              | "spatialPlayback"
              | "unsupportedSourceFeature";
      };

export type MidiToBaudConversion = {
    readonly baud: string;
    readonly diagnostics: readonly MidiToBaudDiagnostic[];
};

type MidiNote = {
    readonly channel: number;
    readonly endTick: number;
    readonly effectiveVelocity: number;
    readonly pitch: number;
    readonly program?: number;
    readonly startTick: number;
    readonly velocity: number;
};

type OpenMidiNote = {
    readonly effectiveVelocity: number;
    readonly program?: number;
    readonly tick: number;
    readonly velocity: number;
};

type MidiTempo = {
    readonly microsecondsPerQuarter: number;
    readonly order: number;
    readonly tick: number;
};

type MidiTimeSignature = {
    readonly denominator: number;
    readonly numerator: number;
    readonly tick: number;
};

type ParsedMidi = {
    readonly features: MidiFeatureCounts;
    readonly notes: readonly MidiNote[];
    readonly ppq: number;
    readonly tempos: readonly MidiTempo[];
    readonly timeSignatures: readonly MidiTimeSignature[];
};

type MidiFeatureCounts = {
    pan: number;
    pitchBend: number;
    trackName: number;
};

type NormalizedTempo = {
    readonly microsecondsPerQuarter: number;
    readonly tick: number;
};

type QuantizedNote = {
    readonly duration: number;
    readonly effectiveVelocity: number;
    readonly pitch: number;
};

type QuantizedMidiNote = QuantizedNote & {
    readonly channel: number;
    readonly program?: number;
    readonly tick: number;
};

type LayerEvent = {
    readonly duration: number;
    readonly effectiveVelocities: readonly number[];
    readonly pitches: readonly number[];
    readonly tick: number;
};

type LayerMap = Record<MidiToBaudLayerId, LayerEvent[]>;

type MidiPartRole = "bass" | "harmony" | "lead" | "percussion" | "texture";

type BaudVoice = {
    readonly events: readonly LayerEvent[];
    readonly id: string;
    readonly octave: number;
    readonly soundId: string;
    readonly volume: number;
};

type MidiPartMapping = {
    readonly minimumTickGap?: number;
    readonly octave?: number;
    readonly role: MidiPartRole;
    readonly soundId: string;
    readonly voiceId: string;
    readonly volume: number;
};

type MappedMidiPart = {
    readonly mapping: MidiPartMapping;
    readonly notes: readonly QuantizedMidiNote[];
    readonly part: MidiPartKey;
    readonly sourceIndex: number;
    readonly sourceNoteCount: number;
};

type MidiPartKey = {
    readonly channel: number;
    readonly percussionPitch?: number;
    readonly program?: number;
};

type NormalizedMidiToBaudPolicy = {
    readonly enabled: boolean;
    readonly lowBassMinimumPitch: number;
    readonly lowBassMinimumTickGap: number;
    readonly maxSimultaneousNotes: number;
    readonly maxWeightedPressure: number;
    readonly profile: MidiToBaudProfile;
    readonly ticksPerBeat: number;
};

type MidiPolicyNoteRef = {
    readonly key: string;
    readonly mappedPitch: number;
    readonly mapping: MidiPartMapping;
    readonly note: QuantizedMidiNote;
    readonly noteIndex: number;
    readonly partIndex: number;
    readonly pressure: number;
    readonly priority: number;
};

const DEFAULT_LINE_LENGTH = 96;
const DEFAULT_SOUND_ID = "note.harp";
const DEFAULT_LAYER_VOLUMES = {
    right: 88,
    inner: 58,
    left: 68,
} as const satisfies Record<MidiToBaudLayerId, number>;
const DEFAULT_LAYER_OCTAVES = {
    right: 5,
    inner: 4,
    left: 3,
} as const satisfies Record<MidiToBaudLayerId, number>;
const LAYER_ORDER = ["right", "inner", "left"] as const;
const CUE_ID_PATTERN = /^[a-z0-9][a-z0-9._:-]*$/i;
const MIDI_TICKS_PER_SECOND = 20;
const MIDI_HEADER_LENGTH = 6;
const DEFAULT_TEMPO_MICROSECONDS = 500_000;
const DEFAULT_MIDI_CHANNEL_VOLUME = 100;
const DEFAULT_MIDI_EXPRESSION = 127;
const MIDI_SUSTAIN_THRESHOLD = 64;
const MINECRAFT_MIDI_POLICY = {
    lowBassMinimumPitch: 36,
    lowBassMinimumTickGap: 4,
    maxSimultaneousNotes: 8,
    maxWeightedPressure: 7,
} as const;
const COMPACT_MIDI_POLICY = {
    lowBassMinimumPitch: 38,
    lowBassMinimumTickGap: 6,
    maxSimultaneousNotes: 6,
    maxWeightedPressure: 5.5,
} as const;
const RAW_MIDI_POLICY = {
    lowBassMinimumPitch: 0,
    lowBassMinimumTickGap: 1,
    maxSimultaneousNotes: Number.POSITIVE_INFINITY,
    maxWeightedPressure: Number.POSITIVE_INFINITY,
} as const;
const NOTE_NAMES: Record<number, string> = {
    0: "c",
    1: "c#",
    2: "d",
    3: "eb",
    4: "e",
    5: "f",
    6: "f#",
    7: "g",
    8: "ab",
    9: "a",
    10: "bb",
    11: "b",
};
const GENERAL_MIDI_PROGRAM_NAMES = [
    "Acoustic Grand Piano",
    "Bright Acoustic Piano",
    "Electric Grand Piano",
    "Honky-tonk Piano",
    "Electric Piano 1",
    "Electric Piano 2",
    "Harpsichord",
    "Clavinet",
    "Celesta",
    "Glockenspiel",
    "Music Box",
    "Vibraphone",
    "Marimba",
    "Xylophone",
    "Tubular Bells",
    "Dulcimer",
    "Drawbar Organ",
    "Percussive Organ",
    "Rock Organ",
    "Church Organ",
    "Reed Organ",
    "Accordion",
    "Harmonica",
    "Tango Accordion",
    "Acoustic Guitar nylon",
    "Acoustic Guitar steel",
    "Electric Guitar jazz",
    "Electric Guitar clean",
    "Electric Guitar muted",
    "Overdriven Guitar",
    "Distortion Guitar",
    "Guitar harmonics",
    "Acoustic Bass",
    "Electric Bass finger",
    "Electric Bass pick",
    "Fretless Bass",
    "Slap Bass 1",
    "Slap Bass 2",
    "Synth Bass 1",
    "Synth Bass 2",
    "Violin",
    "Viola",
    "Cello",
    "Contrabass",
    "Tremolo Strings",
    "Pizzicato Strings",
    "Orchestral Harp",
    "Timpani",
    "String Ensemble 1",
    "String Ensemble 2",
    "SynthStrings 1",
    "SynthStrings 2",
    "Choir Aahs",
    "Voice Oohs",
    "Synth Voice",
    "Orchestra Hit",
    "Trumpet",
    "Trombone",
    "Tuba",
    "Muted Trumpet",
    "French Horn",
    "Brass Section",
    "SynthBrass 1",
    "SynthBrass 2",
    "Soprano Sax",
    "Alto Sax",
    "Tenor Sax",
    "Baritone Sax",
    "Oboe",
    "English Horn",
    "Bassoon",
    "Clarinet",
    "Piccolo",
    "Flute",
    "Recorder",
    "Pan Flute",
    "Blown Bottle",
    "Shakuhachi",
    "Whistle",
    "Ocarina",
    "Lead 1 square",
    "Lead 2 sawtooth",
    "Lead 3 calliope",
    "Lead 4 chiff",
    "Lead 5 charang",
    "Lead 6 voice",
    "Lead 7 fifths",
    "Lead 8 bass + lead",
    "Pad 1 new age",
    "Pad 2 warm",
    "Pad 3 polysynth",
    "Pad 4 choir",
    "Pad 5 bowed",
    "Pad 6 metallic",
    "Pad 7 halo",
    "Pad 8 sweep",
    "FX 1 rain",
    "FX 2 soundtrack",
    "FX 3 crystal",
    "FX 4 atmosphere",
    "FX 5 brightness",
    "FX 6 goblins",
    "FX 7 echoes",
    "FX 8 sci-fi",
    "Sitar",
    "Banjo",
    "Shamisen",
    "Koto",
    "Kalimba",
    "Bag pipe",
    "Fiddle",
    "Shanai",
    "Tinkle Bell",
    "Agogo",
    "Steel Drums",
    "Woodblock",
    "Taiko Drum",
    "Melodic Tom",
    "Synth Drum",
    "Reverse Cymbal",
    "Guitar Fret Noise",
    "Breath Noise",
    "Seashore",
    "Bird Tweet",
    "Telephone Ring",
    "Helicopter",
    "Applause",
    "Gunshot",
] as const;
const PERCUSSION_CHANNEL = 9;

export function convertMidiToBaud(
    data: Uint8Array,
    options: MidiToBaudOptions,
): string {
    return convertMidiToBaudWithDiagnostics(data, options).baud;
}

export function convertMidiToBaudWithDiagnostics(
    data: Uint8Array,
    options: MidiToBaudOptions,
): MidiToBaudConversion {
    if (!CUE_ID_PATTERN.test(options.cueId)) {
        throw new Error(`Invalid BAUD cue id "${options.cueId}".`);
    }

    const midi = parseStandardMidi(data);
    if (midi.notes.length === 0) {
        throw new Error("MIDI file does not contain any playable notes.");
    }

    const tempos = normalizeTempos(midi.tempos);
    const outputTempo = normalizePositiveInteger(
        options.tempo ?? tempoToBpm(tempos[0].microsecondsPerQuarter),
        "tempo",
    );
    const durationLabels = createDurationLabels(outputTempo);
    const timeSignature = midi.timeSignatures[0] ?? {
        tick: 0,
        numerator: 4,
        denominator: 4,
    };
    const barTicks = Math.max(
        1,
        Math.round(
            timeSignature.numerator *
                (4 / timeSignature.denominator) *
                (60 / outputTempo) *
                MIDI_TICKS_PER_SECOND,
        ),
    );
    const firstSecond = firstMidiNoteSecond(midi.notes, midi.ppq, tempos);
    const diagnostics: MidiToBaudDiagnostic[] = [];
    const playbackPolicy = normalizeMidiPlaybackPolicy(options, outputTempo);
    const voices = midi.notes.some(
        (note) =>
            note.program !== undefined || note.channel === PERCUSSION_CHANNEL,
    )
        ? createMappedMidiVoices({
              diagnostics,
              firstSecond,
              midi,
              playbackPolicy,
              soundOverride:
                  typeof options.soundId === "string"
                      ? options.soundId
                      : undefined,
              tempos,
          })
        : createPianoMidiVoices({
              diagnostics,
              firstSecond,
              midi,
              playbackPolicy,
              soundIds: normalizeLayerSoundIds(options.soundId),
              tempos,
              volumes: normalizeLayerVolumes(options.volumes),
          });
    appendMidiFeatureDiagnostics(diagnostics, midi, tempos, voices);

    if (voices.length === 0) {
        throw new Error(
            "MIDI file does not contain any supported playable notes.",
        );
    }

    return {
        baud: renderBaud({
            barTicks,
            cueId: options.cueId,
            durationLabels,
            lineLength: options.lineLength ?? DEFAULT_LINE_LENGTH,
            tempo: outputTempo,
            voices,
        }),
        diagnostics,
    };
}

function appendMidiFeatureDiagnostics(
    diagnostics: MidiToBaudDiagnostic[],
    midi: ParsedMidi,
    tempos: readonly NormalizedTempo[],
    voices: readonly BaudVoice[],
): void {
    for (const voice of voices) {
        const velocities = voice.events.flatMap((event) => [
            ...event.effectiveVelocities,
        ]);
        if (
            new Set(velocities.map((velocity) => Math.round(velocity))).size > 1
        ) {
            diagnostics.push({
                kind: "approximatedFeature",
                feature: "dynamics",
                noteCount: velocities.length,
                reason: "voiceVolume",
                voiceId: voice.id,
            });
        }
    }

    if (tempos.length > 1) {
        diagnostics.push({
            kind: "approximatedFeature",
            count: tempos.length - 1,
            feature: "tempoMap",
            reason: "bakedTiming",
        });
    }
    if (midi.timeSignatures.length > 1) {
        diagnostics.push({
            kind: "ignoredFeature",
            count: midi.timeSignatures.length - 1,
            feature: "timeSignatureChange",
            reason: "singleGrid",
        });
    }
    appendIgnoredFeatureDiagnostic(
        diagnostics,
        midi.features.pan,
        "pan",
        "spatialPlayback",
    );
    appendIgnoredFeatureDiagnostic(
        diagnostics,
        midi.features.pitchBend,
        "pitchBend",
        "unsupportedSourceFeature",
    );
    appendIgnoredFeatureDiagnostic(
        diagnostics,
        midi.features.trackName,
        "trackName",
        "metadataOnly",
    );
}

function appendIgnoredFeatureDiagnostic(
    diagnostics: MidiToBaudDiagnostic[],
    count: number,
    feature: "pan" | "pitchBend" | "trackName",
    reason: "metadataOnly" | "spatialPlayback" | "unsupportedSourceFeature",
): void {
    if (count === 0) {
        return;
    }

    diagnostics.push({
        kind: "ignoredFeature",
        count,
        feature,
        reason,
    });
}

function createPianoMidiVoices(input: {
    readonly diagnostics: MidiToBaudDiagnostic[];
    readonly firstSecond: number;
    readonly midi: ParsedMidi;
    readonly playbackPolicy: NormalizedMidiToBaudPolicy;
    readonly soundIds: Readonly<Record<MidiToBaudLayerId, string>>;
    readonly tempos: readonly NormalizedTempo[];
    readonly volumes: Readonly<Record<MidiToBaudLayerId, number>>;
}): BaudVoice[] {
    const quantized = quantizeMidiNoteList(
        input.midi.notes,
        input.midi.ppq,
        input.tempos,
        input.firstSecond,
    );
    const policyParts = applyMidiPlaybackPolicy(
        [
            {
                mapping: {
                    role: "harmony",
                    soundId: input.soundIds.right,
                    voiceId: "piano",
                    volume: Math.max(...Object.values(input.volumes)),
                },
                notes: quantized,
                part: { channel: 0 },
                sourceIndex: 0,
                sourceNoteCount: quantized.length,
            },
        ],
        input.playbackPolicy,
        input.diagnostics,
    );
    const layers = assignLayers(
        groupQuantizedNotesByTick(policyParts.flatMap((part) => part.notes)),
    );

    return LAYER_ORDER.map((layerId) => ({
        events: layers[layerId],
        id: layerId,
        octave: DEFAULT_LAYER_OCTAVES[layerId],
        soundId: input.soundIds[layerId],
        volume: volumeForEvents(input.volumes[layerId], layers[layerId]),
    }));
}

function createMappedMidiVoices(input: {
    readonly diagnostics: MidiToBaudDiagnostic[];
    readonly firstSecond: number;
    readonly midi: ParsedMidi;
    readonly playbackPolicy: NormalizedMidiToBaudPolicy;
    readonly soundOverride?: string;
    readonly tempos: readonly NormalizedTempo[];
}): BaudVoice[] {
    const quantized = quantizeMidiNoteList(
        input.midi.notes,
        input.midi.ppq,
        input.tempos,
        input.firstSecond,
    );
    const partNotes = groupQuantizedNotesByPart(quantized);
    const mappedParts: MappedMidiPart[] = [];
    const partDiagnostics: Array<
        | {
              readonly diagnostic: MidiToBaudDiagnostic;
              readonly kind: "dropped";
          }
        | { readonly kind: "mapped"; readonly sourceIndex: number }
    > = [];
    const usedVoiceIds = new Set<string>();
    const voices: BaudVoice[] = [];

    for (const [key, notes] of [...partNotes.entries()].sort(
        comparePartEntries,
    )) {
        const part = parseMidiPartKey(key);
        const mapping = mapMidiPart(part, input.soundOverride);
        if (!mapping) {
            partDiagnostics.push({
                diagnostic: {
                    kind: "droppedPart",
                    midiChannel: part.channel + 1,
                    noteCount: notes.length,
                    ...(part.program === undefined
                        ? {}
                        : {
                              program: part.program + 1,
                              programName: midiProgramName(part.program),
                          }),
                    reason:
                        part.channel === PERCUSSION_CHANNEL
                            ? "unsupportedPercussion"
                            : "unsupportedProgram",
                },
                kind: "dropped",
            });
            continue;
        }

        const sourceIndex = mappedParts.length;
        const mappedNotes = prepareMappedNotes(notes, mapping.minimumTickGap);
        mappedParts.push({
            mapping,
            notes: mappedNotes,
            part,
            sourceIndex,
            sourceNoteCount: notes.length,
        });
        partDiagnostics.push({ kind: "mapped", sourceIndex });
    }

    const safeParts = applyMidiPlaybackPolicy(
        mappedParts,
        input.playbackPolicy,
        input.diagnostics,
    );
    const safePartsBySourceIndex = new Map(
        safeParts.map((part) => [part.sourceIndex, part]),
    );

    for (const partDiagnostic of partDiagnostics) {
        if (partDiagnostic.kind === "dropped") {
            input.diagnostics.push(partDiagnostic.diagnostic);
            continue;
        }

        const mappedPart = safePartsBySourceIndex.get(
            partDiagnostic.sourceIndex,
        );
        const originalPart = mappedParts[partDiagnostic.sourceIndex]!;
        const { mapping, part, sourceNoteCount } = originalPart;
        const notes = mappedPart?.notes ?? [];
        const partVoices = createMappedPartVoices({
            mapping,
            notes,
            splitReadableRegisters:
                part.channel !== PERCUSSION_CHANNEL && hasPolyphonicTick(notes),
            usedVoiceIds,
        });
        input.diagnostics.push({
            kind: "mappedPart",
            midiChannel: part.channel + 1,
            noteCount: sourceNoteCount,
            ...(part.program === undefined
                ? {}
                : {
                      program: part.program + 1,
                      programName: midiProgramName(part.program),
                  }),
            soundId: mapping.soundId,
            voiceId: partVoices[0]?.id ?? mapping.voiceId,
        });
        voices.push(...partVoices);
    }

    return voices;
}

function firstMidiNoteSecond(
    notes: readonly MidiNote[],
    ppq: number,
    tempos: readonly NormalizedTempo[],
): number {
    const tickToSeconds = createTickToSeconds(ppq, tempos);
    return Math.min(...notes.map((note) => tickToSeconds(note.startTick)));
}

function groupQuantizedNotesByPart(
    notes: readonly QuantizedMidiNote[],
): Map<string, QuantizedMidiNote[]> {
    const parts = new Map<string, QuantizedMidiNote[]>();
    for (const note of notes) {
        const key =
            note.channel === PERCUSSION_CHANNEL
                ? `drum:${note.pitch}`
                : `${note.channel}:${note.program ?? "none"}`;
        const part = parts.get(key) ?? [];
        part.push(note);
        parts.set(key, part);
    }

    return parts;
}

function comparePartEntries(
    left: readonly [string, readonly QuantizedMidiNote[]],
    right: readonly [string, readonly QuantizedMidiNote[]],
): number {
    const leftPart = parseMidiPartKey(left[0]);
    const rightPart = parseMidiPartKey(right[0]);
    return (
        leftPart.channel - rightPart.channel ||
        (leftPart.program ?? -1) - (rightPart.program ?? -1) ||
        (leftPart.percussionPitch ?? -1) - (rightPart.percussionPitch ?? -1)
    );
}

function parseMidiPartKey(key: string): {
    readonly channel: number;
    readonly percussionPitch?: number;
    readonly program?: number;
} {
    if (key.startsWith("drum:")) {
        return {
            channel: PERCUSSION_CHANNEL,
            percussionPitch: Number(key.slice("drum:".length)),
        };
    }

    const [channel, program] = key.split(":");
    return {
        channel: Number(channel),
        ...(program === "none" ? {} : { program: Number(program) }),
    };
}

function mapMidiPart(
    part: {
        readonly channel: number;
        readonly percussionPitch?: number;
        readonly program?: number;
    },
    soundOverride: string | undefined,
): MidiPartMapping | undefined {
    if (part.channel === PERCUSSION_CHANNEL) {
        const percussion = mapGeneralMidiPercussion(part.percussionPitch);
        if (!percussion) {
            return undefined;
        }

        return {
            ...(percussion.minimumTickGap === undefined
                ? {}
                : { minimumTickGap: percussion.minimumTickGap }),
            ...(percussion.octave === undefined
                ? {}
                : { octave: percussion.octave }),
            role: "percussion",
            soundId: soundOverride ?? percussion.soundId,
            voiceId: percussion.voiceId,
            volume: percussion.volume,
        };
    }

    if (part.program === undefined) {
        return {
            role: "harmony",
            soundId: soundOverride ?? DEFAULT_SOUND_ID,
            voiceId: `channel_${part.channel + 1}`,
            volume: 70,
        };
    }

    const program = mapGeneralMidiProgram(part.program);
    if (!program) {
        return soundOverride === undefined
            ? undefined
            : {
                  role: midiProgramRole(part.program),
                  soundId: soundOverride,
                  voiceId: midiProgramVoiceId(part.program),
                  volume: 70,
              };
    }

    return {
        role: midiProgramRole(part.program),
        soundId: soundOverride ?? program.soundId,
        voiceId: midiProgramVoiceId(part.program),
        volume: program.volume,
    };
}

function applyMidiPlaybackPolicy(
    parts: readonly MappedMidiPart[],
    policy: NormalizedMidiToBaudPolicy,
    diagnostics: MidiToBaudDiagnostic[],
): MappedMidiPart[] {
    if (!policy.enabled || parts.length === 0) {
        return [...parts];
    }

    const refs = collectMidiPolicyNoteRefs(parts, policy);
    const removed = new Set<string>();
    const counts = new Map<
        Extract<
            MidiToBaudDiagnostic,
            { readonly kind: "optimizedPlayback" }
        >["reason"],
        number
    >();

    dropDuplicatePolicyNotes(refs, removed, counts);
    thinLowBassPolicyNotes(refs, removed, counts, policy);
    budgetSameTickPolicyNotes(refs, removed, counts, policy);

    for (const [reason, noteCount] of counts.entries()) {
        diagnostics.push({
            kind: "optimizedPlayback",
            noteCount,
            profile: policy.profile,
            reason,
        });
    }

    return parts
        .map((part, partIndex) => ({
            ...part,
            notes: part.notes.filter(
                (_note, noteIndex) =>
                    !removed.has(policyNoteKey(partIndex, noteIndex)),
            ),
        }))
        .filter((part) => part.notes.length > 0);
}

function collectMidiPolicyNoteRefs(
    parts: readonly MappedMidiPart[],
    policy: NormalizedMidiToBaudPolicy,
): MidiPolicyNoteRef[] {
    return parts.flatMap((part, partIndex) =>
        part.notes.map((note, noteIndex) => {
            const mappedPitch = pitchForMapping(note, part.mapping);
            const pressure = midiPolicyNotePressure(
                note,
                part.mapping,
                mappedPitch,
            );
            return {
                key: policyNoteKey(partIndex, noteIndex),
                mappedPitch,
                mapping: part.mapping,
                note,
                noteIndex,
                partIndex,
                pressure,
                priority: midiPolicyNotePriority(
                    note,
                    part.mapping,
                    mappedPitch,
                    policy.ticksPerBeat,
                ),
            };
        }),
    );
}

function dropDuplicatePolicyNotes(
    refs: readonly MidiPolicyNoteRef[],
    removed: Set<string>,
    counts: Map<
        Extract<
            MidiToBaudDiagnostic,
            { readonly kind: "optimizedPlayback" }
        >["reason"],
        number
    >,
): void {
    const kept = new Map<string, MidiPolicyNoteRef>();
    for (const ref of [...refs].sort(comparePolicyNoteRefsByTimeline)) {
        const duplicateKey = [
            ref.note.tick,
            ref.mapping.soundId,
            ref.mappedPitch,
        ].join(":");
        const existing = kept.get(duplicateKey);
        if (!existing) {
            kept.set(duplicateKey, ref);
            continue;
        }

        if (comparePolicyNoteRefsByPriority(ref, existing) < 0) {
            markPolicyNoteRemoved(existing, "duplicateNote", removed, counts);
            kept.set(duplicateKey, ref);
        } else {
            markPolicyNoteRemoved(ref, "duplicateNote", removed, counts);
        }
    }
}

function thinLowBassPolicyNotes(
    refs: readonly MidiPolicyNoteRef[],
    removed: Set<string>,
    counts: Map<
        Extract<
            MidiToBaudDiagnostic,
            { readonly kind: "optimizedPlayback" }
        >["reason"],
        number
    >,
    policy: NormalizedMidiToBaudPolicy,
): void {
    if (policy.lowBassMinimumTickGap <= 1) {
        return;
    }

    const kept: MidiPolicyNoteRef[] = [];
    const lowBass = refs
        .filter(
            (ref) =>
                !removed.has(ref.key) &&
                ref.mapping.soundId === "note.bass" &&
                ref.mappedPitch < policy.lowBassMinimumPitch,
        )
        .sort(comparePolicyNoteRefsByTimeline);

    for (const ref of lowBass) {
        const conflictIndex = kept.findIndex(
            (candidate) =>
                ref.note.tick - candidate.note.tick <
                policy.lowBassMinimumTickGap,
        );
        if (conflictIndex === -1) {
            kept.push(ref);
            continue;
        }

        const conflict = kept[conflictIndex]!;
        if (comparePolicyNoteRefsByPriority(ref, conflict) < 0) {
            markPolicyNoteRemoved(conflict, "lowBassDensity", removed, counts);
            kept[conflictIndex] = ref;
        } else {
            markPolicyNoteRemoved(ref, "lowBassDensity", removed, counts);
        }
    }
}

function budgetSameTickPolicyNotes(
    refs: readonly MidiPolicyNoteRef[],
    removed: Set<string>,
    counts: Map<
        Extract<
            MidiToBaudDiagnostic,
            { readonly kind: "optimizedPlayback" }
        >["reason"],
        number
    >,
    policy: NormalizedMidiToBaudPolicy,
): void {
    const byTick = new Map<number, MidiPolicyNoteRef[]>();
    for (const ref of refs) {
        if (removed.has(ref.key)) {
            continue;
        }

        const group = byTick.get(ref.note.tick) ?? [];
        group.push(ref);
        byTick.set(ref.note.tick, group);
    }

    for (const group of byTick.values()) {
        const kept = [...group].sort(comparePolicyNoteRefsByPriority);
        let pressure = kept.reduce((total, ref) => total + ref.pressure, 0);

        while (kept.length > 1 && pressure > policy.maxWeightedPressure) {
            const removedRef = kept.pop()!;
            pressure -= removedRef.pressure;
            markPolicyNoteRemoved(
                removedRef,
                "pressureBudget",
                removed,
                counts,
            );
        }

        while (kept.length > policy.maxSimultaneousNotes) {
            const removedRef = kept.pop()!;
            markPolicyNoteRemoved(
                removedRef,
                "simultaneousBudget",
                removed,
                counts,
            );
        }
    }
}

function markPolicyNoteRemoved(
    ref: MidiPolicyNoteRef,
    reason: Extract<
        MidiToBaudDiagnostic,
        { readonly kind: "optimizedPlayback" }
    >["reason"],
    removed: Set<string>,
    counts: Map<
        Extract<
            MidiToBaudDiagnostic,
            { readonly kind: "optimizedPlayback" }
        >["reason"],
        number
    >,
): void {
    if (removed.has(ref.key)) {
        return;
    }

    removed.add(ref.key);
    counts.set(reason, (counts.get(reason) ?? 0) + 1);
}

function comparePolicyNoteRefsByTimeline(
    left: MidiPolicyNoteRef,
    right: MidiPolicyNoteRef,
): number {
    return (
        left.note.tick - right.note.tick ||
        left.partIndex - right.partIndex ||
        left.noteIndex - right.noteIndex
    );
}

function comparePolicyNoteRefsByPriority(
    left: MidiPolicyNoteRef,
    right: MidiPolicyNoteRef,
): number {
    return (
        right.priority - left.priority ||
        right.note.duration - left.note.duration ||
        right.note.effectiveVelocity - left.note.effectiveVelocity ||
        left.partIndex - right.partIndex ||
        left.noteIndex - right.noteIndex
    );
}

function midiPolicyNotePriority(
    note: QuantizedMidiNote,
    mapping: MidiPartMapping,
    mappedPitch: number,
    ticksPerBeat: number,
): number {
    const roleScore: Record<MidiPartRole, number> = {
        lead: 520,
        bass: 430,
        percussion: 390,
        harmony: 320,
        texture: 220,
    };
    const downbeatScore = note.tick % ticksPerBeat === 0 ? 40 : 0;
    const durationScore = Math.min(note.duration, MIDI_TICKS_PER_SECOND);
    const lowBassPenalty =
        mapping.soundId === "note.bass" && mappedPitch < 36 ? 130 : 0;
    const hatPenalty = mapping.voiceId === "hat" ? 120 : 0;
    const kickSnareScore =
        mapping.voiceId === "kick" || mapping.voiceId === "snare" ? 45 : 0;

    return (
        roleScore[mapping.role] +
        note.effectiveVelocity * 2 +
        durationScore +
        downbeatScore +
        kickSnareScore -
        lowBassPenalty -
        hatPenalty
    );
}

function midiPolicyNotePressure(
    note: QuantizedMidiNote,
    mapping: MidiPartMapping,
    mappedPitch: number,
): number {
    let weight = (mapping.volume * note.effectiveVelocity) / 10_000;
    if (mapping.soundId === "note.bass") {
        weight *= mappedPitch < 36 ? 2.4 : mappedPitch < 48 ? 1.7 : 1.25;
    } else if (mapping.soundId === "note.bd") {
        weight *= 1.8;
    } else if (mapping.soundId === "note.snare") {
        weight *= 1.7;
    } else if (mapping.soundId === "note.hat") {
        weight *= 0.65;
    } else if (mapping.soundId === "note.guitar") {
        weight *= 1.15;
    }

    return weight;
}

function policyNoteKey(partIndex: number, noteIndex: number): string {
    return `${partIndex}:${noteIndex}`;
}

function createMappedPartVoices(input: {
    readonly mapping: MidiPartMapping;
    readonly notes: readonly QuantizedMidiNote[];
    readonly splitReadableRegisters: boolean;
    readonly usedVoiceIds: Set<string>;
}): BaudVoice[] {
    const notes = applyMappedPitchPolicy(input.notes, input.mapping);
    if (notes.length === 0) {
        return [];
    }

    if (input.splitReadableRegisters) {
        const layers = assignLayers(groupQuantizedNotesByTick(notes));
        return LAYER_ORDER.flatMap((layerId) => {
            const events = layers[layerId];
            if (events.length === 0) {
                return [];
            }

            const id = uniqueVoiceId(
                `${input.mapping.voiceId}_${layerId}`,
                input.usedVoiceIds,
            );
            input.usedVoiceIds.add(id);
            return [
                {
                    events,
                    id,
                    octave: defaultOctaveForEvents(events),
                    soundId: input.mapping.soundId,
                    volume: volumeForEvents(input.mapping.volume, events),
                },
            ];
        });
    }

    const id = uniqueVoiceId(input.mapping.voiceId, input.usedVoiceIds);
    input.usedVoiceIds.add(id);
    const events = createLayerEvents(notes);
    return [
        {
            events,
            id,
            octave: defaultOctaveForNotes(notes),
            soundId: input.mapping.soundId,
            volume: volumeForEvents(input.mapping.volume, events),
        },
    ];
}

function applyMappedPitchPolicy(
    notes: readonly QuantizedMidiNote[],
    mapping: MidiPartMapping,
): readonly QuantizedMidiNote[] {
    if (mapping.octave === undefined) {
        return notes;
    }

    return notes.map((note) => ({
        ...note,
        pitch: pitchForMapping(note, mapping),
    }));
}

function pitchForMapping(
    note: QuantizedMidiNote,
    mapping: MidiPartMapping,
): number {
    return mapping.octave === undefined
        ? note.pitch
        : pitchInOctave(note.pitch, mapping.octave);
}

function pitchInOctave(pitch: number, octave: number): number {
    return (octave + 1) * 12 + (((pitch % 12) + 12) % 12);
}

function prepareMappedNotes(
    notes: readonly QuantizedMidiNote[],
    minimumTickGap: number | undefined,
): QuantizedMidiNote[] {
    const deduped = dedupeQuantizedMidiNotes(notes);
    if (minimumTickGap === undefined || minimumTickGap <= 1) {
        return deduped;
    }

    const thinned: QuantizedMidiNote[] = [];
    let lastTick = Number.NEGATIVE_INFINITY;
    for (const note of deduped) {
        if (note.tick - lastTick < minimumTickGap) {
            continue;
        }
        thinned.push(note);
        lastTick = note.tick;
    }

    return thinned;
}

function dedupeQuantizedMidiNotes(
    notes: readonly QuantizedMidiNote[],
): QuantizedMidiNote[] {
    const deduped = new Map<string, QuantizedMidiNote>();
    for (const note of notes) {
        const key = `${note.tick}:${note.pitch}`;
        const existing = deduped.get(key);
        if (
            !existing ||
            note.duration > existing.duration ||
            (note.duration === existing.duration &&
                note.effectiveVelocity > existing.effectiveVelocity)
        ) {
            deduped.set(key, note);
        }
    }

    return [...deduped.values()].sort(
        (left, right) => left.tick - right.tick || left.pitch - right.pitch,
    );
}

function hasPolyphonicTick(notes: readonly QuantizedMidiNote[]): boolean {
    const ticks = new Set<number>();
    for (const note of notes) {
        if (ticks.has(note.tick)) {
            return true;
        }
        ticks.add(note.tick);
    }

    return false;
}

function groupQuantizedNotesByTick(
    notes: readonly QuantizedMidiNote[],
): Map<number, QuantizedNote[]> {
    const groups = new Map<number, QuantizedNote[]>();
    for (const note of dedupeQuantizedMidiNotes(notes)) {
        const group = groups.get(note.tick) ?? [];
        group.push({
            duration: note.duration,
            effectiveVelocity: note.effectiveVelocity,
            pitch: note.pitch,
        });
        groups.set(note.tick, group);
    }

    return groups;
}

function mapGeneralMidiProgram(
    program: number,
): Pick<MidiPartMapping, "soundId" | "volume"> | undefined {
    if (program >= 0 && program <= 5) {
        return { soundId: "note.harp", volume: 65 };
    }
    if (program === 6) {
        return { soundId: "note.harp", volume: 58 };
    }
    if (program === 7) {
        return { soundId: "note.guitar", volume: 55 };
    }
    if (program >= 8 && program <= 10) {
        return { soundId: "note.bell", volume: 58 };
    }
    if (program === 11) {
        return { soundId: "note.chime", volume: 58 };
    }
    if (program === 12 || program === 13) {
        return { soundId: "note.xylophone", volume: 58 };
    }
    if (program === 14) {
        return { soundId: "note.bell", volume: 60 };
    }
    if (program === 15) {
        return { soundId: "note.guitar", volume: 55 };
    }
    if (program >= 16 && program <= 20) {
        return { soundId: "note.harp", volume: 58 };
    }
    if (program >= 21 && program <= 23) {
        return { soundId: "note.flute", volume: 68 };
    }
    if (program === 46) {
        return { soundId: "note.harp", volume: 70 };
    }
    if (program >= 24 && program <= 31) {
        return { soundId: "note.guitar", volume: 58 };
    }
    if (program >= 32 && program <= 39) {
        return { soundId: "note.bass", volume: 70 };
    }
    if (program >= 40 && program <= 46) {
        return { soundId: "note.harp", volume: 58 };
    }
    if (program === 47) {
        return { soundId: "note.bass", volume: 72 };
    }
    if (program >= 48 && program <= 51) {
        return { soundId: "note.harp", volume: 58 };
    }
    if (program >= 56 && program <= 63) {
        return { soundId: "note.harp", volume: 62 };
    }
    if (program >= 64 && program <= 71) {
        return { soundId: "note.flute", volume: 72 };
    }
    if (program >= 72 && program <= 75) {
        return { soundId: "note.flute", volume: 80 };
    }
    if (program >= 80 && program <= 87) {
        return { soundId: "note.harp", volume: 60 };
    }

    return undefined;
}

function mapGeneralMidiPercussion(
    pitch: number | undefined,
): Omit<MidiPartMapping, "role"> | undefined {
    if (pitch === undefined) {
        return undefined;
    }
    if (pitch === 35 || pitch === 36) {
        return { soundId: "note.bd", voiceId: "kick", volume: 68 };
    }
    if (pitch === 38 || pitch === 39 || pitch === 40) {
        return {
            octave: 4,
            soundId: "note.snare",
            voiceId: "snare",
            volume: 68,
        };
    }
    if (pitch === 42 || pitch === 44 || pitch === 46 || pitch === 49) {
        return {
            minimumTickGap: 2,
            soundId: "note.hat",
            voiceId: "hat",
            volume: 28,
        };
    }
    if (
        pitch === 41 ||
        pitch === 43 ||
        pitch === 45 ||
        pitch === 47 ||
        pitch === 48 ||
        pitch === 50
    ) {
        return { soundId: "note.bd", voiceId: "tom", volume: 42 };
    }
    if (pitch === 56) {
        return { soundId: "note.cow_bell", voiceId: "cow_bell", volume: 55 };
    }
    if (
        pitch === 60 ||
        pitch === 61 ||
        pitch === 62 ||
        pitch === 63 ||
        pitch === 64 ||
        pitch === 65 ||
        pitch === 66
    ) {
        return {
            minimumTickGap: 2,
            octave: 4,
            soundId: "note.snare",
            voiceId: "hand_drum",
            volume: 36,
        };
    }
    if (pitch === 67 || pitch === 68) {
        return {
            minimumTickGap: 2,
            soundId: "note.cow_bell",
            voiceId: "agogo",
            volume: 34,
        };
    }
    if (pitch === 75 || pitch === 76 || pitch === 77) {
        return {
            minimumTickGap: 2,
            soundId: "note.iron_xylophone",
            voiceId: "wood_block",
            volume: 32,
        };
    }

    return undefined;
}

function createLayerEvents(notes: readonly QuantizedMidiNote[]): LayerEvent[] {
    const groups = new Map<number, QuantizedMidiNote[]>();
    for (const note of dedupeQuantizedMidiNotes(notes)) {
        const group = groups.get(note.tick) ?? [];
        group.push(note);
        groups.set(note.tick, group);
    }

    return [...groups.entries()]
        .sort((left, right) => left[0] - right[0])
        .map(([tick, group]) => ({
            duration: Math.max(...group.map((note) => note.duration)),
            effectiveVelocities: group.map((note) => note.effectiveVelocity),
            pitches: group
                .map((note) => note.pitch)
                .sort((left, right) => left - right),
            tick,
        }));
}

function defaultOctaveForEvents(events: readonly LayerEvent[]): number {
    return defaultOctaveForPitches(
        events.flatMap((event) => [...event.pitches]),
    );
}

function defaultOctaveForNotes(notes: readonly QuantizedNote[]): number {
    return defaultOctaveForPitches(notes.map((note) => note.pitch));
}

function volumeForEvents(
    baseVolume: number,
    events: readonly LayerEvent[],
): number {
    const velocities = events.flatMap((event) => [
        ...event.effectiveVelocities,
    ]);
    if (velocities.length === 0) {
        return baseVolume;
    }

    return clampVolume(
        Math.round((baseVolume * medianNumber(velocities)) / 100),
    );
}

function medianNumber(values: readonly number[]): number {
    const sorted = [...values].sort((left, right) => left - right);
    const middle = Math.floor(sorted.length / 2);
    if (sorted.length % 2 === 1) {
        return sorted[middle];
    }

    return (sorted[middle - 1] + sorted[middle]) / 2;
}

function clampVolume(input: number): number {
    return Math.max(0, Math.min(100, input));
}

function defaultOctaveForPitches(pitches: readonly number[]): number {
    const average =
        pitches.reduce((total, pitch) => total + pitch, 0) /
        Math.max(1, pitches.length);
    return Math.max(1, Math.min(6, Math.round(average / 12) - 1));
}

function uniqueVoiceId(
    base: string,
    usedVoiceIds: ReadonlySet<string>,
): string {
    if (!usedVoiceIds.has(base)) {
        return base;
    }

    let suffix = 2;
    while (usedVoiceIds.has(`${base}_${suffix}`)) {
        suffix += 1;
    }

    return `${base}_${suffix}`;
}

function slugifyVoiceId(input: string): string {
    const slug = input
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/gu, "_")
        .replace(/^_+|_+$/gu, "");
    return slug.length === 0 ? "part" : slug;
}

function midiProgramName(program: number): string {
    return GENERAL_MIDI_PROGRAM_NAMES[program] ?? `Program ${program + 1}`;
}

function midiProgramRole(program: number): MidiPartRole {
    if (program >= 32 && program <= 39) {
        return "bass";
    }
    if ((program >= 56 && program <= 87) || (program >= 64 && program <= 75)) {
        return "lead";
    }
    if (
        (program >= 0 && program <= 7) ||
        (program >= 16 && program <= 31) ||
        (program >= 40 && program <= 51)
    ) {
        return "harmony";
    }

    return "texture";
}

function midiProgramVoiceId(program: number): string {
    if (program >= 0 && program <= 5) {
        return "piano";
    }
    if (program === 6 || program === 46) {
        return "harp";
    }
    if (program === 7 || (program >= 24 && program <= 31)) {
        return "guitar";
    }
    if (program >= 8 && program <= 11) {
        return "bell";
    }
    if (program >= 12 && program <= 15) {
        return "marimba";
    }
    if (program >= 16 && program <= 23) {
        return "organ";
    }
    if (program >= 32 && program <= 39) {
        return "bass";
    }
    if (program >= 40 && program <= 45) {
        return "strings";
    }
    if (program === 47) {
        return "timpani";
    }
    if (program >= 48 && program <= 51) {
        return "strings";
    }
    if (program >= 52 && program <= 55) {
        return "choir";
    }
    if (program >= 56 && program <= 63) {
        return "brass";
    }
    if (program >= 64 && program <= 79) {
        return "flute";
    }
    if (program >= 80 && program <= 87) {
        return "lead";
    }

    return slugifyVoiceId(midiProgramName(program));
}

function parseStandardMidi(data: Uint8Array): ParsedMidi {
    if (!hasAsciiPrefix(data, "MThd")) {
        throw new Error("MIDI data must start with an MThd header.");
    }

    const reader = new MidiReader(data);
    reader.skip(4);

    const headerLength = reader.readUint32();
    if (headerLength < MIDI_HEADER_LENGTH) {
        throw new Error(
            "MIDI header is shorter than the Standard MIDI header.",
        );
    }

    reader.readUint16();
    const trackCount = reader.readUint16();
    const division = reader.readUint16();
    reader.skip(headerLength - MIDI_HEADER_LENGTH);
    if ((division & 0x8000) !== 0) {
        throw new Error("SMPTE-time MIDI files are not supported.");
    }

    const notes: MidiNote[] = [];
    const tempos: MidiTempo[] = [];
    const timeSignatures: MidiTimeSignature[] = [];
    const features: MidiFeatureCounts = {
        pan: 0,
        pitchBend: 0,
        trackName: 0,
    };
    let eventOrder = 0;
    for (let trackIndex = 0; trackIndex < trackCount; trackIndex += 1) {
        const trackId = reader.readAscii(4);
        if (trackId !== "MTrk") {
            throw new Error(
                `MIDI track ${trackIndex} is missing an MTrk header.`,
            );
        }

        const trackLength = reader.readUint32();
        const trackEnd = reader.position + trackLength;
        const openNotes = new Map<string, OpenMidiNote[]>();
        const sustainedNotes = new Map<string, OpenMidiNote[]>();
        const currentChannelVolumes = new Map<number, number>();
        const currentExpressions = new Map<number, number>();
        const currentPrograms = new Map<number, number>();
        const sustainingChannels = new Set<number>();
        let absoluteTick = 0;
        let runningStatus: number | undefined;

        while (reader.position < trackEnd) {
            absoluteTick += reader.readVariableLengthQuantity();
            let status = reader.readUint8();
            if (status < 0x80) {
                if (runningStatus === undefined) {
                    throw new Error(
                        "MIDI running status appeared before a status byte.",
                    );
                }
                reader.unread();
                status = runningStatus;
            } else if (status < 0xf0) {
                runningStatus = status;
            }
            eventOrder += 1;

            if (status === 0xff) {
                const metaType = reader.readUint8();
                const length = reader.readVariableLengthQuantity();
                const payload = reader.readBytes(length);
                if (metaType === 0x2f) {
                    break;
                }
                if (metaType === 0x51 && payload.length === 3) {
                    tempos.push({
                        tick: absoluteTick,
                        order: eventOrder,
                        microsecondsPerQuarter:
                            (payload[0] << 16) | (payload[1] << 8) | payload[2],
                    });
                    continue;
                }
                if (metaType === 0x03 && payload.length > 0) {
                    features.trackName += 1;
                    continue;
                }
                if (metaType === 0x58 && payload.length >= 2) {
                    timeSignatures.push({
                        tick: absoluteTick,
                        numerator: payload[0],
                        denominator: 2 ** payload[1],
                    });
                }
                continue;
            }

            if (status === 0xf0 || status === 0xf7) {
                reader.skip(reader.readVariableLengthQuantity());
                continue;
            }

            const eventType = status & 0xf0;
            const channel = status & 0x0f;
            if (eventType === 0xc0) {
                currentPrograms.set(channel, reader.readUint8());
                continue;
            }

            if (eventType === 0xd0) {
                reader.skip(1);
                continue;
            }

            if (
                eventType === 0x80 ||
                eventType === 0x90 ||
                eventType === 0xa0 ||
                eventType === 0xb0 ||
                eventType === 0xe0
            ) {
                const first = reader.readUint8();
                const second = reader.readUint8();
                if (eventType === 0xb0) {
                    if (first === 7) {
                        currentChannelVolumes.set(channel, second);
                    } else if (first === 10) {
                        features.pan += 1;
                    } else if (first === 11) {
                        currentExpressions.set(channel, second);
                    } else if (first === 64) {
                        if (second >= MIDI_SUSTAIN_THRESHOLD) {
                            sustainingChannels.add(channel);
                        } else {
                            sustainingChannels.delete(channel);
                            closeSustainedNotes(
                                notes,
                                sustainedNotes,
                                channel,
                                absoluteTick,
                            );
                        }
                    }
                    continue;
                }
                if (eventType === 0xe0) {
                    features.pitchBend += 1;
                    continue;
                }
                if (eventType === 0x90 && second > 0) {
                    pushOpenNote(openNotes, channel, first, {
                        effectiveVelocity: effectiveMidiVelocity(
                            second,
                            currentChannelVolumes.get(channel) ??
                                DEFAULT_MIDI_CHANNEL_VOLUME,
                            currentExpressions.get(channel) ??
                                DEFAULT_MIDI_EXPRESSION,
                        ),
                        program: currentPrograms.get(channel),
                        tick: absoluteTick,
                        velocity: second,
                    });
                    continue;
                }
                if (eventType === 0x80 || eventType === 0x90) {
                    const opened = shiftOpenNote(openNotes, channel, first);
                    if (opened) {
                        if (sustainingChannels.has(channel)) {
                            pushOpenNote(
                                sustainedNotes,
                                channel,
                                first,
                                opened,
                            );
                        } else {
                            closeMidiNote(
                                notes,
                                channel,
                                first,
                                opened,
                                absoluteTick,
                            );
                        }
                    }
                }
                continue;
            }

            throw new Error(
                `Unsupported MIDI status 0x${status.toString(16)}.`,
            );
        }

        closeSustainedNotes(notes, sustainedNotes, undefined, absoluteTick);
        reader.position = trackEnd;
    }

    return {
        features,
        notes,
        ppq: division,
        tempos,
        timeSignatures,
    };
}

function hasAsciiPrefix(data: Uint8Array, value: string): boolean {
    if (data.length < value.length) {
        return false;
    }

    for (let index = 0; index < value.length; index += 1) {
        if (data[index] !== value.charCodeAt(index)) {
            return false;
        }
    }

    return true;
}

function normalizeTempos(
    tempos: readonly MidiTempo[],
): readonly NormalizedTempo[] {
    const sorted = [...tempos].sort(
        (left, right) => left.tick - right.tick || left.order - right.order,
    );
    const normalized: NormalizedTempo[] = [];
    for (const tempo of sorted) {
        if (normalized.at(-1)?.tick === tempo.tick) {
            normalized[normalized.length - 1] = {
                tick: tempo.tick,
                microsecondsPerQuarter: tempo.microsecondsPerQuarter,
            };
            continue;
        }
        normalized.push({
            tick: tempo.tick,
            microsecondsPerQuarter: tempo.microsecondsPerQuarter,
        });
    }

    if (normalized.length === 0 || normalized[0].tick !== 0) {
        normalized.unshift({
            tick: 0,
            microsecondsPerQuarter: DEFAULT_TEMPO_MICROSECONDS,
        });
    }

    return normalized;
}

function quantizeMidiNotes(
    notes: readonly MidiNote[],
    ppq: number,
    tempos: readonly NormalizedTempo[],
    firstSecond: number,
): Map<number, QuantizedNote[]> {
    const groups = new Map<number, QuantizedNote[]>();
    for (const note of quantizeMidiNoteList(notes, ppq, tempos, firstSecond)) {
        const group = groups.get(note.tick) ?? [];
        group.push({
            duration: note.duration,
            effectiveVelocity: note.effectiveVelocity,
            pitch: note.pitch,
        });
        groups.set(note.tick, group);
    }

    return groups;
}

function quantizeMidiNoteList(
    notes: readonly MidiNote[],
    ppq: number,
    tempos: readonly NormalizedTempo[],
    firstSecond: number,
): QuantizedMidiNote[] {
    const tickToSeconds = createTickToSeconds(ppq, tempos);
    return notes.map((note) => {
        const start = Math.round(
            (tickToSeconds(note.startTick) - firstSecond) *
                MIDI_TICKS_PER_SECOND,
        );
        const end = Math.max(
            start + 1,
            Math.round(
                (tickToSeconds(note.endTick) - firstSecond) *
                    MIDI_TICKS_PER_SECOND,
            ),
        );
        return {
            channel: note.channel,
            duration: Math.max(1, end - start),
            effectiveVelocity: note.effectiveVelocity,
            pitch: note.pitch,
            ...(note.program === undefined ? {} : { program: note.program }),
            tick: start,
        };
    });
}

function createTickToSeconds(
    ppq: number,
    tempos: readonly NormalizedTempo[],
): (tick: number) => number {
    return (tick) => {
        let total = 0;
        let lastTick = tempos[0].tick;
        let lastTempo = tempos[0].microsecondsPerQuarter;
        if (tick < lastTick) {
            return (tick * DEFAULT_TEMPO_MICROSECONDS) / 1_000_000 / ppq;
        }

        for (const tempo of tempos.slice(1)) {
            if (tempo.tick >= tick) {
                break;
            }
            total += ((tempo.tick - lastTick) * lastTempo) / 1_000_000 / ppq;
            lastTick = tempo.tick;
            lastTempo = tempo.microsecondsPerQuarter;
        }

        return total + ((tick - lastTick) * lastTempo) / 1_000_000 / ppq;
    };
}

function assignLayers(
    groups: ReadonlyMap<number, readonly QuantizedNote[]>,
): LayerMap {
    const layers: LayerMap = {
        right: [],
        inner: [],
        left: [],
    };
    for (const [tick, group] of [...groups.entries()].sort(
        (left, right) => left[0] - right[0],
    )) {
        const notes = dedupeQuantizedNotes(group).sort(
            (left, right) => left.pitch - right.pitch,
        );
        if (notes.length === 1) {
            const note = notes[0];
            const target = note.pitch >= 60 ? "right" : "left";
            layers[target].push({
                tick,
                duration: note.duration,
                effectiveVelocities: [note.effectiveVelocity],
                pitches: [note.pitch],
            });
            continue;
        }

        const left = notes[0];
        const right = notes[notes.length - 1];
        layers.left.push({
            tick,
            duration: left.duration,
            effectiveVelocities: [left.effectiveVelocity],
            pitches: [left.pitch],
        });
        layers.right.push({
            tick,
            duration: right.duration,
            effectiveVelocities: [right.effectiveVelocity],
            pitches: [right.pitch],
        });
        const inner = notes.slice(1, -1);
        if (inner.length > 0) {
            layers.inner.push({
                tick,
                duration: Math.max(...inner.map((note) => note.duration)),
                effectiveVelocities: inner.map(
                    (note) => note.effectiveVelocity,
                ),
                pitches: inner.map((note) => note.pitch),
            });
        }
    }

    return layers;
}

function dedupeQuantizedNotes(
    notes: readonly QuantizedNote[],
): QuantizedNote[] {
    const deduped = new Map<number, QuantizedNote>();
    for (const note of notes) {
        const existing = deduped.get(note.pitch);
        if (
            !existing ||
            note.duration > existing.duration ||
            (note.duration === existing.duration &&
                note.effectiveVelocity > existing.effectiveVelocity)
        ) {
            deduped.set(note.pitch, note);
        }
    }

    return [...deduped.values()];
}

function renderBaud(input: {
    readonly barTicks: number;
    readonly cueId: string;
    readonly durationLabels: ReadonlyMap<number, string>;
    readonly lineLength: number;
    readonly tempo: number;
    readonly voices: readonly BaudVoice[];
}): string {
    const lines = [`cue ${input.cueId} t${input.tempo}`, ""];
    for (const voice of input.voices) {
        lines.push(
            `@${voice.id} ${voice.soundId} o${voice.octave} l8 v${voice.volume}`,
        );
        lines.push(
            ...wrapTokens(
                renderLayer(
                    voice.events,
                    voice.octave,
                    input.barTicks,
                    input.durationLabels,
                ),
                input.lineLength,
            ),
        );
        lines.push("");
    }

    return `${lines.join("\n").trimEnd()}\n`;
}

function renderLayer(
    events: readonly LayerEvent[],
    startOctave: number,
    barTicks: number,
    durationLabels: ReadonlyMap<number, string>,
): string[] {
    const tokens: string[] = [];
    let currentTick = 0;
    let currentOctave = startOctave;
    for (let index = 0; index < events.length; index += 1) {
        const event = events[index];
        if (event.tick > currentTick) {
            currentTick = addAdvance({
                amount: event.tick - currentTick,
                barTicks,
                currentTick,
                durationLabels,
                tokens,
            });
        }

        const nextTick = events[index + 1]?.tick ?? event.tick + event.duration;
        const advance = Math.max(1, nextTick - currentTick);
        currentTick = addAdvance({
            amount: advance,
            barTicks,
            currentTick,
            durationLabels,
            tokens,
            tokenBuilder: (duration) => {
                const rendered = renderPitches(event.pitches, currentOctave);
                currentOctave = rendered.octave;
                return `${rendered.token}${duration}`;
            },
        });
    }

    return tokens;
}

function addAdvance(input: {
    readonly amount: number;
    readonly barTicks: number;
    readonly currentTick: number;
    readonly durationLabels: ReadonlyMap<number, string>;
    readonly tokenBuilder?: (duration: string) => string;
    readonly tokens: string[];
}): number {
    let currentTick = input.currentTick;
    let remaining = input.amount;
    let isFirstToken = true;
    while (remaining > 0) {
        const chunk = chooseDurationChunk(
            remaining,
            currentTick,
            input.barTicks,
            input.durationLabels,
        );
        const duration = input.durationLabels.get(chunk);
        if (duration === undefined) {
            throw new Error(`No BAUD duration can represent ${chunk} ticks.`);
        }

        if (isFirstToken && input.tokenBuilder) {
            input.tokens.push(input.tokenBuilder(duration));
        } else {
            input.tokens.push(`r${duration}`);
        }

        currentTick += chunk;
        remaining -= chunk;
        isFirstToken = false;
        if (currentTick % input.barTicks === 0) {
            input.tokens.push("|");
        }
    }

    return currentTick;
}

function chooseDurationChunk(
    remaining: number,
    currentTick: number,
    barTicks: number,
    durationLabels: ReadonlyMap<number, string>,
): number {
    const boundaryRemaining = barTicks - (currentTick % barTicks || barTicks);
    const limit = Math.min(remaining, boundaryRemaining || barTicks);
    const chunks = [...durationLabels.keys()].sort(
        (left, right) => right - left,
    );
    for (const chunk of chunks) {
        if (chunk <= limit) {
            return chunk;
        }
    }

    return 1;
}

function renderPitches(
    pitches: readonly number[],
    octave: number,
): { readonly octave: number; readonly token: string } {
    let currentOctave = octave;
    const pitchTokens = [...pitches]
        .sort((left, right) => left - right)
        .map((pitch) => {
            const rendered = renderPitch(pitch, currentOctave);
            currentOctave = rendered.octave;
            return rendered.token;
        });

    return {
        octave: currentOctave,
        token:
            pitchTokens.length === 1
                ? pitchTokens[0]
                : `[${pitchTokens.join(" ")}]`,
    };
}

function renderPitch(
    pitch: number,
    currentOctave: number,
): { readonly octave: number; readonly token: string } {
    const octave = Math.floor(pitch / 12) - 1;
    const note = NOTE_NAMES[((pitch % 12) + 12) % 12];
    const prefix =
        octave > currentOctave
            ? ">".repeat(octave - currentOctave)
            : "<".repeat(currentOctave - octave);
    return {
        octave,
        token: `${prefix}${note}`,
    };
}

function wrapTokens(tokens: readonly string[], lineLength: number): string[] {
    const lines: string[] = [];
    let current: string[] = [];
    let currentLength = 0;
    for (const token of tokens) {
        if (token === "|") {
            current.push(token);
            lines.push(current.join(" "));
            current = [];
            currentLength = 0;
            continue;
        }

        const tokenLength = token.length + (current.length > 0 ? 1 : 0);
        if (current.length > 0 && currentLength + tokenLength > lineLength) {
            lines.push(current.join(" "));
            current = [];
            currentLength = 0;
        }
        current.push(token);
        currentLength += tokenLength;
    }
    if (current.length > 0) {
        lines.push(current.join(" "));
    }

    return lines;
}

function createDurationLabels(tempo: number): ReadonlyMap<number, string> {
    const labels = new Map<
        number,
        { readonly label: string; readonly rank: string }
    >();
    const preferred = new Set([
        1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36,
        48, 64, 96, 128, 192, 256,
    ]);
    for (let denominator = 1; denominator <= 512; denominator += 1) {
        for (const dotted of [false, true]) {
            const ticks = audioDurationTicks(tempo, denominator, dotted);
            const label = `${denominator}${dotted ? "." : ""}`;
            const rank = [
                preferred.has(denominator) ? "0" : "1",
                label.length.toString().padStart(3, "0"),
                denominator.toString().padStart(3, "0"),
                dotted ? "1" : "0",
            ].join(":");
            const existing = labels.get(ticks);
            if (!existing || rank < existing.rank) {
                labels.set(ticks, { label, rank });
            }
        }
    }

    return new Map(
        [...labels.entries()].map(([ticks, value]) => [ticks, value.label]),
    );
}

function audioDurationTicks(
    tempo: number,
    denominator: number,
    dotted: boolean,
): number {
    return Math.max(
        1,
        Math.round(
            ((MIDI_TICKS_PER_SECOND * 60 * 4) / (tempo * denominator)) *
                (dotted ? 1.5 : 1),
        ),
    );
}

function normalizeLayerSoundIds(
    input: MidiToBaudOptions["soundId"],
): Record<MidiToBaudLayerId, string> {
    if (typeof input === "string") {
        return {
            right: input,
            inner: input,
            left: input,
        };
    }

    return {
        right: input?.right ?? DEFAULT_SOUND_ID,
        inner: input?.inner ?? DEFAULT_SOUND_ID,
        left: input?.left ?? DEFAULT_SOUND_ID,
    };
}

function normalizeLayerVolumes(
    input: MidiToBaudOptions["volumes"],
): Record<MidiToBaudLayerId, number> {
    return {
        right: normalizeVolume(input?.right ?? DEFAULT_LAYER_VOLUMES.right),
        inner: normalizeVolume(input?.inner ?? DEFAULT_LAYER_VOLUMES.inner),
        left: normalizeVolume(input?.left ?? DEFAULT_LAYER_VOLUMES.left),
    };
}

function normalizeMidiPlaybackPolicy(
    options: MidiToBaudOptions,
    tempo: number,
): NormalizedMidiToBaudPolicy {
    const profile = normalizeMidiToBaudProfile(options.profile);
    const defaults =
        profile === "compact"
            ? COMPACT_MIDI_POLICY
            : profile === "minecraft"
              ? MINECRAFT_MIDI_POLICY
              : RAW_MIDI_POLICY;
    const policy = options.policy ?? {};
    const lowBassMinimumPitch = normalizeOptionalInteger(
        policy.lowBassMinimumPitch,
        "policy.lowBassMinimumPitch",
    );
    const lowBassMinimumTickGap = normalizeOptionalPositiveNumber(
        policy.lowBassMinimumTickGap,
        "policy.lowBassMinimumTickGap",
    );
    const maxSimultaneousNotes = normalizeOptionalPositiveNumber(
        policy.maxSimultaneousNotes,
        "policy.maxSimultaneousNotes",
    );
    const maxWeightedPressure = normalizeOptionalPositiveNumber(
        policy.maxWeightedPressure,
        "policy.maxWeightedPressure",
    );
    const normalized = {
        lowBassMinimumPitch:
            lowBassMinimumPitch ?? defaults.lowBassMinimumPitch,
        lowBassMinimumTickGap:
            lowBassMinimumTickGap ?? defaults.lowBassMinimumTickGap,
        maxSimultaneousNotes:
            maxSimultaneousNotes ?? defaults.maxSimultaneousNotes,
        maxWeightedPressure:
            maxWeightedPressure ?? defaults.maxWeightedPressure,
    };

    return {
        ...normalized,
        enabled:
            normalized.lowBassMinimumTickGap > 1 ||
            normalized.maxSimultaneousNotes < Number.POSITIVE_INFINITY ||
            normalized.maxWeightedPressure < Number.POSITIVE_INFINITY,
        profile,
        ticksPerBeat: Math.max(1, Math.round(1200 / tempo)),
    };
}

function normalizeMidiToBaudProfile(
    input: MidiToBaudOptions["profile"],
): MidiToBaudProfile {
    if (input === undefined) {
        return "minecraft";
    }
    if (input === "compact" || input === "minecraft" || input === "raw") {
        return input;
    }

    throw new Error(
        'MIDI to BAUD profile must be "minecraft", "compact", or "raw".',
    );
}

function normalizeVolume(input: number): number {
    if (!Number.isInteger(input) || input < 0 || input > 100) {
        throw new Error(
            "MIDI to BAUD volume values must be integers between 0 and 100.",
        );
    }

    return input;
}

function normalizeOptionalInteger(
    input: number | undefined,
    label: string,
): number | undefined {
    if (input === undefined) {
        return undefined;
    }
    if (!Number.isInteger(input)) {
        throw new Error(`MIDI to BAUD ${label} must be an integer.`);
    }

    return input;
}

function normalizeOptionalPositiveNumber(
    input: number | undefined,
    label: string,
): number | undefined {
    if (input === undefined) {
        return undefined;
    }
    if (!Number.isFinite(input) || input <= 0) {
        throw new Error(`MIDI to BAUD ${label} must be a positive number.`);
    }

    return input;
}

function normalizePositiveInteger(input: number, label: string): number {
    if (!Number.isInteger(input) || input <= 0) {
        throw new Error(`MIDI to BAUD ${label} must be a positive integer.`);
    }

    return input;
}

function tempoToBpm(microsecondsPerQuarter: number): number {
    return Math.max(1, Math.round(60_000_000 / microsecondsPerQuarter));
}

function effectiveMidiVelocity(
    velocity: number,
    channelVolume: number,
    expression: number,
): number {
    return (
        velocity *
        (channelVolume / DEFAULT_MIDI_CHANNEL_VOLUME) *
        (expression / DEFAULT_MIDI_EXPRESSION)
    );
}

function closeMidiNote(
    notes: MidiNote[],
    channel: number,
    pitch: number,
    opened: OpenMidiNote,
    endTick: number,
): void {
    notes.push({
        channel,
        effectiveVelocity: opened.effectiveVelocity,
        endTick,
        pitch,
        ...(opened.program === undefined ? {} : { program: opened.program }),
        startTick: opened.tick,
        velocity: opened.velocity,
    });
}

function closeSustainedNotes(
    notes: MidiNote[],
    sustainedNotes: Map<string, OpenMidiNote[]>,
    channel: number | undefined,
    endTick: number,
): void {
    for (const [key, stack] of [...sustainedNotes.entries()]) {
        const [noteChannel, pitch] = key.split(":").map(Number);
        if (channel !== undefined && noteChannel !== channel) {
            continue;
        }
        for (const opened of stack) {
            closeMidiNote(notes, noteChannel, pitch, opened, endTick);
        }
        sustainedNotes.delete(key);
    }
}

function pushOpenNote(
    notes: Map<string, OpenMidiNote[]>,
    channel: number,
    pitch: number,
    note: OpenMidiNote,
): void {
    const key = `${channel}:${pitch}`;
    const stack = notes.get(key) ?? [];
    stack.push(note);
    notes.set(key, stack);
}

function shiftOpenNote(
    notes: Map<string, OpenMidiNote[]>,
    channel: number,
    pitch: number,
): OpenMidiNote | undefined {
    const key = `${channel}:${pitch}`;
    const stack = notes.get(key);
    return stack?.shift();
}

class MidiReader {
    position = 0;

    constructor(private readonly data: Uint8Array) {}

    readAscii(length: number): string {
        return String.fromCharCode(...this.readBytes(length));
    }

    readBytes(length: number): Uint8Array {
        this.#require(length);
        const value = this.data.slice(this.position, this.position + length);
        this.position += length;
        return value;
    }

    readUint8(): number {
        this.#require(1);
        return this.data[this.position++];
    }

    readUint16(): number {
        return (this.readUint8() << 8) | this.readUint8();
    }

    readUint32(): number {
        return (
            ((this.readUint8() << 24) |
                (this.readUint8() << 16) |
                (this.readUint8() << 8) |
                this.readUint8()) >>>
            0
        );
    }

    readVariableLengthQuantity(): number {
        let value = 0;
        for (let index = 0; index < 4; index += 1) {
            const byte = this.readUint8();
            value = (value << 7) | (byte & 0x7f);
            if ((byte & 0x80) === 0) {
                return value;
            }
        }

        throw new Error("Invalid MIDI variable-length quantity.");
    }

    skip(length: number): void {
        this.#require(length);
        this.position += length;
    }

    unread(): void {
        this.position = Math.max(0, this.position - 1);
    }

    #require(length: number): void {
        if (this.position + length > this.data.length) {
            throw new Error("Unexpected end of MIDI data.");
        }
    }
}
