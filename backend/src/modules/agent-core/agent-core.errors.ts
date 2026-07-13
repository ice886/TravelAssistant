import { AgentProgress } from "./agent-core.types";

export class AgentExecutionError extends Error {
  constructor(message: string, readonly progress: AgentProgress) {
    super(message);
    this.name = "AgentExecutionError";
  }
}

export class ToolExecutionError extends Error {
  constructor(message: string, readonly tool: string, readonly cause?: unknown) {
    super(message);
    this.name = "ToolExecutionError";
  }
}
