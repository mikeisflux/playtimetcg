"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SubscriptionActions({ id, status, cancelAtPeriodEnd }: { id: string; status: string; cancelAtPeriodEnd: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  async function act(action: string) {
    if (action === "cancel" && !confirm("Cancel this subscription? It stays active until the end of the current period.")) return;
    setBusy(true); setErr("");
    const res = await fetch("/api/account/subscriptions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, action }) });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setErr(data.error || "Something went wrong."); return; }
    if (data.url) { window.location.href = data.url; return; }
    router.refresh();
  }
  return (
    <div className="stack gap-12">
      {err && <div className="note note--err">{err}</div>}
      <div className="row">
        {status === "pending" && <button className="btn btn--md" disabled={busy} onClick={() => act("resume")}>Finish payment</button>}
        {status !== "pending" && !cancelAtPeriodEnd && <button className="btn btn--ghost" disabled={busy} onClick={() => act("cancel")}>Cancel</button>}
        {cancelAtPeriodEnd && <button className="btn btn--outline btn--md" disabled={busy} onClick={() => act("keep")}>Keep it going</button>}
      </div>
    </div>
  );
}
