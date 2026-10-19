import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Sparkles, X, Send, ChevronDown, RotateCcw } from "lucide-react";
import { useEntity, useFiscalYear } from "@/lib/entity";
import { useClientContext } from "@/lib/client-context";
import { useInventory, useS1Breakdown, useS2ByFacility, getVal, type S1BreakdownRow } from "@/lib/api";
import { authFetch } from "@/lib/auth";

/* ─── Types ───────────────────────────────────────────────────────────────── */
type Msg = { role: "user" | "assistant"; content: string };

/* ─── AI call via server-side proxy (keys never leave the server) ─────────── */
async function askGroq(messages: Msg[], systemPrompt: string): Promise<string> {
  for (let i = 0; i < 3; i++) {
    try {
      const d = await authFetch("ai.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [{ role: "system", content: systemPrompt }, ...messages],
        }),
      });
      const reply = d.choices?.[0]?.message?.content as string | undefined;
      if (!reply) throw new Error("empty AI response");
      return reply;
    } catch { continue; }
  }
  return "Sorry, I'm having trouble connecting right now. Please try again in a moment.";
}

/* ─── Typing dots ─────────────────────────────────────────────────────────── */
function TypingDots() {
  return (
    <div className="flex items-center gap-1 px-1 py-0.5">
      {[0, 1, 2].map((i) => (
        <span key={i} className="h-1.5 w-1.5 rounded-full bg-[#94A3B8]"
          style={{ animation: "dcBounce 1.2s infinite", animationDelay: `${i * 0.2}s` }} />
      ))}
    </div>
  );
}

/* ─── Render AI message with bullets ─────────────────────────────────────── */
function AIMessage({ content }: { content: string }) {
  const lines = content.split("\n").filter((l) => l.trim() !== "");
  return (
    <div style={{ fontSize: 12.5, lineHeight: 1.65, color: "#1E293B" }}>
      {lines.map((line, i) => {
        const trimmed    = line.trim();
        const isBullet   = /^[-*•]\s/.test(trimmed);
        const isNumbered = /^\d+\.\s/.test(trimmed);
        const isHeader   = trimmed.startsWith("**") && trimmed.endsWith("**");
        const text = trimmed
          .replace(/^[-*•]\s/, "")
          .replace(/^\d+\.\s/, "")
          .replace(/^\*\*(.*)\*\*$/, "$1");
        const parts    = text.split(/\*\*(.*?)\*\*/g);
        const rendered = parts.map((p, j) => j % 2 === 1 ? <strong key={j}>{p}</strong> : p);
        if (isHeader) return (
          <div key={i} style={{ fontWeight: 700, color: "#1B3A5C", marginBottom: 4, marginTop: i > 0 ? 8 : 0 }}>{text}</div>
        );
        if (isBullet || isNumbered) return (
          <div key={i} style={{ display: "flex", gap: 6, marginBottom: 3 }}>
            <span style={{ color: "#1E6F5C", fontWeight: 700, flexShrink: 0, marginTop: 1 }}>•</span>
            <span>{rendered}</span>
          </div>
        );
        return <div key={i} style={{ marginBottom: 4 }}>{rendered}</div>;
      })}
    </div>
  );
}

/* ─── Entity switch banner ─────────────────────────────────────────────────── */
function SwitchBanner({ entityCode, entityName }: { entityCode: string; entityName: string }) {
  return (
    <div style={{
      background: "#E6F4EF", border: "1px solid #1E6F5C30",
      borderRadius: 8, padding: "8px 12px",
      fontSize: 11.5, color: "#1E6F5C", fontWeight: 600, textAlign: "center",
    }}>
      Context switched to <strong>{entityCode}</strong> — ask anything about <strong>{entityName}</strong>
    </div>
  );
}

/* ─── Main component ──────────────────────────────────────────────────────── */
export function DeecarbAI() {
  const { entity }  = useEntity();
  const { fy }      = useFiscalYear();
  const ctx         = useClientContext();
  const { data: invData }   = useInventory(entity);
  const { data: s1BdData }  = useS1Breakdown(entity);
  const { data: s2FacData } = useS2ByFacility(entity);

  const [open,     setOpen]     = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input,    setInput]    = useState("");
  const [loading,  setLoading]  = useState(false);
  const [pulse,    setPulse]    = useState(false);
  const [banner,   setBanner]   = useState<string | null>(null);
  const bottomRef  = useRef<HTMLDivElement>(null);
  const inputRef   = useRef<HTMLTextAreaElement>(null);
  const prevEntity = useRef<string>(entity);

  const entityInfo = (ctx.entities ?? []).find(e => e.code === entity);
  const entityName = entityInfo?.name ?? entity;
  const isConsolidated = entityInfo?.is_consolidated ?? false;

  /* ─── Build system prompt from live data ─────────────────────────────────── */
  const systemPrompt = useMemo(() => {
    const inv = (metric: string, fy: string) => getVal(invData, metric, fy);
    const years = ctx.reporting_years ?? [];

    const inventoryLines = [
      "Scope 1", "Scope 2 LB", "Scope 2 MB", "Scope 3 Total",
      "Scope 1+2 LB", "Grand Total LB",
    ].map(m => {
      const vals = years.map(y => `${y}=${inv(m, y) ?? "-"}`).join(" | ");
      return `  ${m}: ${vals}`;
    }).join("\n");

    const s1BdLines = years.map(y => {
      const stat = (s1BdData ?? []).filter((r: S1BreakdownRow) => r.source === "Stationary").reduce((s: number, r: S1BreakdownRow) => s + (r.series[y] ?? 0), 0);
      const mob  = (s1BdData ?? []).filter((r: S1BreakdownRow) => r.source === "Mobile").reduce((s: number, r: S1BreakdownRow) => s + (r.series[y] ?? 0), 0);
      const fug  = (s1BdData ?? []).filter((r: S1BreakdownRow) => r.source === "Fugitive").reduce((s: number, r: S1BreakdownRow) => s + (r.series[y] ?? 0), 0);
      return `  ${y}: Stationary=${stat.toFixed(2)} | Mobile=${mob.toFixed(2)} | Fugitive=${fug.toFixed(2)} tCO2e`;
    }).join("\n");

    const s2FacLines = (s2FacData ?? [])
      .map(f => `  ${f.facility} (${f.entity}): ${years.map(y => `${y}=${f.series[y] ?? "-"}`).join(" | ")} tCO2e`)
      .join("\n");

    const { base_year_s12, sbti_target_s12, netzero_year } = ctx.targets ?? {};
    const entitiesList = (ctx.entities ?? []).filter(e => !e.is_consolidated)
      .map(e => `  ${e.code}: ${e.name}`).join("\n");

    return `You are DeeCarb AI, the GHG data assistant embedded in this carbon dashboard, built by Deepwoods Green.

CURRENT CONTEXT: Entity = ${entity} (${entityName}) | Fiscal Year = ${fy}

STRICT RULES — FOLLOW THESE WITHOUT EXCEPTION:
1. Answer ONLY questions about GHG emissions, energy, carbon accounting, sustainability data, SBTi targets, I-RECs, facilities, or this dashboard.
2. For EVERY other topic — respond with: "This doesn't come under the scope of this tool. I'm here to help with GHG emissions, sustainability data, and carbon accounting."
3. Use ONLY the data below. Never invent or estimate numbers.
4. If a value is "-" say "not yet available for that year."
5. Always show ALL fiscal years when asked about trends. Never restrict to one year unless the user asks.
6. Format responses with short bullet points. Bold key numbers using **value unit**.

=== CLIENT: ${ctx.client.name} ===

REPORTING ENTITIES:
${entitiesList}

REPORTING YEARS: ${(ctx.reporting_years ?? []).join(", ")}

--- INVENTORY (tCO2e) ---
${inventoryLines}

--- SCOPE 1 BREAKDOWN (tCO2e) ---
${s1BdLines || "  No breakdown data loaded yet."}

--- SCOPE 2 BY FACILITY (tCO2e LB) ---
${s2FacLines || "  No facility data loaded yet."}

--- SBTI TARGETS ---
  Base year: ${base_year_s12 ?? "not set"} | S1+2 target: ${sbti_target_s12 ?? "not set"}% reduction | Net-zero year: ${netzero_year ?? "not set"}

=== END DATA ===`;
  }, [entity, entityName, fy, invData, s1BdData, s2FacData, ctx]);

  /* ─── Dynamic suggestions ────────────────────────────────────────────────── */
  const suggestions = useMemo(() => [
    `What are total GHG emissions across all years?`,
    `What is the Scope 1 breakdown for ${entity}?`,
    `What is the SBTi target and where are we today?`,
    `Compare location-based vs market-based Scope 2`,
    `Which facility has the highest emissions?`,
    `What is the Scope 3 total for ${fy}?`,
  ], [entity, fy]);

  /* ─── Entity switch banner ───────────────────────────────────────────────── */
  useEffect(() => {
    if (prevEntity.current !== entity) {
      prevEntity.current = entity;
      setMessages([]);
      setInput("");
      setBanner(entity);
      setTimeout(() => setBanner(null), 4000);
    }
  }, [entity]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, loading]);
  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 150); }, [open]);
  useEffect(() => {
    const id = setInterval(() => { setPulse(true); setTimeout(() => setPulse(false), 2000); }, 30000);
    return () => clearInterval(id);
  }, []);

  const send = useCallback(async (text: string) => {
    const q = text.trim();
    if (!q || loading) return;
    setInput("");
    const userMsg: Msg = { role: "user", content: q };
    const next = [...messages, userMsg];
    setMessages(next);
    setLoading(true);
    const answer = await askGroq(next, systemPrompt);
    setMessages([...next, { role: "assistant", content: answer }]);
    setLoading(false);
  }, [messages, loading, systemPrompt]);

  const onKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); }
  };

  return (
    <>
      <style>{`
        @keyframes dcBounce {
          0%,80%,100% { transform:translateY(0);opacity:.4; }
          40% { transform:translateY(-4px);opacity:1; }
        }
        @keyframes dcSlideUp {
          from { opacity:0;transform:translateY(24px) scale(.97); }
          to   { opacity:1;transform:translateY(0) scale(1); }
        }
        @keyframes dcPulse {
          0%   { box-shadow:0 0 0 0 rgba(30,111,92,.55); }
          70%  { box-shadow:0 0 0 14px rgba(30,111,92,0); }
          100% { box-shadow:0 0 0 0 rgba(30,111,92,0); }
        }
        @keyframes dcFadeIn {
          from { opacity:0;transform:translateY(-4px); }
          to   { opacity:1;transform:translateY(0); }
        }
      `}</style>

      {/* ── Chat window ─────────────────────────────────────────────────────── */}
      {open && (
        <div style={{
          position: "fixed", bottom: 88, right: 20, zIndex: 9999,
          width: 390, height: 570,
          background: "#fff", borderRadius: 16,
          boxShadow: "0 24px 80px rgba(0,0,0,.18),0 4px 16px rgba(0,0,0,.1)",
          display: "flex", flexDirection: "column", overflow: "hidden",
          animation: "dcSlideUp .22s cubic-bezier(.16,1,.3,1)",
          border: "1px solid rgba(0,0,0,.08)",
        }}>
          {/* Header */}
          <div style={{
            background: "linear-gradient(135deg,#1B3A5C 0%,#1E6F5C 100%)",
            padding: "14px 16px", flexShrink: 0,
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{
                width: 34, height: 34, borderRadius: 10,
                background: "rgba(255,255,255,.15)",
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
              }}><Sparkles size={17} color="#fff" /></div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#fff", lineHeight: 1.2 }}>DeeCarb AI</div>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,.65)", letterSpacing: ".04em" }}>by Deepwoods Green</div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ textAlign: "right", marginRight: 2 }}>
                <span style={{
                  display: "block", fontSize: 10, fontWeight: 700, letterSpacing: ".06em",
                  color: "#1E6F5C", background: "#E6F4EF",
                  padding: "2px 8px", borderRadius: 20, marginBottom: 2,
                }}>{entity}</span>
                <span style={{ fontSize: 9, color: "rgba(255,255,255,.55)" }}>{fy}</span>
              </div>
              <button onClick={() => { setMessages([]); setInput(""); }} title="New chat"
                style={{
                  background: "rgba(255,255,255,.12)", border: "none",
                  borderRadius: 8, padding: "6px", cursor: "pointer",
                  color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
                }}><RotateCcw size={14} /></button>
              <button onClick={() => setOpen(false)} style={{
                background: "rgba(255,255,255,.12)", border: "none",
                borderRadius: 8, padding: "6px", cursor: "pointer",
                color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
              }}><ChevronDown size={16} /></button>
            </div>
          </div>

          {/* Entity switch banner */}
          {banner && (
            <div style={{ padding: "8px 12px", background: "#fff", flexShrink: 0, animation: "dcFadeIn .3s ease" }}>
              <SwitchBanner entityCode={banner} entityName={entityName} />
            </div>
          )}

          {/* Messages */}
          <div style={{
            flex: 1, overflowY: "auto", padding: "12px 14px 8px",
            display: "flex", flexDirection: "column", gap: 10,
            scrollbarWidth: "thin",
          }}>
            {messages.length === 0 && (
              <div>
                <div style={{
                  background: "#F8FAFC", borderRadius: 12,
                  padding: "12px 14px", marginBottom: 12,
                  border: "1px solid #E2E8F0",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 7 }}>
                    <div style={{
                      width: 22, height: 22, borderRadius: 6,
                      background: "linear-gradient(135deg,#1B3A5C,#1E6F5C)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}><Sparkles size={12} color="#fff" /></div>
                    <span style={{ fontWeight: 700, color: "#1B3A5C", fontSize: 13 }}>DeeCarb AI</span>
                  </div>
                  <span style={{ fontSize: 13, color: "#374151", lineHeight: 1.55 }}>
                    Ask me anything about <strong>{entityName}</strong>'s GHG data — all fiscal years, all scopes, any level of detail.
                  </span>
                </div>
                <div style={{ fontSize: 10, fontWeight: 600, color: "#94A3B8", letterSpacing: ".06em", marginBottom: 7, textTransform: "uppercase" }}>
                  Suggested
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                  {suggestions.map((s) => (
                    <button key={s} onClick={() => send(s)} style={{
                      background: "#fff", border: "1px solid #E2E8F0",
                      borderRadius: 8, padding: "7px 10px",
                      fontSize: 12, color: "#374151", textAlign: "left",
                      cursor: "pointer", lineHeight: 1.4, transition: "background .12s",
                    }}
                      onMouseEnter={e => (e.currentTarget.style.background = "#F1F5F9")}
                      onMouseLeave={e => (e.currentTarget.style.background = "#fff")}
                    >{s}</button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, i) => {
              const isUser = m.role === "user";
              return (
                <div key={i} style={{ display: "flex", flexDirection: isUser ? "row-reverse" : "row", alignItems: "flex-end", gap: 7 }}>
                  {!isUser && (
                    <div style={{
                      width: 26, height: 26, borderRadius: 8, flexShrink: 0,
                      background: "linear-gradient(135deg,#1B3A5C,#1E6F5C)",
                      display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 2,
                    }}><Sparkles size={13} color="#fff" /></div>
                  )}
                  <div style={{
                    maxWidth: "80%",
                    background: isUser ? "#1E6F5C" : "#F8FAFC",
                    color: isUser ? "#fff" : "#1E293B",
                    borderRadius: isUser ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
                    padding: "9px 12px",
                    border: isUser ? "none" : "1px solid #E2E8F0",
                    wordBreak: "break-word",
                  }}>
                    {isUser
                      ? <span style={{ fontSize: 13, lineHeight: 1.5 }}>{m.content}</span>
                      : <AIMessage content={m.content} />}
                  </div>
                </div>
              );
            })}

            {loading && (
              <div style={{ display: "flex", alignItems: "flex-end", gap: 7 }}>
                <div style={{
                  width: 26, height: 26, borderRadius: 8, flexShrink: 0,
                  background: "linear-gradient(135deg,#1B3A5C,#1E6F5C)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}><Sparkles size={13} color="#fff" /></div>
                <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: "14px 14px 14px 4px", padding: "9px 14px" }}>
                  <TypingDots />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div style={{
            borderTop: "1px solid #E2E8F0", padding: "10px 12px",
            background: "#fff", flexShrink: 0,
            display: "flex", alignItems: "flex-end", gap: 8,
          }}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={onKey}
              placeholder={`Ask about ${entity} GHG data…`}
              rows={1}
              style={{
                flex: 1, border: "1px solid #E2E8F0", borderRadius: 10,
                padding: "8px 11px", fontSize: 13, fontFamily: "inherit",
                color: "#1E293B", outline: "none", resize: "none",
                lineHeight: 1.5, maxHeight: 100, overflowY: "auto",
                background: "#F8FAFC",
              }}
              onFocus={e => (e.target.style.borderColor = "#1E6F5C")}
              onBlur={e  => (e.target.style.borderColor = "#E2E8F0")}
            />
            <button onClick={() => send(input)} disabled={!input.trim() || loading}
              style={{
                width: 36, height: 36, borderRadius: 10, border: "none",
                background: input.trim() && !loading ? "#1E6F5C" : "#E2E8F0",
                color: "#fff",
                cursor: input.trim() && !loading ? "pointer" : "default",
                display: "flex", alignItems: "center", justifyContent: "center",
                transition: "background .15s", flexShrink: 0,
              }}
            ><Send size={15} /></button>
          </div>
        </div>
      )}

      {/* ── FAB ─────────────────────────────────────────────────────────────── */}
      <button onClick={() => setOpen(!open)}
        style={{
          position: "fixed", bottom: 24, right: 24, zIndex: 9998,
          width: 56, height: 56, borderRadius: "50%", border: "none",
          background: open ? "#1B3A5C" : "linear-gradient(135deg,#1B3A5C 0%,#1E6F5C 100%)",
          color: "#fff", cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 4px 20px rgba(30,111,92,.45),0 2px 8px rgba(0,0,0,.15)",
          animation: pulse && !open ? "dcPulse 1.5s ease-out" : "none",
          transition: "background .2s,transform .15s",
        }}
        onMouseEnter={e => (e.currentTarget.style.transform = "scale(1.07)")}
        onMouseLeave={e => (e.currentTarget.style.transform = "scale(1)")}
        title="DeeCarb AI"
      >
        {open ? <X size={20} /> : <Sparkles size={22} />}
      </button>
    </>
  );
}
