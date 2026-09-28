"use client";
import { useState } from "react";

export default function Simulator({ reference, amount, kind, successUrl, cancelUrl }: { reference: string; amount: number; kind: "order" | "subscription"; successUrl: string; cancelUrl: string }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  async function pay(outcome: "completed" | "failed") {
    setBusy(true); setErr("");
    const res = await fetch("/api/checkout/simulate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reference, amount, kind, outcome }) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { setErr(data.error || "Simulation failed"); setBusy(false); return; }
    window.location.href = outcome === "completed" ? successUrl : cancelUrl;
  }
  return (
    <div className="stack gap-12">
      {err && <div className="note note--err">{err}</div>}
      <button className="btn" disabled={busy} onClick={() => pay("completed")}>{busy ? "Posting webhook…" : "Pay (simulate success)"}</button>
      <button className="btn btn--outline" disabled={busy} onClick={() => pay("failed")}>Fail the payment</button>
      <a className="btn btn--text" href={cancelUrl}>Cancel and go back</a>
    </div>
  );
}
