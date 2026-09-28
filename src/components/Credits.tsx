"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { money } from "@/lib/content";

interface Ledger { id: string; type: string; amountCents: number; description: string | null; createdAt: string }

/* Mirrors the CreatorCredits RedeemCreditsForm (divinitycoin spec §9.6):
   16-hex code formatted XXXX-XXXX-XXXX-XXXX, redeemed server-side. */
export default function Credits({ configured, balance, error, buyUrl, ledger }: { configured: boolean; balance: { available: number; held: number; total: number } | null; error: string; buyUrl: string; ledger: Ledger[] }) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  function format(v: string) {
    const clean = v.toUpperCase().replace(/[^0-9A-F]/g, "").slice(0, 16);
    return clean.match(/.{1,4}/g)?.join("-") ?? clean;
  }

  async function redeem(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading"); setMessage("");
    const res = await fetch("/api/account/credits/redeem", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }) });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.success) {
      setStatus("success"); setMessage(`${money(Math.round((data.amount ?? 0) * 100))} added to your balance.`); setCode("");
      router.refresh();
    } else { setStatus("error"); setMessage(data.error || "Failed to redeem code."); }
  }

  return (
    <div className="grid g-420" style={{ gap: "clamp(32px, 5vw, 72px)", alignItems: "start" }}>
      <div className="stack gap-28">
        <div className="stack gap-12">
          <div className="t-item">Balance</div>
          {!configured && <div className="t-body-sm">DivinityCoin credits aren’t enabled on this store yet.</div>}
          {error && <div className="note note--err">{error}</div>}
          {balance && (
            <div className="row" style={{ gap: 32, alignItems: "flex-start" }}>
              <div className="stack" style={{ gap: 4 }}><div className="num" style={{ fontSize: 40 }}>{money(Math.round(balance.available * 100))}</div><div className="label">Available</div></div>
              <div className="stack" style={{ gap: 4 }}><div className="num">{money(Math.round(balance.held * 100))}</div><div className="label">On hold</div></div>
              <div className="stack" style={{ gap: 4 }}><div className="num">{money(Math.round(balance.total * 100))}</div><div className="label">Total</div></div>
            </div>
          )}
          <p className="t-body-sm">Credits are bought on DivinityCoin and redeemed here with a code. At checkout, pick “Pay with credits” to use them.</p>
          <a className="btn btn--outline" href={buyUrl} target="_blank" rel="noopener" style={{ alignSelf: "flex-start" }}>Buy credits on DivinityCoin</a>
        </div>
        <form className="form" onSubmit={redeem}>
          <div className="t-item">Redeem a code</div>
          <div className="field">
            <label htmlFor="code">Enter your credit code</label>
            <input id="code" className="input mono" value={code} onChange={(e) => setCode(format(e.target.value))} placeholder="XXXX-XXXX-XXXX-XXXX" maxLength={19} autoComplete="off" spellCheck={false} style={{ letterSpacing: "0.12em", fontSize: 18 }} />
          </div>
          {message && <div className={`note ${status === "success" ? "note--ok" : "note--err"}`} role="status">{message}</div>}
          <button className="btn" disabled={status === "loading" || code.replace(/-/g, "").length !== 16 || !configured}>{status === "loading" ? "Redeeming…" : "Redeem"}</button>
        </form>
      </div>
      <div className="stack gap-16">
        <div className="t-item">Activity</div>
        {ledger.length === 0 && <div className="t-body-sm">No credit activity yet.</div>}
        <div className="stack">
          {ledger.map((l) => (
            <div key={l.id} className="line" style={{ padding: "12px 0" }}>
              <div className="stack min0" style={{ flex: 1, gap: 2 }}>
                <div className="t-item-sm">{l.type}</div>
                <div className="line__unit">{new Date(l.createdAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}{l.description ? ` · ${l.description}` : ""}</div>
              </div>
              <div className="line__total" style={{ color: l.amountCents < 0 ? "var(--text-muted)" : "var(--heat-1)" }}>{l.amountCents < 0 ? "−" : "+"}{money(Math.abs(l.amountCents))}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
