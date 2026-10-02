/** Streams a Lovable AI Gateway Responses call (raw HTTP SSE) and returns the final text. */
export async function streamResponsesText(opts: {
  apiKey: string;
  model: string;
  instructions: string;
  input: unknown[];
}): Promise<string> {
  const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": opts.apiKey,
      "X-Lovable-AIG-SDK": "fetch",
    },
    body: JSON.stringify({
      model: opts.model,
      stream: true,
      store: false,
      reasoning: { effort: "low", summary: "auto" },
      instructions: opts.instructions,
      input: opts.input,
    }),
  });

  if (!res.ok || !res.body) {
    const body = await res.text().catch(() => "");
    let msg = "";
    try { msg = JSON.parse(body)?.error?.message ?? JSON.parse(body)?.message ?? ""; } catch { msg = body.slice(0, 300); }
    if (res.status === 429) throw new Error("The tutor is busy right now. Please try again in a moment.");
    if (res.status === 402) throw new Error(msg || "AI credits are used up. Please add credits to your workspace.");
    if (res.status === 403) throw new Error(msg || "AI access is blocked for this workspace.");
    if (res.status === 400) throw new Error(msg || "The tutor couldn't read this request (check the attached files).");
    throw new Error(msg || `AI error (${res.status})`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let out = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buf.indexOf("\n\n")) >= 0) {
      const chunk = buf.slice(0, idx);
      buf = buf.slice(idx + 2);
      for (const line of chunk.split("\n")) {
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;
        let ev: { type?: string; delta?: string; error?: { message?: string }; response?: { error?: { message?: string } } };
        try { ev = JSON.parse(payload); } catch { continue; }
        if (ev.type === "response.output_text.delta" && ev.delta) out += ev.delta;
        else if (ev.type === "error" || ev.type === "response.failed") {
          throw new Error(ev.error?.message ?? ev.response?.error?.message ?? "The tutor failed to answer");
        }
      }
    }
  }
  if (!out.trim()) throw new Error("The tutor returned an empty answer. Please rephrase your request as a new message.");
  return out;
}
