import React, { useEffect, useRef, useState } from "react";
import Layout from "@/components/Layout";
import { API } from "@/lib/api";
import { PaperPlaneRightIcon, RobotIcon, UserIcon, SparkleIcon } from "@phosphor-icons/react";

const SUGGESTIONS = [
  "What worked best for stuck pipe in Wolfcamp?",
  "Compare CASE-001 and CASE-003 — why did outcomes differ?",
  "Should we shut in the Bakken 2245 event?",
  "Any conflicting evidence I should trust less?",
];

export default function Assistant() {
  const [messages, setMessages] = useState([
    { role: "assistant", content: "RigRecall online. I've indexed 8 historical drilling cases with measured outcomes and 17 evidence records. Ask about patterns, actions that worked, or conflicting reports." }
  ]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [sessionId] = useState(() => `sess_${Date.now()}`);
  const scrollRef = useRef(null);

  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }); }, [messages]);

  const send = async (text) => {
    const q = text ?? input;
    if (!q.trim() || streaming) return;
    setInput("");
    setMessages(m => [...m, { role: "user", content: q }, { role: "assistant", content: "" }]);
    setStreaming(true);

    try {
      const res = await fetch(`${API}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId, message: q }),
      });
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop();
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const evt = JSON.parse(line.slice(6));
              if (evt.type === "delta") {
                setMessages(m => {
                  const nm = [...m];
                  nm[nm.length - 1] = { ...nm[nm.length - 1], content: nm[nm.length - 1].content + evt.content };
                  return nm;
                });
              }
            } catch (e) {
              console.error("Failed to parse SSE chunk:", e);
            }
          }
        }
      }
    } catch (e) {
      setMessages(m => {
        const nm = [...m];
        nm[nm.length - 1] = { role: "assistant", content: "Error reaching RigRecall AI. Check the server logs." };
        return nm;
      });
    } finally {
      setStreaming(false);
    }
  };

  return (
    <Layout title="AI Assistant" subtitle="Claude Sonnet 5 · Reasons over drilling case memory">
      <div className="grid grid-cols-12 gap-4 h-[calc(100vh-220px)]">
        <div className="col-span-12 md:col-span-9 border border-[#262626] bg-[#121212] flex flex-col" data-testid="chat-panel">
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-5">
            {messages.map((m, i) => (
              <div key={i} className="flex gap-3" data-testid={`msg-${m.role}-${i}`}>
                <div className={`w-8 h-8 flex-shrink-0 flex items-center justify-center ${m.role === "user" ? "bg-[#1E1E1E]" : "bg-[#FFB000]"}`}>
                  {m.role === "user" ? <UserIcon size={16} className="text-white" /> : <RobotIcon size={16} weight="fill" className="text-black" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] text-[#71717A] tracking-widest mb-1 font-display font-bold">
                    {m.role === "user" ? "YOU" : "RIGRECALL AI"}
                  </div>
                  <div className="text-[13px] leading-relaxed text-white whitespace-pre-wrap font-mono">
                    {m.content}
                    {streaming && i === messages.length - 1 && m.role === "assistant" && (
                      <span className="inline-block w-2 h-4 bg-[#FFB000] ml-1 animate-pulse" />
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="border-t border-[#262626] p-3 flex gap-2">
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && send()}
              placeholder="Ask about a case, action outcome, or conflicting evidence..."
              className="flex-1 bg-[#0A0A0A] border border-[#262626] px-3 py-2 text-[13px] text-white font-mono focus:outline-none focus:border-[#FFB000]"
              data-testid="chat-input"
              disabled={streaming}
            />
            <button onClick={() => send()} className="btn-amber flex items-center gap-1" data-testid="chat-send" disabled={streaming}>
              SEND <PaperPlaneRightIcon size={12} weight="fill" />
            </button>
          </div>
        </div>

        <div className="col-span-12 md:col-span-3 border border-[#262626] bg-[#121212] p-4" data-testid="suggestions-panel">
          <div className="flex items-center gap-2 mb-3">
            <SparkleIcon size={14} className="text-[#FFB000]" weight="fill" />
            <div className="font-display font-bold text-xs tracking-widest text-[#71717A]">TRY ASKING</div>
          </div>
          <div className="space-y-2">
            {SUGGESTIONS.map((s, i) => (
              <button key={i} onClick={() => send(s)}
                data-testid={`suggest-${i}`}
                className="w-full text-left border border-[#262626] p-3 text-[12px] text-[#A1A1AA] hover:border-[#FFB000] hover:text-white transition-colors">
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>
    </Layout>
  );
}
