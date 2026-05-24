import { describe, expect, it } from "vitest";
import { ZoneEditorSession } from "../src/internal/zones/editor-core.js";

describe("ZoneEditorSession", () => {
    it("creates block zones at exact floored coordinates", () => {
        const session = new ZoneEditorSession();
        const result = session.handle({
            kind: "block",
            id: "town.spawn",
            position: { dimension: "overworld", x: 10, y: 64, z: -4 },
        });

        expect(result).toEqual({
            ok: true,
            message: 'Zone "town.spawn" updated.',
            previewPack: {
                zones: [
                    {
                        id: "town.spawn",
                        dimension: "overworld",
                        extent: {
                            kind: "block",
                            block: { x: 10, y: 64, z: -4 },
                        },
                    },
                ],
            },
        });
        expect(session.dirty).toBe(true);
    });

    it("creates a box zone from two corners regardless of selection order", () => {
        const session = new ZoneEditorSession();
        session.handle({
            kind: "boxStart",
            id: "town.market",
            position: { dimension: "overworld", x: 8, y: 70, z: 12 },
        });

        const result = session.handle({
            kind: "boxEnd",
            id: "town.market",
            position: { dimension: "overworld", x: 2, y: 64, z: 3 },
        });

        expect(result.ok).toBe(true);
        expect(session.toPack()).toEqual({
            zones: [
                {
                    id: "town.market",
                    dimension: "overworld",
                    extent: {
                        kind: "box",
                        min: { x: 2, y: 64, z: 3 },
                        max: { x: 8, y: 70, z: 12 },
                    },
                },
            ],
        });
    });

    it("rejects box end when the pending corner belongs to a different dimension", () => {
        const session = new ZoneEditorSession();
        session.handle({
            kind: "boxStart",
            id: "town.market",
            position: { dimension: "overworld", x: 0, y: 64, z: 0 },
        });

        expect(
            session.handle({
                kind: "boxEnd",
                id: "town.market",
                position: { dimension: "nether", x: 1, y: 65, z: 1 },
            }),
        ).toEqual({
            ok: false,
            message:
                'Box selection for "town.market" started in dimension "overworld".',
        });
    });

    it("discards unsaved changes back to the initial pack", () => {
        const session = new ZoneEditorSession({
            initialPack: {
                zones: [
                    {
                        id: "existing",
                        dimension: "overworld",
                        extent: { kind: "block", block: [0, 64, 0] },
                    },
                ],
            },
        });

        session.handle({
            kind: "delete",
            id: "existing",
            dimension: "overworld",
        });

        expect(session.dirty).toBe(true);
        expect(session.handle({ kind: "discard" })).toEqual({
            ok: true,
            message: "Zone changes discarded.",
            previewPack: {
                zones: [
                    {
                        id: "existing",
                        dimension: "overworld",
                        extent: {
                            kind: "block",
                            block: { x: 0, y: 64, z: 0 },
                        },
                    },
                ],
            },
        });
        expect(session.dirty).toBe(false);
    });

    it("returns a save pack only when the draft is dirty", () => {
        const session = new ZoneEditorSession();

        expect(session.handle({ kind: "save" })).toEqual({
            ok: true,
            message: "No zone changes to save.",
        });

        session.handle({
            kind: "block",
            id: "town.spawn",
            position: { dimension: "overworld", x: 1, y: 2, z: 3 },
        });

        expect(session.handle({ kind: "save" })).toEqual({
            ok: true,
            message: "Zone save requested.",
            savePack: {
                zones: [
                    {
                        id: "town.spawn",
                        dimension: "overworld",
                        extent: {
                            kind: "block",
                            block: { x: 1, y: 2, z: 3 },
                        },
                    },
                ],
            },
        });
    });

    it("creates a simple 2d polygon with a y range", () => {
        const session = new ZoneEditorSession();

        expect(
            session.handle({
                kind: "polygonStart",
                id: "town.route",
                dimension: "overworld",
                yMin: 60,
                yMax: 90,
            }),
        ).toEqual({
            ok: true,
            message: 'Polygon started for "town.route".',
        });

        session.handle({
            kind: "polygonAdd",
            position: { dimension: "overworld", x: 0, y: 70, z: 0 },
        });
        session.handle({
            kind: "polygonAdd",
            position: { dimension: "overworld", x: 8, y: 70, z: 0 },
        });
        session.handle({
            kind: "polygonAdd",
            position: { dimension: "overworld", x: 8, y: 70, z: 8 },
        });

        expect(session.handle({ kind: "polygonFinish" })).toEqual({
            ok: true,
            message: 'Zone "town.route" updated.',
            previewPack: {
                zones: [
                    {
                        id: "town.route",
                        dimension: "overworld",
                        extent: {
                            kind: "polygon",
                            points: [
                                [0, 0],
                                [8, 0],
                                [8, 8],
                            ],
                            y: {
                                min: 60,
                                max: 90,
                            },
                        },
                    },
                ],
            },
        });
    });

    it("rejects polygon finish until at least three points exist", () => {
        const session = new ZoneEditorSession();
        session.handle({
            kind: "polygonStart",
            id: "town.route",
            dimension: "overworld",
            yMin: 60,
            yMax: 90,
        });
        session.handle({
            kind: "polygonAdd",
            position: { dimension: "overworld", x: 0, y: 70, z: 0 },
        });

        expect(session.handle({ kind: "polygonFinish" })).toEqual({
            ok: false,
            message: 'Polygon "town.route" needs at least 3 points.',
        });
    });

    it("rejects polygon points from another dimension", () => {
        const session = new ZoneEditorSession();
        session.handle({
            kind: "polygonStart",
            id: "town.route",
            dimension: "overworld",
            yMin: 60,
            yMax: 90,
        });

        expect(
            session.handle({
                kind: "polygonAdd",
                position: { dimension: "nether", x: 1, y: 70, z: 1 },
            }),
        ).toEqual({
            ok: false,
            message:
                'Polygon "town.route" is being edited in dimension "overworld".',
        });
    });
});
