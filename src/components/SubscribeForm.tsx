"use client";
import { useState } from "react";
import DivinityCheckoutFrame from "./DivinityCheckoutFrame";

export default function SubscribeForm({ productId, needsShipping, address }: { productId: string; needsShipping: boolean; address: Record<string, string> }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [embed, setEmbed] = useState<{ url: string; sessionId: string; subscriptionId: string } | null>(null);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setBusy(true); setErr("");
    const f = new FormData(e.currentTarget);
    const shipping = needsShipping ? Object.fromEntries(["name", "line1", "line2", "city", "region", "postal", "country", "phone"].map((k) => [k, String(f.get(k) || "")])) : undefined;
    const res = await fetch("/api/subscriptions/start", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ productId, shipping }) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { setErr(data.error || "Could not start the subscription."); setBusy(false); return; }
    if (data.embed && data.sessionId && data.subscriptionId) { setEmbed({ url: data.url, sessionId: data.sessionId, subscriptionId: data.subscriptionId }); setBusy(false); return; }
    window.location.href = data.url;
  }
  const a = address;
  if (embed) {
    return (
      <div className="stack gap-16">
        <div className="t-item">Save a card with DivinityCoin</div>
        <DivinityCheckoutFrame checkoutUrl={embed.url} sessionId={embed.sessionId} confirmPath="/api/subscriptions/confirm" confirmBody={{ subscriptionId: embed.subscriptionId }} title="Save your card" onCancel={() => setEmbed(null)} />
      </div>
    );
  }
  return (
    <form className="form" onSubmit={submit}>
      {needsShipping && (
        <>
          <div className="t-item">Where should the cards go?</div>
          <div className="field"><label htmlFor="name">Full name</label><input className="input" id="name" name="name" required defaultValue={a.name} /></div>
          <div className="field"><label htmlFor="line1">Address</label><input className="input" id="line1" name="line1" required defaultValue={a.line1} /></div>
          <div className="field"><label htmlFor="line2">Apartment, suite (optional)</label><input className="input" id="line2" name="line2" defaultValue={a.line2} /></div>
          <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 120px), 1fr))", gap: 16 }}>
            <div className="field"><label htmlFor="city">City</label><input className="input" id="city" name="city" required defaultValue={a.city} /></div>
            <div className="field"><label htmlFor="region">State</label><input className="input" id="region" name="region" required defaultValue={a.region} /></div>
            <div className="field"><label htmlFor="postal">Postal</label><input className="input" id="postal" name="postal" required defaultValue={a.postal} /></div>
          </div>
          <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 160px), 1fr))", gap: 16 }}>
            <div className="field"><label htmlFor="country">Country</label><input className="input" id="country" name="country" required maxLength={2} defaultValue={a.country || "US"} /></div>
            <div className="field"><label htmlFor="phone">Phone</label><input className="input" id="phone" name="phone" defaultValue={a.phone} /></div>
          </div>
          <div className="note">Ships in a plain envelope, discreetly.</div>
        </>
      )}
      {err && <div className="note note--err">{err}</div>}
      <button className="btn" disabled={busy}>{busy ? "Opening secure checkout…" : "Continue to payment"}</button>
    </form>
  );
}
