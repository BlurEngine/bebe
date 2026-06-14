import {
    AUDIO_COMPILED_FORMAT_VERSION,
    normalizeAudioCompiledPack,
    type AudioCompiledLoop,
    type AudioCompiledNote,
    type AudioCompiledPack,
} from "./compiled.js";

export const PROJECT_AUDIO_DIRECTORY = "audio";
export const GENERATED_AUDIO_FILE = "generated/bebe/audio.json";
export const GENERATED_AUDIO_VISUALS_FILE = "generated/bebe/audio.visuals.json";
export const BAUD_FILE_EXTENSION = ".baud";
export const DEFAULT_AUDIO_TEMPO = 120;
export const DEFAULT_AUDIO_OCTAVE = 4;
export const DEFAULT_AUDIO_LENGTH = 4;
export const DEFAULT_AUDIO_VOLUME = 80;
export const DEFAULT_AUDIO_PAN = 100;
export const DEFAULT_AUDIO_CENTS = 0;

export type AudioSourceFile = {
    readonly relativePath: string;
    readonly absolutePath: string;
    readonly text: string;
};

export type CompileAudioTextOptions = {
    readonly source?: string;
};

export type AudioVisualTokenKind = "bar" | "chord" | "note" | "rest";

export type AudioVisualToken = {
    readonly kind: AudioVisualTokenKind;
    readonly tick: number;
    readonly duration: number;
    readonly label: string;
    readonly resolvedLabel?: string;
    readonly midiKeys?: readonly number[];
};

export type AudioVisualVoice = {
    readonly id: string;
    readonly soundId: string;
    readonly tokens: readonly AudioVisualToken[];
};

export type AudioVisualCue = {
    readonly id: string;
    readonly tempo: number;
    readonly voices: readonly AudioVisualVoice[];
};

export type AudioVisualPack = {
    readonly cues: readonly AudioVisualCue[];
};

export type AudioTextCompilationWithVisuals = {
    readonly pack: AudioCompiledPack;
    readonly visual: AudioVisualPack;
};

type ParsedCue = {
    readonly id: string;
    readonly tempo: number;
    readonly loop: AudioCompiledLoop;
    readonly voices: Map<string, VoiceState>;
    readonly notes: ParsedNote[];
};

type VoiceState = {
    readonly id: string;
    readonly order: number;
    soundIndex: number;
    octave: number;
    length: number;
    volume: number;
    pan: number;
    cents: number;
    tick: number;
    visual: MutableAudioVisualVoice;
};

type ParsedNote = {
    readonly note: AudioCompiledNote;
    readonly voiceOrder: number;
    readonly noteOrder: number;
    readonly sequence: number;
};

type DurationSuffix = {
    readonly denominator: number | undefined;
    readonly dotted: boolean;
};

type ParsedPitch = {
    readonly label: string;
    readonly midiKey: number;
};

type MutableAudioVisualVoice = {
    readonly id: string;
    soundId: string;
    readonly tokens: AudioVisualToken[];
};

const DEFAULT_AUDIO_LOOP: AudioCompiledLoop = [0, 0, 0, 0];
const CUE_ID_PATTERN = /^[a-z0-9][a-z0-9._:-]*$/i;
const SIMPLE_TOKEN_DELIMITER = /[\s|[\]<>]/u;
const NOTE_TOKEN_PATTERN = /^([a-g])([#b]?)(\d+)?(\.)?$/i;
const REST_TOKEN_PATTERN = /^r(\d+)?(\.)?$/i;
const SEMITONES: Record<string, number> = {
    c: 0,
    d: 2,
    e: 4,
    f: 5,
    g: 7,
    a: 9,
    b: 11,
};

export function compileAudioText(
    text: string,
    options: CompileAudioTextOptions = {},
): AudioCompiledPack {
    return compileAudioTextCompiler(text, options).toPack();
}

export function compileAudioTextWithVisuals(
    text: string,
    options: CompileAudioTextOptions = {},
): AudioTextCompilationWithVisuals {
    const compiler = compileAudioTextCompiler(text, options);
    return {
        pack: compiler.toPack(),
        visual: compiler.toVisuals(),
    };
}

function compileAudioTextCompiler(
    text: string,
    options: CompileAudioTextOptions,
): BaudCompiler {
    const compiler = new BaudCompiler();
    const source = normalizeSourcePath(
        options.source ?? `${PROJECT_AUDIO_DIRECTORY}/audio.baud`,
    );
    validateAudioSourcePath(source);
    const cues = compiler.parseText(text, source);
    assertUniqueCueIds(cues, source);
    return compiler;
}

export function compileAudioSources(
    sources: readonly AudioSourceFile[],
): AudioCompiledPack {
    return compileAudioSourcesCompiler(sources).toPack();
}

export function compileAudioSourcesWithVisuals(
    sources: readonly AudioSourceFile[],
): AudioTextCompilationWithVisuals {
    const compiler = compileAudioSourcesCompiler(sources);
    return {
        pack: compiler.toPack(),
        visual: compiler.toVisuals(),
    };
}

function compileAudioSourcesCompiler(
    sources: readonly AudioSourceFile[],
): BaudCompiler {
    const compiler = new BaudCompiler();
    const seenCueIds = new Set<string>();
    const normalizedSources = sources
        .map((source) => ({
            ...source,
            relativePath: normalizeSourcePath(source.relativePath),
        }))
        .sort((left, right) =>
            compareCodePointLexically(left.relativePath, right.relativePath),
        );
    if (normalizedSources.length === 0) {
        throw new Error(
            `BAUD source collection must include at least one ${BAUD_FILE_EXTENSION} file under ${PROJECT_AUDIO_DIRECTORY}/.`,
        );
    }

    for (const source of normalizedSources) {
        const relativePath = source.relativePath;
        validateAudioSourcePath(relativePath);
        const cues = compiler.parseText(source.text, relativePath);
        for (const cue of cues) {
            if (seenCueIds.has(cue.id)) {
                throw new Error(
                    `Duplicate cue id "${cue.id}" in ${relativePath}.`,
                );
            }
            seenCueIds.add(cue.id);
        }
    }

    return compiler;
}

function compareCodePointLexically(left: string, right: string): number {
    const leftCodePoints = Array.from(left);
    const rightCodePoints = Array.from(right);
    const length = Math.min(leftCodePoints.length, rightCodePoints.length);
    for (let index = 0; index < length; index += 1) {
        const difference =
            leftCodePoints[index].codePointAt(0)! -
            rightCodePoints[index].codePointAt(0)!;
        if (difference !== 0) {
            return difference;
        }
    }

    return leftCodePoints.length - rightCodePoints.length;
}

class BaudCompiler {
    readonly #soundIds: string[] = [];
    readonly #soundIndexes = new Map<string, number>();
    readonly #cues: ParsedCue[] = [];
    #currentCue: ParsedCue | undefined;
    #currentVoice: VoiceState | undefined;
    #sequence = 0;

    parseText(text: string, source: string): readonly ParsedCue[] {
        const startIndex = this.#cues.length;
        this.#currentCue = undefined;
        this.#currentVoice = undefined;

        const lines = text.split(/\r?\n/u);
        for (let index = 0; index < lines.length; index += 1) {
            this.#parseLine(stripLineComment(lines[index]).trim(), {
                line: index + 1,
                source,
            });
        }

        const cues = this.#cues.slice(startIndex);
        if (cues.length === 0) {
            throw new Error(`${source}:1: BAUD source must declare a cue.`);
        }

        return cues;
    }

    toPack(): AudioCompiledPack {
        return normalizeAudioCompiledPack({
            v: AUDIO_COMPILED_FORMAT_VERSION,
            s: [...this.#soundIds],
            c: this.#cues.map((cue) => [
                cue.id,
                cue.tempo,
                cue.loop,
                [...cue.notes]
                    .sort(compareParsedNotes)
                    .map((note) => note.note),
            ]),
        });
    }

    toVisuals(): AudioVisualPack {
        return {
            cues: this.#cues.map((cue) => ({
                id: cue.id,
                tempo: cue.tempo,
                voices: [...cue.voices.values()]
                    .sort((left, right) => left.order - right.order)
                    .map((voice) => ({
                        id: voice.visual.id,
                        soundId: voice.visual.soundId,
                        tokens: [...voice.visual.tokens],
                    })),
            })),
        };
    }

    #parseLine(
        line: string,
        context: { readonly source: string; readonly line: number },
    ): void {
        if (line.length === 0) {
            return;
        }
        if (line.startsWith("cue ")) {
            this.#startCue(line, context);
            return;
        }
        if (line.startsWith("@")) {
            this.#startVoice(line, context);
            return;
        }

        const cue = this.#expectCurrentCue(context);
        const voice = this.#expectCurrentVoice(context);
        parseAudioTokens(line, context, cue, voice, (note) =>
            this.#addNote(note),
        );
    }

    #startCue(
        line: string,
        context: { readonly source: string; readonly line: number },
    ): void {
        const parts = line.split(/\s+/u);
        if (parts.length !== 3) {
            throw parseError(context, "Cue declarations use: cue <id> t<bpm>.");
        }

        const id = parts[1];
        if (!CUE_ID_PATTERN.test(id)) {
            throw parseError(context, `Invalid cue id "${id}".`);
        }

        const tempo = parsePrefixedPositiveInteger(
            parts[2],
            "t",
            context,
            "tempo",
        );
        const cue: ParsedCue = {
            id,
            tempo,
            loop: DEFAULT_AUDIO_LOOP,
            voices: new Map(),
            notes: [],
        };
        this.#cues.push(cue);
        this.#currentCue = cue;
        this.#currentVoice = undefined;
    }

    #startVoice(
        line: string,
        context: { readonly source: string; readonly line: number },
    ): void {
        const cue = this.#expectCurrentCue(context);
        const parts = line.split(/\s+/u);
        if (parts.length !== 5) {
            throw parseError(
                context,
                "Voice declarations use: @<voice> <sound> o<octave> l<length> v<volume>.",
            );
        }

        const id = parts[0].slice(1);
        if (!CUE_ID_PATTERN.test(id)) {
            throw parseError(context, `Invalid voice id "${id}".`);
        }

        const soundId = parts[1];
        const settings = parseVoiceSettings(parts.slice(2), context);
        if (
            settings.octave === undefined ||
            settings.length === undefined ||
            settings.volume === undefined
        ) {
            throw parseError(
                context,
                "Voice declarations use: @<voice> <sound> o<octave> l<length> v<volume>.",
            );
        }

        const existing = cue.voices.get(id);
        const voice =
            existing ??
            ({
                id,
                order: cue.voices.size,
                soundIndex: this.#soundIndex(soundId),
                octave: settings.octave,
                length: settings.length,
                volume: settings.volume,
                pan: DEFAULT_AUDIO_PAN,
                cents: DEFAULT_AUDIO_CENTS,
                tick: 0,
                visual: {
                    id,
                    soundId,
                    tokens: [],
                },
            } satisfies VoiceState);

        voice.soundIndex = this.#soundIndex(soundId);
        voice.octave = settings.octave;
        voice.length = settings.length;
        voice.volume = settings.volume;
        voice.visual.soundId = soundId;
        cue.voices.set(id, voice);
        this.#currentVoice = voice;
    }

    #expectCurrentCue(context: {
        readonly source: string;
        readonly line: number;
    }): ParsedCue {
        if (!this.#currentCue) {
            throw parseError(context, "BAUD content must start with a cue.");
        }

        return this.#currentCue;
    }

    #expectCurrentVoice(context: {
        readonly source: string;
        readonly line: number;
    }): VoiceState {
        if (!this.#currentVoice) {
            throw parseError(
                context,
                "Audio tokens must follow a voice declaration.",
            );
        }

        return this.#currentVoice;
    }

    #soundIndex(soundId: string): number {
        const existing = this.#soundIndexes.get(soundId);
        if (existing !== undefined) {
            return existing;
        }

        const index = this.#soundIds.length;
        this.#soundIds.push(soundId);
        this.#soundIndexes.set(soundId, index);
        return index;
    }

    #addNote(note: Omit<ParsedNote, "sequence">): void {
        const cue = this.#expectCurrentCue({
            source: "audio",
            line: 1,
        });
        cue.notes.push({
            ...note,
            sequence: this.#sequence,
        });
        this.#sequence += 1;
    }
}

function parseAudioTokens(
    line: string,
    context: { readonly source: string; readonly line: number },
    cue: ParsedCue,
    voice: VoiceState,
    addNote: (note: Omit<ParsedNote, "sequence">) => void,
): void {
    let index = 0;
    while (index < line.length) {
        const current = line[index];
        if (/\s/u.test(current)) {
            index += 1;
            continue;
        }
        if (current === "|") {
            voice.visual.tokens.push({
                kind: "bar",
                tick: voice.tick,
                duration: 0,
                label: "|",
            });
            index += 1;
            continue;
        }
        if (current === ">") {
            voice.octave += 1;
            index += 1;
            continue;
        }
        if (current === "<") {
            voice.octave -= 1;
            index += 1;
            continue;
        }
        if (current === "[") {
            index = parseChord(line, index, context, cue, voice, addNote);
            continue;
        }

        const token = readSimpleToken(line, index);
        parseSimpleAudioToken(token.value, context, cue, voice, addNote);
        index = token.end;
    }
}

function parseChord(
    line: string,
    start: number,
    context: { readonly source: string; readonly line: number },
    cue: ParsedCue,
    voice: VoiceState,
    addNote: (note: Omit<ParsedNote, "sequence">) => void,
): number {
    const end = line.indexOf("]", start + 1);
    if (end < 0) {
        throw parseError(context, "Chord is missing a closing ].");
    }

    const suffix = readDurationSuffix(line, end + 1, context);
    const duration = audioDurationTicks(
        cue.tempo,
        suffix.denominator ?? voice.length,
        suffix.dotted,
        context,
    );
    const chordTick = voice.tick;
    const pitches: ParsedPitch[] = [];
    let noteOrder = 0;

    parseChordTokens(line.slice(start + 1, end), context, voice, (pitch) => {
        addNote({
            note: [
                chordTick,
                voice.soundIndex,
                pitch.midiKey,
                voice.volume,
                voice.pan,
                voice.cents,
            ],
            voiceOrder: voice.order,
            noteOrder,
        });
        pitches.push(pitch);
        noteOrder += 1;
    });

    if (noteOrder === 0) {
        throw parseError(context, "Chord must contain at least one note.");
    }

    voice.visual.tokens.push({
        kind: "chord",
        tick: chordTick,
        duration,
        label: line.slice(start, suffix.end),
        resolvedLabel: `${formatChordLabel(pitches)}/${formatDurationLabel(
            suffix.denominator ?? voice.length,
            suffix.dotted,
        )}`,
        midiKeys: pitches.map((pitch) => pitch.midiKey),
    });
    voice.tick += duration;
    return suffix.end;
}

function parseChordTokens(
    input: string,
    context: { readonly source: string; readonly line: number },
    voice: VoiceState,
    addPitch: (pitch: ParsedPitch) => void,
): void {
    let index = 0;
    while (index < input.length) {
        const current = input[index];
        if (/\s/u.test(current) || current === "|") {
            index += 1;
            continue;
        }
        if (current === ">") {
            voice.octave += 1;
            index += 1;
            continue;
        }
        if (current === "<") {
            voice.octave -= 1;
            index += 1;
            continue;
        }

        const token = readSimpleToken(input, index);
        const pitch = parseNotePitch(token.value, context, voice.octave);
        if (pitch !== undefined) {
            addPitch(pitch);
        } else if (!REST_TOKEN_PATTERN.test(token.value)) {
            throw parseError(context, `Invalid chord token "${token.value}".`);
        }
        index = token.end;
    }
}

function parseSimpleAudioToken(
    token: string,
    context: { readonly source: string; readonly line: number },
    cue: ParsedCue,
    voice: VoiceState,
    addNote: (note: Omit<ParsedNote, "sequence">) => void,
): void {
    const rest = REST_TOKEN_PATTERN.exec(token);
    if (rest) {
        const denominator = durationDenominator(rest[1], voice.length, context);
        const dotted = Boolean(rest[2]);
        const duration = audioDurationTicks(
            cue.tempo,
            denominator,
            dotted,
            context,
        );
        voice.visual.tokens.push({
            kind: "rest",
            tick: voice.tick,
            duration,
            label: token,
            resolvedLabel: `r${formatDurationLabel(denominator, dotted)}`,
        });
        voice.tick += duration;
        return;
    }

    const note = NOTE_TOKEN_PATTERN.exec(token);
    if (!note) {
        throw parseError(context, `Invalid audio token "${token}".`);
    }

    const pitch = createParsedPitch(note[1], note[2], voice.octave);
    const denominator = durationDenominator(note[3], voice.length, context);
    const dotted = Boolean(note[4]);
    const duration = audioDurationTicks(
        cue.tempo,
        denominator,
        dotted,
        context,
    );
    addNote({
        note: [
            voice.tick,
            voice.soundIndex,
            pitch.midiKey,
            voice.volume,
            voice.pan,
            voice.cents,
        ],
        voiceOrder: voice.order,
        noteOrder: 0,
    });
    voice.visual.tokens.push({
        kind: "note",
        tick: voice.tick,
        duration,
        label: token,
        resolvedLabel: `${pitch.label}/${formatDurationLabel(
            denominator,
            dotted,
        )}`,
        midiKeys: [pitch.midiKey],
    });
    voice.tick += duration;
}

function parseNotePitch(
    token: string,
    context: { readonly source: string; readonly line: number },
    octave: number,
): ParsedPitch | undefined {
    const note = NOTE_TOKEN_PATTERN.exec(token);
    if (note) {
        return createParsedPitch(note[1], note[2], octave);
    }
    if (REST_TOKEN_PATTERN.test(token)) {
        return undefined;
    }

    throw parseError(context, `Invalid audio token "${token}".`);
}

function createParsedPitch(
    note: string,
    accidental: string | undefined,
    octave: number,
): ParsedPitch {
    const semitone =
        SEMITONES[note.toLowerCase()] +
        (accidental === "#" ? 1 : accidental?.toLowerCase() === "b" ? -1 : 0);
    return {
        label: `${note.toUpperCase()}${formatAccidental(accidental)}${octave}`,
        midiKey: (octave + 1) * 12 + semitone,
    };
}

function formatAccidental(accidental: string | undefined): string {
    if (accidental === "#") {
        return "#";
    }

    return accidental?.toLowerCase() === "b" ? "b" : "";
}

function formatChordLabel(pitches: readonly ParsedPitch[]): string {
    return `[${pitches.map((pitch) => pitch.label).join("+")}]`;
}

function formatDurationLabel(denominator: number, dotted: boolean): string {
    return `${denominator}${dotted ? "." : ""}`;
}

function readSimpleToken(
    line: string,
    start: number,
): { readonly value: string; readonly end: number } {
    let end = start;
    while (end < line.length && !SIMPLE_TOKEN_DELIMITER.test(line[end])) {
        end += 1;
    }

    return {
        value: line.slice(start, end),
        end,
    };
}

function readDurationSuffix(
    line: string,
    start: number,
    context: { readonly source: string; readonly line: number },
): DurationSuffix & { readonly end: number } {
    let end = start;
    while (end < line.length && /\d/u.test(line[end])) {
        end += 1;
    }

    const denominator =
        end > start
            ? durationDenominator(line.slice(start, end), undefined, context)
            : undefined;
    const dotted = line[end] === ".";
    if (dotted) {
        end += 1;
    }
    if (end < line.length && !/[\s|[\]<>]/u.test(line[end])) {
        throw parseError(context, "Invalid chord duration suffix.");
    }

    return { denominator, dotted, end };
}

function parseVoiceSettings(
    parts: readonly string[],
    context: { readonly source: string; readonly line: number },
): {
    readonly octave?: number;
    readonly length?: number;
    readonly volume?: number;
} {
    let octave: number | undefined;
    let length: number | undefined;
    let volume: number | undefined;

    for (const part of parts) {
        if (part.startsWith("o")) {
            octave = parsePrefixedInteger(part, "o", context, "octave");
        } else if (part.startsWith("l")) {
            length = parsePrefixedPositiveInteger(part, "l", context, "length");
        } else if (part.startsWith("v")) {
            volume = parsePrefixedInteger(part, "v", context, "volume");
            if (volume < 0 || volume > 100) {
                throw parseError(context, "volume must be between 0 and 100.");
            }
        } else {
            throw parseError(context, `Invalid voice setting "${part}".`);
        }
    }

    return { octave, length, volume };
}

function durationDenominator(
    input: string | undefined,
    fallback: number | undefined,
    context: { readonly source: string; readonly line: number },
): number {
    if (input === undefined || input.length === 0) {
        if (fallback === undefined) {
            throw parseError(context, "Duration denominator is required.");
        }
        return fallback;
    }

    const value = Number(input);
    if (!Number.isInteger(value) || value <= 0) {
        throw parseError(context, `Invalid duration denominator "${input}".`);
    }

    return value;
}

function audioDurationTicks(
    tempo: number,
    denominator: number,
    dotted: boolean,
    context: { readonly source: string; readonly line: number },
): number {
    if (denominator <= 0) {
        throw parseError(context, "Duration denominator must be positive.");
    }

    const dotMultiplier = dotted ? 1.5 : 1;
    return Math.max(
        1,
        Math.round(((20 * 60 * 4) / (tempo * denominator)) * dotMultiplier),
    );
}

function parsePrefixedPositiveInteger(
    input: string,
    prefix: string,
    context: { readonly source: string; readonly line: number },
    label: string,
): number {
    const value = parsePrefixedInteger(input, prefix, context, label);
    if (value <= 0) {
        throw parseError(context, `${label} must be positive.`);
    }

    return value;
}

function parsePrefixedInteger(
    input: string,
    prefix: string,
    context: { readonly source: string; readonly line: number },
    label: string,
): number {
    if (!input.startsWith(prefix)) {
        throw parseError(context, `${label} must start with ${prefix}.`);
    }

    const rawValue = input.slice(prefix.length);
    if (!/^-?\d+$/u.test(rawValue)) {
        throw parseError(context, `Invalid ${label} "${input}".`);
    }

    return Number(rawValue);
}

function validateAudioSourcePath(relativePath: string): void {
    const segments = relativePath.split("/");
    if (segments[0] !== PROJECT_AUDIO_DIRECTORY || segments.length < 2) {
        throw new Error(
            `BAUD source ${relativePath} must live under ${PROJECT_AUDIO_DIRECTORY}/.`,
        );
    }
    if (
        segments.some(
            (segment) =>
                segment.length === 0 || segment === "." || segment === "..",
        )
    ) {
        throw new Error(
            `BAUD source ${relativePath} must be a normalized path under ${PROJECT_AUDIO_DIRECTORY}/.`,
        );
    }
    if (!relativePath.endsWith(BAUD_FILE_EXTENSION)) {
        throw new Error(
            `BAUD source ${relativePath} must end with ${BAUD_FILE_EXTENSION}.`,
        );
    }
}

function normalizeSourcePath(input: string): string {
    return input.replace(/\\/gu, "/").replace(/^\.\//u, "");
}

function stripLineComment(line: string): string {
    const commentStart = line.indexOf("//");
    return commentStart >= 0 ? line.slice(0, commentStart) : line;
}

function assertUniqueCueIds(cues: readonly ParsedCue[], source: string): void {
    const seen = new Set<string>();
    for (const cue of cues) {
        if (seen.has(cue.id)) {
            throw new Error(`Duplicate cue id "${cue.id}" in ${source}.`);
        }
        seen.add(cue.id);
    }
}

function compareParsedNotes(left: ParsedNote, right: ParsedNote): number {
    return (
        left.note[0] - right.note[0] ||
        left.voiceOrder - right.voiceOrder ||
        left.noteOrder - right.noteOrder ||
        left.sequence - right.sequence
    );
}

function parseError(
    context: { readonly source: string; readonly line: number },
    message: string,
): Error {
    return new Error(`${context.source}:${context.line}: ${message}`);
}
