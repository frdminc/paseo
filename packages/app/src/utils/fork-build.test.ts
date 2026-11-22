import { describe, expect, it } from "vitest";
import { FORK_BUILD, formatForkBuild, formatVersionWithForkBuild } from "./fork-build";

describe("fork build marker", () => {
  it("names the fork and its build number", () => {
    expect(formatForkBuild({ name: "djbclark", build: 2 })).toBe("djbclark fork 2");
  });

  it("starts at build 2", () => {
    expect(FORK_BUILD.build).toBeGreaterThanOrEqual(2);
  });

  it("follows the version text on the About line", () => {
    expect(formatVersionWithForkBuild("v0.17.1")).toBe(`v0.17.1 · ${formatForkBuild(FORK_BUILD)}`);
  });
});
