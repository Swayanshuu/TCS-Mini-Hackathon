import { type KeyboardEvent, useEffect, useRef, useState } from "react";
import { RotateCcw, Send, Terminal, X } from "lucide-react";
import { api } from "../api";
import type { ChatCard, ChatTrace, RiskLevel } from "../types";
import { AgentAuraFace } from "./FusionMarks";
import { CategoryBadge, CategoryTile, StatusDotText, riskToTone } from "./UiPrimitives";

interface Message {
  id: string;
  role: "user" | "assistant";
  text: string;
  traces?: ChatTrace[];
  cards?: ChatCard[];
  suggestions?: string[];
  error?: boolean;
}

const INITIAL_SUGGESTIONS = [
  "How can I predict a meal?",
  "Predict tomorrow's Lunch with Rice-Paneer",
  "Which food items have the highest wastage?",
  "How do holidays and exams affect attendance?",
];

function renderFormattedText(text: string) {
  const lines = text.split("\n");
  return lines.map((line, lineIdx) => {
    const tokens = line.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
    return (
      <div key={lineIdx} className={line.trim() === "" ? "h-1.5" : "leading-relaxed"}>
        {tokens.map((tok, i) => {
          if (tok.startsWith("**") && tok.endsWith("**")) {
            return (
              <strong key={i} className="font-semibold text-[var(--ink-strong)]">
                {tok.slice(2, -2)}
              </strong>
            );
          }
          if (tok.startsWith("`") && tok.endsWith("`")) {
            return (
              <code
                key={i}
                className="f3-mono rounded bg-[var(--surface-sunken)] px-1 py-0.5 text-[11.5px] text-[var(--ink-strong)]"
              >
                {tok.slice(1, -1)}
              </code>
            );
          }
          return <span key={i}>{tok}</span>;
        })}
      </div>
    );
  });
}

export function MessIQChat({
  activePage,
}: {
  activePage: string;
}) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      text: "Ask me to predict any upcoming meal, calculate kitchen prep quantities, or inspect waste, shortages, and model accuracy.",
      suggestions: INITIAL_SUGGESTIONS,
    },
  ]);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const onKeyDown = (e: globalThis.KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
      if (e.key === "Escape" && open) {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 60);
    }
  }, [open]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, thinking, open]);

  const sendMessage = async (raw?: string) => {
    const text = (raw ?? input).trim();
    if (!text || thinking) return;

    const userMsg: Message = {
      id: `u-${Date.now()}`,
      role: "user",
      text,
    };
    setMessages((prev) => [...prev, userMsg]);
    if (!raw) setInput("");
    setThinking(true);

    try {
      const res = await api.chat(text, { active_page: activePage });
      const botMsg: Message = {
        id: `a-${Date.now()}`,
        role: "assistant",
        text: res.reply,
        traces: res.traces,
        cards: res.cards,
        suggestions: res.suggestions,
      };
      setMessages((prev) => [...prev, botMsg]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: `e-${Date.now()}`,
          role: "assistant",
          text: err instanceof Error ? err.message : "Failed to reach MessIQ assistant.",
          error: true,
        },
      ]);
    } finally {
      setThinking(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const resetChat = () => {
    setMessages([
      {
        id: "welcome",
        role: "assistant",
        text: "Session cleared. Ask me to forecast attendance, check kitchen quantities, or analyze waste.",
        suggestions: INITIAL_SUGGESTIONS,
      },
    ]);
  };

  const lastMessage = messages[messages.length - 1];

  return (
    <>
      {/* Floating Launcher Pill */}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed bottom-5 right-5 z-40 flex h-11 items-center gap-2.5 rounded-full border border-[var(--line-strong)] bg-[var(--surface-paper)] pl-2 pr-3.5 text-[13px] font-semibold text-[var(--ink-strong)] transition-transform active:scale-95"
          aria-label="Open MessIQ Assistant"
        >
          <AgentAuraFace mood="idle" size={28} />
          <span>Ask MessIQ</span>
          <span className="f3-count hidden sm:inline-flex">Ctrl K</span>
        </button>
      )}

      {/* Assistant Drawer */}
      {open && (
        <aside
          className="fixed bottom-4 right-4 z-50 flex h-[min(640px,calc(100vh-2rem))] w-[min(460px,calc(100vw-2rem))] flex-col overflow-hidden rounded-[12px] border border-[var(--line-strong)] bg-[var(--surface-paper)]"
          aria-label="MessIQ Assistant"
        >
          {thinking && <div className="dusk-dreamline" />}

          {/* Header */}
          <div className="flex items-center justify-between border-b border-[var(--line)] bg-[var(--surface-subtle)] px-3.5 py-2.5">
            <div className="flex items-center gap-2.5">
              <AgentAuraFace
                mood={thinking ? "thinking" : lastMessage?.role === "assistant" ? "done" : "idle"}
                size={30}
              />
              <div>
                <div className="text-[13px] font-semibold text-[var(--ink-strong)]">MessIQ Assistant</div>
                {thinking ? (
                  <div className="flex items-center gap-1.5 text-[11px] font-medium dusk-thinking-text">
                    <span className="dusk-ember" />
                    <span>Querying ML &amp; CSVs…</span>
                  </div>
                ) : (
                  <StatusDotText label="Ready · Zero-API Local ML" tone="green" />
                )}
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={resetChat}
                className="f3-btn f3-btn-sm f3-btn-ghost w-7 px-0"
                title="Reset chat"
                aria-label="Reset chat"
              >
                <RotateCcw size={14} />
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="f3-btn f3-btn-sm f3-btn-ghost w-7 px-0"
                title="Close"
                aria-label="Close assistant"
              >
                <X size={15} />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-3.5">
            {messages.map((m, idx) => (
              <div key={m.id} className={`flex flex-col ${m.role === "user" ? "items-end" : "items-start"}`}>
                {m.role === "user" ? (
                  <div className="max-w-[85%] rounded-[10px] border border-[var(--line)] bg-[var(--surface-sunken)] px-3 py-2 text-[13px] text-[var(--ink-strong)]">
                    {m.text}
                  </div>
                ) : (
                  <div className="w-full space-y-2">
                    {/* Tool Traces */}
                    {m.traces && m.traces.length > 0 && (
                      <div className="space-y-1">
                        {m.traces.map((tr, i) => (
                          <div
                            key={`${tr.tool}-${i}`}
                            className="flex items-center justify-between rounded-[7px] border border-[var(--line)] bg-[var(--surface-subtle)] px-2.5 py-1.5 text-[11.5px]"
                          >
                            <div className="flex min-w-0 items-center gap-2">
                              <CategoryTile size={20} tone="pink">
                                <Terminal size={11} />
                              </CategoryTile>
                              <span className="f3-mono truncate font-medium text-[var(--ink-strong)]">
                                {tr.tool}
                              </span>
                              <span className="truncate text-[var(--ink-faint)]">{tr.detail}</span>
                            </div>
                            <span className="f3-mono ml-2 shrink-0 text-[11px]" style={{ color: "var(--green-text)" }}>
                              {tr.ms}ms · Done
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Reply Body */}
                    <div
                      className="rounded-[10px] border border-[var(--line)] bg-[var(--surface-paper)] px-3 py-2.5 text-[13px] text-[var(--ink-body)]"
                      style={
                        m.error
                          ? { borderColor: "var(--red-fill)", backgroundColor: "var(--red-tint)", color: "var(--red-text)" }
                          : undefined
                      }
                    >
                      {renderFormattedText(m.text)}
                    </div>

                    {/* Structured Cards */}
                    {m.cards &&
                      m.cards.map((card, cIdx) => (
                        <div key={cIdx} className="rounded-[9px] border border-[var(--line)] bg-[var(--surface-subtle)] p-2.5">
                          <div className="f3-label mb-2">{card.title}</div>
                          {card.type === "metrics" && card.items && (
                            <div className="grid grid-cols-2 gap-2">
                              {card.items.map((it) => (
                                <div
                                  key={it.label}
                                  className="rounded-[6px] border border-[var(--line)] bg-[var(--surface-paper)] px-2.5 py-1.5"
                                >
                                  <div className="text-[11px] text-[var(--ink-faint)]">{it.label}</div>
                                  <div className="f3-mono mt-0.5 text-[12.5px] font-semibold text-[var(--ink-strong)]">
                                    {it.value}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          {card.type === "table" && card.headers && card.rows && (
                            <div className="overflow-x-auto">
                              <table className="w-full text-left text-[11.5px]">
                                <thead>
                                  <tr className="border-b border-[var(--line)]">
                                    {card.headers.map((h) => (
                                      <th key={h} className="pb-1 pr-2 font-semibold text-[var(--ink-faint)]">
                                        {h}
                                      </th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {card.rows.map((r, rIdx) => (
                                    <tr key={rIdx} className="border-b border-[var(--line)] last:border-0">
                                      <td className="py-1.5 pr-2 font-medium text-[var(--ink-strong)]">{r.col1}</td>
                                      <td className="f3-mono py-1.5 pr-2">{r.col2}</td>
                                      <td className="f3-mono py-1.5 pr-2 font-semibold">{r.col3}</td>
                                      <td className="f3-mono py-1.5 pr-2 text-[var(--ink-muted)]">{r.col4}</td>
                                      <td className="py-1.5">
                                        <CategoryBadge label={r.risk} tone={riskToTone(r.risk as RiskLevel)} />
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      ))}

                    {/* Follow-up Suggestion Chips (only on latest assistant message) */}
                    {idx === messages.length - 1 && m.suggestions && m.suggestions.length > 0 && !thinking && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {m.suggestions.map((s) => (
                          <button
                            key={s}
                            type="button"
                            onClick={() => sendMessage(s)}
                            className="f3-btn f3-btn-sm f3-btn-outline h-auto min-h-[26px] whitespace-normal py-1 text-left text-[12px]"
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Composer with Dusk Halo while active */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendMessage();
            }}
            className="border-t border-[var(--line)] bg-[var(--surface-subtle)] p-3"
          >
            <div
              className={`flex items-end gap-2 rounded-[10px] border border-[var(--line)] bg-[var(--surface-paper)] p-2 transition-all ${
                thinking ? "dusk-halo-active" : ""
              }`}
            >
              <textarea
                ref={inputRef}
                rows={1}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about predictions, food waste, or menus…"
                className="max-h-24 flex-1 resize-none bg-transparent px-1 py-1 text-[13px] text-[var(--ink-strong)] outline-none placeholder:text-[var(--ink-faint)]"
              />
              <button
                type="submit"
                disabled={thinking || !input.trim()}
                className="f3-btn f3-btn-md f3-btn-primary has-leading-icon shrink-0"
              >
                <Send size={14} />
                <span>Send</span>
              </button>
            </div>
            <div className="mt-1.5 flex items-center justify-between px-1 text-[11px] text-[var(--ink-faint)]">
              <span>Enter sends · Shift+Enter newline</span>
              <span>Esc to close</span>
            </div>
          </form>
        </aside>
      )}
    </>
  );
}
