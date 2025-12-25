# Plan: Add Image Input to PromptNode for Multimodal AI Prompts

## Summary

Add image input capability to the text-generation node (PromptNode) enabling vision-based prompts. Start with Google Gemini, architecture supports OpenAI/Anthropic later.

**User Requirements:**
- Single image input (not multiple)
- Both inline upload AND connection from other nodes
- Auto-switch to vision-capable model when image is present
- Local-only storage (runtime, not persisted) - like ImageInputNode

---

## Key Technical Decisions

| Issue | Resolution |
|-------|------------|
| Storage bloat | Strip `imageInput` in 3 places: snapshot.ts, validation.ts, useCollaboration.ts |
| Runtime | Route is `nodejs` (line 15 in route.ts), Buffer available |
| Image format | `ImageData` from `lib/image-utils.ts`: `{ type, value, mimeType }` as JSON string |
| Port dataType | `"image"` already exists in schema (image-input, image-generation use it) |
| SDK multimodal | Vercel AI SDK `{ type: "image", image: base64 }` format |
| Model source | `lib/providers.ts` is UI source of truth; `docs/AI_MODELS.md` is docs only |
| ImageInputNode output | Returns `string` (JSON stringified ImageData) - confirmed in engine.ts:85 |

---

## Files to Modify

| File | Change |
|------|--------|
| `lib/providers.ts` | Add `supportsVision: boolean` to models + `DEFAULT_VISION_MODELS` |
| `types/flow.ts` | Add `imageInput?: string` to `PromptNodeData`, add image port to schema |
| `lib/autopilot/snapshot.ts` | Add `"imageInput"` to `EXCLUDED_DATA_FIELDS` |
| `lib/flow-storage/validation.ts` | Add `imageInput: undefined` to `sanitizeNodes` |
| `lib/hooks/useCollaboration.ts` | Strip `imageInput` from `nodeToPayload` |
| `lib/vision/index.ts` | **NEW** - Vision utilities module |
| `components/Flow/nodes/PromptNode.tsx` | Add image input UI section |
| `lib/execution/engine.ts` | Collect and pass image input to API |
| `app/api/execute/route.ts` | Build multimodal messages when image present |
| `lib/autopilot/system-prompt.ts` | Document image input handle |

---

## Implementation Steps

### 1. Add Vision Model Config (`lib/providers.ts`) ✅

Add `supportsVision: boolean` to each model:
```typescript
// PROVIDERS object - add supportsVision to each model
{ value: "gpt-5.2", label: "GPT-5.2", ..., supportsVision: true },
{ value: "gpt-5-mini", label: "GPT-5 Mini", ..., supportsVision: true },
{ value: "gpt-5-nano", label: "GPT-5 Nano", ..., supportsVision: false },  // fast model
{ value: "gemini-3-flash-preview", label: "Gemini 3 Flash", ..., supportsVision: true },
{ value: "gemini-3-pro-preview", label: "Gemini 3 Pro", ..., supportsVision: true },
{ value: "claude-sonnet-4-5", label: "Claude Sonnet 4.5", ..., supportsVision: true },
{ value: "claude-opus-4-5", label: "Claude Opus 4.5", ..., supportsVision: true },
{ value: "claude-haiku-4-5", label: "Claude Haiku 4.5", ..., supportsVision: true },
```

Add default vision model fallbacks:
```typescript
export const DEFAULT_VISION_MODELS: Record<ProviderId, string> = {
  openai: "gpt-5.2",
  google: "gemini-3-flash-preview",
  anthropic: "claude-sonnet-4-5",
};
```

### 2. Update Types (`types/flow.ts`) ✅

Add to `PromptNodeData`:
```typescript
imageInput?: string;  // Stringified ImageData JSON (runtime only, not persisted)
```

Update port schema for `text-generation`:
```typescript
"text-generation": {
  inputs: [
    { id: "prompt", label: "prompt", dataType: "string", required: true },
    { id: "system", label: "system", dataType: "string", required: false },
    { id: "image", label: "image", dataType: "image", required: false },  // NEW
  ],
  outputs: [{ id: "output", label: "string", dataType: "string" }],
},
```

### 3. Prevent Persistence (3 locations) ✅

**A. `lib/autopilot/snapshot.ts`** - For undo/redo snapshots:
```typescript
const EXCLUDED_DATA_FIELDS = [
  "executionStatus",
  "executionOutput",
  "executionError",
  "isGenerating",
  "generationError",
  "uploadedImage",
  "imageInput",         // NEW
] as const;
```

**B. `lib/flow-storage/validation.ts`** - For save/load:
```typescript
export function sanitizeNodes(nodes: Node[]): Node[] {
  return nodes.map((node) => ({
    ...node,
    data: {
      ...node.data,
      executionStatus: undefined,
      executionOutput: undefined,
      executionError: undefined,
      uploadedImage: undefined,   // Already needed but missing!
      imageInput: undefined,      // NEW
    },
    className: undefined,
  }));
}
```

**C. `lib/hooks/useCollaboration.ts`** - For collab sync:
```typescript
const nodeToPayload = useCallback((node: Node): NodePayload => {
  // Strip runtime image data to avoid syncing large base64
  const { uploadedImage, imageInput, ...cleanData } = node.data as Record<string, unknown>;
  return {
    id: node.id,
    type: node.type || "default",
    position: node.position,
    data: cleanData,
    parentId: node.parentId,
  };
}, []);
```

### 4. Create Vision Module (`lib/vision/index.ts`) ✅

```typescript
import { PROVIDERS, DEFAULT_VISION_MODELS, type ProviderId } from "@/lib/providers";
import { parseImageOutput, type ImageData } from "@/lib/image-utils";

export function modelSupportsVision(provider: ProviderId, model: string): boolean {
  const providerConfig = PROVIDERS[provider];
  if (!providerConfig) return false;
  const modelConfig = providerConfig.models.find((m: { value: string }) => m.value === model);
  return (modelConfig as { supportsVision?: boolean })?.supportsVision ?? false;
}

export function getDefaultVisionModel(provider: ProviderId): string | null {
  return DEFAULT_VISION_MODELS[provider] ?? null;
}

export function getVisionCapableModel(provider: ProviderId, currentModel: string): string | null {
  // Return current if it supports vision
  if (modelSupportsVision(provider, currentModel)) {
    return currentModel;
  }
  // Fall back to default vision model (may be null if provider has none)
  return getDefaultVisionModel(provider);
}

// Resolve image from connection or inline - connection wins if non-empty
export function resolveImageInput(
  connectedImage: string | undefined,
  inlineImage: string | undefined
): ImageData | null {
  const imageSource = (connectedImage && connectedImage.trim()) || inlineImage;
  if (!imageSource) return null;
  return parseImageOutput(imageSource);
}
```

### 5. Update PromptNode Component (`components/Flow/nodes/PromptNode.tsx`) ✅

```typescript
// Imports
import { useRef } from "react";
import { Upload, X } from "lucide-react";
import { parseImageOutput, getImageDataUrl, stringifyImageOutput } from "@/lib/image-utils";
import { modelSupportsVision, getVisionCapableModel } from "@/lib/vision";

// Inside component
const fileInputRef = useRef<HTMLInputElement>(null);
const isImageConnected = edges.some(e => e.target === id && e.targetHandle === "image");
const uploadedImageData = data.imageInput ? parseImageOutput(data.imageInput) : null;

const currentProvider = (data.provider || DEFAULT_PROVIDER) as ProviderId;
const currentModel = data.model || DEFAULT_MODEL;

// File upload with auto-switch guard
const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    const base64 = (reader.result as string).split(",")[1];
    const imageData = stringifyImageOutput({
      type: "image",
      value: base64,
      mimeType: file.type || "image/png",
    });

    const updates: Record<string, unknown> = { imageInput: imageData };

    // Auto-switch to vision model if current doesn't support it
    if (!modelSupportsVision(currentProvider, currentModel)) {
      const visionModel = getVisionCapableModel(currentProvider, currentModel);
      if (visionModel) {
        updates.model = visionModel;
      }
      // If no vision model available, image still uploads but may fail at execution
    }
    updateNodeData(id, updates);
  };
  reader.readAsDataURL(file);
  e.target.value = "";
};

const handleClearImage = () => {
  updateNodeData(id, { imageInput: undefined });
  // Don't revert model - user may want to keep it
};

// UI: Add InputWithHandle with purple color between User Prompt and System Instructions
```

### 6. Update Execution Engine (`lib/execution/engine.ts`) ✅

In `text-generation` case:
```typescript
import { resolveImageInput } from "@/lib/vision";

// Collect image input
const hasImageEdge = "image" in inputs;
const connectedImage = hasImageEdge ? inputs["image"] : undefined;
const inlineImageInput = (node.data?.imageInput as string) || "";

// Use shared resolver - connection wins if non-empty
const imageData = resolveImageInput(connectedImage, inlineImageInput);
const imageInput = imageData ? JSON.stringify(imageData) : undefined;

// Add to request body
const requestBody = {
  ...existing,
  imageInput,  // undefined if no image
};
```

### 7. Update API Route (`app/api/execute/route.ts`) ✅

In text-generation handler:
```typescript
import { parseImageOutput } from "@/lib/image-utils";

// Parse image using shared utility (same as vision module uses)
const imageData = imageInput ? parseImageOutput(imageInput) : null;

// Build messages - Vercel AI SDK format
const messages: CoreMessage[] = [];

if (systemPrompt?.trim()) {
  messages.push({ role: "system", content: systemPrompt.trim() });
}

if (imageData) {
  // Multimodal message
  messages.push({
    role: "user",
    content: [
      { type: "text", text: String(promptInput) },
      {
        type: "image",
        image: imageData.value,  // base64 string
        mediaType: imageData.mimeType,
      }
    ]
  });
} else {
  messages.push({ role: "user", content: String(promptInput) });
}
```

### 8. Update Autopilot System Prompt ✅

Document the new image input handle for text-generation node.

---

## Edge Cases Handled

| Case | Behavior |
|------|----------|
| Connected empty image | Falls back to inline image (via `resolveImageInput`) |
| Image added to non-vision model | Auto-switch if vision model available |
| No vision model for provider | Image uploads but may fail at execution |
| Image removed | Model stays (user chose it) |
| Flow save/load | Image stripped by `sanitizeNodes` |
| Collab sync | Image stripped by `nodeToPayload` |
| Undo/redo | Image stripped by `EXCLUDED_DATA_FIELDS` |
| Text-only prompt | Works as before (no regression) |
| Large images | No size limit currently (consider adding later) |

---

## Implementation Complete ✅

All implementation steps have been completed:
- `npm test` - 65 tests passing
- `npm run lint` - No errors in modified files

## Testing Checklist

- [ ] Connect ImageInputNode → PromptNode image port works
- [ ] Upload image directly in PromptNode works
- [ ] Connection with empty output falls back to inline
- [ ] Auto-switch to vision model on image add
- [ ] No auto-switch if no vision model exists for provider
- [ ] Text-only prompts still work (no regression)
- [ ] Image NOT persisted on save/load (check JSON)
- [ ] Image NOT synced in collaboration
- [ ] Image NOT in undo/redo snapshots
- [ ] Owner-funded execution works with images
- [x] `npm test` passes
- [x] `npm run lint` passes (no errors in modified files)

---

## Notes

- **Model source of truth**: `lib/providers.ts` is the source for UI. `docs/AI_MODELS.md` is documentation only, no code changes needed there.
- **lib/api/providers.ts**: Just a helper for creating Anthropic client, unrelated to model config.
- **Vercel AI SDK**: Uses normalized multimodal format that works across providers.
- **ImageInputNode output**: Confirmed at engine.ts:85 - returns stringified JSON string.
