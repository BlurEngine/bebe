/**
 * One block entry inside a {@link BlockCatalog}.
 */
export type BlockCatalogEntry = {
    /**
     * Fully-qualified block identifier.
     */
    id: string;
    /**
     * Namespaced string tags attached to this block.
     */
    tags: readonly string[];
};

/**
 * Structured block catalog query.
 */
export type BlockCatalogQuery = {
    /**
     * Tags that every matching block must include.
     */
    all?: readonly string[];
    /**
     * Tags where at least one must be present.
     */
    any?: readonly string[];
    /**
     * Tags that must not be present.
     */
    none?: readonly string[];
};

/**
 * Immutable overlay applied on top of an existing {@link BlockCatalog}.
 */
export type BlockCatalogOverlay = {
    /**
     * Entries to merge into the derived catalog.
     *
     * If an id already exists, the provided tags are merged with the existing
     * entry rather than replacing it.
     */
    addEntries?: readonly BlockCatalogEntry[];
    /**
     * Additional tags to add to specific block ids.
     */
    addTags?: Readonly<Record<string, readonly string[]>>;
    /**
     * Block ids to remove entirely from the derived catalog.
     */
    removeEntries?: readonly string[];
    /**
     * Tags to remove from specific block ids.
     */
    removeTags?: Readonly<Record<string, readonly string[]>>;
};

const EMPTY_IDS: readonly string[] = Object.freeze([]);
const EMPTY_TAGS: readonly string[] = Object.freeze([]);
const EMPTY_QUERY: BlockCatalogQuery = Object.freeze({});

/**
 * Immutable block catalog with tag-based lookup and structured querying.
 */
export class BlockCatalog {
    private readonly entriesById: ReadonlyMap<
        string,
        Readonly<BlockCatalogEntry>
    >;
    private readonly idsByTag: ReadonlyMap<string, readonly string[]>;
    private readonly orderedEntries: readonly Readonly<BlockCatalogEntry>[];

    constructor(entries: readonly BlockCatalogEntry[]) {
        const normalizedEntriesById = new Map<
            string,
            Readonly<BlockCatalogEntry>
        >();

        for (const entry of entries) {
            const existing = normalizedEntriesById.get(entry.id);
            const tags = mergeTags(existing?.tags ?? EMPTY_TAGS, entry.tags);
            const normalizedEntry = Object.freeze({
                id: entry.id,
                tags,
            });
            normalizedEntriesById.set(entry.id, normalizedEntry);
        }

        const orderedEntries = Object.freeze(
            [...normalizedEntriesById.values()].sort((left, right) =>
                left.id.localeCompare(right.id),
            ),
        );
        const idsByTag = createIdsByTagIndex(orderedEntries);

        this.entriesById = normalizedEntriesById;
        this.idsByTag = idsByTag;
        this.orderedEntries = orderedEntries;
    }

    /**
     * Returns true when the catalog contains an entry for the given id.
     */
    hasEntry(id: string): boolean {
        return this.entriesById.has(id);
    }

    /**
     * Returns true when the block id has the requested tag.
     */
    has(id: string, tag: string): boolean {
        const entry = this.entriesById.get(id);
        return entry ? entry.tags.includes(tag) : false;
    }

    /**
     * Returns the immutable entry for the given id.
     */
    getEntry(id: string): Readonly<BlockCatalogEntry> | undefined {
        return this.entriesById.get(id);
    }

    /**
     * Returns the immutable tag list for one block id.
     */
    getTags(id: string): readonly string[] {
        return this.entriesById.get(id)?.tags ?? EMPTY_TAGS;
    }

    /**
     * Returns every entry in stable id order.
     */
    entries(): readonly Readonly<BlockCatalogEntry>[] {
        return this.orderedEntries;
    }

    /**
     * Returns all matching block ids in stable id order.
     */
    queryIds(query: BlockCatalogQuery = EMPTY_QUERY): readonly string[] {
        const all = query.all ?? EMPTY_TAGS;
        const any = query.any ?? EMPTY_TAGS;
        const none = query.none ?? EMPTY_TAGS;
        let candidateIds: readonly string[];

        if (all.length > 0) {
            const sortedAll = [...all].sort(
                (left, right) =>
                    this.getIdsForTag(left).length -
                    this.getIdsForTag(right).length,
            );
            candidateIds = this.getIdsForTag(sortedAll[0]!);
        } else if (any.length > 0) {
            const union = new Set<string>();
            for (const tag of any) {
                for (const id of this.getIdsForTag(tag)) {
                    union.add(id);
                }
            }
            candidateIds = [...union].sort((left, right) =>
                left.localeCompare(right),
            );
        } else {
            candidateIds = this.orderedEntries.map((entry) => entry.id);
        }

        const matches: string[] = [];
        for (const id of candidateIds) {
            const tags = this.getTags(id);
            if (
                !matchesAllTags(tags, all) ||
                !matchesAnyTags(tags, any) ||
                !matchesNoTags(tags, none)
            ) {
                continue;
            }

            matches.push(id);
        }

        return Object.freeze(matches);
    }

    /**
     * Returns all matching entries in stable id order.
     */
    queryEntries(
        query: BlockCatalogQuery = EMPTY_QUERY,
    ): readonly Readonly<BlockCatalogEntry>[] {
        return Object.freeze(
            this.queryIds(query)
                .map((id) => this.entriesById.get(id))
                .filter(
                    (entry): entry is Readonly<BlockCatalogEntry> =>
                        entry !== undefined,
                ),
        );
    }

    /**
     * Alias for {@link queryEntries}.
     */
    query(
        query: BlockCatalogQuery = EMPTY_QUERY,
    ): readonly Readonly<BlockCatalogEntry>[] {
        return this.queryEntries(query);
    }

    /**
     * Creates a derived catalog from this catalog plus an immutable overlay.
     */
    extend(overlay: BlockCatalogOverlay): BlockCatalog {
        return extendBlockCatalog(this, overlay);
    }

    private getIdsForTag(tag: string): readonly string[] {
        return this.idsByTag.get(tag) ?? EMPTY_IDS;
    }
}

/**
 * Creates an immutable {@link BlockCatalog} from raw entries.
 */
export function createBlockCatalog(
    entries: readonly BlockCatalogEntry[],
): BlockCatalog {
    return new BlockCatalog(entries);
}

/**
 * Creates a derived block catalog from a base catalog plus an immutable
 * overlay.
 */
export function extendBlockCatalog(
    baseCatalog: BlockCatalog,
    overlay: BlockCatalogOverlay,
): BlockCatalog {
    const entriesById = new Map<string, readonly string[]>(
        baseCatalog.entries().map((entry) => [entry.id, entry.tags]),
    );

    for (const id of overlay.removeEntries ?? EMPTY_IDS) {
        entriesById.delete(id);
    }

    for (const entry of overlay.addEntries ?? []) {
        const existingTags = entriesById.get(entry.id) ?? EMPTY_TAGS;
        entriesById.set(entry.id, mergeTags(existingTags, entry.tags));
    }

    for (const [id, tags] of Object.entries(overlay.addTags ?? {})) {
        const existingTags = entriesById.get(id) ?? EMPTY_TAGS;
        entriesById.set(id, mergeTags(existingTags, tags));
    }

    for (const [id, tags] of Object.entries(overlay.removeTags ?? {})) {
        const existingTags = entriesById.get(id);
        if (!existingTags) {
            continue;
        }

        const removedTags = new Set(tags);
        entriesById.set(
            id,
            Object.freeze(existingTags.filter((tag) => !removedTags.has(tag))),
        );
    }

    return new BlockCatalog(
        [...entriesById.entries()].map(([id, tags]) => ({ id, tags })),
    );
}

/**
 * Returns every namespaced tag on an entry matching the given prefix.
 */
export function getTagsWithPrefix(
    catalog: BlockCatalog,
    id: string,
    prefix: string,
): readonly string[] {
    const matchingTags = catalog
        .getTags(id)
        .filter((tag) => tag.startsWith(prefix));

    return matchingTags.length === 0 ? EMPTY_TAGS : Object.freeze(matchingTags);
}

/**
 * Returns the first namespaced tag on an entry matching the given prefix.
 *
 * Prefer {@link getTagsWithPrefix} when a catalog entry can intentionally
 * carry more than one matching tag.
 */
export function getTagWithPrefix(
    catalog: BlockCatalog,
    id: string,
    prefix: string,
): string | undefined {
    return getTagsWithPrefix(catalog, id, prefix)[0];
}

/**
 * Returns every block family tag for the given id.
 */
export function getCatalogFamilyTags(
    catalog: BlockCatalog,
    id: string,
): readonly string[] {
    return getTagsWithPrefix(catalog, id, "family:");
}

/**
 * Returns the first block family tag for the given id, if any.
 *
 * Prefer {@link getCatalogFamilyTags} when a block can intentionally carry
 * more than one `family:*` tag.
 */
export function getCatalogFamilyTag(
    catalog: BlockCatalog,
    id: string,
): string | undefined {
    return getCatalogFamilyTags(catalog, id)[0];
}

/**
 * Returns every entry with the given family tag.
 */
export function queryCatalogFamily(
    catalog: BlockCatalog,
    familyTag: string,
): readonly Readonly<BlockCatalogEntry>[] {
    return catalog.queryEntries({ all: [familyTag] });
}

function createIdsByTagIndex(
    entries: readonly Readonly<BlockCatalogEntry>[],
): ReadonlyMap<string, readonly string[]> {
    const idsByTag = new Map<string, string[]>();

    for (const entry of entries) {
        for (const tag of entry.tags) {
            const existing = idsByTag.get(tag);
            if (existing) {
                existing.push(entry.id);
                continue;
            }

            idsByTag.set(tag, [entry.id]);
        }
    }

    return new Map(
        [...idsByTag.entries()].map(([tag, ids]) => [
            tag,
            Object.freeze(ids.sort((left, right) => left.localeCompare(right))),
        ]),
    );
}

function mergeTags(
    existingTags: readonly string[],
    nextTags: readonly string[],
): readonly string[] {
    return Object.freeze(
        [...new Set([...existingTags, ...nextTags])].sort((left, right) =>
            left.localeCompare(right),
        ),
    );
}

function matchesAllTags(
    tags: readonly string[],
    requiredTags: readonly string[],
): boolean {
    return requiredTags.every((tag) => tags.includes(tag));
}

function matchesAnyTags(
    tags: readonly string[],
    optionalTags: readonly string[],
): boolean {
    return (
        optionalTags.length === 0 ||
        optionalTags.some((tag) => tags.includes(tag))
    );
}

function matchesNoTags(
    tags: readonly string[],
    excludedTags: readonly string[],
): boolean {
    return excludedTags.every((tag) => !tags.includes(tag));
}
