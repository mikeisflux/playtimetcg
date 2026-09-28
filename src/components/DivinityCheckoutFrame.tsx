"use client";
import { useCallback, useEffect, useRef, useState } from "react";

/* DivinityCoin's hosted checkout, mounted in an iframe so the shopper never
   leaves playtimetcg.com. DivinityCoin drives the embed with postMessage
   (namespace "divinitycoin-checkout", keyed by sessionId):
     ready    → drop the loading veil
     resize   → mirror the content height
     complete → status complete | failed | expired | canceled
   The session is created with disableAutoRedirect, so on completion we own
   the transition: server-verify through `confirmPath`, then navigate. A
   slow poll backs up the message in case it never lands. Requires our
   origin in DivinityCoin's CHECKOUT_FRAME_ANCESTORS allow-list. */
const NAMESPACE = "divinitycoin-checkout";
type Status = "complete" | "failed" | "expired" | "canceled";
type Msg =
  | { namespace: string; type: "ready"; sessionId: string }
  | { namespace: string; type: "resize"; sessionId: string; height: number }
  | { namespace: string; type: "complete"; sessionId: string; status: Status; redirectUrl?: string; disableAutoRedirect?: boolean };

export default function DivinityCheckoutFrame({ checkoutUrl, sessionId, confirmPath, confirmBody, title = "Secure checkout", onCancel }: {
  checkoutUrl: string; sessionId: string; confirmPath: string; confirmBody: Record<string, string>; title?: string; onCancel?: () => void;
}) {
  const [ready, setReady] = useState(false);
  const [height, setHeight] = useState(520);
  const [error, setError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [slow, setSlow] = useState(false);
  const done = useRef(false);
  const origin = (() => { try { return new URL(checkoutUrl, typeof window !== "undefined" ? window.location.href : "https://playtimetcg.com").origin; } catch { return ""; } })();

  const confirm = useCallback(async (hint?: Status): Promise<boolean> => {
    if (done.current) return true;
    setVerifying(true);
    try {
      const res = await fetch(confirmPath, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...confirmBody, sessionId }) });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) { done.current = true; window.location.href = data.redirect || "/"; return true; }
      if (res.status === 202) { setVerifying(false); return false; }
      done.current = true;
      setError(data.message || data.error || (hint === "failed" ? "Your card couldn’t be processed. Please try a different card." : hint === "expired" ? "The checkout session expired. Please try again." : hint === "canceled" ? "Checkout was cancelled. Nothing was charged." : "We couldn’t verify the payment. If your card was charged, your order will appear in your account within a few minutes."));
      setVerifying(false);
      return true;
    } catch {
      setVerifying(false);
      return false;
    }
  }, [confirmPath, confirmBody, sessionId]);

  useEffect(() => {
    const onMessage = (ev: MessageEvent) => {
      if (origin && ev.origin !== origin) return;
      const m = ev.data as Msg;
      if (!m || typeof m !== "object" || m.namespace !== NAMESPACE || m.sessionId !== sessionId) return;
      if (m.type === "ready") setReady(true);
      else if (m.type === "resize") { if (typeof m.height === "number" && m.height > 200) setHeight(Math.min(m.height, 1600)); }
      else if (m.type === "complete") { setReady(true); void confirm(m.status); }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [origin, sessionId, confirm]);

  /* Backstops: a "slow to load" hint (frame blocked?) and a status poll. */
  useEffect(() => {
    const t = setTimeout(() => { if (!ready) setSlow(true); }, 8000);
    return () => clearTimeout(t);
  }, [ready]);
  useEffect(() => {
    if (!ready) return;
    let stop = false;
    const first = setTimeout(async function tick() {
      if (stop || done.current) return;
      await confirm();
      if (!stop && !done.current) setTimeout(tick, 10_000);
    }, 30_000);
    return () => { stop = true; clearTimeout(first); };
  }, [ready, confirm]);

  async function reopen() {
    const res = await fetch(confirmPath, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...confirmBody, reopen: true }) });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.url) window.location.href = data.url; else setError(data.error || "Could not open DivinityCoin.");
  }

  if (error) {
    return (
      <div className="stack gap-16">
        <div className="note note--err" role="alert">{error}</div>
        {onCancel && <button type="button" className="btn btn--outline" onClick={onCancel}>Back to checkout</button>}
      </div>
    );
  }
  return (
    <div className="stack gap-12">
      <div className="dcframe" style={{ height }}>
        {(!ready || verifying) && (
          <div className="dcframe__veil">
            <div className="label">{verifying ? "Confirming your payment…" : "Loading secure checkout…"}</div>
            {slow && !ready && (
              <div className="stack gap-12" style={{ alignItems: "flex-start" }}>
                <div className="t-body-sm">Taking a while? Your browser may be blocking the embedded checkout.</div>
                <button type="button" className="btn btn--sm" onClick={() => void reopen()}>Open DivinityCoin checkout in this tab</button>
              </div>
            )}
          </div>
        )}
        <iframe src={checkoutUrl} title={title} allow="payment *; publickey-credentials-get *" style={{ width: "100%", height: "100%", border: 0, display: "block" }} />
      </div>
      <div className="note">Payment is handled by DivinityCoin inside this page. We never see your card details.</div>
    </div>
  );
}
