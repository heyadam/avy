# Avy Designer Guide

A non-technical overview of how Avy works, written for designers who need to understand the product.

---

## What is Avy?

Avy is a **visual workflow builder for AI**. Think of it like connecting building blocks together to create a chain of AI actions. Instead of writing code, users drag and drop boxes (called "nodes") onto a canvas and connect them with lines to build powerful AI pipelines.

**Simple example:** A user types "a sunset over mountains" → Avy refines that description using AI → Then generates a beautiful image from that description → And displays the result.

---

## The Big Picture

Avy has four main areas that work together:

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  ┌──────────────┐  ┌──────────────────────┐  ┌───────────────┐ │
│  │              │  │                      │  │               │ │
│  │  Autopilot   │  │      Canvas          │  │   Responses   │ │
│  │  Sidebar     │  │   (Flow Editor)      │  │   Sidebar     │ │
│  │              │  │                      │  │               │ │
│  │  Chat with   │  │   Where nodes live   │  │   See AI      │ │
│  │  AI to build │  │   and connect        │  │   output      │ │
│  │  workflows   │  │                      │  │               │ │
│  │              │  │                      │  │               │ │
│  └──────────────┘  └──────────────────────┘  └───────────────┘ │
│                                                                 │
│                    ┌──────────────────────┐                     │
│                    │     Action Bar       │                     │
│                    │  (Control Buttons)   │                     │
│                    └──────────────────────┘                     │
└─────────────────────────────────────────────────────────────────┘
```

---

## The Four Node Types

Nodes are the building blocks of any workflow. Each one does something different:

### 1. Input Node (Purple)
**What it does:** The starting point. Users type whatever they want here—a question, a creative prompt, or instructions.

**Visual:** Purple icon with a keyboard symbol. Contains a text area where users type.

**Think of it as:** The "start here" box. Whatever the user types flows into the rest of the workflow.

---

### 2. Prompt Node (Gray)
**What it does:** Sends text to an AI language model (like ChatGPT or Claude) and gets a response back.

**Visual:** Gray icon with a message bubble. Contains:
- A text area for "system instructions" (tells the AI how to behave)
- A dropdown to pick which AI company to use (OpenAI, Google, Anthropic)
- A dropdown to pick which specific AI model to use

**Think of it as:** The "ask AI" box. It takes whatever input it receives, sends it to an AI with your instructions, and passes the response along.

---

### 3. Image Node (Gray)
**What it does:** Creates images using AI. Takes a text description and turns it into a picture.

**Visual:** Gray icon with an image symbol. Contains:
- A text area for instructions on what kind of image to create
- Dropdowns for provider and model selection
- Options for image size, quality, and format

**Think of it as:** The "create picture" box. Describe what you want, and AI draws it.

---

### 4. Output Node (Blue)
**What it does:** The finish line. Displays the final result and sends it to the Responses sidebar.

**Visual:** Blue icon with a square symbol. Shows whatever result it receives (text or images).

**Think of it as:** The "show result" box. This is where users see what their workflow created.

---

## How Users Build Workflows

### Method 1: Drag and Drop (Manual)

1. **Add nodes:** Click the "+" button at the bottom → A popup shows all four node types → Drag one onto the canvas
2. **Connect nodes:** Click and drag from one node's output handle (small circle) to another node's input handle
3. **Configure:** Click on nodes to edit their settings (what prompt to use, which AI model, etc.)
4. **Run:** Press the green play button to execute the workflow

### Method 2: Chat with Autopilot (AI-Assisted)

1. **Open Autopilot:** Click the sparkles icon at the bottom
2. **Describe what you want:** Type something like "Add a node that translates text to French"
3. **AI builds it:** Autopilot automatically adds the nodes and connections for you
4. **Review:** New nodes glow purple until you interact with them
5. **Undo if needed:** Don't like the changes? Click undo

---

## The Action Bar

A floating control panel at the bottom center of the screen:

| Button | Icon | What it does |
|--------|------|--------------|
| **Add Node** | + | Opens the node selection popup |
| **Autopilot** | Sparkles | Opens/closes the AI assistant sidebar |
| **Responses** | Panel icon | Opens/closes the results sidebar |
| **Settings** | Gear | Opens API key configuration |
| **Reset** | Circular arrows | Clears all results and starts fresh |
| **Run** | Play triangle | Executes the entire workflow |

---

## What Happens When You Run a Workflow

1. **User clicks Run** → The play button becomes a spinning loader
2. **Data flows through nodes** → Starting from Input, moving through each connection
3. **Each node shows its status:**
   - 🔵 **Running:** Blue ring, spinner icon
   - ✅ **Success:** Fades to normal
   - ❌ **Error:** Red ring, error message appears
4. **Results stream in real-time** → As AI generates responses, they appear character-by-character in the Responses sidebar
5. **Multiple paths work in parallel** → If the workflow branches, all branches execute simultaneously

---

## Visual Design System

### Colors

| Element | Color | Usage |
|---------|-------|-------|
| Background | Dark gray (neutral-800/900) | Main canvas and sidebars |
| Input Node | Purple | Entry points |
| Prompt Node | Gray | AI text processing |
| Image Node | Gray | AI image generation |
| Output Node | Blue | Final results |
| Connections | Cyan/Purple/Amber glow | Based on data type |
| Autopilot highlights | Purple glow | Newly added nodes |
| Selection | Yellow border | Selected nodes |
| Errors | Red | Error states and messages |
| Success | Green | Completed actions |

### Node Anatomy

Every node follows the same structure:

```
┌──────────────────────────────┐
│  [Icon]  Node Title    [●]   │  ← Header (title + status dot)
├──────────────────────────────┤
│                              │
│   Configuration area         │  ← Body (textareas, dropdowns)
│   (varies by node type)      │
│                              │
├──────────────────────────────┤
│   Result or placeholder      │  ← Footer (output/status)
└──────────────────────────────┘
```

### Interaction Patterns

- **Pan the canvas:** Click and drag anywhere
- **Select multiple nodes:** Hold spacebar + drag to draw a selection box
- **Delete:** Select nodes/connections and press Delete key
- **Edit node titles:** Click on any title to rename it inline
- **Resize sidebars:** Drag the edge of Autopilot or Responses to adjust width

---

## The Sidebars

### Autopilot Sidebar (Left)
- **Width:** 320-600 pixels (resizable)
- **Purpose:** Chat interface for AI-assisted workflow building
- **Features:**
  - Model selector (choose which AI to talk to)
  - Suggested prompts to get started
  - Message history
  - Clear history button
  - Auto-apply toggle

### Responses Sidebar (Right)
- **Width:** 240-800 pixels (resizable)
- **Purpose:** Display workflow results
- **Features:**
  - Real-time streaming output
  - Shows which node produced each result
  - Displays both text and images
  - Error messages in red
  - Auto-scrolls to new content

---

## The Default Example Workflow

When users first open Avy, they see a pre-built example:

```
                              ┌─────────────┐
                         ┌───▶│   Output    │ (Text result)
┌─────────┐   ┌────────┐ │    └─────────────┘
│  Input  │──▶│ Prompt │─┤
│         │   │        │ │    ┌─────────────┐
│ "A cute │   │Refines │ └───▶│   Output    │ (Image result)
│ robot   │   │the     │      └─────────────┘
│ surfing"│   │prompt  │
└─────────┘   └────┬───┘
                   │
                   ▼
              ┌─────────┐
              │  Image  │
              │         │
              │Generates│
              │ picture │
              └─────────┘
```

This shows users how text flows from Input → gets refined by Prompt → generates an Image → displays in two Output nodes.

---

## Supported AI Providers

### For Text Generation
- **OpenAI:** GPT-5 family (GPT-5, GPT-5 Mini, GPT-5 Nano)
- **Google:** Gemini models (2.5 Flash, 2.5 Pro, 2.0 Flash)
- **Anthropic:** Claude models (Sonnet 4.5, Haiku 3.5)

### For Image Generation
- **OpenAI:** GPT-5 (supports partial image streaming)
- **Google:** Gemini models (2.5 Flash, 3 Pro)

---

## Key User Experiences

### Building a Simple Workflow
1. User drags an Input node onto canvas
2. Drags a Prompt node and connects them
3. Drags an Output node and connects it to Prompt
4. Types a question in Input
5. Writes instructions in Prompt (e.g., "Summarize this text")
6. Clicks Run
7. Watches the response stream into the Output and Responses sidebar

### Using Autopilot
1. User clicks the sparkles icon
2. Types "Create a workflow that takes a topic and writes a haiku about it"
3. Autopilot adds Input → Prompt → Output nodes automatically
4. New nodes glow purple
5. User clicks Run to test it

### Handling Errors
1. If something goes wrong (e.g., bad API key), the failing node shows a red ring
2. An error message appears in the node's footer
3. The Responses sidebar shows the error with a red alert icon
4. User can fix the issue and try again

---

## Summary

Avy lets anyone build AI workflows visually by:
1. **Dragging** nodes onto a canvas
2. **Connecting** them to create a flow of data
3. **Configuring** each node with prompts and AI model choices
4. **Running** the workflow to see AI-generated results
5. **Optionally using Autopilot** to build workflows through natural conversation

The interface prioritizes real-time feedback, visual clarity, and flexibility—users can see exactly what's happening as their AI workflow executes.
