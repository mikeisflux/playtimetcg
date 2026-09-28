"use client";
import { useEffect, useState } from "react";

/* Test-mode stand-in for DivinityCoin's hosted checkout. Inside an iframe it
   speaks the same postMessage protocol (ready / resize / complete) so the
   embedded checkout can be exercised end to end. */
const NAMESPACE = "divinitycoin-checkout";
export default function Simulator({ reference, amount, kind, successUrl, cancelUrl }: { reference: string; amount: number; kind: "order" | "subscription"; successUrl: string; cancelUrl: string }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const sessionId = kind === "subscription" ? `cs_test_setup_${reference}` : `cs_test_${reference}`;
  /* decided after mount so server and client render the same markup */
  const [embedded, setEmbedded] = useState(false);
  useEffect(() => {
    const inFrame = window.parent !== window;
    setEmbedded(inFrame);
    if (!inFrame) return;
    window.parent.postMessage({ namespace: NAMESPACE, type: "ready", sessionId }, "*");
    window.parent.postMessage({ namespace: NAMESPACE, type: "resize", sessionId, height: Math.max(420, document.body.scrollHeight) }, "*");
  }, [sessionId]);
  function finish(status: "complete" | "failed" | "canceled") {
    if (embedded) { window.parent.postMessage({ namespace: NAMESPACE, type: "complete", sessionId, status, disableAutoRedirect: true }, "*"); return; }
    window.location.href = status === "complete" ? successUrl : cancelUrl;
  }
  async function pay(outcome: "completed" | "failed") {
    setBusy(true); setErr("");
    const res = await fetch("/api/checkout/simulate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reference, amount, kind, outcome }) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { setErr(data.error || "Simulation failed"); setBusy(false); return; }
    finish(outcome === "completed" ? "complete" : "failed");
  }
  return (
    <div className="stack gap-12">
      {err && <div className="note note--err">{err}</div>}
      <button className="btn" disabled={busy} onClick={() => pay("completed")}>{busy ? "Posting webhook…" : "Pay (simulate success)"}</button>
      <button className="btn btn--outline" disabled={busy} onClick={() => pay("failed")}>Fail the payment</button>
      {embedded ? <button className="btn btn--text" disabled={busy} onClick={() => finish("canceled")}>Cancel and go back</button> : <a className="btn btn--text" href={cancelUrl}>Cancel and go back</a>}
    </div>
  );
}
