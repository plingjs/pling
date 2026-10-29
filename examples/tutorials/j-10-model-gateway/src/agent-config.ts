export const browserAgentConfig = {
  baseUrl: import.meta.env.VITE_AGENT_BASE_URL?.trim() || "/api/llm/v1",
  model: import.meta.env.VITE_AGENT_MODEL?.trim() || "server-model",
  apiKey: "",
};
