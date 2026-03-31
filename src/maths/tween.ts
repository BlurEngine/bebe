import type { RunHandler } from "../context.js";
import { clamp, lerp } from "./util.js";
import { Vec3, type Vec3Init, type Vec3Like } from "./vec3.js";

export type EasingFunction = (t: number) => number;

/**
 * Creates an easing function that follows a cubic bezier curve definition.
 * Implementation based on https://github.com/gre/bezier-easing (MIT).
 */
export function cubicBezier(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
): (t: number) => number {
    const NEWTON_ITERATIONS = 8;
    const NEWTON_MIN_SLOPE = 1e-3;
    const SUBDIVISION_PRECISION = 1e-7;
    const SUBDIVISION_MAX_ITERATIONS = 10;

    const kSplineTableSize = 11;
    const kSampleStepSize = 1 / (kSplineTableSize - 1);

    const float32ArraySupported = typeof Float32Array === "function";
    const sampleValues = float32ArraySupported
        ? new Float32Array(kSplineTableSize)
        : new Array<number>(kSplineTableSize);

    function A(aA1: number, aA2: number) {
        return 1 - 3 * aA2 + 3 * aA1;
    }
    function B(aA1: number, aA2: number) {
        return 3 * aA2 - 6 * aA1;
    }
    function C(aA1: number) {
        return 3 * aA1;
    }

    function calcBezier(aT: number, aA1: number, aA2: number) {
        return ((A(aA1, aA2) * aT + B(aA1, aA2)) * aT + C(aA1)) * aT;
    }

    function getSlope(aT: number, aA1: number, aA2: number) {
        return 3 * A(aA1, aA2) * aT * aT + 2 * B(aA1, aA2) * aT + C(aA1);
    }

    function binarySubdivide(aX: number, aA: number, aB: number) {
        let currentX: number;
        let currentT: number = 0;
        let i = 0;
        do {
            currentT = aA + (aB - aA) / 2;
            currentX = calcBezier(currentT, x1, x2) - aX;
            if (currentX > 0) {
                aB = currentT;
            } else {
                aA = currentT;
            }
        } while (
            Math.abs(currentX) > SUBDIVISION_PRECISION &&
            ++i < SUBDIVISION_MAX_ITERATIONS
        );
        return currentT;
    }

    function newtonRaphsonIterate(aX: number, aGuessT: number) {
        let t = aGuessT;
        for (let i = 0; i < NEWTON_ITERATIONS; i++) {
            const currentSlope = getSlope(t, x1, x2);
            if (currentSlope === 0) return t;
            const currentX = calcBezier(t, x1, x2) - aX;
            t -= currentX / currentSlope;
        }
        return t;
    }

    for (let i = 0; i < kSplineTableSize; i++) {
        sampleValues[i] = calcBezier(i * kSampleStepSize, x1, x2);
    }

    function getTForX(aX: number) {
        let intervalStart = 0;
        let currentSample = 1;
        const lastSample = kSplineTableSize - 1;

        for (
            ;
            currentSample !== lastSample && sampleValues[currentSample] <= aX;
            ++currentSample
        ) {
            intervalStart += kSampleStepSize;
        }
        currentSample--;

        const dist =
            (aX - sampleValues[currentSample]) /
            (sampleValues[currentSample + 1] - sampleValues[currentSample]);
        const guessForT = intervalStart + dist * kSampleStepSize;

        const initialSlope = getSlope(guessForT, x1, x2);
        if (initialSlope >= NEWTON_MIN_SLOPE) {
            return newtonRaphsonIterate(aX, guessForT);
        } else if (initialSlope === 0) {
            return guessForT;
        }
        return binarySubdivide(
            aX,
            intervalStart,
            intervalStart + kSampleStepSize,
        );
    }

    return function bezierEasing(t: number): number {
        if (x1 === y1 && x2 === y2) return t;
        if (t <= 0) return 0;
        if (t >= 1) return 1;
        return calcBezier(getTForX(t), y1, y2);
    };
}

const outBounce: EasingFunction = (t) => {
    const n1 = 7.5625;
    const d1 = 2.75;
    if (t < 1 / d1) return n1 * t * t;
    if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
    if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
    return n1 * (t -= 2.625 / d1) * t + 0.984375;
};

// Easing collection (t in [0,1])
export const Easings = {
    linear: (t) => t,
    inQuad: (t) => t * t,
    outQuad: (t) => t * (2 - t),
    inOutQuad: (t) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t),
    inCubic: (t) => t * t * t,
    outCubic: (t) => --t * t * t + 1,
    inOutCubic: (t) =>
        t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1,
    inQuart: (t) => t * t * t * t,
    outQuart: (t) => 1 - --t * t * t * t,
    inOutQuart: (t) => (t < 0.5 ? 8 * t * t * t * t : 1 - 8 * --t * t * t * t),
    inQuint: (t) => t * t * t * t * t,
    outQuint: (t) => 1 + --t * t * t * t * t,
    inOutQuint: (t) =>
        t < 0.5 ? 16 * t * t * t * t * t : 1 + 16 * --t * t * t * t * t,
    inSine: (t) => 1 - Math.cos((t * Math.PI) / 2),
    outSine: (t) => Math.sin((t * Math.PI) / 2),
    inOutSine: (t) => 0.5 * (1 - Math.cos(Math.PI * t)),
    inExpo: (t) => (t === 0 ? 0 : Math.pow(2, 10 * (t - 1))),
    outExpo: (t) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t)),
    inOutExpo: (t) =>
        t === 0
            ? 0
            : t === 1
              ? 1
              : t < 0.5
                ? Math.pow(2, 20 * t - 10) / 2
                : (2 - Math.pow(2, -20 * t + 10)) / 2,
    inCirc: (t) => 1 - Math.sqrt(1 - t * t),
    outCirc: (t) => Math.sqrt(1 - --t * t),
    inOutCirc: (t) =>
        t < 0.5
            ? (1 - Math.sqrt(1 - 4 * t * t)) / 2
            : (Math.sqrt(1 - (2 * t - 2) ** 2) + 1) / 2,
    inBack: (t) => {
        const s = 1.70158;
        return t * t * ((s + 1) * t - s);
    },
    outBack: (t) => {
        const s = 1.70158;
        return --t * t * ((s + 1) * t + s) + 1;
    },
    inOutBack: (t) => {
        const s = 1.70158 * 1.525;
        return t < 0.5
            ? ((t * 2) ** 2 * ((s + 1) * t * 2 - s)) / 2
            : ((t * 2 - 2) ** 2 * ((s + 1) * (t * 2 - 2) + s) + 2) / 2;
    },
    inBounce: (t) => 1 - outBounce(1 - t),
    outBounce,
    inOutBounce: (t) =>
        t < 0.5
            ? (1 - outBounce(1 - 2 * t)) / 2
            : (1 + outBounce(2 * t - 1)) / 2,
} satisfies Record<string, EasingFunction>;

export type EasingName = keyof typeof Easings;
export type TweenEasing = EasingFunction | EasingName;

export interface TweenScheduler {
    interval(ticks: number, fn: RunHandler): TweenCancel;
    timeout(ticks: number, fn: RunHandler): TweenCancel;
}

export type TweenCancel = () => void;
export type TweenFactory = () => TweenCancel | void;
export type TweenSequenceDone = () => void;
export type TweenSequenceStep = (done: TweenSequenceDone) => TweenCancel | void;

export type TweenUpdate<T> = (value: T, t: number) => void;

export type TweenCommon = {
    durationTicks: number;
    easing?: TweenEasing;
    yoyo?: boolean;
    repeat?: number | "infinite";
    onComplete?: () => void;
};

export type TweenNumberOptions = TweenCommon & {
    from: number;
    to: number;
    onUpdate: TweenUpdate<number>;
};

export type TweenVec3Options = TweenCommon & {
    from: Vec3Like;
    to: Vec3Like;
    onUpdate: TweenUpdate<Vec3Init>;
};

function resolveEasing(e: TweenEasing | undefined): EasingFunction {
    if (!e) return Easings.linear;
    if (typeof e === "function") return e;
    return Easings[e] ?? Easings.linear;
}

function runController(
    scheduler: TweenScheduler,
    durationTicks: number,
    step: (t01: number) => void,
    opts: {
        yoyo?: boolean;
        repeat?: number | "infinite";
        onComplete?: () => void;
    },
): TweenCancel {
    const total = Math.max(1, durationTicks | 0);
    let tick = 0;
    let direction: 1 | -1 = 1;
    let remaining =
        opts.repeat === "infinite" ? "infinite" : Math.max(0, opts.repeat ?? 0);
    let cancel: TweenCancel = () => {};

    const restartOrComplete = () => {
        if (remaining === "infinite") {
            direction = 1;
            tick = 0;
            return;
        }
        if (typeof remaining === "number" && remaining > 0) {
            remaining--;
            direction = 1;
            tick = 0;
            return;
        }
        cancel();
        opts.onComplete?.();
    };

    cancel = scheduler.interval(1, () => {
        step(clamp(tick / total, 0, 1));

        if (direction === 1) {
            if (tick >= total) {
                if (opts.yoyo) {
                    direction = -1;
                    tick = Math.max(total - 1, 0);
                    return;
                }
                restartOrComplete();
                return;
            }
            tick++;
            return;
        }

        if (tick <= 0) {
            restartOrComplete();
            return;
        }

        tick--;
    });
    return cancel;
}

export function tweenNumber(
    scheduler: TweenScheduler,
    options: TweenNumberOptions,
): TweenCancel {
    const easing = resolveEasing(options.easing);
    return runController(
        scheduler,
        options.durationTicks,
        (t01) => {
            const v = lerp(options.from, options.to, easing(t01));
            options.onUpdate(v, t01);
        },
        {
            yoyo: options.yoyo,
            repeat: options.repeat,
            onComplete: options.onComplete,
        },
    );
}

export function tweenVec3(
    scheduler: TweenScheduler,
    options: TweenVec3Options,
): TweenCancel {
    const easing = resolveEasing(options.easing);
    const from = new Vec3(options.from);
    const to = new Vec3(options.to);
    return runController(
        scheduler,
        options.durationTicks,
        (t01) => {
            const k = easing(t01);
            const v: Vec3Init = {
                x: lerp(from.x, to.x, k),
                y: lerp(from.y, to.y, k),
                z: lerp(from.z, to.z, k),
            };
            options.onUpdate(v, t01);
        },
        {
            yoyo: options.yoyo,
            repeat: options.repeat,
            onComplete: options.onComplete,
        },
    );
}

export function tweenDelay(
    scheduler: TweenScheduler,
    ticks: number,
    fn: () => void,
): TweenCancel {
    return scheduler.timeout(Math.max(0, ticks | 0), () => fn());
}

export function tweenSequence(steps: TweenSequenceStep[]): TweenCancel {
    let currentIndex = 0;
    let currentCancel: TweenCancel | undefined;
    let cancelled = false;
    let advancing = false;

    const advance = () => {
        if (cancelled || currentCancel || advancing) {
            return;
        }

        advancing = true;
        try {
            while (
                !cancelled &&
                currentIndex < steps.length &&
                !currentCancel
            ) {
                let completed = false;
                const done = () => {
                    if (cancelled || completed) {
                        return;
                    }
                    completed = true;
                    currentCancel = undefined;
                    if (!advancing) {
                        advance();
                    }
                };
                const maybeCancel = steps[currentIndex++]?.(done);

                if (completed) {
                    continue;
                }

                currentCancel =
                    typeof maybeCancel === "function" ? maybeCancel : undefined;
                return;
            }
        } finally {
            advancing = false;
        }
    };

    advance();
    return () => {
        if (cancelled) {
            return;
        }
        cancelled = true;
        currentCancel?.();
        currentCancel = undefined;
    };
}

export function tweenParallel(tweens: TweenFactory[]): TweenCancel {
    const cancels: TweenCancel[] = [];
    for (const createTween of tweens) {
        const cancel = createTween?.();
        if (typeof cancel === "function") {
            cancels.push(cancel);
        }
    }
    return () => {
        for (const cancel of cancels) {
            cancel();
        }
    };
}
