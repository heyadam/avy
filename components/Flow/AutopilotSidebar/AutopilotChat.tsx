"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Message,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputFooter,
  PromptInputSubmit,
} from "@/components/ai-elements/prompt-input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Loader } from "@/components/ai-elements/loader";
import { Check, Sparkles, Undo2, ChevronDown, Play, Zap, ListTodo } from "lucide-react";
import type { AutopilotMessage, AutopilotModel, AutopilotMode, FlowPlan } from "@/lib/autopilot/types";

const MODELS: { id: AutopilotModel; name: string }[] = [
  { id: "claude-sonnet-4-5", name: "Sonnet 4.5" },
  { id: "claude-opus-4-5", name: "Opus 4.5" },
];

const MODES: { id: AutopilotMode; name: string; icon: typeof Zap }[] = [
  { id: "execute", name: "Execute", icon: Zap },
  { id: "plan", name: "Plan", icon: ListTodo },
];

const SUGGESTED_PROMPTS = [
  "Summarize the input text",
  "Generate an image from text",
  "Translate text to Spanish",
  "Analyze sentiment of input",
];

interface AutopilotChatProps {
  messages: AutopilotMessage[];
  isLoading: boolean;
  error: string | null;
  mode: AutopilotMode;
  onModeChange: (mode: AutopilotMode) => void;
  onSendMessage: (content: string, model: AutopilotModel) => void;
  onApprovePlan: (messageId: string, model: AutopilotModel) => void;
  onUndoChanges: (messageId: string) => void;
}

export function AutopilotChat({
  messages,
  isLoading,
  error,
  mode,
  onModeChange,
  onSendMessage,
  onApprovePlan,
  onUndoChanges,
}: AutopilotChatProps) {
  const [inputValue, setInputValue] = useState("");
  const [selectedModel, setSelectedModel] = useState<AutopilotModel>("claude-sonnet-4-5");
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const currentModel = MODELS.find((m) => m.id === selectedModel) ?? MODELS[0];

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="flex size-full flex-col items-center justify-center gap-4 p-6 text-center">
            <div className="text-muted-foreground">
              <Sparkles className="h-8 w-8" />
            </div>
            <div className="space-y-1">
              <h3 className="font-medium text-sm">Autopilot</h3>
              <p className="text-muted-foreground text-xs">
                Describe what to build
              </p>
            </div>
            <div className="flex flex-col gap-2 w-full max-w-[280px]">
              {SUGGESTED_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => onSendMessage(prompt, selectedModel)}
                  disabled={isLoading}
                  className="text-left text-xs px-3 py-2 rounded-lg border border-border/50 hover:border-purple-500/50 hover:bg-purple-500/5 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4 p-3">
            {messages.map((message) => (
              <Message key={message.id} from={message.role}>
                <MessageContent>
                  {message.role === "assistant" ? (
                    <>
                      <MessageResponse className="[&_pre]:text-[8px] [&_pre]:leading-[1.2] [&_pre]:p-1.5 [&_code]:text-[8px]">{message.content}</MessageResponse>
                      {/* Plan awaiting approval */}
                      {message.pendingPlan && !message.planApproved && (
                        <PlanCard
                          plan={message.pendingPlan}
                          onApprove={() => onApprovePlan(message.id, selectedModel)}
                          isLoading={isLoading}
                        />
                      )}

                      {/* Plan approved */}
                      {message.pendingPlan && message.planApproved && (
                        <div className="mt-3 pt-3 border-t">
                          <span className="flex items-center gap-1 text-xs text-blue-600">
                            <Check className="h-3 w-3" />
                            Plan Approved
                          </span>
                        </div>
                      )}

                      {/* Flow changes applied */}
                      {message.pendingChanges && (
                        <div className="mt-3 pt-3 border-t">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs text-muted-foreground">
                              {message.pendingChanges.actions.length} change
                              {message.pendingChanges.actions.length !== 1 ? "s" : ""}
                            </span>
                            {message.applied ? (
                              <div className="flex items-center gap-2">
                                <span className="flex items-center gap-1 text-xs text-green-600">
                                  <Check className="h-3 w-3" />
                                  Applied
                                </span>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
                                  onClick={() => onUndoChanges(message.id)}
                                >
                                  <Undo2 className="h-3 w-3 mr-1" />
                                  Undo
                                </Button>
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">
                                Undone
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <span>{message.content}</span>
                  )}
                </MessageContent>
              </Message>
            ))}
            {isLoading && messages[messages.length - 1]?.content === "" && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader className="h-4 w-4" />
                <span className="text-sm">Thinking...</span>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {error && (
        <div className="px-3 py-2 text-xs text-red-600 bg-red-50 dark:bg-red-950/20">
          {error}
        </div>
      )}

      <div className="p-3 border-t">
        <PromptInput
          onSubmit={({ text }) => {
            if (text.trim() && !isLoading) {
              onSendMessage(text, selectedModel);
              setInputValue("");
            }
          }}
        >
          <PromptInputTextarea
            placeholder="Describe what to build..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            className="min-h-[60px] text-sm"
            disabled={isLoading}
          />
          <PromptInputFooter className="justify-between">
            <div className="flex items-center gap-1">
              {/* Mode Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-[11px] text-muted-foreground hover:text-foreground gap-1"
                  >
                    {(() => {
                      const CurrentIcon = MODES.find((m) => m.id === mode)?.icon ?? Zap;
                      return <CurrentIcon className="h-3 w-3" />;
                    })()}
                    <span>{MODES.find((m) => m.id === mode)?.name}</span>
                    <ChevronDown className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="min-w-[120px]">
                  {MODES.map((m) => (
                    <DropdownMenuItem
                      key={m.id}
                      onClick={() => onModeChange(m.id)}
                      className="text-xs gap-2"
                    >
                      <m.icon className="h-3.5 w-3.5" />
                      <span className="flex-1">{m.name}</span>
                      {m.id === mode && (
                        <Check className="h-3 w-3" />
                      )}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Model Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-[11px] text-muted-foreground hover:text-foreground gap-1"
                  >
                    <span>{currentModel.name}</span>
                    <ChevronDown className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="min-w-[120px]">
                  {MODELS.map((model) => (
                    <DropdownMenuItem
                      key={model.id}
                      onClick={() => setSelectedModel(model.id)}
                      className="text-xs gap-2"
                    >
                      <span className="flex-1">{model.name}</span>
                      {model.id === selectedModel && (
                        <Check className="h-3 w-3" />
                      )}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <PromptInputSubmit
              disabled={!inputValue.trim() || isLoading}
              status={isLoading ? "streaming" : undefined}
            />
          </PromptInputFooter>
        </PromptInput>
      </div>
    </div>
  );
}

interface PlanCardProps {
  plan: FlowPlan;
  onApprove: () => void;
  isLoading: boolean;
}

function PlanCard({ plan, onApprove, isLoading }: PlanCardProps) {
  return (
    <div className="mt-3 pt-3 border-t">
      <div className="rounded-lg border bg-muted/30 p-3 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h4 className="text-sm font-medium">{plan.summary}</h4>
            <p className="text-xs text-muted-foreground mt-0.5">
              {plan.estimatedChanges.nodesToAdd} node
              {plan.estimatedChanges.nodesToAdd !== 1 ? "s" : ""},{" "}
              {plan.estimatedChanges.edgesToAdd} edge
              {plan.estimatedChanges.edgesToAdd !== 1 ? "s" : ""}
              {plan.estimatedChanges.edgesToRemove > 0 && (
                <>, {plan.estimatedChanges.edgesToRemove} removal
                  {plan.estimatedChanges.edgesToRemove !== 1 ? "s" : ""}</>
              )}
            </p>
          </div>
        </div>

        {plan.steps.length > 0 && (
          <ul className="space-y-1.5 text-xs">
            {plan.steps.map((step, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-muted-foreground shrink-0">{i + 1}.</span>
                <span>{step.description}</span>
              </li>
            ))}
          </ul>
        )}

        <div className="flex justify-end">
          <Button
            size="sm"
            onClick={onApprove}
            disabled={isLoading}
            className="h-7 px-3 text-xs bg-purple-600 hover:bg-purple-700"
          >
            <Play className="h-3 w-3 mr-1.5" />
            Execute Plan
          </Button>
        </div>
      </div>
    </div>
  );
}
