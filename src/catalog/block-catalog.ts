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
     * Tag groups where every non-empty group must match at least one tag.
     */
    oneOf?: readonly (readonly string[])[];
    /**
     * Tags that matching blocks must not include.
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

/**
 * Optional filter applied while collecting or grouping catalog tags.
 */
export type BlockCatalogTagFilter = {
    /**
     * Restricts results to tags with the provided prefix.
     */
    prefix?: string;
    /**
     * Applies custom matching logic to candidate tags.
     */
    test?: (tag: string) => boolean;
};

type NormalizedBlockCatalogQuery = Readonly<{
    all: readonly string[];
    oneOf: readonly (readonly string[])[];
    none: readonly string[];
}>;

const EMPTY_IDS: readonly string[] = Object.freeze([]);
const EMPTY_TAGS: readonly string[] = Object.freeze([]);
const EMPTY_TAG_GROUPS: readonly (readonly string[])[] = Object.freeze([]);
const EMPTY_QUERY: BlockCatalogQuery = Object.freeze({});
const EMPTY_NORMALIZED_QUERY: NormalizedBlockCatalogQuery = Object.freeze({
    all: EMPTY_TAGS,
    oneOf: EMPTY_TAG_GROUPS,
    none: EMPTY_TAGS,
});

/**
 * Immutable catalog-bound selection of matching block ids.
 */
export type BlockCatalogSelection = {
    /**
     * Returns a derived immutable selection with additional query constraints.
     */
    refine(query: BlockCatalogQuery): BlockCatalogSelection;
    /**
     * Returns the normalized selection query.
     */
    toQuery(): Readonly<BlockCatalogQuery>;
    /**
     * Returns the selected ids in stable id order.
     */
    ids(): readonly string[];
    /**
     * Returns the number of selected block ids.
     */
    readonly size: number;
    /**
     * Returns true when the selection contains the given block id.
     *
     * Nullish ids return `false`.
     */
    hasId(id: string | null | undefined): boolean;
    /**
     * Returns the selected ids as a set for efficient membership checks.
     */
    idSet(): ReadonlySet<string>;
    /**
     * Returns the selected entries in stable id order.
     */
    entries(): readonly Readonly<BlockCatalogEntry>[];
    /**
     * Collects unique tags from the selected ids in stable tag order.
     */
    tags(filter?: BlockCatalogTagFilter): readonly string[];
    /**
     * Groups the selected ids by matching tag in stable tag and id order.
     */
    groupIdsByTag(
        filter?: BlockCatalogTagFilter,
    ): ReadonlyMap<string, readonly string[]>;
    /**
     * Groups the selected ids into narrower selections by matching tag.
     */
    groupSelectionsByTag(
        filter?: BlockCatalogTagFilter,
    ): ReadonlyMap<string, BlockCatalogSelection>;
};

class CatalogSelection implements BlockCatalogSelection {
    private readonly query: NormalizedBlockCatalogQuery;
    private readonly evaluateIdsForQuery: (
        query: NormalizedBlockCatalogQuery,
    ) => readonly string[];
    private readonly getEntryForId: (
        id: string,
    ) => Readonly<BlockCatalogEntry> | undefined;
    private readonly getTagsForId: (id: string) => readonly string[];
    private cachedEvaluation:
        | Readonly<{
              ids: readonly string[];
              idSet: ReadonlySet<string>;
          }>
        | undefined;

    constructor(
        query: NormalizedBlockCatalogQuery,
        evaluateIdsForQuery: (
            query: NormalizedBlockCatalogQuery,
        ) => readonly string[],
        getEntryForId: (id: string) => Readonly<BlockCatalogEntry> | undefined,
        getTagsForId: (id: string) => readonly string[],
    ) {
        this.query = query;
        this.evaluateIdsForQuery = evaluateIdsForQuery;
        this.getEntryForId = getEntryForId;
        this.getTagsForId = getTagsForId;
    }

    /**
     * Returns a derived immutable selection with additional query constraints.
     */
    refine(query: BlockCatalogQuery): BlockCatalogSelection {
        return new CatalogSelection(
            mergeQueries(this.query, normalizeQuery(query)),
            this.evaluateIdsForQuery,
            this.getEntryForId,
            this.getTagsForId,
        );
    }

    /**
     * Returns the normalized selection query.
     */
    toQuery(): Readonly<BlockCatalogQuery> {
        return toPublicQuery(this.query);
    }

    /**
     * Returns the selected ids in stable id order.
     */
    ids(): readonly string[] {
        return this.getCachedEvaluation().ids;
    }

    /**
     * Returns the number of selected block ids.
     */
    get size(): number {
        return this.getCachedEvaluation().ids.length;
    }

    /**
     * Returns true when the selection contains the given block id.
     */
    hasId(id: string | null | undefined): boolean {
        if (typeof id !== "string") {
            return false;
        }

        return this.getCachedEvaluation().idSet.has(id);
    }

    /**
     * Returns the selected ids as a set for efficient membership checks.
     */
    idSet(): ReadonlySet<string> {
        return this.getCachedEvaluation().idSet;
    }

    /**
     * Returns the selected entries in stable id order.
     */
    entries(): readonly Readonly<BlockCatalogEntry>[] {
        return Object.freeze(
            this.ids()
                .map((id) => this.getEntryForId(id))
                .filter(
                    (entry): entry is Readonly<BlockCatalogEntry> =>
                        entry !== undefined,
                ),
        );
    }

    /**
     * Collects unique tags from the selected ids in stable tag order.
     */
    tags(filter?: BlockCatalogTagFilter): readonly string[] {
        return collectTagsForIds(this.ids(), this.getTagsForId, filter);
    }

    /**
     * Groups the selected ids by matching tag in stable tag and id order.
     */
    groupIdsByTag(
        filter?: BlockCatalogTagFilter,
    ): ReadonlyMap<string, readonly string[]> {
        return groupIdsByTag(this.ids(), this.getTagsForId, filter);
    }

    /**
     * Groups the selected ids into narrower selections by matching tag.
     */
    groupSelectionsByTag(
        filter?: BlockCatalogTagFilter,
    ): ReadonlyMap<string, BlockCatalogSelection> {
        return new Map(
            this.tags(filter).map((tag) => [tag, this.refine({ all: [tag] })]),
        );
    }

    private getCachedEvaluation(): Readonly<{
        ids: readonly string[];
        idSet: ReadonlySet<string>;
    }> {
        if (this.cachedEvaluation !== undefined) {
            return this.cachedEvaluation;
        }

        const ids = this.evaluateIdsForQuery(this.query);
        const evaluation = Object.freeze({
            ids,
            idSet: new Set(ids),
        });

        this.cachedEvaluation = evaluation;
        return evaluation;
    }
}

/**
 * Immutable block catalog with tag-based lookup and structured querying.
 */
export class BlockCatalog {
    private readonly entriesById: ReadonlyMap<
        string,
        Readonly<BlockCatalogEntry>
    >;
    private readonly idsByTag: ReadonlyMap<string, readonly string[]>;
    private readonly orderedIds: readonly string[];
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
        this.orderedIds = Object.freeze(
            orderedEntries.map((entry) => entry.id),
        );
        this.orderedEntries = orderedEntries;
    }

    /**
     * Returns true when the catalog contains an entry for the given id.
     *
     * Nullish ids return `false`.
     */
    hasEntry(id: string | null | undefined): boolean {
        if (typeof id !== "string") {
            return false;
        }

        return this.entriesById.has(id);
    }

    /**
     * Returns true when the block id has the requested tag.
     *
     * Nullish ids return `false`.
     */
    has(id: string | null | undefined, tag: string): boolean {
        if (typeof id !== "string") {
            return false;
        }

        const entry = this.entriesById.get(id);
        return entry ? entry.tags.includes(tag) : false;
    }

    /**
     * Returns the immutable entry for the given id.
     *
     * Nullish ids return `undefined`.
     */
    getEntry(
        id: string | null | undefined,
    ): Readonly<BlockCatalogEntry> | undefined {
        if (typeof id !== "string") {
            return undefined;
        }

        return this.entriesById.get(id);
    }

    /**
     * Returns the immutable tag list for one block id.
     *
     * Provide a filter when only matching tags should be returned.
     * Unknown or nullish ids return an empty tag list.
     */
    getTags(
        id: string | null | undefined,
        filter?: BlockCatalogTagFilter,
    ): readonly string[] {
        if (typeof id !== "string") {
            return EMPTY_TAGS;
        }

        const tags = this.entriesById.get(id)?.tags ?? EMPTY_TAGS;

        if (filter === undefined) {
            return tags;
        }

        const matchingTags = tags.filter((tag) =>
            matchesTagFilter(tag, filter),
        );
        if (matchingTags.length === 0) {
            return EMPTY_TAGS;
        }

        return matchingTags.length === tags.length
            ? tags
            : Object.freeze(matchingTags);
    }

    /**
     * Returns every entry in stable id order.
     */
    entries(): readonly Readonly<BlockCatalogEntry>[] {
        return this.orderedEntries;
    }

    /**
     * Returns a lazy immutable selection bound to this catalog.
     */
    select(query: BlockCatalogQuery = EMPTY_QUERY): BlockCatalogSelection {
        return new CatalogSelection(
            normalizeQuery(query),
            (nextQuery) => this.evaluateIds(nextQuery),
            (id) => this.entriesById.get(id),
            (id) => this.getTags(id),
        );
    }

    /**
     * Returns all matching block ids in stable id order.
     */
    queryIds(query: BlockCatalogQuery = EMPTY_QUERY): readonly string[] {
        return this.select(query).ids();
    }

    /**
     * Returns all matching block ids as a set for efficient membership checks.
     *
     * The returned set is a snapshot of the catalog query result. Treat it as
     * immutable.
     */
    queryIdSet(query: BlockCatalogQuery = EMPTY_QUERY): ReadonlySet<string> {
        return this.select(query).idSet();
    }

    /**
     * Returns all matching entries in stable id order.
     */
    queryEntries(
        query: BlockCatalogQuery = EMPTY_QUERY,
    ): readonly Readonly<BlockCatalogEntry>[] {
        return this.select(query).entries();
    }

    /**
     * Creates a derived catalog from this catalog plus an immutable overlay.
     */
    extend(overlay: BlockCatalogOverlay): BlockCatalog {
        return extendBlockCatalog(this, overlay);
    }

    private evaluateIds(query: NormalizedBlockCatalogQuery): readonly string[] {
        const candidateIds = this.getCandidateIds(query) ?? this.orderedIds;
        const matches: string[] = [];

        for (const id of candidateIds) {
            const tags = this.getTags(id);
            if (
                !matchesAllTags(tags, query.all) ||
                !matchesOneOfGroups(tags, query.oneOf) ||
                !matchesNoTags(tags, query.none)
            ) {
                continue;
            }

            matches.push(id);
        }

        return Object.freeze(matches);
    }

    private getCandidateIds(
        query: NormalizedBlockCatalogQuery,
    ): readonly string[] | undefined {
        const candidateSources = [
            ...query.all.map((tag) => this.getIdsForTag(tag)),
            ...query.oneOf.map((tags) => this.getUnionIdsForTags(tags)),
        ].filter((ids) => ids.length > 0);

        return [...candidateSources].sort(
            (left, right) => left.length - right.length,
        )[0];
    }

    private getIdsForTag(tag: string): readonly string[] {
        return this.idsByTag.get(tag) ?? EMPTY_IDS;
    }

    private getUnionIdsForTags(tags: readonly string[]): readonly string[] {
        return getSortedUnionIds(tags, (tag) => this.getIdsForTag(tag));
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
            Object.freeze(ids.sort(compareStrings)),
        ]),
    );
}

function normalizeQuery(
    query: BlockCatalogQuery = EMPTY_QUERY,
): NormalizedBlockCatalogQuery {
    const all = normalizeTags(query.all);
    const oneOf = normalizeTagGroups(query.oneOf);
    const none = normalizeTags(query.none);

    if (all.length === 0 && oneOf.length === 0 && none.length === 0) {
        return EMPTY_NORMALIZED_QUERY;
    }

    return Object.freeze({
        all,
        oneOf,
        none,
    });
}

function normalizeTags(tags: readonly string[] | undefined): readonly string[] {
    if (!tags || tags.length === 0) {
        return EMPTY_TAGS;
    }

    const uniqueTags = [...new Set(tags)];
    return uniqueTags.length === 0 ? EMPTY_TAGS : Object.freeze(uniqueTags);
}

function normalizeTagGroups(
    groups: readonly (readonly string[])[] | undefined,
): readonly (readonly string[])[] {
    if (!groups || groups.length === 0) {
        return EMPTY_TAG_GROUPS;
    }

    const normalizedGroups = groups
        .map((group) => normalizeTags(group))
        .filter((group) => group.length > 0);

    return normalizedGroups.length === 0
        ? EMPTY_TAG_GROUPS
        : Object.freeze(normalizedGroups);
}

function mergeQueries(
    left: NormalizedBlockCatalogQuery,
    right: NormalizedBlockCatalogQuery,
): NormalizedBlockCatalogQuery {
    return normalizeQuery({
        all: [...left.all, ...right.all],
        oneOf: [...left.oneOf, ...right.oneOf],
        none: [...left.none, ...right.none],
    });
}

function toPublicQuery(
    query: NormalizedBlockCatalogQuery,
): Readonly<BlockCatalogQuery> {
    if (
        query.all.length === 0 &&
        query.oneOf.length === 0 &&
        query.none.length === 0
    ) {
        return EMPTY_QUERY;
    }

    const publicQuery: BlockCatalogQuery = {};

    if (query.all.length > 0) {
        publicQuery.all = query.all;
    }

    if (query.oneOf.length > 0) {
        publicQuery.oneOf = query.oneOf;
    }

    if (query.none.length > 0) {
        publicQuery.none = query.none;
    }

    return Object.freeze(publicQuery);
}

function collectTagsForIds(
    ids: Iterable<string>,
    getTagsForId: (id: string) => readonly string[],
    filter?: BlockCatalogTagFilter,
): readonly string[] {
    const matchingTags = new Set<string>();

    for (const id of ids) {
        for (const tag of getTagsForId(id)) {
            if (!matchesTagFilter(tag, filter)) {
                continue;
            }

            matchingTags.add(tag);
        }
    }

    if (matchingTags.size === 0) {
        return EMPTY_TAGS;
    }

    return Object.freeze([...matchingTags].sort(compareStrings));
}

function groupIdsByTag(
    ids: Iterable<string>,
    getTagsForId: (id: string) => readonly string[],
    filter?: BlockCatalogTagFilter,
): ReadonlyMap<string, readonly string[]> {
    const idsByTag = new Map<string, string[]>();

    for (const id of ids) {
        for (const tag of getTagsForId(id)) {
            if (!matchesTagFilter(tag, filter)) {
                continue;
            }

            const existingIds = idsByTag.get(tag);
            if (existingIds) {
                existingIds.push(id);
                continue;
            }

            idsByTag.set(tag, [id]);
        }
    }

    return new Map(
        [...idsByTag.entries()]
            .sort(([left], [right]) => compareStrings(left, right))
            .map(([tag, groupedIds]) => [
                tag,
                Object.freeze([...new Set(groupedIds)].sort(compareStrings)),
            ]),
    );
}

function mergeTags(
    existingTags: readonly string[],
    nextTags: readonly string[],
): readonly string[] {
    return Object.freeze(
        [...new Set([...existingTags, ...nextTags])].sort(compareStrings),
    );
}

function compareStrings(left: string, right: string): number {
    return left.localeCompare(right);
}

function getSortedUnionIds(
    tags: readonly string[],
    getIdsForTag: (tag: string) => readonly string[],
): readonly string[] {
    const union = new Set<string>();

    for (const tag of tags) {
        for (const id of getIdsForTag(tag)) {
            union.add(id);
        }
    }

    return Object.freeze([...union].sort(compareStrings));
}

function matchesTagFilter(
    tag: string,
    filter: BlockCatalogTagFilter | undefined,
): boolean {
    if (filter?.prefix !== undefined && !tag.startsWith(filter.prefix)) {
        return false;
    }

    if (filter?.test !== undefined && !filter.test(tag)) {
        return false;
    }

    return true;
}

function matchesAllTags(
    tags: readonly string[],
    requiredTags: readonly string[],
): boolean {
    return requiredTags.every((tag) => tags.includes(tag));
}

function matchesOneOfGroups(
    tags: readonly string[],
    oneOf: readonly (readonly string[])[],
): boolean {
    return oneOf.every((group) => group.some((tag) => tags.includes(tag)));
}

function matchesNoTags(
    tags: readonly string[],
    excludedTags: readonly string[],
): boolean {
    return excludedTags.every((tag) => !tags.includes(tag));
}
