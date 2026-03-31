import { describe, expect, it } from "vitest";
import * as maths from "../../src/maths/index.js";
import { AABB } from "../../src/maths/aabb.js";
import { Easings, tweenNumber } from "../../src/maths/tween.js";
import { clamp } from "../../src/maths/util.js";
import { Vec2 } from "../../src/maths/vec2.js";
import { Vec3 } from "../../src/maths/vec3.js";

describe("maths barrel exports", () => {
    it("re-exports the public maths surface", () => {
        expect(maths.AABB).toBe(AABB);
        expect(maths.Easings).toBe(Easings);
        expect(maths.Vec2).toBe(Vec2);
        expect(maths.Vec3).toBe(Vec3);
        expect(maths.clamp).toBe(clamp);
        expect(maths.tweenNumber).toBe(tweenNumber);
    });
});
