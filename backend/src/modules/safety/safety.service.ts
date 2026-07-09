import { Inject, Injectable } from "@nestjs/common";

import { AppConfigService } from "../config/app-config.service";

export interface ToolSafetyDecision {
  allowed: boolean;
  reason: string;
}

const BLOCKED_XHS_TOOLS = new Set([
  "delete_cookies",
  "publish_content",
  "publish_with_video",
  "post_comment_to_feed",
  "reply_comment_in_feed",
  "like_feed",
  "favorite_feed"
]);

@Injectable()
export class SafetyService {
  constructor(@Inject(AppConfigService) private readonly config: AppConfigService) {}

  isXhsToolAllowed(toolName: string): ToolSafetyDecision {
    if (BLOCKED_XHS_TOOLS.has(toolName)) {
      return {
        allowed: false,
        reason: `Tool "${toolName}" is blocked because Xiaohongshu MCP is read-only.`
      };
    }

    if (!this.config.xhsReadonlyTools.includes(toolName)) {
      return {
        allowed: false,
        reason: `Tool "${toolName}" is not in XHS_READONLY_TOOLS.`
      };
    }

    return {
      allowed: true,
      reason: "Tool is allowed by the Xiaohongshu read-only whitelist."
    };
  }

  get xhsReadonlyTools(): string[] {
    return this.config.xhsReadonlyTools;
  }

  get xhsBlockedTools(): string[] {
    return [...BLOCKED_XHS_TOOLS];
  }
}
