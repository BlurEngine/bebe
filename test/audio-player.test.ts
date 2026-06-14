import { afterEach, describe, expect, it, vi } from "vitest";
import { Audio } from "@blurengine/bebe";
import {
    installAudioPlayerCommand,
    parseAudioPlayerCommand,
} from "@blurengine/bebe/internal/audio/player";
import { formatAudioActionBar } from "../src/internal/audio/visualizer.js";
import { compileAudioTextWithVisuals } from "../src/audio/definitions.js";
import {
    CommandPermissionLevel,
    CustomCommandParamType,
    CustomCommandStatus,
    Player,
    minecraftMockControl,
} from "./support/minecraft-server.mock";
import { minecraftServerUiMockControl } from "./support/minecraft-server-ui.mock";

describe("internal audio player command", () => {
    afterEach(() => {
        Audio.clear();
        minecraftMockControl.reset();
        minecraftServerUiMockControl.reset();
    });

    it("registers the audio command in the configured namespace", () => {
        Audio.load({
            v: 1,
            s: ["note.harp"],
            c: [["reward.success", 120, [0, 0, 0, 0], []]],
        });
        installAudioPlayerCommand({
            commandNamespace: "demo_pack",
            commandPermissionLevel: CommandPermissionLevel.Any,
        });

        minecraftMockControl.emitStartup();

        const command =
            minecraftMockControl.getCustomCommand("demo_pack:audio")?.command;
        expect(command).toMatchObject({
            description: "Play Bebe audio in a dev world.",
            permissionLevel: CommandPermissionLevel.Any,
            cheatsRequired: true,
            mandatoryParameters: [],
            optionalParameters: [
                {
                    name: "demo_pack:audio_action",
                    type: CustomCommandParamType.Enum,
                },
                { name: "cueOrText", type: CustomCommandParamType.String },
            ],
        });
        expect(
            minecraftMockControl.getCustomCommandEnum("demo_pack:audio_action"),
        ).toEqual(["list", "play", "text", "reward.success"]);
        expect(
            minecraftMockControl.getCustomCommand("bebe:audio"),
        ).toBeUndefined();
    });

    it("parses list, play, and shorthand command arguments", () => {
        expect(parseAudioPlayerCommand([])).toEqual({ kind: "menu" });
        expect(parseAudioPlayerCommand(["list"])).toEqual({ kind: "list" });
        expect(parseAudioPlayerCommand(["play", "reward.success"])).toEqual({
            kind: "play",
            cueId: "reward.success",
        });
        expect(
            parseAudioPlayerCommand([
                "text",
                "cue preview t120; @lead note.harp o4 l4 v80; c",
            ]),
        ).toEqual({
            kind: "text",
            source: "cue preview t120; @lead note.harp o4 l4 v80; c",
        });
        expect(parseAudioPlayerCommand(["reward.success"])).toEqual({
            kind: "play",
            cueId: "reward.success",
        });
        expect(parseAudioPlayerCommand(["text"])).toEqual({
            ok: false,
            message:
                "Use audio list, audio play <cueId>, audio <cueId>, or audio text <baud>.",
        });
    });

    it("opens a cue picker form when the command has no arguments", async () => {
        Audio.load({
            v: 1,
            s: ["note.harp"],
            c: [
                ["alpha", 120, [0, 0, 0, 0], [[0, 0, 60, 80, 100, 0]]],
                ["beta", 120, [0, 0, 0, 0], [[0, 0, 64, 80, 100, 0]]],
            ],
        });
        minecraftServerUiMockControl.queueActionFormResponse({
            canceled: true,
        });
        installAudioPlayerCommand({ commandNamespace: "demo_pack" });
        minecraftMockControl.emitStartup();
        const command =
            minecraftMockControl.getCustomCommand("demo_pack:audio")!;
        const player = new Player({ id: "player" });

        expect(command.callback({ sourceEntity: player })).toEqual({
            status: CustomCommandStatus.Success,
            message: "Opening BAUD audio menu.",
        });

        minecraftMockControl.advance(1);
        await flushPromises();

        expect(minecraftServerUiMockControl.shownActionForms).toHaveLength(1);
        expect(
            minecraftServerUiMockControl.shownActionForms[0]?.buttons.map(
                (button) => button.text,
            ),
        ).toEqual(["alpha", "beta"]);
    });

    it("plays a cue selected from the no-argument command form", async () => {
        Audio.load({
            v: 1,
            s: ["note.harp", "note.bell"],
            c: [
                ["alpha", 120, [0, 0, 0, 0], [[0, 0, 60, 80, 100, 0]]],
                ["beta", 120, [0, 0, 0, 0], [[0, 1, 64, 80, 100, 0]]],
            ],
        });
        minecraftServerUiMockControl.queueActionFormResponse({
            canceled: false,
            selection: 1,
        });
        installAudioPlayerCommand({ commandNamespace: "demo_pack" });
        minecraftMockControl.emitStartup();
        const command =
            minecraftMockControl.getCustomCommand("demo_pack:audio")!;
        const player = new Player({ id: "player" });

        command.callback({ sourceEntity: player });
        minecraftMockControl.advance(1);
        await flushPromises();
        minecraftMockControl.advance(1);

        expect(player.playedSounds.map((sound) => sound.soundId)).toEqual([
            "note.bell",
        ]);
    });

    it("shows a clear button only while command audio is active", async () => {
        Audio.load({
            v: 1,
            s: ["note.harp"],
            c: [
                [
                    "alpha",
                    120,
                    [0, 0, 0, 0],
                    [
                        [0, 0, 60, 80, 100, 0],
                        [10, 0, 72, 80, 100, 0],
                    ],
                ],
            ],
        });
        installAudioPlayerCommand({ commandNamespace: "demo_pack" });
        minecraftMockControl.emitStartup();
        const command =
            minecraftMockControl.getCustomCommand("demo_pack:audio")!;
        const player = new Player({ id: "player" });

        command.callback({ sourceEntity: player }, "alpha");
        minecraftMockControl.advance(1);
        expect(player.playedSounds).toHaveLength(1);

        minecraftServerUiMockControl.queueActionFormResponse({
            canceled: false,
            selection: 0,
        });
        command.callback({ sourceEntity: player });
        minecraftMockControl.advance(1);
        await flushPromises();

        expect(
            minecraftServerUiMockControl.shownActionForms[0]?.buttons.map(
                (button) => button.text,
            ),
        ).toEqual(["Clear", "alpha"]);

        minecraftMockControl.advance(12);

        expect(player.playedSounds).toHaveLength(1);

        minecraftServerUiMockControl.queueActionFormResponse({
            canceled: true,
        });
        command.callback({ sourceEntity: player });
        minecraftMockControl.advance(1);
        await flushPromises();

        expect(
            minecraftServerUiMockControl.shownActionForms[1]?.buttons.map(
                (button) => button.text,
            ),
        ).toEqual(["alpha"]);
    });

    it("cancels the player's previous command audio when another cue is scheduled", () => {
        Audio.load({
            v: 1,
            s: ["note.harp", "note.bell"],
            c: [
                [
                    "alpha",
                    120,
                    [0, 0, 0, 0],
                    [
                        [0, 0, 60, 80, 100, 0],
                        [10, 0, 72, 80, 100, 0],
                    ],
                ],
                ["beta", 120, [0, 0, 0, 0], [[0, 1, 64, 80, 100, 0]]],
            ],
        });
        installAudioPlayerCommand({ commandNamespace: "demo_pack" });
        minecraftMockControl.emitStartup();
        const command =
            minecraftMockControl.getCustomCommand("demo_pack:audio")!;
        const player = new Player({ id: "player" });

        command.callback({ sourceEntity: player }, "alpha");
        minecraftMockControl.advance(1);
        command.callback({ sourceEntity: player }, "beta");
        minecraftMockControl.advance(1);
        minecraftMockControl.advance(12);

        expect(player.playedSounds.map((sound) => sound.soundId)).toEqual([
            "note.harp",
            "note.bell",
        ]);
    });

    it("does not cancel another player's command audio", () => {
        Audio.load({
            v: 1,
            s: ["note.harp", "note.bell"],
            c: [
                [
                    "alpha",
                    120,
                    [0, 0, 0, 0],
                    [
                        [0, 0, 60, 80, 100, 0],
                        [10, 0, 72, 80, 100, 0],
                    ],
                ],
                ["beta", 120, [0, 0, 0, 0], [[0, 1, 64, 80, 100, 0]]],
            ],
        });
        installAudioPlayerCommand({ commandNamespace: "demo_pack" });
        minecraftMockControl.emitStartup();
        const command =
            minecraftMockControl.getCustomCommand("demo_pack:audio")!;
        const firstPlayer = new Player({ id: "first" });
        const secondPlayer = new Player({ id: "second" });

        command.callback({ sourceEntity: firstPlayer }, "alpha");
        command.callback({ sourceEntity: secondPlayer }, "alpha");
        minecraftMockControl.advance(1);
        command.callback({ sourceEntity: firstPlayer }, "beta");
        minecraftMockControl.advance(1);
        minecraftMockControl.advance(12);

        expect(firstPlayer.playedSounds.map((sound) => sound.soundId)).toEqual([
            "note.harp",
            "note.bell",
        ]);
        expect(secondPlayer.playedSounds.map((sound) => sound.soundId)).toEqual(
            ["note.harp", "note.harp"],
        );
    });

    it("lists loaded cue ids", () => {
        Audio.load({
            v: 1,
            s: ["note.harp"],
            c: [
                ["alpha", 120, [0, 0, 0, 0], [[0, 0, 60, 80, 100, 0]]],
                ["beta", 120, [0, 0, 0, 0], [[0, 0, 64, 80, 100, 0]]],
            ],
        });
        installAudioPlayerCommand({ commandNamespace: "demo_pack" });
        minecraftMockControl.emitStartup();
        const command =
            minecraftMockControl.getCustomCommand("demo_pack:audio")!;
        const player = new Player({ id: "player" });

        expect(command.callback({ sourceEntity: player }, "list")).toEqual({
            status: CustomCommandStatus.Success,
            message: "Loaded BAUD cues: alpha, beta",
        });
    });

    it("plays a loaded cue by shorthand id for the command player", () => {
        Audio.load({
            v: 1,
            s: ["note.harp"],
            c: [
                ["reward.success", 120, [0, 0, 0, 0], [[0, 0, 60, 80, 100, 0]]],
            ],
        });
        installAudioPlayerCommand({ commandNamespace: "demo_pack" });
        minecraftMockControl.emitStartup();
        const command =
            minecraftMockControl.getCustomCommand("demo_pack:audio")!;
        const player = new Player({ id: "player" });

        expect(
            command.callback({ sourceEntity: player }, "reward.success"),
        ).toEqual({
            status: CustomCommandStatus.Success,
            message: 'Playing BAUD cue "reward.success".',
        });
        expect(player.playedSounds).toEqual([]);

        minecraftMockControl.advance(1);

        expect(player.playedSounds.map((sound) => sound.soundId)).toEqual([
            "note.harp",
        ]);
    });

    it("shows an actionbar visualisation for loaded cue commands", () => {
        Audio.load({
            v: 1,
            s: ["note.harp"],
            c: [
                [
                    "reward.success",
                    120,
                    [0, 0, 0, 0],
                    [
                        [0, 0, 60, 80, 100, 0],
                        [5, 0, 64, 80, 100, 0],
                    ],
                ],
            ],
        });
        installAudioPlayerCommand({ commandNamespace: "demo_pack" });
        minecraftMockControl.emitStartup();
        const command =
            minecraftMockControl.getCustomCommand("demo_pack:audio")!;
        const player = new Player({ id: "player" });

        expect(
            command.callback({ sourceEntity: player }, "reward.success"),
        ).toEqual({
            status: CustomCommandStatus.Success,
            message: 'Playing BAUD cue "reward.success".',
        });
        expect(actionBarMessages(player)).toEqual([]);

        minecraftMockControl.advance(1);

        const first = latestActionBarMessage(player);
        expect(first).toContain("BAUD reward.success");
        expect(first).toContain("0/5");
        expect(first).toContain("§f§lC");

        minecraftMockControl.advance(5);

        const later = latestActionBarMessage(player);
        expect(actionBarMessages(player).length).toBeGreaterThan(1);
        expect(later).toContain("§f§lE");
    });

    it("greys past notes in command visualisation unless code opts out", () => {
        Audio.load({
            v: 1,
            s: ["note.harp"],
            c: [
                [
                    "reward.success",
                    120,
                    [0, 0, 0, 0],
                    [
                        [0, 0, 60, 80, 100, 0],
                        [5, 0, 64, 80, 100, 0],
                        [10, 0, 67, 80, 100, 0],
                    ],
                ],
            ],
        });
        installAudioPlayerCommand({ commandNamespace: "demo_pack" });
        minecraftMockControl.emitStartup();
        let command = minecraftMockControl.getCustomCommand("demo_pack:audio")!;
        let player = new Player({ id: "player" });

        command.callback({ sourceEntity: player }, "reward.success");
        minecraftMockControl.advance(6);

        expect(
            formattingCodesBeforePlainCharacter(
                latestActionBarMessage(player),
                "C",
            ),
        ).toEqual(["§8"]);

        minecraftMockControl.reset();
        Audio.load({
            v: 1,
            s: ["note.harp"],
            c: [
                [
                    "reward.success",
                    120,
                    [0, 0, 0, 0],
                    [
                        [0, 0, 60, 80, 100, 0],
                        [5, 0, 64, 80, 100, 0],
                        [10, 0, 67, 80, 100, 0],
                    ],
                ],
            ],
        });
        installAudioPlayerCommand({
            commandNamespace: "demo_pack",
            greyPastNotes: false,
        });
        minecraftMockControl.emitStartup();
        command = minecraftMockControl.getCustomCommand("demo_pack:audio")!;
        player = new Player({ id: "player" });

        command.callback({ sourceEntity: player }, "reward.success");
        minecraftMockControl.advance(6);

        expect(
            formattingCodesBeforePlainCharacter(
                latestActionBarMessage(player),
                "C",
            ),
        ).toEqual(["§c"]);
    });

    it("uses dev visual metadata for loaded cue command layers", () => {
        Audio.load({
            v: 1,
            s: ["note.harp", "note.bass"],
            c: [
                [
                    "reward.success",
                    120,
                    [0, 0, 0, 0],
                    [
                        [0, 0, 60, 80, 100, 0],
                        [10, 0, 64, 80, 100, 0],
                        [0, 1, 36, 60, 100, 0],
                        [10, 1, 43, 60, 100, 0],
                    ],
                ],
            ],
        });
        installAudioPlayerCommand({
            commandNamespace: "demo_pack",
            visualPack: {
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
                                        midiKeys: [60],
                                    },
                                    {
                                        kind: "rest",
                                        tick: 5,
                                        duration: 5,
                                        label: "r",
                                    },
                                    {
                                        kind: "note",
                                        tick: 10,
                                        duration: 15,
                                        label: "e4.",
                                        midiKeys: [64],
                                    },
                                ],
                            },
                            {
                                id: "bass",
                                soundId: "note.bass",
                                tokens: [
                                    {
                                        kind: "note",
                                        tick: 0,
                                        duration: 10,
                                        label: "c",
                                        midiKeys: [36],
                                    },
                                    {
                                        kind: "note",
                                        tick: 10,
                                        duration: 10,
                                        label: "g",
                                        midiKeys: [43],
                                    },
                                ],
                            },
                        ],
                    },
                ],
            },
        });
        minecraftMockControl.emitStartup();
        const command =
            minecraftMockControl.getCustomCommand("demo_pack:audio")!;
        const player = new Player({ id: "player" });

        expect(
            command.callback({ sourceEntity: player }, "reward.success"),
        ).toMatchObject({
            status: CustomCommandStatus.Success,
        });

        minecraftMockControl.advance(1);

        const actionBar = latestActionBarMessage(player);
        expect(actionBar).toContain("\n@lead:");
        expect(actionBar).toContain("\n@bass:");
        expect(audioGrid(actionBar, "lead")).toMatch(/^cre__/u);
        expect(audioGrid(actionBar, "bass")).toMatch(/^c_g_/u);
    });

    it("plays a loaded cue through the explicit play action", () => {
        Audio.load({
            v: 1,
            s: ["note.bell"],
            c: [
                ["reward.success", 120, [0, 0, 0, 0], [[0, 0, 67, 50, 100, 0]]],
            ],
        });
        installAudioPlayerCommand({ commandNamespace: "demo_pack" });
        minecraftMockControl.emitStartup();
        const command =
            minecraftMockControl.getCustomCommand("demo_pack:audio")!;
        const player = new Player({ id: "player" });

        expect(
            command.callback(
                { sourceEntity: player },
                "play",
                "reward.success",
            ),
        ).toMatchObject({
            status: CustomCommandStatus.Success,
        });
        expect(player.playedSounds).toEqual([]);

        minecraftMockControl.advance(1);

        expect(player.playedSounds.map((sound) => sound.soundId)).toEqual([
            "note.bell",
        ]);
    });

    it("logs unexpected deferred playback errors through the explicit logger", () => {
        Audio.load({
            v: 1,
            s: ["note.harp"],
            c: [
                ["reward.success", 120, [0, 0, 0, 0], [[0, 0, 60, 80, 100, 0]]],
            ],
        });
        const logger = { error: vi.fn() };
        installAudioPlayerCommand({
            commandNamespace: "demo_pack",
            logger,
        });
        minecraftMockControl.emitStartup();
        const command =
            minecraftMockControl.getCustomCommand("demo_pack:audio")!;
        const player = new Player({ id: "player" });
        const error = new Error("sound failed");
        vi.spyOn(player, "playSound").mockImplementation(() => {
            throw error;
        });

        expect(
            command.callback({ sourceEntity: player }, "reward.success"),
        ).toEqual({
            status: CustomCommandStatus.Success,
            message: 'Playing BAUD cue "reward.success".',
        });

        minecraftMockControl.advance(1);

        expect(logger.error).toHaveBeenCalledWith(
            '[Bebe audio] Failed to play BAUD cue "reward.success".',
            error,
        );
    });

    it("compiles semicolon-separated BAUD text and plays it without replacing loaded cues", () => {
        Audio.load({
            v: 1,
            s: ["note.bass"],
            c: [["loaded", 120, [0, 0, 0, 0], [[0, 0, 48, 80, 100, 0]]]],
        });
        installAudioPlayerCommand({ commandNamespace: "demo_pack" });
        minecraftMockControl.emitStartup();
        const command =
            minecraftMockControl.getCustomCommand("demo_pack:audio")!;
        const player = new Player({ id: "player" });

        expect(
            command.callback(
                { sourceEntity: player },
                "text",
                "cue preview t120; @lead note.harp o4 l4 v80; c e",
            ),
        ).toEqual({
            status: CustomCommandStatus.Success,
            message: 'Playing BAUD text cue "preview".',
        });
        expect(Audio.cues().map((cue) => cue[0])).toEqual(["loaded"]);
        expect(player.playedSounds).toEqual([]);

        minecraftMockControl.advance(1);

        expect(Audio.cues().map((cue) => cue[0])).toEqual(["loaded"]);
        expect(player.playedSounds.map((sound) => sound.soundId)).toEqual([
            "note.harp",
        ]);
    });

    it("shows a coloured actionbar visualisation for BAUD command text after the restricted command callback", () => {
        installAudioPlayerCommand({ commandNamespace: "demo_pack" });
        minecraftMockControl.emitStartup();
        const command =
            minecraftMockControl.getCustomCommand("demo_pack:audio")!;
        const player = new Player({ id: "player" });

        expect(
            command.callback(
                { sourceEntity: player },
                "text",
                "cue preview t120; @lead note.harp o4 l4 v80; c e g > c",
            ),
        ).toEqual({
            status: CustomCommandStatus.Success,
            message: 'Playing BAUD text cue "preview".',
        });
        expect(actionBarMessages(player)).toEqual([]);

        minecraftMockControl.advance(1);

        const latest = latestActionBarMessage(player);
        expect(latest).toContain("BAUD preview");
        expect(latest).toContain("\n@lead:");
        expect(latest).toContain("§f§lc");
        expect(latest).toContain("§ee");
        expect(latest).toContain("§bg");
        expect(player.playedSounds.map((sound) => sound.soundId)).toEqual([
            "note.harp",
        ]);
    });

    it("uses a shared timeline grid for rests, durations, voices, and layered output", () => {
        installAudioPlayerCommand({ commandNamespace: "demo_pack" });
        minecraftMockControl.emitStartup();
        const command =
            minecraftMockControl.getCustomCommand("demo_pack:audio")!;
        const player = new Player({ id: "player" });

        command.callback(
            { sourceEntity: player },
            "text",
            [
                "cue preview t120",
                "@lead note.harp o4 l8 v80",
                "c r e4.",
                "@bass note.bass o2 l4 v60",
                "c g",
            ].join("; "),
        );

        minecraftMockControl.advance(1);

        const first = latestActionBarMessage(player);
        expect(first).toContain("\n@lead:");
        expect(first).toContain("\n@bass:");
        expect(audioGrid(first, "lead")).toMatch(/^cre__/u);
        expect(audioGrid(first, "bass")).toMatch(/^c_g_/u);

        minecraftMockControl.advance(6);

        const later = latestActionBarMessage(player);
        expect(later).toContain("§f§lr");
        expect(audioGrid(later, "lead")).toMatch(/^cre__/u);
        expect(audioGrid(later, "bass")).toMatch(/^c_g_/u);
    });

    it("uses white only for active cells in the source-aware actionbar grid", () => {
        const visual = compileAudioTextWithVisuals(
            ["cue preview t120", "@lead note.harp o4 l8 v80", "c e g"].join(
                "\n",
            ),
            { source: "audio/command.baud" },
        ).visual.cues[0]!;

        const first = formatAudioActionBar(visual, 0);
        expect(first).toContain("§f§lc");
        expect(first).toContain("§ee");
        expect(first).toContain("§bg");
        expect(
            formattingCodesForGridCharacter(first, "lead", "e"),
        ).not.toContain("§f");
        expect(
            formattingCodesForGridCharacter(first, "lead", "g"),
        ).not.toContain("§f");

        const second = formatAudioActionBar(visual, 5);
        expect(second).toContain("§f§le");
        expect(
            formattingCodesForGridCharacter(second, "lead", "c"),
        ).not.toContain("§f");
        expect(
            formattingCodesForGridCharacter(second, "lead", "g"),
        ).not.toContain("§f");
    });

    it("can grey past notes in the source-aware actionbar grid", () => {
        const visual = compileAudioTextWithVisuals(
            ["cue preview t120", "@lead note.harp o4 l8 v80", "c e g"].join(
                "\n",
            ),
            { source: "audio/command.baud" },
        ).visual.cues[0]!;

        const actionBar = formatAudioActionBar(visual, 5, {
            greyPastNotes: true,
        });

        expect(formattingCodesForGridCharacter(actionBar, "lead", "c")).toEqual(
            ["§8"],
        );
        expect(actionBar).toContain("§f§le");
        expect(formattingCodesForGridCharacter(actionBar, "lead", "g")).toEqual(
            ["§b"],
        );
    });

    it("uses white for the active rest and empty source-aware grid cells", () => {
        const restVisual = compileAudioTextWithVisuals(
            ["cue preview t120", "@lead note.harp o4 l8 v80", "c r e"].join(
                "\n",
            ),
            { source: "audio/command.baud" },
        ).visual.cues[0]!;

        expect(
            formattingCodesForGridCharacter(
                formatAudioActionBar(restVisual, 0),
                "lead",
                "r",
            ),
        ).toEqual(["§7"]);
        expect(
            formattingCodesForGridCharacter(
                formatAudioActionBar(restVisual, 5),
                "lead",
                "r",
            ),
        ).toEqual(["§f", "§l"]);

        const emptyVisual = {
            id: "debug",
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
                            midiKeys: [60],
                        },
                        {
                            kind: "note",
                            tick: 10,
                            duration: 5,
                            label: "e",
                            midiKeys: [64],
                        },
                    ],
                },
            ],
        } as const;

        expect(
            formattingCodesForGridCharacter(
                formatAudioActionBar(emptyVisual, 0),
                "lead",
                "_",
            ),
        ).toEqual(["§7"]);
        expect(
            formattingCodesForGridCharacter(
                formatAudioActionBar(emptyVisual, 5),
                "lead",
                "_",
            ),
        ).toEqual(["§f", "§l"]);
    });

    it("applies cell colour to pitchless source-aware grid characters", () => {
        const visual = {
            id: "debug",
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
                            label: "?",
                        },
                        {
                            kind: "chord",
                            tick: 5,
                            duration: 5,
                            label: "[]",
                        },
                    ],
                },
            ],
        } as const;

        const first = formatAudioActionBar(visual, 0);
        expect(first).toContain("§f§l?");
        expect(formattingCodesForGridCharacter(first, "lead", "+")).toContain(
            "§7",
        );
        expect(
            formattingCodesForGridCharacter(first, "lead", "+"),
        ).not.toContain("§f");

        const second = formatAudioActionBar(visual, 5);
        expect(formattingCodesForGridCharacter(second, "lead", "?")).toContain(
            "§7",
        );
        expect(
            formattingCodesForGridCharacter(second, "lead", "?"),
        ).not.toContain("§f");
        expect(second).toContain("§f§l+");
    });

    it("uses white only for the active note in the compact compiled actionbar view", () => {
        const cue = [
            "preview",
            120,
            [0, 0, 0, 0],
            [
                [0, 0, 60, 80, 100, 0],
                [5, 0, 64, 80, 100, 0],
                [10, 0, 67, 80, 100, 0],
            ],
        ] as const;

        const first = formatAudioActionBar(cue, 0);
        expect(first).toContain("§f§lC");
        expect(first).toContain("§eE");
        expect(first).toContain("§bG");
        expect(formattingCodesBeforePlainCharacter(first, "E")).not.toContain(
            "§f",
        );
        expect(formattingCodesBeforePlainCharacter(first, "G")).not.toContain(
            "§f",
        );

        const second = formatAudioActionBar(cue, 5);
        expect(second).toContain("§f§lE");
        expect(formattingCodesBeforePlainCharacter(second, "C")).not.toContain(
            "§f",
        );
        expect(formattingCodesBeforePlainCharacter(second, "G")).not.toContain(
            "§f",
        );
    });

    it("can grey past notes in the compact compiled actionbar view", () => {
        const cue = [
            "preview",
            120,
            [0, 0, 0, 0],
            [
                [0, 0, 60, 80, 100, 0],
                [5, 0, 64, 80, 100, 0],
                [10, 0, 67, 80, 100, 0],
            ],
        ] as const;

        const actionBar = formatAudioActionBar(cue, 5, {
            greyPastNotes: true,
        });

        expect(formattingCodesBeforePlainCharacter(actionBar, "C")).toEqual([
            "§8",
        ]);
        expect(actionBar).toContain("§f§lE");
        expect(formattingCodesBeforePlainCharacter(actionBar, "G")).toEqual([
            "§b",
        ]);
    });

    it("aligns mixed note lengths and chords on one shared actionbar grid", () => {
        const visual = compileAudioTextWithVisuals(
            [
                "cue lol t60",
                "@lead note.harp o4 l8 v100",
                "c d e f a b c d e f a b",
                "@bass note.bass o4 l16 v60",
                "c [d c] r r r r r r r r c c r r r c r r c c",
            ].join("\n"),
            { source: "audio/command.baud" },
        ).visual.cues[0]!;

        const actionBar = formatAudioActionBar(visual, 0);
        const leadGrid = audioGrid(actionBar, "lead");
        const bassGrid = audioGrid(actionBar, "bass");

        expect(leadGrid).toBe("c_d_e_f_a_b_c_d_e_f_a_b_");
        expect(bassGrid).toBe("cDrrrrrrrrccrrrcrrcc____");
        expect(leadGrid).toHaveLength(bassGrid.length);
        expect(bassGrid).not.toContain("[");
    });

    it("shows notes that start between rounded timeline grid ticks", () => {
        const visual = compileAudioTextWithVisuals(
            [
                "cue hero.arrival t96",
                "@lead note.harp o4 l8 v90",
                "c e g > c b g e c d f a > d c a f d",
                "@bass note.bass o2 l4 v75",
                "c g c r f c f r",
            ].join("\n"),
            { source: "audio/command.baud" },
        ).visual.cues[0]!;

        const actionBar = formatAudioActionBar(visual, 40);

        expect(audioGrid(actionBar, "bass")).toBe("c_g_c_r_f_c__f_r__");
    });

    it("pads the current actionbar progress to the total duration width", () => {
        const visual = compileAudioTextWithVisuals(
            [
                "cue hero.arrival t96",
                "@lead note.harp o4 l8 v90",
                "c e g > c b g e c d f a > d c a f d",
                "@bass note.bass o2 l4 v75",
                "c g c r f c f r",
            ].join("\n"),
            { source: "audio/command.baud" },
        ).visual.cues[0]!;

        expect(audioHeader(formatAudioActionBar(visual, 9))).toContain(
            "009/104",
        );
        expect(audioHeader(formatAudioActionBar(visual, 40))).toContain(
            "040/104",
        );
        expect(audioHeader(formatAudioActionBar(visual, 100))).toContain(
            "100/104",
        );
    });

    it("shows the current beat in the actionbar title", () => {
        const visual = compileAudioTextWithVisuals(
            [
                "cue hero.arrival t120",
                "@lead note.harp o4 l8 v90",
                "c e g > c",
            ].join("\n"),
            { source: "audio/command.baud" },
        ).visual.cues[0]!;

        expect(audioHeader(formatAudioActionBar(visual, 0))).toContain("b001");
        expect(audioHeader(formatAudioActionBar(visual, 10))).toContain("b002");
    });

    it("pads inline BAUD actionbar layers for Minecraft's centred proportional font", () => {
        const actionBar = formatAudioActionBar(
            {
                id: "preview",
                tempo: 120,
                voices: [
                    {
                        id: "i",
                        soundId: "note.harp",
                        tokens: [
                            {
                                kind: "note",
                                tick: 0,
                                duration: 5,
                                label: "c",
                                midiKeys: [60],
                            },
                            {
                                kind: "note",
                                tick: 5,
                                duration: 5,
                                label: "d",
                                midiKeys: [62],
                            },
                            {
                                kind: "note",
                                tick: 10,
                                duration: 5,
                                label: "e",
                                midiKeys: [64],
                            },
                        ],
                    },
                    {
                        id: "countermelody",
                        soundId: "note.bass",
                        tokens: [
                            {
                                kind: "rest",
                                tick: 0,
                                duration: 5,
                                label: "r",
                            },
                            {
                                kind: "note",
                                tick: 5,
                                duration: 5,
                                label: "c3",
                                midiKeys: [48],
                            },
                            {
                                kind: "rest",
                                tick: 10,
                                duration: 5,
                                label: "r",
                            },
                        ],
                    },
                ],
            },
            6,
        );

        const lines = actionBar.split("\n");
        expect(lines).toHaveLength(3);
        expect(stripMinecraftFormatting(lines[1]).trimStart()).toContain("@i:");
        expect(stripMinecraftFormatting(lines[2]).trimStart()).toContain(
            "@countermelody:",
        );

        const tokenColumnWidths = lines.slice(1).map(audioActionBarPrefixWidth);
        expect(maxSpread(tokenColumnWidths)).toBeLessThanOrEqual(
            MINECRAFT_SPACE_WIDTH,
        );

        const lineWidths = lines.map(minecraftTextWidth);
        expect(maxSpread(lineWidths)).toBeLessThanOrEqual(
            MINECRAFT_SPACE_WIDTH,
        );
    });

    it("updates the BAUD command text visualisation while playback advances", () => {
        installAudioPlayerCommand({ commandNamespace: "demo_pack" });
        minecraftMockControl.emitStartup();
        const command =
            minecraftMockControl.getCustomCommand("demo_pack:audio")!;
        const player = new Player({ id: "player" });

        command.callback(
            { sourceEntity: player },
            "text",
            "cue preview t120; @lead note.harp o4 l8 v80; c e g > c",
        );

        minecraftMockControl.advance(1);
        const first = latestActionBarMessage(player);
        minecraftMockControl.advance(6);
        const later = latestActionBarMessage(player);

        expect(actionBarMessages(player).length).toBeGreaterThan(1);
        expect(first).not.toBe(later);
        expect(later).toContain("§f§le");
    });

    it("accepts literal newline escapes in BAUD command text", () => {
        installAudioPlayerCommand({ commandNamespace: "demo_pack" });
        minecraftMockControl.emitStartup();
        const command =
            minecraftMockControl.getCustomCommand("demo_pack:audio")!;
        const player = new Player({ id: "player" });

        expect(
            command.callback(
                { sourceEntity: player },
                "text",
                String.raw`cue preview t120\n@lead note.bell o4 l4 v80\nc`,
            ),
        ).toMatchObject({
            status: CustomCommandStatus.Success,
            message: 'Playing BAUD text cue "preview".',
        });

        minecraftMockControl.advance(1);

        expect(player.playedSounds.map((sound) => sound.soundId)).toEqual([
            "note.bell",
        ]);
    });

    it("fails BAUD text command compilation errors without logging", () => {
        const logger = { error: vi.fn() };
        installAudioPlayerCommand({ commandNamespace: "demo_pack", logger });
        minecraftMockControl.emitStartup();
        const command =
            minecraftMockControl.getCustomCommand("demo_pack:audio")!;
        const player = new Player({ id: "player" });

        expect(
            command.callback({ sourceEntity: player }, "text", "c e"),
        ).toEqual({
            status: CustomCommandStatus.Failure,
            message:
                "audio/__command__.baud:1: BAUD content must start with a cue.",
        });

        minecraftMockControl.advance(1);

        expect(logger.error).not.toHaveBeenCalled();
        expect(player.playedSounds).toEqual([]);
    });

    it("requires BAUD command text to declare exactly one cue", () => {
        installAudioPlayerCommand({ commandNamespace: "demo_pack" });
        minecraftMockControl.emitStartup();
        const command =
            minecraftMockControl.getCustomCommand("demo_pack:audio")!;

        expect(
            command.callback(
                { sourceEntity: new Player({ id: "player" }) },
                "text",
                [
                    "cue first t120",
                    "@lead note.harp o4 l4 v80",
                    "c",
                    "cue second t120",
                    "@lead note.harp o4 l4 v80",
                    "e",
                ].join("; "),
            ),
        ).toEqual({
            status: CustomCommandStatus.Failure,
            message: "BAUD text commands must declare exactly one cue.",
        });
    });

    it("fails clearly for non-player origins and unknown cues", () => {
        installAudioPlayerCommand({ commandNamespace: "demo_pack" });
        minecraftMockControl.emitStartup();
        const command =
            minecraftMockControl.getCustomCommand("demo_pack:audio")!;

        expect(command.callback({}, "reward.success")).toEqual({
            status: CustomCommandStatus.Failure,
            message: "Bebe audio commands must be run by a player.",
        });
        expect(
            command.callback(
                { sourceEntity: new Player({ id: "player" }) },
                "missing",
            ),
        ).toEqual({
            status: CustomCommandStatus.Failure,
            message: 'Unknown audio cue "missing".',
        });
    });
});

function actionBarMessages(player: Player): readonly string[] {
    return (
        (
            player as Player & {
                readonly actionBarMessages?: readonly string[];
            }
        ).actionBarMessages ?? []
    );
}

function latestActionBarMessage(player: Player): string {
    const latest = actionBarMessages(player).at(-1);
    expect(latest).toBeDefined();
    return latest!;
}

async function flushPromises(): Promise<void> {
    await Promise.resolve();
    await Promise.resolve();
}

function audioHeader(actionBar: string): string {
    return stripMinecraftFormatting(actionBar.split("\n")[0] ?? "").trim();
}

function audioGrid(actionBar: string, voiceId: string): string {
    const prefix = `@${voiceId}:`;
    const line = actionBar
        .split("\n")
        .map((entry) => stripMinecraftFormatting(entry))
        .find((entry) => entry.trimStart().startsWith(prefix));
    expect(line).toBeDefined();
    return line!.slice(line!.indexOf(":") + 1).replace(/\s+/gu, "");
}

function formattingCodesForGridCharacter(
    actionBar: string,
    voiceId: string,
    character: string,
): string[] {
    const prefix = `@${voiceId}:`;
    const line = actionBar
        .split("\n")
        .find((entry) =>
            stripMinecraftFormatting(entry).trimStart().startsWith(prefix),
        );
    expect(line).toBeDefined();

    return formattingCodesBeforePlainCharacter(
        line!.slice(line!.indexOf(":") + 1),
        character,
    );
}

function formattingCodesBeforePlainCharacter(
    text: string,
    character: string,
): string[] {
    let activeCodes: string[] = [];
    for (let index = 0; index < text.length; index += 1) {
        const current = text[index]!;
        if (current === "§") {
            const code = text.slice(index, index + 2);
            if (code === "§r") {
                activeCodes = [];
            } else {
                activeCodes.push(code);
            }
            index += 1;
            continue;
        }

        if (current === character) {
            return activeCodes;
        }
    }

    throw new Error(`Character ${JSON.stringify(character)} was not rendered.`);
}

const MINECRAFT_SPACE_WIDTH = 4;
const MINECRAFT_DEFAULT_GLYPH_WIDTH = 6;
const MINECRAFT_FONT_WIDTHS = new Map<string, number>([
    [" ", MINECRAFT_SPACE_WIDTH],
    ["!", 2],
    [".", 2],
    [",", 2],
    [":", 2],
    [";", 2],
    ["|", 2],
    ["'", 2],
    ["`", 3],
    ["i", 2],
    ["l", 3],
    ["I", 4],
    ["t", 4],
    ["f", 5],
    ["@", 7],
    ["[", 4],
    ["]", 4],
    ["(", 4],
    [")", 4],
]);

function audioActionBarPrefixWidth(line: string): number {
    const firstFormattingCode = line.indexOf("§");
    return minecraftTextWidth(
        firstFormattingCode >= 0 ? line.slice(0, firstFormattingCode) : line,
    );
}

function minecraftTextWidth(text: string): number {
    let width = 0;
    let bold = false;
    for (let index = 0; index < text.length; index += 1) {
        const character = text[index]!;
        if (character === "§") {
            const code = text[index + 1]?.toLowerCase();
            if (code === "l") {
                bold = true;
            } else if (code === "r") {
                bold = false;
            }
            index += 1;
            continue;
        }

        const characterWidth =
            MINECRAFT_FONT_WIDTHS.get(character) ??
            MINECRAFT_DEFAULT_GLYPH_WIDTH;
        width += characterWidth + (bold && character !== " " ? 1 : 0);
    }

    return width;
}

function stripMinecraftFormatting(text: string): string {
    return text.replace(/§./gu, "");
}

function maxSpread(values: readonly number[]): number {
    return Math.max(...values) - Math.min(...values);
}
