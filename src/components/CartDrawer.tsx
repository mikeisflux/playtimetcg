"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { cart, useCart } from "@/lib/cartStore";
import { money } from "@/lib/content";

export default function CartDrawer({ discreet }: { discreet?: boolean }) {
  const { lines, open, subtotalCents } = useCart();
  const router = useRouter();

  useEffect(() => {
    if (!open) return;
    document.body.classList.add("locked");
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") cart.close(); };
    window.addEventListener("keydown", onKey);
    return () => { document.body.classList.remove("locked"); window.removeEventListener("keydown", onKey); };
  }, [open]);

  if (!open) return null;

  return (
    <>
      <div className="backdrop" onClick={() => cart.close()} />
      <aside className="drawer" role="dialog" aria-modal="true" aria-label="Your cart">
        <div className="drawer__hd">
          <div className="drawer__title">Your cart</div>
          <button className="btn btn--text" onClick={() => cart.close()}>Close</button>
        </div>
        <div className="drawer__body">
          {lines.length === 0 && (
            <div className="empty">
              <div className="t-item-md">Nothing here yet</div>
              <div style={{ fontSize: 15, color: "var(--text-dim)" }}>Start with the base set. Everything else plugs into it.</div>
            </div>
          )}
          {lines.map((l) => {
            const k = cart.key(l);
            return (
              <div key={k} className="line">
                <div className="line__bar" style={{ background: l.accent }} />
                <div className="stack min0" style={{ flex: 1, gap: 4 }}>
                  <div className="line__name">{l.name}</div>
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
        <div className="drawer__ft">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <div className="label" style={{ fontSize: 12, letterSpacing: "0.16em", color: "var(--text-muted)" }}>Subtotal</div>
            <div className="subtotal">{money(subtotalCents)}</div>
          </div>
          <div style={{ fontSize: 13, color: "var(--text-dim)" }}>
            Shipping and tax calculated at checkout.{discreet ? " Ships in discreet packaging." : ""}
          </div>
          <button className="btn" disabled={!lines.length} onClick={() => { cart.close(); router.push("/checkout"); }}>Checkout</button>
        </div>
      </aside>
    </>
  );
}
