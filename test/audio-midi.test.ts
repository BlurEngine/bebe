import { describe, expect, it } from "vitest";
import {
    compileAudioText,
    convertMidiToBaud,
    convertMidiToBaudWithDiagnostics,
} from "@blurengine/bebe/tooling/node";

describe("MIDI to BAUD conversion", () => {
    it("converts MIDI note starts and pitches into deterministic BAUD", () => {
        const midi = createMidiFile([
            createTrack([
                tempo(0, 500_000),
                noteOn(0, 60),
                noteOn(0, 64),
                noteOn(0, 48),
                noteOff(480, 60),
                noteOff(0, 64),
                noteOff(0, 48),
                noteOn(0, 62),
                noteOff(480, 62),
            ]),
        ]);

        const baud = convertMidiToBaud(midi, {
            cueId: "unit.test",
            tempo: 120,
        });

        expect(baud).toContain("cue unit.test t120");
        expect(baud).toContain("@right note.harp");
        expect(baud).toContain("@inner note.harp");
        expect(baud).toContain("@left note.harp");
        expect(
            convertMidiToBaud(midi, { cueId: "unit.test", tempo: 120 }),
        ).toBe(baud);
        expect(compiledNoteStarts(baud, "unit.test")).toEqual([
            [0, 48],
            [0, 60],
            [0, 64],
            [10, 62],
        ]);
    });

    it("uses the MIDI tempo map when quantizing to Bedrock ticks", () => {
        const midi = createMidiFile([
            createTrack([
                tempo(0, 500_000),
                noteOn(0, 60),
                noteOff(480, 60),
                tempo(0, 1_000_000),
                noteOn(480, 64),
                noteOff(480, 64),
            ]),
        ]);

        const baud = convertMidiToBaud(midi, {
            cueId: "tempo.map",
            tempo: 120,
        });

        expect(compiledNoteStarts(baud, "tempo.map")).toEqual([
            [0, 60],
            [30, 64],
        ]);
    });

    it("reads note data from multiple MIDI tracks", () => {
        const midi = createMidiFile([
            createTrack([tempo(0, 500_000)]),
            createTrack([noteOn(0, 60), noteOff(480, 60)]),
        ]);

        const baud = convertMidiToBaud(midi, {
            cueId: "multi.track",
            tempo: 120,
        });

        expect(compiledNoteStarts(baud, "multi.track")).toEqual([[0, 60]]);
    });

    it("derives generated voice volume from MIDI note velocity", () => {
        const midi = createMidiFile([
            createTrack([
                tempo(0, 500_000),
                noteOn(0, 60, 0, 50),
                noteOff(480, 60),
            ]),
        ]);

        const baud = convertMidiToBaud(midi, {
            cueId: "velocity.volume",
            tempo: 120,
        });

        expect(baud).toContain("@right note.harp o5 l8 v44");
        expect(compiledNotes(baud, "velocity.volume")).toContainEqual([
            0, 60, 44,
        ]);
    });

    it("scales generated voice volume with MIDI channel volume and expression", () => {
        const midi = createMidiFile([
            createTrack([
                tempo(0, 500_000),
                controlChange(0, 0, 7, 50),
                controlChange(0, 0, 11, 64),
                noteOn(0, 60, 0, 100),
                noteOff(480, 60),
            ]),
        ]);

        const baud = convertMidiToBaud(midi, {
            cueId: "channel.volume",
            tempo: 120,
        });

        expect(baud).toContain("@right note.harp o5 l8 v22");
        expect(compiledNotes(baud, "channel.volume")).toContainEqual([
            0, 60, 22,
        ]);
    });

    it("extends MIDI note durations while sustain is pressed", () => {
        const midi = createMidiFile([
            createTrack([
                tempo(0, 500_000),
                controlChange(0, 0, 64, 127),
                noteOn(0, 60),
                noteOff(240, 60),
                controlChange(240, 0, 64, 0),
            ]),
        ]);

        const baud = convertMidiToBaud(midi, {
            cueId: "sustain.duration",
            tempo: 120,
        });

        expect(baud).toContain("@right note.harp o5 l8 v88");
        expect(baud).toContain("c4");
    });

    it("reports MIDI features that are approximated or ignored by BAUD import", () => {
        const midi = createMidiFile([
            createTrack([
                trackName(0, "Lead"),
                tempo(0, 500_000),
                tempo(240, 600_000),
                timeSignature(0, 3, 4),
                timeSignature(0, 5, 4),
                controlChange(0, 0, 10, 32),
                pitchBend(0, 0, 0, 96),
                noteOn(0, 60, 0, 40),
                noteOff(240, 60),
                noteOn(0, 64, 0, 100),
                noteOff(240, 64),
            ]),
        ]);

        const conversion = convertMidiToBaudWithDiagnostics(midi, {
            cueId: "feature.diagnostics",
            tempo: 120,
        });

        expect(conversion.diagnostics).toEqual(
            expect.arrayContaining([
                {
                    kind: "approximatedFeature",
                    feature: "dynamics",
                    noteCount: 2,
                    reason: "voiceVolume",
                    voiceId: "right",
                },
                {
                    kind: "approximatedFeature",
                    count: 1,
                    feature: "tempoMap",
                    reason: "bakedTiming",
                },
                {
                    kind: "ignoredFeature",
                    count: 1,
                    feature: "pan",
                    reason: "spatialPlayback",
                },
                {
                    kind: "ignoredFeature",
                    count: 1,
                    feature: "pitchBend",
                    reason: "unsupportedSourceFeature",
                },
                {
                    kind: "ignoredFeature",
                    count: 1,
                    feature: "trackName",
                    reason: "metadataOnly",
                },
                {
                    kind: "ignoredFeature",
                    count: 1,
                    feature: "timeSignatureChange",
                    reason: "singleGrid",
                },
            ]),
        );
    });

    it("maps supported General MIDI parts and drops unsupported parts with diagnostics", () => {
        const midi = createMidiFile([
            createTrack([
                tempo(0, 500_000),
                programChange(0, 0, 73),
                noteOn(0, 72, 0),
                noteOff(480, 72, 0),
                programChange(0, 1, 33),
                noteOn(0, 36, 1),
                noteOff(480, 36, 1),
                programChange(0, 5, 52),
                noteOn(0, 64, 5),
                noteOff(480, 64, 5),
            ]),
        ]);

        const conversion = convertMidiToBaudWithDiagnostics(midi, {
            cueId: "gm.parts",
            tempo: 120,
        });

        expect(conversion.baud).toContain("@flute note.flute");
        expect(conversion.baud).toContain("@bass note.bass");
        expect(conversion.baud).not.toContain("choir");
        expect(compiledNoteStarts(conversion.baud, "gm.parts")).toEqual([
            [0, 72],
            [10, 36],
        ]);
        expect(conversion.diagnostics).toEqual([
            {
                kind: "mappedPart",
                midiChannel: 1,
                noteCount: 1,
                program: 74,
                programName: "Flute",
                soundId: "note.flute",
                voiceId: "flute",
            },
            {
                kind: "mappedPart",
                midiChannel: 2,
                noteCount: 1,
                program: 34,
                programName: "Electric Bass finger",
                soundId: "note.bass",
                voiceId: "bass",
            },
            {
                kind: "droppedPart",
                midiChannel: 6,
                noteCount: 1,
                program: 53,
                programName: "Choir Aahs",
                reason: "unsupportedProgram",
            },
        ]);
    });

    it("maps useful General MIDI families without a sound override", () => {
        const midi = createMidiFile([
            createTrack([
                tempo(0, 500_000),
                programChange(0, 0, 63),
                noteOn(0, 60, 0),
                noteOff(480, 60, 0),
                programChange(0, 1, 29),
                noteOn(0, 55, 1),
                noteOff(480, 55, 1),
                programChange(0, 2, 85),
                noteOn(0, 72, 2),
                noteOff(480, 72, 2),
                programChange(0, 3, 12),
                noteOn(0, 76, 3),
                noteOff(480, 76, 3),
                programChange(0, 4, 7),
                noteOn(0, 64, 4),
                noteOff(480, 64, 4),
                programChange(0, 5, 52),
                noteOn(0, 67, 5),
                noteOff(480, 67, 5),
            ]),
        ]);

        const conversion = convertMidiToBaudWithDiagnostics(midi, {
            cueId: "gm.useful",
            tempo: 120,
        });

        expect(conversion.baud).toContain("@brass note.harp");
        expect(conversion.baud).toContain("@guitar note.guitar");
        expect(conversion.baud).toContain("@lead note.harp");
        expect(conversion.baud).toContain("@marimba note.xylophone");
        expect(conversion.baud).toContain("@guitar_2 note.guitar");
        expect(conversion.baud).not.toContain("choir");
        expect(compiledNoteStarts(conversion.baud, "gm.useful")).toEqual([
            [0, 60],
            [10, 55],
            [20, 72],
            [30, 76],
            [40, 64],
        ]);
        expect(
            conversion.diagnostics.map((diagnostic) => diagnostic.kind),
        ).toEqual([
            "mappedPart",
            "mappedPart",
            "mappedPart",
            "mappedPart",
            "mappedPart",
            "droppedPart",
        ]);
    });

    it("thins rapid duplicate hi-hat hits deterministically", () => {
        const midi = createMidiFile([
            createTrack([
                tempo(0, 500_000),
                noteOn(0, 44, 9),
                noteOff(48, 44, 9),
                noteOn(0, 44, 9),
                noteOff(48, 44, 9),
                noteOn(0, 44, 9),
                noteOff(48, 44, 9),
                noteOn(0, 44, 9),
                noteOff(48, 44, 9),
                noteOn(0, 44, 9),
                noteOff(48, 44, 9),
            ]),
        ]);

        const conversion = convertMidiToBaudWithDiagnostics(midi, {
            cueId: "hat.thin",
            tempo: 120,
        });

        expect(conversion.baud).toContain("@hat note.hat");
        expect(compiledNoteStarts(conversion.baud, "hat.thin")).toEqual([
            [0, 44],
            [2, 44],
            [4, 44],
        ]);
    });

    it("maps General MIDI snare percussion into a curated snare octave", () => {
        const midi = createMidiFile([
            createTrack([
                tempo(0, 500_000),
                noteOn(0, 38, 9),
                noteOff(480, 38, 9),
                noteOn(0, 40, 9),
                noteOff(480, 40, 9),
            ]),
        ]);

        const conversion = convertMidiToBaudWithDiagnostics(midi, {
            cueId: "snare.octave",
            tempo: 120,
        });

        expect(conversion.baud).toContain("@snare note.snare o4");
        expect(compiledNoteStarts(conversion.baud, "snare.octave")).toEqual([
            [0, 62],
            [10, 64],
        ]);
    });

    it("uses the Minecraft profile by default to collapse duplicate low bass starts", () => {
        const midi = createMidiFile([
            createTrack([
                tempo(0, 500_000),
                programChange(0, 0, 35),
                programChange(0, 1, 35),
                noteOn(0, 32, 0, 127),
                noteOn(0, 32, 1, 108),
                noteOff(480, 32, 0),
                noteOff(0, 32, 1),
            ]),
        ]);

        const conversion = convertMidiToBaudWithDiagnostics(midi, {
            cueId: "bass.duplicate",
            tempo: 120,
        });
        const raw = convertMidiToBaudWithDiagnostics(midi, {
            cueId: "bass.duplicate.raw",
            profile: "raw",
            tempo: 120,
        });

        expect(compiledNoteStarts(conversion.baud, "bass.duplicate")).toEqual([
            [0, 32],
        ]);
        expect(compiledNoteStarts(raw.baud, "bass.duplicate.raw")).toEqual([
            [0, 32],
            [0, 32],
        ]);
        expect(conversion.diagnostics).toContainEqual({
            kind: "optimizedPlayback",
            noteCount: 1,
            profile: "minecraft",
            reason: "duplicateNote",
        });
    });

    it("uses the Minecraft profile by default to budget unsafe same-tick stacks", () => {
        const midi = createMidiFile([
            createTrack([
                tempo(0, 500_000),
                programChange(0, 0, 33),
                programChange(0, 1, 73),
                programChange(0, 2, 25),
                programChange(0, 3, 25),
                programChange(0, 4, 0),
                programChange(0, 5, 0),
                programChange(0, 6, 56),
                programChange(0, 7, 40),
                noteOn(0, 31, 0, 118),
                noteOn(0, 72, 1, 100),
                noteOn(0, 52, 2, 92),
                noteOn(0, 55, 3, 90),
                noteOn(0, 64, 4, 80),
                noteOn(0, 67, 5, 78),
                noteOn(0, 60, 6, 82),
                noteOn(0, 59, 7, 76),
                noteOn(0, 36, 9, 100),
                noteOn(0, 38, 9, 100),
                noteOn(0, 42, 9, 70),
                noteOff(480, 31, 0),
                noteOff(0, 72, 1),
                noteOff(0, 52, 2),
                noteOff(0, 55, 3),
                noteOff(0, 64, 4),
                noteOff(0, 67, 5),
                noteOff(0, 60, 6),
                noteOff(0, 59, 7),
                noteOff(0, 36, 9),
                noteOff(0, 38, 9),
                noteOff(0, 42, 9),
            ]),
        ]);

        const conversion = convertMidiToBaudWithDiagnostics(midi, {
            cueId: "safe.stack",
            tempo: 120,
        });
        const raw = convertMidiToBaudWithDiagnostics(midi, {
            cueId: "raw.stack",
            profile: "raw",
            tempo: 120,
        });

        expect(
            countNoteStartsAtTick(conversion.baud, "safe.stack", 0),
        ).toBeLessThanOrEqual(8);
        expect(countNoteStartsAtTick(raw.baud, "raw.stack", 0)).toBe(11);
        expect(conversion.diagnostics).toContainEqual({
            kind: "optimizedPlayback",
            noteCount: expect.any(Number),
            profile: "minecraft",
            reason: "pressureBudget",
        });
    });

    it("splits dense mapped melodic MIDI parts into readable register voices", () => {
        const midi = createMidiFile([
            createTrack([
                tempo(0, 500_000),
                programChange(0, 0, 1),
                noteOn(0, 48),
                noteOn(0, 60),
                noteOn(0, 64),
                noteOff(480, 48),
                noteOff(0, 60),
                noteOff(0, 64),
                noteOn(0, 50),
                noteOff(480, 50),
            ]),
        ]);

        const conversion = convertMidiToBaudWithDiagnostics(midi, {
            cueId: "gm.poly",
            tempo: 120,
        });

        expect(conversion.baud).toContain("@piano_right note.harp");
        expect(conversion.baud).toContain("@piano_inner note.harp");
        expect(conversion.baud).toContain("@piano_left note.harp");
        expect(compiledNoteStarts(conversion.baud, "gm.poly")).toEqual([
            [0, 48],
            [0, 60],
            [0, 64],
            [10, 50],
        ]);
    });

    it("lets an explicit sound override convert unsupported melodic MIDI parts", () => {
        const midi = createMidiFile([
            createTrack([
                tempo(0, 500_000),
                programChange(0, 5, 52),
                noteOn(0, 64, 5),
                noteOff(480, 64, 5),
            ]),
        ]);

        const conversion = convertMidiToBaudWithDiagnostics(midi, {
            cueId: "gm.override",
            soundId: "note.pling",
            tempo: 120,
        });

        expect(conversion.baud).toContain("@choir note.pling");
        expect(compiledNoteStarts(conversion.baud, "gm.override")).toEqual([
            [0, 64],
        ]);
        expect(conversion.diagnostics).toEqual([
            {
                kind: "mappedPart",
                midiChannel: 6,
                noteCount: 1,
                program: 53,
                programName: "Choir Aahs",
                soundId: "note.pling",
                voiceId: "choir",
            },
        ]);
    });

    it("rejects unsupported or empty MIDI input with clear errors", () => {
        expect(() =>
            convertMidiToBaud(new Uint8Array(), { cueId: "bad.input" }),
        ).toThrow("MIDI data must start with an MThd header.");

        expect(() =>
            convertMidiToBaud(createMidiFile([createTrack([])]), {
                cueId: "empty.input",
            }),
        ).toThrow("MIDI file does not contain any playable notes.");
    });
});

function compiledNoteStarts(
    baud: string,
    cueId: string,
): Array<[number, number]> {
    const pack = compileAudioText(baud);
    const cue = pack.c.find((candidate) => candidate[0] === cueId);
    if (!cue) {
        throw new Error(`Missing cue ${cueId}.`);
    }

    return cue[3]
        .map((note) => [note[0], note[2]] satisfies [number, number])
        .sort((left, right) => left[0] - right[0] || left[1] - right[1]);
}

function countNoteStartsAtTick(
    baud: string,
    cueId: string,
    tick: number,
): number {
    const pack = compileAudioText(baud);
    const cue = pack.c.find((candidate) => candidate[0] === cueId);
    if (!cue) {
        throw new Error(`Missing cue ${cueId}.`);
    }

    return cue[3].filter((note) => note[0] === tick).length;
}

function compiledNotes(
    baud: string,
    cueId: string,
): Array<[number, number, number]> {
    const pack = compileAudioText(baud);
    const cue = pack.c.find((candidate) => candidate[0] === cueId);
    if (!cue) {
        throw new Error(`Missing cue ${cueId}.`);
    }

    return cue[3]
        .map(
            (note) =>
                [note[0], note[2], note[3]] satisfies [number, number, number],
        )
        .sort((left, right) => left[0] - right[0] || left[1] - right[1]);
}

function createMidiFile(tracks: readonly Uint8Array[]): Uint8Array {
    return bytes(
        ascii("MThd"),
        u32(6),
        u16(1),
        u16(tracks.length),
        u16(480),
        ...tracks,
    );
}

function createTrack(events: readonly Uint8Array[]): Uint8Array {
    const body = bytes(...events, varlen(0), Uint8Array.of(0xff, 0x2f, 0));
    return bytes(ascii("MTrk"), u32(body.length), body);
}

function tempo(delta: number, microsecondsPerQuarter: number): Uint8Array {
    return bytes(
        varlen(delta),
        Uint8Array.of(
            0xff,
            0x51,
            0x03,
            (microsecondsPerQuarter >> 16) & 0xff,
            (microsecondsPerQuarter >> 8) & 0xff,
            microsecondsPerQuarter & 0xff,
        ),
    );
}

function programChange(
    delta: number,
    channel: number,
    program: number,
): Uint8Array {
    return bytes(varlen(delta), Uint8Array.of(0xc0 | channel, program));
}

function controlChange(
    delta: number,
    channel: number,
    controller: number,
    value: number,
): Uint8Array {
    return bytes(
        varlen(delta),
        Uint8Array.of(0xb0 | channel, controller, value),
    );
}

function pitchBend(
    delta: number,
    channel: number,
    leastSignificant: number,
    mostSignificant: number,
): Uint8Array {
    return bytes(
        varlen(delta),
        Uint8Array.of(0xe0 | channel, leastSignificant, mostSignificant),
    );
}

function noteOn(
    delta: number,
    midiKey: number,
    channel = 0,
    velocity = 100,
): Uint8Array {
    return bytes(
        varlen(delta),
        Uint8Array.of(0x90 | channel, midiKey, velocity),
    );
}

function noteOff(delta: number, midiKey: number, channel = 0): Uint8Array {
    return bytes(varlen(delta), Uint8Array.of(0x80 | channel, midiKey, 0));
}

function trackName(delta: number, name: string): Uint8Array {
    const payload = ascii(name);
    return bytes(
        varlen(delta),
        Uint8Array.of(0xff, 0x03),
        varlen(payload.length),
        payload,
    );
}

function timeSignature(
    delta: number,
    numerator: number,
    denominator: number,
): Uint8Array {
    return bytes(
        varlen(delta),
        Uint8Array.of(
            0xff,
            0x58,
            0x04,
            numerator,
            Math.log2(denominator),
            24,
            8,
        ),
    );
}

function ascii(value: string): Uint8Array {
    return Uint8Array.from([...value].map((char) => char.charCodeAt(0)));
}

function u16(value: number): Uint8Array {
    return Uint8Array.of((value >> 8) & 0xff, value & 0xff);
}

function u32(value: number): Uint8Array {
    return Uint8Array.of(
        (value >> 24) & 0xff,
        (value >> 16) & 0xff,
        (value >> 8) & 0xff,
        value & 0xff,
    );
}

function varlen(value: number): Uint8Array {
    const buffer = [value & 0x7f];
    let remaining = value >> 7;
    while (remaining > 0) {
        buffer.unshift((remaining & 0x7f) | 0x80);
        remaining >>= 7;
    }

    return Uint8Array.from(buffer);
}

function bytes(...parts: readonly Uint8Array[]): Uint8Array {
    const output = new Uint8Array(
        parts.reduce((total, part) => total + part.length, 0),
    );
    let offset = 0;
    for (const part of parts) {
        output.set(part, offset);
        offset += part.length;
    }

    return output;
}
