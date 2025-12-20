import { NextRequest, NextResponse } from "next/server";
import { createAnthropic } from "@ai-sdk/anthropic";
import { generateText } from "ai";
import type { FlowSnapshot } from "@/lib/autopilot/types";

interface ApiKeys {
  openai?: string;
  google?: string;
  anthropic?: string;
}

interface SuggestionsRequest {
  flowSnapshot: FlowSnapshot;
  apiKeys?: ApiKeys;
}

export interface Suggestion {
  icon: string;
  text: string;
}

const DEFAULT_SUGGESTIONS: Suggestion[] = [
  { icon: "FileText", text: "Summarize the input text" },
  { icon: "Image", text: "Generate an image from text" },
  { icon: "Languages", text: "Translate text to Spanish" },
  { icon: "BarChart", text: "Analyze sentiment of input" },
];

// Valid icon names that map to lucide-react icons
const VALID_ICONS = [
  "FileText", "Image", "Languages", "BarChart", "Palette", "RefreshCw",
  "Sparkles", "Bot", "Mail", "Lightbulb", "Code", "MessageSquare",
  "Search", "Filter", "Wand2", "Pencil", "BookOpen", "Mic", "Video",
  "Music", "Globe", "Zap", "Heart", "Star", "Tag", "List"
];

const SYSTEM_PROMPT = `You are an assistant helping users with an AI workflow builder called Composer. Generate 4 short, actionable prompt suggestions for what workflows they could build.

Guidelines:
- Each suggestion needs an icon name and text
- Text should be 3-8 words starting with an action verb (Summarize, Generate, Translate, Analyze, Create, Build, etc.)
- Be specific but concise
- If the flow is empty or just has an input node, suggest common starter workflows
- If the flow already has nodes, suggest ways to extend or modify it
- Don't repeat what the flow already does
- Suggestions should be diverse (mix of text processing, image generation, translation, analysis, etc.)

Valid icon names (use exactly these):
- FileText: text/documents/summarize
- Image: images/photos/visual
- Languages: translation/multilingual
- BarChart: analysis/data/charts
- Palette: creative/design/art
- Sparkles: enhance/improve/magic
- Bot: AI/automation
- Mail: email/messages
- Lightbulb: ideas/brainstorm
- Code: programming/technical
- MessageSquare: chat/conversation
- Search: find/lookup
- Wand2: transform/convert
- Pencil: write/edit
- BookOpen: reading/learning
- Globe: web/international
- Zap: fast/quick/action

Output format (JSON array only, no markdown, no explanation):
[{"icon":"FileText","text":"Summarize the input text"},{"icon":"Image","text":"Generate an image from text"},{"icon":"Languages","text":"Translate to Spanish"},{"icon":"BarChart","text":"Analyze sentiment"}]`;

function buildPrompt(flowSnapshot: FlowSnapshot): string {
  const nodeCount = flowSnapshot.nodes.length;
  const nodeTypes = flowSnapshot.nodes.map(n => n.type);

  if (nodeCount <= 1) {
    return "The workflow is empty. Suggest common starter workflows.";
  }

  const nodeDescriptions = flowSnapshot.nodes.map(n => {
    const label = n.data?.label || n.type;
    return `- ${label} (${n.type})`;
  }).join("\n");

  return `Current workflow has ${nodeCount} nodes:
${nodeDescriptions}

Node types present: ${[...new Set(nodeTypes)].join(", ")}

Suggest ways to extend or modify this workflow.`;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as SuggestionsRequest;
    const { flowSnapshot, apiKeys } = body;

    const apiKey = apiKeys?.anthropic || process.env.ANTHROPIC_API_KEY;

    if (!apiKey) {
      // Return defaults if no API key
      return NextResponse.json({ suggestions: DEFAULT_SUGGESTIONS });
    }

    const anthropic = createAnthropic({ apiKey });

    const result = await generateText({
      model: anthropic("claude-haiku-4-5"),
      system: SYSTEM_PROMPT,
      prompt: buildPrompt(flowSnapshot || { nodes: [], edges: [] }),
      maxOutputTokens: 200,
    });

    // Parse JSON response
    const text = result.text.trim();

    function isValidSuggestion(s: unknown): s is Suggestion {
      return (
        typeof s === "object" &&
        s !== null &&
        typeof (s as Suggestion).icon === "string" &&
        typeof (s as Suggestion).text === "string" &&
        VALID_ICONS.includes((s as Suggestion).icon)
      );
    }

    function validateAndNormalize(parsed: unknown): Suggestion[] | null {
      if (!Array.isArray(parsed) || parsed.length < 4) return null;
      const valid = parsed.slice(0, 4).filter(isValidSuggestion);
      if (valid.length === 4) return valid;
      return null;
    }

    try {
      const parsed = JSON.parse(text);
      const suggestions = validateAndNormalize(parsed);
      if (suggestions) {
        return NextResponse.json({ suggestions });
      }
    } catch {
      // Try to extract array from response
      const match = text.match(/\[[\s\S]*\]/);
      if (match) {
        try {
          const parsed = JSON.parse(match[0]);
          const suggestions = validateAndNormalize(parsed);
          if (suggestions) {
            return NextResponse.json({ suggestions });
          }
        } catch {
          // Fall through to default
        }
      }
    }

    // Fallback to defaults
    return NextResponse.json({ suggestions: DEFAULT_SUGGESTIONS });
  } catch (error) {
    console.error("Suggestions error:", error);
    return NextResponse.json({ suggestions: DEFAULT_SUGGESTIONS });
  }
}
