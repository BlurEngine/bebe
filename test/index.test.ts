import { describe, expect, it } from "vitest";
import * as bebe from "../src/index.js";
import {
    Context,
    ROOT_CONTEXT,
    RootContext,
    createServiceKey,
    isRootContext,
} from "../src/context.js";

describe("package root exports", () => {
    it("re-exports the context surface only", () => {
        expect(Object.keys(bebe).sort()).toEqual(
            [
                "Context",
                "ROOT_CONTEXT",
                "RootContext",
                "createServiceKey",
                "isRootContext",
                "isValidContext",
                "mustContext",
            ].sort(),
        );
    });

    it("matches the direct context exports", () => {
        expect(bebe.Context).toBe(Context);
        expect(bebe.ROOT_CONTEXT).toBe(ROOT_CONTEXT);
        expect(bebe.RootContext).toBe(RootContext);
        expect(bebe.createServiceKey).toBe(createServiceKey);
        expect(bebe.isRootContext).toBe(isRootContext);
    });
});
