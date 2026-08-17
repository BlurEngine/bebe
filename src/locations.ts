import {
    LOCATION_PACK_FORMAT_VERSION,
    normalizeLocationPack,
    type CompiledLocationDefinition,
    type CompiledLocationPack,
    type LocationPack,
} from "./locations/definitions.js";

export type LocationReference = {
    readonly id: string;
    readonly dimension: string;
};

export interface LocationsService {
    readonly size: number;
    clear(): void;
    forDimension(dimension: string): readonly CompiledLocationDefinition[];
    get(reference: LocationReference): CompiledLocationDefinition | undefined;
    load(pack: LocationPack): void;
    locations(): readonly CompiledLocationDefinition[];
    toPack(): CompiledLocationPack;
}

const EMPTY_PACK: CompiledLocationPack = Object.freeze({
    version: LOCATION_PACK_FORMAT_VERSION,
    locations: Object.freeze([]),
});

class LocationsRuntime implements LocationsService {
    #pack = EMPTY_PACK;
    #locationsByKey = new Map<string, CompiledLocationDefinition>();
    #locationsByDimension = new Map<
        string,
        readonly CompiledLocationDefinition[]
    >();

    get size(): number {
        return this.#pack.locations.length;
    }

    clear(): void {
        this.#pack = EMPTY_PACK;
        this.#locationsByKey = new Map();
        this.#locationsByDimension = new Map();
    }

    forDimension(dimension: string): readonly CompiledLocationDefinition[] {
        return (
            this.#locationsByDimension.get(dimension) ?? EMPTY_PACK.locations
        );
    }

    get(reference: LocationReference): CompiledLocationDefinition | undefined {
        return this.#locationsByKey.get(
            locationKey(reference.dimension, reference.id),
        );
    }

    load(pack: LocationPack): void {
        const normalized = normalizeLocationPack(pack);
        const byKey = new Map<string, CompiledLocationDefinition>();
        const mutableByDimension = new Map<
            string,
            CompiledLocationDefinition[]
        >();
        for (const location of normalized.locations) {
            byKey.set(locationKey(location.dimension, location.id), location);
            const dimensionLocations =
                mutableByDimension.get(location.dimension) ?? [];
            dimensionLocations.push(location);
            mutableByDimension.set(location.dimension, dimensionLocations);
        }

        const byDimension = new Map<
            string,
            readonly CompiledLocationDefinition[]
        >();
        for (const [dimension, locations] of mutableByDimension) {
            byDimension.set(dimension, Object.freeze(locations));
        }

        this.#pack = normalized;
        this.#locationsByKey = byKey;
        this.#locationsByDimension = byDimension;
    }

    locations(): readonly CompiledLocationDefinition[] {
        return this.#pack.locations;
    }

    toPack(): CompiledLocationPack {
        return this.#pack;
    }
}

function locationKey(dimension: string, id: string): string {
    return `${dimension}\u0000${id}`;
}

export const Locations: LocationsService = new LocationsRuntime();

export {
    LOCATION_PACK_FORMAT_VERSION,
    normalizeLocationDefinition,
    normalizeLocationPack,
} from "./locations/definitions.js";
export type {
    CompiledLocationDefinition,
    CompiledLocationPack,
    LocationDefinition,
    LocationPack,
    NormalizeLocationPackOptions,
} from "./locations/definitions.js";
