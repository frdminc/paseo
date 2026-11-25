import { describe, expect, it } from "vitest";
import { FORK_BUILD, formatForkBuild, formatVersionWithForkBuild } from "./fork-build";

describe("fork build marker", () => {
  it("names the fork and its build number", () => {
    expect(formatForkBuild({ name: "djbclark", build: 2 })).toBe("djbclark fork 2");
  });

  it("is build 3", () => {
    expect(FORK_BUILD.build).toBe(3);
    expect(formatForkBuild(FORK_BUILD)).toBe("djbclark fork 3");
  });

  it("follows the version text on the About line", () => {
    expect(formatVersionWithForkBuild("v0.17.1")).toBe(`v0.17.1 · ${formatForkBuild(FORK_BUILD)}`);
  });
});
