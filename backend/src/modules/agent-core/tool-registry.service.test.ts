import { describe, expect, it } from "vitest";

import { ToolRegistry } from "./tool-registry.service";

describe("ToolRegistry", () => {
  it("registers and describes named tools", () => {
    const registry = new ToolRegistry();
    const tool = { name: "search", description: "Search", inputSchema: { type: "object" }, execute: async () => ({ observation: "ok" }) };

    registry.register(tool);

    expect(registry.get("search")).toBe(tool);
    expect(registry.describe(["search", "missing"])).toEqual([{ name: "search", description: "Search", inputSchema: { type: "object" } }]);
  });
});
