import { ZoneDraft } from "../../zones/draft.js";
import {
    normalizeZonePack,
    type ZoneDefinition,
    type ZonePack,
} from "../../zones/definitions.js";

export type ZoneEditorPosition = {
    readonly dimension: string;
    readonly x: number;
    readonly y: number;
    readonly z: number;
};

export type ZoneEditorAction =
    | { readonly kind: "status" }
    | { readonly kind: "list"; readonly dimension: string }
    | {
          readonly kind: "block";
          readonly id: string;
          readonly position: ZoneEditorPosition;
      }
    | {
          readonly kind: "boxStart";
          readonly id: string;
          readonly position: ZoneEditorPosition;
      }
    | {
          readonly kind: "boxEnd";
          readonly id: string;
          readonly position: ZoneEditorPosition;
      }
    | {
          readonly kind: "polygonStart";
          readonly id: string;
          readonly dimension: string;
          readonly yMin: number;
          readonly yMax: number;
      }
    | { readonly kind: "polygonAdd"; readonly position: ZoneEditorPosition }
    | { readonly kind: "polygonFinish" }
    | {
          readonly kind: "delete";
          readonly id: string;
          readonly dimension: string;
      }
    | { readonly kind: "discard" }
    | { readonly kind: "save" };

export type ZoneEditorActionResult =
    | {
          readonly ok: true;
          readonly message: string;
          readonly previewPack?: ZonePack;
          readonly savePack?: ZonePack;
      }
    | { readonly ok: false; readonly message: string };

export type ZoneEditorSessionOptions = {
    readonly initialPack?: ZonePack;
};

type PendingBox = {
    readonly id: string;
    readonly position: ZoneEditorPosition;
};

type PendingPolygon = {
    readonly id: string;
    readonly dimension: string;
    readonly yMin: number;
    readonly yMax: number;
    readonly points: [number, number][];
};

export class ZoneEditorSession {
    readonly #baselinePack: ZonePack;
    readonly #draft: ZoneDraft;
    #pendingBox: PendingBox | undefined;
    #pendingPolygon: PendingPolygon | undefined;

    constructor(options: ZoneEditorSessionOptions = {}) {
        this.#baselinePack = normalizeZonePack(
            options.initialPack ?? { zones: [] },
        );
        this.#draft = new ZoneDraft(this.#baselinePack);
    }

    get dirty(): boolean {
        return this.#draft.dirty;
    }

    get activePolygonId(): string | undefined {
        return this.#pendingPolygon?.id;
    }

    handle(action: ZoneEditorAction): ZoneEditorActionResult {
        switch (action.kind) {
            case "status":
                return {
                    ok: true,
                    message: this.#draft.dirty
                        ? `${this.#draft.changes().length} unsaved zone change(s).`
                        : "No unsaved zone changes.",
                };
            case "list":
                return {
                    ok: true,
                    message: this.#list(action.dimension),
                };
            case "block":
                return this.#setZone({
                    id: action.id,
                    dimension: action.position.dimension,
                    extent: {
                        kind: "block",
                        block: toBlock(action.position),
                    },
                });
            case "boxStart":
                this.#pendingBox = {
                    id: action.id,
                    position: action.position,
                };
                return {
                    ok: true,
                    message: `Box start set for "${action.id}".`,
                };
            case "boxEnd":
                return this.#boxEnd(action.id, action.position);
            case "polygonStart":
                this.#pendingPolygon = {
                    id: action.id,
                    dimension: action.dimension,
                    yMin: Math.min(action.yMin, action.yMax),
                    yMax: Math.max(action.yMin, action.yMax),
                    points: [],
                };
                return {
                    ok: true,
                    message: `Polygon started for "${action.id}".`,
                };
            case "polygonAdd":
                return this.#polygonAdd(action.position);
            case "polygonFinish":
                return this.#polygonFinish();
            case "delete":
                return this.#delete(action.id, action.dimension);
            case "discard":
                this.#draft.reset(this.#baselinePack);
                this.#pendingBox = undefined;
                this.#pendingPolygon = undefined;
                return {
                    ok: true,
                    message: "Zone changes discarded.",
                    previewPack: this.#draft.toPack(),
                };
            case "save":
                if (!this.#draft.dirty) {
                    return {
                        ok: true,
                        message: "No zone changes to save.",
                    };
                }
                return {
                    ok: true,
                    message: "Zone save requested.",
                    savePack: this.#draft.toPack(),
                };
        }
    }

    toPack(): ZonePack {
        return this.#draft.toPack();
    }

    #setZone(zone: ZoneDefinition): ZoneEditorActionResult {
        this.#draft.set(zone);
        return {
            ok: true,
            message: `Zone "${zone.id}" updated.`,
            previewPack: this.#draft.toPack(),
        };
    }

    #boxEnd(id: string, position: ZoneEditorPosition): ZoneEditorActionResult {
        const pending = this.#pendingBox;
        if (!pending || pending.id !== id) {
            return {
                ok: false,
                message: `No box selection started for "${id}".`,
            };
        }
        if (pending.position.dimension !== position.dimension) {
            return {
                ok: false,
                message: `Box selection for "${id}" started in dimension "${pending.position.dimension}".`,
            };
        }

        this.#pendingBox = undefined;
        return this.#setZone({
            id,
            dimension: position.dimension,
            extent: {
                kind: "box",
                min: {
                    x: Math.min(pending.position.x, position.x),
                    y: Math.min(pending.position.y, position.y),
                    z: Math.min(pending.position.z, position.z),
                },
                max: {
                    x: Math.max(pending.position.x, position.x),
                    y: Math.max(pending.position.y, position.y),
                    z: Math.max(pending.position.z, position.z),
                },
            },
        });
    }

    #delete(id: string, dimension: string): ZoneEditorActionResult {
        const deleted = this.#draft.delete({ id, dimension });
        return deleted
            ? {
                  ok: true,
                  message: `Zone "${id}" deleted.`,
                  previewPack: this.#draft.toPack(),
              }
            : {
                  ok: false,
                  message: `Zone "${id}" does not exist in dimension "${dimension}".`,
              };
    }

    #polygonAdd(position: ZoneEditorPosition): ZoneEditorActionResult {
        const pending = this.#pendingPolygon;
        if (!pending) {
            return {
                ok: false,
                message: "No polygon is being edited.",
            };
        }
        if (pending.dimension !== position.dimension) {
            return {
                ok: false,
                message: `Polygon "${pending.id}" is being edited in dimension "${pending.dimension}".`,
            };
        }

        pending.points.push([position.x, position.z]);
        return {
            ok: true,
            message: `Point ${pending.points.length} added to "${pending.id}".`,
        };
    }

    #polygonFinish(): ZoneEditorActionResult {
        const pending = this.#pendingPolygon;
        if (!pending) {
            return {
                ok: false,
                message: "No polygon is being edited.",
            };
        }
        if (pending.points.length < 3) {
            return {
                ok: false,
                message: `Polygon "${pending.id}" needs at least 3 points.`,
            };
        }

        this.#pendingPolygon = undefined;
        return this.#setZone({
            id: pending.id,
            dimension: pending.dimension,
            extent: {
                kind: "polygon",
                points: pending.points,
                y: {
                    min: pending.yMin,
                    max: pending.yMax,
                },
            },
        });
    }

    #list(dimension: string): string {
        const ids = this.#draft
            .toPack()
            .zones.filter((zone) => zone.dimension === dimension)
            .map((zone) => zone.id);

        return ids.length === 0
            ? `No zones in dimension "${dimension}".`
            : `Zones in "${dimension}": ${ids.join(", ")}`;
    }
}

function toBlock(position: ZoneEditorPosition): {
    readonly x: number;
    readonly y: number;
    readonly z: number;
} {
    return {
        x: position.x,
        y: position.y,
        z: position.z,
    };
}
