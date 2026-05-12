import fs from "node:fs";
import { relative, resolve } from "node:path";
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

// Build modules map: always root, plus directory subpaths declared by package.json exports.
const modules = { [pkg.name]: resolve(tempTypesDir, "index.d.ts") };
const exportSubpaths = Object.keys(pkg.exports || {})
    .filter((k) => k !== ".")
    .map((k) => k.replace(/^\.\//, ""));
for (const subpath of exportSubpaths) {
    const indexPath = resolve(tempTypesDir, subpath, "index.d.ts");
    if (fs.existsSync(indexPath)) {
        modules[`${pkg.name}/${subpath}`] = indexPath;
    }
}

await createBundle({
    output: resolve(outDir, "bebe-public.d.ts"),
    compilerOptions: { stripInternal: true },
    modules,
});
rewriteBundleDeclarationMap(resolve(outDir, "bebe-public.d.ts"));

console.log(
    `[generate-types] Built single types bundle at ${resolve(outDir, "bebe-public.d.ts")} from ${Object.keys(modules).length} module(s)`,
);

function rewriteBundleDeclarationMap(bundlePath) {
    const bundleMapPath = `${bundlePath}.map`;
    if (!fs.existsSync(bundleMapPath)) {
        return;
    }

    const bundleMap = JSON.parse(fs.readFileSync(bundleMapPath, "utf-8"));
    const rewrittenSources = [];

    for (const sourcePath of bundleMap.sources ?? []) {
        const tempDeclarationPath = resolve(outDir, sourcePath);
        const tempDeclarationMapPath = `${tempDeclarationPath}.map`;
        let finalSourcePath = tempDeclarationPath;

        if (fs.existsSync(tempDeclarationMapPath)) {
            const tempDeclarationMap = JSON.parse(
                fs.readFileSync(tempDeclarationMapPath, "utf-8"),
            );
            const mappedSourcePath = tempDeclarationMap.sources?.[0];
            if (mappedSourcePath) {
                finalSourcePath = resolve(
                    tempDeclarationPath,
                    "..",
                    mappedSourcePath,
                );
            }
        }

        rewrittenSources.push(
            relative(outDir, finalSourcePath).replaceAll("\\", "/"),
        );
    }

    bundleMap.sources = rewrittenSources;
    delete bundleMap.sourcesContent;
    fs.writeFileSync(
        bundleMapPath,
        `${JSON.stringify(bundleMap, null, "\t")}\n`,
        "utf-8",
    );
}
