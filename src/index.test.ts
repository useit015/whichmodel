import { describe, expect, it } from "vitest";
import { program } from "./cli.js";

describe("index", () => {
  it("exposes CLI program", () => {
    expect(program.name()).toBe("whichmodel");
  });
});
