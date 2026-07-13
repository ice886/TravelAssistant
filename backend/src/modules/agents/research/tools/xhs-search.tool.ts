import { Inject, Injectable } from "@nestjs/common";

import { McpService } from "../../../mcp/mcp.service";
import { BaseTool, ToolResult } from "../../../agent-core/interfaces/tool.interface";
import { ResearchSourceDraft } from "../research.agent.types";

const MAX_RESULTS = 5;
const MAX_ATTEMPTS = 2;

@Injectable()
export class XhsSearchTool implements BaseTool<{ query: string }> {
  readonly name = "xhs_search";
  readonly description = "搜索小红书旅行笔记，获取真实体验和攻略线索。";
  readonly inputSchema = { type: "object", additionalProperties: false, required: ["query"], properties: { query: { type: "string" } } };

  constructor(@Inject(McpService) private readonly mcp: McpService) {}

  async execute(input: { query: string }): Promise<ToolResult> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      try {
        const sources = extractSources(await this.mcp.searchXhs(input.query)).slice(0, MAX_RESULTS);
        return { observation: sources.length > 0 ? `找到 ${sources.length} 条小红书笔记。` : "未找到小红书笔记。", artifacts: sources };
      } catch (error) {
        lastError = error;
        if (attempt < MAX_ATTEMPTS) await delay(500);
      }
    }
    throw lastError instanceof Error ? lastError : new Error("小红书检索失败。");
  }
}

function extractSources(value: unknown): ResearchSourceDraft[] {
  const candidates = Array.isArray(value) ? value : isRecord(value) ? Object.values(value).find(Array.isArray) ?? [value] : [value];
  return candidates.filter(isRecord).map((item) => {
    const card = isRecord(item.noteCard) ? item.noteCard : item;
    const user = isRecord(card.user) ? card.user : null;
    const id = stringValue(item.id) ?? stringValue(item.note_id);
    return {
      provider: "xiaohongshu",
      title: stringValue(card.displayTitle) ?? stringValue(item.title) ?? stringValue(item.name) ?? "小红书旅行来源",
      url: stringValue(item.url) ?? (id ? `https://www.xiaohongshu.com/explore/${encodeURIComponent(id)}` : null),
      snippet: stringValue(card.desc) ?? stringValue(item.desc) ?? stringValue(item.content),
      metadata: { tool: "xhs_search", id, author: user ? stringValue(user.nickname) ?? stringValue(user.nickName) : stringValue(item.author) }
    };
  });
}

function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
function stringValue(value: unknown): string | null { return typeof value === "string" && value.trim() ? value.trim() : null; }
function delay(ms: number): Promise<void> { return new Promise((resolve) => setTimeout(resolve, ms)); }
