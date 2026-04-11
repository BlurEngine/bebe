import {
    createBlockCatalog,
    getCatalogFamilyTags,
    queryCatalogFamily,
    type BlockCatalogEntry,
    type BlockCatalog,
} from "./block-catalog.js";
import { VANILLA_BLOCK_CATALOG_ENTRIES } from "./generated/vanilla-block-catalog.data.js";

/**
 * Immutable generated vanilla block catalog entries.
 */
export const vanillaBlockCatalogEntries: readonly BlockCatalogEntry[] =
    VANILLA_BLOCK_CATALOG_ENTRIES;

/**
 * Immutable vanilla block catalog built from generated preset data.
 */
export const vanillaBlockCatalog: BlockCatalog = createBlockCatalog(
    vanillaBlockCatalogEntries,
);

/**
 * Returns every `family:*` tag for a vanilla block id.
 */
export function getFamilyTags(id: string): readonly string[] {
    return getCatalogFamilyTags(vanillaBlockCatalog, id);
}

/**
 * Returns the first `family:*` tag for a vanilla block id, if any.
 *
 * Prefer {@link getFamilyTags} when a vanilla block can intentionally carry
 * more than one family tag.
 */
export function getFamilyTag(id: string): string | undefined {
    return getFamilyTags(id)[0];
}

/**
 * Returns every vanilla block entry with the given family tag.
 */
export function queryFamily(
    familyTag: string,
): readonly Readonly<BlockCatalogEntry>[] {
    return queryCatalogFamily(vanillaBlockCatalog, familyTag);
}
