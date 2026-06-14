import type { AudioCompiledCue } from "../../audio/compiled.js";
import type {
    AudioVisualCue,
    AudioVisualToken,
} from "../../audio/definitions.js";

type AudioActionBarSource = AudioCompiledCue | AudioVisualCue;

type AudioVisualEntry = {
    readonly tick: number;
    readonly label: string;
    readonly kind: "gap" | "note";
};

type PitchClassView = {
    readonly label: string;
    readonly colour: string;
};

type RenderedAudioVisualVoice = {
    readonly prefix: string;
    readonly cells: string[];
};

export type AudioActionBarOptions = {
    readonly greyPastNotes?: boolean;
};

const RESET = "§r";
const BOLD = "§l";
const ACTIVE_CELL_COLOUR = "§f";
const INACTIVE_CELL_COLOUR = "§7";
const PAST_CELL_COLOUR = "§8";
const GAP = `${INACTIVE_CELL_COLOUR}-`;
const EMPTY = `${INACTIVE_CELL_COLOUR}empty`;
const WINDOW_ENTRY_COUNT = 24;
const GRID_CELL_COUNT = 24;
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
const PITCH_CLASSES: readonly PitchClassView[] = [
    { label: "C", colour: "§c" },
    { label: "C#", colour: "§c" },
    { label: "D", colour: "§6" },
    { label: "D#", colour: "§6" },
    { label: "E", colour: "§e" },
    { label: "F", colour: "§a" },
    { label: "F#", colour: "§a" },
    { label: "G", colour: "§b" },
    { label: "G#", colour: "§b" },
    { label: "A", colour: "§9" },
    { label: "A#", colour: "§9" },
    { label: "B", colour: "§d" },
];

export function formatAudioActionBar(
    cue: AudioActionBarSource,
    currentTick: number,
    options: AudioActionBarOptions = {},
): string {
    if (isAudioVisualCue(cue)) {
        return formatVisualAudioActionBar(cue, currentTick, options);
    }

    const entries = createAudioVisualEntries(cue);
    const endTick = audioVisualizationDurationTicks(cue);
    const tick = Math.max(0, Math.round(currentTick));
    if (entries.length === 0) {
        return `BAUD ${cue[0]} ${formatAudioProgress(tick, 0)} ${EMPTY}${RESET}`;
    }

    const currentIndex = currentAudioVisualEntryIndex(entries, tick);
    const start = Math.max(
        0,
        Math.min(
            currentIndex - 8,
            Math.max(0, entries.length - WINDOW_ENTRY_COUNT),
        ),
    );
    const window = entries.slice(start, start + WINDOW_ENTRY_COUNT);
    const tokens = window.map((entry, index) =>
        formatAudioVisualEntry(entry, {
            current: start + index === currentIndex,
            past: start + index < currentIndex,
            greyPastNotes: options.greyPastNotes === true,
        }),
    );

    return `BAUD ${cue[0]} ${formatAudioProgress(tick, endTick)} ${tokens.join(" ")}`;
}

export function audioVisualizationDurationTicks(
    cue: AudioActionBarSource,
): number {
    if (isAudioVisualCue(cue)) {
        return cue.voices.reduce(
            (lastTick, voice) =>
                voice.tokens.reduce(
                    (voiceLastTick, token) =>
                        Math.max(voiceLastTick, token.tick + token.duration),
                    lastTick,
                ),
            0,
        );
    }

    return cue[3].reduce((lastTick, note) => Math.max(lastTick, note[0]), 0);
}

function formatVisualAudioActionBar(
    cue: AudioVisualCue,
    currentTick: number,
    options: AudioActionBarOptions,
): string {
    const endTick = audioVisualizationDurationTicks(cue);
    const tick = Math.max(0, Math.round(currentTick));
    const gridStep = audioVisualGridStep(cue);
    const startTick = audioVisualGridStartTick(tick, endTick, gridStep);
    const cellCount = audioVisualGridCellCount(startTick, endTick, gridStep);
    const voices = cue.voices
        .map((voice) => {
            const tokens = voice.tokens;
            if (tokens.length === 0) {
                return undefined;
            }

            const cells = Array.from({ length: cellCount }, (_, index) =>
                formatAudioTimelineCell(tokens, {
                    cellTick: startTick + index * gridStep,
                    current:
                        tick >= startTick + index * gridStep &&
                        tick < startTick + (index + 1) * gridStep,
                    greyPastNotes: options.greyPastNotes === true,
                    gridStep,
                    past: startTick + (index + 1) * gridStep <= tick,
                }),
            );

            return {
                prefix: `@${voice.id}: `,
                cells,
            };
        })
        .filter(
            (voice): voice is RenderedAudioVisualVoice => voice !== undefined,
        );

    if (voices.length === 0) {
        return `BAUD ${cue.id} ${formatAudioProgress(tick, 0)} ${EMPTY}${RESET}`;
    }

    return balanceAudioActionBarLines([
        `BAUD ${cue.id} ${formatAudioProgress(tick, endTick)}`,
        ...formatAudioVisualVoiceLines(voices),
    ]).join("\n");
}

function createAudioVisualEntries(cue: AudioCompiledCue): AudioVisualEntry[] {
    const groups = new Map<number, string[]>();
    for (const note of cue[3]) {
        let group = groups.get(note[0]);
        if (!group) {
            group = [];
            groups.set(note[0], group);
        }
        group.push(formatPitchClass(note[2]));
    }

    const ticks = [...groups.keys()].sort((left, right) => left - right);
    const entries: AudioVisualEntry[] = [];
    let previousTick: number | undefined;
    for (const tick of ticks) {
        if (previousTick !== undefined && tick > previousTick + 1) {
            entries.push({ kind: "gap", label: "-", tick: previousTick + 1 });
        }

        entries.push({
            kind: "note",
            label: groups.get(tick)!.join("+"),
            tick,
        });
        previousTick = tick;
    }

    return entries;
}

function currentAudioVisualEntryIndex(
    entries: readonly AudioVisualEntry[],
    currentTick: number,
): number {
    let currentIndex = entries.findIndex((entry) => entry.kind === "note");
    for (let index = 0; index < entries.length; index += 1) {
        const entry = entries[index];
        if (entry.kind !== "note" || entry.tick > currentTick) {
            continue;
        }
        currentIndex = index;
    }

    return Math.max(0, currentIndex);
}

function formatAudioVisualEntry(
    entry: AudioVisualEntry,
    options: {
        readonly current: boolean;
        readonly greyPastNotes: boolean;
        readonly past: boolean;
    },
) {
    if (entry.kind === "gap") {
        const colour =
            options.greyPastNotes && options.past
                ? PAST_CELL_COLOUR
                : INACTIVE_CELL_COLOUR;
        return `${colour}-${RESET}`;
    }
    if (options.current) {
        return `${ACTIVE_CELL_COLOUR}${BOLD}${stripMinecraftFormatting(entry.label)}${RESET}`;
    }
    if (options.greyPastNotes && options.past) {
        return `${PAST_CELL_COLOUR}${stripMinecraftFormatting(entry.label)}${RESET}`;
    }

    return entry.label;
}

function formatPitchClass(midiKey: number): string {
    const pitchClass = PITCH_CLASSES[mod(Math.round(midiKey), 12)]!;
    return `${pitchClass.colour}${pitchClass.label}${RESET}`;
}

function formatAudioProgress(currentTick: number, endTick: number): string {
    const clampedTick = Math.min(currentTick, endTick);
    const width = Math.max(1, String(endTick).length);
    return `${String(clampedTick).padStart(width, "0")}/${endTick}`;
}

function audioVisualGridStep(cue: AudioVisualCue): number {
    const durations = cue.voices.flatMap((voice) =>
        voice.tokens
            .filter((token) => token.kind !== "bar" && token.duration > 0)
            .map((token) => token.duration),
    );

    return durations.length === 0 ? 1 : Math.max(1, Math.min(...durations));
}

function audioVisualGridStartTick(
    currentTick: number,
    endTick: number,
    gridStep: number,
): number {
    const totalColumns = Math.max(1, Math.ceil(endTick / gridStep));
    const currentColumn = Math.max(
        0,
        Math.min(totalColumns - 1, Math.floor(currentTick / gridStep)),
    );
    const leadInColumns = Math.min(4, Math.floor(GRID_CELL_COUNT / 3));
    const startColumn = Math.max(
        0,
        Math.min(
            currentColumn - leadInColumns,
            Math.max(0, totalColumns - GRID_CELL_COUNT),
        ),
    );

    return startColumn * gridStep;
}

function audioVisualGridCellCount(
    startTick: number,
    endTick: number,
    gridStep: number,
): number {
    return Math.max(
        1,
        Math.min(GRID_CELL_COUNT, Math.ceil((endTick - startTick) / gridStep)),
    );
}

function formatAudioTimelineCell(
    tokens: readonly AudioVisualToken[],
    options: {
        readonly cellTick: number;
        readonly current: boolean;
        readonly greyPastNotes: boolean;
        readonly gridStep: number;
        readonly past: boolean;
    },
): string {
    const token = audioVisualTokenStartingInCell(
        tokens,
        options.cellTick,
        options.gridStep,
    );
    if (!token) {
        return formatAudioTimelineFiller(options);
    }

    if (token.kind === "rest") {
        return formatAudioTimelineCellText(
            "r",
            audioTimelineInactiveCellColour(options),
            options.current,
        );
    }

    const midiKey = token.midiKeys?.[0];
    const colour = options.current
        ? ACTIVE_CELL_COLOUR
        : options.greyPastNotes && options.past
          ? PAST_CELL_COLOUR
          : midiKey === undefined
            ? INACTIVE_CELL_COLOUR
            : PITCH_CLASSES[mod(Math.round(midiKey), 12)]!.colour;
    const label =
        token.kind === "chord"
            ? compactAudioChordLabel(token.label)
            : compactAudioNoteLabel(token.label);
    const safeLabel = label.length === 0 ? "_" : label;
    return formatAudioTimelineCellText(safeLabel, colour, options.current);
}

function audioVisualTokenStartingInCell(
    tokens: readonly AudioVisualToken[],
    cellTick: number,
    gridStep: number,
): AudioVisualToken | undefined {
    return tokens.find(
        (token) =>
            token.kind !== "bar" &&
            token.tick >= cellTick &&
            token.tick < cellTick + gridStep,
    );
}

function formatAudioTimelineFiller(options: {
    readonly current: boolean;
    readonly greyPastNotes: boolean;
    readonly past: boolean;
}): string {
    return formatAudioTimelineCellText(
        "_",
        audioTimelineInactiveCellColour(options),
        options.current,
    );
}

function audioTimelineInactiveCellColour(options: {
    readonly current: boolean;
    readonly greyPastNotes: boolean;
    readonly past: boolean;
}): string {
    if (options.current) {
        return ACTIVE_CELL_COLOUR;
    }

    return options.greyPastNotes && options.past
        ? PAST_CELL_COLOUR
        : INACTIVE_CELL_COLOUR;
}

function formatAudioTimelineCellText(
    label: string,
    colour: string,
    current: boolean,
): string {
    return `${colour}${current ? BOLD : ""}${label}${RESET}`;
}

function compactAudioNoteLabel(label: string): string {
    return /^[a-g]/iu.test(label) ? label[0]!.toLowerCase() : label.slice(0, 1);
}

function compactAudioChordLabel(label: string): string {
    const chordBody = /^\[([^\]]+)\]/u.exec(label)?.[1] ?? label;
    const firstNote = /[a-g]/iu.exec(chordBody)?.[0];
    return firstNote?.toUpperCase() ?? "+";
}

function formatAudioVisualVoiceLines(
    voices: readonly RenderedAudioVisualVoice[],
): string[] {
    const prefixWidth = Math.max(
        ...voices.map((voice) => minecraftTextWidth(voice.prefix)),
    );
    return voices.map(
        (voice) =>
            `${padMinecraftTextRight(voice.prefix, prefixWidth)}${voice.cells.join("")}`,
    );
}

function balanceAudioActionBarLines(lines: readonly string[]): string[] {
    const lineWidth = Math.max(
        ...lines.map((line) => minecraftTextWidth(line)),
    );
    return lines.map((line) => padMinecraftTextRight(line, lineWidth));
}

function padMinecraftTextRight(text: string, targetWidth: number): string {
    let padded = text;
    let width = minecraftTextWidth(padded);
    while (width < targetWidth) {
        padded += " ";
        width += MINECRAFT_SPACE_WIDTH;
    }

    return padded;
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
            } else if (code === "r" || /^[0-9a-f]$/u.test(code ?? "")) {
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

function mod(value: number, divisor: number): number {
    return ((value % divisor) + divisor) % divisor;
}

function stripMinecraftFormatting(text: string): string {
    return text.replace(/§./gu, "");
}

function isAudioVisualCue(cue: AudioActionBarSource): cue is AudioVisualCue {
    return !Array.isArray(cue);
}
