export const AUDIO_COMPILED_FORMAT_VERSION = 1;

export type AudioCompiledNote = readonly [
    tick: number,
    soundIndex: number,
    midiKey: number,
    volume: number,
    pan: number,
    cents: number,
];

export type AudioCompiledLoop = readonly [
    startTick: number,
    endTick: number,
    count: number,
    flags: number,
];

export type AudioCompiledCue = readonly [
    id: string,
    tempo: number,
    loop: AudioCompiledLoop,
    notes: readonly AudioCompiledNote[],
];

export type AudioCompiledPack = {
    readonly v: typeof AUDIO_COMPILED_FORMAT_VERSION;
    readonly s: readonly string[];
    readonly c: readonly AudioCompiledCue[];
};

export function normalizeAudioCompiledPack(input: unknown): AudioCompiledPack {
    const source = "audio";
    const record = expectRecord(input, source);
    if (record.v !== AUDIO_COMPILED_FORMAT_VERSION) {
        throw new Error(
            `${source}.v must be ${AUDIO_COMPILED_FORMAT_VERSION}.`,
        );
    }

    const soundIds = normalizeSoundTable(record.s, `${source}.s`);
    const cuesInput = record.c;
    if (!Array.isArray(cuesInput)) {
        throw new Error(`${source}.c must be an array of compiled cues.`);
    }

    const seenCueIds = new Set<string>();
    const cues = cuesInput.map((cue, index) => {
        const normalized = normalizeAudioCompiledCue(
            cue,
            `${source}.c[${index}]`,
            soundIds.length,
        );
        if (seenCueIds.has(normalized[0])) {
            throw new Error(`Duplicate compiled cue id "${normalized[0]}".`);
        }
        seenCueIds.add(normalized[0]);
        return normalized;
    });

    return {
        v: AUDIO_COMPILED_FORMAT_VERSION,
        s: soundIds,
        c: cues,
    };
}

function normalizeSoundTable(
    input: unknown,
    source: string,
): readonly string[] {
    if (!Array.isArray(input)) {
        throw new Error(`${source} must be an array of sound ids.`);
    }

    const seen = new Set<string>();
    return input.map((value, index) => {
        const soundId = expectNonEmptyString(value, `${source}[${index}]`);
        if (seen.has(soundId)) {
            throw new Error(`Duplicate compiled sound id "${soundId}".`);
        }
        seen.add(soundId);
        return soundId;
    });
}

function normalizeAudioCompiledCue(
    input: unknown,
    source: string,
    soundCount: number,
): AudioCompiledCue {
    const tuple = expectTuple(input, 4, source, "compiled cue");
    const id = expectNonEmptyString(tuple[0], `${source}[0]`);
    const tempo = expectRoundedPositiveNumber(tuple[1], `${source}[1]`);
    const loop = normalizeAudioCompiledLoop(tuple[2], `${source}[2]`);
    const notesInput = tuple[3];
    if (!Array.isArray(notesInput)) {
        throw new Error(`${source}[3] must be an array of compiled notes.`);
    }

    return [
        id,
        tempo,
        loop,
        notesInput.map((note, index) =>
            normalizeAudioCompiledNote(
                note,
                `${source}[3][${index}]`,
                soundCount,
            ),
        ),
    ];
}

function normalizeAudioCompiledLoop(
    input: unknown,
    source: string,
): AudioCompiledLoop {
    const tuple = expectTuple(input, 4, source, "compiled loop");
    const loop: AudioCompiledLoop = [
        expectRoundedFiniteNumber(tuple[0], `${source}[0]`),
        expectRoundedFiniteNumber(tuple[1], `${source}[1]`),
        expectRoundedFiniteNumber(tuple[2], `${source}[2]`),
        expectRoundedFiniteNumber(tuple[3], `${source}[3]`),
    ];
    if (loop.every((value) => value === 0)) {
        return loop;
    }

    const startTick = expectNonNegativeInteger(loop[0], `${source}[0]`);
    const endTick = expectNonNegativeInteger(loop[1], `${source}[1]`);
    const count = expectNonNegativeInteger(loop[2], `${source}[2]`);
    const flags = expectNonNegativeInteger(loop[3], `${source}[3]`);
    if (endTick > 0 && endTick < startTick) {
        throw new Error(
            `${source}[1] must be 0 or greater than or equal to ${startTick}.`,
        );
    }

    return [startTick, endTick, count, flags];
}

function normalizeAudioCompiledNote(
    input: unknown,
    source: string,
    soundCount: number,
): AudioCompiledNote {
    const tuple = expectTuple(input, 6, source, "compiled note");
    const soundIndex = expectRoundedFiniteNumber(tuple[1], `${source}[1]`);
    if (
        !Number.isInteger(soundIndex) ||
        soundIndex < 0 ||
        soundIndex >= soundCount
    ) {
        throw new Error(`${source}[1] must reference a sound table index.`);
    }

    return [
        expectNonNegativeInteger(
            expectRoundedFiniteNumber(tuple[0], `${source}[0]`),
            `${source}[0]`,
        ),
        soundIndex,
        expectRoundedFiniteNumber(tuple[2], `${source}[2]`),
        expectRoundedIntegerInRange(tuple[3], 0, 100, `${source}[3]`),
        expectRoundedIntegerInRange(tuple[4], 0, 200, `${source}[4]`),
        expectRoundedFiniteNumber(tuple[5], `${source}[5]`),
    ];
}

function expectRecord(input: unknown, source: string): Record<string, unknown> {
    if (!input || typeof input !== "object" || Array.isArray(input)) {
        throw new Error(`${source} must be an object.`);
    }

    return input as Record<string, unknown>;
}

function expectTuple(
    input: unknown,
    length: number,
    source: string,
    name: string,
): readonly unknown[] {
    if (!Array.isArray(input) || input.length !== length) {
        throw new Error(`${source} must be a ${length}-item ${name} tuple.`);
    }

    return input;
}

function expectNonEmptyString(input: unknown, source: string): string {
    if (typeof input !== "string" || input.trim().length === 0) {
        throw new Error(`${source} must be a non-empty string.`);
    }

    return input.trim();
}

function expectRoundedPositiveNumber(input: unknown, source: string): number {
    const value = expectRoundedFiniteNumber(input, source);
    if (value <= 0) {
        throw new Error(`${source} must be a positive finite number.`);
    }

    return value;
}

function expectNonNegativeInteger(input: number, source: string): number {
    if (!Number.isInteger(input) || input < 0) {
        throw new Error(`${source} must be a non-negative integer.`);
    }

    return input;
}

function expectRoundedIntegerInRange(
    input: unknown,
    min: number,
    max: number,
    source: string,
): number {
    const value = expectRoundedFiniteNumber(input, source);
    if (value < min || value > max) {
        throw new Error(`${source} must be between ${min} and ${max}.`);
    }

    return value;
}

function expectRoundedFiniteNumber(input: unknown, source: string): number {
    if (typeof input !== "number" || !Number.isFinite(input)) {
        throw new Error(`${source} must be a finite number.`);
    }

    const rounded = Math.round(input);
    return Object.is(rounded, -0) ? 0 : rounded;
}
