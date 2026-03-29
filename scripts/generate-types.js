import fs from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createBundle } from "dts-buddy";

// Resolve repo root from this script's directory
const scriptDir = fileURLToPath(new URL(".", import.meta.url));
const rootDir = resolve(scriptDir, "..");

const pkg = JSON.parse(
    fs.readFileSync(resolve(rootDir, "package.json"), "utf-8"),
);
const tempTypesDir = resolve(rootDir, "temp", "types");
const outDir = resolve(rootDir, "lib", "types");
fs.mkdirSync(outDir, { recursive: true });

// Build modules map: always root, plus subpaths discovered in temp/types and allowed by package.json exports
const modules = { [pkg.name]: resolve(tempTypesDir, "index.d.ts") };
const exportSubpaths = Object.keys(pkg.exports || {})
    .filter((k) => k !== ".")
    .map((k) => k.replace(/^\.\//, ""));
for (const entry of fs.readdirSync(tempTypesDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    if (!exportSubpaths.includes(entry.name)) continue; // only include declared subpaths
    const indexPath = resolve(tempTypesDir, entry.name, "index.d.ts");
    if (fs.existsSync(indexPath)) {
        modules[`${pkg.name}/${entry.name}`] = indexPath;
    }
}

await createBundle({
    output: resolve(outDir, "bebe-public.d.ts"),
    compilerOptions: { stripInternal: true },
    modules,
});

console.log(
    `[generate-types] Built single types bundle at ${resolve(outDir, "bebe-public.d.ts")} from ${Object.keys(modules).length} module(s)`,
);
