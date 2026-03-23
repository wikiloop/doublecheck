import { describe, it, expect } from "vitest";
import { getBadgeLevel } from "../../injection/badges.js";

describe("getBadgeLevel", () => {
  it("returns 'high' for damaging > 0.7", () => {
    expect(getBadgeLevel(0.71)).toBe("high");
    expect(getBadgeLevel(0.95)).toBe("high");
    expect(getBadgeLevel(1.0)).toBe("high");
  });

  it("returns 'medium' for damaging 0.4-0.7", () => {
    expect(getBadgeLevel(0.41)).toBe("medium");
    expect(getBadgeLevel(0.5)).toBe("medium");
    expect(getBadgeLevel(0.7)).toBe("medium");
  });

  it("returns 'low' for damaging <= 0.4", () => {
    expect(getBadgeLevel(0.4)).toBe("low");
    expect(getBadgeLevel(0.2)).toBe("low");
    expect(getBadgeLevel(0.0)).toBe("low");
  });
});
