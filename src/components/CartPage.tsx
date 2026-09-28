"use client";
import Link from "next/link";
import { cart, useCart } from "@/lib/cartStore";
import { money } from "@/lib/content";

export default function CartPage({ discreet }: { discreet?: boolean }) {
  const { lines, subtotalCents } = useCart();
  if (!lines.length) {
    return (
      <div className="empty">
        <div className="t-item-md">Nothing here yet</div>
        <div style={{ fontSize: 15, color: "var(--text-dim)" }}>Start with the base set. Everything else plugs into it.</div>
        <Link className="btn" href="/shop" style={{ alignSelf: "flex-start", marginTop: 12 }}>Go to the shop</Link>
      </div>
    );
  }
  return (
    <div className="grid g-420" style={{ gap: "clamp(32px, 5vw, 72px)", alignItems: "start" }}>
      <div className="stack">
        {lines.map((l) => {
          const k = cart.key(l);
          return (
            <div key={k} className="line">
              <div className="line__bar" style={{ background: l.accent }} />
              <div className="stack min0" style={{ flex: 1, gap: 4 }}>
                <Link href={`/shop/${l.slug}`} className="line__name" style={{ color: "var(--text-strong)" }}>{l.name}</Link>
                {l.choiceNames?.length ? <div className="line__unit">{l.choiceNames.join(" + ")}</div> : null}
                <div className="line__unit">{money(l.priceCents)} each{l.digital ? " · digital" : ""}</div>
              </div>
              <div className="stepper">
                <button onClick={() => cart.setQty(k, l.qty - 1)} aria-label="Decrease">−</button>
                <span>{l.qty}</span>
                <button onClick={() => cart.setQty(k, l.qty + 1)} aria-label="Increase">+</button>
              </div>
              <div className="line__total">{money(l.priceCents * l.qty)}</div>
            </div>
          );
        })}
      </div>
      <div className="panel panel--surface">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <div className="label" style={{ fontSize: 12, letterSpacing: "0.16em", color: "var(--text-muted)" }}>Subtotal</div>
          <div className="subtotal">{money(subtotalCents)}</div>
        </div>
        <div style={{ fontSize: 13, color: "var(--text-dim)" }}>Shipping and tax calculated at checkout.{discreet ? " Ships in discreet packaging." : ""}</div>
        <Link className="btn" href="/checkout">Checkout</Link>
        <button className="btn btn--text" onClick={() => cart.clear()} style={{ alignSelf: "flex-start" }}>Empty cart</button>
      </div>
    </div>
  );
}
