import { Agent } from "@openai/agents";
import { CONCIERGE_SYSTEM_PROMPT } from "@/agent/prompts";

// The route orchestrates concrete tool execution and emits UI events.
// This object documents the intended SDK wiring for the full concierge agent.
export const conciergeAgent = new Agent({
  name: "Axxelist Concierge",
  model: "gpt-4o",
  instructions: CONCIERGE_SYSTEM_PROMPT,
  tools: [],
});
