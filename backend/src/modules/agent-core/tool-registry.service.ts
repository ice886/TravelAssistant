import { Injectable } from "@nestjs/common";

import { BaseTool } from "./interfaces/tool.interface";

@Injectable()
export class ToolRegistry {
  private readonly tools = new Map<string, BaseTool>();

  register(tool: BaseTool): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool already registered: ${tool.name}`);
    }
    this.tools.set(tool.name, tool);
  }

  get(name: string): BaseTool | undefined {
    return this.tools.get(name);
  }

  getByNames(names: string[]): BaseTool[] {
    return names.flatMap((name) => {
      const tool = this.tools.get(name);
      return tool ? [tool] : [];
    });
  }

  describe(names: string[]): { name: string; description: string; inputSchema: Record<string, unknown> }[] {
    return this.getByNames(names).map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema
    }));
  }
}
