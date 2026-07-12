import {
  ResearchAgentDecision,
  ResearchToolInput,
  ResearchToolName
} from "./research-agent.types";

const MAX_INPUT_LENGTH = 200;

export class ResearchDecisionValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ResearchDecisionValidationError";
  }
}

export function validateResearchDecision(
  value: unknown,
  availableTools: ResearchToolName[]
): ResearchAgentDecision {
  const record = asRecord(value, "Agent decision must be an object.");

  if (record.action === "finish") {
    assertOnlyKeys(record, ["action", "summary"]);
    return {
      action: "finish",
      summary: requiredString(record.summary, "summary", 500)
    };
  }

  if (record.action !== "call_tool") {
    throw new ResearchDecisionValidationError("Agent decision action is invalid.");
  }

  assertOnlyKeys(record, ["action", "tool", "input"]);

  const tool = requiredString(record.tool, "tool", 50) as ResearchToolName;
  if (!availableTools.includes(tool)) {
    throw new ResearchDecisionValidationError(`Agent requested unavailable tool: ${tool}.`);
  }

  return {
    action: "call_tool",
    tool,
    input: validateToolInput(tool, record.input)
  };
}

function validateToolInput(tool: ResearchToolName, value: unknown): ResearchToolInput {
  const input = asRecord(value, `Input for ${tool} must be an object.`);

  if (tool === "xhs_search" || tool === "web_search") {
    assertOnlyKeys(input, ["query"]);
    return { query: requiredString(input.query, "query", MAX_INPUT_LENGTH) };
  }

  if (tool === "poi_search") {
    assertOnlyKeys(input, ["keyword", "city"]);
    return {
      keyword: requiredString(input.keyword, "keyword", MAX_INPUT_LENGTH),
      city: optionalString(input.city, "city", MAX_INPUT_LENGTH)
    };
  }

  if (tool === "get_weather") {
    assertOnlyKeys(input, ["city"]);
    return { city: requiredString(input.city, "city", MAX_INPUT_LENGTH) };
  }

  assertOnlyKeys(input, ["origin", "destination", "mode", "city"]);
  const mode = input.mode ?? "driving";
  if (mode !== "walking" && mode !== "driving" && mode !== "transit") {
    throw new ResearchDecisionValidationError("Route mode must be walking, driving, or transit.");
  }

  return {
    origin: requiredString(input.origin, "origin", MAX_INPUT_LENGTH),
    destination: requiredString(input.destination, "destination", MAX_INPUT_LENGTH),
    mode,
    city: optionalString(input.city, "city", MAX_INPUT_LENGTH)
  };
}

function asRecord(value: unknown, message: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new ResearchDecisionValidationError(message);
  }

  return value as Record<string, unknown>;
}

function requiredString(value: unknown, field: string, maxLength: number): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new ResearchDecisionValidationError(`${field} must be a non-empty string.`);
  }

  return value.trim().slice(0, maxLength);
}

function optionalString(value: unknown, field: string, maxLength: number): string | undefined {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  return requiredString(value, field, maxLength);
}

function assertOnlyKeys(record: Record<string, unknown>, allowedKeys: string[]): void {
  const unexpectedKey = Object.keys(record).find((key) => !allowedKeys.includes(key));
  if (unexpectedKey) {
    throw new ResearchDecisionValidationError(`Unexpected field: ${unexpectedKey}.`);
  }
}
