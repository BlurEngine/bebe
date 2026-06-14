import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Context, Audio } from "@blurengine/bebe";
import { Player, minecraftMockControl } from "@minecraft/server";

describe("Audio runtime", () => {
    beforeEach(() => {
        minecraftMockControl.reset();
        Audio.clear();
    });

    afterEach(() => {
        Audio.clear();
    });

    it("loads compiled cues and plays timed notes through a Context", () => {
        const ctx = new Context();
        const player = new Player({ id: "player" });

        Audio.load({
            v: 1,
            s: ["note.harp"],
            c: [
                [
                    "cue",
                    120,
                    [0, 0, 0, 0],
                    [
                        [0, 0, 60, 80, 100, 0],
                        [2, 0, 64, 50, 100, 0],
                    ],
                ],
            ],
        });

        const playback = Audio.play(ctx, "cue", { target: player });

        expect(Audio.size).toBe(1);
        expect(player.playedSounds).toHaveLength(1);
        expect(player.playedSounds[0]?.soundId).toBe("note.harp");
        expect(player.playedSounds[0]?.options?.volume).toBe(0.8);
        expect(player.playedSounds[0]?.options?.pitch).toBeCloseTo(0.7071, 4);

        minecraftMockControl.advance(1);
        expect(player.playedSounds).toHaveLength(1);

        minecraftMockControl.advance(1);
        expect(player.playedSounds).toHaveLength(2);
        expect(player.playedSounds[1]?.options?.volume).toBe(0.5);
        expect(player.playedSounds[1]?.options?.pitch).toBeCloseTo(0.8909, 4);

        expect(playback.stop()).toBe(true);
        expect(playback.stop()).toBe(false);
        ctx.dispose();
    });

    it("preserves high musical pitches instead of flattening them at pitch 4", () => {
        const ctx = new Context();
        const player = new Player({ id: "player" });

        Audio.load({
            v: 1,
            s: ["note.harp"],
            c: [
                [
                    "cue",
                    120,
                    [0, 0, 0, 0],
                    [
                        [0, 0, 90, 80, 100, 0],
                        [1, 0, 102, 80, 100, 0],
                    ],
                ],
            ],
        });

        Audio.play(ctx, "cue", { target: player });
        minecraftMockControl.advance(1);

        expect(player.playedSounds[0]?.options?.pitch).toBeCloseTo(4, 4);
        expect(player.playedSounds[1]?.options?.pitch).toBeCloseTo(8, 4);
        ctx.dispose();
    });

    it("keeps active playback bound to the sound table it started with", () => {
        const ctx = new Context();
        const player = new Player({ id: "player" });

        Audio.load({
            v: 1,
            s: ["note.harp"],
            c: [["cue", 120, [0, 0, 0, 0], [[2, 0, 60, 80, 100, 0]]]],
        });

        Audio.play(ctx, "cue", { target: player });
        Audio.load({
            v: 1,
            s: ["note.bass"],
            c: [["other", 120, [0, 0, 0, 0], [[0, 0, 48, 80, 100, 0]]]],
        });

        minecraftMockControl.advance(2);

        expect(player.playedSounds.map((sound) => sound.soundId)).toEqual([
            "note.harp",
        ]);
        ctx.dispose();
    });

    it("keeps active playback bound to its sound table after Audio.clear", () => {
        const ctx = new Context();
        const player = new Player({ id: "player" });

        Audio.load({
            v: 1,
            s: ["note.harp"],
            c: [["cue", 120, [0, 0, 0, 0], [[2, 0, 60, 80, 100, 0]]]],
        });

        Audio.play(ctx, "cue", { target: player });
        Audio.clear();
        minecraftMockControl.advance(2);

        expect(player.playedSounds.map((sound) => sound.soundId)).toEqual([
            "note.harp",
        ]);
        ctx.dispose();
    });

    it("cancels pending notes when the owning Context is disposed", () => {
        const ctx = new Context();
        const player = new Player({ id: "player" });

        Audio.load({
            v: 1,
            s: ["note.harp"],
            c: [
                [
                    "cue",
                    120,
                    [0, 0, 0, 0],
                    [
                        [0, 0, 60, 80, 100, 0],
                        [4, 0, 72, 80, 100, 0],
                    ],
                ],
            ],
        });

        Audio.play(ctx, "cue", { target: player });
        ctx.dispose();
        minecraftMockControl.advance(8);

        expect(player.playedSounds.map((sound) => sound.soundId)).toEqual([
            "note.harp",
        ]);
    });

    it("cancels delayed notes when playback is manually stopped", () => {
        const ctx = new Context();
        const player = new Player({ id: "player" });

        Audio.load({
            v: 1,
            s: ["note.harp"],
            c: [["cue", 120, [0, 0, 0, 0], [[2, 0, 60, 80, 100, 0]]]],
        });

        const playback = Audio.play(ctx, "cue", { target: player });
        expect(playback.stop()).toBe(true);
        minecraftMockControl.advance(2);

        expect(player.playedSounds).toHaveLength(0);
        ctx.dispose();
    });

    it("unregisters context cleanup when playback is manually stopped", () => {
        const ctx = new Context();
        const removeFinalizer = vi.fn();
        const use = vi.spyOn(ctx, "use").mockReturnValue(removeFinalizer);
        const player = new Player({ id: "player" });

        Audio.load({
            v: 1,
            s: ["note.harp"],
            c: [["cue", 120, [0, 0, 0, 0], [[2, 0, 60, 80, 100, 0]]]],
        });

        const playback = Audio.play(ctx, "cue", { target: player });
        expect(use).toHaveBeenCalledTimes(1);

        playback.stop();

        expect(removeFinalizer).toHaveBeenCalledTimes(1);
    });

    it("unregisters context cleanup after the final scheduled note fires", () => {
        const ctx = new Context();
        const removeFinalizer = vi.fn();
        vi.spyOn(ctx, "use").mockReturnValue(removeFinalizer);
        const player = new Player({ id: "player" });

        Audio.load({
            v: 1,
            s: ["note.harp"],
            c: [
                [
                    "cue",
                    120,
                    [0, 0, 0, 0],
                    [
                        [1, 0, 60, 80, 100, 0],
                        [3, 0, 64, 80, 100, 0],
                    ],
                ],
            ],
        });

        Audio.play(ctx, "cue", { target: player });
        minecraftMockControl.advance(1);
        expect(removeFinalizer).not.toHaveBeenCalled();

        minecraftMockControl.advance(2);
        expect(removeFinalizer).toHaveBeenCalledTimes(1);
    });

    it("plays same-tick delayed notes together", () => {
        const ctx = new Context();
        const player = new Player({ id: "player" });

        Audio.load({
            v: 1,
            s: ["note.harp", "note.bass"],
            c: [
                [
                    "cue",
                    120,
                    [0, 0, 0, 0],
                    [
                        [2, 0, 60, 80, 100, 0],
                        [2, 1, 48, 70, 100, 0],
                    ],
                ],
            ],
        });

        Audio.play(ctx, "cue", { target: player });

        minecraftMockControl.advance(1);
        expect(player.playedSounds).toHaveLength(0);

        minecraftMockControl.advance(1);
        expect(player.playedSounds.map((sound) => sound.soundId)).toEqual([
            "note.harp",
            "note.bass",
        ]);
        ctx.dispose();
    });

    it("skips invalid targets with method-style validity checks", () => {
        const ctx = new Context();
        const target = {
            valid: false,
            playedSounds: [] as string[],
            isValid() {
                return this.valid;
            },
            playSound(soundId: string): void {
                this.playedSounds.push(soundId);
            },
        };

        Audio.load({
            v: 1,
            s: ["note.harp"],
            c: [["cue", 120, [0, 0, 0, 0], [[0, 0, 60, 80, 100, 0]]]],
        });

        expect(() => Audio.play(ctx, "cue", { target })).not.toThrow();
        expect(target.playedSounds).toEqual([]);
        ctx.dispose();
    });

    it("skips invalid targets with boolean validity checks", () => {
        const ctx = new Context();
        const target = {
            isValid: false,
            playedSounds: [] as string[],
            playSound(soundId: string): void {
                this.playedSounds.push(soundId);
            },
        };

        Audio.load({
            v: 1,
            s: ["note.harp"],
            c: [["cue", 120, [0, 0, 0, 0], [[0, 0, 60, 80, 100, 0]]]],
        });

        expect(() => Audio.play(ctx, "cue", { target })).not.toThrow();
        expect(target.playedSounds).toEqual([]);
        ctx.dispose();
    });

    it("plays through dimensions with normalized Vec3 locations", () => {
        const ctx = new Context();
        const playedSounds: Array<{
            readonly location: {
                readonly x: number;
                readonly y: number;
                readonly z: number;
            };
            readonly options?: {
                readonly pitch?: number;
                readonly volume?: number;
            };
            readonly soundId: string;
        }> = [];
        const dimension = {
            playSound(
                soundId: string,
                location: {
                    readonly x: number;
                    readonly y: number;
                    readonly z: number;
                },
                options?: { readonly pitch?: number; readonly volume?: number },
            ): void {
                playedSounds.push({ soundId, location, options });
            },
        };

        Audio.load({
            v: 1,
            s: ["note.harp"],
            c: [["cue", 120, [0, 0, 0, 0], [[0, 0, 60, 80, 100, 0]]]],
        });

        Audio.play(ctx, "cue", { dimension, location: [1, 2, 3] });

        expect(playedSounds).toEqual([
            {
                location: { x: 1, y: 2, z: 3 },
                options: {
                    pitch: expect.closeTo(0.7071, 4),
                    volume: 0.8,
                },
                soundId: "note.harp",
            },
        ]);
        ctx.dispose();
    });

    it("throws a clear error for unknown cues", () => {
        const ctx = new Context();
        const player = new Player({ id: "player" });

        expect(() => Audio.play(ctx, "missing", { target: player })).toThrow(
            'Unknown audio cue "missing".',
        );

        ctx.dispose();
    });
});
