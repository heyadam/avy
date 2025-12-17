import { NextRequest, NextResponse } from "next/server";
import { streamText } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import {
  buildSystemPrompt,
  buildPlanModeSystemPrompt,
  buildExecuteFromPlanSystemPrompt,
} from "@/lib/autopilot/system-prompt";
import type { AutopilotRequest } from "@/lib/autopilot/types";

interface ApiKeys {
  openai?: string;
  google?: string;
  anthropic?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as AutopilotRequest & { apiKeys?: ApiKeys };
    const {
      messages,
      flowSnapshot,
      model = "claude-sonnet-4-5",
      apiKeys,
      mode = "execute",
      approvedPlan,
    } = body;

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: "Messages array is required" },
        { status: 400 }
      );
    }

    if (!flowSnapshot) {
      return NextResponse.json(
        { error: "Flow snapshot is required" },
        { status: 400 }
      );
    }

    // Build system prompt based on mode
    let systemPrompt: string;
    if (approvedPlan) {
      // Executing an approved plan
      systemPrompt = buildExecuteFromPlanSystemPrompt(flowSnapshot, approvedPlan);
    } else if (mode === "plan") {
      // Plan mode - ask questions, then present plan
      systemPrompt = buildPlanModeSystemPrompt(flowSnapshot);
    } else {
      // Execute mode - current behavior
      systemPrompt = buildSystemPrompt(flowSnapshot);
    }

    // Create Anthropic client with custom or env API key
    const anthropic = createAnthropic({
      apiKey: apiKeys?.anthropic || process.env.ANTHROPIC_API_KEY,
    });

    // Stream response from Claude
    const result = streamText({
      model: anthropic(model),
      system: systemPrompt,
      messages: messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
      })),
      maxOutputTokens: 4000,
    });

    return result.toTextStreamResponse();
  } catch (error) {
    console.error("Autopilot error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Autopilot failed" },
      { status: 500 }
    );
  }
}
