import { describe, it, expect } from "vitest";
import { detectWarningLevel } from "../lib/mediawiki.js";

describe("detectWarningLevel", () => {
  // Get current month/year for test fixtures
  const now = new Date();
  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  const currentMonth = `${monthNames[now.getUTCMonth()]} ${now.getUTCFullYear()}`;

  it("returns 0 for empty string", () => {
    expect(detectWarningLevel("")).toBe(0);
  });

  it("returns 0 for talk page with no warnings", () => {
    const wikitext = `== ${currentMonth} ==\nHello, welcome to Wikipedia! ~~~~`;
    expect(detectWarningLevel(wikitext)).toBe(0);
  });

  it("detects level 1 warning", () => {
    const wikitext = `== ${currentMonth} ==\n{{subst:uw-vandalism1|Some article}} ~~~~`;
    expect(detectWarningLevel(wikitext)).toBe(1);
  });

  it("detects level 2 warning", () => {
    const wikitext = `== ${currentMonth} ==\n{{subst:uw-vandalism2|Some article}} ~~~~`;
    expect(detectWarningLevel(wikitext)).toBe(2);
  });

  it("detects level 3 warning", () => {
    const wikitext = `== ${currentMonth} ==\n{{uw-vandalism3|Some article}} ~~~~`;
    expect(detectWarningLevel(wikitext)).toBe(3);
  });

  it("detects level 4 warning", () => {
    const wikitext = `== ${currentMonth} ==\n{{subst:uw-vandalism4|Some article}} ~~~~`;
    expect(detectWarningLevel(wikitext)).toBe(4);
  });

  it("detects 4im as level 4", () => {
    const wikitext = `== ${currentMonth} ==\n{{subst:uw-vandalism4im|Some article}} ~~~~`;
    expect(detectWarningLevel(wikitext)).toBe(4);
  });

  it("returns the highest level when multiple warnings exist", () => {
    const wikitext = [
      `== ${currentMonth} ==`,
      "{{subst:uw-vandalism1|Article A}} ~~~~",
      "{{subst:uw-vandalism2|Article B}} ~~~~",
      "{{subst:uw-vandalism3|Article C}} ~~~~",
    ].join("\n");
    expect(detectWarningLevel(wikitext)).toBe(3);
  });

  it("ignores warnings from a different month", () => {
    // Use a past month that is guaranteed to be different from the current month
    const pastYear = now.getUTCFullYear() - 1;
    const pastMonth = `January ${pastYear}`;
    const wikitext = [
      `== ${pastMonth} ==`,
      "{{subst:uw-vandalism4|Old article}} ~~~~",
      `== ${currentMonth} ==`,
      "{{subst:uw-vandalism1|New article}} ~~~~",
    ].join("\n");
    expect(detectWarningLevel(wikitext)).toBe(1);
  });

  it("scans entire page when no monthly sections exist", () => {
    // No month headings at all — should scan everything
    const wikitext = "{{subst:uw-vandalism2|Some article}} ~~~~";
    expect(detectWarningLevel(wikitext)).toBe(2);
  });

  it("caps at 4", () => {
    // Hypothetical case: multiple uw-vandalism4 on the page
    const wikitext = [
      `== ${currentMonth} ==`,
      "{{subst:uw-vandalism4|Article A}} ~~~~",
      "{{subst:uw-vandalism4|Article B}} ~~~~",
    ].join("\n");
    expect(detectWarningLevel(wikitext)).toBe(4);
  });
});
