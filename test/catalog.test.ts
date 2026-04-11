import { describe, expect, it } from "vitest";
import {
    BlockCatalog,
    createBlockCatalog,
    extendBlockCatalog,
    getCatalogFamilyTag,
    getCatalogFamilyTags,
    getFamilyTag,
    getFamilyTags,
    getTagWithPrefix,
    getTagsWithPrefix,
    queryCatalogFamily,
    queryFamily,
    vanillaBlockCatalog,
} from "@blurengine/bebe/catalog";

describe("block catalog", () => {
    it("supports structured tag queries", () => {
        const catalog = createBlockCatalog([
            { id: "minecraft:oak_log", tags: ["family:oak", "kind:log"] },
            { id: "minecraft:oak_leaves", tags: ["family:oak", "kind:leaf"] },
            { id: "minecraft:birch_log", tags: ["family:birch", "kind:log"] },
        ]);

        expect(catalog.queryIds({ all: ["kind:log"] })).toEqual([
            "minecraft:birch_log",
            "minecraft:oak_log",
        ]);
        expect(
            catalog.queryIds({
                all: ["family:oak"],
                any: ["kind:leaf", "kind:log"],
            }),
        ).toEqual(["minecraft:oak_leaves", "minecraft:oak_log"]);
        expect(
            catalog.queryIds({ all: ["kind:log"], none: ["family:oak"] }),
        ).toEqual(["minecraft:birch_log"]);
    });

    it("supports immutable overlays without mutating the base catalog", () => {
        const baseCatalog = createBlockCatalog([
            {
                id: "minecraft:oak_log",
                tags: ["family:oak", "kind:log"],
            },
        ]);

        const derivedCatalog = extendBlockCatalog(baseCatalog, {
            addEntries: [
                {
                    id: "minecraft:oak_leaves",
                    tags: ["family:oak", "kind:leaf"],
                },
            ],
            addTags: {
                "minecraft:oak_log": ["project:test"],
            },
        });

        expect(baseCatalog.getTags("minecraft:oak_log")).toEqual([
            "family:oak",
            "kind:log",
        ]);
        expect(derivedCatalog.getTags("minecraft:oak_log")).toEqual([
            "family:oak",
            "kind:log",
            "project:test",
        ]);
        expect(derivedCatalog.getTags("minecraft:oak_leaves")).toEqual([
            "family:oak",
            "kind:leaf",
        ]);
    });

    it("exposes family helpers on both the generic and vanilla preset surfaces", () => {
        expect(
            getTagsWithPrefix(
                vanillaBlockCatalog,
                "minecraft:cut_copper",
                "family:",
            ),
        ).toEqual(["family:copper", "family:cut_copper"]);
        expect(
            getTagWithPrefix(
                vanillaBlockCatalog,
                "minecraft:oak_log",
                "family:",
            ),
        ).toBe("family:oak");
        expect(
            getCatalogFamilyTags(vanillaBlockCatalog, "minecraft:cut_copper"),
        ).toEqual(["family:copper", "family:cut_copper"]);
        expect(
            getCatalogFamilyTag(vanillaBlockCatalog, "minecraft:oak_log"),
        ).toBe("family:oak");
        expect(getFamilyTags("minecraft:cut_copper")).toEqual([
            "family:copper",
            "family:cut_copper",
        ]);
        expect(getFamilyTag("minecraft:oak_log")).toBe("family:oak");
        expect(
            queryCatalogFamily(vanillaBlockCatalog, "family:oak").some(
                (entry) => entry.id === "minecraft:oak_leaves",
            ),
        ).toBe(true);
        expect(
            queryFamily("family:oak").some(
                (entry) => entry.id === "minecraft:oak_leaves",
            ),
        ).toBe(true);
    });

    it("ships inferred vanilla kind, family, color, and exact-override tags", () => {
        expect(vanillaBlockCatalog.has("minecraft:oak_log", "family:oak")).toBe(
            true,
        );
        expect(vanillaBlockCatalog.has("minecraft:oak_log", "kind:log")).toBe(
            true,
        );
        expect(
            vanillaBlockCatalog.has("minecraft:acacia_button", "family:acacia"),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has("minecraft:acacia_button", "kind:button"),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has(
                "minecraft:darkoak_wall_sign",
                "family:dark_oak",
            ),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has("minecraft:darkoak_wall_sign", "kind:sign"),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has("minecraft:standing_banner", "kind:banner"),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has(
                "minecraft:standing_banner",
                "kind:standing_banner",
            ),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has("minecraft:wall_banner", "kind:banner"),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has(
                "minecraft:wall_banner",
                "kind:wall_banner",
            ),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has("minecraft:activator_rail", "kind:rail"),
        ).toBe(true);
        expect(vanillaBlockCatalog.has("minecraft:ice", "kind:ice")).toBe(true);
        expect(vanillaBlockCatalog.has("minecraft:blue_ice", "kind:ice")).toBe(
            true,
        );
        expect(vanillaBlockCatalog.has("minecraft:iron_ore", "kind:ore")).toBe(
            true,
        );
        expect(
            vanillaBlockCatalog.has("minecraft:gold_block", "family:gold"),
        ).toBe(true);
        expect(vanillaBlockCatalog.has("minecraft:clay", "family:clay")).toBe(
            true,
        );
        expect(
            vanillaBlockCatalog.has("minecraft:hardened_clay", "family:clay"),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has("minecraft:coal_block", "family:coal"),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has("minecraft:coal_ore", "family:coal"),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has("minecraft:basalt", "family:basalt"),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has("minecraft:smooth_basalt", "family:basalt"),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has(
                "minecraft:polished_basalt",
                "family:basalt",
            ),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has(
                "minecraft:cobblestone",
                "kind:cobblestone",
            ),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has(
                "minecraft:mossy_cobblestone",
                "kind:cobblestone",
            ),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has(
                "minecraft:infested_cobblestone",
                "kind:cobblestone",
            ),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has(
                "minecraft:cobblestone_wall",
                "kind:cobblestone",
            ),
        ).toBe(false);
        expect(
            vanillaBlockCatalog.has(
                "minecraft:cracked_stone_bricks",
                "kind:cracked_stone_bricks",
            ),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has(
                "minecraft:cracked_stone_bricks",
                "kind:stone_bricks",
            ),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has(
                "minecraft:infested_cracked_stone_bricks",
                "kind:cracked_stone_bricks",
            ),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has(
                "minecraft:stone_bricks",
                "kind:stone_bricks",
            ),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has(
                "minecraft:mossy_stone_bricks",
                "kind:stone_bricks",
            ),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has(
                "minecraft:stone_brick_wall",
                "kind:stone_bricks",
            ),
        ).toBe(false);
        expect(
            vanillaBlockCatalog.has(
                "minecraft:diamond_block",
                "family:diamond",
            ),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has("minecraft:diamond_ore", "family:diamond"),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has(
                "minecraft:deepslate_diamond_ore",
                "family:diamond",
            ),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has("minecraft:lapis_block", "family:lapis"),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has("minecraft:lapis_ore", "family:lapis"),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has(
                "minecraft:deepslate_lapis_ore",
                "family:lapis",
            ),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has(
                "minecraft:chiseled_bookshelf",
                "family:chiseled",
            ),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has(
                "minecraft:chiseled_copper",
                "family:chiseled",
            ),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has(
                "minecraft:chiseled_tuff",
                "family:chiseled",
            ),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has("minecraft:chiseled_tuff", "family:tuff"),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has(
                "minecraft:tuff_bricks",
                "family:tuff_bricks",
            ),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has(
                "minecraft:tuff_brick_wall",
                "family:tuff_bricks",
            ),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has(
                "minecraft:chiseled_tuff_bricks",
                "family:chiseled",
            ),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has(
                "minecraft:chiseled_tuff_bricks",
                "family:tuff_bricks",
            ),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has(
                "minecraft:nether_brick",
                "family:nether_bricks",
            ),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has(
                "minecraft:nether_brick_fence",
                "family:nether_bricks",
            ),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has(
                "minecraft:chiseled_nether_bricks",
                "family:chiseled",
            ),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has(
                "minecraft:chiseled_nether_bricks",
                "family:nether_bricks",
            ),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has("minecraft:gold_ore", "family:gold"),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has(
                "minecraft:deepslate_gold_ore",
                "family:gold",
            ),
        ).toBe(true);
        expect(vanillaBlockCatalog.has("minecraft:water", "family:water")).toBe(
            true,
        );
        expect(vanillaBlockCatalog.has("minecraft:water", "kind:liquid")).toBe(
            true,
        );
        expect(
            vanillaBlockCatalog.has("minecraft:flowing_water", "family:water"),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has("minecraft:flowing_water", "kind:liquid"),
        ).toBe(true);
        expect(vanillaBlockCatalog.has("minecraft:lava", "family:lava")).toBe(
            true,
        );
        expect(vanillaBlockCatalog.has("minecraft:lava", "kind:liquid")).toBe(
            true,
        );
        expect(
            vanillaBlockCatalog.has("minecraft:flowing_lava", "family:lava"),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has("minecraft:flowing_lava", "kind:liquid"),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has("minecraft:bubble_column", "kind:liquid"),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has("minecraft:bubble_column", "family:water"),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has("minecraft:waterlily", "kind:liquid"),
        ).toBe(false);
        expect(
            vanillaBlockCatalog.has(
                "minecraft:underwater_torch",
                "kind:liquid",
            ),
        ).toBe(false);
        expect(
            vanillaBlockCatalog.has(
                "minecraft:emerald_block",
                "family:emerald",
            ),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has("minecraft:emerald_ore", "family:emerald"),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has(
                "minecraft:deepslate_emerald_ore",
                "family:emerald",
            ),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has("minecraft:nether_gold_ore", "family:gold"),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has(
                "minecraft:raw_gold_block",
                "family:raw_gold",
            ),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has("minecraft:raw_gold_block", "family:gold"),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has(
                "minecraft:raw_iron_block",
                "family:raw_iron",
            ),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has("minecraft:golden_rail", "family:gold"),
        ).toBe(false);
        expect(
            vanillaBlockCatalog.has(
                "minecraft:golden_dandelion",
                "family:gold",
            ),
        ).toBe(false);
        expect(
            vanillaBlockCatalog.has("minecraft:deepslate_iron_ore", "kind:ore"),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has("minecraft:nether_gold_ore", "kind:ore"),
        ).toBe(true);
        expect(vanillaBlockCatalog.has("minecraft:torch", "kind:torch")).toBe(
            true,
        );
        expect(
            vanillaBlockCatalog.has("minecraft:redstone_torch", "kind:torch"),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has(
                "minecraft:colored_torch_blue",
                "kind:torch",
            ),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has(
                "minecraft:colored_torch_blue",
                "color:blue",
            ),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has(
                "minecraft:colored_torch_green",
                "color:green",
            ),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has(
                "minecraft:colored_torch_purple",
                "color:purple",
            ),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has("minecraft:colored_torch_red", "color:red"),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has("minecraft:redstone_torch", "color:red"),
        ).toBe(false);
        expect(
            vanillaBlockCatalog.has(
                "minecraft:redstone_torch",
                "kind:redstone",
            ),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has("minecraft:torchflower", "kind:torch"),
        ).toBe(false);
        expect(
            vanillaBlockCatalog.has("minecraft:copper_torch", "kind:redstone"),
        ).toBe(false);
        expect(
            vanillaBlockCatalog.has("minecraft:campfire", "kind:campfire"),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has("minecraft:campfire", "kind:utility"),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has("minecraft:campfire", "kind:storage"),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has("minecraft:soul_campfire", "kind:campfire"),
        ).toBe(true);
        expect(vanillaBlockCatalog.has("minecraft:fire", "kind:fire")).toBe(
            true,
        );
        expect(
            vanillaBlockCatalog.has("minecraft:soul_fire", "kind:fire"),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has("minecraft:fire_coral", "kind:fire"),
        ).toBe(false);
        expect(
            vanillaBlockCatalog.has("minecraft:lantern", "kind:lantern"),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has("minecraft:lantern", "kind:utility"),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has("minecraft:soul_lantern", "kind:lantern"),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has("minecraft:copper_lantern", "kind:lantern"),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has("minecraft:copper_lantern", "kind:utility"),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has("minecraft:sea_lantern", "kind:lantern"),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has("minecraft:sea_lantern", "kind:utility"),
        ).toBe(false);
        expect(vanillaBlockCatalog.has("minecraft:sand", "kind:sand")).toBe(
            true,
        );
        expect(vanillaBlockCatalog.has("minecraft:red_sand", "kind:sand")).toBe(
            true,
        );
        expect(
            vanillaBlockCatalog.has("minecraft:suspicious_sand", "kind:sand"),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has("minecraft:soul_sand", "kind:sand"),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has("minecraft:sandstone", "kind:sand"),
        ).toBe(false);
        expect(vanillaBlockCatalog.has("minecraft:sand", "kind:gravity")).toBe(
            true,
        );
        expect(
            vanillaBlockCatalog.has("minecraft:soul_sand", "kind:gravity"),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has("minecraft:gravel", "kind:gravity"),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has(
                "minecraft:suspicious_gravel",
                "kind:gravity",
            ),
        ).toBe(true);
        expect(vanillaBlockCatalog.has("minecraft:anvil", "kind:gravity")).toBe(
            true,
        );
        expect(
            vanillaBlockCatalog.has(
                "minecraft:white_concrete_powder",
                "kind:gravity",
            ),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has("minecraft:dragon_egg", "kind:gravity"),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has("minecraft:scaffolding", "kind:gravity"),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has(
                "minecraft:pointed_dripstone",
                "kind:gravity",
            ),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has("minecraft:sandstone", "kind:gravity"),
        ).toBe(false);
        expect(vanillaBlockCatalog.has("minecraft:snow", "kind:snow")).toBe(
            true,
        );
        expect(
            vanillaBlockCatalog.has("minecraft:powder_snow", "kind:snow"),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has("minecraft:snow_layer", "kind:snow"),
        ).toBe(true);
        expect(vanillaBlockCatalog.has("minecraft:dirt", "kind:dirt")).toBe(
            true,
        );
        expect(
            vanillaBlockCatalog.has("minecraft:coarse_dirt", "kind:dirt"),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has("minecraft:dirt_with_roots", "kind:dirt"),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has("minecraft:grass_block", "kind:dirt"),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has("minecraft:grass_path", "kind:dirt"),
        ).toBe(true);
        expect(vanillaBlockCatalog.has("minecraft:farmland", "kind:dirt")).toBe(
            true,
        );
        expect(vanillaBlockCatalog.has("minecraft:podzol", "kind:dirt")).toBe(
            true,
        );
        expect(vanillaBlockCatalog.has("minecraft:mycelium", "kind:dirt")).toBe(
            true,
        );
        expect(vanillaBlockCatalog.has("minecraft:mud", "kind:dirt")).toBe(
            true,
        );
        expect(
            vanillaBlockCatalog.has(
                "minecraft:muddy_mangrove_roots",
                "kind:dirt",
            ),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has("minecraft:tall_grass", "kind:dirt"),
        ).toBe(false);
        expect(vanillaBlockCatalog.has("minecraft:seagrass", "kind:dirt")).toBe(
            false,
        );
        expect(
            vanillaBlockCatalog.has(
                "minecraft:stripped_bamboo_block",
                "kind:stripped",
            ),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has(
                "minecraft:stripped_bamboo_block",
                "family:bamboo",
            ),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has(
                "minecraft:stripped_oak_log",
                "kind:stripped",
            ),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has("minecraft:stripped_oak_log", "family:oak"),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has("minecraft:bamboo_block", "kind:stripped"),
        ).toBe(false);
        expect(vanillaBlockCatalog.has("minecraft:anvil", "kind:utility")).toBe(
            true,
        );
        expect(
            vanillaBlockCatalog.has("minecraft:stone_button", "kind:redstone"),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has(
                "minecraft:light_weighted_pressure_plate",
                "kind:redstone",
            ),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has("minecraft:barrel", "kind:storage"),
        ).toBe(true);
        expect(vanillaBlockCatalog.has("minecraft:bed", "kind:utility")).toBe(
            true,
        );
        expect(
            vanillaBlockCatalog.has("minecraft:bedrock", "kind:utility"),
        ).toBe(false);
        expect(
            vanillaBlockCatalog.has("minecraft:crafting_table", "kind:utility"),
        ).toBe(true);
        expect(vanillaBlockCatalog.has("minecraft:chest", "kind:storage")).toBe(
            true,
        );
        expect(
            vanillaBlockCatalog.has("minecraft:copper_chest", "kind:storage"),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has("minecraft:ender_chest", "kind:storage"),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has("minecraft:trapped_chest", "kind:storage"),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has("minecraft:cauldron", "kind:storage"),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has("minecraft:furnace", "kind:storage"),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has("minecraft:blast_furnace", "kind:storage"),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has("minecraft:lit_smoker", "kind:storage"),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has("minecraft:brewing_stand", "kind:storage"),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has(
                "minecraft:chiseled_bookshelf",
                "kind:storage",
            ),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has("minecraft:decorated_pot", "kind:storage"),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has("minecraft:flower_pot", "kind:storage"),
        ).toBe(true);
        expect(vanillaBlockCatalog.has("minecraft:frame", "kind:storage")).toBe(
            true,
        );
        expect(
            vanillaBlockCatalog.has("minecraft:glow_frame", "kind:storage"),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has("minecraft:hopper", "kind:storage"),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has("minecraft:lectern", "kind:storage"),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has("minecraft:redstone_torch", "kind:storage"),
        ).toBe(false);
        expect(
            vanillaBlockCatalog.has("minecraft:chemical_heat", "kind:utility"),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has("minecraft:underwater_tnt", "kind:utility"),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has(
                "minecraft:underwater_tnt",
                "kind:redstone",
            ),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has("minecraft:mob_spawner", "kind:utility"),
        ).toBe(true);
        expect(vanillaBlockCatalog.has("minecraft:vault", "kind:utility")).toBe(
            true,
        );
        expect(
            vanillaBlockCatalog.has("minecraft:sculk_sensor", "kind:utility"),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has("minecraft:black_candle", "kind:utility"),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has("minecraft:acacia_door", "kind:utility"),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has("minecraft:oak_fence", "kind:utility"),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has("minecraft:standing_sign", "kind:utility"),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has("minecraft:redstone_torch", "kind:utility"),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has("minecraft:lever", "kind:redstone"),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has("minecraft:observer", "kind:redstone"),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has(
                "minecraft:powered_repeater",
                "kind:redstone",
            ),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has(
                "minecraft:unpowered_comparator",
                "kind:redstone",
            ),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has("minecraft:target", "kind:redstone"),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has("minecraft:tripwire_hook", "kind:redstone"),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has("minecraft:trip_wire", "kind:redstone"),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has("minecraft:golden_rail", "kind:redstone"),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has("minecraft:detector_rail", "kind:redstone"),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has(
                "minecraft:activator_rail",
                "kind:redstone",
            ),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has("minecraft:redstone_lamp", "kind:redstone"),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has("minecraft:redstone_wire", "kind:redstone"),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has("minecraft:hopper", "kind:redstone"),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has("minecraft:dispenser", "kind:redstone"),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has("minecraft:dropper", "kind:redstone"),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has("minecraft:crafter", "kind:redstone"),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has(
                "minecraft:daylight_detector",
                "kind:redstone",
            ),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has("minecraft:noteblock", "kind:redstone"),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has(
                "minecraft:calibrated_sculk_sensor",
                "kind:redstone",
            ),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has("minecraft:trapped_chest", "kind:redstone"),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has("minecraft:iron_door", "kind:redstone"),
        ).toBe(false);
        expect(vanillaBlockCatalog.has("minecraft:rail", "kind:redstone")).toBe(
            false,
        );
        expect(
            vanillaBlockCatalog.has(
                "minecraft:sculk_shrieker",
                "kind:redstone",
            ),
        ).toBe(false);
        expect(
            vanillaBlockCatalog.has(
                "minecraft:undyed_shulker_box",
                "kind:utility",
            ),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has("minecraft:copper_chest", "kind:utility"),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has("minecraft:glow_frame", "kind:utility"),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has("minecraft:lightning_rod", "kind:utility"),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has("minecraft:dragon_head", "kind:utility"),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has("minecraft:dragon_head", "kind:skull"),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has("minecraft:skeleton_skull", "kind:utility"),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has("minecraft:skeleton_skull", "kind:skull"),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has("minecraft:copper_bulb", "kind:utility"),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has("minecraft:decorated_pot", "kind:utility"),
        ).toBe(false);
        expect(
            vanillaBlockCatalog.has(
                "minecraft:cave_vines_head_with_berries",
                "kind:skull",
            ),
        ).toBe(false);
        expect(
            vanillaBlockCatalog.has("minecraft:allow", "feature:education"),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has(
                "minecraft:border_block",
                "feature:education",
            ),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has("minecraft:camera", "feature:education"),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has(
                "minecraft:chemical_heat",
                "feature:education",
            ),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has(
                "minecraft:element_118",
                "feature:education",
            ),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has(
                "minecraft:element_constructor",
                "feature:education",
            ),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has(
                "minecraft:hard_glass",
                "feature:education",
            ),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has(
                "minecraft:hard_red_stained_glass_pane",
                "feature:education",
            ),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has("minecraft:lab_table", "feature:education"),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has(
                "minecraft:material_reducer",
                "feature:education",
            ),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has(
                "minecraft:underwater_tnt",
                "feature:education",
            ),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has(
                "minecraft:underwater_torch",
                "feature:education",
            ),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has(
                "minecraft:hardened_clay",
                "feature:education",
            ),
        ).toBe(false);
        expect(
            vanillaBlockCatalog.has("minecraft:brain_coral", "kind:coral"),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has("minecraft:brain_coral", "family:brain"),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has(
                "minecraft:brain_coral_block",
                "kind:coral",
            ),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has(
                "minecraft:brain_coral_block",
                "kind:coral_block",
            ),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has("minecraft:brain_coral_fan", "kind:coral"),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has(
                "minecraft:brain_coral_fan",
                "kind:coral_fan",
            ),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has(
                "minecraft:brain_coral_fan",
                "family:brain",
            ),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has(
                "minecraft:brain_coral_wall_fan",
                "kind:coral",
            ),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has(
                "minecraft:brain_coral_wall_fan",
                "kind:wall_coral_fan",
            ),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has(
                "minecraft:dead_brain_coral_fan",
                "kind:coral",
            ),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has(
                "minecraft:dead_brain_coral_fan",
                "kind:coral_fan",
            ),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has(
                "minecraft:dead_brain_coral_fan",
                "family:brain",
            ),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has("minecraft:andesite_wall", "kind:wall"),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has("minecraft:oak_leaves", "kind:leaf"),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has("minecraft:warped_stem", "family:warped"),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has("minecraft:warped_stem", "kind:stem"),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has(
                "minecraft:brown_mushroom",
                "kind:mushroom",
            ),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has("minecraft:red_mushroom", "kind:mushroom"),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has(
                "minecraft:brown_mushroom_block",
                "kind:mushroom_block",
            ),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has(
                "minecraft:red_mushroom_block",
                "kind:mushroom_block",
            ),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has(
                "minecraft:mushroom_stem",
                "kind:mushroom_block",
            ),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has("minecraft:mushroom_stem", "kind:stem"),
        ).toBe(false);
        expect(
            vanillaBlockCatalog.has(
                "minecraft:mushroom_stem",
                "family:mushroom",
            ),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has(
                "minecraft:brown_mushroom_block",
                "family:mushroom",
            ),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has(
                "minecraft:red_mushroom_block",
                "family:mushroom",
            ),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has("minecraft:mycelium", "family:mushroom"),
        ).toBe(true);
        expect(vanillaBlockCatalog.has("minecraft:carrots", "kind:crop")).toBe(
            true,
        );
        expect(
            vanillaBlockCatalog.has("minecraft:pumpkin", "family:pumpkin"),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has(
                "minecraft:carved_pumpkin",
                "family:pumpkin",
            ),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has("minecraft:lit_pumpkin", "family:pumpkin"),
        ).toBe(true);
        expect(vanillaBlockCatalog.has("minecraft:potatoes", "kind:crop")).toBe(
            true,
        );
        expect(vanillaBlockCatalog.has("minecraft:beetroot", "kind:crop")).toBe(
            true,
        );
        expect(vanillaBlockCatalog.has("minecraft:wheat", "kind:crop")).toBe(
            true,
        );
        expect(
            vanillaBlockCatalog.has("minecraft:sweet_berry_bush", "kind:crop"),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has("minecraft:torchflower_crop", "kind:crop"),
        ).toBe(true);
        expect(vanillaBlockCatalog.has("minecraft:cocoa", "kind:crop")).toBe(
            true,
        );
        expect(vanillaBlockCatalog.has("minecraft:kelp", "kind:crop")).toBe(
            true,
        );
        expect(
            vanillaBlockCatalog.has(
                "minecraft:cave_vines_head_with_berries",
                "kind:crop",
            ),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has("minecraft:melon_block", "kind:crop"),
        ).toBe(true);
        expect(vanillaBlockCatalog.has("minecraft:pumpkin", "kind:crop")).toBe(
            true,
        );
        expect(
            vanillaBlockCatalog.has(
                "minecraft:command_block",
                "kind:command_block",
            ),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has(
                "minecraft:command_block",
                "kind:technical",
            ),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has(
                "minecraft:chain_command_block",
                "kind:command_block",
            ),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has(
                "minecraft:chain_command_block",
                "kind:technical",
            ),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has(
                "minecraft:repeating_command_block",
                "kind:command_block",
            ),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has(
                "minecraft:repeating_command_block",
                "kind:technical",
            ),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has("minecraft:jigsaw", "kind:technical"),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has(
                "minecraft:structure_block",
                "kind:technical",
            ),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has(
                "minecraft:structure_void",
                "kind:technical",
            ),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has("minecraft:barrier", "kind:technical"),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has("minecraft:border_block", "kind:technical"),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has("minecraft:allow", "kind:technical"),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has("minecraft:deny", "kind:technical"),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has(
                "minecraft:light_block_0",
                "kind:technical",
            ),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has(
                "minecraft:light_block_15",
                "kind:technical",
            ),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has("minecraft:mob_spawner", "kind:technical"),
        ).toBe(false);
        expect(
            vanillaBlockCatalog.has(
                "minecraft:trial_spawner",
                "kind:technical",
            ),
        ).toBe(false);
        expect(
            vanillaBlockCatalog.has("minecraft:vault", "kind:technical"),
        ).toBe(false);
        expect(
            vanillaBlockCatalog.has("minecraft:acacia_wood", "kind:wood"),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has("minecraft:acacia_wood", "kind:log"),
        ).toBe(false);
        expect(
            vanillaBlockCatalog.has(
                "minecraft:light_blue_wool",
                "color:light_blue",
            ),
        ).toBe(true);
        expect(vanillaBlockCatalog.has("minecraft:glass", "kind:glass")).toBe(
            true,
        );
        expect(
            vanillaBlockCatalog.has("minecraft:glass_pane", "kind:glass"),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has("minecraft:glass_pane", "kind:glass_pane"),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has("minecraft:hard_glass", "kind:glass"),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has("minecraft:hard_glass_pane", "kind:glass"),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has(
                "minecraft:hard_glass_pane",
                "kind:glass_pane",
            ),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has("minecraft:tinted_glass", "kind:glass"),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has(
                "minecraft:hardened_clay",
                "kind:terracotta",
            ),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has("minecraft:light_blue_wool", "kind:wool"),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has("minecraft:azalea_leaves", "family:azalea"),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has("minecraft:azalea", "family:azalea"),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has(
                "minecraft:flowering_azalea",
                "family:azalea",
            ),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has("minecraft:andesite", "family:andesite"),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has(
                "minecraft:andesite_wall",
                "family:andesite",
            ),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has("minecraft:deepslate", "family:deepslate"),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has("minecraft:end_stone", "family:end_stone"),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has(
                "minecraft:end_stone_brick_wall",
                "family:end_stone",
            ),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has(
                "minecraft:infested_deepslate",
                "family:infested",
            ),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has(
                "minecraft:infested_mossy_stone_bricks",
                "family:infested",
            ),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has(
                "minecraft:mossy_cobblestone",
                "family:mossy",
            ),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has(
                "minecraft:mossy_cobblestone",
                "family:cobblestone",
            ),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has(
                "minecraft:mossy_stone_bricks",
                "family:mossy",
            ),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has(
                "minecraft:mossy_stone_bricks",
                "family:stone_bricks",
            ),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has(
                "minecraft:infested_cobblestone",
                "family:cobblestone",
            ),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has(
                "minecraft:infested_cracked_stone_bricks",
                "family:stone_bricks",
            ),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has(
                "minecraft:infested_stone",
                "family:infested",
            ),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has(
                "minecraft:cobbled_deepslate",
                "family:deepslate",
            ),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has(
                "minecraft:deepslate_tile_wall",
                "family:deepslate",
            ),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has(
                "minecraft:chiseled_copper",
                "family:copper",
            ),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has("minecraft:cut_copper", "family:copper"),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has(
                "minecraft:cut_copper",
                "family:cut_copper",
            ),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has(
                "minecraft:exposed_copper",
                "family:exposed_copper",
            ),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has(
                "minecraft:weathered_cut_copper",
                "family:copper",
            ),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has(
                "minecraft:raw_copper_block",
                "family:copper",
            ),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has("minecraft:end_bricks", "family:end_brick"),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has(
                "minecraft:blackstone",
                "family:blackstone",
            ),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has(
                "minecraft:gilded_blackstone",
                "family:blackstone",
            ),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has(
                "minecraft:polished_blackstone",
                "family:blackstone",
            ),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has(
                "minecraft:polished_blackstone",
                "family:polished_blackstone",
            ),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has(
                "minecraft:chiseled_polished_blackstone",
                "family:chiseled",
            ),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has(
                "minecraft:chiseled_polished_blackstone",
                "family:blackstone",
            ),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has(
                "minecraft:chiseled_polished_blackstone",
                "family:polished_blackstone",
            ),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has(
                "minecraft:polished_blackstone_bricks",
                "family:blackstone",
            ),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has(
                "minecraft:polished_blackstone_bricks",
                "family:polished_blackstone",
            ),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has(
                "minecraft:polished_blackstone_bricks",
                "family:polished_blackstone_bricks",
            ),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has(
                "minecraft:cracked_polished_blackstone_bricks",
                "family:blackstone",
            ),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has(
                "minecraft:cracked_polished_blackstone_bricks",
                "family:polished_blackstone_bricks",
            ),
        ).toBe(true);
        expect(vanillaBlockCatalog.has("minecraft:sculk", "family:sculk")).toBe(
            true,
        );
        expect(
            vanillaBlockCatalog.has("minecraft:sculk_vein", "family:sculk"),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has("minecraft:sculk_sensor", "family:sculk"),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has("minecraft:sculk_shrieker", "family:sculk"),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has(
                "minecraft:calibrated_sculk_sensor",
                "family:sculk",
            ),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has(
                "minecraft:amethyst_block",
                "family:amethyst",
            ),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has(
                "minecraft:amethyst_cluster",
                "family:amethyst",
            ),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has(
                "minecraft:budding_amethyst",
                "family:amethyst",
            ),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has(
                "minecraft:large_amethyst_bud",
                "family:amethyst",
            ),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has("minecraft:dandelion", "kind:flower"),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has(
                "minecraft:golden_dandelion",
                "kind:flower",
            ),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has(
                "minecraft:golden_dandelion",
                "kind:foliage",
            ),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has("minecraft:sunflower", "kind:flower"),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has(
                "minecraft:azalea_leaves_flowered",
                "kind:flower",
            ),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has(
                "minecraft:azalea_leaves_flowered",
                "kind:leaf",
            ),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has(
                "minecraft:azalea_leaves_flowered",
                "kind:foliage",
            ),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has("minecraft:cherry_leaves", "kind:flower"),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has("minecraft:cherry_leaves", "kind:foliage"),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has("minecraft:azalea", "kind:foliage"),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has("minecraft:bamboo", "kind:foliage"),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has("minecraft:big_dripleaf", "kind:foliage"),
        ).toBe(true);
        expect(vanillaBlockCatalog.has("minecraft:bush", "kind:foliage")).toBe(
            true,
        );
        expect(
            vanillaBlockCatalog.has("minecraft:cactus", "kind:foliage"),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has("minecraft:cave_vines", "kind:foliage"),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has(
                "minecraft:cave_vines_head_with_berries",
                "kind:foliage",
            ),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has("minecraft:chorus_plant", "kind:foliage"),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has("minecraft:crimson_roots", "kind:foliage"),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has("minecraft:deadbush", "kind:foliage"),
        ).toBe(true);
        expect(vanillaBlockCatalog.has("minecraft:fern", "kind:foliage")).toBe(
            true,
        );
        expect(
            vanillaBlockCatalog.has(
                "minecraft:flowering_azalea",
                "kind:foliage",
            ),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has("minecraft:glow_lichen", "kind:foliage"),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has("minecraft:hanging_roots", "kind:foliage"),
        ).toBe(true);
        expect(vanillaBlockCatalog.has("minecraft:kelp", "kind:foliage")).toBe(
            true,
        );
        expect(
            vanillaBlockCatalog.has("minecraft:leaf_litter", "kind:foliage"),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has(
                "minecraft:mangrove_propagule",
                "kind:foliage",
            ),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has("minecraft:moss_block", "kind:foliage"),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has("minecraft:moss_carpet", "kind:foliage"),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has("minecraft:nether_sprouts", "kind:foliage"),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has(
                "minecraft:pale_hanging_moss",
                "kind:foliage",
            ),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has("minecraft:seagrass", "kind:foliage"),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has("minecraft:short_grass", "kind:foliage"),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has(
                "minecraft:small_dripleaf_block",
                "kind:foliage",
            ),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has("minecraft:tall_grass", "kind:foliage"),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has("minecraft:twisting_vines", "kind:foliage"),
        ).toBe(true);
        expect(vanillaBlockCatalog.has("minecraft:vine", "kind:foliage")).toBe(
            true,
        );
        expect(
            vanillaBlockCatalog.has("minecraft:warped_roots", "kind:foliage"),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has("minecraft:waterlily", "kind:foliage"),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has("minecraft:weeping_vines", "kind:foliage"),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has("minecraft:flower_pot", "kind:foliage"),
        ).toBe(false);
        expect(
            vanillaBlockCatalog.has(
                "minecraft:mossy_cobblestone",
                "kind:foliage",
            ),
        ).toBe(false);
        expect(
            vanillaBlockCatalog.has("minecraft:grass_block", "kind:foliage"),
        ).toBe(false);
        expect(
            vanillaBlockCatalog.has("minecraft:warped_fungus", "family:warped"),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has(
                "minecraft:nether_wart_block",
                "family:nether",
            ),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has(
                "minecraft:nether_wart_block",
                "kind:wart_block",
            ),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has(
                "minecraft:warped_wart_block",
                "family:warped",
            ),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has(
                "minecraft:warped_wart_block",
                "kind:wart_block",
            ),
        ).toBe(true);
        expect(vanillaBlockCatalog.has("minecraft:allow", "kind:allow")).toBe(
            true,
        );
        expect(
            vanillaBlockCatalog.has("minecraft:allow", "kind:permission_block"),
        ).toBe(true);
        expect(vanillaBlockCatalog.has("minecraft:deny", "kind:deny")).toBe(
            true,
        );
        expect(
            vanillaBlockCatalog.has("minecraft:deny", "kind:permission_block"),
        ).toBe(true);
        expect(
            vanillaBlockCatalog.has("minecraft:cocoa", "kind:attachment"),
        ).toBe(true);
        expect(vanillaBlockCatalog.has("minecraft:cocoa", "kind:cocoa")).toBe(
            true,
        );
        expect(vanillaBlockCatalog.has("minecraft:air", "kind:air")).toBe(
            false,
        );
    });

    it("creates a public BlockCatalog class", () => {
        const catalog = new BlockCatalog([]);
        expect(catalog.entries()).toEqual([]);
    });
});
