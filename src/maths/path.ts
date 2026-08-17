import { AABB } from "./aabb.js";
import { Vec3, type Vec3Like } from "./vec3.js";

const MIN_SEGMENT_LENGTH = 1e-7;

export type PathSample = {
    readonly distance: number;
    readonly position: Vec3;
    readonly tangent: Vec3;
    readonly segmentIndex: number;
    readonly segmentT: number;
};

export interface ArcLengthPath {
    readonly closed: boolean;
    readonly length: number;
    sample(distance: number): PathSample | undefined;
    bounds(startDistance: number, endDistance: number): AABB | undefined;
}

type PathSegment = {
    readonly end: Vec3;
    readonly endDistance: number;
    readonly index: number;
    readonly length: number;
    readonly start: Vec3;
    readonly startDistance: number;
    readonly tangent: Vec3;
};

export type CatmullRomOptions = {
    readonly closed?: boolean;
    readonly subdivisionsPerSegment?: number;
};

export const DEFAULT_CATMULL_ROM_SUBDIVISIONS = 16;

export function compilePolyline(
    points: readonly Vec3Like[],
    closed = false,
): ArcLengthPath {
    if (points.length < 2 || (closed && points.length < 3)) {
        throw new RangeError(
            closed
                ? "A closed path requires at least three points."
                : "A path requires at least two points.",
        );
    }

    const vertices = points.map((point, index) => {
        const components = componentsFrom(point);
        if (
            ![components.x, components.y, components.z].every(Number.isFinite)
        ) {
            throw new RangeError(`Path point ${index} must be finite.`);
        }
        return new Vec3(components);
    });
    const segmentCount = closed ? vertices.length : vertices.length - 1;
    const segments: PathSegment[] = [];
    let totalLength = 0;

    for (let index = 0; index < segmentCount; index += 1) {
        const start = vertices[index];
        const end = vertices[(index + 1) % vertices.length];
        const delta = end.subtract(start);
        const length = delta.magnitude();
        if (!Number.isFinite(length) || length <= MIN_SEGMENT_LENGTH) {
            throw new RangeError(
                `Path segment ${index} must have a finite length of at least ${MIN_SEGMENT_LENGTH}.`,
            );
        }
        const endDistance = totalLength + length;
        if (!Number.isFinite(endDistance)) {
            throw new RangeError(
                "Path length exceeds the finite number range.",
            );
        }
        segments.push(
            Object.freeze({
                end,
                endDistance,
                index,
                length,
                start,
                startDistance: totalLength,
                tangent: delta.divide(length),
            }),
        );
        totalLength = endDistance;
    }

    return new CompiledArcLengthPath(
        closed,
        totalLength,
        Object.freeze(segments),
    );
}

export function compileCatmullRom(
    controlPoints: readonly Vec3Like[],
    options: CatmullRomOptions = {},
): ArcLengthPath {
    const closed = options.closed ?? false;
    const subdivisions =
        options.subdivisionsPerSegment ?? DEFAULT_CATMULL_ROM_SUBDIVISIONS;
    if (!Number.isInteger(subdivisions) || subdivisions < 1) {
        throw new RangeError("Spline subdivisions must be a positive integer.");
    }

    const controlPath = compilePolyline(controlPoints, closed);
    if (!closed && controlPoints.length === 2) {
        return controlPath;
    }

    const controls = controlPoints.map((point) => new Vec3(point));
    const segmentCount = closed ? controls.length : controls.length - 1;
    const sampledPoints: Vec3[] = [evaluateSegment(controls, 0, 0, closed)];

    for (let segment = 0; segment < segmentCount; segment += 1) {
        for (let step = 1; step <= subdivisions; step += 1) {
            sampledPoints.push(
                evaluateSegment(controls, segment, step / subdivisions, closed),
            );
        }
    }
    if (closed) {
        sampledPoints.pop();
    }
    return compilePolyline(sampledPoints, closed);
}

class CompiledArcLengthPath implements ArcLengthPath {
    constructor(
        readonly closed: boolean,
        readonly length: number,
        private readonly segments: readonly PathSegment[],
    ) {}

    sample(distance: number): PathSample | undefined {
        if (!Number.isFinite(distance)) {
            return undefined;
        }
        const normalizedDistance = this.normalizeDistance(distance);
        if (normalizedDistance === undefined) {
            return undefined;
        }
        if (!this.closed && normalizedDistance === this.length) {
            return this.createSample(
                this.segments[this.segments.length - 1],
                normalizedDistance,
                1,
            );
        }
        const segment = this.findSegment(normalizedDistance);
        return this.createSample(
            segment,
            normalizedDistance,
            (normalizedDistance - segment.startDistance) / segment.length,
        );
    }

    bounds(startDistance: number, endDistance: number): AABB | undefined {
        if (
            !Number.isFinite(startDistance) ||
            !Number.isFinite(endDistance) ||
            endDistance < startDistance
        ) {
            return undefined;
        }
        if (!this.closed && (startDistance < 0 || endDistance > this.length)) {
            return undefined;
        }

        const span = endDistance - startDistance;
        if (this.closed && span >= this.length) {
            return AABB.fromPoints(
                ...this.segments.map((segment) => segment.start),
            );
        }
        const start = this.sample(startDistance);
        const end = this.sample(endDistance);
        if (!start || !end) {
            return undefined;
        }
        const points: Vec3[] = [start.position, end.position];
        if (!this.closed) {
            for (const segment of this.segments) {
                if (
                    segment.endDistance > startDistance &&
                    segment.endDistance < endDistance
                ) {
                    points.push(segment.end);
                }
            }
            return AABB.fromPoints(...points);
        }

        const normalizedStart = this.wrap(startDistance);
        const unwrappedEnd = normalizedStart + span;
        for (const segment of this.segments) {
            const boundary = segment.endDistance;
            const firstLap = Math.floor(
                (normalizedStart - boundary) / this.length,
            );
            for (let lap = firstLap; lap <= firstLap + 2; lap += 1) {
                const unwrappedBoundary = boundary + lap * this.length;
                if (
                    unwrappedBoundary > normalizedStart &&
                    unwrappedBoundary < unwrappedEnd
                ) {
                    points.push(segment.end);
                }
            }
        }
        return AABB.fromPoints(...points);
    }

    private normalizeDistance(distance: number): number | undefined {
        if (!this.closed) {
            return distance < 0 || distance > this.length
                ? undefined
                : distance;
        }
        return this.wrap(distance);
    }

    private wrap(distance: number): number {
        const wrapped = ((distance % this.length) + this.length) % this.length;
        return Object.is(wrapped, -0) ? 0 : wrapped;
    }

    private findSegment(distance: number): PathSegment {
        let low = 0;
        let high = this.segments.length - 1;
        while (low < high) {
            const middle = Math.floor((low + high) / 2);
            if (distance < this.segments[middle].endDistance) {
                high = middle;
            } else {
                low = middle + 1;
            }
        }
        return this.segments[low];
    }

    private createSample(
        segment: PathSegment,
        distance: number,
        segmentT: number,
    ): PathSample {
        return Object.freeze({
            distance,
            position: segment.start.lerp(segment.end, segmentT),
            tangent: segment.tangent,
            segmentIndex: segment.index,
            segmentT,
        });
    }
}

function componentsFrom(point: Vec3Like): {
    readonly x: number;
    readonly y: number;
    readonly z: number;
} {
    if (Array.isArray(point)) {
        return { x: point[0], y: point[1], z: point[2] };
    }
    return point as {
        readonly x: number;
        readonly y: number;
        readonly z: number;
    };
}

function evaluateSegment(
    points: readonly Vec3[],
    segment: number,
    progress: number,
    closed: boolean,
): Vec3 {
    const p0 = getControlPoint(points, segment - 1, closed);
    const p1 = getControlPoint(points, segment, closed);
    const p2 = getControlPoint(points, segment + 1, closed);
    const p3 = getControlPoint(points, segment + 2, closed);
    if (progress === 0) return p1;
    if (progress === 1) return p2;

    const t0 = 0;
    const t1 = nextKnot(t0, p0, p1);
    const t2 = nextKnot(t1, p1, p2);
    const t3 = nextKnot(t2, p2, p3);
    const time = t1 + (t2 - t1) * progress;
    const a1 = interpolateAtKnot(p0, p1, t0, t1, time);
    const a2 = interpolateAtKnot(p1, p2, t1, t2, time);
    const a3 = interpolateAtKnot(p2, p3, t2, t3, time);
    const b1 = interpolateAtKnot(a1, a2, t0, t2, time);
    const b2 = interpolateAtKnot(a2, a3, t1, t3, time);
    return interpolateAtKnot(b1, b2, t1, t2, time);
}

function getControlPoint(
    points: readonly Vec3[],
    index: number,
    closed: boolean,
): Vec3 {
    if (closed) {
        return points[
            ((index % points.length) + points.length) % points.length
        ];
    }
    if (index < 0) {
        return points[0].multiply(2).subtract(points[1]);
    }
    if (index >= points.length) {
        const last = points[points.length - 1];
        return last.multiply(2).subtract(points[points.length - 2]);
    }
    return points[index];
}

function nextKnot(time: number, start: Vec3, end: Vec3): number {
    return time + Math.sqrt(start.distance(end));
}

function interpolateAtKnot(
    start: Vec3,
    end: Vec3,
    startTime: number,
    endTime: number,
    time: number,
): Vec3 {
    return start.lerp(end, (time - startTime) / (endTime - startTime));
}
