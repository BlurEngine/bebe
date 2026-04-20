import {
    createBlockCatalog,
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
