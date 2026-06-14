import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function readRepositoryFile(path: string): string {
    return readFileSync(resolve(repositoryRoot, path), "utf8");
}

describe("audio documentation", () => {
    it("links sound guidance from the docs index", () => {
        const docsIndex = readRepositoryFile("docs/README.md");

        expect(docsIndex).toContain("./guides/audio-sound-design.md");
    });

    it("documents expected BAUD sound behaviours for authors", () => {
        const guide = readRepositoryFile("docs/guides/audio-sound-design.md");

        expect(guide).toContain("Recommended Sound Roles");
        expect(guide).toContain("BAUD does not validate sound ids");
        expect(guide).toContain("Long samples keep playing");
        expect(guide).toContain("note.*");
        expect(guide).toContain("random.*");
        expect(guide).toContain("Keep this guide curated");
    });
});
