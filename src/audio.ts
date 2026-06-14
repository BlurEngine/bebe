import { type Context, mustContext } from "./context.js";
import { Vec3, type Vec3Like } from "./maths/vec3.js";
import {
    normalizeAudioCompiledPack,
    type AudioCompiledNote,
    type AudioCompiledPack,
    type AudioCompiledCue,
} from "./audio/compiled.js";

export type AudioSoundOptions = {
    readonly pitch?: number;
    readonly volume?: number;
    readonly location?: Vec3Like;
};

export type AudioTarget = {
    readonly isValid?: boolean | (() => boolean);
    playSound(soundId: string, options?: AudioSoundOptions): void;
};

export type AudioDimensionTarget = {
    playSound(
        soundId: string,
        location: Vec3Like,
        options?: AudioSoundOptions,
    ): void;
};

export type AudioPlayOptions =
    | {
          readonly dimension?: never;
          readonly location?: never;
          readonly target: AudioTarget;
      }
    | {
          readonly dimension: AudioDimensionTarget;
          readonly location: Vec3Like;
          readonly target?: never;
      };

type IsAssignable<TInput, TTarget> = [TInput] extends [TTarget] ? true : false;
type ExpectFalse<TValue extends false> = TValue;
type RejectMixedTargetAndDimension = ExpectFalse<
    IsAssignable<
        {
            readonly dimension: AudioDimensionTarget;
            readonly location: Vec3Like;
            readonly target: AudioTarget;
        },
        AudioPlayOptions
    >
>;
type RejectTargetWithLocation = ExpectFalse<
    IsAssignable<
        {
            readonly location: Vec3Like;
            readonly target: AudioTarget;
        },
        AudioPlayOptions
    >
>;

export type AudioPlayback = { stop(): boolean };

export interface AudioService {
    readonly size: number;
    clear(): void;
    get(id: string): AudioCompiledCue | undefined;
    load(pack: AudioCompiledPack): void;
    play(
        context: Context,
        id: string,
        options: AudioPlayOptions,
    ): AudioPlayback;
    cues(): readonly AudioCompiledCue[];
}

type ResolvedAudioNote = {
    readonly note: AudioCompiledNote;
    readonly soundId: string;
};

type AudioPlaybackTick = {
    readonly notes: readonly ResolvedAudioNote[];
    readonly tick: number;
};

class AudioRuntime implements AudioService {
    readonly #cues = new Map<string, AudioCompiledCue>();
    #soundIds: readonly string[] = [];

    get size(): number {
        return this.#cues.size;
    }

    clear(): void {
        this.#cues.clear();
        this.#soundIds = [];
    }

    get(id: string): AudioCompiledCue | undefined {
        return this.#cues.get(id);
    }

    load(pack: AudioCompiledPack): void {
        const normalized = normalizeAudioCompiledPack(pack);
        this.clear();
        this.#soundIds = normalized.s;

        for (const cue of normalized.c) {
            this.#cues.set(cue[0], cue);
        }
    }

    play(
        context: Context,
        id: string,
        options: AudioPlayOptions,
    ): AudioPlayback {
        const cue = this.#cues.get(id);
        if (!cue) {
            throw new Error(`Unknown audio cue "${id}".`);
        }

        return playCompiledAudioCue(context, cue, this.#soundIds, options);
    }

    cues(): readonly AudioCompiledCue[] {
        return Object.freeze([...this.#cues.values()]);
    }
}

export function playCompiledAudioCue(
    context: Context,
    cue: AudioCompiledCue,
    soundIds: readonly string[],
    options: AudioPlayOptions,
): AudioPlayback {
    const owner = mustContext(context);
    const schedule = createPlaybackSchedule(cue, soundIds);
    const cancels: Array<() => void> = [];
    let pendingDelayedGroups = 0;
    let removeContextFinalizer: (() => void) | undefined;
    let stopped = false;
    const releaseContextFinalizer = () => {
        const remove = removeContextFinalizer;
        if (!remove) {
            return;
        }

        removeContextFinalizer = undefined;
        remove();
    };
    const playback: AudioPlayback = {
        stop() {
            if (stopped) {
                return false;
            }

            stopped = true;
            releaseContextFinalizer();
            for (const cancel of cancels) {
                cancel();
            }
            return true;
        },
    };

    for (const group of schedule) {
        if (group.tick === 0) {
            playAudioNotes(group.notes, options);
            continue;
        }

        pendingDelayedGroups += 1;
        cancels.push(
            owner.timeout(group.tick, () => {
                if (stopped) {
                    return;
                }

                try {
                    playAudioNotes(group.notes, options);
                } finally {
                    pendingDelayedGroups -= 1;
                    if (pendingDelayedGroups === 0) {
                        releaseContextFinalizer();
                    }
                }
            }),
        );
    }

    if (pendingDelayedGroups > 0) {
        removeContextFinalizer = owner.use(() => playback.stop());
    }
    return playback;
}

function playAudioNotes(
    notes: readonly ResolvedAudioNote[],
    options: AudioPlayOptions,
): void {
    for (const note of notes) {
        playAudioNote(note, options);
    }
}

function playAudioNote(
    resolved: ResolvedAudioNote,
    options: AudioPlayOptions,
): void {
    const soundOptions = {
        pitch: notePitch(resolved.note),
        volume: noteVolume(resolved.note),
    };

    const target = options.target;
    if (target !== undefined) {
        if (!isValidAudioTarget(target)) {
            return;
        }

        target.playSound(resolved.soundId, soundOptions);
        return;
    }

    options.dimension.playSound(
        resolved.soundId,
        new Vec3(options.location).toObject(),
        soundOptions,
    );
}

const runtime = new AudioRuntime();

export const Audio: AudioService = Object.freeze({
    get size(): number {
        return runtime.size;
    },
    clear(): void {
        runtime.clear();
    },
    get(id: string): AudioCompiledCue | undefined {
        return runtime.get(id);
    },
    load(pack: AudioCompiledPack): void {
        runtime.load(pack);
    },
    play(
        context: Context,
        id: string,
        options: AudioPlayOptions,
    ): AudioPlayback {
        return runtime.play(context, id, options);
    },
    cues(): readonly AudioCompiledCue[] {
        return runtime.cues();
    },
});

function isValidAudioTarget(target: AudioTarget): boolean {
    if (typeof target.isValid === "function") {
        return target.isValid();
    }

    return target.isValid !== false;
}

function createPlaybackSchedule(
    cue: AudioCompiledCue,
    soundIds: readonly string[],
): AudioPlaybackTick[] {
    const groups = new Map<number, ResolvedAudioNote[]>();

    for (const note of cue[3]) {
        const soundId = soundIds[note[1]];
        if (soundId === undefined) {
            continue;
        }

        let group = groups.get(note[0]);
        if (!group) {
            group = [];
            groups.set(note[0], group);
        }
        group.push({ note, soundId });
    }

    return [...groups.entries()].map(([tick, notes]) => ({ notes, tick }));
}

function noteVolume(note: AudioCompiledNote): number {
    return Math.max(0, Math.min(1, note[3] / 100));
}

function notePitch(note: AudioCompiledNote): number {
    const midiKey = note[2];
    const cents = note[5];
    const pitch = 2 ** ((midiKey - 66) / 12 + cents / 1200);
    return Number.isFinite(pitch) ? Math.max(0.01, pitch) : 0.01;
}
