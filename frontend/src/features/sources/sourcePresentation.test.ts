import { describe, expect, it } from "vitest";

import { safeSourceUrl } from "./sourcePresentation";

describe("source presentation", () => {
  it("allows only HTTP(S) source links", () => {
    expect(safeSourceUrl("https://example.com/guide")).toBe("https://example.com/guide");
    expect(safeSourceUrl("http://example.com/guide")).toBe("http://example.com/guide");
    expect(safeSourceUrl("javascript:alert(1)")).toBeNull();
    expect(safeSourceUrl("data:text/html,unsafe")).toBeNull();
    expect(safeSourceUrl("not a url")).toBeNull();
  });
});
