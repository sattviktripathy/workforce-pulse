"use client";

import { useEffect, useRef, useState } from "react";
import type { MetricsFilter } from "../lib/metrics";

type Role = "user" | "model";
interface Message {
  role: Role;
  text: string;
  toolCalls?: { name: string; args: unknown }[];
}

const SUGGESTED: string[] = [
  "Who in finance is spending the most time on email triage, and how much does it cost us per month?",
  "What's the single highest-ROI automation we should ship next quarter?",
  "Show me everyone whose repetitive-task share went up week-over-week.",
  "Tell me about E010.",
];

function fmtArgs(args: unknown): string {
  if (!args || typeof args !== "object") return "";
  const o = args as Record<string, unknown>;
  const parts: string[] = [];
  for (const [k, v] of Object.entries(o)) {
    if (v == null || v === "") continue;
    if (typeof v === "string") parts.push(`${k}="${v}"`);
    else if (typeof v === "number" || typeof v === "boolean")
      parts.push(`${k}=${v}`);
    else if (typeof v === "object") {
      const inner = Object.entries(v as Record<string, unknown>)
        .filter(([, vv]) => vv != null && vv !== "")
        .map(([kk, vv]) => `${kk}=${JSON.stringify(vv)}`)
        .join(", ");
      if (inner) parts.push(`${k}={${inner}}`);
    }
  }
  return parts.join(", ");
}

export default function Chat({ filter }: { filter: MetricsFilter }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, pending]);

  async function send(text: string) {
    const clean = text.trim();
    if (!clean || pending) return;
    setError(null);
    const next: Message[] = [...messages, { role: "user", text: clean }];
    setMessages(next);
    setInput("");
    setPending(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: next.map(({ role, text }) => ({ role, text })),
          filter,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? `Request failed (${res.status}).`);
        return;
      }
      setMessages([
        ...next,
        {
          role: "model",
          text: data.reply ?? "",
          toolCalls: data.toolCalls ?? [],
        },
      ]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error.");
    } finally {
      setPending(false);
      inputRef.current?.focus();
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-4 right-4 z-40 flex items-center gap-2 rounded-full border border-line bg-panel px-4 py-2.5 text-sm font-medium text-ink shadow-lg shadow-black/40 hover:bg-panel-2"
        aria-label="Open AI assistant"
      >
        <span
          className="inline-block h-2 w-2 rounded-full"
          style={{ background: "var(--color-accent)" }}
        />
        Ask the data
      </button>
    );
  }

  return (
    <div
      className="fixed bottom-4 right-4 z-40 flex max-h-[calc(100vh-2rem)] w-[min(420px,calc(100vw-2rem))] flex-col rounded-2xl border border-line bg-panel shadow-2xl shadow-black/60"
      style={{ height: "min(640px, calc(100vh - 2rem))" }}
      role="dialog"
      aria-label="AI assistant"
    >
      <header className="flex items-center justify-between border-b border-line-soft px-4 py-3">
        <div>
          <div className="kicker">Workforce Pulse · AI</div>
          <h2 className="mt-0.5 text-sm font-semibold text-ink">
            Ask the data
          </h2>
        </div>
        <div className="flex items-center gap-1">
          {messages.length > 0 && (
            <button
              onClick={() => {
                setMessages([]);
                setError(null);
              }}
              className="rounded-md px-2 py-1 text-[11px] text-ink-faint hover:bg-panel-2 hover:text-ink-dim"
              title="Clear conversation"
            >
              Clear
            </button>
          )}
          <button
            onClick={() => setOpen(false)}
            className="rounded-md px-2 py-1 text-ink-faint hover:bg-panel-2 hover:text-ink"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
      </header>

      <div
        ref={scrollRef}
        className="flex-1 space-y-3 overflow-y-auto px-4 py-3"
      >
        {messages.length === 0 && !pending && (
          <div className="space-y-3">
            <p className="text-[13px] text-ink-dim leading-relaxed">
              Grounded in the joined dataset — every number cites a tool call,
              a row count and the date window. Multi-turn: follow-ups like
              <span className="text-ink"> &quot;and break that down by department&quot;</span> work.
            </p>
            <div className="flex flex-col gap-1.5">
              <div className="kicker">Try</div>
              {SUGGESTED.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="rounded-lg border border-line-soft bg-panel-2 px-3 py-2 text-left text-[12.5px] text-ink-dim hover:border-line hover:text-ink"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <Bubble key={i} m={m} />
        ))}

        {pending && (
          <div className="flex items-center gap-2 text-[12px] text-ink-faint">
            <span className="relative inline-flex h-2 w-2">
              <span
                className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75"
                style={{ background: "var(--color-accent)" }}
              />
              <span
                className="relative inline-flex h-2 w-2 rounded-full"
                style={{ background: "var(--color-accent)" }}
              />
            </span>
            thinking, calling tools…
          </div>
        )}

        {error && (
          <div
            className="rounded-md border px-3 py-2 text-[12px]"
            style={{
              borderColor: "var(--color-alert)",
              color: "var(--color-alert)",
              background:
                "color-mix(in oklab, var(--color-alert) 8%, transparent)",
            }}
          >
            {error}
          </div>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="border-t border-line-soft p-3"
      >
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            disabled={pending}
            rows={1}
            placeholder="Ask about hours, money, automation, anomalies…"
            className="min-h-[36px] max-h-32 flex-1 resize-none rounded-lg border border-line bg-panel-2 px-3 py-2 text-[13px] text-ink placeholder:text-ink-faint focus:border-line focus:outline-none focus:ring-1 focus:ring-line"
          />
          <button
            type="submit"
            disabled={pending || !input.trim()}
            className="rounded-lg bg-ink px-3 py-2 text-[12.5px] font-semibold text-canvas disabled:opacity-40"
          >
            Send
          </button>
        </div>
        <div className="mt-1.5 text-[10.5px] text-ink-faint">
          Enter to send · Shift+Enter for newline
        </div>
      </form>
    </div>
  );
}

function Bubble({ m }: { m: Message }) {
  const isUser = m.role === "user";
  return (
    <div className={`fp-fade ${isUser ? "ml-6" : "mr-6"}`}>
      <div className="kicker mb-1">{isUser ? "You" : "Analyst"}</div>
      <div
        className={`whitespace-pre-wrap rounded-lg px-3 py-2 text-[13px] leading-relaxed ${
          isUser
            ? "border border-line bg-panel-2 text-ink"
            : "border border-line-soft bg-canvas text-ink"
        }`}
      >
        {m.text || (
          <span className="text-ink-faint italic">(no reply)</span>
        )}
      </div>
      {!isUser && m.toolCalls && m.toolCalls.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {m.toolCalls.map((c, i) => (
            <span
              key={i}
              className="tnum rounded-full border border-line-soft bg-panel-2 px-2 py-0.5 text-[10.5px] text-ink-faint"
              title={JSON.stringify(c.args)}
            >
              → {c.name}
              {fmtArgs(c.args) ? `(${fmtArgs(c.args)})` : "()"}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
