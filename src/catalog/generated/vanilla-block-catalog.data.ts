import type { BlockCatalogEntry } from "../block-catalog.js";
import rawVanillaBlockCatalogEntries from "./vanilla-block-catalog.data.json" with { type: "json" };

/**
 * Generated vanilla block catalog entries loaded from the JSON preset artifact.
 */
export const VANILLA_BLOCK_CATALOG_ENTRIES =
    rawVanillaBlockCatalogEntries as readonly BlockCatalogEntry[];
