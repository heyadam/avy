import { createAnthropic } from "@ai-sdk/anthropic";
import type { ApiKeys } from "@/lib/api-keys/types";

export function getAnthropicClient(apiKeys?: ApiKeys) {
  return createAnthropic({
    apiKey: apiKeys?.anthropic || process.env.ANTHROPIC_API_KEY,
  });
}
