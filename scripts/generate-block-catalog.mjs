import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { MinecraftBlockTypes } from "@minecraft/vanilla-data";

const scriptDir = fileURLToPath(new URL(".", import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const outputDataPath = path.resolve(
    repoRoot,
    "src",
    "catalog",
    "generated",
    "vanilla-block-catalog.data.json",
);
const reportPath = path.resolve(
    repoRoot,
    "temp",
    "catalog",
    "vanilla-block-catalog.report.json",
);
const UNEXPECTED_EMPTY_PREVIEW_LIMIT = 25;
const cliOptions = parseCliOptions(process.argv.slice(2));

const COLOR_NAMES = [
    "black",
    "blue",
    "brown",
    "cyan",
    "gray",
    "green",
    "light_blue",
    "light_gray",
    "lime",
    "magenta",
    "orange",
    "pink",
    "purple",
    "red",
    "white",
    "yellow",
].sort((left, right) => right.length - left.length);
const COLOR_NAME_TOKENS = COLOR_NAMES.map((colorName) => ({
    colorName,
    tokens: colorName.split("_"),
})).sort((left, right) => {
    if (right.tokens.length !== left.tokens.length) {
        return right.tokens.length - left.tokens.length;
    }

    return right.colorName.length - left.colorName.length;
});
const EDUCATION_FEATURE_TAG = "feature:education";
const EDUCATION_BLOCK_IDS = Object.freeze([
    "minecraft:allow",
    "minecraft:border_block",
    "minecraft:camera",
    "minecraft:chemical_heat",
    "minecraft:colored_torch_blue",
    "minecraft:colored_torch_green",
    "minecraft:colored_torch_purple",
    "minecraft:colored_torch_red",
    "minecraft:compound_creator",
    "minecraft:deny",
    "minecraft:element_constructor",
    "minecraft:lab_table",
    "minecraft:material_reducer",
    "minecraft:underwater_tnt",
    "minecraft:underwater_torch",
]);
const EDUCATION_BLOCK_ID_SET = new Set(EDUCATION_BLOCK_IDS);
const EDUCATION_BLOCK_ID_PREFIXES = Object.freeze([
    "minecraft:element_",
    "minecraft:hard_",
]);
const DIRT_LIKE_BLOCK_NAMES = new Set([
    "coarse_dirt",
    "dirt",
    "dirt_with_roots",
    "farmland",
    "grass_block",
    "grass_path",
    "mud",
    "muddy_mangrove_roots",
    "mycelium",
    "podzol",
    "rooted_dirt",
]);
const UTILITY_EXACT_BLOCK_NAMES = new Set([
    "anvil",
    "barrel",
    "beacon",
    "bed",
    "bee_nest",
    "beehive",
    "bell",
    "blast_furnace",
    "bookshelf",
    "brewing_stand",
    "cake",
    "calibrated_sculk_sensor",
    "cartography_table",
    "cauldron",
    "chemical_heat",
    "chipped_anvil",
    "chiseled_bookshelf",
    "composter",
    "compound_creator",
    "conduit",
    "crafter",
    "crafting_table",
    "damaged_anvil",
    "dispenser",
    "dropper",
    "element_constructor",
    "enchanting_table",
    "end_portal",
    "farmland",
    "flower_pot",
    "fletching_table",
    "frosted_ice",
    "furnace",
    "grindstone",
    "honey_block",
    "hopper",
    "jukebox",
    "lab_table",
    "ladder",
    "lectern",
    "lit_blast_furnace",
    "lit_furnace",
    "lit_smoker",
    "lodestone",
    "loom",
    "material_reducer",
    "mob_spawner",
    "note_block",
    "portal",
    "respawn_anchor",
    "scaffolding",
    "sculk_catalyst",
    "sculk_sensor",
    "sculk_shrieker",
    "sea_pickle",
    "slime",
    "smithing_table",
    "smoker",
    "sniffer_egg",
    "sponge",
    "stonecutter_block",
    "suspicious_gravel",
    "suspicious_sand",
    "tnt",
    "trial_spawner",
    "turtle_egg",
    "underwater_tnt",
    "vault",
    "wet_sponge",
]);
const UTILITY_IMPLIED_KIND_TAGS = new Set([
    "kind:campfire",
    "kind:candle",
    "kind:door",
    "kind:fence",
    "kind:fence_gate",
    "kind:shulker_box",
    "kind:sign",
    "kind:torch",
    "kind:trapdoor",
]);
const STORAGE_EXACT_BLOCK_NAMES = new Set([
    "barrel",
    "brewing_stand",
    "chiseled_bookshelf",
    "decorated_pot",
    "dispenser",
    "dropper",
    "flower_pot",
    "glow_frame",
    "frame",
    "hopper",
    "jukebox",
    "lectern",
    "lit_smoker",
    "smoker",
]);
const STORAGE_IMPLIED_KIND_TAGS = new Set([
    "kind:campfire",
    "kind:shulker_box",
]);
const GRAVITY_EXACT_BLOCK_NAMES = new Set([
    "anvil",
    "chipped_anvil",
    "damaged_anvil",
    "dragon_egg",
    "gravel",
    "pointed_dripstone",
    "scaffolding",
    "suspicious_gravel",
]);
const GRAVITY_IMPLIED_KIND_TAGS = new Set([
    "kind:concrete_powder",
    "kind:sand",
]);
const FOLIAGE_EXACT_BLOCK_NAMES = new Set([
    "azalea",
    "bamboo",
    "big_dripleaf",
    "bush",
    "cactus",
    "cave_vines",
    "chorus_plant",
    "crimson_roots",
    "deadbush",
    "fern",
    "firefly_bush",
    "glow_lichen",
    "hanging_roots",
    "kelp",
    "large_fern",
    "leaf_litter",
    "mangrove_roots",
    "moss_block",
    "moss_carpet",
    "nether_sprouts",
    "pale_hanging_moss",
    "pale_moss_block",
    "pale_moss_carpet",
    "seagrass",
    "short_dry_grass",
    "short_grass",
    "small_dripleaf_block",
    "tall_dry_grass",
    "tall_grass",
    "twisting_vines",
    "warped_roots",
    "waterlily",
    "weeping_vines",
]);
const FOLIAGE_IMPLIED_KIND_TAGS = new Set([
    "kind:crop",
    "kind:flower",
    "kind:leaf",
    "kind:sapling",
    "kind:vine",
]);
const REDSTONE_EXACT_BLOCK_NAMES = new Set([
    "activator_rail",
    "calibrated_sculk_sensor",
    "chain_command_block",
    "command_block",
    "crafter",
    "daylight_detector",
    "daylight_detector_inverted",
    "detector_rail",
    "dispenser",
    "dropper",
    "golden_rail",
    "hopper",
    "jukebox",
    "lever",
    "lit_redstone_lamp",
    "noteblock",
    "observer",
    "piston",
    "powered_comparator",
    "powered_repeater",
    "redstone_block",
    "redstone_lamp",
    "redstone_torch",
    "redstone_wire",
    "repeating_command_block",
    "sculk_sensor",
    "sticky_piston",
    "target",
    "tnt",
    "trapped_chest",
    "trip_wire",
    "tripwire_hook",
    "unlit_redstone_torch",
    "underwater_tnt",
    "unpowered_comparator",
    "unpowered_repeater",
]);
const REDSTONE_IMPLIED_KIND_TAGS = new Set([
    "kind:button",
    "kind:pressure_plate",
]);
const TECHNICAL_EXACT_BLOCK_NAMES = new Set([
    "allow",
    "barrier",
    "border_block",
    "chain_command_block",
    "command_block",
    "deny",
    "jigsaw",
    "repeating_command_block",
    "structure_block",
    "structure_void",
]);
const LIQUID_BLOCK_TAGS_BY_NAME = new Map([
    ["bubble_column", ["family:bubble", "family:water", "kind:liquid"]],
    ["flowing_lava", ["family:lava", "kind:liquid"]],
    ["flowing_water", ["family:water", "kind:liquid"]],
    ["lava", ["family:lava", "kind:liquid"]],
    ["water", ["family:water", "kind:liquid"]],
]);

// Maintenance notes only. This list is intentionally not used by generation.
//
// It exists to record naming mismatches between source pages/search terms and
// the runtime-facing Bedrock block ids we actually tag in the catalog.
//
// Education-related examples:
// - "Heat Block" -> `minecraft:chemical_heat`
// - "Colored Torch" -> `minecraft:colored_torch_blue|green|purple|red`
// - "Compound Creator" -> `minecraft:compound_creator`
// - "Element Constructor" -> `minecraft:element_constructor`
// - "Material Reducer" -> `minecraft:material_reducer`
// - "Allow and Deny" -> `minecraft:allow` / `minecraft:deny`
// - "Border" / "Border Block" -> `minecraft:border_block`
// - "Underwater TNT" -> `minecraft:underwater_tnt`
// - "Underwater Torch" -> `minecraft:underwater_torch`
// - "Hardened Glass" / "Hardened Stained Glass" -> `minecraft:hard_*`
// - "Item Frame" -> `minecraft:frame`
// - "Glow Item Frame" -> `minecraft:glow_frame`
// - "Monster Spawner" -> `minecraft:mob_spawner`
// - "Slime Block" -> `minecraft:slime`
//
// Add future source/runtime naming mismatches here when they are discovered.

const FAMILY_ALIASES = new Map([
    ["darkoak", "dark_oak"],
    ["lightblue", "light_blue"],
    ["lightgray", "light_gray"],
    ["mossy_stone_brick", "mossy_stone_bricks"],
    ["nether_brick", "nether_bricks"],
    ["polished_blackstone_brick", "polished_blackstone_bricks"],
    ["stone_brick", "stone_bricks"],
    ["tuff_brick", "tuff_bricks"],
]);
const INHERITED_FAMILY_STRIP_PREFIXES = Object.freeze([
    "stripped",
    "mossy",
    "cracked",
    "infested",
]);
const UNEXPECTED_EMPTY_ANALYSIS_STRIP_PREFIXES = Object.freeze([
    ...INHERITED_FAMILY_STRIP_PREFIXES,
    "crying",
    "dried",
    "ochre",
    "packed",
    "pearlescent",
    "polished",
    "smooth",
    "sticky",
    "verdant",
]);
const UNEXPECTED_EMPTY_ANALYSIS_FAMILY_SUFFIXES = Object.freeze([
    "block",
    "crop",
    "ore",
]);
const PREFIX_FAMILY_RULES = Object.freeze([
    {
        family: "mossy",
        prefix: "mossy_",
    },
]);
const FAMILY_KEYWORD_RULES = Object.freeze([
    {
        family: "andesite",
        keyword: "andesite",
    },
    {
        family: "basalt",
        keyword: "basalt",
    },
    {
        family: "chiseled",
        keyword: "chiseled_",
    },
    {
        family: "clay",
        keyword: "clay",
    },
    {
        family: "coal",
        keyword: "coal",
    },
    {
        family: "deepslate",
        keyword: "deepslate",
    },
    {
        family: "diamond",
        keyword: "diamond",
    },
    {
        family: "end_stone",
        keyword: "end_stone",
    },
    {
        family: "emerald",
        keyword: "emerald",
    },
    {
        family: "lapis",
        keyword: "lapis",
    },
    {
        family: "copper",
        keyword: "copper",
    },
    {
        family: "gold",
        keyword: "gold_",
    },
    {
        family: "azalea",
        keyword: "azalea",
    },
    {
        family: "amethyst",
        keyword: "amethyst",
    },
    {
        family: "blackstone",
        keyword: "blackstone",
    },
    {
        family: "mushroom",
        keyword: "mushroom",
    },
    {
        family: "polished_blackstone",
        keyword: "polished_blackstone",
    },
    {
        family: "polished_blackstone_bricks",
        keyword: "polished_blackstone_brick",
    },
    {
        family: "mushroom",
        keyword: "mycelium",
    },
    {
        family: "pumpkin",
        keyword: "pumpkin",
    },
    {
        family: "raw_gold",
        keyword: "raw_gold",
    },
    {
        family: "raw_iron",
        keyword: "raw_iron",
    },
    {
        family: "sculk",
        keyword: "sculk",
    },
    {
        family: "tuff",
        keyword: "tuff",
    },
    {
        family: "tuff_bricks",
        keyword: "tuff_brick",
    },
    {
        family: "nether_bricks",
        keyword: "nether_brick",
    },
    {
        family: "infested",
        keyword: "infested",
    },
]);

// Flower blocks are manually aligned to the Minecraft Wiki Flower page.
const FLOWER_BLOCK_IDS = Object.freeze([
    "minecraft:allium",
    "minecraft:azure_bluet",
    "minecraft:blue_orchid",
    "minecraft:cactus_flower",
    "minecraft:cherry_leaves",
    "minecraft:chorus_flower",
    "minecraft:closed_eyeblossom",
    "minecraft:cornflower",
    "minecraft:dandelion",
    "minecraft:flowering_azalea",
    "minecraft:golden_dandelion",
    "minecraft:lilac",
    "minecraft:lily_of_the_valley",
    "minecraft:mangrove_propagule",
    "minecraft:open_eyeblossom",
    "minecraft:orange_tulip",
    "minecraft:oxeye_daisy",
    "minecraft:peony",
    "minecraft:pink_petals",
    "minecraft:pink_tulip",
    "minecraft:pitcher_plant",
    "minecraft:poppy",
    "minecraft:red_tulip",
    "minecraft:rose_bush",
    "minecraft:spore_blossom",
    "minecraft:sunflower",
    "minecraft:torchflower",
    "minecraft:wildflowers",
    "minecraft:wither_rose",
    "minecraft:white_tulip",
    "minecraft:azalea_leaves_flowered",
]);
const FLOWER_BLOCK_ID_SET = new Set(FLOWER_BLOCK_IDS);

// Crop source blocks are aligned to the Minecraft Wiki Food page and
// mapped to the Bedrock block ids that players actually harvest from.
const CROP_BLOCK_IDS = Object.freeze([
    "minecraft:beetroot",
    "minecraft:carrots",
    "minecraft:cave_vines_body_with_berries",
    "minecraft:cave_vines_head_with_berries",
    "minecraft:kelp",
    "minecraft:melon_block",
    "minecraft:potatoes",
    "minecraft:pumpkin",
    "minecraft:sweet_berry_bush",
    "minecraft:torchflower_crop",
    "minecraft:wheat",
]);
const CROP_BLOCK_ID_SET = new Set(CROP_BLOCK_IDS);
const BLOCK_FORM_KIND_RULES = Object.freeze([
    {
        allowedPrefixes: ["infested", "mossy"],
        baseName: "cobblestone",
        kind: "cobblestone",
    },
    {
        allowedPrefixes: ["cracked", "infested", "mossy"],
        baseName: "stone_bricks",
        kind: "stone_bricks",
    },
    {
        allowedPrefixes: ["infested"],
        baseName: "cracked_stone_bricks",
        kind: "cracked_stone_bricks",
    },
]);

const KIND_RULES = [
    {
        suffix: "stained_glass_pane",
        tags: ["kind:glass", "kind:glass_pane"],
        inferColor: true,
    },
    {
        suffix: "glass_pane",
        tags: ["kind:glass", "kind:glass_pane"],
    },
    {
        suffix: "concrete_powder",
        tags: ["kind:concrete", "kind:concrete_powder"],
        inferColor: true,
    },
    {
        suffix: "command_block",
        tags: ["kind:command_block"],
    },
    {
        suffix: "mushroom_block",
        tags: ["kind:mushroom_block"],
    },
    {
        suffix: "mushroom_stem",
        tags: ["kind:mushroom_block"],
        inferFamily: true,
    },
    {
        suffix: "mushroom",
        tags: ["kind:mushroom"],
    },
    {
        suffix: "pressure_plate",
        tags: ["kind:pressure_plate"],
        inferFamily: true,
    },
    {
        suffix: "coral_wall_fan",
        tags: ["kind:coral", "kind:coral_fan", "kind:wall_coral_fan"],
        inferFamily: true,
        stripPrefixes: ["dead"],
    },
    {
        suffix: "coral_block",
        tags: ["kind:coral", "kind:coral_block"],
        inferFamily: true,
        stripPrefixes: ["dead"],
    },
    {
        suffix: "ore",
        tags: ["kind:ore"],
    },
    {
        suffix: "rail",
        tags: ["kind:rail"],
    },
    {
        suffix: "coral_fan",
        tags: ["kind:coral", "kind:coral_fan"],
        inferFamily: true,
        stripPrefixes: ["dead"],
    },
    {
        suffix: "coral",
        tags: ["kind:coral"],
        inferFamily: true,
        stripPrefixes: ["dead"],
    },
    {
        suffix: "ice",
        tags: ["kind:ice"],
    },
    {
        suffix: "glass",
        tags: ["kind:glass"],
    },
    {
        suffix: "glazed_terracotta",
        tags: ["kind:terracotta", "kind:glazed_terracotta"],
        inferColor: true,
    },
    {
        suffix: "hanging_sign",
        tags: ["kind:sign", "kind:hanging_sign"],
        inferFamily: true,
    },
    {
        suffix: "standing_sign",
        tags: ["kind:sign", "kind:standing_sign"],
        inferFamily: true,
    },
    {
        suffix: "standing_banner",
        tags: ["kind:banner", "kind:standing_banner"],
    },
    {
        suffix: "fence_gate",
        tags: ["kind:fence_gate"],
        inferFamily: true,
    },
    {
        suffix: "candle_cake",
        tags: ["kind:cake", "kind:candle"],
        inferColor: true,
    },
    {
        suffix: "leaves_flowered",
        tags: ["kind:leaf"],
        inferFamily: true,
    },
    {
        suffix: "wall_sign",
        tags: ["kind:sign", "kind:wall_sign"],
        inferFamily: true,
    },
    {
        suffix: "wall_banner",
        tags: ["kind:banner", "kind:wall_banner"],
    },
    {
        suffix: "double_slab",
        tags: ["kind:slab", "kind:double_slab"],
        inferFamily: true,
    },
    {
        suffix: "shulker_box",
        tags: ["kind:shulker_box"],
        inferColor: true,
    },
    {
        suffix: "stained_glass",
        tags: ["kind:glass", "kind:stained_glass"],
        inferColor: true,
    },
    {
        suffix: "trapdoor",
        tags: ["kind:trapdoor"],
        inferFamily: true,
    },
    {
        suffix: "terracotta",
        tags: ["kind:terracotta"],
        inferColor: true,
    },
    {
        suffix: "carpet",
        tags: ["kind:carpet"],
        inferColor: true,
    },
    {
        suffix: "button",
        tags: ["kind:button"],
        inferFamily: true,
    },
    {
        suffix: "concrete",
        tags: ["kind:concrete"],
        inferColor: true,
    },
    {
        suffix: "fence",
        tags: ["kind:fence"],
        inferFamily: true,
    },
    {
        suffix: "hyphae",
        tags: ["kind:hyphae"],
        inferFamily: true,
        stripPrefixes: ["stripped"],
    },
    {
        suffix: "leaves",
        tags: ["kind:leaf"],
        inferFamily: true,
    },
    {
        suffix: "planks",
        tags: ["kind:planks"],
        inferFamily: true,
    },
    {
        suffix: "sapling",
        tags: ["kind:sapling"],
        inferFamily: true,
    },
    {
        suffix: "stairs",
        tags: ["kind:stairs"],
        inferFamily: true,
    },
    {
        suffix: "stem",
        tags: ["kind:stem"],
        inferFamily: true,
        stripPrefixes: ["stripped"],
    },
    {
        suffix: "shelf",
        tags: ["kind:shelf"],
        inferFamily: true,
    },
    {
        suffix: "slab",
        tags: ["kind:slab"],
        inferFamily: true,
    },
    {
        suffix: "wart_block",
        tags: ["kind:wart_block"],
        inferFamily: true,
    },
    {
        suffix: "wall",
        tags: ["kind:wall"],
        inferFamily: true,
    },
    {
        suffix: "candle",
        tags: ["kind:candle"],
        inferColor: true,
    },
    {
        suffix: "door",
        tags: ["kind:door"],
        inferFamily: true,
    },
    {
        suffix: "wood",
        tags: ["kind:wood"],
        inferFamily: true,
        stripPrefixes: ["stripped"],
    },
    {
        suffix: "wool",
        tags: ["kind:wool"],
        inferColor: true,
    },
    {
        suffix: "log",
        tags: ["kind:log"],
        inferFamily: true,
        stripPrefixes: ["stripped"],
    },
].sort((left, right) => right.suffix.length - left.suffix.length);

const EXPECTED_EMPTY_BLOCK_IDS = new Set(["minecraft:air"]);
const EXPECTED_EMPTY_BLOCK_ID_PREFIXES = ["minecraft:element_"];

const allBlockIds = Object.freeze(
    [...new Set(Object.values(MinecraftBlockTypes))].sort((left, right) =>
        left.localeCompare(right),
    ),
);
const allBlockIdSet = new Set(allBlockIds);
const initialEntries = allBlockIds.map((id) => ({
    id,
    tags: inferBaseTagsForBlock(id),
}));
const entries = applyFamilyInheritance(initialEntries);
const report = createCatalogReport(entries);
const fileContents = createGeneratedJsonFile(entries);
fs.mkdirSync(path.dirname(outputDataPath), { recursive: true });
fs.mkdirSync(path.dirname(reportPath), { recursive: true });

const currentContents = fs.existsSync(outputDataPath)
    ? fs.readFileSync(outputDataPath, "utf8")
    : undefined;

if (currentContents !== fileContents) {
    fs.writeFileSync(outputDataPath, fileContents, "utf8");
    console.log(
        `[generate-block-catalog] Wrote ${path.relative(repoRoot, outputDataPath)}`,
    );
} else {
    console.log(
        `[generate-block-catalog] ${path.relative(repoRoot, outputDataPath)} is up to date`,
    );
}

fs.writeFileSync(
    reportPath,
    `${JSON.stringify(report, undefined, 2)}\n`,
    "utf8",
);
printCatalogReportSummary(report);
printRequestedReportLists(report, cliOptions);

function inferBaseTagsForBlock(id) {
    const blockName = getBlockName(id);
    const tags = new Set();
    const kindRule = matchKindRule(blockName);

    if (kindRule) {
        for (const tag of kindRule.tags) {
            tags.add(tag);
        }

        const remainder = getRuleRemainder(blockName, kindRule.suffix);
        if (remainder) {
            if (kindRule.inferFamily) {
                const familyName = inferFamilyName(remainder, kindRule);
                if (familyName) {
                    tags.add(`family:${familyName}`);
                }
            }

            if (kindRule.inferColor) {
                const colorName = inferColorName(remainder);
                if (colorName) {
                    tags.add(`color:${colorName}`);
                }
            }
        }
    }

    for (const familyTag of inferFamilyKeywordTags(blockName)) {
        tags.add(familyTag);
    }

    for (const blockFormKindTag of inferBlockFormKindTags(blockName)) {
        tags.add(blockFormKindTag);
    }

    for (const kindTag of inferTokenKindTags(blockName)) {
        tags.add(kindTag);
    }

    if (![...tags].some((tag) => tag.startsWith("color:"))) {
        const tokenColorName = inferTokenColorName(blockName);
        if (tokenColorName) {
            tags.add(`color:${tokenColorName}`);
        }
    }

    if (isEducationBlockId(id)) {
        tags.add(EDUCATION_FEATURE_TAG);
    }

    for (const idSpecificTag of inferIdSpecificTags(id, blockName)) {
        tags.add(idSpecificTag);
    }

    for (const utilityTag of inferUtilityTags(blockName, tags)) {
        tags.add(utilityTag);
    }

    for (const storageTag of inferStorageTags(blockName, tags)) {
        tags.add(storageTag);
    }

    for (const gravityTag of inferGravityTags(blockName, tags)) {
        tags.add(gravityTag);
    }

    for (const foliageTag of inferFoliageTags(blockName, tags)) {
        tags.add(foliageTag);
    }

    for (const redstoneTag of inferRedstoneTags(blockName, tags)) {
        tags.add(redstoneTag);
    }

    for (const technicalTag of inferTechnicalTags(blockName)) {
        tags.add(technicalTag);
    }

    for (const liquidTag of inferLiquidTags(blockName)) {
        tags.add(liquidTag);
    }

    return [...tags].sort((left, right) => left.localeCompare(right));
}

function applyFamilyInheritance(entries) {
    const knownFamilies = [...collectKnownFamilies(entries)].sort(
        (left, right) => right.length - left.length,
    );

    return entries.map((entry) => {
        const inheritedFamilies = inferInheritedFamilies(
            getBlockName(entry.id),
            knownFamilies,
        );
        if (inheritedFamilies.length === 0) {
            return entry;
        }

        const nextTags = new Set(entry.tags);
        let changed = false;

        for (const inheritedFamily of inheritedFamilies) {
            const inheritedFamilyTag = `family:${inheritedFamily}`;
            if (nextTags.has(inheritedFamilyTag)) {
                continue;
            }

            nextTags.add(inheritedFamilyTag);
            changed = true;
        }

        if (!changed) {
            return entry;
        }

        return {
            id: entry.id,
            tags: [...nextTags].sort((left, right) =>
                left.localeCompare(right),
            ),
        };
    });
}

function collectKnownFamilies(entries) {
    const familyNames = new Set();

    for (const entry of entries) {
        for (const tag of entry.tags) {
            if (!tag.startsWith("family:")) {
                continue;
            }

            familyNames.add(tag.slice("family:".length));
        }
    }

    return familyNames;
}

function inferInheritedFamilies(blockName, knownFamilies) {
    const inheritedFamilies = new Set();

    for (const familyCandidate of getInheritedFamilyCandidates(blockName)) {
        for (const familyName of knownFamilies) {
            if (matchesInheritedFamily(familyCandidate, familyName)) {
                inheritedFamilies.add(familyName);
            }
        }
    }

    return [...inheritedFamilies];
}

function inferUnexpectedEmptyFamilyCandidates(blockName, knownFamilies) {
    const familyCandidates = new Set(
        inferInheritedFamilies(blockName, knownFamilies),
    );

    for (const candidateName of getUnexpectedEmptyFamilyCandidates(blockName)) {
        if (candidateName !== blockName) {
            const normalizedCandidateName = normalizeFamilyName(candidateName);
            if (normalizedCandidateName) {
                familyCandidates.add(normalizedCandidateName);
            }
        }

        for (const suffix of UNEXPECTED_EMPTY_ANALYSIS_FAMILY_SUFFIXES) {
            const remainder = getRuleRemainder(candidateName, suffix);
            const familyName = normalizeFamilyName(remainder);
            if (familyName) {
                familyCandidates.add(familyName);
            }
        }
    }

    return [...familyCandidates];
}

function getUnexpectedEmptyFamilyCandidates(blockName) {
    const candidates = [];
    const queue = [blockName];
    const visited = new Set();

    while (queue.length > 0) {
        const currentCandidate = queue.shift();
        if (!currentCandidate || visited.has(currentCandidate)) {
            continue;
        }

        visited.add(currentCandidate);
        candidates.push(currentCandidate);

        for (const stripPrefix of UNEXPECTED_EMPTY_ANALYSIS_STRIP_PREFIXES) {
            const prefix = `${stripPrefix}_`;
            if (currentCandidate.startsWith(prefix)) {
                queue.push(currentCandidate.slice(prefix.length));
            }
        }
    }

    return candidates;
}

function getInheritedFamilyCandidates(blockName) {
    const candidates = [];
    const queue = [blockName];
    const visited = new Set();

    while (queue.length > 0) {
        const currentCandidate = queue.shift();
        if (!currentCandidate || visited.has(currentCandidate)) {
            continue;
        }

        visited.add(currentCandidate);
        candidates.push(currentCandidate);

        for (const stripPrefix of INHERITED_FAMILY_STRIP_PREFIXES) {
            const prefix = `${stripPrefix}_`;
            if (currentCandidate.startsWith(prefix)) {
                queue.push(currentCandidate.slice(prefix.length));
            }
        }
    }

    return candidates;
}

function matchesInheritedFamily(blockName, familyName) {
    if (blockName === familyName || blockName.startsWith(`${familyName}_`)) {
        return true;
    }

    const pluralFamilyName = `${familyName}s`;
    return (
        blockName === pluralFamilyName ||
        blockName.startsWith(`${pluralFamilyName}_`)
    );
}

function matchKindRule(blockName) {
    return KIND_RULES.find(
        (rule) => getRuleRemainder(blockName, rule.suffix) !== undefined,
    );
}

function getRuleRemainder(blockName, suffix) {
    if (blockName === suffix) {
        return "";
    }

    if (!blockName.endsWith(`_${suffix}`)) {
        return undefined;
    }

    return blockName.slice(0, -(suffix.length + 1));
}

function inferFamilyName(remainder, kindRule) {
    let familyName = remainder;

    for (const stripPrefix of kindRule.stripPrefixes ?? []) {
        if (familyName === stripPrefix) {
            return undefined;
        }

        if (familyName.startsWith(`${stripPrefix}_`)) {
            familyName = familyName.slice(stripPrefix.length + 1);
        }
    }

    return normalizeFamilyName(familyName);
}

function inferColorName(remainder) {
    const normalizedRemainder = normalizeFamilyName(remainder);
    if (!normalizedRemainder) {
        return undefined;
    }

    return COLOR_NAMES.find((colorName) => colorName === normalizedRemainder);
}

function inferTokenColorName(blockName) {
    const tokens = blockName.split("_");

    for (const { colorName, tokens: colorTokens } of COLOR_NAME_TOKENS) {
        if (hasTokenSequence(tokens, colorTokens)) {
            return colorName;
        }
    }

    return undefined;
}

function normalizeFamilyName(name) {
    if (!name) {
        return undefined;
    }

    return FAMILY_ALIASES.get(name) ?? name;
}

function inferFamilyKeywordTags(blockName) {
    const familyTags = [];

    for (const rule of PREFIX_FAMILY_RULES) {
        if (blockName.startsWith(rule.prefix)) {
            familyTags.push(`family:${rule.family}`);
        }
    }

    for (const rule of FAMILY_KEYWORD_RULES) {
        if (blockName.includes(rule.keyword)) {
            familyTags.push(`family:${rule.family}`);
        }
    }

    return familyTags;
}

function inferBlockFormKindTags(blockName) {
    const kindTags = [];

    for (const rule of BLOCK_FORM_KIND_RULES) {
        if (matchesBlockFormKindRule(blockName, rule)) {
            kindTags.push(`kind:${rule.kind}`);
        }
    }

    return kindTags;
}

function matchesBlockFormKindRule(blockName, rule) {
    if (blockName === rule.baseName) {
        return true;
    }

    return rule.allowedPrefixes.some(
        (prefix) => blockName === `${prefix}_${rule.baseName}`,
    );
}

function inferTokenKindTags(blockName) {
    const tokens = blockName.split("_");
    const kindTags = [];

    if (blockName.startsWith("stripped_")) {
        kindTags.push("kind:stripped");
    }

    if (tokens.includes("torch")) {
        kindTags.push("kind:torch");
    }

    if (hasLastToken(tokens, "campfire")) {
        kindTags.push("kind:campfire");
    }

    if (hasLastToken(tokens, "fire")) {
        kindTags.push("kind:fire");
    }

    if (hasLastToken(tokens, "lantern")) {
        kindTags.push("kind:lantern");
    }

    if (hasLastToken(tokens, "sand")) {
        kindTags.push("kind:sand");
    }

    if (hasLastToken(tokens, "snow") || blockName === "snow_layer") {
        kindTags.push("kind:snow");
    }

    if (hasLastToken(tokens, "head") || hasLastToken(tokens, "skull")) {
        kindTags.push("kind:skull");
    }

    if (DIRT_LIKE_BLOCK_NAMES.has(blockName)) {
        kindTags.push("kind:dirt");
    }

    return kindTags;
}

function inferUnexpectedEmptyKindCandidates(blockName) {
    const tokens = blockName.split("_");
    const kindCandidates = new Set();

    if (hasLastToken(tokens, "crop")) {
        kindCandidates.add("crop");
    }

    if (blockName === "reeds") {
        kindCandidates.add("foliage");
    }

    if (blockName.endsWith("_collision")) {
        kindCandidates.add("technical");
    }

    return [...kindCandidates];
}

function inferUtilityTags(blockName, tags) {
    if (UTILITY_EXACT_BLOCK_NAMES.has(blockName)) {
        return ["kind:utility"];
    }

    for (const tag of tags) {
        if (UTILITY_IMPLIED_KIND_TAGS.has(tag)) {
            return ["kind:utility"];
        }
    }

    const tokens = blockName.split("_");

    if (
        hasLastToken(tokens, "bulb") ||
        hasLastToken(tokens, "chest") ||
        hasLastToken(tokens, "frame") ||
        hasLastToken(tokens, "head") ||
        hasLastToken(tokens, "rod") ||
        hasLastToken(tokens, "skull") ||
        hasLastToken(tokens, "table")
    ) {
        return ["kind:utility"];
    }

    if (hasLastToken(tokens, "lantern") && blockName !== "sea_lantern") {
        return ["kind:utility"];
    }

    return [];
}

function inferStorageTags(blockName, tags) {
    if (STORAGE_EXACT_BLOCK_NAMES.has(blockName)) {
        return ["kind:storage"];
    }

    for (const tag of tags) {
        if (STORAGE_IMPLIED_KIND_TAGS.has(tag)) {
            return ["kind:storage"];
        }
    }

    const tokens = blockName.split("_");

    if (
        hasLastToken(tokens, "cauldron") ||
        hasLastToken(tokens, "chest") ||
        hasLastToken(tokens, "furnace")
    ) {
        return ["kind:storage"];
    }

    return [];
}

function inferGravityTags(blockName, tags) {
    if (GRAVITY_EXACT_BLOCK_NAMES.has(blockName)) {
        return ["kind:gravity"];
    }

    for (const tag of tags) {
        if (GRAVITY_IMPLIED_KIND_TAGS.has(tag)) {
            return ["kind:gravity"];
        }
    }

    return [];
}

function inferFoliageTags(blockName, tags) {
    if (FOLIAGE_EXACT_BLOCK_NAMES.has(blockName)) {
        return ["kind:foliage"];
    }

    for (const tag of tags) {
        if (FOLIAGE_IMPLIED_KIND_TAGS.has(tag)) {
            return ["kind:foliage"];
        }
    }

    return [];
}

function inferRedstoneTags(blockName, tags) {
    if (REDSTONE_EXACT_BLOCK_NAMES.has(blockName)) {
        return ["kind:redstone"];
    }

    for (const tag of tags) {
        if (REDSTONE_IMPLIED_KIND_TAGS.has(tag)) {
            return ["kind:redstone"];
        }
    }

    return [];
}

function inferTechnicalTags(blockName) {
    if (
        TECHNICAL_EXACT_BLOCK_NAMES.has(blockName) ||
        blockName.startsWith("light_block_")
    ) {
        return ["kind:technical"];
    }

    return [];
}

function inferLiquidTags(blockName) {
    return LIQUID_BLOCK_TAGS_BY_NAME.get(blockName) ?? [];
}

function hasTokenSequence(tokens, candidateTokens) {
    if (
        candidateTokens.length === 0 ||
        candidateTokens.length > tokens.length
    ) {
        return false;
    }

    for (
        let tokenIndex = 0;
        tokenIndex <= tokens.length - candidateTokens.length;
        tokenIndex++
    ) {
        let matches = true;

        for (
            let candidateIndex = 0;
            candidateIndex < candidateTokens.length;
            candidateIndex++
        ) {
            if (
                tokens[tokenIndex + candidateIndex] !==
                candidateTokens[candidateIndex]
            ) {
                matches = false;
                break;
            }
        }

        if (matches) {
            return true;
        }
    }

    return false;
}

function hasLastToken(tokens, token) {
    return tokens.length > 0 && tokens[tokens.length - 1] === token;
}

function isEducationBlockId(id) {
    return (
        EDUCATION_BLOCK_ID_SET.has(id) ||
        EDUCATION_BLOCK_ID_PREFIXES.some((prefix) => id.startsWith(prefix))
    );
}

function inferIdSpecificTags(id, blockName) {
    const tags = [];

    if (CROP_BLOCK_ID_SET.has(id)) {
        tags.push("kind:crop");
    }

    if (FLOWER_BLOCK_ID_SET.has(id)) {
        tags.push("kind:flower");
    }

    if (blockName === "allow") {
        tags.push("kind:allow", "kind:permission_block");
    }

    if (blockName === "cocoa") {
        tags.push("kind:attachment", "kind:cocoa", "kind:crop");
    }

    if (blockName === "deny") {
        tags.push("kind:deny", "kind:permission_block");
    }

    if (blockName === "hardened_clay") {
        tags.push("kind:terracotta");
    }

    if (blockName === "vine") {
        tags.push("kind:attachment", "kind:vine");
    }

    return tags;
}

function getBlockName(id) {
    const namespaceSeparator = id.indexOf(":");
    return namespaceSeparator >= 0 ? id.slice(namespaceSeparator + 1) : id;
}

function createGeneratedJsonFile(entries) {
    const lines = ["["];

    for (const [index, entry] of entries.entries()) {
        const suffix = index < entries.length - 1 ? "," : "";
        lines.push(`  ${JSON.stringify(entry)}${suffix}`);
    }

    lines.push("]", "");
    return lines.join("\n");
}

function createCatalogReport(entries) {
    const tagCounts = new Map();
    const kindCounts = new Map();
    const familyCounts = new Map();
    const colorCounts = new Map();
    const expectedEmptyIds = [];
    const unexpectedEmptyIds = [];
    let entriesWithKindTag = 0;
    let entriesWithFamilyTag = 0;
    let entriesWithColorTag = 0;

    for (const entry of entries) {
        let hasKindTag = false;
        let hasFamilyTag = false;
        let hasColorTag = false;

        for (const tag of entry.tags) {
            incrementCount(tagCounts, tag);

            if (tag.startsWith("kind:")) {
                incrementCount(kindCounts, tag);
                hasKindTag = true;
            }

            if (tag.startsWith("family:")) {
                incrementCount(familyCounts, tag);
                hasFamilyTag = true;
            }

            if (tag.startsWith("color:")) {
                incrementCount(colorCounts, tag);
                hasColorTag = true;
            }
        }

        if (hasKindTag) {
            entriesWithKindTag += 1;
        }

        if (hasFamilyTag) {
            entriesWithFamilyTag += 1;
        }

        if (hasColorTag) {
            entriesWithColorTag += 1;
        }

        if (entry.tags.length > 0) {
            continue;
        }

        if (isExpectedEmptyBlockId(entry.id)) {
            expectedEmptyIds.push(entry.id);
            continue;
        }

        unexpectedEmptyIds.push(entry.id);
    }

    const unexpectedEmptyGapAnalysis = analyzeUnexpectedEmptyGaps(
        unexpectedEmptyIds,
        entries,
    );

    return {
        colorCounts: createSortedCountRecord(colorCounts),
        entriesWithColorTag,
        entriesWithFamilyTag,
        entriesWithKindTag,
        expectedEmptyIds,
        familyCounts: createSortedCountRecord(familyCounts),
        kindCounts: createSortedCountRecord(kindCounts),
        tagCounts: createSortedCountRecord(tagCounts),
        taggedEntries:
            entries.length -
            (expectedEmptyIds.length + unexpectedEmptyIds.length),
        taggedPercentage: getPercentage(
            entries.length -
                (expectedEmptyIds.length + unexpectedEmptyIds.length),
            entries.length,
        ),
        totalEntries: entries.length,
        untaggedEntries: expectedEmptyIds.length + unexpectedEmptyIds.length,
        untaggedPercentage: getPercentage(
            expectedEmptyIds.length + unexpectedEmptyIds.length,
            entries.length,
        ),
        unexpectedEmptyPercentage: getPercentage(
            unexpectedEmptyIds.length,
            entries.length,
        ),
        unexpectedEmptyGapAnalysis,
        unexpectedEmptyIds,
    };
}

function analyzeUnexpectedEmptyGaps(unexpectedEmptyIds, entries) {
    const knownFamilies = [...collectKnownFamilies(entries)].sort(
        (left, right) => right.length - left.length,
    );
    const familyOnlyIds = [];
    const kindOnlyIds = [];
    const familyAndKindIds = [];
    const unclearIds = [];

    for (const id of unexpectedEmptyIds) {
        const blockName = getBlockName(id);
        const likelyFamilies = inferUnexpectedEmptyFamilyCandidates(
            blockName,
            knownFamilies,
        );
        const likelyKinds = inferUnexpectedEmptyKindCandidates(blockName);
        const hasFamilyGap = likelyFamilies.length > 0;
        const hasKindGap = likelyKinds.length > 0;

        if (hasFamilyGap && hasKindGap) {
            familyAndKindIds.push(id);
            continue;
        }

        if (hasFamilyGap) {
            familyOnlyIds.push(id);
            continue;
        }

        if (hasKindGap) {
            kindOnlyIds.push(id);
            continue;
        }

        unclearIds.push(id);
    }

    return {
        familyAndKindIds,
        familyOnlyIds,
        kindOnlyIds,
        unclearIds,
    };
}

function printCatalogReportSummary(report) {
    console.log(
        `[generate-block-catalog] entries=${report.totalEntries} tagged=${report.taggedEntries} (${report.taggedPercentage}%) untagged=${report.untaggedEntries} (${report.untaggedPercentage}%) expectedEmpty=${report.expectedEmptyIds.length} unexpectedEmpty=${report.unexpectedEmptyIds.length} (${report.unexpectedEmptyPercentage}%)`,
    );
    console.log(
        `[generate-block-catalog] entriesWith kind=${report.entriesWithKindTag} family=${report.entriesWithFamilyTag} color=${report.entriesWithColorTag}`,
    );
    console.log(
        `[generate-block-catalog] unexpectedEmpty heuristicSplit familyOnly=${report.unexpectedEmptyGapAnalysis.familyOnlyIds.length} kindOnly=${report.unexpectedEmptyGapAnalysis.kindOnlyIds.length} both=${report.unexpectedEmptyGapAnalysis.familyAndKindIds.length} unclear=${report.unexpectedEmptyGapAnalysis.unclearIds.length}`,
    );
    console.log(
        `[generate-block-catalog] Full report: ${path.relative(repoRoot, reportPath)}`,
    );

    if (report.unexpectedEmptyIds.length === 0) {
        return;
    }

    const unexpectedEmptyPreview = report.unexpectedEmptyIds.slice(
        0,
        UNEXPECTED_EMPTY_PREVIEW_LIMIT,
    );
    console.log(
        `[generate-block-catalog] Unexpected empty ids (${unexpectedEmptyPreview.length}/${report.unexpectedEmptyIds.length} shown): ${unexpectedEmptyPreview.join(", ")}`,
    );

    if (report.unexpectedEmptyIds.length > unexpectedEmptyPreview.length) {
        console.log(
            `[generate-block-catalog] ...and ${report.unexpectedEmptyIds.length - unexpectedEmptyPreview.length} more. See ${path.relative(repoRoot, reportPath)} for the full list.`,
        );
    }
}

function printRequestedReportLists(report, options) {
    if (options.listUnexpectedEmpty) {
        printIdList("Unexpected empty ids", report.unexpectedEmptyIds);
    }
}

function printIdList(label, ids) {
    console.log(`[generate-block-catalog] ${label}:`);

    for (const id of ids) {
        console.log(id);
    }
}

function createSortedCountRecord(counts) {
    return Object.fromEntries(
        [...counts.entries()].sort((left, right) => {
            if (right[1] !== left[1]) {
                return right[1] - left[1];
            }

            return left[0].localeCompare(right[0]);
        }),
    );
}

function incrementCount(counts, key) {
    counts.set(key, (counts.get(key) ?? 0) + 1);
}

function isExpectedEmptyBlockId(id) {
    return (
        EXPECTED_EMPTY_BLOCK_IDS.has(id) ||
        EXPECTED_EMPTY_BLOCK_ID_PREFIXES.some((prefix) => id.startsWith(prefix))
    );
}

function getPercentage(count, total) {
    if (total === 0) {
        return "0.0";
    }

    return ((count / total) * 100).toFixed(1);
}

function parseCliOptions(args) {
    const options = {
        listUnexpectedEmpty: false,
    };

    for (const arg of args) {
        if (arg === "--list-unexpected-empty") {
            options.listUnexpectedEmpty = true;
            continue;
        }

        throw new Error(`[generate-block-catalog] Unknown argument: ${arg}`);
    }

    return options;
}

for (const id of [...CROP_BLOCK_ID_SET, ...FLOWER_BLOCK_ID_SET]) {
    if (!allBlockIdSet.has(id)) {
        throw new Error(
            `[generate-block-catalog] Unknown block id in inferred id sets: ${id}`,
        );
    }
}
