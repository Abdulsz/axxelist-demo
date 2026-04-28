"use client";

import { FormEvent, useMemo, useState } from "react";
import { ConciergeMessage } from "@/components/concierge-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useConciergeStore } from "@/lib/store";
import type { Listing, ToolEvent } from "@/lib/types";

type ChatItem = { role: "user" | "assistant"; content: string };

type ConciergePanelProps = {
  onEvents: (events: ToolEvent[], listings?: Listing[]) => void;
};

const STARTER_PROMPTS = [
  "2BR under $2,500 near BART, dogs ok",
  "Loft with lots of natural light in Jack London Square",
  "Quiet 1BR in Rockridge with parking",
];

export function ConciergePanel({ onEvents }: ConciergePanelProps) {
  const [messages, setMessages] = useState<ChatItem[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const selectedListingId = useConciergeStore((s) => s.selectedListingId);

  const showStarters = useMemo(() => messages.length === 0, [messages.length]);

  async function sendMessage(content: string) {
    const text = content.trim();
    if (!text) return;
    setLoading(true);
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setInput("");

    try {
      const response = await fetch("/api/concierge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, { role: "user", content: text }],
          context: { selectedListingId },
        }),
      });

      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Concierge request failed");

      setMessages((prev) => [...prev, { role: "assistant", content: payload.message ?? "Done." }]);
      onEvents((payload.events ?? []) as ToolEvent[], payload.listings as Listing[] | undefined);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unexpected concierge error";
      setMessages((prev) => [...prev, { role: "assistant", content: `I had trouble — try again. (${message})` }]);
    } finally {
      setLoading(false);
    }
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    void sendMessage(input);
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="mb-4 border-b border-slate-100 pb-3">
        <h2 className="text-lg font-semibold text-slate-900">AI Concierge</h2>
        <p className="text-sm text-slate-600">Describe what you want and I will refine the listings.</p>
      </div>

      <ScrollArea className="h-0 min-h-0 flex-1 pr-2">
        <div className="space-y-3">
          {messages.map((message, index) => (
            <ConciergeMessage key={`${message.role}-${index}-${message.content.slice(0, 8)}`} role={message.role} content={message.content} />
          ))}
          {loading ? <ConciergeMessage role="assistant" content="Thinking..." /> : null}
        </div>
      </ScrollArea>

      {showStarters ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {STARTER_PROMPTS.map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={() => void sendMessage(prompt)}
              className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-700 transition hover:bg-slate-100"
            >
              {prompt}
            </button>
          ))}
        </div>
      ) : null}

      <form
        onSubmit={onSubmit}
        className="sticky bottom-0 mt-3 flex items-center gap-2 border-t border-slate-100 bg-white/95 pt-3 backdrop-blur"
      >
        <Input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Ask for a neighborhood, budget, vibe, or summary..."
          disabled={loading}
        />
        <Button type="submit" disabled={loading || !input.trim()}>
          Send
        </Button>
      </form>
    </div>
  );
}
