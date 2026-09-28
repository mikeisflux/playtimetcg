"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { cart, useCart } from "@/lib/cartStore";
import { money } from "@/lib/content";
import DivinityCheckoutFrame from "./DivinityCheckoutFrame";

interface Quote { subtotalCents: number; shippingCents: number; taxCents: number; totalCents: number; needsShipping: boolean; problems: string[] }
interface Me { id: string; email: string; name: string; address: Record<string, string> | null }

export default function Checkout({ me, discreet }: { me: Me | null; discreet: boolean }) {
  const { lines } = useCart();
  const [quote, setQuote] = useState<Quote | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [embed, setEmbed] = useState<{ url: string; sessionId: string; orderId: string } | null>(null);
  const payload = lines.map((l) => ({ id: l.id, qty: l.qty, choices: l.choices }));

  useEffect(() => {
    if (!lines.length) { setQuote(null); return; }
    const c = new AbortController();
    fetch("/api/checkout/quote", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lines: payload }), signal: c.signal })
      .then((r) => r.json()).then(setQuote).catch(() => {});
    return () => c.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(payload)]);

  if (!lines.length) {
    return <div className="empty"><div className="t-item-md">Your cart is empty</div><Link className="btn" href="/shop" style={{ alignSelf: "flex-start" }}>Go to the shop</Link></div>;
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr(""); setBusy(true);
    const f = new FormData(e.currentTarget);
    const body = {
      lines: payload,
      email: String(f.get("email") || me?.email || ""),
      shipping: quote?.needsShipping ? {
        name: f.get("name"), line1: f.get("line1"), line2: f.get("line2"), city: f.get("city"), region: f.get("region"), postal: f.get("postal"), country: f.get("country") || "US", phone: f.get("phone"),
      } : null,
      notes: f.get("notes"), discreet: discreet,
    };
    const res = await fetch("/api/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { setErr(data.error || "Checkout failed."); setBusy(false); return; }
    if (data.embed && data.sessionId && data.orderId) {
      /* the card form opens inside this page; the cart is cleared once payment confirms */
      setEmbed({ url: data.url, sessionId: data.sessionId, orderId: data.orderId });
      setBusy(false);
      return;
    }
    cart.clear();
    window.location.href = data.url;
  }

  if (embed) {
    return (
      <div className="grid g-420" style={{ gap: "clamp(32px, 5vw, 72px)", alignItems: "start" }}>
        <div className="stack gap-16">
          <div className="t-item">Pay by card</div>
          <DivinityCheckoutFrame checkoutUrl={embed.url} sessionId={embed.sessionId} confirmPath="/api/checkout/confirm" confirmBody={{ orderId: embed.orderId }} onCancel={() => setEmbed(null)} />
        </div>
        <Summary lines={lines} quote={quote} />
      </div>
    );
  }

  const a = me?.address ?? {};

  return (
    <form className="grid g-420" style={{ gap: "clamp(32px, 5vw, 72px)", alignItems: "start" }} onSubmit={submit}>
      <div className="stack gap-28">
        <div className="stack gap-16">
          <div className="t-item">Contact</div>
          {!me && <div className="note">Have an account? <Link href="/login?next=/checkout">Sign in</Link> to keep this order in your history.</div>}
          <div className="field"><label htmlFor="email">Email</label><input className="input" id="email" name="email" type="email" required defaultValue={me?.email ?? ""} readOnly={!!me} /></div>
        </div>
        {quote?.needsShipping && (
          <div className="stack gap-16">
            <div className="t-item">Shipping</div>
            <div className="field"><label htmlFor="name">Full name</label><input className="input" id="name" name="name" required defaultValue={a.name ?? me?.name ?? ""} autoComplete="name" /></div>
            <div className="field"><label htmlFor="line1">Address</label><input className="input" id="line1" name="line1" required defaultValue={a.line1 ?? ""} autoComplete="address-line1" /></div>
            <div className="field"><label htmlFor="line2">Apartment, suite (optional)</label><input className="input" id="line2" name="line2" defaultValue={a.line2 ?? ""} autoComplete="address-line2" /></div>
            <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 140px), 1fr))", gap: 16 }}>
              <div className="field"><label htmlFor="city">City</label><input className="input" id="city" name="city" required defaultValue={a.city ?? ""} autoComplete="address-level2" /></div>
              <div className="field"><label htmlFor="region">State / region</label><input className="input" id="region" name="region" required defaultValue={a.region ?? ""} autoComplete="address-level1" /></div>
              <div className="field"><label htmlFor="postal">Postal code</label><input className="input" id="postal" name="postal" required defaultValue={a.postal ?? ""} autoComplete="postal-code" /></div>
            </div>
            <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 200px), 1fr))", gap: 16 }}>
              <div className="field"><label htmlFor="country">Country</label>
                <select className="input" id="country" name="country" defaultValue={a.country ?? "US"}>
                  {["US", "CA", "GB", "AU", "NZ", "IE", "DE", "FR", "NL", "SE", "NO", "DK", "FI", "ES", "IT", "PT", "BE", "AT", "CH", "MX", "BR", "JP"].map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="field"><label htmlFor="phone">Phone (for the carrier)</label><input className="input" id="phone" name="phone" defaultValue={a.phone ?? ""} autoComplete="tel" /></div>
            </div>
            {discreet && <div className="note">Ships in plain, discreet packaging. The return label says “PT Games”.</div>}
          </div>
        )}
        <div className="field"><label htmlFor="notes">Order notes (optional)</label><textarea className="input" id="notes" name="notes" maxLength={1000} style={{ minHeight: 80 }} /></div>
      </div>

      <Summary lines={lines} quote={quote}>
        {err && <div className="note note--err" role="alert">{err}</div>}
        <button className="btn" disabled={busy || !quote || quote.problems.length > 0}>{busy ? "Opening secure checkout…" : "Continue to payment"}</button>
        <div className="note">Pay by card right here on this page. We never see or store your card details.</div>
      </Summary>
    </form>
  );
}

function Summary({ lines, quote, children }: { lines: ReturnType<typeof useCart>["lines"]; quote: Quote | null; children?: React.ReactNode }) {
  return (
    <div className="panel panel--surface" style={{ position: "sticky", top: 88 }}>
      <div className="t-item">Summary</div>
      <div className="stack">
        {lines.map((l) => (
          <div key={cart.key(l)} className="row" style={{ justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid var(--rule)", flexWrap: "nowrap" }}>
            <div className="min0"><div className="t-item-sm">{l.name} × {l.qty}</div>{l.choiceNames?.length ? <div className="line__unit">{l.choiceNames.join(" + ")}</div> : null}</div>
            <div className="mono" style={{ fontSize: 14 }}>{money(l.priceCents * l.qty)}</div>
          </div>
        ))}
      </div>
      {quote && (
        <div className="stack" style={{ gap: 6, fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--text-muted)" }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}><span>Subtotal</span><span>{money(quote.subtotalCents)}</span></div>
          <div style={{ display: "flex", justifyContent: "space-between" }}><span>Shipping</span><span>{quote.needsShipping ? (quote.shippingCents ? money(quote.shippingCents) : "Free") : "—"}</span></div>
          <div style={{ display: "flex", justifyContent: "space-between" }}><span>Tax</span><span>{quote.taxCents ? money(quote.taxCents) : "—"}</span></div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", paddingTop: 10, borderTop: "2px solid var(--rule)", marginTop: 6 }}>
            <span className="label" style={{ fontSize: 12 }}>Total</span><span className="subtotal">{money(quote.totalCents)}</span>
          </div>
          {quote.problems.map((p) => <div key={p} className="note note--err">{p}</div>)}
        </div>
      )}
      {children}
    </div>
  );
}
