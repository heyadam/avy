import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, input } = body;

    if (type === "prompt") {
      const { prompt, model } = body;
      const messages: { role: "system" | "user"; content: string }[] = [];
      if (typeof prompt === "string" && prompt.trim().length > 0) {
        messages.push({ role: "system", content: prompt.trim() });
      }

      const completion = await openai.chat.completions.create({
        model: model || "gpt-5.2-2025-12-11",
        messages: messages.concat([{ role: "user", content: String(input ?? "") }]),
        max_completion_tokens: 1000,
      });

      const output = completion.choices[0]?.message?.content || "";
      return NextResponse.json({ output });
    }

    return NextResponse.json({ error: "Unknown execution type" }, { status: 400 });
  } catch (error) {
    console.error("Execution error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Execution failed" },
      { status: 500 }
    );
  }
}
