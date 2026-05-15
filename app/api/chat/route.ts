// Gemini chat endpoint. Function-calling loop over our normalized aggregates
// (lib/ai/tools.ts) — every quantitative answer the model gives is grounded in
// a tool response, no inventing numbers. Multi-turn: history rebuilt per
// request from the messages array the client maintains.

import "server-only";
import { GoogleGenerativeAI, type Part } from "@google/generative-ai";
import { getDataset } from "../../../lib/data";
import { EMPTY_FILTER, type MetricsFilter } from "../../../lib/metrics";
import { SYSTEM_PROMPT } from "../../../lib/ai/system-prompt";
import { TOOL_DECLARATIONS, dispatchTool } from "../../../lib/ai/tools";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MODEL = "gemini-2.5-flash-lite";
const MAX_HOPS = 6;

type ChatRole = "user" | "model";
interface ChatMessage {
  role: ChatRole;
  text: string;
}
interface ChatRequest {
  messages: ChatMessage[];
  filter?: MetricsFilter;
}

interface ToolCallTrace {
  name: string;
  args: unknown;
}

export async function POST(req: Request): Promise<Response> {
  let body: ChatRequest;
  try {
    body = (await req.json()) as ChatRequest;
  } catch {
    return Response.json(
      { error: "Invalid JSON body." },
      { status: 400 },
    );
  }

  const messages = Array.isArray(body.messages) ? body.messages : [];
  if (messages.length === 0) {
    return Response.json(
      { error: "messages[] is empty." },
      { status: 400 },
    );
  }
  const last = messages[messages.length - 1];
  if (!last || last.role !== "user" || !last.text?.trim()) {
    return Response.json(
      { error: "Last message must be a non-empty user turn." },
      { status: 400 },
    );
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "AI not configured. Set GEMINI_API_KEY in .env.local." },
      { status: 503 },
    );
  }

  const activeFilter: MetricsFilter = {
    department: body.filter?.department ?? null,
    taskCategory: body.filter?.taskCategory ?? null,
  };
  const filterIsEmpty =
    !activeFilter.department && !activeFilter.taskCategory;
  const filterForResolve = filterIsEmpty ? EMPTY_FILTER : activeFilter;

  const ds = await getDataset();

  const history = messages.slice(0, -1).map((m) => ({
    role: m.role === "model" ? "model" : "user",
    parts: [{ text: m.text }],
  }));

  const filterContext = filterIsEmpty
    ? "Dashboard filter: none (company-wide)."
    : `Dashboard filter active — ${[
        activeFilter.department && `department=${activeFilter.department}`,
        activeFilter.taskCategory && `taskCategory=${activeFilter.taskCategory}`,
      ]
        .filter(Boolean)
        .join(", ")}. Tools default to this filter; pass an explicit empty filter to a tool for company-wide.`;

  const systemInstruction = `${SYSTEM_PROMPT}\n\nCURRENT CONTEXT: ${filterContext}`;

  const genai = new GoogleGenerativeAI(apiKey);
  const model = genai.getGenerativeModel({
    model: MODEL,
    systemInstruction,
    tools: [{ functionDeclarations: TOOL_DECLARATIONS }],
  });

  const chat = model.startChat({ history });

  const toolCalls: ToolCallTrace[] = [];
  let nextMessage: string | Part[] = last.text;
  let reply = "";
  let stoppedEarly = false;

  try {
    for (let hop = 0; hop < MAX_HOPS; hop++) {
      const result = await chat.sendMessage(nextMessage);
      const calls = result.response.functionCalls();
      if (!calls || calls.length === 0) {
        reply = result.response.text();
        break;
      }
      const fnResponseParts: Part[] = [];
      for (const call of calls) {
        const args = (call.args ?? {}) as Record<string, unknown>;
        toolCalls.push({ name: call.name, args });
        const data = dispatchTool(call.name, args, ds, filterForResolve);
        fnResponseParts.push({
          functionResponse: {
            name: call.name,
            response: { content: data },
          },
        });
      }
      nextMessage = fnResponseParts;
      if (hop === MAX_HOPS - 1) {
        stoppedEarly = true;
      }
    }

    if (stoppedEarly && !reply) {
      reply =
        "I had to stop before finalizing an answer — too many tool calls in one turn. Try a narrower question.";
    }

    return Response.json({ reply, toolCalls, stoppedEarly });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // Surface a safe message; full error is logged server-side.
    console.error("[/api/chat] Gemini error:", msg);
    const looksLikeAuth = /\b(api[_ ]key|401|403)\b/i.test(msg);
    const looksLikeRate = /\b(quota|rate limit|429)\b/i.test(msg);
    const looksLikeOverload = /\b(503|unavailable|overloaded|high demand)\b/i.test(msg);
    return Response.json(
      {
        error: looksLikeAuth
          ? "Gemini rejected the API key. Check GEMINI_API_KEY."
          : looksLikeRate
            ? "Gemini rate limit hit. Try again in a moment."
            : looksLikeOverload
              ? "Gemini is overloaded right now. Retry in a few seconds."
              : "AI request failed. Try again.",
        detail: msg,
      },
      { status: 502 },
    );
  }
}
