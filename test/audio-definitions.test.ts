import { describe, expect, it } from "vitest";
import {
    compileAudioSources,
    compileAudioSourcesWithVisuals,
    compileAudioText,
    normalizeAudioCompiledPack,
} from "@blurengine/bebe/tooling/node";
import { compileAudioTextWithVisuals } from "../src/audio/definitions.js";

describe("BAUD audio definitions", () => {
    it("compiles hand-written BAUD into the compact audio pack", () => {
        expect(
            compileAudioText(
                [
                    "cue reward.success t120",
                    "",
                    "@lead note.harp o4 l4 v80",
                    "c e g > c",
                    "",
                    "@bass note.bass o3 l2 v70",
                    "c g",
                    "",
                ].join("\n"),
                { source: "audio/reward.baud" },
            ),
        ).toEqual({
            v: 1,
            s: ["note.harp", "note.bass"],
            c: [
                [
                    "reward.success",
                    120,
                    [0, 0, 0, 0],
                    [
                        [0, 0, 60, 80, 100, 0],
                        [0, 1, 48, 70, 100, 0],
                        [10, 0, 64, 80, 100, 0],
                        [20, 0, 67, 80, 100, 0],
                        [20, 1, 55, 70, 100, 0],
                        [30, 0, 72, 80, 100, 0],
                    ],
                ],
            ],
        });
    });

    it("supports rests, bars, accidentals, dotted notes, and chords", () => {
        expect(
            compileAudioText(
                [
                    "cue sparkle t120",
                    "@lead note.bell o4 l8 v65",
                    "c r | [e g > c]4. < f#8 bb8",
                    "",
                ].join("\n"),
                { source: "audio/sparkle.baud" },
            ).c[0]?.[3],
        ).toEqual([
            [0, 0, 60, 65, 100, 0],
            [10, 0, 64, 65, 100, 0],
            [10, 0, 67, 65, 100, 0],
            [10, 0, 72, 65, 100, 0],
            [25, 0, 66, 65, 100, 0],
            [30, 0, 70, 65, 100, 0],
        ]);
    });

    it("rounds non-120 BPM durations only after resolving the requested note length", () => {
        expect(
            compileAudioText(
                [
                    "cue timing t140",
                    "@lead note.harp o4 l4 v80",
                    "c4. d8 e16",
                    "",
                ].join("\n"),
                { source: "audio/timing.baud" },
            ).c[0]?.[3],
        ).toEqual([
            [0, 0, 60, 80, 100, 0],
            [13, 0, 62, 80, 100, 0],
            [17, 0, 64, 80, 100, 0],
        ]);
    });

    it("can return visual metadata beside the compact playback pack", () => {
        const compilation = compileAudioTextWithVisuals(
            [
                "cue preview t120",
                "@lead note.harp o4 l8 v80",
                "c r e4.",
                "",
            ].join("\n"),
            { source: "audio/preview.baud" },
        );

        expect(Object.keys(compilation.pack).sort()).toEqual(["c", "s", "v"]);
        expect(compilation.visual.cues[0]).toMatchObject({
            id: "preview",
            tempo: 120,
            voices: [
                {
                    id: "lead",
                    soundId: "note.harp",
                    tokens: [
                        {
                            kind: "note",
                            tick: 0,
                            duration: 5,
                            label: "c",
                            resolvedLabel: "C4/8",
                        },
                        {
                            kind: "rest",
                            tick: 5,
                            duration: 5,
                            label: "r",
                            resolvedLabel: "r8",
                        },
                        {
                            kind: "note",
                            tick: 10,
                            duration: 15,
                            label: "e4.",
                            resolvedLabel: "E4/4.",
                        },
                    ],
                },
            ],
        });
    });

    it("rejects cue declarations without tempo", () => {
        expect(() =>
            compileAudioText("cue cue\n@lead note.harp o4 l4 v80\nc\n", {
                source: "audio/bad.baud",
            }),
        ).toThrow("Cue declarations use: cue <id> t<bpm>.");
    });

    it("rejects incomplete voice declarations", () => {
        expect(() =>
            compileAudioText("cue cue t120\n@lead note.harp\nc\n", {
                source: "audio/bad.baud",
            }),
        ).toThrow(
            "Voice declarations use: @<voice> <sound> o<octave> l<length> v<volume>.",
        );
    });

    it("rejects voice volumes outside 0..100", () => {
        expect(() =>
            compileAudioText("cue cue t120\n@lead note.harp o4 l4 v-10\nc\n", {
                source: "audio/bad.baud",
            }),
        ).toThrow("volume must be between 0 and 100.");

        expect(() =>
            compileAudioText("cue cue t120\n@lead note.harp o4 l4 v101\nc\n", {
                source: "audio/bad.baud",
            }),
        ).toThrow("volume must be between 0 and 100.");
    });

    it("validates compact compiled audio domains", () => {
        expect(
            normalizeAudioCompiledPack(
                compiledPackWithNote([0, 0, 60, 80, 100, -4.4]),
            ),
        ).toEqual({
            v: 1,
            s: ["note.harp"],
            c: [["cue", 120, [0, 0, 0, 0], [[0, 0, 60, 80, 100, -4]]]],
        });

        expect(() =>
            normalizeAudioCompiledPack(
                compiledPackWithNote([-1, 0, 60, 80, 100, 0]),
            ),
        ).toThrow("audio.c[0][3][0][0] must be a non-negative integer.");

        expect(() =>
            normalizeAudioCompiledPack(
                compiledPackWithNote([0, 1, 60, 80, 100, 0]),
            ),
        ).toThrow("audio.c[0][3][0][1] must reference a sound table index.");

        expect(() =>
            normalizeAudioCompiledPack(
                compiledPackWithNote([0, 0, 60, 101, 100, 0]),
            ),
        ).toThrow("audio.c[0][3][0][3] must be between 0 and 100.");

        expect(() =>
            normalizeAudioCompiledPack(
                compiledPackWithNote([0, 0, 60, 80, 201, 0]),
            ),
        ).toThrow("audio.c[0][3][0][4] must be between 0 and 200.");

        expect(() =>
            normalizeAudioCompiledPack(compiledPackWithLoop([-1, 0, 0, 0])),
        ).toThrow("audio.c[0][2][0] must be a non-negative integer.");

        expect(() =>
            normalizeAudioCompiledPack(compiledPackWithLoop([10, 5, 0, 0])),
        ).toThrow("audio.c[0][2][1] must be 0 or greater than or equal to 10.");
    });

    it("compiles multiple source files in stable relative-path order", () => {
        expect(
            compileAudioSources([
                {
                    relativePath: "audio/b.baud",
                    absolutePath: "/project/audio/b.baud",
                    text: "cue beta t120\n@lead note.harp o4 l4 v80\nc\n",
                },
                {
                    relativePath: "audio/a.baud",
                    absolutePath: "/project/audio/a.baud",
                    text: "cue alpha t120\n@lead note.harp o4 l4 v80\ne\n",
                },
            ]).c.map((cue) => cue[0]),
        ).toEqual(["alpha", "beta"]);
    });

    it("rejects an empty BAUD source file collection", () => {
        expect(() => compileAudioSources([])).toThrow(
            "BAUD source collection must include at least one .baud file under audio/.",
        );
    });

    it("can return visual metadata for BAUD source file collections", () => {
        const compilation = compileAudioSourcesWithVisuals([
            {
                relativePath: "audio/b.baud",
                absolutePath: "/project/audio/b.baud",
                text: [
                    "cue beta t120",
                    "@lead note.harp o4 l8 v80",
                    "c r e4.",
                ].join("\n"),
            },
            {
                relativePath: "audio/a.baud",
                absolutePath: "/project/audio/a.baud",
                text: [
                    "cue alpha t120",
                    "@bass note.bass o2 l4 v60",
                    "c g",
                ].join("\n"),
            },
        ]);

        expect(compilation.pack.c.map((cue) => cue[0])).toEqual([
            "alpha",
            "beta",
        ]);
        expect(compilation.visual.cues.map((cue) => cue.id)).toEqual([
            "alpha",
            "beta",
        ]);
        expect(compilation.visual.cues[1]?.voices[0]).toMatchObject({
            id: "lead",
            soundId: "note.harp",
            tokens: [
                {
                    kind: "note",
                    tick: 0,
                    duration: 5,
                    label: "c",
                    resolvedLabel: "C4/8",
                },
                {
                    kind: "rest",
                    tick: 5,
                    duration: 5,
                    label: "r",
                    resolvedLabel: "r8",
                },
                {
                    kind: "note",
                    tick: 10,
                    duration: 15,
                    label: "e4.",
                    resolvedLabel: "E4/4.",
                },
            ],
        });
    });

    it("orders multiple source files by code point, not locale collation", () => {
        expect(
            compileAudioSources([
                {
                    relativePath: "audio/a.baud",
                    absolutePath: "/project/audio/a.baud",
                    text: "cue lower t120\n@lead note.harp o4 l4 v80\nc\n",
                },
                {
                    relativePath: "audio/Z.baud",
                    absolutePath: "/project/audio/Z.baud",
                    text: "cue upper t120\n@lead note.harp o4 l4 v80\ne\n",
                },
            ]).c.map((cue) => cue[0]),
        ).toEqual(["upper", "lower"]);
    });

    it("sorts multiple source files after relative path normalization", () => {
        expect(
            compileAudioSources([
                {
                    relativePath: "audio\\b.baud",
                    absolutePath: "/project/audio/b.baud",
                    text: "cue beta t120\n@lead note.harp o4 l4 v80\nc\n",
                },
                {
                    relativePath: "audio/a.baud",
                    absolutePath: "/project/audio/a.baud",
                    text: "cue alpha t120\n@lead note.harp o4 l4 v80\ne\n",
                },
            ]).c.map((cue) => cue[0]),
        ).toEqual(["alpha", "beta"]);
    });

    it("rejects duplicate cue ids across files with source context", () => {
        expect(() =>
            compileAudioSources([
                {
                    relativePath: "audio/a.baud",
                    absolutePath: "/project/audio/a.baud",
                    text: "cue cue t120\n@lead note.harp o4 l4 v80\nc\n",
                },
                {
                    relativePath: "audio/b.baud",
                    absolutePath: "/project/audio/b.baud",
                    text: "cue cue t120\n@lead note.harp o4 l4 v80\ne\n",
                },
            ]),
        ).toThrow('Duplicate cue id "cue" in audio/b.baud.');
    });

    it("rejects BAUD files outside the project audio directory", () => {
        expect(() =>
            compileAudioSources([
                {
                    relativePath: "reward.baud",
                    absolutePath: "/project/reward.baud",
                    text: "cue cue t120\n@lead note.harp o4 l4 v80\nc\n",
                },
            ]),
        ).toThrow("BAUD source reward.baud must live under audio/.");
    });

    it("rejects compileAudioText sources outside the project audio directory", () => {
        expect(() =>
            compileAudioText("cue cue t120\n@lead note.harp o4 l4 v80\nc\n", {
                source: "audio.baud",
            }),
        ).toThrow("BAUD source audio.baud must live under audio/.");
    });

    it("rejects malformed BAUD source paths under the project audio directory", () => {
        expect(() =>
            compileAudioSources([
                {
                    relativePath: "audio/../cue.baud",
                    absolutePath: "/project/cue.baud",
                    text: "cue cue t120\n@lead note.harp o4 l4 v80\nc\n",
                },
            ]),
        ).toThrow(
            "BAUD source audio/../cue.baud must be a normalized path under audio/.",
        );

        expect(() =>
            compileAudioText("cue cue t120\n@lead note.harp o4 l4 v80\nc\n", {
                source: "audio//cue.baud",
            }),
        ).toThrow(
            "BAUD source audio//cue.baud must be a normalized path under audio/.",
        );
    });
});

function compiledPackWithNote(note: readonly number[]) {
    return {
        v: 1,
        s: ["note.harp"],
        c: [["cue", 120, [0, 0, 0, 0], [note]]],
    };
}

function compiledPackWithLoop(loop: readonly number[]) {
    return {
        v: 1,
        s: ["note.harp"],
        c: [["cue", 120, loop, [[0, 0, 60, 80, 100, 0]]]],
    };
}
