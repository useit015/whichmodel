import { describe, expect, it } from "vitest";
import { getBootstrapMessage } from "./index.js";

describe("index", () => {
  it("returns a bootstrap message", () => {
    expect(getBootstrapMessage()).toBe("whichmodel phase 0 foundation ready");
  });
});
