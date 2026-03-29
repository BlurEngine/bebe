import { rmSync } from "node:fs";

const TARGETS = ["coverage", "dist", "lib", "temp"];

for (const target of TARGETS) {
    rmSync(target, { recursive: true, force: true });
}
