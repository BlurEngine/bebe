import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import {
    Facing,
    FACING_OFFSETS,
    HORIZONTAL_FACING_OFFSETS,
    SURROUNDING_OFFSETS,
    VERTICAL_FACING_OFFSETS,
    Vec3,
    createSurroundingOffsets,
} from "@blurengine/bebe/maths";

describe("maths/Facing", () => {
    it("loads the public maths barrel without a Bedrock runtime", () => {
        expect(() =>
            execFileSync(
                process.execPath,
                [
                    "--input-type=module",
                    "--eval",
                    "await import('./lib/maths/index.js')",
                ],
                { cwd: process.cwd(), stdio: "pipe" },
            ),
        ).not.toThrow();
    });

    it("re-exports Bedrock Direction under the Facing name", () => {
        expect(Facing.Down).toBe("Down");
        expect(Facing.East).toBe("East");
        expect(Facing.North).toBe("North");
        expect(Facing.South).toBe("South");
        expect(Facing.Up).toBe("Up");
        expect(Facing.West).toBe("West");
    });

    it("exposes facing offsets in Facing order", () => {
        expect(FACING_OFFSETS).toHaveLength(6);
        expect(FACING_OFFSETS[0]).toBeInstanceOf(Vec3);
        expect(FACING_OFFSETS.map((offset) => offset.toObject())).toEqual([
            { x: 0, y: -1, z: 0 },
            { x: 1, y: 0, z: 0 },
            { x: 0, y: 0, z: 1 },
            { x: 0, y: 0, z: -1 },
            { x: 0, y: 1, z: 0 },
            { x: -1, y: 0, z: 0 },
        ]);
    });

    it("exposes horizontal and vertical facing subsets", () => {
        expect(HORIZONTAL_FACING_OFFSETS).toHaveLength(4);
        expect(
            HORIZONTAL_FACING_OFFSETS.map((offset) => offset.toObject()),
        ).toEqual([
            { x: 1, y: 0, z: 0 },
            { x: 0, y: 0, z: 1 },
            { x: 0, y: 0, z: -1 },
            { x: -1, y: 0, z: 0 },
        ]);

        expect(VERTICAL_FACING_OFFSETS).toHaveLength(2);
        expect(
            VERTICAL_FACING_OFFSETS.map((offset) => offset.toObject()),
        ).toEqual([
            { x: 0, y: -1, z: 0 },
            { x: 0, y: 1, z: 0 },
        ]);
    });

    it("exposes all surrounding offsets except the origin", () => {
        expect(SURROUNDING_OFFSETS).toHaveLength(26);
        expect(SURROUNDING_OFFSETS[0]).toBeInstanceOf(Vec3);
        expect(
            new Set(
                SURROUNDING_OFFSETS.map(
                    (offset) => `${offset.x},${offset.y},${offset.z}`,
                ),
            ).size,
        ).toBe(26);
        expect(
            SURROUNDING_OFFSETS.some(
                (offset) => offset.x === 0 && offset.y === 0 && offset.z === 0,
            ),
        ).toBe(false);
    });

    it("creates the default surrounding offsets", () => {
        expect(createSurroundingOffsets()).toEqual(SURROUNDING_OFFSETS);
    });

    it("can include the origin in surrounding offsets", () => {
        const offsets = createSurroundingOffsets({ includeOrigin: true });

        expect(offsets).toHaveLength(27);
        expect(
            offsets.some(
                (offset) => offset.x === 0 && offset.y === 0 && offset.z === 0,
            ),
        ).toBe(true);
    });

    it("can scale the surrounding offset step distance", () => {
        const offsets = createSurroundingOffsets({ size: 2 });

        expect(offsets).toHaveLength(26);
        expect(
            offsets.some(
                (offset) => offset.x === 2 && offset.y === 0 && offset.z === 0,
            ),
        ).toBe(true);
        expect(
            offsets.some(
                (offset) =>
                    offset.x === -2 && offset.y === -2 && offset.z === -2,
            ),
        ).toBe(true);
        expect(
            offsets.every(
                (offset) =>
                    Number.isInteger(offset.x / 2) &&
                    Number.isInteger(offset.y / 2) &&
                    Number.isInteger(offset.z / 2),
            ),
        ).toBe(true);
    });

    it("throws when the surrounding offset size is not a positive integer", () => {
        expect(() => createSurroundingOffsets({ size: 0 })).toThrow(
            "createSurroundingOffsets requires size to be a positive integer.",
        );
        expect(() => createSurroundingOffsets({ size: 1.5 })).toThrow(
            "createSurroundingOffsets requires size to be a positive integer.",
        );
    });
});
