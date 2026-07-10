import { afterEach, describe, expect, it, vi } from "vitest";

import { McpHttpClient } from "./mcp-http-client";

describe("McpHttpClient", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("surfaces MCP tool errors instead of treating them as empty results", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            result: {
              isError: true,
              content: [{ type: "text", text: "搜索Feeds失败: browser timeout" }]
            }
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      )
    );

    const client = new McpHttpClient("http://localhost:18060/mcp");

    await expect(client.callTool("search_feeds", { keyword: "大理" })).rejects.toThrow(
      "搜索Feeds失败: browser timeout"
    );
  });
});
