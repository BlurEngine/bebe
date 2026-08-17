import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function readRepositoryFile(path: string): string {
    return readFileSync(resolve(repositoryRoot, path), "utf8");
}

describe("release tooling", () => {
    it("keeps Changesets v3 aligned with the v2 action contract", () => {
        const packageJson = JSON.parse(readRepositoryFile("package.json")) as {
            packageManager: string;
            devDependencies: Record<string, string>;
        };
        const changesetsConfig = JSON.parse(
            readRepositoryFile(".changeset/config.json"),
        ) as { $schema: string };
        const publishWorkflow = readRepositoryFile(
            ".github/workflows/publish.yml",
        );

        expect(packageJson.devDependencies["@changesets/cli"]).toMatch(
            /^\^3\./u,
        );
        expect(
            packageJson.devDependencies["@changesets/changelog-github"],
        ).toMatch(/^\^1\./u);
        const npmVersion = /^npm@(\d+)\.(\d+)\.(\d+)$/u.exec(
            packageJson.packageManager,
        );
        expect(npmVersion).not.toBeNull();
        const npmMajor = Number(npmVersion?.[1]);
        const npmMinor = Number(npmVersion?.[2]);
        expect(npmMajor > 10 || (npmMajor === 10 && npmMinor >= 9)).toBe(true);
        expect(changesetsConfig.$schema).toContain("@changesets/config@4.");

        expect(publishWorkflow).toContain("uses: changesets/action@v2");
        expect(publishWorkflow).toContain(
            "github-token: ${{ secrets.GITHUB_TOKEN }}",
        );
        expect(publishWorkflow).toContain(
            'commit-message: "chore: version packages"',
        );
        expect(publishWorkflow).toContain(
            'pr-title: "chore: version packages"',
        );
        expect(publishWorkflow).toContain(
            "version-script: npm run version-packages",
        );
        expect(publishWorkflow).not.toMatch(/^\s+(?:commit|title|version):/mu);
        expect(publishWorkflow).not.toMatch(/^\s+GITHUB_TOKEN:/mu);
    });
});
