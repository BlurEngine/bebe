import { afterEach, describe, expect, it } from "vitest";
import {
    ZONE_DRAFT_SAVE_EVENT,
    ZoneDraft,
    createZoneDraft,
    requestZoneDraftSave,
} from "@blurengine/bebe";
import {
    clearLinkTransport,
    installLinkTransport,
    type LinkEvent,
    type LinkEventTransport,
    type LinkInboundHandler,
} from "../src/link.js";

class FakeLinkTransport implements LinkEventTransport {
    readonly sent: LinkEvent[] = [];

    capabilities(): readonly string[] {
        return ["events"];
    }

    event(event: LinkEvent): void {
        this.sent.push(event);
    }

    isAvailable(capability?: string): boolean {
        return capability ? capability === "events" : true;
    }

    on(_kind: string, _handler: LinkInboundHandler): () => void {
        return () => {};
    }

    status() {
        return {
            available: true,
            capabilities: this.capabilities(),
        };
    }
}

describe("zone drafts", () => {
    afterEach(() => {
        clearLinkTransport();
    });

    it("tracks editor changes without mutating the saved pack", () => {
        const savedPack = {
            zones: [
                {
                    id: "spawn",
                    dimension: "minecraft:overworld",
                    extent: { kind: "block" as const, block: [0, 64, 0] },
                },
            ],
        };
        const draft = createZoneDraft(savedPack);

        expect(draft.dirty).toBe(false);
        draft.set({
            id: "spawn",
            dimension: "minecraft:overworld",
            extent: { kind: "block", block: [1, 64, 0] },
        });
        draft.set({
            id: "arena",
            dimension: "minecraft:overworld",
            extent: {
                kind: "polygon",
                points: [
                    [0, 0],
                    [4, 0],
                    [4, 4],
                ],
                y: { min: 60, max: 80 },
            },
        });

        expect(savedPack.zones[0]?.extent).toEqual({
            kind: "block",
            block: [0, 64, 0],
        });
        expect(draft.dirty).toBe(true);
        expect(draft.changes()).toEqual([
            expect.objectContaining({
                after: expect.objectContaining({ id: "spawn" }),
                before: expect.objectContaining({ id: "spawn" }),
                dimension: "minecraft:overworld",
                id: "spawn",
                kind: "update",
            }),
            expect.objectContaining({
                after: expect.objectContaining({ id: "arena" }),
                before: undefined,
                dimension: "minecraft:overworld",
                id: "arena",
                kind: "add",
            }),
        ]);
    });

    it("supports noop saves by resetting the baseline to the current draft", () => {
        const draft = new ZoneDraft();

        draft.set({
            id: "spawn",
            dimension: "minecraft:overworld",
            extent: { kind: "block", block: [0, 64, 0] },
        });

        expect(draft.dirty).toBe(true);
        const saved = draft.toPack({ compile: true });
        draft.reset(saved);

        expect(draft.dirty).toBe(false);
        expect(draft.changes()).toEqual([]);
        expect(saved.compiled?.dimensions["minecraft:overworld"]).toEqual({
            cells: { "0,4,0": ["spawn"] },
            scanned: [],
        });
    });

    it("reports deletes as explicit draft changes", () => {
        const draft = createZoneDraft({
            zones: [
                {
                    id: "spawn",
                    dimension: "minecraft:overworld",
                    extent: { kind: "infinite" },
                },
            ],
        });

        expect(
            draft.delete({
                id: "spawn",
                dimension: "minecraft:overworld",
            }),
        ).toBe(true);

        expect(draft.toPack()).toEqual({ zones: [] });
        expect(draft.changes()).toEqual([
            expect.objectContaining({
                after: undefined,
                before: expect.objectContaining({ id: "spawn" }),
                dimension: "minecraft:overworld",
                id: "spawn",
                kind: "delete",
            }),
        ]);
    });

    it("requests draft saves through Link with source-only zone packs", () => {
        const transport = new FakeLinkTransport();
        clearLinkTransport();
        installLinkTransport(transport);
        const draft = createZoneDraft({
            zones: [
                {
                    id: "spawn",
                    dimension: "minecraft:overworld",
                    extent: { kind: "block", block: [0, 64, 0] },
                },
            ],
        });
        draft.set({
            id: "spawn",
            dimension: "minecraft:overworld",
            extent: { kind: "block", block: [1, 64, 0] },
        });

        requestZoneDraftSave(draft);
        requestZoneDraftSave({
            zones: [],
            compiled: {
                version: 1,
                cellSize: 16,
                maxCellsPerZone: 4096,
                dimensions: {},
            },
        });

        expect(transport.sent).toEqual([
            {
                kind: ZONE_DRAFT_SAVE_EVENT,
                data: {
                    pack: {
                        zones: [
                            {
                                id: "spawn",
                                dimension: "minecraft:overworld",
                                extent: {
                                    kind: "block",
                                    block: {
                                        x: 1,
                                        y: 64,
                                        z: 0,
                                    },
                                },
                            },
                        ],
                    },
                },
            },
            {
                kind: ZONE_DRAFT_SAVE_EVENT,
                data: {
                    pack: {
                        zones: [],
                    },
                },
            },
        ]);
    });
});
