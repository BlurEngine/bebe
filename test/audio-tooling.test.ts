import { describe, expect, it } from "vitest";
import {
    GENERATED_AUDIO_FILE,
    GENERATED_AUDIO_VISUALS_FILE,
    PROJECT_AUDIO_DIRECTORY,
    compileAudioText,
    createAudioAssetCompiler,
} from "@blurengine/bebe/tooling/node";

describe("audio asset compiler", () => {
    it("declares a text collection compiler for audio/**/*.baud", () => {
        const compiler = createAudioAssetCompiler();

        expect(compiler.id).toBe("bebe:audio");
        expect(compiler.sourcePaths).toEqual([PROJECT_AUDIO_DIRECTORY]);
        expect(compiler.sourceKind).toBe("text");
        expect(compiler.sourceMode).toBe("collection");
        expect(compiler.sourceFileExtensions).toEqual([".baud"]);
        expect(compiler.outputPath).toBe(GENERATED_AUDIO_FILE);
        expect(compiler.artifactOutputPaths).toEqual([
            {
                target: "scripts",
                outputPath: GENERATED_AUDIO_VISUALS_FILE,
            },
        ]);
    });

    it("compiles source file collections into the compact audio pack", () => {
        const compiler = createAudioAssetCompiler();

        const result = compiler.compile({
            pipeline: "build",
            projectRoot: "/project",
            sourcePath: "/project/audio",
            sourceFiles: [
                {
                    relativePath: "audio/reward.baud",
                    absolutePath: "/project/audio/reward.baud",
                    text: "cue reward.success t120\n@lead note.harp o4 l4 v80\nc\n",
                },
            ],
        });

        expect(result.output).toEqual({
            v: 1,
            s: ["note.harp"],
            c: [
                ["reward.success", 120, [0, 0, 0, 0], [[0, 0, 60, 80, 100, 0]]],
            ],
        });
        expect(result.artifacts ?? []).toEqual([]);
    });

    it("emits source visual metadata as a dev-only script artifact", () => {
        const compiler = createAudioAssetCompiler();

        const result = compiler.compile({
            pipeline: "dev",
            projectRoot: "/project",
            sourcePath: "/project/audio",
            sourceFiles: [
                {
                    relativePath: "audio/reward.baud",
                    absolutePath: "/project/audio/reward.baud",
                    text: [
                        "cue reward.success t120",
                        "@lead note.harp o4 l8 v80",
                        "c r e",
                    ].join("\n"),
                },
            ],
        });

        expect(result.artifacts).toEqual([
            {
                target: "scripts",
                outputPath: GENERATED_AUDIO_VISUALS_FILE,
                output: {
                    cues: [
                        {
                            id: "reward.success",
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
                                            midiKeys: [60],
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
                                            duration: 5,
                                            label: "e",
                                            resolvedLabel: "E4/8",
                                            midiKeys: [64],
                                        },
                                    ],
                                },
                            ],
                        },
                    ],
                },
            },
        ]);
    });

    it("rejects missing source file collections", () => {
        const compiler = createAudioAssetCompiler();

        expect(() =>
            compiler.compile({
                pipeline: "build",
                projectRoot: "/project",
                sourcePath: "/project/audio",
            }),
        ).toThrow(
            "Audio asset compiler requires sourceFiles from the audio directory.",
        );
    });

    it("renders bootstrap that loads Audio without starting a loop", () => {
        const compiler = createAudioAssetCompiler();

        expect(
            compiler.renderBootstrap?.({
                outputImportSpecifier: "./dist/generated/bebe/audio.json",
                outputPath: GENERATED_AUDIO_FILE,
            }),
        ).toEqual([
            'import { Audio } from "@blurengine/bebe";',
            'import __bebeAudio from "./dist/generated/bebe/audio.json";',
            "Audio.load(__bebeAudio);",
        ]);
    });

    it("accepts authored notes at MIDI range boundaries", () => {
        expect(
            compileAudioText(
                "cue range.low t120\n@lead note.harp o-1 l4 v80\nc\n",
            ).c[0]?.[3][0]?.[2],
        ).toBe(0);
        expect(
            compileAudioText(
                "cue range.high t120\n@lead note.harp o9 l4 v80\ng\n",
            ).c[0]?.[3][0]?.[2],
        ).toBe(127);
    });

    it("rejects authored notes outside the MIDI range", () => {
        expect(() =>
            compileAudioText(
                "cue range.too-high t120\n@lead note.harp o9 l4 v80\ng#\n",
                { source: "audio/range.baud" },
            ),
        ).toThrow(
            "audio/range.baud:3: Audio note G#9 resolves to MIDI key 128, outside supported range 0..127.",
        );
        expect(() =>
            compileAudioText(
                "cue range.too-low t120\n@lead note.harp o-2 l4 v80\nb\n",
                { source: "audio/range.baud" },
            ),
        ).toThrow(
            "audio/range.baud:3: Audio note B-2 resolves to MIDI key -1, outside supported range 0..127.",
        );
    });
});
