import {
    compileZonePack,
    normalizeZoneDefinition,
    normalizeZonePack,
    type CompileZonePackOptions,
    type ZoneDefinition,
    type ZonePack,
    type ZonePackScope,
} from "./definitions.js";
import { Link } from "../link.js";

export const ZONE_DRAFT_SAVE_EVENT = "bebe.zones.saveDraft";

export type ZoneDraftSavePayload = {
    readonly pack: ZonePack;
};

export type ZoneDraftLookup = {
    readonly id: string;
    readonly dimension: string;
};

export type ZoneDraftChangeKind = "add" | "update" | "delete";

export type ZoneDraftChange = {
    readonly kind: ZoneDraftChangeKind;
    readonly id: string;
    readonly dimension: string;
    readonly before: ZoneDefinition | undefined;
    readonly after: ZoneDefinition | undefined;
};

export type ZoneDraftToPackOptions = {
    readonly compile?: boolean | CompileZonePackOptions;
};

/**
 * Mutable JSON-zone draft for editor tools.
 *
 * The draft keeps saved state separate from working state. Runtime editor code
 * can preview `toPack(...)` through `Zones.load(...)`, then call `reset(...)`
 * after its own save command has written the new source file.
 */
export class ZoneDraft {
    #baseline = new Map<string, ZoneDefinition>();
    #current = new Map<string, ZoneDefinition>();
    #baselineScope: ZonePackScope | undefined;
    #scope: ZonePackScope | undefined;

    constructor(pack: ZonePack = { zones: [] }) {
        this.reset(pack);
    }

    get dirty(): boolean {
        return (
            !sameJson(this.#scope, this.#baselineScope) ||
            this.changes().length > 0
        );
    }

    get size(): number {
        return this.#current.size;
    }

    get scope(): ZonePackScope | undefined {
        return cloneJson(this.#scope);
    }

    setScope(scope: ZonePackScope | undefined): void {
        this.#scope = cloneJson(scope);
    }

    get(lookup: ZoneDraftLookup): ZoneDefinition | undefined {
        return cloneJson(this.#current.get(zoneKey(lookup)));
    }

    set(zone: ZoneDefinition): void {
        const normalized = normalizeZoneDefinition(zone);
        this.#current.set(zoneKey(normalized), cloneJson(normalized));
    }

    delete(lookup: ZoneDraftLookup): boolean {
        return this.#current.delete(zoneKey(lookup));
    }

    clear(): void {
        this.#current.clear();
    }

    toPack(options: ZoneDraftToPackOptions = {}): ZonePack {
        const pack = this.#createPack();
        if (!options.compile) {
            return pack;
        }

        return compileZonePack(
            pack,
            options.compile === true ? {} : options.compile,
        );
    }

    changes(): readonly ZoneDraftChange[] {
        const changes: ZoneDraftChange[] = [];
        const keys = new Set([
            ...this.#baseline.keys(),
            ...this.#current.keys(),
        ]);

        for (const key of keys) {
            const before = this.#baseline.get(key);
            const after = this.#current.get(key);
            if (sameJson(before, after)) {
                continue;
            }

            const zone = after ?? before;
            if (!zone) {
                continue;
            }

            changes.push({
                kind: before ? (after ? "update" : "delete") : "add",
                id: zone.id,
                dimension: zone.dimension,
                before: cloneJson(before),
                after: cloneJson(after),
            });
        }

        return changes;
    }

    reset(pack: ZonePack = { zones: [] }): void {
        const normalized = normalizeZonePack(pack);
        this.#baseline = packToMap(normalized);
        this.#current = packToMap(normalized);
        this.#baselineScope = cloneJson(normalized.scope);
        this.#scope = cloneJson(normalized.scope);
    }

    #createPack(): ZonePack {
        const zones = Array.from(this.#current.values(), (zone) =>
            cloneJson(zone),
        );
        const pack: ZonePack = { zones };

        return this.#scope ? { ...pack, scope: cloneJson(this.#scope) } : pack;
    }
}

export function createZoneDraft(pack: ZonePack = { zones: [] }): ZoneDraft {
    return new ZoneDraft(pack);
}

/**
 * Requests that a connected `blr dev` session writes a zone draft back to the
 * project source file.
 *
 * This is a Link event only. It is safe to call without Link installed, in
 * which case the request is ignored like any other Link event.
 */
export function requestZoneDraftSave(draftOrPack: ZoneDraft | ZonePack): void {
    Link.event(ZONE_DRAFT_SAVE_EVENT, {
        pack: createZoneSourcePack(draftOrPack),
    } satisfies ZoneDraftSavePayload);
}

function packToMap(pack: ZonePack): Map<string, ZoneDefinition> {
    return new Map(
        pack.zones.map((zone) => [
            zoneKey(zone),
            cloneJson(zone) as ZoneDefinition,
        ]),
    );
}

function zoneKey(lookup: ZoneDraftLookup): string {
    return `${lookup.dimension}\u0000${lookup.id}`;
}

function sameJson(left: unknown, right: unknown): boolean {
    return JSON.stringify(left) === JSON.stringify(right);
}

function cloneJson<T>(value: T): T {
    if (value === undefined) {
        return value;
    }

    return JSON.parse(JSON.stringify(value)) as T;
}

function createZoneSourcePack(draftOrPack: ZoneDraft | ZonePack): ZonePack {
    const pack =
        draftOrPack instanceof ZoneDraft
            ? draftOrPack.toPack()
            : normalizeZonePack(draftOrPack);

    return pack.scope
        ? { zones: pack.zones, scope: pack.scope }
        : { zones: pack.zones };
}
